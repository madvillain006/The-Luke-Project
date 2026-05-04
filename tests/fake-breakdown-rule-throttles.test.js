'use strict';

const {
  clusterRuleSignals,
  signalPnl,
  simulateThrottle,
} = require('../lib/research/fake-breakdown-state-machine/rule-throttle-analysis');

function signal(overrides = {}) {
  return {
    setup_id: overrides.setup_id || `setup-${overrides.entry_timestamp_et || 'x'}`,
    rule_id: 'B',
    date: '2026-04-09',
    entry_timestamp_et: '2026-04-09T15:00:00-04:00',
    final_state: 'TRADEABLE',
    stop_points: 3,
    level: 100,
    tp2_hit: true,
    stop_first: false,
    ...overrides,
  };
}

describe('fake breakdown rule throttle analysis', () => {
  it('limits Rule B to max one trade per day when requested', () => {
    const result = simulateThrottle([
      signal({ entry_timestamp_et: '2026-04-09T15:00:00-04:00' }),
      signal({ entry_timestamp_et: '2026-04-09T15:15:00-04:00' }),
      signal({ entry_timestamp_et: '2026-04-09T15:30:00-04:00' }),
    ], { maxTradesPerDay: 1 });

    expect(result.day_results[0].trades).toBe(1);
    expect(result.cumulative_pnl).toBe(150);
  });

  it('stops after the first loss and after a daily profit stop', () => {
    const lossThenWin = [
      signal({ entry_timestamp_et: '2026-04-09T15:00:00-04:00', tp2_hit: false, stop_first: true }),
      signal({ entry_timestamp_et: '2026-04-09T15:15:00-04:00', tp2_hit: true, stop_first: false }),
    ];
    const firstLoss = simulateThrottle(lossThenWin, { stopAfterFirstLoss: true, maxTradesPerDay: 2 });
    expect(firstLoss.day_results[0].trades).toBe(1);
    expect(firstLoss.cumulative_pnl).toBe(-350);

    const profitStop = simulateThrottle([
      signal({ entry_timestamp_et: '2026-04-09T15:00:00-04:00' }),
      signal({ entry_timestamp_et: '2026-04-09T15:15:00-04:00' }),
    ], { dailyProfitStop: 150, maxTradesPerDay: 2 });
    expect(profitStop.day_results[0].trades).toBe(1);
    expect(profitStop.cumulative_pnl).toBe(150);
  });

  it('skips repeat same-level signals after that level loses', () => {
    const result = simulateThrottle([
      signal({ setup_id: 'loss', entry_timestamp_et: '2026-04-09T15:00:00-04:00', level: 100, tp2_hit: false, stop_first: true }),
      signal({ setup_id: 'repeat', entry_timestamp_et: '2026-04-09T15:15:00-04:00', level: 100, tp2_hit: true, stop_first: false }),
      signal({ setup_id: 'new-level', entry_timestamp_et: '2026-04-09T15:30:00-04:00', level: 101, tp2_hit: true, stop_first: false }),
    ], { noRepeatSameLevelAfterLoss: true, maxTradesPerDay: 3 });

    expect(result.day_results[0].taken.map(row => row.setup_id)).toEqual(['loss', 'new-level']);
    expect(result.cumulative_pnl).toBe(-200);
  });

  it('calculates 1ES starter PnL with the same slippage assumption', () => {
    expect(signalPnl(signal({ tp2_hit: true, stop_first: false }), '1ES_STARTER')).toBe(75);
    expect(signalPnl(signal({ tp2_hit: false, stop_first: true }), '1ES_STARTER')).toBe(-175);
  });

  it('clusters wins and losses by day and week', () => {
    const result = clusterRuleSignals([
      signal({ rule_id: 'A', date: '2026-04-06', entry_timestamp_et: '2026-04-06T15:00:00-04:00', tp2_hit: true, stop_first: false }),
      signal({ rule_id: 'A', date: '2026-04-06', entry_timestamp_et: '2026-04-06T15:15:00-04:00', tp2_hit: false, stop_first: true }),
      signal({ rule_id: 'A', date: '2026-04-07', entry_timestamp_et: '2026-04-07T15:00:00-04:00', tp2_hit: true, stop_first: false }),
      signal({ rule_id: 'B', date: '2026-04-07', entry_timestamp_et: '2026-04-07T15:30:00-04:00', tp2_hit: true, stop_first: false }),
    ], 'A');

    expect(result.total_signals).toBe(3);
    expect(result.by_day).toHaveLength(2);
    expect(result.by_day.find(row => row.date === '2026-04-06')).toEqual(expect.objectContaining({
      signals: 2,
      winners: 1,
      losers: 1,
      pnl_2es: -200,
    }));
    expect(result.by_week[0]).toEqual(expect.objectContaining({ signals: 3, winners: 2, losers: 1 }));
  });
});
