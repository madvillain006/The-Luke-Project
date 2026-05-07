'use strict';

const { getCandles, getLocalCandleInventory } = require('../market-data/candle-feed');
const { normalizeSymbol } = require('./instruments');
const { toMs } = require('./io');

function backtestMarketSymbol(symbol) {
  if (String(symbol || '').toUpperCase().startsWith('O:')) return String(symbol).toUpperCase();
  const normalized = normalizeSymbol(symbol);
  if (['ES', 'MES'].includes(normalized)) return 'ES';
  if (normalized === 'SPX') return 'SPX';
  if (['NQ', 'MNQ'].includes(normalized)) return 'NQ';
  return normalized;
}

function polygonTickerForStage2(symbol) {
  const marketSymbol = backtestMarketSymbol(symbol);
  if (!marketSymbol) return null;
  if (String(marketSymbol).startsWith('O:')) return marketSymbol;
  if (marketSymbol === 'SPX' || marketSymbol === 'ES' || marketSymbol === 'NQ') return null;
  if (/^[A-Z]{1,5}$/.test(marketSymbol)) return marketSymbol;
  return null;
}

function isStage2MarketSupported(symbol, options = {}) {
  const marketSymbol = backtestMarketSymbol(symbol);
  if (['ES', 'SPX', 'NQ'].includes(marketSymbol)) return true;
  return options.remote === true && Boolean(polygonTickerForStage2(marketSymbol));
}

function getPolygonKey(options = {}) {
  return options.polygonApiKey || process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY || null;
}

function normalizeCandle(candle) {
  return {
    symbol: candle.symbol || null,
    timestamp_utc: new Date(candle.timestamp).toISOString(),
    timestamp: candle.timestamp,
    timeframe: '1m',
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume || 0),
    source: candle.source || 'local_csv',
    delay_info: candle.replay ? 'local_replay_not_live' : (candle.delayed ? 'delayed' : 'unknown'),
    data_quality_flags: [
      candle.finalized === false ? 'not_finalized' : null,
      candle.stale ? 'stale_local_snapshot' : null,
      candle.replay ? 'replay_only' : null,
    ].filter(Boolean),
  };
}

async function loadCandlesForSymbol(symbol, options = {}) {
  const marketSymbol = backtestMarketSymbol(symbol);
  if (!marketSymbol) {
    return {
      symbol: marketSymbol || symbol,
      candles: [],
      coverage: {
        found: false,
        error: 'symbol_missing',
      },
    };
  }
  const result = await getCandles(marketSymbol, {
    mode: 'replay',
    start: options.start,
    end: options.end,
    limit: options.limit || 500000,
    cache: false,
    ...(options.local || {}),
  });
  const candles = (result.candles || []).map(candle => ({ ...normalizeCandle(candle), symbol: marketSymbol }));
  if (!candles.length && options.remote === true) {
    const remote = await loadPolygonCandlesForSymbol(marketSymbol, options);
    if (remote.candles.length || remote.coverage.error !== 'polygon_not_applicable') return remote;
  }
  return {
    symbol: marketSymbol,
    candles,
    coverage: {
      found: candles.length > 0,
      source: result.source,
      source_label: result.source_label,
      timeframe: result.timeframe,
      rows: candles.length,
      first_timestamp: candles[0]?.timestamp_utc || null,
      last_timestamp: candles[candles.length - 1]?.timestamp_utc || null,
      delayed: result.delayed,
      replay: result.replay,
      live: result.live,
      error: result.error || null,
      raw: result.raw || null,
    },
  };
}

