'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { handleHeatmap } = require('../lib/slash-commands-ingest');
const { buildTradeDecision } = require('../lib/decision-spine');
const { loadMemory, _internal: levelMemoryInternal } = require('../lib/level-memory');

const DATA_DIR = path.join(__dirname, '../data');
const SATY_LEVELS_FILE = path.join(DATA_DIR, 'saty-levels.json');

function makeRes() {
  return {
    payload: null,
    json(obj) {
      this.payload = obj;
      return obj;
    },
  };
}

function countBobbyMentions(memory) {
  return (memory.levels || []).reduce((sum, level) => {
    return sum + (level.mentions || []).filter(m => m.analyst === 'bobby').length;
  }, 0);
}

describe('Bobby heatmap idempotency', () => {
  let tmpDir;
  let memoryFile;
  let levelsObj;
  let originalSaty;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T18:30:00.000Z'));

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bobby-idempotency-'));
    memoryFile = path.join(tmpDir, 'level-memory.json');
    levelMemoryInternal._setMemoryFile(memoryFile);
    levelMemoryInternal._resetWriteFn();
    levelsObj = { date: '2026-05-02', richyd: [], bobby: [] };

    originalSaty = fs.existsSync(SATY_LEVELS_FILE)
      ? fs.readFileSync(SATY_LEVELS_FILE, 'utf8')
      : null;
    fs.writeFileSync(SATY_LEVELS_FILE, JSON.stringify({
      valid: true,
      atr_plus_1: 7338,
      ext_plus_4: 7318,
      ext_plus_3: 7302,
      ext_plus_2: 7291,
      ext_plus_1: 7280,
      call_trigger: 7266,
      prev_close: 7243,
      put_trigger: 7221,
      ext_minus_1: 7207,
      ext_minus_2: 7196,
      ext_minus_3: 7185,
      ext_minus_4: 7169,
      atr_minus_1: 7148,
      updated: '2026-05-02T18:20:00.000Z',
    }), 'utf8');
  });

  afterEach(() => {
    levelMemoryInternal._resetWriteFn();
    vi.useRealTimers();

    if (originalSaty === null) {
      if (fs.existsSync(SATY_LEVELS_FILE)) fs.unlinkSync(SATY_LEVELS_FILE);
    } else {
      fs.writeFileSync(SATY_LEVELS_FILE, originalSaty, 'utf8');
    }
  });

  it('does not duplicate Level Memory or change the ES decision for repeated identical Bobby text', async () => {
    const text = fs.readFileSync(
      path.join(__dirname, '../fixtures/bobby/synthetic-bearish-bobby.txt'),
      'utf8'
    );
    const ctx = {
      todayKeyET: () => '2026-05-02',
      getLegacyConfluenceState: () => levelsObj,
      saveLevels: obj => { levelsObj = JSON.parse(JSON.stringify(obj)); },
    };

    const firstRes = makeRes();
    await handleHeatmap(`/heatmap ${text}`, firstRes, ctx);
    expect(firstRes.payload.reply).toMatch(/^Heatmap context updated\./);
    const firstNodeCount = Number(firstRes.payload.reply.match(/(\d+) nodes found/)[1]);
    expect(firstNodeCount).toBeGreaterThan(0);
    expect(levelsObj.bobby).toHaveLength(1);

    const firstMemory = loadMemory();
    const firstMentionCount = countBobbyMentions(firstMemory);
    expect(firstMentionCount).toBe(firstNodeCount);

    const firstDecision = buildTradeDecision({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 7237,
      now: new Date(),
    });

    const secondRes = makeRes();
    await handleHeatmap(`/heatmap ${text}`, secondRes, ctx);
    expect(secondRes.payload.reply).toContain(`${firstNodeCount} nodes found`);
    expect(secondRes.payload.reply).toContain('duplicate ignored');
    expect(levelsObj.bobby).toHaveLength(1);

    const secondMemory = loadMemory();
    expect(countBobbyMentions(secondMemory)).toBe(firstMentionCount);

    const secondDecision = buildTradeDecision({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 7237,
      now: new Date(),
    });

    expect(secondDecision).toMatchObject({
      ok: firstDecision.ok,
      action: firstDecision.action,
      reason: firstDecision.reason,
      entry: firstDecision.entry,
      stop: firstDecision.stop,
      target: firstDecision.target,
      sizing: firstDecision.sizing,
    });
    expect(secondDecision.confluence).toEqual(firstDecision.confluence);
  });

  it('skips vision reparse for the same Bobby image source id', async () => {
    const image = `data:image/png;base64,${Buffer.from('same-image-bytes').toString('base64')}`;
    let parseCalls = 0;
    const ctx = {
      todayKeyET: () => '2026-05-02',
      getLegacyConfluenceState: () => levelsObj,
      saveLevels: obj => { levelsObj = JSON.parse(JSON.stringify(obj)); },
      parseBobbyImage: async () => {
        parseCalls += 1;
        return {
          panels: [
            {
              ticker: 'SPXW',
              instrument: 'SPX',
              current_price: 7117,
              king_nodes: [7125],
              support: [7100],
              resistance: [7150],
            },
          ],
          king_nodes: [7125],
          support: [7100],
          resistance: [7150],
          bias: 'NEUTRAL',
          notes: 'fixture vision parse',
          source: 'bobby-vision',
          vision_parsed: true,
        };
      },
    };

    const firstRes = makeRes();
    firstRes._heatmapImage = image;
    await handleHeatmap('/heatmap ', firstRes, ctx);
    expect(firstRes.payload.reply).toContain('3 nodes found');
    expect(parseCalls).toBe(1);

    const mentionsAfterFirst = countBobbyMentions(loadMemory());

    const secondRes = makeRes();
    secondRes._heatmapImage = image;
    await handleHeatmap('/heatmap ', secondRes, ctx);
    expect(secondRes.payload.reply).toContain('3 nodes found');
    expect(secondRes.payload.reply).toContain('duplicate ignored');
    expect(parseCalls).toBe(1);
    expect(countBobbyMentions(loadMemory())).toBe(mentionsAfterFirst);
  });
});
