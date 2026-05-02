const fs = require('fs');
const path = require('path');

const {
  getMarketPrice,
  getMarketSnapshot,
  normalizeMarketSymbol,
  _internal,
} = require('../lib/market-data');
const { makeMarketResult, makeUnknownResult } = require('../lib/market-data/result');
const { buildDecisionResponse } = require('../lib/operator/decision-adapter');

function ok(info, provider, price, fields = {}) {
  return makeMarketResult(info, {
    price,
    last: price,
    timestamp: '2026-05-01T20:00:00.000Z',
    session: fields.session || 'live',
    source: provider,
    sourcePriority: fields.priority ?? 1,
    stale: fields.stale ?? false,
    delayed: fields.delayed ?? false,
    confidence: fields.confidence ?? 0.9,
  });
}

describe('market data provider abstraction', () => {
  beforeEach(() => {
    _internal.clearMarketDataCache();
  });

  it('normalizes supported futures, index, and ETF symbols', () => {
    expect(normalizeMarketSymbol('ES').instrument).toBe('ES');
    expect(normalizeMarketSymbol('MES').equivalent).toBe('ES');
    expect(normalizeMarketSymbol('NQ').instrument).toBe('NQ');
    expect(normalizeMarketSymbol('MNQ').equivalent).toBe('NQ');
    expect(normalizeMarketSymbol('SPX').polygonTicker).toBe('I:SPX');
    expect(normalizeMarketSymbol('SPY').yahooSymbol).toBe('SPY');
    expect(normalizeMarketSymbol('QQQ').yahooSymbol).toBe('QQQ');
  });

  it('uses provider priority and returns the first successful provider', async () => {
    const quote = await getMarketPrice('ES', {
      cache: false,
      providerFns: {
        tradovate: info => ok(info, 'tradovate', 5232, { priority: 1 }),
        finnhub: info => ok(info, 'finnhub_quote', 5225, { priority: 3, stale: true, delayed: true, confidence: 0.5 }),
        yahoo: info => ok(info, 'yahoo_chart', 5220, { priority: 3 }),
      },
    });
    expect(quote.source).toBe('tradovate');
    expect(quote.price).toBe(5232);
    expect(quote.stale).toBe(false);
  });

  it('falls through to a labeled fallback provider without inventing a price', async () => {
    const quote = await getMarketPrice('ES', {
      cache: false,
      providerFns: {
        tradovate: info => makeUnknownResult(info, 'tradovate_down', 'tradovate', 1),
        finnhub: info => makeUnknownResult(info, 'finnhub_down', 'finnhub', 3),
        yahoo: info => ok(info, 'yahoo_chart', 5220, { priority: 3, delayed: true, confidence: 0.6 }),
      },
    });
    expect(quote.source).toBe('yahoo_chart');
    expect(quote.delayed).toBe(true);
    expect(quote.price).toBe(5220);
  });

  it('marks latest-close data stale and non-live', async () => {
    const quote = await getMarketPrice('SPX', {
      cache: false,
      providerFns: {
        polygon: info => ok(info, 'polygon_latest_close', 5215, {
          priority: 2,
          stale: true,
          delayed: true,
          confidence: 0.55,
          session: 'closed',
        }),
      },
    });
    expect(quote.session).toBe('closed');
    expect(quote.stale).toBe(true);
    expect(quote.delayed).toBe(true);
  });

  it('returns structured UNKNOWN when every provider fails', async () => {
    const quote = await getMarketPrice('ES', {
      cache: false,
      providerFns: {
        tradovate: info => makeUnknownResult(info, 'tradovate_missing', 'tradovate', 1),
        finnhub: info => makeUnknownResult(info, 'finnhub_missing', 'finnhub', 3),
        yahoo: info => makeUnknownResult(info, 'yahoo_missing', 'yahoo', 3),
      },
    });
    expect(quote.price).toBeNull();
    expect(quote.source).toBe('UNKNOWN');
    expect(quote.stale).toBe(true);
    expect(quote.error).toContain('tradovate');
  });

  it('builds snapshots without external calls when providers are mocked', async () => {
    const snapshot = await getMarketSnapshot(['ES', 'SPX'], {
      cache: false,
      providerFns: {
        tradovate: info => ok(info, 'tradovate', 5232),
        polygon: info => ok(info, 'polygon_latest_close', 5215, { stale: true, delayed: true, confidence: 0.55 }),
        finnhub: info => makeUnknownResult(info, 'not_used', 'finnhub', 3),
        yahoo: info => makeUnknownResult(info, 'not_used', 'yahoo', 3),
      },
    });
    expect(snapshot.ES.source).toBe('tradovate');
    expect(snapshot.SPX.source).toBe('polygon_latest_close');
  });
});

describe('production static market price guard', () => {
  it('does not keep old live-price approximation formulas in production price code', () => {
    const files = [
      path.join(__dirname, '..', 'lib', 'live-price.js'),
      path.join(__dirname, '..', 'trading', 'signals.js'),
      path.join(__dirname, '..', 'lib', 'operator', 'decision-adapter.js'),
      path.join(__dirname, '..', 'lib', 'operator', 'confluence-adapter.js'),
    ];
    const combined = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    expect(combined).not.toMatch(/SPX\s*\+\s*30/);
    expect(combined).not.toMatch(/41\.3/);
    expect(combined).not.toMatch(/SPY\s*(?:x|\*)\s*10/i);
  });
});

describe('decision adapter market data behavior', () => {
  it('includes marketData metadata and can use live trusted price', async () => {
    const decision = await buildDecisionResponse({
      instrument: 'ES',
      state: null,
      getMarketPriceFn: async info => ok(normalizeMarketSymbol(info), 'tradovate', 5232),
      buildTradeDecisionFn: ({ currentPrice }) => ({
        ok: true,
        action: 'PASS',
        reason: `price ${currentPrice}`,
        instrument: 'ES',
        entry: null,
        acceptable_entry: null,
        stop: null,
        target: null,
        sizing: 'pass',
        confluence: {},
        freshness: {},
        vetoes: [],
        evidence: [],
      }),
    });
    expect(decision.current_price).toBe(5232);
    expect(decision.marketData.source).toBe('tradovate');
  });

  it('does not feed stale latest-close data into the spine as live price', async () => {
    const decision = await buildDecisionResponse({
      instrument: 'ES',
      state: null,
      getMarketPriceFn: async info => ok(normalizeMarketSymbol(info), 'yahoo_chart', 5232, {
        stale: true,
        delayed: true,
        confidence: 0.4,
      }),
      buildTradeDecisionFn: ({ currentPrice }) => ({
        ok: true,
        action: 'LONG',
        reason: currentPrice === null ? 'no live price' : 'has live price',
        instrument: 'ES',
        entry: 5232,
        acceptable_entry: 5234,
        stop: 5228,
        target: 5248,
        sizing: 'quarter',
        confluence: { anchor: 5232 },
        freshness: {},
        vetoes: [],
        evidence: [],
      }),
    });
    expect(decision.current_price).toBeNull();
    expect(decision.marketData.stale).toBe(true);
    expect(decision.decision.action).toBe('PASS');
    expect(decision.decision.reason).toContain('WAIT - market price unavailable');
  });
});
