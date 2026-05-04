'use strict';

const { tsMs, average } = require('../common');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function sweepDepthBucket(depth) {
  if (!Number.isFinite(depth)) return 'unknown';
  if (depth >= 1 && depth <= 2) return '1_to_2';
  if (depth > 2 && depth <= 3) return '2_to_3';
  if (depth > 3 && depth <= 5) return '3_to_5';
  if (depth > 5) return 'gt_5';
  return 'lt_1';
}

function timeBelowBucket(minutes) {
  if (!Number.isFinite(minutes)) return 'unknown';
  if (minutes <= 3) return 'lte_3';
  if (minutes <= 5) return 'lte_5';
  if (minutes <= 10) return 'lte_10';
  return 'gt_10';
}

function bobbyTargetDistanceBucket(distance) {
  if (!Number.isFinite(distance)) return 'none_or_unknown';
  if (distance >= 2 && distance <= 4) return '2_to_4';
  if (distance > 4 && distance <= 8) return '4_to_8';
  if (distance > 8) return '8_plus';
  return 'too_close';
}

function entryModelGroup(entryModel) {
  const map = {
    '2_candle_hold': 'two_candle_hold_above_level',
    '3_candle_hold': 'three_candle_hold_above_level',
    higher_low_after_reclaim: 'higher_low_after_reclaim',
    micro_pivot_break: 'micro_pivot_break',
    retest_hold: 'first_retest_hold',
  };
  return map[entryModel] || 'not_v3_entry';
}

function timeOfDayBucket(timestamp) {
  const m = String(timestamp || '').match(/T(\d{2}):(\d{2})/);
  if (!m) return 'unknown';
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes < 570) return 'premarket';
  if (minutes < 600) return 'opening_30_minutes';
  if (minutes < 690) return 'mid_morning';
  if (minutes < 810) return 'lunch';
  if (minutes >= 900 && minutes <= 960) return 'power_hour';
  return 'afternoon';
}

function barsBetween(bars, startTimestamp, endTimestamp) {
  const start = tsMs(startTimestamp);
  const end = tsMs(endTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t >= start && t <= end;
  });
}

function barAtOrAfter(bars, timestamp) {
  const target = tsMs(timestamp);
  if (!Number.isFinite(target)) return null;
  return (bars || []).find(bar => tsMs(bar.timestamp) >= target) || null;
}

function reclaimQuality({ setup, bars, maxReclaimRange = 6 }) {
  const reclaimBar = barAtOrAfter(bars, setup?.reclaim_timestamp);
  const level = setup?.executable_level;
  const fallbackLocation = setup?.accumulation?.reclaim_close_location;
  const fallbackRange = setup?.accumulation?.reclaim_candle_size;
  const range = reclaimBar ? reclaimBar.high - reclaimBar.low : fallbackRange;
  const location = reclaimBar && range > 0 ? (reclaimBar.close - reclaimBar.low) / range : fallbackLocation;
  const close = reclaimBar?.close;
  return {
    reclaim_close_above_level: Number.isFinite(close) && Number.isFinite(level) ? close >= level : setup?.valid_reclaim === true,
    reclaim_close_upper_half: Number.isFinite(location) ? location >= 0.5 : false,
    reclaim_close_upper_third: Number.isFinite(location) ? location >= (2 / 3) : false,
    reclaim_range: rounded(range),
    reclaim_close_location: rounded(location),
    reclaim_range_not_excessive: Number.isFinite(range) ? range <= maxReclaimRange : false,
  };
}

function acceptanceFeatures({ setup, row, bars }) {
  const level = setup?.executable_level ?? row?.executable_level;
  const preEntryBars = barsBetween(bars, setup?.reclaim_timestamp, row?.entry_timestamp_et);
  if (preEntryBars.length) {
    const closesAbove = preEntryBars.filter(bar => Number.isFinite(level) && bar.close >= level).length;
    const closesBelow = preEntryBars.filter(bar => Number.isFinite(level) && bar.close < level).length;
    return {
      pre_entry_bar_count: preEntryBars.length,
      pre_entry_closes_above_level: closesAbove,
      two_closes_above_level: closesAbove >= 2,
      three_closes_above_level: closesAbove >= 3,
      no_close_below_before_entry: closesBelow === 0,
    };
  }

  const group = entryModelGroup(row?.entry_model);
  return {
    pre_entry_bar_count: 0,
    pre_entry_closes_above_level: null,
    two_closes_above_level: ['two_candle_hold_above_level', 'three_candle_hold_above_level'].includes(group),
    three_closes_above_level: group === 'three_candle_hold_above_level',
    no_close_below_before_entry: false,
  };
}

function nextTrustedDistance({ row, setup, bobbyTargetDistance }) {
  const candidates = [];
  if (Number.isFinite(bobbyTargetDistance)) candidates.push(bobbyTargetDistance);
  if (Number.isFinite(setup?.next_trusted_level_above) && Number.isFinite(row?.entry_price)) {
    candidates.push(setup.next_trusted_level_above - row.entry_price);
  }
  const usable = candidates.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  return usable.length ? rounded(usable[0]) : null;
}

