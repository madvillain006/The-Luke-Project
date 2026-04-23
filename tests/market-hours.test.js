'use strict';

describe('market-hours module', () => {
  // Test module shape without mocking time — just verify exports exist and return expected shapes
  it('exports isMarketOpen, isGoodTradingTime, minsUntilOpen, isWeekend', () => {
    const mh = require('../lib/market-hours');
    expect(typeof mh.isMarketOpen).toBe('function');
    expect(typeof mh.isGoodTradingTime).toBe('function');
    expect(typeof mh.minsUntilOpen).toBe('function');
    expect(typeof mh.isWeekend).toBe('function');
  });

  it('isMarketOpen returns object with open, session, message fields', () => {
    const { isMarketOpen } = require('../lib/market-hours');
    const result = isMarketOpen();
    expect(result).toHaveProperty('open');
    expect(result).toHaveProperty('session');
    expect(result).toHaveProperty('message');
    expect(typeof result.open).toBe('boolean');
    expect(typeof result.session).toBe('string');
  });

  it('isGoodTradingTime returns object with good, window, message fields', () => {
    const { isGoodTradingTime } = require('../lib/market-hours');
    const result = isGoodTradingTime();
    expect(result).toHaveProperty('good');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('message');
    expect(typeof result.good).toBe('boolean');
  });

  it('isWeekend returns a boolean', () => {
    const { isWeekend } = require('../lib/market-hours');
    expect(typeof isWeekend()).toBe('boolean');
  });

  it('minsUntilOpen returns a positive number when market is closed', () => {
    const { minsUntilOpen, isMarketOpen } = require('../lib/market-hours');
    if (!isMarketOpen().open) {
      expect(minsUntilOpen()).toBeGreaterThan(0);
    }
  });

  it('session values are one of known valid strings', () => {
    const { isMarketOpen } = require('../lib/market-hours');
    const VALID = ['closed', 'pre', 'after', 'regular'];
    expect(VALID).toContain(isMarketOpen().session);
  });

  it('window values are one of known valid strings', () => {
    const { isGoodTradingTime } = require('../lib/market-hours');
    const VALID = ['closed', 'morning', 'lunch', 'afternoon', 'last10'];
    expect(VALID).toContain(isGoodTradingTime().window);
  });
});
