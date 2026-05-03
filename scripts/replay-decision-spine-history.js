#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SESSION_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');
const DERIVED_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'derived');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const REPORT_MD = path.join(ARTIFACT_DIR, 'HISTORICAL_DECISION_SPINE_REPLAY.md');
const REPORT_JSON = path.join(ARTIFACT_DIR, 'historical-decision-spine-replay.json');
const TEMP_MEMORY_FILE = path.join(ROOT, 'state', 'runtime', 'historical-replay-level-memory.json');
const SATY_FILE = path.join(ROOT, 'data', 'saty-levels.json');
const DUBZ_FILE = path.join(ROOT, 'data', 'dubz-levels.json');

const DEFAULT_DATES = ['2026-04-09', '2026-04-10', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-27', '2026-04-28'];
const CHECKPOINT_TIMES = ['10:05', '11:30', '13:00'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, idx) => {
      try { return JSON.parse(line); }
      catch (err) { throw new Error(`${filePath}:${idx + 1}: ${err.message}`); }
    });
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return { existed: false, content: null };
  return { existed: true, content: fs.readFileSync(filePath, 'utf8') };
}

function restoreFile(filePath, backup) {
  if (backup.existed) {
    fs.writeFileSync(filePath, backup.content);
  } else if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function checkpointIso(date, hhmm) {
  return `${date}T${hhmm}:00-04:00`;
}

function hhmmFromIso(timestamp) {
  const match = String(timestamp || '').match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function tsMs(timestamp) {
  return new Date(timestamp).getTime();
}

function barAtOrBefore(bars, timestamp) {
  const target = tsMs(timestamp);
  let found = null;
  for (const bar of bars || []) {
    if (tsMs(bar.timestamp) <= target) found = bar;
    else break;
  }
  return found;
}

function barsAfter(bars, timestamp) {
  const target = tsMs(timestamp);
  return (bars || []).filter(bar => tsMs(bar.timestamp) > target);
}

function classifyDirection(role, source) {
  const text = String(role || '').toLowerCase();
  if (source === 'bobby_image' || source === 'bobby_text') return null;
  if (text.includes('support') || text.includes('reclaim') || text.includes('put_trigger')) return 'support';
  if (text.includes('resistance') || text.includes('call_trigger')) return 'resistance';
  return null;
}

function classifySignificance(role, source) {
  const text = String(role || '').toLowerCase();
  if (source === 'bobby_image') return 'key';
  if (source === 'bobby_text') return 'key';
  if (text.includes('trigger') || text.includes('support') || text.includes('resistance') || text.includes('chop')) return 'key';
  return 'unclear';
}

function appendMention(records, { analyst, instrument, price, timestamp, sourceType, role, sourceId }) {
  if (!Number.isFinite(price)) return;
  const key = `${instrument}:${price.toFixed(2)}`;
  if (!records.has(key)) {
    records.set(key, {
      canonical_price: price,
      instrument,
      first_seen: timestamp,
      last_seen: timestamp,
      total_mentions: 0,
      mentions: [],
    });
  }
  const record = records.get(key);
  record.last_seen = timestamp;
  record.mentions.push({
    analyst,
    date: timestamp.slice(0, 10),
    timestamp,
    significance: classifySignificance(role, sourceType),
    direction: classifyDirection(role, sourceType),
    intent: role === 'chop_zone' ? 'chop_boundary' : null,
    source_type: sourceType,
    source_snippet: role ? String(role) : null,
    source_id: sourceId || `${sourceType}:${timestamp}:${price}`,
    crossSourceConfirmed: false,
  });
  record.total_mentions = record.mentions.length;
}

function buildMemoryForCheckpoint(session, bobbyParses, checkpoint) {
  const records = new Map();

  for (const level of session.levels || []) {
    const source = level.source || 'unknown';
    if (source === 'saty') {
      appendMention(records, {
        analyst: 'saty',
        instrument: 'ES',
        price: Number(level.price),
        timestamp: checkpoint,
        sourceType: 'historical_saty',
        role: level.label || source,
        sourceId: `saty:${session.date}:${level.label || level.price}`,
      });
    } else if (source === 'mancini') {
      appendMention(records, {
        analyst: 'mancini',
        instrument: 'ES',
        price: Number(level.price),
        timestamp: checkpoint,
        sourceType: 'historical_mancini',
        role: level.role || source,
        sourceId: `mancini:${session.date}:${level.postIndex || 'na'}:${level.price}`,
      });
    } else if (source === 'bobby_text') {
      appendMention(records, {
        analyst: 'bobby',
        instrument: 'ES',
        price: Number(level.price),
        timestamp: checkpoint,
        sourceType: 'historical_bobby_text',
        role: 'king_node',
        sourceId: `bobby_text:${session.date}:${level.messageId || level.price}`,
      });
    }
  }

  const checkpointMs = tsMs(checkpoint);
  for (const parse of bobbyParses) {
    if (parse.tradingDateET !== session.date) continue;
    if (parse.parseStatus !== 'ok') continue;
    if (tsMs(parse.timestamp) > checkpointMs) continue;
    for (const level of parse.levels || []) {
      appendMention(records, {
        analyst: 'bobby',
        instrument: String(level.ticker || '').toUpperCase().startsWith('SP') ? 'SPX' : 'ES',
        price: Number(level.price),
        timestamp: parse.timestamp,
        sourceType: 'bobby_image',
        role: level.role || 'king_node',
        sourceId: `bobby_image:${parse.attachmentId}:${level.price}`,
      });
    }
  }

  return {
    version: 1,
    last_updated: checkpoint,
    levels: [...records.values()],
  };
}

function writeTempSaty(session, checkpoint) {
  const levels = session.saty?.levels;
  if (!levels || levels.valid !== true) {
    fs.writeFileSync(SATY_FILE, JSON.stringify({ updated: checkpoint, valid: false }, null, 2));
    return;
  }
  fs.writeFileSync(SATY_FILE, JSON.stringify({ ...levels, updated: checkpoint }, null, 2));
}

function writeTempDubz(session, checkpoint) {
  const esLevels = (session.levels || [])
    .filter(level => level.source === 'mancini' || level.source === 'saty')
    .slice(0, 8)
    .map(level => ({
      price: level.price,
      significance: classifySignificance(level.role || level.label, level.source),
      significance_signal: 'historical_replay',
      direction: classifyDirection(level.role || level.label, level.source),
      intent: null,
      source: 'historical_replay',
      source_snippet: `${level.source}:${level.role || level.label || 'level'}`,
      crossSourceConfirmed: false,
    }));
  fs.writeFileSync(DUBZ_FILE, JSON.stringify({
    date: session.date,
    last_updated: checkpoint,
    source_pastes: [{ source: 'historical_replay', timestamp: checkpoint }],
    instruments: { ES: { levels: esLevels }, NQ: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] } },
    conflicts: [],
    parse_errors: [],
  }, null, 2));
}

