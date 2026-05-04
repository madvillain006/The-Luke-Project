'use strict';

const { tsMs, median, average } = require('../common');

function barsAfter(bars, timestamp, minutes = 60) {
  const start = tsMs(timestamp);
  if (!Number.isFinite(start)) return [];
  const end = start + minutes * 60 * 1000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t <= end;
  });
}

function mfeMae(bars, entryPrice) {
  if (!bars.length || !Number.isFinite(entryPrice)) return { mfe: null, mae: null };
  return {
    mfe: Math.max(...bars.map(bar => bar.high - entryPrice)),
    mae: Math.max(...bars.map(bar => entryPrice - bar.low)),
  };
}

function firstHit({ bars, entryTimestamp, entryPrice, stopPrice, targetPrice }) {
  const future = barsAfter(bars, entryTimestamp, 390);
  const start = tsMs(entryTimestamp);
  let stopAt = null;
  let targetAt = null;
  for (const bar of future) {
    const hitStop = Number.isFinite(stopPrice) && bar.low <= stopPrice;
    const hitTarget = Number.isFinite(targetPrice) && bar.high >= targetPrice;
    if (hitStop && !stopAt) stopAt = bar.timestamp;
    if (hitTarget && !targetAt) targetAt = bar.timestamp;
    if (hitStop && hitTarget) return { first: 'AMBIGUOUS_SAME_BAR', stop_at: bar.timestamp, target_at: bar.timestamp };
    if (hitStop) return { first: 'STOP_FIRST', stop_at: bar.timestamp, target_at: targetAt };
    if (hitTarget) return { first: 'TARGET_FIRST', stop_at: stopAt, target_at: bar.timestamp };
  }
  return {
    first: 'NEITHER',
    stop_at: stopAt,
    target_at: targetAt,
    time_to_stop_minutes: stopAt ? Math.round((tsMs(stopAt) - start) / 60000) : null,
  };
}

function timeToGain(bars, entryTimestamp, entryPrice, points) {
  const start = tsMs(entryTimestamp);
  for (const bar of barsAfter(bars, entryTimestamp, 390)) {
    if (bar.high - entryPrice >= points) return Math.round((tsMs(bar.timestamp) - start) / 60000);
  }
  return null;
}

function rMultiple(entryPrice, stopPrice, markPrice) {
  const risk = entryPrice - stopPrice;
  if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(markPrice)) return null;
  return (markPrice - entryPrice) / risk;
}

function computeTradeMetrics({ bars, entryTimestamp, entryPrice, stopPrice, targetPrice }) {
  const out = {};
  for (const minutes of [5, 15, 30, 60]) {
    const window = barsAfter(bars, entryTimestamp, minutes);
    const mm = mfeMae(window, entryPrice);
    out[`mfe_${minutes}m`] = mm.mfe;
    out[`mae_${minutes}m`] = mm.mae;
    const mark = window.length ? window[window.length - 1].close : null;
    out[`r_multiple_${minutes}m`] = rMultiple(entryPrice, stopPrice, mark);
  }
  const hit = firstHit({ bars, entryTimestamp, entryPrice, stopPrice, targetPrice });
  out.stop_hit_first = hit.first === 'STOP_FIRST';
  out.target_hit_first = hit.first === 'TARGET_FIRST';
  out.first_hit = hit.first;
  out.stop_at = hit.stop_at || null;
  out.target_at = hit.target_at || null;
  out.time_to_stop_minutes = hit.stop_at ? Math.round((tsMs(hit.stop_at) - tsMs(entryTimestamp)) / 60000) : null;
  out.time_to_plus_5 = timeToGain(bars, entryTimestamp, entryPrice, 5);
  out.time_to_plus_10 = timeToGain(bars, entryTimestamp, entryPrice, 10);
  out.time_to_plus_15 = timeToGain(bars, entryTimestamp, entryPrice, 15);
  return out;
}

function sampleConfidence(count) {
  if (count >= 100) return 'high';
  if (count >= 30) return 'medium';
  return 'low';
}

function summarizeGroup(rows, key) {
  const groups = new Map();
  for (const row of rows || []) {
    const value = row[key] == null ? 'unknown' : String(row[key]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([value, group]) => ({
    [key]: value,
    count: group.length,
    target_first_rate: group.filter(row => row.target_hit_first).length / group.length,
    stop_first_rate: group.filter(row => row.stop_hit_first).length / group.length,
    average_mfe_15m: average(group.map(row => row.mfe_15m)),
    median_mfe_15m: median(group.map(row => row.mfe_15m)),
    average_mae_15m: average(group.map(row => row.mae_15m)),
    median_mae_15m: median(group.map(row => row.mae_15m)),
    average_r_60m: average(group.map(row => row.r_multiple_60m)),
    confidence: sampleConfidence(group.length),
  })).sort((a, b) => b.count - a.count);
}

module.exports = {
  barsAfter,
  mfeMae,
  firstHit,
  timeToGain,
  rMultiple,
  computeTradeMetrics,
  summarizeGroup,
  sampleConfidence,
};
