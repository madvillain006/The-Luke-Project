'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR, writeJson, writeCsv, average, median } = require('../common');
const { buildSourceTimeline } = require('../source-timeline');
const { loadHistoricalCsvBars, loadUsableSessions, summarizeBars } = require('../corpus-loader');
const { factsForSession, spxHeatmapComparisonsForSession } = require('../prop-fake-breakdown/detector');
const { detectV2SetupsForSession } = require('./setup-detector');
const { buildLevelLadder } = require('./level-ladder');
const { selectTargets } = require('./target-selector');
const { stagedPlan } = require('./staged-sizing');
const { computePlanOutcome } = require('./metrics');
const {
  DEFAULT_V2_PROP_CONFIG,
  stopPoints,
  riskDollars,
  rewardRisk,
  classifyHistoricalPlan,
  annotateDailyRisk,
} = require('./prop-risk');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function stopPrices(setup, entryPrice, config = DEFAULT_V2_PROP_CONFIG) {
  return [
    { stop_model: 'sweep_low_minus_1tick', stop_price: setup.sweep_low - 0.25 },
    { stop_model: 'sweep_low_minus_1point', stop_price: setup.sweep_low - 1 },
    { stop_model: 'level_minus_2points', stop_price: setup.executable_level - 2 },
    { stop_model: 'max_prop_stop_capped', stop_price: entryPrice - config.preferred_max_stop_points },
  ].map(row => ({ ...row, stop_price: rounded(row.stop_price) }));
}

function stopsForArchetype(setup, entryPrice, archetype, config) {
  const all = stopPrices(setup, entryPrice, config);
  if (archetype === 'REACTION_SCALP') {
    return all.filter(row => ['sweep_low_minus_1tick', 'max_prop_stop_capped'].includes(row.stop_model));
  }
  if (archetype === 'LEVEL_TO_LEVEL_LONG') {
    return all.filter(row => ['sweep_low_minus_1point', 'level_minus_2points'].includes(row.stop_model));
  }
  return all.filter(row => row.stop_model === 'sweep_low_minus_1point');
}

function entryModelsForArchetype(setup, archetype) {
  const entries = setup.entry_models_v2 || [];
  if (archetype === 'REACTION_SCALP') {
    return entries.filter(entry => ['reclaim_close', 'level_reclaim_limit', 'retest_hold', '2_candle_hold'].includes(entry.entry_model));
  }
  if (archetype === 'LEVEL_TO_LEVEL_LONG') {
    return entries.filter(entry => ['retest_hold', '2_candle_hold', '3_candle_hold', 'higher_low_after_reclaim', 'micro_pivot_break'].includes(entry.entry_model));
  }
  return entries.filter(entry => ['reclaim_close', 'level_reclaim_limit', 'retest_hold'].includes(entry.entry_model));
}

function timeOfDay(timestamp) {
  const m = String(timestamp || '').match(/T(\d{2}):(\d{2})/);
  if (!m) return 'unknown';
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes < 600) return 'open_0930_1000';
  if (minutes < 690) return 'morning_1000_1130';
  if (minutes < 810) return 'midday_1130_1330';
  if (minutes < 900) return 'afternoon_1330_1500';
  return 'late_1500_1600';
}

function reclaimWindow(minutes) {
  if (!Number.isFinite(minutes)) return 'no_reclaim';
  if (minutes <= 3) return '0_to_3';
  if (minutes <= 5) return '3_to_5';
  if (minutes <= 10) return '5_to_10';
  if (minutes <= 15) return '10_to_15';
  return 'late';
}