function chopStatus(row) {
  if (!row?.inside_chop) return 'outside_chop';
  if (row?.valid_reclaim) return 'inside_chop_reclaimed_level';
  return 'inside_chop_blocked';
}

function stopPointsBucket(stopPoints) {
  if (!Number.isFinite(stopPoints)) return 'unknown';
  if (stopPoints <= 3) return 'lte_3';
  if (stopPoints <= 5) return 'lte_5';
  return 'gt_5';
}

function buildBobbyDistanceMap(rows) {
  const bySetupEntry = new Map();
  const bySetup = new Map();
  for (const row of rows || []) {
    if (row?.tp2_source !== 'bobby') continue;
    if (!Number.isFinite(row.target_distance) || row.target_distance <= 0) continue;
    const availableAt = row.target_available_at_et || row.evidence?.target_available_at_et;
    if (availableAt && tsMs(availableAt) > tsMs(row.entry_timestamp_et)) continue;
    const entryKey = `${row.setup_id}|${row.entry_model}`;
    const setupKey = row.setup_id;
    const existingEntry = bySetupEntry.get(entryKey);
    if (!existingEntry || row.target_distance < existingEntry.target_distance) {
      bySetupEntry.set(entryKey, {
        target_distance: rounded(row.target_distance),
        target_price: row.tp2,
        target_available_at_et: availableAt || null,
        target_basis_method: row.evidence?.target_basis_method || row.basis_method || null,
      });
    }
    const existingSetup = bySetup.get(setupKey);
    if (!existingSetup || row.target_distance < existingSetup.target_distance) {
      bySetup.set(setupKey, {
        target_distance: rounded(row.target_distance),
        target_price: row.tp2,
        target_available_at_et: availableAt || null,
        target_basis_method: row.evidence?.target_basis_method || row.basis_method || null,
      });
    }
  }
  return { bySetupEntry, bySetup };
}

function bobbyDistanceForRow(row, bobbyDistanceMap) {
  if (!bobbyDistanceMap) return null;
  return bobbyDistanceMap.bySetupEntry?.get(`${row.setup_id}|${row.entry_model}`)
    || bobbyDistanceMap.bySetup?.get(row.setup_id)
    || null;
}

function extractPreEntryFeatures({ row, setup, bars = [], bobbyDistance = null, maxReclaimRange = 6 }) {
  const bobbyTargetDistance = bobbyDistance?.target_distance ?? null;
  const targetDistance = nextTrustedDistance({ row, setup, bobbyTargetDistance });
  const group = entryModelGroup(row?.entry_model);
  const quality = reclaimQuality({ setup, bars, maxReclaimRange });
  const acceptance = acceptanceFeatures({ setup, row, bars });
  return {
    setup_id: row.setup_id,
    entry_timestamp_et: row.entry_timestamp_et,
    bobby_heatmap_target_present: row.bobby_heatmap_target_present === true,
    bobby_target_distance: bobbyTargetDistance,
    bobby_target_distance_bucket: row.bobby_heatmap_target_present === true
      ? (Number.isFinite(bobbyTargetDistance) ? bobbyTargetDistanceBucket(bobbyTargetDistance) : 'present_distance_unknown')
      : 'none',
    entry_model_group: group,
    sweep_depth_bucket: sweepDepthBucket(row.breakdown_depth ?? setup?.breakdown_depth_actual),
    time_below_bucket: timeBelowBucket(row.minutes_below_level ?? setup?.minutes_below_level),
    ...quality,
    ...acceptance,
    next_trusted_target_distance: targetDistance,
    no_trusted_level_within_2_above: Number.isFinite(targetDistance) ? targetDistance >= 2 : true,
    next_trusted_target_at_least_3: Number.isFinite(targetDistance) ? targetDistance >= 3 : false,
    next_trusted_target_at_least_4: Number.isFinite(targetDistance) ? targetDistance >= 4 : false,
    chop_status: chopStatus(row),
    time_of_day_bucket_v3: timeOfDayBucket(row.entry_timestamp_et || row.timestamp_et),
    stop_points_bucket: stopPointsBucket(row.stop_points),
    stop_within_preferred: Number.isFinite(row.stop_points) && row.stop_points <= 3,
    stop_within_hard: Number.isFinite(row.stop_points) && row.stop_points <= 5,
    position_model_test: row.stop_points <= 3 ? '2es_full_preferred' : (row.stop_points <= 5 ? '1es_or_hard_stop' : 'not_prop_safe'),
    pre_entry_feature_keys: [
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
    ],
  };
}

