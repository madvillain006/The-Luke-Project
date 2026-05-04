'use strict';

const { tsMs } = require('../common');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function futureRows(bars, timestamp, minutes = 390) {
  const start = tsMs(timestamp);
  const end = start + minutes * 60 * 1000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t <= end;
  });
}

function mfeMae(rows, entryPrice) {
  if (!rows.length || !Number.isFinite(entryPrice)) return { mfe: null, mae: null };
  return {
    mfe: rounded(Math.max(0, ...rows.map(bar => bar.high - entryPrice))),
    mae: rounded(Math.max(0, ...rows.map(bar => entryPrice - bar.low))),
  };
}

function rAt(rows, entryPrice, stopPrice) {
  if (!rows.length || !Number.isFinite(entryPrice) || !Number.isFinite(stopPrice)) return null;
  const risk = entryPrice - stopPrice;
  if (risk <= 0) return null;
  return rounded((rows[rows.length - 1].close - entryPrice) / risk);
}

function firstHitRows(rows, { stopPrice, tp1, tp2 }) {
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
      if (hitTp2 && !hitTp1) return { first: 'TP2_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
      return { first: 'TP1_FIRST', stopAt, tp1At, tp2At, sameBarAmbiguity };
    }
  }
  return { first: 'NEITHER', stopAt, tp1At, tp2At, sameBarAmbiguity };
}

function timeTo(timestamp, hitTimestamp) {
  if (!timestamp || !hitTimestamp) return null;
  const a = tsMs(timestamp);
  const b = tsMs(hitTimestamp);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function heatBefore(rows, entryPrice, targetPrice) {
  let heat = 0;
  for (const bar of rows) {
    heat = Math.max(heat, Math.max(0, entryPrice - bar.low));
    if (Number.isFinite(targetPrice) && bar.high >= targetPrice) break;
  }
  return rounded(heat);
}

function returnedToEntryAfterTp1(rows, entryPrice, tp1) {
  if (!Number.isFinite(tp1)) return false;
  let hit = false;
  for (const bar of rows) {
    if (!hit && bar.high >= tp1) hit = true;
    else if (hit && bar.low <= entryPrice) return true;
  }
  return false;
}

function computePlanOutcome({ bars, entryTimestamp, entryPrice, stopPrice, tp1, tp2, addPrice = null }) {
  const rows = futureRows(bars, entryTimestamp, 390);
  const out = {};
  for (const minutes of [3, 5, 10, 15, 30, 60]) {
    const end = tsMs(entryTimestamp) + minutes * 60 * 1000;
    const window = rows.filter(bar => tsMs(bar.timestamp) <= end);
    const mm = mfeMae(window, entryPrice);
    out[`mfe_${minutes}m`] = mm.mfe;
    out[`mae_${minutes}m`] = mm.mae;
  }
  for (const minutes of [5, 15, 30, 60]) {
    const end = tsMs(entryTimestamp) + minutes * 60 * 1000;
    out[`r_${minutes}m`] = rAt(rows.filter(bar => tsMs(bar.timestamp) <= end), entryPrice, stopPrice);
  }
  const hits = firstHitRows(rows, { stopPrice, tp1, tp2 });
  out.tp1_hit = Boolean(hits.tp1At);
  out.tp2_hit = Boolean(hits.tp2At);
  out.stop_hit = Boolean(hits.stopAt);
  out.stop_first = hits.first === 'STOP_FIRST';
  out.tp1_first = hits.first === 'TP1_FIRST';
  out.tp2_first = hits.first === 'TP2_FIRST';
  out.same_bar_ambiguity = hits.sameBarAmbiguity;
  out.first_hit = hits.first;
  out.time_to_tp1 = timeTo(entryTimestamp, hits.tp1At);
  out.time_to_tp2 = timeTo(entryTimestamp, hits.tp2At);
  out.time_to_stop = timeTo(entryTimestamp, hits.stopAt);
  out.max_heat_before_tp1 = heatBefore(rows, entryPrice, tp1);
  out.max_heat_before_tp2 = heatBefore(rows, entryPrice, tp2);
  out.did_price_hit_next_applicable_level = out.tp2_hit;
  out.did_price_reject_from_next_applicable_level = false;
  if (out.tp2_hit && Number.isFinite(tp2)) {
    const hitBar = rows.find(bar => bar.high >= tp2);
    const after = hitBar ? futureRows(bars, hitBar.timestamp, 15) : [];
    out.did_price_reject_from_next_applicable_level = after.some(bar => bar.close <= tp2 - 2);
  }
  out.did_return_to_entry_after_tp1 = returnedToEntryAfterTp1(rows, entryPrice, tp1);
  out.did_staged_add_improve = Number.isFinite(addPrice) && Number.isFinite(tp2)
    ? addPrice <= entryPrice + 2 && out.tp2_hit && !out.stop_first
    : false;
  return out;
}

module.exports = {
  futureRows,
  mfeMae,
  firstHitRows,
  heatBefore,
  computePlanOutcome,
};
