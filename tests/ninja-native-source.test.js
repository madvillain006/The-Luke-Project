const fs = require('fs');
const path = require('path');

const { DEFAULT_CONFIG } = require('../lib/backtest-data/saty-pine-watch');
const { auditSource } = require('../scripts/check-ninja-native-port');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'ninjatrader', 'LukeNativeShadowStrategy.cs');

function readSource() {
  return fs.readFileSync(SOURCE_PATH, 'utf8');
}

function defaultValue(source, property) {
  const match = source.match(new RegExp(`${property}\\s*=\\s*([^;]+);`));
  if (!match) return null;
  const text = match[1].trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

describe('LukeNativeShadowStrategy source gate', () => {
  it('defaults to shadow and gates native NinjaTrader orders', () => {
    const source = readSource();
    const audit = auditSource(source);
    expect(audit.status).toBe('clean');
    expect(audit.no_banned_order_calls).toBe(true);
    expect(audit.order_calls_gated).toBe(true);
    expect(source).toContain('AutonomyMode = LukeNativeAutonomyMode.Shadow');
    expect(source).toContain('SimExecution');
    expect(source).toContain('LiveGuarded');
    expect(source).toContain('AllowLiveAccounts = false');
    expect(source).toContain('AllowedAccountName = "LFE050706094670001"');
    expect(source).toContain('MaxMarketableEntryPoints = 0.25');
    expect(source).toContain('IsNativeLongPriceContextAllowed');
    expect(source).toContain('EnterLongLimit');
    expect(source).toContain('SetStopLoss');
    expect(source).toContain('SetProfitTarget');
    expect(source).toContain('CancelOrder');
    expect(source).toContain('WriteTelemetry("ORDER_BLOCKED"');
    expect(source).toContain('WriteTelemetry("ORDER_SUBMITTED"');
    expect(source).toContain('Calculate = Calculate.OnEachTick');
    expect(source).toContain('Math.Abs(decision.ActiveEntry - lastPrice) > MaxMarketableEntryPoints');
    expect(source).not.toContain('culEyYkQrx7nqBgWopdfvDzJT40bU8Ve632tMO9N');
    expect(source).toContain('IsTradeLevelLine');
    expect(source).toContain('key == "trade" || key == "mancini" || key == "trade_levels"');
    expect(source).toContain('WriteTelemetry("NO_CLUSTERS"');
    expect(source).toContain('raw_count=');
    expect(source).toContain('has_sections=');
  });

  it('keeps the core Pine-style defaults aligned with the existing replay engine', () => {
    const source = readSource();
    const checks = [
      ['Tp1Points', 'tp1Points'],
      ['MaxStopPoints', 'maxStopPoints'],
      ['HardStopPoints', 'hardStopPoints'],
      ['ClusterTolerancePoints', 'clusterTolerancePoints'],
      ['ReclaimHoldBars', 'reclaimHoldBars'],
      ['FlushLookbackBars', 'flushLookbackBars'],
      ['MinTargetSpacePoints', 'minTargetSpacePoints'],
      ['MinCloseAboveLevelPoints', 'minCloseAboveLevelPoints'],
      ['LevelTapLookbackBars', 'levelTapLookbackBars'],
      ['LevelTapTolerancePoints', 'levelTapTolerancePoints'],
      ['ReEntryCooldownBars', 'reentryCooldownBars'],
      ['FailedReEntryCooldownBars', 'failedReentryCooldownBars'],
      ['FailedReEntryLevelTolerancePoints', 'failedReentryLevelTolerancePoints'],
      ['FailedReEntryResetPoints', 'failedReentryResetPoints'],
      ['MinReclaimCloseLocation', 'minReclaimCloseLocation'],
      ['MaxReclaimUpperWickPoints', 'maxReclaimUpperWickPoints'],
      ['MinImpulseBodyPercent', 'minImpulseBodyPct'],
      ['EntrySlippagePoints', 'entrySlippagePoints'],
      ['CommissionPerContractRoundTrip', 'roundTripFeePerContract'],
      ['PnlDollarsPerPoint', 'pnlPointValue'],
      ['PivotFastEma', 'pivotFastEma'],
      ['PivotEma', 'pivotEma'],
      ['PivotSlowEma', 'pivotSlowEma'],
      ['PivotFastConvictionEma', 'pivotFastConvictionEma'],
      ['PivotSlowConvictionEma', 'pivotSlowConvictionEma'],
      ['PivotBiasEma', 'pivotBiasEma'],
    ];

    for (const [property, configKey] of checks) {
      expect(defaultValue(source, property)).toBe(DEFAULT_CONFIG[configKey]);
    }
    expect(defaultValue(source, 'EntryPriceMode')).toBe('LukeNativeEntryPriceMode.ClusterPlusTick');
    expect(defaultValue(source, 'LtfValidationMode')).toBe('LukeNativeLtfValidationMode.OneMinute');
    expect(defaultValue(source, 'PivotRibbonMode')).toBe('LukeNativePivotRibbonMode.SoftReclaim');
  });

  it('contains the actual port surfaces needed for Ninja side-by-side parity', () => {
    const source = readSource();
    const normalizedSource = source.replace(/\r\n/g, '\n');
    expect(source).toContain('AddDataSeries(BarsPeriodType.Minute, 1)');
    expect(source).toContain('AddDataSeries(BarsPeriodType.Minute, 3)');
    expect(source).toContain('AddDataSeries(BarsPeriodType.Day, 1)');
    expect(source).toContain('BuildSatyLevels');
    expect(source).toContain('SatyTriggerPct = 0.236');
    expect(source).toContain('ComputeSatyAtr');
    expect(source).toContain('previousClose + atr * 0.382');
    expect(source).toContain('previousClose - atr * 0.786');
    expect(source).toContain('!string.Equals(source, "saty", StringComparison.Ordinal)');
    expect(source).toContain('SyncPrimaryBarState');
    expect(source).toContain('ValidateLtf');
    expect(source).toContain('lowerTime <= barStart || lowerTime > barEnd');
    expect(source).toContain('PrimaryBarMinutes');
    expect(source).toContain('PineBarTime().ToString');
    expect(source).toContain('Draw.TextFixed');
    expect(source).toContain('LUKE NATIVE SESSION LEDGER');
    expect(source).toContain('score incl cxl');
    expect(source).toContain('realistic net');
    expect(source).toContain('SessionCommissionDollars');
    expect(source).toContain('PineBridgeEventsPath = @"C:\\Users\\conor\\luke\\state\\events\\ninjatrader-bridge.jsonl"');
    expect(source).toContain('BuildPivotState');
    expect(source).not.toContain('int barsAgo = State == State.Realtime ? 1 : 0');
    expect(source).toContain('int barsAgo = 0;');
    expect(source).toContain('ShadowLongEvent');
    expect(source).toContain('WriteShadowOnlyLongTelemetry');
    expect(source).toContain('shadow_only=true');
    expect(source).toContain('TrackCandidateOutcome');
    expect(source).toContain('OpenContractCount(false)');
    expect(source).toContain('trackedCandidateActiveStop = trackedCandidateEntry');
    expect(source).toContain('EntrySlippagePoints = 0.25');
    expect(source).toContain('CommissionPerContractRoundTrip = 5.0');
    expect(source).toContain('total_points=');
    expect(source).toContain('SelectByPriority(3');
    expect(source).toContain('SelectByPriority(2');
    expect(source).toContain('SelectByPriority(1');
    expect(source).toContain('WriteTelemetry("LONG"');
    expect(source).toContain('WriteTelemetry("CANCEL"');
    expect(source).toContain('WriteTelemetry("TP1"');
    expect(source).toContain('WriteCancelTelemetry');
    expect(source).toContain('cross_bar=true');
    expect(source).toContain('STOP_FIRST');
    expect(source).toContain('MIXED_STOP_FIRST');
    expect(normalizedSource).toContain('DrawLedgerOverlay();\n\n            if (AutonomyMode == LukeNativeAutonomyMode.Disabled)');
    expect(normalizedSource).toContain('ResetSessionState();\n                DrawLedgerOverlay();');
  });
});
