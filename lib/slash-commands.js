const fs = require("fs");
const path = require("path");
const { writeJsonAtomic, appendJsonl } = require("../state/lib");
const { loadMemory, saveMemory } = require("./memory");
const { parseXimes, getSessionContext,
        resetSessionContext } = require("./parse-ximes");
const { parseBobby, parseBobbyImage, mergeBobby } = require("./parse-bobby");
const { detectConfluence, inferInstrument } = require("./confluence");
const { katSignalsToZones, getRecentKatSignals, getKatContextSummary } = require('./kat-confluence');
const { checkEmotionalState, loadTodayContext } = require("./emotional-exits");
const { log } = require("./logger");
const { logSignalReplay, todaySummary } = require("./session-replay");
const { getSiennaRegime } = require("./sienna-regime");
const { isWeekend, isMarketOpen, isGoodTradingTime, minsUntilOpen } = require("./market-hours");
const { calculateBracket } = require("./bracket-calc");
const { APEX: APEX_CFG } = require("./config");
const { loadState, saveState } = require("../trading/common");
const { loadSatyLevels, saveSatyLevels, parseSatyText, getSatyRecommendation, buildStatusSummary } = require('./saty-levels');
const { parseDubzText, parseDubzImage, mergeDubzInputs, loadDubzState, saveDubzState, buildDubzStatus } = require('./parse-dubz');
const { getLivePrice } = require('./live-price');

