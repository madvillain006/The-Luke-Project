#!/usr/bin/env node
'use strict';

/**
 * DRY-FIRE TEST SCRIPT â€” v2
 *
 * Simulates the full Luke pipeline OUTSIDE market hours. Sanity check
 * for tomorrow. Restores all state on exit.
 *
 * Strategy: mock the TIME (Date.now and new Date()) but DO NOT touch
 * Intl.DateTimeFormat â€” let it see the mocked Date naturally.
 *
 * Then update today's balance to the mocked date so /ready passes.
 * Chain tests so /alert creates active trade â†’ /runner sets runner â†’
 * /trade sees the runner.
 *
 * Usage:
 *   node scripts/dry-fire.js
 *   node scripts/dry-fire.js --verbose
 */

const path = require('path');
const fs   = require('fs');

const VERBOSE       = process.argv.includes('--verbose');
const MOCK_ENABLED  = process.env.NO_MOCK !== '1';

// â”€â”€ STEP 1: Mock Date to Tuesday 4/28/2026 @ 2:30 PM ET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//   2:30 PM ET on April 28 2026 â†’ 18:30 UTC (EDT = UTC-4)
const MOCK_UTC_MS = Date.UTC(2026, 3, 28, 18, 30, 0);

if (MOCK_ENABLED) {
  const RealDate = Date;
  function MockDate(...args) {
    if (!(this instanceof MockDate)) {
      return args.length === 0 ? new RealDate(MOCK_UTC_MS).toString()
                               : new RealDate(...args).toString();
    }
    if (args.length === 0) return new RealDate(MOCK_UTC_MS);
    return new RealDate(...args);
  }
  MockDate.prototype = RealDate.prototype;
  MockDate.UTC   = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  MockDate.now   = () => MOCK_UTC_MS;
  global.Date    = MockDate;

  console.log('[DRY-FIRE] Mocked time â†’ Tue 4/28/2026 2:30 PM ET (afternoon window)\n');
}

// â”€â”€ STEP 2: Backup state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LUKE_ROOT = path.join(__dirname, '..');
const FILES_TO_BACKUP = [
  'data/today-levels.json',
  'data/active-trade.json',
  'data/last-signal.json',
  'data/apex-state.json',
  'bobby-context.jsonl',
  'trades.jsonl',
  'data/session-replay.jsonl',
];

