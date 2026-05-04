'use strict';

const { getMarketSnapshot } = require('../market-data');
const { getCandles } = require('../market-data/candle-feed');
const { summarizeMarketData } = require('../operator/decision-adapter');
const { buildLevelClusters, sourceFreshness, normalizeInstrument } = require('./level-clusters');
const { evaluateLevelStates, marketDataHealth } = require('./reclaim-state-machine');
const { buildTradeCandidates } = require('./trade-candidate-builder');
const { buildAlerts } = require('./alert-feed');
const { buildDataModeStatus, normalizeMode } = require('./data-modes');
const { buildLevelSnapshot } = require('./level-snapshot-store');

function unknownMarketData(instrument, reason = 'market data unavailable') {
  return {
    symbol: instrument,
    instrument,
    price: null,
    bid: null,
    ask: null,
    last: null,
    timestamp: null,
    session: 'UNKNOWN',
    source: 'UNKNOWN',
    stale: true,
    delayed: false,
    confidence: 0,
    error: reason,
    status: 'UNKNOWN',
    live: false,
    replay: false,
    usable_for_replay: false,
    usable_for_live_arming: false,
  };
}

async function resolveMarketData({ instrument = 'ES', getMarketSnapshotFn = getMarketSnapshot, marketData = null } = {}) {
  const normalized = normalizeInstrument(instrument);
  if (marketData) return marketData;
  if (getMarketSnapshotFn === false) return unknownMarketData(normalized, 'market lookup disabled');
  try {
    const snapshot = await getMarketSnapshotFn([normalized, 'SPX']);
    return snapshot?.[normalized] || unknownMarketData(normalized);
  } catch (err) {
    return unknownMarketData(normalized, err.message);
  }
}

function replayMarketDataFromCandles(instrument, candleFeed) {
  const latest = candleFeed?.candles?.[candleFeed.candles.length - 1] || null;
  if (!latest) return unknownMarketData(instrument, 'replay candle unavailable');
  return {
    symbol: instrument,
    instrument,
    price: latest.close,
    bid: null,
    ask: null,
    last: latest.close,
    previousClose: null,
    settlement: null,
    timestamp: latest.timestamp,
    session: 'replay',
    source: 'local/replay',
    sourcePriority: 80,
    stale: false,
    delayed: false,
    confidence: 0.7,
    error: null,
    raw: { candle: latest },
    status: 'REPLAY',
    live: false,
    replay: true,
    usable_for_replay: true,
    usable_for_live_arming: false,
  };
}

function candleOptionsFromRequest({ mode, date, time, start, end, limit } = {}) {
  return {
    mode: mode === 'replay' ? 'replay' : 'latest-local',
    date,
    time,
    start,
    end,
    limit: limit !== null && limit !== undefined && Number.isFinite(Number(limit)) ? Number(limit) : (mode === 'replay' ? 240 : 120),
  };
}

function unknownCandleFeed(instrument, reason = 'candle feed unavailable') {
  return {
    symbol: instrument,
    instrument,
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
    error: reason,
    session: 'UNKNOWN',
    raw: null,
  };
}

async function resolveCandleFeed({
  instrument = 'ES',
  mode = 'live',
  date = null,
  time = null,
  start = null,
  end = null,
  limit = null,
  getCandlesFn = getCandles,
} = {}) {
  const normalized = normalizeInstrument(instrument);
  if (getCandlesFn === false) return unknownCandleFeed(normalized, 'candle lookup disabled');
  try {
    return await getCandlesFn(normalized, candleOptionsFromRequest({ mode, date, time, start, end, limit }));
  } catch (err) {
    return unknownCandleFeed(normalized, err.message);
  }
}

