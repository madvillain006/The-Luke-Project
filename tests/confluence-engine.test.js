'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  scoreLevel,
  queryLevelsAcrossEquivalents,
  buildVerdictMarkdown,
  INSTRUMENT_EQUIVALENCE,
  _internal: {
    withinTradingDays,
    gradeFromScore,
    buildAnalystSummaryString,
    _setQueryLevels,
    _resetQueryLevels,
  },
} = require('../lib/confluence-engine');
const { recordLevel, _internal: { _setMemoryFile, _resetWriteFn } } = require('../lib/level-memory');

const DEFAULT_MEMORY_FILE = path.join(__dirname, '../data/level-memory.json');

// ── Timestamp helpers ──────────────────────────────────────────────────────────

// Within the last 5 trading days
const RECENT = new Date().toISOString();

// 30 calendar days ago — well outside any 5-trading-day window
const OLD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

// ── Mention factory ────────────────────────────────────────────────────────────

function mention(analyst, significance, direction, sourceType = 'text', timestamp = RECENT, extra = {}) {
  return { analyst, significance, direction, source_type: sourceType, timestamp, ...extra };
}

function record(canonicalPrice, instrument, mentionList) {
  return {
    canonical_price: canonicalPrice,
    instrument,
    first_seen: mentionList[0]?.timestamp || RECENT,
    last_seen:  mentionList[0]?.timestamp || RECENT,
    total_mentions: mentionList.length,
    mentions: mentionList,
  };
}

