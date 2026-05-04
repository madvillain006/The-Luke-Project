const fs = require("fs");
const path = require("path");
const { writeJsonAtomic, appendJsonl } = require("../state/lib");
const { loadMemory, saveMemory } = require("./memory");
const { parseXimes, getSessionContext,
        resetSessionContext } = require("./parse-ximes");
const { parseBobby } = require("./parse-bobby");
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
const { getApexPreTradeFloorBlock } = require("../trading/risk");
const { loadSatyLevels, getSatyRecommendation } = require('./saty-levels');
const { loadDubzState } = require('./parse-dubz');
const { getLivePrice } = require('./live-price');
const { queryLevelsAcrossEquivalents, scoreLevel } = require('./confluence-engine');
const { loadIntraday, getCurrentPriceAt } = require('./historical-data');
const { replayLevelAgainstPriceAction } = require('./level-replay');
const { computeFuturesEntryZone } = require('./futures-entry-zones');
const { buildTradeDecision } = require('./decision-spine');
const { DAILY_CTX_FILE } = require('./daily-accumulator');
const { loadMemory: loadLevelMemory } = require('./level-memory');
const { handleSaty, handleMancini, handleHeatmap, handleDubz } = require('./commands/ingest-commands');
const { handleVerdictCommand } = require('./commands/verdict-command');
const { handleEntriesCommand } = require('./commands/entries-command');
const { handleStatusCommand } = require('./commands/status-command');
const { events } = require('./paths');

const LUKE_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(LUKE_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LEVELS_FILE        = path.join(DATA_DIR, "today-levels.json");
const LAST_SIGNAL_FILE   = path.join(DATA_DIR, "last-signal.json");
const ACTIVE_TRADE_FILE  = path.join(DATA_DIR, "active-trade.json");
const APEX_STATE_FILE    = path.join(DATA_DIR, "apex-state.json");
const TRADES_JSONL       = events.trades;
const DISCORD_HISTORY    = events.discordHistory;

function todayKeyET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function cleanReplyText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  if (out.includes('Paste Bobby\'s heatmap text then run:')) {
    return "HEATMAP Paste Bobby's heatmap text then run:\n/heatmap [paste text here]\n\nOr paste the image directly into chat; vision will parse it automatically.";
  }
  if (out.includes('Paste a Ximes signal then run:')) {
    return "ALERT Paste a Ximes signal then run:\n/alert [paste signal here]\n\nExample:\n/alert [2:34 PM] ximestrades ES LONG 5880";
  }
  if (out.includes('No levels loaded today. Paste /dubz and /heatmap first.')) {
    return "Warning:No levels loaded today. Paste /dubz and /heatmap first.";
  }
  for (let i = 0; i < 3; i++) {
    if (!/[\u00C2\u00C3\u00E2\u00F0]/.test(out)) break;
    try {
      const fixed = Buffer.from(out, 'latin1').toString('utf8');
      if (!fixed || fixed === out) break;
      out = fixed;
    } catch {
      break;
    }
  }
  const replacements = [
    [/\u2013|\u2014/g, '-'],
    [/\u2192/g, '->'],
    [/\u00B7/g, ' - '],
    [/\u2500|\u2501|\u2502|\u2514|\u2518|\u251C|\u2524|\u252C|\u2534|\u253C/gu, '-'],
    [/\u2705|\u2714|\u2611/gu, 'OK'],
    [/\u274C/gu, 'ERROR'],
    [/\u26A0/gu, 'WARNING'],
    [/\u{1F4CB}/gu, 'INFO'],
    [/\u{1F321}/gu, 'HEATMAP'],
    [/\u{1F6A6}/gu, 'READY'],
    [/\u{1F4B0}/gu, 'BALANCE'],
    [/\u23F0/gu, 'CLOSED'],
    [/\u{1F3C3}/gu, 'RUNNER'],
    [/\u2702/gu, 'TRIM'],
    [/\u{1F6AA}/gu, 'EXIT'],
    [/\u2795/gu, 'ADD'],
    [/\u23FA/gu, 'STOP'],
    [/\u{1F3AF}/gu, 'TARGET'],
    [/\u{1F4CA}/gu, 'CONFLUENCE'],
    [/\u{1F534}/gu, 'HIGH'],
    [/\u{1F7E1}/gu, 'MED'],
    [/\u{1F4CD}/gu, 'SESSION'],
    [/\u{1F4D0}/gu, 'LEVELS'],
    [/\u{1F5A5}/gu, 'LAYOUT'],
    [/\u{1F501}/gu, 'DUPLICATE']
  ];
  for (const [pattern, value] of replacements) out = out.replace(pattern, value);
  out = out.replace(/[\uFE0F\uFFFD]/g, '');
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  out = out.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  out = out.replace(/^x9\s+/gm, 'INFO ');
  out = out.replace(/^xR\s+/gm, 'HEATMAP ');
  out = out.replace(/^xa\s+/gm, 'READY ');
  out = out.replace(/^S&\s+/gm, 'OK ');
  out = out.replace(/^x\s+/gm, '');
  out = out.replace(/^R\s+/gm, 'ERROR ');
  out = out.replace(/^Since:\s*$/gm, 'Since: -');
  const dubzAnchor = out.indexOf('Dubz levels updated');
  if (dubzAnchor > 0) out = out.slice(dubzAnchor);
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

const recentAlerts = new Map(); // key  timestamp
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
    return `DUPLICATE alert (fired ${ago}s ago). Ignoring.`;
  }
  recentAlerts.set(key, now);
  return null;
}

