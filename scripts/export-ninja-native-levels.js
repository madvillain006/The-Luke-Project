"use strict";

const fs = require("fs");
const path = require("path");

const { buildTradingViewLevelExport } = require("../lib/tradingview/level-export");
const { loadIntraday } = require("../lib/historical-data");
const { deriveLevelsByDate } = require("../lib/backtest-data/saty-historical");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "ninjatrader", "luke-native-levels.txt");
const DEFAULT_MANCINI_EVENTS_CSV = path.join(ROOT, "artifacts", "research", "mancini-context-protocol", "events.csv");
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

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function discoverDailyPlans({ rootDir = ROOT } = {}) {
  const dir = path.join(rootDir, "data", "research", "mancini", "daily-plans");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.json$/i.test(name))
    .map((name) => {
      const filePath = path.join(dir, name);
      const plan = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const date = String(plan.date || path.basename(filePath).slice(0, 10));
      const targetSession = String(plan.target_session || date);
      return {
        filePath,
        plan,
        date,
        targetSession,
        score: `${targetSession}|${date}|${name}`,
      };
    })
    .sort((a, b) => a.score.localeCompare(b.score));
}

function discoverLatestDailyPlan({ rootDir = ROOT } = {}) {
  const candidates = discoverDailyPlans({ rootDir });
  return candidates[candidates.length - 1]?.filePath || null;
}

function selectDailyPlan({ rootDir = ROOT, targetSession = null } = {}) {
  const candidates = discoverDailyPlans({ rootDir });
  if (!targetSession) return candidates[candidates.length - 1] || null;
  if (!isIsoDate(targetSession)) throw new Error(`Invalid target session date: ${targetSession}`);
  const matches = candidates.filter((candidate) => candidate.targetSession === targetSession);
  if (matches.length === 0) throw new Error(`No Mancini daily plan found for target session ${targetSession}`);
  return matches[matches.length - 1];
}

function pricesFrom(values, fieldName = "levels") {
  if (!Array.isArray(values)) throw new Error(`Daily plan ${fieldName} must be an array`);
  return uniqueSortedPrices(values.map((price) => ({ price })));
}

function splitCsvLine(line = "") {
  const values = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  values.push(cell);
  return values;
}

function truthyCsv(value) {
  return /^(true|1|yes|y)$/i.test(String(value || "").trim());
}

