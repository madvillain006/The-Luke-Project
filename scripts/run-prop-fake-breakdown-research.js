#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR } = require('../lib/research/common');
const { runPropFakeBreakdownResearch } = require('../lib/research/prop-fake-breakdown/evaluator');
const { renderReadme } = require('../lib/research/prop-fake-breakdown/report');

async function main() {
  const { summary } = await runPropFakeBreakdownResearch();
  fs.writeFileSync(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-readme.md'), renderReadme(summary), 'utf8');
  console.log(`prop fake breakdown unique setups: ${summary.unique_setups}`);
  console.log(`variant rows: ${summary.variant_rows}`);
  console.log(`TRADEABLE: ${summary.classification_counts.TRADEABLE} | WATCH_ONLY: ${summary.classification_counts.WATCH_ONLY} | PASS: ${summary.classification_counts.PASS}`);
  console.log(`daily drawdown failures: ${summary.prop_sim.daily_drawdown_failures}`);
  console.log(`basis methods: ${summary.basis_comparison.actual_basis_methods_tested.join(', ') || 'none'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'prop-fake-breakdown-variants.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`prop fake breakdown research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
