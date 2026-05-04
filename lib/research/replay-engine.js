'use strict';

const fs = require('fs');
const path = require('path');
const { buildTradeDecision } = require('../decision-spine');
const { buildDecisionResponse } = require('../operator/decision-adapter');
const { _internal: levelMemoryInternal } = require('../level-memory');
const { _internal: confluenceInternal } = require('../confluence-engine');
const { ROOT, RESEARCH_ARTIFACT_DIR, ensureDir, writeJson, tsMs, etIso } = require('./common');
const { loadUsableSessions, loadHistoricalCsvBars, summarizeBars } = require('./corpus-loader');
const { buildSourceTimeline } = require('./source-timeline');
const { buildActiveSourceContext } = require('./no-lookahead-context');
const { computeOutcomeMetrics } = require('./outcome-metrics');
const { sourceComboFromContext, summarizeBySourceCombo } = require('./source-attribution');

const TEMP_MEMORY_FILE = path.join(RESEARCH_ARTIFACT_DIR, '.tmp-replay-level-memory.json');

function barAtOrBefore(bars, timestamp) {
  const target = tsMs(timestamp);
  let found = null;
  for (const bar of bars || []) {
    const current = tsMs(bar.timestamp);
    if (Number.isFinite(current) && current <= target) found = bar;
    if (Number.isFinite(current) && current > target) break;
  }
  return found;
}

