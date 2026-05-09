const {
  parseBridgeEvents,
  parseLukeIdTimestamp,
  parseNinjaLogEvents,
  summarizeLatency,
} = require('../lib/ninja-bridge-latency');

describe('Ninja bridge latency analysis', () => {
  it('extracts Pine realtime milliseconds from Luke signal ids', () => {
    expect(parseLukeIdTimestamp('luke-long-1778251200372-22-7413.25')).toBe('2026-05-08T14:40:00.372Z');
    expect(parseLukeIdTimestamp('doctor-ping-1778251979255')).toBe(null);
  });

  it('summarizes source-to-Luke and Luke-to-Ninja latency', () => {
    const bridgeEvents = parseBridgeEvents([
      JSON.stringify({
        ts: '2026-05-08T14:40:04.426Z',
        type: 'luke_long_signal_saved',
        id: 'luke-long-1778251200372-22-7413.25',
        symbol: 'ES1!',
        entry: 7413.25,
      }),
      JSON.stringify({
        ts: '2026-05-08T14:40:32.400Z',
        type: 'luke_cancel_signal_saved',
        id: 'luke-long-1778251200372-22-7413.25',
        symbol: 'ES1!',
        created_at: '2026-05-08T14:40:29.000Z',
      }),
      JSON.stringify({
        ts: '2026-05-08T14:41:32.400Z',
        type: 'luke_cancel_signal_saved',
        id: 'luke-long-1778251200372-22-7413.25',
        symbol: 'ES1!',
      }),
    ].join('\n'));

    const ninjaEvents = parseNinjaLogEvents([
      "2026-05-08 10:40:04:562|1|16|LUKE SIM LONG luke-long-1778251200372-22-7413.25 qty=2 t1=1 t2=1 entry=7413.25 stop=7410.00 tp1=7415.25 tp2=7418.25 mode=LimitAtLukeEntry class=SCALP_VALID profile=default model=confirmed_retest_limit expiry=600s pollMs=100",
      "2026-05-08 10:40:32:489|1|16|LUKE SIM CANCEL luke-long-1778251200372-22-7413.25 no active order or long position",
    ].join('\n'));

    const summary = summarizeLatency(bridgeEvents, ninjaEvents);
    expect(summary.rows[0]).toMatchObject({
      source_to_luke_ms: 4054,
      luke_to_ninja_ms: 136,
      ninja_type: 'ninja_long_submitted',
    });
    expect(summary.rows[1]).toMatchObject({
      source_to_luke_ms: 3400,
      luke_to_ninja_ms: 89,
      ninja_type: 'ninja_cancel_seen',
    });
    expect(summary.stats.source_to_luke_ms.count).toBe(2);
    expect(summary.rows[2].source_to_luke_ms).toBe(null);
    expect(summary.stats.luke_to_ninja_ms.count).toBe(2);
  });

  it('flags duplicate LONGs, cancel timing, and bridge events with no Ninja match', () => {
    const duplicateId = 'luke-long-1778251200372-22-7413.25';
    const missingId = 'luke-long-1778251260000-22-7416.25';
    const bridgeEvents = parseBridgeEvents([
      JSON.stringify({
        ts: '2026-05-08T14:40:04.426Z',
        type: 'luke_long_signal_saved',
        id: duplicateId,
        symbol: 'ES1!',
        entry: 7413.25,
      }),
      JSON.stringify({
        ts: '2026-05-08T14:40:05.100Z',
        type: 'luke_long_signal_saved',
        id: duplicateId,
        symbol: 'ES1!',
        entry: 7413.25,
      }),
      JSON.stringify({
        ts: '2026-05-08T14:40:08.000Z',
        type: 'luke_long_signal_saved',
        id: missingId,
        symbol: 'ES1!',
        entry: 7416.25,
      }),
      JSON.stringify({
        ts: '2026-05-08T14:40:32.400Z',
        type: 'luke_cancel_signal_saved',
        id: duplicateId,
        symbol: 'ES1!',
        created_at: '2026-05-08T14:40:29.000Z',
      }),
    ].join('\n'));

    const ninjaEvents = parseNinjaLogEvents([
      `2026-05-08 10:40:04:562|1|16|LUKE SIM LONG ${duplicateId} qty=2 entry=7413.25`,
      `2026-05-08 10:40:05:250|1|16|LUKE SIM LONG ${duplicateId} qty=2 entry=7413.25`,
      `2026-05-08 10:40:32:489|1|16|LUKE SIM CANCEL ${duplicateId} no active order or long position`,
    ].join('\n'));

    const summary = summarizeLatency(bridgeEvents, ninjaEvents);
    expect(summary.parity.counts).toMatchObject({
      bridge_events: 4,
      bridge_longs: 3,
      bridge_cancels: 1,
      matched: 3,
      no_ninja_match: 1,
    });
    expect(summary.parity.duplicate_longs.bridge).toEqual([expect.objectContaining({
      id: duplicateId,
      count: 2,
    })]);
    expect(summary.parity.duplicate_longs.ninja).toEqual([expect.objectContaining({
      id: duplicateId,
      count: 2,
    })]);
    expect(summary.parity.cancel_timing).toEqual([expect.objectContaining({
      id: duplicateId,
      cancel_after_long_ms: 27300,
      cancel_after_ninja_long_ms: 27150,
      luke_to_ninja_cancel_ms: 89,
    })]);
    expect(summary.parity.no_ninja_match).toEqual([expect.objectContaining({
      id: missingId,
      kind: 'long',
    })]);
    expect(summary.parity.readiness).toMatchObject({
      status: 'review',
      blockers: ['no_ninja_match', 'duplicate_bridge_longs', 'duplicate_ninja_longs'],
      matched_ratio: 0.75,
    });
  });
});
