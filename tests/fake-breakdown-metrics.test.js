'use strict';

const {
  computeTradeMetrics,
  firstHit,
  mfeMae,
  rMultiple,
} = require('../lib/research/fake-breakdown/metrics');
const { resultRowsForCandidate, stopModels, targetModels } = require('../lib/research/fake-breakdown/strategy');

describe('fake breakdown metrics', () => {
  it('calculates MFE/MAE, target first, time to gains, and R multiples', () => {
    const bars = [
      { timestamp: '2026-04-09T10:01:00-04:00', high: 101, low: 99.5, close: 100.5 },
      { timestamp: '2026-04-09T10:05:00-04:00', high: 106, low: 100, close: 105 },
      { timestamp: '2026-04-09T10:10:00-04:00', high: 107, low: 98, close: 101 },
    ];
    const metrics = computeTradeMetrics({
      bars,
      entryTimestamp: '2026-04-09T10:00:00-04:00',
      entryPrice: 100,
      stopPrice: 97,
      targetPrice: 105,
    });

    expect(metrics.mfe_5m).toBe(6);
    expect(metrics.mae_5m).toBe(0.5);
    expect(metrics.target_hit_first).toBe(true);
    expect(metrics.stop_hit_first).toBe(false);
    expect(metrics.time_to_plus_5).toBe(5);
    expect(metrics.r_multiple_5m).toBeCloseTo(5 / 3, 5);
  });

  it('detects stop first versus target first', () => {
    const stopFirst = firstHit({
      bars: [{ timestamp: '2026-04-09T10:01:00-04:00', high: 101, low: 96 }],
      entryTimestamp: '2026-04-09T10:00:00-04:00',
      entryPrice: 100,
      stopPrice: 97,
      targetPrice: 105,
    });
    expect(stopFirst.first).toBe('STOP_FIRST');
  });

  it('calculates primitive helpers and stop/target model prices', () => {
    expect(mfeMae([{ high: 106, low: 98 }], 100)).toEqual({ mfe: 6, mae: 2 });
    expect(rMultiple(100, 98, 104)).toBe(2);

    const candidate = {
      sweep_low: 97.5,
      level_price: 100,
      next_trusted_level_above: 110,
    };
    expect(stopModels(candidate).map(row => row.stop_model)).toEqual(['sweep_low_minus_buffer', 'level_minus_fixed_buffer']);
    expect(targetModels(candidate, 101, 98).map(row => row.target_model)).toContain('next_trusted_level_above');
  });

  it('emits result rows without live state or execution calls', () => {
    const candidate = {
      id: 'c1',
      strategy: 'fake_breakdown_reclaim_long',
      date: '2026-04-09',
      timestamp_et: '2026-04-09T10:00:00-04:00',
      instrument: 'ES',
      level_price: 100,
      level_sources: ['saty'],
      source_combo: 'saty',
      source_freshness: {},
      valid_reclaim: true,
      level: { level_types: ['put_trigger'], proxy_labels: [] },
      breakdown_depth: 3,
      breakdown_depth_bucket: '3_to_5',
      minutes_below_level: 3,
      reclaim_timestamp_et: '2026-04-09T10:03:00-04:00',
      reclaim_window_bucket: '0_to_3',
      entry_models: [{ model: 'reclaim_close', timestamp_et: '2026-04-09T10:03:00-04:00', price: 100.5 }],
      sweep_low: 97,
      next_trusted_level_above: 105,
      inside_mancini_chop: false,
      chop_veto_would_skip: false,
      bobby_confirmed: false,
      gex_confirmed: false,
      dubz_aligned: false,
      saty_confirmed: true,
      mancini_confirmed: false,
      katbot_present: false,
      time_of_day: 'morning_1000_1130',
    };
    const rows = resultRowsForCandidate(candidate, [
      { timestamp: '2026-04-09T10:04:00-04:00', high: 106, low: 100, close: 105 },
    ]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(expect.objectContaining({
      entry_model: 'reclaim_close',
      saty_confirmed: true,
    }));
  });
});
