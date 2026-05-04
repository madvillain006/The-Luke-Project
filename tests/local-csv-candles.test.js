'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getLocalCsvCandles,
  getLocalCandleInventory,
  listLocalCandleFiles,
  _internal,
} = require('../lib/market-data/providers/local-csv-candles');

function writeBarchartCsv(dir, fileName = 'esm26_intraday-1min_historical-data-download-test.csv') {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, [
    'Time,Open,High,Low,Latest,Change,%Change,Volume',
    '"2026-04-29 08:27",7163.25,7164.25,7161.75,7163,-1.0,-0.01%,1094',
    '"2026-04-29 08:28",7163,7164.25,7162.5,7164,1.0,+0.01%,1544',
    '"2026-04-29 08:29",7164,7165,7162.75,7163.25,-0.75,-0.01%,1912',
  ].join('\n'), 'utf8');
  return filePath;
}

describe('local CSV candle provider', () => {
  afterEach(() => {
    _internal._inventoryCache.clear();
  });

  it('discovers and parses Barchart-style ES 1m CSV files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-candles-'));
    writeBarchartCsv(dir);

    const files = listLocalCandleFiles({ searchDirs: [dir] });
    const result = await getLocalCsvCandles('ES', {
      searchDirs: [dir],
      mode: 'replay',
      date: '2026-04-29',
      time: '08:29',
      limit: 2,
      cache: false,
    });

    expect(files).toHaveLength(1);
    expect(result.candles).toHaveLength(2);
    expect(result.timestamp).toBe('2026-04-29T08:29:00-04:00');
    expect(result.candles[0].open).toBe(7163);
    expect(result.candles[1].close).toBe(7163.25);
    expect(result.source).toBe('local_csv');
    expect(result.source_label).toBe('local/replay');
    expect(result.live).toBe(false);
    expect(result.replay).toBe(true);
    expect(result.usable_for_replay).toBe(true);
    expect(result.usable_for_live_arming).toBe(false);
  });

  it('keeps latest-local CSV candles stale and proof-only', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-candles-'));
    writeBarchartCsv(dir);

    const result = await getLocalCsvCandles('ES', { searchDirs: [dir], limit: 1, cache: false });

    expect(result.stale).toBe(true);
    expect(result.live).toBe(false);
    expect(result.replay).toBe(true);
    expect(result.usable_for_live_arming).toBe(false);
    expect(result.candles[0].stale).toBe(true);
  });

  it('discovers SPX without converting it into ES', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-candles-'));
    writeBarchartCsv(dir, 'spx_intraday-1min_historical-data-download-test.csv');

    const inventory = getLocalCandleInventory({ searchDirs: [dir], cache: false });
    const spx = await getLocalCsvCandles('SPX', { searchDirs: [dir], limit: 1, cache: false });
    const es = await getLocalCsvCandles('ES', { searchDirs: [dir], limit: 1, cache: false });

    expect(inventory.symbols.SPX.found).toBe(true);
    expect(spx.instrument).toBe('SPX');
    expect(spx.candles).toHaveLength(1);
    expect(es.candles).toHaveLength(0);
    expect(es.error).toBe('local_csv_candles_not_found');
  });
});
