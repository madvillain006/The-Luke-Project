'use strict';

const fs = require('fs');
const path = require('path');
const { buildTradingState, resolveCandleFeed, summarizeCandleFeed } = require('./level-state-engine');
const { normalizeMode, buildDataModeStatus } = require('./data-modes');
const { normalizeInstrument } = require('./level-clusters');

const ROOT = path.join(__dirname, '..', '..');

function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function rowsFromArtifact(relativePath) {
  const data = readJson(relativePath, null);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.examples || data.rows || data.winners || [];
}

function timestampOf(row) {
  return row?.first_reclaim_timestamp_et || row?.reclaim_timestamp_et || row?.timestamp_et || row?.entry_timestamp_et || row?.timestamp || null;
}

function routeParts(row, fallbackDate = '2026-03-31', fallbackTime = '11:00') {
  const ts = timestampOf(row);
  if (!ts) return { date: row?.date || fallbackDate, time: fallbackTime };
  return { date: ts.slice(0, 10), time: ts.slice(11, 16) };
}

function addMinutesToParts(parts, minutes = 0) {
  if (!minutes) return parts;
  const match = /^(\d{2}):(\d{2})$/.exec(String(parts.time || ''));
  if (!match) return parts;
  const base = new Date(`${parts.date}T00:00:00Z`);
  if (!Number.isFinite(base.getTime())) return parts;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  base.setUTCDate(base.getUTCDate() + Math.floor(total / 1440));
  const minuteOfDay = ((total % 1440) + 1440) % 1440;
  const hour = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const minute = String(minuteOfDay % 60).padStart(2, '0');
  return {
    date: base.toISOString().slice(0, 10),
    time: `${hour}:${minute}`,
  };
}

function chooseReplayExamples() {
  const positives = rowsFromArtifact('artifacts/research/ladder-reclaim-bobby-mancini-review.json');
  const negatives = rowsFromArtifact('artifacts/research/ladder-reclaim-false-positives.json');
  const staged = rowsFromArtifact('artifacts/research/ladder-reclaim-staged-add-analysis.json');
  const positive = positives.find(row => timestampOf(row)?.startsWith('2026-04-02T11:31'))
    || positives.find(row => timestampOf(row)?.startsWith('2026-04-21T10:36'))
    || positives.find(row => timestampOf(row)?.startsWith('2026-03-31T11:00'))
    || positives[0]
    || { date: '2026-03-31', timestamp_et: '2026-03-31T11:00:00-04:00', source: 'fallback' };
  const negative = negatives.find(row => timestampOf(row)?.startsWith('2026-04-20T09:49'))
    || negatives.find(row => row.date === '2026-04-20')
    || negatives[0]
    || { date: '2026-04-20', timestamp_et: '2026-04-20T15:23:00-04:00', source: 'fallback' };
  const stagedAdd = staged.find(row => row?.diagnostic === '1ES_ADD_AFTER_RETEST_HOLD')
    || staged[0]
    || positive;
  return { positive, negative, staged: stagedAdd };
}

function resolveTradingRequest(options = {}) {
  const mode = normalizeMode(options.mode || (options.example ? 'replay' : 'live'));
  const examples = chooseReplayExamples();
  const exampleKey = ['positive', 'negative', 'staged'].includes(String(options.example || '').toLowerCase())
    ? String(options.example).toLowerCase()
    : null;
  if (exampleKey && (!options.date || !options.time)) {
    const baseParts = routeParts(examples[exampleKey]);
    const parts = ['positive', 'staged'].includes(exampleKey) ? addMinutesToParts(baseParts, 2) : baseParts;
    return {
      ...options,
      mode: 'replay',
      date: options.date || parts.date,
      time: options.time || parts.time,
      replay_example: { key: exampleKey, row: examples[exampleKey] },
    };
  }
  return {
    ...options,
    mode,
    replay_example: exampleKey ? { key: exampleKey, row: examples[exampleKey] } : null,
  };
}

function markerData(clusters = [], candles = []) {
  return clusters.flatMap(cluster => {
    const out = [];
    if (cluster.flush?.detected) {
      const candle = candles[cluster.flush.index] || null;
      out.push({
        kind: 'flush',
        level_cluster_id: cluster.id,
        price: cluster.canonical_price_es,
        timestamp: candle?.timestamp || cluster.last_transition_at || null,
        label: 'FLUSH_DETECTED',
      });
    }
    if (cluster.reclaim?.detected) {
      const candle = candles[cluster.reclaim.index] || null;
      out.push({
        kind: 'reclaim',
        level_cluster_id: cluster.id,
        price: cluster.canonical_price_es,
        timestamp: candle?.timestamp || cluster.last_transition_at || null,
        label: cluster.reclaim.retest_hold ? 'RETEST_HOLD' : 'FIRST_RECLAIM_WATCH',
      });
    }
    return out;
  });
}