function hhmm(timestamp) {
  const m = String(timestamp || '').match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function checkpointFromDateTime(date, time) {
  return etIso(date, `${time}:00`);
}

function collectCheckpointTimes(session, events, options = {}) {
  const times = new Map();
  const add = (timestamp, reason) => {
    const time = hhmm(timestamp);
    if (!time) return;
    if (time < '09:30' || time > '16:00') return;
    if (!times.has(time)) times.set(time, new Set());
    times.get(time).add(reason);
  };

  for (const time of ['09:30', '09:45', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']) {
    times.set(time, new Set(['15m_cadence_or_opening_range']));
  }

  const dateEvents = events.filter(event => String(event.available_at_et || '').startsWith(session.date));
  for (const event of dateEvents) add(event.available_at_et, `source_update:${event.source}`);

  const levelPrices = new Set();
  for (const level of session.levels || []) {
    if (Number.isFinite(Number(level.price))) levelPrices.add(Number(level.price));
  }
  const maxTouches = options.maxTouchesPerDay || 40;
  let touches = 0;
  for (const bar of session.replayBars || []) {
    if (touches >= maxTouches) break;
    for (const level of levelPrices) {
      if (Math.abs(bar.close - level) <= 2 || (bar.low <= level + 1 && bar.high >= level - 1)) {
        add(bar.timestamp, 'near_level_or_touch');
        touches += 1;
        break;
      }
    }
  }

  return [...times.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, options.maxCheckpointsPerDay || 80)
    .map(([time, reasons]) => ({
      timestamp: checkpointFromDateTime(session.date, time),
      reasons: [...reasons],
    }));
}

function mentionFromEvent(event, level) {
  const role = String(level.role || level.label || event.source_type || '').toLowerCase();
  const analyst = event.source === 'bobby' ? 'bobby'
    : event.source === 'mancini' ? 'mancini'
      : event.source === 'saty' ? 'saty'
        : event.source;
  const significance = analyst === 'bobby' || /trigger|support|target|king|node/.test(role) ? 'key' : 'unclear';
  const direction = /resistance|short|call_trigger/.test(role)
    ? 'resistance'
    : (/support|long|put_trigger|reclaim|trap|target/.test(role) ? 'support' : null);
  return {
    analyst,
    date: String(event.available_at_et || '').slice(0, 10),
    timestamp: event.available_at_et,
    significance,
    direction,
    intent: /chop/.test(role) ? 'chop_boundary' : null,
    source_type: event.source_type,
    source_snippet: role,
    source_id: `${event.id}:${level.price}`,
    crossSourceConfirmed: false,
  };
}

function normalizeInstrumentForLevel(event, level) {
  if (event.instrument) {
    if (String(event.instrument).toUpperCase().startsWith('SP')) return 'SPX';
    return String(event.instrument).toUpperCase();
  }
  if (String(level.ticker || '').toUpperCase().startsWith('SP')) return 'SPX';
  return 'ES';
}

function recordsFromContext(context) {
  const byKey = new Map();
  for (const event of context.events || []) {
    for (const level of event.levels || []) {
      const price = Number(level.price);
      if (!Number.isFinite(price)) continue;
      const instrument = normalizeInstrumentForLevel(event, level);
      const rounded = Math.round(price * 100) / 100;
      const key = `${instrument}:${rounded.toFixed(2)}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          canonical_price: rounded,
          instrument,
          first_seen: event.available_at_et,
          last_seen: event.available_at_et,
          total_mentions: 0,
          mentions: [],
        });
      }
      const record = byKey.get(key);
      record.last_seen = event.available_at_et > record.last_seen ? event.available_at_et : record.last_seen;
      record.mentions.push(mentionFromEvent(event, { ...level, price: rounded }));
      record.total_mentions = record.mentions.length;
    }
  }
  return [...byKey.values()];
}

function writeTempMemory(records, checkpoint) {
  ensureDir(path.dirname(TEMP_MEMORY_FILE));
  const hasBobby = records.some(record => record.mentions.some(mention => mention.analyst === 'bobby'));
  const memory = { version: 1, last_updated: checkpoint, levels: records };
  if (!hasBobby) {
    memory.levels.push({
      canonical_price: 0,
      instrument: 'ES',
      first_seen: checkpoint,
      last_seen: checkpoint,
      total_mentions: 0,
      mentions: [],
      research_note: 'no active Bobby event; keeps freshness honest',
    });
  }
  fs.writeFileSync(TEMP_MEMORY_FILE, JSON.stringify(memory, null, 2));
}

async function decideWithResearchContext({ context, checkpoint, currentPrice }) {
  const records = recordsFromContext(context);
  writeTempMemory(records, checkpoint);
  levelMemoryInternal._setMemoryFile(TEMP_MEMORY_FILE);
  confluenceInternal._setQueryLevels(({ instrument }) =>
    records.filter(record => record.instrument === instrument)
  );
  try {
    return await buildDecisionResponse({
      instrument: 'ES',
      mode: 'existing-data-research-replay',
      currentPrice,
      now: new Date(checkpoint),
      getLivePriceFn: false,
      getMarketPriceFn: false,
      buildTradeDecisionFn: buildTradeDecision,
    });
  } finally {
    confluenceInternal._resetQueryLevels();
    levelMemoryInternal._setMemoryFile(path.join(ROOT, 'data', 'level-memory.json'));
  }
}

function flattenDecision(response) {
  const decision = response.decision || {};
  const spine = response.spine_decision || {};
  return {
    action: decision.action || null,
    raw_spine_action: spine.action || null,
    adapter_action: decision.action || null,
    anchor: decision.confluence?.anchor ?? null,
    entry: decision.entry ?? null,
    acceptable_entry: decision.acceptable_entry ?? null,
    stop: decision.stop ?? null,
    target: decision.target ?? null,
    sizing: decision.sizing ?? null,
    vetoes: decision.vetoes || [],
    evidence: decision.evidence || [],
    market_data: response.market_data || null,
    reason: decision.reason || null,
  };
}

function classifyPassMiss(row) {
  if (row.adapter_action === 'LONG' || row.adapter_action === 'SHORT') return false;
  return Number.isFinite(row.outcome?.mfe_15m) && row.outcome.mfe_15m >= 10;
}

function classifyVetoSave(row) {
  if (!row.vetoes?.length) return false;
  return Number.isFinite(row.outcome?.mae_15m) && row.outcome.mae_15m >= 5;
}

async function runExistingDataReplay(options = {}) {
  ensureDir(RESEARCH_ARTIFACT_DIR);
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esHistoricalCsvBars = loadHistoricalCsvBars('ES');
  const rows = [];
  const blocked = [];

  for (const session of sessions) {
    const checkpoints = collectCheckpointTimes(session, timeline.events, options);
    for (const checkpoint of checkpoints) {
      const bar = barAtOrBefore(session.replayBars, checkpoint.timestamp);
      if (!bar) {
        blocked.push(`${session.date} ${checkpoint.timestamp}: no ES bar at/before checkpoint`);
        continue;
      }
      const context = buildActiveSourceContext(timeline.events, checkpoint.timestamp);
      const response = await decideWithResearchContext({
        context,
        checkpoint: checkpoint.timestamp,
        currentPrice: bar.close,
      });
      const decision = flattenDecision(response);
      const outcome = computeOutcomeMetrics({
        bars: session.replayBars,
        timestamp: checkpoint.timestamp,
        price: bar.close,
        decision: response.decision,
      });
      const sourceCombo = sourceComboFromContext(context);
      const row = {
        date: session.date,
        timestamp_et: checkpoint.timestamp,
        instrument: 'ES',
        checkpoint_reasons: checkpoint.reasons,
        current_price_source: 'session_es_1m_close',
        es_price: bar.close,
        spx_price: null,
        active_source_counts: context.source_counts,
        source_freshness: context.source_freshness,
        source_combo: sourceCombo,
        action: decision.action,
        raw_spine_action: decision.raw_spine_action,
        adapter_action: decision.adapter_action,
        anchor: decision.anchor,
        entry: decision.entry,
        acceptable_entry: decision.acceptable_entry,
        stop: decision.stop,
        target: decision.target,
        sizing: decision.sizing,
        vetoes: decision.vetoes,
        evidence: decision.evidence,
        market_data: decision.market_data ? {
          ...decision.market_data,
          timestamp: checkpoint.timestamp,
          source: 'session_es_1m_close',
          confidence: 1,
        } : null,
        reason: decision.reason,
        outcome,
      };
      row.pass_missed_move = classifyPassMiss(row);
      row.veto_saved_bad_trade = classifyVetoSave(row);
      rows.push(row);
    }
  }

  const attribution = summarizeBySourceCombo(rows);
  const vetoAnalysis = rows.filter(row => row.vetoes?.length).map(row => ({
    date: row.date,
    timestamp_et: row.timestamp_et,
    vetoes: row.vetoes.map(veto => veto.type || veto),
    outcome: row.outcome,
    veto_saved_bad_trade: row.veto_saved_bad_trade,
  }));
  const passMissAnalysis = rows.filter(row => row.adapter_action === 'PASS' || row.pass_missed_move).map(row => ({
    date: row.date,
    timestamp_et: row.timestamp_et,
    reason: row.reason,
    source_combo: row.source_combo,
    mfe_15m: row.outcome?.mfe_15m,
    mfe_60m: row.outcome?.mfe_60m,
    pass_missed_move: row.pass_missed_move,
  }));

  const result = {
    generated_at: new Date().toISOString(),
    scope: 'ES 1-minute replay with existing analyst context; SPX CSV inventory available but not silently substituted for ES price.',
    sessions: sessions.length,
    excluded_sessions: excluded,
    checkpoint_strategy: '15-minute/opening checkpoints plus source updates plus near-level/touch events, capped per day.',
    checkpoint_count: rows.length,
    no_lookahead_enforced: true,
    es_session_bars: sessions.reduce((sum, session) => sum + session.replayBars.length, 0),
    es_historical_csv_bars: summarizeBars(esHistoricalCsvBars),
    spx_historical_csv_bars: summarizeBars(spxBars),
    counts: {
      actionable: rows.filter(row => row.adapter_action === 'LONG' || row.adapter_action === 'SHORT').length,
      pass_wait: rows.filter(row => !(row.adapter_action === 'LONG' || row.adapter_action === 'SHORT')).length,
      vetoes: rows.filter(row => row.vetoes?.length).length,
      pass_misses: rows.filter(row => row.pass_missed_move).length,
      veto_saves: rows.filter(row => row.veto_saved_bad_trade).length,
    },
    blocked,
    rows,
  };

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'replay-results.json'), result);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'source-attribution.json'), attribution);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'veto-analysis.json'), vetoAnalysis);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'pass-miss-analysis.json'), passMissAnalysis);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'missing-data-report.json'), {
    generated_at: new Date().toISOString(),
    excluded_sessions: excluded,
    timeline_missing: timeline.missing,
    replay_blocked: blocked,
    missing_spx_for_session_replay: spxBars.length === 0,
  });
  if (fs.existsSync(TEMP_MEMORY_FILE)) fs.unlinkSync(TEMP_MEMORY_FILE);

  return { result, attribution, vetoAnalysis, passMissAnalysis };
}

module.exports = {
  runExistingDataReplay,
  collectCheckpointTimes,
  recordsFromContext,
  decideWithResearchContext,
  barAtOrBefore,
  _internal: {
    TEMP_MEMORY_FILE,
    classifyPassMiss,
    classifyVetoSave,
  },
};
