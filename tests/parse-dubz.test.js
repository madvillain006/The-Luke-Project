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