const LUKE_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(LUKE_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LEVELS_FILE        = path.join(DATA_DIR, "today-levels.json");
const LAST_SIGNAL_FILE   = path.join(DATA_DIR, "last-signal.json");
const ACTIVE_TRADE_FILE  = path.join(DATA_DIR, "active-trade.json");
const APEX_STATE_FILE    = path.join(DATA_DIR, "apex-state.json");
const TRADES_JSONL       = path.join(LUKE_ROOT, "trades.jsonl");
const DISCORD_HISTORY    = path.join(LUKE_ROOT, "discord-history.jsonl");
const BOBBY_CONTEXT_JSONL = path.join(LUKE_ROOT, "bobby-context.jsonl");

// ── ALERT DEDUP (BLOCKER 2) ──────────────────────────────────────────────────
const recentAlerts = new Map(); // key → timestamp
const ALERT_DEDUP_MS = 60 * 1000;

function dedupKey(signal) {
  const ticker = (signal.ticker || signal.instrument || 'UNK').toUpperCase();
  const dir    = signal.direction || 'UNK';
  const strike = signal.strike || signal.entry_price || 0;
  return `${ticker}:${dir}:${strike}`;
}

function checkAlertDedup(signal) {
  const now = Date.now();
  // clean old entries
  for (const [k, ts] of recentAlerts) {
    if (now - ts > 5 * 60 * 1000) recentAlerts.delete(k);
  }
  const key = dedupKey(signal);
  const last = recentAlerts.get(key);
  if (last && now - last < ALERT_DEDUP_MS) {
    const ago = Math.round((now - last) / 1000);
    return `🔁 Duplicate alert (fired ${ago}s ago). Ignoring.`;
  }
  recentAlerts.set(key, now);
  return null;
}

// ── APEX STATE ───────────────────────────────────────────────────────────────
function loadApexState() {
  try {
    if (!fs.existsSync(APEX_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(APEX_STATE_FILE, "utf8"));
  } catch { return null; }
}

// ── ACTIVE TRADE STATE (BLOCKER 3) ──────────────────────────────────────────
function loadActiveTrade() {
  try {
    if (!fs.existsSync(ACTIVE_TRADE_FILE)) return null;
    const obj = JSON.parse(fs.readFileSync(ACTIVE_TRADE_FILE, 'utf8'));
    return obj && obj.status === 'open' ? obj : null;
  } catch { return null; }
}

function writeActiveTrade(signal, bracket, extra) {
  const entry = {
    status: 'open',
    opened_at: new Date().toISOString(),
    ticker: signal.ticker || '',
    direction: signal.direction || '',
    strike: signal.strike || signal.entry_price || null,
    bracket: bracket || null,
    ...(extra || {})
  };
  try { writeJsonAtomic(ACTIVE_TRADE_FILE, entry); } catch {}
}

function clearActiveTrade() {
  try { if (fs.existsSync(ACTIVE_TRADE_FILE)) fs.unlinkSync(ACTIVE_TRADE_FILE); } catch {}
}

// ── VISION RATE LIMIT (BLOCKER 1) ────────────────────────────────────────────
let lastVisionCallMs = 0;
let lastDubzVisionCallMs = 0;
const VISION_RATE_LIMIT_MS = 30 * 1000;

const loadLevels = (today) => {
  try { return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8")); } catch { return { date: today, richyd: [], bobby: [] }; }
};
const saveLevels = (obj) => writeJsonAtomic(LEVELS_FILE, obj);

const saveLastSignal = (ticker, verdict) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const etTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
    writeJsonAtomic(LAST_SIGNAL_FILE, { date: today, time: etTime, ticker: ticker || "?", verdict });
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
const DUBZ_PRICE_FLOORS = { SPX: 3000, ES: 3000, MES: 3000, NQ: 10000, MNQ: 10000, SPY: 200, QQQ: 200 };
const LEVEL_AT_PRICE_RE = /\b(?:HOD|LOD|high of day|low of day|support|resistance|failure|failing|rejection|rejecting|bounce|bouncing|hold|holding|break|breaking)\b[^0-9]{0,25}\bat\s+([\d,]+(?:\.\d+)?)/gi;

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

  const seenLevels = new Set();
  for (const [, ticker, price] of [...line.matchAll(RICHY_TICKER_PRICE_RE)]) {
    const level = parseFloat(price.replace(/,/g, ''));
    results.push({
      signal_type: 'CONTEXT',
      analyst: 'richydubz',
      source: 'richydubz:CONTEXT',
      ticker: ticker.toUpperCase(),
      level,
      tag,
      bias,
      confidence: 'MEDIUM',
      raw
    });
    seenLevels.add(`${ticker.toUpperCase()}:${level}`);
  }

  // Second pass: carry last-seen ticker to bare numbers following level-phrase "at [price]" patterns.
  // Requires "at" between the phrase and the number to avoid false positives from proximity alone.
  const tickerPositions = [];
  const tickerScanRe = /\b(SPY|SPX|QQQ|ES|NQ|MNQ|MES)\b/gi;
  for (const m of line.matchAll(tickerScanRe)) {
    tickerPositions.push({ pos: m.index, ticker: m[1].toUpperCase() });
  }
  if (tickerPositions.length > 0) {
    for (const m of line.matchAll(LEVEL_AT_PRICE_RE)) {
      const priceStr = m[1];
      const level = parseFloat(priceStr.replace(/,/g, ''));
      const pricePos = m.index + m[0].length - priceStr.length;
      let assignedTicker = null;
      for (const tp of tickerPositions) {
        if (tp.pos < pricePos) assignedTicker = tp.ticker;
      }
      if (!assignedTicker) continue;
      const floor = DUBZ_PRICE_FLOORS[assignedTicker] ?? 50;
      if (level < floor) continue;
      const key = `${assignedTicker}:${level}`;
      if (seenLevels.has(key)) continue;
      seenLevels.add(key);
      results.push({
        signal_type: 'CONTEXT',
        analyst: 'richydubz',
        source: 'richydubz:CONTEXT',
        ticker: assignedTicker,
        level,
        tag,
        bias,
        confidence: 'MEDIUM',
        raw
      });
    }
  }

  return results;
}

async function handleSlashCommand(message, res) {
  if (message.trim() === "/levels") {
    return res.json({ reply: "📋 Paste RichyDubz levels then run:\n/levels [paste text here]\n\nExample:\n/levels ES 5850 support\nSPY 582 resistance" });
  }

  if (message.startsWith("/levels ")) {
    const today = new Date().toISOString().split('T')[0];
    const text = message.slice(8).trim();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const richyd = [];
    const richyd_structured = [];
    for (const l of lines) {
      const parsed = parseXimes(null, l);
      if (parsed) richyd.push(parsed);

      const dubzLine = l.replace(/[_*]{2}/g, '');
      const dubzHits = extractRichydubzLevels(dubzLine);
      if (dubzHits.length) richyd_structured.push(...dubzHits);
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

  if (message.trim() === "/heatmap") {
    return res.json({ reply: "🌡️ Paste Bobby's heatmap text then run:\n/heatmap [paste text here]\n\nOr paste the image directly into chat — vision will parse it automatically." });
  }

  if (message.startsWith("/heatmap ")) {
    const today = new Date().toISOString().split('T')[0];
    const text = message.slice(9).trim();
    const textBobby = parseBobby(text);
    const obj = loadLevels(today);
    const now = Date.now();
    let visionBobby = null;
    let visionNote = '';

    let visionFailed = false;
    if (res._heatmapImage) {
      if (now - lastVisionCallMs < VISION_RATE_LIMIT_MS) {
        const waitSecs = Math.ceil((VISION_RATE_LIMIT_MS - (now - lastVisionCallMs)) / 1000);
        visionNote = ` (vision rate-limited — retry in ${waitSecs}s)`;
      } else {
        lastVisionCallMs = now;
        try {
          const visionResult = await parseBobbyImage(res._heatmapImage);
          if (visionResult && visionResult.parse_status === 'failed') {
            visionFailed = true;
            visionNote = `\n❌ Vision error: ${visionResult.error}`;
          } else if (visionResult) {
            visionBobby = visionResult;
            visionBobby.date = new Date().toISOString();
            visionBobby.channel = 'bobby-spx-coms';
            visionBobby.vision_parsed = true;
            fs.appendFileSync(BOBBY_CONTEXT_JSONL, JSON.stringify(visionBobby) + '\n');
            log('heatmap-vision', { nodes: visionBobby.king_nodes.length + visionBobby.support.length + visionBobby.resistance.length });
            visionNote = ' + vision parsed';
          } else {
            visionFailed = true;
            visionNote = `\n❌ Vision returned no data`;
          }
        } catch (err) {
          visionFailed = true;
          visionNote = `\n❌ Vision error: ${err.message}`;
        }
      }
    }

    const merged = mergeBobby(textBobby, visionBobby);
    if (merged) {
      obj.bobby = [...(obj.bobby || []), merged];
      saveLevels(obj);
      const nodeCount = (merged.king_nodes || []).length + (merged.support || []).length + (merged.resistance || []).length;
      const mixedSuccess = visionFailed && textBobby;
      const heatmapPrefix = mixedSuccess ? '⚠️ Partial parse — text levels captured, image vision failed\n' : '';
      const tailNote      = mixedSuccess ? visionNote : '';
      const inlineNote    = mixedSuccess ? '' : visionNote;
      return res.json({ reply: `${heatmapPrefix}Heatmap context updated. ${nodeCount} nodes found${inlineNote}.${tailNote}` });
    }
    return res.json({ reply: `${visionFailed && !textBobby ? '❌ ' : ''}No prices found in heatmap text${visionNote}.` });
  }

  if (message.trim() === "/confluence") {
    const today = new Date().toISOString().split('T')[0];
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

  if (message.trim() === "/balance") {
    const apexNow = loadApexState();
    if (apexNow) {
      return res.json({ reply: `💰 Apex balance: ${apexNow.balance?.toLocaleString()} | Floor: ${apexNow.trail_floor?.toLocaleString()} | Headroom: ${(apexNow.balance - apexNow.trail_floor)?.toLocaleString()}\nLast updated: ${new Date(apexNow.updated).toLocaleString()}\n\nTo update: /balance 51200` });
    }
    return res.json({ reply: "💰 No balance set yet. Run:\n/balance [your current Apex balance]\nExample: /balance 50717" });
  }

  if (message.startsWith("/balance ")) {
    const raw = message.slice(9).trim().replace(/[$,]/g, "");
    const bal = parseFloat(raw);
    if (!bal || isNaN(bal)) return res.json({ reply: "❌ Format: /balance 51200" });
    const floor = bal - APEX_CFG.TRAIL_AMOUNT;
    const state = { balance: bal, trail_floor: floor, updated: new Date().toISOString() };
    writeJsonAtomic(APEX_STATE_FILE, state);
    return res.json({ reply: `Balance set: $${bal.toLocaleString()}. Trail floor auto-calculated: $${floor.toLocaleString()}.` });
  }

  function checkSessionReadiness() {
    const warnings = [];
    try {
      // 1. BALANCE_FRESH
      const apexState = loadApexState();
      if (!apexState || !apexState.updated) {
        warnings.push("⚠️ /balance not run today — floor check may be stale");
      } else {
        const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const balanceET = new Date(apexState.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        if (balanceET !== todayET) warnings.push("⚠️ /balance not run today — floor check may be stale");
      }

      // 2. LEVELS_LOADED
      const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      if (fs.existsSync(LEVELS_FILE)) {
        const levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
        if (!levels.richyd || levels.richyd.length === 0 || levels.date !== todayET) {
          warnings.push("⚠️ No levels loaded — paste RichyDubz and run /levels");
        }
      } else {
        warnings.push("⚠️ No levels loaded — paste RichyDubz and run /levels");
      }

      // 3. BOBBY_LOADED
      if (fs.existsSync(LEVELS_FILE)) {
        const levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
        const bobby = levels.bobby || [];
        if (bobby.length === 0) {
          warnings.push("⚠️ No Bobby context — paste heatmap and run /heatmap");
        } else {
          const age = Date.now() - new Date(bobby[0].ts).getTime();
          if (age > 8 * 3600 * 1000) warnings.push("⚠️ Bobby context is stale (>8h) — repaste /heatmap");
        }
      }

      // 4. APEX FLOOR HEADROOM
      const apexFloorState = loadApexState();
      if (apexFloorState && typeof apexFloorState.balance === 'number' && typeof apexFloorState.trail_floor === 'number') {
        if (apexFloorState.balance - apexFloorState.trail_floor <= 500) {
          warnings.push("⚠️ Apex floor headroom < $500 — size down or skip");
        }
      }

      // 5. EMOTIONAL_CLEAR — already handled by existing hard block below
    } catch (e) {
      console.error('[readiness] check error:', e.message);
    }
    return { warnings };
  }

  if (message.trim() === "/ready") {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const sep = "━━━━━━━━━━━━━━━━━━━━";
    const checks = [];

    // 1. Balance set today
    const readyApex = loadApexState();
    if (readyApex && readyApex.updated) {
      const balET = new Date(readyApex.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      checks.push(balET === todayET ? "✅ Balance set today" : "❌ Balance NOT set today — run /balance");
    } else {
      checks.push("❌ Balance NOT set today — run /balance");
    }

    // 2. RichyDubz levels loaded
    let readyLevels = null;
    try { readyLevels = fs.existsSync(LEVELS_FILE) ? JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8')) : null; } catch {}
    if (readyLevels && readyLevels.date === todayET && (readyLevels.richyd || []).length > 0) {
      checks.push(`✅ RichyDubz levels loaded (${readyLevels.richyd.length} levels)`);
    } else {
      checks.push("❌ RichyDubz levels NOT loaded — paste levels and run /levels");
    }

    // 3. Bobby heatmap loaded
    if (readyLevels && (readyLevels.bobby || []).length > 0) {
      checks.push(`✅ Bobby heatmap loaded (${readyLevels.bobby.length} node sets)`);
    } else {
      checks.push("❌ Bobby heatmap NOT loaded — paste heatmap and run /heatmap");
    }

    // 4. Apex floor safe
    if (readyApex && typeof readyApex.balance === 'number' && typeof readyApex.trail_floor === 'number') {
      const headroom = readyApex.balance - readyApex.trail_floor;
      if (headroom > 500) {
        checks.push(`✅ Apex floor safe ($${headroom.toLocaleString()} headroom)`);
      } else {
        checks.push(`❌ Apex floor headroom < $500 ($${headroom.toLocaleString()}) — size down or skip`);
      }
    } else {
      checks.push("❌ Apex floor unknown — run /balance first");
    }

    const allPass = checks.every(c => c.startsWith("✅"));
    const verdict = allPass ? "✅ READY TO TRADE" : "❌ NOT READY — fix above before trading";
    return res.json({ reply: `🚦 SESSION READINESS\n${sep}\n${checks.join("\n")}\n${sep}\n${verdict}` });
  }

  if (message.trim() === "/alert") {
    return res.json({ reply: "📡 Paste a Ximes signal then run:\n/alert [paste signal here]\n\nExample:\n/alert [2:34 PM] ximestrades ES LONG 5880" });
  }

  if (message.startsWith("/alert ")) {
    const today = new Date().toISOString().split('T')[0];
    const _alertStart = Date.now();
    const text = message.slice(7).trim();
    const readiness = checkSessionReadiness();
    const readinessPrefix = readiness.warnings.length > 0
      ? '🚦 Session notes:\n' + readiness.warnings.join('\n') + '\n\n'
      : '';

    if (isWeekend()) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'weekend', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "❌ Market closed. Weekend." });
    }
    if (!isMarketOpen().open) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'market_closed', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "⏰ Market closed. Opens 9:30 AM ET. Use this time to prep levels." });
    }
    const _tradingTime = isGoodTradingTime();
    if (!_tradingTime.good) {
      if (_tradingTime.window === "lunch") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'lunch_window', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: "⚠️ Lunch chop window. High risk. Skip unless A+ setup only." });
      }
      if (_tradingTime.window === "last10") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'last_10_mins', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: "⚠️ Last 10 mins. Ximes says no responsibility after 3:49 PM." });
      }
    }

    const tradeCtx = loadTodayContext();
    const exitWarnings = checkEmotionalState(tradeCtx);
    const hardBlock = exitWarnings.find(w => w.type === "HARD");
    if (hardBlock) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'BLOCK', skip_reason: 'emotional_hard_block', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: `${hardBlock.emoji} ${hardBlock.message}` });
    }
    const softWarnings = exitWarnings.filter(w => w.type === "SOFT");

    const tsMatch = text.match(/\[(\d{1,2}:\d{2}\s*[AP]M)\]/i);
    const signalTimestamp = tsMatch ? tsMatch[1] : null;

    const uFromText = text.match(/\[\d{1,2}:\d{2}\s*[AP]M\]\s+(\S+)/i);
    const detectedUsername = uFromText ? uFromText[1].toLowerCase() : null;
    let signal = parseXimes(detectedUsername, text);

    if (!signal) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'parse_fail', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "❌ SKIP — could not parse signal" });
    }

    if (signal.signal_type === 'MANAGEMENT') {
      if (signal.action === 'TRIM') {
        const trimPct = signal.pct || 50;
        const trimActive = loadActiveTrade();
        let runnerLine = '';
        if (trimActive && trimActive.status === 'open') {
          trimActive.runner      = true;
          trimActive.runner_pct  = 100 - trimPct;
          trimActive.runner_stop = trimActive.strike;
          trimActive.trimmed_at  = new Date().toISOString();
          trimActive.trim_pct    = trimPct;
          try { writeJsonAtomic(ACTIVE_TRADE_FILE, trimActive); } catch {}
          runnerLine = '\n🏃 Runner set — ' + (100 - trimPct) + '% remaining.' +
                       '\n→ Stop: move to breakeven (' + trimActive.strike + ')' +
                       '\n→ Let Ximes call the exit. Do not touch it.';
        }
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'trim', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '✂️ TRIM — Ximes taking ' + trimPct + '% off.\n' +
          '→ Reduce position by ' + trimPct + '% NOW in Tradovate.' +
          runnerLine
        });
      }
      if (signal.action === 'RUNNER') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'runner', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '🏃 XIMES RUNNER — Hold partial position.\n' +
          (signal.sizing ? 'He has ' + signal.sizing +
            ' cons left (' + signal.pctRemaining + '%).\n' : '') +
          '→ Keep 20-25% on. Move stop to breakeven.' });
      }
      if (signal.action === 'CLOSE') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'close', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '🚪 XIMES EXIT — Close position now.' });
      }
      if (signal.action === 'ADD') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'add', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '➕ XIMES ADDING — He is sizing in further.\n' +
          '→ Consider adding within your risk parameters.' });
      }
      if (signal.action === 'STOP_UPDATE') {
        const price = signal.price ? '$' + signal.price : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'stop_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '⏺ STOP UPDATE — Move your stop to ' + price + '.\n' +
          '→ Adjust in Tradovate now. Do not wait.'
        });
      }
      if (signal.action === 'TARGET_UPDATE') {
        const ticker = signal.ticker ? signal.ticker + ' ' : '';
        const price  = signal.price  ? String(signal.price)  : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'target_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          '🎯 TARGET UPDATE — ' + ticker + 'new target: ' + price + '.\n' +
          '→ Adjust your OCO or mental target now.'
        });
      }
    }

    if (signalTimestamp) signal.signal_time = signalTimestamp;

    // BLOCKER 2 — alert dedup
    const dupMsg = checkAlertDedup(signal);
    if (dupMsg) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'dedup', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: dupMsg });
    }

    // BLOCKER 3 — active trade guard
    let runnerWarning = '';
    const activeTrade = loadActiveTrade();
    if (activeTrade) {
      if (activeTrade.runner) {
        runnerWarning = '⚠️ Runner active on ' + (activeTrade.ticker || '?') +
                        ' (' + (activeTrade.runner_pct || '?') + '% remaining). ' +
                        'New signal is independent — manage runner separately.\n\n';
      } else {
        const since = activeTrade.opened_at ? Math.round((Date.now() - new Date(activeTrade.opened_at).getTime()) / 60000) : '?';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'active_trade', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: `⚠️ Active trade detected (${activeTrade.direction} ${activeTrade.ticker} opened ${since}m ago). Close current trade with /trade before new signals.` });
      }
    }

    log("alert", { event: "auto-username detection", detected: detectedUsername, timestamp: signalTimestamp });

    const obj = loadLevels(today);
    const strike = signal.strike || signal.entry_price || null;
    if (!strike) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: null, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'no_strike', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "❌ SKIP — no strike found in signal" });
    }
    const instrument    = inferInstrument(strike, signal.ticker);
    const instrLabel    = instrument || 'UNK';
    const tol           = (instrument === 'ES_NQ' || instrument === 'SPX') ? 10 : 2;
    const katInstrument = inferInstrument(strike, signal.ticker);
    const katZones      = katSignalsToZones(getRecentKatSignals(katInstrument));
    const katSummary    = getKatContextSummary(katInstrument);
    const zones = detectConfluence([signal, ...(obj.richyd || [])], obj.bobby || [], katZones);
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
    if (_isMorning && (instrLabel === "SPY_QQQ" || instrLabel === "SPX")) {
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
      setImmediate(() => logSignalReplay({
        raw_input: text,
        analyst: signal.analyst,
        signal_type: signal.signal_type,
        parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price },
        verdict: 'SKIP',
        skip_reason: 'no_confluence',
        confluence_score: zones[0] ? zones[0].score : null,
        ms_elapsed: Date.now() - _alertStart
      }));
      return res.json({ reply: runnerWarning + `❌ SKIP — no confluence at ${strike} (${instrLabel}) today${timeSuffix}${softSuffix}` });
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
      setImmediate(() => logSignalReplay({
        raw_input: text,
        analyst: signal.analyst,
        signal_type: signal.signal_type,
        parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price },
        verdict: 'BLOCK',
        skip_reason: 'regime_max_trades',
        confluence_score: hit.score,
        top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
        regime: regime.regime,
        ms_elapsed: Date.now() - _alertStart
      }));
      return res.json({ reply: `🚫 BLOCKED — max ${regime.max_trades_today} trades today reached [${regime.regime}]${regimeLine}${timeSuffix}${softSuffix}` });
    }

    if (hit.confidence === "HIGH") {
      const rawDir = signal.direction;
      const direction = rawDir === 'PUT' ? 'SHORT' : rawDir === 'CALL' ? 'LONG' :
                        rawDir === 'SHORT' ? 'SHORT' : rawDir === 'LONG' ? 'LONG' :
                        signal.bias === 'BULLISH' ? 'LONG' : signal.bias === 'BEARISH' ? 'SHORT' : null;
      const ticker = signal.ticker || instrLabel;

      const bracketSignal = { ...signal, ticker, direction };
      const bracket = calculateBracket(bracketSignal, zones, strike);

      if (bracket.error) {
        saveLastSignal(ticker, "SKIP");
        setImmediate(() => logSignalReplay({
          raw_input: text,
          analyst: signal.analyst,
          signal_type: signal.signal_type,
          parsed: { ticker, direction, strike: signal.strike, entry_price: signal.entry_price },
          verdict: 'SKIP',
          skip_reason: 'bracket_error',
          confluence_score: hit.score,
          top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
          regime: regime.regime,
          ms_elapsed: Date.now() - _alertStart
        }));
        return res.json({ reply: `❌ SKIP — bracket error: ${bracket.error}` });
      }

      if (bracket.flag === "reject") {
        saveLastSignal(ticker, "SKIP");
        setImmediate(() => logSignalReplay({
          raw_input: text,
          analyst: signal.analyst,
          signal_type: signal.signal_type,
          parsed: { ticker, direction, strike: signal.strike, entry_price: signal.entry_price },
          verdict: 'SKIP',
          skip_reason: 'bracket_reject',
          confluence_score: hit.score,
          top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
          rr: bracket.rr_ratio,
          risk_dollars: bracket.risk_dollars,
          regime: regime.regime,
          ms_elapsed: Date.now() - _alertStart
        }));
        return res.json({ reply: `❌ SKIP — ${ticker} ${direction} ${strike}${timeSuffix}\n${bracket.flag_message}\nR:R 1:${bracket.rr_ratio}${regimeLine}${edgeSuffix}${softSuffix}` });
      }

      // APEX EOD TRAIL FLOOR CHECK
      const apexState = loadApexState();
      if (apexState && apexState.balance && apexState.trail_floor) {
        const FLOOR_BUFFER = 200;
        const wouldBreach = (apexState.balance - bracket.risk_dollars - FLOOR_BUFFER) <= apexState.trail_floor;
        if (wouldBreach) {
          const maxRisk = apexState.balance - apexState.trail_floor;
          saveLastSignal(ticker, "SKIP");
          setImmediate(() => logSignalReplay({
            raw_input: text,
            analyst: signal.analyst,
            signal_type: signal.signal_type,
            parsed: { ticker, direction, strike: signal.strike, entry_price: signal.entry_price },
            verdict: 'BLOCK',
            skip_reason: 'apex_floor',
            confluence_score: hit.score,
            top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
            rr: bracket.rr_ratio,
            risk_dollars: bracket.risk_dollars,
            apex_floor_headroom: apexState.balance - apexState.trail_floor - bracket.risk_dollars,
            regime: regime.regime,
            ms_elapsed: Date.now() - _alertStart
          }));
          return res.json({ reply: `⛔ APEX FLOOR — This trade risks breaching your EOD trail floor ($${apexState.trail_floor.toLocaleString()}). Max risk on this trade: $${maxRisk.toLocaleString()}. Reduce size or skip.` });
        }
      }

      let verdict = "SETUP";
      let verdictEmoji = "✅";
      let weakLine = "";
      if (bracket.flag === "warning") {
        verdict = "WEAK";
        verdictEmoji = "⚠️";
        weakLine = `\n⚠️ ${bracket.flag_message}`;
      }

      const _FRAC_RE = /\b(1\/4\s*size|half\s*size|small|starter|fractional|light)\b/i;
      const _isFractional = _FRAC_RE.test(text);
      let sizingNote = '';
      if (instrument === 'ES_NQ') {
        const _tc = ticker.toUpperCase();
        if (['ES', 'MES'].includes(_tc)) {
          sizingNote = _isFractional
            ? 'Size: START 1 contract. Add 1-2 when Ximes adds.'
            : 'Size: 2-3 contracts (runner-capable). 1 to trim, rest runs.';
        } else if (['NQ', 'MNQ'].includes(_tc)) {
          sizingNote = _isFractional
            ? 'Size: START 1 contract. Add 1-3 when Ximes adds.'
            : 'Size: 2-4 contracts (runner-capable). 1 to trim, rest runs.';
        }
      }

      saveLastSignal(ticker, verdict);
      log("alert", { event: "bracket calc complete", rr: bracket.rr_ratio, flag: bracket.flag || "ok" });

      const apexStateForReplay = apexState || loadApexState();
      setImmediate(() => logSignalReplay({
        raw_input: text,
        analyst: signal.analyst,
        signal_type: signal.signal_type,
        parsed: { ticker, direction, strike: signal.strike, entry_price: signal.entry_price },
        verdict,
        skip_reason: null,
        confluence_score: hit.score,
        top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
        rr: bracket.rr_ratio,
        risk_dollars: bracket.risk_dollars,
        apex_floor_headroom: apexStateForReplay
          ? (apexStateForReplay.balance - apexStateForReplay.trail_floor - bracket.risk_dollars)
          : null,
        regime: regime.regime,
        runner_active: !!(activeTrade && activeTrade.runner),
        ms_elapsed: Date.now() - _alertStart
      }));

      // BLOCKER 3 — mark trade as active on SETUP
      if (verdict === "SETUP") {
        writeActiveTrade({ ...signal, ticker, direction }, bracket, sizingNote ? { sizing_note: sizingNote } : {});
        // Fire popup via WS — same staged_trade event the autonomous path uses
        if (typeof global.broadcast === 'function') {
          const tradePayload = {
            ticker,
            direction,
            entry:                 bracket.entry,
            stop:                  bracket.stop,
            target:                bracket.target,
            rr_ratio:              bracket.rr_ratio,
            risk_dollars:          bracket.risk_dollars,
            reward_dollars:        bracket.reward_dollars,
            confluence_score:      hit.score,
            confluence_confidence: hit.confidence,
            regime:                regime.regime,
            source:                'manual_alert',
          };
          global.broadcast({
            type:         'staged_trade',
            signal:       { ticker, direction, entry: bracket.entry, stop: bracket.stop, target: bracket.target, confluence_score: hit.score, confluence_confidence: hit.confidence, reason: `${hit.confidence} confluence — manual alert` },
            trade:        tradePayload,
            risk_dollars: bracket.risk_dollars,
            rr:           bracket.rr_ratio,
            seconds_left: 60,
          });
        }
      }

      const stopLine   = `${bracket.stop}  (${bracket.stop_ticks} ticks | -${bracket.risk_dollars})`;
      const targetLine = `${bracket.target}  (${bracket.target_ticks} ticks | +${bracket.reward_dollars})`;
      const katContextLine = katSummary
        ? '\n🎯 Kat context (' + katInstrument + '): ' +
          katSummary.count + ' signals in last 30m — ' + katSummary.dominant_bias +
          (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
        : '';
      // Saty ATR entry refinement
      const _satyData = loadSatyLevels();
      const _satyLine = _satyData
        ? getSatyRecommendation(bracket.entry, direction, bracket.stop, _satyData)
        : null;
      const satySuffix = _satyLine ? '\n' + _satyLine : '';
      const replyText = [
        `${verdictEmoji} ${verdict} — ${ticker} ${direction}${timeSuffix}`,
        `Entry:  ${bracket.entry}`,
        `Stop:   ${stopLine}`,
        `Target: ${targetLine}`,
        `R:R     1:${bracket.rr_ratio}`,
        ...(sizingNote ? [sizingNote] : []),
        `Confluence: ${hit.score} ${hit.confidence}`,
        `Regime: ${regime.regime}`,
      ].join("\n") + weakLine + edgeSuffix + softSuffix + satySuffix + katContextLine;

      return res.json({
        reply: readinessPrefix + runnerWarning + replyText,
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
    setImmediate(() => logSignalReplay({
      raw_input: text,
      analyst: signal.analyst,
      signal_type: signal.signal_type,
      parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price },
      verdict: 'WEAK',
      skip_reason: 'low_confidence',
      confluence_score: hit.score,
      top_zone: { level: hit.level, score: hit.score, instrument: hit.instrument },
      regime: regime.regime,
      ms_elapsed: Date.now() - _alertStart
    }));
    const _katWeak = katSummary
      ? '\n🎯 Kat context (' + katInstrument + '): ' +
        katSummary.count + ' signals in last 30m — ' + katSummary.dominant_bias +
        (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
      : '';
    return res.json({ reply: readinessPrefix + runnerWarning + `⚠️ WEAK — ${hit.confidence} confluence at ${hit.level} (${instrLabel}) (score: ${hit.score})${timeSuffix}${regimeLine}${edgeSuffix}${softSuffix}` + _katWeak });
  }

  if (message.startsWith('/runner')) {
    const runnerArgs = message.slice(7).trim().split(/\s+/);
    const pct = parseInt(runnerArgs[0]) || 50;
    const runnerTrade = loadActiveTrade();
    if (!runnerTrade || runnerTrade.status !== 'open') {
      return res.json({ reply: '❌ No active trade to set runner on.' });
    }
    runnerTrade.runner      = true;
    runnerTrade.runner_pct  = 100 - pct;
    runnerTrade.runner_stop = runnerTrade.strike;
    runnerTrade.trimmed_at  = new Date().toISOString();
    runnerTrade.trim_pct    = pct;
    try { writeJsonAtomic(ACTIVE_TRADE_FILE, runnerTrade); } catch {}
    return res.json({ reply:
      '🏃 Runner active.\n' +
      '→ ' + pct + '% trimmed. ' + (100 - pct) + '% running.\n' +
      '→ Move stop to breakeven (' + runnerTrade.strike + ') in Tradovate NOW.\n' +
      '→ Next Ximes management signal will guide the rest.'
    });
  }

  if (message.startsWith("/trade ")) {
    const today = new Date().toISOString().split('T')[0];
    const VALID_FORMAT = "Format: /trade [LONG/SHORT] [ticker] [entry] [exit] [WIN/LOSS/SCRATCH]";
    const parts = message.slice(7).trim().split(/\s+/);
    if (parts.length < 5) return res.json({ reply: VALID_FORMAT });
    const [rawDir, rawTicker, rawEntry, rawExit, rawResult] = parts;
    const isRunnerClose = (parts[5] || '').toUpperCase() === 'RUNNER';
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
      direction, ticker, entry, exit, result, pnl, confluence_used,
      ...(isRunnerClose ? { runner_close: true } : {})
    };
    if (!isRunnerClose) {
      const _runnerCheck = loadActiveTrade();
      if (_runnerCheck && _runnerCheck.runner === true) {
        const _rt = _runnerCheck.ticker || '?';
        const _rp = _runnerCheck.runner_pct || '?';
        return res.json({ reply:
          `⚠️ RUNNER ACTIVE — ${_rt} ${_rp}% still running.\n` +
          `Ximes hasn't called the exit yet.\n` +
          `→ Close full position? Add RUNNER to confirm: /trade ${direction} ${ticker} ${rawEntry} ${rawExit} ${result} RUNNER\n` +
          `→ Or set runner stop in Tradovate and wait for Ximes call.`
        });
      }
    }
    appendJsonl(TRADES_JSONL, tradeEntry);
    // F1 fix — update state.daily_pnl so Apex consistency cap sees manual trades
    try {
      const tradeState = loadState();
      const dollarPnl  = pnl * (ticker === 'SPY' ? 100 : 1);
      tradeState.daily_pnl = parseFloat(((tradeState.daily_pnl || 0) + dollarPnl).toFixed(2));
      saveState(tradeState);
    } catch (e) {
      console.error('[trade] state.daily_pnl update failed:', e.message);
    }
    clearActiveTrade(); // BLOCKER 3 — trade closed, clear active-trade guard
    const sign = pnl >= 0 ? "+" : "";
    const runnerSuffix = isRunnerClose ? ' Runner closed. Full position closed.' : '';
    return res.json({ reply: `✅ Trade logged. ${direction} ${ticker} ${entry}→${exit} ${result} (${sign}${pnl} pts)${runnerSuffix}` });
  }

  if (message.trim() === "/review") {
    const today = new Date().toISOString().split('T')[0];
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

    const replay = todaySummary();
    const replayLines = replay
      ? ['\n📊 Signal log: ' + replay.total + ' signals — ' +
          replay.setups + ' SETUP (' + replay.setup_rate + '), ' +
          replay.skips + ' SKIP, ' + replay.blocks + ' BLOCK' +
          (replay.avg_confluence ? '. Avg confluence: ' + replay.avg_confluence : '') +
          (replay.top_skip_reason ? '. Top skip reason: ' + replay.top_skip_reason : '')]
      : [];

    return res.json({ reply: [header, ...tradeLines, ...stateLines, ...replayLines].join("\n") });
  }

  if (message.trim() === "/reset") {
    try { if (fs.existsSync(LEVELS_FILE)) fs.unlinkSync(LEVELS_FILE); } catch {}
    try {
      if (fs.existsSync(LAST_SIGNAL_FILE)) fs.unlinkSync(LAST_SIGNAL_FILE);
    } catch {}
    resetSessionContext();
    log("UX", { event: "daily reset command" });
    return res.json({ reply: "✅ Daily reset complete. Paste /levels and /heatmap to start." });
  }

  if (message.trim() === "/session") {
    const ctx = getSessionContext();
    return res.json({ reply:
      '📍 Session context:\n' +
      'Instrument: ' + (ctx.instrument || 'none') + '\n' +
      'Direction: ' + (ctx.direction || 'none') + '\n' +
      'Strike: ' + (ctx.strike || 'none') + '\n' +
      'In trade: ' + (ctx.inTrade ? 'YES' : 'no') + '\n' +
      'Since: ' + (ctx.tradeStartTime
        ? new Date(ctx.tradeStartTime).toLocaleTimeString()
        : '—')
    });
  }

  if (message.trim() === "/status") {
    const today = new Date().toISOString().split('T')[0];
    const statusLines = [];
    statusLines.push("LUKE ONLINE ✅");
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
      const lukeLogMem = loadMemory();
      const lastLukeLog = lukeLogMem.luke_last_log;
      const lukeMins = lastLukeLog && lastLukeLog.timestamp
        ? Math.round((Date.now() - new Date(lastLukeLog.timestamp).getTime()) / 60000)
        : null;
      if (lukeMins === null) {
        statusLines.push("🐾 Luke: no log recorded");
      } else if (lukeMins < 60) {
        statusLines.push(`🐾 Luke: logged ${lukeMins}m ago`);
      } else {
        statusLines.push(`🐾 Luke: logged ${Math.floor(lukeMins / 60)}h ${lukeMins % 60}m ago`);
      }
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

  if (message.startsWith("/luke ") || message.trim() === "/luke") {
    const text = message.slice(5).trim();
    if (!text) return res.json({ reply: "Usage: /luke meds:omeprazole,mirtazapine food:yes stool:firm energy:normal\nOr free-form: /luke omeprazole given 4am mirtazapine+prednisone 430am ate breakfast" });

    // Key-value extraction
    const medsKV   = text.match(/\bmeds?:([\w,+\s-]+?)(?=\s+\w+:|$)/i);
    const foodKV   = text.match(/\bfood:(\S+)/i);
    const stoolKV  = text.match(/\bstool:(\S+)/i);
    const energyKV = text.match(/\benergy:(\S+)/i);
    const notesKV  = text.match(/\bnotes?:(.+?)$/i);

    // Prose fallback for med names
    const MED_NAMES = ['omeprazole', 'mirtazapine', 'prednisone', 'cerenia', 'metronidazole', 'pepcid', 'carafate'];
    const proseMeds = MED_NAMES.filter(m => new RegExp('\\b' + m + '\\b', 'i').test(text));

    const meds = medsKV
      ? medsKV[1].split(/[,+\s]+/).map(m => m.trim()).filter(m => m && m.length > 2)
      : proseMeds;

    const food = foodKV ? foodKV[1] :
      /\bate\b|\bfood:?\s*yes\b/i.test(text) ? 'yes' :
      /\bno food\b|\bfood:?\s*no\b|\brefused\b/i.test(text) ? 'no' : null;

    const stool = stoolKV ? stoolKV[1] :
      text.match(/\b(firm|soft|loose|normal|blood|watery|formed|mushy|diarrhea)\b/i)?.[1] || null;

    const energy = energyKV ? energyKV[1] :
      text.match(/\b(normal|lethargic|active|low|high|tired|energetic)\b/i)?.[1] || null;

    const notes = notesKV ? notesKV[1].trim() :
      (!medsKV && !foodKV && !stoolKV && !energyKV && proseMeds.length === 0) ? text : null;

    const entry = {
      timestamp: new Date().toISOString(),
      meds:   meds.length > 0 ? meds : null,
      food:   food || null,
      stool:  stool || null,
      energy: energy || null,
      notes:  notes || null,
    };

    const mem = loadMemory();
    mem.luke_last_log = entry;
    saveMemory(mem);

    const LUKE_LOG_FILE = path.join(LUKE_ROOT, "luke-log.jsonl");
    try { fs.appendFileSync(LUKE_LOG_FILE, JSON.stringify(entry) + "\n"); } catch {}

    const parts = [
      entry.meds   ? "meds: " + entry.meds.join(", ") : null,
      entry.food   ? "food: " + entry.food             : null,
      entry.stool  ? "stool: " + entry.stool           : null,
      entry.energy ? "energy: " + entry.energy         : null,
      entry.notes  ? "notes: " + entry.notes.slice(0, 80) : null,
    ].filter(Boolean);

    log("luke", { event: "log saved", entry });
    return res.json({ reply: "✅ Luke log saved: " + (parts.join(" | ") || text.slice(0, 80)) });
  }

  if (message.trim() === "/layout") {
    const { exec } = require("child_process");
    const layoutScript = path.join(LUKE_ROOT, "scripts", "trading-layout.py");
    exec(`python "${layoutScript}"`, (err) => {
      if (err) log("layout", { event: "layout script error", error: err.message });
    });
    return res.json({
      reply: [
        "📐 Layout starting...",
        "1. Positioning Luke ✓",
        "2. Opening ximes-dubz (scrolling to bottom)",
        "3. Opening bobby-spx-coms (scrolling to bottom)",
        "4. Opening Tradovate (checking login)",
        "Type /status when ready to trade."
      ].join("\n")
    });
  }

  if (message.trim() === "/history") {
    try {
      const lines = fs.existsSync(TRADES_JSONL)
        ? fs.readFileSync(TRADES_JSONL, "utf8").trim().split("\n").filter(Boolean)
        : [];
      if (lines.length === 0) {
        return res.json({ reply: "No trades logged yet. Use /trade to log entries." });
      }
      const last5 = lines.slice(-5).map(l => JSON.parse(l));
      const rows = last5.map(t => {
        const pnl = t.pnl != null ? (t.pnl >= 0 ? `+${t.pnl}` : `${t.pnl}`) : "?";
        const ts  = t.timestamp ? new Date(t.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "?";
        return `${ts} | ${t.ticker || "?"} ${t.direction || "?"} | ${pnl} pts | ${t.result || "?"}`;
      });
      return res.json({ reply: `**Last ${last5.length} trades:**\n${rows.join("\n")}` });
    } catch (e) {
      return res.json({ reply: `Error reading trade history: ${e.message}` });
    }
  }

  if (message.trim() === "/trading-mode") {
    const { exec } = require('child_process');
    const scriptPath = path.join(__dirname, '..', 'scripts', 'trading-layout.py');
    // Check pywin32 is available before running
    exec('python -c "import win32gui"', (err) => {
      if (err) {
        broadcast({ type: 'notification', message: '⚠️ trading-mode: pywin32 not installed. Run: pip install pywin32 --break-system-packages' });
        return;
      }
      exec('python "' + scriptPath + '"', (err2, stdout, stderr) => {
        if (err2) {
          console.error('[trading-mode]', err2.message);
          const detail = (stderr || stdout || err2.message || 'unknown').slice(0, 200);
          broadcast({ type: 'notification', message: '⚠️ trading-mode failed: ' + detail });
        }
      });
    });
    return res.json({ reply: '🖥️ Layout launching — ximes top-left, Bobby bottom-left, Tradovate top-right, Luke bottom-right. Takes ~20s. Check top bar for errors.' });
  }

  // ── SATY ATR LEVELS ──────────────────────────────────────────────────
  if (message.trim() === '/saty') {
    return res.json({ reply: buildStatusSummary(loadSatyLevels()) });
  }

  if (message.startsWith('/saty ')) {
    const satyText = message.slice(6).trim();
    const satyParsed = parseSatyText(satyText);
    if (!satyParsed.valid) {
      return res.json({ reply: `❌ ${satyParsed.error || 'parse failed'}\n\nFormat: paste 13 levels highest→lowest\n/saty 5920 5910 5900 5890 5880 5870 5860 5850 5840 5830 5820 5810 5800` });
    }
    saveSatyLevels(satyParsed);
    const savedSaty = loadSatyLevels();
    return res.json({ reply: `📐 Saty levels saved:\n\n${buildStatusSummary(savedSaty)}\n\nWill appear in /alert as entry refinement.` });
  }

  // ── DUBZ LEVELS ──────────────────────────────────────────────────────────────

  // Bare /dubz with no image = status display
  if (message.trim() === '/dubz' && !res._dubzImage) {
    return res.json({ reply: buildDubzStatus(loadDubzState()) });
  }

  // /dubz [text], /dubz + image, or /dubz [text] + image
  if (message.startsWith('/dubz') && (message.startsWith('/dubz ') || res._dubzImage)) {
    const today   = new Date().toISOString().split('T')[0];
    const rawText = message.startsWith('/dubz ') ? message.slice(6).trim() : null;
    const now     = Date.now();

    // Warm live-price cache before text parsing so bounds are Polygon-grounded.
    // parseDubzImage fetches live prices internally; this ensures text-only pastes
    // also get live bounds rather than falling back to hardcoded PRICE_RANGES.
    const livePrice = await getLivePrice().catch(() => null);

    // Parse text if present
    let textResult = null;
    if (rawText) textResult = parseDubzText(rawText, livePrice);

    // Parse image if present, with rate limit
    let imageResults = [];
    let visionNote   = '';
    let visionFailed = false;
    if (res._dubzImage) {
      if (now - lastDubzVisionCallMs < VISION_RATE_LIMIT_MS) {
        const waitSecs = Math.ceil((VISION_RATE_LIMIT_MS - (now - lastDubzVisionCallMs)) / 1000);
        visionNote = ` (vision rate-limited — retry in ${waitSecs}s)`;
      } else {
        lastDubzVisionCallMs = now;
        try {
          const imgResult = await parseDubzImage(res._dubzImage);
          imageResults = imgResult ? [imgResult] : [];
          if (imgResult?.parse_status === 'failed') {
            visionFailed = true;
            visionNote = `\n❌ Vision error: ${imgResult.error}`;
          } else if (imgResult) {
            visionNote = ` + vision parsed (${imgResult.instrument || '?'}: ${(imgResult.levels || []).length} levels)`;
          }
        } catch (err) {
          visionFailed = true;
          visionNote = `\n❌ Vision error: ${err.message}`;
        }
      }
    }

    const input_type = (rawText && imageResults.length) ? 'mixed'
      : imageResults.length ? 'image' : 'text';

    const pasteRecord = {
      timestamp:   new Date().toISOString(),
      input_type,
      raw_text:    rawText || null,
      image_count: imageResults.filter(r => r && r.parse_status !== 'failed').length,
    };

    const existingState = loadDubzState();
    const newState      = mergeDubzInputs(textResult, imageResults, existingState, today, pasteRecord);
    saveDubzState(newState);

    // Build reply summary
    const instrLines = Object.entries(newState.instruments)
      .map(([instr, data]) => `${instr}: ${data.levels.length}`)
      .join('  |  ');
    const conflictLine = newState.conflicts.length > 0
      ? `\n⚠️ ${newState.conflicts.length} conflict(s) detected — run /dubz to review`
      : '';
    const errLine = newState.parse_errors.length > 0
      ? `\nParse notes: ${newState.parse_errors.join('; ')}`
      : '';

    if (newState.carry_forward_failed) {
      return res.json({ reply: `⚠️ Carry-forward requested but no prior Dubz state was found. Paste today's levels first.` });
    }

    const mixedSuccess = visionFailed && textResult;
    const dubzPrefix   = mixedSuccess ? '⚠️ Partial parse — text levels captured, image vision failed\n' : '';
    const dubzTailNote = mixedSuccess ? visionNote : '';
    const dubzInline   = mixedSuccess ? '' : visionNote;
    // Suppress parse_errors redundancy in mixed-success: dubzTailNote already carries the ❌ detail
    const dubzErrLine  = mixedSuccess ? '' : errLine;

    return res.json({
      reply: `${dubzPrefix}📊 Dubz levels updated${dubzInline}.\n${instrLines}${conflictLine}${dubzErrLine}${dubzTailNote}`,
    });
  }

  return null;
}

module.exports = { handleSlashCommand, extractRichydubzLevels };
