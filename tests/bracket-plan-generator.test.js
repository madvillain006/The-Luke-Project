'use strict';

const { buildLevelClusters } = require('../lib/trading-state/level-clusters');
const { evaluateLevelStates } = require('../lib/trading-state/reclaim-state-machine');
const { buildTradeCandidates } = require('../lib/trading-state/trade-candidate-builder');

function row(price, source) {
  return {
    id: `${source}:${price}`,
    instrument: 'ES',
    executable_instrument: 'ES',
    canonical_price_es: price,
    original_price: price,
    original_instrument: 'ES',
    source,
    source_family: source,
    sources: [source],
    source_families: [source],
    roles: ['support_or_trigger'],
    freshness: 1,
    basis_method: 'native_es',
    is_executable_es: true,
    is_reference_only: false,
    is_chop_or_veto: false,
    confidence: 'B',
    evidence: [{ source, role: 'level' }],
  };
}

function armedCluster() {
  const clusters = buildLevelClusters({ rows: [row(7223, 'heatmap_gex'), row(7223, 'mancini'), row(7230, 'mancini')] });
  const bars = [
    { open: 7225, high: 7226, low: 7224, close: 7225 },
    { open: 7225, high: 7225, low: 7221.5, close: 7222 },
    { open: 7222, high: 7224, low: 7221.75, close: 7223.25 },
    { open: 7223.25, high: 7225, low: 7223, close: 7224 },
    { open: 7224, high: 7225, low: 7223.25, close: 7224.5 },
  ];
  return evaluateLevelStates({
    clusters,
    marketData: { price: 7224.5, stale: false, delayed: false, status: 'REPLAY', replay: true, usable_for_replay: true },
    bars,
    options: { allowReplay: true },
  }).clusters[0];
}

describe('bracket plan generator', () => {
  it('creates replay PAPER_CANDIDATE_SIM bracket visual without execution capability', () => {
    const candidates = buildTradeCandidates({
      clusters: [armedCluster()],
      marketData: { price: 7224.5, stale: false, delayed: false, status: 'REPLAY', replay: true, usable_for_replay: true },
      mode: 'replay',
    });

    const candidate = candidates[0];
    expect(candidate.status).toBe('PAPER_CANDIDATE_SIM');
    expect(candidate.strategy).toBe('ladder_reclaim_bobby_mancini_staged_v1');
    expect(candidate.bracket.entry).toBe(7223.25);
    expect(candidate.bracket.stop).toBe(7221.25);
    expect(candidate.bracket.tp1).toBe(7225.25);
    expect(candidate.bracket.tp2).toBe(7230);
    expect(candidate.bracket.can_submit).toBe(false);
    expect(candidate.bracket_visual.can_submit).toBe(false);
    expect(candidate.can_execute_live).toBe(false);
    expect(candidate.add_rule).toContain('retest hold');
    expect(candidate.size_plan.starter_contracts).toBe(1);
  });

  it('never emits LIVE_READY status', () => {
    const candidates = buildTradeCandidates({
      clusters: [armedCluster()],
      marketData: { price: 7224.5, stale: false, delayed: false, status: 'FRESH', live: true },
      mode: 'live',
    });

    expect(candidates[0].status).toBe('PAPER_CANDIDATE_LIVE_DATA');
    expect(candidates.map(candidate => candidate.status)).not.toContain('LIVE_READY');
  });
});
