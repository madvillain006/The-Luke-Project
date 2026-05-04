'use strict';

const {
  reclaimCloseEntry,
  levelReclaimLimitEntry,
  retestHoldEntry,
  holdAboveEntry,
  higherLowEntry,
  microPivotBreakEntry,
  accumulationMetrics,
  buildEntryModels,
} = require('../lib/research/fake-breakdown-v2/entry-models');

function fixture() {
  const bars = [
    { timestamp: '2026-04-09T09:59:00-04:00', open: 102, high: 103, low: 101, close: 102 },
    { timestamp: '2026-04-09T10:00:00-04:00', open: 102, high: 102, low: 97, close: 98 },
    { timestamp: '2026-04-09T10:02:00-04:00', open: 99, high: 101, low: 98.5, close: 100.5 },
    { timestamp: '2026-04-09T10:03:00-04:00', open: 100.5, high: 101, low: 100.25, close: 100.75 },
    { timestamp: '2026-04-09T10:04:00-04:00', open: 100.75, high: 101, low: 100.5, close: 100.8 },
    { timestamp: '2026-04-09T10:05:00-04:00', open: 100.8, high: 102, low: 100.75, close: 101.5 },
    { timestamp: '2026-04-09T10:06:00-04:00', open: 101.5, high: 103, low: 101.25, close: 102.5 },
  ];
  const setup = {
    id: 'setup:test',
    valid_reclaim: true,
    executable_level: 100,
    sweep_low: 97,
    reclaim_timestamp: '2026-04-09T10:02:00-04:00',
    minutes_below_level: 2,
  };
  return { bars, setup };
}

describe('fake breakdown v2 entry models', () => {
  it('detects reclaim close, L+0.25, retest hold, two/three candle holds, higher low, and micro pivot break', () => {
    const { bars, setup } = fixture();
    expect(reclaimCloseEntry(setup, bars)).toEqual(expect.objectContaining({ entry_model: 'reclaim_close', entry_price: 100.5 }));
    expect(levelReclaimLimitEntry(setup, bars)).toEqual(expect.objectContaining({ entry_model: 'level_reclaim_limit', entry_price: 100.25 }));
    expect(retestHoldEntry(setup, bars)).toEqual(expect.objectContaining({ entry_model: 'retest_hold' }));
    expect(holdAboveEntry(setup, bars, 2)).toEqual(expect.objectContaining({ entry_model: '2_candle_hold' }));
    expect(holdAboveEntry(setup, bars, 3)).toEqual(expect.objectContaining({ entry_model: '3_candle_hold' }));
    expect(higherLowEntry(setup, bars)).toEqual(expect.objectContaining({ entry_model: 'higher_low_after_reclaim' }));
    expect(microPivotBreakEntry(setup, bars)).toEqual(expect.objectContaining({ entry_model: 'micro_pivot_break', entry_price: 101.25 }));

    const models = buildEntryModels(setup, bars).map(entry => entry.entry_model);
    expect(models).toContain('reclaim_close');
    expect(models).toContain('level_reclaim_limit');
    expect(models).toContain('micro_pivot_break');
  });

  it('measures accumulation and acceptance above the reclaimed level', () => {
    const { bars, setup } = fixture();
    const metrics = accumulationMetrics(setup, bars);
    expect(metrics.closes_above_level).toBeGreaterThanOrEqual(3);
    expect(metrics.minutes_held_above).toBeGreaterThanOrEqual(3);
    expect(metrics.higher_low_formed).toBe(true);
    expect(metrics.accumulation_above_level).toBe(true);
  });
});
