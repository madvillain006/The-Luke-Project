'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findFirstCandleAfter,
  isStage2MarketSupported,
  loadCandlesForSymbol,
  loadMarketDataForTrades,
  loadPolygonCandlesForSymbol,
  priorClosedCandles,
  priorCandles,
  remotePriority,
} = require('../lib/kat-stage2/market-data');

function writeCsv(dir) {
  fs.writeFileSync(path.join(dir, 'esm26_intraday-1min_historical-data-download-test.csv'), [
    'Time,Open,High,Low,Latest,Change,%Change,Volume',
    '"2026-04-22 10:00",5300,5302,5299,5301,0,+0.01%,100',
    '"2026-04-22 10:01",5301,5304,5300,5303,0,+0.01%,120',
  ].join('\n'), 'utf8');
}

describe('Kat Stage 2 market data adapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes local candles to UTC and labels replay data', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-stage2-md-'));
    writeCsv(dir);

    const loaded = await loadCandlesForSymbol('ES', {
      local: { searchDirs: [dir], cache: false },
      start: '2026-04-22T13:59:00.000Z',
      end: '2026-04-22T14:02:00.000Z',
    });

    expect(loaded.coverage.found).toBe(true);
    expect(loaded.candles[0].timestamp_utc).toBe('2026-04-22T14:00:00.000Z');
    expect(loaded.candles[0].data_quality_flags).toContain('replay_only');
  });

  it('uses only candles after or before the requested timestamp as specified', () => {
    const candles = [
      { timestamp_utc: '2026-04-22T14:00:00.000Z', close: 1 },
      { timestamp_utc: '2026-04-22T14:01:00.000Z', close: 2 },
    ];

    expect(findFirstCandleAfter(candles, '2026-04-22T14:00:00.000Z').candle.close).toBe(2);
    expect(priorCandles(candles, '2026-04-22T14:00:30.000Z', 1)[0].close).toBe(1);
    expect(priorClosedCandles(candles, '2026-04-22T14:00:30.000Z', 1)).toHaveLength(0);
    expect(priorClosedCandles(candles, '2026-04-22T14:01:00.000Z', 1)[0].close).toBe(1);
  });

  it('separates unsupported symbols instead of hammering the candle adapter', async () => {
    const loaded = await loadMarketDataForTrades([
      { normalized_symbol: 'AAPL', timestamp_utc: '2026-04-22T14:00:00.000Z' },
      { normalized_symbol: 'SPY', timestamp_utc: '2026-04-22T14:00:00.000Z' },
    ], {
      local: { searchDirs: [fs.mkdtempSync(path.join(os.tmpdir(), 'kat-stage2-empty-md-'))], cache: false },
      skipInventory: true,
    });

    expect(loaded.unsupported_symbols.AAPL).toBe(1);
    expect(loaded.unsupported_symbols.SPY).toBe(1);
    expect(isStage2MarketSupported('ES')).toBe(true);
    expect(loaded.symbols).not.toContain('AAPL');
    expect(loaded.symbols).not.toContain('SPY');
  });

  it('loads option contract candles from Polygon/Massive without a live network call in tests', async () => {
    global.fetch = async url => {
      expect(String(url)).toContain('O%3ASPY260422C00730000');
      return {
        ok: true,
        json: async () => ({
          results: [{
            t: Date.UTC(2026, 3, 22, 14, 31),
            o: 1.00,
            h: 1.20,
            l: 0.95,
            c: 1.10,
            v: 50,
          }],
        }),
      };
    };

    const loaded = await loadPolygonCandlesForSymbol('O:SPY260422C00730000', {
      start: '2026-04-22T00:00:00.000Z',
      end: '2026-04-22T23:59:00.000Z',
      polygonApiKey: 'test-key',
    });

    expect(loaded.coverage.found).toBe(true);
    expect(loaded.coverage.source).toBe('polygon_aggs');
    expect(loaded.candles[0].symbol).toBe('O:SPY260422C00730000');
    expect(loaded.candles[0].data_quality_flags).toContain('option_contract_bars');
  });

  it('prioritizes exact option contracts before broad equity fallbacks', () => {
    const sorted = ['ZM', 'SPY', 'O:SPY260422C00730000', 'ES']
      .sort((a, b) => remotePriority(a) - remotePriority(b) || String(a).localeCompare(String(b)));

    expect(sorted[0]).toBe('O:SPY260422C00730000');
    expect(sorted[1]).toBe('SPY');
    expect(sorted[2]).toBe('ES');
    expect(sorted[3]).toBe('ZM');
  });
});
