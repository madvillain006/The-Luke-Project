'use strict';

const { replayLevelAgainstPriceAction } = require('../lib/level-replay');

function record(price, mention = {}) {
  return {
    canonical_price: price,
    mentions: [{ direction: 'support', ...mention }],
  };
}

describe('level-replay', () => {
  it('handles no bars', () => {
    const result = replayLevelAgainstPriceAction(record(100), [], {});
    expect(result.summary.total_touches).toBe(0);
    expect(result.interactions).toEqual([]);
  });

  it('records a clean hold interaction', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', open: 100.2, high: 100.8, low: 99.9, close: 100.6 },
      { timestamp: '2026-04-09T09:31:00-04:00', open: 100.6, high: 101.2, low: 100.1, close: 101.0 },
      { timestamp: '2026-04-09T09:32:00-04:00', open: 101.0, high: 101.4, low: 100.7, close: 101.3 },
    ];
    const result = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.5, windowMinutes: 5 });
    expect(result.summary.total_touches).toBe(1);
    expect(result.summary.hold_count).toBe(1);
  });

  it('records a clean fail interaction', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', open: 100.2, high: 100.5, low: 99.8, close: 100.1 },
      { timestamp: '2026-04-09T09:31:00-04:00', open: 100.0, high: 100.1, low: 98.9, close: 99.1 },
      { timestamp: '2026-04-09T09:32:00-04:00', open: 99.1, high: 99.2, low: 98.7, close: 98.8 },
    ];
    const result = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.5, windowMinutes: 5 });
    expect(result.summary.fail_count).toBe(1);
    expect(result.interactions[0].outcome).toBe('fail');
  });

  it('captures multiple touches', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', open: 100.2, high: 100.7, low: 99.9, close: 100.4 },
      { timestamp: '2026-04-09T09:31:00-04:00', open: 101.2, high: 101.5, low: 101.0, close: 101.3 },
      { timestamp: '2026-04-09T09:35:00-04:00', open: 100.3, high: 100.6, low: 99.8, close: 100.1 },
      { timestamp: '2026-04-09T09:36:00-04:00', open: 100.9, high: 101.2, low: 100.7, close: 101.0 },
    ];
    const result = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.5, windowMinutes: 2 });
    expect(result.summary.total_touches).toBeGreaterThanOrEqual(2);
  });

  it('handles oscillation around level', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', open: 99.9, high: 100.4, low: 99.7, close: 100.2 },
      { timestamp: '2026-04-09T09:31:00-04:00', open: 100.2, high: 100.5, low: 99.8, close: 99.9 },
      { timestamp: '2026-04-09T09:32:00-04:00', open: 99.9, high: 100.3, low: 99.7, close: 100.1 },
    ];
    const result = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.3, windowMinutes: 5 });
    expect(result.interactions[0].bars_within_tolerance).toBeGreaterThanOrEqual(2);
  });

  it('respects tolerance boundary', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', open: 100.6, high: 100.7, low: 100.4, close: 100.5 },
      { timestamp: '2026-04-09T09:31:00-04:00', open: 100.5, high: 100.8, low: 100.4, close: 100.7 },
    ];
    const tight = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.25, windowMinutes: 5 });
    const loose = replayLevelAgainstPriceAction(record(100), bars, { tolerancePoints: 0.75, windowMinutes: 5 });
    expect(tight.summary.total_touches).toBe(0);
    expect(loose.summary.total_touches).toBe(1);
  });
});
