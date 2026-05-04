'use strict';

const fs = require('fs');
const path = require('path');

const {
  WATCHLIST_STATES,
  buildFakeBreakdownLiveWatchlist,
} = require('../lib/research/fake-breakdown-state-machine/live-watchlist');
const {
  buildFakeBreakdownWatchlistResponse,
} = require('../lib/operator/fake-breakdown-watchlist-adapter');

const ROOT = path.join(__dirname, '..');

function mention(analyst, fields = {}) {
  return {
    analyst,
    date: '2026-04-09',
    timestamp: fields.timestamp || '2026-04-09T09:00:00-04:00',
    source_type: fields.source_type || 'text',
    intent: fields.intent || null,
    significance: fields.significance || null,
    direction: fields.direction || null,
  };
}

function level(price, instrument = 'ES', analysts = ['saty'], fields = {}) {
  const mentions = analysts.map(analyst => mention(analyst, fields));
  return {
    canonical_price: price,
    instrument,
    first_seen: mentions[0].timestamp,
    last_seen: mentions.at(-1).timestamp,
    total_mentions: mentions.length,
    mentions,
    ...fields,
  };
}

function market(price, fields = {}) {
  return {
    instrument: 'ES',
    symbol: 'ES',
    price,
    timestamp: fields.timestamp || '2026-04-09T15:04:00-04:00',
    source: fields.source || 'test_market',
    stale: fields.stale ?? false,
    delayed: fields.delayed ?? false,
    confidence: fields.confidence ?? 0.9,
    error: fields.error || null,
  };
}

function barsForHold() {
  return [
    { timestamp: '2026-04-09T15:00:00-04:00', open: 100.5, high: 100.75, low: 98.5, close: 99 },
    { timestamp: '2026-04-09T15:01:00-04:00', open: 99, high: 101, low: 99, close: 100.5 },
    { timestamp: '2026-04-09T15:02:00-04:00', open: 100.5, high: 101.25, low: 100.25, close: 100.75 },
    { timestamp: '2026-04-09T15:03:00-04:00', open: 100.75, high: 101.5, low: 100.5, close: 101 },
    { timestamp: '2026-04-09T15:04:00-04:00', open: 101, high: 101.75, low: 100.75, close: 101.25 },
  ];
}

