'use strict';

const { makeMarketResult, makeUnknownResult } = require('../result');

const MAX_LOOKBACK_DAYS = 7;

function getPolygonKey() {
  return process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY || null;
}

function dayStr(offsetDays, now = new Date()) {
  return new Date(now.getTime() - offsetDays * 86400000).toISOString().slice(0, 10);
}

async function fetchDailyClose(ticker, date, key, timeoutMs) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${date}/${date}?adjusted=true&sort=desc&limit=1&apiKey=${key}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs || 5000) });
  if (!response.ok) {
    if (response.status === 429) throw new Error(`polygon_rate_limited_${ticker}`);
    if (response.status === 403) throw new Error(`polygon_not_authorized_${ticker}`);
    throw new Error(`polygon_http_${response.status}_${ticker}`);
  }
  const raw = await response.json();
  const row = raw?.results?.[0] || null;
  return Number.isFinite(row?.c) && row.c > 0 ? { close: row.c, timestamp: row.t, raw } : null;
}

async function getPolygonMarketPrice(info, options = {}) {
  const key = options.polygonApiKey || getPolygonKey();
  const ticker = info.polygonTicker;
  if (!ticker) return makeUnknownResult(info, 'polygon_not_applicable', 'polygon', 2);
  if (!key) return makeUnknownResult(info, 'polygon_key_missing', 'polygon', 2);

  try {
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
      const date = dayStr(offset, now);
      const daily = await fetchDailyClose(ticker, date, key, options.timeoutMs);
      if (!daily) continue;
      return makeMarketResult(info, {
        price: daily.close,
        last: daily.close,
        previousClose: daily.close,
        settlement: daily.close,
        timestamp: daily.timestamp || `${date}T21:00:00.000Z`,
        session: 'closed',
        source: 'polygon_latest_close',
        sourcePriority: 2,
        stale: true,
        delayed: true,
        confidence: 0.55,
        raw: { ticker, date, response: daily.raw },
      });
    }
    return makeUnknownResult(info, 'polygon_latest_close_missing', 'polygon', 2);
  } catch (err) {
    return makeUnknownResult(info, err?.message || 'polygon_fetch_failed', 'polygon', 2);
  }
}

module.exports = {
  getPolygonMarketPrice,
  _internal: { dayStr },
};
