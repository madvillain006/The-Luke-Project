'use strict';

const { getTradingWindowStatus } = require('../trading/common');

describe('trading common window status', () => {
  it('does not call Sunday evening futures open a Weekend blocker while keeping trading blocked', () => {
    const status = getTradingWindowStatus(new Date('2026-05-03T22:30:00Z'));

    expect(status).toEqual(expect.objectContaining({
      ok: false,
      futures_open: true,
      session: 'futures_overnight',
    }));
    expect(status.reason).toContain('outside approved cash trading window');
  });

  it('keeps Saturday fully blocked as weekend', () => {
    const status = getTradingWindowStatus(new Date('2026-05-02T18:00:00Z'));

    expect(status).toEqual(expect.objectContaining({
      ok: false,
      reason: 'Weekend',
      futures_open: false,
    }));
  });
});
