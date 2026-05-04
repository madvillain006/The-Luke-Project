'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR, ROOT, readJson, writeJson, writeCsv, average, median } = require('../common');
const { loadUsableSessions } = require('../corpus-loader');
const { runFakeBreakdownV2Research } = require('../fake-breakdown-v2/evaluator');
const { computePlanOutcome } = require('../fake-breakdown-v2/metrics');
const {
  buildBobbyDistanceMap,
  bobbyDistanceForRow,
  entryModelGroup,
  makeObservation,
  rounded,
} = require('./feature-extractor');
const { DEFAULT_25K_ACCOUNT, DEFAULT_50K_ACCOUNT, searchCombos, summarizeRows } = require('./combo-search');
const { renderReadme } = require('./report');

const V3_ENTRY_GROUPS = new Set([
  'two_candle_hold_above_level',
  'three_candle_hold_above_level',
  'higher_low_after_reclaim',
  'micro_pivot_break',
  'first_retest_hold',
]);

function loadV2Artifacts() {
  const resultsPath = path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-results.json');
  const setupsPath = path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-setups.json');
  let results = readJson(resultsPath);
  let setups = readJson(setupsPath);
  if (!results?.rows || !Array.isArray(setups)) return null;
  return { results, setups };
}

async function ensureV2Artifacts() {
  const existing = loadV2Artifacts();
  if (existing) return existing;
  const { summary, setups, rows } = await runFakeBreakdownV2Research();
  return { results: { summary, rows }, setups };
}

function buildSessionBarsByDate() {
  const { sessions } = loadUsableSessions();
  const map = new Map();
  for (const session of sessions) map.set(session.date, session.replayBars || []);
  return map;
}

function buildTp3Map(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.archetype !== 'REACTION_SCALP') continue;
    if (row.target_model !== 'fixed_plus_3') continue;
    const key = [row.setup_id, row.entry_model, row.stop_model, row.position_model].join('|');
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function buildTargetContextMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.setup_id || !row?.entry_model) continue;
    const key = `${row.setup_id}|${row.entry_model}`;
    const existing = map.get(key) || {
      bobby_heatmap_target_present: false,
      gex_heatseeker_target_present: false,
      dubz_aligned: false,
      level_ladder_above_count: 0,
      level_ladder_below_count: 0,
      evidence: {},
    };
    existing.bobby_heatmap_target_present = existing.bobby_heatmap_target_present || row.bobby_heatmap_target_present === true;
    existing.gex_heatseeker_target_present = existing.gex_heatseeker_target_present || row.gex_heatseeker_target_present === true;
    existing.dubz_aligned = existing.dubz_aligned || row.dubz_aligned === true;
    existing.level_ladder_above_count = Math.max(existing.level_ladder_above_count, row.level_ladder_above_count || 0);
    existing.level_ladder_below_count = Math.max(existing.level_ladder_below_count, row.level_ladder_below_count || 0);
    existing.evidence = { ...existing.evidence, ...(row.evidence || {}) };
    map.set(key, existing);
  }
  return map;
}

function observationSourceRows(rows) {
  return (rows || []).filter(row => (
    row.archetype === 'REACTION_SCALP'
    && row.target_model === 'fixed_plus_2'
    && V3_ENTRY_GROUPS.has(entryModelGroup(row.entry_model))
    && row.basis_method !== 'fixed_plus_30_proxy'
    && row.basis_method !== 'reference_only'
  ));
}

function stopRows(setup, entry) {
  const sweep = Number.isFinite(setup.sweep_low) ? rounded(setup.sweep_low - 0.25) : null;
  return [
    { stop_model: 'sweep_low_minus_1tick', stop_price: sweep },
    { stop_model: 'max_prop_stop_capped', stop_price: rounded(entry.entry_price - 3) },
  ].filter(stop => Number.isFinite(stop.stop_price));
}

function stopPoints(entryPrice, stopPrice) {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopPrice)) return null;
  return rounded(entryPrice - stopPrice);
}

