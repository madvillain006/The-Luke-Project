'use strict';

const { buildLevelSnapshot } = require('../lib/trading-state/level-snapshot-store');

function event(overrides) {
  return {
    id: 'event',
    source: 'mancini',
    source_type: 'date_only_premarket_context',
    instrument: 'ES',
    available_at_et: '2026-04-20T09:25:00-04:00',
    levels: [{ price: 7100, role: 'support', source: 'mancini' }],
    usable_for_replay: true,
    ...overrides,
  };
}

describe('level snapshot store', () => {
  it('builds timestamp-scoped snapshots without lookahead', () => {
    const snapshot = buildLevelSnapshot({
      timestamp: '2026-04-20T10:30:00-04:00',
      events: [
        event({ id: 'known', available_at_et: '2026-04-20T09:25:00-04:00', levels: [{ price: 7100, role: 'support' }] }),
        event({ id: 'future', available_at_et: '2026-04-20T11:00:00-04:00', levels: [{ price: 7200, role: 'target' }] }),
      ],
    });

    expect(snapshot.ok).toBe(true);
    expect(snapshot.active_levels.map(level => level.price)).toContain(7100);
    expect(snapshot.active_levels.map(level => level.price)).not.toContain(7200);
    expect(snapshot.active_clusters.some(cluster => cluster.canonical_price_es === 7100)).toBe(true);
  });

  it('applies heatmap_gex freshness and supersession policy', () => {
    const snapshot = buildLevelSnapshot({
      timestamp: '2026-04-20T10:55:00-04:00',
      events: [
        event({ id: 'mancini', levels: [{ price: 7100, role: 'support' }] }),
        event({ id: 'old-heatmap', source: 'bobby', source_type: 'bobby_cached_parsed_heatmap', instrument: 'SPX', available_at_et: '2026-04-20T10:00:00-04:00', levels: [{ price: 7100, role: 'king_node' }] }),
        event({ id: 'new-heatmap', source: 'bobby', source_type: 'bobby_cached_parsed_heatmap', instrument: 'SPX', available_at_et: '2026-04-20T10:30:00-04:00', levels: [{ price: 7120, role: 'king_node' }] }),
      ],
    });

    expect(snapshot.source_counts.heatmap_gex).toBe(1);
    expect(snapshot.superseded_sources.map(source => source.id)).toContain('old-heatmap');
    const heatmap = snapshot.active_levels.find(level => level.source_family === 'heatmap_gex');
    expect(heatmap.instrument).toBe('SPX');
    expect(heatmap.is_reference_only).toBe(true);
    expect(heatmap.basis_method).toBe('reference_only');
  });

  it('expires same-day callouts while keeping structural sources', () => {
    const snapshot = buildLevelSnapshot({
      timestamp: '2026-04-20T16:30:00-04:00',
      events: [
        event({ id: 'mancini', levels: [{ price: 7100, role: 'support' }] }),
        event({ id: 'dubz-callout', source: 'dubz_callout', source_type: 'callout', available_at_et: '2026-04-20T09:30:00-04:00', levels: [{ price: 7095, role: 'support' }] }),
        event({ id: 'dubz-structural', source: 'dubz_structural', source_type: 'structural', available_at_et: '2026-04-18T09:30:00-04:00', levels: [{ price: 7080, role: 'support' }] }),
      ],
    });

    expect(snapshot.active_levels.map(level => level.price)).toContain(7100);
    expect(snapshot.active_levels.map(level => level.price)).toContain(7080);
    expect(snapshot.active_levels.map(level => level.price)).not.toContain(7095);
  });
});
