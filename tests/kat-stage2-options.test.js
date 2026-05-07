'use strict';

const {
  parseExpiryToken,
  parseOptionContracts,
  polygonOptionTicker,
} = require('../lib/kat-stage2/options');

describe('Kat Stage 2 option contract parser', () => {
  it('parses SPX 0DTE calls and builds a Polygon/Massive option ticker', () => {
    const contracts = parseOptionContracts('Buying SPX 0DTE 7300c @ 1.25', null, '2026-04-22T14:30:00.000Z');

    expect(contracts).toHaveLength(1);
    expect(contracts[0].underlying).toBe('SPX');
    expect(contracts[0].option_root).toBe('SPXW');
    expect(contracts[0].option_side).toBe('CALL');
    expect(contracts[0].strike).toBe(7300);
    expect(contracts[0].expiration_date).toBe('2026-04-22');
    expect(contracts[0].entry_premium).toBe(1.25);
    expect(contracts[0].option_ticker).toBe('O:SPXW260422C07300000');
  });

  it('parses lowercase equity option tickers from text logs', () => {
    const contracts = parseOptionContracts('buying mu 4/17 500c were 2.85', null, '2026-04-22T14:30:00.000Z');

    expect(contracts).toHaveLength(1);
    expect(contracts[0].underlying).toBe('MU');
    expect(contracts[0].option_side).toBe('CALL');
    expect(contracts[0].strike).toBe(500);
    expect(contracts[0].expiration_date).toBe('2026-04-17');
    expect(contracts[0].exit_premium).toBe(2.85);
    expect(contracts[0].option_ticker).toBe('O:MU260417C00500000');
  });

  it('captures SPX spread legs without inventing a missing expiration', () => {
    const contracts = parseOptionContracts('took off 1 7125/7130c spread from yesterday .10 to .90', null, '2026-04-22T14:30:00.000Z');

    expect(contracts).toHaveLength(1);
    expect(contracts[0].underlying).toBe('SPX');
    expect(contracts[0].expiration_date).toBeNull();
    expect(contracts[0].entry_premium).toBe(0.10);
    expect(contracts[0].exit_premium).toBe(0.90);
    expect(contracts[0].spread_legs).toEqual([
      { strike: 7125, side: 'CALL' },
      { strike: 7130, side: 'CALL' },
    ]);
    expect(contracts[0].option_ticker).toBeNull();
  });

  it('marks dated multi-leg spreads unrouteable until dedicated spread pricing exists', () => {
    const contracts = parseOptionContracts('SPX 0DTE 7125/7130c spread .10 to .90', null, '2026-04-22T14:30:00.000Z');

    expect(contracts).toHaveLength(1);
    expect(contracts[0].underlying).toBe('SPX');
    expect(contracts[0].expiration_date).toBe('2026-04-22');
    expect(contracts[0].spread_legs).toHaveLength(2);
    expect(contracts[0].option_ticker).toBeNull();
    expect(contracts[0].parse_notes).toContain('multi_leg_spread_requires_dedicated_pricing');
  });


  it('keeps explicit date parsing deterministic', () => {
    expect(parseExpiryToken('4/22', '2026-04-21T10:00:00.000Z')).toBe('2026-04-22');
    expect(polygonOptionTicker({
      underlying: 'SPY',
      expiration_date: '2026-04-22',
      strike: 730,
      option_side: 'CALL',
    })).toBe('O:SPY260422C00730000');
  });

  it('does not treat common chat words as option underlyings unless cashtagged', () => {
    expect(parseOptionContracts('sell 4/24 420c', null, '2026-04-22T14:30:00.000Z')[0].underlying).toBeNull();
    expect(parseOptionContracts('got 3/26 649p', null, '2026-04-22T14:30:00.000Z')[0].underlying).toBeNull();
    expect(parseOptionContracts('SPX dropped after 3/31 12p talk', null, '2026-04-22T14:30:00.000Z')[0].underlying).toBeNull();
    expect(parseOptionContracts('the 7/17 75c idea', null, '2026-04-22T14:30:00.000Z')[0].underlying).toBeNull();
    expect(parseOptionContracts('$DTE 4/17 120c', null, '2026-04-22T14:30:00.000Z')[0].underlying).toBe('DTE');
  });

  it('does not route impossible SPX/SPY strikes as real option tickers', () => {
    const spx = parseOptionContracts('SPX 4/24 1005c', null, '2026-04-22T14:30:00.000Z')[0];
    const spy = parseOptionContracts('SPY 3/31 12p', null, '2026-04-22T14:30:00.000Z')[0];

    expect(spx.underlying).toBe('SPX');
    expect(spx.option_ticker).toBeNull();
    expect(spx.parse_notes).toContain('implausible_strike_for_underlying');
    expect(spy.underlying).toBe('SPY');
    expect(spy.option_ticker).toBeNull();
    expect(spy.parse_notes).toContain('implausible_strike_for_underlying');
  });
});