describe('fake breakdown live watchlist', () => {
  it('returns UNKNOWN/NO_SETUP and does not arm without ES price', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(100), level(106)],
      marketData: market(null, { source: 'UNKNOWN', stale: true, delayed: true, confidence: 0 }),
      recentBars: barsForHold(),
      now: new Date('2026-04-09T15:04:00-04:00'),
    });

    expect(result.state).toBe(WATCHLIST_STATES.NO_SETUP);
    expect(result.current_price).toBeNull();
    expect(result.rule_candidate).toBe('none');
    expect(result.warnings).toContain('ES market price UNKNOWN; watchlist cannot arm');
  });

  it('displays Rule A state when power-hour three-candle hold and target space are present', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(100), level(106, 'ES', ['saty', 'mancini'])],
      marketData: market(101.25),
      recentBars: barsForHold(),
      now: new Date('2026-04-09T15:04:00-04:00'),
    });

    expect(result.state).toBe(WATCHLIST_STATES.ARMED_RULE_A);
    expect(result.rule_candidate).toBe('A');
    expect(result.rule_candidates.find(rule => rule.id === 'A')).toEqual(expect.objectContaining({
      status: 'WATCHLIST_ONLY',
      blocked: false,
    }));
    expect(result.suggested_research_plan.warning).toBe('WATCHLIST ONLY - not a trade recommendation.');
  });

  it('blocks Rule B repeats after a same-level loss today', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(100), level(105)],
      marketData: market(101.5, { timestamp: '2026-04-09T15:01:00-04:00' }),
      recentBars: barsForHold().slice(0, 2),
      todayLosses: [{ date: '2026-04-09', level: 100, pnl: -350 }],
      now: new Date('2026-04-09T15:01:00-04:00'),
    });

    expect(result.rule_candidate).toBe('B');
    expect(result.state).toBe(WATCHLIST_STATES.WATCH_ONLY);
    expect(result.prior_loss_same_level_today).toBe(true);
    expect(result.no_repeat_after_loss_throttle).toEqual(expect.objectContaining({
      status: 'BLOCKED_REPEAT_LEVEL_AFTER_LOSS',
      blocked: true,
    }));
  });

  it('displays Rule C as WATCHLIST_ONLY when Bobby target and two-candle hold are present', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(100, 'ES', ['saty']), level(104, 'ES', ['bobby'], { source_type: 'heatmap' })],
      marketData: market(101, { timestamp: '2026-04-09T14:04:00-04:00' }),
      recentBars: [
        { timestamp: '2026-04-09T14:00:00-04:00', open: 100.5, high: 100.75, low: 98.75, close: 99 },
        { timestamp: '2026-04-09T14:01:00-04:00', open: 99, high: 101, low: 99, close: 100.5 },
        { timestamp: '2026-04-09T14:02:00-04:00', open: 100.5, high: 101.25, low: 100.25, close: 100.75 },
      ],
      now: new Date('2026-04-09T14:02:00-04:00'),
    });

    expect(result.state).toBe(WATCHLIST_STATES.ARMED_RULE_C);
    expect(result.rule_candidate).toBe('C');
    expect(result.rule_candidates.find(rule => rule.id === 'C')).toEqual(expect.objectContaining({
      status: 'WATCHLIST_ONLY',
    }));
  });

  it('does not arm on stale market data even if historical bar conditions match', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(100), level(106)],
      marketData: market(101.25, { stale: true, delayed: true, confidence: 0.4 }),
      recentBars: barsForHold(),
      now: new Date('2026-04-09T15:04:00-04:00'),
    });

    expect(result.state).not.toBe(WATCHLIST_STATES.ARMED_RULE_A);
    expect(result.rule_candidate).toBe('none');
    expect(result.required_next_condition).toContain('fresh ES market data');
  });

  it('keeps SPX reference levels non-executable without an explicit basis', () => {
    const result = buildFakeBreakdownLiveWatchlist({
      levels: [level(5100, 'SPX', ['bobby'], { source_type: 'heatmap' })],
      marketData: market(5102),
      recentBars: [],
      now: new Date('2026-04-09T15:04:00-04:00'),
    });

    expect(result.state).toBe(WATCHLIST_STATES.NO_SETUP);
    expect(result.active_level).toBeNull();
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toEqual(expect.objectContaining({
      original_instrument: 'SPX',
      basis_method: 'reference_only',
      executable: false,
    }));
  });

  it('builds the read-only endpoint payload through the operator adapter', async () => {
    const result = await buildFakeBreakdownWatchlistResponse({
      getMarketPriceFn: async () => market(101.25),
      queryLevelsFn: ({ instrument }) => instrument === 'ES' ? [level(100), level(106)] : [],
      readTradingStateFn: () => ({ ok: true, value: { shadow_session: { trades: [] } } }),
      readJsonFn: () => ({
        generated_at: '2026-04-09T00:00:00.000Z',
        summary: {
          signal_count: 301,
          by_rule: {
            A: { signals: 33, tradeable: 32, tp2_hit_rate: 0.8125, stop_first_rate: 0.1875 },
            B: { signals: 192, tradeable: 155, tp2_hit_rate: 0.761, stop_first_rate: 0.174 },
            C: { signals: 76, tradeable: 56, tp2_hit_rate: 0.804, stop_first_rate: 0.268 },
          },
        },
      }),
      recentBars: barsForHold(),
      now: new Date('2026-04-09T15:04:00-04:00'),
    });

    expect(result.endpoint_type).toBe('fake_breakdown_watchlist');
    expect(result.read_only).toBe(true);
    expect(result.rule_status).toEqual({ A: 'WATCHLIST_ONLY', B: 'WATCHLIST_ONLY', C: 'WATCHLIST_ONLY' });
    expect(result.artifact_summary).toEqual(expect.objectContaining({
      signal_count: 301,
      artifact_route: '/research/fake-breakdown-watchlist',
    }));
    expect(result.source).toEqual(expect.objectContaining({
      market_data: 'market-data adapter',
      levels: 'Level Memory active window',
    }));
  });

  it('adds only a GET endpoint and no live execution imports in new watchlist code', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    expect(index).toMatch(/app\.get\("\/api\/research\/fake-breakdown-watchlist"/);
    expect(index).toMatch(/app\.get\("\/research\/fake-breakdown-watchlist"/);
    expect(index).not.toMatch(/app\.post\("\/api\/research\/fake-breakdown-watchlist"/);

    const watchlistFiles = [
      path.join(ROOT, 'lib', 'research', 'fake-breakdown-state-machine', 'live-watchlist.js'),
      path.join(ROOT, 'lib', 'operator', 'fake-breakdown-watchlist-adapter.js'),
    ].map(file => fs.readFileSync(file, 'utf8')).join('\n');
    expect(watchlistFiles).not.toMatch(/buildTradeDecision|broker-tradovate|execution-live|executeOrder|router\.post/i);

    const html = fs.readFileSync(path.join(ROOT, 'operator-v2.html'), 'utf8');
    expect(html).toContain('/api/research/fake-breakdown-watchlist?instrument=ES');
    expect(html).toContain('Fake Breakdown Watchlist');
    expect(html).toContain('WATCHLIST ONLY - not a trade recommendation.');
  });
});
