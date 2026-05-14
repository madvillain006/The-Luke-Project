"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "ninjatrader", "ManciniFbdStrategyAnalyzer.cs");
const DEFAULT_CUSTOM_DIR = process.env.NINJATRADER_CUSTOM_DIR
  || path.join(process.env.USERPROFILE || "C:\\Users\\conor", "OneDrive", "Documents", "NinjaTrader 8", "bin", "Custom");
const TARGET_RELATIVE = path.join("Strategies", "ManciniFbdStrategyAnalyzer.cs");
const CSPROJ_NAME = "NinjaTrader.Custom.csproj";
const CSPROJ_INCLUDE = '    <Compile Include="Strategies\\ManciniFbdStrategyAnalyzer.cs" />';

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function auditStrategySource(source) {
  const blockers = [];
  for (const snippet of [
    "public class ManciniFbdStrategyAnalyzer : Strategy",
    'PrimaryRule = "non_acceptance_only"',
    'PrimaryFillMode = "pine_next_bar_limit_split"',
    'PrimaryStopPolicy = "level_minus_3"',
    "AnalyzerQuantity = 2;",
    "SplitTp1Tp2Runner = true;",
    "Tp1Points = 2.0;",
    "StopBelowLevelPoints = 3.0;",
    "HardStopRiskGatePoints = 5.0;",
    "RunnerFallbackPoints = 4.0;",
    "AccountingCostPointsPerContract = 0.35;",
    'StrategyBuildId = "mancini-fbd-live-tagged-levels-20260514-1430"',
    "UseBakedLevelUniverse = true;",
    "RespectLevelPublicationDate = false;",
    "ActiveLevelWindowPoints = 250.0;",
    "MinimumLevelSourceConfidence = 0.45;",
    "MinimumCandidateScore = 0.50;",
    "MinimumNonAcceptanceScore = 0.50;",
    "RequireOneMinuteBars = false;",
    "BarsRequiredToTrade = 120;",
    "StopTargetHandling = StopTargetHandling.PerEntryExecution;",
    'TaggedLevelsPath = @"C:\\Users\\conor\\luke\\data\\ninjatrader\\luke-native-levels.txt";',
    "SubmitRealtimeAnalyzerOrders = true;",
    "LoadTaggedManciniLevels()",
    "ReloadTaggedLevelsIfChanged(sessionDate)",
    "tagged_levels_mode=last_input_wins",
    "TAGGED_LEVELS_LOADED",
    "TAGGED_LEVELS_RELOADED",
    "TAGGED_LEVELS_RELOAD_DEFERRED",
    "CanReloadTaggedLevelsNow",
    "AppendBuildId(notes)",
    "build_id=",
    "IsTaggedLevel(level)",
    '|| tag == "resistance"',
    "ParseTaggedRangeEnd",
    "TaggedMatchIsInlineMajor",
    "MAJOR_RESISTANCE",
    "level.IsExecutable",
    "return SubmitRealtimeAnalyzerOrders;",
    "REALTIME_READY",
    "ResetRealtimeLevelRuntimeState()",
    "cleared_level_states=",
    "realtime_level_states=",
    "ORDER_SUBMIT_REQUESTED",
    "ORDER_SUBMIT_FAILED",
    "ORDER_SUBMIT_SKIPPED",
    "simulation_only=true managed_order_proof=false",
    "requires_1m_bars_for_primary_build_path",
    "primary_bars_period=",
    "Csv(PrimaryBarsPeriodTelemetry())",
    "EnterLongLimit(0, true, qtyT1, entry, t1Name)",
    "EnterLongLimit(0, true, qtyT2, entry, t2Name)",
    "pending.OrdersSubmitted = SubmitAnalyzerOrders(pending.SignalName, pending.Feature);",
    "pending.OrderSubmitAttempted = true;",
    "SetStopLoss(t1Name, CalculationMode.Price, stop, false)",
    "SetProfitTarget(t1Name, CalculationMode.Price, tp1)",
    "SetStopLoss(t2Name, CalculationMode.Price, stop, false)",
    "SetProfitTarget(t2Name, CalculationMode.Price, tp2)",
    "RUNNER_STOP_BREAKEVEN",
    "OnExecutionUpdate",
    "TrackManagedExecution(execution, price, quantity, time)",
    "MANAGED_ENTRY_EXECUTION",
    "MANAGED_OUTCOME",
    "order_update_time=",
    "gross_contract_points=",
    "TrackAnalyzerEntryOrder(t1Name, signalName, feature, orderT1, qtyT1, entry)",
    'CancelAnalyzerEntryOrdersForSignal(pending.SignalName, pending.Feature, "pine_limit_timeout_no_fill")',
    "CancelExpiredAnalyzerEntryOrders()",
    "CancelOrder(state.Order)",
    'CancelAllAnalyzerEntryOrders("session_reset_before_level_reload")',
    "ProcessManagedTimeoutExits()",
    "ExitLong(0, quantityToExit, timeoutExitName, state.EntryName)",
    "MANAGED_TIMEOUT_EXIT_SUBMITTED",
    "TryResolveSingleOpenManagedExit",
    "allManciniLevels.Add(level)",
    "BuildActiveLevelUniverse(sessionDate, Close[0]",
    'levelMode = "baked_level_universe"',
    "exact_plan_levels=",
    "mancini-context-protocol\\events.csv",
    "trap_detected_timestamp_et",
    "candidate_fired_timestamp_et",
  ]) {
    if (!source.includes(snippet)) blockers.push(`missing:${snippet}`);
  }

  for (const banned of [
    "LiveGuarded",
    "AllowRealtimePlaybackSim",
    "PermittedRealtimeAccounts",
    "IsPermittedRealtimeAccount",
    "realtime_disabled_allow_realtime_playback_sim_false",
    "realtime_account_not_permitted",
    "AllowLiveAccounts",
    "AllowedAccountName",
    "AllowLiveAccounts = true",
    "SubmitOrderUnmanaged",
    "Account.CreateOrder",
    "ORDER_EXIT_SUBMITTED",
    "ExitLongLimit(0, false",
    "ExitLongStopMarket(0, false",
    "RequireSupportedSignalMinutes",
    "requires_supported_signal_minutes",
    "StrategyConfigNotes()",
    "SignalBarsForMinutes",
    "culEyYkQrx7nqBgWopdfvDzJT40bU8Ve632tMO9N",
    'PrimaryFillMode = "hard_mode"',
    'PrimaryStopPolicy = "fixed_12"',
    "FixedStopPoints = 12.0;",
  ]) {
    if (source.includes(banned)) blockers.push(`banned:${banned}`);
  }

  return {
    status: blockers.length === 0 ? "clean" : "blocked",
    blockers,
  };
}