function activeLevelLines(clusters = []) {
  return clusters.map(cluster => ({
    id: cluster.id,
    price: cluster.canonical_price_es ?? cluster.original_levels?.[0]?.price ?? null,
    instrument: cluster.instrument,
    executable_instrument: cluster.executable_instrument,
    is_executable_es: cluster.is_executable_es === true,
    is_reference_only: cluster.is_reference_only === true,
    sources: cluster.sources || [],
    source_families: cluster.source_families || cluster.sources || [],
    transports: cluster.transports || [],
    roles: cluster.roles || [],
    state: cluster.state,
    freshness: cluster.freshness,
    basis_method: cluster.basis_method,
  }));
}

async function buildTradingChartDataResponse(options = {}) {
  const request = resolveTradingRequest(options);
  const instrument = normalizeInstrument(request.instrument || 'ES');
  const state = await buildTradingState({
    ...request,
    instrument,
    limit: request.limit || 180,
  });
  const candleFeed = await resolveCandleFeed({
    instrument,
    mode: state.mode,
    date: request.date,
    time: request.time,
    start: request.start,
    end: request.end,
    limit: request.limit || 180,
  });
  const bestCandidate = state.candidates?.[0] || null;
  return {
    ok: true,
    generated_at: state.generated_at,
    endpoint_type: 'trading_chart_data',
    read_only: true,
    no_live_execution: true,
    instrument,
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
    live_arming_enabled: state.live_arming_enabled,
    replay_example: request.replay_example,
    candle_feed: summarizeCandleFeed(candleFeed),
    candles: candleFeed.candles || [],
    current_price: state.market_data?.price ?? candleFeed.candles?.[candleFeed.candles.length - 1]?.close ?? null,
    level_snapshot: state.level_snapshot,
    clusters: state.clusters,
    levels: activeLevelLines(state.clusters),
    markers: markerData(state.clusters, candleFeed.candles || []),
    candidates: state.candidates,
    alerts: state.alerts,
    bracket_visual: bestCandidate?.bracket_visual || null,
    warnings: [
      'Trading window is read-only.',
      'Replay/dev candles are proof-only and cannot arm live candidates.',
      ...(state.warnings || []),
    ],
  };
}

async function buildTradingSourceHealthResponse(options = {}) {
  const request = resolveTradingRequest(options);
  const instrument = normalizeInstrument(request.instrument || 'ES');
  const primary = await resolveCandleFeed({ instrument, mode: request.mode, date: request.date, time: request.time, limit: 1 });
  const spx = instrument === 'SPX'
    ? primary
    : await resolveCandleFeed({ instrument: 'SPX', mode: request.mode, date: request.date, time: request.time, limit: 1 });
  const state = await buildTradingState({ ...request, instrument, limit: request.limit || 180 });
  const dataMode = buildDataModeStatus({ mode: state.mode, candleFeed: primary, marketData: state.market_data });
  return {
    ok: true,
    generated_at: state.generated_at,
    endpoint_type: 'trading_source_health',
    read_only: true,
    no_live_execution: true,
    instrument,
    mode: state.mode,
    data_mode: dataMode,
    live: dataMode.live,
    delayed: dataMode.delayed,
    replay: state.replay,
    stale: dataMode.stale,
    usable_for_replay: dataMode.usable_for_replay,
    usable_for_live_arming: dataMode.usable_for_live_arming,
    can_generate_watch: dataMode.can_generate_watch,
    can_generate_paper_candidate: dataMode.can_generate_paper_candidate,
    can_generate_live_candidate: dataMode.can_generate_live_candidate,
    reason: dataMode.reason,
    live_arming_enabled: false,
    feeds: {
      [instrument]: summarizeCandleFeed(primary),
      ...(instrument === 'SPX' ? {} : { SPX: summarizeCandleFeed(spx) }),
    },
    source_health: state.level_snapshot?.source_health || state.source_freshness || {},
    source_counts: state.level_snapshot?.source_counts || {},
    stale_sources: state.level_snapshot?.stale_sources || [],
    superseded_sources: state.level_snapshot?.superseded_sources || [],
    heatmap_gex: {
      family: 'heatmap_gex',
      freshness_policy: {
        fresh_minutes: 60,
        aging_minutes: 120,
        stale_after_minutes: 120,
      },
      stale_count: state.level_snapshot?.stale_sources?.length || 0,
      superseded_count: state.level_snapshot?.superseded_sources?.length || 0,
    },
    basis_status: {
      spx_reference_only_without_explicit_basis: true,
      fixed_spx_to_es_conversion_used: false,
      note: 'SPX reference levels do not become ES executable levels without explicit basis metadata.',
    },
    warnings: [
      'No execution routes are exposed by trading source health.',
      ...(state.warnings || []),
    ],
  };
}

module.exports = {
  chooseReplayExamples,
  resolveTradingRequest,
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
  _internal: {
    timestampOf,
    routeParts,
    addMinutesToParts,
    markerData,
    activeLevelLines,
  },
};
