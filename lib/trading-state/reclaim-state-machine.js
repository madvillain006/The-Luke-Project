'use strict';

const { round } = require('./prop-risk-gate');

const STATES = {
  NO_DATA: 'NO_DATA',
  LEVELS_LOADED: 'LEVELS_LOADED',
  WATCHING: 'WATCHING',
  APPROACHING_LEVEL: 'APPROACHING_LEVEL',
  FLUSH_DETECTED: 'FLUSH_DETECTED',
  FIRST_RECLAIM_WATCH: 'FIRST_RECLAIM_WATCH',
  RECLAIMED: 'RECLAIMED',
  ACCEPTANCE_PENDING: 'ACCEPTANCE_PENDING',
  ARMED: 'ARMED',
  TRADE_CANDIDATE: 'TRADE_CANDIDATE',
  PASS_RISK: 'PASS_RISK',
  PASS_NO_TARGET: 'PASS_NO_TARGET',
  INVALIDATED: 'INVALIDATED',
  EXPIRED: 'EXPIRED',
  REFERENCE_ONLY: 'REFERENCE_ONLY',
};

function normalizeBars(bars = []) {
  return (bars || [])
    .map((bar, index) => ({
      index,
      timestamp: bar.timestamp || bar.timestamp_et || bar.time || null,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
    }))
    .filter(bar => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));
}

function isMarketDataUsable(marketData, options = {}) {
  const replayOk = options.allowReplay === true && marketData?.replay === true && marketData?.usable_for_replay === true;
  return Number.isFinite(marketData?.price)
    && (marketData.stale !== true || replayOk)
    && marketData.delayed !== true
    && marketData.status !== 'UNKNOWN';
}

function marketDataHealth(marketData) {
  if (!marketData || !Number.isFinite(marketData.price)) return 'UNKNOWN';
  if (marketData.replay === true) return 'REPLAY';
  if (marketData.stale === true) return 'STALE';
  if (marketData.delayed === true) return 'DELAYED';
  return 'FRESH';
}

function findFlushIndex(bars, level, breakBuffer) {
  for (let index = 1; index < bars.length; index += 1) {
    const previousClose = bars[index - 1].close;
    const bar = bars[index];
    if (previousClose >= level - 0.25 && bar.low <= level - breakBuffer) return index;
  }
  return -1;
}

function findReclaimIndex(bars, level, flushIndex) {
  if (flushIndex < 0) return -1;
  for (let index = flushIndex + 1; index < bars.length; index += 1) {
    const previousClose = bars[index - 1].close;
    const bar = bars[index];
    if (bar.close >= level && previousClose < level) return index;
    if (bar.low <= level && bar.close >= level) return index;
  }
  return -1;
}

function sweepLowAfterFlush(bars, flushIndex, reclaimIndex) {
  if (flushIndex < 0) return null;
  const end = reclaimIndex >= 0 ? reclaimIndex : bars.length - 1;
  const lows = bars.slice(flushIndex, end + 1).map(bar => bar.low).filter(Number.isFinite);
  return lows.length ? round(Math.min(...lows)) : null;
}

function hasRetestHold(bars, level, reclaimIndex, retestBuffer) {
  if (reclaimIndex < 0) return false;
  const after = bars.slice(reclaimIndex + 1);
  if (!after.length) return false;
  return after.some(bar => bar.low <= level + 0.5 && bar.low >= level - retestBuffer && bar.close >= level);
}

function hasTwoCandleHold(bars, level, reclaimIndex, retestBuffer) {
  if (reclaimIndex < 0) return false;
  const after = bars.slice(Math.max(reclaimIndex, bars.length - 3));
  if (after.length < 2) return false;
  return after.slice(-2).every(bar => bar.close >= level && bar.low >= level - retestBuffer);
}

function higherLowAfterReclaim(bars, reclaimIndex) {
  if (reclaimIndex < 0 || bars.length - reclaimIndex < 3) return false;
  const lows = bars.slice(reclaimIndex).map(bar => bar.low);
  return lows[lows.length - 1] > Math.min(...lows.slice(0, -1));
}

