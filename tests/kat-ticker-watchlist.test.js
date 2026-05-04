'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildKatTickerWatchlist,
  extractTickerMentions,
  formatKatTickerWatchlistForDiscord,
  isWatchlistTicker,
} = require('../lib/kat-ticker-watchlist');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-watchlist-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat'), { recursive: true });
  return root;
}

function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat ticker watchlist', () => {
  it('extracts repeated non-index tickers without treating index tickers as single-name candidates', () => {
    expect(extractTickerMentions('$GLW breakout with $SPY context')).toEqual(['GLW']);
    expect(isWatchlistTicker('GLW')).toBe(true);
    expect(isWatchlistTicker('SPY')).toBe(false);
  });

  it('builds a shadow watchlist from raw mentions and processed signals', () => {
    const root = makeRoot();
    const now = new Date('2026-05-03T14:00:00.000Z');
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-03T13:30:00.000Z',
        message_id: '1',
        username: 'analyst1',
        channel_name: 'trade-floor',
        content: '$GLW breakout over 60',
        attachments: [{ filename: 'glw.png', content_type: 'image/png' }],
      },
      {
        ts: '2026-05-03T13:35:00.000Z',
        message_id: '2',
        username: 'analyst2',
        channel_name: 'trade-floor',
        content: 'GLW 1D bull flag',
        attachments: [],
      },
      {
        ts: '2026-05-03T13:40:00.000Z',
        message_id: '3',
        username: 'analyst3',
        channel_name: 'trade-floor',
        content: '$SPY heatmap still direct lane',
        attachments: [],
      },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-03T13:35:00.000Z', analyst: 'analyst2', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: 'GLW 1D bull flag' },
      { ts: '2026-05-03T13:40:00.000Z', analyst: 'analyst3', ticker: 'SPY', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$SPY heatmap' },
    ]);

    const watchlist = buildKatTickerWatchlist({ rootDir: root, now });

    expect(watchlist.candidates).toHaveLength(1);
    expect(watchlist.candidates[0].ticker).toBe('GLW');
    expect(watchlist.candidates[0].policy).toContain('not SPX-equivalent');
    expect(formatKatTickerWatchlistForDiscord(watchlist)).toContain('`GLW`');
  });
});
