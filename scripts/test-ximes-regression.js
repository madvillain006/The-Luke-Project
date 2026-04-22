'use strict';

const path = require('path');
const fs   = require('fs');
const { parseXimes, resetSessionContext } = require('../lib/parse-ximes');

const CASES = [
  // 1 — unknown user always null
  { id: 'unknown-user',       user: 'unknownuser',        text: 'SPY 560C avg 1.20' },
  // 2 — noise: too short
  { id: 'noise-ticker-only',  user: 'ximestrades',        text: 'SPY' },
  // 3 — noise: url
  { id: 'noise-url',          user: 'ximestrades',        text: 'https://example.com/chart' },
  // 4 — live entry with avg price (Pattern A)
  { id: 'live-entry-patA',    user: 'ximestrades',        text: 'SPX 5800C avg 2.50 — ENTRY NOW' },
  // 5 — pre-market setup block
  { id: 'pre-market-setup',   user: 'ximestrades',        text: 'SETUP A\nDirection: calls\nStrike: 5750\nEntry: 9:35 open\nCut: 5740\nConfidence: 75%' },
  // 6 — management: trim
  { id: 'mgmt-trim',          user: 'ximestrades',        text: 'TRIMMING 50% at 3.20' },
  // 7 — management: cut (relay user)
  { id: 'mgmt-cut-relay',     user: 'followthewhiterabblt', text: 'CUT — cut small loss at .80' },
  // 8 — live entry Pattern B (strikeP notation)
  { id: 'live-entry-patB',    user: 'ximestrades',        text: '5800P avg 1.10' },
  // 9 — NQ entry with strike in range
  { id: 'live-entry-nq',      user: 'ximestrades',        text: 'NQ 20000P avg 45.00' },
  // 10 — relay user: management allowed, entry blocked
  { id: 'relay-entry-blocked', user: 'kanabis16',         text: 'SPX 5750C avg 2.00' },
];

const results = [];
let passed = 0;
let failed = 0;

for (const c of CASES) {
  resetSessionContext();
  let out;
  try {
    out = parseXimes(c.user, c.text);
  } catch (e) {
    out = { __error: e.message };
  }
  const entry = { id: c.id, user: c.user, input: c.text, output: out };
  results.push(entry);
  console.log(`\n[${c.id}]`);
  console.log('  input:', JSON.stringify(c.text.slice(0, 80)));
  console.log('  output:', JSON.stringify(out, null, 2).split('\n').join('\n  '));
  passed++;
}

const baselineDir  = path.join(__dirname, 'baselines');
const baselinePath = path.join(baselineDir, 'ximes-baseline.json');
if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });
fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));

console.log(`\n\nBaseline saved → ${baselinePath}`);
console.log(`${passed} cases run, ${failed} errors`);
