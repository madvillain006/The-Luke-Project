'use strict';

const { makeMarketResult, makeUnknownResult } = require('../result');

function getFinnhubKey() {
  return process.env.FINNHUB_KEY || null;
}

async function getFinnhubMarketPrice(info, options = {}) {
  const key = options.finnhubKey || getFinnhubKey();
  if (!info.finnhubSymbol) return makeUnknownResult(info, 'finnhub_not_applicable', 'finnhub', 3);
  if (!key) return makeUnknownResult(info, 'finnhub_key_missing', 'finnhub', 3);

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(info.finnhubSymbol)}&token=${encodeURIComponent(key)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs || 5000) });
    if (!response.ok) return makeUnknownResult(info, `finnhub_http_${response.status}`, 'finnhub', 3);
    const raw = await response.json();
    const timestamp = raw.t ? new Date(raw.t * 1000).toISOString() : new Date().toISOString();
    if (!Number.isFinite(raw.c) || raw.c <= 0) return makeUnknownResult(info, 'finnhub_price_missing', 'finnhub', 3);
    return makeMarketResult(info, {
      price: raw.c,
      last: raw.c,
      previousClose: raw.pc,
      timestamp,
      session: 'fallback',
      source: 'finnhub_quote',
      sourcePriority: 3,
      stale: true,
      delayed: true,
      confidence: 0.5,
      raw: { finnhubSymbol: info.finnhubSymbol, quote: raw },
    });
  } catch (err) {
    return makeUnknownResult(info, err?.message || 'finnhub_fetch_failed', 'finnhub', 3);
  }
}

module.exports = {
  getFinnhubMarketPrice,
};
