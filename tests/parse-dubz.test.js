'use strict';

const { mergeDubzInputs } = require('../lib/parse-dubz');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTextResult(esLevels = [], otherInstrs = {}) {
  return {
    instruments: {
      NQ:  { levels: otherInstrs.NQ  || [] },
      ES:  { levels: esLevels },
      QQQ: { levels: otherInstrs.QQQ || [] },
      SPY: { levels: otherInstrs.SPY || [] },
    },
    parse_errors: [],
  };
}

function makeTextLevel(price, direction, significance = 'key') {
  return {
    price,
    significance,
    significance_signal: significance === 'key' ? 'language' : 'unstated',
    direction,
    intent:         null,
    source:         'text',
    source_snippet: `ES ${significance} ${direction} ${price}`,
  };
}

function makeImageResult(instrument, levels, zones = []) {
  return {
    instrument,
    current_price: null,
    levels,
    zones,
    parse_status: 'ok',
  };
}

const PASTE = { source: 'test', timestamp: '2026-04-27T00:00:00.000Z' };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('mergeDubzInputs – cross-source deduplication', () => {

  it('GATE 1: deduplicates same price across sources – text wins, crossSourceConfirmed true', () => {
    const textResult  = makeTextResult([makeTextLevel(7185.75, 'flip')]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7185.75, type: 'support', color: 'green' }]),
    ];

    const merged   = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    // Exactly one level at 7185.75
    expect(esLevels).toHaveLength(1);
    expect(esLevels[0].price).toBe(7185.75);

    // Text metadata wins
    expect(esLevels[0].direction).toBe('flip');
    expect(esLevels[0].significance).toBe('key');
    expect(esLevels[0].source).toBe('text');

    // Cross-source flag
    expect(esLevels[0].crossSourceConfirmed).toBe(true);
  });

  it('levels present in only one source get crossSourceConfirmed: false', () => {
    const textResult   = makeTextResult([makeTextLevel(7100.00, 'support')]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7300.00, type: 'resistance', color: 'red' }]),
    ];

    const merged   = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    expect(esLevels).toHaveLength(2);
    for (const lvl of esLevels) {
      expect(lvl.crossSourceConfirmed).toBe(false);
    }
  });

  it('every level in output has crossSourceConfirmed (no omissions)', () => {
    const textResult = makeTextResult(
      [makeTextLevel(7185.75, 'flip'), makeTextLevel(7050.00, 'support', 'minor')],
    );
    const imageResults = [
      makeImageResult('ES', [
        { price: 7185.75, type: 'support', color: 'green' },
        { price: 7400.00, type: 'resistance', color: 'red' },
      ]),
    ];

    const merged = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);

    for (const [, data] of Object.entries(merged.instruments)) {
      for (const lvl of data.levels) {
        expect(Object.prototype.hasOwnProperty.call(lvl, 'crossSourceConfirmed')).toBe(true);
      }
    }
  });

  it('fills null direction from image when text direction is null', () => {
    const textResult = makeTextResult([makeTextLevel(7185.75, null, 'unclear')]);
    // Patch: the helper always sets direction from arg — set it to null explicitly
    const textLvl = makeTextResult([]).instruments.ES.levels; // unused, just use direct obj
    const textResultDirect = makeTextResult([{
      price: 7185.75, significance: 'unclear', significance_signal: 'unstated',
      direction: null, intent: null, source: 'text', source_snippet: null,
    }]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7185.75, type: 'support', color: 'green' }]),
    ];

    const merged   = mergeDubzInputs(textResultDirect, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    expect(esLevels).toHaveLength(1);
    expect(esLevels[0].direction).toBe('support');
    expect(esLevels[0].crossSourceConfirmed).toBe(true);
  });

  it('does not overwrite populated text direction with image direction', () => {
    const textResult   = makeTextResult([makeTextLevel(7185.75, 'flip')]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7185.75, type: 'resistance', color: 'red' }]),
    ];

    const merged   = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    expect(esLevels).toHaveLength(1);
    expect(esLevels[0].direction).toBe('flip'); // text wins, not 'resistance'
    expect(esLevels[0].crossSourceConfirmed).toBe(true);
  });

  it('deduplicates within the 0.25-point tolerance window', () => {
    // Text: 7185.75, Image: 7185.75 — diff 0, within tolerance
    const textResult   = makeTextResult([makeTextLevel(7185.75, 'support')]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7186.00, type: 'support', color: 'green' }]),
    ];

    const merged   = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    // 7186.00 is 0.25 from 7185.75 — within tolerance, should be deduped
    expect(esLevels).toHaveLength(1);
    expect(esLevels[0].price).toBe(7185.75); // text price kept
    expect(esLevels[0].crossSourceConfirmed).toBe(true);
  });

  it('keeps levels beyond the 0.26-point gap as distinct entries', () => {
    const textResult   = makeTextResult([makeTextLevel(7185.75, 'support')]);
    const imageResults = [
      makeImageResult('ES', [{ price: 7186.01, type: 'support', color: 'green' }]),
    ];

    const merged   = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    // 0.26 apart — beyond tolerance, kept as separate levels
    expect(esLevels).toHaveLength(2);
    expect(esLevels.every(l => l.crossSourceConfirmed === false)).toBe(true);
  });

  it('handles image-only levels (no text result) with crossSourceConfirmed: false', () => {
    const imageResults = [
      makeImageResult('ES', [{ price: 7185.75, type: 'support', color: 'green' }]),
    ];

    const merged   = mergeDubzInputs(null, imageResults, null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    expect(esLevels).toHaveLength(1);
    expect(esLevels[0].crossSourceConfirmed).toBe(false);
  });

  it('handles text-only (no images) with crossSourceConfirmed: false on all levels', () => {
    const textResult = makeTextResult([
      makeTextLevel(7185.75, 'flip'),
      makeTextLevel(7050.00, 'support'),
    ]);

    const merged   = mergeDubzInputs(textResult, [], null, '2026-04-27', PASTE);
    const esLevels = merged.instruments.ES.levels;

    expect(esLevels).toHaveLength(2);
    expect(esLevels.every(l => l.crossSourceConfirmed === false)).toBe(true);
  });
});

