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

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
}

describe('brain-core radar integration', () => {
  it('buildBrainSnapshot includes a radar section with summary_line', () => {
    const { paths } = tempPaths();
    const snapshot = buildBrainSnapshot({ paths, now: new Date('2026-05-08T14:00:00.000Z') });

    expect(snapshot.subagents).toBeDefined();
    expect(snapshot.subagents.radar).toBeDefined();
    expect(typeof snapshot.subagents.radar.summary_line).toBe('string');
  });

  it('buildBrainSnapshot includes a review-lane summary for the dashboard panel', () => {
    const { paths } = tempPaths();
    const snapshot = buildBrainSnapshot({ paths, now: new Date('2026-05-14T17:15:00.000Z') });

    expect(snapshot.subagents.review_lane).toBeDefined();
    expect(snapshot.subagents.review_lane.read_only).toBe(true);
    expect(snapshot.subagents.review_lane.summary_line).toContain('review-only');
  });

  it('buildBrainSnapshot includes persisted QA proof in the review lane when brain reports carry qa_packet data', () => {
    const { paths } = tempPaths();
    appendJsonl(paths.events.brainReports, {
      ts: '2026-05-14T17:16:00.000Z',
      agent: 'qa',
      status: 'reported',
      summary: 'QA packet captured.',
      severity: 'info',
      data: {
        qa_packet: {
          job_id: 'subconscious_job_snapshot_review_lane',
          phase_id: 'phase-snapshot',
          files_changed: ['lib/radar/review-lane-status.js'],
          tests_run: ['npx vitest run tests/brain-core-radar.test.js'],
          test_output_summary: 'Snapshot review-lane QA proof passed.',
          tests_skipped_with_reason: [],
          behavior_proven: ['Brain snapshot surfaces persisted QA packet evidence.'],
          regression_risks: ['Monitor remains report-only without explicit workflow context.'],
          rollback_path: 'Revert snapshot review-lane QA wiring.',
          safety_boundary_confirmation: {
            pine_untouched_unless_approved: true,
            ninjatrader_untouched_unless_approved: true,
            market_hours_untouched_unless_approved: true,
            live_trading_paths_untouched: true,
            risk_checks_not_weakened: true,
            credentials_secrets_untouched: true,
            broker_account_routing_untouched: true,
            order_execution_unchanged: true,
            runtime_state_not_overwritten: true,
            no_unsafe_dependency_added: true,
          },
          result: 'pass',
          reviewer: 'qa',
          timestamp: '2026-05-14T17:15:30.000Z',
        },
      },
    });

    const snapshot = buildBrainSnapshot({ paths, now: new Date('2026-05-14T17:17:00.000Z') });

    expect(snapshot.subagents.review_lane.qa.latest_result).toBe('pass');
    expect(snapshot.subagents.review_lane.qa.feed[0]).toEqual(expect.objectContaining({
      job_id: 'subconscious_job_snapshot_review_lane',
      phase_id: 'phase-snapshot',
      valid: true,
      source_agent: 'qa',
    }));
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