function loadCentralManciniEventLevels({ rootDir = ROOT, targetSession = null, csvPath = DEFAULT_MANCINI_EVENTS_CSV } = {}) {
  const resolvedCsv = path.isAbsolute(csvPath) ? csvPath : path.join(rootDir, csvPath);
  if (!fs.existsSync(resolvedCsv)) return null;

  const lines = fs.readFileSync(resolvedCsv, "utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return null;

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const index = new Map(headers.map((header, i) => [header, i]));
  const get = (columns, key) => {
    const i = index.get(key);
    return Number.isInteger(i) && i < columns.length ? String(columns[i] || "").trim() : "";
  };
  if (!index.has("plan_date") || !index.has("price")) return null;

  const rows = lines.slice(1)
    .map((line) => ({ line, columns: splitCsvLine(line) }))
    .filter(({ columns }) => (
      get(columns, "direction").toLowerCase() === "support"
      && truthyCsv(get(columns, "long_eligible"))
      && Number.isFinite(Number(get(columns, "price")))
    ));
  if (!rows.length) return null;

  const selectedSession = targetSession || [...new Set(rows.map(({ columns }) => get(columns, "plan_date")).filter(isIsoDate))].sort().at(-1);
  if (!selectedSession) return null;
  if (!isIsoDate(selectedSession)) throw new Error(`Invalid target session date: ${selectedSession}`);

  const sessionRows = rows.filter(({ columns }) => get(columns, "plan_date") === selectedSession);
  if (!sessionRows.length) return null;

  const prices = pricesFrom(sessionRows.map(({ columns }) => Number(get(columns, "price"))), "central_event_prices");
  const major = pricesFrom(sessionRows
    .filter(({ columns }) => /major/i.test(`${get(columns, "primary_role")} ${get(columns, "tags")}`))
    .map(({ columns }) => Number(get(columns, "price"))), "central_event_major_levels");
  const focus = pricesFrom(sessionRows
    .filter(({ columns }) => /focus|trigger|reclaim|manual_user_supports/i.test(`${get(columns, "primary_role")} ${get(columns, "tags")} ${get(columns, "event_status")}`))
    .map(({ columns }) => Number(get(columns, "price"))), "central_event_focus_levels");

  return {
    file_path: resolvedCsv,
    date: selectedSession,
    target_session: selectedSession,
    instrument: "ES",
    levels: {
      trade: prices,
      major,
      focus_long: focus.length ? focus : prices,
      trigger: focus.length ? focus : prices,
      target_only: [],
      read_reaction: prices,
    },
    prices,
    rows: sessionRows.length,
  };
}

function loadDailyPlanLevels({ rootDir = ROOT, targetSession = null } = {}) {
  const selected = selectDailyPlan({ rootDir, targetSession });
  if (!selected) return null;
  const { filePath, plan } = selected;
  if (!isIsoDate(plan.date || path.basename(filePath).slice(0, 10))) throw new Error(`Daily plan has invalid date: ${filePath}`);
  const inputs = plan.corrected_luke_inputs || {};
  if (!Array.isArray(inputs.trade_levels)) throw new Error(`Daily plan missing corrected_luke_inputs.trade_levels: ${filePath}`);
  const levels = {
    trade: pricesFrom(inputs.trade_levels, "trade_levels"),
    major: pricesFrom(inputs.major_levels || [], "major_levels"),
    focus_long: pricesFrom(inputs.focus_long_levels || [], "focus_long_levels"),
    trigger: pricesFrom((inputs.focus_long_levels || []).filter((price) => (
      (plan.trigger_guidance || []).some((row) => Number(row.level) === Number(price) && !/short/i.test(String(row.type || "")))
    )), "trigger_levels"),
    target_only: pricesFrom(inputs.target_only_levels || [], "target_only_levels"),
    read_reaction: pricesFrom(inputs.read_reaction_levels || (plan.trigger_guidance || [])
      .filter((row) => /read|sweep|defend|support|backtest/i.test(String(row.type || "")))
      .map((row) => row.level), "read_reaction_levels"),
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
    "# Strategy parser uses last matching tag wins. Generated context sections come first so trade levels remain executable.",
  ];
  if (dailyPlan) {
    lines.push(`# source: ${path.relative(ROOT, dailyPlan.file_path).replace(/\\/g, "/")}`);
    lines.push(`# source_date: ${dailyPlan.date}`);
    lines.push(`# target_session: ${dailyPlan.target_session || dailyPlan.date} ${dailyPlan.instrument}`);
    lines.push(formatSection("target_only", dailyPlan.levels.target_only));
    lines.push(formatSection("read_reaction", dailyPlan.levels.read_reaction));
    lines.push(formatSection("trade", dailyPlan.levels.trade));
    lines.push(formatSection("focus_long", dailyPlan.levels.focus_long));
    lines.push(formatSection("trigger", dailyPlan.levels.trigger));
    lines.push(formatSection("major", dailyPlan.levels.major));
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

function exportNativeLevels({ rootDir = ROOT, outFile = DEFAULT_OUT, historicalDate = null, targetSession = null, includeContext = false } = {}) {
  const effectiveTargetSession = targetSession || historicalDate || null;
  const exportData = buildTradingViewLevelExport({ rootDir });
  const dailyPlan = loadCentralManciniEventLevels({ rootDir, targetSession: effectiveTargetSession })
    || loadDailyPlanLevels({ rootDir, targetSession: effectiveTargetSession });
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
    source: dailyPlan ? (dailyPlan.file_path.endsWith(".csv") ? "mancini_event_csv" : "mancini_daily_plan") : "tradingview_level_export",
    level_file_mode: includeContext ? "sectioned_context" : "trade_levels_only",
    target_session: effectiveTargetSession || dailyPlan?.target_session || dailyPlan?.date || null,
    historical_date: historicalDate,
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
  const targetSession = argValue("--target-session", null);
  const includeContext = process.argv.includes("--context");
  const result = exportNativeLevels({ outFile, historicalDate, targetSession, includeContext });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  activeNativeLevel,
  loadCentralManciniEventLevels,
  discoverDailyPlans,
  discoverLatestDailyPlan,
  exportNativeLevels,
  loadDailyPlanLevels,
  selectDailyPlan,
  renderNativeLevelFile,
  historicalSatyLevels,
  uniqueSortedPrices,
};
