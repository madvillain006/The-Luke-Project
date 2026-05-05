'use strict';

const { getTradovateToken, getBaseUrl } = require('../../../trading/broker-tradovate');
const { getFrontMonthSymbol } = require('../symbols');
const { makeMarketResult, makeUnknownResult } = require('../result');

function hasTradovateCreds(creds) {
  return Boolean(creds && creds.username && creds.cid && creds.sec);
}

async function getTradovateMarketPrice(info, options = {}) {
  const creds = options.tradovate || options.creds || null;
  if (info.kind !== 'future') return makeUnknownResult(info, 'tradovate_not_applicable', 'tradovate', 1);
  if (!hasTradovateCreds(creds)) return makeUnknownResult(info, 'tradovate_credentials_missing', 'tradovate', 1);

  try {
    const token = await getTradovateToken(creds);
    const baseUrl = getBaseUrl(creds);
    const contract = getFrontMonthSymbol(info.tradovateRoot || info.instrument, options.now || new Date());
    const response = await fetch(`${baseUrl}/quote/find?name=${contract}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(options.timeoutMs || 4000),
    });
    if (!response.ok) {
      return makeUnknownResult(info, `tradovate_quote_http_${response.status}`, 'tradovate', 1);
    }
    const raw = await response.json();
    return makeMarketResult(info, {
      bid: raw.bidPrice,
      ask: raw.askPrice,
      last: raw.lastPrice,
      timestamp: raw.timestamp || raw.tradeDate || new Date().toISOString(),
      session: 'live',
      source: 'tradovate',
      sourcePriority: 1,
      stale: false,
      delayed: false,
      live: true,
      usable_for_live_arming: true,
      confidence: 0.95,
      raw: { contract, quote: raw },
    });
  } catch (err) {
    return makeUnknownResult(info, err?.message || 'tradovate_quote_failed', 'tradovate', 1);
  }
}

module.exports = {
  getTradovateMarketPrice,
  hasTradovateCreds,
};
