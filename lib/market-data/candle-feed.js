'use strict';

const { normalizeMarketSymbol } = require('./symbols');
const {
  getLocalCsvCandles,
  getLocalCandleInventory,
} = require('./providers/local-csv-candles');

function unknownCandleResult(symbol, error) {
  const info = normalizeMarketSymbol(symbol);
  return {
    symbol: info.symbol,
    instrument: info.instrument,
    timeframe: '1m',
    candles: [],
    source: 'UNKNOWN',
    source_label: 'UNKNOWN',
    timestamp: null,
    stale: true,
    delayed: false,
    live: false,
    replay: false,
    usable_for_replay: false,
    usable_for_live_arming: false,
    confidence: 0,
    error,
    session: 'UNKNOWN',
    raw: null,
  };
}

async function getCandles(symbol, options = {}) {
  const info = normalizeMarketSymbol(symbol);
  if (options.provider === 'unknown') return unknownCandleResult(info.symbol, 'candle_provider_unknown');

  const local = await getLocalCsvCandles(info.symbol, options.local || options);
  if (local.candles.length > 0) return local;

  return {
    ...unknownCandleResult(info.symbol, local.error || 'no_candle_provider_available'),
    raw: {
      local_csv: local,
      provider_priority: [
        'tradovate_safe_future_provider_not_configured_for_1m_candles',
        'market_data_1m_provider_not_available',
        'local_csv',
        'yahoo_finnhub_1m_unsupported_here',
      ],
    },
  };
}

async function getLatestCandle(symbol, options = {}) {
  const result = await getCandles(symbol, { ...options, limit: 1 });
  return result.candles[0] || null;
}

async function getCandleFeedStatus(symbol, options = {}) {
  const result = await getCandles(symbol, { ...options, limit: 1 });
  const inventory = getLocalCandleInventory(options.local || options);
  const summary = inventory.symbols[result.symbol] || null;
  return {
    symbol: result.symbol,
    instrument: result.instrument,
    timeframe: result.timeframe,
    source: result.source,
    source_label: result.source_label,
    timestamp: result.timestamp,
    stale: result.stale,
    delayed: result.delayed,
    live: result.live,
    replay: result.replay,
    usable_for_replay: result.usable_for_replay,
    usable_for_live_arming: result.usable_for_live_arming,
    confidence: result.confidence,
    error: result.error,
    session: result.session,
    inventory: summary,
    reason: result.usable_for_live_arming
      ? 'candle feed can support live arming'
      : (result.usable_for_replay ? 'local/replay candles are proof-only and cannot arm live candidates' : result.error),
  };
}

module.exports = {
  getCandles,
  getLatestCandle,
  getCandleFeedStatus,
  getLocalCandleInventory,
  unknownCandleResult,
};