function fixedTargetRow({ setup, entry, stop, bars, targetPoints, context }) {
  const sp = stopPoints(entry.entry_price, stop.stop_price);
  const tp1 = rounded(entry.entry_price + targetPoints);
  return {
    setup_id: setup.id,
    strategy: 'fake_breakdown_v3_live_filters_source',
    archetype: 'REACTION_SCALP',
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
    target_model: `fixed_plus_${targetPoints}`,
    tp1,
    tp2: null,
    target_distance: targetPoints,
    breakdown_depth: setup.breakdown_depth_actual,
    reclaim_window: setup.reclaim_windows?.[0] || null,
    minutes_below_level: setup.minutes_below_level,
    inside_chop: setup.inside_chop,
    valid_reclaim: setup.valid_reclaim,
    bobby_heatmap_target_present: context?.bobby_heatmap_target_present === true,
    gex_heatseeker_target_present: context?.gex_heatseeker_target_present === true,
    dubz_aligned: context?.dubz_aligned === true,
    level_ladder_above_count: context?.level_ladder_above_count || 0,
    level_ladder_below_count: context?.level_ladder_below_count || 0,
    no_lookahead_violation: false,
    classification: 'V3_OBSERVATION_NOT_HINDSIGHT_CLASSIFIED',
    evidence: {
      sweep_low: setup.sweep_low,
      source_freshness: setup.source_freshness || null,
      spx_heatmap_minute_comparison: setup.spx_heatmap_minute_comparison || null,
      ...(context?.evidence || {}),
    },
    ...computePlanOutcome({
      bars,
      entryTimestamp: entry.entry_timestamp_et,
      entryPrice: entry.entry_price,
      stopPrice: stop.stop_price,
      tp1,
      tp2: null,
    }),
  };
}

function buildObservations({ rows, setups, barsByDate, account25k = DEFAULT_25K_ACCOUNT, account50k = DEFAULT_50K_ACCOUNT }) {
  const bobbyDistanceMap = buildBobbyDistanceMap(rows);
  const targetContextMap = buildTargetContextMap(rows);
  const out = [];
  for (const setup of setups || []) {
    if (!setup.valid_reclaim || setup.basis_method === 'fixed_plus_30_proxy' || setup.basis_method === 'reference_only') continue;
    const bars = barsByDate.get(setup.date) || [];
    for (const entry of setup.entry_models_v2 || []) {
      if (!V3_ENTRY_GROUPS.has(entryModelGroup(entry.entry_model))) continue;
      const context = targetContextMap.get(`${setup.id}|${entry.entry_model}`) || null;
      for (const stop of stopRows(setup, entry)) {
        const row = fixedTargetRow({ setup, entry, stop, bars, targetPoints: 2, context });
        const tp3Row = fixedTargetRow({ setup, entry, stop, bars, targetPoints: 3, context });
        const observation = makeObservation({
          row,
          setup,
          bars,
          tp3Row,
          bobbyDistance: bobbyDistanceForRow(row, bobbyDistanceMap),
          accounts: { account25k, account50k },
        });
        out.push(observation);
      }
    }
  }
  return out;
}

function buildObservationsFromV2Rows({ rows, setups, barsByDate, account25k = DEFAULT_25K_ACCOUNT, account50k = DEFAULT_50K_ACCOUNT }) {
  const setupMap = new Map((setups || []).map(setup => [setup.id, setup]));
  const tp3Map = buildTp3Map(rows);
  const bobbyDistanceMap = buildBobbyDistanceMap(rows);
  const out = [];
  for (const row of observationSourceRows(rows)) {
    const setup = setupMap.get(row.setup_id);
    if (!setup) continue;
    const tp3Row = tp3Map.get([row.setup_id, row.entry_model, row.stop_model, row.position_model].join('|')) || null;
    out.push(makeObservation({
      row,
      setup,
      bars: barsByDate.get(row.date) || [],
      tp3Row,
      bobbyDistance: bobbyDistanceForRow(row, bobbyDistanceMap),
      accounts: { account25k, account50k },
    }));
  }
  return out;
}

