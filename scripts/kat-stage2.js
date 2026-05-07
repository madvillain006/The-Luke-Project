#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });
const { runStage2 } = require('../lib/kat-stage2/pipeline');

const COMMANDS = new Set(['discover', 'ingest', 'parse', 'enrich', 'backtest', 'report', 'run-all']);

function parseArgs(argv) {
  const args = {
    command: argv[0] && !argv[0].startsWith('--') ? argv[0] : 'run-all',
    includeDiscordExports: true,
    includeDms: false,
    remoteMarketData: false,
  };
  for (let i = args.command === argv[0] ? 1 : 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--no-discord-exports') args.includeDiscordExports = false;
    else if (flag === '--include-dms') args.includeDms = true;
    else if (flag === '--discord-exports-dir') { args.discordExportsDir = next; i += 1; }
    else if (flag === '--remote-market-data') args.remoteMarketData = true;
    else if (flag === '--remote-symbol-limit') { args.remoteSymbolLimit = Number(next); i += 1; }
    else if (flag === '--remote-request-delay-ms') { args.remoteRequestDelayMs = Number(next); i += 1; }
    else if (flag === '--help' || flag === '-h') args.help = true;
    else throw new Error('Unknown argument: ' + flag);
  }
  if (!COMMANDS.has(args.command)) throw new Error('Unknown command: ' + args.command);
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/kat-stage2.js [discover|ingest|parse|enrich|backtest|report|run-all] [options]',
    '',
    'Options:',
    '  --no-discord-exports       Only use data/kat/raw-feed.jsonl',
    '  --discord-exports-dir DIR  Load valid DiscordChatExporter JSON from DIR',
    '  --include-dms              Include DM-looking export paths; default is excluded',
    '  --remote-market-data       Use configured Massive/Polygon historical bars for ETFs/equities/options',
    '  --remote-symbol-limit N    Cap remote symbols/contracts fetched per run',
    '  --remote-request-delay-ms N Wait between remote requests to respect free/limited plans',
    '',
    'Stage 2 is offline research only. It does not place trades or change live Katbot behavior.',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await runStage2(args.command, {
    ...args,
    marketData: {
      remote: args.remoteMarketData,
      remoteSymbolLimit: args.remoteSymbolLimit,
      remoteRequestDelayMs: args.remoteRequestDelayMs,
    },
  });
  const summary = {
    ok: result.ok,
    command: result.command,
    messages: result.context.ingestion.inventory.deduped_messages,
    trade_calls: result.context.parsed.summary.trade_calls,
    heatmaps: result.context.linked.summary.heatmaps,
    backtestable: result.context.metrics.overall.backtestable_trades,
    output_paths: result.outputPaths,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
