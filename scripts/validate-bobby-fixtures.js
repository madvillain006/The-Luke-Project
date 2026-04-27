'use strict';

/**
 * Integration validation harness for Bobby fixture parsing.
 * Runs real vision calls (costs tokens — that's intentional).
 * READ-ONLY: never writes to data/ state files.
 *
 * Usage: node scripts/validate-bobby-fixtures.js
 */

const fs   = require('fs');
const path = require('path');

const { parseBobby, parseBobbyImage, mergeBobby } = require('../lib/parse-bobby');

const FIXTURES_DIR = path.join(__dirname, '../fixtures/bobby');

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupFixtures(dir) {
  const files = fs.readdirSync(dir).sort();
  const sets  = {};
  for (const f of files) {
    // Matches: 2026-04-27_1003_bobby.txt  or  2026-04-27_1003_bobby_3panel.png
    const m = f.match(/^(\d{4}-\d{2}-\d{2}_\d{4})_bobby(?:_3panel)?(\.\w+)$/);
    if (!m) continue;
    const key = m[1]; // e.g. "2026-04-27_1003"
    const ext = m[2];
    if (!sets[key]) sets[key] = { txt: null, images: [] };
    if (ext === '.txt') sets[key].txt = f;
    else if (['.png', '.jpg', '.jpeg'].includes(ext)) sets[key].images.push(f);
  }
  return sets;
}

function sep(char = '─', len = 70) { return char.repeat(len); }

