'use strict';

const { parseBobby, mergeBobby } = require('../lib/parse-bobby');

describe('parseBobby', () => {
  it('returns null for empty or non-string input', () => {
    expect(parseBobby('')).toBeNull();
    expect(parseBobby(null)).toBeNull();
    expect(parseBobby(undefined)).toBeNull();
    expect(parseBobby(42)).toBeNull();
  });

  it('returns null when no prices found near keywords', () => {
    expect(parseBobby('Just some random text with no relevant prices')).toBeNull();
  });

  it('extracts king node price', () => {
    const result = parseBobby('King node at 5800 — watching this magnet');
    expect(result).not.toBeNull();
    expect(result.king_nodes).toContain(5800);
    expect(result.source).toBe('bobby-text');
  });

  it('extracts support and resistance levels', () => {
    const result = parseBobby('Support at 5750 holding strong. Resistance wall at 5820 above.');
    expect(result).not.toBeNull();
    expect(result.support).toContain(5750);
    expect(result.resistance).toContain(5820);
  });

  it('detects bullish bias from keywords', () => {
    const result = parseBobby('Upper king node at 5800 — bullish above. Support cushion at 5780.');
    expect(result).not.toBeNull();
    expect(result.bias).toBe('BULLISH');
  });

  it('detects bearish bias from keywords', () => {
    const result = parseBobby('No floor below 5750 — bearish, air pocket below 5730.');
    expect(result).not.toBeNull();
    expect(result.bias).toBe('BEARISH');
  });

  it('returns null for messages over 10000 chars', () => {
    const big = 'king node at 5800 '.repeat(600);
    expect(parseBobby(big)).toBeNull();
  });

  it('detects VIX mention', () => {
    const result = parseBobby('King node 5800 — VIX elevated, be careful');
    expect(result).not.toBeNull();
    expect(result.vix_mentioned).toBe(true);
  });
});

describe('mergeBobby', () => {
  it('returns null if both are null', () => {
    expect(mergeBobby(null, null)).toBeNull();
  });

  it('returns visionResult if textResult is null', () => {
    const v = { king_nodes: [5800], support: [], resistance: [], bias: 'BULLISH', source: 'bobby-vision' };
    expect(mergeBobby(null, v)).toBe(v);
  });

  it('text result wins over vision when both have king_nodes', () => {
    const text   = { king_nodes: [5810], support: [], resistance: [], bias: 'NEUTRAL', raw: 'test', vix_mentioned: false };
    const vision = { king_nodes: [5820], support: [], resistance: [], bias: 'BULLISH', vix_mentioned: false };
    const merged = mergeBobby(text, vision);
    expect(merged.king_nodes).toEqual([5810]);
    expect(merged.source).toBe('bobby-merged');
  });
});
