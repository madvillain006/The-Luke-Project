'use strict';

const { parseXimes } = require('../lib/parse-ximes');

describe('parseXimes', () => {
  it('returns null for unknown username', () => {
    expect(parseXimes('unknownuser', 'SPY 560C avg 1.20')).toBeNull();
  });

  it('returns null for noise (too short, no direction/price)', () => {
    expect(parseXimes('ximestrades', 'SPY')).toBeNull();
    expect(parseXimes('ximestrades', 'https://example.com/chart')).toBeNull();
    expect(parseXimes('ximestrades', '')).toBeNull();
  });

  it('classifies live entry: SPX calls with avg price', () => {
    const result = parseXimes('ximestrades', 'SPX 5800C avg 2.50 — ENTRY NOW');
    expect(result).not.toBeNull();
    expect(result.signal_type).toBe('LIVE_ENTRY');
    expect(result.direction).toBe('LONG');
    expect(result.strike).toBe(5800);
    expect(result.entry_price).toBe(2.50);
    expect(result.analyst).toBe('ximes');
  });

  it('classifies pre-market setup with direction and strike', () => {
    const msg = 'SETUP A\nDirection: calls\nStrike: 5750\nEntry: 9:35 open\nCut: 5740\nConfidence: 75%';
    const result = parseXimes('ximestrades', msg);
    expect(result).not.toBeNull();
    expect(result.signal_type).toBe('PRE_MARKET_SETUP');
    expect(result.direction).toBe('LONG');
    expect(result.strike).toBe(5750);
    expect(result.cut).toBe(5740);
    expect(result.confidence_pct).toBe(75);
    expect(result.confidence).toBe('HIGH');
  });

  it('classifies management: trim action with percentage', () => {
    const result = parseXimes('ximestrades', 'TRIMMING 50% at 3.20');
    expect(result).not.toBeNull();
    expect(result.signal_type).toBe('MANAGEMENT');
    expect(result.action).toBe('TRIM');
    expect(result.pct).toBe(50);
  });

  it('classifies management: cut/stop action', () => {
    const result = parseXimes('followthewhiterabblt', 'CUT — cut small loss at .80');
    expect(result).not.toBeNull();
    expect(result.signal_type).toBe('MANAGEMENT');
    expect(result.action).toBe('CUT');
    expect(result.analyst).toBe('ximes');
  });

  it('returns null for messages over 10000 chars', () => {
    const bigText = 'SPY 560C avg 1.20 '.repeat(600);
    expect(parseXimes('ximestrades', bigText)).toBeNull();
  });
});
