#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildLukeOperatorCheck } = require('../lib/luke-operator-check');
const { recordRadarIngest } = require('../lib/radar/ingest');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'luke-operator-check');
const OUT_FILE = path.join(OUT_DIR, 'luke-operator-check-proof.json');

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-operator-check-proof-'));
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
      radarState: path.join(snapshotsDir, 'radar-state.json'),
      memory: path.join(snapshotsDir, 'memory.json'),
    },
  };
}

function main() {
  const paths = makePaths();
  const now = new Date('2026-05-08T13:00:00.000Z');
  fs.writeFileSync(paths.snapshots.dailySpine, JSON.stringify({
    generated_at: now.toISOString(),
    date_label: 'Friday, May 8, 2026',
  }, null, 2), 'utf8');

  recordRadarIngest({
    source_label: 'sybil',
    source_type: 'sybil_paste',
    text: '$NVDA note contradicts an active AI capex thesis. Review before treating it as useful.',
  }, { paths, now });

  const memory = {
    luke_companion_memory: {
      entries: [
        {
          id: 'mem_bank_appointment',
          kind: 'appointment',
          text: 'I have a bank appointment at 2.',
          updated_at: now.toISOString(),
          active: true,
        },
      ],
    },
  };

  const check = buildLukeOperatorCheck({
    paths,
    now,
    health: { ok: true, port: 3000 },
    memoryOptions: {
      loadMemoryFn: () => memory,
    },
  });

  assert.equal(check.ok, true);
  assert.equal(check.verdict, 'use_luke_first');
  assert.equal(check.can_replace_codex_for_daily_use, true);
  assert.deepEqual(check.front_routes, ['/luke', '/trading', '/daily', '/radar']);
  assert.ok(check.drilldown_routes.includes('/operator-v2'));
  assert.ok(check.operator_lines.join('\n').includes('Codex for code changes'));
  assert.ok(check.checks.every(item => ['green', 'yellow'].includes(item.status)));

  const proof = {
    ok: true,
    generated_at: new Date().toISOString(),
    summary_line: check.summary_line,
    verdict: check.verdict,
    counts: check.counts,
    front_routes: check.front_routes,
    drilldown_routes: check.drilldown_routes,
    operator_lines: check.operator_lines,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(proof, null, 2), 'utf8');
  console.log(`luke-operator-check proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
}

main();
