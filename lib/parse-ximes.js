'use strict';

const ANALYST_MAP = {
  followthewhiterabblt: 'ximes',
  ximestrades: 'ximes',
  richydubz: 'richydubz'
};

// ─── helpers ────────────────────────────────────────────────────────────────

function analyst(username) {
  return ANALYST_MAP[username] || null;
}

function extractNumbers(text) {
  return [...text.matchAll(/\$?([\d,]+(?:\.\d+)?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n));
}

function firstNumber(text, afterLabel) {
  const idx = text.search(new RegExp(afterLabel, 'i'));
  if (idx === -1) return null;
  const m = text.slice(idx).match(/\$?([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

function confidence(pct) {
  if (pct >= 70) return 'HIGH';
  if (pct >= 50) return 'MEDIUM';
  return 'LOW';
}

function toDirection(text) {
  if (/\b(calls?|bull(?:ish)?|long)\b/i.test(text)) return 'LONG';
  if (/\b(puts?|bear(?:ish)?|short)\b/i.test(text)) return 'SHORT';
  return null;
}

// ─── noise filter ────────────────────────────────────────────────────────────

const TICKER_ALONE_RE = /^(NQ|QQQ|ES|SPY|SPX)$/i;
const URL_ONLY_RE     = /^https?:\/\/\S+$/;
const PRICE_RE        = /\d+\.?\d*/;
const DIRECTION_RE    = /\b(call|calls?|put|puts?|long|short|bull|bear)\b/i;

const DIRECTION_TICKER_RE = /\b(long|short)\s+(SPX|SPY|NQ|ES|QQQ|MNQ|MES)\s+\d/i;

function isNoise(text) {
  if (text.length < 15 && !DIRECTION_TICKER_RE.test(text)) return true;
  if (URL_ONLY_RE.test(text)) return true;
  const stripped = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}]/gu, '')
    .trim();
  if (!stripped) return true; // image/gif/emoji only
  if (TICKER_ALONE_RE.test(stripped.trim())) return true;
  if (!PRICE_RE.test(text) && !DIRECTION_RE.test(text)) return true;
  return false;
}

function isBio(text) {
  return (
    text.length > 500 &&
    !/strike:/i.test(text) &&
    !/entry:/i.test(text) &&
    !/cut:/i.test(text)
  );
}

// ─── type classifiers ────────────────────────────────────────────────────────

function classifyPreMarket(text) {
  const hasSetup    = /SETUP\s+[ABC]/i.test(text);
  const hasDirStrike = /Direction:/i.test(text) && /Strike:/i.test(text);
  const hasEntyCut   = /Entry:/i.test(text) && /Cut:/i.test(text);
  return hasSetup || hasDirStrike || hasEntyCut;
}

function classifyLiveEntry(text) {
  return (
    /ENTRY NOW/i.test(text) ||
    /\bCALLS\s*[—–-]/i.test(text) ||
    /\bPUTS\s*[—–-]/i.test(text) ||
    /\b(SPX|SPY|NQ|ES|QQQ)\b.+(C|P|calls?|puts?).+(AVG|avg)\s*\$?[\d.]+/i.test(text) ||
    /\b(SPX|SPY|NQ|ES|QQQ)\b.*\d+\s*(calls?|puts?|[CP])\b/i.test(text) ||
    // direction-first: "long SPY 556c", "short ES 5850"
    /\b(long|short|bull|bear)\s+(SPX|SPY|NQ|ES|QQQ|MNQ|MES)\b/i.test(text) ||
    // "ported the 709c" — Ximes high-conviction entry slang
    /\bport(?:ed|ing|s)?\b/i.test(text)
  );
}

function classifyManagement(text) {
  return /\b(TRIM(?:MING)?|SELLING|SOLD|ADDING|ADDED|CUT|STOPPED|STOP)\b/i.test(text) ||
    /cut small loss/i.test(text) ||
    /selling\s+\d+%/i.test(text) ||
    /taking profits?/i.test(text) ||
    /\brolling\b/i.test(text) ||
    /\bscaling\s+out\b/i.test(text);
}

function classifyContext(text, username) {
  const keywords = /\b(king|PIKA|node|gamma|vanna|air pocket|barney)\b/i.test(text);
  const richyLong = username === 'richydubz' && text.length > 300 && extractNumbers(text).length >= 3;
  return keywords || richyLong;
}

function classifySizing(text) {
  return (
    /\bBP\b/.test(text) ||
    /buying power/i.test(text) ||
    (/\bsize\b/i.test(text) && /\b(morning|afternoon|today)\b/i.test(text)) ||
    /\b(MEDIUM tier|HIGH tier|LOTTO)\b/i.test(text)
  );
}

// ─── parsers ─────────────────────────────────────────────────────────────────

function parsePreMarket(text, src) {
  const setupM = text.match(/SETUP\s+([ABC])/i);
  const setup_id = setupM ? setupM[1].toUpperCase() : null;

  const dirRaw = (text.match(/Direction:\s*(\S+)/i) || [])[1] || '';
  const direction = toDirection(dirRaw) || toDirection(text) || null;

  const entry_condition = (text.match(/Entry:\s*([^\n]+)/i) || [])[1]?.trim() || null;
  const strike = firstNumber(text, 'Strike:');
  const target = firstNumber(text, 'Target:');
  const cut    = firstNumber(text, 'Cut:');

  const confM = text.match(/Confidence:\s*([\d]+)\s*%/i);
  const confidence_pct = confM ? parseInt(confM[1]) : null;

  return {
    signal_type: 'PRE_MARKET_SETUP',
    analyst: src,
    setup_id,
    direction,
    entry_condition,
    strike,
    target,
    cut,
    confidence_pct,
    confidence: confidence_pct !== null ? confidence(confidence_pct) : 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

function parseLiveEntry(text, src) {
  // direction-first: "long SPY 556c", "short ES 5850"
  const dirFirstM = text.match(/\b(long|short|bull|bear)\s+(SPX|SPY|NQ|ES|QQQ|MNQ|MES)\b/i);

  const tickerM = text.match(/\b(SPX|SPY|NQ|ES|QQQ|MNQ|MES)\b/i);
  const ticker   = tickerM ? tickerM[1].toUpperCase() : null;

  // anchor to ticker first: "SPY 709C", "SPX 6580 C", "SPY 709 calls" — capture strike before premium
  const strikeM = text.match(/\b(SPX|SPY|NQ|ES|QQQ|MNQ|MES)\s+(\d[\d,]*\.?\d*)\s*(calls?|puts?|[CP])\b/i);
  const strike  = strikeM ? parseFloat(strikeM[2].replace(/,/g, '')) : null;

  let direction = null;
  if (strikeM) {
    const opt = strikeM[3].toUpperCase();
    if (opt === 'C' || opt.startsWith('CALL')) direction = 'LONG';
    else if (opt === 'P' || opt.startsWith('PUT')) direction = 'SHORT';
  }
  if (!direction && dirFirstM) {
    direction = toDirection(dirFirstM[1]);
  }
  if (!direction) direction = toDirection(text);

  // support both "avg 1.64" and "avg .80" (leading decimal)
  const epM = text.match(/(?:avg|entry|@)\s*\$?(\d*\.?\d+)/i);
  let entry_price = epM ? parseFloat(epM[1]) : null;
  if (!entry_price) {
    const nums = extractNumbers(text).filter(n => n < 1000 && n !== strike && String(n).includes('.'));
    entry_price = nums[0] || null;
  }

  // "ported the 709c" — extract strike from trailing option reference
  let portedStrike = strike;
  if (!portedStrike && /\bport(?:ed|ing|s)?\b/i.test(text)) {
    const portM = text.match(/(\d[\d,]*)\s*[CP]\b/i);
    if (portM) portedStrike = parseFloat(portM[1].replace(/,/g, ''));
    if (!direction) direction = 'LONG'; // ported = conviction long unless puts mentioned
    if (/puts?/i.test(text)) direction = 'SHORT';
  }

  return {
    signal_type: 'LIVE_ENTRY',
    analyst: src,
    ticker,
    direction,
    strike: portedStrike || null,
    entry_price,
    confidence: /@everyone/.test(text) ? 'HIGH' : 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

function parseManagement(text, src) {
  let action = 'TRIM';
  if (/\b(ADDING|ADDED)\b/i.test(text)) action = 'ADD';
  else if (/\b(CUT|STOPPED|STOP|cut small loss)\b/i.test(text)) action = 'CUT';
  else if (/\brolling\b/i.test(text)) action = 'ROLL';
  else if (/\bscaling\s+out\b/i.test(text)) action = 'TRIM';
  else if (/\b(TRIM(?:MING)?|SELLING|SOLD|taking profits?)\b/i.test(text)) action = 'TRIM';

  const pctM = text.match(/([\d]+)\s*%/);
  const pct  = pctM ? parseInt(pctM[1]) : null;

  // support leading-decimal prices: ".50" or "1.64"
  const priceM = text.match(/\bat\s*\$?(\d*\.?\d+)/i);
  const price  = priceM ? parseFloat(priceM[1]) : (extractNumbers(text).filter(n => n < 1000 && String(n).includes('.'))[0] || null);

  // for ROLL: capture the target strike ("rolling 710c to 712c")
  let roll_to = null;
  if (action === 'ROLL') {
    const rollM = text.match(/to\s+(\d[\d,]*)\s*[CP]\b/i);
    if (rollM) roll_to = parseFloat(rollM[1].replace(/,/g, ''));
  }

  return {
    signal_type: 'MANAGEMENT',
    analyst: src,
    action,
    pct,
    price,
    roll_to,
    confidence: 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

function parseContext(text, src, username) {
  const levels = extractNumbers(text).filter(n => n > 100);
  const bias =
    /\b(calls?|longs?|above)\b/i.test(text) ? 'BULLISH' :
    /\b(puts?|shorts?|below)\b/i.test(text) ? 'BEARISH' : 'NEUTRAL';

  return {
    signal_type: 'CONTEXT',
    analyst: src,
    source: `${src}-context`,
    levels,
    bias,
    confidence: 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

function parseSizing(text, src) {
  return {
    signal_type: 'SIZING_NOTE',
    analyst: src,
    note: text.slice(0, 200),
    confidence: 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

// ─── follow-up price rule ────────────────────────────────────────────────────

function tryFollowUpPrice(text, lastSignal, lastSignalTime, messageHistory) {
  if (!lastSignal || !lastSignalTime) return null;

  // standalone number (with or without decimal)
  if (!/^\$?[\d]+\.[\d]+$/.test(text.trim())) return null;

  // within 10 messages
  const histLen = Array.isArray(messageHistory) ? messageHistory.length : 0;
  const recentEnough = histLen <= 10;

  if (!recentEnough) return null;

  return {
    ...lastSignal,
    signal_type: 'MANAGEMENT',
    action: 'PRICE_UPDATE',
    entry_price: parseFloat(text.trim().replace('$', '')),
    confidence: 'MEDIUM',
    raw: text.slice(0, 150)
  };
}

// ─── main export ─────────────────────────────────────────────────────────────

function parseXimes(username, messageText, lastSignal, lastSignalTime, messageHistory) {
  const src = analyst(username);
  if (!src) return null;

  const text = (messageText || '').trim();
  if (!text) return null;
  if (isNoise(text)) return null;
  if (isBio(text)) return null;

  // follow-up price check first (before broader classification)
  const fp = tryFollowUpPrice(text, lastSignal, lastSignalTime, messageHistory);
  if (fp) return fp;

  if (classifyPreMarket(text))  return parsePreMarket(text, src);
  if (classifyLiveEntry(text))  return parseLiveEntry(text, src);
  if (classifyManagement(text)) return parseManagement(text, src);
  if (classifyContext(text, username)) return parseContext(text, src, username);
  if (classifySizing(text))     return parseSizing(text, src);

  return null;
}

module.exports = { parseXimes };
