'use strict';

const fs = require('fs');
const path = require('path');
const { detectPasteIntent } = require('../lib/detect-paste');
const {
  classifyPaste,
  checklistComplete,
  DAILY_CTX_FILE,
} = require('../lib/daily-accumulator');
const { handleSlashCommand } = require('../lib/slash-commands');

const TODAY_LEVELS_FILE = path.join(__dirname, '..', 'data', 'today-levels.json');

function todayKeyET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

describe('Richy/Dubz paste routing regressions', () => {
  it('routes Richy analyst text to /dubz instead of legacy /levels', () => {
    const result = detectPasteIntent('RichyDubz ES flipped 7185.75 and SPY 712.38 premarket.', false);
    expect(result.command).toBe('/dubz');
    expect(result.detectedAnalyst).toBe('richy');
  });

  it('does not classify Richy analyst text as a Ximes alert', () => {
    const result = classifyPaste('RichyDubz ES flipped 7185.75 and SPY 712.38 premarket.');
    expect(result.type).toBeNull();
  });
});

describe('/reset clears daily accumulator context', () => {
  let originalDailyCtx = null;
  let hadDailyCtx = false;

  beforeEach(() => {
    hadDailyCtx = fs.existsSync(DAILY_CTX_FILE);
    originalDailyCtx = hadDailyCtx ? fs.readFileSync(DAILY_CTX_FILE, 'utf8') : null;
  });

  afterEach(() => {
    if (hadDailyCtx) {
      fs.writeFileSync(DAILY_CTX_FILE, originalDailyCtx, 'utf8');
    } else if (fs.existsSync(DAILY_CTX_FILE)) {
      fs.unlinkSync(DAILY_CTX_FILE);
    }
  });

  it('removes stale ximes/heatmap carry-over file', async () => {
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: '2026-04-27',
      ximes: { raw: 'stale signal', strike: 712.38, direction: 'LONG', ticker: 'SPY' },
      heatmap: { source: 'image', stored_at: '2026-04-27T18:00:00.000Z' },
    }), 'utf8');

    const res = {
      payload: null,
      json(data) { this.payload = data; return data; },
    };

    await handleSlashCommand('/reset', res);

    expect(res.payload.reply).toContain('Daily reset complete');
    expect(fs.existsSync(DAILY_CTX_FILE)).toBe(false);
  });
});

describe('daily accumulator heatmap readiness bridge', () => {
  let originalTodayLevels = null;
  let hadTodayLevels = false;

  beforeEach(() => {
    hadTodayLevels = fs.existsSync(TODAY_LEVELS_FILE);
    originalTodayLevels = hadTodayLevels ? fs.readFileSync(TODAY_LEVELS_FILE, 'utf8') : null;
  });

  afterEach(() => {
    if (hadTodayLevels) {
      fs.writeFileSync(TODAY_LEVELS_FILE, originalTodayLevels, 'utf8');
    } else if (fs.existsSync(TODAY_LEVELS_FILE)) {
      fs.unlinkSync(TODAY_LEVELS_FILE);
    }
  });

  it('uses stored accumulator heatmap context without reading today-levels', () => {
    if (fs.existsSync(TODAY_LEVELS_FILE)) fs.unlinkSync(TODAY_LEVELS_FILE);

    const result = checklistComplete({
      ximes: { strike: 712.38 },
      heatmap: { source: 'bobby-text', stored_at: new Date().toISOString() },
    });

    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('temporarily accepts today-levels bobby entries as the heatmap compatibility shim', () => {
    fs.writeFileSync(TODAY_LEVELS_FILE, JSON.stringify({
      date: todayKeyET(),
      bobby: [{ level: 7130, label: 'major resistance' }],
    }), 'utf8');

    const result = checklistComplete({
      ximes: { strike: 712.38 },
    });

    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('does not accept missing or stale today-levels as heatmap readiness', () => {
    fs.writeFileSync(TODAY_LEVELS_FILE, JSON.stringify({
      date: '2026-04-27',
      bobby: [{ level: 7130, label: 'stale resistance' }],
    }), 'utf8');

    const result = checklistComplete({
      ximes: { strike: 712.38 },
    });

    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['heatmap (Bobby or Jefe)']);
  });
});
