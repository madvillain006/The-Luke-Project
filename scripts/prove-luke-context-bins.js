#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildContextBinPrompt,
  buildContextBinsSnapshot,
  classifyContextTurn,
  recordContextTurn,
} = require('../lib/luke-context-bins');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'luke-context-bins');
const OUT_FILE = path.join(OUT_DIR, 'luke-context-bins-proof.json');

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-context-bins-proof-'));
  const eventsDir = path.join(root, 'events');
  const snapshotsDir = path.join(root, 'snapshots');
  fs.mkdirSync(eventsDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  return {
    events: {
      contextBins: path.join(eventsDir, 'context-bins.jsonl'),
    },
    snapshots: {
      contextBins: path.join(snapshotsDir, 'context-bins.json'),
    },
  };
}

function main() {
  const paths = makePaths();
  const now = new Date('2026-05-08T13:00:00.000Z');

  recordContextTurn({
    surface: 'system',
    role: 'user',
    text: 'I have an appointment at 2 and I prefer blunt answers.',
  }, { paths, now });
  recordContextTurn({
    surface: 'system',
    role: 'user',
    text: 'Sybil source says NVDA contradicts the AI capex thesis.',
  }, { paths, now: new Date('2026-05-08T13:01:00.000Z') });
  recordContextTurn({
    surface: 'trading',
    role: 'user',
    text: 'ES Saty level and Mancini reclaim stay watchlist only.',
  }, { paths, now: new Date('2026-05-08T13:02:00.000Z') });

  const recoveredCommandRoute = classifyContextTurn({
    surface: 'system',
    text: '/status',
  });
  assert.equal(recoveredCommandRoute.primary_bin, 'trading');
  assert.equal(recoveredCommandRoute.intent, 'trading_command');

  const snapshot = buildContextBinsSnapshot({ paths, limit: 4 });
  assert.ok(snapshot.bins.personal.count >= 1);
  assert.ok(snapshot.bins.radar.count >= 1);
  assert.ok(snapshot.bins.trading.count >= 2);

  const prompt = buildContextBinPrompt({
    surface: 'system',
    text: 'what was the NVDA contradiction?',
  }, { paths });
  assert.match(prompt, /Radar bin/);
  assert.match(prompt, /NVDA contradicts/);

  const proof = {
    ok: true,
    generated_at: new Date().toISOString(),
    summary_line: snapshot.summary_line,
    command_route: recoveredCommandRoute,
    counts: Object.fromEntries(Object.entries(snapshot.bins).map(([id, bin]) => [id, bin.count])),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(proof, null, 2), 'utf8');
  console.log(`luke-context-bins proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
}

main();
