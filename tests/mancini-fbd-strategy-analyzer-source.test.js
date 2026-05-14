const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'ninjatrader', 'ManciniFbdStrategyAnalyzer.cs');

function readSource() {
  return fs.readFileSync(SOURCE_PATH, 'utf8');
}

describe('ManciniFbdStrategyAnalyzer source gate', () => {
  it('ports the Pine prop-risk non-acceptance build path for Strategy Analyzer', () => {
    const source = readSource();

    expect(source).toContain('public class ManciniFbdStrategyAnalyzer : Strategy');
    expect(source).toContain('PrimaryRule = "non_acceptance_only"');
    expect(source).toContain('PrimaryFillMode = "pine_next_bar_limit_split"');
    expect(source).toContain('PrimaryStopPolicy = "level_minus_3"');
    expect(source).toContain('AnalyzerQuantity = 2;');
    expect(source).toContain('SplitTp1Tp2Runner = true;');
    expect(source).toContain('Tp1Points = 2.0;');
    expect(source).toContain('StopBelowLevelPoints = 3.0;');
    expect(source).toContain('HardStopRiskGatePoints = 5.0;');
    expect(source).toContain('RunnerFallbackPoints = 4.0;');
    expect(source).toContain('AccountingCostPointsPerContract = 0.35;');
    expect(source).toContain('StrategyBuildId = "mancini-fbd-live-tagged-levels-20260514-1430"');
    expect(source).toContain('UseBakedLevelUniverse = true;');
    expect(source).toContain('RespectLevelPublicationDate = false;');
    expect(source).toContain('ActiveLevelWindowPoints = 250.0;');
    expect(source).toContain('MinimumLevelSourceConfidence = 0.45;');
    expect(source).toContain('MinimumCandidateScore = 0.50;');
    expect(source).toContain('MinimumNonAcceptanceScore = 0.50;');
    expect(source).toContain('NonAcceptancePoints = 5.0;');
    expect(source).toContain('RequireOneMinuteBars = false;');
    expect(source).toContain('BarsRequiredToTrade = 120;');
    expect(source).toContain('StopTargetHandling = StopTargetHandling.PerEntryExecution;');
    expect(source).toContain('EventsCsvPath = @"C:\\Users\\conor\\luke\\artifacts\\research\\mancini-context-protocol\\events.csv";');
    expect(source).toContain('TaggedLevelsPath = @"C:\\Users\\conor\\luke\\data\\ninjatrader\\luke-native-levels.txt";');
    expect(source).toContain('SubmitRealtimeAnalyzerOrders = true;');
    expect(source).toContain('LoadTaggedManciniLevels()');
    expect(source).toContain('ReloadTaggedLevelsIfChanged(sessionDate)');
    expect(source).toContain('tagged_levels_mode=last_input_wins');
    expect(source).toContain('TAGGED_LEVELS_LOADED');
    expect(source).toContain('TAGGED_LEVELS_RELOADED');
    expect(source).toContain('TAGGED_LEVELS_RELOAD_DEFERRED');
    expect(source).toContain('CanReloadTaggedLevelsNow');
    expect(source).toContain('AppendBuildId(notes)');
    expect(source).toContain('build_id=');
    expect(source).toContain('IsTaggedLevel(level)');
    expect(source).toContain('TaggedLevelIsExecutable');
    expect(source).toContain('|| tag == "resistance"');
    expect(source).toContain('ParseTaggedRangeEnd');
    expect(source).toContain('TaggedMatchIsInlineMajor');
    expect(source).toContain('MAJOR_RESISTANCE');
    expect(source).toContain('level.IsExecutable');
    expect(source).toContain('feature.AcceptanceFamilyModel, "non_acceptance_protocol"');
    expect(source).toContain('feature.CandidateScore >= MinimumCandidateScore');
    expect(source).toContain('feature.NonAcceptanceScore >= MinimumNonAcceptanceScore');
    expect(source).toContain('allManciniLevels.Add(level)');
    expect(source).toContain('BuildActiveLevelUniverse(sessionDate, Close[0]');
    expect(source).toContain('levelMode = "baked_level_universe"');
    expect(source).toContain('exact_plan_levels=');
    expect(source).toContain('0.25 * significantLowScore');
    expect(source).toContain('0.20 * flushScore');
    expect(source).toContain('0.25 * Math.Max(reclaimScore, nonAcceptanceScore)');
    expect(source).toContain('0.20 * squeezeScore');
    expect(source).toContain('0.10 * level.SourceConfidence');
  });

  it('uses managed orders without the removed realtime account blocker', () => {
    const source = readSource();

    expect(source).toContain('SubmitHistoricalAnalyzerOrders = true;');
    expect(source).toContain('return SubmitRealtimeAnalyzerOrders;');
    expect(source).toContain('REALTIME_READY');
    expect(source).toContain('ResetRealtimeLevelRuntimeState()');
    expect(source).toContain('cleared_level_states=');
    expect(source).toContain('realtime_level_states=');
    expect(source).toContain('ORDER_SUBMIT_REQUESTED');
    expect(source).toContain('ORDER_SUBMIT_FAILED');
    expect(source).toContain('ORDER_SUBMIT_SKIPPED');
    expect(source).toContain('simulation_only=true managed_order_proof=false');
    expect(source).not.toContain('AllowRealtimePlaybackSim');
    expect(source).not.toContain('PermittedRealtimeAccounts');
    expect(source).not.toContain('IsPermittedRealtimeAccount');
    expect(source).not.toContain('realtime_disabled_allow_realtime_playback_sim_false');
    expect(source).not.toContain('realtime_account_not_permitted');
    expect(source).toContain('requires_1m_bars_for_primary_build_path');
    expect(source).not.toContain('RequireSupportedSignalMinutes');
    expect(source).not.toContain('requires_supported_signal_minutes');
    expect(source).not.toContain('StrategyConfigNotes()');
    expect(source).not.toContain('SignalBarsForMinutes');
    expect(source).toContain('primary_bars_period=');
    expect(source).toContain('Csv(PrimaryBarsPeriodTelemetry())');
    expect(source).not.toContain('Csv("1"),\r\n                    Csv(sessionDate)');
    expect(source).not.toContain('Csv("1"),\n                    Csv(sessionDate)');
    expect(source).toContain('EnterLongLimit(0, true, qtyT1, entry, t1Name)');
    expect(source).toContain('EnterLongLimit(0, true, qtyT2, entry, t2Name)');
    expect(source).toContain('pending.OrdersSubmitted = SubmitAnalyzerOrders(pending.SignalName, pending.Feature);');
    expect(source).toContain('pending.OrderSubmitAttempted = true;');
    expect(source).toContain('SetStopLoss(t1Name, CalculationMode.Price, stop, false)');
    expect(source).toContain('SetProfitTarget(t1Name, CalculationMode.Price, tp1)');
    expect(source).toContain('SetStopLoss(t2Name, CalculationMode.Price, stop, false)');
    expect(source).toContain('SetProfitTarget(t2Name, CalculationMode.Price, tp2)');
    expect(source).toContain('RUNNER_STOP_BREAKEVEN');
    expect(source).toContain('OnExecutionUpdate');
    expect(source).toContain('TrackManagedExecution(execution, price, quantity, time)');
    expect(source).toContain('MANAGED_ENTRY_EXECUTION');
    expect(source).toContain('MANAGED_OUTCOME');
    expect(source).toContain('order_update_time=');
    expect(source).not.toContain('ORDER_EXIT_SUBMITTED');
    expect(source).not.toContain('ExitLongLimit(0, false');
    expect(source).not.toContain('ExitLongStopMarket(0, false');
    expect(source).toContain('TrackAnalyzerEntryOrder(t1Name, signalName, feature, orderT1, qtyT1, entry)');
    expect(source).toContain('CancelAnalyzerEntryOrdersForSignal(pending.SignalName, pending.Feature, "pine_limit_timeout_no_fill")');
    expect(source).toContain('CancelExpiredAnalyzerEntryOrders()');
    expect(source).toContain('CancelOrder(state.Order)');
    expect(source).toContain('CancelAllAnalyzerEntryOrders("session_reset_before_level_reload")');
    expect(source).toContain('ProcessManagedTimeoutExits()');
    expect(source).toContain('ExitLong(0, quantityToExit, timeoutExitName, state.EntryName)');
    expect(source).toContain('MANAGED_TIMEOUT_EXIT_SUBMITTED');
    expect(source).toContain('TryResolveSingleOpenManagedExit');
    expect(source).not.toContain('LiveGuarded');
    expect(source).not.toContain('AllowLiveAccounts');
    expect(source).not.toContain('AllowedAccountName');
    expect(source).not.toContain('AllowLiveAccounts = true');
    expect(source).not.toContain('SubmitOrderUnmanaged');
    expect(source).not.toContain('Account.CreateOrder');
    expect(source).not.toContain('culEyYkQrx7nqBgWopdfvDzJT40bU8Ve632tMO9N');
  });

  it('emits the required replay audit telemetry fields', () => {
    const source = readSource();

    expect(source).toContain('trap_detected_timestamp_et');
    expect(source).toContain('reclaim_detected_timestamp_et');
    expect(source).toContain('classification_complete_timestamp_et');
    expect(source).toContain('candidate_fired_timestamp_et');
    expect(source).toContain('first_hit_event');
    expect(source).toContain('same_bar_stop_and_target');
    expect(source).toContain('net_contract_points_after_cost=');
    expect(source).toContain('gross_contract_points=');
    expect(source).toContain('signal=" + simulation.SignalName');
    expect(source).toContain('pine_limit_not_touched_within_bars=');
    expect(source).toContain('pine_next_bar_limit_fill');
  });
});
