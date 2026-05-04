'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR, writeJson, writeCsv, average, median } = require('../common');
const { loadUsableSessions, loadHistoricalCsvBars, summarizeBars } = require('../corpus-loader');
const { buildSourceTimeline } = require('../source-timeline');
const { detectSetupsForSession, spxHeatmapComparisonsForSession } = require('./detector');
const { computeOutcome } = require('./metrics');
const { DEFAULT_PROP_CONFIG, classifyVariant, annotateDailyPropMetrics } = require('./prop-risk');

function stopPrices(setup, entryPrice, config = DEFAULT_PROP_CONFIG) {
  return [
    { stop_model: 'sweep_low_minus_1tick', stop_price: setup.sweep_low - 0.25 },
    { stop_model: 'sweep_low_minus_1point', stop_price: setup.sweep_low - 1 },
    { stop_model: 'level_minus_2points', stop_price: setup.executable_level - 2 },
    { stop_model: 'max_prop_stop_capped', stop_price: entryPrice - config.max_stop_points },
  ].map(row => ({ ...row, stop_price: Math.round(row.stop_price * 100) / 100 }));
}

function targetPrices(setup, entryPrice) {
  const rows = [2, 3, 4, 5, 8].map(points => ({
    target_model: `fixed_plus_${points}`,
    tp1: Math.round((entryPrice + points) * 100) / 100,
    tp2: null,
  }));
  if (Number.isFinite(setup.next_trusted_level_above) && setup.next_trusted_level_above > entryPrice + 0.5) {
    rows.push({
      target_model: 'next_trusted_level_above',
      tp1: setup.next_trusted_level_above,
      tp2: null,
    });
    rows.push({
      target_model: 'tp1_3_tp2_next_trusted',
      tp1: Math.round((entryPrice + 3) * 100) / 100,
      tp2: setup.next_trusted_level_above,
    });
    rows.push({
      target_model: 'tp1_4_tp2_next_trusted',
      tp1: Math.round((entryPrice + 4) * 100) / 100,
      tp2: setup.next_trusted_level_above,
    });
  }
  return rows;
}

