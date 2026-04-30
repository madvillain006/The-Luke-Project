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
  it('derives the day-mode Saty ladder from daily bars', () => {
    const result = _internal.deriveSatyLevelsFromBars(makeBullBars());
    expect(result.valid).toBe(true);
    expect(result.prev_close).toBe(6039);
    expect(result.atr_value).toBe(10);
    expect(result.call_trigger).toBe(6041.36);
    expect(result.put_trigger).toBe(6036.64);
    expect(result.ext_plus_4).toBe(6046.86);
    expect(result.atr_plus_1).toBe(6049);
    expect(result.atr_minus_1).toBe(6029);
  });

  it('classifies bullish ribbon on rising closes', () => {
    expect(_internal.classifyRibbonFromBars(makeBullBars())).toBe('BULLISH');
  });

  it('classifies bearish ribbon on falling closes', () => {
    expect(_internal.classifyRibbonFromBars(makeBearBars())).toBe('BEARISH');
  });

  it('scales SPY bars into SPX approximation bars', () => {
    const scaled = _internal.scaleBars([{ date: '2026-04-28', open: 510.1, high: 511.2, low: 509.9, close: 510.5, volume: 123 }], 10);
    expect(scaled[0]).toEqual({
      date: '2026-04-28',
      open: 5101,
      high: 5112,
      low: 5099,
      close: 5105,
      volume: 123,
    });
  });
});
