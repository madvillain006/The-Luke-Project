import { describe, it, expect } from 'vitest';
import {
  buildSatyLevelList,
  clusterLevels,
  evaluatePineWatchSession,
  compareReferenceFields,
} from '../lib/backtest-data/saty-pine-watch.js';

function bar(timestamp, open, high, low, close) {
  return { timestamp, open, high, low, close, volume: 100 };
}

function makeSession(sessionDate, base) {
  const prior = new Date(`${sessionDate}T12:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const priorDate = prior.toISOString().slice(0, 10);
  return [
    bar(`${priorDate}T18:00:00-04:00`, base, base + 4, base - 2, base + 1),
    bar(`${sessionDate}T09:30:00-04:00`, base + 1, base + 7, base - 3, base + 3),
    bar(`${sessionDate}T16:59:00-04:00`, base + 3, base + 6, base - 1, base + 4),
  ];
}

function makeHistoricalBars(startDate, count) {
  const rows = [];
  let date = startDate;
  let made = 0;
  while (made < count) {
    const d = new Date(`${date}T12:00:00Z`);
    if (![0, 6].includes(d.getUTCDay())) {
      rows.push(...makeSession(date, 5000 + made * 10));
      made += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
    date = d.toISOString().slice(0, 10);
  }
  return rows;
}

describe('Saty Pine watch backtest port', () => {
  it('builds the same 13 Saty levels the Pine script adds to raw prices', () => {
    const levels = buildSatyLevelList({
      valid: true,
      prev_close: 100,
      call_trigger: 102.36,
      put_trigger: 97.64,
      ext_plus_1: 103.82,
      ext_plus_2: 105,
      ext_plus_3: 106.18,
      ext_plus_4: 107.86,
      atr_plus_1: 110,
      ext_minus_1: 96.18,
      ext_minus_2: 95,
      ext_minus_3: 93.82,
      ext_minus_4: 92.14,
      atr_minus_1: 90,
    });

    expect(levels).toHaveLength(13);
    expect(levels.map(level => level.field)).toContain('call_trigger');
    expect(levels.map(level => level.field)).toContain('atr_minus_1');
  });

  it('clusters adjacent Saty levels with the same tolerance cap semantics', () => {
    const clusters = clusterLevels([
      { price: 100, source: 'saty', field: 'a', fresh: true },
      { price: 100.75, source: 'saty', field: 'b', fresh: true },
      { price: 104, source: 'saty', field: 'c', fresh: true },
    ], { clusterTolerancePoints: 1.25 });

    expect(clusters).toHaveLength(2);
    expect(clusters[0].fields).toEqual(['a', 'b']);
  });

  it('detects watch, armed, long candidate, and TP1 from historical candles', () => {
    const bars = [
      bar('2026-04-02T09:30:00-04:00', 100, 101, 99.5, 100.5),
      bar('2026-04-02T09:31:00-04:00', 100.5, 100.75, 98.75, 99.5),
      bar('2026-04-02T09:32:00-04:00', 99.5, 101.5, 99.25, 100.75),
      bar('2026-04-02T09:33:00-04:00', 100.75, 101.25, 100.25, 100.75),
      bar('2026-04-02T09:34:00-04:00', 100.75, 103, 100.5, 102.75),
    ];
    const result = evaluatePineWatchSession({
      bars,
      satyLevels: {
        valid: true,
        prev_close: 100,
        call_trigger: 108,
        put_trigger: 92,
      },
      config: {
        pivotRibbonFilterMode: 'off',
        requireImpulseCloudBreak: false,
        minTargetSpacePoints: 3,
      },
    });

    expect(result.events.map(event => event.event)).toContain('WATCH');
    expect(result.events.map(event => event.event)).toContain('ARMED');
    expect(result.trades.some(trade => trade.outcome === 'tp1_first')).toBe(true);
    expect(result.trades[0].outcome).toBe('tp1_first');
  });

  it('compares current Pine close anchor against an explicit prior-open variant', () => {
    const bars = makeHistoricalBars('2026-03-02', 18);
    const report = compareReferenceFields(bars, { dates: ['2026-03-25'] });

    expect(report.read_only).toBe(true);
    expect(report.no_live_execution).toBe(true);
    expect(report.current_pine_reference_field).toBe('close');
    expect(report.user_hypothesis_reference_field).toBe('open');
    expect(report.close_summary.reference_field).toBe('close');
    expect(report.open_summary.reference_field).toBe('open');
  });
});
