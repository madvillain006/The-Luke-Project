const fs = require("fs");
const path = require("path");
const { parseXimes } = require("./parse-ximes");
const { parseBobby } = require("./parse-bobby");
const { detectConfluence, inferInstrument } = require("./confluence");
const { checkEmotionalState, loadTodayContext } = require("./emotional-exits");
const { log } = require("./logger");
const { getSiennaRegime } = require("./sienna-regime");
const { isWeekend, isMarketOpen, isGoodTradingTime, minsUntilOpen } = require("./market-hours");
const { calculateBracket } = require("./bracket-calc");

const JARVIS_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(JARVIS_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LEVELS_FILE = path.join(DATA_DIR, "today-levels.json");
const LAST_SIGNAL_FILE = path.join(DATA_DIR, "last-signal.json");
const TRADES_JSONL = path.join(JARVIS_ROOT, "trades.jsonl");
const DISCORD_HISTORY = path.join(JARVIS_ROOT, "discord-history.jsonl");

const loadLevels = (today) => {
  try { return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8")); } catch { return { date: today, richyd: [], bobby: [] }; }
};
const saveLevels = (obj) => fs.writeFileSync(LEVELS_FILE, JSON.stringify(obj, null, 2));

const saveLastSignal = (ticker, verdict) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const etTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
    fs.writeFileSync(LAST_SIGNAL_FILE, JSON.stringify({ date: today, time: etTime, ticker: ticker || "?", verdict }));
  } catch {}
};

const loadDiscord48h = () => {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  try {
    return fs.readFileSync(DISCORD_HISTORY, "utf8")
      .split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      .filter(m => new Date(m.timestamp || m.ts || 0).getTime() >= cutoff);
  } catch { return []; }
};

function sourceLabel(s) {
  if (s === "ximes:LIVE_ENTRY") return "Ximes entry";
  if (s === "ximes:PRE_MARKET_SETUP") return "Ximes pre-mkt";
  if (s === "ximes:CONTEXT") return "Ximes context";
  if (s === "ximes:SIZING_NOTE") return "Ximes sizing";
  if (s === "richydubz:CONTEXT") return "RichyDubz level";
  if (s === "bobby:king_node") return "Bobby king node";
  if (s === "bobby:support") return "Bobby support";
  if (s === "bobby:resistance") return "Bobby resistance";
  if (s === "bobby:has_image") return "Bobby image";
  return s;
}

const RICHY_TICKERS = /\b(SPY|SPX|QQQ|ES|NQ|MNQ|MES)\b/i;
const RICHY_TICKER_PRICE_RE = /\b(SPY|SPX|QQQ|ES|NQ|MNQ|MES)\s+([\d,]+(?:\.\d+)?)/gi;

function extractRichydubzLevels(line) {
  const results = [];
  const isPriorityWatches = /priority watches:/i.test(line);
  const hasTicker = RICHY_TICKERS.test(line);
  if (!isPriorityWatches && !hasTicker) return results;

  let tag = 'key_level';
  if (/\b(demand|support)\b/i.test(line)) tag = 'support';
  else if (/\b(resistance|supply)\b/i.test(line)) tag = 'resistance';

  const bias = tag === 'support' ? 'BULLISH' : tag === 'resistance' ? 'BEARISH' : 'NEUTRAL';
  const raw = line.slice(0, 150);

  for (const [, ticker, price] of [...line.matchAll(RICHY_TICKER_PRICE_RE)]) {
    results.push({
      signal_type: 'CONTEXT',
      analyst: 'richydubz',
      source: 'richydubz:CONTEXT',
      ticker: ticker.toUpperCase(),
      level: parseFloat(price.replace(/,/g, '')),
      tag,
      bias,
      confidence: 'MEDIUM',
      raw
    });
  }
  return results;
}

