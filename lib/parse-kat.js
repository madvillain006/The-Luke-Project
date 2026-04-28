'use strict';

// ── Signal types ────────────────────────────────────────────────────────────
// CHART_ANALYSIS  — ticker + timeframe + pattern + chart image
// DIRECTIONAL     — ticker + bias (bullish/bearish) without specific entry
// LEVEL_WATCH     — specific price level called out as significant
// MANAGEMENT      — position update (trimming, stopped, adding)
// CONTEXT         — market commentary, no actionable level
// NOISE           — banter, GIFs, off-topic

// ── Vocabulary ──────────────────────────────────────────────────────────────

const TIMEFRAMES = /\b(1m|3m|5m|10m|15m|30m|1h|2h|4h|1d|1w|1M|daily|weekly|monthly|intraday|overnight)\b/i;

const BULLISH_PATTERNS = [
  'bull flag','bull pennant','bullish','ihs','inverse head and shoulders',
  'double bottom','higher low','breakout','launchpad','natH','nATH',
  'ath','all time high','demand zone','buyers showed up','holding support',
  'base','inside day','inside week','consolidation','squeeze','coiling',
  'cup and handle','golden cross','oversold bounce','long'
];

const BEARISH_PATTERNS = [
  'bear flag','bearish','head and shoulders','double top','lower high',
  'breakdown','resistance','sellers','supply zone','exhaustion',
  'evening star','death cross','overbought','short','put','flush',
  'gap fill','bearish divergence','bearish engulfing','rejection'
];

const MANAGEMENT_KEYWORDS = [
  'trimming','trim','stopped','stop out','adding','added','closed',
  'out of','took profits','cutting','cut','scaled','runner'
];

const NOISE_PATTERNS = [
  /^https?:\/\//i,                    // URL only
  /tenor\.com/i,                      // GIF link
  /^<@\d+>/,                          // mention only
  /^\s*$/,                            // empty
];

// ── Tickers ─────────────────────────────────────────────────────────────────
// Matches: SPY, SPX, QQQ, ES, NQ, MES, MNQ, AAPL, NVDA etc.
// Also matches $TICKER format (El Jefe style)
const TICKER_RE = /\$?([A-Z]{1,5})(?:\s|$)/g;

const INDEX_TICKERS = new Set(['SPY','SPX','QQQ','ES','NQ','MES','MNQ','VIX','IWM','DIA']);

// ── Price levels ─────────────────────────────────────────────────────────────
const LEVEL_RE = /\b(\d{2,6}(?:\.\d{1,2})?)\b/g;

// ── Main export ──────────────────────────────────────────────────────────────

function parseKatSignal(username, text, hasAttachments) {
  if (!text && !hasAttachments) return null;

  const content = (text || '').trim();

  // 1. Noise check
  if (isNoise(content, hasAttachments)) return null;

  // 2. Management check
  const mgmt = classifyManagement(content);
  if (mgmt) return { signal_type: 'MANAGEMENT', ...mgmt, analyst: username };

  // 3. Extract ticker
  const ticker = extractTicker(content);

  // 4. Timeframe
  const tfMatch = content.match(TIMEFRAMES);
  const timeframe = tfMatch ? tfMatch[0].toUpperCase() : null;

  // 5. Bias
  const bias = classifyBias(content);

  // 6. Levels
  const levels = extractLevels(content, ticker);

  // 7. Pattern
  const pattern = extractPattern(content);

  // 8. Signal type
  if (hasAttachments && (ticker || bias !== 'NEUTRAL')) {
    return {
      signal_type: 'CHART_ANALYSIS',
      ticker,
      timeframe,
      bias,
      pattern,
      levels,
      has_image: true,
      raw: content,
      analyst: username
    };
  }

  if (ticker && levels.length > 0) {
    return {
      signal_type: 'LEVEL_WATCH',
      ticker,
      timeframe,
      bias,
      levels,
      pattern,
      has_image: false,
      raw: content,
      analyst: username
    };
  }

  if (ticker && bias !== 'NEUTRAL') {
    return {
      signal_type: 'DIRECTIONAL',
      ticker,
      timeframe,
      bias,
      pattern,
      levels,
      has_image: hasAttachments || false,
      raw: content,
      analyst: username
    };
  }

  if (bias !== 'NEUTRAL' || levels.length > 0) {
    return {
      signal_type: 'CONTEXT',
      ticker,
      bias,
      levels,
      pattern,
      raw: content,
      analyst: username
    };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNoise(content, hasAttachments) {
  if (!content && !hasAttachments) return true;
  if (!content) return false; // image with no text — let it through
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(content.trim())) return true;
  }
  // Short with no ticker and no number
  if (content.length < 8 && !/\d/.test(content) && !/[A-Z]{2,}/.test(content)) return true;
  if (!hasAttachments) {
    const hasTicker = /\$?[A-Z]{2,5}\b/.test(content);
    const hasRealLevel = /\b([1-9]\d{2,}(?:\.\d{1,2})?)\b/.test(content);
    if (!hasTicker && !hasRealLevel && content.length < 40) return true;
  }
  return false;
}

