#!/usr/bin/env node
'use strict';

// Inject Bobby image-parsed levels into session JSON files.
//
// Reads derived/bobby-image-parses.jsonl and merges the extracted SPX/SPXW
// levels into the matching YYYY-MM-DD.json session file in sessions/.
//
// Safe to re-run - deduplicates by price+source+role before writing.
// Does not remove existing Mancini/Saty/text-bobby levels.
// Does not touch any live trading files, PM2, /entries, or broker execution.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  parses:   path.join(ROOT, 'data/backtest/es-long-bracket/derived/bobby-image-parses.jsonl'),
  sessions: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  dryRun:   false,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], next = argv[i + 1];
    if      (flag === '--parses')   { args.parses   = next; i++; }
    else if (flag === '--sessions') { args.sessions = next; i++; }
    else if (flag === '--dry-run')  { args.dryRun   = true; }
    else if (flag === '--help' || flag === '-h') { args.help = true; }
    else { throw new Error(`Unknown argument: ${flag}`); }
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/inject-session-bobby-levels.js [options]',
    '',
    '  --parses   <path>  Input parses JSONL (default: derived/bobby-image-parses.jsonl)',
    '  --sessions <dir>   Session JSON directory (default: sessions/)',
    '  --dry-run          Print what would change without writing files',
  ].join('\n');
}

// Level dedup key: price rounded to nearest 0.25 + source + role
function levelKey(level) {
  const price = Math.round(Number(level.price) * 4) / 4;
  return `${price}|${level.source}|${level.role}`;
}

// Group parse rows by tradingDateET, collecting all ok-status levels per date.
function buildLevelsByDate(parsesPath) {
  const lines = fs.readFileSync(parsesPath, 'utf8').split('\n').filter(Boolean);
  const byDate = {};

  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch (_) { continue; }
    if (row.parseStatus !== 'ok') continue;
    if (!row.tradingDateET || !Array.isArray(row.levels) || row.levels.length === 0) continue;

    if (!byDate[row.tradingDateET]) byDate[row.tradingDateET] = [];
    byDate[row.tradingDateET].push(...row.levels);
  }

  // Dedup within each date by level key
  for (const date of Object.keys(byDate)) {
    const seen = new Set();
    byDate[date] = byDate[date].filter(level => {
      const key = levelKey(level);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return byDate;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }

  console.log('[inject-bobby-levels] Loading parse results...');
  const levelsByDate = buildLevelsByDate(args.parses);
  const parseDates = Object.keys(levelsByDate).sort();
  console.log(`  ${parseDates.length} dates with parsed Bobby image levels`);
  console.log(`  Total unique levels to inject: ${Object.values(levelsByDate).reduce((s, a) => s + a.length, 0)}`);

  let updated = 0, skipped = 0, noSession = 0;

  for (const date of parseDates) {
    const sessionPath = path.join(args.sessions, `${date}.json`);

    if (!fs.existsSync(sessionPath)) {
      console.log(`  ${date}: no session file - skipping`);
      noSession++;
      continue;
    }

    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const existing = session.levels || [];

    // Build existing key set so we don't re-inject what's already there
    const existingKeys = new Set(existing.map(levelKey));

    const newLevels = levelsByDate[date].filter(l => !existingKeys.has(levelKey(l)));

    if (newLevels.length === 0) {
      console.log(`  ${date}: ${existing.length} existing levels, 0 new to inject - skip`);
      skipped++;
      continue;
    }

    const merged = [...existing, ...newLevels];
    merged.sort((a, b) => Number(a.price) - Number(b.price));

    console.log(`  ${date}: ${existing.length} -> ${merged.length} levels (+${newLevels.length} from bobby_image)`);

    if (!args.dryRun) {
      session.levels = merged;
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2) + '\n', 'utf8');
    }

    updated++;
  }

  console.log('\n[inject-bobby-levels] Done');
  console.log(`  Sessions updated:  ${updated}`);
  console.log(`  Sessions skipped (already up to date): ${skipped}`);
  console.log(`  Dates with no session file: ${noSession}`);
  if (args.dryRun) console.log('  (DRY RUN - no files written)');
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('[inject-bobby-levels] Fatal:', e.message); process.exit(1); }
}

module.exports = { parseArgs, buildLevelsByDate };
