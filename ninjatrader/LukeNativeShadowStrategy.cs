#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript.DrawingTools;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Indicators;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public enum LukeNativeEntryPriceMode
    {
        ClusterPlusTick,
        SignalClose
    }

    public enum LukeNativeLtfValidationMode
    {
        Off,
        OneMinute,
        ThreeMinute,
        FiveMinuteChart,
        EitherOneOrThree,
        BothOneAndThree,
        AnyOneThreeFive,
        AllOneThreeFive
    }

    public enum LukeNativePivotRibbonMode
    {
        Off,
        SoftReclaim,
        AbovePivot,
        PivotOrConviction,
        FullBullish
    }

    public enum LukeNativeAutonomyMode
    {
        Disabled,
        Shadow,
        SimExecution,
        LiveGuarded
    }

    public class LukeNativeShadowStrategy : Strategy
    {
        private const string NativeEntryT1Name = "LukeNativeLongT1";
        private const string NativeEntryT2Name = "LukeNativeLongT2";
        private readonly List<LevelInput> rawLevels = new List<LevelInput>();
        private readonly List<LevelCluster> clusters = new List<LevelCluster>();
        private DateTime lastLevelLoadUtc = DateTime.MinValue;
        private string lastLevelFileText = string.Empty;
        private DateTime lastLevelSessionDate = DateTime.MinValue;
        private int lastNoClustersTelemetryBar = -1;
        private bool previousWatchSignal;
        private bool previousArmedSignal;
        private bool previousPaperSignal;
        private bool previousInvalidatedSignal;
        private bool previousBlockedSignal;
        private double previousActiveLevel = double.NaN;
        private int primaryBarIndex = -1;
        private bool currentBarWatchSignal;
        private bool currentBarArmedSignal;
        private bool currentBarPaperSignal;
        private bool currentBarInvalidatedSignal;
        private bool currentBarBlockedSignal;
        private double currentBarActiveLevel = double.NaN;
        private bool trackedCandidateOpen;
        private int trackedCandidateStartBar = -1;
        private string trackedCandidateId = string.Empty;
        private double trackedCandidateLevel = double.NaN;
        private double trackedCandidateEntry = double.NaN;
        private double trackedCandidateActiveStop = double.NaN;
        private double trackedCandidateTp1 = double.NaN;
        private double trackedCandidateTp2 = double.NaN;
        private bool trackedCandidateTp1Hit;
        private bool trackedCandidateSuccessCounted;
        private double trackedCandidateRealizedPoints;
        private double trackedCandidateRealizedGrossDollars;
        private double trackedCandidateRealizedCostDollars;
        private double trackedCandidateRealizedNetDollars;
        private int lastCandidateClosedBar = -1;
        private double lastFailedCandidateLevel = double.NaN;
        private int lastFailedCandidateBar = -1;
        private bool pendingLong;
        private int pendingLongBar = -1;
        private string pendingLongId = string.Empty;
        private double pendingLongLevel = double.NaN;
        private double pendingLongEntry = double.NaN;
        private Order nativeEntryOrderT1;
        private Order nativeEntryOrderT2;
        private readonly List<string> ledgerOverlayRows = new List<string>();
        private string nativeActiveSignalId = string.Empty;
        private double nativeActiveEntry = double.NaN;
        private double nativeActiveTp1 = double.NaN;
        private int nativeRunnerQuantity;
        private DateTime nativeSubmittedUtc = DateTime.MinValue;
        private bool nativeRunnerStopMovedToBreakEven;
        private DateTime lastLedgerCountRefreshUtc = DateTime.MinValue;
        private int nativeLongsToday;
        private int nativeCancelsToday;
        private int pineBridgeLongsToday;
        private int pineBridgeCancelsToday;
        private int sessionAttempts;
        private int sessionSuccesses;
        private int sessionStopped;
        private int sessionWatches;
        private int sessionTp1Hits;
        private int sessionTp2Hits;
        private int sessionBreakevens;
        private int sessionMixed;
        private int sessionLtfFiltered;
        private int sessionLiveCancelled;
        private double sessionCancelRealizedPoints;
        private double sessionCancelRealizedDollars;
        private double sessionCancelCostDollars;
        private double sessionCancelNetDollars;
        private double sessionRealizedPoints;
        private double sessionRealizedDollars;
        private double sessionCostDollars;
        private double sessionNetDollars;
        private int candidateId;
        private int watchId;

        [NinjaScriptProperty]
        [Display(Name = "Autonomy mode", GroupName = "Luke Native", Order = 1)]
        public LukeNativeAutonomyMode AutonomyMode { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Level file path", GroupName = "Luke Native", Order = 2)]
        public string LevelFilePath { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Telemetry file path", GroupName = "Luke Native", Order = 3)]
        public string TelemetryFilePath { get; set; }

        [NinjaScriptProperty]
        [Range(1, 3600)]
        [Display(Name = "Level refresh seconds", GroupName = "Luke Native", Order = 4)]
        public int LevelRefreshSeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show parity ledger overlay", GroupName = "Luke Native", Order = 5)]
        public bool ShowParityLedgerOverlay { get; set; }

        [NinjaScriptProperty]
        [Range(3, 20)]
        [Display(Name = "Ledger overlay rows", GroupName = "Luke Native", Order = 6)]
        public int LedgerOverlayRows { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Pine bridge events path", GroupName = "Luke Native", Order = 7)]
        public string PineBridgeEventsPath { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require flat position", GroupName = "Native Execution Safety", Order = 1)]
        public bool RequireFlatPosition { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Allow live accounts", GroupName = "Native Execution Safety", Order = 2)]
        public bool AllowLiveAccounts { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Allowed exact account", GroupName = "Native Execution Safety", Order = 3)]
        public string AllowedAccountName { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "Native quantity", GroupName = "Native Execution Safety", Order = 4)]
        public int NativeQuantity { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "Max quantity", GroupName = "Native Execution Safety", Order = 5)]
        public int MaxQuantity { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Max marketable entry points", GroupName = "Native Execution Safety", Order = 6)]
        public double MaxMarketableEntryPoints { get; set; }

        [NinjaScriptProperty]
        [Range(1, 7200)]
        [Display(Name = "Limit order expiry seconds", GroupName = "Native Execution Safety", Order = 7)]
        public int LimitOrderExpirySeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Entry price mode", GroupName = "Signal Math", Order = 1)]
        public LukeNativeEntryPriceMode EntryPriceMode { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "LTF validation", GroupName = "Signal Math", Order = 2)]
        public LukeNativeLtfValidationMode LtfValidationMode { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Pivot ribbon mode", GroupName = "Signal Math", Order = 3)]
        public LukeNativePivotRibbonMode PivotRibbonMode { get; set; }

        [NinjaScriptProperty]
        [Range(0.25, 3.0)]
        [Display(Name = "Cluster tolerance points", GroupName = "Signal Math", Order = 4)]
        public double ClusterTolerancePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 5000.0)]
        [Display(Name = "Live level window points", GroupName = "Signal Math", Order = 5)]
        public double LiveLevelWindowPoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.25, 50.0)]
        [Display(Name = "TP1 points", GroupName = "Signal Math", Order = 6)]
        public double Tp1Points { get; set; }

        [NinjaScriptProperty]
        [Range(0.25, 50.0)]
        [Display(Name = "Max stop points", GroupName = "Signal Math", Order = 7)]
        public double MaxStopPoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.25, 50.0)]
        [Display(Name = "Hard stop points", GroupName = "Signal Math", Order = 8)]
        public double HardStopPoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.25, 50.0)]
        [Display(Name = "Minimum target space points", GroupName = "Signal Math", Order = 9)]
        public double MinTargetSpacePoints { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Allow candidate with TP1 room", GroupName = "Signal Math", Order = 10)]
        public bool AllowTp1RoomCandidate { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "Reclaim hold bars", GroupName = "Signal Math", Order = 11)]
        public int ReclaimHoldBars { get; set; }

        [NinjaScriptProperty]
        [Range(2, 100)]
        [Display(Name = "Flush lookback bars", GroupName = "Signal Math", Order = 12)]
        public int FlushLookbackBars { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Minimum close above level", GroupName = "Signal Math", Order = 13)]
        public double MinCloseAboveLevelPoints { get; set; }

        [NinjaScriptProperty]
        [Range(0, 10)]
        [Display(Name = "Fresh level tap lookback bars", GroupName = "Signal Math", Order = 14)]
        public int LevelTapLookbackBars { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Fresh level tap tolerance", GroupName = "Signal Math", Order = 15)]
        public double LevelTapTolerancePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0, 20)]
        [Display(Name = "Re-entry cooldown bars", GroupName = "Signal Math", Order = 16)]
        public int ReEntryCooldownBars { get; set; }

        [NinjaScriptProperty]
        [Range(0, 50)]
        [Display(Name = "Failed-level cooldown bars", GroupName = "Signal Math", Order = 17)]
        public int FailedReEntryCooldownBars { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Failed-level match tolerance", GroupName = "Signal Math", Order = 18)]
        public double FailedReEntryLevelTolerancePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Failed-level reset depth", GroupName = "Signal Math", Order = 19)]
        public double FailedReEntryResetPoints { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Block stuffed reclaim candles", GroupName = "Signal Math", Order = 20)]
        public bool AntiStuffFilter { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 1.0)]
        [Display(Name = "Minimum reclaim close location", GroupName = "Signal Math", Order = 21)]
        public double MinReclaimCloseLocation { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 20.0)]
        [Display(Name = "Maximum reclaim upper wick", GroupName = "Signal Math", Order = 22)]
        public double MaxReclaimUpperWickPoints { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Enable impulse reclaim LONG", GroupName = "Signal Math", Order = 23)]
        public bool EnableImpulseReclaimLong { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require impulse cloud break", GroupName = "Signal Math", Order = 24)]
        public bool RequireImpulseCloudBreak { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 1.0)]
        [Display(Name = "Minimum impulse body percent", GroupName = "Signal Math", Order = 25)]
        public double MinImpulseBodyPercent { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Enable Saty levels", GroupName = "Saty", Order = 1)]
        public bool EnableSatyLevels { get; set; }

        [NinjaScriptProperty]
        [Range(1, 100)]
        [Display(Name = "Saty ATR length", GroupName = "Saty", Order = 2)]
        public int SatyAtrLength { get; set; }

        [NinjaScriptProperty]
        [Range(0.001, 1.0)]
        [Display(Name = "Saty trigger percentage", GroupName = "Saty", Order = 3)]
        public double SatyTriggerPct { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Split TP1/TP2 runner", GroupName = "Shadow Accounting", Order = 1)]
        public bool SplitTp1Tp2Runner { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Entry slippage points", GroupName = "Shadow Accounting", Order = 2)]
        public double EntrySlippagePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Exit slippage points", GroupName = "Shadow Accounting", Order = 3)]
        public double ExitSlippagePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 100.0)]
        [Display(Name = "Commission round trip", GroupName = "Shadow Accounting", Order = 4)]
        public double CommissionPerContractRoundTrip { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 500.0)]
        [Display(Name = "PnL dollars per point", GroupName = "Shadow Accounting", Order = 5)]
        public double PnlDollarsPerPoint { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot fast EMA", GroupName = "Pivot Ribbon", Order = 1)]
        public int PivotFastEma { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot EMA", GroupName = "Pivot Ribbon", Order = 2)]
        public int PivotEma { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot slow EMA", GroupName = "Pivot Ribbon", Order = 3)]
        public int PivotSlowEma { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot fast conviction EMA", GroupName = "Pivot Ribbon", Order = 4)]
        public int PivotFastConvictionEma { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot slow conviction EMA", GroupName = "Pivot Ribbon", Order = 5)]
        public int PivotSlowConvictionEma { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Pivot bias EMA", GroupName = "Pivot Ribbon", Order = 6)]
        public int PivotBiasEma { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "LukeNativeShadowStrategy";
                Description = "Ninja-native port of the Luke v4 reclaim/bridge signal engine. Defaults to shadow; guarded modes can submit limit orders.";
                Calculate = Calculate.OnEachTick;
                EntriesPerDirection = 2;
                EntryHandling = EntryHandling.UniqueEntries;
                IsExitOnSessionCloseStrategy = true;
                ExitOnSessionCloseSeconds = 30;
                IsInstantiatedOnEachOptimizationIteration = false;

                AutonomyMode = LukeNativeAutonomyMode.Shadow;
                LevelFilePath = @"C:\Users\conor\luke\data\ninjatrader\luke-native-levels.txt";
                TelemetryFilePath = @"C:\Users\conor\luke\state\events\ninja-native-shadow.jsonl";
                LevelRefreshSeconds = 5;
                ShowParityLedgerOverlay = true;
                LedgerOverlayRows = 8;
                PineBridgeEventsPath = @"C:\Users\conor\luke\state\events\ninjatrader-bridge.jsonl";
                RequireFlatPosition = true;
                AllowLiveAccounts = false;
                AllowedAccountName = "LFE050706094670001";
                NativeQuantity = 2;
                MaxQuantity = 2;
                MaxMarketableEntryPoints = 0.25;
                LimitOrderExpirySeconds = 600;
                EntryPriceMode = LukeNativeEntryPriceMode.ClusterPlusTick;
                LtfValidationMode = LukeNativeLtfValidationMode.OneMinute;
                PivotRibbonMode = LukeNativePivotRibbonMode.SoftReclaim;
                ClusterTolerancePoints = 1.25;
                LiveLevelWindowPoints = 400.0;
                Tp1Points = 2.0;
                MaxStopPoints = 3.0;
                HardStopPoints = 5.0;
                MinTargetSpacePoints = 3.0;
                AllowTp1RoomCandidate = true;
                ReclaimHoldBars = 2;
                FlushLookbackBars = 12;
                MinCloseAboveLevelPoints = 0.25;
                LevelTapLookbackBars = 2;
                LevelTapTolerancePoints = 0.5;
                ReEntryCooldownBars = 2;
                FailedReEntryCooldownBars = 8;
                FailedReEntryLevelTolerancePoints = 1.25;
                FailedReEntryResetPoints = 1.0;
                AntiStuffFilter = true;
                MinReclaimCloseLocation = 0.55;
                MaxReclaimUpperWickPoints = 3.0;
                EnableImpulseReclaimLong = true;
                RequireImpulseCloudBreak = true;
                MinImpulseBodyPercent = 0.45;
                EnableSatyLevels = true;
                SatyAtrLength = 14;
                SatyTriggerPct = 0.236;
                SplitTp1Tp2Runner = true;
                EntrySlippagePoints = 0.25;
                ExitSlippagePoints = 0.0;
                CommissionPerContractRoundTrip = 5.0;
                PnlDollarsPerPoint = 50.0;
                PivotFastEma = 8;
                PivotEma = 21;
                PivotSlowEma = 34;
                PivotFastConvictionEma = 13;
                PivotSlowConvictionEma = 48;
                PivotBiasEma = 21;
            }
            else if (State == State.Configure)
            {
                AddDataSeries(BarsPeriodType.Minute, 1);
                AddDataSeries(BarsPeriodType.Minute, 3);
                AddDataSeries(BarsPeriodType.Day, 1);
            }
            else if (State == State.Realtime)
            {
                WriteTelemetry("ENGINE_READY", null, "mode=" + AutonomyMode + " account=" + GetCurrentAccountName() + " guard=" + AccountGuardDescription());
            }
            else if (State == State.Terminated)
            {
                WriteTelemetry("ENGINE_TERMINATED", null, "shadow strategy terminated");
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0)
                return;

            DrawLedgerOverlay();

            if (AutonomyMode == LukeNativeAutonomyMode.Disabled)
                return;
            if (CurrentBar < Math.Max(FlushLookbackBars + 2, Math.Max(PivotSlowConvictionEma, PivotSlowEma) + 2))
                return;

            SyncPrimaryBarState();
            if (Bars.IsFirstBarOfSession && IsFirstTickOfBar)
            {
                ResetSessionState();
                DrawLedgerOverlay();
            }

            CancelExpiredNativeOrders();
            MoveNativeRunnerStopToBreakEvenIfNeeded();
            ResetNativeExecutionStateIfFlat();

            LoadLevelsIfNeeded();
            BuildClusters();
            if (clusters.Count == 0)
            {
                if (lastNoClustersTelemetryBar != CurrentBar)
                {
                    lastNoClustersTelemetryBar = CurrentBar;
                    WriteTelemetry("NO_CLUSTERS", null, "raw_levels=" + rawLevels.Count.ToString(CultureInfo.InvariantCulture)
                        + " close=" + Format(Close[0])
                        + " window=" + Format(LiveLevelWindowPoints)
                        + " level_path=" + LevelFilePath);
                }
                return;
            }

            ShadowDecision decision = EvaluateDecision();
            EmitDecisionEvents(decision);
            TrackCandidateOutcome();
        }

        protected override void OnOrderUpdate(Order order, double limitPrice, double stopPrice, int quantity, int filled, double averageFillPrice, OrderState orderState, DateTime time, ErrorCode error, string nativeError)
        {
            if (order == null)
                return;

            if (string.Equals(order.Name, NativeEntryT1Name, StringComparison.Ordinal))
                nativeEntryOrderT1 = order;
            else if (string.Equals(order.Name, NativeEntryT2Name, StringComparison.Ordinal))
                nativeEntryOrderT2 = order;
            else
                return;

            if (orderState == OrderState.Rejected)
            {
                WriteTelemetry("ORDER_REJECTED", null, "id=" + nativeActiveSignalId
                    + " order=" + order.Name
                    + " error=" + error
                    + " native_error=" + nativeError);
            }
            else if (orderState == OrderState.Cancelled)
            {
                WriteTelemetry("ORDER_CANCELLED_BY_BROKER", null, "id=" + nativeActiveSignalId
                    + " order=" + order.Name
                    + " filled=" + filled.ToString(CultureInfo.InvariantCulture));
            }
        }

        private void ResetSessionState()
        {
            previousWatchSignal = false;
            previousArmedSignal = false;
            previousPaperSignal = false;
            previousInvalidatedSignal = false;
            previousBlockedSignal = false;
            previousActiveLevel = double.NaN;
            ClearTrackedCandidate();
            lastCandidateClosedBar = -1;
            lastFailedCandidateLevel = double.NaN;
            lastFailedCandidateBar = -1;
            pendingLong = false;
            pendingLongBar = -1;
            pendingLongId = string.Empty;
            pendingLongLevel = double.NaN;
            pendingLongEntry = double.NaN;
            ResetSessionLedger();
            primaryBarIndex = CurrentBar;
            currentBarWatchSignal = false;
            currentBarArmedSignal = false;
            currentBarPaperSignal = false;
            currentBarInvalidatedSignal = false;
            currentBarBlockedSignal = false;
            currentBarActiveLevel = double.NaN;
        }

        private void SyncPrimaryBarState()
        {
            if (primaryBarIndex == CurrentBar)
                return;
            if (primaryBarIndex >= 0)
            {
                previousWatchSignal = currentBarWatchSignal;
                previousArmedSignal = currentBarArmedSignal;
                previousPaperSignal = currentBarPaperSignal;
                previousInvalidatedSignal = currentBarInvalidatedSignal;
                previousBlockedSignal = currentBarBlockedSignal;
                previousActiveLevel = IsFinite(currentBarActiveLevel) ? currentBarActiveLevel : double.NaN;
            }
            primaryBarIndex = CurrentBar;
            currentBarWatchSignal = false;
            currentBarArmedSignal = false;
            currentBarPaperSignal = false;
            currentBarInvalidatedSignal = false;
            currentBarBlockedSignal = false;
            currentBarActiveLevel = double.NaN;
        }

        private void LoadLevelsIfNeeded()
        {
            if (string.IsNullOrWhiteSpace(LevelFilePath))
                return;
            if ((DateTime.UtcNow - lastLevelLoadUtc).TotalSeconds < Math.Max(1, LevelRefreshSeconds))
                return;
            lastLevelLoadUtc = DateTime.UtcNow;

            string text;
            try
            {
                text = File.Exists(LevelFilePath) ? File.ReadAllText(LevelFilePath) : string.Empty;
            }
            catch (Exception ex)
            {
                WriteTelemetry("LEVEL_LOAD_ERROR", null, ex.Message);
                return;
            }
            DateTime chartSessionDate = ChartFuturesSessionDate();
            DateTime targetSessionDate = ExtractTargetSessionDate(text);
            if (string.Equals(text, lastLevelFileText, StringComparison.Ordinal)
                && chartSessionDate == lastLevelSessionDate)
                return;

            if (targetSessionDate != DateTime.MinValue && chartSessionDate != DateTime.MinValue && targetSessionDate.Date != chartSessionDate.Date)
            {
                rawLevels.Clear();
                lastLevelFileText = text;
                lastLevelSessionDate = chartSessionDate;
                WriteTelemetry("LEVEL_SESSION_MISMATCH", null,
                    "target_session=" + targetSessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                    + " chart_session=" + chartSessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                    + " path=" + LevelFilePath);
                return;
            }

            rawLevels.Clear();
            lastLevelFileText = text;
            lastLevelSessionDate = chartSessionDate;
            string[] lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            bool hasSections = Regex.IsMatch(text, @"(?im)^\s*(trade|mancini|major|focus_long|target_only|read_reaction|caution|trigger|reclaim)\s*:");
            int rawMatches = 0;
            int rejectedMatches = 0;
            for (int lineIndex = 0; lineIndex < lines.Length; lineIndex++)
            {
                string line = (lines[lineIndex] ?? string.Empty).Trim();
                if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal))
                    continue;
                if (hasSections && !IsTradeLevelLine(line))
                    continue;
                foreach (Match match in Regex.Matches(line, @"[-+]?\d+(?:\.\d+)?"))
                {
                    rawMatches++;
                    double value;
                    if (!double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out value))
                        continue;
                    if (!IsValidExternalEsLevel(value))
                    {
                        rejectedMatches++;
                        continue;
                    }
                    InsertSorted(rawLevels, new LevelInput(RoundPrice(value), "mancini"));
                }
            }
            WriteTelemetry("LEVELS_LOADED", null, "count=" + rawLevels.Count.ToString(CultureInfo.InvariantCulture)
                + " raw_count=" + rawMatches.ToString(CultureInfo.InvariantCulture)
                + " rejected_count=" + rejectedMatches.ToString(CultureInfo.InvariantCulture)
                + " target_session=" + (targetSessionDate == DateTime.MinValue ? "" : targetSessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                + " chart_session=" + (chartSessionDate == DateTime.MinValue ? "" : chartSessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                + " bytes=" + text.Length.ToString(CultureInfo.InvariantCulture)
                + " has_sections=" + (hasSections ? "true" : "false")
                + " path=" + LevelFilePath);
        }

        private DateTime ExtractTargetSessionDate(string text)
        {
            Match match = Regex.Match(text ?? string.Empty, @"(?im)^\s*#\s*target_session:\s*(\d{4}-\d{2}-\d{2})\b");
            DateTime parsed;
            if (match.Success && DateTime.TryParseExact(match.Groups[1].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
                return parsed.Date;
            return DateTime.MinValue;
        }

        private DateTime ChartFuturesSessionDate()
        {
            if (CurrentBar < 0)
                return DateTime.MinValue;
            DateTime sessionDate = Time[0].TimeOfDay >= TimeSpan.FromHours(18.0)
                ? Time[0].Date.AddDays(1.0)
                : Time[0].Date;
            while (sessionDate.DayOfWeek == DayOfWeek.Saturday || sessionDate.DayOfWeek == DayOfWeek.Sunday)
                sessionDate = sessionDate.AddDays(-1.0);
            return sessionDate.Date;
        }

        private static bool IsValidExternalEsLevel(double value)
        {
            if (!IsFinite(value) || value < 3000.0 || value > 20000.0)
                return false;
            double ticks = value / 0.25;
            return Math.Abs(ticks - Math.Round(ticks)) < 0.000001;
        }

        private static bool IsTradeLevelLine(string line)
        {
            string text = (line ?? string.Empty).Trim().ToLowerInvariant();
            int colon = text.IndexOf(':');
            if (colon < 0)
                return true;
            string key = text.Substring(0, colon).Trim();
            return key == "trade" || key == "mancini" || key == "trade_levels";
        }

        private void BuildClusters()
        {
            clusters.Clear();
            List<LevelInput> scanLevels = new List<LevelInput>(rawLevels);
            AddSatyLevels(scanLevels);
            foreach (LevelInput input in scanLevels)
            {
                double price = input.Price;
                string source = input.Source;
                if (!string.Equals(source, "saty", StringComparison.Ordinal)
                    && LiveLevelWindowPoints > 0.0
                    && Math.Abs(price - Close[0]) > LiveLevelWindowPoints)
                    continue;
                if (clusters.Count == 0)
                {
                    clusters.Add(new LevelCluster(price, source));
                    continue;
                }

                LevelCluster last = clusters[clusters.Count - 1];
                double lowEdge = Math.Min(last.Min, price);
                double highEdge = Math.Max(last.Max, price);
                bool withinAnchor = Math.Abs(price - last.Anchor) <= ClusterTolerancePoints;
                bool withinWidth = highEdge - lowEdge <= ClusterTolerancePoints;
                if (withinAnchor && withinWidth)
                {
                    bool newSource = !last.HasSource(source);
                    last.Anchor = RoundToTick(((last.Anchor * last.Strength) + price) / (last.Strength + 1));
                    last.Min = lowEdge;
                    last.Max = highEdge;
                    if (newSource)
                    {
                        last.AddSource(source);
                        last.Strength++;
                    }
                }
                else
                {
                    clusters.Add(new LevelCluster(price, source));
                }
            }
        }

        private void AddSatyLevels(List<LevelInput> values)
        {
            if (!EnableSatyLevels)
                return;
            List<double> saty = BuildSatyLevels();
            foreach (double level in saty)
                InsertSorted(values, new LevelInput(level, "saty"));
        }

        private List<double> BuildSatyLevels()
        {
            List<double> levels = new List<double>();
            if (BarsArray.Length <= 3 || CurrentBars.Length <= 3 || CurrentBars[3] <= SatyAtrLength)
                return levels;

            double previousClose = Closes[3][1];
            double atr = ComputeSatyAtr(3, SatyAtrLength);
            if (!IsFinite(previousClose) || !IsFinite(atr) || atr <= 0.0)
                return levels;

            AddSatyLevel(levels, previousClose);
            AddSatyLevel(levels, previousClose + atr * SatyTriggerPct);
            AddSatyLevel(levels, previousClose - atr * SatyTriggerPct);
            AddSatyLevel(levels, previousClose + atr * 0.382);
            AddSatyLevel(levels, previousClose + atr * 0.500);
            AddSatyLevel(levels, previousClose + atr * 0.618);
            AddSatyLevel(levels, previousClose + atr * 0.786);
            AddSatyLevel(levels, previousClose + atr);
            AddSatyLevel(levels, previousClose - atr * 0.382);
            AddSatyLevel(levels, previousClose - atr * 0.500);
            AddSatyLevel(levels, previousClose - atr * 0.618);
            AddSatyLevel(levels, previousClose - atr * 0.786);
            AddSatyLevel(levels, previousClose - atr);
            return levels;
        }

        private void AddSatyLevel(List<double> levels, double price)
        {
            if (IsFinite(price))
                InsertSorted(levels, RoundPrice(price));
        }

        private double ComputeSatyAtr(int seriesIndex, int length)
        {
            if (seriesIndex >= BarsArray.Length || seriesIndex >= CurrentBars.Length || CurrentBars[seriesIndex] <= length)
                return double.NaN;

            int completedBars = CurrentBars[seriesIndex];
            List<double> highs = new List<double>();
            List<double> lows = new List<double>();
            List<double> closes = new List<double>();
            for (int barsAgo = completedBars; barsAgo >= 1; barsAgo--)
            {
                highs.Add(Highs[seriesIndex][barsAgo]);
                lows.Add(Lows[seriesIndex][barsAgo]);
                closes.Add(Closes[seriesIndex][barsAgo]);
            }
            if (closes.Count <= length)
                return double.NaN;

            List<double> ranges = new List<double>();
            for (int i = 0; i < closes.Count; i++)
            {
                double previousClose = i > 0 ? closes[i - 1] : double.NaN;
                double range = highs[i] - lows[i];
                if (IsFinite(previousClose))
                {
                    range = Math.Max(range, Math.Abs(highs[i] - previousClose));
                    range = Math.Max(range, Math.Abs(lows[i] - previousClose));
                }
                ranges.Add(range);
            }

            double seed = 0.0;
            for (int i = 1; i <= length; i++)
                seed += ranges[i];
            double atr = seed / length;
            for (int i = length + 1; i < ranges.Count; i++)
                atr = ((atr * (length - 1)) + ranges[i]) / length;
            return atr;
        }

        private ShadowDecision EvaluateDecision()
        {
            ShadowDecision decision = new ShadowDecision();
            for (int i = 0; i < clusters.Count; i++)
            {
                double level = clusters[i].Anchor;
                double nextCluster = NextAbove(level);
                double entry = EntryPriceMode == LukeNativeEntryPriceMode.SignalClose
                    ? Close[0]
                    : level + Math.Max(MinCloseAboveLevelPoints, TickSize);
                entry = RoundPrice(entry);
                double stop = RoundPrice(level - Math.Min(MaxStopPoints, HardStopPoints));
                double tp1 = RoundPrice(entry + Tp1Points);
                double tp2 = !double.IsNaN(nextCluster) && nextCluster > tp1
                    ? RoundPrice(nextCluster)
                    : RoundPrice(entry + Tp1Points * 2.0);

                double targetSpace = double.IsNaN(nextCluster) ? Tp1Points * 2.0 : nextCluster - level;
                double entryTargetSpace = double.IsNaN(nextCluster) ? Tp1Points * 2.0 : nextCluster - entry;
                double riskPoints = entry - stop;
                bool targetOk = (targetSpace >= MinTargetSpacePoints && entryTargetSpace >= MinTargetSpacePoints)
                    || (AllowTp1RoomCandidate && (double.IsNaN(nextCluster) || nextCluster - entry >= Tp1Points));
                bool riskOk = riskPoints <= HardStopPoints;

                bool recentTap = RecentLevelTap(level);
                bool freshLevelRetest = recentTap && Close[0] >= level + MinCloseAboveLevelPoints;
                bool failedRecent = IsFailedLevelRecent(level);
                bool failedReset = Low[0] <= level - FailedReEntryResetPoints && Close[0] >= level + MinCloseAboveLevelPoints;
                bool failedChaseBlock = failedRecent && !failedReset;
                bool flushEvent = Low[0] <= level - TickSize && Close[1] >= level;
                bool reclaimEvent = Close[0] > level && (Close[1] <= level || Low[0] <= level - TickSize);
                bool reclaimRecent = ReclaimRecent(level);
                bool holdAbove = HoldAbove(level);
                double candleRange = Math.Max(High[0] - Low[0], TickSize);
                double closeLocation = (Close[0] - Low[0]) / candleRange;
                double bodyPct = Math.Abs(Close[0] - Open[0]) / candleRange;
                double upperWick = High[0] - Math.Max(Open[0], Close[0]);
                bool closeCleared = Close[0] >= level + MinCloseAboveLevelPoints;
                PivotState pivot = BuildPivotState();
                bool notStuffed = !AntiStuffFilter
                    || (closeCleared && closeLocation >= MinReclaimCloseLocation && upperWick <= MaxReclaimUpperWickPoints && pivot.LongOk);
                bool impulseCloudOk = !RequireImpulseCloudBreak || pivot.CloudBreakNow || Close[0] >= pivot.CloudTop;
                bool impulseReclaim = EnableImpulseReclaimLong
                    && reclaimEvent
                    && freshLevelRetest
                    && Close[0] > Open[0]
                    && bodyPct >= MinImpulseBodyPercent
                    && closeCleared
                    && impulseCloudOk
                    && pivot.LongOk;
                bool armedHere = ((reclaimRecent && holdAbove) || impulseReclaim) && targetOk && notStuffed && !failedChaseBlock;
                bool paperHere = armedHere && riskOk;
                bool watchHere = flushEvent && targetOk;
                bool invalidHere = reclaimRecent && Close[0] < level - TickSize && Close[1] >= level;
                bool blockedHere = reclaimRecent && holdAbove && (!targetOk || !notStuffed || !riskOk || failedChaseBlock);

                if (watchHere)
                    decision.SetWatch(level, entry, stop, tp1, tp2);
                if (armedHere)
                    decision.SetArmed(level, entry, stop, tp1, tp2);
                if (paperHere)
                    decision.SetPaper(level, entry, stop, tp1, tp2, freshLevelRetest, failedChaseBlock);
                if (invalidHere)
                    decision.InvalidatedSignal = true;
                if (blockedHere)
                {
                    decision.BlockedSignal = true;
                    if (string.IsNullOrEmpty(decision.BlockedReason))
                        decision.BlockedReason = BlockedReason(targetOk, notStuffed, closeCleared, closeLocation, upperWick, riskOk, riskPoints, failedChaseBlock);
                }
            }

            decision.WatchEvent = decision.WatchSignal && !previousWatchSignal;
            decision.ArmedEvent = decision.ArmedSignal && !previousArmedSignal;
            bool paperEdgeEvent = decision.PaperSignal && !previousPaperSignal;
            bool trackedCandidateBlocksSignal = trackedCandidateOpen && trackedCandidateStartBar < CurrentBar;
            bool paperRetestReentry = decision.PaperSignal
                && decision.PaperFreshRetest
                && !decision.PaperFailedChaseBlock
                && !trackedCandidateBlocksSignal
                && lastCandidateClosedBar >= 0
                && CurrentBar > lastCandidateClosedBar + ReEntryCooldownBars;
            bool paperEvent = paperEdgeEvent || paperRetestReentry;
            bool candidateLevelChanged = decision.PaperSignal
                && !decision.PaperFailedChaseBlock
                && !trackedCandidateBlocksSignal
                && IsFinite(decision.ActiveLevel)
                && IsFinite(previousActiveLevel)
                && Math.Abs(decision.ActiveLevel - previousActiveLevel) >= TickSize;
            bool longCandidate = decision.PaperSignal
                && !decision.PaperFailedChaseBlock
                && !trackedCandidateBlocksSignal
                && (paperEvent || candidateLevelChanged);
            bool ltfOk = ValidateLtf(decision);
            decision.LtfOk = ltfOk;
            decision.LtfFilteredEvent = longCandidate && !ltfOk;
            decision.LongEvent = longCandidate && ltfOk && !(pendingLong && pendingLongBar == CurrentBar);
            decision.CancelEvent = pendingLong && pendingLongBar == CurrentBar && !(longCandidate && ltfOk);
            decision.InvalidatedEvent = decision.InvalidatedSignal && !previousInvalidatedSignal;
            decision.BlockedEvent = decision.BlockedSignal && !previousBlockedSignal;
            return decision;
        }

        private void EmitDecisionEvents(ShadowDecision decision)
        {
            // Always update signal state so edge detection remains correct when Realtime starts.
            currentBarWatchSignal = decision.WatchSignal;
            currentBarArmedSignal = decision.ArmedSignal;
            currentBarPaperSignal = decision.PaperSignal;
            currentBarInvalidatedSignal = decision.InvalidatedSignal;
            currentBarBlockedSignal = decision.BlockedSignal;
            currentBarActiveLevel = IsFinite(decision.ActiveLevel) ? decision.ActiveLevel : double.NaN;

            if (State != State.Realtime)
                return;

            if (decision.WatchEvent)
            {
                watchId++;
                sessionWatches++;
                WriteTelemetry("WATCH", decision, string.Empty);
            }
            if (decision.ArmedEvent)
                WriteTelemetry("ARMED", decision, string.Empty);
            if (decision.BlockedEvent)
                WriteTelemetry("BLOCKED", decision, decision.BlockedReason);
            if (decision.InvalidatedEvent)
                WriteTelemetry("INVALIDATED", decision, string.Empty);
            if (decision.LtfFilteredEvent)
            {
                sessionLtfFiltered++;
                WriteTelemetry("LTF_FILTERED", decision, string.Empty);
            }

            if (decision.LongEvent && !double.IsNaN(decision.ActiveLevel))
            {
                candidateId++;
                sessionAttempts++;
                pendingLong = true;
                pendingLongBar = CurrentBar;
                pendingLongLevel = decision.ActiveLevel;
                pendingLongEntry = decision.ActiveEntry;
                pendingLongId = BuildSignalId(decision.ActiveEntry);
                StartTrackedCandidate(pendingLongId, decision);
                WriteTelemetry("LONG", decision, "id=" + pendingLongId);
                TrySubmitNativeLong(decision, pendingLongId);
            }
            else if (decision.CancelEvent)
            {
                double cancelPoints = (Close[0] - pendingLongEntry) * OpenContractCount(false);
                double cancelContracts = OpenContractCount(false);
                ApplySessionCancel(cancelPoints, cancelContracts);
                WriteTelemetry("CANCEL", decision, AccountingNote(pendingLongId, cancelPoints, cancelContracts, true));
                CancelNativeSignal(pendingLongId, decision);
                ClearTrackedCandidate();
                pendingLong = false;
                pendingLongBar = -1;
                pendingLongId = string.Empty;
                pendingLongLevel = double.NaN;
                pendingLongEntry = double.NaN;
            }

            if (IsFirstTickOfBar && pendingLong && pendingLongBar < CurrentBar)
            {
                pendingLong      = false;
                pendingLongBar   = -1;
                pendingLongId    = string.Empty;
                pendingLongLevel = double.NaN;
                pendingLongEntry = double.NaN;
                // Pending alert expires at bar close; tracked candidate continues to monitor TP/stop.
            }
        }

        private void StartTrackedCandidate(string signalId, ShadowDecision decision)
        {
            trackedCandidateOpen = true;
            trackedCandidateStartBar = CurrentBar;
            trackedCandidateId = signalId;
            trackedCandidateLevel = decision.ActiveLevel;
            trackedCandidateEntry = decision.ActiveEntry;
            trackedCandidateActiveStop = decision.ActiveStop;
            trackedCandidateTp1 = decision.ActiveTp1;
            trackedCandidateTp2 = decision.ActiveTp2;
            trackedCandidateTp1Hit = false;
            trackedCandidateSuccessCounted = false;
            trackedCandidateRealizedPoints = 0.0;
            trackedCandidateRealizedGrossDollars = 0.0;
            trackedCandidateRealizedCostDollars = 0.0;
            trackedCandidateRealizedNetDollars = 0.0;
        }

        private void TrackCandidateOutcome()
        {
            if (!trackedCandidateOpen || CurrentBar <= trackedCandidateStartBar)
                return;

            bool hitStop = Low[0] <= trackedCandidateActiveStop;
            bool hitTp1 = High[0] >= trackedCandidateTp1;
            bool hitTp2 = High[0] >= trackedCandidateTp2;
            ShadowDecision tracked = TrackedDecision();

            if (!trackedCandidateTp1Hit && hitStop && hitTp1)
            {
                double points = (trackedCandidateActiveStop - trackedCandidateEntry) * MixedTp1ContractCount();
                CloseTrackedCandidate("MIXED_STOP_FIRST", tracked, points, points < 0.0);
                return;
            }
            if (hitStop)
            {
                string outcome = trackedCandidateTp1Hit ? "TP1_THEN_STOP" : "STOP_FIRST";
                double points = (trackedCandidateActiveStop - trackedCandidateEntry) * OpenContractCount(trackedCandidateTp1Hit);
                CloseTrackedCandidate(outcome, tracked, points, !trackedCandidateTp1Hit && points < 0.0);
                return;
            }
            if (hitTp2)
            {
                double points = SplitTp1Tp2Runner && !trackedCandidateTp1Hit
                    ? (trackedCandidateTp1 - trackedCandidateEntry) + (trackedCandidateTp2 - trackedCandidateEntry)
                    : trackedCandidateTp2 - trackedCandidateEntry;
                CloseTrackedCandidate("TP2_FIRST", tracked, points, false);
                return;
            }
            if (hitTp1)
            {
                if (SplitTp1Tp2Runner)
                {
                    if (!trackedCandidateTp1Hit)
                    {
                        trackedCandidateTp1Hit = true;
                        double points = trackedCandidateTp1 - trackedCandidateEntry;
                        trackedCandidateRealizedPoints += points;
                        trackedCandidateRealizedGrossDollars += GrossDollars(points);
                        trackedCandidateRealizedCostDollars += EventCostDollars(1.0);
                        trackedCandidateRealizedNetDollars += EventNetDollars(points, 1.0);
                        ApplySessionPartialTp1(points, 1.0);
                        trackedCandidateActiveStop = trackedCandidateEntry;
                        WriteTelemetry("TP1", tracked, AccountingNote(trackedCandidateId, points, 1.0, false)
                            + " total_points=" + Format(trackedCandidateRealizedPoints)
                            + " total_net=" + Format(trackedCandidateRealizedNetDollars));
                    }
                }
                else
                {
                    CloseTrackedCandidate("TP1_FIRST", tracked, trackedCandidateTp1 - trackedCandidateEntry, false);
                }
            }
        }

        private ShadowDecision TrackedDecision()
        {
            return new ShadowDecision
            {
                LtfOk = true,
                ActiveLevel = trackedCandidateLevel,
                ActiveEntry = trackedCandidateEntry,
                ActiveStop = trackedCandidateActiveStop,
                ActiveTp1 = trackedCandidateTp1,
                ActiveTp2 = trackedCandidateTp2,
            };
        }

        private void CloseTrackedCandidate(string outcome, ShadowDecision decision, double points, bool failed)
        {
            double totalPoints = trackedCandidateRealizedPoints + points;
            double contracts = ContractsForOutcome(outcome);
            double eventGross = GrossDollars(points);
            double eventCost = EventCostDollars(contracts);
            double eventNet = eventGross - eventCost;
            double totalGross = trackedCandidateRealizedGrossDollars + eventGross;
            double totalCost = trackedCandidateRealizedCostDollars + eventCost;
            double totalNet = trackedCandidateRealizedNetDollars + eventNet;
            ApplySessionCloseOutcome(outcome, points, contracts);
            WriteTelemetry(outcome, decision, AccountingNote(trackedCandidateId, points, contracts, false)
                + " total_points=" + Format(totalPoints)
                + " total_gross=" + Format(totalGross)
                + " total_cost=" + Format(totalCost)
                + " total_net=" + Format(totalNet));
            lastCandidateClosedBar = CurrentBar;
            if (failed)
            {
                lastFailedCandidateLevel = trackedCandidateLevel;
                lastFailedCandidateBar = CurrentBar;
            }
            ClearTrackedCandidate();
        }

        private void ClearTrackedCandidate()
        {
            trackedCandidateOpen = false;
            trackedCandidateStartBar = -1;
            trackedCandidateId = string.Empty;
            trackedCandidateLevel = double.NaN;
            trackedCandidateEntry = double.NaN;
            trackedCandidateActiveStop = double.NaN;
            trackedCandidateTp1 = double.NaN;
            trackedCandidateTp2 = double.NaN;
            trackedCandidateTp1Hit = false;
            trackedCandidateSuccessCounted = false;
            trackedCandidateRealizedPoints = 0.0;
            trackedCandidateRealizedGrossDollars = 0.0;
            trackedCandidateRealizedCostDollars = 0.0;
            trackedCandidateRealizedNetDollars = 0.0;
        }

        private bool RecentLevelTap(double level)
        {
            int max = Math.Min(LevelTapLookbackBars, CurrentBar);
            for (int i = 0; i <= max; i++)
            {
                if (Low[i] <= level + LevelTapTolerancePoints && High[i] >= level - TickSize)
                    return true;
            }
            return false;
        }

        private bool ReclaimRecent(double level)
        {
            int barsSinceFlush = -1;
            int barsSinceReclaim = -1;
            int max = Math.Min(FlushLookbackBars, CurrentBar - 1);
            for (int i = 0; i <= max; i++)
            {
                bool pastFlush = Low[i] <= level - TickSize && Close[i + 1] >= level;
                bool pastReclaim = Close[i] > level && (Close[i + 1] <= level || Low[i] <= level - TickSize);
                if (barsSinceFlush == -1 && pastFlush)
                    barsSinceFlush = i;
                if (barsSinceReclaim == -1 && pastReclaim)
                    barsSinceReclaim = i;
            }
            bool flushBeforeReclaim = barsSinceFlush >= 0 && barsSinceReclaim >= 0
                && (barsSinceFlush > barsSinceReclaim || (barsSinceFlush == 0 && barsSinceReclaim == 0));
            return flushBeforeReclaim && barsSinceFlush <= FlushLookbackBars && barsSinceReclaim <= FlushLookbackBars;
        }

        private bool HoldAbove(double level)
        {
            int max = Math.Min(ReclaimHoldBars - 1, CurrentBar);
            for (int i = 0; i <= max; i++)
            {
                if (Close[i] < level)
                    return false;
            }
            return true;
        }

        private bool IsFailedLevelRecent(double level)
        {
            return !double.IsNaN(lastFailedCandidateLevel)
                && lastFailedCandidateBar >= 0
                && Math.Abs(level - lastFailedCandidateLevel) <= FailedReEntryLevelTolerancePoints
                && CurrentBar - lastFailedCandidateBar <= FailedReEntryCooldownBars;
        }

        private bool ValidateLtf(ShadowDecision decision)
        {
            if (LtfValidationMode == LukeNativeLtfValidationMode.Off || EntryPriceMode == LukeNativeEntryPriceMode.SignalClose)
                return true;
            bool one = ValidateSeriesTouch(1, decision.ActiveEntry, decision.ActiveStop, decision.ActiveTp1);
            bool three = ValidateSeriesTouch(2, decision.ActiveEntry, decision.ActiveStop, decision.ActiveTp1);
            bool five = ChartFiveMinuteOk(decision.ActiveEntry, decision.ActiveStop);
            switch (LtfValidationMode)
            {
                case LukeNativeLtfValidationMode.OneMinute: return one;
                case LukeNativeLtfValidationMode.ThreeMinute: return three;
                case LukeNativeLtfValidationMode.FiveMinuteChart: return five;
                case LukeNativeLtfValidationMode.EitherOneOrThree: return one || three;
                case LukeNativeLtfValidationMode.BothOneAndThree: return one && three;
                case LukeNativeLtfValidationMode.AnyOneThreeFive: return one || three || five;
                case LukeNativeLtfValidationMode.AllOneThreeFive: return one && three && five;
                default: return one;
            }
        }

        private bool ValidateSeriesTouch(int seriesIndex, double entry, double stop, double tp1)
        {
            if (seriesIndex >= BarsArray.Length || CurrentBars[seriesIndex] < 0)
                return false;
            DateTime barEnd = Time[0];
            DateTime barStart = barEnd.AddMinutes(-PrimaryBarMinutes());
            bool entrySeen = false;
            int max = Math.Min(CurrentBars[seriesIndex], 12);
            for (int i = max; i >= 0; i--)
            {
                DateTime lowerTime = Times[seriesIndex][i];
                if (lowerTime <= barStart || lowerTime > barEnd)
                    continue;
                double lo = Lows[seriesIndex][i];
                double hi = Highs[seriesIndex][i];
                bool touchesEntry = lo <= entry && hi >= entry;
                bool touchesStop = lo <= stop && hi >= stop;
                bool touchesTp1 = lo <= tp1 && hi >= tp1;
                if (!entrySeen && touchesEntry)
                {
                    entrySeen = true;
                    if (touchesStop)
                        return false;
                    if (touchesTp1)
                        return true;
                }
                else if (entrySeen)
                {
                    if (touchesStop)
                        return false;
                    if (touchesTp1)
                        return true;
                }
            }
            return entrySeen;
        }

        private double PrimaryBarMinutes()
        {
            if (BarsPeriod != null && BarsPeriod.BarsPeriodType == BarsPeriodType.Minute && BarsPeriod.Value > 0)
                return BarsPeriod.Value;
            return 5.0;
        }

        private DateTime PineBarTime()
        {
            return Time[0].AddMinutes(-PrimaryBarMinutes());
        }

        private bool ChartFiveMinuteOk(double entry, double stop)
        {
            bool entryTouched = Low[0] <= entry && High[0] >= entry;
            bool stopRisk = entryTouched && Low[0] <= stop && High[0] >= stop;
            return entryTouched && !stopRisk;
        }

        private PivotState BuildPivotState()
        {
            int barsAgo = 0;
            if (CurrentBar <= barsAgo)
                return new PivotState(false, double.NaN, false);
            double fast = EMA(PivotFastEma)[barsAgo];
            double pivot = EMA(PivotEma)[barsAgo];
            double slow = EMA(PivotSlowEma)[barsAgo];
            double fastConviction = EMA(PivotFastConvictionEma)[barsAgo];
            double slowConviction = EMA(PivotSlowConvictionEma)[barsAgo];
            double bias = EMA(PivotBiasEma)[barsAgo];
            bool dataReady = IsFinite(fast) && IsFinite(pivot) && IsFinite(slow) && IsFinite(fastConviction) && IsFinite(slowConviction);
            bool bullishConviction = fastConviction >= slowConviction;
            bool abovePivot = Close[0] >= pivot;
            bool aboveBias = Close[0] >= bias;
            bool fastCloudBullish = fast >= pivot;
            bool slowCloudBullish = pivot >= slow;
            double cloudTop = Math.Max(Math.Max(fast, pivot), slow);
            bool softReclaim = dataReady && (abovePivot || bullishConviction || Close[0] >= fast || Close[0] >= pivot - 1.0);
            bool longOk = PivotRibbonMode == LukeNativePivotRibbonMode.Off
                || (PivotRibbonMode == LukeNativePivotRibbonMode.SoftReclaim && softReclaim)
                || (PivotRibbonMode == LukeNativePivotRibbonMode.AbovePivot && dataReady && abovePivot && aboveBias)
                || (PivotRibbonMode == LukeNativePivotRibbonMode.FullBullish && dataReady && abovePivot && fastCloudBullish && slowCloudBullish && bullishConviction)
                || (PivotRibbonMode == LukeNativePivotRibbonMode.PivotOrConviction && dataReady && abovePivot && aboveBias && (fastCloudBullish || bullishConviction));
            bool cloudBreakNow = dataReady && Close[0] >= cloudTop && (Close[1] <= cloudTop || Low[0] <= cloudTop);
            return new PivotState(longOk, cloudTop, cloudBreakNow);
        }

        private double NextAbove(double level)
        {
            double next = double.NaN;
            foreach (LevelCluster cluster in clusters)
            {
                if (cluster.Anchor > level && (double.IsNaN(next) || cluster.Anchor < next))
                    next = cluster.Anchor;
            }
            return next;
        }

        private string BlockedReason(bool targetOk, bool notStuffed, bool closeCleared, double closeLocation, double upperWick, bool riskOk, double riskPoints, bool failedChaseBlock)
        {
            if (!targetOk) return "target room";
            if (!notStuffed)
            {
                if (!closeCleared) return "close not clear";
                if (closeLocation < MinReclaimCloseLocation) return "weak close";
                if (upperWick > MaxReclaimUpperWickPoints) return "upper wick";
                return "pivot ribbon";
            }
            if (!riskOk) return "risk " + Format(riskPoints);
            if (failedChaseBlock) return "failed cooldown";
            return "blocked";
        }

        private double OpenContractCount(bool tp1AlreadyHit)
        {
            return SplitTp1Tp2Runner && !tp1AlreadyHit ? 2.0 : 1.0;
        }

        private double MixedTp1ContractCount()
        {
            return SplitTp1Tp2Runner ? 2.0 : 1.0;
        }

        private double ContractsForOutcome(string outcome)
        {
            if (outcome == "MIXED_STOP_FIRST")
                return MixedTp1ContractCount();
            if (outcome == "TP1_THEN_STOP")
                return OpenContractCount(true);
            if (outcome == "TP2_FIRST")
                return OpenContractCount(trackedCandidateTp1Hit);
            if (outcome == "TP1_FIRST")
                return 1.0;
            return OpenContractCount(false);
        }

        private void ResetSessionLedger()
        {
            sessionAttempts = 0;
            sessionSuccesses = 0;
            sessionStopped = 0;
            sessionWatches = 0;
            sessionTp1Hits = 0;
            sessionTp2Hits = 0;
            sessionBreakevens = 0;
            sessionMixed = 0;
            sessionLtfFiltered = 0;
            sessionLiveCancelled = 0;
            sessionCancelRealizedPoints = 0.0;
            sessionCancelRealizedDollars = 0.0;
            sessionCancelCostDollars = 0.0;
            sessionCancelNetDollars = 0.0;
            sessionRealizedPoints = 0.0;
            sessionRealizedDollars = 0.0;
            sessionCostDollars = 0.0;
            sessionNetDollars = 0.0;
            ledgerOverlayRows.Clear();
        }

        private void ApplySessionCancel(double points, double contracts)
        {
            double gross = GrossDollars(points);
            double cost = EventCostDollars(contracts);
            double net = gross - cost;
            sessionLiveCancelled++;
            sessionCancelRealizedPoints += points;
            sessionCancelRealizedDollars += gross;
            sessionCancelCostDollars += cost;
            sessionCancelNetDollars += net;
        }

        private void ApplySessionPartialTp1(double points, double contracts)
        {
            double gross = GrossDollars(points);
            double cost = EventCostDollars(contracts);
            double net = gross - cost;
            sessionRealizedPoints += points;
            sessionRealizedDollars += gross;
            sessionCostDollars += cost;
            sessionNetDollars += net;
            if (!trackedCandidateSuccessCounted)
            {
                sessionSuccesses++;
                trackedCandidateSuccessCounted = true;
            }
            sessionTp1Hits++;
        }

        private void ApplySessionCloseOutcome(string outcome, double points, double contracts)
        {
            double gross = GrossDollars(points);
            double cost = EventCostDollars(contracts);
            double net = gross - cost;
            sessionRealizedPoints += points;
            sessionRealizedDollars += gross;
            sessionCostDollars += cost;
            sessionNetDollars += net;

            if (outcome == "MIXED_STOP_FIRST")
            {
                sessionMixed++;
                if (points > 0.0)
                {
                    CountSessionSuccess();
                    sessionTp1Hits++;
                }
                else if (points < 0.0)
                {
                    sessionStopped++;
                }
                return;
            }

            if (outcome == "STOP_FIRST")
            {
                sessionStopped++;
                return;
            }

            if (outcome == "TP1_THEN_STOP")
            {
                sessionBreakevens++;
                return;
            }

            if (outcome == "TP1_FIRST")
            {
                CountSessionSuccess();
                sessionTp1Hits++;
                return;
            }

            if (outcome == "TP2_FIRST")
            {
                CountSessionSuccess();
                sessionTp2Hits++;
            }
        }

        private void CountSessionSuccess()
        {
            if (trackedCandidateSuccessCounted)
                return;
            sessionSuccesses++;
            trackedCandidateSuccessCounted = true;
        }

        private bool NativeExecutionEnabled()
        {
            return AutonomyMode == LukeNativeAutonomyMode.SimExecution
                || AutonomyMode == LukeNativeAutonomyMode.LiveGuarded;
        }

        private void TrySubmitNativeLong(ShadowDecision decision, string signalId)
        {
            if (!NativeExecutionEnabled())
                return;

            string rejectReason;
            if (!CanSubmitNativeLong(decision, out rejectReason))
            {
                WriteTelemetry("ORDER_BLOCKED", decision, "id=" + signalId + " reason=" + rejectReason);
                return;
            }

            int qty = Math.Min(Math.Max(1, NativeQuantity), Math.Max(1, MaxQuantity));
            int qtyT1 = qty;
            int qtyT2 = 0;
            if (SplitTp1Tp2Runner && qty >= 2)
            {
                qtyT1 = Math.Max(1, qty / 2);
                qtyT2 = qty - qtyT1;
            }

            SetStopLoss(NativeEntryT1Name, CalculationMode.Price, decision.ActiveStop, false);
            SetProfitTarget(NativeEntryT1Name, CalculationMode.Price, decision.ActiveTp1);
            if (qtyT2 > 0)
            {
                SetStopLoss(NativeEntryT2Name, CalculationMode.Price, decision.ActiveStop, false);
                SetProfitTarget(NativeEntryT2Name, CalculationMode.Price, decision.ActiveTp2);
            }

            nativeActiveSignalId = signalId;
            nativeActiveEntry = decision.ActiveEntry;
            nativeActiveTp1 = decision.ActiveTp1;
            nativeRunnerQuantity = qtyT2;
            nativeSubmittedUtc = DateTime.UtcNow;
            nativeRunnerStopMovedToBreakEven = false;

            nativeEntryOrderT1 = EnterLongLimit(qtyT1, decision.ActiveEntry, NativeEntryT1Name);
            if (qtyT2 > 0)
                nativeEntryOrderT2 = EnterLongLimit(qtyT2, decision.ActiveEntry, NativeEntryT2Name);

            WriteTelemetry("ORDER_SUBMITTED", decision, "id=" + signalId
                + " qty=" + qty.ToString(CultureInfo.InvariantCulture)
                + " t1=" + qtyT1.ToString(CultureInfo.InvariantCulture)
                + " t2=" + qtyT2.ToString(CultureInfo.InvariantCulture)
                + " account=" + GetCurrentAccountName()
                + " mode=" + AutonomyMode);
        }

        private bool CanSubmitNativeLong(ShadowDecision decision, out string rejectReason)
        {
            rejectReason = string.Empty;

            if (State != State.Realtime)
            {
                rejectReason = "not realtime";
                return false;
            }

            if (!IsAccountAllowed())
            {
                rejectReason = "account guard rejected " + GetCurrentAccountName() + "; allowed " + AccountGuardDescription();
                return false;
            }

            if (RequireFlatPosition && Position.MarketPosition != MarketPosition.Flat)
            {
                rejectReason = "position is not flat";
                return false;
            }

            if (HasActiveNativeEntryOrders())
            {
                rejectReason = "active entry order exists";
                return false;
            }

            if (!IsNativeLongPriceContextAllowed(decision, out rejectReason))
                return false;

            return true;
        }

        private bool IsNativeLongPriceContextAllowed(ShadowDecision decision, out string rejectReason)
        {
            rejectReason = string.Empty;
            double lastPrice = Close[0];
            double tick = TickSize > 0 ? TickSize : 0.25;

            if (!IsFinite(decision.ActiveEntry) || !IsFinite(decision.ActiveStop) || !IsFinite(decision.ActiveTp1) || !IsFinite(decision.ActiveTp2))
            {
                rejectReason = "invalid order geometry";
                return false;
            }

            if (decision.ActiveStop >= decision.ActiveEntry)
            {
                rejectReason = FormatPriceReject("stop is not below entry", decision, lastPrice);
                return false;
            }

            if (decision.ActiveTp1 <= decision.ActiveEntry || decision.ActiveTp2 <= decision.ActiveEntry)
            {
                rejectReason = FormatPriceReject("target is not above entry", decision, lastPrice);
                return false;
            }

            if (decision.ActiveStop >= lastPrice - tick)
            {
                rejectReason = FormatPriceReject("stop is not below current market", decision, lastPrice);
                return false;
            }

            if (Math.Abs(decision.ActiveEntry - lastPrice) > MaxMarketableEntryPoints)
            {
                rejectReason = FormatPriceReject("entry is outside current market wiggle", decision, lastPrice);
                return false;
            }

            return true;
        }

        private string FormatPriceReject(string reason, ShadowDecision decision, double lastPrice)
        {
            return string.Format(CultureInfo.InvariantCulture,
                "{0}: last={1:F2} entry={2:F2} stop={3:F2} tp1={4:F2} tp2={5:F2} maxWiggle={6:F2}",
                reason, lastPrice, decision.ActiveEntry, decision.ActiveStop, decision.ActiveTp1, decision.ActiveTp2, MaxMarketableEntryPoints);
        }

        private void CancelNativeSignal(string signalId, ShadowDecision decision)
        {
            if (!NativeExecutionEnabled())
                return;

            bool hadActiveEntries = HasActiveNativeEntryOrders();
            bool hadOpenLong = Position.MarketPosition == MarketPosition.Long;

            if (IsActive(nativeEntryOrderT1))
                CancelOrder(nativeEntryOrderT1);
            if (IsActive(nativeEntryOrderT2))
                CancelOrder(nativeEntryOrderT2);
            if (hadOpenLong)
                ExitLong();

            WriteTelemetry("ORDER_CANCELLED", decision, "id=" + signalId
                + " had_entries=" + hadActiveEntries
                + " had_long=" + hadOpenLong);

            if (!hadOpenLong)
                ResetNativeExecutionState();
        }

        private void CancelExpiredNativeOrders()
        {
            if (!NativeExecutionEnabled() || nativeSubmittedUtc == DateTime.MinValue)
                return;

            int expirySeconds = Math.Max(1, LimitOrderExpirySeconds);
            if ((DateTime.UtcNow - nativeSubmittedUtc).TotalSeconds < expirySeconds)
                return;

            bool hadActiveEntries = HasActiveNativeEntryOrders();
            if (IsActive(nativeEntryOrderT1))
                CancelOrder(nativeEntryOrderT1);
            if (IsActive(nativeEntryOrderT2))
                CancelOrder(nativeEntryOrderT2);

            WriteTelemetry("ORDER_EXPIRED", null, "id=" + nativeActiveSignalId
                + " expiry_seconds=" + expirySeconds.ToString(CultureInfo.InvariantCulture)
                + " had_entries=" + hadActiveEntries);

            if (Position.MarketPosition == MarketPosition.Flat)
                ResetNativeExecutionState();
        }

        private void MoveNativeRunnerStopToBreakEvenIfNeeded()
        {
            if (!NativeExecutionEnabled() || nativeRunnerQuantity <= 0 || nativeRunnerStopMovedToBreakEven)
                return;
            if (Position.MarketPosition != MarketPosition.Long)
                return;
            if (!IsFinite(nativeActiveEntry) || !IsFinite(nativeActiveTp1) || High[0] < nativeActiveTp1)
                return;

            SetStopLoss(NativeEntryT2Name, CalculationMode.Price, nativeActiveEntry, false);
            nativeRunnerStopMovedToBreakEven = true;
            WriteTelemetry("RUNNER_STOP_BREAKEVEN", null, "id=" + nativeActiveSignalId
                + " entry=" + Format(nativeActiveEntry)
                + " tp1=" + Format(nativeActiveTp1));
        }

        private void ResetNativeExecutionStateIfFlat()
        {
            if (Position.MarketPosition != MarketPosition.Flat || HasActiveNativeEntryOrders())
                return;
            ResetNativeExecutionState();
        }

        private void ResetNativeExecutionState()
        {
            nativeEntryOrderT1 = null;
            nativeEntryOrderT2 = null;
            nativeActiveSignalId = string.Empty;
            nativeActiveEntry = double.NaN;
            nativeActiveTp1 = double.NaN;
            nativeRunnerQuantity = 0;
            nativeSubmittedUtc = DateTime.MinValue;
            nativeRunnerStopMovedToBreakEven = false;
        }

        private bool IsAccountAllowed()
        {
            string accountName = GetCurrentAccountName();
            string allowedAccount = string.IsNullOrWhiteSpace(AllowedAccountName) ? string.Empty : AllowedAccountName.Trim();

            if (AutonomyMode == LukeNativeAutonomyMode.SimExecution)
            {
                return accountName.StartsWith("Sim", StringComparison.OrdinalIgnoreCase)
                    || accountName.StartsWith("Playback", StringComparison.OrdinalIgnoreCase);
            }

            if (AutonomyMode == LukeNativeAutonomyMode.LiveGuarded)
            {
                return AllowLiveAccounts
                    && !string.IsNullOrEmpty(allowedAccount)
                    && string.Equals(accountName, allowedAccount, StringComparison.OrdinalIgnoreCase);
            }

            return false;
        }

        private string GetCurrentAccountName()
        {
            return Account == null ? string.Empty : (Account.Name ?? string.Empty).Trim();
        }

        private string AccountGuardDescription()
        {
            string allowedAccount = string.IsNullOrWhiteSpace(AllowedAccountName) ? string.Empty : AllowedAccountName.Trim();
            if (AutonomyMode == LukeNativeAutonomyMode.SimExecution)
                return "Sim*/Playback* only";
            if (AutonomyMode == LukeNativeAutonomyMode.LiveGuarded)
                return AllowLiveAccounts && !string.IsNullOrEmpty(allowedAccount)
                    ? "exact " + allowedAccount
                    : "live disabled until AllowLiveAccounts=true and exact account is set";
            return "shadow/no orders";
        }

        private bool HasActiveNativeEntryOrders()
        {
            return IsActive(nativeEntryOrderT1) || IsActive(nativeEntryOrderT2);
        }

        private static bool IsActive(Order order)
        {
            if (order == null)
                return false;
            return order.OrderState == OrderState.Accepted
                || order.OrderState == OrderState.Submitted
                || order.OrderState == OrderState.Working
                || order.OrderState == OrderState.PartFilled;
        }

        private double GrossDollars(double points)
        {
            return points * PnlDollarsPerPoint;
        }

        private double EventCostDollars(double contracts)
        {
            double roundTripSlippage = EntrySlippagePoints + ExitSlippagePoints;
            return ((roundTripSlippage * PnlDollarsPerPoint) + CommissionPerContractRoundTrip) * contracts;
        }

        private double EventNetDollars(double points, double contracts)
        {
            return GrossDollars(points) - EventCostDollars(contracts);
        }

        private string AccountingNote(string signalId, double points, double contracts, bool includeTotals)
        {
            double gross = GrossDollars(points);
            double cost = EventCostDollars(contracts);
            double net = gross - cost;
            string note = "id=" + signalId
                + " points=" + Format(points)
                + " contracts=" + Format(contracts)
                + " gross=" + Format(gross)
                + " cost=" + Format(cost)
                + " net=" + Format(net);
            if (includeTotals)
                note += " total_points=" + Format(points) + " total_gross=" + Format(gross) + " total_cost=" + Format(cost) + " total_net=" + Format(net);
            return note;
        }

        private void InsertSorted(List<double> values, double price)
        {
            int index = values.BinarySearch(price);
            if (index < 0)
                index = ~index;
            values.Insert(index, price);
        }

        private void InsertSorted(List<LevelInput> values, LevelInput level)
        {
            int index = values.BinarySearch(level, LevelInputComparer.Instance);
            if (index < 0)
                index = ~index;
            values.Insert(index, level);
        }

        private double RoundPrice(double value)
        {
            return Math.Round(value * 100.0, MidpointRounding.AwayFromZero) / 100.0;
        }

        private double RoundToTick(double value)
        {
            double tick = TickSize > 0 ? TickSize : 0.25;
            return Math.Round(value / tick, MidpointRounding.AwayFromZero) * tick;
        }

        private string BuildSignalId(double entry)
        {
            return "ninja-native-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture)
                + "-" + candidateId.ToString(CultureInfo.InvariantCulture)
                + "-" + Format(entry);
        }

        private void WriteTelemetry(string eventType, ShadowDecision decision, string note)
        {
            if (string.IsNullOrWhiteSpace(TelemetryFilePath))
                return;
            try
            {
                string directory = Path.GetDirectoryName(TelemetryFilePath);
                if (!string.IsNullOrWhiteSpace(directory))
                    Directory.CreateDirectory(directory);
                bool hasBar = CurrentBar >= 0;
                double price = hasBar ? Close[0] : double.NaN;
                string barTime = hasBar ? PineBarTime().ToString("O", CultureInfo.InvariantCulture) : string.Empty;
                string signalId = ExtractNoteValue(note ?? string.Empty, "id");
                string line = "{"
                    + "\"ts\":\"" + DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture) + "\","
                    + "\"source\":\"ninja-native-shadow\","
                    + "\"event\":\"" + Escape(eventType) + "\","
                    + "\"signal_id\":\"" + Escape(signalId) + "\","
                    + "\"instrument\":\"" + Escape(Instrument == null ? "" : Instrument.FullName) + "\","
                    + "\"bar\":" + CurrentBar.ToString(CultureInfo.InvariantCulture) + ","
                    + "\"bar_time\":\"" + Escape(barTime) + "\","
                    + "\"price\":" + FormatNullable(price) + ","
                    + "\"level\":" + FormatNullable(decision == null ? double.NaN : decision.ActiveLevel) + ","
                    + "\"entry\":" + FormatNullable(decision == null ? double.NaN : decision.ActiveEntry) + ","
                    + "\"stop\":" + FormatNullable(decision == null ? double.NaN : decision.ActiveStop) + ","
                    + "\"tp1\":" + FormatNullable(decision == null ? double.NaN : decision.ActiveTp1) + ","
                    + "\"tp2\":" + FormatNullable(decision == null ? double.NaN : decision.ActiveTp2) + ","
                    + "\"ltf_ok\":" + ((decision != null && decision.LtfOk) ? "true" : "false") + ","
                    + "\"note\":\"" + Escape(note ?? string.Empty) + "\""
                    + "}";
                File.AppendAllText(TelemetryFilePath, line + Environment.NewLine);
                RecordLedgerOverlayRow(eventType, decision, note ?? string.Empty);
            }
            catch (Exception ex)
            {
                Print("LukeNativeShadow telemetry failed: " + ex.Message);
            }
        }

        private void WriteCancelTelemetry(string signalId, double entry, double level, string noteSuffix)
        {
            if (string.IsNullOrWhiteSpace(TelemetryFilePath))
                return;
            try
            {
                string directory = Path.GetDirectoryName(TelemetryFilePath);
                if (!string.IsNullOrWhiteSpace(directory))
                    Directory.CreateDirectory(directory);
                bool hasBar = CurrentBar >= 0;
                string barTime = hasBar
                    ? PineBarTime().ToString("O", CultureInfo.InvariantCulture)
                    : string.Empty;
                string note = "id=" + signalId + " " + noteSuffix;
                string line = "{"
                    + "\"ts\":\""        + DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture) + "\","
                    + "\"source\":\"ninja-native-shadow\","
                    + "\"event\":\"CANCEL\","
                    + "\"signal_id\":\"" + Escape(signalId) + "\","
                    + "\"instrument\":\"" + Escape(Instrument == null ? "" : Instrument.FullName) + "\","
                    + "\"bar\":"         + CurrentBar.ToString(CultureInfo.InvariantCulture) + ","
                    + "\"bar_time\":\""  + Escape(barTime) + "\","
                    + "\"price\":"       + FormatNullable(hasBar ? Open[0] : double.NaN) + ","
                    + "\"level\":"       + FormatNullable(level) + ","
                    + "\"entry\":"       + FormatNullable(entry) + ","
                    + "\"stop\":null,\"tp1\":null,\"tp2\":null,"
                    + "\"ltf_ok\":false,"
                    + "\"note\":\""      + Escape(note) + "\""
                    + "}";
                File.AppendAllText(TelemetryFilePath, line + Environment.NewLine);
                // RecordLedgerOverlayRow intentionally skipped - null decision safety; overlay reads file on next tick
            }
            catch (Exception ex)
            {
                Print("LukeNativeShadow cancel-telemetry failed: " + ex.Message);
            }
        }

        private void RecordLedgerOverlayRow(string eventType, ShadowDecision decision, string note)
        {
            if (!ShowParityLedgerOverlay || !IsLedgerOverlayEvent(eventType))
                return;

            string row = FormatLedgerOverlayRow(eventType, decision, note);
            ledgerOverlayRows.Add(row);
            int maxRows = Math.Max(3, LedgerOverlayRows);
            while (ledgerOverlayRows.Count > maxRows)
                ledgerOverlayRows.RemoveAt(0);

            DrawLedgerOverlay();
        }

        private bool IsLedgerOverlayEvent(string eventType)
        {
            string type = (eventType ?? string.Empty).ToUpperInvariant();
            return type == "ENGINE_READY"
                || type == "LEVELS_LOADED"
                || type == "WATCH"
                || type == "ARMED"
                || type == "BLOCKED"
                || type == "LONG"
                || type == "CANCEL"
                || type == "ORDER_BLOCKED"
                || type == "ORDER_SUBMITTED"
                || type == "ORDER_CANCELLED"
                || type == "ORDER_EXPIRED"
                || type == "TP1"
                || type == "TP1_FIRST"
                || type == "TP2_FIRST"
                || type == "TP1_THEN_STOP"
                || type == "STOP_FIRST"
                || type == "MIXED_STOP_FIRST";
        }

        private string FormatLedgerOverlayRow(string eventType, ShadowDecision decision, string note)
        {
            string clock = DateTime.Now.ToString("HH:mm:ss", CultureInfo.InvariantCulture);
            string entry = decision == null || !IsFinite(decision.ActiveEntry) ? "--" : Format(decision.ActiveEntry);
            string level = decision == null || !IsFinite(decision.ActiveLevel) ? "--" : Format(decision.ActiveLevel);
            string net = ExtractNoteValue(note ?? string.Empty, "net");
            string suffix = string.IsNullOrWhiteSpace(net) ? string.Empty : " net " + net;
            return clock + " " + (eventType ?? string.Empty).ToUpperInvariant()
                + " L " + level
                + " E " + entry
                + suffix;
        }

        private void DrawLedgerOverlay()
        {
            if (!ShowParityLedgerOverlay || ChartControl == null)
                return;

            RefreshLedgerCountsIfNeeded();
            int totalSignalAttempts = sessionAttempts + sessionLiveCancelled;
            int totalSignalMisses = sessionStopped + sessionLiveCancelled;
            double totalRealizedPoints = sessionRealizedPoints + sessionCancelRealizedPoints;
            double totalRealizedDollars = sessionRealizedDollars + sessionCancelRealizedDollars;
            double totalSessionNetDollars = sessionNetDollars + sessionCancelNetDollars;
            double sessionCommissionDollars = SessionCommissionDollars();
            double sessionSlippageDollars = SessionSlippageDollars();
            double sessionAfterCommissions = totalRealizedDollars - sessionCommissionDollars;
            double scorePct = totalSignalAttempts > 0 ? (sessionSuccesses * 100.0) / totalSignalAttempts : double.NaN;

            string text = "LUKE NATIVE SESSION LEDGER"
                + Environment.NewLine
                + "score incl cxl     " + sessionSuccesses.ToString(CultureInfo.InvariantCulture) + "/" + totalSignalAttempts.ToString(CultureInfo.InvariantCulture) + "  " + FormatPercent(scorePct)
                + Environment.NewLine
                + "watch/long/cxl     W " + sessionWatches.ToString(CultureInfo.InvariantCulture) + " / L " + sessionAttempts.ToString(CultureInfo.InvariantCulture) + " / C " + sessionLiveCancelled.ToString(CultureInfo.InvariantCulture)
                + Environment.NewLine
                + "misses incl cxl    " + totalSignalMisses.ToString(CultureInfo.InvariantCulture) + " = S " + sessionStopped.ToString(CultureInfo.InvariantCulture) + " + C " + sessionLiveCancelled.ToString(CultureInfo.InvariantCulture)
                + Environment.NewLine
                + "milestones         T1 " + sessionTp1Hits.ToString(CultureInfo.InvariantCulture) + " / T2 " + sessionTp2Hits.ToString(CultureInfo.InvariantCulture) + " / BE " + sessionBreakevens.ToString(CultureInfo.InvariantCulture) + " / M " + sessionMixed.ToString(CultureInfo.InvariantCulture)
                + Environment.NewLine
                + "gross total        " + SignedPoints(totalRealizedPoints) + "  " + Money(totalRealizedDollars)
                + Environment.NewLine
                + "minus comm         " + Money(sessionAfterCommissions)
                + Environment.NewLine
                + "realistic net      " + Money(totalSessionNetDollars)
                + Environment.NewLine
                + "cxl net            " + SignedPoints(sessionCancelRealizedPoints) + "  " + Money(sessionCancelNetDollars)
                + Environment.NewLine
                + "mode/costs         entry_only_0_25 | comm " + Money(sessionCommissionDollars) + " / slip " + Money(sessionSlippageDollars)
                + Environment.NewLine
                + "Native today L/C   " + nativeLongsToday.ToString(CultureInfo.InvariantCulture) + "/" + nativeCancelsToday.ToString(CultureInfo.InvariantCulture)
                + " | Pine bridge today L/C " + pineBridgeLongsToday.ToString(CultureInfo.InvariantCulture) + "/" + pineBridgeCancelsToday.ToString(CultureInfo.InvariantCulture)
                + Environment.NewLine
                + "Mode " + AutonomyMode + " | Guard " + AccountGuardDescription();

            if (ledgerOverlayRows.Count > 0)
                text += Environment.NewLine + string.Join(Environment.NewLine, ledgerOverlayRows);

            Draw.TextFixed(this, "LukeNativeParityLedger", text, TextPosition.TopRight);
        }

        private double SessionTotalCostDollars()
        {
            return sessionCostDollars + sessionCancelCostDollars;
        }

        private double SessionCommissionDollars()
        {
            double costPerContract = ((EntrySlippagePoints + ExitSlippagePoints) * PnlDollarsPerPoint) + CommissionPerContractRoundTrip;
            return costPerContract > 0.0 ? SessionTotalCostDollars() * CommissionPerContractRoundTrip / costPerContract : 0.0;
        }

        private double SessionSlippageDollars()
        {
            return SessionTotalCostDollars() - SessionCommissionDollars();
        }

        private string Money(double value)
        {
            return (value < 0.0 ? "-$" : "$") + Math.Abs(value).ToString("0.00", CultureInfo.InvariantCulture);
        }

        private string SignedPoints(double value)
        {
            return (value > 0.0 ? "+" : "") + Format(value) + " pts";
        }

        private string FormatPercent(double value)
        {
            return IsFinite(value) ? value.ToString("0.0", CultureInfo.InvariantCulture) + "%" : "n/a";
        }

        private void RefreshLedgerCountsIfNeeded()
        {
            if ((DateTime.UtcNow - lastLedgerCountRefreshUtc).TotalSeconds < 2.0)
                return;
            lastLedgerCountRefreshUtc = DateTime.UtcNow;
            CountTodayTelemetry(TelemetryFilePath, "\"event\":\"LONG\"", "\"event\":\"CANCEL\"", out nativeLongsToday, out nativeCancelsToday);
            CountTodayTelemetry(PineBridgeEventsPath, "\"type\":\"luke_long_signal_saved\"", "\"type\":\"luke_cancel_signal_saved\"", out pineBridgeLongsToday, out pineBridgeCancelsToday);
        }

        private void CountTodayTelemetry(string filePath, string longMarker, string cancelMarker, out int longs, out int cancels)
        {
            longs = 0;
            cancels = 0;
            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                return;

            DateTime today = EasternDate(DateTime.UtcNow);
            try
            {
                foreach (string line in File.ReadLines(filePath))
                {
                    string ts = ExtractJsonString(line, "ts");
                    if (string.IsNullOrWhiteSpace(ts))
                        ts = ExtractJsonString(line, "received_at");
                    DateTime parsed;
                    if (!DateTime.TryParse(ts, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out parsed))
                        continue;
                    if (EasternDate(parsed) != today)
                        continue;
                    if (line.IndexOf(longMarker, StringComparison.OrdinalIgnoreCase) >= 0)
                        longs++;
                    if (line.IndexOf(cancelMarker, StringComparison.OrdinalIgnoreCase) >= 0)
                        cancels++;
                }
            }
            catch
            {
            }
        }

        private static string ExtractJsonString(string line, string key)
        {
            Match match = Regex.Match(line ?? string.Empty, "\"" + Regex.Escape(key) + "\"\\s*:\\s*\"([^\"]*)\"");
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        private static DateTime EasternDate(DateTime value)
        {
            try
            {
                TimeZoneInfo eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
                DateTime utc = value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime();
                return TimeZoneInfo.ConvertTimeFromUtc(utc, eastern).Date;
            }
            catch
            {
                return value.ToLocalTime().Date;
            }
        }

        private static string ExtractNoteValue(string note, string key)
        {
            string marker = key + "=";
            int start = note.IndexOf(marker, StringComparison.Ordinal);
            if (start < 0)
                return string.Empty;
            start += marker.Length;
            int end = note.IndexOf(" ", start, StringComparison.Ordinal);
            if (end < 0)
                end = note.Length;
            return note.Substring(start, end - start);
        }

        private string Format(double value)
        {
            return value.ToString("0.00", CultureInfo.InvariantCulture);
        }

        private string FormatNullable(double value)
        {
            return IsFinite(value) ? Format(value) : "null";
        }

        private static bool IsFinite(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }

        private static string Escape(string value)
        {
            return (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "'");
        }

        private class LevelInput
        {
            public LevelInput(double price, string source)
            {
                Price = price;
                Source = string.IsNullOrWhiteSpace(source) ? "unknown" : source;
            }

            public double Price;
            public string Source;
        }

        private class LevelInputComparer : IComparer<LevelInput>
        {
            public static readonly LevelInputComparer Instance = new LevelInputComparer();

            public int Compare(LevelInput x, LevelInput y)
            {
                if (x == null && y == null) return 0;
                if (x == null) return -1;
                if (y == null) return 1;
                int price = x.Price.CompareTo(y.Price);
                if (price != 0) return price;
                return string.Compare(x.Source, y.Source, StringComparison.Ordinal);
            }
        }

        private class LevelCluster
        {
            public LevelCluster(double price, string source)
            {
                Anchor = price;
                Min = price;
                Max = price;
                Strength = 1;
                Sources = string.IsNullOrWhiteSpace(source) ? "unknown" : source;
            }

            public double Anchor;
            public double Min;
            public double Max;
            public int Strength;
            public string Sources;

            public bool HasSource(string source)
            {
                return Sources.IndexOf(source ?? string.Empty, StringComparison.Ordinal) >= 0;
            }

            public void AddSource(string source)
            {
                if (string.IsNullOrWhiteSpace(source) || HasSource(source))
                    return;
                Sources = Sources + "+" + source;
            }
        }

        private class PivotState
        {
            public PivotState(bool longOk, double cloudTop, bool cloudBreakNow)
            {
                LongOk = longOk;
                CloudTop = cloudTop;
                CloudBreakNow = cloudBreakNow;
            }

            public bool LongOk;
            public double CloudTop;
            public bool CloudBreakNow;
        }

        private class ShadowDecision
        {
            public bool WatchSignal;
            public bool ArmedSignal;
            public bool PaperSignal;
            public bool InvalidatedSignal;
            public bool BlockedSignal;
            public bool WatchEvent;
            public bool ArmedEvent;
            public bool InvalidatedEvent;
            public bool BlockedEvent;
            public bool LtfFilteredEvent;
            public bool LongEvent;
            public bool CancelEvent;
            public bool LtfOk;
            public bool PaperFreshRetest;
            public bool PaperFailedChaseBlock;
            public string BlockedReason = string.Empty;
            public double ActiveLevel = double.NaN;
            public double ActiveEntry = double.NaN;
            public double ActiveStop = double.NaN;
            public double ActiveTp1 = double.NaN;
            public double ActiveTp2 = double.NaN;
            private int ActivePriority;

            public void SetWatch(double level, double entry, double stop, double tp1, double tp2)
            {
                WatchSignal = true;
                SelectByPriority(1, level, entry, stop, tp1, tp2);
            }

            public void SetArmed(double level, double entry, double stop, double tp1, double tp2)
            {
                ArmedSignal = true;
                SelectByPriority(2, level, entry, stop, tp1, tp2);
            }

            public void SetPaper(double level, double entry, double stop, double tp1, double tp2, bool freshRetest, bool failedChaseBlock)
            {
                PaperSignal = true;
                PaperFreshRetest = freshRetest;
                PaperFailedChaseBlock = failedChaseBlock;
                SelectByPriority(3, level, entry, stop, tp1, tp2);
            }

            private void SelectByPriority(int priority, double level, double entry, double stop, double tp1, double tp2)
            {
                if (priority < ActivePriority)
                    return;
                if (priority == ActivePriority && !double.IsNaN(ActiveLevel) && level <= ActiveLevel)
                    return;
                ActivePriority = priority;
                ActiveLevel = level;
                ActiveEntry = entry;
                ActiveStop = stop;
                ActiveTp1 = tp1;
                ActiveTp2 = tp2;
            }
        }
    }
}