//  APEX STATE 
function loadApexState() {
  try {
    if (!fs.existsSync(APEX_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(APEX_STATE_FILE, "utf8"));
  } catch { return null; }
}

//  ACTIVE TRADE STATE (BLOCKER 3) 
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

function getLegacyConfluenceState(today) {
  const obj = loadLevels(today);
  const richyd = Array.isArray(obj.richyd) ? [...obj.richyd] : [];
  const seen = new Set(
    richyd.map(sig => `${(sig.ticker || 'UNK').toUpperCase()}:${sig.signal_type || 'UNK'}:${sig.level ?? sig.strike ?? JSON.stringify(sig.levels || [])}`)
  );

  try {
    const dubzState = loadDubzState();
    if (dubzState && dubzState.date === today) {
      for (const [instrument, bucket] of Object.entries(dubzState.instruments || {})) {
        const ticker = String(instrument || '').toUpperCase();
        for (const level of (bucket && bucket.levels) ? bucket.levels : []) {
          if (typeof level.price !== 'number') continue;
          const key = `${ticker}:CONTEXT:${level.price}`;
          if (seen.has(key)) continue;
          seen.add(key);
          richyd.push({
            signal_type: 'CONTEXT',
            analyst: 'richydubz',
            source: 'richydubz-context',
            ticker,
            levels: [level.price],
            bias: 'NEUTRAL',
            raw: level.source_snippet || `${ticker} ${level.price}`,
          });
        }
      }
    }
  } catch {}

  return {
    ...obj,
    date: today,
    richyd,
    bobby: Array.isArray(obj.bobby) ? obj.bobby : [],
  };
}

function getPhase2WorkflowLoadStatus() {
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  let dubzCount = 0;
  let bobbyCount = 0;
  let dubzLoaded = false;
  let bobbyLoaded = false;

  try {
    const dubzState = loadDubzState();
    if (dubzState && dubzState.date === todayET) {
      dubzCount = Object.values(dubzState.instruments || {})
        .reduce((sum, bucket) => sum + ((bucket && bucket.levels) ? bucket.levels.length : 0), 0);
      dubzLoaded = dubzCount > 0;
    }
  } catch {}

  try {
    if (fs.existsSync(DAILY_CTX_FILE)) {
      const dailyCtx = JSON.parse(fs.readFileSync(DAILY_CTX_FILE, 'utf8'));
      if (dailyCtx && dailyCtx.date === todayCT && dailyCtx.heatmap) {
        bobbyLoaded = true;
      }
    }
  } catch {}

  try {
    const lm = loadLevelMemory();
    bobbyCount = lm.levels.reduce((sum, level) => {
      const todaysBobbyMentions = (level.mentions || []).filter(m => m.analyst === 'bobby' && m.date === todayET);
      return sum + todaysBobbyMentions.length;
    }, 0);
    if (bobbyCount > 0) bobbyLoaded = true;
  } catch {}

  try {
    if (!bobbyLoaded && fs.existsSync(LEVELS_FILE)) {
      const legacyLevels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
      const legacyBobbyCount = Array.isArray(legacyLevels.bobby) ? legacyLevels.bobby.length : 0;
      if (legacyLevels.date === todayET && legacyBobbyCount > 0) {
        bobbyLoaded = true;
        bobbyCount = legacyBobbyCount;
      }
    }
  } catch {}

  return { dubzLoaded, dubzCount, bobbyLoaded, bobbyCount };
}

function getMorningPrepLine(apexState, satyData, workflowStatus) {
  const now = new Date();
  const etText = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York'
  });
  const [hh, mm] = etText.split(':').map(Number);
  const mins = (hh * 60) + mm;
  const missing = [];
  if (!(apexState && typeof apexState.balance === 'number')) missing.push('/balance');
  if (!satyData) missing.push('/saty');
  if (!workflowStatus?.bobbyLoaded) missing.push('/heatmap');
  if (missing.length === 0) return null;
  if (mins < 510) return `Prep by 8:30 AM ET: ${missing.join(', ')}`;
  if (mins < 570) return `8:30+ ET and still missing: ${missing.join(', ')}`;
  return `Missing prep inputs: ${missing.join(', ')}`;
}

