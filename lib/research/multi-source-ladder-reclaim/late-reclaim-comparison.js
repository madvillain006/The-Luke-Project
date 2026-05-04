'use strict';

const { tsMs } = require('../common');
const { rounded } = require('./level-clusters');

function minutesBetween(a, b) {
  const at = tsMs(a);
  const bt = tsMs(b);
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return null;
  return Math.round((bt - at) / 60000);
}

function findLaterReclaim(bars, startIndex, cluster, maxMinutes = 60) {
  const start = tsMs(bars[startIndex]?.timestamp);
  const price = cluster?.canonical_price_es;
  if (!Number.isFinite(price)) return null;
  for (let i = startIndex + 1; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxMinutes) return null;
    const priorClose = i > 0 ? bars[i - 1].close : null;
    if (bars[i].close >= price && (!Number.isFinite(priorClose) || priorClose < price)) {
      return {
        late_reclaim_cluster: cluster,
        late_reclaim_timestamp_et: bars[i].timestamp,
        late_reclaim_index: i,
        late_reclaim_price: rounded(bars[i].close),
      };
    }
  }
  return null;
}

function compareLateReclaim({ flush, row, bars }) {
  const upper = (flush.upper_lost_clusters || [])
    .filter(cluster => cluster.canonical_price_es > flush.first_reclaimed_price + 0.25)
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  const firstUpper = upper[0] || flush.next_cluster_above || null;
  const late = findLaterReclaim(bars, flush.reclaim_index, firstUpper, 60);
  if (!late) {
    return {
      late_reclaim_available: false,
      points_captured_before_late_reclaim: null,
      late_reclaim_too_late: false,
      late_reclaim_reason: firstUpper ? 'upper_cluster_not_reclaimed_within_60m' : 'no_upper_cluster_to_compare',
    };
  }

  const pointsCaptured = rounded(late.late_reclaim_price - row.entry_price);
  const timeToLate = minutesBetween(row.entry_timestamp_et, late.late_reclaim_timestamp_et);
  const tooLateByTp = row.tp1_hit && Number.isFinite(row.time_to_tp1) && Number.isFinite(timeToLate) && row.time_to_tp1 <= timeToLate;
  const nextTargetDistanceFromLate = flush.second_cluster_above?.canonical_price_es
    ? rounded(flush.second_cluster_above.canonical_price_es - late.late_reclaim_price)
    : null;
  const tooLateByTargetSpace = Number.isFinite(nextTargetDistanceFromLate) && nextTargetDistanceFromLate < 2;

  return {
    late_reclaim_available: true,
    late_reclaim_cluster_id: firstUpper?.cluster_id || null,
    late_reclaim_level: firstUpper?.canonical_price_es || null,
    late_reclaim_timestamp_et: late.late_reclaim_timestamp_et,
    late_reclaim_price: late.late_reclaim_price,
    points_captured_before_late_reclaim: pointsCaptured,
    minutes_first_to_late_reclaim: timeToLate,
    late_reclaim_too_late: Boolean(tooLateByTp || tooLateByTargetSpace),
    late_reclaim_reason: tooLateByTp ? 'first_reclaim_tp1_hit_before_late_reclaim' : (tooLateByTargetSpace ? 'late_reclaim_target_space_too_small' : 'late_reclaim_comparable'),
  };
}

function summarizeLateComparison(rows) {
  const comparable = rows.filter(row => row.late_reclaim_available);
  const tooLate = rows.filter(row => row.late_reclaim_too_late);
  const captured = comparable.map(row => row.points_captured_before_late_reclaim).filter(Number.isFinite);
  return {
    comparable_rows: comparable.length,
    late_reclaim_too_late_cases: tooLate.length,
    average_points_captured_before_late_reclaim: captured.length
      ? rounded(captured.reduce((sum, n) => sum + n, 0) / captured.length)
      : null,
  };
}

module.exports = {
  findLaterReclaim,
  compareLateReclaim,
  summarizeLateComparison,
};