function simulateOutcome(decision, bars, checkpoint) {
  const d = decision?.decision || decision;
  if (!d || !(d.action === 'LONG' || d.action === 'SHORT')) {
    return { status: 'NOT_ACTIONABLE', detail: d?.reason || 'pass' };
  }
  if (![d.entry, d.stop, d.target].every(Number.isFinite)) {
    return { status: 'NO_PLAN', detail: 'entry/stop/target incomplete' };
  }
  const future = barsAfter(bars, checkpoint);
  let filledAt = null;
  for (const bar of future) {
    if (bar.low <= d.entry && bar.high >= d.entry) {
      filledAt = bar.timestamp;
      break;
    }
  }
  if (!filledAt) return { status: 'NO_FILL', detail: `entry ${d.entry} not touched after checkpoint` };

  for (const bar of future.filter(b => tsMs(b.timestamp) >= tsMs(filledAt))) {
    const hitStop = d.action === 'LONG' ? bar.low <= d.stop : bar.high >= d.stop;
    const hitTarget = d.action === 'LONG' ? bar.high >= d.target : bar.low <= d.target;
    if (hitStop && hitTarget) return { status: 'AMBIGUOUS', detail: `stop and target touched in ${bar.timestamp}`, filledAt };
    if (hitTarget) return { status: 'TARGET_FIRST', detail: `target ${d.target} touched at ${bar.timestamp}`, filledAt };
    if (hitStop) return { status: 'STOP_FIRST', detail: `stop ${d.stop} touched at ${bar.timestamp}`, filledAt };
  }
  return { status: 'OPEN_AT_END', detail: 'entry filled, neither stop nor target touched by session end', filledAt };
}

function summarizeDecision(response) {
  const decision = response.decision;
  return {
    ok: decision.ok,
    action: decision.action,
    reason: decision.reason,
    anchor: decision.confluence?.anchor ?? null,
    entry: decision.entry,
    acceptable_entry: decision.acceptable_entry,
    stop: decision.stop,
    target: decision.target,
    sizing: decision.sizing,
    vetoes: decision.vetoes || [],
    warnings: response.warnings || [],
  };
}

