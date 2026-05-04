'use strict';

const path = require('path');

const {
  buildTradingViewLevelExport,
  writeTradingViewArtifacts,
} = require('../lib/tradingview/level-export');

function main() {
  const rootDir = path.join(__dirname, '..');
  const exportData = buildTradingViewLevelExport({ rootDir });
  const summary = writeTradingViewArtifacts({ exportData, rootDir });

  console.log(JSON.stringify({
    ok: true,
    generated_at: summary.generated_at,
    source_summary: summary.source_summary,
    artifacts: summary.artifacts,
    issues: summary.issues,
    safety: summary.safety,
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { main };
