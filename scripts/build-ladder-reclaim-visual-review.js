#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  buildLadderReclaimVisualReview,
  writeVisualReviewArtifacts,
} = require('../lib/research/multi-source-ladder-reclaim/visual-replay');

async function main() {
  const result = await buildLadderReclaimVisualReview();
  const caseReports = await writeVisualReviewArtifacts(result);
  const staged = result.staged_add_analysis.best_variant;
  const staged50k = result.staged_add_analysis.best_variant_50k;
  console.log(`ladder reclaim visual examples: ${result.summary.examples}`);
  console.log(`bobby+mancini examples: ${result.summary.bobby_mancini_examples}`);
  console.log(`25k 1ES taken examples: ${result.summary.account_25k_1es_taken_examples}`);
  console.log(`false-positive rows available: ${result.summary.false_positive_examples_available}`);
  console.log(`best staged variant: ${staged?.variant || 'n/a'} pnl=${staged?.cumulative_pnl ?? 'n/a'} failed=${staged?.failed ?? 'n/a'} maxDD=${staged?.max_drawdown ?? 'n/a'}`);
  console.log(`50k best staged variant: ${staged50k?.variant || 'n/a'} pnl=${staged50k?.cumulative_pnl ?? 'n/a'} failed=${staged50k?.failed ?? 'n/a'} maxDD=${staged50k?.max_drawdown ?? 'n/a'}`);
  console.log(`positive case images: ${caseReports?.positive?.length ?? 0}`);
  console.log(`negative case images: ${caseReports?.negative?.length ?? 0}`);
  console.log(`case image folder: ${caseReports?.out_dir || 'n/a'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'ladder-reclaim-visual-review.html')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`ladder reclaim visual review failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
