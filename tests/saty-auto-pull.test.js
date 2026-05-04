'use strict';

const { _internal } = require('../lib/saty-auto-pull');

function makeBullBars(count = 40, start = 6000) {
  return Array.from({ length: count }, (_, i) => {
    const close = start + i;
    return {
      date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      open: close,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1000 + i,
    };
  });
}

function makeBearBars(count = 40, start = 6000) {
  return Array.from({ length: count }, (_, i) => {
    const close = start - i;
    return {
      date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      open: close,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1000 + i,
    };
  });
}

describe('saty-auto-pull internal derivation', () => {
  it('matches the Pine day-mode Saty ladder coefficients for all 13 stored levels', () => {
    const result = _internal.deriveSatyLevelsFromBars(makeBullBars());
    expect(result.valid).toBe(true);
    expect(result.prev_close).toBe(6039);
    expect(result.atr_value).toBe(10);
    expect({
      atr_plus_1: result.atr_plus_1,
      ext_plus_4: result.ext_plus_4,
      ext_plus_3: result.ext_plus_3,
      ext_plus_2: result.ext_plus_2,
      ext_plus_1: result.ext_plus_1,
      call_trigger: result.call_trigger,
      prev_close: result.prev_close,
      put_trigger: result.put_trigger,
      ext_minus_1: result.ext_minus_1,
      ext_minus_2: result.ext_minus_2,
      ext_minus_3: result.ext_minus_3,
      ext_minus_4: result.ext_minus_4,
      atr_minus_1: result.atr_minus_1,
    }).toEqual({
      atr_plus_1: 6049,
      ext_plus_4: 6046.86,
      ext_plus_3: 6045.18,
      ext_plus_2: 6044,
      ext_plus_1: 6042.82,
      call_trigger: 6041.36,
      prev_close: 6039,
      put_trigger: 6036.64,
      ext_minus_1: 6035.18,
      ext_minus_2: 6034,
      ext_minus_3: 6032.82,
      ext_minus_4: 6031.14,
      atr_minus_1: 6029,
    });
  });

  it('classifies bullish ribbon on rising closes', () => {
    expect(_internal.classifyRibbonFromBars(makeBullBars())).toBe('BULLISH');
  });

  it('classifies bearish ribbon on falling closes', () => {
    expect(_internal.classifyRibbonFromBars(makeBearBars())).toBe('BEARISH');
  });

  it('keeps Yahoo SPX bars as direct SPX bars instead of scaling SPY proxy data', async () => {
    const { fetchDailyBarsFromYahoo } = require('../lib/market-data/providers/yahoo');
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            timestamp: [1772323200, 1772409600],
            indicators: {
              quote: [{
                open: [6000, 6010],
                high: [6020, 6030],
                low: [5990, 6005],
                close: [6015, 6025],
                volume: [100, 200],
              }],
            },
          }],
        },
      }),
    }));

    try {
      const bars = await fetchDailyBarsFromYahoo('^GSPC', { range: '5d' });
      expect(bars).toEqual([
        { date: '2026-03-01', open: 6000, high: 6020, low: 5990, close: 6015, volume: 100 },
        { date: '2026-03-02', open: 6010, high: 6030, low: 6005, close: 6025, volume: 200 },
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('prefers US500-style reference bars when futures are open and cash is closed', () => {
    const sundayEvening = new Date('2026-05-03T22:30:00Z');
    const mondayCashOpen = new Date('2026-05-04T14:30:00Z');

    expect(_internal.shouldPreferUs500Reference({ now: sundayEvening })).toBe(true);
    expect(_internal.shouldPreferUs500Reference({ now: mondayCashOpen })).toBe(false);
    expect(_internal.shouldPreferUs500Reference({ preferUs500: true, now: mondayCashOpen })).toBe(true);
    expect(_internal.shouldPreferUs500Reference({ preferUs500: false, now: sundayEvening })).toBe(false);
  });

  it('dedupes configurable US500 Yahoo symbol lists before fallback symbols', () => {
    expect(_internal.parseSymbolList('US500, US500,ALT', ['ALT', 'BACKUP'])).toEqual([
      'US500',
      'ALT',
      'BACKUP',
    ]);
  });
});
