'use strict';

// Offline ES long backtest session builder.
//
// Inputs (default derived data dir):
//   bobby-messages.jsonl
//   bobby-image-cache.jsonl
//   mancini-posts.jsonl
//   saty-levels-by-date.json
//   data/historical/*.csv via lib/historical-data.js
//
// Outputs:
//   data/backtest/es-long-bracket/sessions/YYYY-MM-DD.json
//   data/backtest/es-long-bracket/derived/session-build-report.json
//   data/backtest/es-long-bracket/derived/session-build-report.md
//
// Safety:
//   - No Anthropic vision calls.
//   - No Discord CDN downloads.
//   - No live routes, /entries, scheduler, PM2, or broker execution touched.
//   - Low-confidence Mancini posts are preserved as context but not entry-ready.
//   - Saty levels are included only when valid.
//   - ES session date is the RTH trading date, with overnight defined as the
//     prior evening through the current premarket.

const fs = require('fs');
const path = require('path');

const { loadIntraday } = require('../lib/historical-data');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  derived: path.join(ROOT, 'data/backtest/es-long-bracket/derived'),
  sessions: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  start: null,
  end: null,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--derived') { args.derived = next; i++; }
    else if (flag === '--sessions') { args.sessions = next; i++; }
    else if (flag === '--start') { args.start = next; i++; }
    else if (flag === '--end') { args.end = next; i++; }
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function cleanGeneratedSessionFiles(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return 0;
  const resolved = path.resolve(sessionsDir);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    fs.unlinkSync(path.join(resolved, entry.name));
    removed++;
  }
  return removed;
}

