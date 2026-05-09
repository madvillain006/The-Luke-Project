#region Using declarations
using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Media;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public enum LukeBridgeExecutionMode
    {
        MarketOnAlert,
        LimitAtLukeEntry
    }

    public class LukeAlertBridgeStrategy : Strategy
    {
        private const string EntryT1Name = "LukeLongT1";
        private const string EntryT2Name = "LukeLongT2";
        private const string LiveBridgeArmPhrase = "LUKE_BRIDGE_LIVE_ACK";

        private string lastProcessedId = string.Empty;
        private string lastRejectedId = string.Empty;
        private string lastCancelledId = string.Empty;
        private string lastFileContent = string.Empty;
        private DateTime lastFileWriteUtc = DateTime.MinValue;
        private DateTime submittedUtc = DateTime.MinValue;
        private Order entryOrderT1;
        private Order entryOrderT2;
        private int signalsSubmittedThisSession;
        private LukeSignal activeSignal;
        private int activeRunnerQuantity;
        private int activeLimitOrderExpirySeconds;
        private bool runnerStopMovedToBreakEven;
        private System.Timers.Timer bridgePollTimer;

        [NinjaScriptProperty]
        [Display(Name = "Bridge file path", GroupName = "Luke Bridge", Order = 1)]
        public string BridgeFilePath { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Execution mode", GroupName = "Luke Bridge", Order = 2)]
        public LukeBridgeExecutionMode ExecutionMode { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Max signal age seconds", GroupName = "Luke Bridge", Order = 3)]
        public int MaxSignalAgeSeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Limit expiry seconds", GroupName = "Luke Bridge", Order = 4)]
        public int LimitOrderExpirySeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Use payload quantity", GroupName = "Luke Bridge", Order = 5)]
        public bool UsePayloadQuantity { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Default quantity", GroupName = "Luke Bridge", Order = 6)]
        public int BridgeDefaultQuantity { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Split TP1/TP2 runner", GroupName = "Luke Bridge", Order = 7)]
        public bool SplitTp1Tp2Runner { get; set; }

        [NinjaScriptProperty]
        [Range(25, 2000)]
        [Display(Name = "Bridge poll milliseconds", GroupName = "Luke Bridge", Order = 8)]
        public int BridgePollMilliseconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require flat position", GroupName = "Luke Safety", Order = 1)]
        public bool RequireFlatPosition { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Allow live accounts", GroupName = "Luke Safety", Order = 2)]
        public bool AllowLiveAccounts { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Allowed exact account", GroupName = "Luke Safety", Order = 3)]
        public string AllowedAccountName { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "Max quantity", GroupName = "Luke Safety", Order = 4)]
        public int MaxQuantity { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Live bridge arm phrase", GroupName = "Luke Safety", Order = 5)]
        public string LiveBridgeArmCode { get; set; }

        [NinjaScriptProperty]
        [Range(0, 50)]
        [Display(Name = "Max signals per session", GroupName = "Luke Safety", Order = 6)]
        public int MaxSignalsPerSession { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require symbol prefix match", GroupName = "Luke Safety", Order = 7)]
        public bool RequireSymbolPrefixMatch { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Max marketable entry points", GroupName = "Luke Safety", Order = 8)]
        public double MaxMarketableEntryPoints { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require cancel matches active signal", GroupName = "Luke Safety", Order = 9)]
        public bool RequireCancelMatchesActiveSignal { get; set; }

        [NinjaScriptProperty]
        [Range(1, 7200)]
        [Display(Name = "Scalp limit expiry seconds", GroupName = "Luke Order Profiles", Order = 1)]
        public int ScalpLimitOrderExpirySeconds { get; set; }

        [NinjaScriptProperty]
        [Range(1, 7200)]
        [Display(Name = "Mancini reclaim limit expiry seconds", GroupName = "Luke Order Profiles", Order = 2)]
        public int ManciniReclaimLimitOrderExpirySeconds { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "LukeAlertBridgeStrategy";
                Description = "SIM-first bridge: polls Luke's latest LONG alert JSON and submits NinjaTrader simulated orders. Defaults block live accounts.";
                Calculate = Calculate.OnEachTick;
                EntriesPerDirection = 2;
                EntryHandling = EntryHandling.UniqueEntries;
                IsExitOnSessionCloseStrategy = true;
                ExitOnSessionCloseSeconds = 30;
                IsInstantiatedOnEachOptimizationIteration = false;

                BridgeFilePath = @"C:\Users\conor\luke\data\ninjatrader\latest-luke-signal.json";
                ExecutionMode = LukeBridgeExecutionMode.LimitAtLukeEntry;
                MaxSignalAgeSeconds = 20;
                LimitOrderExpirySeconds = 600;
                UsePayloadQuantity = true;
                BridgeDefaultQuantity = 1;
                SplitTp1Tp2Runner = true;
                BridgePollMilliseconds = 50;
                RequireFlatPosition = true;
                AllowLiveAccounts = false;
                AllowedAccountName = "LFE050706094670001";
                MaxQuantity = 2;
                LiveBridgeArmCode = "";
                MaxSignalsPerSession = 20;
                RequireSymbolPrefixMatch = true;
                MaxMarketableEntryPoints = 0.25;
                RequireCancelMatchesActiveSignal = true;
                ScalpLimitOrderExpirySeconds = 600;
                ManciniReclaimLimitOrderExpirySeconds = 600;
            }
            else if (State == State.Realtime)
            {
                StartBridgePollTimer();
                BridgeInfo("LukeAlertBridgeStrategy realtime. Account guard: " + AccountGuardDescription() + ". Account: " + GetCurrentAccountName() + ". Polling: " + BridgeFilePath);
            }
            else if (State == State.Terminated)
            {
                StopBridgePollTimer();
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0 || CurrentBar < 1)
                return;

            if (State != State.Realtime)
                return;

            if (Bars.IsFirstBarOfSession && IsFirstTickOfBar)
                signalsSubmittedThisSession = 0;

            ProcessBridgeCycle();
        }

        private void ProcessBridgeCycle()
        {
            if (CurrentBar < 1 || State != State.Realtime)
                return;

            CancelExpiredLimitOrders();
            MoveRunnerStopToBreakEvenIfNeeded();
            ResetActiveSignalIfFlat();

            LukeSignal signal;
            if (!TryReadLatestSignal(out signal))
                return;

            if (signal.IsPing)
            {
                ProcessPing(signal);
                return;
            }

            if (signal.IsCancel)
            {
                ProcessCancel(signal);
                return;
            }

            if (signal.Id == lastProcessedId || signal.Id == lastRejectedId)
                return;

            if (!IsInstrumentAllowed(signal))
            {
                Reject(signal, "signal symbol " + signal.Symbol + " does not match chart instrument " + Instrument.FullName);
                return;
            }

            if (MaxSignalsPerSession > 0 && signalsSubmittedThisSession >= MaxSignalsPerSession)
            {
                Reject(signal, "max signals per session reached");
                return;
            }

            if (UsePayloadQuantity && MaxQuantity > 0 && signal.Quantity > MaxQuantity)
            {
                Reject(signal, "signal quantity " + signal.Quantity + " exceeds max quantity " + MaxQuantity);
                return;
            }

            if (IsSignalStale(signal))
            {
                Reject(signal, "stale signal");
                return;
            }

            if (!IsAccountAllowed())
            {
                Reject(signal, "account guard rejected " + GetCurrentAccountName() + "; allowed " + AccountGuardDescription());
                return;
            }

            if (RequireFlatPosition && Position.MarketPosition != MarketPosition.Flat)
            {
                Reject(signal, "position not flat");
                return;
            }

            if (HasActiveEntryOrders())
            {
                Reject(signal, "entry order already active");
                return;
            }

            string priceRejectReason;
            if (!IsLongPriceContextAllowed(signal, out priceRejectReason))
            {
                Reject(signal, priceRejectReason);
                return;
            }

            SubmitLukeLong(signal);
        }

        private void StartBridgePollTimer()
        {
            StopBridgePollTimer();
            int interval = Math.Max(25, BridgePollMilliseconds);
            bridgePollTimer = new System.Timers.Timer(interval);
            bridgePollTimer.AutoReset = true;
            bridgePollTimer.Elapsed += OnBridgePollTimerElapsed;
            bridgePollTimer.Start();
        }

        private void StopBridgePollTimer()
        {
            if (bridgePollTimer == null)
                return;
            bridgePollTimer.Stop();
            bridgePollTimer.Elapsed -= OnBridgePollTimerElapsed;
            bridgePollTimer.Dispose();
            bridgePollTimer = null;
        }

        private void OnBridgePollTimerElapsed(object sender, System.Timers.ElapsedEventArgs e)
        {
            try
            {
                TriggerCustomEvent(state => ProcessBridgeCycle(), null);
            }
            catch
            {
            }
        }

        private void ProcessCancel(LukeSignal signal)
        {
            if (signal.Id == lastCancelledId)
                return;

            if (!IsInstrumentAllowed(signal))
            {
                Reject(signal, "cancel symbol " + signal.Symbol + " does not match chart instrument " + Instrument.FullName);
                return;
            }

            if (!IsAccountAllowed())
            {
                Reject(signal, "cancel ignored because account guard rejected " + GetCurrentAccountName() + "; allowed " + AccountGuardDescription());
                return;
            }

            if (RequireCancelMatchesActiveSignal && activeSignal != null
                && !string.Equals(signal.Id, activeSignal.Id, StringComparison.Ordinal))
            {
                Reject(signal, "cancel id does not match active signal " + activeSignal.Id);
                return;
            }

            bool hadActiveEntries = HasActiveEntryOrders();
            bool hadOpenLong = Position.MarketPosition == MarketPosition.Long;

            if (IsActive(entryOrderT1))
                CancelOrder(entryOrderT1);
            if (IsActive(entryOrderT2))
                CancelOrder(entryOrderT2);
            if (hadOpenLong)
                ExitLong();

            submittedUtc = DateTime.MinValue;
            activeSignal = null;
            activeRunnerQuantity = 0;
            activeLimitOrderExpirySeconds = 0;
            runnerStopMovedToBreakEven = false;
            lastCancelledId = signal.Id;

            string message = "LUKE SIM CANCEL " + signal.Id
                + (hadActiveEntries ? " cancelled active entries" : "")
                + (hadOpenLong ? " exit long submitted" : "")
                + (!hadActiveEntries && !hadOpenLong ? " no active order or long position" : "");
            BridgeInfo(message);
            Alert("LukeBridgeCancelled-" + signal.Id, Priority.High, message, NinjaTrader.Core.Globals.InstallDir + @"\sounds\Alert2.wav", 1, Brushes.DarkOrange, Brushes.White);
        }

        private void ProcessPing(LukeSignal signal)
        {
            if (signal.Id == lastProcessedId)
                return;

            if (!IsInstrumentAllowed(signal))
            {
                Reject(signal, "ping symbol " + signal.Symbol + " does not match chart instrument " + Instrument.FullName);
                return;
            }

            if (!IsAccountAllowed())
            {
                Reject(signal, "ping account guard rejected " + GetCurrentAccountName() + "; allowed " + AccountGuardDescription());
                return;
            }

            lastProcessedId = signal.Id;
            BridgeInfo("LUKE BRIDGE PING " + signal.Id + " account=" + GetCurrentAccountName() + " instrument=" + Instrument.FullName);
        }

        private void SubmitLukeLong(LukeSignal signal)
        {
            int qty = UsePayloadQuantity ? Math.Max(1, signal.Quantity) : Math.Max(1, BridgeDefaultQuantity);
            qty = Math.Min(qty, Math.Max(1, MaxQuantity));
            int qtyT1 = qty;
            int qtyT2 = 0;
            if (signal.ForceAllOutAtTp1)
            {
                qtyT1 = qty;
                qtyT2 = 0;
            }
            else if (signal.HasExplicitTargetQuantities)
            {
                qtyT1 = Math.Min(qty, Math.Max(0, signal.Tp1Quantity));
                qtyT2 = Math.Min(qty - qtyT1, Math.Max(0, signal.Tp2Quantity));
                int remainder = qty - qtyT1 - qtyT2;
                if (remainder > 0)
                    qtyT1 += remainder;
            }
            else if (SplitTp1Tp2Runner && qty >= 2)
            {
                qtyT1 = Math.Max(1, qty / 2);
                qtyT2 = qty - qtyT1;
            }

            SetStopLoss(EntryT1Name, CalculationMode.Price, signal.Stop, false);
            SetProfitTarget(EntryT1Name, CalculationMode.Price, signal.Tp1);
            if (qtyT2 > 0)
            {
                SetStopLoss(EntryT2Name, CalculationMode.Price, signal.Stop, false);
                SetProfitTarget(EntryT2Name, CalculationMode.Price, signal.Tp2);
            }

            submittedUtc = DateTime.UtcNow;
            activeSignal = signal;
            activeRunnerQuantity = qtyT2;
            activeLimitOrderExpirySeconds = ResolveLimitOrderExpirySeconds(signal);
            runnerStopMovedToBreakEven = false;

            if (ExecutionMode == LukeBridgeExecutionMode.MarketOnAlert)
            {
                entryOrderT1 = EnterLong(qtyT1, EntryT1Name);
                if (qtyT2 > 0)
                    entryOrderT2 = EnterLong(qtyT2, EntryT2Name);
            }
            else
            {
                entryOrderT1 = EnterLongLimit(qtyT1, signal.Entry, EntryT1Name);
                if (qtyT2 > 0)
                    entryOrderT2 = EnterLongLimit(qtyT2, signal.Entry, EntryT2Name);
            }

            lastProcessedId = signal.Id;
            signalsSubmittedThisSession++;
            string message = string.Format(CultureInfo.InvariantCulture,
                "LUKE SIM LONG {0} qty={1} t1={2} t2={3} entry={4:F2} stop={5:F2} tp1={6:F2} tp2={7:F2} mode={8} class={9} profile={10} model={11} expiry={12}s pollMs={13}",
                signal.Id, qty, qtyT1, qtyT2, signal.Entry, signal.Stop, signal.Tp1, signal.Tp2, ExecutionMode,
                signal.SignalClass, signal.OrderProfile, signal.ExecutionModel, activeLimitOrderExpirySeconds, BridgePollMilliseconds);
            BridgeInfo(message);
            Alert("LukeBridgeSubmitted-" + signal.Id, Priority.High, message, NinjaTrader.Core.Globals.InstallDir + @"\sounds\Alert1.wav", 1, Brushes.DarkGreen, Brushes.White);
        }

        private int ResolveLimitOrderExpirySeconds(LukeSignal signal)
        {
            if (ExecutionMode != LukeBridgeExecutionMode.LimitAtLukeEntry)
                return 0;
            if (signal != null && signal.IsManciniReclaim && ManciniReclaimLimitOrderExpirySeconds > 0)
                return ManciniReclaimLimitOrderExpirySeconds;
            if (signal != null && signal.IsScalpClass && ScalpLimitOrderExpirySeconds > 0)
                return ScalpLimitOrderExpirySeconds;
            return Math.Max(1, LimitOrderExpirySeconds);
        }

        private bool IsLongPriceContextAllowed(LukeSignal signal, out string rejectReason)
        {
            rejectReason = string.Empty;
            double lastPrice = Close[0];
            double tick = TickSize > 0 ? TickSize : 0.25;

            if (signal.Stop >= signal.Entry)
            {
                rejectReason = FormatPriceReject("stop is not below entry", signal, lastPrice);
                return false;
            }

            if (signal.Tp1 <= signal.Entry || signal.Tp2 <= signal.Entry)
            {
                rejectReason = FormatPriceReject("target is not above entry", signal, lastPrice);
                return false;
            }

            if (signal.Stop >= lastPrice - tick)
            {
                rejectReason = FormatPriceReject("stop is not below current market", signal, lastPrice);
                return false;
            }

            if (ExecutionMode == LukeBridgeExecutionMode.LimitAtLukeEntry && Math.Abs(signal.Entry - lastPrice) > MaxMarketableEntryPoints)
            {
                rejectReason = FormatPriceReject("entry is outside current market wiggle", signal, lastPrice);
                return false;
            }

            return true;
        }

        private string FormatPriceReject(string reason, LukeSignal signal, double lastPrice)
        {
            return string.Format(CultureInfo.InvariantCulture,
                "{0}: last={1:F2} entry={2:F2} stop={3:F2} tp1={4:F2} tp2={5:F2} maxMarketable={6:F2}",
                reason, lastPrice, signal.Entry, signal.Stop, signal.Tp1, signal.Tp2, MaxMarketableEntryPoints);
        }

        private void MoveRunnerStopToBreakEvenIfNeeded()
        {
            if (activeSignal == null || activeRunnerQuantity <= 0 || runnerStopMovedToBreakEven)
                return;
            if (Position.MarketPosition != MarketPosition.Long)
                return;
            if (Close[0] < activeSignal.Tp1)
                return;

            SetStopLoss(EntryT2Name, CalculationMode.Price, activeSignal.Entry, false);
            runnerStopMovedToBreakEven = true;
            Print(string.Format(CultureInfo.InvariantCulture,
                "Luke runner stop moved to breakeven at {0:F2} after TP1 {1:F2}",
                activeSignal.Entry, activeSignal.Tp1));
        }

        private void ResetActiveSignalIfFlat()
        {
            if (Position.MarketPosition != MarketPosition.Flat || HasActiveEntryOrders())
                return;

            activeSignal = null;
            activeRunnerQuantity = 0;
            activeLimitOrderExpirySeconds = 0;
            runnerStopMovedToBreakEven = false;
        }

        private bool TryReadLatestSignal(out LukeSignal signal)
        {
            signal = null;
            try
            {
                if (string.IsNullOrWhiteSpace(BridgeFilePath) || !File.Exists(BridgeFilePath))
                    return false;

                DateTime writeUtc = File.GetLastWriteTimeUtc(BridgeFilePath);
                string json = File.ReadAllText(BridgeFilePath);
                if (writeUtc == lastFileWriteUtc && string.Equals(json, lastFileContent, StringComparison.Ordinal))
                    return false;
                lastFileWriteUtc = writeUtc;
                lastFileContent = json;

                LukeSignal parsed = LukeSignal.Parse(json, writeUtc);
                if (parsed == null || (parsed.Side != "LONG" && !parsed.IsCancel && !parsed.IsPing))
                    return false;

                signal = parsed;
                return true;
            }
            catch (Exception ex)
            {
                Print("Luke bridge read failed: " + ex.Message);
                return false;
            }
        }

        private bool IsSignalStale(LukeSignal signal)
        {
            if (MaxSignalAgeSeconds <= 0)
                return false;
            return (DateTimeOffset.UtcNow - signal.CreatedAt.ToUniversalTime()).TotalSeconds > MaxSignalAgeSeconds;
        }

        private bool IsAccountAllowed()
        {
            string accountName = GetCurrentAccountName();
            if (IsSimOrPlaybackAccount(accountName))
                return true;

            string allowedAccount = string.IsNullOrWhiteSpace(AllowedAccountName) ? string.Empty : AllowedAccountName.Trim();
            if (string.IsNullOrEmpty(allowedAccount) || !string.Equals(accountName, allowedAccount, StringComparison.OrdinalIgnoreCase))
                return false;

            return AllowLiveAccounts && IsLiveBridgeArmed();
        }

        private string GetCurrentAccountName()
        {
            return Account == null ? string.Empty : (Account.Name ?? string.Empty).Trim();
        }

        private string AccountGuardDescription()
        {
            string allowedAccount = string.IsNullOrWhiteSpace(AllowedAccountName) ? "" : AllowedAccountName.Trim();
            if (string.IsNullOrEmpty(allowedAccount))
                return "Sim*/Playback* only; live disabled until exact account, AllowLiveAccounts=true, and arm phrase are set";
            if (!AllowLiveAccounts)
                return "Sim*/Playback* only; exact " + allowedAccount + " configured but live toggle is off";
            if (!IsLiveBridgeArmed())
                return "Sim*/Playback* only; exact " + allowedAccount + " configured but arm phrase is missing";
            return "Sim*/Playback* or exact armed account " + allowedAccount;
        }

        private static bool IsSimOrPlaybackAccount(string accountName)
        {
            return accountName.StartsWith("Sim", StringComparison.OrdinalIgnoreCase)
                || accountName.StartsWith("Playback", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsLiveBridgeArmed()
        {
            return string.Equals((LiveBridgeArmCode ?? string.Empty).Trim(), LiveBridgeArmPhrase, StringComparison.Ordinal);
        }

        private bool IsInstrumentAllowed(LukeSignal signal)
        {
            if (!RequireSymbolPrefixMatch)
                return true;

            string signalFamily = NormalizeInstrumentFamily(signal.Symbol);
            string chartFamily = NormalizeInstrumentFamily(Instrument == null ? string.Empty : Instrument.FullName);
            if (string.IsNullOrWhiteSpace(chartFamily) && Instrument != null && Instrument.MasterInstrument != null)
                chartFamily = NormalizeInstrumentFamily(Instrument.MasterInstrument.Name);

            return !string.IsNullOrWhiteSpace(signalFamily)
                && !string.IsNullOrWhiteSpace(chartFamily)
                && string.Equals(signalFamily, chartFamily, StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeInstrumentFamily(string value)
        {
            string text = (value ?? string.Empty).Trim().ToUpperInvariant();
            if (text.StartsWith("MES", StringComparison.OrdinalIgnoreCase)) return "MES";
            if (text.StartsWith("ES", StringComparison.OrdinalIgnoreCase)) return "ES";
            if (text.StartsWith("MNQ", StringComparison.OrdinalIgnoreCase)) return "MNQ";
            if (text.StartsWith("NQ", StringComparison.OrdinalIgnoreCase)) return "NQ";
            if (text.StartsWith("M2K", StringComparison.OrdinalIgnoreCase)) return "M2K";
            if (text.StartsWith("RTY", StringComparison.OrdinalIgnoreCase)) return "RTY";

            int length = 0;
            while (length < text.Length && char.IsLetter(text[length]))
                length++;
            return length > 0 ? text.Substring(0, length) : string.Empty;
        }

        private bool HasActiveEntryOrders()
        {
            return IsActive(entryOrderT1) || IsActive(entryOrderT2);
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

        private void CancelExpiredLimitOrders()
        {
            if (ExecutionMode != LukeBridgeExecutionMode.LimitAtLukeEntry || submittedUtc == DateTime.MinValue)
                return;
            int expirySeconds = activeLimitOrderExpirySeconds > 0 ? activeLimitOrderExpirySeconds : Math.Max(1, LimitOrderExpirySeconds);
            if ((DateTime.UtcNow - submittedUtc).TotalSeconds < expirySeconds)
                return;

            if (IsActive(entryOrderT1))
                CancelOrder(entryOrderT1);
            if (IsActive(entryOrderT2))
                CancelOrder(entryOrderT2);
            submittedUtc = DateTime.MinValue;
            activeLimitOrderExpirySeconds = 0;
            Print("Luke bridge limit entry expired after " + expirySeconds + "s and was cancelled.");
        }

        private void Reject(LukeSignal signal, string reason)
        {
            lastRejectedId = signal.Id;
            string message = "LUKE BRIDGE REJECT " + signal.Id + ": " + reason;
            BridgeInfo(message);
            Alert("LukeBridgeRejected-" + signal.Id, Priority.Medium, message, NinjaTrader.Core.Globals.InstallDir + @"\sounds\Alert2.wav", 1, Brushes.DarkRed, Brushes.White);
        }

        private void BridgeInfo(string message)
        {
            Print(message);
            Log(message, LogLevel.Information);
        }

        protected override void OnOrderUpdate(Order order, double limitPrice, double stopPrice, int quantity, int filled,
            double averageFillPrice, OrderState orderState, DateTime time, ErrorCode error, string nativeError)
        {
            if (order == null)
                return;

            if (order.Name == EntryT1Name)
                entryOrderT1 = order;
            else if (order.Name == EntryT2Name)
                entryOrderT2 = order;

            if (error != ErrorCode.NoError)
                Print("Luke bridge order error " + order.Name + ": " + error + " " + nativeError);
        }

        private class LukeSignal
        {
            public string Id;
            public string Type;
            public string Side;
            public string Symbol;
            public string SignalClass;
            public string OrderProfile;
            public string ExecutionModel;
            public double Entry;
            public double Stop;
            public double Tp1;
            public double Tp2;
            public int Quantity;
            public int Tp1Quantity;
            public int Tp2Quantity;
            public bool ForceAllOutAtTp1;
            public DateTimeOffset CreatedAt;

            public static LukeSignal Parse(string json, DateTime fileWriteUtc)
            {
                string id = ExtractString(json, "id");
                string type = ExtractString(json, "type");
                string side = ExtractString(json, "side");
                string symbol = ExtractString(json, "symbol");
                string signalClass = ExtractString(json, "class");
                string orderProfile = ExtractString(json, "profile");
                string executionModel = ExtractString(json, "execution_model");
                double entry = ExtractDouble(json, "entry");
                double stop = ExtractDouble(json, "stop");
                double tp1 = ExtractDouble(json, "tp1");
                double tp2 = ExtractDouble(json, "tp2");
                int qty = ExtractInt(json, "qty", 1);
                int tp1Qty = ExtractIntAllowZero(json, "tp1_qty", -1);
                int tp2Qty = ExtractIntAllowZero(json, "tp2_qty", -1);
                bool allOutAtTp1 = ExtractBool(json, "all_out_tp1");
                string createdText = ExtractString(json, "created_at");

                DateTimeOffset created;
                if (!DateTimeOffset.TryParse(createdText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out created))
                    created = new DateTimeOffset(DateTime.SpecifyKind(fileWriteUtc, DateTimeKind.Utc));

                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(side))
                    return null;
                bool isCancel = type.IndexOf("CANCEL", StringComparison.OrdinalIgnoreCase) >= 0
                    || side.Equals("CANCEL", StringComparison.OrdinalIgnoreCase);
                bool isPing = type.IndexOf("PING", StringComparison.OrdinalIgnoreCase) >= 0
                    || side.Equals("PING", StringComparison.OrdinalIgnoreCase);
                if (!isCancel && !isPing && (!IsFinite(entry) || !IsFinite(stop) || !IsFinite(tp1) || !IsFinite(tp2)))
                    return null;

                return new LukeSignal
                {
                    Id = id,
                    Type = string.IsNullOrWhiteSpace(type) ? "LUKE_LONG" : type.ToUpperInvariant(),
                    Side = side.ToUpperInvariant(),
                    Symbol = string.IsNullOrWhiteSpace(symbol) ? "ES" : symbol,
                    SignalClass = string.IsNullOrWhiteSpace(signalClass) ? "SCALP_VALID" : signalClass.ToUpperInvariant(),
                    OrderProfile = string.IsNullOrWhiteSpace(orderProfile) ? "default" : orderProfile.ToUpperInvariant(),
                    ExecutionModel = string.IsNullOrWhiteSpace(executionModel) ? "unknown" : executionModel.ToLowerInvariant(),
                    Entry = entry,
                    Stop = stop,
                    Tp1 = tp1,
                    Tp2 = tp2,
                    Quantity = Math.Max(1, qty),
                    Tp1Quantity = tp1Qty,
                    Tp2Quantity = tp2Qty,
                    ForceAllOutAtTp1 = allOutAtTp1,
                    CreatedAt = created
                };
            }

            public bool IsCancel
            {
                get
                {
                    return (Type ?? string.Empty).IndexOf("CANCEL", StringComparison.OrdinalIgnoreCase) >= 0
                        || string.Equals(Side, "CANCEL", StringComparison.OrdinalIgnoreCase);
                }
            }

            public bool IsPing
            {
                get
                {
                    return (Type ?? string.Empty).IndexOf("PING", StringComparison.OrdinalIgnoreCase) >= 0
                        || string.Equals(Side, "PING", StringComparison.OrdinalIgnoreCase);
                }
            }

            public bool IsManciniReclaim
            {
                get
                {
                    return string.Equals(SignalClass, "MANCINI_RECLAIM", StringComparison.OrdinalIgnoreCase);
                }
            }

            public bool IsScalpClass
            {
                get
                {
                    return (SignalClass ?? string.Empty).StartsWith("SCALP", StringComparison.OrdinalIgnoreCase);
                }
            }

            public bool HasExplicitTargetQuantities
            {
                get
                {
                    return Tp1Quantity >= 0 || Tp2Quantity >= 0;
                }
            }

            private static bool IsFinite(double value)
            {
                return !double.IsNaN(value) && !double.IsInfinity(value);
            }

            private static string ExtractString(string json, string name)
            {
                Match match = Regex.Match(json, "\\\"" + Regex.Escape(name) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"", RegexOptions.IgnoreCase);
                return match.Success ? Regex.Unescape(match.Groups[1].Value) : string.Empty;
            }

            private static double ExtractDouble(string json, string name)
            {
                Match quoted = Regex.Match(json, "\\\"" + Regex.Escape(name) + "\\\"\\s*:\\s*\\\"([-+]?[0-9]*\\.?[0-9]+)\\\"", RegexOptions.IgnoreCase);
                Match bare = Regex.Match(json, "\\\"" + Regex.Escape(name) + "\\\"\\s*:\\s*([-+]?[0-9]*\\.?[0-9]+)", RegexOptions.IgnoreCase);
                Match match = quoted.Success ? quoted : bare;
                double value;
                return match.Success && double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out value)
                    ? value
                    : double.NaN;
            }

            private static int ExtractInt(string json, string name, int fallback)
            {
                double value = ExtractDouble(json, name);
                return IsFinite(value) ? Math.Max(1, Convert.ToInt32(value)) : fallback;
            }

            private static int ExtractIntAllowZero(string json, string name, int fallback)
            {
                double value = ExtractDouble(json, name);
                return IsFinite(value) ? Math.Max(0, Convert.ToInt32(value)) : fallback;
            }

            private static bool ExtractBool(string json, string name)
            {
                Match match = Regex.Match(json, "\\\"" + Regex.Escape(name) + "\\\"\\s*:\\s*(true|false|1|0|\\\"true\\\"|\\\"false\\\"|\\\"1\\\"|\\\"0\\\")", RegexOptions.IgnoreCase);
                if (!match.Success)
                    return false;
                string value = match.Groups[1].Value.Trim().Trim('"');
                return value.Equals("true", StringComparison.OrdinalIgnoreCase) || value.Equals("1", StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}
