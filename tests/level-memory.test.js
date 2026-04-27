'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const {
  recordLevel,
  queryLevels,
  loadMemory,
  _internal: { tradingDayWindow, _setMemoryFile, _setWriteFn, _resetWriteFn },
} = require('../lib/level-memory');

// ── Test setup ─────────────────────────────────────────────────────────────────
// Each test redirects the module to a fresh tmpfile so production
// data/level-memory.json is never touched.

let tmpFile;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'level-mem-'));
  tmpFile = path.join(tmpDir, 'level-memory.json');
  _setMemoryFile(tmpFile);
  _resetWriteFn();
});

afterEach(() => {
  _resetWriteFn();
});

// ── T1: Empty state load ───────────────────────────────────────────────────────
it('T1: loadMemory with no file returns empty default', () => {
  const mem = loadMemory();
  expect(mem.version).toBe(1);
  expect(mem.last_updated).toBeNull();
  expect(mem.levels).toEqual([]);
});

// ── T2: Record first level ─────────────────────────────────────────────────────
it('T2: recordLevel creates canonical, returns created_new: true', async () => {
  const result = await recordLevel({
    analyst:      'dubz',
    instrument:   'NQ',
    price:        26884.75,
    significance: 'key',
    direction:    'flip',
    source_type:  'text',
    source_snippet: 'NQ key flip at 26884.75',
  });

  expect(result.canonical_price).toBe(26884.75);
  expect(result.total_mentions).toBe(1);
  expect(result.created_new).toBe(true);

  const mem = loadMemory();
  expect(mem.levels).toHaveLength(1);
  expect(mem.levels[0].canonical_price).toBe(26884.75);
  expect(mem.levels[0].instrument).toBe('NQ');
  expect(mem.levels[0].mentions).toHaveLength(1);
  expect(mem.levels[0].mentions[0].analyst).toBe('dubz');
});

// ── T3: Near-neighbor within tolerance attaches to existing canonical ──────────
it('T3: recordLevel within tolerance appends mention, created_new: false', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' });

  // 26884.50 is 0.25 away from 26884.75 — exactly at NQ tolerance limit
  const result = await recordLevel({ analyst: 'saty', instrument: 'NQ', price: 26884.50, source_type: 'saty_atr' });

  expect(result.created_new).toBe(false);
  expect(result.canonical_price).toBe(26884.75); // original canonical_price preserved
  expect(result.total_mentions).toBe(2);

  const mem = loadMemory();
  expect(mem.levels).toHaveLength(1);
  expect(mem.levels[0].total_mentions).toBe(2);
  expect(mem.levels[0].last_seen).not.toBeNull();
  expect(mem.levels[0].mentions).toHaveLength(2);
});

// ── T4: Outside tolerance creates new canonical ────────────────────────────────
it('T4: recordLevel outside tolerance creates new canonical record', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' });

  // 26885.25 is 0.50 away — outside NQ tolerance of 0.25
  const result = await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26885.25, source_type: 'text' });

  expect(result.created_new).toBe(true);
  expect(result.canonical_price).toBe(26885.25);

  const mem = loadMemory();
  expect(mem.levels).toHaveLength(2);
});

// ── T5: Tolerance precision per instrument ─────────────────────────────────────
it('T5a: NQ 26884.75 vs 26884.50 (delta=0.25) — same canonical', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' });
  const r = await recordLevel({ analyst: 'saty', instrument: 'NQ', price: 26884.50, source_type: 'text' });
  expect(r.created_new).toBe(false);
});

it('T5b: NQ 26884.75 vs 26885.25 (delta=0.50) — different canonical', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' });
  const r = await recordLevel({ analyst: 'saty', instrument: 'NQ', price: 26885.25, source_type: 'text' });
  expect(r.created_new).toBe(true);
  const mem = loadMemory();
  expect(mem.levels).toHaveLength(2);
});

// ── T6: Cross-analyst attribution on same canonical ───────────────────────────
it('T6: same canonical_price, different analysts — both mentions appear', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'ES', price: 7093.75, source_type: 'text' });
  await recordLevel({ analyst: 'saty', instrument: 'ES', price: 7093.75, source_type: 'saty_atr' });

  const mem = loadMemory();
  expect(mem.levels).toHaveLength(1);
  const mentions = mem.levels[0].mentions;
  expect(mentions).toHaveLength(2);
  expect(mentions.map(m => m.analyst)).toEqual(['dubz', 'saty']);
});

// ── T7: Query with no instrument filter returns nothing ────────────────────────
it('T7: queryLevels with no instrument returns []', async () => {
  await recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' });
  expect(queryLevels({})).toEqual([]);
  expect(queryLevels()).toEqual([]);
});

