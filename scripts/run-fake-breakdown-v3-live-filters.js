#!/usr/bin/env node
'use strict';

const path = require('path');
const { runFakeBreakdownV3Research } = require('../lib/research/fake-breakdown-v3/evaluator');

async function main() {
  const { summary, rules } = await runFakeBreakdownV3Research();
  const best = rules.best_2es_rule;
  console.log(`fake breakdown v3 unique setups: ${summary.unique_setups}`);
  console.log(`observation rows: ${summary.observation_rows}`);
  console.log(`best pre-entry rule: ${best?.label || 'none'}`);
  console.log(`best sample: ${best?.taken_setup_count ?? 0} setups`);
  console.log(`best TP +2 hit rate: ${best?.tp2_hit_rate == null ? 'n/a' : (best.tp2_hit_rate * 100).toFixed(1) + '%'}`);
  console.log(`best stop-first rate: ${best?.stop_first_rate == null ? 'n/a' : (best.stop_first_rate * 100).toFixed(1) + '%'}`);
  console.log(`best 2ES expectancy after 0.5pt round-trip slippage: ${best?.expectancy_2es_slip_0_5_round_trip ?? 'n/a'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'fake-breakdown-v3-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`fake breakdown v3 research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
