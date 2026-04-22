'use strict';

const { calculateBracket } = require('../lib/bracket-calc');

describe('calculateBracket', () => {
  it('returns error for unknown instrument', () => {
    const result = calculateBracket({ ticker: 'AAPL', direction: 'LONG', strike: 200 }, [], 200);
    expect(result.error).toMatch(/Unknown instrument/);
  });

  it('calculates correct LONG bracket for SPY using default stop/target', () => {
    const result = calculateBracket(
      { ticker: 'SPY', direction: 'LONG', strike: 560 },
      [],
      560
    );
    expect(result.error).toBeUndefined();
    expect(result.entry).toBe(560);
    expect(result.target).toBe(563);    // +3 default
    expect(result.stop).toBe(558.5);    // -1.5 default
    expect(result.direction).toBe('LONG');
    expect(result.rr_ratio).toBeGreaterThan(1);
  });

  it('uses confluence zone levels for target and stop', () => {
    const zones = [
      { level: 565, confidence: 'HIGH',   zone: [563, 567], instrument: 'SPY_QQQ' },
      { level: 555, confidence: 'MEDIUM', zone: [553, 557], instrument: 'SPY_QQQ' },
    ];
    const result = calculateBracket(
      { ticker: 'SPY', direction: 'LONG', strike: 560 },
      zones,
      560
    );
    expect(result.target).toBe(565);
    expect(result.stop).toBe(555);
  });

  it('flags reject when R:R is below 1:1', () => {
    const zones = [
      { level: 561, confidence: 'HIGH', zone: [560, 562], instrument: 'SPY_QQQ' },  // tiny target
      { level: 558, confidence: 'HIGH', zone: [557, 559], instrument: 'SPY_QQQ' },  // big stop
    ];
    const result = calculateBracket(
      { ticker: 'SPY', direction: 'LONG', strike: 560 },
      zones,
      560
    );
    // target 561 (1pt up) vs stop 558 (2pt down) → R:R 0.5 → reject
    expect(result.flag).toBe('reject');
  });

  it('returns error when no entry price available', () => {
    const result = calculateBracket({ ticker: 'ES', direction: 'LONG' }, [], null);
    expect(result.error).toMatch(/No entry price/);
  });

  it('SHORT bracket: target below entry, stop above entry', () => {
    const result = calculateBracket(
      { ticker: 'ES', direction: 'SHORT', strike: 5800 },
      [],
      5800
    );
    expect(result.error).toBeUndefined();
    expect(result.target).toBeLessThan(5800);
    expect(result.stop).toBeGreaterThan(5800);
  });
});
