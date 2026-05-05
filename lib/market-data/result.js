'use strict';

function isFinitePrice(value) {
  return Number.isFinite(value) && value > 0;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function makeUnknownResult(info, error, source = 'UNKNOWN', sourcePriority = 99) {
  return {
    symbol: info.symbol,
    instrument: info.instrument,
    price: null,
    bid: null,
    ask: null,
    last: null,
    previousClose: null,
    settlement: null,
    timestamp: null,
    session: 'unknown',
    source,
    sourcePriority,
    stale: true,
    delayed: true,
    live: false,
    replay: false,
    usable_for_replay: false,
    usable_for_live_arming: false,
    confidence: 0,
    error: error || 'market_data_unavailable',
    raw: null,
  };
}

function makeMarketResult(info, fields) {
  const last = isFinitePrice(fields.last) ? fields.last : null;
  const bid = isFinitePrice(fields.bid) ? fields.bid : null;
  const ask = isFinitePrice(fields.ask) ? fields.ask : null;
  const previousClose = isFinitePrice(fields.previousClose) ? fields.previousClose : null;
  const settlement = isFinitePrice(fields.settlement) ? fields.settlement : null;
  const price = isFinitePrice(fields.price)
    ? fields.price
    : last ?? (bid !== null && ask !== null ? (bid + ask) / 2 : previousClose ?? settlement ?? null);

  return {
    symbol: info.symbol,
    instrument: info.instrument,
    price,
    bid,
    ask,
    last,
    previousClose,
    settlement,
    timestamp: normalizeTimestamp(fields.timestamp),
    session: fields.session || 'unknown',
    source: fields.source || 'UNKNOWN',
    sourcePriority: fields.sourcePriority ?? 99,
    stale: fields.stale !== undefined ? Boolean(fields.stale) : true,
    delayed: fields.delayed !== undefined ? Boolean(fields.delayed) : true,
    live: fields.live === true,
    replay: fields.replay === true,
    usable_for_replay: fields.usable_for_replay === true,
    usable_for_live_arming: fields.usable_for_live_arming === true,
    confidence: Number.isFinite(fields.confidence) ? fields.confidence : 0,
    error: fields.error || null,
    raw: fields.raw ?? null,
  };
}

module.exports = {
  isFinitePrice,
  makeMarketResult,
  makeUnknownResult,
};
