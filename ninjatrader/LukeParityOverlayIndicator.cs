#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Media;
using NinjaTrader.Data;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    public class LukeParityOverlayIndicator : Indicator
    {
        private const int MaxRowsToRead = 500;
        private const int MaxMarkers = 30;

        private readonly List<LukeOverlayLevel> levels = new List<LukeOverlayLevel>();
        private readonly List<LukeOverlayEvent> events = new List<LukeOverlayEvent>();
        private readonly List<string> activeMarkerTags = new List<string>();
        private readonly List<string> activeLevelTags = new List<string>();
        private DateTime lastRefreshUtc = DateTime.MinValue;
        private DateTime lastLevelWriteUtc = DateTime.MinValue;
        private DateTime lastNativeWriteUtc = DateTime.MinValue;
        private DateTime lastSatySessionDate = DateTime.MinValue;
        private double previousClose = double.NaN;
        private double satyAtr = double.NaN;
        private int lastDrawnLevelCount;
        private int externalLevelCount;
        private int dailyBarsLoaded = -1;
        private string levelFileStatus = "not checked";
        private string satyStatus = "not checked";
        private string ledgerText = "LUKE PARITY OVERLAY\nwaiting for local files";

        [NinjaScriptProperty]
        [Display(Name = "Level file path", GroupName = "Luke Overlay", Order = 1)]
        public string LevelFilePath { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Native telemetry path", GroupName = "Luke Overlay", Order = 2)]
        public string NativeTelemetryPath { get; set; }

        [NinjaScriptProperty]
        [Range(1, 300)]
        [Display(Name = "Refresh seconds", GroupName = "Luke Overlay", Order = 3)]
        public int RefreshSeconds { get; set; }

        [NinjaScriptProperty]
        [Range(1, 100)]
        [Display(Name = "Max visible levels", GroupName = "Luke Overlay", Order = 4)]
        public int MaxVisibleLevels { get; set; }

        [NinjaScriptProperty]
        [Range(5.0, 500.0)]
        [Display(Name = "Level window points", GroupName = "Luke Overlay", Order = 5)]
        public double LevelWindowPoints { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show event markers", GroupName = "Luke Overlay", Order = 6)]
        public bool ShowEventMarkers { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Saty levels", GroupName = "Luke Overlay", Order = 7)]
        public bool ShowSatyLevels { get; set; }

        [NinjaScriptProperty]
        [Range(1, 100)]
        [Display(Name = "Saty ATR length", GroupName = "Luke Overlay", Order = 8)]
        public int SatyAtrLength { get; set; }

        [NinjaScriptProperty]
        [Range(0.001, 1.0)]
        [Display(Name = "Saty trigger percentage", GroupName = "Luke Overlay", Order = 9)]
        public double SatyTriggerPct { get; set; }

        [NinjaScriptProperty]
        [Range(1.0, 500.0)]
        [Display(Name = "PnL dollars per point", GroupName = "Luke Overlay", Order = 10)]
        public double PnlDollarsPerPoint { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 10.0)]
        [Display(Name = "Entry slippage points", GroupName = "Luke Overlay", Order = 11)]
        public double EntrySlippagePoints { get; set; }

        [NinjaScriptProperty]
        [Range(0.0, 100.0)]
        [Display(Name = "Commission per contract round trip", GroupName = "Luke Overlay", Order = 12)]
        public double CommissionPerContractRoundTrip { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "LukeParityOverlayIndicator";
                Description = "Chart-only Luke parity overlay. Reads local Luke level/event files and never submits orders.";
                Calculate = Calculate.OnEachTick;
                IsOverlay = true;
                DisplayInDataBox = false;
                DrawOnPricePanel = true;
                IsSuspendedWhileInactive = true;

                LevelFilePath = @"C:\Users\conor\luke\data\ninjatrader\luke-native-levels.txt";
                NativeTelemetryPath = @"C:\Users\conor\luke\state\events\ninja-native-shadow.jsonl";
                RefreshSeconds = 5;
                MaxVisibleLevels = 60;
                LevelWindowPoints = 80.0;
                ShowEventMarkers = true;
                ShowSatyLevels = true;
                SatyAtrLength = 14;
                SatyTriggerPct = 0.236;
                PnlDollarsPerPoint = 50.0;
                EntrySlippagePoints = 0.25;
                CommissionPerContractRoundTrip = 5.0;
            }
            else if (State == State.Configure)
            {
                AddDataSeries(BarsPeriodType.Day, 1);
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0 || CurrentBar < 1)
                return;

            RefreshSatyLevelsIfNeeded();
            RefreshIfNeeded();
            DrawLevels();
            DrawLedger();
            if (ShowEventMarkers)
                DrawMarkers();
        }

        private void RefreshIfNeeded()
        {
            if ((DateTime.UtcNow - lastRefreshUtc).TotalSeconds < Math.Max(1, RefreshSeconds))
                return;

            lastRefreshUtc = DateTime.UtcNow;
            bool changed = RefreshLevels();
            changed = RefreshEvents() || changed;
            if (changed)
                ledgerText = BuildLedgerText();
        }

        private bool RefreshLevels()
        {
            DateTime writeUtc = SafeWriteUtc(LevelFilePath);
            if (writeUtc == lastLevelWriteUtc)
                return false;

            lastLevelWriteUtc = writeUtc;
            RemoveLevelsBySource("mancini");

            string text = SafeRead(LevelFilePath);
            externalLevelCount = 0;
            string[] lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            for (int lineIndex = 0; lineIndex < lines.Length; lineIndex++)
            {
                string trimmedLine = (lines[lineIndex] ?? string.Empty).Trim();
                if (trimmedLine.Length == 0 || trimmedLine.StartsWith("#", StringComparison.Ordinal))
                    continue;
                string source = LevelSourceForLine(lines[lineIndex]);
                foreach (Match match in Regex.Matches(lines[lineIndex], @"[-+]?\d+(?:\.\d+)?"))
                {
                    double value;
                    if (double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out value))
                    {
                        AddUniqueLevel(value, source);
                        externalLevelCount++;
                    }
                }
            }
            levelFileStatus = externalLevelCount > 0
                ? "OK manual levels " + externalLevelCount.ToString(CultureInfo.InvariantCulture)
                : "EMPTY paste Mancini levels into luke-native-levels.txt";
            SortLevels();
            return true;
        }

        private bool RefreshEvents()
        {
            DateTime nativeWriteUtc = SafeWriteUtc(NativeTelemetryPath);
            if (nativeWriteUtc == lastNativeWriteUtc)
                return false;
            lastNativeWriteUtc = nativeWriteUtc;
            events.Clear();
            ReadEventFile(NativeTelemetryPath, "native");
            events.Sort((a, b) => a.Time.CompareTo(b.Time));
            if (events.Count > MaxRowsToRead)
                events.RemoveRange(0, events.Count - MaxRowsToRead);
            return true;
        }

        private void ReadEventFile(string filePath, string source)
        {
            string[] lines = SafeTailLines(filePath, MaxRowsToRead);
            for (int i = 0; i < lines.Length; i++)
            {
                LukeOverlayEvent row = LukeOverlayEvent.Parse(lines[i], source);
                if (row != null)
                    events.Add(row);
            }
        }

        private void RefreshSatyLevelsIfNeeded()
        {
            if (!ShowSatyLevels)
            {
                satyStatus = "disabled";
                return;
            }

            DateTime sessionDate = Time[0].Date;
            if (sessionDate == lastSatySessionDate && levels.Exists(level => level.Source.StartsWith("saty", StringComparison.Ordinal)))
                return;

            RemoveLevelsBySource("saty");
            lastSatySessionDate = sessionDate;
            dailyBarsLoaded = CurrentBars.Length > 1 ? CurrentBars[1] : -1;

            if (BarsArray.Length <= 1 || CurrentBars.Length <= 1 || CurrentBars[1] <= SatyAtrLength)
            {
                previousClose = double.NaN;
                satyAtr = double.NaN;
                satyStatus = "WAIT daily bars " + Math.Max(0, dailyBarsLoaded).ToString(CultureInfo.InvariantCulture)
                    + "/" + (SatyAtrLength + 1).ToString(CultureInfo.InvariantCulture)
                    + " - set chart Days to load >= 30 and reload";
                ledgerText = BuildLedgerText();
                return;
            }

            previousClose = Closes[1][1];
            satyAtr = ComputeSatyAtr(1, SatyAtrLength);
            if (!IsFinite(previousClose) || !IsFinite(satyAtr) || satyAtr <= 0.0)
            {
                satyStatus = "WAIT invalid daily close/ATR from Ninja data";
                ledgerText = BuildLedgerText();
                return;
            }

            AddUniqueLevel(previousClose, "saty_prev_close");
            AddUniqueLevel(previousClose + satyAtr * SatyTriggerPct, "saty_call_trigger");
            AddUniqueLevel(previousClose - satyAtr * SatyTriggerPct, "saty_put_trigger");
            AddUniqueLevel(previousClose + satyAtr * 0.382, "saty_ext_plus_1");
            AddUniqueLevel(previousClose + satyAtr * 0.500, "saty_ext_plus_2");
            AddUniqueLevel(previousClose + satyAtr * 0.618, "saty_ext_plus_3");
            AddUniqueLevel(previousClose + satyAtr * 0.786, "saty_ext_plus_4");
            AddUniqueLevel(previousClose + satyAtr, "saty_atr_plus_1");
            AddUniqueLevel(previousClose - satyAtr * 0.382, "saty_ext_minus_1");
            AddUniqueLevel(previousClose - satyAtr * 0.500, "saty_ext_minus_2");
            AddUniqueLevel(previousClose - satyAtr * 0.618, "saty_ext_minus_3");
            AddUniqueLevel(previousClose - satyAtr * 0.786, "saty_ext_minus_4");
            AddUniqueLevel(previousClose - satyAtr, "saty_atr_minus_1");
            SortLevels();
            satyStatus = "OK daily bars " + dailyBarsLoaded.ToString(CultureInfo.InvariantCulture);
            ledgerText = BuildLedgerText();
        }

        private void AddUniqueLevel(double value, string source)
        {
            for (int i = 0; i < levels.Count; i++)
                if (Math.Abs(levels[i].Price - value) < 0.005 && string.Equals(levels[i].Source, source, StringComparison.Ordinal))
                    return;
            levels.Add(new LukeOverlayLevel(Math.Round(value * 100.0) / 100.0, source));
        }

        private void RemoveLevelsBySource(string source)
        {
            for (int i = levels.Count - 1; i >= 0; i--)
                if (levels[i].Source.StartsWith(source, StringComparison.Ordinal))
                    levels.RemoveAt(i);
        }

        private void SortLevels()
        {
            levels.Sort((a, b) => a.Price.CompareTo(b.Price));
        }

        private void DrawLevels()
        {
            ClearLevelDrawObjects();
            List<LukeOverlayLevel> visibleLevels = VisibleLevels();
            for (int i = 0; i < visibleLevels.Count; i++)
            {
                LukeOverlayLevel level = visibleLevels[i];
                Brush brush = LevelBrush(level.Source);
                int width = LevelWidth(level.Source);
                string lineTag = "LukeParityLevel" + i;
                Draw.HorizontalLine(this, lineTag, level.Price, brush, DashStyleHelper.Solid, width);
                activeLevelTags.Add(lineTag);
                if (i < 24)
                {
                    string labelTag = "LukeParityLevelLabel" + i;
                    Draw.Text(this, labelTag, LevelLabel(level), 0, level.Price, brush);
                    activeLevelTags.Add(labelTag);
                }
            }
            lastDrawnLevelCount = visibleLevels.Count;
        }

        private void ClearLevelDrawObjects()
        {
            for (int i = 0; i < activeLevelTags.Count; i++)
                RemoveDrawObject(activeLevelTags[i]);
            activeLevelTags.Clear();
        }

        private List<LukeOverlayLevel> VisibleLevels()
        {
            List<LukeOverlayLevel> merged = MergeVisibleLevels();
            double last = Close[0];
            if (LevelWindowPoints > 0.0)
                merged.RemoveAll(level => Math.Abs(level.Price - last) > LevelWindowPoints);
            merged.Sort((a, b) =>
            {
                int distance = Math.Abs(a.Price - last).CompareTo(Math.Abs(b.Price - last));
                return distance != 0 ? distance : a.Price.CompareTo(b.Price);
            });
            if (merged.Count > MaxVisibleLevels)
                merged.RemoveRange(MaxVisibleLevels, merged.Count - MaxVisibleLevels);
            merged.Sort((a, b) => a.Price.CompareTo(b.Price));
            return merged;
        }

        private List<LukeOverlayLevel> MergeVisibleLevels()
        {
            List<LukeOverlayLevel> merged = new List<LukeOverlayLevel>();
            for (int i = 0; i < levels.Count; i++)
            {
                LukeOverlayLevel source = levels[i];
                LukeOverlayLevel existing = null;
                for (int j = 0; j < merged.Count; j++)
                {
                    if (Math.Abs(merged[j].Price - source.Price) < 0.005)
                    {
                        existing = merged[j];
                        break;
                    }
                }
                if (existing == null)
                    merged.Add(new LukeOverlayLevel(source.Price, source.Source));
                else if (!existing.Source.Contains(source.Source))
                    existing.Source = CombineSources(existing.Source, source.Source);
            }
            return merged;
        }

        private static string CombineSources(string left, string right)
        {
            bool hasMancini = IsManciniSource(left) || IsManciniSource(right);
            bool hasSaty = IsSatySource(left) || IsSatySource(right);
            if (hasMancini && hasSaty)
                return "both";
            return left + "+" + right;
        }

        private void DrawLedger()
        {
            Draw.TextFixed(
                this,
                "LukeParityLedger",
                ledgerText,
                TextPosition.TopRight,
                Brushes.White,
                new SimpleFont("Consolas", 12),
                Brushes.Transparent,
                Brushes.Black,
                35);
        }

        private void DrawMarkers()
        {
            for (int i = 0; i < activeMarkerTags.Count; i++)
                RemoveDrawObject(activeMarkerTags[i]);
            activeMarkerTags.Clear();

            int drawn = 0;
            for (int i = events.Count - 1; i >= 0 && drawn < MaxMarkers; i--)
            {
                LukeOverlayEvent row = events[i];
                if (!row.HasPrice)
                    continue;
                int barsAgo = FindBarsAgo(row.ChartTime);
                if (barsAgo < 0)
                    continue;

                Brush brush = row.Kind == "LONG" ? Brushes.LimeGreen
                    : row.Kind == "CANCEL" ? Brushes.DarkOrange
                    : row.Kind == "TP1" ? Brushes.DeepSkyBlue
                    : row.Kind.IndexOf("STOP", StringComparison.OrdinalIgnoreCase) >= 0 ? Brushes.Red
                    : Brushes.White;
                string tag = "LukeParityMarker" + row.Source + row.Kind + row.Time.Ticks + drawn;
                Draw.Text(this, tag, MarkerText(row), barsAgo, row.Price, brush);
                activeMarkerTags.Add(tag);
                drawn++;
            }
        }

        private int FindBarsAgo(DateTime barTime)
        {
            if (barTime == DateTime.MinValue)
                return 0;
            for (int barsAgo = 0; barsAgo <= Math.Min(CurrentBar, 300); barsAgo++)
            {
                double minutes = Math.Abs((Time[barsAgo] - barTime).TotalMinutes);
                if (minutes <= Math.Max(1, BarsPeriod.Value))
                    return barsAgo;
            }
            return -1;
        }

        private double CostPerContract()
        {
            return EntrySlippagePoints * PnlDollarsPerPoint + CommissionPerContractRoundTrip;
        }

        private static string FmtNet(double net)
        {
            if (double.IsNaN(net) || double.IsInfinity(net)) return "?";
            return net >= 0
                ? string.Format(CultureInfo.InvariantCulture, "+${0:F2}", net)
                : string.Format(CultureInfo.InvariantCulture, "-${0:F2}", Math.Abs(net));
        }

        private static string FmtPts(double pts)
        {
            if (double.IsNaN(pts) || double.IsInfinity(pts)) return "?pt";
            return pts >= 0
                ? string.Format(CultureInfo.InvariantCulture, "+{0:F2}pt", pts)
                : string.Format(CultureInfo.InvariantCulture, "{0:F2}pt", pts);
        }

        private string BuildLedgerText()
        {
            int nativeLong = 0, allNativeLong = 0, nativeCancel = 0;
            int tp1Count = 0, tp2Count = 0, stopCount = 0;
            double realizedGross = 0.0, realizedNet = 0.0, cancelNet = 0.0;
            double costPerContract = CostPerContract();
            var recentRows = new List<string>();
            var todayLongs = new List<LukeOverlayEvent>();
            DateTime sessionDate = Time[0].Date;

            // Pass 1: index today's LONG events by signal_id so CANCEL can resolve tp1/stop
            var longIndex = new Dictionary<string, LukeOverlayEvent>(StringComparer.Ordinal);
            for (int i = 0; i < events.Count; i++)
            {
                LukeOverlayEvent row = events[i];
                if (row.Source != "native" || row.Kind != "LONG") continue;
                DateTime keyTime = row.BarTime == DateTime.MinValue ? row.Time : row.BarTime.ToLocalTime();
                if (keyTime != DateTime.MinValue && keyTime.Date != sessionDate) continue;
                if (!string.IsNullOrEmpty(row.SignalId))
                    longIndex[row.SignalId] = row;
            }

            for (int i = 0; i < events.Count; i++)
            {
                LukeOverlayEvent row = events[i];
                if (row.Source != "native") continue;
                DateTime keyTime = row.BarTime == DateTime.MinValue ? row.Time : row.BarTime.ToLocalTime();
                if (keyTime != DateTime.MinValue && keyTime.Date != sessionDate) continue;

                if (row.Kind == "LONG")
                {
                    allNativeLong++;
                    if (!row.IsShadowOnly) { nativeLong++; todayLongs.Add(row); }
                    continue;
                }

                double pts = double.NaN;
                double net;
                bool entryKnown = !double.IsNaN(row.Entry) && !double.IsInfinity(row.Entry);

                if (row.Kind == "CANCEL")
                {
                    nativeCancel++;
                    bool priceKnown = !double.IsNaN(row.Price) && !double.IsInfinity(row.Price);

                    // Resolve tp1/tp2/stop from matched LONG (CANCEL events have null targets in JSONL)
                    LukeOverlayEvent matched = null;
                    if (!string.IsNullOrEmpty(row.SignalId))
                        longIndex.TryGetValue(row.SignalId, out matched);
                    double resolvedTp1  = (matched != null && IsFinite(matched.EntryTp1))  ? matched.EntryTp1  : row.EntryTp1;
                    double resolvedTp2  = (matched != null && IsFinite(matched.EntryTp2))  ? matched.EntryTp2  : row.EntryTp2;
                    double resolvedStop = (matched != null && IsFinite(matched.EntryStop)) ? matched.EntryStop : row.EntryStop;
                    double resolvedEntry = entryKnown ? row.Entry : (matched != null ? matched.Entry : double.NaN);
                    bool tp1Known  = IsFinite(resolvedTp1);
                    bool tp2Known  = IsFinite(resolvedTp2) && resolvedTp2 > resolvedTp1;
                    bool stopKnown = IsFinite(resolvedStop);

                    if (priceKnown && tp2Known && row.Price >= resolvedTp2)
                    {
                        // Price was at/past TP2 at cancel - counts as TP2 outcome
                        tp2Count++;
                        nativeCancel--;
                        double t1Pts = IsFinite(resolvedTp1) && IsFinite(resolvedEntry) ? resolvedTp1 - resolvedEntry : double.NaN;
                        pts = IsFinite(resolvedTp2) && IsFinite(resolvedEntry) ? resolvedTp2 - resolvedEntry : double.NaN;
                        // Split plan: contract1 exits at TP1 + contract2 exits at TP2
                        double grossPts = (IsFinite(t1Pts) ? t1Pts : 0.0) + (IsFinite(pts) ? pts : 0.0);
                        net = IsFinite(grossPts) ? grossPts * PnlDollarsPerPoint - 2.0 * costPerContract : 0.0;
                        realizedGross += grossPts * PnlDollarsPerPoint;
                        realizedNet += net;
                        recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0:HH:mm} CXL->T2 E{1} {2} {3}",
                            row.Time, IsFinite(resolvedEntry) ? resolvedEntry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                            FmtPts(pts), FmtNet(net)));
                    }
                    else if (priceKnown && tp1Known && row.Price >= resolvedTp1)
                    {
                        // Price was at/past TP1 at cancel - counts as TP1 outcome
                        tp1Count++;
                        nativeCancel--;
                        pts = resolvedTp1 - resolvedEntry;
                        net = IsFinite(pts) ? pts * PnlDollarsPerPoint - costPerContract : 0.0;
                        realizedGross += IsFinite(pts) ? pts * PnlDollarsPerPoint : 0.0;
                        realizedNet += net;
                        recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0:HH:mm} CXL->T1 E{1} {2} {3}",
                            row.Time, IsFinite(resolvedEntry) ? resolvedEntry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                            FmtPts(pts), FmtNet(net)));
                    }
                    else if (priceKnown && stopKnown && row.Price <= resolvedStop)
                    {
                        // Price was at/below stop at cancel - direction loss
                        stopCount++;
                        nativeCancel--;
                        pts = resolvedStop - resolvedEntry;
                        net = IsFinite(pts) ? pts * PnlDollarsPerPoint - costPerContract : 0.0;
                        realizedGross += IsFinite(pts) ? pts * PnlDollarsPerPoint : 0.0;
                        realizedNet += net;
                        recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0:HH:mm} CXL->ST E{1} {2} {3}",
                            row.Time, IsFinite(resolvedEntry) ? resolvedEntry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                            FmtPts(pts), FmtNet(net)));
                    }
                    else
                    {
                        // Neutral cancel: price between entry and tp1/stop - informational only
                        if (priceKnown && IsFinite(resolvedEntry))
                        {
                            pts = row.Price - resolvedEntry;
                            net = pts * PnlDollarsPerPoint - costPerContract;
                        }
                        else
                        {
                            net = row.HasNet ? row.Net : 0.0;
                        }
                        cancelNet += net;
                        recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0:HH:mm} CANCEL E{1} {2} {3}",
                            row.Time, IsFinite(resolvedEntry) ? resolvedEntry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                            FmtPts(pts), FmtNet(net)));
                    }
                }
                else if (row.Kind == "TP1" || row.Kind == "TP2")
                {
                    bool tp1Known = IsFinite(row.EntryTp1);
                    bool tp2Known2 = IsFinite(row.EntryTp2);
                    if (row.Kind == "TP2")
                    {
                        tp2Count++;
                        // TP2_FIRST: split plan - contract1 exits at TP1, contract2 at TP2
                        double t1Pts = (entryKnown && tp1Known) ? row.EntryTp1 - row.Entry : double.NaN;
                        double t2Pts = (entryKnown && tp2Known2) ? row.EntryTp2 - row.Entry : double.NaN;
                        pts = IsFinite(t2Pts) ? t2Pts : t1Pts;
                        if (row.HasNet)
                        {
                            net = row.Net;
                            if (IsFinite(t1Pts) && IsFinite(t2Pts)) realizedGross += (t1Pts + t2Pts) * PnlDollarsPerPoint;
                            else if (IsFinite(t2Pts)) realizedGross += t2Pts * PnlDollarsPerPoint;
                            else if (IsFinite(t1Pts)) realizedGross += t1Pts * PnlDollarsPerPoint;
                        }
                        else if (IsFinite(t1Pts) && IsFinite(t2Pts))
                        {
                            net = (t1Pts + t2Pts) * PnlDollarsPerPoint - 2.0 * costPerContract;
                            realizedGross += (t1Pts + t2Pts) * PnlDollarsPerPoint;
                        }
                        else if (IsFinite(t2Pts))
                        {
                            net = t2Pts * PnlDollarsPerPoint - costPerContract;
                            realizedGross += t2Pts * PnlDollarsPerPoint;
                        }
                        else { net = 0.0; }
                    }
                    else
                    {
                        tp1Count++;
                        // TP1 or TP1_THEN_STOP (normalised to "TP1"): single or split plan
                        pts = (entryKnown && tp1Known) ? row.EntryTp1 - row.Entry : double.NaN;
                        if (row.HasNet)
                        {
                            net = row.Net;
                            if (IsFinite(pts)) realizedGross += pts * PnlDollarsPerPoint;
                        }
                        else if (IsFinite(pts))
                        {
                            net = pts * PnlDollarsPerPoint - costPerContract;
                            realizedGross += pts * PnlDollarsPerPoint;
                        }
                        else { net = 0.0; }
                    }
                    realizedNet += net;
                    recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0:HH:mm} {1,-4}   E{2} {3} {4}",
                        row.Time, row.Kind,
                        entryKnown ? row.Entry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                        FmtPts(pts), FmtNet(net)));
                }
                else if (row.Kind == "STOP")
                {
                    stopCount++;
                    bool stopKnown = IsFinite(row.EntryStop);
                    if (row.HasNet)
                    {
                        net = row.Net;
                        if (entryKnown && stopKnown)
                        {
                            pts = row.EntryStop - row.Entry;
                            realizedGross += pts * PnlDollarsPerPoint;
                        }
                    }
                    else if (entryKnown && stopKnown)
                    {
                        pts = row.EntryStop - row.Entry;
                        net = pts * PnlDollarsPerPoint - costPerContract;
                        realizedGross += pts * PnlDollarsPerPoint;
                    }
                    else { net = 0.0; }
                    realizedNet += net;
                    recentRows.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0:HH:mm} STOP   E{1} {2} {3}",
                        row.Time, entryKnown ? row.Entry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                        FmtPts(pts), FmtNet(net)));
                }
            }

            int sessionSuccesses = tp1Count + tp2Count;
            int closedSignals = sessionSuccesses + stopCount;
            // Pine formula: score denominator = outcomes(closed) + cancels, NOT all LONGs fired
            int totalAttempts = closedSignals + nativeCancel;
            // cxl net is informational only - never added to realizedNet (no fills on cancelled signals)
            double totalNet = realizedNet;
            double commDollars = CommissionPerContractRoundTrip * totalAttempts;
            double slipDollars = EntrySlippagePoints * PnlDollarsPerPoint * totalAttempts;

            string scorePct = totalAttempts > 0
                ? string.Format(CultureInfo.InvariantCulture,
                    "{0}/{1}  {2:F1}%", sessionSuccesses, totalAttempts,
                    100.0 * sessionSuccesses / totalAttempts)
                : "0/0";

            // Simulation: scan forward through chart bars to find what should have happened
            int simTp1 = 0, simTp2 = 0, simBE = 0, simStop = 0, simOpen = 0, simNoFill = 0;
            double simNet = 0.0;
            var simRows = new List<string>();
            const int SimLookforward = 500; // 500 one-minute bars covers full RTH session

            foreach (LukeOverlayEvent longEvt in todayLongs)
            {
                SimResult sim = SimulateLong(longEvt, costPerContract, SimLookforward);
                DateTime simTime = longEvt.BarTime != DateTime.MinValue
                    ? longEvt.BarTime.ToLocalTime()
                    : longEvt.Time.ToLocalTime();
                switch (sim.Outcome)
                {
                    case "TP1":  simTp1++;  simNet += sim.Net; break;
                    case "TP2":  simTp2++;  simNet += sim.Net; break;
                    case "BE":   simBE++;   simNet += sim.Net; break;
                    case "STOP": simStop++; simNet += sim.Net; break;
                    case "OPEN": simOpen++;  break;
                    default:     simNoFill++; break;
                }
                bool simResolved = sim.Outcome == "TP1" || sim.Outcome == "TP2" || sim.Outcome == "BE" || sim.Outcome == "STOP";
                simRows.Add(string.Format(CultureInfo.InvariantCulture,
                    "{0:HH:mm} SIM {1,-5} E{2} {3} {4}",
                    simTime, sim.Outcome,
                    IsFinite(longEvt.Entry) ? longEvt.Entry.ToString("F2", CultureInfo.InvariantCulture) : "?",
                    simResolved ? FmtPts(sim.Pts) : "",
                    simResolved ? FmtNet(sim.Net) : ""));
            }

            int simWins = simTp1 + simTp2 + simBE;
            string simScorePct = nativeLong > 0
                ? string.Format(CultureInfo.InvariantCulture,
                    "{0}/{1}  {2:F1}%", simWins, nativeLong, 100.0 * simWins / nativeLong)
                : "0/0";

            System.Text.StringBuilder sb = new System.Text.StringBuilder();
            sb.AppendLine("Luke best UI");
            sb.AppendFormat(CultureInfo.InvariantCulture, "session {0:yyyy-MM-dd}\n", sessionDate);
            sb.AppendFormat(CultureInfo.InvariantCulture, "score incl cxl     {0}\n", scorePct);
            sb.AppendFormat(CultureInfo.InvariantCulture, "watch/long/cxl     W 0 / L {0} / C {1}\n", nativeLong, nativeCancel);
            sb.AppendFormat(CultureInfo.InvariantCulture, "misses incl cxl    {0} = S {1} + C {2}\n", stopCount + nativeCancel, stopCount, nativeCancel);
            sb.AppendFormat(CultureInfo.InvariantCulture, "milestones         T1 {0} / T2 {1} / STOP {2}\n", tp1Count, tp2Count, stopCount);
            sb.AppendFormat(CultureInfo.InvariantCulture, "gross total        {0:+0.00;-0.00;0.00}\n", realizedGross);
            sb.AppendFormat(CultureInfo.InvariantCulture, "realistic net      {0:+0.00;-0.00;0.00}\n", totalNet);
            sb.AppendFormat(CultureInfo.InvariantCulture, "cxl net            {0:+0.00;-0.00;0.00}\n", cancelNet);
            sb.AppendFormat(CultureInfo.InvariantCulture, "mode/costs         entry_only_0.25 | comm ${0:F2} / slip ${1:F2}\n", commDollars, slipDollars);
            sb.AppendFormat(CultureInfo.InvariantCulture, "native L/C         {0}/{1}\n", allNativeLong, nativeCancel);
            sb.AppendLine("base lines         M blue | S lime | both yellow");
            sb.AppendLine("mancini ctx        target purple | read gray");
            sb.AppendFormat(CultureInfo.InvariantCulture, "levels             total {0} manual {1} window +/-{2:F0}\n", levels.Count, externalLevelCount, LevelWindowPoints);
            sb.AppendFormat(CultureInfo.InvariantCulture, "manual file        {0}\n", levelFileStatus);
            sb.AppendFormat(CultureInfo.InvariantCulture, "saty               {0}\n", satyStatus);
            sb.AppendFormat(CultureInfo.InvariantCulture, "saty values        prev {0} atr {1}\n", FormatPrice(previousClose), FormatPrice(satyAtr));
            sb.AppendLine("chart-only: no order APIs");
            sb.AppendLine("--- sim: what should have happened ---");
            sb.AppendFormat(CultureInfo.InvariantCulture, "sim score          {0}\n", simScorePct);
            sb.AppendFormat(CultureInfo.InvariantCulture, "sim net            {0:+0.00;-0.00;0.00}\n", simNet);
            sb.AppendFormat(CultureInfo.InvariantCulture, "sim detail         T1 {0} / T2 {1} / BE {2} / STOP {3} / OPEN {4} / NOFILL {5}\n", simTp1, simTp2, simBE, simStop, simOpen, simNoFill);

            int startIdx = Math.Max(0, recentRows.Count - 8);
            for (int i = startIdx; i < recentRows.Count; i++)
            {
                sb.Append("\n");
                sb.Append(recentRows[i]);
            }

            int simStartIdx = Math.Max(0, simRows.Count - 8);
            for (int i = simStartIdx; i < simRows.Count; i++)
            {
                sb.Append("\n");
                sb.Append(simRows[i]);
            }

            return sb.ToString();
        }

        private struct SimResult
        {
            public string Outcome;  
            public double Pts;      
            public double Net;
        }

        private SimResult SimulateLong(LukeOverlayEvent evt, double costPerContract, int maxBarsForward)
        {
            if (!IsFinite(evt.Entry) || !IsFinite(evt.EntryTp1) || !IsFinite(evt.EntryStop))
                return new SimResult { Outcome = "?" };

            int signalBarsAgo = FindBarsAgo(evt.ChartTime);

            if (signalBarsAgo < 0)
                return new SimResult { Outcome = "?" };

            bool filled = false;
            bool tp1Hit = false;
            bool hasTp2 = IsFinite(evt.EntryTp2) && evt.EntryTp2 > evt.EntryTp1;

            for (int b = signalBarsAgo; b >= 0 && (signalBarsAgo - b) <= maxBarsForward; b--)
            {
                if ((Time[b] - evt.ChartTime).TotalMinutes > 480.0) break;

                if (!filled)
                {
                    if (Low[b] <= evt.Entry && High[b] >= evt.Entry) filled = true;
                    else continue;
                }

                double activeStop = tp1Hit ? evt.Entry : evt.EntryStop;

                if (Low[b] <= activeStop)
                {
                    if (tp1Hit)
                    {
                        double tp1Pts = evt.EntryTp1 - evt.Entry;
                        return new SimResult { Outcome = "BE", Pts = tp1Pts, Net = tp1Pts * PnlDollarsPerPoint - 2.0 * costPerContract };
                    }
                    double stopPts = evt.EntryStop - evt.Entry;
                    double stopNet = hasTp2
                        ? stopPts * PnlDollarsPerPoint * 2.0 - 2.0 * costPerContract
                        : stopPts * PnlDollarsPerPoint - costPerContract;
                    return new SimResult { Outcome = "STOP", Pts = stopPts, Net = stopNet };
                }

                if (hasTp2 && High[b] >= evt.EntryTp2)
                {
                    double tp1Pts = evt.EntryTp1 - evt.Entry;
                    double tp2Pts = evt.EntryTp2 - evt.Entry;
                    double tp2Net = (tp1Pts + tp2Pts) * PnlDollarsPerPoint - 2.0 * costPerContract;
                    return new SimResult { Outcome = "TP2", Pts = tp2Pts, Net = tp2Net };
                }

                if (!tp1Hit && High[b] >= evt.EntryTp1)
                {
                    if (!hasTp2)
                    {
                        double pts = evt.EntryTp1 - evt.Entry;
                        return new SimResult { Outcome = "TP1", Pts = pts, Net = pts * PnlDollarsPerPoint - costPerContract };
                    }
                    tp1Hit = true;
                    continue;
                }
            }

            if (tp1Hit)
            {
                double tp1Pts = evt.EntryTp1 - evt.Entry;
                return new SimResult { Outcome = "TP1", Pts = tp1Pts, Net = tp1Pts * PnlDollarsPerPoint - 2.0 * costPerContract };
            }
            return new SimResult { Outcome = filled ? "OPEN" : "NOFILL" };
        }

        private static Brush LevelBrush(string source)
        {
            if (source == "both") return Brushes.Yellow;
            if (source == "mancini") return Brushes.DodgerBlue;
            if (source == "mancini_major") return Brushes.Aqua;
            if (source == "mancini_focus") return Brushes.Orange;
            if (source == "mancini_trigger") return Brushes.DeepPink;
            if (source == "mancini_target") return Brushes.Purple;
            if (source == "mancini_read") return Brushes.Gray;
            if (source == "saty_prev_close") return Brushes.Gray;
            if (source == "saty_call_trigger") return Brushes.LimeGreen;
            if (source == "saty_put_trigger") return Brushes.Red;
            if (source == "saty_atr_plus_1") return Brushes.Green;
            if (source == "saty_atr_minus_1") return Brushes.DarkRed;
            if (source.StartsWith("saty_ext_plus", StringComparison.Ordinal)) return Brushes.ForestGreen;
            if (source.StartsWith("saty_ext_minus", StringComparison.Ordinal)) return Brushes.IndianRed;
            return Brushes.DimGray;
        }

        private static int LevelWidth(string source)
        {
            return source == "both"
                || source == "mancini"
                || source == "mancini_major"
                || source == "mancini_focus"
                || source == "mancini_trigger"
                || source == "saty_call_trigger"
                || source == "saty_put_trigger"
                || source.StartsWith("saty_atr", StringComparison.Ordinal)
                ? 2
                : 1;
        }

        private static string LevelLabel(LukeOverlayLevel level)
        {
            if (level.Source == "both") return "BOTH " + FormatPrice(level.Price);
            return level.Source.Replace("saty_", "S ").Replace("_", " ") + " " + FormatPrice(level.Price);
        }

        private static bool IsManciniSource(string source)
        {
            return (source ?? string.Empty).StartsWith("mancini", StringComparison.Ordinal);
        }

        private static bool IsSatySource(string source)
        {
            return (source ?? string.Empty).StartsWith("saty", StringComparison.Ordinal);
        }

        private static string LevelSourceForLine(string line)
        {
            string text = (line ?? string.Empty).Trim().ToLowerInvariant();
            if (text.StartsWith("#", StringComparison.Ordinal) || text.Length == 0)
                return "mancini";
            int colon = text.IndexOf(':');
            string key = colon >= 0 ? text.Substring(0, colon).Trim() : text;
            if (key == "major" || key == "mancini_major") return "mancini_major";
            if (key == "focus_long" || key == "focus" || key == "mancini_focus") return "mancini_focus";
            if (key == "trigger" || key == "reclaim" || key == "reclaim_trigger" || key == "mancini_trigger") return "mancini_trigger";
            if (key == "target" || key == "target_only" || key == "mancini_target") return "mancini_target";
            if (key == "read" || key == "read_reaction" || key == "caution" || key == "mancini_read") return "mancini_read";
            return "mancini";
        }

        private static string MarkerText(LukeOverlayEvent row)
        {
            return row.Source.ToUpperInvariant() + " " + row.Kind
                + (row.HasNet ? " net " + row.Net.ToString("F2", CultureInfo.InvariantCulture) : string.Empty);
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
                double priorClose = i > 0 ? closes[i - 1] : double.NaN;
                double range = highs[i] - lows[i];
                if (IsFinite(priorClose))
                {
                    range = Math.Max(range, Math.Abs(highs[i] - priorClose));
                    range = Math.Max(range, Math.Abs(lows[i] - priorClose));
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

        private static bool IsFinite(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }

        private static string FormatPrice(double value)
        {
            return IsFinite(value) ? value.ToString("F2", CultureInfo.InvariantCulture) : "--";
        }

        private static string SafeRead(string filePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return string.Empty;
                return File.ReadAllText(filePath);
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string[] SafeTailLines(string filePath, int maxLines)
        {
            string text = SafeRead(filePath);
            if (string.IsNullOrWhiteSpace(text))
                return new string[0];
            string[] lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
            if (lines.Length <= maxLines)
                return lines;
            string[] tail = new string[maxLines];
            Array.Copy(lines, lines.Length - maxLines, tail, 0, maxLines);
            return tail;
        }

        private static DateTime SafeWriteUtc(string filePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return DateTime.MinValue;
                return File.GetLastWriteTimeUtc(filePath);
            }
            catch
            {
                return DateTime.MinValue;
            }
        }

        private class LukeOverlayLevel
        {
            public LukeOverlayLevel(double price, string source)
            {
                Price = price;
                Source = source;
            }

            public double Price;
            public string Source;
        }

        private class LukeOverlayEvent
        {
            public string Source;
            public string Kind;
            public string SignalId;
            public DateTime Time;
            public DateTime BarTime;
            public double Price;
            public double Entry;
            public double EntryTp1;
            public double EntryTp2;
            public double EntryStop;
            public double Net;
            public string Note;
            public bool IsShadowOnly;

            public bool HasPrice
            {
                get { return !double.IsNaN(Price) && !double.IsInfinity(Price); }
            }

            public bool HasNet
            {
                get { return !double.IsNaN(Net) && !double.IsInfinity(Net); }
            }

            public DateTime ChartTime
            {
                get { return BarTime == DateTime.MinValue ? Time.ToLocalTime() : BarTime; }
            }

            public static LukeOverlayEvent Parse(string json, string source)
            {
                if (string.IsNullOrWhiteSpace(json))
                    return null;

                string eventText = ExtractString(json, "event");
                string kind = NormalizeKind(eventText);
                if (string.IsNullOrWhiteSpace(kind))
                    return null;

                DateTime ts = ExtractTime(json, "ts");
                if (ts == DateTime.MinValue)
                    ts = ExtractTime(json, "received_at");
                DateTime bar = ExtractTime(json, "bar_time");
                
                string note = ExtractString(json, "note");

                double rawPrice = ExtractDouble(json, "price");
                if (!IsFinite(rawPrice)) rawPrice = NoteDouble(note, "price");

                double entry = ExtractDouble(json, "entry");
                if (!IsFinite(entry)) entry = NoteDouble(note, "entry");
                if (!IsFinite(entry) && IsFinite(rawPrice)) entry = rawPrice;

                double price = IsFinite(rawPrice) ? rawPrice : (IsFinite(entry) ? entry : double.NaN);

                double tp1 = ExtractDouble(json, "tp1");
                if (!IsFinite(tp1)) tp1 = NoteDouble(note, "tp1");

                double tp2 = ExtractDouble(json, "tp2");
                if (!IsFinite(tp2)) tp2 = NoteDouble(note, "tp2");

                double stop = ExtractDouble(json, "stop");
                if (!IsFinite(stop)) stop = NoteDouble(note, "stop");

                double net = ExtractDouble(json, "net");
                if (!IsFinite(net))
                    net = NoteDouble(note, "net");

                string signalId = ExtractString(json, "signal_id");
                if (string.IsNullOrEmpty(signalId) && !string.IsNullOrEmpty(note))
                {
                    Match noteIdMatch = Regex.Match(note, @"(?:^|\s)id=(\S+)");
                    if (noteIdMatch.Success)
                        signalId = noteIdMatch.Groups[1].Value;
                }

                return new LukeOverlayEvent
                {
                    Source = source,
                    Kind = kind,
                    SignalId = signalId,
                    Time = ts == DateTime.MinValue ? DateTime.UtcNow : ts,
                    BarTime = bar,
                    Price = price,
                    Entry = entry,
                    EntryTp1 = tp1,
                    EntryTp2 = tp2,
                    EntryStop = stop,
                    Net = net,
                    Note = note,
                    IsShadowOnly = note.IndexOf("shadow_only=true", StringComparison.Ordinal) >= 0
                };
            }

            private static string NormalizeKind(string value)
            {
                string text = (value ?? string.Empty).ToUpperInvariant();
                if (text.Contains("LONG"))   return "LONG";
                if (text.Contains("CANCEL")) return "CANCEL";
                // TP2 check must precede TP1: "TP2_FIRST" contains both "TP2" and "TP1" substring.
                if (text.Contains("TP2"))    return "TP2";
                if (text.Contains("TP1"))    return "TP1";   // also matches "TP1_THEN_STOP" -> TP1 (BE outcome counts as success)
                if (text.Contains("STOP"))   return "STOP";  // STOP_FIRST, MIXED_STOP_FIRST
                if (text.Contains("PING"))   return "PING";
                return string.Empty;
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

            private static DateTime ExtractTime(string json, string name)
            {
                DateTime value;
                string text = ExtractString(json, name);
                if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out value))
                    return value;
                double epochMs;
                if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out epochMs) && epochMs > 946684800000.0)
                    return new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(epochMs).ToLocalTime();
                Match bare = Regex.Match(json, "\\\"" + Regex.Escape(name) + "\\\"\\s*:\\s*([-+]?[0-9]+(?:\\.[0-9]+)?)", RegexOptions.IgnoreCase);
                if (bare.Success && double.TryParse(bare.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out epochMs) && epochMs > 946684800000.0)
                    return new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(epochMs).ToLocalTime();
                return DateTime.MinValue;
            }

            private static double NoteDouble(string note, string key)
            {
                if (string.IsNullOrEmpty(note)) return double.NaN;
                Match m = Regex.Match(note,
                    @"(?:^|\s)" + Regex.Escape(key) + @"=([-+]?\d+(?:\.\d+)?)");
                double v;
                return m.Success && double.TryParse(m.Groups[1].Value,
                    NumberStyles.Float, CultureInfo.InvariantCulture, out v)
                    ? v : double.NaN;
            }

            private static bool IsFinite(double value)
            {
                return !double.IsNaN(value) && !double.IsInfinity(value);
            }
        }
    }
}
