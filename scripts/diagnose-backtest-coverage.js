'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const DERIVED = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'derived');
const SESSION = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');

// ── helpers ──────────────────────────────────────────────────────────────────

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function isoToDateStr(iso) {
  // Extract YYYY-MM-DD from an ISO timestamp string
  return iso ? String(iso).slice(0, 10) : null;
}

// ── 1. Bobby parsed levels: derived/bobby-image-parses.jsonl ─────────────────

const bobbyParsesFile = path.join(DERIVED, 'bobby-image-parses.jsonl');
const bobbyParses     = readJsonl(bobbyParsesFile);

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  BOBBY PARSED LEVELS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Path : ${bobbyParsesFile}`);
console.log(`  Total entries (one per image parse): ${bobbyParses.length}`);

// Group by tradingDateET → sum levelCount
const bobbyByDate = {};
for (const entry of bobbyParses) {
  const date = isoToDateStr(entry.tradingDateET || entry.tradingDate);
  if (!date) continue;
  if (!bobbyByDate[date]) bobbyByDate[date] = { images: 0, levels: 0, parsed: 0, failed: 0 };
  bobbyByDate[date].images++;
  if (entry.parseStatus === 'ok' || entry.levelCount != null) {
    bobbyByDate[date].parsed++;
    bobbyByDate[date].levels += Number(entry.levelCount) || 0;
  }
  if (entry.parseStatus === 'failed' || entry.error) {
    bobbyByDate[date].failed++;
  }
}

const bobbyDates     = Object.keys(bobbyByDate).sort();
const bobbyWithLevels = bobbyDates.filter(d => bobbyByDate[d].levels > 0);
const bobbyEmpty      = bobbyDates.filter(d => bobbyByDate[d].levels === 0);

console.log(`  Total distinct trading dates: ${bobbyDates.length}`);
console.log(`  Dates with populated levels (count > 0): ${bobbyWithLevels.length}`);
console.log(`  Dates with zero parsed levels: ${bobbyEmpty.length}`);
console.log('');
console.log('  Per-date detail (sorted):');
console.log('  date         images  parsed  failed  levels');
console.log('  ----------   ------  ------  ------  ------');
for (const d of bobbyDates) {
  const { images, parsed, failed, levels } = bobbyByDate[d];
  const flag = levels > 0 ? '' : ' ← ZERO LEVELS';
  console.log(`  ${d}      ${String(images).padStart(4)}    ${String(parsed).padStart(4)}    ${String(failed).padStart(4)}    ${String(levels).padStart(4)}${flag}`);
}

// ── 2. Mancini parsed levels: session files ───────────────────────────────────

const sessionFiles = fs.readdirSync(SESSION)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  MANCINI PARSED LEVELS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Path : ${SESSION}`);
console.log(`  Total session files: ${sessionFiles.length}`);

const manciniByDate = {};
for (const fname of sessionFiles) {
  const date = fname.replace('.json', '');
  const sess = JSON.parse(fs.readFileSync(path.join(SESSION, fname), 'utf8'));
  const mancini = sess.mancini || {};
  const posts   = mancini.posts || [];
  // Count total levels extracted from all mancini posts for this session
  let levelCount = 0;
  for (const post of posts) {
    levelCount += Array.isArray(post.levels) ? post.levels.length : 0;
  }
  // Also count from flat sess.levels with source=mancini (may differ from above)
  const flatManciniLevels = (sess.levels || []).filter(l => String(l.source || '').toLowerCase().includes('mancini')).length;

  manciniByDate[date] = {
    posts:              posts.length,
    entryReady:         (mancini.counts || {}).entryReady || 0,
    levelsFromPosts:    levelCount,
    levelsInFlatArray:  flatManciniLevels,
  };
}

const manciniDates      = Object.keys(manciniByDate).sort();
const manciniWithLevels = manciniDates.filter(d => manciniByDate[d].levelsInFlatArray > 0);
const manciniEmpty      = manciniDates.filter(d => manciniByDate[d].levelsInFlatArray === 0);

console.log(`  Total distinct trading dates: ${manciniDates.length}`);
console.log(`  Dates with populated levels in flat array (count > 0): ${manciniWithLevels.length}`);
console.log(`  Dates with zero Mancini levels in flat array: ${manciniEmpty.length}`);
console.log('');
console.log('  Per-date detail (sorted):');
console.log('  date         posts  entryRdy  levFromPosts  levFlat');
console.log('  ----------   -----  --------  ------------  -------');
for (const d of manciniDates) {
  const { posts, entryReady, levelsFromPosts, levelsInFlatArray } = manciniByDate[d];
  const flag = levelsInFlatArray > 0 ? '' : ' ← ZERO LEVELS';
  console.log(`  ${d}      ${String(posts).padStart(3)}      ${String(entryReady).padStart(4)}          ${String(levelsFromPosts).padStart(5)}         ${String(levelsInFlatArray).padStart(4)}${flag}`);
}

// ── 3. Intersection: both Bobby AND Mancini have levels ───────────────────────

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  INTERSECTION: dates where BOTH have populated levels');
console.log('═══════════════════════════════════════════════════════════════');

const bobbySet   = new Set(bobbyWithLevels);
const manciniSet = new Set(manciniWithLevels);

const intersection = [...bobbySet].filter(d => manciniSet.has(d)).sort();
const bobbyOnly    = [...bobbySet].filter(d => !manciniSet.has(d)).sort();
const manciniOnly  = [...manciniSet].filter(d => !bobbySet.has(d)).sort();

console.log(`  Intersection count: ${intersection.length}`);
if (intersection.length > 0) {
  console.log(`  Earliest: ${intersection[0]}`);
  console.log(`  Latest:   ${intersection[intersection.length - 1]}`);
  console.log(`  Dates: ${intersection.join(', ')}`);
}

// ── 4. Bobby dates with NO matching Mancini ───────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  BOBBY dates (with levels) that have NO Mancini levels');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Count: ${bobbyOnly.length}`);
if (bobbyOnly.length > 0) {
  console.log(`  Dates: ${bobbyOnly.join(', ')}`);
} else {
  console.log('  (none)');
}

// ── 5. Mancini dates with NO matching Bobby ───────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  MANCINI dates (with levels) that have NO Bobby levels');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Count: ${manciniOnly.length}`);
if (manciniOnly.length > 0) {
  console.log(`  Dates: ${manciniOnly.join(', ')}`);
} else {
  console.log('  (none)');
}

// ── 6. Summary ────────────────────────────────────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Bobby dates with any levels    : ${bobbyWithLevels.length}`);
console.log(`  Mancini dates with any levels  : ${manciniWithLevels.length}`);
console.log(`  Intersection (both non-empty)  : ${intersection.length}`);
console.log(`  Bobby-only (no Mancini)        : ${bobbyOnly.length}`);
console.log(`  Mancini-only (no Bobby)        : ${manciniOnly.length}`);
console.log('');
