'use strict';

const { getRegistry, getByCategory, getContextSummary } = require('../lib/reference-repo-registry');

describe('reference repo registry', () => {
  it('has exactly 10 entries with no duplicate keys', () => {
    const reg = getRegistry();
    expect(reg).toHaveLength(10);
    const keys = reg.map(e => e.key);
    expect(new Set(keys).size).toBe(10);
  });

  it('each entry has required fields', () => {
    for (const entry of getRegistry()) {
      expect(typeof entry.key).toBe('string');
      expect(typeof entry.local_path).toBe('string');
      expect(typeof entry.upstream_url).toBe('string');
      expect(typeof entry.commit).toBe('string');
      expect(typeof entry.category).toBe('string');
      expect(Array.isArray(entry.allowed_surfaces)).toBe(true);
      expect(Array.isArray(entry.banned_surfaces)).toBe(true);
      expect(typeof entry.description).toBe('string');
    }
  });

  it('no entry allows trading_execution surface', () => {
    for (const entry of getRegistry()) {
      expect(entry.allowed_surfaces).not.toContain('trading_execution');
    }
  });

  it('getByCategory filters correctly', () => {
    const memory = getByCategory('memory');
    expect(memory.length).toBeGreaterThan(0);
    for (const entry of memory) expect(entry.category).toBe('memory');
    const quant = getByCategory('quant');
    expect(quant.length).toBeGreaterThan(0);
  });

  it('getContextSummary returns a string of 400 chars or fewer', () => {
    const summary = getContextSummary();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeLessThanOrEqual(400);
    expect(summary).toContain('mempalace');
  });
});
