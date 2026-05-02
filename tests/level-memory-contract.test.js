'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  recordLevel,
  queryLevels,
  loadMemory,
  _internal: { _setMemoryFile, _resetWriteFn },
} = require('../lib/level-memory');
const { parseBobby, appendBobbyToMemory } = require('../lib/parse-bobby');
const { parseDubzText, mergeDubzInputs, appendDubzToMemory } = require('../lib/parse-dubz');
const { parseManciniTweet, appendManciniToMemory } = require('../lib/parse-mancini');
const { appendSatyToMemory } = require('../lib/saty-levels');
const {
  queryLevelsAcrossEquivalents,
  _internal: { _resetQueryLevels },
} = require('../lib/confluence-engine');

const DEFAULT_MEMORY_FILE = path.join(__dirname, '../data/level-memory.json');

function useTempMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'level-contract-'));
  const file = path.join(dir, 'level-memory.json');
  _setMemoryFile(file);
  _resetWriteFn();
  return file;
}

afterEach(() => {
  _setMemoryFile(DEFAULT_MEMORY_FILE);
  _resetWriteFn();
  _resetQueryLevels();
});

describe('Level Memory contract', () => {
  it('stores canonical records and mention schema without normalizing instruments', async () => {
    useTempMemory();

    await recordLevel({
      analyst: 'dubz',
      instrument: 'ES',
      price: 7185.75,
      significance: 'key',
      direction: 'flip',
      intent: 'long_retest',
      source_type: 'text',
      source_snippet: 'ES key flip 7185.75',
      timestamp: '2026-04-27T13:45:00.000Z',
      crossSourceConfirmed: true,
    });

    const memory = loadMemory();
    expect(memory.levels).toHaveLength(1);
    expect(memory.levels[0]).toEqual(expect.objectContaining({
      canonical_price: 7185.75,
      instrument: 'ES',
      total_mentions: 1,
    }));
    expect(memory.levels[0].mentions[0]).toEqual({
      analyst: 'dubz',
      date: '2026-04-27',
      timestamp: '2026-04-27T13:45:00.000Z',
      significance: 'key',
      direction: 'flip',
      intent: 'long_retest',
      source_type: 'text',
      source_snippet: 'ES key flip 7185.75',
      source_id: null,
      crossSourceConfirmed: true,
    });

    await expect(
      recordLevel({ analyst: 'dubz', instrument: 'es', price: 7185.75, source_type: 'text' })
    ).rejects.toThrow('unknown instrument "es"');
  });

  it('merges duplicate levels across analysts by instrument tolerance', async () => {
    useTempMemory();

    await recordLevel({
      analyst: 'bobby',
      instrument: 'SPY',
      price: 712,
      significance: 'key',
      source_type: 'vision',
      timestamp: '2026-04-27T13:00:00.000Z',
    });
    const merged = await recordLevel({
      analyst: 'dubz',
      instrument: 'SPY',
      price: 712.38,
      significance: 'key',
      direction: 'flip',
      source_type: 'text',
      timestamp: '2026-04-27T14:00:00.000Z',
    });

    expect(merged.created_new).toBe(false);
    expect(merged.canonical_price).toBe(712);

    const levels = queryLevels({ instrument: 'SPY' });
    expect(levels).toHaveLength(1);
    expect(levels[0].mentions.map(m => m.analyst)).toEqual(['bobby', 'dubz']);
  });

  it('writes Bobby text and merged vision mentions with the expected contract metadata', async () => {
    useTempMemory();

    const textOnly = parseBobby('King node at 7160 with support at 7130 below.');
    await appendBobbyToMemory(textOnly);

    const mergedVision = {
      source: 'bobby-merged',
      king_nodes: [711],
      panels: [{
        ticker: 'SPY',
        instrument: 'SPY',
        king_nodes: [711],
        support: [709],
        resistance: [720],
      }],
      notes: 'SPY panel confirmed',
    };
    await appendBobbyToMemory(mergedVision);

    const spx = queryLevels({ instrument: 'SPX' });
    expect(spx.some(level =>
      level.canonical_price === 7160 &&
      level.mentions.some(m => m.analyst === 'bobby' && m.source_type === 'text' && m.significance === 'key')
    )).toBe(true);

    const spy = queryLevels({ instrument: 'SPY' });
    const king = spy.find(level => level.canonical_price === 711);
    expect(king.mentions[0]).toEqual(expect.objectContaining({
      analyst: 'bobby',
      source_type: 'vision',
      significance: 'key',
      direction: null,
      crossSourceConfirmed: true,
    }));
  });

  it('writes Dubz text/image merge metadata and reports conflict cases before writing', async () => {
    useTempMemory();

    const text = parseDubzText('ES key flip 7185.75. SPY significant flip 712.38.');
    const merged = mergeDubzInputs(text, [
      {
        instrument: 'ES',
        current_price: null,
        levels: [{ price: 7186, type: 'support', color: 'green' }],
        zones: [],
        parse_status: 'ok',
      },
      {
        instrument: 'SPY',
        current_price: null,
        levels: [{ price: 716, type: 'resistance', color: 'red' }],
        zones: [],
        parse_status: 'ok',
      },
    ], null, '2026-04-27', { source: 'test', timestamp: '2026-04-27T12:00:00.000Z' });

    expect(merged.instruments.ES.levels.find(l => l.price === 7185.75).crossSourceConfirmed).toBe(true);
    expect(merged.conflicts.some(c => c.instrument === 'SPY')).toBe(true);
    expect(merged.parse_errors.some(e => e.includes('vision/text disagreement on SPY'))).toBe(true);

    await appendDubzToMemory(merged);

    const es = queryLevels({ instrument: 'ES' }).find(level => level.canonical_price === 7185.75);
    expect(es.mentions[0]).toEqual(expect.objectContaining({
      analyst: 'dubz',
      source_type: 'text',
      direction: 'flip',
      crossSourceConfirmed: true,
    }));
  });

  it('keeps Mancini narrative and timestamp/year tokens out of Level Memory and does not persist wide chop boundaries', async () => {
    useTempMemory();

    const narrative = parseManciniTweet('## [2026-04-18 - philosophy]\n> Plan your levels, wait on price, react.');
    await appendManciniToMemory(narrative);
    expect(queryLevels({ instrument: 'ES' })).toEqual([]);

    const timestamped = parseManciniTweet(
      '04/22/2026 07:56AM - Failed Breakdown of 7097. Target was 7147, hit\n\n' +
      '04/22/2026 07:57AM - 7085-7185 remains a massive flag. No elevator down sell = no trading for me.'
    );
    const parsedPrices = timestamped.levels.map(level => level.price);
    expect(parsedPrices).not.toContain(2026);
    expect(parsedPrices).not.toContain(756);
    expect(parsedPrices).not.toContain(757);
    expect(timestamped.chop_zones).toEqual(expect.arrayContaining([
      expect.objectContaining({ low: 7085, high: 7185 }),
    ]));

    await appendManciniToMemory(timestamped);

    const prices = queryLevels({ instrument: 'ES' }).map(level => level.canonical_price);
    expect(prices).toContain(7097);
    expect(prices).toContain(7147);
    expect(prices).not.toContain(7085);
    expect(prices).not.toContain(7185);
  });

  it('surfaces Saty SPX truth to ES through confluence equivalence, not Level Memory merging', async () => {
    useTempMemory();

    await appendSatyToMemory({
      valid: true,
      atr_plus_1: 7231,
      ext_plus_4: 7209,
      ext_plus_3: 7192,
      ext_plus_2: 7180,
      ext_plus_1: 7168,
      call_trigger: 7153,
      prev_close: 7129,
      put_trigger: 7105,
      ext_minus_1: 7090,
      ext_minus_2: 7078,
      ext_minus_3: 7066,
      ext_minus_4: 7049,
      atr_minus_1: 7028,
      updated: '2026-04-27T17:00:00.000Z',
    });

    expect(queryLevels({ instrument: 'ES' })).toEqual([]);

    const esEquivalents = queryLevelsAcrossEquivalents('ES');
    const atrMinusOne = esEquivalents.find(level =>
      level.cross_instrument_origin?.instrument === 'SPX' &&
      level.cross_instrument_origin.original_price === 7028
    );

    expect(atrMinusOne).toEqual(expect.objectContaining({
      instrument: 'ES',
      canonical_price: 7058,
    }));
    expect(atrMinusOne.mentions[0]).toEqual(expect.objectContaining({
      analyst: 'saty',
      source_type: 'saty_atr',
    }));
  });
});
