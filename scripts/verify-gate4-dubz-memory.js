'use strict';

/**
 * Gate 4 verification: run golden fixture through parseDubzText → mergeDubzInputs →
 * appendDubzToMemory and confirm Level Memory ends up with the expected 5 Dubz levels
 * plus the 13 Saty levels already present (18 total assuming no overlap).
 *
 * One-shot script — not part of the regular pipeline.
 */

const fs   = require('fs');
const path = require('path');

const { parseDubzText, mergeDubzInputs, appendDubzToMemory } = require('../lib/parse-dubz');
const { queryLevels } = require('../lib/level-memory');

const FIXTURE = path.join(__dirname, '../fixtures/dubz/2026-04-26_0917_dubz.txt');

async function main() {
  const rawText = fs.readFileSync(FIXTURE, 'utf8');
  console.log('[gate4] Fixture loaded, length:', rawText.length);

  const textResult = parseDubzText(rawText, null);
  console.log('[gate4] parseDubzText errors:', textResult.parse_errors);

  const date  = '2026-04-26';
  const paste = { timestamp: new Date().toISOString(), input_type: 'text', raw_text: rawText, image_count: 0 };
  // Fresh state (no existing dubz state) so we get a clean merge
  const newState = mergeDubzInputs(textResult, [], null, date, paste);

  console.log('\n[gate4] Merged Dubz levels:');
  for (const [instr, data] of Object.entries(newState.instruments)) {
    for (const lvl of data.levels) {
      console.log(`  ${instr} ${lvl.price}  sig=${lvl.significance}  dir=${lvl.direction}`);
    }
  }

  const EXPECTED = [
    { instrument: 'NQ',  price: 26884.75 },
    { instrument: 'ES',  price: 7093.75  },
    { instrument: 'QQQ', price: 650      },
    { instrument: 'SPY', price: 698.34   },
    { instrument: 'SPY', price: 702.65   },
  ];

  console.log('\n[gate4] Expected level check (pre-memory):');
  let allPresent = true;
  for (const exp of EXPECTED) {
    const found = newState.instruments[exp.instrument]?.levels.some(
      l => Math.abs(l.price - exp.price) < 0.01
    );
    console.log(found ? '  PASS' : '  FAIL', `${exp.instrument} ${exp.price}`);
    if (!found) allPresent = false;
  }
  if (!allPresent) {
    console.error('[gate4] One or more expected levels missing from Dubz state — aborting');
    process.exit(1);
  }

  console.log('\n[gate4] Appending to Level Memory...');
  await appendDubzToMemory(newState);

  if (newState.parse_errors.length > 0) {
    console.warn('[gate4] parse_errors after append:', newState.parse_errors);
  }

  console.log('\n[gate4] Level Memory state by instrument:');
  for (const instr of ['NQ', 'ES', 'QQQ', 'SPY', 'SPX']) {
    const levels = queryLevels({ instrument: instr, window: null });
    console.log(`  ${instr}: ${levels.length} canonical(s)`);
    for (const lvl of levels) {
      const analysts = [...new Set(lvl.mentions.map(m => m.analyst))].join(', ');
      console.log(`    ${lvl.canonical_price}  total_mentions=${lvl.total_mentions}  analysts=[${analysts}]`);
    }
  }

  const totalAll = ['NQ', 'ES', 'QQQ', 'SPY', 'SPX'].reduce(
    (sum, instr) => sum + queryLevels({ instrument: instr, window: null }).length, 0
  );
  console.log(`\n[gate4] Total canonical records across all instruments: ${totalAll}`);
  console.log(totalAll === 18 ? '[gate4] PASS: 18 total canonicals' : `[gate4] WARN: expected 18, got ${totalAll}`);
}

main().catch(err => {
  console.error('[gate4] Error:', err);
  process.exit(1);
});
