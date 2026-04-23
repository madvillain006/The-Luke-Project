'use strict';

describe('smoke: core modules load without throwing', () => {
  it('loads lib/parse-ximes', () => {
    expect(() => require('../lib/parse-ximes')).not.toThrow();
  });
  it('loads lib/parse-bobby', () => {
    expect(() => require('../lib/parse-bobby')).not.toThrow();
  });
  it('loads lib/confluence', () => {
    expect(() => require('../lib/confluence')).not.toThrow();
  });
  it('loads lib/bracket-calc', () => {
    expect(() => require('../lib/bracket-calc')).not.toThrow();
  });
  it('loads lib/market-hours', () => {
    expect(() => require('../lib/market-hours')).not.toThrow();
  });
  it('loads lib/validators', () => {
    expect(() => require('../lib/validators')).not.toThrow();
  });
  it('loads lib/config', () => {
    expect(() => require('../lib/config')).not.toThrow();
  });
  it('loads lib/logger', () => {
    expect(() => require('../lib/logger')).not.toThrow();
  });
});

describe('smoke: validators', () => {
  const { validateMemoryKey, validateSignalStrike, MAX_TEXT_BYTES } = require('../lib/validators');

  it('validateMemoryKey blocks protected keys', () => {
    expect(validateMemoryKey('luke_last_log')).toBe(false);
    expect(validateMemoryKey('current_state')).toBe(false);
    expect(validateMemoryKey('apex')).toBe(false);
    expect(validateMemoryKey('_schema_version')).toBe(false);
  });

  it('validateMemoryKey allows normal keys', () => {
    expect(validateMemoryKey('my_custom_key')).toBe(true);
    expect(validateMemoryKey('trade_notes')).toBe(true);
  });

  it('validateSignalStrike rejects non-numeric values', () => {
    expect(validateSignalStrike('abc')).toBe(false);
    expect(validateSignalStrike(NaN)).toBe(false);
    expect(validateSignalStrike(-1)).toBe(false);
  });

  it('validateSignalStrike accepts valid strike prices', () => {
    expect(validateSignalStrike(5800)).toBe(true);
    expect(validateSignalStrike(560)).toBe(true);
  });

  it('validateSignalStrike treats null/undefined as valid (optional field)', () => {
    expect(validateSignalStrike(null)).toBe(true);
    expect(validateSignalStrike(undefined)).toBe(true);
  });

  it('MAX_TEXT_BYTES is a positive number', () => {
    expect(typeof MAX_TEXT_BYTES).toBe('number');
    expect(MAX_TEXT_BYTES).toBeGreaterThan(0);
  });
});
