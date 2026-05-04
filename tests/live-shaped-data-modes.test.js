'use strict';

const { buildDataModeStatus } = require('../lib/trading-state/data-modes');

describe('live-shaped data modes', () => {
  it('allows replay/dev watch and paper sim only', () => {
    const mode = buildDataModeStatus({
      mode: 'replay',
      candleFeed: { replay: true, usable_for_replay: true, usable_for_live_arming: false, stale: false, source: 'local_csv' },
      marketData: { price: 7100, replay: true, usable_for_replay: true, usable_for_live_arming: false, stale: false, source: 'local/replay' },
    });

    expect(mode.mode).toBe('replay');
    expect(mode.live).toBe(false);
    expect(mode.can_generate_watch).toBe(true);
    expect(mode.can_generate_paper_candidate).toBe(true);
    expect(mode.can_generate_live_candidate).toBe(false);
    expect(mode.reason).toContain('PAPER_CANDIDATE_SIM');
  });

  it('blocks stale and UNKNOWN data from arming candidates', () => {
    const stale = buildDataModeStatus({
      mode: 'live',
      candleFeed: { source: 'UNKNOWN', stale: true, usable_for_live_arming: false },
      marketData: { price: null, source: 'UNKNOWN', stale: true },
    });

    expect(stale.can_generate_live_candidate).toBe(false);
    expect(stale.can_generate_paper_candidate).toBe(false);
    expect(stale.reason).toBe('stale or UNKNOWN data cannot arm candidates');
  });

  it('labels delayed data and leaves live arming disabled by default', () => {
    const delayed = buildDataModeStatus({
      mode: 'delayed',
      candleFeed: { source: 'test_delayed', delayed: true, live: true, usable_for_live_arming: true },
      marketData: { price: 7100, source: 'test_delayed', delayed: true, live: true, usable_for_live_arming: true },
    });

    expect(delayed.delayed).toBe(true);
    expect(delayed.can_generate_live_candidate).toBe(false);
    expect(delayed.reason).toBe('delayed data is labeled and live arming is disabled by default');
  });
});
