'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HARDMODE = path.join(ROOT, 'tradingview', 'history', 'level-reclaim', 'luke-level-reclaim-watch-hardmode.strategy.pine');
const VISUAL = path.join(ROOT, 'tradingview', 'history', 'level-reclaim', 'luke-level-reclaim-watch.pine');
const REALISTIC = path.join(ROOT, 'tradingview', 'history', 'level-reclaim', 'luke-level-reclaim-watch-realistic-accounting.pine');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

describe('Pine hard-mode slippage strategy', () => {
  it('keeps the visual file indicator-only and the hard-mode file strategy-only', () => {
    const visual = read(VISUAL);
    const realistic = read(REALISTIC);
    const hardmode = read(HARDMODE);

    expect(visual).toContain('indicator("Luke Level Reclaim Watch"');
    expect(visual).not.toContain('strategy(');
    expect(realistic).toContain('indicator("Luke Level Reclaim Watch - Realistic Accounting"');
    expect(realistic).not.toContain('strategy(');
    expect(hardmode).toContain('strategy("Luke Level Reclaim Watch Hard Mode Strategy"');
    expect(hardmode).not.toContain('indicator(');
  });

  it('keeps the realistic indicator selectable and defaults to one-way entry slippage', () => {
    const realistic = read(REALISTIC);

    expect(realistic).toContain('realistic_accounting_mode = input.string("entry_only_0_25"');
    for (const mode of [
      'commission_only',
      'entry_only_0_25',
      'exit_only_0_25',
      'both_sides_0_25_each',
      'custom_entry_only',
      'custom_exit_only',
      'custom_both_sides',
    ]) {
      expect(realistic).toContain(mode);
    }
    expect(realistic).toContain('f_round_trip_slippage_points()');
    expect(realistic).toContain('entry_price + f_entry_slippage_points()');
    expect(realistic).toContain('Realistic default charges commission plus one-way entry slippage');
    expect(realistic).not.toMatch(/webhook|brokerSubmit|submitOrder|placeOrder|LIVE_READY|EXECUTE/);
    expect(realistic).not.toMatch(/\bBUY\b|\bSELL\b/);
  });

  it('defines all required pessimistic slippage modes and manual effective prices', () => {
    const hardmode = read(HARDMODE);

    for (const mode of [
      'none',
      'entry_only_0_25',
      'exit_only_0_25',
      'both_sides_0_25_each',
      'round_trip_0_50',
      'round_trip_1_00',
      'custom_points',
    ]) {
      expect(hardmode).toContain(mode);
    }

    expect(hardmode).toContain('hard_mode_enabled = input.bool(true');
    expect(hardmode).toContain('custom_slippage_points = input.float');
    expect(hardmode).toContain('manual_entry_effective := manual_raw_entry + entry_slippage_points');
    expect(hardmode).toContain('manual_tp_effective := manual_raw_tp1 - target_exit_slippage_points');
    expect(hardmode).toContain('manual_stop_effective := manual_raw_stop - stop_exit_slippage_points');
    expect(hardmode).toContain('entry_slippage_points = f_entry_slippage_points');
    expect(hardmode).toContain('target_exit_slippage_points = f_target_exit_slippage_points');
    expect(hardmode).toContain('stop_exit_slippage_points = f_stop_exit_slippage_points');
  });

  it('models 1ES and 2ES research sizing without external broker automation', () => {
    const hardmode = read(HARDMODE);

    expect(hardmode).toContain('contract_mode = input.string("1ES_starter"');
    expect(hardmode).toContain('2ES_full');
    expect(hardmode).toContain('point_value_per_contract = 50.0');
    expect(hardmode).toContain('contracts = contract_mode == "2ES_full" ? 2.0 : 1.0');
    expect(hardmode).toContain('strategy.entry("LUKE_RESEARCH_ENTRY"');
    expect(hardmode).toContain('strategy.exit("LUKE_RESEARCH_EXIT"');
    expect(hardmode).not.toMatch(/webhook|brokerSubmit|submitOrder|placeOrder|LIVE_READY|EXECUTE/);
    expect(hardmode).not.toMatch(/\bBUY\b|\bSELL\b/);
  });
});
