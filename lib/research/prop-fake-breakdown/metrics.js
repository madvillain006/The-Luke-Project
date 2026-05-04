'use strict';

const { tsMs } = require('../common');

function futureBars(bars, timestamp, minutes) {
  const start = tsMs(timestamp);
  if (!Number.isFinite(start)) return [];
  const end = start + minutes * 60 * 1000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t <= end;
  });
}

function mfeMae(bars, entry) {
  if (!bars.length || !Number.isFinite(entry)) return { mfe: null, mae: null };
  return {
    mfe: Math.max(0, ...bars.map(bar => bar.high - entry)),
    mae: Math.max(0, ...bars.map(bar => entry - bar.low)),
  };
}

function firstHits({ bars, entryTimestamp, entryPrice, stopPrice, tp1, tp2 }) {
  let stopAt = null;
  let tp1At = null;
  let tp2At = null;
  let sameBarAmbiguity = false;
  for (const bar of futureBars(bars, entryTimestamp, 390)) {
    const hitStop = Number.isFinite(stopPrice) && bar.low <= stopPrice;
    const hitTp1 = Number.isFinite(tp1) && bar.high >= tp1;
    const hitTp2 = Number.isFinite(tp2) && bar.high >= tp2;
    if (hitStop && (hitTp1 || hitTp2)) sameBarAmbiguity = true;
    if (hitStop && !stopAt) stopAt = bar.timestamp;
    if (hitTp1 && !tp1At) tp1At = bar.timestamp;
    if (hitTp2 && !tp2At) tp2At = bar.timestamp;
    if (hitStop || hitTp1 || hitTp2) {
      if (sameBarAmbiguity) return { first: 'AMBIGUOUS_SAME_BAR', stopAt, tp1At, tp2At, sameBarAmbiguity };
      if (hitStop) return { first: 'STOP_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
      if (hitTp1 || hitTp2) return { first: 'TARGET_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
    }
  }
  return { first: 'NEITHER', stopAt, tp1At, tp2At, sameBarAmbiguity };
}

function timeToPriceMove(bars, entryTimestamp, entryPrice, points) {
  const start = tsMs(entryTimestamp);
  for (const bar of futureBars(bars, entryTimestamp, 390)) {
    if (bar.high - entryPrice >= points) return Math.round((tsMs(bar.timestamp) - start) / 60000);
  }
  return null;
}

function timeToStop(bars, entryTimestamp, stopPrice) {
  const start = tsMs(entryTimestamp);
  for (const bar of futureBars(bars, entryTimestamp, 390)) {
    if (bar.low <= stopPrice) return Math.round((tsMs(bar.timestamp) - start) / 60000);
  }
  return null;
}

function rAt(window, entryPrice, stopPrice) {
  if (!window.length) return null;
  const risk = entryPrice - stopPrice;
  if (!Number.isFinite(risk) || risk <= 0) return null;
  return (window[window.length - 1].close - entryPrice) / risk;
}

function maxHeatBeforeTp1(bars, entryTimestamp, entryPrice, tp1) {
  const rows = futureBars(bars, entryTimestamp, 390);
  let heat = 0;
  for (const bar of rows) {
    heat = Math.max(heat, Math.max(0, entryPrice - bar.low));
    if (Number.isFinite(tp1) && bar.high >= tp1) return heat;
  }
  return heat;
}

function firstHitsFromRows({ rows, stopPrice, tp1, tp2 }) {
  let stopAt = null;
  let tp1At = null;
  let tp2At = null;
  let sameBarAmbiguity = false;
  for (const bar of rows) {
    const hitStop = Number.isFinite(stopPrice) && bar.low <= stopPrice;
    const hitTp1 = Number.isFinite(tp1) && bar.high >= tp1;
    const hitTp2 = Number.isFinite(tp2) && bar.high >= tp2;
    if (hitStop && (hitTp1 || hitTp2)) sameBarAmbiguity = true;
    if (hitStop && !stopAt) stopAt = bar.timestamp;
    if (hitTp1 && !tp1At) tp1At = bar.timestamp;
    if (hitTp2 && !tp2At) tp2At = bar.timestamp;
    if (hitStop || hitTp1 || hitTp2) {
      if (sameBarAmbiguity) return { first: 'AMBIGUOUS_SAME_BAR', stopAt, tp1At, tp2At, sameBarAmbiguity };
      if (hitStop) return { first: 'STOP_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
      return { first: 'TARGET_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
    }
  }
  return { first: 'NEITHER', stopAt, tp1At, tp2At, sameBarAmbiguity };
}

function computeOutcome({ bars, entryTimestamp, entryPrice, stopPrice, tp1, tp2, nextTrustedLevelAbove }) {
  const out = {};
  const start = tsMs(entryTimestamp);
  const rows = futureBars(bars, entryTimestamp, 390);
  for (const minutes of [3, 5, 10, 15, 30, 60]) {
    const end = start + minutes * 60 * 1000;
    const window = rows.filter(bar => tsMs(bar.timestamp) <= end);
    const mm = mfeMae(window, entryPrice);
    out[`mfe_${minutes}m`] = mm.mfe;
    out[`mae_${minutes}m`] = mm.mae;
  }
  for (const minutes of [5, 15, 30, 60]) {
    const end = start + minutes * 60 * 1000;
    out[`r_${minutes}m`] = rAt(rows.filter(bar => tsMs(bar.timestamp) <= end), entryPrice, stopPrice);
  }
  const hits = firstHitsFromRows({ rows, stopPrice, tp1, tp2 });
  out.tp1_hit = Boolean(hits.tp1At);
  out.tp2_hit = Boolean(hits.tp2At);
  out.stop_hit = Boolean(hits.stopAt);
  out.stop_first = hits.first === 'STOP_FIRST';
  out.target_first = hits.first === 'TARGET_FIRST';
  out.same_bar_ambiguity = hits.sameBarAmbiguity;
  out.first_hit = hits.first;
  for (const points of [2, 3, 4, 5, 8]) {
    const hit = rows.find(bar => bar.high - entryPrice >= points);
    out[`time_to_plus_${points}`] = hit ? Math.round((tsMs(hit.timestamp) - start) / 60000) : null;
  }
  const stopHit = Number.isFinite(stopPrice) ? rows.find(bar => bar.low <= stopPrice) : null;
  out.time_to_stop = stopHit ? Math.round((tsMs(stopHit.timestamp) - start) / 60000) : null;
  let heat = 0;
  for (const bar of rows) {
    heat = Math.max(heat, Math.max(0, entryPrice - bar.low));
    if (Number.isFinite(tp1) && bar.high >= tp1) break;
  }
  out.max_heat_before_tp1 = heat;
  out.did_hit_next_trusted_level_above = Number.isFinite(nextTrustedLevelAbove)
    ? Boolean(firstHitsFromRows({ rows, stopPrice: null, tp1: nextTrustedLevelAbove }).tp1At)
    : false;
  out.did_reject_from_next_trusted_level = false;
  if (out.did_hit_next_trusted_level_above) {
    const hitWindow = rows.filter(bar => bar.high >= nextTrustedLevelAbove);
    const first = hitWindow[0];
    if (first) {
      const after = futureBars(bars, first.timestamp, 15);
      out.did_reject_from_next_trusted_level = after.some(bar => bar.close < nextTrustedLevelAbove - 2);
    }
  }
  out.result_class = classifyResult(out);
  return out;
}

function classifyResult(out) {
  if (out.same_bar_ambiguity) return 'invalid';
  if (out.stop_first) return 'stop_loss';
  if (out.tp2_hit) return 'prop_level_to_level_win';
  if (out.tp1_hit) return 'prop_scalp_win';
  if (Number.isFinite(out.r_60m) && Math.abs(out.r_60m) < 0.25) return 'scratch';
  return Number.isFinite(out.mfe_15m) && out.mfe_15m >= 4 ? 'watch_only_missed' : 'invalid';
}

module.exports = {
  futureBars,
  mfeMae,
  firstHits,
  computeOutcome,
  maxHeatBeforeTp1,
};
