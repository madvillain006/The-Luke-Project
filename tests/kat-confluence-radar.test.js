'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { recordRadarIngest, buildRadarSnapshot } = require('../lib/brain/radar-layer');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-kat-radar-'));
  return {
    root,
    paths: {
      events: {
        radarIngest: path.join(root, 'events', 'radar-ingest.jsonl'),
        radarReviews: path.join(root, 'events', 'radar-reviews.jsonl'),
      },
      snapshots: {
        radarState: path.join(root, 'snapshots', 'radar-state.json'),
      },
    },
  };
}

const ROOT = path.join(__dirname, '..');

describe('katbot confluence radar bridge', () => {
  it('katbot_paste items always get review_priority review (human gate)', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T14:00:00.000Z');
    const result = recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      title: 'BULL ES_NQ confluence',
      text: 'BULL KAT ALERT - ES_NQ confluence brewing\n- 2 analysts bullish: kapri, dubz\n- Pine/Luke Watch context only - not an order',
      relationship_ids: ['kat:kapri', 'kat:dubz'],
    }, { paths, now });

    expect(result.ok).toBe(true);
    expect(result.item.source_type).toBe('katbot_paste');
    expect(result.item.review_priority).toBe('review');
    expect(result.item.relationship_ids).toEqual(['kat:kapri', 'kat:dubz']);
  });

  it('katbot confluence alert appears in radar review queue', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T14:00:00.000Z');
    recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      text: 'BEAR KAT ALERT - SPX confluence brewing\n- 3 analysts bearish\n- Pine/Luke Watch context only - not an order',
    }, { paths, now });

    const snapshot = buildRadarSnapshot(paths, now);
    expect(snapshot.counts.review).toBe(1);
    expect(snapshot.source_type_counts.katbot_paste).toBe(1);
  });

  it('agent-14-kat.js contains the radar ingest call for confluence alerts', () => {
    const agent14 = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(agent14).toContain('katbot-confluence');
    expect(agent14).toContain('recordRadarIngest');
    expect(agent14).toContain("envFlagEnabled('KATBOT_ENABLE_LIVE_VISION') && envFlagEnabled('LUKE_ALLOW_ANTHROPIC_VISION')");
  });

  it('katbot confluence radar ingest creates no live candidate path', () => {
    const { paths } = tempPaths();
    const result = recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      text: 'BULL KAT ALERT - SPX confluence brewing\n- Pine/Luke Watch context only - not an order',
    }, { paths });

    expect(result.item.review_state).toBe('new');
    expect(result.item).not.toHaveProperty('live');
    expect(result.item).not.toHaveProperty('execute');
    expect(result.item).not.toHaveProperty('broker');
  });
});