function summarizeCandleFeed(candleFeed) {
  const latest = candleFeed?.candles?.[candleFeed.candles.length - 1] || null;
  const ageMs = latest ? Date.now() - new Date(latest.timestamp).getTime() : null;
  return {
    symbol: candleFeed?.symbol || null,
    instrument: candleFeed?.instrument || null,
    timeframe: candleFeed?.timeframe || '1m',
    source: candleFeed?.source || 'UNKNOWN',
    source_label: candleFeed?.source_label || candleFeed?.source || 'UNKNOWN',
    latest_candle_timestamp: candleFeed?.timestamp || null,
    latest_candle_age_minutes: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null,
    candle_count: Array.isArray(candleFeed?.candles) ? candleFeed.candles.length : 0,
    finalized: latest?.finalized === true,
    stale: candleFeed?.stale === true,
    delayed: candleFeed?.delayed === true,
    live: candleFeed?.live === true,
    replay: candleFeed?.replay === true,
    usable_for_replay: candleFeed?.usable_for_replay === true,
    usable_for_live_arming: candleFeed?.usable_for_live_arming === true,
    confidence: candleFeed?.confidence || 0,
    error: candleFeed?.error || null,
    session: candleFeed?.session || 'UNKNOWN',
    reason: candleFeed?.usable_for_live_arming === true
      ? 'candle feed can support live arming'
      : (candleFeed?.usable_for_replay ? 'local/replay candles are proof-only and cannot arm live candidates' : candleFeed?.error || 'candle feed unavailable'),
    inventory: candleFeed?.raw ? {
      file_count: candleFeed.raw.file_count,
      rows: candleFeed.raw.rows,
      first_timestamp: candleFeed.raw.first_timestamp,
      last_timestamp: candleFeed.raw.last_timestamp,
      date_range: candleFeed.raw.date_range,
      files: candleFeed.raw.files,
      timezone: candleFeed.raw.timezone,
    } : null,
  };
}

function requestedReplayTimestamp({ candleFeed, request = {} } = {}) {
  const candles = Array.isArray(candleFeed?.candles) ? candleFeed.candles : [];
  const current = candles[candles.length - 1] || null;
  if (current?.timestamp) return current.timestamp;
  if (request.date && request.time) {
    const normalizedTime = String(request.time).length === 5 ? `${request.time}:00` : String(request.time);
    return `${request.date}T${normalizedTime}-04:00`;
  }
  return null;
}

function replayContext({ replayMode, candleFeed, request = {}, levelSnapshot = null } = {}) {
  if (!replayMode) return null;
  const candles = Array.isArray(candleFeed?.candles) ? candleFeed.candles : [];
  const first = candles[0] || null;
  const current = candles[candles.length - 1] || null;
  return {
    mode: 'replay',
    requested: {
      date: request.date || null,
      time: request.time || null,
      start: request.start || null,
      end: request.end || null,
      limit: request.limit ?? null,
    },
    replay_timestamp: current?.timestamp || null,
    candle_window: {
      start: first?.timestamp || null,
      end: current?.timestamp || null,
      count: candles.length,
    },
    current_candle: current ? {
      timestamp: current.timestamp,
      open: current.open,
      high: current.high,
      low: current.low,
      close: current.close,
      volume: current.volume,
      source: current.source,
      finalized: current.finalized === true,
      stale: current.stale === true,
      delayed: current.delayed === true,
      live: current.live === true,
      replay: current.replay === true,
    } : null,
    source: candleFeed?.source || 'UNKNOWN',
    source_label: candleFeed?.source_label || candleFeed?.source || 'UNKNOWN',
    live: false,
    usable_for_replay: candleFeed?.usable_for_replay === true,
    usable_for_live_arming: false,
    level_scope: {
      active_level_source: levelSnapshot?.ok ? 'timestamp_scoped_source_timeline' : 'current_active_level_memory',
      timestamp_scoped_levels_available: levelSnapshot?.ok === true,
      warning: levelSnapshot?.ok
        ? null
        : 'timestamp-scoped level snapshot unavailable; no historical levels fabricated',
    },
    error: candleFeed?.error || null,
  };
}