function evaluateClusterState({
  cluster,
  marketData,
  bars = [],
  now = new Date(),
  options = {},
} = {}) {
  const approachPoints = Number.isFinite(options.approachPoints) ? options.approachPoints : 3;
  const breakBuffer = Number.isFinite(options.breakBuffer) ? options.breakBuffer : 0.25;
  const retestBuffer = Number.isFinite(options.retestBuffer) ? options.retestBuffer : 0.25;
  const warnings = [];
  const price = Number(marketData?.price);
  const usable = isMarketDataUsable(marketData, { allowReplay: options.allowReplay === true });

  if (!cluster?.is_executable_es) {
    return {
      ...cluster,
      state: STATES.REFERENCE_ONLY,
      distance: null,
      last_transition_at: now.toISOString(),
      state_detail: 'reference-only; not executable ES',
      warnings: [...(cluster?.warnings || []), 'reference-only level cannot arm ES candidate'],
    };
  }

  if (!usable) {
    return {
      ...cluster,
      state: STATES.LEVELS_LOADED,
      distance: Number.isFinite(price) ? round(price - cluster.canonical_price_es) : null,
      last_transition_at: now.toISOString(),
      state_detail: 'market data unavailable, stale, delayed, or UNKNOWN',
      warnings: ['market data not fresh enough to arm'],
    };
  }

  const validBars = normalizeBars(bars);
  const level = cluster.canonical_price_es;
  const distance = round(price - level);
  let state = Math.abs(distance) <= approachPoints ? STATES.APPROACHING_LEVEL : STATES.WATCHING;
  let stateDetail = Math.abs(distance) <= approachPoints ? 'price is near active cluster' : 'watching active cluster';
  let flushIndex = -1;
  let reclaimIndex = -1;
  let sweepLow = null;

  if (validBars.length > 0) {
    flushIndex = findFlushIndex(validBars, level, breakBuffer);
    reclaimIndex = findReclaimIndex(validBars, level, flushIndex);
    sweepLow = sweepLowAfterFlush(validBars, flushIndex, reclaimIndex);
    const last = validBars[validBars.length - 1];

    if (flushIndex >= 0 && reclaimIndex < 0) {
      state = STATES.FLUSH_DETECTED;
      stateDetail = `flush below ${level} detected; waiting for first reclaim`;
    }
    if (reclaimIndex >= 0) {
      state = STATES.FIRST_RECLAIM_WATCH;
      stateDetail = `first reclaim of ${level} detected; retest hold needed`;
    }
    if (reclaimIndex >= 0 && hasRetestHold(validBars, level, reclaimIndex, retestBuffer)) {
      state = STATES.RECLAIMED;
      stateDetail = `retest held above ${level}; acceptance pending`;
    }
    if (reclaimIndex >= 0 && hasTwoCandleHold(validBars, level, reclaimIndex, retestBuffer)) {
      state = STATES.ARMED;
      stateDetail = `two-candle hold above ${level}; paper candidate can be evaluated`;
    }
    if (reclaimIndex >= 0 && higherLowAfterReclaim(validBars, reclaimIndex) && state === STATES.RECLAIMED) {
      state = STATES.ACCEPTANCE_PENDING;
      stateDetail = `higher low formed after reclaim; waiting for full hold confirmation`;
    }
    if (reclaimIndex >= 0 && last.close < level - breakBuffer) {
      state = STATES.INVALIDATED;
      stateDetail = `closed back below ${level} after reclaim`;
    }
  } else {
    warnings.push('insufficient candle data; can watch/approach but cannot arm');
  }

  return {
    ...cluster,
    state,
    distance,
    last_transition_at: now.toISOString(),
    state_detail: stateDetail,
    flush: flushIndex >= 0 ? {
      detected: true,
      index: flushIndex,
      sweep_low: sweepLow,
    } : null,
    reclaim: reclaimIndex >= 0 ? {
      detected: true,
      index: reclaimIndex,
      retest_hold: hasRetestHold(validBars, level, reclaimIndex, retestBuffer),
      two_candle_hold: hasTwoCandleHold(validBars, level, reclaimIndex, retestBuffer),
      higher_low_after_reclaim: higherLowAfterReclaim(validBars, reclaimIndex),
    } : null,
    warnings,
  };
}

function evaluateLevelStates({ clusters = [], marketData, bars = [], now = new Date(), options = {} } = {}) {
  const evaluated = clusters.map(cluster => evaluateClusterState({ cluster, marketData, bars, now, options }));
  const executable = evaluated.filter(cluster => cluster.is_executable_es);
  const state = !isMarketDataUsable(marketData, { allowReplay: options.allowReplay === true })
    ? STATES.NO_DATA
    : executable.length ? STATES.WATCHING : STATES.LEVELS_LOADED;
  return {
    state,
    clusters: evaluated,
    market_data_health: marketDataHealth(marketData),
  };
}

module.exports = {
  STATES,
  normalizeBars,
  isMarketDataUsable,
  marketDataHealth,
  evaluateClusterState,
  evaluateLevelStates,
  findFlushIndex,
  findReclaimIndex,
};