function patchProject(projectText) {
  if (projectText.includes('Compile Include="Strategies\\ManciniFbdStrategyAnalyzer.cs"')) {
    return { changed: false, text: projectText };
  }

  const strategyAnchor = /(\s*<Compile Include="Strategies\\[^"]+\.cs" \/>\r?\n)(?![\s\S]*<Compile Include="Strategies\\[^"]+\.cs" \/>)/;
  if (strategyAnchor.test(projectText)) {
    return {
      changed: true,
      text: projectText.replace(strategyAnchor, `$1${CSPROJ_INCLUDE}\r\n`),
    };
  }

  const itemGroupEnd = /(\s*<\/ItemGroup>)/;
  if (!itemGroupEnd.test(projectText)) {
    throw new Error("Could not find a Strategy compile anchor or ItemGroup end in NinjaTrader.Custom.csproj");
  }
  return {
    changed: true,
    text: projectText.replace(itemGroupEnd, `${CSPROJ_INCLUDE}\r\n$1`),
  };
}

function install({ customDir = DEFAULT_CUSTOM_DIR, write = false } = {}) {
  const source = readText(SOURCE);
  const audit = auditStrategySource(source);
  if (audit.status !== "clean") {
    throw new Error(`Mancini FBD Strategy Analyzer source gate failed: ${audit.blockers.join(", ")}`);
  }

  const target = path.join(customDir, TARGET_RELATIVE);
  const project = path.join(customDir, CSPROJ_NAME);
  const projectText = readText(project);
  const patched = patchProject(projectText);
  const targetExists = fs.existsSync(target);
  const targetSame = targetExists && readText(target) === source;
  const actions = [];
  const backups = [];

  if (!targetSame) actions.push(`copy ${SOURCE} -> ${target}`);
  if (patched.changed) actions.push(`add ${TARGET_RELATIVE} compile include to ${project}`);

  if (write) {
    const backupStamp = stamp();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!targetSame) {
      if (targetExists) {
        const targetBackup = `${target}.luke-backup-${backupStamp}`;
        fs.copyFileSync(target, targetBackup);
        backups.push(targetBackup);
      }
      writeText(target, source);
    }
    if (patched.changed) {
      const projectBackup = `${project}.luke-backup-${backupStamp}`;
      fs.copyFileSync(project, projectBackup);
      backups.push(projectBackup);
      writeText(project, patched.text);
    }
  }

  return {
    custom_dir: customDir,
    source: SOURCE,
    target,
    project,
    write,
    source_gate: audit,
    target_same: targetSame,
    project_changed: patched.changed,
    actions,
    backups,
  };
}

function main() {
  const write = process.argv.includes("--write");
  const customArg = process.argv.find((arg) => arg.startsWith("--custom-dir="));
  const customDir = customArg ? customArg.slice("--custom-dir=".length) : DEFAULT_CUSTOM_DIR;
  const result = install({ customDir, write });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  auditStrategySource,
  install,
  patchProject,
};
