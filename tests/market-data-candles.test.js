'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { getCandles, getLatestCandle, getCandleFeedStatus } = require('../lib/market-data/candle-feed');

function writeCsv(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'esm26_intraday-1min_historical-data-download-test.csv'), [
    'Time,Open,High,Low,Latest,Change,%Change,Volume',
    '"2026-04-29 08:28",7163,7164.25,7162.5,7164,1.0,+0.01%,1544',
    '"2026-04-29 08:29",7164,7165,7162.75,7163.25,-0.75,-0.01%,1912',
  ].join('\n'), 'utf8');
}

describe('market data candle feed abstraction', () => {
  it('returns local/replay 1m candles with required safety labels', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-feed-'));
    writeCsv(dir);

    const result = await getCandles('ES', {
      searchDirs: [dir],
      mode: 'replay',
      date: '2026-04-29',
      time: '08:29',
      limit: 2,
      cache: false,
    });

    expect(result.timeframe).toBe('1m');
    expect(result.candles).toHaveLength(2);
    expect(result.live).toBe(false);
    expect(result.replay).toBe(true);
    expect(result.usable_for_replay).toBe(true);
    expect(result.usable_for_live_arming).toBe(false);
  });

  it('returns latest candle and status without fabricating missing data', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-feed-empty-'));

    const latest = await getLatestCandle('ES', { searchDirs: [emptyDir], cache: false });
    const status = await getCandleFeedStatus('ES', { searchDirs: [emptyDir], cache: false });

    expect(latest).toBeNull();
    expect(status.usable_for_replay).toBe(false);
    expect(status.usable_for_live_arming).toBe(false);
    expect(status.error).toBeTruthy();
  });
});
