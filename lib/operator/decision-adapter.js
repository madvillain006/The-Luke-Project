'use strict';

const { buildTradeDecision } = require('../decision-spine');
const { getLivePrice } = require('../live-price');
const { getMarketPrice, normalizeMarketSymbol } = require('../market-data');
const { makeUnknownResult } = require('../market-data/result');

function normalizeInstrument(value) {
  return String(value || 'ES').toUpperCase();
}

function priceFromLive(instrument, livePrice) {
  if (!livePrice) return null;
  const normalized = normalizeInstrument(instrument);
  if (normalized === 'ES') return livePrice?.instruments?.es?.price ?? null;
  if (normalized === 'NQ') return livePrice?.instruments?.nq?.price ?? null;
  if (normalized === 'SPX') return livePrice?.instruments?.spx?.price ?? livePrice?.spx ?? null;
  if (normalized === 'SPY') return livePrice?.instruments?.spy?.price ?? livePrice?.spy ?? null;
  if (normalized === 'QQQ') return livePrice?.instruments?.qqq?.price ?? null;
  return null;
}

function marketDataFromExplicitPrice(instrument, price) {
  const parsed = Number(price);
  return {
    symbol: normalizeInstrument(instrument),
    instrument: normalizeInstrument(instrument),
    price: Number.isFinite(parsed) ? parsed : null,
    bid: null,
    ask: null,
    last: Number.isFinite(parsed) ? parsed : null,
    previousClose: null,
    settlement: null,
    timestamp: new Date().toISOString(),
    session: 'manual_override',
    source: 'query_param',
    sourcePriority: 0,
    stale: false,
    delayed: false,
    confidence: Number.isFinite(parsed) ? 0.5 : 0,
    error: Number.isFinite(parsed) ? null : 'currentPrice was not numeric',
    raw: null,
  };
}

function marketDataFromLegacyLive(instrument, livePrice) {
  const resolved = priceFromLive(instrument, livePrice);
  const normalized = normalizeInstrument(instrument);
  const key = normalized.toLowerCase();
  const sourceEntry = livePrice?.instruments?.[key] || null;
  return {
    symbol: normalized,
    instrument: normalized,
    price: Number.isFinite(resolved) ? resolved : null,
    bid: null,
    ask: null,
    last: Number.isFinite(resolved) ? resolved : null,
    previousClose: null,
    settlement: null,
    timestamp: sourceEntry?.timestamp || (livePrice?.cached_at ? new Date(livePrice.cached_at).toISOString() : null),
    session: livePrice?.delayed ? 'delayed' : 'legacy',
    source: sourceEntry?.source || livePrice?.source || 'legacy_live_price',
    sourcePriority: 90,
    stale: Boolean(sourceEntry?.stale || livePrice?.delayed),
    delayed: Boolean(sourceEntry?.delayed || livePrice?.delayed),
    confidence: Number.isFinite(resolved) ? (sourceEntry?.confidence ?? (livePrice?.delayed ? 0.4 : 0.9)) : 0,
    error: Number.isFinite(resolved) ? null : 'live price UNKNOWN',
    raw: livePrice || null,
  };
}

function isUsableDecisionPrice(marketData) {
  return Number.isFinite(marketData?.price) && marketData.stale !== true && marketData.delayed !== true && marketData.confidence >= 0.6;
}

function summarizeMarketData(marketData) {
  if (!marketData) return null;
  return {
    symbol: marketData.symbol,
    instrument: marketData.instrument,
    price: marketData.price,
    timestamp: marketData.timestamp,
    session: marketData.session,
    source: marketData.source,
    stale: marketData.stale,
    delayed: marketData.delayed,
    confidence: marketData.confidence,
    error: marketData.error,
    provider_attempts: marketData.provider_attempts || [],
    provider_count: marketData.provider_count || 0,
    provider_errors: marketData.provider_errors || {},
    fallback_used: marketData.fallback_used === true,
    minimum_hookups_ok: marketData.minimum_hookups_ok === true,
  };
}

function summarizeDecision(decision) {
  return {
    ok: decision.ok,
    action: decision.action,
    reason: decision.reason,
    instrument: decision.instrument,
    anchor: decision.confluence?.anchor ?? null,
    grade: decision.confluence?.grade ?? null,
    side: decision.action === 'LONG' || decision.action === 'SHORT' ? decision.action : (decision.side || null),
    entry: decision.entry,
    acceptable_entry: decision.acceptable_entry,
    stop: decision.stop,
    target: decision.target,
    sizing: decision.sizing,
    vetoes: decision.vetoes || [],
  };
}

function unknownDecisionMarketData(instrument, reason) {
  return makeUnknownResult(normalizeMarketSymbol(instrument), reason || 'market_price_unknown');
}

