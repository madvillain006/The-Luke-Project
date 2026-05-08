const fs = require('fs');
const path = require('path');

process.env.LUKE_NINJA_BRIDGE_FILE = path.join(__dirname, '..', 'tmp', 'tests', 'latest-luke-signal.test.json');
process.env.LUKE_NINJA_BRIDGE_EVENTS_FILE = path.join(__dirname, '..', 'tmp', 'tests', 'ninjatrader-bridge.test.jsonl');

const {
  LATEST_SIGNAL_FILE,
  normalizeTimestamp,
  latencyMs,
  normalizeLukeBridgePayload,
  normalizeLukeCancelPayload,
  normalizeLukePingPayload,
  normalizeLukeLongPayload,
  saveLukeBridgeCommand,
  saveLukeLongSignal,
} = require('../lib/ninjatrader-alert-bridge');

const originalMaxQty = process.env.LUKE_NINJA_MAX_QTY;

afterEach(() => {
  fs.rmSync(path.dirname(LATEST_SIGNAL_FILE), { recursive: true, force: true });
  if (originalMaxQty === undefined) {
    delete process.env.LUKE_NINJA_MAX_QTY;
  } else {
    process.env.LUKE_NINJA_MAX_QTY = originalMaxQty;
  }
});

describe('NinjaTrader alert bridge', () => {
  it('normalizes a Luke LONG alert payload for SIM bridge consumption', () => {
    const signal = normalizeLukeLongPayload({
      id: 'sig-1',
      symbol: 'ESM26',
      side: 'LONG',
      entry: 7395.25,
      stop: 7392.25,
      tp1: 7397.25,
      tp2: 7400,
      qty: 2,
      class: 'MANCINI_RECLAIM',
      execution_model: 'confirmed_retest_limit',
      timestamp: '2026-05-07T10:31:00-04:00',
      bar_time: '2026-05-07T10:30:00-04:00',
    }, new Date('2026-05-07T14:31:03Z'));

    expect(signal).toMatchObject({
      id: 'sig-1',
      type: 'LUKE_LONG',
      side: 'LONG',
      symbol: 'ESM26',
      class: 'MANCINI_RECLAIM',
      execution_model: 'confirmed_retest_limit',
      entry: 7395.25,
      stop: 7392.25,
      tp1: 7397.25,
      tp2: 7400,
      qty: 2,
      created_at: '2026-05-07T14:31:00.000Z',
      bar_time: '2026-05-07T14:30:00.000Z',
      received_at: '2026-05-07T14:31:03.000Z',
    });
  });

  it('converts Pine numeric realtime timestamps into ISO for Ninja stale checks', () => {
    const ms = Date.parse('2026-05-07T14:31:00Z');
    expect(normalizeTimestamp(String(ms), new Date('2026-05-07T14:31:03Z'))).toBe('2026-05-07T14:31:00.000Z');
    expect(normalizeTimestamp(String(Math.floor(ms / 1000)), new Date('2026-05-07T14:31:03Z'))).toBe('2026-05-07T14:31:00.000Z');
    expect(normalizeTimestamp('not-a-date', new Date('2026-05-07T14:31:03Z'))).toBe('2026-05-07T14:31:03.000Z');
  });

  it('records source-to-Luke latency for bottleneck diagnostics', () => {
    expect(latencyMs('2026-05-08T14:40:00.372Z', '2026-05-08T14:40:04.426Z')).toBe(4054);

    const payload = saveLukeBridgeCommand({
      id: 'luke-long-1778251200372-22-7413.25',
      symbol: 'ESM26',
      side: 'LONG',
      entry: 7413.25,
      stop: 7410,
      tp1: 7415.25,
      tp2: 7418.25,
      qty: 2,
      timestamp: '1778251200372',
      source: 'luke-pine-ninja-bridge',
    }, { now: new Date('2026-05-08T14:40:04.426Z') });

    expect(payload.signal.created_at).toBe('2026-05-08T14:40:00.372Z');
    expect(payload.signal.received_at).toBe('2026-05-08T14:40:04.426Z');

    const events = fs.readFileSync(process.env.LUKE_NINJA_BRIDGE_EVENTS_FILE, 'utf8').trim().split(/\r?\n/);
    const event = JSON.parse(events.at(-1));
    expect(event).toMatchObject({
      id: 'luke-long-1778251200372-22-7413.25',
      created_at: '2026-05-08T14:40:00.372Z',
      received_at: '2026-05-08T14:40:04.426Z',
      source_to_luke_ms: 4054,
      source: 'luke-pine-ninja-bridge',
    });
  });

  it('normalizes cancel commands without requiring order geometry', () => {
    const signal = normalizeLukeBridgePayload({
      type: 'LUKE_CANCEL',
      id: 'sig-1',
      symbol: 'ESM26',
      timestamp: String(Date.parse('2026-05-07T14:31:02Z')),
      reason: 'live_cancel',
    }, new Date('2026-05-07T14:31:03Z'));

    expect(signal).toMatchObject({
      id: 'sig-1',
      type: 'LUKE_CANCEL',
      side: 'CANCEL',
      symbol: 'ESM26',
      created_at: '2026-05-07T14:31:02.000Z',
      reason: 'live_cancel',
    });
    expect(() => normalizeLukeCancelPayload({ type: 'LUKE_CANCEL' })).toThrow(/cancel command/);
  });

  it('treats cmd as a command alias for cancel payloads', () => {
    const signal = normalizeLukeBridgePayload({
      cmd: 'CANCEL',
      id: 'sig-cmd-cancel',
      symbol: 'ESM26',
      reason: 'manual_cancel',
    }, new Date('2026-05-07T14:31:03Z'));

    expect(signal).toMatchObject({
      id: 'sig-cmd-cancel',
      type: 'LUKE_CANCEL',
      side: 'CANCEL',
      reason: 'manual_cancel',
    });
  });

  it('normalizes ping commands without requiring order geometry', () => {
    const signal = normalizeLukeBridgePayload({
      cmd: 'PING',
      id: 'sig-ping',
      symbol: 'ESM26',
      reason: 'healthcheck',
    }, new Date('2026-05-07T14:31:03Z'));

    expect(signal).toMatchObject({
      id: 'sig-ping',
      type: 'LUKE_PING',
      side: 'PING',
      symbol: 'ESM26',
      reason: 'healthcheck',
    });
    expect(normalizeLukePingPayload({ symbol: 'ESM26' }, new Date('2026-05-07T14:31:03Z')).id).toBe('ping-1778164263000');
  });

  it('rejects non-long or malformed order geometry', () => {
    expect(() => normalizeLukeLongPayload({
      side: 'SHORT',
      entry: 100,
      stop: 99,
      tp1: 101,
      tp2: 102,
    })).toThrow(/only LONG/);

    expect(() => normalizeLukeLongPayload({
      side: 'LONG',
      entry: 100,
      stop: 101,
      tp1: 102,
      tp2: 103,
    })).toThrow(/stop must be below entry/);

    process.env.LUKE_NINJA_MAX_QTY = '2';
    expect(() => normalizeLukeLongPayload({
      side: 'LONG',
      entry: 100,
      stop: 99,
      tp1: 101,
      tp2: 102,
      qty: 3,
    })).toThrow(/exceeds bridge max/);
  });

  it('writes the latest bridge state file atomically', () => {
    const payload = saveLukeLongSignal({
      id: 'sig-write-test',
      symbol: 'ESM26',
      entry: 7395.25,
      stop: 7392.25,
      tp1: 7397.25,
      tp2: 7400,
      qty: 1,
      class: 'SCALP_MAJOR',
      execution_model: 'confirmed_retest_limit',
      token: 'do-not-store',
    }, { now: new Date('2026-05-07T14:31:03Z') });

    const saved = JSON.parse(fs.readFileSync(LATEST_SIGNAL_FILE, 'utf8'));
    expect(saved.signal.id).toBe('sig-write-test');
    expect(saved.signal.class).toBe('SCALP_MAJOR');
    expect(saved.signal.execution_model).toBe('confirmed_retest_limit');
    expect(saved.safety.live_broker_execution).toBe(false);
    expect(saved.raw.token).toBeUndefined();
    expect(payload.signal.id).toBe(saved.signal.id);
    expect(path.basename(LATEST_SIGNAL_FILE)).toBe('latest-luke-signal.test.json');
  });

  it('accepts TradingView JSON payloads even when Express receives them as text', () => {
    const payload = saveLukeBridgeCommand(JSON.stringify({
      id: 'sig-text-body',
      symbol: 'ESM26',
      side: 'LONG',
      entry: 7395.25,
      stop: 7392.25,
      tp1: 7397.25,
      tp2: 7400,
      qty: 2,
      token: 'do-not-store',
    }), { now: new Date('2026-05-07T14:31:03Z') });

    const saved = JSON.parse(fs.readFileSync(LATEST_SIGNAL_FILE, 'utf8'));
    expect(payload.signal).toMatchObject({
      id: 'sig-text-body',
      type: 'LUKE_LONG',
      side: 'LONG',
      qty: 2,
    });
    expect(saved.signal.id).toBe('sig-text-body');
    expect(saved.raw.token).toBeUndefined();
  });

  it('writes cancel commands as the latest Ninja bridge command', () => {
    const payload = saveLukeBridgeCommand({
      type: 'LUKE_CANCEL',
      target_id: 'sig-write-test',
      symbol: 'ESM26',
      token: 'do-not-store',
    }, { now: new Date('2026-05-07T14:31:04Z') });

    const saved = JSON.parse(fs.readFileSync(LATEST_SIGNAL_FILE, 'utf8'));
    expect(saved.signal).toMatchObject({
      id: 'sig-write-test',
      type: 'LUKE_CANCEL',
      side: 'CANCEL',
    });
    expect(saved.raw.token).toBeUndefined();
    expect(payload.signal.id).toBe(saved.signal.id);
  });

  it('rejects late LONG payloads for an already-cancelled signal id', () => {
    saveLukeBridgeCommand({
      type: 'LUKE_CANCEL',
      id: 'sig-out-of-order',
      symbol: 'ESM26',
    }, { now: new Date('2026-05-07T14:31:04Z') });

    expect(() => saveLukeBridgeCommand({
      id: 'sig-out-of-order',
      symbol: 'ESM26',
      side: 'LONG',
      entry: 7395.25,
      stop: 7392.25,
      tp1: 7397.25,
      tp2: 7400,
      qty: 1,
    }, { now: new Date('2026-05-07T14:31:05Z') })).toThrow(/already cancelled/);

    const saved = JSON.parse(fs.readFileSync(LATEST_SIGNAL_FILE, 'utf8'));
    expect(saved.signal).toMatchObject({
      id: 'sig-out-of-order',
      type: 'LUKE_CANCEL',
    });
  });

  it('keeps the Ninja bridge entry guard symmetric around current price', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'ninjatrader', 'LukeAlertBridgeStrategy.cs'), 'utf8');
    expect(source).toContain('Math.Abs(signal.Entry - lastPrice) > MaxMarketableEntryPoints');
    expect(source).toContain('entry is outside current market wiggle');
  });
});
