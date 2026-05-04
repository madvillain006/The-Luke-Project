'use strict';

const {
  applyHeatmapLifecycle,
  heatmapFreshness,
  dedupeHeatmapSnapshots,
} = require('../lib/trading-state/heatmap-gex-lifecycle');

describe('heatmap_gex lifecycle', () => {
  it('classifies heatmap freshness by intraday age', () => {
    expect(heatmapFreshness('2026-04-20T10:00:00-04:00', '2026-04-20T10:45:00-04:00').status).toBe('fresh');
    expect(heatmapFreshness('2026-04-20T10:00:00-04:00', '2026-04-20T11:30:00-04:00').status).toBe('aging');
    expect(heatmapFreshness('2026-04-20T10:00:00-04:00', '2026-04-20T12:30:00-04:00').status).toBe('stale');
  });

  it('dedupes identical snapshots and supersedes older same-transport snapshots', () => {
    const events = [
      { id: 'old', transport: 'bobby', instrument: 'SPX', available_at_et: '2026-04-20T10:00:00-04:00', levels: [{ price: 7100, role: 'king_node' }] },
      { id: 'dup', transport: 'bobby', instrument: 'SPX', available_at_et: '2026-04-20T10:01:00-04:00', levels: [{ price: 7100, role: 'king_node' }] },
      { id: 'new', transport: 'bobby', instrument: 'SPX', available_at_et: '2026-04-20T10:30:00-04:00', levels: [{ price: 7120, role: 'king_node' }] },
      { id: 'kat', transport: 'katbot', instrument: 'SPX', available_at_et: '2026-04-20T10:45:00-04:00', levels: [{ price: 7110, role: 'king_node' }] },
    ];

    expect(dedupeHeatmapSnapshots(events)).toHaveLength(3);
    const lifecycle = applyHeatmapLifecycle(events, '2026-04-20T11:00:00-04:00');
    expect(lifecycle.active.map(event => event.id).sort()).toEqual(['kat', 'new']);
    expect(lifecycle.superseded.map(event => event.id)).toContain('old');
  });

  it('excludes stale latest snapshots from active heatmap state', () => {
    const lifecycle = applyHeatmapLifecycle([
      { id: 'old', transport: 'bobby', instrument: 'SPX', available_at_et: '2026-04-20T10:00:00-04:00', levels: [{ price: 7100 }] },
    ], '2026-04-20T12:30:00-04:00');

    expect(lifecycle.active).toEqual([]);
    expect(lifecycle.stale[0].id).toBe('old');
  });
});
