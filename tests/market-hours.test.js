'use strict';

describe('market-hours module', () => {
  // Test module shape without mocking time — just verify exports exist and return expected shapes
  it('exports cash and futures market-hour helpers', () => {
    const mh = require('../lib/market-hours');
    expect(typeof mh.isMarketOpen).toBe('function');
    expect(typeof mh.isFuturesMarketOpen).toBe('function');
    expect(typeof mh.isGoodTradingTime).toBe('function');
    expect(typeof mh.minsUntilOpen).toBe('function');
    expect(typeof mh.minsUntilFuturesOpen).toBe('function');
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

  it('treats Sunday evening as an open futures overnight session without opening cash market', () => {
    const { isMarketOpen, isFuturesMarketOpen, minsUntilFuturesOpen } = require('../lib/market-hours');
    const sundayEvening = new Date('2026-05-03T22:30:00Z'); // 6:30 PM ET

    expect(isMarketOpen(sundayEvening)).toEqual(expect.objectContaining({ open: false, session: 'closed' }));
    expect(isFuturesMarketOpen(sundayEvening)).toEqual(expect.objectContaining({ open: true, session: 'futures_overnight' }));
    expect(minsUntilFuturesOpen(sundayEvening)).toBe(0);
  });

  it('keeps the daily futures maintenance break closed', () => {
    const { isFuturesMarketOpen, minsUntilFuturesOpen } = require('../lib/market-hours');
    const mondayBreak = new Date('2026-05-04T21:30:00Z'); // 5:30 PM ET

    expect(isFuturesMarketOpen(mondayBreak)).toEqual(expect.objectContaining({ open: false, session: 'maintenance' }));
    expect(minsUntilFuturesOpen(mondayBreak)).toBe(30);
  });

  it('maps Saturday and Sunday daytime to the prior Friday market session', () => {
    const { marketSessionDate, previousMarketDay } = require('../lib/market-hours');

    expect(marketSessionDate(new Date('2026-05-09T16:00:00Z'))).toBe('2026-05-08');
    expect(marketSessionDate(new Date('2026-05-10T16:00:00Z'))).toBe('2026-05-08');
    expect(previousMarketDay('2026-05-11')).toBe('2026-05-08');
  });

  it('maps Sunday futures reopen to the Monday target session', () => {
    const { marketSessionDate } = require('../lib/market-hours');

    expect(marketSessionDate(new Date('2026-05-10T22:30:00Z'))).toBe('2026-05-11');
  });

  it('skips injected holidays when finding the previous market day', () => {
    const { isMarketDate, previousMarketDay } = require('../lib/market-hours');
    const holidays = ['2026-05-25'];

    expect(isMarketDate('2026-05-25', { holidays })).toBe(false);
    expect(previousMarketDay('2026-05-26', { holidays })).toBe('2026-05-22');
  });

  it('window values are one of known valid strings', () => {
    const { isGoodTradingTime } = require('../lib/market-hours');
    const VALID = ['closed', 'morning', 'lunch', 'afternoon', 'last10'];
    expect(VALID).toContain(isGoodTradingTime().window);
  });
});