function decisionTimingBlock(decision, currentPrice) {
  if (!Number.isFinite(currentPrice)) return null;
  if (!Number.isFinite(decision.entry) || !Number.isFinite(decision.acceptable_entry)) return 'WAIT';
  if (decision.action === 'LONG') {
    if (currentPrice < decision.entry) return `WAIT - reclaim ${decision.entry}`;
    if (currentPrice <= decision.acceptable_entry) return null;
    return `SKIP CHASE - above ${decision.acceptable_entry}`;
  }
  if (decision.action === 'SHORT') {
    if (currentPrice > decision.entry) return `WAIT - lose ${decision.entry}`;
    if (currentPrice >= decision.acceptable_entry) return null;
    return `SKIP CHASE - below ${decision.acceptable_entry}`;
  }
  return null;
}

function decisionBlockedByAdapter(decision, warnings, currentPrice = null, marketData = null) {
  if (warnings.some(warning => /market price stale|market price UNKNOWN|market price not trusted|market price lookup disabled|live price UNKNOWN/i.test(warning))) {
    const side = decision.action === 'LONG' || decision.action === 'SHORT' ? decision.action : decision.side || null;
    const reason = Number.isFinite(marketData?.price)
      ? 'WAIT - live price not trusted'
      : 'WAIT - market price UNKNOWN';
    return {
      ...decision,
      action: 'PASS',
      side,
      reason: `${reason} | ${decision.reason}`,
      adapter_blocker: Number.isFinite(marketData?.price) ? 'market_price_not_trusted' : 'market_price_unknown',
    };
  }
  const timingBlock = decisionTimingBlock(decision, currentPrice);
  if (timingBlock && (decision.action === 'LONG' || decision.action === 'SHORT')) {
    return {
      ...decision,
      action: 'PASS',
      side: decision.action,
      reason: `${timingBlock} | ${decision.reason}`,
      adapter_blocker: timingBlock.startsWith('SKIP CHASE') ? 'skip_chase' : 'wait_for_entry',
    };
  }
  return decision;
}

async function resolveCurrentPrice({ instrument, currentPrice, getLivePriceFn, getMarketPriceFn }) {
  if (currentPrice !== undefined && currentPrice !== null) {
    const marketData = marketDataFromExplicitPrice(instrument, currentPrice);
    return {
      currentPrice: Number.isFinite(marketData.price) ? marketData.price : null,
      warning: Number.isFinite(marketData.price) ? null : 'currentPrice was not numeric',
      marketData,
    };
  }

  if (getMarketPriceFn === false || getLivePriceFn === false) {
    const marketData = unknownDecisionMarketData(instrument, 'market price lookup disabled');
    return {
      currentPrice: null,
      warning: 'market price lookup disabled',
      marketData,
    };
  }

  try {
    const marketData = getMarketPriceFn
      ? await getMarketPriceFn(instrument)
      : marketDataFromLegacyLive(instrument, await getLivePriceFn());
    const usable = isUsableDecisionPrice(marketData);
    return {
      currentPrice: usable ? marketData.price : null,
      warning: usable ? null : (Number.isFinite(marketData?.price) ? 'market price not trusted' : 'market price UNKNOWN'),
      marketData,
    };
  } catch (err) {
    return {
      currentPrice: null,
      warning: `market price UNKNOWN: ${err.message}`,
      marketData: unknownDecisionMarketData(instrument, err.message),
    };
  }
}

async function buildDecisionResponse({
  instrument = 'ES',
  mode = 'manual',
  currentPrice = undefined,
  state = null,
  now = new Date(),
  getLivePriceFn = getLivePrice,
  getMarketPriceFn = getMarketPrice,
  buildTradeDecisionFn = buildTradeDecision,
} = {}) {
  const normalizedInstrument = normalizeInstrument(instrument);
  const warnings = [];
  const effectiveGetMarketPriceFn = getLivePriceFn !== getLivePrice ? null : getMarketPriceFn;
  const price = await resolveCurrentPrice({
    instrument: normalizedInstrument,
    currentPrice,
    getLivePriceFn,
    getMarketPriceFn: effectiveGetMarketPriceFn,
  });
  if (price.warning) warnings.push(price.warning);

  const spineDecision = buildTradeDecisionFn({
    instrument: normalizedInstrument,
    mode,
    currentPrice: price.currentPrice,
    state,
    now,
  });
  const decision = decisionBlockedByAdapter(spineDecision, warnings, price.currentPrice, price.marketData);
  const actionable = decision.ok === true && (decision.action === 'LONG' || decision.action === 'SHORT');

  return {
    ok: decision.ok,
    endpoint_type: 'decision',
    instrument: normalizedInstrument,
    mode,
    current_price: price.currentPrice,
    marketData: summarizeMarketData(price.marketData),
    market_data: summarizeMarketData(price.marketData),
    actionable,
    pass: decision.action === 'PASS',
    trade_instruction: actionable ? {
      side: decision.action,
      entry: decision.entry,
      acceptable_entry: decision.acceptable_entry,
      stop: decision.stop,
      target: decision.target,
      sizing: decision.sizing,
    } : null,
    summary: summarizeDecision(decision),
    decision,
    spine_decision: spineDecision,
    warnings,
  };
}

module.exports = {
  buildDecisionResponse,
  summarizeDecision,
  decisionBlockedByAdapter,
  decisionTimingBlock,
  priceFromLive,
  summarizeMarketData,
  isUsableDecisionPrice,
};
