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
        private DateTime lastRefreshUtc = DateTime.MinValue;
        private DateTime lastLevelWriteUtc = DateTime.MinValue;
        private DateTime lastBridgeWriteUtc = DateTime.MinValue;
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
        [Display(Name = "Pine bridge events path", GroupName = "Luke Overlay", Order = 2)]
        public string PineBridgeEventsPath { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Native telemetry path", GroupName = "Luke Overlay", Order = 3)]
        public string NativeTelemetryPath { get; set; }

        [NinjaScriptProperty]
        [Range(1, 300)]
        [Display(Name = "Refresh seconds", GroupName = "Luke Overlay", Order = 4)]
        public int RefreshSeconds { get; set; }

        [NinjaScriptProperty]
        [Range(1, 100)]
        [Display(Name = "Max visible levels", GroupName = "Luke Overlay", Order = 5)]
        public int MaxVisibleLevels { get; set; }

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
                PineBridgeEventsPath = @"C:\Users\conor\luke\state\events\ninjatrader-bridge.jsonl";
                NativeTelemetryPath = @"C:\Users\conor\luke\state\events\ninja-native-shadow.jsonl";
                RefreshSeconds = 5;
                MaxVisibleLevels = 60;
                ShowEventMarkers = true;
                ShowSatyLevels = true;
                SatyAtrLength = 14;
                SatyTriggerPct = 0.236;
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
            foreach (Match match in Regex.Matches(text, @"[-+]?\d+(?:\.\d+)?"))
            {
                double value;
                if (double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out value))
                {
                    AddUniqueLevel(value, "mancini");
                    externalLevelCount++;
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
            DateTime bridgeWriteUtc = SafeWriteUtc(PineBridgeEventsPath);
            DateTime nativeWriteUtc = SafeWriteUtc(NativeTelemetryPath);
            if (bridgeWriteUtc == lastBridgeWriteUtc && nativeWriteUtc == lastNativeWriteUtc)
                return false;

            lastBridgeWriteUtc = bridgeWriteUtc;
            lastNativeWriteUtc = nativeWriteUtc;
            events.Clear();
            ReadEventFile(PineBridgeEventsPath, "pine");
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
            int visible = Math.Min(MaxVisibleLevels, levels.Count);
            for (int i = 0; i < visible; i++)
            {
                LukeOverlayLevel level = levels[i];
                Brush brush = LevelBrush(level.Source);
                int width = LevelWidth(level.Source);
                Draw.HorizontalLine(this, "LukeParityLevel" + i, level.Price, brush, DashStyleHelper.Solid, width);
                if (i < 24)
                    Draw.Text(this, "LukeParityLevelLabel" + i, LevelLabel(level), 0, level.Price, brush);
            }
            for (int i = visible; i < lastDrawnLevelCount; i++)
            {
                RemoveDrawObject("LukeParityLevel" + i);
                RemoveDrawObject("LukeParityLevelLabel" + i);
            }
            lastDrawnLevelCount = visible;
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

        private string BuildLedgerText()
        {
            int pineLong = 0;
            int pineCancel = 0;
            int nativeLong = 0;
            int nativeCancel = 0;
            int tp1 = 0;
            int stops = 0;
            double net = 0.0;
            int netRows = 0;

            DateTime sessionDate = Time[0].Date;
            for (int i = 0; i < events.Count; i++)
            {
                LukeOverlayEvent row = events[i];
                DateTime keyTime = row.BarTime == DateTime.MinValue ? row.Time : row.BarTime;
                if (keyTime != DateTime.MinValue && keyTime.Date != sessionDate)
                    continue;
                if (row.Source == "pine" && row.Kind == "LONG") pineLong++;
                if (row.Source == "pine" && row.Kind == "CANCEL") pineCancel++;
                if (row.Source == "native" && row.Kind == "LONG") nativeLong++;
                if (row.Source == "native" && row.Kind == "CANCEL") nativeCancel++;
                if (row.Kind == "TP1") tp1++;
                if (row.Kind.IndexOf("STOP", StringComparison.OrdinalIgnoreCase) >= 0) stops++;
                if (row.HasNet)
                {
                    net += row.Net;
                    netRows++;
                }
            }

            return string.Format(CultureInfo.InvariantCulture,
                "Luke best UI - Ninja parity\nsession {0:yyyy-MM-dd}\nscore incl cxl     native {4}/{5} | pine {2}/{3}\nwatch/long/cxl     pine L {2} / C {3}\nmisses incl cxl    visual compare required\nmilestones         TP1 {6} / STOP {7}\nrealistic net      net rows {8} / {9:F2}\nbase lines         M blue | S lime | both yellow\nmancini ctx        target purple | read gray\nlevels             total {1} manual {12}\nmanual file        {14}\nsaty               {13}\nsaty values        prev {10} atr {11}\nchart-only: no order APIs",
                sessionDate,
                levels.Count,
                pineLong,
                pineCancel,
                nativeLong,
                nativeCancel,
                tp1,
                stops,
                netRows,
                net,
                FormatPrice(previousClose),
                FormatPrice(satyAtr),
                externalLevelCount,
                satyStatus,
                levelFileStatus);
        }

        private static Brush LevelBrush(string source)
        {
            if (source == "mancini") return Brushes.DodgerBlue;
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
            return source == "mancini"
                || source == "saty_call_trigger"
                || source == "saty_put_trigger"
                || source.StartsWith("saty_atr", StringComparison.Ordinal)
                ? 2
                : 1;
        }

        private static string LevelLabel(LukeOverlayLevel level)
        {
            return level.Source.Replace("saty_", "S ").Replace("_", " ") + " " + FormatPrice(level.Price);
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
            public DateTime Time;
            public DateTime BarTime;
            public double Price;
            public double Net;

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

                string eventText = source == "pine" ? ExtractString(json, "type") : ExtractString(json, "event");
                string kind = NormalizeKind(eventText);
                if (string.IsNullOrWhiteSpace(kind))
                    return null;

                DateTime ts = ExtractTime(json, "ts");
                if (ts == DateTime.MinValue)
                    ts = ExtractTime(json, "received_at");
                DateTime bar = ExtractTime(json, "bar_time");
                double entry = ExtractDouble(json, "entry");
                double price = IsFinite(entry) ? entry : ExtractDouble(json, "price");
                double net = ExtractDouble(json, "net");

                return new LukeOverlayEvent
                {
                    Source = source,
                    Kind = kind,
                    Time = ts == DateTime.MinValue ? DateTime.UtcNow : ts,
                    BarTime = bar,
                    Price = price,
                    Net = net
                };
            }

            private static string NormalizeKind(string value)
            {
                string text = (value ?? string.Empty).ToUpperInvariant();
                if (text.Contains("LONG")) return "LONG";
                if (text.Contains("CANCEL")) return "CANCEL";
                if (text.Contains("TP1")) return "TP1";
                if (text.Contains("STOP")) return "STOP";
                if (text.Contains("PING")) return "PING";
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

            private static bool IsFinite(double value)
            {
                return !double.IsNaN(value) && !double.IsInfinity(value);
            }
        }
    }
}
