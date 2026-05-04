'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeHeatmapGexLevels } = require('../lib/tradingview/level-export');

function makeHeatmapRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-heatmap-'));
  const dir = path.join(root, 'state', 'events');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bobby-context.jsonl'), [
    JSON.stringify({
      source: 'bobby-vision',
      source_id: 'fresh-snapshot',
      date: '2026-05-04T14:30:00.000Z',
      channel: 'bobby-spx-coms',
      panels: [
        {
          ticker: 'SPXW',
          instrument: 'SPX',
          king_nodes: [7125],
          support: [7100],
          resistance: [7150],
        },
      ],
    }),
    JSON.stringify({
      source: 'bobby-text',
      source_id: 'old-snapshot',
      date: '2026-05-04T12:00:00.000Z',
      channel: 'bobby-spx-coms',
      king_nodes: [7180],
    }),
  ].join('\n'), 'utf8');
  return root;
}

describe('heatmap_gex normalization for TradingView export', () => {
  it('normalizes Bobby heatmap snapshots with freshness and transport', () => {
    const root = makeHeatmapRoot();
    const levels = normalizeHeatmapGexLevels({
      rootDir: root,
      now: new Date('2026-05-04T15:00:00.000Z'),
      policy: { freshMinutes: 60, agingMinutes: 120 },
    });

    const fresh = levels.filter(level => level.active);
    expect(fresh.map(level => level.price).sort((a, b) => a - b)).toEqual([7100, 7125, 7150]);
    expect(fresh.every(level => level.source_family === 'heatmap_gex')).toBe(true);
    expect(fresh.every(level => level.source_transport === 'bobby')).toBe(true);

    const stale = levels.find(level => level.price === 7180);
    expect(stale.active).toBe(false);
    expect(stale.freshness.status).toBe('stale');
  });
});
