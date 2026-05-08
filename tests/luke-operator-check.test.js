'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildLukeOperatorCheck } = require('../lib/luke-operator-check');

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-operator-check-'));
  const eventsDir = path.join(root, 'events');
  const snapshotsDir = path.join(root, 'snapshots');
  fs.mkdirSync(eventsDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  return {
    ROOT: root,
    events: {
      radarIngest: path.join(eventsDir, 'radar-ingest.jsonl'),
      radarReviews: path.join(eventsDir, 'radar-reviews.jsonl'),
      companionMemory: path.join(eventsDir, 'companion-memory.jsonl'),
    },
    snapshots: {
      dailySpine: path.join(snapshotsDir, 'daily-spine.json'),
      contextBins: path.join(snapshotsDir, 'context-bins.json'),
      radarState: path.join(snapshotsDir, 'radar-state.json'),
      memory: path.join(snapshotsDir, 'memory.json'),
    },
  };
}

describe('Luke operator check', () => {
  it('summarizes Luke-first readiness without creating another front route', () => {
    const paths = makePaths();
    fs.writeFileSync(paths.snapshots.dailySpine, JSON.stringify({
      generated_at: '2026-05-08T13:00:00.000Z',
      date_label: 'Friday, May 8, 2026',
    }), 'utf8');

    const memory = {
      luke_companion_memory: {
        entries: [
          {
            id: 'mem_appointment',
            kind: 'appointment',
            text: 'I have a bank appointment at 2.',
            updated_at: '2026-05-08T13:00:00.000Z',
            active: true,
          },
        ],
      },
    };

    const check = buildLukeOperatorCheck({
      paths,
      now: new Date('2026-05-08T13:10:00.000Z'),
      health: { ok: true, port: 3000 },
      memoryOptions: {
        loadMemoryFn: () => memory,
      },
    });

    expect(check.ok).toBe(true);
    expect(check.verdict).toBe('use_luke_first');
    expect(check.summary_line).toContain('daily operator surface');
    expect(check.can_replace_codex_for_daily_use).toBe(true);
    expect(check.codex_boundary).toContain('code-improvement tool');
    expect(check.context_bins.summary_line).toContain('ready');
    expect(check.market_data.minimum_hookups_ok).toBe(true);
    expect(check.market_data.provider_ladders.ES.length).toBeGreaterThanOrEqual(2);
    expect(check.front_routes).toEqual(['/luke', '/trading', '/daily', '/radar']);
    expect(check.drilldown_routes).toContain('/operator-v2');
    expect(check.operator_lines.join('\n')).toContain('Codex for code changes');
    expect(check.checks.map(item => item.id)).toEqual([
      'shared-memory',
      'luke-chat',
      'context-bins',
      'trading-boundary',
      'market-data',
      'radar',
      'daily-brief',
      'runtime',
      'code-boundary',
    ]);
  });

  it('reports memory failure as a blocker instead of pretending readiness', () => {
    const check = buildLukeOperatorCheck({
      paths: makePaths(),
      now: new Date('2026-05-08T13:10:00.000Z'),
      memoryOptions: {
        loadMemoryFn: () => {
          throw new Error('memory unavailable');
        },
      },
    });

    expect(check.ok).toBe(false);
    expect(check.verdict).toBe('fix_before_defaulting_to_luke');
    expect(check.counts.red).toBe(1);
    expect(check.summary_line).toContain('not ready');
  });
});
