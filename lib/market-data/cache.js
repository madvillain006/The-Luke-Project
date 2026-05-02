'use strict';

const DEFAULT_TTL_MS = 30 * 1000;
const _cache = new Map();

function cacheKey(symbol, providers) {
  return `${String(symbol || '').toUpperCase()}::${(providers || []).join(',')}`;
}

function getCachedMarketPrice(symbol, providers, now = Date.now()) {
  const hit = _cache.get(cacheKey(symbol, providers));
  if (!hit) return null;
  if ((now - hit.cachedAt) > hit.ttlMs) return null;
  return hit.value;
}

function setCachedMarketPrice(symbol, providers, value, ttlMs = DEFAULT_TTL_MS, now = Date.now()) {
  _cache.set(cacheKey(symbol, providers), { value, cachedAt: now, ttlMs });
  return value;
}

function clearMarketDataCache() {
  _cache.clear();
}

module.exports = {
  DEFAULT_TTL_MS,
  getCachedMarketPrice,
  setCachedMarketPrice,
  clearMarketDataCache,
};
