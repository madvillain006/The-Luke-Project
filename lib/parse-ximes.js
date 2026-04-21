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

// ── Analyst map ───────────────────────────────────────────────
const ANALYST_MAP = {
  ximestrades:          { source: 'ximes', role: 'live',  channel: 'ximes-dubz' },
  followthewhiterabblt: { source: 'ximes', role: 'live',  channel: 'ximes-dubz' },
  kanabis16:            { source: 'kana',  role: 'relay', channel: 'ximes-dubz' },
};

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
  /TRIMMING\b/i,
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
const CUT_PATTERNS = [
  /^\s*CUT\b/i,
  /\bCUT\s*[—\-]/i,
];
const ADD_PATTERNS = [
  /sizing\s+in/i,
  /adding\s+(more|to)/i,
  /averag(ing|e\s+down)/i,
  /added\s+to\b/i,
];
const STOP_UPDATE_PATTERNS = [
  /updated?\s+stops?\s+to\b/i,
  /new\s+stl\b/i,
  /stop\s+is\b/i,
  /stops?\s+at\b/i,
];
const TARGET_UPDATE_PATTERNS = [
  /target\s+on\b/i,
  /is\s+next\s+target\b/i,
  /updated?\s+target\b/i,
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

// ── Extract price following a pattern match ───────────────────
function extractPriceAfter(text, re) {
  const m = text.match(re);
  if (!m) return null;
  const after = text.slice(m.index + m[0].length);
  const pm = after.match(/\$?(\d+\.?\d*)/);
  return pm ? Number(pm[1]) : null;
}

// ── TICKERS list (shared) ─────────────────────────────────────
const TICKERS = ['SPX','SPY','QQQ','ES','NQ','NVDA','AAPL',
                 'MSFT','TSLA','META','GOOGL','AMZN'];

function extractTicker(text) {
  for (const t of TICKERS) {
    if (new RegExp('\\b'+t+'\\b','i').test(text)) return t.toUpperCase();
  }
  return null;
}

// ── Direction normalizer (CALL/PUT or LONG/SHORT → LONG/SHORT) ─
function normalizeDirection(raw) {
  if (!raw) return null;
  const r = raw.toUpperCase();
  if (r === 'C' || r === 'CALL' || r === 'CALLS' || r === 'LONG') return 'LONG';
  if (r === 'P' || r === 'PUT'  || r === 'PUTS'  || r === 'SHORT') return 'SHORT';
  return null;
}

// ── PRE_MARKET_SETUP detector ─────────────────────────────────
function parsePreMarketSetup(text, analyst) {
  const hasSetupLabel    = /\bSETUP\s*[A-Z]?\b/i.test(text);
  const hasDirectionLabel = /\bDirection\s*:/i.test(text);
  if (!hasSetupLabel && !hasDirectionLabel) return null;

  const dirM    = text.match(/Direction\s*:\s*(calls?|puts?|long|short)/i);
  const strikeM = text.match(/Strike\s*:\s*(\d{3,5})/i);
  const cutM    = text.match(/Cut\s*:\s*(\d{3,5})/i);
  const confM   = text.match(/Confidence\s*:\s*(\d{1,3})%/i);

  if (!dirM && !strikeM) return null;

  const direction     = dirM ? normalizeDirection(dirM[1]) : null;
  const strike        = strikeM ? Number(strikeM[1]) : null;
  const cut           = cutM ? Number(cutM[1]) : null;
  const confidence_pct = confM ? Number(confM[1]) : null;
  const confidence    = confidence_pct !== null
    ? (confidence_pct >= 70 ? 'HIGH' : confidence_pct >= 50 ? 'MEDIUM' : 'LOW')
    : null;

  return {
    signal_type: 'PRE_MARKET_SETUP',
    direction, strike, cut, confidence_pct, confidence,
    analyst, raw: text,
  };
}

// ── Main export ───────────────────────────────────────────────
function parseXimes(username, rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Username gating — drop unknown users, allow null/empty (manual /alert path)
  let isRelay = false;
  let analystId = 'manual';
  if (username) {
    const analyst = ANALYST_MAP[username.toLowerCase()];
    if (!analyst) return null;
    isRelay  = analyst.role === 'relay';
    analystId = analyst.source;
  }

  // Length guard
  if (rawText.length > 10000) return null;

  const text = stripPrefix(rawText);
  if (text.length < 4) return null;

  // Noise check
  for (const re of NOISE_PATTERNS) {
    if (re.test(text)) return null;
  }
  if (/^https?:\/\//.test(text)) return null;

  // ── PRE_MARKET_SETUP (before management to avoid trim % collision) ──
  const setup = parsePreMarketSetup(text, analystId);
  if (setup) return setup;

  // ── Management signals ──────────────────────────────────────
  // CLOSE
  for (const re of CLOSE_PATTERNS) {
    if (re.test(text)) {
      sessionCtx.inTrade = false;
      return { signal_type:'MANAGEMENT', action:'CLOSE', analyst:analystId, raw:text };
    }
  }

  // CUT
  for (const re of CUT_PATTERNS) {
    if (re.test(text)) {
      const price = extractPriceAfter(text, re);
      return { signal_type:'MANAGEMENT', action:'CUT', price, analyst:analystId, raw:text };
    }
  }

  // STOP_UPDATE
  for (const re of STOP_UPDATE_PATTERNS) {
    if (re.test(text)) {
      const price = extractPriceAfter(text, re);
      return { signal_type:'MANAGEMENT', action:'STOP_UPDATE', price, analyst:analystId, raw:text };
    }
  }

  // TARGET_UPDATE
  for (const re of TARGET_UPDATE_PATTERNS) {
    if (re.test(text)) {
      const ticker = extractTicker(text);
      const pm = text.match(/\b(\d{3,5}(?:\.\d+)?)\b/);
      const price = pm ? Number(pm[1]) : null;
      return { signal_type:'MANAGEMENT', action:'TARGET_UPDATE', ticker, price, analyst:analystId, raw:text };
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
      const pct = sizing ? Math.round((Number(m[1])/Number(m[2]))*100) : null;
      return { signal_type:'MANAGEMENT', action:'RUNNER',
               sizing, pctRemaining:pct, analyst:analystId, raw:text };
    }
  }

  // TRIM
  for (const re of TRIM_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const pct = /\d{2,3}%/.test(text)
        ? Number(text.match(/(\d{2,3})%/)[1]) : null;
      return { signal_type:'MANAGEMENT', action:'TRIM', pct, analyst:analystId, raw:text };
    }
  }

  // ADD — parse strike/direction/entry_price, return MANAGEMENT/ADD
  for (const re of ADD_PATTERNS) {
    if (re.test(text)) {
      let addStrike = null, addDir = null;
      const patBd = text.match(/\b(\d{3,5}(?:\.\d+)?)\s*([PpCc])\b(?!\w)/);
      const patCd = text.match(/\b(\d{3,5}(?:\.\d+)?)\s+([PpCc])\b(?!\w)/);
      if (patBd) {
        addStrike = Number(patBd[1]);
        addDir = normalizeDirection(patBd[2]);
      } else if (patCd) {
        addStrike = Number(patCd[1]);
        addDir = normalizeDirection(patCd[2]);
      }
      const avgM = text.match(/(?:avg|average|avging|@)\s*\$?(\d*\.?\d+)/i)
                || text.match(/\$?(\d*\.\d+|\d+\.\d+)\s+(?:avg|average)\b/i);
      const entry_price = avgM ? Number(avgM[1]) : null;
      let ticker = extractTicker(text);
      if (!ticker && addStrike) ticker = inferInstrument(addStrike) || lastInstrument;
      return { signal_type:'MANAGEMENT', action:'ADD',
               ticker, strike:addStrike, direction:addDir, entry_price,
               analyst:analystId, raw:text };
    }
  }

  // ── Relay users stop here (management-only) ───────────────────
  if (isRelay) return null;

  // ── Entry signal parsing ──────────────────────────────────────

  let ticker = extractTicker(text);
  let strike = null;
  let direction = null;

  // Pattern A: ticker + strike + direction  "SPX 7105 p"
  const patA = text.match(
    /\b(?:SPX|SPY|QQQ|ES|NQ|NVDA)\s+(\d{3,5}(?:\.\d+)?)\s*([PpCc])\b/i);
  if (patA) {
    strike = Number(patA[1]);
    direction = normalizeDirection(patA[2]);
  }

  // Pattern B: strike immediately followed by P/C "7105P" or "7105C"
  if (!strike) {
    const patB = text.match(/\b(\d{3,5}(?:\.\d+)?)([PpCc])\b(?!\w)/);
    if (patB) {
      strike = Number(patB[1]);
      direction = normalizeDirection(patB[2]);
    }
  }

  // Pattern C: strike + space + isolated P/C "7105 p"
  if (!strike) {
    const patC = text.match(/\b(\d{3,5}(?:\.\d+)?)\s+([PpCc])\b(?!\w)/);
    if (patC) {
      strike = Number(patC[1]);
      direction = normalizeDirection(patC[2]);
    }
  }

  // Pattern D: strike + put/call word "7105 puts"
  if (!strike) {
    const patD = text.match(/\b(\d{3,5}(?:\.\d+)?)\s+(puts?|calls?)\b/i);
    if (patD) {
      strike = Number(patD[1]);
      direction = normalizeDirection(patD[2]);
    }
  }

  // Pattern E: "X Strike" format "200 Strike"
  if (!strike) {
    const patE = text.match(/\b(\d{3,5})\s+[Ss]trike\b/);
    if (patE) strike = Number(patE[1]);
  }

  // Pattern F: bare direction word with session strike
  if (!strike && /\bputs?\b/i.test(text)) direction = 'SHORT';
  if (!strike && /\bcalls?\b/i.test(text)) direction = 'LONG';

  // Pattern G: ticker + bare number (no direction qualifier) "SPX 7105"
  if (!strike && ticker) {
    const patG = text.match(new RegExp('\\b' + ticker + '\\s+(\\d{3,5}(?:\\.\\d+)?)\\b', 'i'));
    if (patG) strike = Number(patG[1]);
  }

  // Entry price — handles "avg X", "@X", and "X avg" with optional leading dot
  const avgM = text.match(/(?:avg|average|avging|@)\s*\$?(\d*\.?\d+)/i)
            || text.match(/\$?(\d*\.\d+|\d+\.\d+)\s+(?:avg|average)\b/i);
  const entry_price = avgM ? Number(avgM[1]) : null;

  // Instrument fallback
  if (!ticker && strike) ticker = inferInstrument(strike) || lastInstrument;
  if (!ticker) ticker = lastInstrument;
  // Direction fallback only when strike present — prevents session bleed on noise
  if (!direction && strike) direction = lastDirection;

  // Noise: no strike and no direction = context only
  if (!strike && !direction) return null;

  // Update session memory
  if (ticker)    { lastInstrument = ticker;   sessionCtx.instrument = ticker; }
  if (direction) { lastDirection = direction;  sessionCtx.direction = direction; }
  if (strike)    { lastStrike = strike;        sessionCtx.strike = strike; }
  sessionCtx.inTrade = true;
  if (!sessionCtx.tradeStartTime) sessionCtx.tradeStartTime = new Date().toISOString();

  return {
    signal_type: 'LIVE_ENTRY',
    ticker,
    strike,
    direction,
    entry_price,
    analyst: analystId,
    confidence: strike && direction && ticker ? 'HIGH' :
                strike && direction ? 'MEDIUM' : 'LOW',
    verdict: null,
    raw: text,
  };
}

module.exports = { parseXimes, getSessionContext, resetSessionContext };
