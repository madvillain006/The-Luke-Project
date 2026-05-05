#!/usr/bin/env node
'use strict';

const path = require('path');
const { runPineSlippageAudit } = require('../lib/research/pine-slippage-audit/report');

async function main() {
  const result = await runPineSlippageAudit();
  const rt050 = result.slippage_modes.find(mode => mode.mode === 'round_trip_0_50');
  const rt100 = result.slippage_modes.find(mode => mode.mode === 'round_trip_1_00');
  const best = result.family_comparison.best_family;
  console.log(`pine slippage audit: ${result.audit_result}`);
  console.log(`comparison: ${result.comparison_type}`);
  console.log(`signals: ${result.data.pine_style_signals}`);
  console.log(`round-trip 0.50 1ES expectancy: ${rt050?.one_es.expectancy ?? 'n/a'} total=${rt050?.one_es.total_pnl ?? 'n/a'}`);
  console.log(`round-trip 1.00 1ES expectancy: ${rt100?.one_es.expectancy ?? 'n/a'} total=${rt100?.one_es.total_pnl ?? 'n/a'}`);
  console.log(`break-even slippage: ${result.break_even_slippage}`);
  console.log(`best family: ${best?.family || 'none'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'pine-slippage-audit', 'slippage-summary.json')}`);
  console.log(`report: ${path.join('artifacts', 'research', 'pine-slippage-audit', 'PINE_SLIPPAGE_HISTORICAL_AUDIT.md')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`pine slippage audit failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
