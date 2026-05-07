'use strict';

const { backtestTrade } = require('../lib/kat-stage2/backtest');

function candles(rows) {
  return rows.map(row => ({
    symbol: 'ES',
    timestamp_utc: row[0],
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: 100,
  }));
}

function trade(overrides = {}) {
  return {
    trade_id: overrides.trade_id || 't1',
    analyst_id: 'u1',
    analyst_name: 'analyst1',
    timestamp_utc: '2026-04-22T14:00:00.000Z',
    normalized_symbol: 'ES',
    direction: 'long',
    entry_type: 'market',
    entry_price: null,
    entry_zone_low: null,
    entry_zone_high: null,
    stop_price: 5298,
    take_profit_1: 5304,
    take_profit_2: null,
    take_profit_3: null,
    take_profit_more: [],
    partial_exit_plan: null,
    parser_confidence: 0.9,
    parse_status: 'valid',
    ...overrides,
  };
}

function md(c) {
  return { bySymbol: { ES: c }, coverage: { ES: { replay: true } } };
}

function optionMd(optionTicker, rows) {
  return {
    bySymbol: {
      [optionTicker]: rows.map(row => ({
        symbol: optionTicker,
        timestamp_utc: row[0],
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: 100,
      })),
    },
    coverage: { [optionTicker]: { replay: true, source: 'polygon_aggs' } },
  };
}

