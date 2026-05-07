'use strict';

const { summarizeResults } = require('../lib/kat-stage2/metrics');

describe('Kat Stage 2 metrics', () => {
  it('scores settled signed PnL and excludes unresolved movement from expectancy', () => {
    const summary = summarizeResults([
      { outcome: 'win', gross_points: 4, r_multiple: 2, time_to_close_seconds: 60 },
      { outcome: 'loss', gross_points: -2, r_multiple: -1, time_to_close_seconds: 120 },
      { outcome: 'breakeven', gross_points: 0, r_multiple: 0, time_to_close_seconds: 90 },
      { outcome: 'unresolved', gross_points: 100, r_multiple: 50, time_to_close_seconds: 600 },
      { outcome: 'partial', gross_points: 8, r_multiple: 4, time_to_close_seconds: 300 },
      { outcome: 'no_fill', gross_points: null },
    ]);

    expect(summary.backtestable_trades).toBe(5);
    expect(summary.point_scored_trades).toBe(3);
    expect(summary.win_count).toBe(1);
    expect(summary.loss_count).toBe(1);
    expect(summary.average_win_points).toBe(4);
    expect(summary.average_loss_points).toBe(-2);
    expect(summary.expectancy_points).toBeCloseTo((4 - 2 + 0) / 3, 10);
  });

  it('does not coerce missing R values to zero', () => {
    const summary = summarizeResults([
      { outcome: 'win', gross_points: 4, r_multiple: null },
      { outcome: 'loss', gross_points: -2, r_multiple: '' },
    ]);

    expect(summary.average_r).toBe(null);
    expect(summary.median_r).toBe(null);
  });
});
