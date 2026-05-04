'use strict';

const { tsMs } = require('../common');

function indexAtOrAfter(bars, timestamp) {
  const target = tsMs(timestamp);
  return (bars || []).findIndex(bar => tsMs(bar.timestamp) >= target);
}

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function elapsedMinutes(from, to) {
  const a = tsMs(from);
  const b = tsMs(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function reclaimCloseEntry(setup, bars) {
  if (!setup.valid_reclaim) return null;
  const idx = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (idx < 0) return null;
  return {
    entry_model: 'reclaim_close',
    entry_timestamp_et: bars[idx].timestamp,
    entry_price: rounded(bars[idx].close),
    entry_index: idx,
    fill_assumption: 'close of reclaim candle',
  };
}

function levelReclaimLimitEntry(setup, bars, offset = 0.25, maxWait = 10) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0) return null;
  const price = rounded(setup.executable_level + offset);
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 1; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].low <= price && bars[i].high >= price) {
      return {
        entry_model: 'level_reclaim_limit',
        entry_timestamp_et: bars[i].timestamp,
        entry_price: price,
        entry_index: i,
        fill_assumption: `post-reclaim limit touched at L+${offset}`,
      };
    }
  }
  return null;
}

function retestHoldEntry(setup, bars, maxWait = 10) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0) return null;
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 1; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].low <= setup.executable_level + 0.25 && bars[i].close >= setup.executable_level) {
      return {
        entry_model: 'retest_hold',
        entry_timestamp_et: bars[i].timestamp,
        entry_price: rounded(Math.max(setup.executable_level, bars[i].close)),
        entry_index: i,
        fill_assumption: 'post-reclaim retest held above level',
      };
    }
  }
  return null;
}

function holdAboveEntry(setup, bars, candles = 2) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0) return null;
  let count = 0;
  for (let i = reclaimIndex; i < Math.min(bars.length, reclaimIndex + candles + 6); i += 1) {
    if (bars[i].close >= setup.executable_level) count += 1;
    else count = 0;
    if (count >= candles) {
      return {
        entry_model: `${candles}_candle_hold`,
        entry_timestamp_et: bars[i].timestamp,
        entry_price: rounded(bars[i].close),
        entry_index: i,
        fill_assumption: `${candles} consecutive closes above reclaimed level`,
      };
    }
  }
  return null;
}

function higherLowEntry(setup, bars, maxWait = 12) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0) return null;
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 2; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    const prior = bars[i - 1];
    if (
      prior.low > setup.sweep_low &&
      bars[i].low >= prior.low &&
      bars[i].close >= setup.executable_level
    ) {
      return {
        entry_model: 'higher_low_after_reclaim',
        entry_timestamp_et: bars[i].timestamp,
        entry_price: rounded(bars[i].close),
        entry_index: i,
        fill_assumption: 'higher low formed after reclaim',
      };
    }
  }
  return null;
}

function microPivotBreakEntry(setup, bars, maxWait = 12) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0 || reclaimIndex + 2 >= bars.length) return null;
  const pivotWindow = bars.slice(reclaimIndex, reclaimIndex + 3);
  const pivot = Math.max(...pivotWindow.map(bar => bar.high));
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 3; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].high >= pivot + 0.25 && bars[i].close >= setup.executable_level) {
      return {
        entry_model: 'micro_pivot_break',
        entry_timestamp_et: bars[i].timestamp,
        entry_price: rounded(pivot + 0.25),
        entry_index: i,
        fill_assumption: 'break of first post-reclaim micro pivot',
      };
    }
  }
  return null;
}

function accumulationMetrics(setup, bars, lookahead = 10) {
  if (!setup.valid_reclaim) {
    return {
      minutes_held_above: 0,
      closes_above_level: 0,
      failed_pushes_below: 0,
      higher_low_formed: false,
      reclaim_candle_size: null,
      reclaim_close_location: null,
      accumulation_above_level: false,
    };
  }
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0) return null;
  const rows = bars.slice(reclaimIndex, reclaimIndex + lookahead);
  const reclaimBar = bars[reclaimIndex];
  let minutesHeldAbove = 0;
  for (const bar of rows) {
    if (bar.close >= setup.executable_level) minutesHeldAbove += 1;
    else break;
  }
  const closesAbove = rows.filter(bar => bar.close >= setup.executable_level).length;
  const failedPushesBelow = rows.filter(bar => bar.low < setup.executable_level && bar.close >= setup.executable_level).length;
  const higherLowFormed = rows.some((bar, idx) => idx > 0 && bar.low > setup.sweep_low && bar.low >= rows[idx - 1].low);
  const range = reclaimBar.high - reclaimBar.low;
  return {
    minutes_held_above: minutesHeldAbove,
    closes_above_level: closesAbove,
    failed_pushes_below: failedPushesBelow,
    higher_low_formed: higherLowFormed,
    distance_from_sweep_low: rounded(setup.executable_level - setup.sweep_low),
    time_spent_below_level: setup.minutes_below_level,
    time_to_reclaim: setup.minutes_below_level,
    reclaim_candle_size: rounded(range),
    reclaim_close_location: range > 0 ? rounded((reclaimBar.close - reclaimBar.low) / range) : null,
    accumulation_above_level: closesAbove >= 3 && failedPushesBelow <= 1,
  };
}

function buildEntryModels(setup, bars) {
  const entries = [
    reclaimCloseEntry(setup, bars),
    levelReclaimLimitEntry(setup, bars),
    retestHoldEntry(setup, bars),
    holdAboveEntry(setup, bars, 2),
    holdAboveEntry(setup, bars, 3),
    higherLowEntry(setup, bars),
    microPivotBreakEntry(setup, bars),
  ].filter(Boolean);
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.entry_model}|${entry.entry_timestamp_et}|${entry.entry_price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  indexAtOrAfter,
  reclaimCloseEntry,
  levelReclaimLimitEntry,
  retestHoldEntry,
  holdAboveEntry,
  higherLowEntry,
  microPivotBreakEntry,
  accumulationMetrics,
  buildEntryModels,
  elapsedMinutes,
};