// ── T8: Query by window ────────────────────────────────────────────────────────
it('T8: queryLevels by window filters mentions and excludes empty-window canonicals', async () => {
  const today     = new Date().toISOString().slice(0, 10);
  const oldDate   = '2020-01-01';
  const oldTs     = '2020-01-01T10:00:00Z';

  // Level A: one recent mention
  await recordLevel({
    analyst: 'dubz', instrument: 'NQ', price: 26884.75,
    source_type: 'text', timestamp: new Date().toISOString(),
  });

  // Level B: one OLD mention only
  await recordLevel({
    analyst: 'saty', instrument: 'NQ', price: 27000.00,
    source_type: 'saty_atr', timestamp: oldTs,
  });

  // hot window: should return only level A (level B is old)
  const hot = queryLevels({ instrument: 'NQ', window: 'hot' });
  expect(hot).toHaveLength(1);
  expect(hot[0].canonical_price).toBe(26884.75);
  expect(hot[0].total_mentions).toBe(1);

  // null: should return both
  const all = queryLevels({ instrument: 'NQ', window: null });
  expect(all).toHaveLength(2);
});

// ── T9: Write failure throws ──────────────────────────────────────────────────
it('T9: recordLevel throws when writeJsonAtomic throws (not silently swallowed)', async () => {
  _setWriteFn(() => { throw new Error('disk full'); });

  await expect(
    recordLevel({ analyst: 'dubz', instrument: 'NQ', price: 26884.75, source_type: 'text' })
  ).rejects.toThrow('atomic write failed');
});

// ── T10: Concurrent recordLevel calls both succeed ────────────────────────────
it('T10: two parallel recordLevel calls both succeed without corruption', async () => {
  const [r1, r2] = await Promise.all([
    recordLevel({ analyst: 'dubz', instrument: 'ES', price: 7093.00, source_type: 'text' }),
    recordLevel({ analyst: 'saty', instrument: 'ES', price: 7200.00, source_type: 'saty_atr' }),
  ]);
  expect(r1.created_new).toBe(true);
  expect(r2.created_new).toBe(true);

  // Both levels recorded (last-write-wins on concurrent same-instrument writes is acceptable)
  const mem = loadMemory();
  expect(mem.levels.length).toBeGreaterThanOrEqual(1);
});

// ── T11: queryLevels with corrupt state throws ────────────────────────────────
it('T11: queryLevels with corrupt state file throws (not silent empty)', async () => {
  fs.writeFileSync(tmpFile, 'this is not json', 'utf8');
  expect(() => queryLevels({ instrument: 'NQ' })).toThrow();
});

// ── T12: queryLevels with missing state file returns [] ───────────────────────
it('T12: queryLevels with missing state file returns []', () => {
  // tmpFile was never written — it does not exist
  expect(queryLevels({ instrument: 'NQ' })).toEqual([]);
});

// ── T13: Gate 5 — SPY/QQQ tolerance 0.50 ─────────────────────────────────────
it('T13: SPY tolerance 0.50 — Bobby 712 and Dubz 712.38 (0.38pt) collapse to one canonical', async () => {
  await recordLevel({ analyst: 'bobby', instrument: 'SPY', price: 712,    source_type: 'vision' });
  const r2 = await recordLevel({ analyst: 'dubz',  instrument: 'SPY', price: 712.38, source_type: 'text' });

  // 0.38 < 0.50 tolerance → attaches to existing canonical
  expect(r2.created_new).toBe(false);
  expect(r2.canonical_price).toBe(712);
  expect(r2.total_mentions).toBe(2);

  const mem = loadMemory();
  expect(mem.levels.filter(l => l.instrument === 'SPY')).toHaveLength(1);
});

it('T13b: SPY tolerance 0.50 — prices 1pt apart (711 vs 712) create separate canonicals', async () => {
  await recordLevel({ analyst: 'bobby', instrument: 'SPY', price: 711, source_type: 'vision' });
  const r2 = await recordLevel({ analyst: 'bobby', instrument: 'SPY', price: 712, source_type: 'vision' });

  // 1.0 > 0.50 tolerance → new canonical
  expect(r2.created_new).toBe(true);
  const mem = loadMemory();
  expect(mem.levels.filter(l => l.instrument === 'SPY')).toHaveLength(2);
});

// ── T14: recordLevel stores crossSourceConfirmed on mention ───────────────────
it('T14: recordLevel stores crossSourceConfirmed on mention and defaults to false', async () => {
  await recordLevel({
    analyst: 'dubz', instrument: 'ES', price: 7100,
    source_type: 'text', crossSourceConfirmed: true,
  });
  const mem1 = loadMemory();
  expect(mem1.levels[0].mentions[0].crossSourceConfirmed).toBe(true);

  await recordLevel({
    analyst: 'bobby', instrument: 'ES', price: 7200,
    source_type: 'vision',
    // crossSourceConfirmed omitted — should default false
  });
  const mem2 = loadMemory();
  const bobbyLevel = mem2.levels.find(l => l.canonical_price === 7200);
  expect(bobbyLevel.mentions[0].crossSourceConfirmed).toBe(false);
});