async function buildTradingState({
  instrument = 'ES',
  now = new Date(),
  bars = [],
  marketData = null,
  mode = 'live',
  date = null,
  time = null,
  start = null,
  end = null,
  limit = null,
  getMarketSnapshotFn = getMarketSnapshot,
  getCandlesFn = getCandles,
  clusterOptions = {},
  accountConfig = {},
  priorLossLevels = [],
} = {}) {
  const normalized = normalizeInstrument(instrument);
  const normalizedMode = normalizeMode(mode);
  const replayMode = normalizedMode === 'replay' || normalizedMode === 'dev';
  const candleFeed = await resolveCandleFeed({
    instrument: normalized,
    mode: replayMode ? 'replay' : 'live',
    date,
    time,
    start,
    end,
    limit,
    getCandlesFn,
  });
  const resolvedMarketData = replayMode
    ? replayMarketDataFromCandles(normalized, candleFeed)
    : await resolveMarketData({ instrument: normalized, getMarketSnapshotFn, marketData });
  const stateBars = Array.isArray(bars) && bars.length
    ? bars
    : ((replayMode && candleFeed.usable_for_replay) || candleFeed.usable_for_live_arming ? candleFeed.candles : []);
  const snapshotTimestamp = requestedReplayTimestamp({ candleFeed, request: { date, time, start, end, limit } });
  const levelSnapshot = replayMode && !clusterOptions.rows
    ? buildLevelSnapshot({ timestamp: snapshotTimestamp || now.toISOString(), instrument: normalized, now })
    : null;
  const effectiveClusterOptions = levelSnapshot?.ok
    ? { ...clusterOptions, rows: levelSnapshot.rows }
    : clusterOptions;
  const clusters = buildLevelClusters({ instrument: normalized, now, ...effectiveClusterOptions });
  const evaluated = evaluateLevelStates({
    clusters,
    marketData: resolvedMarketData,
    bars: stateBars,
    now,
    options: { allowReplay: replayMode && candleFeed.usable_for_replay },
  });
  const dataMode = buildDataModeStatus({
    mode: replayMode ? normalizedMode : normalizedMode,
    candleFeed,
    marketData: resolvedMarketData,
  });
  const candidates = buildTradeCandidates({
    clusters: evaluated.clusters,
    marketData: resolvedMarketData,
    accountConfig,
    priorLossLevels,
    mode: replayMode ? normalizedMode : normalizedMode,
  });
  const alerts = buildAlerts({ clusters: evaluated.clusters, candidates, dataMode });
  const replay = replayContext({
    replayMode,
    candleFeed,
    request: { date, time, start, end, limit },
    levelSnapshot,
  });
  const warnings = [
    ...(replayMode ? ['replay mode is read-only; candles cannot arm live candidates'] : []),
    ...(!stateBars.length ? ['insufficient candle data; engine will not arm fresh trade candidates from latest price alone'] : []),
    ...(replayMode && !candleFeed.usable_for_replay ? [`replay candle unavailable: ${candleFeed.error || 'no replay candles matched request'}`] : []),
    ...(replayMode && clusters.length === 0 ? ['active levels unavailable for replay timestamp; no levels fabricated'] : []),
    ...(levelSnapshot?.warnings || []),
    ...(candleFeed.usable_for_replay && !candleFeed.usable_for_live_arming ? ['local/replay candles are proof-only and cannot arm live candidates'] : []),
    ...(marketDataHealth(resolvedMarketData) === 'FRESH' ? [] : [`market data ${marketDataHealth(resolvedMarketData)}`]),
  ];

  return {
    ok: true,
    generated_at: now.toISOString(),
    instrument: normalized,
    mode: replayMode ? normalizedMode : normalizedMode,
    data_mode: dataMode,
    live: dataMode.live,
    delayed: dataMode.delayed,
    replay: replay,
    stale: dataMode.stale,
    usable_for_replay: dataMode.usable_for_replay,
    usable_for_live_arming: dataMode.usable_for_live_arming,
    can_generate_watch: dataMode.can_generate_watch,
    can_generate_paper_candidate: dataMode.can_generate_paper_candidate,
    can_generate_live_candidate: dataMode.can_generate_live_candidate,
    reason: dataMode.reason,
    no_live_execution: true,
    read_only: true,
    live_arming_enabled: candleFeed.usable_for_live_arming === true && resolvedMarketData.live === true,
    level_snapshot: levelSnapshot ? {
      ok: levelSnapshot.ok,
      timestamp_et: levelSnapshot.timestamp_et,
      instrument: levelSnapshot.instrument,
      source_counts: levelSnapshot.source_counts,
      source_health: levelSnapshot.source_health,
      stale_sources: levelSnapshot.stale_sources,
      superseded_sources: levelSnapshot.superseded_sources,
      warnings: levelSnapshot.warnings,
      active_levels: levelSnapshot.active_levels,
    } : null,
    state: evaluated.state,
    market_data: {
      ...summarizeMarketData(resolvedMarketData),
      status: marketDataHealth(resolvedMarketData),
      live: resolvedMarketData.live === true,
      replay: resolvedMarketData.replay === true,
      usable_for_replay: resolvedMarketData.usable_for_replay === true,
      usable_for_live_arming: resolvedMarketData.usable_for_live_arming === true,
    },
    candle_feed: summarizeCandleFeed(candleFeed),
    source_freshness: sourceFreshness(evaluated.clusters),
    warnings,
    clusters: evaluated.clusters,
    candidates,
    alerts,
  };
}