function classifyManagement(content) {
  const lower = content.toLowerCase();
  for (const kw of MANAGEMENT_KEYWORDS) {
    if (lower.includes(kw)) {
      const pctMatch = content.match(/(\d+)%/);
      return {
        action: kw.toUpperCase().replace(' ', '_'),
        pct: pctMatch ? parseInt(pctMatch[1]) : null
      };
    }
  }
  return null;
}

function extractTicker(content) {
  // #ES_F / #NQ_F futures tag format first
  const futuresTagMatch = content.match(/[#$]?((?:ES|NQ|MES|MNQ|SPX|SPY|QQQ|NDX))(?:_F)?\b/i);
  if (futuresTagMatch) return futuresTagMatch[1].toUpperCase();

  // $TICKER format first (El Jefe style)
  const dollarMatch = content.match(/\$([A-Z]{1,5})\b/);
  if (dollarMatch) return dollarMatch[1];

  // TICKER TIMEFRAME format (KapriK0rn3 style: "NVDA 1D.")
  const tfTickerMatch = content.match(/^([A-Z]{1,5})\s+(?:1[mMdDwW]|[0-9]+[mMhH]|daily|weekly)/);
  if (tfTickerMatch) return tfTickerMatch[1];

  // Known index tickers anywhere in text
  const words = content.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Z]/gi, '').toUpperCase();
    if (INDEX_TICKERS.has(clean)) return clean;
  }

  // General ticker — uppercase 2-5 chars at start of message
  const startMatch = content.match(/^([A-Z]{2,5})\b/);
  if (startMatch && startMatch[1] !== 'IHS' && startMatch[1] !== 'ATH') {
    return startMatch[1];
  }

  return null;
}

function classifyBias(content) {
  const lower = content.toLowerCase();
  let bullScore = 0;
  let bearScore = 0;
  for (const p of BULLISH_PATTERNS) if (lower.includes(p)) bullScore++;
  for (const p of BEARISH_PATTERNS) if (lower.includes(p)) bearScore++;
  if (bullScore > bearScore) return 'BULLISH';
  if (bearScore > bullScore) return 'BEARISH';
  return 'NEUTRAL';
}

function extractLevels(content, ticker) {
  // Instrument-aware minimum price floor
  // Prevents EMA/SMA period numbers (50, 100, 200) from
  // being extracted as price levels
  let minPrice = 50;
  if (ticker) {
    const t = ticker.toUpperCase();
    if (['SPX','ES','MES'].includes(t))       minPrice = 3000;
    else if (['NQ','MNQ','NDX'].includes(t))  minPrice = 10000;
    else if (['SPY','QQQ','DIA','IWM'].includes(t)) minPrice = 200;
    else minPrice = 50; // equities — floor at 50
  }

  const levels = [];
  const matches = [...content.matchAll(LEVEL_RE)];
  for (const m of matches) {
    const n = parseFloat(m[1]);
    if (n < minPrice) continue;   // below instrument floor — skip
    if (n > 99999)   continue;   // absurd value — skip
    if (n >= 2020 && n <= 2035) continue; // year reference — skip
    // Skip MA period references: "200 SMA", "50 EMA", "100 MA"
    const after = content.slice(m.index + m[0].length, m.index + m[0].length + 6);
    if (/^\s*(SMA|EMA|MA)\b/i.test(after)) continue;
    // For high-floor instruments, also skip the price that immediately follows "EMA at N" / "SMA at N"
    // (e.g. "50 EMA at 540" on SPY — 540 is contextual, not a key level call)
    if (minPrice >= 200) {
      const before = content.slice(Math.max(0, m.index - 12), m.index);
      if (/\b(SMA|EMA|MA)\s+at\s*$/i.test(before)) continue;
    }
    levels.push(n);
  }
  return [...new Set(levels)];
}

function extractPattern(content) {
  const lower = content.toLowerCase();
  const allPatterns = [...BULLISH_PATTERNS, ...BEARISH_PATTERNS];
  for (const p of allPatterns) {
    if (lower.includes(p)) return p;
  }
  return null;
}

module.exports = { parseKatSignal };