function reclaimWindowBucket(minutes) {
  if (!Number.isFinite(minutes)) return 'no_reclaim';
  if (minutes <= 3) return '0_to_3';
  if (minutes <= 5) return '3_to_5';
  if (minutes <= 10) return '5_to_10';
  if (minutes <= 15) return '10_to_15';
  return 'late';
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

function riskBucket(stopPoints) {
  if (!Number.isFinite(stopPoints)) return 'unknown';
  if (stopPoints <= 2) return '0_to_2';
  if (stopPoints <= 3) return '2_to_3';
  if (stopPoints <= 5) return '3_to_5';
  return '5_plus';
}

function breakdownBucket(depth) {
  if (!Number.isFinite(depth)) return 'unknown';
  if (depth <= 1.5) return '1';
  if (depth <= 2.5) return '2';
  if (depth <= 4) return '3';
  return '5_plus';
}

function variantRowsForSetup(setup, bars, config = DEFAULT_PROP_CONFIG) {
  const rows = [];
  const chopVariants = setup.inside_chop
    ? ['chop_blocked', 'chop_allowed_after_reclaim']
    : ['no_chop'];
  const entryPoints = setup.valid_reclaim ? setup.entry_points : [{
    entry_model: 'none',
    entry_timestamp_et: setup.timestamp_et,
    entry_price: null,
    fill_assumption: 'no valid reclaim',
  }];
  for (const entry of entryPoints) {
    for (const stop of stopPrices(setup, entry.entry_price, config)) {
      const stopPoints = Number.isFinite(entry.entry_price) ? Math.round((entry.entry_price - stop.stop_price) * 100) / 100 : null;
      for (const target of targetPrices(setup, entry.entry_price || setup.executable_level)) {
        for (const chopRule of chopVariants) {
          const base = {
            setup_id: setup.id,
            strategy: setup.strategy,
            date: setup.date,
            timestamp_et: setup.timestamp_et,
            instrument: 'ES',
            level: setup.level,
            executable_level: setup.executable_level,
            original_level_instrument: setup.original_level_instrument,
            basis_method: setup.basis_method,
            basis: setup.basis,
            basis_diagnostic_only: setup.basis_diagnostic_only,
            level_sources: setup.level_sources,
            source_combo: setup.source_combo,
            source_freshness: setup.source_freshness,
            level_type: setup.level_type,
            inside_chop: setup.inside_chop,
            chop_rule_variant: chopRule,
            breakdown_depth: setup.breakdown_depth_actual,
            breakdown_depth_bucket: breakdownBucket(setup.breakdown_depth_test),
            minutes_below_level: setup.minutes_below_level,
            reclaim_window: reclaimWindowBucket(setup.minutes_below_level),
            reclaim_timestamp: setup.reclaim_timestamp,
            entry_model: entry.entry_model,
            entry_timestamp_et: entry.entry_timestamp_et,
            entry_price: entry.entry_price,
            fill_assumption: entry.fill_assumption,
            stop_model: stop.stop_model,
            stop_price: stop.stop_price,
            stop_points: stopPoints,
            target_model: target.target_model,
            tp1: target.tp1,
            tp2: target.tp2,
            contracts: config.contracts,
            invalidation: Number.isFinite(stop.stop_price) ? `below ${stop.stop_price}` : setup.invalid_reason,
            evidence: {
              sweep_low: setup.sweep_low,
              next_trusted_level_above: setup.next_trusted_level_above,
              basis_reason: setup.basis_reason,
              spx_heatmap_minute_comparison: setup.spx_heatmap_minute_comparison,
            },
            spx_heatmap_comparison_available: setup.spx_heatmap_minute_comparison?.comparison_available === true,
            spx_heatmap_event_id: setup.spx_heatmap_minute_comparison?.event_id || null,
            es_spx_same_minute_basis: setup.spx_heatmap_minute_comparison?.es_minus_spx ?? null,
            time_of_day_bucket: timeOfDay(setup.timestamp_et),
            risk_bucket: riskBucket(stopPoints),
            tp1_size: Number.isFinite(entry.entry_price) && Number.isFinite(target.tp1)
              ? Math.round((target.tp1 - entry.entry_price) * 100) / 100
              : null,
            valid_reclaim: setup.valid_reclaim,
            no_lookahead_violation: false,
          };
          const risk = classifyVariant(base, config);
          let row = { ...base, ...risk };
          if (row.classification !== 'PASS' && Number.isFinite(row.entry_price)) {
            row = {
              ...row,
              ...computeOutcome({
                bars,
                entryTimestamp: row.entry_timestamp_et,
                entryPrice: row.entry_price,
                stopPrice: row.stop_price,
                tp1: row.tp1,
                tp2: row.tp2,
                nextTrustedLevelAbove: setup.next_trusted_level_above,
              }),
            };
          } else {
            row = {
              ...row,
              tp1_hit: false,
              tp2_hit: false,
              stop_hit: false,
              stop_first: false,
              target_first: false,
              same_bar_ambiguity: false,
              result_class: setup.valid_reclaim ? 'invalid' : 'invalid',
            };
          }
          if (row.classification === 'WATCH_ONLY' && row.mfe_15m >= 4) row.result_class = 'watch_only_missed';
          if (row.classification === 'PASS' && row.mfe_15m >= 4) row.result_class = 'pass_missed_move';
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

function summarizeGroup(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] == null ? 'unknown' : String(row[key]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([value, group]) => ({
    [key]: value,
    unique_setups: new Set(group.map(row => row.setup_id)).size,
    variant_rows: group.length,
    tradeable_count: group.filter(row => row.classification === 'TRADEABLE').length,
    watch_only_count: group.filter(row => row.classification === 'WATCH_ONLY').length,
    pass_count: group.filter(row => row.classification === 'PASS').length,
    tp1_hit_rate: rate(group, row => row.tp1_hit),
    stop_first_rate: rate(group, row => row.stop_first),
    average_mfe_15m: average(group.map(row => row.mfe_15m)),
    median_mfe_15m: median(group.map(row => row.mfe_15m)),
    average_mae_15m: average(group.map(row => row.mae_15m)),
    median_mae_15m: median(group.map(row => row.mae_15m)),
    average_max_heat_before_tp1: average(group.map(row => row.max_heat_before_tp1)),
    average_time_to_tp1: average(group.filter(row => row.tp1_hit).map(row => {
      if (row.tp1_size === 2) return row.time_to_plus_2;
      if (row.tp1_size === 3) return row.time_to_plus_3;
      if (row.tp1_size === 4) return row.time_to_plus_4;
      if (row.tp1_size === 5) return row.time_to_plus_5;
      if (row.tp1_size === 8) return row.time_to_plus_8;
      return null;
    })),
    average_r_60m: average(group.map(row => row.r_60m)),
    simulated_daily_drawdown: maxOf(group.map(row => row.drawdown_used || 0)),
    prop_drawdown_failures: group.filter(row => row.would_eod_drawdown_fail || row.would_intraday_trailing_fail).length,
    confidence: group.length >= 100 ? 'high' : group.length >= 30 ? 'medium' : 'low',
  })).sort((a, b) => b.variant_rows - a.variant_rows);
}

function maxOf(values) {
  let max = 0;
  for (const value of values) {
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

function rate(group, predicate) {
  if (!group.length) return null;
  return group.filter(predicate).length / group.length;
}

function aggregate(rows) {
  return {
    by_source_combo: summarizeGroup(rows, 'source_combo'),
    by_saty_level_type: summarizeGroup(rows.filter(row => row.source_combo.includes('saty')), 'level_type'),
    by_mancini_level_type: summarizeGroup(rows.filter(row => row.source_combo.includes('mancini')), 'level_type'),
    by_bobby_confirmed: summarizeGroup(rows.map(row => ({ ...row, bobby_confirmed: row.source_combo.includes('bobby') })), 'bobby_confirmed'),
    by_dubz_aligned: summarizeGroup(rows.map(row => ({ ...row, dubz_aligned: row.source_combo.includes('dubz') })), 'dubz_aligned'),
    by_gex_confirmed: summarizeGroup(rows.map(row => ({ ...row, gex_confirmed: row.source_combo.includes('gex') })), 'gex_confirmed'),
    by_chop: summarizeGroup(rows.map(row => ({ ...row, chop_group: row.inside_chop ? row.chop_rule_variant : 'outside_chop' })), 'chop_group'),
    by_basis_method: summarizeGroup(rows, 'basis_method'),
    by_entry_model: summarizeGroup(rows, 'entry_model'),
    by_stop_model: summarizeGroup(rows, 'stop_model'),
    by_target_model: summarizeGroup(rows, 'target_model'),
    by_time_of_day_bucket: summarizeGroup(rows, 'time_of_day_bucket'),
    by_breakdown_depth_bucket: summarizeGroup(rows, 'breakdown_depth_bucket'),
    by_reclaim_window_bucket: summarizeGroup(rows, 'reclaim_window'),
    by_risk_bucket: summarizeGroup(rows, 'risk_bucket'),
    by_tp1_size: summarizeGroup(rows, 'tp1_size'),
  };
}

function toCsvRows(rows) {
  return rows.map(row => ({
    setup_id: row.setup_id,
    date: row.date,
    timestamp_et: row.timestamp_et,
    basis_method: row.basis_method,
    source_combo: row.source_combo,
    classification: row.classification,
    classification_reason: row.classification_reason,
    executable_level: row.executable_level,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_points: row.stop_points,
    risk_dollars: row.risk_dollars,
    target_model: row.target_model,
    tp1: row.tp1,
    tp2: row.tp2,
    tp1_hit: row.tp1_hit,
    stop_first: row.stop_first,
    same_bar_ambiguity: row.same_bar_ambiguity,
    mfe_15m: row.mfe_15m,
    mae_15m: row.mae_15m,
    max_heat_before_tp1: row.max_heat_before_tp1,
    r_60m: row.r_60m,
    allowed_under_prop_rules: row.allowed_under_prop_rules,
  }));
}

async function runPropFakeBreakdownResearch(options = {}) {
  const config = { ...DEFAULT_PROP_CONFIG, ...(options.prop || {}) };
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esCsvBars = loadHistoricalCsvBars('ES');
  const setups = [];
  const variants = [];
  const spxHeatmapMinuteComparisons = [];
  for (const session of sessions) {
    spxHeatmapMinuteComparisons.push(...spxHeatmapComparisonsForSession({ session, timelineEvents: timeline.events, spxBars }));
    const sessionSetups = detectSetupsForSession({ session, timelineEvents: timeline.events, spxBars });
    setups.push(...sessionSetups);
    for (const setup of sessionSetups) variants.push(...variantRowsForSetup(setup, session.replayBars, config));
  }
  annotateDailyPropMetrics(variants, config);
  const aggregates = aggregate(variants);
  const propSim = buildPropSim(variants);
  const basisComparison = {
    generated_at: new Date().toISOString(),
    by_basis_method: aggregates.by_basis_method,
    fixed_plus_30_diagnostic_rows: variants.filter(row => row.basis_method === 'fixed_plus_30_proxy').length,
    spx_reference_only_cases: spxHeatmapMinuteComparisons.length,
    actual_basis_methods_tested: [...new Set(variants.map(row => row.basis_method).filter(method =>
      ['same_minute_basis', 'session_open_basis', 'prior_close_basis', 'rolling_15m_basis', 'native_es'].includes(method)
    ))].sort(),
    spx_heatmap_minute_comparisons: {
      total: spxHeatmapMinuteComparisons.length,
      same_minute_es_spx_available: spxHeatmapMinuteComparisons.filter(row => row.comparison_available).length,
      attached_to_candidate_setups: setups.filter(setup => setup.spx_heatmap_minute_comparison?.comparison_available).length,
      conversion_used: false,
    },
    note: 'The prop evaluator uses ES minute bars and native ES executable levels. SPX heatmap events are reference-only and receive same-minute ES/SPX comparison when a timestamped SPX heatmap image is attached to that minute.',
  };
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'prop_fake_breakdown_reclaim_long_v1',
    prop_config: config,
    sessions: sessions.length,
    excluded_sessions: excluded,
    date_range: sessions.length ? { start: sessions[0].date, end: sessions[sessions.length - 1].date } : null,
    es_1m_bars: summarizeBars(esCsvBars),
    spx_1m_bars: summarizeBars(spxBars),
    unique_setups: setups.length,
    variant_rows: variants.length,
    classification_counts: {
      TRADEABLE: variants.filter(row => row.classification === 'TRADEABLE').length,
      WATCH_ONLY: variants.filter(row => row.classification === 'WATCH_ONLY').length,
      PASS: variants.filter(row => row.classification === 'PASS').length,
    },
    chop_cases: setups.filter(setup => setup.inside_chop).length,
    no_lookahead_enforced: true,
    aggregates,
    basis_comparison: basisComparison,
    spx_heatmap_minute_comparisons: basisComparison.spx_heatmap_minute_comparisons,
    prop_sim: propSim,
    long_only_prop_strategy_supported: 'inconclusive',
    confidence: variants.length >= 1000 ? 'medium' : 'low',
  };
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-setups.json'), setups);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-variants.json'), { summary, rows: variants });
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-summary.csv'), toCsvRows(variants), [
    'setup_id', 'date', 'timestamp_et', 'basis_method', 'source_combo', 'classification', 'classification_reason',
    'executable_level', 'entry_model', 'entry_price', 'stop_model', 'stop_points', 'risk_dollars',
    'target_model', 'tp1', 'tp2', 'tp1_hit', 'stop_first', 'same_bar_ambiguity',
    'mfe_15m', 'mae_15m', 'max_heat_before_tp1', 'r_60m', 'allowed_under_prop_rules',
  ]);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-source-combos.json'), aggregates.by_source_combo);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-basis-comparison.json'), basisComparison);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-chop-analysis.json'), {
    chop_cases: setups.filter(setup => setup.inside_chop),
    by_chop: aggregates.by_chop,
  });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-prop-sim.json'), propSim);
  return { summary, setups, variants };
}

function buildPropSim(rows) {
  const tradeable = rows.filter(row => row.classification === 'TRADEABLE');
  return {
    generated_at: new Date().toISOString(),
    tradeable_rows: tradeable.length,
    allowed_rows_after_daily_rules: tradeable.filter(row => row.allowed_under_prop_rules).length,
    daily_drawdown_failures: rows.filter(row => row.would_eod_drawdown_fail || row.would_intraday_trailing_fail).length,
    daily_kill_triggers: rows.filter(row => row.daily_kill_triggered).length,
    max_drawdown_used: maxOf(rows.map(row => row.drawdown_used || 0)),
    note: 'Daily simulation is per entry/stop/target/basis policy group to avoid mixing independent variants as one strategy.',
  };
}

module.exports = {
  runPropFakeBreakdownResearch,
  variantRowsForSetup,
  stopPrices,
  targetPrices,
  aggregate,
  summarizeGroup,
};