function handleSlashCommand(message, res) {
  const today = new Date().toISOString().slice(0, 10);

  if (message.startsWith("/levels ")) {
    const text = message.slice(8).trim();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const richyd = [];
    const richyd_structured = [];
    for (const l of lines) {
      const parsed = parseXimes("richydubz", l, null, null, null);
      if (parsed) {
        richyd.push(parsed);
      } else {
        richyd_structured.push(...extractRichydubzLevels(l));
      }
    }
    const bobby = parseBobby(text);
    const obj = loadLevels(today);
    obj.date = today;
    obj.richyd = richyd;
    obj.richyd_structured = richyd_structured;
    if (bobby) obj.bobby = [bobby];
    saveLevels(obj);
    const totalRichy = richyd.length + richyd_structured.length;
    return res.json({ reply: `Today's levels saved. ${totalRichy} RichyDubz levels, ${obj.bobby.length} Bobby nodes.` });
  }

  if (message.startsWith("/heatmap ")) {
    const text = message.slice(9).trim();
    const bobby = parseBobby(text);
    const obj = loadLevels(today);
    if (bobby) {
      obj.bobby = [...(obj.bobby || []), bobby];
      saveLevels(obj);
      return res.json({ reply: `Heatmap context updated. ${[...obj.bobby].length} nodes found.` });
    }
    return res.json({ reply: "No prices found in heatmap text." });
  }

  if (message.trim() === "/confluence") {
    if (!fs.existsSync(LEVELS_FILE)) {
      return res.json({ reply: "⚠️ No levels loaded today. Paste /levels and /heatmap first." });
    }
    const obj = loadLevels(today);
    if (obj.date !== today) {
      return res.json({ reply: "⚠️ No levels loaded today. Paste /levels and /heatmap first." });
    }
    const richydCount = (obj.richyd || []).length;
    const bobbyCount = (obj.bobby || []).length;
    const recentMsgs = loadDiscord48h();
    const extraBobby = recentMsgs
      .filter(m => m.author?.username === "bobby" || m.channel?.includes("bobby") || m.channel?.includes("heatmap"))
      .map(m => parseBobby(m.content || "")).filter(Boolean);
    const allBobby = [...(obj.bobby || []), ...extraBobby];
    const zones = detectConfluence(obj.richyd || [], allBobby, null);

    const displayZones = zones.filter(z => z.confidence === "HIGH" || z.confidence === "MEDIUM");
    const sep = "━━━━━━━━━━━━━━━━━━━━";
    if (displayZones.length === 0) {
      return res.json({ reply: `📊 TODAY'S CONFLUENCE ZONES\n${sep}\nNo HIGH or MEDIUM zones yet.\n${sep}\nLoaded: ${richydCount} RichyDubz levels · ${bobbyCount + extraBobby.length} Bobby nodes` });
    }
    const zoneLines = displayZones.map(z => {
      const icon = z.confidence === "HIGH" ? "🔴" : "🟡";
      const conf = z.confidence === "HIGH" ? "HIGH" : "MED ";
      const instrLabel = z.instrument === 'ES_NQ' ? 'ES/NQ' : z.instrument === 'SPX' ? 'SPX' : z.instrument === 'SPY_QQQ' ? 'SPY' : z.instrument || 'UNK';
      const srcStr = z.sources.slice(0, 3).map(sourceLabel).join(" + ");
      return `${icon} ${conf}  ${z.level} ${instrLabel} ${z.bias} (score: ${z.score})\n         Sources: ${srcStr}`;
    });
    return res.json({ reply: `📊 TODAY'S CONFLUENCE ZONES\n${sep}\n${zoneLines.join("\n")}\n${sep}\nLoaded: ${richydCount} RichyDubz levels · ${bobbyCount + extraBobby.length} Bobby nodes` });
  }

  if (message.startsWith("/alert ")) {
    const text = message.slice(7).trim();

    if (isWeekend()) return res.json({ reply: "❌ Market closed. Weekend." });
    if (!isMarketOpen().open) return res.json({ reply: "⏰ Market closed. Opens 9:30 AM ET. Use this time to prep levels." });
    const _tradingTime = isGoodTradingTime();
    if (!_tradingTime.good) {
      if (_tradingTime.window === "lunch") return res.json({ reply: "⚠️ Lunch chop window. High risk. Skip unless A+ setup only." });
      if (_tradingTime.window === "last10") return res.json({ reply: "⚠️ Last 10 mins. Ximes says no responsibility after 3:49 PM." });
    }

    const tradeCtx = loadTodayContext();
    const exitWarnings = checkEmotionalState(tradeCtx);
    const hardBlock = exitWarnings.find(w => w.type === "HARD");
    if (hardBlock) return res.json({ reply: `${hardBlock.emoji} ${hardBlock.message}` });
    const softWarnings = exitWarnings.filter(w => w.type === "SOFT");

    const TRUSTED_USERNAMES = ["followthewhiterabblt", "ximestrades", "richydubz"];
    let signal = null;
    let detectedUsername = null;

    const tsMatch = text.match(/\[(\d{1,2}:\d{2}\s*[AP]M)\]/i);
    const signalTimestamp = tsMatch ? tsMatch[1] : null;

    const uFromText = text.match(/\[\d{1,2}:\d{2}\s*[AP]M\]\s+(\S+)/i);
    if (uFromText) {
      const candidate = uFromText[1].toLowerCase();
      if (TRUSTED_USERNAMES.includes(candidate)) {
        detectedUsername = candidate;
        signal = parseXimes(candidate, text, null, null, null);
      }
    }
    if (!signal) {
      for (const uname of TRUSTED_USERNAMES) {
        const parsed = parseXimes(uname, text, null, null, null);
        if (parsed) { signal = parsed; detectedUsername = uname; break; }
      }
    }
    if (!signal) signal = parseXimes("followthewhiterabblt", text, null, null, null);

    if (!signal) return res.json({ reply: "❌ SKIP — could not parse signal" });
    if (signalTimestamp) signal.signal_time = signalTimestamp;

    log("alert", { event: "auto-username detection", detected: detectedUsername, timestamp: signalTimestamp });

    const obj = loadLevels(today);
    const zones = detectConfluence([signal, ...(obj.richyd || [])], obj.bobby || [], null);
    const strike = signal.strike || signal.entry_price || null;
    if (!strike) return res.json({ reply: "❌ SKIP — no strike found in signal" });
    const instrument = inferInstrument(strike);
    const instrLabel = instrument === 'ES_NQ' ? 'ES/NQ' : instrument === 'SPX' ? 'SPX' : instrument === 'SPY_QQQ' ? 'SPY' : 'UNK';
    const tol = instrument === 'ES_NQ' ? 10 : 2;
    const hit = zones.find(z => Math.abs(z.level - strike) <= tol * 2);

    const _etParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(new Date());
    const _etH = parseInt(_etParts.find(p => p.type === "hour")?.value || "0");
    const _etM = parseInt(_etParts.find(p => p.type === "minute")?.value || "0");
    const _etMins = _etH * 60 + _etM;
    const _isMorning = _etMins >= 570 && _etMins <= 660;
    const _isAfternoon = _etMins >= 840 && _etMins <= 950;
    let edgeNote = null;
    if (_isMorning && (instrLabel === "SPY" || instrLabel === "SPX")) {
      edgeNote = "📋 Edge match: Ximes morning window (9:30–11:00 AM) — preferred setup";
    } else if (_isMorning) {
      edgeNote = "📋 Edge match: Morning window — Ximes preferred SPY/SPX 0-1DTE play";
    } else if (_isAfternoon) {
      edgeNote = "📋 Edge match: Afternoon window (2–3:50 PM) — higher risk, size down ⚠️";
    }

    const softSuffix = softWarnings.length > 0
      ? "\n" + softWarnings.map(w => `${w.emoji} ${w.message}`).join("\n")
      : "";
    const edgeSuffix = edgeNote ? "\n" + edgeNote : "";
    const timeSuffix = signalTimestamp ? ` [${signalTimestamp}]` : "";

    if (!hit) {
      saveLastSignal(signal.ticker || instrLabel, "SKIP");
      return res.json({ reply: `❌ SKIP — no confluence at ${strike} (${instrLabel}) today${timeSuffix}${softSuffix}` });
    }

    const regime = getSiennaRegime();
    let todayTradeCount = 0;
    try {
      todayTradeCount = fs.readFileSync(TRADES_JSONL, "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(today) || (t.timestamp || "").startsWith(today))).length;
    } catch {}
    const regimeLine = `\n🌡️ Regime: ${regime.regime} — ${regime.reason}`;

    if (todayTradeCount >= regime.max_trades_today) {
      saveLastSignal(signal.ticker || instrLabel, "BLOCKED");
      return res.json({ reply: `🚫 BLOCKED — max ${regime.max_trades_today} trades today reached [${regime.regime}]${regimeLine}${timeSuffix}${softSuffix}` });
    }

    if (hit.confidence === "HIGH") {
      const direction = signal.direction || (signal.bias === "BULLISH" ? "LONG" : signal.bias === "BEARISH" ? "SHORT" : null);
      const ticker = signal.ticker || instrLabel;

      const bracketSignal = { ...signal, ticker, direction };
      const bracket = calculateBracket(bracketSignal, zones, strike);

      if (bracket.error) {
        saveLastSignal(ticker, "SKIP");
        return res.json({ reply: `❌ SKIP — bracket error: ${bracket.error}` });
      }

      if (bracket.flag === "reject") {
        saveLastSignal(ticker, "SKIP");
        return res.json({ reply: `❌ SKIP — ${ticker} ${direction} ${strike}${timeSuffix}\n${bracket.flag_message}\nR:R 1:${bracket.rr_ratio}${regimeLine}${edgeSuffix}${softSuffix}` });
      }

      let verdict = "SETUP";
      let verdictEmoji = "✅";
      let weakLine = "";
      if (bracket.flag === "warning") {
        verdict = "WEAK";
        verdictEmoji = "⚠️";
        weakLine = `\n⚠️ ${bracket.flag_message}`;
      }

      saveLastSignal(ticker, verdict);
      log("alert", { event: "bracket calc complete", rr: bracket.rr_ratio, flag: bracket.flag || "ok" });

      const stopLine   = `${bracket.stop}  (${bracket.stop_ticks} ticks | -$${bracket.risk_dollars})`;
      const targetLine = `${bracket.target}  (${bracket.target_ticks} ticks | +$${bracket.reward_dollars})`;
      const replyText = [
        `${verdictEmoji} ${verdict} — ${ticker} ${direction}${timeSuffix}`,
        `Entry:  ${bracket.entry}`,
        `Stop:   ${stopLine}`,
        `Target: ${targetLine}`,
        `R:R     1:${bracket.rr_ratio}`,
        `Confluence: ${hit.score} ${hit.confidence}`,
        `Regime: ${regime.regime}`,
      ].join("\n") + weakLine + edgeSuffix + softSuffix;

      return res.json({
        reply: replyText,
        bracket: {
          entry:         bracket.entry,
          stop:          bracket.stop,
          target:        bracket.target,
          stop_ticks:    bracket.stop_ticks,
          target_ticks:  bracket.target_ticks,
          risk_dollars:  bracket.risk_dollars,
          reward_dollars: bracket.reward_dollars,
          rr_ratio:      bracket.rr_ratio,
          instrument:    bracket.instrument,
          direction,
          ticker,
          confluence_score: hit.score,
          confluence_confidence: hit.confidence,
          sienna_regime: regime.regime,
        }
      });
    }

    saveLastSignal(signal.ticker || instrLabel, "WEAK");
    return res.json({ reply: `⚠️ WEAK — ${hit.confidence} confluence at ${hit.level} (${instrLabel}) (score: ${hit.score})${timeSuffix}${regimeLine}${edgeSuffix}${softSuffix}` });
  }

  if (message.startsWith("/trade ")) {
    const VALID_FORMAT = "Format: /trade [LONG/SHORT] [ticker] [entry] [exit] [WIN/LOSS/SCRATCH]";
    const parts = message.slice(7).trim().split(/\s+/);
    if (parts.length < 5) return res.json({ reply: VALID_FORMAT });
    const [rawDir, rawTicker, rawEntry, rawExit, rawResult] = parts;
    const direction = rawDir.toUpperCase();
    const ticker = rawTicker.toUpperCase();
    const entry = parseFloat(rawEntry);
    const exit = parseFloat(rawExit);
    const result = rawResult.toUpperCase();
    if (!["LONG", "SHORT"].includes(direction)) return res.json({ reply: VALID_FORMAT });
    if (!["SPY", "SPX", "NQ", "ES", "QQQ", "MNQ", "MES"].includes(ticker)) return res.json({ reply: VALID_FORMAT });
    if (isNaN(entry) || isNaN(exit)) return res.json({ reply: VALID_FORMAT });
    if (!["WIN", "LOSS", "SCRATCH"].includes(result)) return res.json({ reply: VALID_FORMAT });
    const pnl = direction === "LONG" ? parseFloat((exit - entry).toFixed(2)) : parseFloat((entry - exit).toFixed(2));
    const levelObj = loadLevels(today);
    const confluence_used = !!(levelObj && levelObj.date === today && ((levelObj.richyd || []).length > 0 || (levelObj.bobby || []).length > 0));
    const tradeEntry = {
      date: today,
      timestamp: new Date().toISOString(),
      direction, ticker, entry, exit, result, pnl, confluence_used
    };
    fs.appendFileSync(TRADES_JSONL, JSON.stringify(tradeEntry) + "\n");
    const sign = pnl >= 0 ? "+" : "";
    return res.json({ reply: `✅ Trade logged. ${direction} ${ticker} ${entry}→${exit} ${result} (${sign}${pnl} pts)` });
  }

  if (message.trim() === "/review") {
    let todayTrades = [];
    try {
      const lines = fs.readFileSync(TRADES_JSONL, "utf8").split("\n").filter(Boolean);
      todayTrades = lines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date && t.date.startsWith(today)) || (t.timestamp && t.timestamp.startsWith(today))))
        .filter(t => t.result === "WIN" || t.result === "LOSS" || t.result === "SCRATCH");
    } catch {}
    if (todayTrades.length === 0) return res.json({ reply: "No trades logged today." });
    const wins = todayTrades.filter(t => t.result === "WIN").length;
    const losses = todayTrades.filter(t => t.result === "LOSS").length;
    const netPts = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const sign = netPts >= 0 ? "+" : "";
    const header = `📊 Today: ${todayTrades.length} trades | ${wins}W ${losses}L | Net: ${sign}${netPts.toFixed(2)} pts`;
    const tradeLines = todayTrades.map(t => {
      const ps = (t.pnl >= 0 ? "+" : "") + t.pnl;
      return `  ${t.direction} ${t.ticker} ${t.entry}→${t.exit} ${t.result} (${ps} pts)`;
    });
    const tradeCtx = loadTodayContext();
    const exitWarnings = checkEmotionalState(tradeCtx);
    const stateLines = exitWarnings.length > 0
      ? ["Emotional state: " + exitWarnings.map(w => `${w.emoji} ${w.message}`).join(" | ")]
      : ["Emotional state: ✅ Clear"];
    return res.json({ reply: [header, ...tradeLines, ...stateLines].join("\n") });
  }

  if (message.trim() === "/reset") {
    try { if (fs.existsSync(LEVELS_FILE)) fs.unlinkSync(LEVELS_FILE); } catch {}
    try {
      if (fs.existsSync(LAST_SIGNAL_FILE)) fs.unlinkSync(LAST_SIGNAL_FILE);
    } catch {}
    log("UX", { event: "daily reset command" });
    return res.json({ reply: "✅ Daily reset complete. Paste /levels and /heatmap to start." });
  }

  if (message.trim() === "/status") {
    const statusLines = [];
    statusLines.push("JARVIS ONLINE ✅");
    statusLines.push("");

    const _mkt = isMarketOpen();
    const _tt  = isGoodTradingTime();
    let _cd = null;
    if (_mkt.open) {
      statusLines.push(`🕐 Market: OPEN — ${_tt.message}`);
    } else {
      const _mins = minsUntilOpen();
      const _h = Math.floor(_mins / 60);
      const _m = _mins % 60;
      _cd = _h > 0 ? `${_h}h ${_m}m` : `${_m}m`;
      statusLines.push(`🕐 Market: CLOSED — Opens in ${_cd}`);
    }

    if (fs.existsSync(LEVELS_FILE)) {
      const obj = loadLevels(today);
      if (obj.date === today) {
        const r = (obj.richyd || []).length + (obj.richyd_structured || []).length;
        const b = (obj.bobby || []).length;
        statusLines.push(`Levels: ✅ loaded (${r} RichyDubz, ${b} Bobby)`);
      } else {
        statusLines.push("Levels: ❌ not loaded (stale date)");
      }
    } else {
      statusLines.push("Levels: ❌ not loaded");
    }

    let statusTrades = [];
    try {
      statusTrades = fs.readFileSync(TRADES_JSONL, "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(today) || (t.timestamp || "").startsWith(today)))
        .filter(t => t.result === "WIN" || t.result === "LOSS" || t.result === "SCRATCH");
    } catch {}
    const stWins = statusTrades.filter(t => t.result === "WIN").length;
    const stLosses = statusTrades.filter(t => t.result === "LOSS").length;
    const stNet = statusTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    statusLines.push(`Trades: ${statusTrades.length} trades, ${stWins}W ${stLosses}L, net ${stNet >= 0 ? "+" : ""}${stNet.toFixed(2)} pts`);

    if (!_mkt.open) {
      statusLines.push(`State: 🔵 CLOSED — Market opens in ${_cd}`);
    } else {
      const stTradeCtx = loadTodayContext();
      const stWarnings = checkEmotionalState(stTradeCtx);
      const stHard = stWarnings.find(w => w.type === "HARD");
      const stSoft = stWarnings.filter(w => w.type === "SOFT");
      if (stHard) {
        statusLines.push(`State: 🔴 RED — ${stHard.message}`);
      } else if (stSoft.length > 0) {
        statusLines.push(`State: 🟡 YELLOW — ${stSoft.map(w => w.message).join(" | ")}`);
      } else {
        statusLines.push("State: 🟢 GREEN");
      }
    }

    try {
      const regime = getSiennaRegime();
      statusLines.push(`Regime: 🌡️ ${regime.regime} — ${regime.reason}`);
    } catch {}

    try {
      if (fs.existsSync(LAST_SIGNAL_FILE)) {
        const sig = JSON.parse(fs.readFileSync(LAST_SIGNAL_FILE, "utf8"));
        if (sig.date === today) {
          statusLines.push(`Last signal: ${sig.time} ${sig.ticker} — ${sig.verdict}`);
        } else {
          statusLines.push("Last signal: none today");
        }
      } else {
        statusLines.push("Last signal: none today");
      }
    } catch { statusLines.push("Last signal: none today"); }

    const etParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(new Date());
    const etH = parseInt(etParts.find(p => p.type === "hour").value);
    const etM = parseInt(etParts.find(p => p.type === "minute").value);
    const etMins = etH * 60 + etM;
    statusLines.push("Luke meds:");
    statusLines.push(`  4:00 AM omeprazole — ${etMins >= 240 ? "✅ due" : "⏰ upcoming"}`);
    statusLines.push(`  4:30 AM mirtazapine + prednisone — ${etMins >= 270 ? "✅ due" : "⏰ upcoming"}`);

    return res.json({ reply: statusLines.join("\n") });
  }

  if (message.trim() === "/layout") {
    const { exec } = require("child_process");
    const layoutScript = path.join(JARVIS_ROOT, "scripts", "trading-layout.py");
    exec(`python "${layoutScript}"`, (err) => {
      if (err) log("layout", { event: "layout script error", error: err.message });
    });
    return res.json({
      reply: [
        "📐 Layout starting...",
        "1. Positioning Jarvis ✓",
        "2. Opening ximes-dubz (scrolling to bottom)",
        "3. Opening bobby-spx-coms (scrolling to bottom)",
        "4. Opening Tradovate (checking login)",
        "Type /status when ready to trade."
      ].join("\n")
    });
  }

  return null;
}

module.exports = { handleSlashCommand };
