'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { appendSatyToMemory } = require('../lib/saty-levels');
const { queryLevels, _internal: { _setMemoryFile, _resetWriteFn } } = require('../lib/level-memory');

const DEFAULT_MEMORY_FILE = path.join(__dirname, '../data/level-memory.json');

describe('appendSatyToMemory', () => {
  let tmpFile;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saty-mem-'));
    tmpFile = path.join(dir, 'level-memory.json');
    _setMemoryFile(tmpFile);
    _resetWriteFn();
  });

  afterEach(() => {
    _setMemoryFile(DEFAULT_MEMORY_FILE);
    _resetWriteFn();
  });

  it('writes all 13 Saty levels into SPX level memory', async () => {
    const satyData = {
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
    };

    const results = await appendSatyToMemory(satyData);
    expect(results).toHaveLength(13);

    const levels = queryLevels({ instrument: 'SPX' });
    expect(levels).toHaveLength(13);
    expect(levels.every(level => level.mentions[0].analyst === 'saty')).toBe(true);
    expect(levels.some(level => level.canonical_price === 7105)).toBe(true);
    expect(levels.some(level => level.canonical_price === 7028)).toBe(true);
  });
});
