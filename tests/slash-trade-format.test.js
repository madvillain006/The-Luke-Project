'use strict';

const fs = require('fs');
const path = require('path');

const { handleSlashCommand } = require('../lib/slash-commands');
const { events, snapshots } = require('../lib/paths');

const ROOT = path.join(__dirname, '..');
const TRADING_STATE_FILE = path.join(ROOT, 'state', 'snapshots', 'trading-state.json');
const TRADING_EVENTS_FILE = path.join(ROOT, 'state', 'events', 'trading-events.jsonl');
const ACTIVE_TRADE_FILE = path.join(ROOT, 'data', 'active-trade.json');

const FILES = [
  events.trades,
  snapshots.autonomousState,
  TRADING_STATE_FILE,
  TRADING_EVENTS_FILE,
  ACTIVE_TRADE_FILE,
];

function readMaybe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function restoreMaybe(file, content) {
  if (content === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

async function slash(message) {
  let payload = null;
  const res = { json(obj) { payload = obj; return obj; } };
  await handleSlashCommand(message, res);
  return payload;
}

describe('slash-commands trade journal formatting', () => {
  let originals;

  beforeEach(() => {
    originals = new Map(FILES.map(file => [file, readMaybe(file)]));
    fs.mkdirSync(path.dirname(events.trades), { recursive: true });
    fs.writeFileSync(events.trades, '', 'utf8');
    if (fs.existsSync(ACTIVE_TRADE_FILE)) fs.unlinkSync(ACTIVE_TRADE_FILE);
  });

  afterEach(() => {
    for (const [file, original] of originals.entries()) restoreMaybe(file, original);
  });

  it('separates entry and exit prices in trade log and EOD review output', async () => {
    const first = await slash('/trade LONG ES 7248 7265 WIN');
    const second = await slash('/trade SHORT ES 7297 7287 WIN');
    const review = await slash('/review');

    expect(first.reply).toContain('LONG ES 7248 -> 7265 WIN');
    expect(second.reply).toContain('SHORT ES 7297 -> 7287 WIN');
    expect(review.reply).toContain('LONG ES 7248 -> 7265 WIN');
    expect(review.reply).toContain('SHORT ES 7297 -> 7287 WIN');
    expect(review.reply).not.toContain('72487265');
    expect(review.reply).not.toContain('72977287');
  });
});
