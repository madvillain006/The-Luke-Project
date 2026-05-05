#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildKatReleaseReadiness,
  formatKatReleaseReadinessMarkdown,
} = require('../lib/kat-release-readiness');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-release');

function main() {
  const report = buildKatReleaseReadiness({ rootDir: ROOT });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonFile = path.join(OUT_DIR, 'katbot-release-readiness.json');
  const mdFile = path.join(OUT_DIR, 'katbot-release-readiness.md');
  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdFile, formatKatReleaseReadinessMarkdown(report), 'utf8');

  console.log(JSON.stringify({
    status: report.status,
    recommended_phase: report.recommended_phase,
    blockers: report.blockers,
    warnings: report.warnings,
    files: { json: jsonFile, markdown: mdFile },
  }, null, 2));

  if (!['READY_TO_UNGATE_COMMAND_REPLIES', 'PHASE_1_COMMAND_REPLIES_LIVE'].includes(report.status)) {
    process.exitCode = 1;
  }
}

main();
