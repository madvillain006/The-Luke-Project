const { slippageModel, applyLongSlippage } = require('../lib/research/pine-slippage-audit/slippage-models');
const fs = require('fs');
const path = require('path');
const {
  ACCOUNT_RULES,
  evaluateSignals,
  summarizeTrades,
} = require('../lib/research/pine-slippage-audit/evaluator');

function signal(overrides = {}) {
  return {
    id: 'sig-1',
    family: 'test',
    date: '2026-04-24',
    entry_timestamp_et: '2026-04-24T09:31:00-04:00',
    entry_index: 0,
    level: 100,
    raw_entry: 100,
    raw_stop: 98,
    raw_tp1: 102,
    no_future_outcome_filter: true,
    ...overrides,
  };
}

function bar(minute, high, low, close = 100) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open: 100, high, low, close };
}

describe('pine slippage audit evaluator', () => {
  it('keeps the generated historical report out of canonical docs', () => {
    const report = fs.readFileSync(path.join(__dirname, '..', 'lib', 'research', 'pine-slippage-audit', 'report.js'), 'utf8');
    expect(report).toContain("path.join(AUDIT_DIR, 'PINE_SLIPPAGE_HISTORICAL_AUDIT.md')");
    expect(report).not.toContain("path.join(ROOT, 'docs', 'PINE_SLIPPAGE_HISTORICAL_AUDIT.md')");
  });

  it('applies entry-only, exit-only, both-side, and round-trip slippage exactly like hard-mode Pine', () => {
    expect(applyLongSlippage(signal(), slippageModel('entry_only_0_25'))).toEqual(expect.objectContaining({
      entry_effective: 100.25,
      stop_effective: 98,
      tp1_effective: 102,
    }));
    expect(applyLongSlippage(signal(), slippageModel('exit_only_0_25'))).toEqual(expect.objectContaining({
      entry_effective: 100,
      stop_effective: 97.75,
      tp1_effective: 101.75,
    }));
    expect(applyLongSlippage(signal(), slippageModel('both_sides_0_25_each'))).toEqual(expect.objectContaining({
      entry_effective: 100.25,
      stop_effective: 97.75,
      tp1_effective: 101.75,
    }));
    expect(applyLongSlippage(signal(), slippageModel('round_trip_1_00'))).toEqual(expect.objectContaining({
      entry_effective: 100.5,
      stop_effective: 97.5,
      tp1_effective: 101.5,
    }));
  });

  it('calculates 1ES and 2ES PnL with commission', () => {
    const context = { barsByDate: new Map([['2026-04-24', [bar('31', 102, 99, 101)]]]) };
    const one = evaluateSignals([signal()], context, { slippageMode: 'none', sameBarPolicy: 'stop_first_hard', contracts: 1 });
    const two = evaluateSignals([signal()], context, { slippageMode: 'none', sameBarPolicy: 'stop_first_hard', contracts: 2 });
    expect(one.summary.total_pnl).toBe(95);
    expect(two.summary.total_pnl).toBe(190);
  });

  it('turns a same-bar optimistic win into a hard-mode loss', () => {
    const context = { barsByDate: new Map([['2026-04-24', [bar('31', 102.5, 97.5, 100)]]]) };
    const hard = evaluateSignals([signal()], context, { slippageMode: 'none', sameBarPolicy: 'stop_first_hard', contracts: 1 });
    const optimistic = evaluateSignals([signal()], context, { slippageMode: 'none', sameBarPolicy: 'target_first_optimistic', contracts: 1 });
    expect(hard.summary.wins_converted_to_losses).toBe(1);
    expect(hard.summary.total_pnl).toBe(-105);
    expect(optimistic.summary.total_pnl).toBe(95);
  });

  it('does not use future outcome bars to create or filter supplied signals', () => {
    const setup = signal({ raw_tp1: 110 });
    const context = { barsByDate: new Map([['2026-04-24', [bar('31', 101, 99, 100), bar('32', 111, 100, 110)]]]) };
    const result = evaluateSignals([setup], context, { slippageMode: 'none', sameBarPolicy: 'stop_first_hard', contracts: 1 });
    expect(result.summary.total_signals).toBe(1);
    expect(result.summary.tp1_hit).toBe(1);
    expect(setup.no_future_outcome_filter).toBe(true);
  });

  it('treats eval profit targets as cumulative milestones, not viability filters', () => {
    const context = { barsByDate: new Map([['2026-04-24', [bar('31', 102, 99, 101)]]]) };
    const result = evaluateSignals([signal()], context, {
      slippageMode: 'none',
      sameBarPolicy: 'stop_first_hard',
      contracts: 1,
      account: '25k_eval',
    });
    expect(result.summary.total_pnl).toBe(95);
    expect(result.summary.eval_target_hit).toBe(false);
    expect(result.summary.net_profitable).toBe(true);
    expect(result.summary.account_viable_net_profitable).toBe(true);
  });

  it('uses the posted 25K and 50K DLL rules without fabricating a 25K daily limit', () => {
    const sixLosingTrades = Array.from({ length: 6 }, (_, index) => ({
      date: '2026-04-24',
      entry_timestamp_et: `2026-04-24T09:3${index}:00-04:00`,
      pnl_dollars: -105,
    }));
    const twentyFourLosingTrades = Array.from({ length: 24 }, (_, index) => ({
      date: '2026-04-24',
      entry_timestamp_et: `2026-04-24T10:${String(index).padStart(2, '0')}:00-04:00`,
      pnl_dollars: -55,
    }));

    const eval25 = summarizeTrades({ totalSignals: 6, trades: sixLosingTrades, account: '25k_eval' });
    const eval50 = summarizeTrades({ totalSignals: 24, trades: twentyFourLosingTrades, account: '50k_eval' });

    expect(ACCOUNT_RULES['25k_eval'].dailyLossLimit).toBeNull();
    expect(eval25.daily_drawdown_failures).toBe(0);
    expect(eval25.account_fail).toBe(false);
    expect(ACCOUNT_RULES['50k_eval'].dailyLossLimit).toBe(1200);
    expect(eval50.daily_drawdown_failures).toBe(1);
    expect(eval50.account_fail).toBe(true);
  });
});
