const fs = require("fs");
const path = require("path");
const { writeJsonAtomic, appendJsonl } = require("../state/lib");
const { loadMemory, saveMemory } = require("./memory");
const { parseXimes, getSessionContext,
        resetSessionContext } = require("./parse-ximes");
const { parseBobby, parseBobbyImage, mergeBobby, appendBobbyToMemory } = require("./parse-bobby");
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
const { loadSatyLevels, saveSatyLevels, parseSatyText, getSatyRecommendation, buildStatusSummary, appendSatyToMemory } = require('./saty-levels');
const { parseDubzText, parseDubzImage, mergeDubzInputs, appendDubzToMemory, loadDubzState, saveDubzState, buildDubzStatus } = require('./parse-dubz');
const { parseManciniText, appendManciniToMemory } = require('./parse-mancini');
const { getLivePrice } = require('./live-price');
const { buildVerdictMarkdown, queryLevelsAcrossEquivalents, scoreLevel } = require('./confluence-engine');
const { loadIntraday, getCurrentPriceAt } = require('./historical-data');
const { replayLevelAgainstPriceAction } = require('./level-replay');
const { computeFuturesEntryZone } = require('./futures-entry-zones');
const { DAILY_CTX_FILE } = require('./daily-accumulator');
const { loadMemory: loadLevelMemory } = require('./level-memory');

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

function cleanReplyText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
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
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

