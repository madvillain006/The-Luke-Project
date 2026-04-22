'use strict';

// Test paste for Dubz parser bug fixes (BUG-A through BUG-D)
// Expected: NQ 26884.75 (resistance), NQ 26564.50 (support), ES 7093.75 (support), SPY 698.34 (watch)

const { extractRichydubzLevels } = require('../lib/slash-commands');

const PASTE = `1. 8:45 AM]RichyDubz [$OWL], :
NQ
2. [8:45 AM]RichyDubz [$OWL], :
QQQ
3. [8:45 AM]RichyDubz [$OWL], :
ES
4. [8:46 AM]RichyDubz [$OWL], :
SPY
5. [8:48 AM]RichyDubz [$OWL], :
@everyone I don't think I need to say anything today, perfect rejections marking HOD at 26,884.75 yesterday for another nice short opportunity with the first serious bounce coming in on the ES 7093.75 and the @XImEs PERFECT swing call entry off another retest of 7093.73 and more importantly __NQ 26,564.50__. These look gorgeous on a 5MN chart especially that volatile drop EOD that perfectly held to swing the calls We're in the same channel today and putting in another failure at 26,884.75 currently in the pre-market, and remember this level goes all the way back to October 2025. I'd still love an opportunity to long SPY 698.34 to load up on longer term calls.`;

const lines = PASTE.split('\n').map(l => l.trim()).filter(Boolean);

console.log('=== Lines fed to parser ===');
lines.forEach((l, i) => console.log(`  [${i}] ${l.slice(0, 100)}`));
console.log('');

const richyd_structured = [];
for (const l of lines) {
  const dubzLine = l.replace(/[_*]{2}/g, '');
  const hits = extractRichydubzLevels(dubzLine);
  if (hits.length) {
    console.log(`  matched: ${JSON.stringify(hits.map(h => h.ticker + ' ' + h.level))}`);
    richyd_structured.push(...hits);
  }
}

console.log('\n=== richyd_structured ===');
console.log(JSON.stringify(richyd_structured, null, 2));

const EXPECTED = [
  { ticker: 'NQ', level: 26884.75 },
  { ticker: 'ES', level: 7093.75 },
  { ticker: 'NQ', level: 26564.50 },
];

console.log('\n=== Coverage check ===');
let allFound = true;
for (const exp of EXPECTED) {
  const found = richyd_structured.some(r => r.ticker === exp.ticker && Math.abs(r.level - exp.level) < 0.01);
  console.log(found ? 'PASS' : 'FAIL', `${exp.ticker} ${exp.level}`);
  if (!found) allFound = false;
}
console.log(allFound ? '\nAll expected levels found.' : '\nSome levels MISSING.');
