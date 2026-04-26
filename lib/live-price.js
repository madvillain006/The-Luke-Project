'use strict';

let _cache = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Walk back up to this many calendar days to find the last trading day close.
// Covers long weekends (Fri close visible by Mon+1 offset=3) with a buffer.
const MAX_LOOKBACK_DAYS = 5;

function dayStr(offsetDays) {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);
}

async function fetchDailyClose(ticker, date, key) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${date}/${date}?adjusted=true&sort=desc&limit=1&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error(`rate limited on ${ticker}`);
    return null;
  }
  const data = await res.json();
  const close = data?.results?.[0]?.c;
  return (typeof close === 'number' && close > 0) ? { close, date } : null;
}

// Walk back to find the last trading day close for a ticker.
// SPY is used as the calendar anchor; QQQ is fetched directly for that date.
async function fetchLastClose(ticker, key) {
  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset++) {
    const result = await fetchDailyClose(ticker, dayStr(offset), key);
    if (result) return result;
  }
  return null;
}

async function getLivePrice() {
  const now = Date.now();
  if (_cache && (now - _cachedAt) < CACHE_TTL_MS) return _cache;

  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    console.warn('[live-price] MASSIVE_API_KEY not set — live price unavailable');
    return null;
  }

  try {
    // SPY anchors the last-trading-day lookup; QQQ fetched for that same date.
    // Sequential (not parallel) to stay under the ~5 req/min plan limit.
    const spyResult = await fetchLastClose('SPY', key);
    if (!spyResult) {
      console.warn('[live-price] no SPY data found in last 5 days');
      return null;
    }

    const qqqResult = await fetchDailyClose('QQQ', spyResult.date, key);
    if (!qqqResult) {
      console.warn('[live-price] no QQQ data for', spyResult.date);
    }

    const spy    = spyResult.close;
    const spx    = Math.round(spy * 10);              // SPX ≈ SPY × 10
    const qqq    = qqqResult?.close ?? null;

    // ES approximation: SPX + 30 (hardcoded).
    // Observed 2026-04-24 actual basis was closer to SPX + 55.
    // Refine with rolling-basis calculation in a future phase once we have
    // time-series price history feeding it.
    const es = spx + 30;

    // NQ approximation: QQQ × 41.3 (hardcoded).
    // Observed 2026-04-24 ratio was in the 41.3–41.5 range; good enough for now.
    const nq = qqq !== null ? Math.round(qqq * 41.3) : null;

    const dataDate = spyResult.date;
    const isDelayed = dataDate !== dayStr(0);

    const instruments = {
      spx: { price: spx,  source: 'approximated', basis_note: 'SPY × 10' },
      spy: { price: spy,  source: 'live',          basis_note: null },
      qqq: qqq !== null
        ? { price: qqq,  source: 'live',          basis_note: null }
        : null,
      es:  { price: es,   source: 'approximated', basis_note: 'SPX + 30 (hardcoded; observed ~SPX+55 on 2026-04-24)' },
      nq:  nq !== null
        ? { price: nq,   source: 'approximated', basis_note: 'QQQ × 41.3 (hardcoded)' }
        : null,
    };

    // Top-level spx/spy kept for backward compatibility with existing callers
    // (parse-bobby.js, confluence.js, parse-dubz.js).
    _cache = { spx, spy, instruments, source: 'massive', cached_at: now, data_date: dataDate, delayed: isDelayed };
    _cachedAt = now;

    if (isDelayed) console.warn(`[live-price] using ${dataDate} close (pre-market or market closed)`);
    return _cache;
  } catch (err) {
    console.warn('[live-price] fetch error:', err.message);
    return null;
  }
}

function getCachedPrice() {
  const now = Date.now();
  if (_cache && (now - _cachedAt) < CACHE_TTL_MS) return _cache;
  return null;
}

module.exports = { getLivePrice, getCachedPrice };