function makeObservation({ row, setup, bars = [], tp3Row = null, bobbyDistance = null, accounts = null }) {
  const features = extractPreEntryFeatures({ row, setup, bars, bobbyDistance });
  const tpPoints = Number.isFinite(row.tp1) && Number.isFinite(row.entry_price) ? rounded(row.tp1 - row.entry_price) : 2;
  const pnl2es = scalpPnl({ row, targetPoints: tpPoints, contracts: 2, slippageRoundTrip: 0.5 });
  const pnl1es = scalpPnl({ row, targetPoints: tpPoints, contracts: 1, slippageRoundTrip: 0.5 });
  return {
    setup_id: row.setup_id,
    row_key: [row.setup_id, row.entry_model, row.stop_model, row.target_model].join('|'),
    strategy: 'fake_breakdown_v3_live_filters',
    date: row.date,
    timestamp_et: row.timestamp_et,
    entry_timestamp_et: row.entry_timestamp_et,
    instrument: 'ES',
    level: row.level,
    executable_level: row.executable_level,
    source_combo: row.source_combo,
    level_type: row.level_type,
    basis_method: row.basis_method,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_price: row.stop_price,
    stop_points: row.stop_points,
    target_model: row.target_model,
    tp1: row.tp1,
    tp1_points: tpPoints,
    tp3: tp3Row?.tp1 ?? (Number.isFinite(row.entry_price) ? rounded(row.entry_price + 3) : null),
    valid_reclaim: row.valid_reclaim,
    no_lookahead_violation: row.no_lookahead_violation === true,
    original_v2_classification: row.classification,
    ...features,
    outcome: {
      tp2_hit: row.tp1_hit === true,
      tp3_hit: tp3Row?.tp1_hit === true,
      stop_first: row.stop_first === true || row.same_bar_ambiguity === true,
      stop_hit: row.stop_hit === true,
      same_bar_ambiguity: row.same_bar_ambiguity === true,
      mae_before_tp1: row.max_heat_before_tp1,
      mfe_60m: row.mfe_60m,
      mae_60m: row.mae_60m,
      median_inputs_available: Number.isFinite(row.max_heat_before_tp1),
      time_to_tp1: row.time_to_tp1,
    },
    prop: {
      two_es_risk_dollars: Number.isFinite(row.stop_points) ? rounded(row.stop_points * 100) : null,
      one_es_risk_dollars: Number.isFinite(row.stop_points) ? rounded(row.stop_points * 50) : null,
      two_es_full_preferred: Number.isFinite(row.stop_points) && row.stop_points <= 3,
      two_es_full_hard_ok: Number.isFinite(row.stop_points) && row.stop_points <= 5,
      one_es_starter_ok: Number.isFinite(row.stop_points) && row.stop_points <= 5,
      pnl_2es_slip_0_25_side: pnl2es,
      pnl_2es_slip_0_5_round_trip: pnl2es,
      pnl_1es_slip_0_25_side: pnl1es,
      pnl_1es_slip_0_5_round_trip: pnl1es,
      staged_add_plus_1_pnl: stagedPnl({ row, targetPoints: tpPoints, addTriggerPoints: 1, slippageRoundTrip: 0.5 }),
      staged_add_plus_2_pnl: stagedPnl({ row, targetPoints: tpPoints, addTriggerPoints: 2, slippageRoundTrip: 0.5 }),
      accounts,
    },
  };
}

function scalpPnl({ row, targetPoints = 2, contracts = 2, slippageRoundTrip = 0.5 }) {
  if (!Number.isFinite(row?.stop_points)) return 0;
  const dollarsPerPoint = 50 * contracts;
  if (row.same_bar_ambiguity || row.stop_first) return rounded(-(row.stop_points + slippageRoundTrip) * dollarsPerPoint);
  if (row.tp1_hit) return rounded((targetPoints - slippageRoundTrip) * dollarsPerPoint);
  return 0;
}

function stagedPnl({ row, targetPoints = 2, addTriggerPoints = 1, slippageRoundTrip = 0.5 }) {
  if (!Number.isFinite(row?.stop_points)) return 0;
  if (row.same_bar_ambiguity || row.stop_first) return rounded(-(row.stop_points + slippageRoundTrip) * 50);
  if (!row.tp1_hit) return 0;
  const starter = (targetPoints - slippageRoundTrip) * 50;
  const add = targetPoints > addTriggerPoints ? (targetPoints - addTriggerPoints - slippageRoundTrip) * 50 : 0;
  return rounded(starter + Math.max(0, add));
}

function averageMaeBeforeTp1(rows) {
  return average((rows || []).map(row => row.outcome?.mae_before_tp1));
}

module.exports = {
  rounded,
  sweepDepthBucket,
  timeBelowBucket,
  bobbyTargetDistanceBucket,
  entryModelGroup,
  timeOfDayBucket,
  barsBetween,
  reclaimQuality,
  acceptanceFeatures,
  buildBobbyDistanceMap,
  bobbyDistanceForRow,
  extractPreEntryFeatures,
  makeObservation,
  scalpPnl,
  stagedPnl,
  averageMaeBeforeTp1,
};
