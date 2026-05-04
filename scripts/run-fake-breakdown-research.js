#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR } = require('../lib/research/common');
const { runFakeBreakdownResearch } = require('../lib/research/fake-breakdown/strategy');
const { renderReadme } = require('../lib/research/fake-breakdown/report');

async function main() {
  const { summary } = await runFakeBreakdownResearch();
  fs.writeFileSync(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-readme.md'), renderReadme(summary), 'utf8');
  console.log(`fake breakdown candidates: ${summary.candidates_detected}`);
  console.log(`valid reclaims: ${summary.valid_reclaims} | invalid/no-reclaim: ${summary.invalid_no_reclaim}`);
  console.log(`result rows: ${summary.result_rows} | chop cases: ${summary.chop_zone_cases}`);
  const best = summary.aggregates.best_source_combo;
  console.log(`best combo: ${best ? `${best.source_combo} count=${best.count} avgR60=${best.average_r_60m}` : 'insufficient sample'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'fake-breakdown-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`fake breakdown research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
