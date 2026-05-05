'use strict';

const { buildLevelClusters } = require('../lib/trading-state/level-clusters');
const { evaluateLevelStates } = require('../lib/trading-state/reclaim-state-machine');
const { buildTradeCandidates } = require('../lib/trading-state/trade-candidate-builder');

function armedCluster({ nearestAbove = 7230, sourceRows = ['bobby', 'mancini'], bars } = {}) {
  const rows = sourceRows.map(source => ({
    id: `${source}:7223`,
    instrument: 'ES',
    executable_instrument: 'ES',
    canonical_price_es: 7223,
    original_price: 7223,
    original_instrument: 'ES',
    source,
    sources: [source],
    roles: ['support_or_trigger'],
    freshness: 1,
    basis_method: 'native_es',
    is_executable_es: true,
    is_reference_only: false,
    is_chop_or_veto: false,
    confidence: 'B',
    evidence: [{ source, role: 'level' }],
  }));
  if (nearestAbove) {
    rows.push({
      ...rows[0],
      id: 'mancini:7230',
      canonical_price_es: nearestAbove,
      original_price: nearestAbove,
      source: 'mancini',
      sources: ['mancini'],
    });
  }
  const clusters = buildLevelClusters({ rows });
  const defaultBars = [
    { open: 7225, high: 7226, low: 7224, close: 7225 },
    { open: 7225, high: 7225, low: 7221.5, close: 7222 },
    { open: 7222, high: 7224, low: 7221.75, close: 7223.25 },
    { open: 7223.25, high: 7225, low: 7223, close: 7224 },
    { open: 7224, high: 7225, low: 7223.25, close: 7224.5 },
  ];
  return evaluateLevelStates({
    clusters,
    marketData: { price: 7224.5, stale: false, delayed: false, status: 'FRESH' },
    bars: bars || defaultBars,
  }).clusters[0];
}

function liveCandidateMarket(price = 7224.5, extras = {}) {
  return {
    price,
    stale: false,
    delayed: false,
    status: 'FRESH',
    live: true,
    replay: false,
    usable_for_live_arming: true,
    usable_for_replay: false,
    ...extras,
  };
}

describe('trade candidate builder', () => {
  it('creates WATCH_ONLY when cluster is not armed', () => {
    const cluster = { ...armedCluster(), state: 'APPROACHING_LEVEL', warnings: ['insufficient candle data; can watch/approach but cannot arm'] };
    const candidates = buildTradeCandidates({ clusters: [cluster], marketData: liveCandidateMarket(7224) });

    expect(candidates[0].status).toBe('WATCH_ONLY');
    expect(candidates[0].bracket).toBeNull();
  });

  it('creates PAPER_CANDIDATE_LIVE_DATA with simulated bracket plan', () => {
    const cluster = armedCluster();
    const candidates = buildTradeCandidates({ clusters: [cluster], marketData: liveCandidateMarket(7224.5) });

    expect(candidates[0].status).toBe('PAPER_CANDIDATE_LIVE_DATA');
    expect(candidates[0].strategy).toBe('ladder_reclaim_bobby_mancini_staged_v1');
    expect(candidates[0].bracket.order_type).toBe('simulated_bracket_plan');
    expect(candidates[0].bracket.live_enabled).toBe(false);
    expect(candidates[0].can_execute_live).toBe(false);
    expect(candidates[0].size_recommendation.contracts).toBe(1);
    expect(candidates[0].tp1).toBe(7225.25);
  });

  it('blocks stale market data with PASS_DATA_UNKNOWN', () => {
    const cluster = armedCluster();
    const candidates = buildTradeCandidates({ clusters: [cluster], marketData: { price: 7224.5, stale: true, delayed: false, status: 'STALE' } });

    expect(candidates[0].status).toBe('PASS_DATA_UNKNOWN');
    expect(candidates[0].warnings).toContain('stale/delayed/UNKNOWN or unauthorized data cannot arm candidate');
  });

  it('blocks fresh-looking data without explicit live arming authorization', () => {
    const cluster = armedCluster();
    const candidates = buildTradeCandidates({
      clusters: [cluster],
      marketData: { price: 7224.5, stale: false, delayed: false, status: 'FRESH' },
    });

    expect(candidates[0].status).toBe('PASS_DATA_UNKNOWN');
    expect(candidates[0].can_execute_live).toBe(false);
    expect(candidates[0].warnings).toContain('stale/delayed/UNKNOWN or unauthorized data cannot arm candidate');
  });

  it('blocks wide stops with PASS_RISK', () => {
    const cluster = armedCluster({
      bars: [
        { open: 7225, high: 7226, low: 7224, close: 7225 },
        { open: 7225, high: 7225, low: 7210, close: 7222 },
        { open: 7222, high: 7224, low: 7212, close: 7223.25 },
        { open: 7223.25, high: 7225, low: 7223, close: 7224 },
        { open: 7224, high: 7225, low: 7223.25, close: 7224.5 },
      ],
    });
    const candidates = buildTradeCandidates({ clusters: [cluster], marketData: liveCandidateMarket(7224.5) });

    expect(candidates[0].status).toBe('PASS_RISK');
    expect(candidates[0].risk.risk_dollars).toBeGreaterThan(500);
  });

  it('blocks repeat same level after loss', () => {
    const cluster = armedCluster();
    const candidates = buildTradeCandidates({
      clusters: [cluster],
      marketData: liveCandidateMarket(7224.5),
      priorLossLevels: [7223],
    });

    expect(candidates[0].status).toBe('PASS_RISK');
    expect(candidates[0].warnings).toContain('no_repeat_after_loss');
  });
});
