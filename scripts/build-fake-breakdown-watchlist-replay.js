#!/usr/bin/env node
'use strict';

const path = require('path');
const { buildWatchlistReplay, writeWatchlistArtifacts } = require('../lib/research/fake-breakdown-state-machine/visual-replay');
const { renderWatchlistDoc } = require('../lib/research/fake-breakdown-state-machine/watchlist-report');
const { ROOT } = require('../lib/research/common');
const fs = require('fs');

async function main() {
  const result = buildWatchlistReplay();
  writeWatchlistArtifacts(result);
  fs.writeFileSync(path.join(ROOT, 'docs', 'FAKE_BREAKDOWN_WATCHLIST_REPLAY.md'), renderWatchlistDoc(result), 'utf8');
  const bestThrottle = result.throttles.best_variant;
  console.log(`watchlist signals: ${result.summary.signal_count}`);
  console.log(`rule A days: ${result.clustering.rule_a.by_day.length}`);
  console.log(`rule B best throttle: ${bestThrottle?.name || 'n/a'} pnl=${bestThrottle?.cumulative_pnl ?? 'n/a'} failed=${bestThrottle?.failed ?? 'n/a'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'fake-breakdown-watchlist.html')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`fake breakdown watchlist replay failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
