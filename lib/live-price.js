'use strict';

const { getMarketSnapshot } = require('./market-data');

let _cache = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function instrumentEntry(result) {
  if (!result || !Number.isFinite(result.price)) return null;
  return {
    price: result.price,
    source: result.source,
    timestamp: result.timestamp,
    stale: result.stale,
    delayed: result.delayed,
    confidence: result.confidence,
    error: result.error,
    marketData: result,
  };
}

function emptySnapshot(snapshot, now) {
  return {
    spx: null,
    spy: null,
    instruments: {
      spx: null,
      spy: null,
      qqq: null,
      es: null,
      nq: null,
    },
    source: 'market-data',
    cached_at: now,
    data_date: null,
    delayed: true,
    available: false,
    error: 'market_data_unavailable',
    marketData: snapshot || {},
  };
}

async function getLivePrice() {
  const now = Date.now();
  if (_cache && (now - _cachedAt) < CACHE_TTL_MS) return _cache;

  try {
    const snapshot = await getMarketSnapshot(['SPX', 'SPY', 'QQQ', 'ES', 'NQ']);
    const instruments = {
      spx: instrumentEntry(snapshot.SPX),
      spy: instrumentEntry(snapshot.SPY),
      qqq: instrumentEntry(snapshot.QQQ),
      es: instrumentEntry(snapshot.ES),
      nq: instrumentEntry(snapshot.NQ),
    };

    if (!Object.values(instruments).some(Boolean)) {
      console.warn('[live-price] market data unavailable; returning structured UNKNOWN snapshot');
      _cache = emptySnapshot(snapshot, now);
      _cachedAt = now;
      return _cache;
    }

    const firstTimestamp = Object.values(instruments).find(Boolean)?.timestamp || null;
    const delayed = Object.values(instruments).filter(Boolean).some(item => item.delayed || item.stale);
    _cache = {
      spx: instruments.spx?.price ?? null,
      spy: instruments.spy?.price ?? null,
      instruments,
      source: 'market-data',
      cached_at: now,
      data_date: firstTimestamp ? firstTimestamp.slice(0, 10) : null,
      delayed,
      marketData: snapshot,
    };
    _cachedAt = now;

    if (delayed) console.warn('[live-price] using delayed/stale market data; no live approximation applied');
    return _cache;
  } catch (err) {
    console.warn('[live-price] fetch error:', err.message);
    _cache = emptySnapshot({
      error: err.message,
    }, now);
    _cachedAt = now;
    return _cache;
  }
}

function getCachedPrice() {
  const now = Date.now();
  if (_cache && (now - _cachedAt) < CACHE_TTL_MS) return _cache;
  return null;
}

module.exports = { getLivePrice, getCachedPrice };
