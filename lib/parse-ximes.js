'use strict';

// ── Session context (persists across calls in same process) ──
let lastInstrument = null;
let lastDirection  = null;
let lastStrike     = null;
let sessionCtx = {
  instrument: null, direction: null, strike: null,
  inTrade: false, tradeStartTime: null
};

function getSessionContext() { return { ...sessionCtx }; }
function resetSessionContext() {
  lastInstrument = lastDirection = lastStrike = null;
  sessionCtx = { instrument:null, direction:null, strike:null,
                 inTrade:false, tradeStartTime:null };
}

// ── Noise filter ──────────────────────────────────────────────
const NOISE_PATTERNS = [
  /tell your mom/i,
  /we made it/i,
  /your gay/i,
  /rolling outta bed/i,
  /closest guess/i,
  /\bwhop\b/i,
  /1k to 5/i,
  /lfg+[^a-z]/i,
  /lets go+[^a-z]/i,
  /affiliate/i,
];

// ── Management signal patterns ────────────────────────────────
const TRIM_PATTERNS = [
  /\b(\d{2,3})%/,
  /take\s+(profits?|some\s+off)/i,
  /out\s+of\s+most/i,
  /you\s+should\s+be\s+out/i,
  /please\s+take\s+profits?/i,
  /bang+er+\s*alert/i,
  /securing\s+(profits?|gains?)/i,
];
const RUNNER_PATTERNS = [
  /hold\s+runners?/i,
  /keep\s+runners?/i,
  /(\d+)\s*\/\s*(\d+)\s*cons?/i,
];
const CLOSE_PATTERNS = [
  /close\s+(everything|all)/i,
  /fully?\s+out/i,
  /exit\s+all/i,
  /im\s+out\b/i,
];
const ADD_PATTERNS = [
  /sizing\s+in/i,
  /adding\s+(more|to)/i,
  /averag(ing|e\s+down)/i,
];

// ── Instrument ranges ─────────────────────────────────────────
function inferInstrument(strike) {
  if (!strike) return null;
  const s = Number(strike);
  if (s >= 15000 && s <= 30000) return 'NQ';
  if (s >= 5000  && s <= 6500)  return 'ES';
  if (s >= 7000  && s <= 8500)  return 'SPX';
  if (s >= 400   && s <= 750)   return 'SPY';
  if (s >= 100   && s <= 400)   return 'STOCK';
  return null;
}