async function loadPolygonCandlesForSymbol(symbol, options = {}) {
  const marketSymbol = backtestMarketSymbol(symbol);
  const ticker = polygonTickerForStage2(marketSymbol);
  const key = getPolygonKey(options);
  if (!ticker) {
    return {
      symbol: marketSymbol,
      candles: [],
      coverage: { found: false, error: marketSymbol === 'NQ' ? 'local_stage2_nq_candles_not_connected' : 'polygon_not_applicable' },
    };
  }
  if (!key) {
    return { symbol: marketSymbol, candles: [], coverage: { found: false, error: 'polygon_key_missing' } };
  }
  const start = String(options.start || '').slice(0, 10);
  const end = String(options.end || options.start || '').slice(0, 10);
  if (!start || !end) {
    return { symbol: marketSymbol, candles: [], coverage: { found: false, error: 'polygon_date_range_missing' } };
  }
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/minute/${start}/${end}?adjusted=true&sort=asc&limit=${options.remoteLimit || 50000}&apiKey=${encodeURIComponent(key)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs || 12000) });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        symbol: marketSymbol,
        candles: [],
        coverage: { found: false, source: 'polygon_aggs', ticker, error: raw.error || raw.message || `polygon_http_${response.status}` },
      };
    }
    const candles = (raw.results || []).map(row => ({
      symbol: marketSymbol,
      timestamp_utc: new Date(row.t).toISOString(),
      timestamp: row.t,
      timeframe: '1m',
      open: Number(row.o),
      high: Number(row.h),
      low: Number(row.l),
      close: Number(row.c),
      volume: Number(row.v || 0),
      source: 'polygon_aggs',
      delay_info: 'historical_polygon_massive',
      data_quality_flags: ['remote_historical', String(marketSymbol).startsWith('O:') ? 'option_contract_bars' : null].filter(Boolean),
    })).filter(candle => Number.isFinite(candle.open) && Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) && Number.isFinite(candle.close));
    return {
      symbol: marketSymbol,
      candles,
      coverage: {
        found: candles.length > 0,
        source: 'polygon_aggs',
        source_label: 'Massive/Polygon historical 1m',
        ticker,
        rows: candles.length,
        first_timestamp: candles[0]?.timestamp_utc || null,
        last_timestamp: candles[candles.length - 1]?.timestamp_utc || null,
        delayed: true,
        replay: true,
        live: false,
        error: candles.length ? null : (raw.status || 'polygon_no_rows'),
      },
    };
  } catch (err) {
    return {
      symbol: marketSymbol,
      candles: [],
      coverage: { found: false, source: 'polygon_aggs', ticker, error: err?.message || 'polygon_fetch_failed' },
    };
  }
}

function requestedMarketSymbolsForTrade(trade) {
  const symbols = [];
  const optionTicker = trade.option_contract?.option_ticker;
  if (optionTicker) symbols.push(optionTicker);
  if (trade.normalized_symbol) symbols.push(backtestMarketSymbol(trade.normalized_symbol));
  return symbols.filter(Boolean);
}