// ── parseDubzText – compound attribution ───────────────────────────────────────

const { parseDubzText } = require('../lib/parse-dubz');

describe('parseDubzText – compound attribution', () => {

  // The exact sentence from fixtures/dubz/2026-04-27_0859_dubz.txt that
  // exposed the bug: ES was silently dropped because its window ended before
  // the prices appeared.
  const FIXTURE_SENTENCE =
    'Most importantly ES and SPY flipped 7185.75 & 712.38 in this pre-market ' +
    'this morning and currently pushing off those levels from last week. ' +
    'These were great spots to fade last week making this another significant ' +
    'flip you need to be aware of, these 2 levels will be key to managing the ' +
    'weekend puts swings off open for me too.';

  it('Pattern A: "A and B verbed X & Y" – each instrument gets its own price', () => {
    const result = parseDubzText(FIXTURE_SENTENCE);

    const esLvls  = result.instruments.ES.levels;
    const spyLvls = result.instruments.SPY.levels;

    // ES must get 7185.75 (in ES price range 3000-20000)
    expect(esLvls.length).toBeGreaterThanOrEqual(1);
    const esLevel = esLvls.find(l => Math.abs(l.price - 7185.75) < 0.01);
    expect(esLevel).toBeDefined();
    expect(esLevel.source).toBe('text');

    // SPY must get 712.38 (in SPY price range 100-1000)
    expect(spyLvls.length).toBeGreaterThanOrEqual(1);
    const spyLevel = spyLvls.find(l => Math.abs(l.price - 712.38) < 0.01);
    expect(spyLevel).toBeDefined();
    expect(spyLevel.source).toBe('text');
  });

  it('Pattern A: direction and significance from shared verb apply to ES level', () => {
    const result  = parseDubzText(FIXTURE_SENTENCE);
    const esLevel = result.instruments.ES.levels.find(l => Math.abs(l.price - 7185.75) < 0.01);

    expect(esLevel).toBeDefined();
    expect(esLevel.direction).toBe('flip');       // "flipped" triggers FLIP_RE
    expect(esLevel.significance).toBe('key');     // "significant flip" → key
  });

  it('Pattern A: ES does NOT receive the SPY-range price (712.38)', () => {
    const result  = parseDubzText(FIXTURE_SENTENCE);
    const esLvls  = result.instruments.ES.levels;
    const wrongLvl = esLvls.find(l => Math.abs(l.price - 712.38) < 0.01);
    expect(wrongLvl).toBeUndefined();
  });

  it('Pattern A: SPY does NOT receive the ES-range price (7185.75)', () => {
    const result  = parseDubzText(FIXTURE_SENTENCE);
    const spyLvls = result.instruments.SPY.levels;
    const wrongLvl = spyLvls.find(l => Math.abs(l.price - 7185.75) < 0.01);
    expect(wrongLvl).toBeUndefined();
  });

  it('Pattern B: "A and B key level at X" – both instruments get the shared price', () => {
    // QQQ range: 100-2000, SPY range: 100-1000 — 450 is valid for both
    const text   = 'QQQ and SPY key level at 450.';
    const result = parseDubzText(text);

    const qqqLvl = result.instruments.QQQ.levels.find(l => Math.abs(l.price - 450) < 0.01);
    const spyLvl = result.instruments.SPY.levels.find(l => Math.abs(l.price - 450) < 0.01);

    expect(qqqLvl).toBeDefined();
    expect(spyLvl).toBeDefined();
  });

  it('single-instrument attribution is unaffected by the fix', () => {
    const text   = 'ES key flip 7185.75 major level.';
    const result = parseDubzText(text);

    const esLvls = result.instruments.ES.levels;
    expect(esLvls.length).toBeGreaterThanOrEqual(1);
    const lvl = esLvls.find(l => Math.abs(l.price - 7185.75) < 0.01);
    expect(lvl).toBeDefined();
    expect(lvl.direction).toBe('flip');
  });

  it('non-connector gap between instruments does not trigger window extension', () => {
    // "ES 7093.75 major level QQQ 650" — "7093.75 major level" is not a connector
    // so QQQ should not receive ES-range prices.
    const text   = 'ES 7093.75 major level. QQQ 650 support zone.';
    const result = parseDubzText(text);

    const esLvls  = result.instruments.ES.levels;
    const qqqLvls = result.instruments.QQQ.levels;

    // ES gets 7093.75, not 650 (out of range anyway)
    expect(esLvls.find(l => Math.abs(l.price - 7093.75) < 0.01)).toBeDefined();
    // QQQ gets 650, not 7093.75 (out of range for QQQ too)
    expect(qqqLvls.find(l => Math.abs(l.price - 650) < 0.01)).toBeDefined();
  });
});

