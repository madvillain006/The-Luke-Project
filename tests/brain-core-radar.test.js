'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildBrainSnapshot } = require('../lib/brain/brain-core');
const { recordRadarIngest } = require('../lib/brain/radar-layer');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-brain-'));
  const SNAPSHOTS_DIR = path.join(root, 'snapshots');
  const EVENTS_DIR = path.join(root, 'events');
  return {
    root,
    SNAPSHOTS_DIR,
    paths: {
      ROOT: root,
      SNAPSHOTS_DIR,
      EVENTS_DIR,
      events: {
        radarIngest: path.join(EVENTS_DIR, 'radar-ingest.jsonl'),
        radarReviews: path.join(EVENTS_DIR, 'radar-reviews.jsonl'),
        brainReports: path.join(EVENTS_DIR, 'brain-reports.jsonl'),
        trades: path.join(EVENTS_DIR, 'trades.jsonl'),
        paperTrades: path.join(EVENTS_DIR, 'paper-trades.jsonl'),
        bobbyContext: path.join(EVENTS_DIR, 'bobby-context.jsonl'),
        discordHistory: path.join(EVENTS_DIR, 'discord-history.jsonl'),
      },
      snapshots: {
        radarState: path.join(SNAPSHOTS_DIR, 'radar-state.json'),
        brainState: path.join(SNAPSHOTS_DIR, 'brain-state.json'),
        autonomousState: path.join(SNAPSHOTS_DIR, 'autonomous-state.json'),
        schedulerJobs: path.join(SNAPSHOTS_DIR, 'scheduler-jobs.json'),
        schedulerHeartbeat: path.join(SNAPSHOTS_DIR, 'scheduler-heartbeat.json'),
        contextBins: path.join(SNAPSHOTS_DIR, 'context-bins.json'),
        memory: path.join(SNAPSHOTS_DIR, 'memory.json'),
      },
      config: {
        memory: path.join(root, 'config', 'memory.json'),
      },
    },
  };
}

describe('brain-core radar integration', () => {
  it('buildBrainSnapshot includes a radar section with summary_line', () => {
    const { paths } = tempPaths();
    const snapshot = buildBrainSnapshot({ paths, now: new Date('2026-05-08T14:00:00.000Z') });

    expect(snapshot.subagents).toBeDefined();
    expect(snapshot.subagents.radar).toBeDefined();
    expect(typeof snapshot.subagents.radar.summary_line).toBe('string');
  });

  it('radar section reflects ingested items in the brain snapshot', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T14:00:00.000Z');

    recordRadarIngest({
      source_label: 'sybil',
      source_type: 'sybil_paste',
      text: '$NVDA data center capex note may contradict the old semi thesis.',
    }, { paths, now });

    const snapshot = buildBrainSnapshot({ paths, now });
    const radar = snapshot.subagents.radar;

    expect(radar.ok).toBe(true);
    expect(radar.ideas_to_verify).toHaveLength(1);
    expect(radar.safety.trading_authority).toBe('none');
  });

  it('radar failure does not crash buildBrainSnapshot', () => {
    const { paths } = tempPaths();
    const badPaths = { ...paths, events: { ...paths.events, radarIngest: null } };
    expect(() => buildBrainSnapshot({ paths: badPaths, now: new Date() })).not.toThrow();
    const snapshot = buildBrainSnapshot({ paths: badPaths, now: new Date() });
    expect(snapshot.subagents.radar).toBeDefined();
    expect(snapshot.subagents.radar.ok).toBe(true);
    expect(snapshot.subagents.radar.ideas_to_verify).toHaveLength(0);
  });
});
