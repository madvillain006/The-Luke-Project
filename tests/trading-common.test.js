'use strict';

const {
  getLiveExecutionGate,
  getPointValue,
  getStagedExecutionGate,
  getTradingWindowStatus,
} = require('../trading/common');

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

  it('uses actual futures dollar point values', () => {
    expect(getPointValue('ES')).toBe(50);
    expect(getPointValue('MES')).toBe(5);
    expect(getPointValue('NQ')).toBe(20);
    expect(getPointValue('MNQ')).toBe(2);
  });

  it('blocks staged and live execution unless explicit operator env gates are set', () => {
    const blocked = getStagedExecutionGate({});
    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toContain('disabled by default');

    const staged = getStagedExecutionGate({ LUKE_ENABLE_STAGED_EXECUTION: 'YES_I_ACCEPT_STAGED_EXECUTION_RISK' });
    expect(staged.enabled).toBe(true);

    const liveBlocked = getLiveExecutionGate({ LUKE_ENABLE_STAGED_EXECUTION: 'YES_I_ACCEPT_STAGED_EXECUTION_RISK' });
    expect(liveBlocked.enabled).toBe(false);
    expect(liveBlocked.reason).toContain('Live execution is disabled');

    const live = getLiveExecutionGate({
      LUKE_ENABLE_STAGED_EXECUTION: 'YES_I_ACCEPT_STAGED_EXECUTION_RISK',
      LUKE_ENABLE_LIVE_EXECUTION: 'YES_I_ACCEPT_LIVE_BROKER_RISK',
    });
    expect(live.enabled).toBe(true);
  });
});