function baseRow({ setup, entry, stop, target, archetype, ladder, config, staged = null }) {
  const sp = stopPoints(entry.entry_price, stop.stop_price);
  const fullRisk = riskDollars(sp, 2, config);
  const starterRisk = riskDollars(sp, 1, config);
  const stagedRisk = staged?.staged_1_to_2_risk_dollars ?? null;
  const tp2 = target.tp2 ?? null;
  const tp1 = target.tp1 ?? null;
  const targetDistance = Number.isFinite(tp2)
    ? rounded(tp2 - entry.entry_price)
    : (Number.isFinite(tp1) ? rounded(tp1 - entry.entry_price) : null);
  return {
    setup_id: setup.id,
    strategy: 'fake_breakdown_reclaim_long_v2',
    archetype,
    date: setup.date,
    timestamp_et: setup.timestamp_et,
    instrument: 'ES',
    level: setup.level,
    executable_level: setup.executable_level,
    level_source_combo: setup.source_combo,
    source_combo: setup.source_combo,
    level_type: setup.level_type,
    basis_method: setup.basis_method || 'native_es',
    entry_model: entry.entry_model,
    entry_timestamp_et: entry.entry_timestamp_et,
    entry_price: entry.entry_price,
    stop_model: stop.stop_model,
    stop_price: stop.stop_price,
    stop_points: sp,
    contracts: archetype === 'STAGED_LONG' ? 1 : 2,
    full_risk_dollars: fullRisk,
    starter_risk_dollars: starterRisk,
    staged_risk_dollars: stagedRisk,
    active_risk_dollars: archetype === 'STAGED_LONG' ? (stagedRisk || starterRisk) : fullRisk,
    target_model: target.target_model,
    tp1,
    tp2,
    tp2_source: target.tp2_source || null,
    tp2_level_type: target.tp2_level_type || null,
    target_distance: targetDistance,
    reward_risk: rewardRisk(entry.entry_price, stop.stop_price, tp2 || tp1),
    position_model: staged?.position_model || '2ES_FULL_ENTRY',
    add_rule: staged?.add_rule || null,
    add_timestamp_et: staged?.add_entry?.add_timestamp_et || null,
    add_price: staged?.add_entry?.add_price || null,
    breakdown_depth: setup.breakdown_depth_actual,
    reclaim_window: reclaimWindow(setup.minutes_below_level),
    minutes_below_level: setup.minutes_below_level,
    inside_chop: setup.inside_chop,
    chop_allowed_variant: !setup.inside_chop,
    valid_reclaim: setup.valid_reclaim,
    time_of_day_bucket: timeOfDay(setup.timestamp_et),
    accumulation: setup.accumulation,
    accumulation_pattern: setup.accumulation?.accumulation_above_level ? 'accepted_above_level' : 'thin_acceptance',
    level_ladder_above_count: ladder.above.length,
    level_ladder_below_count: ladder.below.length,
    bobby_heatmap_target_present: ladder.above.some(level => level.source === 'bobby'),
    gex_heatseeker_target_present: ladder.above.some(level => ['gex', 'heatseeker'].includes(level.source)),
    dubz_aligned: setup.source_combo.includes('dubz'),
    no_lookahead_violation: false,
    evidence: {
      sweep_low: setup.sweep_low,
      source_freshness: setup.source_freshness,
      spx_heatmap_minute_comparison: setup.spx_heatmap_minute_comparison || null,
      target_basis_method: target.target_basis_method || null,
      target_raw_path: target.target_raw_path || null,
    },
  };
}

