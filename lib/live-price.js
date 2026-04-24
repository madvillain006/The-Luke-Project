'use strict';

let _cache = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchSpyForDate(dateStr, key) {
  const url = `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/minute/${dateStr}/${dateStr}?adjusted=true&sort=desc&limit=1&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const close = data?.results?.[0]?.c;
  return (typeof close === 'number' && close > 0) ? { close, date: dateStr } : null;
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
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Try today first; fall back to yesterday when market hasn't opened yet
    const result = (await fetchSpyForDate(today, key)) || (await fetchSpyForDate(yesterday, key));
    if (!result) {
      console.warn('[live-price] no SPY data for today or yesterday');
      return null;
    }

    const spy = result.close;
    const spx = Math.round(spy * 10);
    const isDelayed = result.date !== today;
    _cache = { spx, spy, source: 'massive', cached_at: now, data_date: result.date, delayed: isDelayed };
    _cachedAt = now;
    if (isDelayed) console.warn(`[live-price] using ${result.date} close (pre-market or market closed)`);
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