describe('Kat Stage 2 backtester', () => {
  it('handles target hit and stop hit', () => {
    const win = backtestTrade(trade(), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
      ['2026-04-22T14:02:00.000Z', 5300, 5305, 5299, 5304],
    ])));
    const loss = backtestTrade(trade(), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
      ['2026-04-22T14:02:00.000Z', 5300, 5301, 5297, 5298],
    ])));

    expect(win.outcome).toBe('win');
    expect(win.gross_points).toBe(4);
    expect(loss.outcome).toBe('loss');
    expect(loss.gross_points).toBe(-2);
  });

  it('handles breakeven update, partial then stop, unresolved, no-fill, breakout fill, and intrabar ambiguity', () => {
    const be = backtestTrade(trade(), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5302, 5299, 5301],
      ['2026-04-22T14:03:00.000Z', 5301, 5302, 5300, 5300],
    ])), {
      linkedUpdates: [{ trade_id: 't1', update_type: 'moved_to_breakeven', timestamp_utc: '2026-04-22T14:02:00.000Z' }],
    });
    expect(be.outcome).toBe('breakeven');
    expect(be.exit_price).toBe(5300);

    const partial = backtestTrade(trade({ partial_exit_plan: 'take 50%' }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5305, 5299, 5304],
      ['2026-04-22T14:02:00.000Z', 5304, 5304, 5298, 5298],
    ])));
    expect(partial.outcome).toBe('partial');

    const unresolved = backtestTrade(trade({ take_profit_1: null, stop_price: null }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
    ])), { maxHoldMinutes: 1 });
    expect(unresolved.outcome).toBe('unresolved');

    const noFill = backtestTrade(trade({ entry_type: 'limit', entry_price: 5290 }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
    ])));
    expect(noFill.outcome).toBe('no_fill');

    const gap = backtestTrade(trade(), md(candles([
      ['2026-04-23T14:01:00.000Z', 5300, 5301, 5299, 5300],
    ])));
    expect(gap.outcome).toBe('no_fill');
    expect(gap.assumptions_used).toContain('market_data_gap_after_call');

    const breakout = backtestTrade(trade({ entry_type: 'breakout', entry_price: 5302 }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
      ['2026-04-22T14:02:00.000Z', 5301, 5303, 5300, 5302],
      ['2026-04-22T14:03:00.000Z', 5302, 5305, 5302, 5304],
    ])));
    expect(breakout.assumed_entry_price).toBe(5302);

    const ambiguous = backtestTrade(trade(), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5304, 5298, 5301],
    ])));
    expect(ambiguous.outcome).toBe('intrabar_ambiguous');
  });

  it('rejects impossible explicit close prices instead of scoring them as index exits', () => {
    const result = backtestTrade(trade({ take_profit_1: null, stop_price: null }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
      ['2026-04-22T14:02:00.000Z', 5300, 5301, 5299, 5300],
    ])), {
      linkedUpdates: [{
        trade_id: 't1',
        update_type: 'closed',
        timestamp_utc: '2026-04-22T14:02:00.000Z',
        price: 1,
      }],
      maxHoldMinutes: 2,
    });

    expect(result.outcome).toBe('unresolved');
    expect(result.assumptions_used).not.toContain('explicit_update_closed');
  });

  it('ignores implausible option-like stop and target numbers for index candles', () => {
    const result = backtestTrade(trade({ stop_price: 8, take_profit_1: 1 }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5304, 5298, 5301],
      ['2026-04-22T14:02:00.000Z', 5301, 5305, 5297, 5302],
    ])), { maxHoldMinutes: 2 });

    expect(result.outcome).toBe('unresolved');
    expect(result.assumptions_used).toContain('ignored_implausible_stop_price');
    expect(result.assumptions_used).toContain('ignored_implausible_target_price');
  });

  it('ignores stop and target levels on the wrong side of the trade', () => {
    const result = backtestTrade(trade({
      direction: 'short',
      stop_price: 5298,
      take_profit_1: 5304,
    }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5304, 5298, 5301],
      ['2026-04-22T14:02:00.000Z', 5301, 5305, 5297, 5302],
    ])), { maxHoldMinutes: 2 });

    expect(result.outcome).toBe('unresolved');
    expect(result.assumptions_used).toContain('ignored_wrong_side_stop_price');
    expect(result.assumptions_used).toContain('ignored_wrong_side_target_price');
    expect(result.r_multiple).toBe(null);
  });

  it('treats zero-point stop hits as breakeven, not losses', () => {
    const simulated = backtestTrade(trade({ stop_price: 5300, take_profit_1: null }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
    ])));
    const explicit = backtestTrade(trade({ take_profit_1: null, stop_price: null }), md(candles([
      ['2026-04-22T14:01:00.000Z', 5300, 5301, 5299, 5300],
    ])), {
      linkedUpdates: [{
        trade_id: 't1',
        update_type: 'stop_hit',
        timestamp_utc: '2026-04-22T14:01:30.000Z',
        price: 5300,
      }],
    });

    expect(simulated.outcome).toBe('breakeven');
    expect(simulated.gross_points).toBe(0);
    expect(explicit.outcome).toBe('breakeven');
    expect(explicit.gross_points).toBe(0);
  });

  it('scores option contracts only from exact option premium bars', () => {
    const optionTicker = 'O:SPY260422C00730000';
    const result = backtestTrade(trade({
      normalized_symbol: 'SPY',
      asset_class: 'option',
      direction: 'long',
      entry_type: 'limit',
      entry_price: 1.00,
      stop_price: null,
      take_profit_1: null,
      option_contract: {
        underlying: 'SPY',
        option_ticker: optionTicker,
        option_side: 'CALL',
        strike: 730,
        expiration_date: '2026-04-22',
        entry_premium: 1.00,
        exit_premium: 1.50,
      },
    }), optionMd(optionTicker, [
      ['2026-04-22T14:01:00.000Z', 1.00, 1.10, 0.95, 1.05],
      ['2026-04-22T14:02:00.000Z', 1.05, 1.50, 1.00, 1.50],
    ]));

    expect(result.market_symbol).toBe(optionTicker);
    expect(result.outcome).toBe('win');
    expect(result.gross_points).toBe(0.5);
    expect(result.gross_ticks).toBe(50);
    expect(result.gross_dollars).toBe(50);
  });

  it('does not score multi-leg spreads as one-leg option trades', () => {
    const optionTicker = 'O:SPXW260422C07125000';
    const result = backtestTrade(trade({
      normalized_symbol: 'SPX',
      asset_class: 'option',
      direction: 'long',
      option_contract: {
        underlying: 'SPX',
        option_ticker: optionTicker,
        option_side: 'CALL',
        strike: 7125,
        expiration_date: '2026-04-22',
        entry_premium: 0.10,
        exit_premium: 0.90,
        spread_legs: [
          { strike: 7125, side: 'CALL' },
          { strike: 7130, side: 'CALL' },
        ],
      },
    }), optionMd(optionTicker, [
      ['2026-04-22T14:01:00.000Z', 0.10, 0.90, 0.10, 0.90],
    ]));

    expect(result.outcome).toBe('invalid');
    expect(result.assumptions_used).toContain('multi_leg_option_spread_pricing_unavailable');
  });

  it('ignores explicit option exits that name a different contract ticker', () => {
    const optionTicker = 'O:SPY260422C00730000';
    const mismatchTicker = 'O:SPY260422P00730000';
    const result = backtestTrade(trade({
      normalized_symbol: 'SPY',
      asset_class: 'option',
      direction: 'long',
      stop_price: null,
      take_profit_1: null,
      option_contract: {
        underlying: 'SPY',
        option_ticker: optionTicker,
        option_side: 'CALL',
        strike: 730,
        expiration_date: '2026-04-22',
        entry_premium: 1.00,
      },
    }), optionMd(optionTicker, [
      ['2026-04-22T14:01:00.000Z', 1.00, 1.05, 0.95, 1.00],
      ['2026-04-22T14:02:00.000Z', 1.00, 1.05, 0.95, 1.00],
    ]), {
      linkedUpdates: [{
        trade_id: 't1',
        update_type: 'closed',
        timestamp_utc: '2026-04-22T14:02:00.000Z',
        price: 1.50,
        option_ticker: mismatchTicker,
      }],
      maxHoldMinutes: 2,
    });

    expect(result.outcome).toBe('unresolved');
    expect(result.assumptions_used).not.toContain('explicit_update_closed');
  });

  it('does not proxy option P&L through underlying candles when contract bars are missing', () => {
    const optionTicker = 'O:SPY260422C00730000';
    const result = backtestTrade(trade({
      normalized_symbol: 'SPY',
      asset_class: 'option',
      direction: 'long',
      option_contract: {
        underlying: 'SPY',
        option_ticker: optionTicker,
        option_side: 'CALL',
        strike: 730,
        expiration_date: '2026-04-22',
      },
    }), {
      bySymbol: {
        SPY: [{ timestamp_utc: '2026-04-22T14:01:00.000Z', open: 530, high: 531, low: 529, close: 530 }],
      },
      coverage: { SPY: { replay: true } },
    });

    expect(result.outcome).toBe('invalid');
    expect(result.assumptions_used).toContain('option_contract_market_data_missing_' + optionTicker);
  });
});
