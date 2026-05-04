'use strict';

const {
  assertFilterUsesAllowed,
  buildPredicates,
  applyFilters,
} = require('../lib/research/fake-breakdown-v3/filters');
const {
  sweepDepthBucket,
  timeBelowBucket,
  bobbyTargetDistanceBucket,
  entryModelGroup,
  extractPreEntryFeatures,
  scalpPnl,
} = require('../lib/research/fake-breakdown-v3/feature-extractor');

describe('fake breakdown v3 pre-entry filters', () => {
  it('allows declared pre-entry fields and rejects future outcome fields', () => {
    expect(() => assertFilterUsesAllowed(['bobby_heatmap_target_present', 'entry_model_group'])).not.toThrow();
    expect(() => assertFilterUsesAllowed(['max_heat_before_tp1'])).toThrow(/future outcome/);
    expect(() => assertFilterUsesAllowed(['mfe_5m'])).toThrow(/future outcome/);
    expect(() => assertFilterUsesAllowed(['tp1_hit'])).toThrow(/future outcome/);
  });

  it('buckets observable sweep, time-below, target distance, and entry model values', () => {
    expect(sweepDepthBucket(1.5)).toBe('1_to_2');
    expect(sweepDepthBucket(2.5)).toBe('2_to_3');
    expect(sweepDepthBucket(4)).toBe('3_to_5');
    expect(sweepDepthBucket(6)).toBe('gt_5');
    expect(timeBelowBucket(3)).toBe('lte_3');
    expect(timeBelowBucket(7)).toBe('lte_10');
    expect(bobbyTargetDistanceBucket(3)).toBe('2_to_4');
    expect(bobbyTargetDistanceBucket(6)).toBe('4_to_8');
    expect(entryModelGroup('2_candle_hold')).toBe('two_candle_hold_above_level');
    expect(entryModelGroup('micro_pivot_break')).toBe('micro_pivot_break');
  });

  it('extracts reclaim quality and acceptance only through entry timestamp', () => {
    const setup = {
      executable_level: 100,
      reclaim_timestamp: '2026-04-09T10:00:00-04:00',
      valid_reclaim: true,
      minutes_below_level: 2,
      breakdown_depth_actual: 2.5,
    };
    const row = {
      setup_id: 's1',
      entry_model: '2_candle_hold',
      entry_timestamp_et: '2026-04-09T10:01:00-04:00',
      entry_price: 101,
      executable_level: 100,
      bobby_heatmap_target_present: true,
      stop_points: 3,
      inside_chop: false,
      valid_reclaim: true,
    };
    const bars = [
      { timestamp: '2026-04-09T10:00:00-04:00', open: 99, high: 101, low: 98, close: 100.75 },
      { timestamp: '2026-04-09T10:01:00-04:00', open: 100.75, high: 101.25, low: 100.25, close: 101 },
      { timestamp: '2026-04-09T10:02:00-04:00', open: 101, high: 101.25, low: 95, close: 96 },
    ];
    const features = extractPreEntryFeatures({ row, setup, bars, bobbyDistance: { target_distance: 3.5 } });
    expect(features.two_closes_above_level).toBe(true);
    expect(features.no_close_below_before_entry).toBe(true);
    expect(features.reclaim_close_upper_half).toBe(true);
    expect(features.bobby_target_distance_bucket).toBe('2_to_4');
  });

  it('applies only allowlisted predicates to rows', () => {
    const rows = [
      { bobby_heatmap_target_present: true, entry_model_group: 'micro_pivot_break', stop_within_preferred: true },
      { bobby_heatmap_target_present: false, entry_model_group: 'micro_pivot_break', stop_within_preferred: true },
    ];
    const filters = buildPredicates().filter(filter => filter.id === 'bobby_target_present');
    expect(applyFilters(rows, filters)).toHaveLength(1);
  });

  it('applies slippage to TP and stop outcomes', () => {
    expect(scalpPnl({ row: { stop_points: 3, tp1_hit: true }, targetPoints: 2, contracts: 2, slippageRoundTrip: 0.5 })).toBe(150);
    expect(scalpPnl({ row: { stop_points: 3, stop_first: true }, targetPoints: 2, contracts: 2, slippageRoundTrip: 0.5 })).toBe(-350);
  });
});
