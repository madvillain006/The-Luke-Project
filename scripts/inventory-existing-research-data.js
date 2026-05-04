#!/usr/bin/env node
'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR, writeJson } = require('../lib/research/common');
const { discoverResearchData } = require('../lib/research/existing-data-inventory');
const { buildSourceTimeline } = require('../lib/research/source-timeline');

function main() {
  const inventory = discoverResearchData();
  const timeline = buildSourceTimeline({ usableOnly: false });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'existing-data-inventory.json'), inventory);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'source-timeline.json'), timeline);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'missing-data-report.json'), {
    generated_at: new Date().toISOString(),
    timeline_missing: timeline.missing,
    note: 'Replay script appends replay-specific missing data.',
  });
  console.log(`inventory files: ${inventory.total_files}`);
  console.log(`timeline events: ${timeline.event_count} usable: ${timeline.usable_event_count}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'existing-data-inventory.json')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`research inventory failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}
