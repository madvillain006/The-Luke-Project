'use strict';

const { makeMarketResult, makeUnknownResult } = require('../result');

function isOpenMarketState(state) {
  return ['REGULAR', 'OPEN'].includes(String(state || '').toUpperCase());
}

function isOld(timestampIso, maxAgeMs, now = Date.now()) {
  if (!timestampIso) return true;
  const ms = new Date(timestampIso).getTime();
  return !Number.isFinite(ms) || (now - ms) > maxAgeMs;
}

async function getYahooMarketPrice(info, options = {}) {
  if (!info.yahooSymbol) return makeUnknownResult(info, 'yahoo_not_applicable', 'yahoo', 3);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(info.yahooSymbol)}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(options.timeoutMs || 5000),
    });
    if (!response.ok) return makeUnknownResult(info, `yahoo_http_${response.status}`, 'yahoo', 3);

    const raw = await response.json();
    const meta = raw?.chart?.result?.[0]?.meta || {};
    const price = meta.regularMarketPrice;
    const previousClose = meta.previousClose ?? meta.chartPreviousClose;
    const timestamp = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
    const marketState = meta.marketState || 'unknown';
    const stale = !isOpenMarketState(marketState) || isOld(timestamp, options.maxLiveAgeMs || 15 * 60 * 1000, options.nowMs || Date.now());

    if (!Number.isFinite(price) || price <= 0) {
      return makeUnknownResult(info, 'yahoo_price_missing', 'yahoo', 3);
    }

    return makeMarketResult(info, {
      price,
      last: price,
      previousClose,
      bid: meta.bid,
      ask: meta.ask,
      timestamp,
      session: marketState,
      source: 'yahoo_chart',
      sourcePriority: 3,
      stale,
      delayed: true,
      confidence: stale ? 0.4 : 0.6,
      raw: { yahooSymbol: info.yahooSymbol, meta },
    });
  } catch (err) {
    return makeUnknownResult(info, err?.message || 'yahoo_fetch_failed', 'yahoo', 3);
  }
}

async function fetchDailyBarsFromYahoo(yahooSymbol, options = {}) {
  if (!yahooSymbol) throw new Error('yahoo symbol required');
  const range = options.range || '6mo';
  const interval = options.interval || '1d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(options.timeoutMs || 7000),
  });
  if (!response.ok) throw new Error(`yahoo daily bars fetch failed for ${yahooSymbol}: HTTP ${response.status}`);

  const raw = await response.json();
  const result = raw?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const bars = timestamps.map((ts, idx) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: Number(quote.open?.[idx]),
    high: Number(quote.high?.[idx]),
    low: Number(quote.low?.[idx]),
    close: Number(quote.close?.[idx]),
    volume: Number(quote.volume?.[idx] || 0),
  })).filter(bar => Number.isFinite(bar.open) && Number.isFinite(bar.high) &&
    Number.isFinite(bar.low) && Number.isFinite(bar.close) &&
    bar.high >= bar.low && bar.close > 0);

  if (bars.length === 0) throw new Error(`yahoo daily bars missing for ${yahooSymbol}`);
  return bars;
}

module.exports = {
  getYahooMarketPrice,
  fetchDailyBarsFromYahoo,
  _internal: { isOpenMarketState, isOld },
};