function inDateRange(date, start, end) {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function isWeekday(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function dateAdd(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutesOfDay(timestamp) {
  const m = String(timestamp).match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function barDate(bar) {
  return String(bar.timestamp).slice(0, 10);
}

function isRthBar(bar) {
  const minutes = minutesOfDay(bar.timestamp);
  return minutes !== null && minutes >= 570 && minutes <= 960;
}

function isOvernightBarForSession(bar, sessionDate) {
  const d = barDate(bar);
  const minutes = minutesOfDay(bar.timestamp);
  if (minutes === null) return false;
  const priorDate = dateAdd(sessionDate, -1);
  return (d === priorDate && minutes >= 1080) || (d === sessionDate && minutes < 570);
}

function splitEsBarsForSession(esBars, sessionDate) {
  const overnightBars = esBars.filter(bar => isOvernightBarForSession(bar, sessionDate));
  const rthBars = esBars.filter(bar => barDate(bar) === sessionDate && isRthBar(bar));
  return {
    overnightBars,
    rthBars,
    esBars: [...overnightBars, ...rthBars].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
    ),
  };
}

function groupByDate(rows, dateGetter) {
  const out = new Map();
  for (const row of rows) {
    const date = dateGetter(row);
    if (!date) continue;
    if (!out.has(date)) out.set(date, []);
    out.get(date).push(row);
  }
  return out;
}

function groupManciniPostsBySessionDate(posts) {
  const out = new Map();
  for (const post of posts) {
    const dates = post.estimatedDate
      ? [post.estimatedDate]
      : (Array.isArray(post.candidateTradingDates) ? post.candidateTradingDates : []);
    for (const date of dates) {
      if (!date) continue;
      if (!out.has(date)) out.set(date, []);
      out.get(date).push(post);
    }
  }
  return out;
}

function getEsRthDates(esBars) {
  const dates = new Set();
  for (const bar of esBars) {
    if (isRthBar(bar)) dates.add(barDate(bar));
  }
  return [...dates].sort();
}

function normalizeSatyLevels(saty) {
  if (!saty || saty.valid !== true) return null;
  const levels = [];
  const addLevel = (price, label) => {
    if (Number.isFinite(Number(price))) {
      levels.push({ price: Number(price), source: 'saty', label });
    }
  };
  addLevel(saty.call_trigger, 'call_trigger');
  addLevel(saty.put_trigger, 'put_trigger');
  for (const key of ['call_levels', 'put_levels', 'levels']) {
    if (!Array.isArray(saty[key])) continue;
    for (const item of saty[key]) {
      if (typeof item === 'number') addLevel(item, key);
      else if (item && typeof item === 'object') addLevel(item.price ?? item.level, item.label || key);
    }
  }
  return { ...saty, normalizedLevels: dedupeLevels(levels) };
}

function dedupeLevels(levels) {
  const seen = new Set();
  const out = [];
  for (const level of levels) {
    const price = Number(level.price);
    if (!Number.isFinite(price)) continue;
    const key = price.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...level, price });
  }
  return out.sort((a, b) => a.price - b.price);
}

function levelsFromBobby(messages) {
  const levels = [];
  for (const msg of messages) {
    for (const price of msg.levelCandidates || []) {
      levels.push({ price: Number(price), source: 'bobby_text', messageId: msg.id });
    }
  }
  return levels;
}

function levelsFromMancini(posts) {
  const levels = [];
  for (const post of posts) {
    for (const level of post.levels || []) {
      levels.push({
        price: Number(level.price),
        source: 'mancini',
        role: level.role,
        postIndex: post.postIndex,
      });
    }
  }
  return levels;
}

function buildSession({
  date,
  esBars,
  bobbyMessages = [],
  bobbyImages = [],
  manciniPosts = [],
  satyByDate = {},
}) {
  const split = splitEsBarsForSession(esBars, date);
  const entryReadyMancini = manciniPosts.filter(p => p.timestampConfidence === 'high');
  const lowConfidenceMancini = manciniPosts.filter(p => p.timestampConfidence !== 'high');
  const saty = normalizeSatyLevels(satyByDate[date]);

  const levels = dedupeLevels([
    ...levelsFromBobby(bobbyMessages),
    ...levelsFromMancini(entryReadyMancini),
    ...(saty?.normalizedLevels || []),
  ]);

  const excludedReasons = [];
  if (split.rthBars.length === 0) excludedReasons.push('missing_es_rth_bars');
  if (split.esBars.length === 0) excludedReasons.push('missing_es_session_bars');

  return {
    date,
    instrument: 'ES',
    strategyScope: 'long_only',
    sessionDefinition: {
      timezone: 'America/New_York',
      overnight: 'prior date 18:00 through current date 09:29 ET',
      rth: 'current date 09:30 through 16:00 ET',
    },
    usable: excludedReasons.length === 0,
    excludedReason: excludedReasons.length ? excludedReasons.join(',') : null,
    bars: {
      es: split.esBars,
      overnight: split.overnightBars,
      rth: split.rthBars,
      counts: {
        es: split.esBars.length,
        overnight: split.overnightBars.length,
        rth: split.rthBars.length,
      },
    },
    bobby: {
      commentary: bobbyMessages,
      images: bobbyImages,
      counts: {
        commentary: bobbyMessages.length,
        images: bobbyImages.length,
        localMatchedImages: bobbyImages.filter(i => i.status === 'local_matched').length,
        unmatchedImages: bobbyImages.filter(i => i.status === 'unmatched').length,
      },
    },
    mancini: {
      posts: manciniPosts,
      entryReadyPosts: entryReadyMancini,
      lowConfidencePosts: lowConfidenceMancini,
      counts: {
        total: manciniPosts.length,
        entryReady: entryReadyMancini.length,
        lowConfidence: lowConfidenceMancini.length,
      },
    },
    saty: {
      included: Boolean(saty),
      levels: saty,
      excludedReason: saty ? null : 'unavailable_or_invalid_saty_levels',
    },
    levels,
  };
}

function collectTargetDates({ esBars, bobbyMessages, bobbyImages, manciniPosts, satyByDate, start, end }) {
  const dates = new Set();
  const esRthDates = new Set(getEsRthDates(esBars));

  // ES RTH dates are always valid session candidates.
  for (const d of esRthDates) dates.add(d);

  // Context-only dates need to be weekdays. This avoids creating weekend-only
  // sessions from futures overnight calendar dates or derived Saty keys.
  const addContextDate = date => {
    if (!date) return;
    if (esRthDates.has(date) || isWeekday(date)) dates.add(date);
  };

  for (const m of bobbyMessages) addContextDate(m.tradingDateET);
  for (const i of bobbyImages) addContextDate(i.tradingDateET);
  for (const p of manciniPosts) addContextDate(p.estimatedDate);
  for (const p of manciniPosts) {
    for (const d of p.candidateTradingDates || []) addContextDate(d);
  }
  for (const d of Object.keys(satyByDate || {})) addContextDate(d);
  return [...dates].filter(d => inDateRange(d, start, end)).sort();
}

function summarizeSessions(sessions) {
  const eligible = sessions.filter(s => s.usable);
  const excluded = sessions.filter(s => !s.usable);
  const withBobby = sessions.filter(s => s.bobby.counts.commentary > 0 || s.bobby.counts.images > 0);
  const withMancini = sessions.filter(s => s.mancini.counts.entryReady > 0);
  const withSaty = sessions.filter(s => s.saty.included);
  const eligibleWithBobby = eligible.filter(s => s.bobby.counts.commentary > 0 || s.bobby.counts.images > 0);
  const eligibleWithMancini = eligible.filter(s => s.mancini.counts.entryReady > 0);
  const eligibleWithSaty = eligible.filter(s => s.saty.included);
  return {
    totalSessions: sessions.length,
    eligibleSessions: eligible.length,
    excludedSessions: excluded.length,
    sessionsWithBobby: withBobby.length,
    sessionsWithEntryReadyMancini: withMancini.length,
    sessionsWithSaty: withSaty.length,
    eligibleSessionsWithBobby: eligibleWithBobby.length,
    eligibleSessionsWithEntryReadyMancini: eligibleWithMancini.length,
    eligibleSessionsWithSaty: eligibleWithSaty.length,
    excludedByReason: excluded.reduce((acc, s) => {
      acc[s.excludedReason] = (acc[s.excludedReason] || 0) + 1;
      return acc;
    }, {}),
    excludedSessionDetails: excluded.map(s => ({
      date: s.date,
      reason: s.excludedReason,
      bobbyMessages: s.bobby.counts.commentary,
      bobbyImages: s.bobby.counts.images,
      entryReadyMancini: s.mancini.counts.entryReady,
      satyIncluded: s.saty.included,
    })),
  };
}

function buildMarkdownReport(report) {
  const lines = [
    '# ES Long Backtest - Session Build Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    '**Mode:** Offline session assembly only. No live routes, /entries, PM2, scheduler, or broker execution touched.',
    '',
    '## Summary',
    '',
    '| Field | Value |',
    '|---|---:|',
    `| Total sessions written | ${report.summary.totalSessions} |`,
    `| Eligible sessions | ${report.summary.eligibleSessions} |`,
    `| Excluded sessions | ${report.summary.excludedSessions} |`,
    `| Sessions with Bobby context | ${report.summary.sessionsWithBobby} |`,
    `| Sessions with entry-ready Mancini | ${report.summary.sessionsWithEntryReadyMancini} |`,
    `| Sessions with valid Saty | ${report.summary.sessionsWithSaty} |`,
    `| Eligible sessions with Bobby context | ${report.summary.eligibleSessionsWithBobby} |`,
    `| Eligible sessions with entry-ready Mancini | ${report.summary.eligibleSessionsWithEntryReadyMancini} |`,
    `| Eligible sessions with valid Saty | ${report.summary.eligibleSessionsWithSaty} |`,
    '',
    '## Exclusions',
    '',
  ];

  const excluded = Object.entries(report.summary.excludedByReason);
  if (excluded.length === 0) {
    lines.push('_None_');
  } else {
    lines.push('| Reason | Count |', '|---|---:|');
    for (const [reason, count] of excluded) lines.push(`| ${reason} | ${count} |`);
    lines.push(
      '',
      '| Date | Reason | Bobby | Images | Entry-ready Mancini | Saty |',
      '|---|---|---:|---:|---:|---|',
    );
    for (const row of report.summary.excludedSessionDetails) {
      lines.push(`| ${row.date} | ${row.reason} | ${row.bobbyMessages} | ${row.bobbyImages} | ${row.entryReadyMancini} | ${row.satyIncluded ? 'yes' : 'no'} |`);
    }
  }

  lines.push(
    '',
    '## Files',
    '',
    `- Sessions directory: \`${report.outputs.sessionsDir}\``,
    '- One JSON file per target date, named `YYYY-MM-DD.json`.',
    '- Session files include ES overnight/RTH bars, Bobby commentary/images, Mancini posts, valid Saty levels, and deduped candidate levels.',
    '',
    '## Safety',
    '',
    '- No vision calls.',
    '- No CDN downloads.',
    '- Low-confidence Mancini posts preserved but excluded from `entryReadyPosts`.',
    '- Invalid Saty dates preserved as `saty.included: false`.',
    '- Long-only ES scope.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function buildSessionsFromInputs({ derivedDir, sessionsDir, start = null, end = null, esBars = null }) {
  const bobbyMessages = readJsonl(path.join(derivedDir, 'bobby-messages.jsonl'));
  const bobbyImages = readJsonl(path.join(derivedDir, 'bobby-image-cache.jsonl'));
  const manciniPosts = readJsonl(path.join(derivedDir, 'mancini-posts.jsonl'));
  const satyByDate = readJson(path.join(derivedDir, 'saty-levels-by-date.json'), {});
  const actualEsBars = esBars || loadIntraday('ES') || [];

  const bobbyByDate = groupByDate(bobbyMessages, row => row.tradingDateET);
  const imagesByDate = groupByDate(bobbyImages, row => row.tradingDateET);
  const manciniByDate = groupManciniPostsBySessionDate(manciniPosts);

  const targetDates = collectTargetDates({
    esBars: actualEsBars,
    bobbyMessages,
    bobbyImages,
    manciniPosts,
    satyByDate,
    start,
    end,
  });

  ensureDir(sessionsDir);
  const removedStaleSessions = cleanGeneratedSessionFiles(sessionsDir);

  const sessions = targetDates.map(date => buildSession({
    date,
    esBars: actualEsBars,
    bobbyMessages: bobbyByDate.get(date) || [],
    bobbyImages: imagesByDate.get(date) || [],
    manciniPosts: manciniByDate.get(date) || [],
    satyByDate,
  }));

  for (const session of sessions) {
    writeJson(path.join(sessionsDir, `${session.date}.json`), session);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'offline-backtest-session-build',
    args: { derivedDir, sessionsDir, start, end },
    summary: summarizeSessions(sessions),
    housekeeping: { removedStaleSessionFiles: removedStaleSessions },
    targetDates,
    outputs: {
      sessionsDir,
      sessionBuildReportJson: path.join(derivedDir, 'session-build-report.json'),
      sessionBuildReportMd: path.join(derivedDir, 'session-build-report.md'),
    },
  };

  writeJson(path.join(derivedDir, 'session-build-report.json'), report);
  fs.writeFileSync(path.join(derivedDir, 'session-build-report.md'), buildMarkdownReport(report), 'utf8');

  return { sessions, report };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('[build-sessions] Offline ES long backtest session build');
  console.log(`[build-sessions] Derived dir: ${args.derived}`);
  console.log(`[build-sessions] Sessions dir: ${args.sessions}`);

  const { report } = buildSessionsFromInputs({
    derivedDir: args.derived,
    sessionsDir: args.sessions,
    start: args.start,
    end: args.end,
  });

  console.log('[build-sessions] Summary');
  console.log(`  Total sessions:    ${report.summary.totalSessions}`);
  console.log(`  Eligible sessions: ${report.summary.eligibleSessions}`);
  console.log(`  Excluded sessions: ${report.summary.excludedSessions}`);
  console.log(`  With Bobby:        ${report.summary.sessionsWithBobby}`);
  console.log(`  With Mancini:      ${report.summary.sessionsWithEntryReadyMancini}`);
  console.log(`  With Saty:         ${report.summary.sessionsWithSaty}`);
  console.log('[build-sessions] Done.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('[build-sessions] FATAL:', err.message || err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  readJsonl,
  inDateRange,
  dateAdd,
  minutesOfDay,
  isRthBar,
  isOvernightBarForSession,
  splitEsBarsForSession,
  collectTargetDates,
  normalizeSatyLevels,
  buildSession,
  summarizeSessions,
  buildSessionsFromInputs,
  _internal: {
    groupByDate,
    groupManciniPostsBySessionDate,
    getEsRthDates,
    levelsFromBobby,
    levelsFromMancini,
    dedupeLevels,
    buildMarkdownReport,
  },
};
