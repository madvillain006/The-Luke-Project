'use strict';

const path = require('path');
const { buildSourceTimeline } = require('../source-timeline');
const { loadHistoricalCsvBars, loadUsableSessions, summarizeBars } = require('../corpus-loader');
const { factsForSession } = require('../prop-fake-breakdown/detector');
const { RESEARCH_ARTIFACT_DIR, writeJson, writeCsv, average, median } = require('../common');
const { buildTrustedLadder } = require('./ladder');
const { detectFlushesForSession } = require('./flush-detector');
const { buildFirstReclaimEntries, buildFirstReclaimPlanSpace } = require('./first-reclaim');
const { compareLateReclaim, summarizeLateComparison } = require('./late-reclaim-comparison');
const {
  ACCOUNT_25K,
  ACCOUNT_50K,
  annotateOutcome,
  summarizeRows,
  summarizeBy,
  simulateAccount,
} = require('./metrics');
const { rounded } = require('./level-clusters');
const { writeResearchDoc } = require('./report');

const DEFAULT_CONFIG = Object.freeze({
  cluster_tolerance: 1.5,
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

function rowForPlan({ flush, entry, stop, target, ladder, bars, config }) {
  const nextCluster = target.target_cluster || null;
  const row = {
    setup_id: flush.id,
    date: flush.date,
    timestamp_et: flush.timestamp_et,
    flush_start_timestamp_et: flush.flush_start_timestamp_et,
    instrument: 'ES',
    strategy: 'multi_source_ladder_first_reclaim_long',
    flush_type: flush.flush_type,
    clusters_lost_count: flush.clusters_lost_count,
    clusters_lost: flush.lost_cluster_prices,
    first_reclaimed_cluster_id: flush.first_reclaimed_cluster.cluster_id,
    first_reclaimed_level: flush.first_reclaimed_price,
    first_reclaimed_source_type: flush.first_reclaimed_cluster.source_combo,
    first_reclaimed_cluster_strength: flush.first_reclaimed_cluster.cluster_strength,
    first_reclaimed_cluster_is_chop: flush.first_reclaimed_cluster.is_veto_or_chop,
    source_combo: flush.source_combo,
    flush_source_combo: flush.flush_source_combo,
    sweep_low: flush.sweep_low,
    minutes_to_reclaim: flush.minutes_to_reclaim,
    entry_model: entry.entry_model,
    entry_timestamp_et: entry.entry_timestamp_et,
    entry_price: entry.entry_price,
    stop_model: stop.stop_model,
    stop_price: stop.stop_price,
    target_model: target.target_model,
    tp1: target.tp1,
    tp2: target.tp2,
    next_cluster_target: nextCluster?.canonical_price_es || null,
    next_cluster_source_combo: nextCluster?.source_combo || null,
    second_cluster_target: flush.second_cluster_above?.canonical_price_es || null,
    target_distance: target.target_distance,
    basis_method: flush.first_reclaimed_cluster.basis_method,
    basis_methods: flush.first_reclaimed_cluster.basis_methods,
    target_basis_method: target.target_basis_method,
    target_executable_or_reference: nextCluster?.is_executable_es ? 'ES_EXECUTABLE' : (nextCluster ? 'REFERENCE_OR_DIAGNOSTIC' : 'FIXED_ES'),
    saty_present: flush.included_sources.saty,
    mancini_present: flush.included_sources.mancini,
    bobby_heatmap_present: flush.included_sources.bobby_heatmap,
    dubz_present: flush.included_sources.dubz,
    gex_heatseeker_present: flush.included_sources.gex_heatseeker,
    multi_source_confluence_cluster: flush.included_sources.multi_source_cluster,
    ladder_cluster_count_at_entry: ladder.executable_clusters.length,
    no_lookahead_violation: false,
  };
  const withOutcome = annotateOutcome(row, bars, config);
  return { ...withOutcome, ...compareLateReclaim({ flush, row: withOutcome, bars }) };
}

function planRowsForFlush({ flush, bars, facts, spxBars, config }) {
  const entries = buildFirstReclaimEntries(flush, bars);
  const rows = [];
  for (const entry of entries) {
    const planSpace = buildFirstReclaimPlanSpace({ flush, entry, bars, facts, spxBars, config });
    for (const stop of planSpace.stops) {
      for (const target of planSpace.targets) {
        rows.push(rowForPlan({
          flush,
          entry,
          stop,
          target,
          ladder: planSpace.ladder,
          bars,
          config,
        }));
      }
    }
  }
  if (!rows.length) {
    rows.push({
      setup_id: flush.id,
      date: flush.date,
      timestamp_et: flush.timestamp_et,
      strategy: 'multi_source_ladder_first_reclaim_long',
      flush_type: flush.flush_type,
      clusters_lost_count: flush.clusters_lost_count,
      first_reclaimed_level: flush.first_reclaimed_price,
      source_combo: flush.source_combo,
      classification: 'PASS_NO_TARGET',
      classification_reason: 'no_entry_or_target_generated',
    });
  }
  return rows;
}

function aggregate(rows) {
  return {
    by_source_combo: summarizeBy(rows, 'source_combo'),
    by_flush_source_combo: summarizeBy(rows, 'flush_source_combo'),
    by_clusters_flushed: summarizeBy(rows, 'clusters_lost_count'),
    by_flush_type: summarizeBy(rows, 'flush_type'),
    by_first_reclaimed_source_type: summarizeBy(rows, 'first_reclaimed_source_type'),
    by_entry_model: summarizeBy(rows, 'entry_model'),
    by_stop_model: summarizeBy(rows, 'stop_model'),
    by_target_model: summarizeBy(rows, 'target_model'),
    by_basis_method: summarizeBy(rows, 'basis_method'),
    by_saty_present: summarizeBy(rows, 'saty_present'),
    by_mancini_present: summarizeBy(rows, 'mancini_present'),
    by_bobby_heatmap_present: summarizeBy(rows, 'bobby_heatmap_present'),
    by_dubz_present: summarizeBy(rows, 'dubz_present'),
    by_gex_heatseeker_present: summarizeBy(rows, 'gex_heatseeker_present'),
  };
}

function examples(flushes, rows, limit = 25) {
  const bySetup = new Map();
  for (const row of rows) {
    if (!bySetup.has(row.setup_id)) bySetup.set(row.setup_id, row);
  }
  return flushes.slice(0, limit).map(flush => ({
    setup_id: flush.id,
    date: flush.date,
    flush_type: flush.flush_type,
    flush_start_timestamp_et: flush.flush_start_timestamp_et,
    first_reclaim_timestamp_et: flush.reclaim_timestamp_et,
    clusters_lost: flush.lost_cluster_prices,
    first_reclaimed_level: flush.first_reclaimed_price,
    next_cluster_above: flush.next_cluster_above?.canonical_price_es || null,
    row: bySetup.get(flush.id) || null,
  }));
}

function toCsvRows(rows) {
  return rows.map(row => ({
    setup_id: row.setup_id,
    date: row.date,
    timestamp_et: row.timestamp_et,
    flush_type: row.flush_type,
    clusters_lost_count: row.clusters_lost_count,
    source_combo: row.source_combo,
    first_reclaimed_level: row.first_reclaimed_level,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_points: row.stop_points,
    risk_dollars_2es: row.risk_dollars_2es,
    target_model: row.target_model,
    tp1: row.tp1,
    tp2: row.tp2,
    classification: row.classification,
    tp1_hit: row.tp1_hit,
    stop_first: row.stop_first,
    max_heat_before_tp1: row.max_heat_before_tp1,
    next_cluster_hit: row.next_cluster_hit,
    points_captured_before_late_reclaim: row.points_captured_before_late_reclaim,
    late_reclaim_too_late: row.late_reclaim_too_late,
    pnl_2es_slip_0_5_round_trip: row.pnl_2es_slip_0_5_round_trip,
  }));
}

function failureAnalysis(rows) {
  const reasonCounts = {};
  for (const row of rows) {
    const reason = row.classification_reason || 'unknown';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  const tradeable = rows.filter(row => row.classification === 'TRADEABLE_RESEARCH');
  return {
    reason_counts: reasonCounts,
    first_reclaim_false_positives: tradeable.filter(row => !row.tp1_hit && !row.next_cluster_hit).length,
    same_bar_ambiguity_rows: rows.filter(row => row.same_bar_ambiguity).length,
    average_heat_tradeable: rounded(average(tradeable.map(row => row.max_heat_before_tp1))),
    median_heat_tradeable: rounded(median(tradeable.map(row => row.max_heat_before_tp1))),
    unresolved_risks: [
      'cluster tolerance can merge levels that a discretionary trader would separate',
      'OHLC bars do not prove limit-fill queue priority',
      'date-only commentary is treated as premarket context when the source timeline marks it usable',
      'SPX basis conversions depend on paired ES/SPX bars and are labeled; fixed +30 is diagnostic only',
      'attached visual example clarifies the pattern but is not itself a backtest data source',
    ],
  };
}

function lateComparisonRows(rows) {
  return rows
    .filter(row => row.late_reclaim_available || row.late_reclaim_too_late)
    .map(row => ({
      setup_id: row.setup_id,
      date: row.date,
      entry_timestamp_et: row.entry_timestamp_et,
      entry_price: row.entry_price,
      first_reclaimed_level: row.first_reclaimed_level,
      late_reclaim_available: row.late_reclaim_available,
      late_reclaim_level: row.late_reclaim_level,
      late_reclaim_timestamp_et: row.late_reclaim_timestamp_et,
      late_reclaim_price: row.late_reclaim_price,
      points_captured_before_late_reclaim: row.points_captured_before_late_reclaim,
      minutes_first_to_late_reclaim: row.minutes_first_to_late_reclaim,
      late_reclaim_too_late: row.late_reclaim_too_late,
      late_reclaim_reason: row.late_reclaim_reason,
    }));
}

async function runMultiSourceLadderReclaimResearch(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  const shouldWriteArtifacts = options.writeArtifacts !== false;
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esCsvBars = loadHistoricalCsvBars('ES');
  const flushes = [];
  const rows = [];
  const clusterArtifacts = [];

  for (const session of sessions) {
    const bars = session.replayBars || [];
    const facts = factsForSession(timeline.events, session.date);
    const sessionFlushes = detectFlushesForSession({
      session,
      facts,
      esBars: bars,
      spxBars,
      options: {
        minClusters: config.min_clusters,
        breakBuffer: config.break_buffer,
        clusterTolerance: config.cluster_tolerance,
        basisMethods: config.basis_methods,
      },
    });
    flushes.push(...sessionFlushes);
    for (const flush of sessionFlushes) {
      rows.push(...planRowsForFlush({ flush, bars, facts, spxBars, config }));
    }
    if (bars[0]) {
      const ladder = buildTrustedLadder({
        facts,
        timestamp: bars[0].timestamp,
        esBars: bars,
        spxBars,
        clusterTolerance: config.cluster_tolerance,
        basisMethods: config.basis_methods,
      });
      clusterArtifacts.push({
        date: session.date,
        timestamp_et: bars[0].timestamp,
        clusters: ladder.clusters,
      });
    }
  }

  const account25Full = simulateAccount(rows, ACCOUNT_25K, '2ES_FULL');
  const account25Starter = simulateAccount(rows, ACCOUNT_25K, '1ES_STARTER');
  const account50Full = simulateAccount(rows, ACCOUNT_50K, '2ES_FULL');
  const account50Starter = simulateAccount(rows, ACCOUNT_50K, '1ES_STARTER');
  const continuousProfitability = {
    target_hit_is_diagnostic_only: true,
    viability_requires: [
      'cumulative_pnl_above_zero',
      'no_eod_or_intraday_drawdown_failure',
      'profit_factor_above_account_threshold',
      'average_trade_pnl_above_zero',
    ],
    reported_but_not_required: ['positive_day_rate'],
    '25k_2ES_FULL': account25Full.continuous_profitable,
    '25k_1ES_STARTER': account25Starter.continuous_profitable,
    '50k_2ES_FULL': account50Full.continuous_profitable,
    '50k_1ES_STARTER': account50Starter.continuous_profitable,
  };
  const aggregates = aggregate(rows);
  const late = summarizeLateComparison(rows);
  const firstBetter = late.comparable_rows
    ? (late.late_reclaim_too_late_cases / late.comparable_rows >= 0.5 ? 'yes' : 'inconclusive')
    : 'inconclusive';
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'multi_source_ladder_first_reclaim_long',
    config,
    sessions: sessions.length,
    excluded_sessions: excluded,
    date_range: sessions.length ? { start: sessions[0].date, end: sessions[sessions.length - 1].date } : null,
    es_1m_bars: summarizeBars(esCsvBars),
    spx_1m_bars: summarizeBars(spxBars),
    source_timeline_events: timeline.event_count,
    source_timeline_usable_events: timeline.usable_event_count,
    setups: {
      single_level_flushes: flushes.filter(flush => flush.flush_type === 'single_level').length,
      multi_level_flushes: flushes.filter(flush => flush.flush_type === 'multi_level').length,
      deep_flushes: flushes.filter(flush => flush.flush_type === 'deep_flush').length,
      first_reclaim_candidates: flushes.length,
    },
    rows: rows.length,
    overall: summarizeRows(rows),
    aggregates,
    late_comparison: late,
    account_sim: {
      '25k_2ES_FULL': account25Full,
      '25k_1ES_STARTER': account25Starter,
      '50k_2ES_FULL': account50Full,
      '50k_1ES_STARTER': account50Starter,
    },
    continuous_profitability: continuousProfitability,
    first_reclaim_better_than_late_reclaim: firstBetter,
    prop_viability: [
      account25Full,
      account25Starter,
      account50Full,
      account50Starter,
    ].some(sim => sim.continuous_profitable) ? 'WATCHLIST_ONLY' : 'NOT_READY',
    confidence: flushes.length >= 100 ? 'medium' : 'low',
    safety: {
      live_trading_behavior_changed: false,
      build_trade_decision_changed: false,
      live_execution_touched: false,
      fake_data_fabricated: false,
      fixed_plus_30_strategy_truth_rows: rows.filter(row => row.basis_method === 'fixed_plus_30_proxy').length,
      first_reclaim_before_upper_reclaim: rows.filter(row => row.points_captured_before_late_reclaim > 0).length,
    },
  };

  if (shouldWriteArtifacts) {
    const compactRows = toCsvRows(rows);
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-results.json'), { summary, rows: compactRows });
    writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-summary.csv'), compactRows, [
      'setup_id', 'date', 'timestamp_et', 'flush_type', 'clusters_lost_count', 'source_combo',
      'first_reclaimed_level', 'entry_model', 'entry_price', 'stop_model', 'stop_points',
      'risk_dollars_2es', 'target_model', 'tp1', 'tp2', 'classification', 'tp1_hit',
      'stop_first', 'max_heat_before_tp1', 'next_cluster_hit', 'points_captured_before_late_reclaim',
      'late_reclaim_too_late', 'pnl_2es_slip_0_5_round_trip',
    ]);
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-clusters.json'), clusterArtifacts);
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-late-comparison.json'), {
      summary: late,
      rows: lateComparisonRows(rows),
    });
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-examples.json'), examples(flushes, rows));
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-account-sim.json'), summary.account_sim);
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-failure-analysis.json'), failureAnalysis(rows));
    writeResearchDoc(summary);
  }

  return { summary, flushes, rows };
}

module.exports = {
  DEFAULT_CONFIG,
  runMultiSourceLadderReclaimResearch,
  planRowsForFlush,
  rowForPlan,
  aggregate,
  toCsvRows,
};
