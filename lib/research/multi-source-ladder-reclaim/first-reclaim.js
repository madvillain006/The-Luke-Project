'use strict';

const {
  reclaimCloseEntry,
  levelReclaimLimitEntry,
  retestHoldEntry,
  holdAboveEntry,
  higherLowEntry,
  microPivotBreakEntry,
} = require('../fake-breakdown-v2/entry-models');
const { buildTrustedLadder, nextExecutableClustersAbove } = require('./ladder');
const { rounded } = require('./level-clusters');

function setupFromFlush(flush) {
  return {
    id: flush.id,
    date: flush.date,
    valid_reclaim: true,
    executable_level: flush.first_reclaimed_price,
    reclaim_timestamp: flush.reclaim_timestamp_et,
    sweep_low: flush.sweep_low,
    timestamp_et: flush.timestamp_et,
  };
}

function renameEntry(entry) {
  if (!entry) return null;
  const names = {
    reclaim_close: 'reclaim_close_first_cluster',
    level_reclaim_limit: 'first_cluster_plus_025',
    retest_hold: 'first_retest_hold_first_cluster',
    '2_candle_hold': 'two_candle_hold_above_first_cluster',
    higher_low_after_reclaim: 'higher_low_after_first_cluster_reclaim',
    micro_pivot_break: 'micro_pivot_break_after_first_cluster_reclaim',
  };
  return {
    ...entry,
    entry_model: names[entry.entry_model] || entry.entry_model,
  };
}

function buildFirstReclaimEntries(flush, bars) {
  const setup = setupFromFlush(flush);
  return [
    reclaimCloseEntry(setup, bars),
    levelReclaimLimitEntry(setup, bars, 0.25),
    retestHoldEntry(setup, bars),
    holdAboveEntry(setup, bars, 2),
    higherLowEntry(setup, bars),
    microPivotBreakEntry(setup, bars),
  ].map(renameEntry).filter(Boolean);
}

function stopCandidates(flush, entryPrice, config = {}) {
  const preferredMax = Number.isFinite(config.preferred_max_stop_points) ? config.preferred_max_stop_points : 3;
  const hardMax = Number.isFinite(config.hard_max_stop_points) ? config.hard_max_stop_points : 5;
  const reclaimLow = flush.reclaim_bar?.low ?? null;
  const candidates = [
    { stop_model: 'first_cluster_minus_2points', stop_price: flush.first_reclaimed_price - 2 },
    { stop_model: 'reclaim_candle_low_minus_1tick', stop_price: Number.isFinite(reclaimLow) ? reclaimLow - 0.25 : null },
    { stop_model: 'sweep_low_if_prop_safe', stop_price: flush.sweep_low - 0.25 },
    { stop_model: 'prop_capped_stop', stop_price: entryPrice - preferredMax },
  ].map(row => ({ ...row, stop_price: rounded(row.stop_price) }))
    .filter(row => Number.isFinite(row.stop_price) && row.stop_price < entryPrice);

  return candidates.map(row => ({
    ...row,
    stop_points: rounded(entryPrice - row.stop_price),
    hard_max_stop_ok: entryPrice - row.stop_price <= hardMax,
  }));
}

function targetCandidates({ flush, entryPrice, ladder }) {
  const above = nextExecutableClustersAbove(ladder, entryPrice, { minDistance: 0.25 });
  const next = above[0] || flush.next_cluster_above || null;
  const second = above[1] || flush.second_cluster_above || null;
  const fixed = [2, 3, 4].map(points => ({
    target_model: `fixed_plus_${points}`,
    tp1: rounded(entryPrice + points),
    tp2: null,
    target_cluster: null,
    target_distance: points,
    target_basis_method: 'native_es',
  }));
  const clusterTargets = [];
  if (next?.canonical_price_es > entryPrice + 0.25) {
    clusterTargets.push({
      target_model: 'next_trusted_cluster_above',
      tp1: rounded(next.canonical_price_es),
      tp2: null,
      target_cluster: next,
      target_distance: rounded(next.canonical_price_es - entryPrice),
      target_basis_method: next.basis_method,
    });
    clusterTargets.push({
      target_model: 'tp1_plus_2_runner_next_cluster',
      tp1: rounded(entryPrice + 2),
      tp2: rounded(next.canonical_price_es),
      target_cluster: next,
      target_distance: rounded(next.canonical_price_es - entryPrice),
      target_basis_method: next.basis_method,
    });
  }
  if (second?.canonical_price_es > entryPrice + 0.25) {
    clusterTargets.push({
      target_model: 'second_trusted_cluster_above',
      tp1: rounded(entryPrice + 2),
      tp2: rounded(second.canonical_price_es),
      target_cluster: second,
      target_distance: rounded(second.canonical_price_es - entryPrice),
      target_basis_method: second.basis_method,
    });
  }
  return [...fixed, ...clusterTargets];
}

function buildFirstReclaimPlanSpace({ flush, entry, bars, facts, spxBars, config }) {
  const ladder = buildTrustedLadder({
    facts,
    timestamp: entry.entry_timestamp_et,
    esBars: bars,
    spxBars,
    clusterTolerance: config.cluster_tolerance,
    basisMethods: config.basis_methods,
  });
  return {
    ladder,
    stops: stopCandidates(flush, entry.entry_price, config),
    targets: targetCandidates({ flush, entryPrice: entry.entry_price, ladder }),
  };
}

module.exports = {
  setupFromFlush,
  buildFirstReclaimEntries,
  stopCandidates,
  targetCandidates,
  buildFirstReclaimPlanSpace,
};