afterEach(() => {
  _resetQueryLevels();
  _setMemoryFile(DEFAULT_MEMORY_FILE);
  _resetWriteFn();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 1 — scoreLevel tests (T1–T12)
// ═══════════════════════════════════════════════════════════════════════════════

// T1: empty mentions → grade F, score 0
it('T1: empty mentions → grade F, score 0', () => {
  const r = scoreLevel(record(5000, 'ES', []));
  expect(r.score).toBe(0);
  expect(r.grade).toBe('F');
  expect(r.breakdown.raw_total).toBe(0);
});

// T2: single Bobby vision mention → grade C or D depending on significance
it('T2: single Bobby vision mention → grade C-D depending on significance', () => {
  // Unclear significance → 1 analyst (0.20), no recency bonus (OLD) → 0.20 → D
  const dResult = scoreLevel(record(5000, 'SPX', [
    mention('bobby', 'unclear', 'support', 'vision', OLD),
  ]));
  expect(dResult.grade).toBe('D');
  expect(dResult.score).toBeCloseTo(0.20, 5);

  // Key significance → 1 analyst (0.20) + key (0.15), OLD → 0.35 → C
  const cResult = scoreLevel(record(5000, 'SPX', [
    mention('bobby', 'key', 'support', 'vision', OLD),
  ]));
  expect(cResult.grade).toBe('C');
  expect(cResult.score).toBeCloseTo(0.35, 5);
});

// T3: Dubz key+flip + Saty ATR → grade B
it('T3: dubz key+flip + saty ATR → grade B', () => {
  const r = scoreLevel(record(26884.75, 'NQ', [
    mention('dubz', 'key', 'flip', 'text', RECENT),
    mention('saty', 'unclear', null, 'saty_atr', RECENT),
  ]));
  // 2 analysts (0.40) + key (0.15) + recent (0.10) = 0.65 → B
  expect(r.grade).toBe('B');
  expect(r.score).toBeCloseTo(0.65, 5);
});

// T4: Dubz key + Bobby vision-confirmed + Saty → grade A
it('T4: dubz key + bobby vision-confirmed + saty → grade A', () => {
  const r = scoreLevel(record(26884.75, 'NQ', [
    mention('dubz', 'key', 'flip', 'text', RECENT, { crossSourceConfirmed: true }),
    mention('bobby', 'unclear', 'support', 'vision', RECENT),
    mention('saty', 'unclear', null, 'saty_atr', RECENT),
  ]));
  // 3 analysts (0.60) + key (0.15) + crossSource (0.15) + recent (0.10) = 1.00 → A (capped)
  expect(r.grade).toBe('A');
  expect(r.score).toBeCloseTo(1.0, 5);
  expect(r.breakdown.capped_at_1).toBe(true);
});

// T5: King node alone distinguishable from directional level with same analyst count.
// Uses OLD timestamps to avoid recency dependency — tests the king_node_contribution (0.10)
// in isolation. Both levels have the same analyst count; king gets the extra boost.
it('T5: king node produces higher score than directional level with same analyst count', () => {
  // King node: bobby + key + direction:null → +0.10 king_node_contribution
  const kingResult = scoreLevel(record(5000, 'SPX', [
    mention('bobby', 'key', null, 'text', OLD),
  ]));
  // 1 analyst (0.20) + key (0.15) + king (0.10) = 0.45 → C

  // Directional: bobby + key + direction:'support' → no king boost
  const dirResult = scoreLevel(record(5000, 'SPX', [
    mention('bobby', 'key', 'support', 'text', OLD),
  ]));
  // 1 analyst (0.20) + key (0.15) = 0.35 → C

  // King node adds a separate +0.10 dimension that directional doesn't get
  expect(kingResult.score).toBeGreaterThan(dirResult.score);
  expect(kingResult.score - dirResult.score).toBeCloseTo(0.10, 5);

  // Both are grade C with old timestamps — distinguishable by score, not grade
  expect(kingResult.grade).toBe('C');
  expect(dirResult.grade).toBe('C');

  // King node flag appears on king record only
  expect(kingResult.flags.some(f => f.type === 'king_node')).toBe(true);
  expect(dirResult.flags.some(f => f.type === 'king_node')).toBe(false);
});

// T6: crossSourceConfirmed adds expected weight (+0.15)
it('T6: crossSourceConfirmed adds +0.15 weight to score', () => {
  const base = [mention('dubz', 'key', 'flip', 'text', RECENT)];
  const withConf = [mention('dubz', 'key', 'flip', 'text', RECENT, { crossSourceConfirmed: true })];

  const without = scoreLevel(record(7000, 'ES', base));
  const withIt  = scoreLevel(record(7000, 'ES', withConf));

  // without: 0.20 + 0.15 + 0.10 = 0.45 → C
  // with:    0.20 + 0.15 + 0.15 + 0.10 = 0.60 → B
  expect(withIt.score - without.score).toBeCloseTo(0.15, 5);
  expect(without.grade).toBe('C');
  expect(withIt.grade).toBe('B');
});

// T7: Stale level (>5% from currentPrice) gets stale flag; score is unaffected
it('T7: stale level flag fires without changing score', () => {
  const mentions = [mention('dubz', 'key', 'flip', 'text', RECENT)];

  // No staleness check
  const noPrice = scoreLevel(record(26884, 'NQ', mentions));

  // currentPrice 20000 → 26884 is (26884-20000)/20000 = 34% away → stale
  const withPrice = scoreLevel(record(26884, 'NQ', mentions), { currentPrice: 20000 });

  expect(withPrice.score).toBeCloseTo(noPrice.score, 5);
  expect(withPrice.flags.some(f => f.type === 'stale')).toBe(true);
  expect(noPrice.flags.some(f => f.type === 'stale')).toBe(false);
  expect(withPrice.flags.find(f => f.type === 'stale').detail).toMatch(/5%/);
});

// T8: Vision disagreement detected from mention metadata produces flag
it('T8: dubz text + image mentions without crossSourceConfirmed → vision_disagreement flag', () => {
  const r = scoreLevel(record(7185.75, 'ES', [
    mention('dubz', 'key', 'flip', 'text', RECENT),
    mention('dubz', 'unclear', 'resistance', 'image', RECENT),
  ]));

  const vdFlag = r.flags.find(f => f.type === 'vision_disagreement');
  expect(vdFlag).toBeDefined();
  expect(vdFlag.detail).toBeTruthy();

  // When crossSourceConfirmed is true, the flag must NOT fire
  const confirmedR = scoreLevel(record(7185.75, 'ES', [
    mention('dubz', 'key', 'flip', 'text', RECENT, { crossSourceConfirmed: true }),
    mention('dubz', 'unclear', 'resistance', 'image', RECENT),
  ]));
  expect(confirmedR.flags.some(f => f.type === 'vision_disagreement')).toBe(false);
});

// T9: Recency bonus fires only for mentions within 5 trading days
it('T9: recency bonus +0.10 fires for recent mentions but not for old ones', () => {
  const oldMentions    = [mention('dubz', 'key', 'flip', 'text', OLD)];
  const recentMentions = [mention('dubz', 'key', 'flip', 'text', RECENT)];

  const oldResult    = scoreLevel(record(7000, 'ES', oldMentions));
  const recentResult = scoreLevel(record(7000, 'ES', recentMentions));

  // Old: 0.20 + 0.15 = 0.35 | Recent: 0.20 + 0.15 + 0.10 = 0.45
  expect(recentResult.score - oldResult.score).toBeCloseTo(0.10, 5);
  expect(oldResult.breakdown.recency_contribution).toBe(0);
  expect(recentResult.breakdown.recency_contribution).toBe(0.10);
});

// T10: Capping at 1.0 works for high-confluence cases
it('T10: score caps at 1.0 and capped_at_1 flag set', () => {
  // 4 analysts (0.80) + key (0.15) + king (0.10) + crossSource (0.15) + recent (0.10) = 1.30
  const r = scoreLevel(record(5000, 'SPX', [
    mention('dubz',   'key',     'flip',    'text',     RECENT, { crossSourceConfirmed: true }),
    mention('bobby',  'key',     null,      'vision',   RECENT),
    mention('saty',   'unclear', null,      'saty_atr', RECENT),
    mention('custom', 'unclear', 'support', 'text',     RECENT),
  ]));

  expect(r.score).toBeCloseTo(1.0, 5);
  expect(r.grade).toBe('A');
  expect(r.breakdown.capped_at_1).toBe(true);
  expect(r.breakdown.raw_total).toBeGreaterThan(1.0);
});

// T11: Grade threshold boundaries (0.70 → B, 0.75 → A)
it('T11: grade threshold at 0.75 boundary — below is B, at boundary is A', () => {
  // 3 analysts (0.60) + recent (0.10) = 0.70 → B (below A threshold of 0.75)
  const belowA = scoreLevel(record(5000, 'SPX', [
    mention('dubz',  'unclear', null, 'text',     RECENT),
    mention('bobby', 'unclear', null, 'text',     RECENT),
    mention('saty',  'unclear', null, 'saty_atr', RECENT),
  ]));
  expect(belowA.score).toBeCloseTo(0.70, 5);
  expect(belowA.grade).toBe('B');

  // 3 analysts (0.60) + key (0.15) = 0.75 → A (at threshold, no recency)
  const atA = scoreLevel(record(5000, 'SPX', [
    mention('dubz',  'key',     'flip', 'text',     OLD),
    mention('bobby', 'unclear', null,   'text',     OLD),
    mention('saty',  'unclear', null,   'saty_atr', OLD),
  ]));
  expect(atA.score).toBeCloseTo(0.75, 5);
  expect(atA.grade).toBe('A');

  // Verify gradeFromScore directly at the boundary
  expect(gradeFromScore(0.7499)).toBe('B');
  expect(gradeFromScore(0.75)).toBe('A');
});

// T12: Breakdown sums correctly to raw_total
it('T12: breakdown components sum to raw_total', () => {
  const r = scoreLevel(record(7093.75, 'ES', [
    mention('dubz', 'key',     'flip', 'text',     RECENT, { crossSourceConfirmed: true }),
    mention('saty', 'unclear', null,   'saty_atr', RECENT),
  ]));

  const { breakdown } = r;
  const sum =
    breakdown.distinct_analysts_contribution +
    breakdown.key_significance_contribution +
    breakdown.king_node_contribution +
    breakdown.cross_source_contribution +
    breakdown.recency_contribution;

  expect(sum).toBeCloseTo(breakdown.raw_total, 10);
  // Also verify final_score matches breakdown
  expect(breakdown.final_score).toBeCloseTo(r.score, 10);
  expect(breakdown.final_grade).toBe(r.grade);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 2 — Cross-instrument equivalence tests (T13–T16)
// ═══════════════════════════════════════════════════════════════════════════════

// T13: ES query returns levels from SPX with prices basis-adjusted (Gate 4 fix: basis +30)
it('T13: ES query returns SPX levels with prices basis-adjusted (SPX + (+30))', () => {
  const spxRecord = record(5100, 'SPX', [
    mention('bobby', 'key', null, 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'SPX' ? [spxRecord] : []);

  const results = queryLevelsAcrossEquivalents('ES');
  expect(results).toHaveLength(1);

  const equiv = results[0];
  // SPX 5100 converted to ES: 5100 + basis(+30) = 5130
  expect(equiv.canonical_price).toBeCloseTo(5130, 4);
  expect(equiv.instrument).toBe('ES');
});

// T13b: SPX query returns ES levels with prices basis-adjusted (basis −30)
it('T13b: SPX query returns ES levels with prices basis-adjusted (ES + (-30))', () => {
  const esRecord = record(5130, 'ES', [
    mention('dubz', 'key', 'flip', 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'ES' ? [esRecord] : []);

  const results = queryLevelsAcrossEquivalents('SPX');
  expect(results).toHaveLength(1);

  const equiv = results[0];
  // ES 5130 converted to SPX: 5130 + basis(-30) = 5100
  expect(equiv.canonical_price).toBeCloseTo(5100, 4);
  expect(equiv.instrument).toBe('SPX');
});

// T13c: production scenario — SPX Saty 7028 surfaces as ES 7058 (not 6998)
it('T13c: production scenario — SPX 7028 surfaces as ES 7058 (not 6998)', () => {
  const spxRecord = record(7028, 'SPX', [
    mention('saty', 'key', null, 'saty_atr', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'SPX' ? [spxRecord] : []);

  const results = queryLevelsAcrossEquivalents('ES');
  expect(results).toHaveLength(1);
  // ES = SPX + 30: 7028 + 30 = 7058, NOT 6998
  expect(results[0].canonical_price).toBeCloseTo(7058, 4);
});

// T14: Levels in primary instrument carry cross_instrument_origin: null
it('T14: native levels carry cross_instrument_origin: null', () => {
  const esRecord = record(7093.75, 'ES', [
    mention('dubz', 'key', 'flip', 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'ES' ? [esRecord] : []);

  const results = queryLevelsAcrossEquivalents('ES');
  const native = results.find(r => r.canonical_price === 7093.75);
  expect(native).toBeDefined();
  expect(native.cross_instrument_origin).toBeNull();
});

// T15: Levels from equivalent carry cross_instrument_origin with instrument + original_price
it('T15: equivalent levels carry cross_instrument_origin with source details', () => {
  const spxRecord = record(5100, 'SPX', [
    mention('bobby', 'key', null, 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'SPX' ? [spxRecord] : []);

  const results = queryLevelsAcrossEquivalents('ES');
  const equiv = results.find(r => r.cross_instrument_origin != null);
  expect(equiv).toBeDefined();
  expect(equiv.cross_instrument_origin.instrument).toBe('SPX');
  expect(equiv.cross_instrument_origin.original_price).toBe(5100);
});

// T16: SPY has no equivalents → behaves like queryLevels
it('T16: SPY has no equivalents — result equals queryLevels output (with null origin)', () => {
  const spyRecord = record(560, 'SPY', [
    mention('dubz', 'key', 'support', 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'SPY' ? [spyRecord] : []);

  const results = queryLevelsAcrossEquivalents('SPY');
  expect(results).toHaveLength(1);
  expect(results[0].canonical_price).toBe(560);
  expect(results[0].cross_instrument_origin).toBeNull();
  expect(INSTRUMENT_EQUIVALENCE.SPY.equivalents).toHaveLength(0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 3 — /verdict output tests (via buildVerdictMarkdown)
// ═══════════════════════════════════════════════════════════════════════════════

it('/verdict with empty Level Memory returns graceful message per instrument', () => {
  _setQueryLevels(() => []);

  const output = buildVerdictMarkdown(['NQ', 'ES', 'SPY'], { currentPrices: {}, topN: 5 });

  expect(output).toContain('## Confluence verdict');
  expect(output).toContain('### NQ');
  expect(output).toContain('### ES');
  expect(output).toContain('### SPY');
  // Every instrument section should say no levels
  const sections = output.split('###').slice(1); // skip header
  for (const section of sections) {
    expect(section).toContain('No levels recorded yet.');
  }
});

it('/verdict with mock Level Memory state produces expected output format', () => {
  const nqRecord = record(26884.75, 'NQ', [
    mention('dubz', 'key',     'flip', 'text',     RECENT),
    mention('saty', 'unclear', null,   'saty_atr', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'NQ' ? [nqRecord] : []);

  const output = buildVerdictMarkdown(['NQ'], { currentPrices: { NQ: 27000 }, topN: 5 });

  // Header present
  expect(output).toContain('## Confluence verdict');
  // Instrument section with current price
  expect(output).toContain('### NQ (current: 27000)');
  // Level line with bold format and grade
  expect(output).toContain('**NQ 26884.75**');
  expect(output).toContain('**B**'); // 2 analysts(0.40)+key(0.15)+recent(0.10)=0.65→B
  expect(output).toContain('(0.65)');
  // Analyst summary
  expect(output).toContain('2 analysts:');
  expect(output).toContain('dubz key+flip');
  expect(output).toContain('saty ATR');
});

it('/verdict ES includes SPX-equivalent levels in output', () => {
  const spxRecord = record(5100, 'SPX', [
    mention('bobby', 'key', null, 'text', RECENT),
  ]);

  _setQueryLevels(({ instrument }) => instrument === 'SPX' ? [spxRecord] : []);

  const output = buildVerdictMarkdown(['ES'], { currentPrices: {}, topN: 5 });

  // SPX 5100 normalized to ES: 5100 + basis(+30) = 5130
  expect(output).toContain('5130');
  // Should show king node flag
  expect(output).toContain('king node');
});

it('/verdict integrates with real level-memory records from a temp file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-mem-'));
  const tmpFile = path.join(dir, 'level-memory.json');
  _setMemoryFile(tmpFile);
  _resetWriteFn();

  await recordLevel({
    analyst: 'dubz',
    instrument: 'SPY',
    price: 712.38,
    significance: 'key',
    direction: 'flip',
    source_type: 'text',
    timestamp: RECENT,
    crossSourceConfirmed: true,
  });
  await recordLevel({
    analyst: 'bobby',
    instrument: 'SPY',
    price: 712.0,
    significance: 'key',
    direction: null,
    source_type: 'vision',
    timestamp: RECENT,
  });

  const output = buildVerdictMarkdown(['SPY'], { currentPrices: { SPY: 712.5 }, topN: 5 });

  expect(output).toContain('### SPY (current: 712.5)');
  expect(output).toContain('**SPY 712.38**');
  expect(output).toContain('**A**');
  expect(output).toContain('2 analysts: dubz key+flip, bobby vision');
  expect(output).toContain('king node');
});

// ── Additional coverage ────────────────────────────────────────────────────────

it('buildAnalystSummaryString formats single analyst as "X only"', () => {
  const s = buildAnalystSummaryString([
    mention('bobby', 'unclear', 'support', 'vision', RECENT),
  ]);
  expect(s).toBe('bobby vision only');
});

it('buildAnalystSummaryString formats multi-analyst correctly', () => {
  const s = buildAnalystSummaryString([
    mention('dubz', 'key', 'flip', 'text', RECENT),
    mention('saty', 'unclear', null, 'saty_atr', RECENT),
  ]);
  expect(s).toBe('2 analysts: dubz key+flip, saty ATR');
});

it('withinTradingDays returns true for today, false for 30-day-old timestamp', () => {
  expect(withinTradingDays(RECENT, 5)).toBe(true);
  expect(withinTradingDays(OLD, 5)).toBe(false);
});
