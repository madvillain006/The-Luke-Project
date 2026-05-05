'use strict';

const { normalizeMarketSymbol } = require('./symbols');
const { isFinitePrice, makeUnknownResult } = require('./result');
const { getCachedMarketPrice, setCachedMarketPrice, clearMarketDataCache } = require('./cache');
const { getTradovateMarketPrice } = require('./providers/tradovate');
const { getPolygonMarketPrice } = require('./providers/polygon');
const { getFinnhubMarketPrice } = require('./providers/finnhub');
const { getYahooMarketPrice } = require('./providers/yahoo');

const DEFAULT_PROVIDER_ORDER = ['tradovate', 'polygon', 'finnhub', 'yahoo'];
const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;
let _lastStatus = {
  lastRequestAt: null,
  providers: DEFAULT_PROVIDER_ORDER,
  lastErrors: {},
};

function providerListFor(info, options = {}) {
  const requested = options.providers || DEFAULT_PROVIDER_ORDER;
  return requested.filter(provider => {
    if (provider === 'tradovate') return info.kind === 'future';
    if (provider === 'polygon') return Boolean(info.polygonTicker);
    if (provider === 'finnhub') return Boolean(info.finnhubSymbol);
    if (provider === 'yahoo') return Boolean(info.yahooSymbol);
    return false;
  });
}

function successful(result) {
  return result && isFinitePrice(result.price);
}

async function callProvider(provider, info, options) {
  const providerOptions = { ...options, timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS };
  if (options.providerFns && typeof options.providerFns[provider] === 'function') {
    return options.providerFns[provider](info, providerOptions);
  }
  if (provider === 'tradovate') return getTradovateMarketPrice(info, providerOptions);
  if (provider === 'polygon') return getPolygonMarketPrice(info, providerOptions);
  if (provider === 'finnhub') return getFinnhubMarketPrice(info, providerOptions);
  if (provider === 'yahoo') return getYahooMarketPrice(info, providerOptions);
  return makeUnknownResult(info, `provider_unknown_${provider}`, provider, 99);
}

async function getMarketPrice(symbol, options = {}) {
  const info = normalizeMarketSymbol(symbol);
  const providers = providerListFor(info, options);
  const cacheEnabled = options.cache !== false;
  if (cacheEnabled) {
    const cached = getCachedMarketPrice(info.symbol, providers);
    if (cached) return cached;
  }

  _lastStatus = {
    ..._lastStatus,
    lastRequestAt: new Date().toISOString(),
    providers,
  };

  const errors = {};
  for (const provider of providers) {
    const result = await callProvider(provider, info, options);
    if (successful(result)) {
      if (cacheEnabled) setCachedMarketPrice(info.symbol, providers, result, options.cacheTtlMs);
      return result;
    }
    errors[provider] = result?.error || 'unavailable';
  }

  _lastStatus.lastErrors[info.symbol] = errors;
  const unknown = makeUnknownResult(info, Object.entries(errors).map(([provider, error]) => `${provider}:${error}`).join('; ') || 'no_provider_available');
  if (cacheEnabled) setCachedMarketPrice(info.symbol, providers, unknown, Math.min(options.cacheTtlMs || 30000, 5000));
  return unknown;
}

async function getMarketSnapshot(symbols, options = {}) {
  const list = Array.from(new Set((symbols || []).map(symbol => normalizeMarketSymbol(symbol).symbol)));
  const pairs = await Promise.all(list.map(async symbol => [symbol, await getMarketPrice(symbol, options)]));
  return Object.fromEntries(pairs);
}

function getMarketDataStatus() {
  return { ..._lastStatus };
}

module.exports = {
  getMarketPrice,
  getMarketSnapshot,
  normalizeMarketSymbol,
  getMarketDataStatus,
  _internal: {
    DEFAULT_PROVIDER_ORDER,
    clearMarketDataCache,
    providerListFor,
    callProvider,
  },
};