// ── Strip Discord prefix ──────────────────────────────────────
function stripPrefix(text) {
  return text
    .replace(/^\[\d{1,2}:\d{2}\s*(AM|PM)\][^\:]+:\s*/i, '')
    .replace(/^[A-Za-z\[\]\s\$@]+,\s*:\s*/, '')
    .replace(/@(everyone|here)/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

// ── Main export ───────────────────────────────────────────────
function parseXimes(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = stripPrefix(rawText);
  if (text.length < 4) return null;

  // Noise check
  for (const re of NOISE_PATTERNS) {
    if (re.test(text)) return null;
  }
  // Pure URL
  if (/^https?:\/\//.test(text)) return null;

  // ── Management signals ──────────────────────────────────────
  // CLOSE
  for (const re of CLOSE_PATTERNS) {
    if (re.test(text)) {
      sessionCtx.inTrade = false;
      return { type:'MANAGEMENT', action:'CLOSE', raw:text };
    }
  }
  // RUNNER — skip if message also contains a strike+direction (sizing notation in entry)
  for (const re of RUNNER_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const hasEntrySignal = /\b\d{3,5}\s*[PpCc]\b/.test(text) ||
                             /\b\d{3,5}\s+(puts?|calls?)\b/i.test(text);
      if (hasEntrySignal && m[1] && m[2]) continue;
      const sizing = m[1] && m[2] ? m[1]+'/'+m[2] : null;
      const pct = sizing
        ? Math.round((Number(m[1])/Number(m[2]))*100) : null;
      return { type:'MANAGEMENT', action:'RUNNER',
               sizing, pctRemaining:pct, raw:text };
    }
  }
  // TRIM — only when percentage present OR explicit phrase
  for (const re of TRIM_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const gainPct = /\d{2,3}%/.test(text)
        ? Number(text.match(/(\d{2,3})%/)[1]) : null;
      return { type:'MANAGEMENT', action:'TRIM',
               gainPct, raw:text };
    }
  }
  // ADD
  for (const re of ADD_PATTERNS) {
    if (re.test(text)) {
      // still try to parse strike below — fall through
      // if no strike found, return ADD without strike
    }
  }

  // ── Entry signal parsing ────────────────────────────────────

  // Ticker detection (scan full text)
  const TICKERS = ['SPX','SPY','QQQ','ES','NQ','NVDA','AAPL',
                   'MSFT','TSLA','META','GOOGL','AMZN'];
  let ticker = null;
  for (const t of TICKERS) {
    if (new RegExp('\\b'+t+'\\b','i').test(text)) {
      ticker = t.toUpperCase(); break;
    }
  }

  // Strike detection — ordered most-specific to least
  let strike = null;
  let direction = null;

  // Pattern A: ticker + strike + direction  "SPX 7105 p"
  const patA = text.match(
    /\b(?:SPX|SPY|QQQ|ES|NQ|NVDA)\s+(\d{3,5})\s*([PpCc])\b/i);
  if (patA) {
    strike = Number(patA[1]);
    direction = /p/i.test(patA[2]) ? 'PUT' : 'CALL';
  }

  // Pattern B: strike immediately followed by P/C "7105P"
  if (!strike) {
    const patB = text.match(/\b(\d{3,5})([PpCc])\b(?!\w)/);
    if (patB) {
      strike = Number(patB[1]);
      direction = /p/i.test(patB[2]) ? 'PUT' : 'CALL';
    }
  }

  // Pattern C: strike + space + isolated P/C "7105 p"
  if (!strike) {
    const patC = text.match(/\b(\d{3,5})\s+([PpCc])\b(?!\w)/);
    if (patC) {
      strike = Number(patC[1]);
      direction = /p/i.test(patC[2]) ? 'PUT' : 'CALL';
    }
  }

  // Pattern D: strike + put/call word "7105 puts"
  if (!strike) {
    const patD = text.match(
      /\b(\d{3,5})\s+(puts?|calls?)\b/i);
    if (patD) {
      strike = Number(patD[1]);
      direction = /put/i.test(patD[2]) ? 'PUT' : 'CALL';
    }
  }

  // Pattern E: "X Strike" format "200 Strike"
  if (!strike) {
    const patE = text.match(/\b(\d{3,5})\s+[Ss]trike\b/);
    if (patE) strike = Number(patE[1]);
  }

  // Pattern F: bare direction word with session strike
  if (!strike && /\bputs?\b/i.test(text)) direction = 'PUT';
  if (!strike && /\bcalls?\b/i.test(text)) direction = 'CALL';

  // Pattern G: ticker + bare number (no direction qualifier) "SPX 7105"
  if (!strike && ticker) {
    const patG = text.match(new RegExp('\\b' + ticker + '\\s+(\\d{3,5})\\b', 'i'));
    if (patG) strike = Number(patG[1]);
  }

  // AVG price
  const avgM = text.match(
    /(?:avg|average|avging|@)\s*\$?(\d+\.?\d*)/i);
  const avg = avgM ? Number(avgM[1]) : null;

  // Instrument fallback
  if (!ticker && strike) {
    ticker = inferInstrument(strike) || lastInstrument;
  }
  if (!ticker) ticker = lastInstrument;
  // Direction fallback only when strike present — prevents session bleed on noise
  if (!direction && strike) direction = lastDirection;

  // Noise: no strike and no direction = context only
  if (!strike && !direction) {
    // Check for ADD pattern without strike
    for (const re of ADD_PATTERNS) {
      if (re.test(text)) {
        return { type:'MANAGEMENT', action:'ADD',
                 ticker, raw:text };
      }
    }
    return null;
  }

  // Update session memory
  if (ticker)    { lastInstrument = ticker;
                   sessionCtx.instrument = ticker; }
  if (direction) { lastDirection = direction;
                   sessionCtx.direction = direction; }
  if (strike)    { lastStrike = strike;
                   sessionCtx.strike = strike; }
  sessionCtx.inTrade = true;
  if (!sessionCtx.tradeStartTime)
    sessionCtx.tradeStartTime = new Date().toISOString();

  return {
    type: 'signal',
    ticker,
    strike,
    direction,
    avg,
    confidence: strike && direction && ticker ? 'HIGH' :
                strike && direction ? 'MEDIUM' : 'LOW',
    verdict: null,
    raw: text,
  };
}

module.exports = { parseXimes, getSessionContext,
                   resetSessionContext };