function printArr(label, arr) {
  if (!arr || arr.length === 0) {
    console.log(`  ${label}: (none)`);
    return;
  }
  console.log(`  ${label}: ${arr.join(', ')}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(sep('═'));
  console.log('BOBBY FIXTURE VALIDATION HARNESS');
  console.log(`Run at: ${new Date().toISOString()}`);
  console.log(sep('═'));

  const sets    = groupFixtures(FIXTURES_DIR);
  const setKeys = Object.keys(sets).sort();

  if (setKeys.length === 0) {
    console.log('No fixture sets found in fixtures/bobby/');
    process.exit(1);
  }

  console.log(`\nFixture sets found: ${setKeys.length}`);
  for (const k of setKeys) {
    const s = sets[k];
    const txtLabel = s.txt
      ? s.txt
      : s.images.length > 0 ? 'MISSING (image-only set)' : 'MISSING';
    console.log(`  ${k}  txt=${txtLabel}  images=[${s.images.join(', ')}]`);
  }

  const summary = {
    fixtures:       0,
    visionCalls:    0,
    visionFailed:   0,
    visionOk:       0,
    textParseOk:    0,
    textParseNull:  0,
    kingNodesTotal: 0,
    supportTotal:   0,
    resistTotal:    0,
  };

  for (const key of setKeys) {
    const set = sets[key];

    console.log(`\n${sep('═')}`);
    console.log(`FIXTURE SET: ${key}`);
    const txtStatus = set.txt ? set.txt : '(none — image-only fixture)';
    console.log(`  txt=${txtStatus}  images=${set.images.length}`);
    console.log(sep('═'));

    // ── 1. Text parse ──────────────────────────────────────────────────────────
    let textResult = null;
    if (set.txt) {
      const rawText = fs.readFileSync(path.join(FIXTURES_DIR, set.txt), 'utf8');
      const chars   = rawText.length;
      const isEmpty = rawText.trim() === '';
      console.log(`\n[TEXT PARSE]  file=${set.txt}  chars=${chars}  empty=${isEmpty}`);

      if (isEmpty) {
        console.log('  [no text] — empty .txt file, skipping parseBobby');
        summary.textParseNull++;
      } else {
        console.log(`  Preview: "${rawText.slice(0, 120).replace(/\n/g, ' ')}"`);
        textResult = parseBobby(rawText);
        if (!textResult) {
          console.log('  Result: null (parseBobby returned null — no prices found)');
          summary.textParseNull++;
        } else {
          console.log(`  Result: ok  bias=${textResult.bias}`);
          printArr('  king_nodes', textResult.king_nodes);
          printArr('  support   ', textResult.support);
          printArr('  resistance', textResult.resistance);
          if (textResult.bias_statement) {
            console.log(`  bias_statement: "${textResult.bias_statement}"`);
          }
          console.log(`  vix_mentioned: ${textResult.vix_mentioned}`);
          summary.textParseOk++;
        }
      }
    } else {
      console.log('\n[TEXT PARSE]  No .txt file — image-only fixture, skipping text parse');
      summary.textParseNull++;
    }

    // ── 2. Vision parse (one PNG per set) ─────────────────────────────────────
    let visionResult = null;
    for (const imgFile of set.images) {
      summary.visionCalls++;
      const imgPath = path.join(FIXTURES_DIR, imgFile);
      const buf     = fs.readFileSync(imgPath);
      const b64     = buf.toString('base64');
      const sizeKB  = (buf.length / 1024).toFixed(1);

      console.log(`\n[VISION PARSE]  file=${imgFile}  size=${sizeKB}KB`);

      let imgResult;
      try {
        imgResult = await parseBobbyImage(b64);
      } catch (err) {
        console.log(`  ERROR (uncaught): ${err.message}`);
        imgResult = { parse_status: 'failed', error: `uncaught: ${err.message}` };
      }

      if (!imgResult || imgResult.parse_status === 'failed') {
        summary.visionFailed++;
        console.log(`  Status: FAILED  error=${imgResult?.error || 'null result'}`);
      } else {
        summary.visionOk++;
        console.log(`  Status: ok`);
        console.log(`  tickers_detected: ${JSON.stringify(imgResult.tickers_detected)}`);
        console.log(`  bias: ${imgResult.bias}  trinity: ${imgResult.trinity}`);
        if (imgResult.notes) console.log(`  notes: "${imgResult.notes}"`);

        // G1/B-2: per-panel output with instrument attribution
        const panels = imgResult.panels || [];
        if (panels.length > 0) {
          console.log(`\n  Panels (${panels.length}):`);
          for (const p of panels) {
            console.log(`    ${p.ticker} (${p.instrument ?? 'skip'})  current_price=${p.current_price ?? 'null'}`);
            printArr(`      king_nodes`, p.king_nodes);
            printArr(`      support   `, p.support);
            printArr(`      resistance`, p.resistance);
          }
        } else {
          console.log('  Panels: (none)');
          printArr('  king_nodes (flat)', imgResult.king_nodes);
          printArr('  support    (flat)', imgResult.support);
          printArr('  resistance (flat)', imgResult.resistance);
        }
        if (imgResult.air_pockets?.length) printArr('  air_pockets', imgResult.air_pockets);
      }

      // Bobby has one image per fixture set — store for merge
      visionResult = imgResult;
    }

    // ── 3. Merge ───────────────────────────────────────────────────────────────
    console.log(`\n[MERGE]`);
    const visionForMerge = (visionResult && visionResult.parse_status !== 'failed') ? visionResult : null;
    const merged = mergeBobby(textResult, visionForMerge);

    if (!merged) {
      console.log('  merged: null (both text and vision were null/failed)');
    } else {
      console.log(`  source: ${merged.source}  bias: ${merged.bias}`);
      if (merged.bias_statement) console.log(`  bias_statement: "${merged.bias_statement}"`);
      if (merged.tickers_detected?.length) {
        console.log(`  tickers_detected: ${JSON.stringify(merged.tickers_detected)}`);
      }

      // G1/B-2: show panels in merge output
      const mergedPanels = merged.panels || [];
      if (mergedPanels.length > 0) {
        console.log(`\n  Merged panels (${mergedPanels.length}):`);
        for (const p of mergedPanels) {
          console.log(`    ${p.ticker} (${p.instrument ?? 'skip'})  current_price=${p.current_price ?? 'null'}`);
          printArr(`      king_nodes`, p.king_nodes);
          printArr(`      support   `, p.support);
          printArr(`      resistance`, p.resistance);
        }
      }

      console.log('\n  Legacy flat arrays (backward compat):');
      printArr('  king_nodes', merged.king_nodes);
      printArr('  support   ', merged.support);
      printArr('  resistance', merged.resistance);
      if (merged.notes)           console.log(`  notes: "${merged.notes}"`);
      if (merged.tickers_detected?.length) {}

      summary.kingNodesTotal += (merged.king_nodes || []).length;
      summary.supportTotal   += (merged.support    || []).length;
      summary.resistTotal    += (merged.resistance  || []).length;

      console.log('\n  Full merged JSON:');
      console.log(JSON.stringify(merged, null, 2));
    }

    summary.fixtures++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${sep('═')}`);
  console.log('VALIDATION SUMMARY');
  console.log(sep('═'));
  console.log(`Fixtures processed:    ${summary.fixtures}`);
  console.log(`Text parse ok:         ${summary.textParseOk}`);
  console.log(`Text parse null/empty: ${summary.textParseNull}`);
  console.log(`Vision calls made:     ${summary.visionCalls}`);
  console.log(`Vision calls ok:       ${summary.visionOk}`);
  console.log(`Vision calls failed:   ${summary.visionFailed}`);
  console.log(`King nodes total:      ${summary.kingNodesTotal}`);
  console.log(`Support levels total:  ${summary.supportTotal}`);
  console.log(`Resistance total:      ${summary.resistTotal}`);
  console.log(sep('═'));
}

main().catch(err => {
  console.error('\n[HARNESS FATAL]', err.message);
  console.error(err.stack);
  process.exit(1);
});
