"use strict";

const fs = require("fs");
const path = require("path");

const { DEFAULT_CONFIG } = require("../lib/backtest-data/saty-pine-watch");
const {
  parseNativeTelemetry,
  summarizeNativeTelemetry,
} = require("../lib/ninja-native-telemetry");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "ninjatrader", "LukeNativeShadowStrategy.cs");
const TELEMETRY = path.join(ROOT, "state", "events", "ninja-native-shadow.jsonl");
const LEVEL_FILE = path.join(ROOT, "data", "ninjatrader", "luke-native-levels.txt");

const BANNED_ORDER_CALLS = [
  "EnterShort",
  "ExitShort",
  "SubmitOrder",
  "SubmitOrderUnmanaged",
];

const REQUIRED_SNIPPETS = [
  "Calculate = Calculate.OnEachTick",
  "AutonomyMode = LukeNativeAutonomyMode.Shadow",
  "SimExecution",
  "LiveGuarded",
  "AllowLiveAccounts = false",
  "AllowedAccountName = \"LFE050706094670001\"",
  "MaxMarketableEntryPoints = 0.25",
  "AddDataSeries(BarsPeriodType.Minute, 1)",
  "AddDataSeries(BarsPeriodType.Minute, 3)",
  "AddDataSeries(BarsPeriodType.Day, 1)",
  "BuildSatyLevels",
  "ComputeSatyAtr",
  "SatyTriggerPct = 0.236",
  "!string.Equals(source, \"saty\", StringComparison.Ordinal)",
  "SyncPrimaryBarState",
  "PrimaryBarMinutes",
  "PineBarTime().ToString",
  "Draw.TextFixed",
  "PineBridgeEventsPath = @\"C:\\Users\\conor\\luke\\state\\events\\ninjatrader-bridge.jsonl\"",
  "ExtractTargetSessionDate",
  "ChartFuturesSessionDate",
  "LEVEL_SESSION_MISMATCH",
  "IsValidExternalEsLevel",
  "LUKE NATIVE SESSION LEDGER",
  "score incl cxl",
  "realistic net",
  "SessionCommissionDollars",
  "int barsAgo = 0;",
  "EntrySlippagePoints = 0.25",
  "CommissionPerContractRoundTrip = 5.0",
  "WriteTelemetry(\"LONG\"",
  "WriteTelemetry(\"CANCEL\"",
  "WriteTelemetry(\"ORDER_BLOCKED\"",
  "WriteTelemetry(\"ORDER_SUBMITTED\"",
  "WriteTelemetry(\"TP1\"",
  "total_points=",
  "rejected_count=",
  "target_session=",
  "chart_session=",
  "STOP_FIRST",
  "MIXED_STOP_FIRST",
  "ValidateLtf",
  "BuildPivotState",
  "TrackCandidateOutcome",
  "IsNativeLongPriceContextAllowed",
  "EnterLongLimit",
  "SetStopLoss",
  "SetProfitTarget",
  "CancelOrder",
];

