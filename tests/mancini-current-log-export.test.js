'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  discoverManciniCurrentLog,
  extractManciniLevelsFromLog,
} = require('../lib/tradingview/level-export');

function makeRootWithManciniLog() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-mancini-'));
  const dir = path.join(root, 'data', 'research', 'mancini');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'The Mancini Logs 3-15-2026 - 5-3-2026.txt');
  fs.writeFileSync(file, [
    'The Mancini Logs 3-15-2026 - 5-4-2026',
    '',
    'Adam Mancini',
    '@AdamMancini4',
    'Â·',
    '2h',
    'Plan: 7248 reclaim sees 53, 64, 85. 7237 fails, dip 7212. Watch sweeps of the 7213 low. 7199 below.',
    'Quote',
    'Adam Mancini',
    '@AdamMancini4',
    'Â·',
    '4h',
    'NOTE: Friday newsletter excerpt still applies.',
    'Big Picture View: 1 week ago, when #ES_F was 7180, I posted it spent the week building a bull flag 7198-7080.',
    'Plan Next Week: ES needs to digest this and backtest. 7245, 7198 (backtest) = supports. Sets up 7300, 7345, 7395 next',
    '10:34 AM Â· May 2, 2026',
    'Who to follow',
    '@TradingThomas3',
    'Open chat',
    'Adam_Mankini  commented 1 mo. ago',
    'Old March context 6591 must reclaim. This should not be current.',
    'Upvote',
  ].join('\n'), 'utf8');
  return { root, file };
}

describe('Mancini current log export', () => {
  it('discovers the edited current log even when the filename is stale', () => {
    const { root, file } = makeRootWithManciniLog();
    const found = discoverManciniCurrentLog({ rootDir: root });

    expect(found.path).toBe(file);
    expect(found.latest_date).toBe('2026-05-04');
    expect(found.misnamed).toBe(true);
  });

  it('pulls current levels from the full Mancini log and ignores sidebar/date junk', () => {
    const { file } = makeRootWithManciniLog();
    const result = extractManciniLevelsFromLog({
      filePath: file,
      latestDate: '2026-05-04',
      now: new Date('2026-05-04T17:30:00.000Z'),
    });
    const activePrices = result.levels.filter(level => level.active).map(level => level.price);

    for (const price of [7198, 7199, 7212, 7213, 7237, 7245, 7248, 7253, 7264, 7285, 7300, 7345, 7395]) {
      expect(activePrices).toContain(price);
    }

    expect(activePrices).not.toContain(2026);
    expect(activePrices).toContain(6591);
    expect(result.posts_scanned).toBeGreaterThanOrEqual(2);
  });

  it('parses Reddit exports where Adam_Mankini and commented metadata are split across lines', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-mancini-split-'));
    const dir = path.join(root, 'data', 'research', 'mancini');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'The Mancini Logs 3-15-2026 - 5-6-2026.txt');
    fs.writeFileSync(file, [
      'The Mancini Logs 3-15-2026 - 5-6-2026',
      '',
      'r/ThePiratesDen',
      '- The Airboat for Week of 5/3/2026',
      'Adam_Mankini',
      '  commented 19 hr. ago',
      'Targets given at 8am for next leg up 7268 (hit), 7277 (hit), 7298-302 above.',
      '',
      '7268 micro support. 7242 below. Bonus targets are 7311, 7319, 7329.',
      '',
      'Upvote',
    ].join('\n'), 'utf8');

    const result = extractManciniLevelsFromLog({
      filePath: file,
      latestDate: '2026-05-06',
      now: new Date('2026-05-06T17:30:00.000Z'),
    });
    const activePrices = result.levels.filter(level => level.active).map(level => level.price);

    for (const price of [7242, 7268, 7277, 7298, 7302, 7311, 7319, 7329]) {
      expect(activePrices).toContain(price);
    }
  });
});
