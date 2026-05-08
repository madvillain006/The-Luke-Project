const {
  parseNativeTelemetry,
  summarizeNativeTelemetry,
} = require('../lib/ninja-native-telemetry');

describe('Ninja-native shadow telemetry', () => {
  it('parses and summarizes shadow LONG, CANCEL, and outcome rows', () => {
    const events = parseNativeTelemetry([
      JSON.stringify({
        ts: '2026-05-08T15:00:00.100Z',
        source: 'ninja-native-shadow',
        event: 'LONG',
        signal_id: 'ninja-native-1',
        instrument: 'ES 06-26',
        bar: 42,
        bar_time: '2026-05-08T11:00:00.0000000',
        price: 7413.25,
        level: 7413,
        entry: 7413.25,
        stop: 7410,
        tp1: 7415.25,
        tp2: 7418.25,
        ltf_ok: true,
      }),
      JSON.stringify({
        ts: '2026-05-08T15:00:04.100Z',
        source: 'ninja-native-shadow',
        event: 'CANCEL',
        signal_id: 'ninja-native-1',
        instrument: 'ES 06-26',
        bar: 42,
        bar_time: '2026-05-08T11:00:00.0000000',
        price: 7412.75,
        level: 7413,
        entry: 7413.25,
        stop: 7410,
        tp1: 7415.25,
        tp2: 7418.25,
        ltf_ok: false,
        note: 'points=-1.00 contracts=2.00 gross=-50.00 cost=35.00 net=-85.00 total_points=-1.00 total_net=-85.00',
      }),
      JSON.stringify({
        ts: '2026-05-08T15:05:04.100Z',
        source: 'ninja-native-shadow',
        event: 'STOP_FIRST',
        signal_id: 'ninja-native-2',
        instrument: 'ES 06-26',
        bar: 48,
        bar_time: '2026-05-08T11:05:00.0000000',
        price: 7410,
        level: 7413,
        entry: 7413.25,
        stop: 7410,
        tp1: 7415.25,
        tp2: 7418.25,
        ltf_ok: true,
      }),
    ].join('\n'));

    const summary = summarizeNativeTelemetry(events);
    expect(summary.counts).toMatchObject({
      events: 3,
      longs: 1,
      cancels: 1,
      outcomes: 1,
    });
    expect(summary.counts.by_event).toMatchObject({
      LONG: 1,
      CANCEL: 1,
      STOP_FIRST: 1,
    });
    expect(summary.readiness).toEqual({
      status: 'clean',
      blockers: [],
    });
    expect(events[1]).toMatchObject({
      points: -1,
      contracts: 2,
      gross: -50,
      cost: 35,
      net: -85,
      total_points: -1,
      total_net: -85,
    });
  });

  it('flags telemetry rows that cannot be used for parity because geometry is missing', () => {
    const events = parseNativeTelemetry(JSON.stringify({
      ts: '2026-05-08T15:00:00.100Z',
      source: 'ninja-native-shadow',
      event: 'LONG',
      signal_id: '',
      entry: 7413.25,
    }));

    const summary = summarizeNativeTelemetry(events);
    expect(summary.readiness.status).toBe('review');
    expect(summary.readiness.blockers).toEqual(['missing_geometry', 'long_without_signal_id']);
    expect(summary.geometry_issues[0]).toMatchObject({
      event: 'LONG',
      missing: ['level', 'stop', 'tp1', 'tp2'],
    });
  });
});
