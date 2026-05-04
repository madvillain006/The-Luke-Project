'use strict';

const { buildLevelClusters } = require('../lib/trading-state/level-clusters');
const { evaluateLevelStates } = require('../lib/trading-state/reclaim-state-machine');

function row(price, source = 'mancini', extras = {}) {
  return {
    id: `${source}:${price}`,
    instrument: 'ES',
    executable_instrument: 'ES',
    canonical_price_es: price,
    original_price: price,
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
    evidence: [],
    ...extras,
  };
}

function market(price, extra = {}) {
  return { price, stale: false, delayed: false, status: 'FRESH', source: 'test', ...extra };
}

describe('level state engine', () => {
  it('returns NO_DATA with loaded levels when market data is unknown', () => {
    const clusters = buildLevelClusters({ rows: [row(7223)] });
    const result = evaluateLevelStates({ clusters, marketData: { price: null, status: 'UNKNOWN' } });

    expect(result.state).toBe('NO_DATA');
    expect(result.clusters[0].state).toBe('LEVELS_LOADED');
    expect(result.clusters[0].warnings).toContain('market data not fresh enough to arm');
  });

  it('marks approaching level from latest price', () => {
    const clusters = buildLevelClusters({ rows: [row(7223)] });
    const result = evaluateLevelStates({ clusters, marketData: market(7224.5) });

    expect(result.clusters[0].state).toBe('APPROACHING_LEVEL');
    expect(result.clusters[0].distance).toBe(1.5);
  });

  it('detects flush and first reclaim watch from candle structure', () => {
    const clusters = buildLevelClusters({ rows: [row(7223)] });
    const bars = [
      { open: 7225, high: 7226, low: 7224, close: 7225 },
      { open: 7225, high: 7225, low: 7221.5, close: 7222 },
      { open: 7222, high: 7224, low: 7221.75, close: 7223.25 },
    ];
    const result = evaluateLevelStates({ clusters, marketData: market(7223.25), bars });

    expect(result.clusters[0].state).toBe('FIRST_RECLAIM_WATCH');
    expect(result.clusters[0].flush.sweep_low).toBe(7221.5);
  });

  it('arms after retest and two-candle hold', () => {
    const clusters = buildLevelClusters({ rows: [row(7223)] });
    const bars = [
      { open: 7225, high: 7226, low: 7224, close: 7225 },
      { open: 7225, high: 7225, low: 7221.5, close: 7222 },
      { open: 7222, high: 7224, low: 7221.75, close: 7223.25 },
      { open: 7223.25, high: 7225, low: 7223, close: 7224 },
      { open: 7224, high: 7225, low: 7223.25, close: 7224.5 },
    ];
    const result = evaluateLevelStates({ clusters, marketData: market(7224.5), bars });

    expect(result.clusters[0].state).toBe('ARMED');
    expect(result.clusters[0].reclaim.retest_hold).toBe(true);
  });

  it('invalidates after losing reclaimed level', () => {
    const clusters = buildLevelClusters({ rows: [row(7223)] });
    const bars = [
      { open: 7225, high: 7226, low: 7224, close: 7225 },
      { open: 7225, high: 7225, low: 7221.5, close: 7222 },
      { open: 7222, high: 7224, low: 7221.75, close: 7223.25 },
      { open: 7223.25, high: 7224, low: 7221.75, close: 7222.5 },
    ];
    const result = evaluateLevelStates({ clusters, marketData: market(7222.5), bars });

    expect(result.clusters[0].state).toBe('INVALIDATED');
  });

  it('does not make SPX reference levels executable ES levels', () => {
    const clusters = buildLevelClusters({
      rows: [row(7223, 'saty', {
        instrument: 'SPX',
        executable_instrument: null,
        canonical_price_es: null,
        original_price: 7223,
        original_instrument: 'SPX',
        basis_method: 'reference_only',
        is_executable_es: false,
        is_reference_only: true,
      })],
    });

    expect(clusters[0].state).toBe('REFERENCE_ONLY');
    expect(clusters[0].is_executable_es).toBe(false);
    expect(clusters[0].warnings[0]).toContain('reference-only');
  });
});
