const {
  buildParityLedger,
  parityRowsToCsv,
  parityRowsToMarkdown,
} = require('../lib/ninja-parity-ledger');

function jsonl(rows) {
  return rows.map(row => JSON.stringify(row)).join('\n');
}

describe('Ninja/Pine parity ledger', () => {
  it('matches Pine bridge LONG and CANCEL rows to native Ninja rows by bar time and entry', () => {
    const bridgeText = jsonl([
      {
        ts: '2026-05-08T14:31:03.000Z',
        type: 'luke_long_signal_saved',
        id: 'luke-long-1778164260000-18-7395.25',
        symbol: 'ES1!',
        created_at: '2026-05-08T14:31:00.000Z',
        bar_time: '2026-05-08T14:30:00.000Z',
        received_at: '2026-05-08T14:31:03.000Z',
        source_to_luke_ms: 3000,
        entry: 7395.25,
        stop: 7392.25,
        tp1: 7397.25,
        tp2: 7400,
      },
      {
        ts: '2026-05-08T14:31:18.000Z',
        type: 'luke_cancel_signal_saved',
        id: 'luke-long-1778164260000-18-7395.25',
        symbol: 'ES1!',
        created_at: '2026-05-08T14:31:18.000Z',
        bar_time: '2026-05-08T14:30:00.000Z',
        received_at: '2026-05-08T14:31:18.000Z',
      },
    ]);
    const nativeText = jsonl([
      {
        ts: '2026-05-08T14:30:02.000Z',
        source: 'ninja-native-shadow',
        event: 'LONG',
        signal_id: 'ninja-native-1',
        instrument: 'ES 06-26',
        bar_time: '2026-05-08T10:30:00.0000000',
        entry: 7395.25,
        stop: 7392.25,
        tp1: 7397.25,
        tp2: 7400,
        note: 'id=ninja-native-1',
      },
      {
        ts: '2026-05-08T14:30:05.000Z',
        source: 'ninja-native-shadow',
        event: 'CANCEL',
        signal_id: 'ninja-native-1',
        instrument: 'ES 06-26',
        bar_time: '2026-05-08T10:30:00.0000000',
        entry: 7395.25,
        stop: 7392.25,
        tp1: 7397.25,
        tp2: 7400,
      },
    ]);

    const report = buildParityLedger({
      bridgeText,
      nativeText,
      date: '2026-05-08',
      timeZone: 'America/New_York',
    });

    expect(report.summary.status).toBe('clean');
    expect(report.summary.counts).toMatchObject({
      pine_longs: 1,
      pine_cancels: 1,
      native_longs: 1,
      native_cancels: 1,
      matched: 2,
      missing_native: 0,
      native_only: 0,
      geometry_mismatch: 0,
    });
    expect(parityRowsToCsv(report.rows)).toContain('matched,LONG');
    expect(parityRowsToMarkdown(report)).toContain('Status: clean');
  });

  it('flags unmatched or mismatched executable rows before promotion', () => {
    const bridgeText = jsonl([
      {
        ts: '2026-05-08T14:31:03.000Z',
        type: 'luke_long_signal_saved',
        id: 'luke-long-1778164260000-18-7395.25',
        created_at: '2026-05-08T14:31:00.000Z',
        bar_time: '2026-05-08T14:30:00.000Z',
        received_at: '2026-05-08T14:31:03.000Z',
        entry: 7395.25,
        stop: 7392.25,
        tp1: 7397.25,
        tp2: 7400,
      },
    ]);
    const nativeText = jsonl([
      {
        ts: '2026-05-08T14:30:02.000Z',
        source: 'ninja-native-shadow',
        event: 'LONG',
        signal_id: 'ninja-native-1',
        bar_time: '2026-05-08T10:30:00.0000000',
        entry: 7395.25,
        stop: 7391.25,
        tp1: 7397.25,
        tp2: 7400,
      },
    ]);

    const report = buildParityLedger({
      bridgeText,
      nativeText,
      date: '2026-05-08',
      timeZone: 'America/New_York',
    });

    expect(report.summary.status).toBe('review');
    expect(report.summary.blockers).toContain('geometry_mismatch');
    expect(report.rows[0].mismatches).toEqual(['stop']);
  });

  it('does not bless bridge rows that lack Pine bar_time', () => {
    const bridgeText = jsonl([
      {
        ts: '2026-05-08T14:31:03.000Z',
        type: 'luke_long_signal_saved',
        id: 'luke-long-1778164260000-18-7395.25',
        created_at: '2026-05-08T14:31:00.000Z',
        received_at: '2026-05-08T14:31:03.000Z',
        entry: 7395.25,
        stop: 7392.25,
        tp1: 7397.25,
        tp2: 7400,
      },
    ]);

    const report = buildParityLedger({
      bridgeText,
      nativeText: '',
      date: '2026-05-08',
      timeZone: 'America/New_York',
    });

    expect(report.summary.status).toBe('review');
    expect(report.summary.blockers).toContain('pine_bridge_missing_bar_time');
  });
});
