#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR, ensureDir, writeJson } = require('../lib/research/common');
const { parseArchiveFile } = require('../lib/research/fake-breakdown/mancini-importer');

function parseArgs(argv) {
  const args = { inputs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      args.inputs.push(argv[i + 1]);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      args.inputs.push(arg);
    }
  }
  return args;
}

function defaultInputs() {
  const fixed = [
    path.join('data', 'backtest', 'es-long-bracket', 'raw', 'mancini', 'Mancini.txt'),
    path.join('fixtures', 'mancini', 'inbox.md'),
    path.join('fixtures', 'mancini', 'reddit-archive-2026-04-10-to-2026-04-22.md'),
  ].filter(file => fs.existsSync(file));
  const researchDir = path.join('data', 'research', 'mancini');
  const researchFiles = fs.existsSync(researchDir)
    ? fs.readdirSync(researchDir)
      .filter(name => /\.(md|txt|json|csv|jsonl)$/i.test(name))
      .map(name => path.join(researchDir, name))
    : [];
  return [...fixed, ...researchFiles];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/import-mancini-archive.js [--input local-file]');
    return;
  }
  const inputs = args.inputs.length ? args.inputs : defaultInputs();
  ensureDir(RESEARCH_ARTIFACT_DIR);
  const normalized = [];
  const quarantine = [];
  for (const input of inputs) {
    const filePath = path.resolve(input);
    if (!fs.existsSync(filePath)) {
      quarantine.push({ raw_path: input, usable_for_replay: false, unusable_reason: 'file_missing' });
      continue;
    }
    const parsed = parseArchiveFile(filePath);
    normalized.push(...parsed.normalized);
    quarantine.push(...parsed.quarantine);
  }
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'mancini-normalized.json'), {
    generated_at: new Date().toISOString(),
    source_count: inputs.length,
    events: normalized,
  });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'mancini-quarantine.json'), {
    generated_at: new Date().toISOString(),
    source_count: inputs.length,
    events: quarantine,
  });
  console.log(`mancini normalized: ${normalized.length}`);
  console.log(`mancini quarantined: ${quarantine.length}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'mancini-normalized.json')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`mancini import failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, defaultInputs };
