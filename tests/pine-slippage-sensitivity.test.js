const {
  evaluateSignals,
  slippageSensitivity,
  breakEvenSlippage,
} = require('../lib/research/pine-slippage-audit/evaluator');
const { variantOutcome } = require('../lib/research/multi-source-ladder-reclaim/staged-add-analysis');

function signal(overrides = {}) {
  return {
    id: 'sig-1',
    family: 'test',
    date: '2026-04-24',
    entry_timestamp_et: '2026-04-24T09:30:00-04:00',
    entry_index: 0,
    level: 100,
    raw_entry: 100,
    raw_stop: 98,
    raw_tp1: 101,
    no_future_outcome_filter: true,
    ...overrides,
  };
}

function bar(minute, open, high, low, close) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open, high, low, close };
}

describe('pine slippage sensitivity', () => {
  it('finds break-even round-trip slippage from a sensitivity curve', () => {
    const context = { barsByDate: new Map([['2026-04-24', [bar('30', 100, 101.25, 99.75, 101)]]]) };
    const curve = slippageSensitivity([signal()], context, [0, 0.5, 1, 1.5, 2], { sameBarPolicy: 'stop_first_hard' });
    expect(curve[0].expectancy).toBe(45);
    expect(breakEvenSlippage(curve)).toBe(0.9);
  });

  it('keeps round-trip 0.50 and 1.00 stress separate', () => {
    const context = { barsByDate: new Map([['2026-04-24', [bar('30', 100, 101.25, 99.75, 101)]]]) };
    const rt050 = evaluateSignals([signal()], context, { slippageMode: 'round_trip_0_50', sameBarPolicy: 'stop_first_hard', contracts: 1 });
    const rt100 = evaluateSignals([signal()], context, { slippageMode: 'round_trip_1_00', sameBarPolicy: 'stop_first_hard', contracts: 1 });
    expect(rt050.summary.total_pnl).toBe(20);
    expect(rt100.summary.total_pnl).toBe(-5);
  });

  it('keeps staged add PnL separate from starter PnL', () => {
    const row = {
      setup_id: 'setup-1',
      date: '2026-04-24',
      entry_timestamp_et: '2026-04-24T09:30:00-04:00',
      entry_price: 100,
      stop_price: 98,
      stop_points: 2,
      tp1_hit: true,
      stop_first: false,
      same_bar_ambiguity: false,
      next_cluster_target: 102,
      second_cluster_target: 104,
      time_to_tp1: 1,
    };
    const bars = [
      bar('30', 100, 100.5, 99.5, 100.25),
      bar('31', 100.25, 101.25, 100.5, 101),
      bar('32', 101, 103.25, 100.75, 103),
    ];
    const outcome = variantOutcome(row, bars, '1ES_ADD_AFTER_PLUS_1');
    expect(outcome.add_triggered).toBe(true);
    expect(outcome.pnl).toBeGreaterThan(75);
  });
});
