'use strict';

const {
  ACCOUNT_25K,
  ACCOUNT_50K,
  simulateAccount,
} = require('../lib/research/fake-breakdown-state-machine/account-sim');

function signal(timestamp, pnl2 = 150, classification = '2ES_FULL') {
  return {
    setup_id: timestamp,
    date: timestamp.slice(0, 10),
    entry_timestamp_et: timestamp,
    final_state: 'TRADEABLE',
    trade_plan: { classification },
    prop: {
      pnl_2es_slip_0_5_round_trip: pnl2,
      pnl_1es_slip_0_5_round_trip: pnl2 / 2,
      staged_add_plus_1_pnl: pnl2 * 0.75,
    },
  };
}

describe('fake breakdown account simulation', () => {
  it('limits tradeable signals per day', () => {
    const rows = [
      signal('2026-04-09T10:00:00-04:00'),
      signal('2026-04-09T10:05:00-04:00'),
      signal('2026-04-09T10:10:00-04:00'),
    ];
    const sim = simulateAccount(rows, { account: ACCOUNT_25K, mode: '2ES_FULL' });
    expect(sim.day_results[0].trades).toBe(2);
    expect(sim.cumulative_pnl).toBe(300);
  });

  it('enforces max losses and daily kill', () => {
    const rows = [
      signal('2026-04-09T10:00:00-04:00', -350),
      signal('2026-04-09T10:05:00-04:00', -350),
      signal('2026-04-09T10:10:00-04:00', 150),
    ];
    const sim = simulateAccount(rows, { account: ACCOUNT_25K, mode: '2ES_FULL' });
    expect(sim.day_results[0].losses).toBe(2);
    expect(sim.day_results[0].daily_kill_triggered).toBe(true);
    expect(sim.day_results[0].trades).toBe(2);
  });

  it('tracks positive days and days to the 25k target', () => {
    const rows = [
      signal('2026-04-09T10:00:00-04:00', 500),
      signal('2026-04-10T10:00:00-04:00', 500),
      signal('2026-04-11T10:00:00-04:00', 500),
    ];
    const sim = simulateAccount(rows, { account: ACCOUNT_25K, mode: '2ES_FULL' });
    expect(sim.target_hit).toBe(true);
    expect(sim.days_to_target).toBe(3);
    expect(sim.positive_day_rate).toBe(1);
  });

  it('runs 50k previous-rule account target and drawdown settings', () => {
    const rows = [
      signal('2026-04-09T10:00:00-04:00', 1000),
      signal('2026-04-10T10:00:00-04:00', 1000),
      signal('2026-04-11T10:00:00-04:00', 1000),
    ];
    const sim = simulateAccount(rows, { account: ACCOUNT_50K, mode: '2ES_FULL' });
    expect(sim.target).toBe(3000);
    expect(sim.target_hit).toBe(true);
    expect(sim.days_to_target).toBe(3);
    expect(ACCOUNT_50K.max_eod_drawdown).toBe(2000);
  });

  it('ignores invalidated signals', () => {
    const sim = simulateAccount([{ ...signal('2026-04-09T10:00:00-04:00'), final_state: 'INVALIDATED' }], { account: ACCOUNT_25K, mode: '2ES_FULL' });
    expect(sim.signals_available).toBe(0);
    expect(sim.cumulative_pnl).toBe(0);
  });
});
