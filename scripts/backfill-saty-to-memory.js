'use strict';

/**
 * One-shot backfill: reads data/saty-levels.json and appends all 13 ATR positions
 * to Level Memory as analyst: "saty" mentions with source_type: "saty_atr".
 *
 * Safe to re-run — each execution adds another set of saty_atr mentions (append-only).
 * Run it once after initial deployment. Check output before running again.
 */

const path = require('path');
const { readJsonFile } = require('../state/lib');
const { recordLevel, queryLevels } = require('../lib/level-memory');

const SATY_FILE = path.join(__dirname, '../data/saty-levels.json');

// Ordered map of saty-levels.json field → significance.
// ATR boundary levels are 'key'; everything between is 'unclear'.
const SATY_FIELDS = [
  { field: 'atr_plus_1',   significance: 'key'     },
  { field: 'ext_plus_4',   significance: 'unclear' },
  { field: 'ext_plus_3',   significance: 'unclear' },
  { field: 'ext_plus_2',   significance: 'unclear' },
  { field: 'ext_plus_1',   significance: 'unclear' },
  { field: 'call_trigger', significance: 'key'     },
  { field: 'prev_close',   significance: 'unclear' },
  { field: 'put_trigger',  significance: 'key'     },
  { field: 'ext_minus_1',  significance: 'unclear' },
  { field: 'ext_minus_2',  significance: 'unclear' },
  { field: 'ext_minus_3',  significance: 'unclear' },
  { field: 'ext_minus_4',  significance: 'unclear' },
  { field: 'atr_minus_1',  significance: 'key'     },
];

async function main() {
  let satyData;
  try {
    satyData = readJsonFile(SATY_FILE);
  } catch (err) {
    console.error(`[backfill-saty] Failed to read ${SATY_FILE}: ${err.message}`);
    process.exit(1);
  }

  if (!satyData.valid) {
    console.warn('[backfill-saty] saty-levels.json has valid: false - data may be out of date, proceeding anyway');
  }

  const timestamp = satyData.updated || new Date().toISOString();
  console.log(`[backfill-saty] Source timestamp: ${timestamp}`);

  let created = 0;
  let attached = 0;

  for (const { field, significance } of SATY_FIELDS) {
    const price = satyData[field];
    if (typeof price !== 'number') {
      console.warn(`[backfill-saty] Field "${field}" unavailable or non-numeric - skipping`);
      continue;
    }

    try {
      const result = await recordLevel({
        analyst:        'saty',
        instrument:     'SPX',
        price,
        significance,
        direction:      null,
        intent:         null,
        source_type:    'saty_atr',
        source_snippet: `ATR position: ${field}`,
        timestamp,
      });

      const tag = result.created_new ? 'NEW' : 'ATTACH';
      console.log(`  [${tag}] ${field} = ${price} (canonical: ${result.canonical_price}, mentions: ${result.total_mentions})`);
      if (result.created_new) created++; else attached++;
    } catch (err) {
      console.error(`  [ERROR] ${field} = ${price}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n[backfill-saty] Done. ${created} new canonicals, ${attached} attached to existing.`);

  const levels = queryLevels({ instrument: 'SPX', window: null });
  console.log(`[backfill-saty] queryLevels(SPX, null) → ${levels.length} canonical records`);
  for (const lvl of levels) {
    console.log(`  ${lvl.canonical_price}  mentions: ${lvl.total_mentions}`);
  }
}

main().catch(err => {
  console.error('[backfill-saty] Unexpected error:', err);
  process.exit(1);
});
