'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const READABLE_PINE = path.join(ROOT, 'tradingview', 'history', 'production-ledger', 'luke-watch-production-test-readable-ledger.pine');
const SIMULATION_PINE = path.join(ROOT, 'tradingview', 'history', 'production-ledger', 'luke-watch-production-test-simulation.strategy.pine');

function slippagePoints(mode, custom = 0.25) {
  const entry =
    mode === 'entry_only_0_25' || mode === 'both_sides_0_25_each'
      ? 0.25
      : mode === 'custom_entry_only' || mode === 'custom_both_sides'
        ? custom
        : 0;
  const exit =
    mode === 'exit_only_0_25' || mode === 'both_sides_0_25_each'
      ? 0.25
      : mode === 'custom_exit_only' || mode === 'custom_both_sides'
        ? custom
        : 0;

  return { entry, exit, roundTrip: entry + exit };
}

function eventCost({ contracts, pointValue = 50, mode = 'entry_only_0_25', commission = 5, sizeMode = '2ES split' }) {
  if (sizeMode === 'watch only') return 0;
  return ((slippagePoints(mode).roundTrip * pointValue) + commission) * contracts;
}

function eventNet({ eventPoints, contracts, pointValue = 50, mode = 'entry_only_0_25', commission = 5, sizeMode = '2ES split' }) {
  return eventPoints * pointValue - eventCost({ contracts, pointValue, mode, commission, sizeMode });
}

describe('Pine realistic accounting math', () => {
  it('keeps the readable indicator on the same gross-points minus per-contract-cost formula', () => {
    const pine = fs.readFileSync(READABLE_PINE, 'utf8');

    expect(pine).toContain('pnl_dollars_per_point = pnl_point_value_mode == "custom"');
    expect(pine).toContain('pnl_point_value_mode == "ES" ? 50.0');
    expect(pine).toContain('pnl_point_value_mode == "MES" ? 5.0');
    expect(pine).toContain('f_round_trip_slippage_points() * pnl_dollars_per_point');
    expect(pine).toContain('commission_per_contract_round_trip) * contracts');
    expect(pine).toContain('event_points * pnl_dollars_per_point - f_event_cost_dollars(contracts)');
    expect(pine).toContain('split_contract_pnl and not tp1_already_hit ? 2.0 : 1.0');
    expect(pine).toContain('split_contract_pnl ? 1.0 : 0.0');
  });

  it('charges default one-way 0.25 point slippage plus round-trip commission per ES contract event', () => {
    expect(eventCost({ contracts: 1, pointValue: 50, mode: 'entry_only_0_25' })).toBe(17.5);
    expect(eventCost({ contracts: 1, pointValue: 50, mode: 'exit_only_0_25' })).toBe(17.5);
    expect(eventCost({ contracts: 1, pointValue: 50, mode: 'both_sides_0_25_each' })).toBe(30);
    expect(eventCost({ contracts: 2, pointValue: 50, mode: 'entry_only_0_25' })).toBe(35);
  });

  it('calculates 1ES TP1 net dollars from points times $50 minus one contract cost', () => {
    const entry = 100;
    const tp1 = 102;

    expect(eventNet({ eventPoints: tp1 - entry, contracts: 1 })).toBe(82.5);
  });

  it('calculates 2ES split TP1 plus TP2 as contract-points, not chart points', () => {
    const entry = 100;
    const tp1 = 102;
    const tp2 = 107;
    const contractPoints = (tp1 - entry) + (tp2 - entry);

    expect(contractPoints).toBe(9);
    expect(eventNet({ eventPoints: contractPoints, contracts: 2 })).toBe(415);
  });

  it('calculates 2ES TP1 plus runner breakeven as TP1 gain minus two contract costs', () => {
    const tp1ExitNet = eventNet({ eventPoints: 2, contracts: 1 });
    const runnerBreakevenNet = eventNet({ eventPoints: 0, contracts: 1 });

    expect(tp1ExitNet).toBe(82.5);
    expect(runnerBreakevenNet).toBe(-17.5);
    expect(tp1ExitNet + runnerBreakevenNet).toBe(65);
  });

  it('calculates 2ES stop before TP1 as two stopped contracts', () => {
    const entry = 100;
    const stop = 96.5;
    const contractPoints = (stop - entry) * 2;

    expect(contractPoints).toBe(-7);
    expect(eventNet({ eventPoints: contractPoints, contracts: 2 })).toBe(-385);
  });

  it('uses MES $5 point value when the selected size mode is MES', () => {
    const entry = 100;
    const tp1 = 102;
    const tp2 = 107;
    const contractPoints = (tp1 - entry) + (tp2 - entry);

    expect(eventNet({ eventPoints: contractPoints, contracts: 2, pointValue: 5, sizeMode: '2MES split' })).toBe(32.5);
  });

  it('keeps Strategy Tester accounting separate from visual accounting', () => {
    const strategy = fs.readFileSync(SIMULATION_PINE, 'utf8');

    expect(strategy).toContain('commission_type=strategy.commission.cash_per_contract');
    expect(strategy).toContain('commission_value=2.5');
    expect(strategy).toContain('slippage=1');
    expect(strategy).toContain('f_strategy_contract_qty()');
  });
});
