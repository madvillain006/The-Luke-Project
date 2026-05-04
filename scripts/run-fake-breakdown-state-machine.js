#!/usr/bin/env node
'use strict';

const path = require('path');
const { runFakeBreakdownStateMachineResearch } = require('../lib/research/fake-breakdown-state-machine/evaluator');

async function main() {
  const { summary } = await runFakeBreakdownStateMachineResearch();
  const best = summary.best_rule;
  console.log(`fake breakdown state machine level watches: ${summary.level_watch_count}`);
  console.log(`state rows: ${summary.state_rows}`);
  console.log(`best named rule: ${best?.rule_label || 'none'}`);
  console.log(`best recommendation: ${best?.recommendation || 'n/a'}`);
  console.log(`best sample: ${best?.sample_size ?? 0}`);
  console.log(`best TP +2: ${best?.tp2_hit_rate == null ? 'n/a' : (best.tp2_hit_rate * 100).toFixed(1) + '%'}`);
  console.log(`best stop-first: ${best?.stop_first_rate == null ? 'n/a' : (best.stop_first_rate * 100).toFixed(1) + '%'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'fake-breakdown-state-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`fake breakdown state machine research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
