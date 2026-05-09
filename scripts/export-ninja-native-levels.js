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

function discoverLatestDailyPlan({ rootDir = ROOT } = {}) {
  const dir = path.join(rootDir, "data", "research", "mancini", "daily-plans");
  if (!fs.existsSync(dir)) return null;
  const candidates = fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.json$/i.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return candidates[candidates.length - 1] || null;
}

function pricesFrom(values) {
  return uniqueSortedPrices((values || []).map((price) => ({ price })));
}

function loadDailyPlanLevels({ rootDir = ROOT } = {}) {
  const filePath = discoverLatestDailyPlan({ rootDir });
  if (!filePath) return null;
  const plan = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const inputs = plan.corrected_luke_inputs || {};
  const levels = {
    trade: pricesFrom(inputs.trade_levels),
    major: pricesFrom(inputs.major_levels),
    focus_long: pricesFrom(inputs.focus_long_levels),
    trigger: pricesFrom((inputs.focus_long_levels || []).filter((price) => (
      (plan.trigger_guidance || []).some((row) => Number(row.level) === Number(price) && !/short/i.test(String(row.type || "")))
    ))),
    target_only: pricesFrom(inputs.target_only_levels),
    read_reaction: pricesFrom(inputs.read_reaction_levels || (plan.trigger_guidance || [])
      .filter((row) => /read|sweep|defend|support|backtest/i.test(String(row.type || "")))
      .map((row) => row.level)),
  };
  const prices = pricesFrom([
    ...levels.trade,
    ...levels.major,
    ...levels.focus_long,
    ...levels.trigger,
    ...levels.target_only,
    ...levels.read_reaction,
  ]);
  return {
    file_path: filePath,
    date: plan.date || path.basename(filePath).slice(0, 10),
    target_session: plan.target_session || null,
    instrument: plan.instrument || "ES",
    levels,
    prices,
  };
}

function formatPrice(price) {
  return Number(price).toFixed(2);
}

function formatSection(name, prices) {
  return `${name}: ${prices.map(formatPrice).join(",")}`;
}

function renderNativeLevelFile({
  dailyPlan = null,
  prices = [],
  generatedAt = new Date().toISOString(),
  includeContext = false,
} = {}) {
  if (!includeContext) {
    const executablePrices = dailyPlan?.levels?.trade?.length ? dailyPlan.levels.trade : prices;
    return `${executablePrices.map(formatPrice).join(",")}\n`;
  }

  const lines = [
    "# Luke Ninja native external levels",
    `# generated_at: ${generatedAt}`,
    "# Strategy parser trades only the trade/mancini section. Context sections are overlay-only.",
  ];
  if (dailyPlan) {
    lines.push(`# source: ${path.relative(ROOT, dailyPlan.file_path).replace(/\\/g, "/")}`);
    lines.push(`# source_date: ${dailyPlan.date}`);
    lines.push(`# target_session: ${dailyPlan.target_session || dailyPlan.date} ${dailyPlan.instrument}`);
    lines.push(formatSection("trade", dailyPlan.levels.trade));
    lines.push(formatSection("major", dailyPlan.levels.major));
    lines.push(formatSection("focus_long", dailyPlan.levels.focus_long));
    lines.push(formatSection("trigger", dailyPlan.levels.trigger));
    lines.push(formatSection("target_only", dailyPlan.levels.target_only));
    lines.push(formatSection("read_reaction", dailyPlan.levels.read_reaction));
  } else {
    lines.push(formatSection("trade", prices));
  }
  return `${lines.join("\n")}\n`;
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

function exportNativeLevels({ rootDir = ROOT, outFile = DEFAULT_OUT, historicalDate = null, includeContext = false } = {}) {
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
  const dailyPlan = loadDailyPlanLevels({ rootDir });
  const levels = exportData.levels.filter(activeNativeLevel);
  const prices = dailyPlan?.levels?.trade?.length ? dailyPlan.levels.trade : uniqueSortedPrices(levels);
  const byFamily = {};
  for (const level of levels) {
    byFamily[level.source_family] = (byFamily[level.source_family] || 0) + 1;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, renderNativeLevelFile({ dailyPlan, prices, includeContext }), "utf8");
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    out_file: outFile,
    source: dailyPlan ? "mancini_daily_plan" : "tradingview_level_export",
    level_file_mode: includeContext ? "sectioned_context" : "trade_levels_only",
    daily_plan: dailyPlan ? {
      file: dailyPlan.file_path,
      date: dailyPlan.date,
      target_session: dailyPlan.target_session,
      instrument: dailyPlan.instrument,
      trade: dailyPlan.levels.trade.length,
      major: dailyPlan.levels.major.length,
      focus_long: dailyPlan.levels.focus_long.length,
      trigger: dailyPlan.levels.trigger.length,
      target_only: dailyPlan.levels.target_only.length,
      read_reaction: dailyPlan.levels.read_reaction.length,
    } : null,
    prices: prices.length,
    by_family: byFamily,
    source_summary: exportData.source_summary,
    issues: exportData.issues,
  };
}

function main() {
  const outFile = argValue("--out", DEFAULT_OUT);
  const historicalDate = argValue("--historical-date", null);
  const includeContext = process.argv.includes("--context");
  const result = exportNativeLevels({ outFile, historicalDate, includeContext });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  activeNativeLevel,
  discoverLatestDailyPlan,
  exportNativeLevels,
  loadDailyPlanLevels,
  renderNativeLevelFile,
  historicalSatyLevels,
  uniqueSortedPrices,
};
