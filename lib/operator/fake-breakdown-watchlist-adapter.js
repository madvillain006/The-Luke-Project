'use strict';

const { getMarketPrice } = require('../market-data');
const { queryLevels } = require('../level-memory');
const { readTradingStateReadOnly } = require('./operator-status-adapter');
const { buildFakeBreakdownLiveWatchlist, todayEt } = require('../research/fake-breakdown-state-machine/live-watchlist');
const { loadHistoricalCsvBars } = require('../research/corpus-loader');
const { ROOT, RESEARCH_ARTIFACT_DIR, readJson } = require('../research/common');
const path = require('path');

function normalizeInstrument(value) {
  return String(value || 'ES').toUpperCase();
}

function closedLossesFromTradingState(state, now = new Date()) {
  const today = todayEt(now);
  const candidates = [
    ...(Array.isArray(state?.closed_trades) ? state.closed_trades : []),
    ...(Array.isArray(state?.trades) ? state.trades : []),
    ...(Array.isArray(state?.shadow_session?.trades) ? state.shadow_session.trades : []),
  ];
  return candidates
    .filter(trade => {
      const date = trade.date || String(trade.closed || trade.timestamp || trade.timestamp_et || '').slice(0, 10);
      const pnl = Number(trade.pnl);
      return date === today && Number.isFinite(pnl) && pnl < 0;
    })
    .map(trade => ({
      date: trade.date || String(trade.closed || trade.timestamp || trade.timestamp_et || '').slice(0, 10),
      timestamp_et: trade.timestamp_et || trade.closed || trade.timestamp || null,
      level: Number(trade.level ?? trade.executable_level ?? trade.entry ?? trade.entry_price),
      pnl: Number(trade.pnl),
      source: trade.source || trade.strategy || 'trading_state',
    }))
    .filter(loss => Number.isFinite(loss.level));
}

function loadLevelsForWatchlist({ instrument = 'ES', queryLevelsFn = queryLevels } = {}) {
  const normalized = normalizeInstrument(instrument);
  const levels = [];
  const blockers = [];
  for (const item of Array.from(new Set([normalized, 'SPX']))) {
    try {
      levels.push(...queryLevelsFn({ instrument: item, window: 'active' }));
    } catch (err) {
      blockers.push(`level memory ${item} unavailable: ${err.message}`);
    }
  }
  return { levels, blockers };
}

function loadRecentBarsForWatchlist({ instrument = 'ES', now = new Date(), loadHistoricalCsvBarsFn = loadHistoricalCsvBars } = {}) {
  if (normalizeInstrument(instrument) !== 'ES') return [];
  try {
    const date = todayEt(now);
    return loadHistoricalCsvBarsFn('ES', date) || [];
  } catch (_err) {
    return [];
  }
}

function latestArtifactSummary({ readJsonFn = readJson } = {}) {
  const artifactPath = path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-watchlist-replay.json');
  const htmlPath = path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-watchlist.html');
  const replay = readJsonFn(artifactPath, null);
  const summary = replay?.summary || {};
  return {
    artifact_path: path.relative(ROOT, htmlPath).replace(/\\/g, '/'),
    artifact_json_path: path.relative(ROOT, artifactPath).replace(/\\/g, '/'),
    artifact_route: '/research/fake-breakdown-watchlist',
    generated_at: replay?.generated_at || null,
    signal_count: summary.signal_count ?? null,
    rules: {
      A: {
        status: 'WATCHLIST_ONLY',
        signals: summary.by_rule?.A?.signals ?? null,
        tradeable: summary.by_rule?.A?.tradeable ?? null,
        tp2_hit_rate: summary.by_rule?.A?.tp2_hit_rate ?? null,
        stop_first_rate: summary.by_rule?.A?.stop_first_rate ?? null,
        caveat: 'low sample and clustered across 12 days / 6 weeks',
      },
      B: {
        status: 'WATCHLIST_ONLY',
        signals: summary.by_rule?.B?.signals ?? null,
        tradeable: summary.by_rule?.B?.tradeable ?? null,
        tp2_hit_rate: summary.by_rule?.B?.tp2_hit_rate ?? null,
        stop_first_rate: summary.by_rule?.B?.stop_first_rate ?? null,
        best_throttle: summary.rule_b_best_throttle?.name || 'no_repeat_same_level_after_loss_2es',
        caveat: 'throttle improved survival but did not hit the 25k target',
      },
      C: {
        status: 'WATCHLIST_ONLY',
        signals: summary.by_rule?.C?.signals ?? null,
        tradeable: summary.by_rule?.C?.tradeable ?? null,
        tp2_hit_rate: summary.by_rule?.C?.tp2_hit_rate ?? null,
        stop_first_rate: summary.by_rule?.C?.stop_first_rate ?? null,
        caveat: 'needs visual review',
      },
    },
    caveats: [
      'No rule is PAPER_ONLY.',
      'No rule is LIVE.',
      'Research watchlist only - not a trade recommendation.',
    ],
  };
}

async function buildFakeBreakdownWatchlistResponse({
  instrument = 'ES',
  now = new Date(),
  recentBars = [],
  getMarketPriceFn = getMarketPrice,
  queryLevelsFn = queryLevels,
  readTradingStateFn = readTradingStateReadOnly,
  loadHistoricalCsvBarsFn = loadHistoricalCsvBars,
  readJsonFn = readJson,
} = {}) {
  const normalized = normalizeInstrument(instrument);
  const blockers = [];
  const marketData = await getMarketPriceFn(normalized).catch(err => ({
    instrument: normalized,
    symbol: normalized,
    price: null,
    source: 'UNKNOWN',
    stale: true,
    delayed: true,
    confidence: 0,
    timestamp: null,
    error: err.message,
  }));
  const levelResult = loadLevelsForWatchlist({ instrument: normalized, queryLevelsFn });
  blockers.push(...levelResult.blockers);
  const stateRead = readTradingStateFn ? readTradingStateFn() : { ok: false, value: null };
  if (stateRead && stateRead.ok === false && stateRead.error) blockers.push(`trading state read-only unavailable: ${stateRead.error}`);
  const todayLosses = closedLossesFromTradingState(stateRead?.value, now);
  const bars = Array.isArray(recentBars) && recentBars.length
    ? recentBars
    : loadRecentBarsForWatchlist({ instrument: normalized, now, loadHistoricalCsvBarsFn });
  const payload = buildFakeBreakdownLiveWatchlist({
    instrument: normalized,
    levels: levelResult.levels,
    marketData,
    recentBars: bars,
    todayLosses,
    now,
  });
  return {
    ...payload,
    ok: blockers.length === 0 && payload.ok !== false,
    blockers,
    artifact_summary: latestArtifactSummary({ readJsonFn }),
    source: {
      levels: 'Level Memory active window',
      market_data: 'market-data adapter',
      recent_bars: bars.length ? 'local ES one-minute bar corpus' : 'unavailable',
      loss_throttle: 'read-only trading state',
    },
  };
}

module.exports = {
  buildFakeBreakdownWatchlistResponse,
  closedLossesFromTradingState,
  loadLevelsForWatchlist,
  loadRecentBarsForWatchlist,
  latestArtifactSummary,
};
