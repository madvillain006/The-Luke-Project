'use strict';

const FORBIDDEN_FILTER_KEYS = new Set([
  'mfe_3m', 'mfe_5m', 'mfe_10m', 'mfe_15m', 'mfe_30m', 'mfe_60m',
  'mae_3m', 'mae_5m', 'mae_10m', 'mae_15m', 'mae_30m', 'mae_60m',
  'max_heat_before_tp1', 'max_heat_before_tp2',
  'tp1_hit', 'tp2_hit', 'stop_hit', 'stop_first', 'target_first',
  'tp2_first', 'tp1_first', 'first_hit',
  'time_to_tp1', 'time_to_tp2', 'time_to_stop',
  'r_5m', 'r_15m', 'r_30m', 'r_60m',
  'classification', 'classification_reason',
  'pnl_2es', 'pnl_1es', 'expectancy',
]);

const PRE_ENTRY_FEATURE_KEYS = new Set([
  'bobby_heatmap_target_present',
  'bobby_target_distance_bucket',
  'entry_model_group',
  'sweep_depth_bucket',
  'time_below_bucket',
  'reclaim_close_above_level',
  'reclaim_close_upper_half',
  'reclaim_close_upper_third',
  'reclaim_range_not_excessive',
  'two_closes_above_level',
  'three_closes_above_level',
  'no_close_below_before_entry',
  'no_trusted_level_within_2_above',
  'next_trusted_target_at_least_3',
  'next_trusted_target_at_least_4',
  'chop_status',
  'time_of_day_bucket_v3',
  'stop_points_bucket',
  'stop_within_preferred',
  'stop_within_hard',
  'position_model_test',
]);

function assertFilterUsesAllowed(keys) {
  for (const key of keys || []) {
    if (FORBIDDEN_FILTER_KEYS.has(key)) throw new Error(`future outcome key is not allowed as V3 filter: ${key}`);
    if (!PRE_ENTRY_FEATURE_KEYS.has(key)) throw new Error(`unknown or non-whitelisted V3 filter key: ${key}`);
  }
}

function predicate(id, label, uses, test) {
  assertFilterUsesAllowed(uses);
  return { id, label, uses, test };
}

function buildPredicates() {
  return [
    predicate('bobby_target_present', 'Bobby/heatmap target present', ['bobby_heatmap_target_present'], row => row.bobby_heatmap_target_present === true),
    predicate('bobby_target_2_4', 'Bobby target 2-4 points above', ['bobby_target_distance_bucket'], row => row.bobby_target_distance_bucket === '2_to_4'),
    predicate('bobby_target_4_8', 'Bobby target 4-8 points above', ['bobby_target_distance_bucket'], row => row.bobby_target_distance_bucket === '4_to_8'),
    predicate('bobby_target_8_plus', 'Bobby target 8+ points above', ['bobby_target_distance_bucket'], row => row.bobby_target_distance_bucket === '8_plus'),
    predicate('entry_2_candle_hold', 'Two-candle hold above level', ['entry_model_group'], row => row.entry_model_group === 'two_candle_hold_above_level'),
    predicate('entry_3_candle_hold', 'Three-candle hold above level', ['entry_model_group'], row => row.entry_model_group === 'three_candle_hold_above_level'),
    predicate('entry_higher_low', 'Higher-low after reclaim', ['entry_model_group'], row => row.entry_model_group === 'higher_low_after_reclaim'),
    predicate('entry_micro_pivot', 'Micro-pivot break', ['entry_model_group'], row => row.entry_model_group === 'micro_pivot_break'),
    predicate('entry_first_retest', 'First retest hold', ['entry_model_group'], row => row.entry_model_group === 'first_retest_hold'),
    predicate('sweep_1_2', 'Sweep depth 1-2 points', ['sweep_depth_bucket'], row => row.sweep_depth_bucket === '1_to_2'),
    predicate('sweep_2_3', 'Sweep depth 2-3 points', ['sweep_depth_bucket'], row => row.sweep_depth_bucket === '2_to_3'),
    predicate('sweep_3_5', 'Sweep depth 3-5 points', ['sweep_depth_bucket'], row => row.sweep_depth_bucket === '3_to_5'),
    predicate('time_below_le_3', 'Time below <=3 minutes', ['time_below_bucket'], row => row.time_below_bucket === 'lte_3'),
    predicate('time_below_le_5', 'Time below <=5 minutes', ['time_below_bucket'], row => ['lte_3', 'lte_5'].includes(row.time_below_bucket)),
    predicate('time_below_le_10', 'Time below <=10 minutes', ['time_below_bucket'], row => ['lte_3', 'lte_5', 'lte_10'].includes(row.time_below_bucket)),
    predicate('reclaim_upper_half', 'Reclaim closes in upper half', ['reclaim_close_upper_half'], row => row.reclaim_close_upper_half === true),
    predicate('reclaim_upper_third', 'Reclaim closes in upper third', ['reclaim_close_upper_third'], row => row.reclaim_close_upper_third === true),
    predicate('reclaim_range_ok', 'Reclaim range not excessive', ['reclaim_range_not_excessive'], row => row.reclaim_range_not_excessive === true),
    predicate('two_closes_above', 'At least 2 closes above before entry', ['two_closes_above_level'], row => row.two_closes_above_level === true),
    predicate('three_closes_above', 'At least 3 closes above before entry', ['three_closes_above_level'], row => row.three_closes_above_level === true),
    predicate('no_close_below', 'No close below after reclaim before entry', ['no_close_below_before_entry'], row => row.no_close_below_before_entry === true),
    predicate('no_overhead_2', 'No trusted level within 2 points overhead', ['no_trusted_level_within_2_above'], row => row.no_trusted_level_within_2_above === true),
    predicate('target_at_least_3', 'Next trusted target at least 3 points above', ['next_trusted_target_at_least_3'], row => row.next_trusted_target_at_least_3 === true),
    predicate('target_at_least_4', 'Next trusted target at least 4 points above', ['next_trusted_target_at_least_4'], row => row.next_trusted_target_at_least_4 === true),
    predicate('outside_chop', 'Outside chop', ['chop_status'], row => row.chop_status === 'outside_chop'),
    predicate('inside_reclaimed', 'Inside chop but reclaimed level', ['chop_status'], row => row.chop_status === 'inside_chop_reclaimed_level'),
    predicate('opening_30', 'Opening 30 minutes', ['time_of_day_bucket_v3'], row => row.time_of_day_bucket_v3 === 'opening_30_minutes'),
    predicate('mid_morning', 'Mid-morning', ['time_of_day_bucket_v3'], row => row.time_of_day_bucket_v3 === 'mid_morning'),
    predicate('lunch', 'Lunch', ['time_of_day_bucket_v3'], row => row.time_of_day_bucket_v3 === 'lunch'),
    predicate('power_hour', 'Power hour', ['time_of_day_bucket_v3'], row => row.time_of_day_bucket_v3 === 'power_hour'),
    predicate('stop_preferred', 'Stop <=3 points', ['stop_within_preferred'], row => row.stop_within_preferred === true),
    predicate('stop_hard', 'Stop <=5 points', ['stop_within_hard'], row => row.stop_within_hard === true),
  ];
}

function applyFilters(rows, filters) {
  for (const filter of filters || []) assertFilterUsesAllowed(filter.uses);
  return (rows || []).filter(row => (filters || []).every(filter => filter.test(row)));
}

module.exports = {
  FORBIDDEN_FILTER_KEYS,
  PRE_ENTRY_FEATURE_KEYS,
  assertFilterUsesAllowed,
  buildPredicates,
  applyFilters,
};