function bestRules(comboSummaries) {
  const viable = (comboSummaries || []).filter(row => row.taken_setup_count >= 30);
  const mediumOrBetter = (comboSummaries || []).filter(row => row.taken_setup_count >= 50);
  const highConfidence = (comboSummaries || []).filter(row => row.confidence === 'high');
  const sortedBy2es = viable.slice().sort((a, b) => (
    (b.expectancy_2es_slip_0_5_round_trip || -9999) - (a.expectancy_2es_slip_0_5_round_trip || -9999)
  ));
  const sortedMediumBy2es = mediumOrBetter.slice().sort((a, b) => (
    (b.expectancy_2es_slip_0_5_round_trip || -9999) - (a.expectancy_2es_slip_0_5_round_trip || -9999)
  ));
  const sortedHighBy2es = highConfidence.slice().sort((a, b) => (
    (b.expectancy_2es_slip_0_5_round_trip || -9999) - (a.expectancy_2es_slip_0_5_round_trip || -9999)
  ));
  const sortedBy1es = viable.slice().sort((a, b) => (
    (b.expectancy_1es_slip_0_5_round_trip || -9999) - (a.expectancy_1es_slip_0_5_round_trip || -9999)
  ));
  const bobby = viable.filter(row => row.filter_ids.includes('bobby_target_present'))
    .sort((a, b) => (b.expectancy_2es_slip_0_5_round_trip || -9999) - (a.expectancy_2es_slip_0_5_round_trip || -9999));
  return {
    best_2es_rule: sortedBy2es[0] || null,
    best_medium_or_better_2es_rule: sortedMediumBy2es[0] || null,
    best_high_confidence_2es_rule: sortedHighBy2es[0] || null,
    best_1es_rule: sortedBy1es[0] || null,
    best_bobby_rule: bobby[0] || null,
    top_10_by_2es_expectancy: sortedBy2es.slice(0, 10),
    top_10_by_1es_expectancy: sortedBy1es.slice(0, 10),
  };
}

