'use strict';

const { average, median } = require('./common');

function sourceComboFromContext(context) {
  const names = Object.keys(context.source_counts || {})
    .filter(name => (context.source_counts[name] || 0) > 0)
    .sort();
  return names.length ? names.join('+') : 'none';
}

function confidenceForSampleSize(count) {
  if (count >= 50) return 'high';
  if (count >= 15) return 'medium';
  return 'low';
}

function summarizeBySourceCombo(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const combo = row.source_combo || 'none';
    if (!groups.has(combo)) groups.set(combo, []);
    groups.get(combo).push(row);
  }
  return [...groups.entries()].map(([combo, group]) => {
    const actionable = group.filter(row => row.adapter_action === 'LONG' || row.adapter_action === 'SHORT');
    const passWait = group.length - actionable.length;
    const mfe15 = group.map(row => row.outcome?.mfe_15m);
    const mae15 = group.map(row => row.outcome?.mae_15m);
    return {
      source_combo: combo,
      count: group.length,
      actionable_count: actionable.length,
      pass_wait_count: passWait,
      average_mfe_15m: average(mfe15),
      median_mfe_15m: median(mfe15),
      average_mae_15m: average(mae15),
      median_mae_15m: median(mae15),
      target_first_rate: rate(group, row => row.outcome?.target_stop_first === 'TARGET_FIRST'),
      stop_first_rate: rate(group, row => row.outcome?.target_stop_first === 'STOP_FIRST'),
      veto_save_count: group.filter(row => row.veto_saved_bad_trade).length,
      pass_miss_count: group.filter(row => row.pass_missed_move).length,
      confidence: confidenceForSampleSize(group.length),
    };
  }).sort((a, b) => b.count - a.count);
}

function rate(group, predicate) {
  if (!group.length) return null;
  return group.filter(predicate).length / group.length;
}

module.exports = {
  sourceComboFromContext,
  summarizeBySourceCombo,
  confidenceForSampleSize,
};