const DEFAULT_CHECKS = [
  ["Tp1Points", "tp1Points"],
  ["MaxStopPoints", "maxStopPoints"],
  ["HardStopPoints", "hardStopPoints"],
  ["ClusterTolerancePoints", "clusterTolerancePoints"],
  ["ReclaimHoldBars", "reclaimHoldBars"],
  ["FlushLookbackBars", "flushLookbackBars"],
  ["MinTargetSpacePoints", "minTargetSpacePoints"],
  ["MinCloseAboveLevelPoints", "minCloseAboveLevelPoints"],
  ["LevelTapLookbackBars", "levelTapLookbackBars"],
  ["LevelTapTolerancePoints", "levelTapTolerancePoints"],
  ["ReEntryCooldownBars", "reentryCooldownBars"],
  ["FailedReEntryCooldownBars", "failedReentryCooldownBars"],
  ["FailedReEntryLevelTolerancePoints", "failedReentryLevelTolerancePoints"],
  ["FailedReEntryResetPoints", "failedReentryResetPoints"],
  ["MinReclaimCloseLocation", "minReclaimCloseLocation"],
  ["MaxReclaimUpperWickPoints", "maxReclaimUpperWickPoints"],
  ["MinImpulseBodyPercent", "minImpulseBodyPct"],
  ["EntrySlippagePoints", "entrySlippagePoints"],
  ["CommissionPerContractRoundTrip", "roundTripFeePerContract"],
  ["PnlDollarsPerPoint", "pnlPointValue"],
  ["PivotFastEma", "pivotFastEma"],
  ["PivotEma", "pivotEma"],
  ["PivotSlowEma", "pivotSlowEma"],
  ["PivotFastConvictionEma", "pivotFastConvictionEma"],
  ["PivotSlowConvictionEma", "pivotSlowConvictionEma"],
  ["PivotBiasEma", "pivotBiasEma"],
];

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function findDefault(source, property) {
  const match = source.match(new RegExp(`${property}\\s*=\\s*([^;]+);`));
  if (!match) return null;
  const text = match[1].trim();
  if (text === "true") return true;
  if (text === "false") return false;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

function auditSource(source) {
  const blockers = [];
  const warnings = [];

  for (const call of BANNED_ORDER_CALLS) {
    if (new RegExp(`\\b${call}\\s*\\(`).test(source)) blockers.push(`order_call:${call}`);
  }
  for (const snippet of REQUIRED_SNIPPETS) {
    if (!source.includes(snippet)) blockers.push(`missing:${snippet}`);
  }
  if (/culEyYkQrx7nqBgWopdfvDzJT40bU8Ve632tMO9N/.test(source)) blockers.push("private_bridge_token_present");
  if (!/AutonomyMode\s*==\s*LukeNativeAutonomyMode\.LiveGuarded[\s\S]+AllowLiveAccounts/.test(source)) {
    blockers.push("missing_live_account_guard");
  }
  if (!/Math\.Abs\(decision\.ActiveEntry - lastPrice\)\s*>\s*MaxMarketableEntryPoints/.test(source)) {
    blockers.push("missing_entry_wiggle_guard");
  }

  for (const [property, configKey] of DEFAULT_CHECKS) {
    const actual = findDefault(source, property);
    const expected = DEFAULT_CONFIG[configKey];
    if (actual === null) {
      blockers.push(`missing_default:${property}`);
    } else if (Number.isFinite(expected) && Number(actual) !== Number(expected)) {
      blockers.push(`default_mismatch:${property}:${actual}!=${expected}`);
    }
  }

  const textChecks = [
    ["EntryPriceMode", "LukeNativeEntryPriceMode.ClusterPlusTick"],
    ["LtfValidationMode", "LukeNativeLtfValidationMode.OneMinute"],
    ["PivotRibbonMode", "LukeNativePivotRibbonMode.SoftReclaim"],
  ];
  for (const [property, expected] of textChecks) {
    const actual = findDefault(source, property);
    if (actual !== expected) blockers.push(`default_mismatch:${property}:${actual}!=${expected}`);
  }

  if (!source.includes("ninja-native-shadow")) warnings.push("telemetry_source_literal_not_found");

  return {
    status: blockers.length === 0 ? "clean" : "blocked",
    blockers,
    warnings,
    no_banned_order_calls: !blockers.some((item) => item.startsWith("order_call:")),
    order_calls_gated: source.includes("NativeExecutionEnabled()")
      && source.includes("CanSubmitNativeLong")
      && source.includes("IsNativeLongPriceContextAllowed"),
  };
}

function readLevelFile(filePath = LEVEL_FILE) {
  const text = readText(filePath);
  const hasSections = /(?:^|\n)\s*(trade|mancini|major|focus_long|target_only|read_reaction|caution|trigger|reclaim)\s*:/i.test(text);
  const executableText = hasSections
    ? text.split(/\r?\n/).filter((line) => /^\s*(trade|mancini|trade_levels)\s*:/i.test(line)).join("\n")
    : text;
  const prices = [...executableText.matchAll(/[-+]?\d+(?:\.\d+)?/g)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
  return {
    file: filePath,
    prices: prices.length,
    sectioned: hasSections,
    first: prices[0] ?? null,
    last: prices.at(-1) ?? null,
  };
}

function main() {
  const outputJson = process.argv.includes("--json");
  const source = readText(SOURCE);
  const sourceAudit = auditSource(source);
  const telemetry = summarizeNativeTelemetry(parseNativeTelemetry(readText(TELEMETRY)));
  const levelFile = readLevelFile();
  const result = {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    telemetry_file: TELEMETRY,
    level_file: levelFile,
    source_audit: sourceAudit,
    telemetry,
    ready_to_install: sourceAudit.status === "clean",
    ready_to_shadow_run: sourceAudit.status === "clean",
  };

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Ninja-native port check");
    console.log(`source=${SOURCE}`);
    console.log(`source_status=${sourceAudit.status} blockers=${sourceAudit.blockers.join(",") || "none"} warnings=${sourceAudit.warnings.join(",") || "none"}`);
    console.log(`no_banned_order_calls=${sourceAudit.no_banned_order_calls}`);
    console.log(`order_calls_gated=${sourceAudit.order_calls_gated}`);
    console.log(`ready_to_install=${result.ready_to_install}`);
    console.log(`level_file_prices=${levelFile.prices}`);
    console.log(`ready_to_shadow_run=${result.ready_to_shadow_run}`);
    console.log(`telemetry_events=${telemetry.counts.events} telemetry_readiness=${telemetry.readiness.status}`);
  }

  if (sourceAudit.status !== "clean") process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  auditSource,
  readLevelFile,
};
