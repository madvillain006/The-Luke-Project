'use strict';

const { tsMs } = require('./common');

function futureBarsWithin(bars, timestamp, minutes) {
  const start = tsMs(timestamp);
  if (!Number.isFinite(start)) return [];
  const end = start + minutes * 60 * 1000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t <= end;
  });
}

function directionForDecision(decision) {
  if (decision?.action === 'SHORT') return 'SHORT';
  return 'LONG';
}

function mfeMaeForWindow(bars, startPrice, direction) {
  if (!bars.length || !Number.isFinite(startPrice)) return { mfe: null, mae: null };
  if (direction === 'SHORT') {
    return {
      mfe: Math.max(...bars.map(bar => startPrice - bar.low)),
      mae: Math.max(...bars.map(bar => bar.high - startPrice)),
    };
  }
  return {
    mfe: Math.max(...bars.map(bar => bar.high - startPrice)),
    mae: Math.max(...bars.map(bar => startPrice - bar.low)),
  };
}

function firstTargetStop(decision, bars, timestamp) {
  if (!decision || !(decision.action === 'LONG' || decision.action === 'SHORT')) return null;
  if (!Number.isFinite(decision.target) || !Number.isFinite(decision.stop)) return null;
  const future = futureBarsWithin(bars, timestamp, 390);
  for (const bar of future) {
    const hitTarget = decision.action === 'LONG' ? bar.high >= decision.target : bar.low <= decision.target;
    const hitStop = decision.action === 'LONG' ? bar.low <= decision.stop : bar.high >= decision.stop;
    if (hitTarget && hitStop) return 'AMBIGUOUS_SAME_BAR';
    if (hitTarget) return 'TARGET_FIRST';
    if (hitStop) return 'STOP_FIRST';
  }
  return 'NEITHER';
}

function timeToMove(bars, timestamp, startPrice, points, favorable = true, direction = 'LONG') {
  const future = futureBarsWithin(bars, timestamp, 390);
  const start = tsMs(timestamp);
  for (const bar of future) {
    const hit = direction === 'SHORT'
      ? (favorable ? startPrice - bar.low >= points : bar.high - startPrice >= points)
      : (favorable ? bar.high - startPrice >= points : startPrice - bar.low >= points);
    if (hit) return Math.round((tsMs(bar.timestamp) - start) / 60000);
  }
  return null;
}

function classifyLevelReaction(bars, timestamp, anchor) {
  if (!Number.isFinite(anchor)) return null;
  const future = futureBarsWithin(bars, timestamp, 60);
  if (!future.length) return null;
  const brokeBelow = future.some(bar => bar.low < anchor - 2);
  const reclaimed = brokeBelow && future.some(bar => bar.close > anchor + 2);
  if (reclaimed) return 'reclaimed';
  if (brokeBelow) return 'broken';
  return 'respected';
}

function computeOutcomeMetrics({ bars, timestamp, price, decision }) {
  const direction = directionForDecision(decision);
  const out = {};
  for (const minutes of [5, 15, 30, 60]) {
    const window = futureBarsWithin(bars, timestamp, minutes);
    const { mfe, mae } = mfeMaeForWindow(window, price, direction);
    out[`mfe_${minutes}m`] = mfe;
    out[`mae_${minutes}m`] = mae;
  }
  out.target_stop_first = firstTargetStop(decision, bars, timestamp);
  out.time_to_first_plus_5_es = timeToMove(bars, timestamp, price, 5, true, direction);
  out.time_to_first_plus_10_es = timeToMove(bars, timestamp, price, 10, true, direction);
  out.time_to_first_minus_5_es = timeToMove(bars, timestamp, price, 5, false, direction);
  out.time_to_first_minus_10_es = timeToMove(bars, timestamp, price, 10, false, direction);
  out.level_reaction = classifyLevelReaction(bars, timestamp, decision?.confluence?.anchor ?? decision?.anchor);
  return out;
}

module.exports = {
  futureBarsWithin,
  computeOutcomeMetrics,
  _internal: {
    mfeMaeForWindow,
    firstTargetStop,
    timeToMove,
  },
};
