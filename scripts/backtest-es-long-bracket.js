#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadIntraday, rthBarsOnly, _internal } = require('../lib/historical-data');
const {
  loadSessionFile,
  runSessionBacktest,
  formatMarkdownReport,
} = require('../lib/es-long-bracket-runner');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--session') args.session = argv[++i];
    else if (token === '--historical-root') args.historicalRoot = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts\\backtest-es-long-bracket.js --session <session.json> [--out <report-base>] [--historical-root <dir>]',
    '',
    'Examples:',
    '  node scripts\\backtest-es-long-bracket.js --session data\\backtest\\es-long-bracket\\sessions\\2026-04-27.json',
    '  node scripts\\backtest-es-long-bracket.js --session data\\backtest\\es-long-bracket\\sessions\\2026-04-27.json --out data\\backtest\\es-long-bracket\\reports\\2026-04-27',
  ].join('\n');
}

function writeOutputs(outBase, result, markdown) {
  const parsed = path.parse(outBase);
  const base = parsed.ext ? path.join(parsed.dir, parsed.name) : outBase;
  const jsonPath = `${base}.json`;
  const mdPath = `${base}.md`;

  fs.mkdirSync(path.dirname(path.resolve(jsonPath)), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.session) throw new Error('--session is required');

  if (args.historicalRoot) {
    _internal._setHistoricalRoot(path.resolve(args.historicalRoot));
  }

  const session = loadSessionFile(args.session);
  let bars = loadIntraday(session.instrument, session.date) || [];
  if (session.rthOnly) bars = rthBarsOnly(bars);

  const result = runSessionBacktest(session, bars);
  const markdown = formatMarkdownReport(result);

  if (args.out) {
    const written = writeOutputs(args.out, result, markdown);
    console.log(`Wrote ${written.jsonPath}`);
    console.log(`Wrote ${written.mdPath}`);
  } else {
    process.stdout.write(markdown);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`backtest-es-long-bracket failed: ${err.message}`);
    console.error('');
    console.error(usage());
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  writeOutputs,
};

