'use strict';

const { makeEvent } = require('../lib/research/source-timeline');
const {
  trustedLevelsAt,
  detectFakeBreakdownsForSession,
  findReclaim,
  findRetestHold,
} = require('../lib/research/fake-breakdown/detector');

describe('fake breakdown detector', () => {
  function event(id, at, price, source = 'saty', extra = {}) {
    return makeEvent({
      id,
      source,
      source_type: `${source}_levels`,
      instrument: extra.instrument || 'ES',
      timestamp_et: at,
      available_at_et: at,
      levels: [{ price, role: extra.role || 'support', ticker: extra.ticker }],
      usable_for_replay: true,
    });
  }

  it('requires trusted level to exist before the event and excludes future sources', () => {
    const levels = trustedLevelsAt([
      event('before', '2026-04-09T09:25:00-04:00', 100),
      event('after', '2026-04-09T10:10:00-04:00', 101),
    ], '2026-04-09T10:00:00-04:00');

    expect(levels.map(level => level.price)).toEqual([100]);
  });

  it('labels SPX reference levels as explicit ES proxy levels', () => {
    const levels = trustedLevelsAt([
      event('spx', '2026-04-09T09:25:00-04:00', 6700, 'bobby', { instrument: 'SPX', ticker: 'SPXW', role: 'king_node' }),
    ], '2026-04-09T10:00:00-04:00');

    expect(levels[0].price).toBe(6730);
    expect(levels[0].proxy_labels[0]).toEqual(expect.objectContaining({
      source_instrument: 'SPX',
      basis_points: 30,
      label: 'SPX_reference_to_ES_proxy',
    }));
  });

  it('detects breakdown below level and reclaim within 3/5/10/15 minute windows', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', open: 102, high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', open: 102, high: 102, low: 97.5, close: 98 },
        { timestamp: '2026-04-09T10:03:00-04:00', open: 99, high: 101, low: 98, close: 100.5 },
      ],
    };
    const candidates = detectFakeBreakdownsForSession({
      session,
      timelineEvents: [event('level', '2026-04-09T09:25:00-04:00', 100)],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(expect.objectContaining({
      valid_reclaim: true,
      breakdown_depth: 2.5,
      minutes_below_level: 3,
      windows_reclaimed: [3, 5, 10, 15],
    }));
    expect(candidates[0].entry_models[0]).toEqual(expect.objectContaining({
      model: 'reclaim_close',
      price: 100.5,
    }));
  });

  it('invalidates setup when no reclaim occurs', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', high: 102, low: 97, close: 98 },
        { timestamp: '2026-04-09T10:16:00-04:00', high: 99, low: 95, close: 99 },
      ],
    };
    const candidates = detectFakeBreakdownsForSession({
      session,
      timelineEvents: [event('level', '2026-04-09T09:25:00-04:00', 100)],
    });

    expect(candidates[0].valid_reclaim).toBe(false);
    expect(candidates[0].invalid_reason).toBe('no_reclaim_within_15m');
  });

  it('invalidates reclaim after allowed window', () => {
    const bars = [
      { timestamp: '2026-04-09T10:00:00-04:00', low: 97, close: 98 },
      { timestamp: '2026-04-09T10:16:00-04:00', low: 98, close: 100.25 },
    ];
    expect(findReclaim(bars, 0, 100, 15)).toBeNull();
  });

  it('detects retest hold after reclaim', () => {
    const bars = [
      { timestamp: '2026-04-09T10:00:00-04:00', low: 97, close: 98 },
      { timestamp: '2026-04-09T10:03:00-04:00', low: 99, close: 100.5 },
      { timestamp: '2026-04-09T10:05:00-04:00', low: 100.25, close: 101 },
    ];
    const retest = findRetestHold(bars, 1, 100);
    expect(retest.bar.timestamp).toBe('2026-04-09T10:05:00-04:00');
  });

  it('marks Mancini chop-zone candidates for chop veto analysis', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', high: 102, low: 97, close: 98 },
        { timestamp: '2026-04-09T10:03:00-04:00', high: 101, low: 98, close: 100.5 },
      ],
    };
    const candidates = detectFakeBreakdownsForSession({
      session,
      timelineEvents: [event('mancini', '2026-04-09T09:25:00-04:00', 100, 'mancini', { role: 'chop_boundary' })],
    });
    expect(candidates[0].inside_mancini_chop).toBe(true);
    expect(candidates[0].chop_veto_would_skip).toBe(true);
  });
});
