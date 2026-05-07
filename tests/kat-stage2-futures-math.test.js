'use strict';

const {
  grossDollarsForMove,
  netDollars,
  roundTripCommission,
  signedMovePoints,
  ticksForMove,
  trueBreakevenPoints,
} = require('../lib/kat-stage2/instruments');

describe('Kat Stage 2 futures math', () => {
  it('proves ES tick, point, and contract math', () => {
    const onePointLong = signedMovePoints('long', 5300, 5301);
    expect(onePointLong).toBe(1);
    expect(ticksForMove('ES', onePointLong)).toBe(4);
    expect(grossDollarsForMove('ES', onePointLong, 1)).toBe(50);
    expect(grossDollarsForMove('ES', onePointLong, 2)).toBe(100);

    const onePointShort = signedMovePoints('short', 5300, 5299);
    expect(ticksForMove('ES', onePointShort)).toBe(4);
    expect(grossDollarsForMove('ES', onePointShort, 2)).toBe(100);

    const oneTickLong = signedMovePoints('long', 5300, 5300.25);
    expect(ticksForMove('ES', oneTickLong)).toBe(1);
    expect(grossDollarsForMove('ES', oneTickLong, 2)).toBe(25);
  });

  it('handles per-side commission and true net breakeven', () => {
    const commission = { type: 'per_contract_per_side', amount: 2.5 };

    expect(roundTripCommission(commission, 2)).toBe(10);
    expect(netDollars(100, commission, 2, 0)).toBe(90);
    expect(trueBreakevenPoints('ES', commission, 2, 0)).toBe(0.1);
  });
});