function formatKatSummaryLine(summary, label) {
  if (!summary) return null;
  const charts = summary.with_image ? `, ${summary.with_image} charts` : "";
  return `${label}: ${summary.count} recent, ${summary.dominant_bias}${charts}`;
}

function checkSessionReadiness() {
  const warnings = [];
  try {
    // 1. BALANCE_FRESH
    const apexState = loadApexState();
    if (!apexState || !apexState.updated) {
      warnings.push("Warning: /balance not run today; floor check may be stale");
    } else {
      const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const balanceET = new Date(apexState.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      if (balanceET !== todayET) warnings.push("Warning: Apex balance is stale. Update /balance before trading.");
    }

    // 2. LEVELS_LOADED
    const workflowStatus = getPhase2WorkflowLoadStatus();

    // 3. BOBBY_LOADED
    if (!workflowStatus.bobbyLoaded) {
      warnings.push("Warning: Bobby heatmap not loaded yet. Run /heatmap before trading.");
    } else if (fs.existsSync(LEVELS_FILE)) {
      const levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
      const bobby = levels.bobby || [];
      if (bobby.length > 0) {
        const age = Date.now() - new Date(bobby[0].ts).getTime();
        if (age > 8 * 3600 * 1000) warnings.push("Warning: Bobby heatmap is stale (>8h old). Reload /heatmap before trading.");
      }
    }

    // 4. APEX FLOOR HEADROOM
    const apexFloorState = loadApexState();
    if (apexFloorState && typeof apexFloorState.balance === 'number' && typeof apexFloorState.trail_floor === 'number') {
      if (apexFloorState.balance - apexFloorState.trail_floor <= 500) {
        warnings.push("Warning: Apex floor headroom < $500; size down or skip");
      }
    }

    // 5. EMOTIONAL_CLEAR  already handled by existing hard block below
  } catch (e) {
    console.error('[readiness] check error:', e.message);
  }
  return { warnings };
}

async function handleSlashCommand(message, res) {
  const _rawJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload.reply === 'string') {
      payload = { ...payload, reply: cleanReplyText(payload.reply) };
    }
    return _rawJson(payload);
  };
  if (message.trim() === "/levels") {
    return res.json({ reply: "LEVELS Use /dubz [paste RichyDubz morning message here]." });
  }

  if (message.startsWith("/levels ")) {
    const text = message.slice(8).trim();
    return handleSlashCommand(`/dubz ${text}`, res);
  }

  if (message.trim() === "/heatmap" || message.startsWith("/heatmap ")) {
    return handleHeatmap(message, res, { todayKeyET, getLegacyConfluenceState, saveLevels });
  }

  if (message.trim() === "/confluence") {
    const today = new Date().toISOString().split('T')[0];
    const obj = getLegacyConfluenceState(today);
    if ((obj.richyd || []).length === 0 && (obj.bobby || []).length === 0) {
      return res.json({ reply: "No levels loaded today. Paste /dubz and /heatmap first." });
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
    const sep = "";
    if (displayZones.length === 0) {
      return res.json({ reply: `TODAY'S CONFLUENCE ZONES\n${sep}\nNo HIGH or MEDIUM zones yet.\n${sep}\nLoaded: ${richydCount} RichyDubz levels; ${bobbyCount + extraBobby.length} Bobby nodes` });
    }
    const zoneLines = displayZones.map(z => {
      const icon = z.confidence === "HIGH" ? "" : "";
      const conf = z.confidence === "HIGH" ? "HIGH" : "MED ";
      const instrLabel = z.instrument === 'ES_NQ' ? 'ES/NQ' : z.instrument === 'SPX' ? 'SPX' : z.instrument === 'SPY_QQQ' ? 'SPY' : z.instrument || 'UNK';
      const srcStr = z.sources.slice(0, 3).map(sourceLabel).join(" + ");
      return `${icon} ${conf}  ${z.level} ${instrLabel} ${z.bias} (score: ${z.score})\n         Sources: ${srcStr}`;
    });
    return res.json({ reply: `TODAY'S CONFLUENCE ZONES\n${sep}\n${zoneLines.join("\n")}\n${sep}\nLoaded: ${richydCount} RichyDubz levels; ${bobbyCount + extraBobby.length} Bobby nodes` });
  }

  if (message.trim() === "/balance") {
    const apexNow = loadApexState();
    if (apexNow) {
      const updatedLabel = apexNow.updated ? new Date(apexNow.updated).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'unknown';
      return res.json({ reply: `APEX BALANCE\n\nApex balance: ${apexNow.balance.toLocaleString()} | Floor: ${apexNow.trail_floor.toLocaleString()} | Headroom: ${(apexNow.balance - apexNow.trail_floor).toLocaleString()}\nLast updated: ${updatedLabel}\n\nTo update: /balance 51200` });
    }
    return res.json({ reply: 'No Apex balance loaded yet. Use /balance 51200' });
  }

  if (message.startsWith("/balance ")) {
    const raw = message.slice(9).trim().replace(/[$,]/g, "");
    const bal = parseFloat(raw);
    if (!bal || isNaN(bal)) return res.json({ reply: "Invalid balance. Use /balance 51200" });
    const floor = bal - APEX_CFG.TRAIL_AMOUNT;
    const state = { balance: bal, trail_floor: floor, updated: new Date().toISOString() };
    writeJsonAtomic(APEX_STATE_FILE, state);
    return res.json({ reply: `Balance set: $${bal.toLocaleString()}. Trail floor auto-calculated: $${floor.toLocaleString()}.` });
  }

  if (message.trim() === "/ready") {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const sep = '--------------------';
    const checks = [];

    const readyApex = loadApexState();
    if (readyApex && readyApex.updated) {
      const balET = new Date(readyApex.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      checks.push(balET === todayET ? 'OK Balance set today' : 'X Balance NOT set today - run /balance');
    } else {
      checks.push('X Balance NOT set today - run /balance');
    }

    const readySaty = loadSatyLevels();
    checks.push(readySaty ? 'OK Saty ATR levels loaded' : 'X Saty ATR levels NOT loaded - run /saty');

    const workflowStatus = getPhase2WorkflowLoadStatus();
    checks.push(workflowStatus.bobbyLoaded
      ? `OK Bobby heatmap loaded (${workflowStatus.bobbyCount} mentions)`
      : 'X Bobby heatmap NOT loaded - paste heatmap and run /heatmap');

    if (readyApex && typeof readyApex.balance === 'number' && typeof readyApex.trail_floor === 'number') {
      const headroom = readyApex.balance - readyApex.trail_floor;
      checks.push(headroom > 500
        ? `OK Apex floor safe ($${headroom.toLocaleString()} headroom)`
        : `X Apex floor headroom < $500 ($${headroom.toLocaleString()}) - size down or skip`);
    } else {
      checks.push('X Apex floor unknown - run /balance first');
    }

    const allPass = checks.every(c => c.startsWith('OK'));
    const verdict = allPass ? 'OK READY TO TRADE' : 'X NOT READY - fix above before trading';
    return res.json({ reply: `READY SESSION READINESS\n${sep}\n${checks.join("\n")}\n${sep}\n${verdict}` });
  }

  if (message.trim() === "/alert") {
    return res.json({ reply: "ALERT Paste a Ximes signal then run:\n/alert [paste signal here]\n\nExample:\n/alert [2:34 PM] ximestrades ES LONG 5880" });
  }

  if (message.startsWith("/alert ")) {
    const today = new Date().toISOString().split('T')[0];
    const _alertStart = Date.now();
    const text = message.slice(7).trim();
    const readiness = checkSessionReadiness();
    const readinessPrefix = readiness.warnings.length > 0
      ? `WARNING Session readiness issues:
${readiness.warnings.join('\n')}\n\n`
      : '';

    if (isWeekend()) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'weekend', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "MARKET CLOSED Weekend - Luke will not score live trades." });
    }
    if (!isMarketOpen().open) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'market_closed', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "MARKET CLOSED Outside market hours - wait for session open." });
    }
    const _tradingTime = isGoodTradingTime();
    if (!_tradingTime.good) {
      if (_tradingTime.window === "lunch") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'lunch_window', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: `${readinessPrefix}SKIP Lunch chop window. High risk. Skip unless A+ setup only.` });
      }
      if (_tradingTime.window === "last10") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'last_10_mins', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: `${readinessPrefix}SKIP Last 10 minutes. No new entries. Manage only.` });
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
      return res.json({ reply: "SKIP: could not parse signal" });
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
          runnerLine = '\n Runner set  ' + (100 - trimPct) + '% remaining.' +
                       '\n Stop: move to breakeven (' + trimActive.strike + ')' +
                       '\n Let Ximes call the exit. Do not touch it.';
        }
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'trim', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' TRIM  Ximes taking ' + trimPct + '% off.\n' +
          ' Reduce position by ' + trimPct + '% NOW in Tradovate.' +
          runnerLine
        });
      }
      if (signal.action === 'RUNNER') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'runner', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' XIMES RUNNER  Hold partial position.\n' +
          (signal.sizing ? 'He has ' + signal.sizing +
            ' cons left (' + signal.pctRemaining + '%).\n' : '') +
          ' Keep 20-25% on. Move stop to breakeven.' });
      }
      if (signal.action === 'CLOSE') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'close', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' XIMES EXIT  Close position now.' });
      }
      if (signal.action === 'ADD') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'add', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' XIMES ADDING  He is sizing in further.\n' +
          ' Consider adding within your risk parameters.' });
      }
      if (signal.action === 'STOP_UPDATE') {
        const price = signal.price ? '$' + signal.price : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'stop_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' STOP UPDATE  Move your stop to ' + price + '.\n' +
          ' Adjust in Tradovate now. Do not wait.'
        });
      }
      if (signal.action === 'TARGET_UPDATE') {
        const ticker = signal.ticker ? signal.ticker + ' ' : '';
        const price  = signal.price  ? String(signal.price)  : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'target_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          ' TARGET UPDATE  ' + ticker + 'new target: ' + price + '.\n' +
          ' Adjust your OCO or mental target now.'
        });
      }
    }

    if (signalTimestamp) signal.signal_time = signalTimestamp;

    // BLOCKER 2  alert dedup
    const dupMsg = checkAlertDedup(signal);
    if (dupMsg) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'dedup', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: dupMsg });
    }

    // BLOCKER 3  active trade guard
    let runnerWarning = '';
    const activeTrade = loadActiveTrade();
    if (activeTrade) {
      if (activeTrade.runner) {
        runnerWarning = ' Runner active on ' + (activeTrade.ticker || '?') +
                        ' (' + (activeTrade.runner_pct || '?') + '% remaining). ' +
                        'New signal is independent  manage runner separately.\n\n';
      } else {
        const since = activeTrade.opened_at ? Math.round((Date.now() - new Date(activeTrade.opened_at).getTime()) / 60000) : '?';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'active_trade', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: ` Active trade detected (${activeTrade.direction} ${activeTrade.ticker} opened ${since}m ago). Close current trade with /trade before new signals.` });
      }
    }

    log("alert", { event: "auto-username detection", detected: detectedUsername, timestamp: signalTimestamp });

    const obj = getLegacyConfluenceState(today);
    const strike = signal.strike || signal.entry_price || null;
    if (!strike) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: null, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'no_strike', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "SKIP: no strike found in signal" });
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
      edgeNote = " Edge match: Ximes morning window (9:3011:00 AM)  preferred setup";
    } else if (_isMorning) {
      edgeNote = " Edge match: Morning window  Ximes preferred SPY/SPX 0-1DTE play";
    } else if (_isAfternoon) {
      edgeNote = " Edge match: Afternoon window (2:00-3:50 PM)  higher risk, size down ";
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
      return res.json({ reply: runnerWarning + `SKIP: no confluence at ${strike} (${instrLabel}) today${timeSuffix}${softSuffix}` });
    }

    const regime = getSiennaRegime();
    let todayTradeCount = 0;
    try {
      todayTradeCount = fs.readFileSync(TRADES_JSONL, "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(today) || (t.timestamp || "").startsWith(today))).length;
    } catch {}
    const regimeLine = `\n Regime: ${regime.regime}  ${regime.reason}`;

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
      return res.json({ reply: `BLOCKED: max ${regime.max_trades_today} trades today reached [${regime.regime}]${regimeLine}${timeSuffix}${softSuffix}` });
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
        return res.json({ reply: `SKIP: bracket error: ${bracket.error}` });
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
        return res.json({ reply: `SKIP: ${ticker} ${direction} ${strike}${timeSuffix}\n${bracket.flag_message}\nR:R 1:${bracket.rr_ratio}${regimeLine}${edgeSuffix}${softSuffix}` });
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
          return res.json({ reply: `APEX FLOOR: This trade risks breaching your EOD trail floor ($${apexState.trail_floor.toLocaleString()}). Max risk on this trade: $${maxRisk.toLocaleString()}. Reduce size or skip.` });
        }
      }

      let verdict = "SETUP";
      let verdictEmoji = "";
      let weakLine = "";
      if (bracket.flag === "warning") {
        verdict = "WEAK";
        verdictEmoji = "";
        weakLine = `\n ${bracket.flag_message}`;
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

      // BLOCKER 3  mark trade as active on SETUP
      if (verdict === "SETUP") {
        writeActiveTrade({ ...signal, ticker, direction }, bracket, sizingNote ? { sizing_note: sizingNote } : {});
        // Fire popup via WS  same staged_trade event the autonomous path uses
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
            signal:       { ticker, direction, entry: bracket.entry, stop: bracket.stop, target: bracket.target, confluence_score: hit.score, confluence_confidence: hit.confidence, reason: `${hit.confidence} confluence  manual alert` },
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
        ? '\n Kat context (' + katInstrument + '): ' +
          katSummary.count + ' signals in last 30m  ' + katSummary.dominant_bias +
          (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
        : '';
      // Saty ATR entry refinement
      const _satyData = loadSatyLevels();
      const _satyLine = _satyData
        ? getSatyRecommendation(bracket.entry, direction, bracket.stop, _satyData)
        : null;
      const satySuffix = _satyLine ? '\n' + _satyLine : '';
      const replyText = [
        `${verdictEmoji} ${verdict}  ${ticker} ${direction}${timeSuffix}`,
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
      ? '\n Kat context (' + katInstrument + '): ' +
        katSummary.count + ' signals in last 30m  ' + katSummary.dominant_bias +
        (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
      : '';
    return res.json({ reply: readinessPrefix + runnerWarning + `WEAK: ${hit.confidence} confluence at ${hit.level} (${instrLabel}) (score: ${hit.score})${timeSuffix}${regimeLine}${edgeSuffix}${softSuffix}` + _katWeak });
  }

  if (message.startsWith('/runner')) {
    const runnerArgs = message.slice(7).trim().split(/\s+/);
    const pct = parseInt(runnerArgs[0]) || 50;
    const runnerTrade = loadActiveTrade();
    if (!runnerTrade || runnerTrade.status !== 'open') {
      return res.json({ reply: 'No active trade to set runner on.' });
    }
    runnerTrade.runner      = true;
    runnerTrade.runner_pct  = 100 - pct;
    runnerTrade.runner_stop = runnerTrade.strike;
    runnerTrade.trimmed_at  = new Date().toISOString();
    runnerTrade.trim_pct    = pct;
    try { writeJsonAtomic(ACTIVE_TRADE_FILE, runnerTrade); } catch {}
    return res.json({ reply:
      ' Runner active.\n' +
      ' ' + pct + '% trimmed. ' + (100 - pct) + '% running.\n' +
      ' Move stop to breakeven (' + runnerTrade.strike + ') in Tradovate NOW.\n' +
      ' Next Ximes management signal will guide the rest.'
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
    const levelObj = getLegacyConfluenceState(today);
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
          ` RUNNER ACTIVE  ${_rt} ${_rp}% still running.\n` +
          `Ximes hasn't called the exit yet.\n` +
          ` Close full position? Add RUNNER to confirm: /trade ${direction} ${ticker} ${rawEntry} ${rawExit} ${result} RUNNER\n` +
          ` Or set runner stop in Tradovate and wait for Ximes call.`
        });
      }
    }
    appendJsonl(TRADES_JSONL, tradeEntry);
    // F1 fix  update state.daily_pnl so Apex consistency cap sees manual trades
    try {
      const tradeState = loadState();
      const dollarPnl  = pnl * (ticker === 'SPY' ? 100 : 1);
      tradeState.daily_pnl = parseFloat(((tradeState.daily_pnl || 0) + dollarPnl).toFixed(2));
      saveState(tradeState);
    } catch (e) {
      console.error('[trade] state.daily_pnl update failed:', e.message);
    }
    clearActiveTrade(); // BLOCKER 3  trade closed, clear active-trade guard
    const sign = pnl >= 0 ? "+" : "";
    const runnerSuffix = isRunnerClose ? ' Runner closed. Full position closed.' : '';
    return res.json({ reply: `Trade logged. ${direction} ${ticker} ${entry} -> ${exit} ${result} (${sign}${pnl} pts)${runnerSuffix}` });
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
    const header = ` Today: ${todayTrades.length} trades | ${wins}W ${losses}L | Net: ${sign}${netPts.toFixed(2)} pts`;
    const tradeLines = todayTrades.map(t => {
      const ps = (t.pnl >= 0 ? "+" : "") + t.pnl;
      return `  ${t.direction} ${t.ticker} ${t.entry} -> ${t.exit} ${t.result} (${ps} pts)`;
    });
    const tradeCtx = loadTodayContext();
    const exitWarnings = checkEmotionalState(tradeCtx);
    const stateLines = exitWarnings.length > 0
      ? ["Emotional state: " + exitWarnings.map(w => `${w.emoji} ${w.message}`).join(" | ")]
      : ["Emotional state:  Clear"];

    const replay = todaySummary();
    const replayLines = replay
      ? ['\n Signal log: ' + replay.total + ' signals  ' +
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
    try {
      if (fs.existsSync(DAILY_CTX_FILE)) fs.unlinkSync(DAILY_CTX_FILE);
    } catch {}
    resetSessionContext();
    log("UX", { event: "daily reset command" });
    return res.json({ reply: "Daily reset complete. Paste /dubz and /heatmap to start." });
  }

  if (message.trim() === "/session") {
    const ctx = getSessionContext();
    return res.json({ reply:
      ' Session context:\n' +
      'Instrument: ' + (ctx.instrument || 'none') + '\n' +
      'Direction: ' + (ctx.direction || 'none') + '\n' +
      'Strike: ' + (ctx.strike || 'none') + '\n' +
      'In trade: ' + (ctx.inTrade ? 'YES' : 'no') + '\n' +
      'Since: ' + (ctx.tradeStartTime
        ? new Date(ctx.tradeStartTime).toLocaleTimeString()
        : '')
    });
  }

  if (message.trim() === "/status") {
    return handleStatusCommand(message, res, {
      fs,
      TRADES_JSONL,
      LAST_SIGNAL_FILE,
      isMarketOpen,
      isGoodTradingTime,
      minsUntilOpen,
      getPhase2WorkflowLoadStatus,
      loadSatyLevels,
      loadApexState,
      getMorningPrepLine,
      loadTodayContext,
      checkEmotionalState,
      getSiennaRegime,
      formatKatSummaryLine,
      getKatContextSummary,
    });
  }

  if (message.startsWith("/luke ") || message.trim() === "/luke") {
    return res.json({
      reply: [
        "Luke system chat is active.",
        "Use the system chat for general Luke conversation.",
        "Use Trading (Analysis) for trading readiness, alerts, Saty levels, balances, and level-state work."
      ].join("\n")
    });
  }

  if (message.trim() === "/layout") {
    const { exec } = require("child_process");
    const layoutScript = path.join(LUKE_ROOT, "scripts", "trading-layout.py");
    exec(`python "${layoutScript}"`, (err) => {
      if (err) log("layout", { event: "layout script error", error: err.message });
    });
    return res.json({
      reply: [
        " Layout starting...",
        "1. Positioning Luke ",
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
        broadcast({ type: 'notification', message: ' trading-mode: pywin32 not installed. Run: pip install pywin32 --break-system-packages' });
        return;
      }
      exec('python "' + scriptPath + '"', (err2, stdout, stderr) => {
        if (err2) {
          console.error('[trading-mode]', err2.message);
          const detail = (stderr || stdout || err2.message || 'unknown').slice(0, 200);
          broadcast({ type: 'notification', message: ' trading-mode failed: ' + detail });
        }
      });
    });
    return res.json({ reply: 'Layout launching: ximes top-left, Bobby bottom-left, Tradovate top-right, Luke bottom-right. Takes ~20s. Check top bar for errors.' });
  }

  //  SATY ATR LEVELS 
  if (message.trim() === '/saty' || message.startsWith('/saty ')) {
    return handleSaty(message, res);
  }

  //   DUBZ LEVELS

  if (message.trim() === '/mancini' || message.startsWith('/mancini ')) {
    return handleMancini(message, res);
  }

  if (message.trim() === '/dubz' || message.startsWith('/dubz ')) {
    return handleDubz(message, res, { todayKeyET });
  }

  //  /verdict  confluence verdict across Level Memory 
  //
  // /verdict            NQ + ES + SPY, top 5 levels each by grade
  // /verdict ES         ES (+ SPX-equivalent) levels, top 5
  // /verdict NQ all     NQ (+ QQQ-equivalent) levels, no cap
  //
  // C7: fails open when Level Memory is empty or live price unavailable.

  if (message.trim() === '/verdict' || message.startsWith('/verdict ')) {
    return handleVerdictCommand(message, res, {
      getPhase2WorkflowLoadStatus,
      loadSatyLevels,
      getLivePrice,
    });
  }

  if (message.startsWith('/backtest ')) {
    const args = message.slice('/backtest '.length).trim().split(/\s+/).filter(Boolean);
    if (args.length < 2) {
      return res.json({ reply: 'Use /backtest <INSTRUMENT> <YYYY-MM-DD>' });
    }

    const instrument = args[0].toUpperCase();
    const date = args[1];
    const bars = loadIntraday(instrument, date);
    if (bars === null || bars.length === 0) {
      return res.json({ reply: `No data for ${instrument} on ${date}. Drop matching CSV into data/historical/.` });
    }

    const currentPrice = bars[bars.length - 1]?.close ?? null;
    const records = queryLevelsAcrossEquivalents(instrument);
    if (records.length === 0) {
      return res.json({ reply: `No levels recorded yet for ${instrument}.` });
    }

    const tolerancePoints = ['ES', 'NQ'].includes(instrument) ? 1.0 : 0.5;
    const evaluated = records.map(record => {
      const scored = scoreLevel(record, { currentPrice });
      const replay = replayLevelAgainstPriceAction(record, bars, {
        tolerancePoints,
        windowMinutes: 30,
        futures: ['ES', 'NQ'].includes(instrument),
      });
      return { record, scored, replay };
    });

    const touched = evaluated.filter(item => item.replay.summary.total_touches > 0);
    const totalTouches = evaluated.reduce((sum, item) => sum + item.replay.summary.total_touches, 0);
    const totalHolds = evaluated.reduce((sum, item) => sum + item.replay.summary.hold_count, 0);
    const holdRate = totalTouches > 0 ? totalHolds / totalTouches : 0;
    const byGrade = new Map();
    for (const item of evaluated) {
      const grade = item.scored.grade;
      if (!byGrade.has(grade)) byGrade.set(grade, []);
      byGrade.get(grade).push(item.replay.summary);
    }

    const gradeLines = ['A', 'B', 'C', 'D', 'F']
      .filter(grade => byGrade.has(grade))
      .map(grade => {
        const rows = byGrade.get(grade);
        const gradeTouches = rows.reduce((sum, row) => sum + row.total_touches, 0);
        const gradeHolds = rows.reduce((sum, row) => sum + row.hold_count, 0);
        const gradeTouchedLevels = rows.filter(row => row.total_touches > 0).length;
        const gradeRate = gradeTouches > 0 ? (gradeHolds / gradeTouches) : 0;
        return `${grade}: ${rows.length} lvls, ${gradeTouchedLevels} touched, ${(gradeRate * 100).toFixed(0)}% hold`;
      });

    const worst = touched
      .map(item => ({
        price: item.record.canonical_price,
        grade: item.scored.grade,
        dd: item.replay.summary.worst_drawdown_seen,
      }))
      .sort((a, b) => b.dd - a.dd)
      .slice(0, 3)
      .map(item => `${instrument} ${item.price} (${item.grade}) dd=${item.dd.toFixed(2)}`);

    return res.json({
      reply: [
        `## Backtest ${instrument} ${date}`,
        `Total levels tested: ${evaluated.length}`,
        `Touched levels: ${touched.length}/${evaluated.length}`,
        `Hold rate: ${(holdRate * 100).toFixed(0)}%`,
        ...gradeLines,
        'Worst drawdowns:',
        ...(worst.length > 0 ? worst : ['none touched']),
      ].join('\n'),
    });
  }

  if (message.startsWith('/entries ')) {
    return handleEntriesCommand(message, res, {
      getKatContextSummary,
      formatKatSummaryLine,
      getLivePrice,
      loadState,
      buildTradeDecision,
    });
  }

  if (message.trim() === '/nodes') {
    try {
      const mem = loadLevelMemory();
      const bobbyLevels = (mem.levels || []).filter(lvl =>
        (lvl.mentions || []).some(m => m.analyst === 'Bobby')
      );
      if (bobbyLevels.length === 0) {
        return res.json({ reply: 'Parsed Heatmap Nodes:\nNo Bobby heatmap nodes loaded. Run /heatmap first.' });
      }
      const sorted = bobbyLevels.slice().sort((a, b) => b.canonical_price - a.canonical_price);
      const lines = sorted.map(lvl => {
        const bobbyMention = (lvl.mentions || []).find(m => m.analyst === 'Bobby');
        const grade = bobbyMention?.significance || bobbyMention?.intent || '-';
        return `- ${lvl.instrument} ${lvl.canonical_price} (${grade})`;
      });
      return res.json({ reply: 'Parsed Heatmap Nodes:\n' + lines.join('\n') });
    } catch (e) {
      return res.json({ reply: 'Parsed Heatmap Nodes:\nError reading level memory: ' + e.message });
    }
  }

  return null;
}

module.exports = {
  handleSlashCommand,
  extractRichydubzLevels,
  _internal: { getPhase2WorkflowLoadStatus, getLegacyConfluenceState }
};
