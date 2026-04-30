#!/usr/bin/env node
'use strict';

// Batch Bobby heatmap image parser.
//
// Reads bobby-image-cache.jsonl, processes local_matched images through
// parseBobbyImage(), and writes results to bobby-image-parses.jsonl.
//
// Offline backtest pipeline only. Does not touch /entries, PM2, scheduler,
// broker execution, or any live trading routes.
//
// Usage:
//   node scripts/parse-bobby-images.js [options]
//
// Options:
//   --start YYYY-MM-DD   Only process images on or after this trading date
//   --end   YYYY-MM-DD   Only process images on or before this trading date
//   --limit N            Stop after N images (for test runs)
//   --resume             Skip attachmentIds already present in output file
//   --cache <path>       Input cache JSONL (default: derived/bobby-image-cache.jsonl)
//   --out   <path>       Output parses JSONL (default: derived/bobby-image-parses.jsonl)
//   --sessions <dir>     Session dir to restrict dates (only parse dates with session files)
//   --require-mancini    Only parse dates where the session has at least one mancini level

const fs   = require('fs');
const path = require('path');
const {
  parseImageRow,
  loadProcessedIds,
  summarizeParses,
} = require('../lib/backtest-data/bobby-image-parse');
const { parseBobbyImage } = require('../lib/parse-bobby');

const ROOT = path.join(__dirname, '..');
const DERIVED = path.join(ROOT, 'data/backtest/es-long-bracket/derived');

const DEFAULTS = {
  cache:    path.join(DERIVED, 'bobby-image-cache.jsonl'),
  out:      path.join(DERIVED, 'bobby-image-parses.jsonl'),
  sessions: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  start:    null,
  end:      null,
  limit:    null,
  resume:   false,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], next = argv[i + 1];
    if      (flag === '--cache')    { args.cache    = next; i++; }
    else if (flag === '--out')      { args.out      = next; i++; }
    else if (flag === '--sessions') { args.sessions = next; i++; }
    else if (flag === '--start')    { args.start    = next; i++; }
    else if (flag === '--end')      { args.end      = next; i++; }
    else if (flag === '--limit')    { args.limit    = parseInt(next, 10); i++; }
    else if (flag === '--resume')          { args.resume         = true; }
    else if (flag === '--require-mancini') { args.requireMancini = true; }
    else if (flag === '--help' || flag === '-h') { args.help = true; }
    else { throw new Error(`Unknown argument: ${flag}`); }
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/parse-bobby-images.js [options]',
    '',
    '  --start YYYY-MM-DD   Only process images on or after this date',
    '  --end   YYYY-MM-DD   Only process images on or before this date',
    '  --limit N            Stop after N images (useful for test runs)',
    '  --resume             Skip images already in output file',
    '  --cache <path>       Input cache JSONL',
    '  --out   <path>       Output parses JSONL',
    '  --sessions <dir>     Only parse dates with a matching session JSON file',
    '',
    'Tip: run with --limit 5 first to verify the pipeline before a full run.',
  ].join('\n');
}