function planRowsForSetup({ setup, bars, facts, spxBars, config }) {
  if (!setup.valid_reclaim) {
    return [{
      setup_id: setup.id,
      strategy: 'fake_breakdown_reclaim_long_v2',
      archetype: 'PASS',
      date: setup.date,
      timestamp_et: setup.timestamp_et,
      instrument: 'ES',
      level: setup.level,
      executable_level: setup.executable_level,
      level_source_combo: setup.source_combo,
      source_combo: setup.source_combo,
      level_type: setup.level_type,
      valid_reclaim: false,
      classification: 'PASS',
      classification_reason: setup.invalid_reason || 'no_valid_reclaim',
      position_safety: 'NOT_PROP_SAFE',
    }];
  }

  const rows = [];
  for (const archetype of ['REACTION_SCALP', 'LEVEL_TO_LEVEL_LONG', 'STAGED_LONG']) {
    for (const entry of entryModelsForArchetype(setup, archetype)) {
      const ladder = buildLevelLadder({
        setup,
        facts,
        timestamp: entry.entry_timestamp_et,
        esBars: bars,
        spxBars,
        allowSpxBasis: false,
        basisMethods: ['native_es', 'reference_only'],
      });
      for (const stop of stopsForArchetype(setup, entry.entry_price, archetype, config)) {
        const staged = archetype === 'STAGED_LONG'
          ? stagedPlan({ bars, entry, level: setup.executable_level, stopPrice: stop.stop_price, addRule: 'plus_2' })
          : null;
        const targets = selectTargets({
          archetype,
          ladder,
          entryPrice: entry.entry_price,
          allowChop: false,
        });
        for (const target of targets) {
          let row = baseRow({ setup, entry, stop, target, archetype, ladder, config, staged });
          row = {
            ...row,
            ...computePlanOutcome({
              bars,
              entryTimestamp: row.entry_timestamp_et,
              entryPrice: row.entry_price,
              stopPrice: row.stop_price,
              tp1: row.tp1,
              tp2: row.tp2,
              addPrice: row.add_price,
            }),
          };
          row = { ...row, ...classifyHistoricalPlan(row, config) };
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

function rate(rows, predicate) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function summarizeRows(rows) {
  const taken = rows.filter(row => String(row.classification || '').startsWith('TRADEABLE'));
  const measured = rows.filter(row => Number.isFinite(row.entry_price));
  return {
    unique_setups: new Set(rows.map(row => row.setup_id)).size,
    candidate_rows: rows.length,
    taken_rows: taken.length,
    tradeable_reaction_scalp: rows.filter(row => row.classification === 'TRADEABLE_REACTION_SCALP').length,
    tradeable_level_to_level: rows.filter(row => row.classification === 'TRADEABLE_LEVEL_TO_LEVEL').length,
    tradeable_staged: rows.filter(row => row.classification === 'TRADEABLE_STAGED').length,
    watch_only: rows.filter(row => row.classification === 'WATCH_ONLY').length,
    pass: rows.filter(row => row.classification === 'PASS').length,
    tp1_hit_rate: rate(taken, row => row.tp1_hit),
    tp2_hit_rate: rate(taken, row => row.tp2_hit),
    stop_first_rate: rate(taken, row => row.stop_first),
    candidate_tp1_hit_rate: rate(measured, row => row.tp1_hit),
    candidate_tp2_hit_rate: rate(measured, row => row.tp2_hit),
    candidate_stop_first_rate: rate(measured, row => row.stop_first),
    average_heat_before_tp1: average(taken.map(row => row.max_heat_before_tp1)),
    average_heat_before_tp2: average(taken.map(row => row.max_heat_before_tp2)),
    candidate_average_heat_before_tp1: average(measured.map(row => row.max_heat_before_tp1)),
    candidate_average_heat_before_tp2: average(measured.map(row => row.max_heat_before_tp2)),
    median_time_to_tp1: median(taken.map(row => row.time_to_tp1)),
    median_time_to_tp2: median(taken.map(row => row.time_to_tp2)),
    average_r_60m: average(taken.map(row => row.r_60m)),
    daily_drawdown_failures: rows.filter(row => row.account_fail).length,
    confidence: new Set(rows.map(row => row.setup_id)).size >= 100 ? 'medium' : 'low',
  };
}

function summarizeBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] == null ? 'unknown' : String(row[key]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([value, group]) => ({
    [key]: value,
    ...summarizeRows(group),
  })).sort((a, b) => b.candidate_rows - a.candidate_rows);
}

function buildAggregates(rows) {
  return {
    by_archetype: summarizeBy(rows, 'archetype'),
    by_entry_model: summarizeBy(rows, 'entry_model'),
    by_source_combo: summarizeBy(rows, 'source_combo'),
    by_target_model: summarizeBy(rows, 'target_model'),
    by_saty_level_type: summarizeBy(rows.filter(row => row.source_combo?.includes('saty')), 'level_type'),
    by_mancini_level_type: summarizeBy(rows.filter(row => row.source_combo?.includes('mancini')), 'level_type'),
    by_bobby_heatmap_target_present: summarizeBy(rows, 'bobby_heatmap_target_present'),
    by_gex_heatseeker_target_present: summarizeBy(rows, 'gex_heatseeker_target_present'),
    by_dubz_aligned: summarizeBy(rows, 'dubz_aligned'),
    by_inside_chop: summarizeBy(rows, 'inside_chop'),
    by_basis_method: summarizeBy(rows, 'basis_method'),
    by_time_of_day: summarizeBy(rows, 'time_of_day_bucket'),
    by_breakdown_depth: summarizeBy(rows, 'breakdown_depth'),
    by_reclaim_window: summarizeBy(rows, 'reclaim_window'),
    by_accumulation_pattern: summarizeBy(rows, 'accumulation_pattern'),
    by_stop_model: summarizeBy(rows, 'stop_model'),
    by_position_model: summarizeBy(rows, 'position_model'),
  };
}

function toCsvRows(rows) {
  return rows.map(row => ({
    setup_id: row.setup_id,
    date: row.date,
    timestamp_et: row.timestamp_et,
    archetype: row.archetype,
    classification: row.classification,
    position_safety: row.position_safety,
    source_combo: row.source_combo,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_points: row.stop_points,
    active_risk_dollars: row.active_risk_dollars,
    target_model: row.target_model,
    tp1: row.tp1,
    tp2: row.tp2,
    reward_risk: row.reward_risk,
    tp1_hit: row.tp1_hit,
    tp2_hit: row.tp2_hit,
    stop_first: row.stop_first,
    max_heat_before_tp1: row.max_heat_before_tp1,
    max_heat_before_tp2: row.max_heat_before_tp2,
    r_60m: row.r_60m,
    daily_drawdown_used: row.daily_drawdown_used,
  }));
}

function levelLadderArtifact(setups) {
  return setups.map(setup => ({
    setup_id: setup.id,
    date: setup.date,
    timestamp_et: setup.timestamp_et,
    level: setup.executable_level,
    source_combo: setup.source_combo,
    next_trusted_level_above: setup.next_trusted_level_above,
    accumulation: setup.accumulation,
    spx_heatmap_minute_comparison: setup.spx_heatmap_minute_comparison || null,
  }));
}

function targetSelectionArtifact(rows) {
  return rows
    .filter(row => row.archetype !== 'PASS')
    .map(row => ({
      setup_id: row.setup_id,
      archetype: row.archetype,
      entry_model: row.entry_model,
      target_model: row.target_model,
      tp1: row.tp1,
      tp2: row.tp2,
      tp2_source: row.tp2_source,
      target_distance: row.target_distance,
      reward_risk: row.reward_risk,
      bobby_heatmap_target_present: row.bobby_heatmap_target_present,
      gex_heatseeker_target_present: row.gex_heatseeker_target_present,
    }));
}

function failureAnalysis(rows) {
  const reasonCounts = {};
  for (const row of rows) {
    for (const reason of String(row.classification_reason || '').split(';').filter(Boolean)) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  const byDay = summarizeBy(rows, 'date');
  return {
    reason_counts: reasonCounts,
    same_bar_ambiguity_rows: rows.filter(row => row.same_bar_ambiguity).length,
    stop_first_rows: rows.filter(row => row.stop_first).length,
    best_days: byDay.slice().sort((a, b) => (b.average_r_60m || -999) - (a.average_r_60m || -999)).slice(0, 5),
    worst_days: byDay.slice().sort((a, b) => (a.average_r_60m || 999) - (b.average_r_60m || 999)).slice(0, 5),
    unresolved_risks: [
      'fills are assumed from OHLC bars, not order queue data',
      'slippage and fees are not modeled',
      'classification is historical evidence, not a live rule',
      'some source combos have small unique setup counts',
      'visual discretionary pattern quality is only approximated by acceptance metrics',
    ],
  };
}

async function runFakeBreakdownV2Research(options = {}) {
  const config = { ...DEFAULT_V2_PROP_CONFIG, ...(options.prop || {}) };
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esCsvBars = loadHistoricalCsvBars('ES');
  const setups = [];
  const rows = [];
  const heatmapComparisons = [];

  for (const session of sessions) {
    const facts = factsForSession(timeline.events, session.date);
    heatmapComparisons.push(...spxHeatmapComparisonsForSession({ session, timelineEvents: timeline.events, spxBars }));
    const sessionSetups = detectV2SetupsForSession({ session, timelineEvents: timeline.events, spxBars });
    setups.push(...sessionSetups);
    for (const setup of sessionSetups) {
      rows.push(...planRowsForSetup({ setup, bars: session.replayBars, facts, spxBars, config }));
    }
  }

  annotateDailyRisk(rows, config);
  const aggregates = buildAggregates(rows);
  const reaction = rows.filter(row => row.archetype === 'REACTION_SCALP');
  const levelToLevel = rows.filter(row => row.archetype === 'LEVEL_TO_LEVEL_LONG');
  const staged = rows.filter(row => row.archetype === 'STAGED_LONG');
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'fake_breakdown_reclaim_long_v2',
    sessions: sessions.length,
    excluded_sessions: excluded,
    date_range: sessions.length ? { start: sessions[0].date, end: sessions[sessions.length - 1].date } : null,
    es_1m_bars: summarizeBars(esCsvBars),
    spx_1m_bars: summarizeBars(spxBars),
    source_timeline_events: timeline.event_count,
    source_timeline_usable_events: timeline.usable_event_count,
    unique_setups: setups.length,
    valid_reclaim_setups: setups.filter(setup => setup.valid_reclaim).length,
    candidate_rows: rows.length,
    reaction_scalp_candidates: new Set(reaction.map(row => row.setup_id)).size,
    level_to_level_candidates: new Set(levelToLevel.map(row => row.setup_id)).size,
    staged_long_candidates: new Set(staged.map(row => row.setup_id)).size,
    no_lookahead_enforced: true,
    basis: {
      actual_basis_methods_tested: ['native_es'],
      fixed_plus_30_strategy_rows: 0,
      spx_reference_only_cases: heatmapComparisons.length,
      spx_heatmap_minute_comparisons: heatmapComparisons.length,
      same_minute_es_spx_available: heatmapComparisons.filter(row => row.comparison_available).length,
    },
    overall: summarizeRows(rows),
    reaction_scalp: summarizeRows(reaction),
    level_to_level: summarizeRows(levelToLevel),
    staged_long: summarizeRows(staged),
    aggregates,
    immediate_2es_viable: 'inconclusive',
    staged_1_to_2_viable: 'inconclusive',
    level_to_level_more_promising_than_scalp: 'inconclusive',
    confidence: 'low',
  };

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-setups.json'), setups);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-results.json'), { summary, rows });
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-summary.csv'), toCsvRows(rows), [
    'setup_id', 'date', 'timestamp_et', 'archetype', 'classification', 'position_safety',
    'source_combo', 'entry_model', 'entry_price', 'stop_model', 'stop_points', 'active_risk_dollars',
    'target_model', 'tp1', 'tp2', 'reward_risk', 'tp1_hit', 'tp2_hit', 'stop_first',
    'max_heat_before_tp1', 'max_heat_before_tp2', 'r_60m', 'daily_drawdown_used',
  ]);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-reaction-scalp.json'), { summary: summary.reaction_scalp, rows: reaction });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-level-to-level.json'), { summary: summary.level_to_level, rows: levelToLevel });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-staged-long.json'), { summary: summary.staged_long, rows: staged });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-level-ladder.json'), levelLadderArtifact(setups));
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-target-selection.json'), targetSelectionArtifact(rows));
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-failure-analysis.json'), failureAnalysis(rows));

  return { summary, setups, rows };
}

module.exports = {
  runFakeBreakdownV2Research,
  planRowsForSetup,
  stopPrices,
  summarizeRows,
  buildAggregates,
};
