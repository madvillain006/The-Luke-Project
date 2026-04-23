'use strict';

let _cache = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

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
    const url = `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/minute/${today}/${today}?adjusted=true&sort=desc&limit=1&apiKey=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const close = data?.results?.[0]?.c;
    if (typeof close !== 'number' || close <= 0) {
      console.warn('[live-price] unexpected Massive payload:', JSON.stringify(data));
      return null;
    }
    const spy = close;
    const spx = Math.round(spy * 10);
    _cache = { spx, spy, source: 'massive', cached_at: now };
    _cachedAt = now;
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
