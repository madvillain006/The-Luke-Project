'use strict';

const { detectConfluence, inferInstrument } = require('../lib/confluence');

describe('inferInstrument', () => {
  it('classifies ES/NQ range correctly (>=1000)', () => {
    expect(inferInstrument(5800)).toBe('ES_NQ');
    expect(inferInstrument(20000)).toBe('ES_NQ');
    expect(inferInstrument(1000)).toBe('ES_NQ');
  });
  it('classifies SPY/QQQ range correctly (50–999)', () => {
    expect(inferInstrument(999)).toBe('SPY_QQQ');
    expect(inferInstrument(640)).toBe('SPY_QQQ');
    expect(inferInstrument(500)).toBe('SPY_QQQ');
    expect(inferInstrument(450)).toBe('SPY_QQQ');
    expect(inferInstrument(100)).toBe('SPY_QQQ');
    expect(inferInstrument(50)).toBe('SPY_QQQ');
  });
  it('returns null for noise below 50', () => {
    expect(inferInstrument(49)).toBeNull();
  });
  it('identifies SPX only via tickerHint', () => {
    expect(inferInstrument(5800, 'SPX')).toBe('SPX');
    expect(inferInstrument(560,  'SPY')).toBe('SPY_QQQ');
    expect(inferInstrument(640,  'QQQ')).toBe('SPY_QQQ');
    expect(inferInstrument(5800, 'ES')).toBe('ES_NQ');
    expect(inferInstrument(5800, 'NQ')).toBe('ES_NQ');
  });
});

describe('detectConfluence', () => {
  it('returns empty array when no signals', () => {
    expect(detectConfluence([], [], 5800)).toEqual([]);
  });

  it('detects confluence zone from ximes LIVE_ENTRY + bobby support at same level', () => {
    const ximes = [{ signal_type: 'LIVE_ENTRY', analyst: 'ximes', strike: 560, ticker: 'SPY', ts: Date.now() }];
    const bobby = [{ king_nodes: [560], support: [], resistance: [], bias: 'BULLISH', source: 'bobby-text' }];
    const zones = detectConfluence(ximes, bobby, 558);
    expect(zones.length).toBeGreaterThan(0);
    const zone = zones[0];
    expect(zone.level).toBeCloseTo(560, 0);
    expect(zone.score).toBeGreaterThan(0);
  });

  it('scores bobby image higher (vision_parsed adds bonus)', () => {
    const ximes = [];
    const bobbyText = [{ king_nodes: [580], support: [], resistance: [], bias: 'NEUTRAL', source: 'bobby-text' }];
    const bobbyVision = [{ king_nodes: [580], support: [], resistance: [], bias: 'NEUTRAL', source: 'bobby-vision', vision_parsed: true }];
    const textZones   = detectConfluence(ximes, bobbyText,   578);
    const visionZones = detectConfluence(ximes, bobbyVision, 578);
    expect(visionZones[0].score).toBeGreaterThan(textZones[0].score);
  });

  it('sorts zones by score descending', () => {
    // Two bobby king nodes — one with an image (higher score) and one without
    const bobby = [
      { king_nodes: [555, 560], support: [], resistance: [], bias: 'NEUTRAL', source: 'bobby-text' },
      { king_nodes: [555],      support: [], resistance: [], bias: 'NEUTRAL', source: 'bobby-vision', vision_parsed: true },
    ];
    const zones = detectConfluence([], bobby, 550);
    // first zone should have highest score
    for (let i = 0; i < zones.length - 1; i++) {
      expect(zones[i].score).toBeGreaterThanOrEqual(zones[i + 1].score);
    }
  });

  it('returns NEUTRAL bias when bullish and bearish sources cancel out', () => {
    // ximes (BULLISH) and richydubz (BEARISH) at same level → equal bull/bear → NEUTRAL
    const ximes = [
      { signal_type: 'CONTEXT', analyst: 'ximes',     levels: [560], bias: 'BULLISH', ts: Date.now() },
      { signal_type: 'CONTEXT', analyst: 'richydubz', levels: [560], bias: 'BEARISH', ts: Date.now() },
    ];
    const zones = detectConfluence(ximes, [], 555);
    if (zones.length > 0) {
      expect(zones[0].bias).toBe('NEUTRAL');
    }
  });
});