function remotePriority(symbol) {
  const marketSymbol = backtestMarketSymbol(symbol);
  if (String(marketSymbol || '').startsWith('O:')) return 0;
  if (['SPY', 'QQQ'].includes(marketSymbol)) return 1;
  if (['ES', 'SPX', 'NQ'].includes(marketSymbol)) return 2;
  return 3;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadMarketDataForTrades(trades, options = {}) {
  const requestedSymbols = trades.flatMap(requestedMarketSymbolsForTrade);
  const unsupportedSymbols = {};
  const remoteCandidates = [];
  for (const symbol of requestedSymbols) {
    if (!isStage2MarketSupported(symbol, options)) {
      unsupportedSymbols[symbol] = (unsupportedSymbols[symbol] || 0) + 1;
    } else {
      remoteCandidates.push(symbol);
    }
  }
  const remoteLimit = Number(options.remoteSymbolLimit || 40);
  const unique = [...new Set(remoteCandidates)].sort((a, b) => remotePriority(a) - remotePriority(b) || String(a).localeCompare(String(b)));
  const symbols = [];
  let remoteCount = 0;
  for (const symbol of unique) {
    if (!options.remote || ['ES', 'SPX', 'NQ'].includes(backtestMarketSymbol(symbol))) {
      symbols.push(symbol);
      continue;
    }
    if (remoteCount < remoteLimit) {
      symbols.push(symbol);
      remoteCount += 1;
      continue;
    }
    unsupportedSymbols[symbol] = (unsupportedSymbols[symbol] || 0) + 1;
  }
  const times = trades.map(trade => toMs(trade.timestamp_utc)).filter(Number.isFinite).sort((a, b) => a - b);
  const start = options.start || (times.length ? new Date(times[0] - 60 * 60 * 1000).toISOString() : null);
  const end = options.end || (times.length ? new Date(times[times.length - 1] + 24 * 60 * 60 * 1000).toISOString() : null);
  const bySymbol = {};
  const coverage = {};
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    if (i > 0 && options.remote && options.remoteRequestDelayMs && !['ES', 'SPX', 'NQ'].includes(backtestMarketSymbol(symbol))) {
      await delay(Number(options.remoteRequestDelayMs));
    }
    const loaded = await loadCandlesForSymbol(symbol, { ...options, start, end });
    bySymbol[symbol] = loaded.candles;
    coverage[symbol] = loaded.coverage;
  }
  return {
    generated_at: new Date().toISOString(),
    symbols,
    unsupported_symbols: unsupportedSymbols,
    start,
    end,
    bySymbol,
    coverage,
    inventory: options.skipInventory ? { skipped: true } : getLocalCandleInventory({ cache: false }),
  };
}

function findFirstCandleAfter(candles, timestampUtc) {
  const ms = toMs(timestampUtc);
  if (!Number.isFinite(ms)) return { candle: null, index: -1 };
  for (let i = 0; i < candles.length; i += 1) {
    if (toMs(candles[i].timestamp_utc) > ms) return { candle: candles[i], index: i };
  }
  return { candle: null, index: -1 };
}

function findFirstCandleAtOrAfter(candles, timestampUtc) {
  const ms = toMs(timestampUtc);
  if (!Number.isFinite(ms)) return { candle: null, index: -1 };
  for (let i = 0; i < candles.length; i += 1) {
    if (toMs(candles[i].timestamp_utc) >= ms) return { candle: candles[i], index: i };
  }
  return { candle: null, index: -1 };
}

function priorCandles(candles, timestampUtc, count) {
  const ms = toMs(timestampUtc);
  const before = candles.filter(candle => toMs(candle.timestamp_utc) <= ms);
  return before.slice(-count);
}

function priorClosedCandles(candles, timestampUtc, count, timeframeMs = 60 * 1000) {
  const ms = toMs(timestampUtc);
  if (!Number.isFinite(ms)) return [];
  const closed = candles.filter(candle => {
    const candleMs = toMs(candle.timestamp_utc);
    return Number.isFinite(candleMs) && candleMs + timeframeMs <= ms;
  });
  return closed.slice(-count);
}

function detectMissingWindows(candles, maxGapMinutes = 3) {
  const gaps = [];
  for (let i = 1; i < candles.length; i += 1) {
    const prev = toMs(candles[i - 1].timestamp_utc);
    const cur = toMs(candles[i].timestamp_utc);
    if (Number.isFinite(prev) && Number.isFinite(cur) && cur - prev > maxGapMinutes * 60 * 1000) {
      gaps.push({
        from: candles[i - 1].timestamp_utc,
        to: candles[i].timestamp_utc,
        gap_minutes: Math.round((cur - prev) / 60000),
      });
    }
  }
  return gaps;
}

module.exports = {
  backtestMarketSymbol,
  detectMissingWindows,
  findFirstCandleAfter,
  findFirstCandleAtOrAfter,
  isStage2MarketSupported,
  loadPolygonCandlesForSymbol,
  loadCandlesForSymbol,
  loadMarketDataForTrades,
  normalizeCandle,
  polygonTickerForStage2,
  priorClosedCandles,
  priorCandles,
  remotePriority,
};