// ── Gate G5 (Dubz Bug #3): vision/text disagreement surfaces in parse_errors ──

describe('mergeDubzInputs – Gate G5: vision/text disagreement in parse_errors', () => {

  it('adds parse_error when vision and text disagree on ES level (rounding case)', () => {
    // ES: text=7185.75 (exact from Dubz commentary), vision=7190.00 (rounding artifact)
    // diff=4.25 > CROSS_TOL 0.25, so both survive; detectConflicts flags it.
    const textResult   = makeTextResult([makeTextLevel(7185.75, 'flip')]);
    const imageResults = [makeImageResult('ES', [{ price: 7190.00, type: 'resistance', color: 'red' }])];
    const merged = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);

    // Both levels survive (beyond cross-source dedup tolerance)
    const esLevels = merged.instruments.ES.levels;
    expect(esLevels).toHaveLength(2);

    // Conflict is detected structurally
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0].instrument).toBe('ES');
    expect(merged.conflicts[0].text_level).toBe(7185.75);
    expect(merged.conflicts[0].image_level).toBe(7190.00);

    // And surfaced in parse_errors for user-facing reply (G5)
    const conflictError = merged.parse_errors.find(e => e.includes('vision/text disagreement'));
    expect(conflictError).toBeDefined();
    expect(conflictError).toMatch(/ES/);
    expect(conflictError).toMatch(/7185.75/);
    expect(conflictError).toMatch(/7190/);
  });

  it('does NOT add parse_error when text and vision match within dedup tolerance', () => {
    // 7185.75 vs 7186.00 — diff 0.25, within CROSS_TOL → deduped; no conflict
    const textResult   = makeTextResult([makeTextLevel(7185.75, 'flip')]);
    const imageResults = [makeImageResult('ES', [{ price: 7186.00, type: 'support', color: 'green' }])];
    const merged = mergeDubzInputs(textResult, imageResults, null, '2026-04-27', PASTE);

    expect(merged.conflicts).toHaveLength(0);
    expect(merged.parse_errors.filter(e => e.includes('vision/text disagreement'))).toHaveLength(0);
  });

  it('does NOT add parse_error when no image levels exist to compare', () => {
    const textResult = makeTextResult([makeTextLevel(7185.75, 'flip')]);
    const merged = mergeDubzInputs(textResult, [], null, '2026-04-27', PASTE);
    expect(merged.parse_errors.filter(e => e.includes('vision/text disagreement'))).toHaveLength(0);
  });
});

// ── Gate 3: crossSourceConfirmed wired through appendDubzToMemory ─────────────

describe('appendDubzToMemory – Gate 3: crossSourceConfirmed persisted to Level Memory', () => {
  const fs   = require('fs');
  const os   = require('os');
  const path = require('path');
  const { appendDubzToMemory } = require('../lib/parse-dubz');
  const { queryLevels, _internal: { _setMemoryFile, _resetWriteFn } } = require('../lib/level-memory');

  let tmpFile;
  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dubz-mem-'));
    tmpFile = path.join(dir, 'level-memory.json');
    _setMemoryFile(tmpFile);
    _resetWriteFn();
  });

  it('crossSourceConfirmed: true on merged level is stored in the Level Memory mention', async () => {
    const state = {
      instruments: {
        ES: {
          levels: [{
            price: 7185.75, significance: 'key', direction: 'flip',
            intent: null, source: 'text', source_snippet: 'ES key flip 7185.75',
            crossSourceConfirmed: true,
          }],
        },
        NQ: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] },
      },
      parse_errors: [],
    };

    await appendDubzToMemory(state);

    const results = queryLevels({ instrument: 'ES' });
    expect(results).toHaveLength(1);
    expect(results[0].mentions[0].crossSourceConfirmed).toBe(true);
  });

  it('crossSourceConfirmed: false on unconfirmed level is stored correctly', async () => {
    const state = {
      instruments: {
        ES: {
          levels: [{
            price: 7100, significance: 'unclear', direction: 'support',
            intent: null, source: 'text', source_snippet: null,
            crossSourceConfirmed: false,
          }],
        },
        NQ: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] },
      },
      parse_errors: [],
    };

    await appendDubzToMemory(state);

    const results = queryLevels({ instrument: 'ES' });
    expect(results[0].mentions[0].crossSourceConfirmed).toBe(false);
  });
});
