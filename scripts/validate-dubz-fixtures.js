'use strict';

require('dotenv').config();

/**
 * Integration validation harness for Dubz fixture parsing.
 * Runs real vision calls (costs tokens — that's intentional).
 * READ-ONLY: never writes to data/ state files.
 *
 * Usage: node scripts/validate-dubz-fixtures.js
 */

const fs   = require('fs');
const path = require('path');

const { parseDubzText, parseDubzImage, mergeDubzInputs } = require('../lib/parse-dubz');

const FIXTURES_DIR = path.join(__dirname, '../fixtures/dubz');

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupFixtures(dir) {
  const files = fs.readdirSync(dir).sort();
  const sets = {};
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2}_\d{4}_dubz)(?:_(\w+))?(\.\w+)$/);
    if (!m) continue;
    const key  = m[1]; // e.g. "2026-04-26_0917_dubz"
    const inst = m[2] || '_text';
    const ext  = m[3];
    if (!sets[key]) sets[key] = { txt: null, images: [] };
    if (ext === '.txt') sets[key].txt = f;
    else if (['.png', '.jpg', '.jpeg'].includes(ext)) sets[key].images.push({ file: f, instrument: inst });
  }
  return sets;
}

function sep(char = '─', len = 70) { return char.repeat(len); }

