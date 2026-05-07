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

  it('does not classify Richy analyst text as a legacy alert', () => {
    const result = classifyPaste('RichyDubz ES flipped 7185.75 and SPY 712.38 premarket.');
    expect(result.type).toBeNull();
  });

  it('does not route legacy analyst text or option-contract text to /alert', () => {
    const legacy = detectPasteIntent('[2:34 PM] oldanalyst ES LONG 5880', false);
    const option = detectPasteIntent('SPY 588C avg 1.25', false);
    expect(legacy.command).toBeNull();
    expect(option.command).toBeNull();
  });

  it('does not classify conversational questions mentioning Saty as partial Saty input', () => {
    const result = classifyPaste('based on the loaded Saty, Mancini, Dubz, and Katbot heatmap context, what is possible today and what should I avoid?');
    expect(result.type).toBeNull();
  });

  it('does not route conversational Katbot heatmap context questions to /heatmap', () => {
    const result = detectPasteIntent('based on loaded Saty, Mancini, Dubz, and Katbot heatmap context, what is possible today?', false);
    expect(result.command).toBeNull();
  });

  it('lets KatBot analyst option-contract pastes fall through to Stage 2 instead of heatmap ingestion', () => {
    const result = classifyPaste('[6:14 AM] KapriK0rn3, : buying spx 0DTE 7300c @ 1.25 stop .80 target 2.50');
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

  it('removes stale daily heatmap carry-over file', async () => {
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: '2026-04-27',
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
    });

    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['Katbot/SPX heatmap']);
  });
});
