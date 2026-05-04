'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  extractOptionContext,
  buildKatEquityOptionsUniverse,
  buildKatEquityOptionsProfile,
  formatKatEquityOptionsForDiscord,
} = require('../lib/kat-equity-options');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-equity-options-'));
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

describe('Kat equity/options shadow profiles', () => {
  it('parses single-name option context without treating it as SPX-equivalent', () => {
    const context = extractOptionContext('$TSLA 250c 5/17 @ 2.50 breakout', null);

    expect(context).toMatchObject({
      asset_class: 'option',
      underlying: 'TSLA',
      side: 'CALL',
      strike: 250,
      expiry: '5/17',
      premium: 2.5,
    });
    expect(context.parse_note).toContain('shadow context only');
  });

  it('aggregates equity and option evidence into downstream-ready shadow profiles', () => {
    const root = makeRoot();
    const now = new Date('2026-05-03T14:00:00.000Z');
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-03T13:30:00.000Z',
        message_id: '1',
        username: 'analyst1',
        channel_name: 'trade-floor',
        content: '$TSLA 250c 5/17 @ 2.50 breakout',
        attachments: [{ filename: 'tsla.png', content_type: 'image/png' }],
      },
      {
        ts: '2026-05-03T13:35:00.000Z',
        message_id: '2',
        username: 'analyst2',
        channel_name: 'trade-floor',
        content: 'TSLA 15m holding support 248',
        attachments: [],
      },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-03T13:30:00.000Z', message_id: '1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'TSLA', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$TSLA 250c 5/17 @ 2.50 breakout', has_image: true },
      { ts: '2026-05-03T13:35:00.000Z', message_id: '2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'TSLA', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [248], raw: 'TSLA 15m holding support 248', has_image: false },
    ]);

    const universe = buildKatEquityOptionsUniverse({ rootDir: root, now });
    const profile = buildKatEquityOptionsProfile('TSLA', { rootDir: root, now });

    expect(universe.ready_for_backtest).toContain('TSLA');
    expect(profile.asset_scope).toBe('equity_and_options');
    expect(profile.option_mentions).toBeGreaterThan(0);
    expect(profile.equity_mentions).toBeGreaterThan(0);
    expect(profile.policy).toContain('not SPX-equivalent');
    expect(formatKatEquityOptionsForDiscord(profile)).toContain('TSLA');
  });
});
