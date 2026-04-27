'use strict';

const fs = require('fs');
const path = require('path');

const { _internal: { getPhase2WorkflowLoadStatus, getLegacyConfluenceState } } = require('../lib/slash-commands');

const DATA_DIR = path.join(__dirname, '../data');
const LEVEL_MEMORY_FILE = path.join(DATA_DIR, 'level-memory.json');
const DUBZ_LEVELS_FILE = path.join(DATA_DIR, 'dubz-levels.json');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');

describe('slash-commands Phase 2 workflow status', () => {
  let originals;

  beforeEach(() => {
    originals = {
      levelMemory: fs.existsSync(LEVEL_MEMORY_FILE) ? fs.readFileSync(LEVEL_MEMORY_FILE, 'utf8') : null,
      dubzLevels: fs.existsSync(DUBZ_LEVELS_FILE) ? fs.readFileSync(DUBZ_LEVELS_FILE, 'utf8') : null,
      dailyCtx: fs.existsSync(DAILY_CTX_FILE) ? fs.readFileSync(DAILY_CTX_FILE, 'utf8') : null,
      todayLevels: fs.existsSync(TODAY_LEVELS_FILE) ? fs.readFileSync(TODAY_LEVELS_FILE, 'utf8') : null,
    };
  });

  afterEach(() => {
    for (const [file, original] of [
      [LEVEL_MEMORY_FILE, originals.levelMemory],
      [DUBZ_LEVELS_FILE, originals.dubzLevels],
      [DAILY_CTX_FILE, originals.dailyCtx],
      [TODAY_LEVELS_FILE, originals.todayLevels],
    ]) {
      if (original === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.writeFileSync(file, original, 'utf8');
      }
    }
  });

  it('reads modern Dubz + Bobby workflow state without relying on today-levels.json', () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    fs.writeFileSync(LEVEL_MEMORY_FILE, JSON.stringify({
      version: 1,
      last_updated: null,
      levels: [
        {
          canonical_price: 712,
          instrument: 'SPY',
          first_seen: '2026-04-27T18:00:00.000Z',
          last_seen: '2026-04-27T18:00:00.000Z',
          total_mentions: 1,
          mentions: [
            { analyst: 'bobby', date: todayET, timestamp: '2026-04-27T18:00:00.000Z', significance: 'key', direction: null, intent: null, source_type: 'vision', source_snippet: null, crossSourceConfirmed: false },
          ],
        },
      ],
    }), 'utf8');

    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: '2026-04-27T18:01:00.000Z',
      source_pastes: [],
      instruments: {
        NQ: { levels: [] },
        ES: { levels: [{ price: 7185.75 }, { price: 7090 }] },
        QQQ: { levels: [] },
        SPY: { levels: [{ price: 712.38 }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');

    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: todayCT,
      heatmap: { source: 'image', stored_at: '2026-04-27T18:02:00.000Z' },
    }), 'utf8');

    const status = getPhase2WorkflowLoadStatus();

    expect(status.dubzLoaded).toBe(true);
    expect(status.dubzCount).toBe(3);
    expect(status.bobbyLoaded).toBe(true);
    expect(status.bobbyCount).toBe(1);
  });

  it('bridges modern Dubz state into legacy confluence context when today-levels.json is absent', () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    if (fs.existsSync(TODAY_LEVELS_FILE)) fs.unlinkSync(TODAY_LEVELS_FILE);

    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: '2026-04-27T18:01:00.000Z',
      source_pastes: [],
      instruments: {
        NQ: { levels: [] },
        ES: { levels: [{ price: 7185.75, source_snippet: 'ES flip 7185.75' }] },
        QQQ: { levels: [] },
        SPY: { levels: [{ price: 712.38, source_snippet: 'SPY flip 712.38' }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');

    const state = getLegacyConfluenceState(todayET);

    expect(state.date).toBe(todayET);
    expect(state.bobby).toEqual([]);
    expect(state.richyd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        analyst: 'richydubz',
        signal_type: 'CONTEXT',
        ticker: 'ES',
        levels: [7185.75],
      }),
      expect.objectContaining({
        analyst: 'richydubz',
        signal_type: 'CONTEXT',
        ticker: 'SPY',
        levels: [712.38],
      }),
    ]));
  });
});
