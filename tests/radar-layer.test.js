'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildRadarBrief,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
} = require('../lib/brain/radar-layer');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-radar-'));
  return {
    root,
    paths: {
      events: {
        radarIngest: path.join(root, 'events', 'radar-ingest.jsonl'),
      },
      snapshots: {
        radarState: path.join(root, 'snapshots', 'radar-state.json'),
      },
    },
  };
}

describe('radar layer', () => {
  it('captures Radar items, dedupes them, and builds review-only briefs', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-07T10:00:00.000Z');
    const input = {
      source_label: 'sybil',
      source_url: 'https://x.com/example/status/1',
      text: '$NVDA data center capex note contradicts the old semi thesis. Remind me to verify before market open because the risk changed.',
    };

    const first = recordRadarIngest(input, { paths, now });
    const duplicate = recordRadarIngest(input, { paths, now });
    const snapshot = buildRadarSnapshot(paths, now);
    const brief = buildRadarBrief({ paths, now });
    const items = buildRadarItems({ paths, limit: 5 });

    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.item.symbols).toContain('NVDA');
    expect(first.item.themes).toEqual(expect.arrayContaining(['ai_capex', 'reminder', 'contradiction']));
    expect(first.item.review_priority).toBe('review');
    expect(duplicate.ok).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(snapshot.counts).toMatchObject({ total: 1, fresh_24h: 1, review: 1 });
    expect(snapshot.summary_line).toBe('1 fresh / 1 review');
    expect(brief.ideas_to_verify).toHaveLength(1);
    expect(brief.safety.trading_authority).toBe('none');
    expect(items.items).toHaveLength(1);
  });
});