function parseArgs(argv) {
  const args = { dates: DEFAULT_DATES, times: CHECKPOINT_TIMES };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--dates') {
      args.dates = next.split(',').map(s => s.trim()).filter(Boolean);
      i += 1;
    } else if (flag === '--times') {
      args.times = next.split(',').map(s => s.trim()).filter(Boolean);
      i += 1;
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

function renderMarkdown(result) {
  const lines = [
    '# Historical Decision Spine Replay',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Verdict: ${result.verdict}`,
    '',
    '## Inputs',
    `- Dates: ${result.dates.join(', ')}`,
    '- Price source: local ES minute bars from `data/backtest/es-long-bracket/sessions/*.json`.',
    '- Analyst source: derived Saty, Mancini posts, Bobby text levels, and cached Bobby image parses where available.',
    '- Execution: none. This only calls the decision spine/decision adapter and simulates fills from historical bars.',
    '- State writes: temporary Saty/Dubz files are backed up and restored; Level Memory uses an ignored temp file.',
    '',
    '## Summary',
    `- Checkpoints: ${result.checkpoints.length}`,
    `- Raw spine trade plans before adapter WAIT/SKIP blocks: ${result.counts.spinePlans}`,
    `- Actionable decisions: ${result.counts.actionable}`,
    `- PASS/WAIT decisions: ${result.counts.pass}`,
    `- Mancini vetoes observed: ${result.counts.manciniVeto}`,
    `- Bobby parsed-level checkpoints: ${result.counts.withBobbyParsed}`,
    `- Bobby image-present-but-unparsed days: ${result.imageOnlyUnparsedDates.join(', ') || 'none'}`,
    '',
    '## Checkpoints',
    '| Date | Time | Source | ES close | Bobby parsed | Action | Spine | Anchor | Entry | Stop | Target | Sizing | Vetoes | Outcome |',
    '| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
  ];

  for (const row of result.checkpoints) {
    lines.push([
      row.date,
      row.time,
      row.source,
      row.price,
      row.bobbyParsedLevels,
      row.decision.action,
      row.spineAction,
      row.decision.anchor ?? '',
      row.decision.entry ?? '',
      row.decision.stop ?? '',
      row.decision.target ?? '',
      row.decision.sizing,
      row.decision.vetoes.map(v => v.type).join(', ') || 'none',
      row.outcome.status,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push('', '## Blocked/Not Proven');
  for (const item of result.blocked) lines.push(`- ${item}`);
  lines.push('', '## Artifact');
  lines.push(`- JSON: ${path.relative(ROOT, REPORT_JSON).replace(/\\/g, '/')}`);
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/replay-decision-spine-history.js [--dates YYYY-MM-DD,...] [--times HH:MM,...]');
    return;
  }

  ensureDir(ARTIFACT_DIR);
  ensureDir(path.dirname(TEMP_MEMORY_FILE));

  const satyBackup = backupFile(SATY_FILE);
  const dubzBackup = backupFile(DUBZ_FILE);
  const originalDateNow = Date.now;

  const { _internal: levelMemoryInternal } = require('../lib/level-memory');
  const bobbyParses = readJsonl(path.join(DERIVED_DIR, 'bobby-image-parses.jsonl'));
  const candidates = readJsonl(path.join(DERIVED_DIR, 'long-candidates.jsonl'));
  const { buildDecisionResponse } = require('../lib/operator/decision-adapter');

  const checkpoints = [];
  const blocked = [];
  const imageOnlyUnparsedDates = [];

  try {
    levelMemoryInternal._setMemoryFile(TEMP_MEMORY_FILE);

    for (const date of args.dates) {
      const sessionPath = path.join(SESSION_DIR, `${date}.json`);
      if (!fs.existsSync(sessionPath)) {
        blocked.push(`${date}: missing session JSON`);
        continue;
      }
      const session = readJson(sessionPath);
      const bars = session.bars?.es || [];
      const imageCount = session.bobby?.images?.length || 0;
      const parsedForDate = bobbyParses.filter(p => p.tradingDateET === date && p.parseStatus === 'ok' && (p.levelCount || 0) > 0);
      if (imageCount > 0 && parsedForDate.length === 0) imageOnlyUnparsedDates.push(date);

      if (!bars.length) {
        blocked.push(`${date}: no ES minute bars`);
        continue;
      }

      const checkpointSpecs = [];
      const seenTimes = new Set();
      for (const time of args.times) {
        if (seenTimes.has(time)) continue;
        seenTimes.add(time);
        checkpointSpecs.push({ time, source: 'fixed' });
      }
      for (const candidate of candidates.filter(row => row.date === date).slice(0, 2)) {
        const time = hhmmFromIso(candidate.time);
        if (!time || seenTimes.has(time)) continue;
        seenTimes.add(time);
        checkpointSpecs.push({ time, source: `candidate:${candidate.triggerType || 'long'}` });
      }

      for (const spec of checkpointSpecs) {
        const { time } = spec;
        const checkpoint = checkpointIso(date, time);
        const bar = barAtOrBefore(bars, checkpoint);
        if (!bar) {
          blocked.push(`${date} ${time}: no ES bar at/before checkpoint`);
          continue;
        }

        const memory = buildMemoryForCheckpoint(session, bobbyParses, checkpoint);
        fs.writeFileSync(TEMP_MEMORY_FILE, JSON.stringify(memory, null, 2));
        writeTempSaty(session, checkpoint);
        writeTempDubz(session, checkpoint);

        Date.now = () => tsMs(checkpoint);
        const response = await buildDecisionResponse({
          instrument: 'ES',
          mode: 'historical-replay',
          currentPrice: bar.close,
          now: new Date(checkpoint),
          getLivePriceFn: false,
          getMarketPriceFn: false,
        });

        const decision = summarizeDecision(response);
        const outcome = simulateOutcome(response, bars, checkpoint);
        const bobbyParsedLevels = memory.levels.reduce((sum, record) =>
          sum + (record.mentions || []).filter(m => m.analyst === 'bobby').length, 0);

        checkpoints.push({
          date,
          time,
          source: spec.source,
          checkpoint,
          price: bar.close,
          bobbyImages: imageCount,
          bobbyParsedLevels,
          decision,
          spineAction: response.spine_decision?.action || null,
          outcome,
        });
      }
    }
  } finally {
    Date.now = originalDateNow;
    levelMemoryInternal._setMemoryFile(path.join(ROOT, 'data', 'level-memory.json'));
    restoreFile(SATY_FILE, satyBackup);
    restoreFile(DUBZ_FILE, dubzBackup);
    if (fs.existsSync(TEMP_MEMORY_FILE)) fs.unlinkSync(TEMP_MEMORY_FILE);
  }

  const counts = checkpoints.reduce((acc, row) => {
    if (row.decision.action === 'LONG' || row.decision.action === 'SHORT') acc.actionable += 1;
    else acc.pass += 1;
    if (row.spineAction === 'LONG' || row.spineAction === 'SHORT') acc.spinePlans += 1;
    if (row.decision.vetoes.some(v => v.type === 'mancini_chop_zone')) acc.manciniVeto += 1;
    if (row.bobbyParsedLevels > 0) acc.withBobbyParsed += 1;
    return acc;
  }, { actionable: 0, pass: 0, spinePlans: 0, manciniVeto: 0, withBobbyParsed: 0 });

  if (counts.withBobbyParsed === 0) blocked.push('No checkpoint had parsed Bobby levels; heatmap actionability was not proven.');
  if (checkpoints.length === 0) blocked.push('No checkpoints were replayed.');

  const result = {
    verdict: blocked.length ? 'HISTORICAL_REPLAY_PASS_WITH_LIMITATIONS' : 'HISTORICAL_REPLAY_PASS',
    dates: args.dates,
    times: args.times,
    counts,
    imageOnlyUnparsedDates: [...new Set(imageOnlyUnparsedDates)],
    blocked,
    checkpoints,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(result));

  console.log(`historical replay verdict: ${result.verdict}`);
  console.log(`checkpoints: ${checkpoints.length} | actionable: ${counts.actionable} | pass/wait: ${counts.pass}`);
  console.log(`bobby parsed checkpoints: ${counts.withBobbyParsed} | mancini vetoes: ${counts.manciniVeto}`);
  if (blocked.length) {
    console.log('limitations:');
    for (const item of blocked) console.log(`- ${item}`);
  }
  console.log(`report: ${path.relative(ROOT, REPORT_MD)}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`historical replay failed: ${err.stack || err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  buildMemoryForCheckpoint,
  simulateOutcome,
};