function groupSummary(rows, key) {
  const groups = new Map();
  for (const row of rows || []) {
    const value = row[key] == null ? 'unknown' : String(row[key]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([value, group]) => ({
    [key]: value,
    ...summarizeRows(group),
  })).sort((a, b) => b.taken_rows - a.taken_rows);
}

function failureAnalysis(observations, combos, rules) {
  const best = rules.best_2es_rule;
  const bobbyRows = observations.filter(row => row.bobby_heatmap_target_present);
  return {
    forbidden_filter_policy: 'filter uses are checked against an allowlist and reject MFE, MAE, TP, stop, classification, and heat-before-TP fields',
    baseline: summarizeRows(observations),
    bobby_target_present: summarizeRows(bobbyRows),
    best_rule: best,
    small_sample_combos: combos.filter(row => row.confidence === 'low').length,
    same_bar_ambiguity_rows: observations.filter(row => row.outcome?.same_bar_ambiguity).length,
    stop_first_rows: observations.filter(row => row.outcome?.stop_first).length,
    unresolved_risks: [
      'V3 consumes V2 OHLC artifacts; fills are still bar assumptions, not queue-level executions',
      'slippage is simplified to 0.5 ES points round trip and does not include commissions',
      'rows are filtered by observable features, but the selected thresholds were still chosen after seeing V2 research',
      'Bobby target distance is unavailable for some target-present rows and is labeled present_distance_unknown',
      'same-bar TP/stop ambiguity is treated conservatively as stop-first',
      '50k side project changes drawdown/profit target only; it does not prove account-passing reliability',
    ],
  };
}

function toCsvRows(combos) {
  return (combos || []).map(row => ({
    combo_id: row.combo_id,
    label: row.label,
    unique_setup_count: row.unique_setup_count,
    taken_setup_count: row.taken_setup_count,
    taken_rows: row.taken_rows,
    tp2_hit_rate: row.tp2_hit_rate,
    tp3_hit_rate: row.tp3_hit_rate,
    stop_first_rate: row.stop_first_rate,
    average_mae_before_tp1: row.average_mae_before_tp1,
    median_mae_before_tp1: row.median_mae_before_tp1,
    median_time_to_tp1: row.median_time_to_tp1,
    expectancy_2es_slip_0_5_round_trip: row.expectancy_2es_slip_0_5_round_trip,
    expectancy_1es_slip_0_5_round_trip: row.expectancy_1es_slip_0_5_round_trip,
    daily_drawdown_failures_25k_2es: row.daily_drawdown_failures_25k_2es,
    daily_drawdown_failures_25k_1es: row.daily_drawdown_failures_25k_1es,
    confidence: row.confidence,
  }));
}

function dateRange(rows) {
  const dates = [...new Set((rows || []).map(row => row.date).filter(Boolean))].sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

async function runFakeBreakdownV3Research(options = {}) {
  const { results, setups } = await ensureV2Artifacts();
  const barsByDate = buildSessionBarsByDate();
  const account25k = { ...DEFAULT_25K_ACCOUNT, ...(options.account25k || {}) };
  const account50k = { ...DEFAULT_50K_ACCOUNT, ...(options.account50k || {}) };
  const observations = buildObservations({ rows: results.rows, setups, barsByDate, account25k, account50k });
  const combos = searchCombos(observations, { account25k, account50k, maxSize: options.maxComboSize || 3, minRows: options.minRows || 10 });
  const rules = bestRules(combos);
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'fake_breakdown_v3_live_filters',
    source_artifact: 'artifacts/research/fake-breakdown-v2-results.json',
    v2_source_summary: results.summary || null,
    date_range: dateRange(observations),
    unique_setups: new Set(observations.map(row => row.setup_id)).size,
    observation_rows: observations.length,
    no_lookahead_enforced: true,
    target_primary: 'fixed_plus_2_es_points',
    target_secondary: 'fixed_plus_3_es_points',
    filter_policy: 'pre-entry allowlist only; future outcome fields are blocked from filter predicates',
    account_25k: account25k,
    account_50k_side_project: account50k,
    baseline: summarizeRows(observations, { account25k, account50k }),
    by_entry_model_group: groupSummary(observations, 'entry_model_group'),
    by_bobby_target_presence: groupSummary(observations, 'bobby_heatmap_target_present'),
    by_bobby_target_distance_bucket: groupSummary(observations, 'bobby_target_distance_bucket'),
    by_time_below_bucket: groupSummary(observations, 'time_below_bucket'),
    by_sweep_depth_bucket: groupSummary(observations, 'sweep_depth_bucket'),
    by_time_of_day_bucket: groupSummary(observations, 'time_of_day_bucket_v3'),
    best_rules: rules,
    conclusion: {
      bobby_target_remained_useful: rules.best_bobby_rule ? 'yes_but_sample_dependent' : 'inconclusive',
      two_es_viable: rules.best_2es_rule?.expectancy_2es_slip_0_5_round_trip > 0 && rules.best_2es_rule?.confidence !== 'low' ? 'inconclusive_watchlist_only' : 'no',
      one_es_starter_better: (rules.best_1es_rule?.expectancy_1es_slip_0_5_round_trip || -9999) > (rules.best_2es_rule?.expectancy_2es_slip_0_5_round_trip || -9999) ? 'yes_in_research' : 'inconclusive',
      live_rule_status: 'watchlist_only_not_live_rule',
      confidence: rules.best_2es_rule?.confidence || 'low',
    },
  };
  const failure = failureAnalysis(observations, combos, rules);

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-results.json'), { summary, rows: observations });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-filter-combos.json'), combos);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-best-rules.json'), rules);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-failure-analysis.json'), failure);
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-summary.csv'), toCsvRows(combos), [
    'combo_id', 'label', 'unique_setup_count', 'taken_setup_count', 'taken_rows',
    'tp2_hit_rate', 'tp3_hit_rate', 'stop_first_rate', 'average_mae_before_tp1',
    'median_mae_before_tp1', 'median_time_to_tp1',
    'expectancy_2es_slip_0_5_round_trip', 'expectancy_1es_slip_0_5_round_trip',
    'daily_drawdown_failures_25k_2es', 'daily_drawdown_failures_25k_1es', 'confidence',
  ]);
  const doc = renderReadme({ summary, rules, failure });
  fs.writeFileSync(path.join(ROOT, 'docs', 'FAKE_BREAKDOWN_V3_LIVE_FILTERS.md'), doc, 'utf8');
  return { summary, rows: observations, combos, rules, failure };
}

module.exports = {
  V3_ENTRY_GROUPS,
  loadV2Artifacts,
  ensureV2Artifacts,
  buildSessionBarsByDate,
  buildTp3Map,
  observationSourceRows,
  buildObservations,
  buildObservationsFromV2Rows,
  buildTargetContextMap,
  bestRules,
  groupSummary,
  failureAnalysis,
  runFakeBreakdownV3Research,
};
