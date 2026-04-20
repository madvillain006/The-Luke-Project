'use strict';

const fs = require('fs');
const path = require('path');
const { parseSignal } = require('./parse-signal');

const HISTORY_PATH = path.join(__dirname, '..', 'discord-history.jsonl');
const SAMPLE_LINES = 100;

const lines = fs.readFileSync(HISTORY_PATH, 'utf8')
  .split('\n')
  .filter(l => l.trim())
  .slice(0, SAMPLE_LINES);

let passed = 0;
let failed = 0;
const failures = [];

for (const line of lines) {
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  const channel = entry.channel || 'unknown';
  const results = Array.isArray(entry.results) ? entry.results : [];

  for (const r of results) {
    const insights = r.insights || '';
    if (!insights || insights === 'NO_ACTIONABLE_SIGNALS') {
      failed++;
      if (failures.length < 20) {
        failures.push({ channel, insights: insights.slice(0, 80), reason: 'NO_ACTIONABLE_SIGNALS sentinel' });
      }
      continue;
    }

    const sig = parseSignal(insights, channel);

    if (sig.passToPipeline) {
      passed++;
    } else {
      failed++;
      if (failures.length < 20) {
        const reason = !sig.bias
          ? 'no bias'
          : !parseConfidenceRaw(insights)
          ? 'no CONVICTION field'
          : sig.level === null
          ? `level null (confidence=${parseConfidenceRaw(insights)})`
          : 'unknown';
        failures.push({ channel, insights: insights.slice(0, 120), reason, sig });
      }
    }
  }
}

function parseConfidenceRaw(text) {
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '');
  const m = clean.match(/CONVICTION\s*:\s*(HIGH|MEDIUM|LOW)/i);
  return m ? m[1].toUpperCase() : null;
}

const total = passed + failed;
const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

console.log(`\n=== Replay Alignment (Phase 1.5) ===`);
console.log(`Entries parsed : ${total}`);
console.log(`Passed         : ${passed} (${rate}%)`);
console.log(`Failed         : ${failed}`);
console.log(`\nTarget: 15%+ pass rate → ${parseFloat(rate) >= 15 ? 'PASS ✓' : 'FAIL ✗'}\n`);

if (parseFloat(rate) < 15) {
  console.log('--- 5 Sample Failures ---');
  failures.slice(0, 5).forEach((f, i) => {
    console.log(`\n[${i + 1}] Channel: ${f.channel}`);
    console.log(`    Reason : ${f.reason}`);
    console.log(`    Snippet: ${f.insights}`);
  });
}
