'use strict';

const { backtestMarketSymbol, priorClosedCandles } = require('./market-data');
const { toMs } = require('./io');

function candleDirection(candle) {
  if (!candle) return 'unknown';
  if (candle.close > candle.open) return 'up';
  if (candle.close < candle.open) return 'down';
  return 'flat';
}

function trendFor(candles) {
  if (!candles.length) return 'unknown';
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (last.close > first.open) return 'up';
  if (last.close < first.open) return 'down';
  return 'flat';
}

function sessionSegment(timestampUtc) {
  const date = new Date(timestampUtc);
  if (!Number.isFinite(date.getTime())) return 'unknown';
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const [hh, mm] = et.split(':').map(Number);
  const mins = hh * 60 + mm;
  if (mins < 570) return 'premarket';
  if (mins < 600) return 'market_open';
  if (mins < 720) return 'morning';
  if (mins < 840) return 'midday';
  if (mins < 900) return 'afternoon';
  if (mins < 960) return 'power_hour';
  if (mins < 1200) return 'after_hours';
  return 'futures_overnight';
}

function realizedRange(candles) {
  if (!candles.length) return null;
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  return high - low;
}

function sybilTagsForTrade(trade, sybilContexts = [], maxItems = 8) {
  const { contextsBeforeTrade } = require('./sybil');
  const contexts = contextsBeforeTrade(trade, sybilContexts, 24).slice(-maxItems);
  const tags = new Set();
  for (const context of contexts) {
    for (const tag of context.context_tags || []) tags.add(tag);
  }
  return { contexts, tags: [...tags] };
}

function computeMarketFeatures(trade, marketData, heatmapLinks = [], sybilContexts = []) {
  const symbol = backtestMarketSymbol(trade.normalized_symbol);
  const candles = marketData.bySymbol?.[symbol] || [];
  const prior5 = priorClosedCandles(candles, trade.timestamp_utc, 5);
  const prior3 = prior5.slice(-3);
  const prior1 = prior5[prior5.length - 1] || null;
  const day = String(trade.timestamp_utc || '').slice(0, 10);
  const callMs = toMs(trade.timestamp_utc);
  const dayCandles = candles.filter(candle => {
    const candleMs = toMs(candle.timestamp_utc);
    return String(candle.timestamp_utc || '').slice(0, 10) === day &&
      Number.isFinite(candleMs) &&
      Number.isFinite(callMs) &&
      candleMs + 60 * 1000 <= callMs;
  });
  const sessionHigh = dayCandles.length ? Math.max(...dayCandles.map(c => c.high)) : null;
  const sessionLow = dayCandles.length ? Math.min(...dayCandles.map(c => c.low)) : null;
  const price = prior1 ? prior1.close : null;
  const volumeAvg = prior5.length ? prior5.reduce((sum, c) => sum + (c.volume || 0), 0) / prior5.length : null;
  const heatmapForTrade = heatmapLinks.filter(link => link.trade_id === trade.trade_id);
  const sybil = sybilTagsForTrade(trade, sybilContexts);
  return {
    trade_id: trade.trade_id,
    symbol,
    price_at_call: price,
    prior_candle_direction: candleDirection(prior1),
    prior_3_candle_trend: trendFor(prior3),
    prior_5_candle_trend: trendFor(prior5),
    recent_high: dayCandles.length ? sessionHigh : null,
    recent_low: dayCandles.length ? sessionLow : null,
    distance_from_session_high: Number.isFinite(price) && Number.isFinite(sessionHigh) ? price - sessionHigh : null,
    distance_from_session_low: Number.isFinite(price) && Number.isFinite(sessionLow) ? price - sessionLow : null,
    vwap_distance: null,
    above_below_vwap: 'unavailable',
    atr_or_recent_range: realizedRange(prior5),
    volume_spike: Number.isFinite(volumeAvg) && prior1 ? prior1.volume > volumeAvg * 1.8 : false,
    regime: realizedRange(prior5) !== null && realizedRange(prior5) < 3 ? 'chop_or_compression' : 'trend_or_expansion',
    time_of_day: sessionSegment(trade.timestamp_utc),
    day_of_week: new Date(trade.timestamp_utc || 0).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' }),
    heatmap_confluence_present: heatmapForTrade.length > 0,
    heatmap_link_count: heatmapForTrade.length,
    sybil_context_present: sybil.contexts.length > 0,
    sybil_context_count: sybil.contexts.length,
    sybil_context_tags: sybil.tags,
    multiple_analyst_alignment: false,
    feature_quality: candles.length ? 'computed_from_closed_local_replay_candles' : 'market_data_missing',
  };
}

function computeFeaturesForTrades(trades, marketData, heatmapLinks, sybilContexts = []) {
  return trades.map(trade => computeMarketFeatures(trade, marketData, heatmapLinks, sybilContexts));
}

module.exports = {
  computeFeaturesForTrades,
  computeMarketFeatures,
  sessionSegment,
  sybilTagsForTrade,
};
