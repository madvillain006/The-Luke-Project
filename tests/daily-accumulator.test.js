'use strict';

const fs = require('fs');
const { detectPasteIntent } = require('../lib/detect-paste');
const { classifyPaste, DAILY_CTX_FILE } = require('../lib/daily-accumulator');
const { handleSlashCommand } = require('../lib/slash-commands');

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