function printLevels(label, levels) {
  if (!levels || levels.length === 0) {
    console.log(`  ${label}: (none)`);
    return;
  }
  console.log(`  ${label}:`);
  for (const l of levels) {
    const sig  = l.significance        ? `sig=${l.significance}`         : '';
    const dir  = l.direction           ? `dir=${l.direction}`             : '';
    const src  = l.source              ? `src=${l.source}`                : '';
    const zone = l.zone_edge           ? `zone_edge=${l.zone_edge}`       : '';
    const snip = l.source_snippet      ? `snippet="${l.source_snippet}"` : '';
    const tags = [sig, dir, src, zone, snip].filter(Boolean).join('  ');
    console.log(`    ${String(l.price).padEnd(12)}  ${tags}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(sep('═'));
  console.log('DUBZ FIXTURE VALIDATION HARNESS');
  console.log(`Run at: ${new Date().toISOString()}`);
  console.log(sep('═'));

  const sets = groupFixtures(FIXTURES_DIR);
  const setKeys = Object.keys(sets).sort();

  if (setKeys.length === 0) {
    console.log('No fixture sets found in fixtures/dubz/');
    process.exit(1);
  }

  console.log(`\nFixture sets found: ${setKeys.length}`);
  for (const k of setKeys) {
    const s = sets[k];
    console.log(`  ${k}  txt=${s.txt || 'MISSING'}  images=[${s.images.map(i => i.file).join(', ')}]`);
  }

  // Per-fixture tracking for summary
  const summary = {
    fixtures:          0,
    visionCalls:       0,
    visionFailed:      0,
    totalParseErrors:  0,
    levelsByInstrument: { NQ: 0, ES: 0, QQQ: 0, SPY: 0 },
  };

  for (const key of setKeys) {
    const set = sets[key];
    // Extract date string from key: "2026-04-26_0917_dubz" → "2026-04-26"
    const date = key.slice(0, 10);

    console.log(`\n${sep('═')}`);
    console.log(`FIXTURE SET: ${key}`);
    console.log(`Date: ${date}   Text: ${set.txt || 'MISSING'}   Images: ${set.images.length}`);
    console.log(sep('═'));

    // ── 1. Text parse ──────────────────────────────────────────────────────────
    let textResult = null;
    if (set.txt) {
      const rawText = fs.readFileSync(path.join(FIXTURES_DIR, set.txt), 'utf8');
      console.log(`\n[TEXT PARSE]  file=${set.txt}  chars=${rawText.length}`);
      console.log(`  Preview: "${rawText.slice(0, 120).replace(/\n/g, ' ')}..."`);
      textResult = parseDubzText(rawText);

      if (textResult.carry_forward) {
        console.log('  Result: CARRY_FORWARD signal detected — no levels expected');
      } else {
        for (const [instr, data] of Object.entries(textResult.instruments)) {
          printLevels(`${instr} (${data.levels.length} levels)`, data.levels);
        }
      }
      if (textResult.parse_errors?.length) {
        console.log(`  parse_errors: ${JSON.stringify(textResult.parse_errors)}`);
      } else {
        console.log('  parse_errors: (none)');
      }
    } else {
      console.log('\n[TEXT PARSE]  MISSING .txt file — skipping text parse');
    }

    // ── 2. Vision parse (per image) ────────────────────────────────────────────
    const imageResults = [];
    for (const { file, instrument } of set.images) {
      summary.visionCalls++;
      const imgPath = path.join(FIXTURES_DIR, file);
      const buf     = fs.readFileSync(imgPath);
      const b64     = buf.toString('base64');

      console.log(`\n[VISION PARSE]  file=${file}  expected_instrument=${instrument.toUpperCase()}  size=${(buf.length / 1024).toFixed(1)}KB`);

      let imgResult;
      try {
        imgResult = await parseDubzImage(b64);
      } catch (err) {
        console.log(`  ERROR (uncaught): ${err.message}`);
        imgResult = { parse_status: 'failed', error: `uncaught: ${err.message}` };
      }

      if (!imgResult || imgResult.parse_status === 'failed') {
        summary.visionFailed++;
        console.log(`  Status: FAILED  error=${imgResult?.error || 'null result'}`);
      } else {
        console.log(`  Status: ok`);
        console.log(`  Detected instrument: ${imgResult.instrument}  (expected: ${instrument.toUpperCase()})`);
        if (imgResult.instrument !== instrument.toUpperCase()) {
          console.log(`  *** INSTRUMENT MISMATCH *** detected=${imgResult.instrument} expected=${instrument.toUpperCase()}`);
        }
        console.log(`  Current price: ${imgResult.current_price ?? 'null'}`);
        printLevels(`Levels (${imgResult.levels?.length ?? 0})`, imgResult.levels);
        if (imgResult.zones?.length) {
          console.log(`  Zones (${imgResult.zones.length}):`);
          for (const z of imgResult.zones) {
            console.log(`    top=${z.top}  bottom=${z.bottom}  type=${z.type}  color=${z.color}`);
          }
        } else {
          console.log('  Zones: (none)');
        }
      }
      imageResults.push(imgResult);
    }

    // ── 3. Merge ───────────────────────────────────────────────────────────────
    console.log(`\n[MERGE]`);
    const pasteRecord = {
      source:     'validation-harness',
      fixture:    key,
      timestamp:  new Date().toISOString(),
    };
    const mergedState = mergeDubzInputs(textResult, imageResults, null, date, pasteRecord);

    console.log('\n  Final merged state (instruments):');
    for (const [instr, data] of Object.entries(mergedState.instruments)) {
      printLevels(`  ${instr} (${data.levels.length} total)`, data.levels);
      summary.levelsByInstrument[instr] = (summary.levelsByInstrument[instr] || 0) + data.levels.length;
    }
    if (mergedState.conflicts?.length) {
      console.log(`  Conflicts: ${JSON.stringify(mergedState.conflicts)}`);
    } else {
      console.log('  Conflicts: (none)');
    }
    if (mergedState.parse_errors?.length) {
      console.log(`  Merged parse_errors:`);
      for (const e of mergedState.parse_errors) console.log(`    - ${e}`);
      summary.totalParseErrors += mergedState.parse_errors.length;
    } else {
      console.log('  Merged parse_errors: (none)');
    }
    if (mergedState.carry_forward_failed) {
      console.log(`  carry_forward_failed: ${JSON.stringify(mergedState.carry_forward_failed)}`);
    }

    console.log('\n  Full merged state JSON:');
    console.log(JSON.stringify(mergedState, null, 2));

    summary.fixtures++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${sep('═')}`);
  console.log('VALIDATION SUMMARY');
  console.log(sep('═'));
  console.log(`Fixtures processed:    ${summary.fixtures}`);
  console.log(`Vision calls made:     ${summary.visionCalls}`);
  console.log(`Vision calls failed:   ${summary.visionFailed}`);
  console.log(`Total parse_errors:    ${summary.totalParseErrors}`);
  console.log('Levels extracted per instrument (across all fixtures):');
  for (const [instr, count] of Object.entries(summary.levelsByInstrument)) {
    console.log(`  ${instr.padEnd(5)}  ${count}`);
  }
  console.log(sep('═'));
}

main().catch(err => {
  console.error('\n[HARNESS FATAL]', err.message);
  console.error(err.stack);
  process.exit(1);
});
