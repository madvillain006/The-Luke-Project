#!/usr/bin/env node
'use strict';

const path = require('path');
const { runMultiSourceLadderReclaimResearch } = require('../lib/research/multi-source-ladder-reclaim/evaluator');

async function main() {
  const { summary } = await runMultiSourceLadderReclaimResearch();
  console.log(`multi-source ladder first-reclaim sessions: ${summary.sessions}`);
  console.log(`single-level flushes: ${summary.setups.single_level_flushes}`);
  console.log(`multi-level flushes: ${summary.setups.multi_level_flushes}`);
  console.log(`deep flushes: ${summary.setups.deep_flushes}`);
  console.log(`first-reclaim candidates: ${summary.setups.first_reclaim_candidates}`);
  console.log(`TP +2 hit rate: ${summary.overall.tp2_hit_rate == null ? 'n/a' : (summary.overall.tp2_hit_rate * 100).toFixed(1) + '%'}`);
  console.log(`stop-first rate: ${summary.overall.stop_first_rate == null ? 'n/a' : (summary.overall.stop_first_rate * 100).toFixed(1) + '%'}`);
  console.log(`25k 2ES: pnl=${summary.account_sim['25k_2ES_FULL'].cumulative_pnl} failed=${summary.account_sim['25k_2ES_FULL'].account_failed} continuous=${summary.account_sim['25k_2ES_FULL'].continuous_profitable} targetDiagnostic=${summary.account_sim['25k_2ES_FULL'].target_hit}`);
  console.log(`25k 1ES: pnl=${summary.account_sim['25k_1ES_STARTER'].cumulative_pnl} failed=${summary.account_sim['25k_1ES_STARTER'].account_failed} continuous=${summary.account_sim['25k_1ES_STARTER'].continuous_profitable} targetDiagnostic=${summary.account_sim['25k_1ES_STARTER'].target_hit}`);
  console.log(`50k 2ES: pnl=${summary.account_sim['50k_2ES_FULL'].cumulative_pnl} failed=${summary.account_sim['50k_2ES_FULL'].account_failed} continuous=${summary.account_sim['50k_2ES_FULL'].continuous_profitable} targetDiagnostic=${summary.account_sim['50k_2ES_FULL'].target_hit}`);
  console.log(`50k 1ES: pnl=${summary.account_sim['50k_1ES_STARTER'].cumulative_pnl} failed=${summary.account_sim['50k_1ES_STARTER'].account_failed} continuous=${summary.account_sim['50k_1ES_STARTER'].continuous_profitable} targetDiagnostic=${summary.account_sim['50k_1ES_STARTER'].target_hit}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'multi-source-ladder-reclaim-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`multi-source ladder reclaim research failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
