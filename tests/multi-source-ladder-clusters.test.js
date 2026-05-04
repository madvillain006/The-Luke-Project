const { rowsForFact, clusterRows } = require('../lib/research/multi-source-ladder-reclaim/level-clusters');
const { buildTrustedLadder } = require('../lib/research/multi-source-ladder-reclaim/ladder');

function fact(overrides = {}) {
  return {
    id: overrides.id || 'f1',
    source: overrides.source || 'saty',
    source_type: overrides.source_type || 'fixture',
    level_type: overrides.level_type || 'support',
    role: overrides.role || 'support',
    original_level: overrides.original_level ?? 100,
    original_level_instrument: overrides.original_level_instrument || 'ES',
    available_at_et: overrides.available_at_et || '2026-04-24T09:25:00-04:00',
    raw_path: 'fixture',
  };
}

describe('multi-source ladder level clustering', () => {
  it('clusters nearby ES-native trusted levels', () => {
    const rows = [
      ...rowsForFact({ fact: fact({ id: 's', source: 'saty', original_level: 100 }), timestamp: '2026-04-24T09:31:00-04:00' }),
      ...rowsForFact({ fact: fact({ id: 'm', source: 'mancini', original_level: 100.75 }), timestamp: '2026-04-24T09:31:00-04:00' }),
    ];
    const clusters = clusterRows(rows, 1);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].is_executable_es).toBe(true);
    expect(clusters[0].source_combo).toBe('mancini+saty');
  });

  it('keeps SPX reference-only when no basis is requested', () => {
    const ladder = buildTrustedLadder({
      facts: [fact({ original_level: 5000, original_level_instrument: 'SPX', source: 'bobby' })],
      timestamp: '2026-04-24T09:31:00-04:00',
      basisMethods: ['reference_only'],
    });
    expect(ladder.executable_clusters).toHaveLength(0);
    expect(ladder.reference_only_clusters[0].basis_method).toBe('reference_only');
  });

  it('converts SPX to ES only with an explicit non-diagnostic basis', () => {
    const timestamp = '2026-04-24T09:31:00-04:00';
    const esBars = [{ timestamp, open: 103, high: 103, low: 103, close: 103 }];
    const spxBars = [{ timestamp, open: 100, high: 100, low: 100, close: 100 }];
    const ladder = buildTrustedLadder({
      facts: [fact({ original_level: 99, original_level_instrument: 'SPX', source: 'bobby' })],
      timestamp,
      esBars,
      spxBars,
      basisMethods: ['same_minute_basis'],
    });
    expect(ladder.executable_clusters).toHaveLength(1);
    expect(ladder.executable_clusters[0].canonical_price_es).toBe(102);
    expect(ladder.executable_clusters[0].basis_method).toBe('same_minute_basis');
  });

  it('marks fixed plus 30 as diagnostic only, not executable strategy truth', () => {
    const ladder = buildTrustedLadder({
      facts: [fact({ original_level: 5000, original_level_instrument: 'SPX', source: 'bobby' })],
      timestamp: '2026-04-24T09:31:00-04:00',
      basisMethods: ['fixed_plus_30_proxy'],
    });
    expect(ladder.executable_clusters).toHaveLength(0);
    expect(ladder.diagnostic_only_clusters[0].is_diagnostic_only).toBe(true);
  });

  it('labels chop and veto clusters', () => {
    const ladder = buildTrustedLadder({
      facts: [fact({ source: 'mancini', level_type: 'mancini_chop_boundary', role: 'chop', original_level: 100 })],
      timestamp: '2026-04-24T09:31:00-04:00',
    });
    expect(ladder.executable_clusters[0].is_veto_or_chop).toBe(true);
  });
});
