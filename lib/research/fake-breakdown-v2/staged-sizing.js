'use strict';

const { tsMs } = require('../common');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function futureBars(bars, timestamp, minutes = 390) {
  const start = tsMs(timestamp);
  const end = start + minutes * 60 * 1000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t <= end;
  });
}

function findAddAfterMove({ bars, entryTimestamp, entryPrice, points = 2 }) {
  for (const bar of futureBars(bars, entryTimestamp, 60)) {
    if (bar.high >= entryPrice + points) {
      return {
        add_model: `add_after_plus_${points}`,
        add_timestamp_et: bar.timestamp,
        add_price: rounded(entryPrice + points),
        add_trigger_points: points,
      };
    }
  }
  return null;
}

function findAddAfterHold({ bars, entryTimestamp, level, candles = 2 }) {
  let count = 0;
  for (const bar of futureBars(bars, entryTimestamp, 30)) {
    if (bar.close >= level) count += 1;
    else count = 0;
    if (count >= candles) {
      return {
        add_model: `add_after_${candles}_candle_hold`,
        add_timestamp_et: bar.timestamp,
        add_price: rounded(bar.close),
        add_trigger_points: rounded(bar.close - level),
      };
    }
  }
  return null;
}

function riskDollars({ entryPrice, stopPrice, contracts = 1, dollarsPerPoint = 50 }) {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopPrice) || entryPrice <= stopPrice) return null;
  return rounded((entryPrice - stopPrice) * contracts * dollarsPerPoint);
}

function stagedAverageEntry(starterEntry, addEntry) {
  if (!addEntry || !Number.isFinite(addEntry.add_price)) return starterEntry;
  return rounded((starterEntry + addEntry.add_price) / 2);
}

function compareFullVsStagedRisk({ fullEntryPrice, starterEntryPrice, addEntry, stopPrice }) {
  const fullRisk = riskDollars({ entryPrice: fullEntryPrice, stopPrice, contracts: 2 });
  const starterRisk = riskDollars({ entryPrice: starterEntryPrice, stopPrice, contracts: 1 });
  const stagedRisk = addEntry
    ? rounded(starterRisk + riskDollars({ entryPrice: addEntry.add_price, stopPrice, contracts: 1 }))
    : starterRisk;
  return {
    full_2es_risk_dollars: fullRisk,
    starter_1es_risk_dollars: starterRisk,
    staged_1_to_2_risk_dollars: stagedRisk,
    risk_reduction_vs_full: Number.isFinite(fullRisk) && Number.isFinite(starterRisk) ? rounded(fullRisk - starterRisk) : null,
  };
}

function stagedPlan({ bars, entry, level, stopPrice, addRule = 'plus_2' }) {
  const addEntry = addRule === 'hold_2'
    ? findAddAfterHold({ bars, entryTimestamp: entry.entry_timestamp_et, level, candles: 2 })
    : findAddAfterMove({ bars, entryTimestamp: entry.entry_timestamp_et, entryPrice: entry.entry_price, points: 2 });
  return {
    position_model: addEntry ? '1ES_STARTER_PLUS_1ES_ADD' : '1ES_STARTER_ONLY',
    starter_contracts: 1,
    add_contracts: addEntry ? 1 : 0,
    add_rule: addRule,
    add_entry: addEntry,
    average_entry_after_add: stagedAverageEntry(entry.entry_price, addEntry),
    ...compareFullVsStagedRisk({
      fullEntryPrice: entry.entry_price,
      starterEntryPrice: entry.entry_price,
      addEntry,
      stopPrice,
    }),
  };
}

module.exports = {
  findAddAfterMove,
  findAddAfterHold,
  riskDollars,
  stagedAverageEntry,
  compareFullVsStagedRisk,
  stagedPlan,
};