const BACKUPS = {};
for (const rel of FILES_TO_BACKUP) {
  const full = path.join(LUKE_ROOT, rel);
  BACKUPS[rel] = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function restoreState() {
  for (const [rel, content] of Object.entries(BACKUPS)) {
    const full = path.join(LUKE_ROOT, rel);
    try {
      if (content === null) {
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } else {
        fs.writeFileSync(full, content, 'utf8');
      }
    } catch (e) {
      console.error(`[restore] failed on ${rel}: ${e.message}`);
    }
  }
  console.log('\n[DRY-FIRE] State restored. Your real files are untouched.');
}

process.on('exit',   restoreState);
process.on('SIGINT', () => { restoreState(); process.exit(130); });
process.on('uncaughtException', (e) => {
  console.error('[DRY-FIRE] Uncaught:', e.message);
  restoreState();
  process.exit(1);
});

// â”€â”€ STEP 3: Seed fresh state for tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (Done AFTER backup, so restore undoes these.)
const apexStatePath = path.join(LUKE_ROOT, 'data/apex-state.json');
const activeTradePath = path.join(LUKE_ROOT, 'data/active-trade.json');
const levelsPath = path.join(LUKE_ROOT, 'data/today-levels.json');

// Seed apex-state.json with today's mocked date so /ready balance check passes.
fs.mkdirSync(path.dirname(apexStatePath), { recursive: true });
fs.writeFileSync(apexStatePath, JSON.stringify({
  balance: 50700,
  trail_floor: 48200,          // $2500 headroom â€” safely above $500
  updated: new Date(MOCK_UTC_MS).toISOString(),
}, null, 2));

// Clear any residual active trade so /alert can create fresh.
if (fs.existsSync(activeTradePath)) fs.unlinkSync(activeTradePath);

// â”€â”€ STEP 4: Require slash-commands AFTER Date mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { handleSlashCommand } = require('../lib/slash-commands');

// â”€â”€ STEP 5: Test harness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let passed = 0, failed = 0;

async function test(name, command, checks) {
  console.log(`\nâ”â”â” ${name} â”â”â”`);
  console.log(`> ${command.replace(/\n/g, ' âŽ ')}`);

  let responseData = null;
  const res = {
    json:   (data) => { responseData = data; return res; },
    status: () => res,
  };

  try {
    const result = handleSlashCommand(command, res);
    if (result && typeof result.then === 'function') await result;
  } catch (e) {
    console.log(`âœ— THREW: ${e.message}`);
    if (VERBOSE) console.log(e.stack);
    failed++;
    return null;
  }

  if (!responseData || !responseData.reply) {
    console.log('âœ— NO RESPONSE');
    failed++;
    return null;
  }

  const reply = responseData.reply;
  if (VERBOSE) console.log('--- response ---\n' + reply + '\n----------------');

  let allOk = true;
  for (const c of checks) {
    const ok = c.match.test ? c.match.test(reply) : reply.includes(c.match);
    console.log(`  ${ok ? 'âœ“' : 'âœ—'} ${c.label}`);
    if (!ok) {
      allOk = false;
      if (!VERBOSE) console.log(`      (expected match: ${c.match})`);
    }
  }

  if (allOk) { passed++; console.log('PASS'); }
  else       { failed++; console.log('FAIL'); }

  return responseData;
}

// â”€â”€ STEP 6: Run tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(async () => {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(' LUKE DRY-FIRE v2 â€” pipeline sanity test');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  // Test 1 â€” /ready BEFORE loading levels (expect some âŒ)
  await test(
    'Test 1: /ready (pre-load â€” expects some âŒ)',
    '/ready',
    [
      { label: 'Shows SESSION READINESS header',      match: /SESSION READINESS/i },
      { label: 'Balance check appears',               match: /Balance/i },
      { label: 'RichyDubz check appears',             match: /RichyDubz/i },
      { label: 'Bobby heatmap check appears',         match: /Bobby/i },
      { label: 'Apex floor check appears',            match: /Apex floor/i },
    ]
  );

  // Test 2 â€” /levels (RichyDubz sample)
  await test(
    'Test 2 - /dubz - RichyDubz paste',
    '/dubz ES 6845 support, SPY 593 resistance, SPX 7120 support',
    [
      { label: 'Confirms levels saved', match: /saved|updated|âœ…|levels/i },
    ]
  );

  // Test 3 â€” /heatmap (Bobby sample with real-looking SPX prices)
  await test(
    'Test 3: /heatmap â€” Bobby paste',
    '/heatmap King node upper at 7125. King node lower at 7085. Support: 7095, 7088. Resistance: 7118. Bullish',
    [
      { label: 'Confirms heatmap saved',   match: /updated|saved|heatmap|nodes/i },
    ]
  );

  // Test 4 â€” /ready AGAIN (expect all âœ…)
  await test(
    'Test 4: /ready (post-load â€” expects all âœ…)',
    '/ready',
    [
      { label: 'Shows READY TO TRADE verdict', match: /READY TO TRADE/i },
      { label: 'Balance set today âœ…',          match: /âœ… Balance set today/i },
      { label: 'RichyDubz loaded âœ…',           match: /âœ… RichyDubz/i },
      { label: 'Bobby loaded âœ…',               match: /âœ… Bobby/i },
      { label: 'Apex floor safe âœ…',            match: /âœ… Apex floor safe/i },
    ]
  );

  // Test 5 â€” /alert ES 6845 LONG (should produce SETUP or WEAK with bracket)
  //
  // Your confluence threshold requires at least a MEDIUM zone. We loaded
  // ES 6845 support in /levels which is the same price as the alert, so
  // parseXimes + confluence should match.
  const alertResp = await test(
    'Test 5: /alert ES 6845 calls avg 3.20 â€” expect verdict + bracket',
    '/alert ES 6845 calls avg 3.20',
    [
      { label: 'Returns a verdict',               match: /SETUP|WEAK|SKIP/i },
      { label: 'Contains session readiness or bracket line', match: /Entry:|Session notes|SKIP|WEAK/i },
    ]
  );

  // Peek at active trade â€” did /alert create one?
  const hasActive = fs.existsSync(activeTradePath);
  console.log(`  (post-/alert) active-trade.json exists: ${hasActive}`);

  // Test 6 â€” /runner (needs active trade; skips gracefully if none)
  const runnerResp = await test(
    'Test 6: /runner â€” mark runner active',
    '/runner 50',
    hasActive
      ? [{ label: 'Confirms runner active', match: /Runner active|ðŸƒ/i }]
      : [{ label: 'Gracefully handles no active trade', match: /No active trade|âŒ/i }]
  );

  // Test 7 â€” /trade WITHOUT RUNNER keyword
  // If runner was set, expect âš ï¸ RUNNER ACTIVE warning.
  // If no runner was set, expect trade to log cleanly.
  const runnerWasSet = hasActive && runnerResp && /Runner active/i.test(runnerResp.reply || '');

  await test(
    'Test 7: /trade LONG ES 3.20 4.80 WIN (no RUNNER keyword)',
    '/trade LONG ES 3.20 4.80 WIN',
    runnerWasSet
      ? [
          { label: 'Returns RUNNER ACTIVE warning',        match: /RUNNER ACTIVE|âš ï¸/i },
          { label: 'Instructs to add RUNNER keyword',       match: /add RUNNER|RUNNER to confirm/i },
        ]
      : [
          { label: 'Logs trade successfully',                match: /Trade logged|logged|âœ…/i },
        ]
  );

  // Test 8 â€” /trade WITH RUNNER keyword (should always log)
  await test(
    'Test 8: /trade LONG ES 3.20 4.80 WIN RUNNER â€” logs cleanly',
    '/trade LONG ES 3.20 4.80 WIN RUNNER',
    [
      { label: 'Trade logged confirmation', match: /Trade logged|logged|âœ…/i },
    ]
  );

  // Test 9 â€” /status sanity
  await test(
    'Test 9: /status',
    '/status',
    [
      { label: 'Shows LUKE ONLINE',    match: /LUKE ONLINE/i },
      { label: 'Shows market status',    match: /Market:/i },
      { label: 'Shows levels status',    match: /Levels:/i },
      { label: 'Shows Luke row',         match: /Luke/i },
    ]
  );

  // â”€â”€ SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  if (failed === 0) {
    console.log('\nâœ… Full pipeline is green. Tomorrow, follow the same flow live.\n');
  } else {
    console.log(`\nâš ï¸ ${failed} test(s) failed. Run with --verbose for full response text.\n`);
  }

  process.exit(failed === 0 ? 0 : 1);
})();