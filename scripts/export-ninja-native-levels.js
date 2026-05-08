"use strict";

const fs = require("fs");
const path = require("path");

const { buildTradingViewLevelExport } = require("../lib/tradingview/level-export");
const { loadIntraday } = require("../lib/historical-data");
const { deriveLevelsByDate } = require("../lib/backtest-data/saty-historical");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "ninjatrader", "luke-native-levels.txt");
const SATY_FIELDS = [
  "atr_minus_1",
  "ext_minus_4",
  "ext_minus_3",
  "ext_minus_2",
  "ext_minus_1",
  "put_trigger",
  "prev_close",
  "call_trigger",
  "ext_plus_1",
  "ext_plus_2",
  "ext_plus_3",
  "ext_plus_4",
  "atr_plus_1",
];

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function activeNativeLevel(level) {
  if (!level || !Number.isFinite(Number(level.price))) return false;
  // Native Ninja matches the flagship Pine by deriving Saty from the chart
  // instrument internally; the file is only the external Mancini input bucket.
  if (level.source_family === "saty") return false;
  if (level.source_family === "mancini") return level.active !== false;
  return false;
}

function uniqueSortedPrices(levels) {
  return [...new Set((levels || [])
    .map((level) => Number(level.price))
    .filter(Number.isFinite)
    .map((price) => Math.round(price * 100) / 100))]
    .sort((a, b) => a - b);
}

function historicalSatyLevels(targetDate, instrument = "ES") {
  const bars = loadIntraday(instrument);
  const byDate = deriveLevelsByDate(bars || [], [targetDate], { referenceField: "close" });
  const saty = byDate[targetDate];
  if (!saty?.valid) {
    throw new Error(saty?.error || `Could not derive historical Saty levels for ${targetDate}`);
  }
  return SATY_FIELDS.map((field) => ({
    price: saty[field],
    source_family: "saty",
    field,
    active: true,
    reference_date: saty.reference_date,
    target_session_date: saty.target_session_date,
  }));
}

function exportNativeLevels({ rootDir = ROOT, outFile = DEFAULT_OUT, historicalDate = null } = {}) {
  if (historicalDate) {
    const levels = historicalSatyLevels(historicalDate, "ES");
    const prices = uniqueSortedPrices(levels);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, `${prices.map((price) => price.toFixed(2)).join(",")}\n`, "utf8");
    return {
      ok: true,
      generated_at: new Date().toISOString(),
      out_file: outFile,
      mode: "historical_barchart_es",
      historical_date: historicalDate,
      prices: prices.length,
      by_family: { saty: levels.length },
      issues: [],
    };
  }

  const exportData = buildTradingViewLevelExport({ rootDir });
  const levels = exportData.levels.filter(activeNativeLevel);
  const prices = uniqueSortedPrices(levels);
  const byFamily = {};
  for (const level of levels) {
    byFamily[level.source_family] = (byFamily[level.source_family] || 0) + 1;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${prices.map((price) => price.toFixed(2)).join(",")}\n`, "utf8");
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    out_file: outFile,
    prices: prices.length,
    by_family: byFamily,
    source_summary: exportData.source_summary,
    issues: exportData.issues,
  };
}

function main() {
  const outFile = argValue("--out", DEFAULT_OUT);
  const historicalDate = argValue("--historical-date", null);
  const result = exportNativeLevels({ outFile, historicalDate });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  activeNativeLevel,
  exportNativeLevels,
  historicalSatyLevels,
  uniqueSortedPrices,
};
