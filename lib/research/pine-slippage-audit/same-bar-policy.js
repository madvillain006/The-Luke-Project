'use strict';

const { tsMs } = require('../common');

const SAME_BAR_POLICIES = Object.freeze([
  'target_first_optimistic',
  'stop_first_hard',
  'ambiguous_exclude',
  'ambiguous_report_only',
]);

function normalizeSameBarPolicy(policy = 'stop_first_hard') {
  const value = String(policy || 'stop_first_hard');
  if (value === 'target_first') return 'target_first_optimistic';
  if (value === 'stop_first_hard_mode') return 'stop_first_hard';
  if (SAME_BAR_POLICIES.includes(value)) return value;
  return 'stop_first_hard';
}

function classifyBarTouch(bar, { stopPrice, targetPrice }) {
  const hitStop = Number.isFinite(stopPrice) && Number.isFinite(bar?.low) && bar.low <= stopPrice;
  const hitTarget = Number.isFinite(targetPrice) && Number.isFinite(bar?.high) && bar.high >= targetPrice;
  if (hitStop && hitTarget) return 'both_same_bar';
  if (hitTarget) return 'target_only';
  if (hitStop) return 'stop_only';
  return 'neither';
}

function resolveTouch(touch, policy) {
  const selected = normalizeSameBarPolicy(policy);
  if (touch === 'target_only') return { outcome: 'target_first', ambiguous: false, excluded: false, targetHit: true, stopHit: false };
  if (touch === 'stop_only') return { outcome: 'stop_first', ambiguous: false, excluded: false, targetHit: false, stopHit: true };
  if (touch !== 'both_same_bar') return null;
  if (selected === 'ambiguous_exclude') {
    return { outcome: 'ambiguous_excluded', ambiguous: true, excluded: true, targetHit: true, stopHit: true };
  }
  if (selected === 'target_first_optimistic' || selected === 'ambiguous_report_only') {
    return { outcome: 'ambiguous_target_first', ambiguous: true, excluded: false, targetHit: true, stopHit: true };
  }
  return {
    outcome: 'ambiguous_stop_first',
    ambiguous: true,
    excluded: false,
    targetHit: true,
    stopHit: true,
    winConvertedToLoss: true,
  };
}

function barsFromEntry(bars, entryTimestamp, entryIndex = null) {
  if (!Array.isArray(bars) || !bars.length) return [];
  if (Number.isInteger(entryIndex) && entryIndex >= 0) return bars.slice(entryIndex);
  const entryMs = tsMs(entryTimestamp);
  if (!Number.isFinite(entryMs)) return [];
  return bars.filter(bar => {
    const current = tsMs(bar.timestamp);
    return Number.isFinite(current) && current >= entryMs;
  });
}

function firstTouchOutcome({
  bars,
  entryTimestamp,
  entryIndex = null,
  entryPrice,
  stopPrice,
  targetPrice,
  policy = 'stop_first_hard',
}) {
  const rows = barsFromEntry(bars, entryTimestamp, entryIndex);
  for (const bar of rows) {
    const touch = classifyBarTouch(bar, { stopPrice, targetPrice });
    const resolved = resolveTouch(touch, policy);
    if (!resolved) continue;
    const exitPrice = resolved.excluded
      ? entryPrice
      : resolved.outcome.includes('target') ? targetPrice : stopPrice;
    return {
      ...resolved,
      touch,
      exit_timestamp_et: bar.timestamp,
      exit_price: exitPrice,
    };
  }
  const last = rows[rows.length - 1] || null;
  return {
    outcome: 'session_close',
    touch: 'neither',
    ambiguous: false,
    excluded: false,
    targetHit: false,
    stopHit: false,
    exit_timestamp_et: last?.timestamp || entryTimestamp,
    exit_price: Number.isFinite(last?.close) ? last.close : entryPrice,
  };
}

module.exports = {
  SAME_BAR_POLICIES,
  normalizeSameBarPolicy,
  classifyBarTouch,
  resolveTouch,
  barsFromEntry,
  firstTouchOutcome,
};
