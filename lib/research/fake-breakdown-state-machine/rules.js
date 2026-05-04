'use strict';

const { assertFilterUsesAllowed } = require('../fake-breakdown-v3/filters');

function rule(id, label, uses, test) {
  assertFilterUsesAllowed(uses);
  return { id, label, uses, test };
}

const NAMED_RULES = [
  rule(
    'A',
    'Rule A: power_hour + three_candle_hold + next target >=4',
    ['time_of_day_bucket_v3', 'entry_model_group', 'next_trusted_target_at_least_4'],
    row => row.time_of_day_bucket_v3 === 'power_hour'
      && row.entry_model_group === 'three_candle_hold_above_level'
      && row.next_trusted_target_at_least_4 === true
  ),
  rule(
    'B',
    'Rule B: power_hour + reclaim range not excessive + next target >=3',
    ['time_of_day_bucket_v3', 'reclaim_range_not_excessive', 'next_trusted_target_at_least_3'],
    row => row.time_of_day_bucket_v3 === 'power_hour'
      && row.reclaim_range_not_excessive === true
      && row.next_trusted_target_at_least_3 === true
  ),
  rule(
    'C',
    'Rule C: Bobby/heatmap target above + two_candle_hold',
    ['bobby_heatmap_target_present', 'entry_model_group'],
    row => row.bobby_heatmap_target_present === true
      && row.entry_model_group === 'two_candle_hold_above_level'
  ),
  rule(
    'D',
    'Rule D: micro_pivot_break + no overhead level within 2',
    ['entry_model_group', 'no_trusted_level_within_2_above'],
    row => row.entry_model_group === 'micro_pivot_break'
      && row.no_trusted_level_within_2_above === true
  ),
  rule(
    'E',
    'Rule E: higher_low_after_reclaim + target >=4',
    ['entry_model_group', 'next_trusted_target_at_least_4'],
    row => row.entry_model_group === 'higher_low_after_reclaim'
      && row.next_trusted_target_at_least_4 === true
  ),
  rule(
    'F',
    'Rule F: first_retest_hold + 1-2pt sweep + no overhead within 2',
    ['entry_model_group', 'sweep_depth_bucket', 'no_trusted_level_within_2_above'],
    row => row.entry_model_group === 'first_retest_hold'
      && row.sweep_depth_bucket === '1_to_2'
      && row.no_trusted_level_within_2_above === true
  ),
];

function matchingRules(row, rules = NAMED_RULES) {
  return rules.filter(candidate => candidate.test(row));
}

function planClassification(row) {
  const reasons = [];
  if (!row?.valid_reclaim) reasons.push('no_valid_reclaim');
  if (row?.no_lookahead_violation) reasons.push('no_lookahead_violation');
  if (row?.chop_status === 'inside_chop_blocked') reasons.push('active_chop_veto');
  if (!Number.isFinite(row?.entry_price)) reasons.push('no_entry_price');
  if (!Number.isFinite(row?.stop_points) || row.stop_points <= 0) reasons.push('no_safe_stop');
  if (row?.next_trusted_target_distance !== null && row.next_trusted_target_distance < 2) reasons.push('target_too_close');
  if (row?.basis_method === 'fixed_plus_30_proxy' || row?.basis_method === 'reference_only') reasons.push('non_executable_basis');
  if (Number.isFinite(row?.stop_points) && row.stop_points > 5) reasons.push('stop_exceeds_hard_max');

  if (reasons.length) return { classification: 'PASS', reason: reasons.join(';') };
  if (row.stop_points <= 3) return { classification: '2ES_FULL', reason: 'preferred_stop_and_risk' };
  if (row.stop_points <= 5 && row.next_trusted_target_at_least_4) return { classification: '1ES_ADD_LATER', reason: 'hard_stop_with_target_space' };
  if (row.stop_points <= 5) return { classification: '1ES_STARTER', reason: 'hard_stop_starter_only' };
  return { classification: 'WATCH_ONLY', reason: 'structure_present_but_not_prop_safe' };
}

function planPriority(classification) {
  return {
    '2ES_FULL': 0,
    '1ES_ADD_LATER': 1,
    '1ES_STARTER': 2,
    WATCH_ONLY: 3,
    PASS: 4,
  }[classification] ?? 9;
}

function chooseSignalForSetup(rows) {
  return (rows || []).slice().sort((a, b) => {
    const pa = a.final_state === 'TRADEABLE' ? planPriority(a.trade_plan?.classification) : planPriority(a.final_state === 'INVALIDATED' ? 'PASS' : 'WATCH_ONLY');
    const pb = b.final_state === 'TRADEABLE' ? planPriority(b.trade_plan?.classification) : planPriority(b.final_state === 'INVALIDATED' ? 'PASS' : 'WATCH_ONLY');
    if (pa !== pb) return pa - pb;
    const at = String(a.entry_timestamp_et || '');
    const bt = String(b.entry_timestamp_et || '');
    if (at !== bt) return at.localeCompare(bt);
    return (a.stop_points || 999) - (b.stop_points || 999);
  })[0] || null;
}

module.exports = {
  NAMED_RULES,
  rule,
  matchingRules,
  planClassification,
  planPriority,
  chooseSignalForSetup,
};
