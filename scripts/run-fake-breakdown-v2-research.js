#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR } = require('../lib/research/common');
const { runFakeBreakdownV2Research } = require('../lib/research/fake-breakdown-v2/evaluator');
const { renderReadme } = require('../lib/research/fake-breakdown-v2/report');

async function main() {
  const { summary } = await runFakeBreakdownV2Research();
  fs.writeFileSync(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v2-readme.md'), renderReadme(summary), 'utf8');
  console.log(`fake breakdown v2 unique setups: ${summary.unique_setups}`);
  console.log(`reaction scalp candidates: ${summary.reaction_scalp_candidates}`);
  console.log(`level-to-level candidates: ${summary.level_to_level_candidates}`);
  console.log(`staged long candidates: ${summary.staged_long_candidates}`);
  console.log(`rows: ${summary.candidate_rows}`);
  console.log(`reaction taken: ${summary.reaction_scalp.taken_rows} | level-to-level taken: ${summary.level_to_level.taken_rows} | staged taken: ${summary.staged_long.taken_rows}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'fake-breakdown-v2-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`fake breakdown v2 research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