// Build set of dates that have session files (YYYY-MM-DD.json).
// If requireMancini, only include dates where the session has >= 1 mancini level.
function sessionDates(sessionsDir, requireMancini = false) {
  if (!fs.existsSync(sessionsDir)) return null; // null = no restriction
  const files = fs.readdirSync(sessionsDir);
  const dates = new Set();
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    if (requireMancini) {
      const session = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf8'));
      const hasMancini = (session.levels || []).some(l =>
        String(l.source || '').toLowerCase().includes('mancini')
      );
      if (!hasMancini) continue;
    }
    dates.add(m[1]);
  }
  return dates;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }

  const t0 = Date.now();

  // Load cache rows
  const cacheLines = fs.readFileSync(args.cache, 'utf8').split('\n').filter(Boolean);
  const allRows = cacheLines.map((l, i) => {
    try { return JSON.parse(l); }
    catch (e) { throw new Error(`cache line ${i + 1}: ${e.message}`); }
  });

  // Filter to local_matched images only
  let rows = allRows.filter(r => r.status === 'local_matched');
  console.log(`[parse-bobby-images] Cache: ${allRows.length} rows, ${rows.length} local_matched`);

  // Apply date filters
  if (args.start) rows = rows.filter(r => r.tradingDateET >= args.start);
  if (args.end)   rows = rows.filter(r => r.tradingDateET <= args.end);

  // Restrict to session dates (optionally requiring mancini levels)
  const dates = sessionDates(args.sessions, args.requireMancini);
  if (dates) {
    const before = rows.length;
    rows = rows.filter(r => dates.has(r.tradingDateET));
    console.log(`  Session-date filter: ${before} -> ${rows.length} images`);
  }

  // Resume: skip already-processed
  if (args.resume) {
    const processed = loadProcessedIds(args.out);
    const before = rows.length;
    rows = rows.filter(r => !processed.has(r.attachmentId));
    console.log(`  Resume: skipping ${before - rows.length} already-processed, ${rows.length} remaining`);
  }

  // Apply limit
  if (args.limit && rows.length > args.limit) {
    rows = rows.slice(0, args.limit);
    console.log(`  Limit: processing first ${rows.length} images`);
  }

  if (rows.length === 0) {
    console.log('[parse-bobby-images] Nothing to process. Done.');
    return;
  }

  // Summary of what we're about to do
  const uniqueDates = [...new Set(rows.map(r => r.tradingDateET))].sort();
  console.log(`[parse-bobby-images] Processing ${rows.length} images across ${uniqueDates.length} dates`);
  console.log(`  Dates: ${uniqueDates.join(', ')}`);
  console.log('  (This calls the Anthropic vision API — check cost before a full run)');

  // Open output stream
  const outStream = fs.createWriteStream(args.out, { flags: args.resume ? 'a' : 'w' });

  let ok = 0, failed = 0, skipped = 0;
  const failedDates = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prefix = `  [${i + 1}/${rows.length}] ${row.tradingDateET} ${row.fileName}`;

    try {
      const result = await parseImageRow(row, parseBobbyImage);
      outStream.write(JSON.stringify(result) + '\n');

      if (result.parseStatus === 'ok') {
        ok++;
        console.log(`${prefix} -> ok (${result.levelCount} levels, ${result.spxPanels} SPX panels)`);
      } else {
        failed++;
        failedDates[row.tradingDateET] = (failedDates[row.tradingDateET] || 0) + 1;
        console.warn(`${prefix} -> ${result.parseStatus}: ${result.error || ''}`);
      }
    } catch (e) {
      failed++;
      failedDates[row.tradingDateET] = (failedDates[row.tradingDateET] || 0) + 1;
      console.error(`${prefix} -> UNCAUGHT: ${e.message}`);
      outStream.write(JSON.stringify({
        messageId: row.messageId, attachmentId: row.attachmentId,
        timestamp: row.timestamp, tradingDateET: row.tradingDateET,
        localPath: row.localPath, fileName: row.fileName,
        parseStatus: 'uncaught_error', levels: [], error: e.message,
      }) + '\n');
    }

    // Progress line every 10 images
    if ((i + 1) % 10 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  -- progress: ${i + 1}/${rows.length} (${ok} ok, ${failed} failed) ${elapsed}s --`);
    }
  }

  outStream.end();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[parse-bobby-images] Done in ${elapsed}s`);
  console.log(`  ok:     ${ok}`);
  console.log(`  failed: ${failed}`);
  if (Object.keys(failedDates).length > 0) {
    console.log(`  failed dates: ${JSON.stringify(failedDates)}`);
  }

  // Fail-threshold check: warn if > 20% failed
  const failRate = rows.length > 0 ? failed / rows.length : 0;
  if (failRate > 0.2) {
    console.warn(`  [WARN] Failure rate ${(failRate * 100).toFixed(1)}% exceeds 20% threshold.`);
    console.warn('  Check API key, image format, and parseBobbyImage output before continuing.');
  }

  // Final summary from output file
  console.log('\n  Summary from output file:');
  const summary = summarizeParses(args.out);
  for (const [k, v] of Object.entries(summary)) {
    console.log(`    ${k}: ${v}`);
  }
  console.log(`\n  Output -> ${path.relative(ROOT, args.out)}`);
}

if (require.main === module) {
  main().catch(e => { console.error('[parse-bobby-images] Fatal:', e.message); process.exit(1); });
}

module.exports = { parseArgs };