const recentAlerts = new Map(); // key Ã¢â€ â€™ timestamp
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
    return `Ã°Å¸â€Â Duplicate alert (fired ${ago}s ago). Ignoring.`;
  }
  recentAlerts.set(key, now);
  return null;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ APEX STATE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function loadApexState() {
  try {
    if (!fs.existsSync(APEX_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(APEX_STATE_FILE, "utf8"));
  } catch { return null; }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ACTIVE TRADE STATE (BLOCKER 3) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ VISION RATE LIMIT (BLOCKER 1) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  if (!workflowStatus?.dubzLoaded) missing.push('/dubz');
  if (!workflowStatus?.bobbyLoaded) missing.push('/heatmap');
  if (missing.length === 0) return null;
  if (mins < 510) return `Prep by 8:30 AM ET: ${missing.join(', ')}`;
  if (mins < 570) return `8:30+ ET and still missing: ${missing.join(', ')}`;
  return `Missing prep inputs: ${missing.join(', ')}`;
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
    return res.json({ reply: "Ã°Å¸â€œâ€¹ Legacy path. Use /dubz for the current RichyDubz workflow.\n\nExample:\n/dubz [paste RichyDubz morning text]" });
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
    const obj = getLegacyConfluenceState(today);
    obj.date = today;
    obj.richyd = richyd;
    obj.richyd_structured = richyd_structured;
    if (bobby) obj.bobby = [bobby];
    saveLevels(obj);
    const totalRichy = richyd.length + richyd_structured.length;
    return res.json({ reply: `Today's levels saved. ${totalRichy} RichyDubz levels, ${obj.bobby.length} Bobby nodes.` });
  }

  if (message.trim() === "/heatmap" && !res._heatmapImage) {
    return res.json({ reply: "Ã°Å¸Å’Â¡Ã¯Â¸Â Paste Bobby's heatmap text then run:\n/heatmap [paste text here]\n\nOr paste the image directly into chat Ã¢â‚¬â€ vision will parse it automatically." });
  }

  if (message.trim() === "/heatmap" || message.startsWith("/heatmap ")) {
    const today = new Date().toISOString().split('T')[0];
    const text = message.trim() === "/heatmap" ? "" : message.slice(9).trim();
    const textBobby = parseBobby(text);
    const obj = getLegacyConfluenceState(today);
    const now = Date.now();
    let visionBobby = null;
    let visionNote = '';

    let visionFailed = false;
    if (res._heatmapImage) {
      if (now - lastVisionCallMs < VISION_RATE_LIMIT_MS) {
        const waitSecs = Math.ceil((VISION_RATE_LIMIT_MS - (now - lastVisionCallMs)) / 1000);
        visionNote = ` (vision rate-limited Ã¢â‚¬â€ retry in ${waitSecs}s)`;
      } else {
        lastVisionCallMs = now;
        try {
          const visionResult = await parseBobbyImage(res._heatmapImage);
          if (visionResult && visionResult.parse_status === 'failed') {
            visionFailed = true;
            visionNote = `\nÃ¢ÂÅ’ Vision error: ${visionResult.error}`;
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
            visionNote = `\nÃ¢ÂÅ’ Vision returned no data`;
          }
        } catch (err) {
          visionFailed = true;
          visionNote = `\nÃ¢ÂÅ’ Vision error: ${err.message}`;
        }
      }
    }

    const merged = mergeBobby(textBobby, visionBobby);
    if (merged) {
      obj.bobby = [...(obj.bobby || []), merged];
      saveLevels(obj);
      await appendBobbyToMemory(merged);
      const nodeCount = (merged.king_nodes || []).length + (merged.support || []).length + (merged.resistance || []).length;
      const mixedSuccess = visionFailed && textBobby;
      const heatmapPrefix = mixedSuccess ? 'Ã¢Å¡Â Ã¯Â¸Â Partial parse Ã¢â‚¬â€ text levels captured, image vision failed\n' : '';
      const tailNote      = mixedSuccess ? visionNote : '';
      const inlineNote    = mixedSuccess ? '' : visionNote;
      return res.json({ reply: `${heatmapPrefix}Heatmap context updated. ${nodeCount} nodes found${inlineNote}.${tailNote}` });
    }
    return res.json({ reply: `${visionFailed && !textBobby ? 'Ã¢ÂÅ’ ' : ''}No prices found in heatmap text${visionNote}.` });
  }

  if (message.trim() === "/confluence") {
    const today = new Date().toISOString().split('T')[0];
    const obj = getLegacyConfluenceState(today);
    if ((obj.richyd || []).length === 0 && (obj.bobby || []).length === 0) {
      return res.json({ reply: "Ã¢Å¡Â Ã¯Â¸Â No levels loaded today. Paste /dubz and /heatmap first." });
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
    const sep = "Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â";
    if (displayZones.length === 0) {
      return res.json({ reply: `Ã°Å¸â€œÅ  TODAY'S CONFLUENCE ZONES\n${sep}\nNo HIGH or MEDIUM zones yet.\n${sep}\nLoaded: ${richydCount} RichyDubz levels Ã‚Â· ${bobbyCount + extraBobby.length} Bobby nodes` });
    }
    const zoneLines = displayZones.map(z => {
      const icon = z.confidence === "HIGH" ? "Ã°Å¸â€Â´" : "Ã°Å¸Å¸Â¡";
      const conf = z.confidence === "HIGH" ? "HIGH" : "MED ";
      const instrLabel = z.instrument === 'ES_NQ' ? 'ES/NQ' : z.instrument === 'SPX' ? 'SPX' : z.instrument === 'SPY_QQQ' ? 'SPY' : z.instrument || 'UNK';
      const srcStr = z.sources.slice(0, 3).map(sourceLabel).join(" + ");
      return `${icon} ${conf}  ${z.level} ${instrLabel} ${z.bias} (score: ${z.score})\n         Sources: ${srcStr}`;
    });
    return res.json({ reply: `Ã°Å¸â€œÅ  TODAY'S CONFLUENCE ZONES\n${sep}\n${zoneLines.join("\n")}\n${sep}\nLoaded: ${richydCount} RichyDubz levels Ã‚Â· ${bobbyCount + extraBobby.length} Bobby nodes` });
  }

  if (message.trim() === "/balance") {
    const apexNow = loadApexState();
    if (apexNow) {
      return res.json({ reply: `Ã°Å¸â€™Â° Apex balance: ${apexNow.balance?.toLocaleString()} | Floor: ${apexNow.trail_floor?.toLocaleString()} | Headroom: ${(apexNow.balance - apexNow.trail_floor)?.toLocaleString()}\nLast updated: ${new Date(apexNow.updated).toLocaleString()}\n\nTo update: /balance 51200` });
    }
    return res.json({ reply: "Ã°Å¸â€™Â° No balance set yet. Run:\n/balance [your current Apex balance]\nExample: /balance 50717" });
  }

  if (message.startsWith("/balance ")) {
    const raw = message.slice(9).trim().replace(/[$,]/g, "");
    const bal = parseFloat(raw);
    if (!bal || isNaN(bal)) return res.json({ reply: "Ã¢ÂÅ’ Format: /balance 51200" });
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
        warnings.push("Ã¢Å¡Â Ã¯Â¸Â /balance not run today Ã¢â‚¬â€ floor check may be stale");
      } else {
        const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const balanceET = new Date(apexState.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        if (balanceET !== todayET) warnings.push("Ã¢Å¡Â Ã¯Â¸Â /balance not run today Ã¢â‚¬â€ floor check may be stale");
      }

      // 2. LEVELS_LOADED
      const workflowStatus = getPhase2WorkflowLoadStatus();
      if (!workflowStatus.dubzLoaded) {
        warnings.push("Ã¢Å¡Â Ã¯Â¸Â No levels loaded Ã¢â‚¬â€ paste RichyDubz and run /dubz");
      }

      // 3. BOBBY_LOADED
      if (!workflowStatus.bobbyLoaded) {
        warnings.push("Ã¢Å¡Â Ã¯Â¸Â No Bobby context Ã¢â‚¬â€ paste heatmap and run /heatmap");
      } else if (fs.existsSync(LEVELS_FILE)) {
        const levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
        const bobby = levels.bobby || [];
        if (bobby.length > 0) {
          const age = Date.now() - new Date(bobby[0].ts).getTime();
          if (age > 8 * 3600 * 1000) warnings.push("Ã¢Å¡Â Ã¯Â¸Â Bobby context is stale (>8h) Ã¢â‚¬â€ repaste /heatmap");
        }
      }

      // 4. APEX FLOOR HEADROOM
      const apexFloorState = loadApexState();
      if (apexFloorState && typeof apexFloorState.balance === 'number' && typeof apexFloorState.trail_floor === 'number') {
        if (apexFloorState.balance - apexFloorState.trail_floor <= 500) {
          warnings.push("Ã¢Å¡Â Ã¯Â¸Â Apex floor headroom < $500 Ã¢â‚¬â€ size down or skip");
        }
      }

      // 5. EMOTIONAL_CLEAR Ã¢â‚¬â€ already handled by existing hard block below
    } catch (e) {
      console.error('[readiness] check error:', e.message);
    }
    return { warnings };
  }

  if (message.trim() === "/ready") {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const sep = "Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â";
    const checks = [];

    // 1. Balance set today
    const readyApex = loadApexState();
    if (readyApex && readyApex.updated) {
      const balET = new Date(readyApex.updated).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      checks.push(balET === todayET ? "Ã¢Å“â€¦ Balance set today" : "Ã¢ÂÅ’ Balance NOT set today Ã¢â‚¬â€ run /balance");
    } else {
      checks.push("Ã¢ÂÅ’ Balance NOT set today Ã¢â‚¬â€ run /balance");
    }

    const readySaty = loadSatyLevels();
    if (readySaty) {
      checks.push('OK Saty ATR levels loaded');
    } else {
      checks.push('X Saty ATR levels NOT loaded - run /saty');
    }

    const workflowStatus = getPhase2WorkflowLoadStatus();

    // 3. RichyDubz/Dubz levels loaded
    if (workflowStatus.dubzLoaded) {
      checks.push(`Ã¢Å“â€¦ RichyDubz levels loaded (${workflowStatus.dubzCount} levels)`);
    } else {
      checks.push("Ã¢ÂÅ’ RichyDubz levels NOT loaded Ã¢â‚¬â€ paste /dubz");
    }

    // 4. Bobby heatmap loaded
    if (workflowStatus.bobbyLoaded) {
      checks.push(`Ã¢Å“â€¦ Bobby heatmap loaded (${workflowStatus.bobbyCount} mentions)`);
    } else {
      checks.push("Ã¢ÂÅ’ Bobby heatmap NOT loaded Ã¢â‚¬â€ paste heatmap and run /heatmap");
    }

    // 5. Apex floor safe
    if (readyApex && typeof readyApex.balance === 'number' && typeof readyApex.trail_floor === 'number') {
      const headroom = readyApex.balance - readyApex.trail_floor;
      if (headroom > 500) {
        checks.push(`Ã¢Å“â€¦ Apex floor safe ($${headroom.toLocaleString()} headroom)`);
      } else {
        checks.push(`Ã¢ÂÅ’ Apex floor headroom < $500 ($${headroom.toLocaleString()}) Ã¢â‚¬â€ size down or skip`);
      }
    } else {
      checks.push("Ã¢ÂÅ’ Apex floor unknown Ã¢â‚¬â€ run /balance first");
    }

    const allPass = checks.every(c => c.startsWith("Ã¢Å“â€¦"));
    const verdict = allPass ? "Ã¢Å“â€¦ READY TO TRADE" : "Ã¢ÂÅ’ NOT READY Ã¢â‚¬â€ fix above before trading";
    return res.json({ reply: `Ã°Å¸Å¡Â¦ SESSION READINESS\n${sep}\n${checks.join("\n")}\n${sep}\n${verdict}` });
  }

  if (message.trim() === "/alert") {
    return res.json({ reply: "Ã°Å¸â€œÂ¡ Paste a Ximes signal then run:\n/alert [paste signal here]\n\nExample:\n/alert [2:34 PM] ximestrades ES LONG 5880" });
  }

  if (message.startsWith("/alert ")) {
    const today = new Date().toISOString().split('T')[0];
    const _alertStart = Date.now();
    const text = message.slice(7).trim();
    const readiness = checkSessionReadiness();
    const readinessPrefix = readiness.warnings.length > 0
      ? 'Ã°Å¸Å¡Â¦ Session notes:\n' + readiness.warnings.join('\n') + '\n\n'
      : '';

    if (isWeekend()) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'weekend', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "Ã¢ÂÅ’ Market closed. Weekend." });
    }
    if (!isMarketOpen().open) {
      setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'market_closed', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "Ã¢ÂÂ° Market closed. Opens 9:30 AM ET. Use this time to prep levels." });
    }
    const _tradingTime = isGoodTradingTime();
    if (!_tradingTime.good) {
      if (_tradingTime.window === "lunch") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'lunch_window', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: "Ã¢Å¡Â Ã¯Â¸Â Lunch chop window. High risk. Skip unless A+ setup only." });
      }
      if (_tradingTime.window === "last10") {
        setImmediate(() => logSignalReplay({ raw_input: text, verdict: 'SKIP', skip_reason: 'last_10_mins', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: "Ã¢Å¡Â Ã¯Â¸Â Last 10 mins. Ximes says no responsibility after 3:49 PM." });
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
      return res.json({ reply: "Ã¢ÂÅ’ SKIP Ã¢â‚¬â€ could not parse signal" });
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
          runnerLine = '\nÃ°Å¸ÂÆ’ Runner set Ã¢â‚¬â€ ' + (100 - trimPct) + '% remaining.' +
                       '\nÃ¢â€ â€™ Stop: move to breakeven (' + trimActive.strike + ')' +
                       '\nÃ¢â€ â€™ Let Ximes call the exit. Do not touch it.';
        }
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'trim', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã¢Å“â€šÃ¯Â¸Â TRIM Ã¢â‚¬â€ Ximes taking ' + trimPct + '% off.\n' +
          'Ã¢â€ â€™ Reduce position by ' + trimPct + '% NOW in Tradovate.' +
          runnerLine
        });
      }
      if (signal.action === 'RUNNER') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'runner', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã°Å¸ÂÆ’ XIMES RUNNER Ã¢â‚¬â€ Hold partial position.\n' +
          (signal.sizing ? 'He has ' + signal.sizing +
            ' cons left (' + signal.pctRemaining + '%).\n' : '') +
          'Ã¢â€ â€™ Keep 20-25% on. Move stop to breakeven.' });
      }
      if (signal.action === 'CLOSE') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'close', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã°Å¸Å¡Âª XIMES EXIT Ã¢â‚¬â€ Close position now.' });
      }
      if (signal.action === 'ADD') {
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'add', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã¢Å¾â€¢ XIMES ADDING Ã¢â‚¬â€ He is sizing in further.\n' +
          'Ã¢â€ â€™ Consider adding within your risk parameters.' });
      }
      if (signal.action === 'STOP_UPDATE') {
        const price = signal.price ? '$' + signal.price : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'stop_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã¢ÂÂº STOP UPDATE Ã¢â‚¬â€ Move your stop to ' + price + '.\n' +
          'Ã¢â€ â€™ Adjust in Tradovate now. Do not wait.'
        });
      }
      if (signal.action === 'TARGET_UPDATE') {
        const ticker = signal.ticker ? signal.ticker + ' ' : '';
        const price  = signal.price  ? String(signal.price)  : 'check message';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: 'MANAGEMENT', verdict: 'MANAGEMENT', skip_reason: 'target_update', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply:
          'Ã°Å¸Å½Â¯ TARGET UPDATE Ã¢â‚¬â€ ' + ticker + 'new target: ' + price + '.\n' +
          'Ã¢â€ â€™ Adjust your OCO or mental target now.'
        });
      }
    }

    if (signalTimestamp) signal.signal_time = signalTimestamp;

    // BLOCKER 2 Ã¢â‚¬â€ alert dedup
    const dupMsg = checkAlertDedup(signal);
    if (dupMsg) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'dedup', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: dupMsg });
    }

    // BLOCKER 3 Ã¢â‚¬â€ active trade guard
    let runnerWarning = '';
    const activeTrade = loadActiveTrade();
    if (activeTrade) {
      if (activeTrade.runner) {
        runnerWarning = 'Ã¢Å¡Â Ã¯Â¸Â Runner active on ' + (activeTrade.ticker || '?') +
                        ' (' + (activeTrade.runner_pct || '?') + '% remaining). ' +
                        'New signal is independent Ã¢â‚¬â€ manage runner separately.\n\n';
      } else {
        const since = activeTrade.opened_at ? Math.round((Date.now() - new Date(activeTrade.opened_at).getTime()) / 60000) : '?';
        setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: signal.strike, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'active_trade', ms_elapsed: Date.now() - _alertStart }));
        return res.json({ reply: `Ã¢Å¡Â Ã¯Â¸Â Active trade detected (${activeTrade.direction} ${activeTrade.ticker} opened ${since}m ago). Close current trade with /trade before new signals.` });
      }
    }

    log("alert", { event: "auto-username detection", detected: detectedUsername, timestamp: signalTimestamp });

    const obj = getLegacyConfluenceState(today);
    const strike = signal.strike || signal.entry_price || null;
    if (!strike) {
      setImmediate(() => logSignalReplay({ raw_input: text, analyst: signal.analyst, signal_type: signal.signal_type, parsed: { ticker: signal.ticker, direction: signal.direction, strike: null, entry_price: signal.entry_price }, verdict: 'SKIP', skip_reason: 'no_strike', ms_elapsed: Date.now() - _alertStart }));
      return res.json({ reply: "Ã¢ÂÅ’ SKIP Ã¢â‚¬â€ no strike found in signal" });
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
      edgeNote = "Ã°Å¸â€œâ€¹ Edge match: Ximes morning window (9:30Ã¢â‚¬â€œ11:00 AM) Ã¢â‚¬â€ preferred setup";
    } else if (_isMorning) {
      edgeNote = "Ã°Å¸â€œâ€¹ Edge match: Morning window Ã¢â‚¬â€ Ximes preferred SPY/SPX 0-1DTE play";
    } else if (_isAfternoon) {
      edgeNote = "Ã°Å¸â€œâ€¹ Edge match: Afternoon window (2Ã¢â‚¬â€œ3:50 PM) Ã¢â‚¬â€ higher risk, size down Ã¢Å¡Â Ã¯Â¸Â";
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
      return res.json({ reply: runnerWarning + `Ã¢ÂÅ’ SKIP Ã¢â‚¬â€ no confluence at ${strike} (${instrLabel}) today${timeSuffix}${softSuffix}` });
    }

    const regime = getSiennaRegime();
    let todayTradeCount = 0;
    try {
      todayTradeCount = fs.readFileSync(TRADES_JSONL, "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(today) || (t.timestamp || "").startsWith(today))).length;
    } catch {}
    const regimeLine = `\nÃ°Å¸Å’Â¡Ã¯Â¸Â Regime: ${regime.regime} Ã¢â‚¬â€ ${regime.reason}`;

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
      return res.json({ reply: `Ã°Å¸Å¡Â« BLOCKED Ã¢â‚¬â€ max ${regime.max_trades_today} trades today reached [${regime.regime}]${regimeLine}${timeSuffix}${softSuffix}` });
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
        return res.json({ reply: `Ã¢ÂÅ’ SKIP Ã¢â‚¬â€ bracket error: ${bracket.error}` });
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
        return res.json({ reply: `Ã¢ÂÅ’ SKIP Ã¢â‚¬â€ ${ticker} ${direction} ${strike}${timeSuffix}\n${bracket.flag_message}\nR:R 1:${bracket.rr_ratio}${regimeLine}${edgeSuffix}${softSuffix}` });
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
          return res.json({ reply: `Ã¢â€ºâ€ APEX FLOOR Ã¢â‚¬â€ This trade risks breaching your EOD trail floor ($${apexState.trail_floor.toLocaleString()}). Max risk on this trade: $${maxRisk.toLocaleString()}. Reduce size or skip.` });
        }
      }

      let verdict = "SETUP";
      let verdictEmoji = "Ã¢Å“â€¦";
      let weakLine = "";
      if (bracket.flag === "warning") {
        verdict = "WEAK";
        verdictEmoji = "Ã¢Å¡Â Ã¯Â¸Â";
        weakLine = `\nÃ¢Å¡Â Ã¯Â¸Â ${bracket.flag_message}`;
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

      // BLOCKER 3 Ã¢â‚¬â€ mark trade as active on SETUP
      if (verdict === "SETUP") {
        writeActiveTrade({ ...signal, ticker, direction }, bracket, sizingNote ? { sizing_note: sizingNote } : {});
        // Fire popup via WS Ã¢â‚¬â€ same staged_trade event the autonomous path uses
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
            signal:       { ticker, direction, entry: bracket.entry, stop: bracket.stop, target: bracket.target, confluence_score: hit.score, confluence_confidence: hit.confidence, reason: `${hit.confidence} confluence Ã¢â‚¬â€ manual alert` },
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
        ? '\nÃ°Å¸Å½Â¯ Kat context (' + katInstrument + '): ' +
          katSummary.count + ' signals in last 30m Ã¢â‚¬â€ ' + katSummary.dominant_bias +
          (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
        : '';
      // Saty ATR entry refinement
      const _satyData = loadSatyLevels();
      const _satyLine = _satyData
        ? getSatyRecommendation(bracket.entry, direction, bracket.stop, _satyData)
        : null;
      const satySuffix = _satyLine ? '\n' + _satyLine : '';
      const replyText = [
        `${verdictEmoji} ${verdict} Ã¢â‚¬â€ ${ticker} ${direction}${timeSuffix}`,
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
      ? '\nÃ°Å¸Å½Â¯ Kat context (' + katInstrument + '): ' +
        katSummary.count + ' signals in last 30m Ã¢â‚¬â€ ' + katSummary.dominant_bias +
        (katSummary.with_image ? ' (' + katSummary.with_image + ' charts)' : '')
      : '';
    return res.json({ reply: readinessPrefix + runnerWarning + `Ã¢Å¡Â Ã¯Â¸Â WEAK Ã¢â‚¬â€ ${hit.confidence} confluence at ${hit.level} (${instrLabel}) (score: ${hit.score})${timeSuffix}${regimeLine}${edgeSuffix}${softSuffix}` + _katWeak });
  }

  if (message.startsWith('/runner')) {
    const runnerArgs = message.slice(7).trim().split(/\s+/);
    const pct = parseInt(runnerArgs[0]) || 50;
    const runnerTrade = loadActiveTrade();
    if (!runnerTrade || runnerTrade.status !== 'open') {
      return res.json({ reply: 'Ã¢ÂÅ’ No active trade to set runner on.' });
    }
    runnerTrade.runner      = true;
    runnerTrade.runner_pct  = 100 - pct;
    runnerTrade.runner_stop = runnerTrade.strike;
    runnerTrade.trimmed_at  = new Date().toISOString();
    runnerTrade.trim_pct    = pct;
    try { writeJsonAtomic(ACTIVE_TRADE_FILE, runnerTrade); } catch {}
    return res.json({ reply:
      'Ã°Å¸ÂÆ’ Runner active.\n' +
      'Ã¢â€ â€™ ' + pct + '% trimmed. ' + (100 - pct) + '% running.\n' +
      'Ã¢â€ â€™ Move stop to breakeven (' + runnerTrade.strike + ') in Tradovate NOW.\n' +
      'Ã¢â€ â€™ Next Ximes management signal will guide the rest.'
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
          `Ã¢Å¡Â Ã¯Â¸Â RUNNER ACTIVE Ã¢â‚¬â€ ${_rt} ${_rp}% still running.\n` +
          `Ximes hasn't called the exit yet.\n` +
          `Ã¢â€ â€™ Close full position? Add RUNNER to confirm: /trade ${direction} ${ticker} ${rawEntry} ${rawExit} ${result} RUNNER\n` +
          `Ã¢â€ â€™ Or set runner stop in Tradovate and wait for Ximes call.`
        });
      }
    }
    appendJsonl(TRADES_JSONL, tradeEntry);
    // F1 fix Ã¢â‚¬â€ update state.daily_pnl so Apex consistency cap sees manual trades
    try {
      const tradeState = loadState();
      const dollarPnl  = pnl * (ticker === 'SPY' ? 100 : 1);
      tradeState.daily_pnl = parseFloat(((tradeState.daily_pnl || 0) + dollarPnl).toFixed(2));
      saveState(tradeState);
    } catch (e) {
      console.error('[trade] state.daily_pnl update failed:', e.message);
    }
    clearActiveTrade(); // BLOCKER 3 Ã¢â‚¬â€ trade closed, clear active-trade guard
    const sign = pnl >= 0 ? "+" : "";
    const runnerSuffix = isRunnerClose ? ' Runner closed. Full position closed.' : '';
    return res.json({ reply: `Ã¢Å“â€¦ Trade logged. ${direction} ${ticker} ${entry}Ã¢â€ â€™${exit} ${result} (${sign}${pnl} pts)${runnerSuffix}` });
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
    const header = `Ã°Å¸â€œÅ  Today: ${todayTrades.length} trades | ${wins}W ${losses}L | Net: ${sign}${netPts.toFixed(2)} pts`;
    const tradeLines = todayTrades.map(t => {
      const ps = (t.pnl >= 0 ? "+" : "") + t.pnl;
      return `  ${t.direction} ${t.ticker} ${t.entry}Ã¢â€ â€™${t.exit} ${t.result} (${ps} pts)`;
    });
    const tradeCtx = loadTodayContext();
    const exitWarnings = checkEmotionalState(tradeCtx);
    const stateLines = exitWarnings.length > 0
      ? ["Emotional state: " + exitWarnings.map(w => `${w.emoji} ${w.message}`).join(" | ")]
      : ["Emotional state: Ã¢Å“â€¦ Clear"];

    const replay = todaySummary();
    const replayLines = replay
      ? ['\nÃ°Å¸â€œÅ  Signal log: ' + replay.total + ' signals Ã¢â‚¬â€ ' +
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
    return res.json({ reply: "Ã¢Å“â€¦ Daily reset complete. Paste /dubz and /heatmap to start." });
  }

  if (message.trim() === "/session") {
    const ctx = getSessionContext();
    return res.json({ reply:
      'Ã°Å¸â€œÂ Session context:\n' +
      'Instrument: ' + (ctx.instrument || 'none') + '\n' +
      'Direction: ' + (ctx.direction || 'none') + '\n' +
      'Strike: ' + (ctx.strike || 'none') + '\n' +
      'In trade: ' + (ctx.inTrade ? 'YES' : 'no') + '\n' +
      'Since: ' + (ctx.tradeStartTime
        ? new Date(ctx.tradeStartTime).toLocaleTimeString()
        : 'Ã¢â‚¬â€')
    });
  }

  if (message.trim() === "/status") {
    const today = new Date().toISOString().split('T')[0];
    const statusLines = [];
    statusLines.push("LUKE ONLINE");
    statusLines.push("");

    const _mkt = isMarketOpen();
    const _tt  = isGoodTradingTime();
    let _cd = null;
    if (_mkt.open) {
      statusLines.push(`Market: OPEN - ${_tt.message}`);
    } else {
      const _mins = minsUntilOpen();
      const _h = Math.floor(_mins / 60);
      const _m = _mins % 60;
      _cd = _h > 0 ? `${_h}h ${_m}m` : `${_m}m`;
      statusLines.push(`Market: CLOSED - Opens in ${_cd}`);
    }

    const workflowStatus = getPhase2WorkflowLoadStatus();
    const satyStatus = loadSatyLevels();
    const apexStatus = loadApexState();
    if (workflowStatus.dubzLoaded || workflowStatus.bobbyLoaded) {
      statusLines.push(`Levels: loaded (${workflowStatus.dubzCount} Dubz, ${workflowStatus.bobbyCount} Bobby mentions)`);
    } else {
      statusLines.push("Levels: not loaded");
    }
    statusLines.push(`Saty: ${satyStatus ? 'loaded' : 'missing'}`);
    const prepLine = getMorningPrepLine(apexStatus, satyStatus, workflowStatus);
    if (prepLine) statusLines.push(`Next: ${prepLine}`);

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
      statusLines.push(`State: CLOSED - Market opens in ${_cd}`);
    } else {
      const stTradeCtx = loadTodayContext();
      const stWarnings = checkEmotionalState(stTradeCtx);
      const stHard = stWarnings.find(w => w.type === "HARD");
      const stSoft = stWarnings.filter(w => w.type === "SOFT");
      if (stHard) {
        statusLines.push(`State: RED - ${stHard.message}`);
      } else if (stSoft.length > 0) {
        statusLines.push(`State: YELLOW - ${stSoft.map(w => w.message).join(" | ")}`);
      } else {
        statusLines.push("State: GREEN");
      }
    }

    try {
      const regime = getSiennaRegime();
      statusLines.push(`Regime: ${regime.regime} - ${regime.reason}`);
    } catch {}
    statusLines.push("In memory of Luke");

    try {

      if (fs.existsSync(LAST_SIGNAL_FILE)) {
        const sig = JSON.parse(fs.readFileSync(LAST_SIGNAL_FILE, "utf8"));
        if (sig.date === today) {
          statusLines.push(`Last signal: ${sig.time} ${sig.ticker} - ${sig.verdict}`);
        } else {
          statusLines.push("Last signal: none today");
        }
      } else {
        statusLines.push("Last signal: none today");
      }
    } catch { statusLines.push("Last signal: none today"); }

    return res.json({ reply: statusLines.join("\n") });
  }

  if (message.startsWith("/luke ") || message.trim() === "/luke") {
    return res.json({ reply: "In memory of Luke. /luke logging is retired." });
  }

  if (message.trim() === "/layout") {
    const { exec } = require("child_process");
    const layoutScript = path.join(LUKE_ROOT, "scripts", "trading-layout.py");
    exec(`python "${layoutScript}"`, (err) => {
      if (err) log("layout", { event: "layout script error", error: err.message });
    });
    return res.json({
      reply: [
        "Ã°Å¸â€œÂ Layout starting...",
        "1. Positioning Luke Ã¢Å“â€œ",
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
        broadcast({ type: 'notification', message: 'Ã¢Å¡Â Ã¯Â¸Â trading-mode: pywin32 not installed. Run: pip install pywin32 --break-system-packages' });
        return;
      }
      exec('python "' + scriptPath + '"', (err2, stdout, stderr) => {
        if (err2) {
          console.error('[trading-mode]', err2.message);
          const detail = (stderr || stdout || err2.message || 'unknown').slice(0, 200);
          broadcast({ type: 'notification', message: 'Ã¢Å¡Â Ã¯Â¸Â trading-mode failed: ' + detail });
        }
      });
    });
    return res.json({ reply: 'Ã°Å¸â€“Â¥Ã¯Â¸Â Layout launching Ã¢â‚¬â€ ximes top-left, Bobby bottom-left, Tradovate top-right, Luke bottom-right. Takes ~20s. Check top bar for errors.' });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ SATY ATR LEVELS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  if (message.trim() === '/saty') {
    return res.json({ reply: buildStatusSummary(loadSatyLevels()) });
  }

  if (message.startsWith('/saty ')) {
    const satyText = message.slice(6).trim();
    const satyParsed = parseSatyText(satyText);
    if (!satyParsed.valid) {
      return res.json({ reply: `Ã¢ÂÅ’ ${satyParsed.error || 'parse failed'}\n\nFormat: paste 13 levels highestÃ¢â€ â€™lowest\n/saty 5920 5910 5900 5890 5880 5870 5860 5850 5840 5830 5820 5810 5800` });
    }
    saveSatyLevels(satyParsed);
    const savedSaty = loadSatyLevels();
    await appendSatyToMemory(savedSaty);
    return res.json({ reply: `Ã°Å¸â€œÂ Saty levels saved:\n\n${buildStatusSummary(savedSaty)}\n\nWill appear in /alert as entry refinement.` });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ DUBZ LEVELS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  if (message.trim() === '/mancini') {
    return res.json({ reply: 'Use /mancini [tweet text]\nExample:\n/mancini Apr 9 8am: 6809 reclaim long trigger, 6819 1st, 6830 2nd. Chop 6793/88 to 6830.' });
  }

  if (message.startsWith('/mancini ')) {
    const rawText = message.slice(9).trim();
    const parsed = parseManciniText(rawText);
    if (parsed.levels.length === 0 && parsed.chop_zones.length === 0) {
      return res.json({ reply: `ÃƒÂ¢Ã‚ÂÃ…â€™ Mancini parse failed.\n${parsed.parse_errors.join('\n')}` });
    }

    await appendManciniToMemory(parsed);

    const grouped = new Map();
    for (const level of parsed.levels) {
      const key = level.intent || level.direction || 'other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(level.price);
    }

    const lines = [`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‹Å“ Mancini levels saved (${parsed.instrument} ${parsed.date})`];
    for (const [intent, prices] of grouped) {
      lines.push(`${intent}: ${prices.join(', ')}`);
    }
    for (const zone of parsed.chop_zones) {
      lines.push(`avoid: ${zone.low}-${zone.high} (chop)`);
    }
    if (parsed.parse_errors.length > 0) {
      lines.push(`notes: ${parsed.parse_errors.join('; ')}`);
    }
    return res.json({ reply: lines.join('\n') });
  }

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
        visionNote = ` (vision rate-limited Ã¢â‚¬â€ retry in ${waitSecs}s)`;
      } else {
        lastDubzVisionCallMs = now;
        try {
          const imgResult = await parseDubzImage(res._dubzImage);
          imageResults = imgResult ? [imgResult] : [];
          if (imgResult?.parse_status === 'failed') {
            visionFailed = true;
            visionNote = `\nÃ¢ÂÅ’ Vision error: ${imgResult.error}`;
          } else if (imgResult) {
            visionNote = ` + vision parsed (${imgResult.instrument || '?'}: ${(imgResult.levels || []).length} levels)`;
          }
        } catch (err) {
          visionFailed = true;
          visionNote = `\nÃ¢ÂÅ’ Vision error: ${err.message}`;
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
    await appendDubzToMemory(newState);

    // Build reply summary
    const instrLines = Object.entries(newState.instruments)
      .map(([instr, data]) => `${instr}: ${data.levels.length}`)
      .join('  |  ');
    const conflictLine = newState.conflicts.length > 0
      ? `\nÃ¢Å¡Â Ã¯Â¸Â ${newState.conflicts.length} conflict(s) detected Ã¢â‚¬â€ run /dubz to review`
      : '';
    const errLine = newState.parse_errors.length > 0
      ? `\nParse notes: ${newState.parse_errors.join('; ')}`
      : '';

    if (newState.carry_forward_failed) {
      return res.json({ reply: `Ã¢Å¡Â Ã¯Â¸Â Carry-forward requested but no prior Dubz state was found. Paste today's levels first.` });
    }

    const mixedSuccess = visionFailed && textResult;
    const dubzPrefix   = mixedSuccess ? 'Ã¢Å¡Â Ã¯Â¸Â Partial parse Ã¢â‚¬â€ text levels captured, image vision failed\n' : '';
    const dubzTailNote = mixedSuccess ? visionNote : '';
    const dubzInline   = mixedSuccess ? '' : visionNote;
    // Suppress parse_errors redundancy in mixed-success: dubzTailNote already carries the Ã¢ÂÅ’ detail
    const dubzErrLine  = mixedSuccess ? '' : errLine;

    return res.json({
      reply: `${dubzPrefix}Ã°Å¸â€œÅ  Dubz levels updated${dubzInline}.\n${instrLines}${conflictLine}${dubzErrLine}${dubzTailNote}`,
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ /verdict Ã¢â‚¬â€ confluence verdict across Level Memory Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  //
  // /verdict           Ã¢â€ â€™ NQ + ES + SPY, top 5 levels each by grade
  // /verdict ES        Ã¢â€ â€™ ES (+ SPX-equivalent) levels, top 5
  // /verdict NQ all    Ã¢â€ â€™ NQ (+ QQQ-equivalent) levels, no cap
  //
  // C7: fails open when Level Memory is empty or live price unavailable.

  if (message.trim() === '/verdict' || message.startsWith('/verdict ')) {
    const args = message.slice('/verdict'.length).trim().split(/\s+/).filter(Boolean);
    const hasAll = args.includes('all');
    const instrArgs = args.filter(a => a.toLowerCase() !== 'all').map(a => a.toUpperCase());

    const DEFAULT_INSTRUMENTS = ['NQ', 'ES', 'SPY'];
    const instruments = instrArgs.length > 0 ? instrArgs : DEFAULT_INSTRUMENTS;
    const topN = hasAll ? Infinity : 5;

    // Get live prices for staleness grounding Ã¢â‚¬â€ fail-open if unavailable (C7)
    let livePrice = null;
    try {
      livePrice = await getLivePrice();
    } catch { /* no-op Ã¢â‚¬â€ staleness flags will be absent */ }

    const currentPrices = {
      NQ:  livePrice?.instruments?.nq?.price  ?? null,
      ES:  livePrice?.instruments?.es?.price  ?? null,
      SPX: livePrice?.instruments?.spx?.price ?? livePrice?.spx ?? null,
      QQQ: livePrice?.instruments?.qqq?.price ?? null,
      SPY: livePrice?.instruments?.spy?.price ?? livePrice?.spy ?? null,
    };

    const reply = buildVerdictMarkdown(instruments, { currentPrices, topN });
    return res.json({ reply });
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
    const args = message.slice('/entries '.length).trim().split(/\s+/).filter(Boolean);
    if (args.length < 1) {
      return res.json({ reply: 'Use /entries <INSTRUMENT>' });
    }

    const instrument = args[0].toUpperCase();
    const records = queryLevelsAcrossEquivalents(instrument);
    if (records.length === 0) {
      return res.json({ reply: `No levels recorded yet for ${instrument}.` });
    }

    let livePrice = null;
    try {
      livePrice = await getLivePrice();
    } catch {}

    const currentPrice = instrument === 'ES'
      ? (livePrice?.instruments?.es?.price ?? null)
      : instrument === 'NQ'
        ? (livePrice?.instruments?.nq?.price ?? null)
        : null;

    const ranked = records
      .map(record => ({ record, scored: scoreLevel(record, { currentPrice }) }))
      .sort((a, b) => b.scored.score - a.scored.score);

    const avoidZones = records
      .filter(record => (record.mentions || []).some(m => m.analyst === 'mancini' && m.intent === 'chop_boundary'))
      .sort((a, b) => a.canonical_price - b.canonical_price);

    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const replayDate = `${etNow.getFullYear()}-${String(etNow.getMonth() + 1).padStart(2, "0")}-${String(etNow.getDate()).padStart(2, "0")}`;
    const replayTolerance = ['ES', 'NQ'].includes(instrument) ? 1.0 : 0.5;
    let replayBars = null;
    try {
      replayBars = loadIntraday(instrument, replayDate);
    } catch {}

    const top = ranked.slice(0, 5).map(item => {
      const replay = replayBars && replayBars.length > 0
        ? replayLevelAgainstPriceAction(item.record, replayBars, { tolerancePoints: replayTolerance, windowMinutes: 30, futures: ['ES', 'NQ'].includes(instrument) })
        : null;
      const zone = computeFuturesEntryZone(item.record, {
        instrument,
        currentPrice,
        confluenceGrade: item.scored.grade,
        confluenceScore: item.scored.score,
        historicalReplay: replay,
      });
      const abort = zone.entry_window.abort_below != null
        ? `abort< ${zone.entry_window.abort_below}`
        : `abort> ${zone.entry_window.abort_above}`;
      return `- ${instrument} ${zone.canonical_price} ${item.scored.grade} | opt ${zone.entry_window.optimal_entry} | ok ${zone.entry_window.acceptable_entry} | ${abort} | ${zone.sizing_guidance}`;
    });

    const avoidLines = [];
    for (let i = 0; i < avoidZones.length - 1; i += 2) {
      avoidLines.push(`AVOID: ${avoidZones[i].canonical_price}-${avoidZones[i + 1].canonical_price} (Mancini chop zone)`);
    }

    return res.json({
      reply: [
        `## Futures Entries ${instrument}`,
        ...(top.length > 0 ? top : ['No actionable levels.']),
        ...(avoidLines.length > 0 ? ['Avoid zones:', ...avoidLines] : []),
      ].join('\n'),
    });
  }

  return null;
}

module.exports = {
  handleSlashCommand,
  extractRichydubzLevels,
  _internal: { getPhase2WorkflowLoadStatus, getLegacyConfluenceState }
};




