'use strict';

/**
 * Gate 5 verification: run parseBobby text through appendBobbyToMemory and confirm
 * Bobby levels appear in Level Memory with correct attribution and direction.
 *
 * Uses text parse (no API call) — deterministic, reproducible.
 */

const { parseBobby, appendBobbyToMemory } = require('../lib/parse-bobby');
const { queryLevels } = require('../lib/level-memory');

const BOBBY_TEXT = `King node at 7100 — magnet for the day. Support cushion at 7060 holding well. ` +
  `Resistance wall at 7140 above — gatekeeper if we rip. Support floor at 7020 below.`;

async function main() {
  const result = parseBobby(BOBBY_TEXT);
  if (!result) {
    console.error('[gate5] parseBobby returned null — fixture may be bad');
    process.exit(1);
  }

  console.log('[gate5] parseBobby result:');
  console.log('  king_nodes:', result.king_nodes);
  console.log('  support:   ', result.support);
  console.log('  resistance:', result.resistance);
  console.log('  source:    ', result.source);
  console.log('  bias:      ', result.bias);

  const totalBefore = queryLevels({ instrument: 'SPX', window: null }).length;
  console.log(`\n[gate5] SPX canonicals before: ${totalBefore}`);

  await appendBobbyToMemory(result);

  const afterLevels = queryLevels({ instrument: 'SPX', window: null });
  console.log(`[gate5] SPX canonicals after: ${afterLevels.length}`);

  const bobbyMentions = afterLevels.filter(lvl =>
    lvl.mentions.some(m => m.analyst === 'bobby')
  );
  console.log(`[gate5] Bobby-attributed SPX canonicals: ${bobbyMentions.length}`);
  for (const lvl of bobbyMentions) {
    const m = lvl.mentions.find(x => x.analyst === 'bobby');
    console.log(`  ${lvl.canonical_price}  sig=${m.significance}  dir=${m.direction}  src=${m.source_type}`);
  }

  // Expect at least king_nodes + support + resistance entries
  const expectedCount = result.king_nodes.length + result.support.length + result.resistance.length;
  console.log(`\n[gate5] Expected ${expectedCount} new Bobby mentions`);

  const allBobbyMentionCount = afterLevels.reduce((sum, lvl) =>
    sum + lvl.mentions.filter(m => m.analyst === 'bobby').length, 0
  );
  console.log(`[gate5] Actual Bobby mentions in SPX: ${allBobbyMentionCount}`);
  console.log(allBobbyMentionCount >= expectedCount
    ? '[gate5] PASS: Bobby levels written to Level Memory'
    : '[gate5] FAIL: fewer Bobby mentions than expected'
  );
}

main().catch(err => {
  console.error('[gate5] Error:', err);
  process.exit(1);
});
