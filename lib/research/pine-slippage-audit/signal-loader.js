'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readJson, tsMs } = require('../common');
const { buildSourceTimeline } = require('../source-timeline');
const { loadUsableSessions, loadHistoricalCsvBars, summarizeBars } = require('../corpus-loader');
const { runMultiSourceLadderReclaimResearch } = require('../multi-source-ladder-reclaim/evaluator');
const { accountRows } = require('../multi-source-ladder-reclaim/metrics');

const HARDMODE_CONFIG = Object.freeze({
  cluster_tolerance: 1.25,
  break_buffer: 0.25,
  min_clusters: 1,
  preferred_max_stop_points: 3,
  hard_max_stop_points: 5,
  basis_methods: [
    'same_minute_basis',
    'session_open_basis',
    'prior_close_basis',
    'rolling_15m_basis',
    'reference_only',
    'fixed_plus_30_proxy',
  ],
});

const PINE_SIGNAL_CONFIG = Object.freeze({
  entry_timing_mode: 'next_bar_open',
  signal_name: 'LUKE PAPER_CANDIDATE',
  entry_model: 'next_bar_open_after_confirmed_reclaim',
  stop_model: 'cluster_minus_3_points',
  tp_model: 'entry_plan_plus_2_points',
  size_model: '1ES_starter_default_with_2ES_full_comparison',
  reclaim_hold_bars: 2,
  flush_lookback_bars: 12,
  min_close_above_level_points: 0.25,
  level_tap_tolerance_points: 0.5,
  tp1_points: 2,
  max_stop_points: 3,
  hard_stop_points: 5,
  cluster_tolerance: 1.25,
  cluster_tolerance_cap: 3,
  saty_mode: 'strategy_safe_lookahead_off_where_pine_uses_security',
  heatmap_gex_fresh_minutes: 60,
  heatmap_gex_stale_minutes: 120,
});

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function indexAtOrAfter(bars, timestamp) {
  const target = tsMs(timestamp);
  return (bars || []).findIndex(bar => {
    const current = tsMs(bar.timestamp);
    return Number.isFinite(current) && Number.isFinite(target) && current >= target;
  });
}

function loadPineHardmodeConfig(rootDir = ROOT) {
  const hardmodeAudit = readJson(path.join(rootDir, 'artifacts', 'tradingview', 'pine-hardmode-audit.json'), {});
  const slippage = readJson(path.join(rootDir, 'artifacts', 'tradingview', 'slippage-modes-summary.json'), {});
  const exportSummary = readJson(path.join(rootDir, 'artifacts', 'tradingview', 'export-summary.json'), {});
  const hardmodePath = path.join(rootDir, 'tradingview', 'luke-level-reclaim-watch-hardmode.strategy.pine');
  const generatedHardmodePath = path.join(rootDir, 'artifacts', 'tradingview', 'luke-level-reclaim-watch-hardmode.generated.strategy.pine');
  return {
    comparison_type: 'Luke-equivalent reconstruction',
    hardmode_audit: hardmodeAudit,
    slippage_modes: slippage.modes || [],
    default_slippage_mode: slippage.default_mode || 'both_sides_0_25_each',
    same_bar_policy_default: slippage.same_bar_default || 'stop_first_hard_mode',
    export_summary: exportSummary,
    files: {
      visual_indicator: path.join(rootDir, 'tradingview', 'luke-level-reclaim-watch.pine'),
      hardmode_strategy: fs.existsSync(hardmodePath) ? hardmodePath : null,
      generated_visual_indicator: path.join(rootDir, 'artifacts', 'tradingview', 'luke-level-reclaim-watch.generated.pine'),
      generated_hardmode_strategy: fs.existsSync(generatedHardmodePath) ? generatedHardmodePath : null,
    },
    extracted: PINE_SIGNAL_CONFIG,
  };
}

function buildBarsByDate(sessions) {
  return new Map((sessions || []).map(session => [session.date, session.replayBars || []]));
}

function holdAboveConfirmed(bars, index, level, config) {
  if (index < config.reclaim_hold_bars - 1) return false;
  for (let offset = 0; offset < config.reclaim_hold_bars; offset += 1) {
    const bar = bars[index - offset];
    if (!bar || bar.close < level + config.min_close_above_level_points) return false;
  }
  return true;
}

function findConfirmationIndex({ flush, bars, config = PINE_SIGNAL_CONFIG }) {
  const reclaimIndex = indexAtOrAfter(bars, flush.reclaim_timestamp_et);
  if (reclaimIndex < 0) return -1;
  const level = Number(flush.first_reclaimed_price);
  const last = Math.min(bars.length - 2, reclaimIndex + config.flush_lookback_bars);
  for (let index = reclaimIndex; index <= last; index += 1) {
    const bar = bars[index];
    const recentTap = bar.low <= level + config.level_tap_tolerance_points && bar.high >= level - 0.25;
    const closeCleared = bar.close >= level + config.min_close_above_level_points;
    if (holdAboveConfirmed(bars, index, level, config) && recentTap && closeCleared) return index;
  }
  return -1;
}

