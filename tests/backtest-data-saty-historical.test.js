import { describe, it, expect } from 'vitest';
import {
  buildFuturesSessionBars,
  deriveLevelsByDate,
  deriveSatyLevelsFromReferenceSession,
  _internal,
} from '../lib/backtest-data/saty-historical.js';

const {
  futuresSessionDateForTimestamp,
  isInsideFuturesSession,
  computeWilderAtr,
} = _internal;

function bar(timestamp, open, high, low, close) {
  return { timestamp, open, high, low, close, volume: 100 };
}

function makeSessionBars(sessionDate, base) {
  const prevDate = _internal.dateAdd(sessionDate, -1);
  return [
    bar(`${prevDate}T18:00:00-04:00`, base, base + 2, base - 2, base + 1),
    bar(`${sessionDate}T09:30:00-04:00`, base + 1, base + 6, base - 3, base + 2),
    bar(`${sessionDate}T16:59:00-04:00`, base + 2, base + 4, base - 1, base + 3),
  ];
}

function makeManySessionBars(startDate, count) {
  const rows = [];
  let date = startDate;
  let made = 0;
  while (made < count) {
    const d = new Date(`${date}T12:00:00Z`);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      rows.push(...makeSessionBars(date, 5000 + made * 10));
      made++;
    }
    date = _internal.dateAdd(date, 1);
  }
  return rows;
}

describe('Saty historical futures-session calendar', () => {
  it('maps 18:00 ET bars to the next futures session date', () => {
    expect(futuresSessionDateForTimestamp('2026-04-28T17:59:00-04:00')).toBe('2026-04-28');
    expect(futuresSessionDateForTimestamp('2026-04-28T18:00:00-04:00')).toBe('2026-04-29');
    expect(futuresSessionDateForTimestamp('2026-04-29T09:30:00-04:00')).toBe('2026-04-29');
    expect(futuresSessionDateForTimestamp('2026-04-29T16:59:00-04:00')).toBe('2026-04-29');
  });

  it('excludes the daily 17:00-17:59 ET maintenance break', () => {
    expect(isInsideFuturesSession(bar('2026-04-29T16:59:00-04:00', 1, 1, 1, 1))).toBe(true);
    expect(isInsideFuturesSession(bar('2026-04-29T17:00:00-04:00', 1, 1, 1, 1))).toBe(false);
    expect(isInsideFuturesSession(bar('2026-04-29T17:59:00-04:00', 1, 1, 1, 1))).toBe(false);
    expect(isInsideFuturesSession(bar('2026-04-29T18:00:00-04:00', 1, 1, 1, 1))).toBe(true);
  });

  it('builds ES extended futures-session bars from intraday data', () => {
    const sessions = buildFuturesSessionBars([
      bar('2026-04-28T17:30:00-04:00', 1, 100, 1, 50),
      ...makeSessionBars('2026-04-29', 5000),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      date: '2026-04-29',
      open: 5000,
      close: 5003,
      bar_count: 3,
    });
    expect(sessions[0].high).toBe(5006);
    expect(sessions[0].low).toBe(4997);
  });
});

describe('Saty historical ATR derivation', () => {
  it('computes Wilder ATR with the same seed behavior as Pine ta.atr', () => {
    const sessions = Array.from({ length: 16 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      high: 100 + i + 5,
      low: 100 + i - 5,
      close: 100 + i,
    }));
    const atr = computeWilderAtr(sessions, 14);
    expect(atr[13]).toBeNull();
    expect(atr[14]).toBe(10);
    expect(atr[15]).toBe(10);
  });

  it('derives levels from prior completed session close plus ATR multipliers', () => {
    const result = deriveSatyLevelsFromReferenceSession({
      date: '2026-04-28',
      session_open: '2026-04-27T18:00:00-04:00',
      session_close: '2026-04-28T16:59:00-04:00',
      high: 101,
      low: 91,
      close: 100,
      bar_count: 3,
    }, 10);

    expect(result.valid).toBe(true);
    expect(result.prev_close).toBe(100);
    expect(result.atr_value).toBe(10);
    expect(result.call_trigger).toBe(102.36);
    expect(result.put_trigger).toBe(97.64);
    expect(result.ext_plus_4).toBe(107.86);
    expect(result.atr_plus_1).toBe(110);
    expect(result.formula_provenance).toBe('Saty_Pine_D_session_extended_close1_atr14_1');
  });

  it('uses target date D minus one completed futures session with no lookahead', () => {
    const intraday = makeManySessionBars('2026-03-02', 18);
    const dates = buildFuturesSessionBars(intraday).map(s => s.date);
    const targetDate = dates[16];
    const result = deriveLevelsByDate(intraday, [targetDate]);

    expect(result[targetDate].valid).toBe(true);
    expect(result[targetDate].target_session_date).toBe(targetDate);
    expect(result[targetDate].reference_date).toBe(_internal.dateAdd(targetDate, -1));
    expect(result[targetDate].reference_date < targetDate).toBe(true);
    expect(result[targetDate].valid_from).toBe(`${_internal.dateAdd(targetDate, -1)}T18:00:00`);
    expect(result[targetDate].valid_until).toBe(`${targetDate}T17:00:00`);
  });

  it('uses the prior available session for Mondays instead of requiring Sunday data', () => {
    const intraday = makeManySessionBars('2026-03-02', 20);
    const result = deriveLevelsByDate(intraday, ['2026-03-30']);

    expect(result['2026-03-30'].valid).toBe(true);
    expect(result['2026-03-30'].reference_date).toBe('2026-03-27');
    expect(result['2026-03-30'].valid_from).toBe('2026-03-29T18:00:00');
    expect(result['2026-03-30'].valid_until).toBe('2026-03-30T17:00:00');
  });

  it('fails only until there are enough prior ES sessions for ATR(14)', () => {
    const intraday = makeManySessionBars('2026-03-02', 18);
    const dates = buildFuturesSessionBars(intraday).map(s => s.date);
    const early = deriveLevelsByDate(intraday, [dates[1]]);
    const later = deriveLevelsByDate(intraday, [dates[16]]);

    expect(early[dates[1]].valid).toBe(false);
    expect(early[dates[1]].error).toContain('Need at least 15 ES futures sessions');
    expect(later[dates[16]].valid).toBe(true);
  });
});