function levelStatePayload(state) {
  return {
    ok: state.ok,
    generated_at: state.generated_at,
    instrument: state.instrument,
    mode: state.mode,
    data_mode: state.data_mode,
    live: state.live,
    delayed: state.delayed,
    replay: state.replay,
    stale: state.stale,
    usable_for_replay: state.usable_for_replay,
    usable_for_live_arming: state.usable_for_live_arming,
    can_generate_watch: state.can_generate_watch,
    can_generate_paper_candidate: state.can_generate_paper_candidate,
    can_generate_live_candidate: state.can_generate_live_candidate,
    reason: state.reason,
    no_live_execution: true,
    read_only: true,
    endpoint_type: 'trading_level_state',
    state: state.state,
    market_data: state.market_data,
    candle_feed: state.candle_feed,
    level_snapshot: state.level_snapshot,
    live_arming_enabled: state.live_arming_enabled,
    source_freshness: state.source_freshness,
    warnings: state.warnings,
    clusters: state.clusters,
  };
}

function candidatesPayload(state) {
  return {
    ok: state.ok,
    generated_at: state.generated_at,
    instrument: state.instrument,
    mode: state.mode,
    data_mode: state.data_mode,
    live: state.live,
    delayed: state.delayed,
    replay: state.replay,
    stale: state.stale,
    usable_for_replay: state.usable_for_replay,
    usable_for_live_arming: state.usable_for_live_arming,
    can_generate_watch: state.can_generate_watch,
    can_generate_paper_candidate: state.can_generate_paper_candidate,
    can_generate_live_candidate: state.can_generate_live_candidate,
    reason: state.reason,
    no_live_execution: true,
    read_only: true,
    endpoint_type: 'trading_trade_candidates',
    market_data: state.market_data,
    candle_feed: state.candle_feed,
    level_snapshot: state.level_snapshot,
    live_arming_enabled: state.live_arming_enabled,
    source_freshness: state.source_freshness,
    warnings: state.warnings,
    candidates: state.candidates,
  };
}

function alertsPayload(state) {
  return {
    ok: state.ok,
    generated_at: state.generated_at,
    instrument: state.instrument,
    mode: state.mode,
    data_mode: state.data_mode,
    live: state.live,
    delayed: state.delayed,
    replay: state.replay,
    stale: state.stale,
    usable_for_replay: state.usable_for_replay,
    usable_for_live_arming: state.usable_for_live_arming,
    can_generate_watch: state.can_generate_watch,
    can_generate_paper_candidate: state.can_generate_paper_candidate,
    can_generate_live_candidate: state.can_generate_live_candidate,
    reason: state.reason,
    no_live_execution: true,
    read_only: true,
    endpoint_type: 'trading_alerts',
    market_data: state.market_data,
    candle_feed: state.candle_feed,
    level_snapshot: state.level_snapshot,
    live_arming_enabled: state.live_arming_enabled,
    source_freshness: state.source_freshness,
    warnings: state.warnings,
    alerts: state.alerts,
  };
}

async function candleStatusPayload({
  instrument = 'ES',
  mode = 'live',
  date = null,
  time = null,
  start = null,
  end = null,
  limit = 1,
  getCandlesFn = getCandles,
} = {}) {
  const normalized = normalizeInstrument(instrument);
  const primary = await resolveCandleFeed({ instrument: normalized, mode, date, time, start, end, limit, getCandlesFn });
  const spx = normalized === 'SPX'
    ? primary
    : await resolveCandleFeed({ instrument: 'SPX', mode, date, time, start, end, limit, getCandlesFn });
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    endpoint_type: 'trading_candle_status',
    read_only: true,
    no_live_execution: true,
    mode: mode === 'replay' ? 'replay' : 'live',
    instrument: normalized,
    feeds: {
      [normalized]: summarizeCandleFeed(primary),
      ...(normalized === 'SPX' ? {} : { SPX: summarizeCandleFeed(spx) }),
    },
  };
}

module.exports = {
  buildTradingState,
  resolveMarketData,
  resolveCandleFeed,
  unknownMarketData,
  unknownCandleFeed,
  summarizeCandleFeed,
  replayContext,
  levelStatePayload,
  candidatesPayload,
  alertsPayload,
  candleStatusPayload,
};