function signalFromFlush(flush, session, config = PINE_SIGNAL_CONFIG) {
  const bars = session?.replayBars || [];
  const confirmationIndex = findConfirmationIndex({ flush, bars, config });
  if (confirmationIndex < 0 || confirmationIndex + 1 >= bars.length) return null;
  const entryIndex = confirmationIndex + 1;
  const level = rounded(Number(flush.first_reclaimed_price));
  const entryPlan = rounded(level + config.min_close_above_level_points);
  const stop = rounded(level - Math.min(config.max_stop_points, config.hard_stop_points));
  const tp1 = rounded(entryPlan + config.tp1_points);
  const rawEntry = Number(bars[entryIndex].open);
  if (!Number.isFinite(rawEntry)) return null;
  return {
    id: [
      'pine-hardmode-rebuild',
      session.date,
      bars[confirmationIndex].timestamp,
      level,
      flush.source_combo || flush.first_reclaimed_cluster?.source_combo || 'unknown',
    ].join(':'),
    family: 'pine_hardmode_luke_reconstruction',
    signal_name: 'LUKE PAPER_CANDIDATE',
    date: session.date,
    setup_timestamp_et: flush.flush_start_timestamp_et || flush.timestamp_et || null,
    luke_reclaim_timestamp_et: flush.reclaim_timestamp_et,
    confirmation_timestamp_et: bars[confirmationIndex].timestamp,
    signal_timestamp_et: bars[confirmationIndex].timestamp,
    entry_timestamp_et: bars[entryIndex].timestamp,
    signal_index: confirmationIndex,
    entry_index: entryIndex,
    level,
    source_combo: flush.source_combo || flush.first_reclaimed_cluster?.source_combo || null,
    sources: flush.first_reclaimed_cluster?.source_combo || flush.source_combo || null,
    raw_entry: rounded(rawEntry),
    planned_entry: entryPlan,
    raw_stop: stop,
    raw_tp1: tp1,
    stop_points_raw_from_entry_plan: rounded(entryPlan - stop),
    fill_assumption: 'next bar open after confirmed historical reclaim',
    no_future_outcome_filter: true,
  };
}

function buildPineStyleSignals({ flushes, sessions, config = PINE_SIGNAL_CONFIG }) {
  const sessionsByDate = new Map((sessions || []).map(session => [session.date, session]));
  const candidates = [];
  for (const flush of flushes || []) {
    const session = sessionsByDate.get(flush.date);
    const signal = signalFromFlush(flush, session, config);
    if (signal) candidates.push(signal);
  }

  const bySignalBar = new Map();
  for (const signal of candidates) {
    const key = `${signal.date}|${signal.signal_index}`;
    const existing = bySignalBar.get(key);
    if (!existing || signal.level > existing.level) bySignalBar.set(key, signal);
  }
  return [...bySignalBar.values()].sort((a, b) => (tsMs(a.entry_timestamp_et) || 0) - (tsMs(b.entry_timestamp_et) || 0));
}

function rowToSignal(row, family, barsByDate) {
  const bars = barsByDate.get(row.date) || [];
  const entryIndex = indexAtOrAfter(bars, row.entry_timestamp_et);
  if (entryIndex < 0) return null;
  if (!Number.isFinite(row.entry_price) || !Number.isFinite(row.stop_price) || !Number.isFinite(row.tp1)) return null;
  return {
    id: `${family}:${row.setup_id}:${row.entry_model}:${row.stop_model}:${row.target_model}`,
    family,
    signal_name: family,
    date: row.date,
    setup_timestamp_et: row.flush_start_timestamp_et || row.timestamp_et || null,
    luke_reclaim_timestamp_et: row.timestamp_et || null,
    confirmation_timestamp_et: row.entry_timestamp_et,
    signal_timestamp_et: row.entry_timestamp_et,
    entry_timestamp_et: row.entry_timestamp_et,
    entry_index: entryIndex,
    level: row.first_reclaimed_level,
    source_combo: row.source_combo || row.first_reclaimed_source_type || null,
    raw_entry: rounded(row.entry_price),
    planned_entry: rounded(row.entry_price),
    raw_stop: rounded(row.stop_price),
    raw_tp1: rounded(row.tp1),
    row,
    no_future_outcome_filter: true,
  };
}

function selectBestRowsBySetup(rows) {
  return accountRows(rows || []);
}

function rowsToSignals(rows, family, barsByDate) {
  return (rows || []).map(row => rowToSignal(row, family, barsByDate)).filter(Boolean);
}

async function loadHistoricalAuditInputs(options = {}) {
  const pineConfig = loadPineHardmodeConfig(options.rootDir || ROOT);
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const barsByDate = buildBarsByDate(sessions);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esCsvBars = loadHistoricalCsvBars('ES');
  const ladder = await runMultiSourceLadderReclaimResearch({
    writeArtifacts: false,
    timeline,
    config: HARDMODE_CONFIG,
    dates: options.dates,
  });
  const pineSignals = buildPineStyleSignals({
    flushes: ladder.flushes,
    sessions,
    config: PINE_SIGNAL_CONFIG,
  });
  const accountLadderRows = selectBestRowsBySetup(ladder.rows);

  return {
    comparison_type: 'Luke-equivalent reconstruction',
    comparison_note: 'No direct Pine signal export was present; signals were rebuilt from Luke timestamp-valid ladder reclaim flushes using hard-mode timing and bracket assumptions.',
    pineConfig,
    sessions,
    excluded_sessions: excluded,
    barsByDate,
    es_1m_bars: summarizeBars(esCsvBars),
    spx_1m_bars: summarizeBars(spxBars),
    source_timeline_events: timeline.event_count,
    source_timeline_usable_events: timeline.usable_event_count,
    ladder_summary: ladder.summary,
    ladder_rows: ladder.rows,
    ladder_flushes: ladder.flushes,
    account_ladder_rows: accountLadderRows,
    pine_signals: pineSignals,
  };
}

module.exports = {
  HARDMODE_CONFIG,
  PINE_SIGNAL_CONFIG,
  loadPineHardmodeConfig,
  buildBarsByDate,
  findConfirmationIndex,
  signalFromFlush,
  buildPineStyleSignals,
  rowToSignal,
  rowsToSignals,
  selectBestRowsBySetup,
  loadHistoricalAuditInputs,
};
