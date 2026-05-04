'use strict';

const { buildTradingState } = require('../lib/trading-state/level-state-engine');

function row(price, source = 'mancini') {
  return {
    id: `${source}:${price}`,
    instrument: 'ES',
    executable_instrument: 'ES',
    canonical_price_es: price,
    original_price: price,
    original_instrument: 'ES',
    source,
    sources: [source],
    roles: ['support_or_trigger'],
    freshness: 1,
    basis_method: 'native_es',
    is_executable_es: true,
    is_reference_only: false,
    is_chop_or_veto: false,
    confidence: 'B',
    evidence: [],
  };
}

function replayCandles({ explicit = true } = {}) {
  const stale = explicit ? false : true;
  return {
    symbol: 'ES',
    instrument: 'ES',
    timeframe: '1m',
    source: 'local_csv',
    source_label: 'local/replay',
    timestamp: '2026-04-29T08:33:00-04:00',
    stale,
    delayed: false,
    live: false,
    replay: true,
    usable_for_replay: true,
    usable_for_live_arming: false,
    confidence: 0.7,
    error: null,
    session: explicit ? 'replay' : 'latest-local',
    raw: { rows: 5, files: ['test.csv'] },
    candles: [
      { timestamp: '2026-04-29T08:29:00-04:00', open: 7225, high: 7226, low: 7224, close: 7225, volume: 10, finalized: true, stale, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:30:00-04:00', open: 7225, high: 7225, low: 7221.5, close: 7222, volume: 10, finalized: true, stale, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:31:00-04:00', open: 7222, high: 7224, low: 7221.75, close: 7223.25, volume: 10, finalized: true, stale, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:32:00-04:00', open: 7223.25, high: 7225, low: 7223, close: 7224, volume: 10, finalized: true, stale, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:33:00-04:00', open: 7224, high: 7225, low: 7223.25, close: 7224.5, volume: 10, finalized: true, stale, delayed: false, live: false, replay: true },
    ],
  };
}

describe('level-state candle gating', () => {
  it('does not use local/replay candles to arm live mode', async () => {
    const state = await buildTradingState({
      mode: 'live',
      marketData: { symbol: 'ES', instrument: 'ES', price: 7224.5, stale: false, delayed: false, confidence: 0.9, source: 'test_live', live: true },
      getCandlesFn: async () => replayCandles({ explicit: false }),
      clusterOptions: { rows: [row(7223, 'bobby'), row(7223, 'mancini')] },
    });

    expect(state.mode).toBe('live');
    expect(state.candle_feed.usable_for_live_arming).toBe(false);
    expect(state.clusters[0].state).toBe('APPROACHING_LEVEL');
    expect(state.candidates[0].status).toBe('WATCH_ONLY');
  });

  it('allows explicit replay/dev state proof while keeping live arming disabled', async () => {
    const state = await buildTradingState({
      mode: 'replay',
      getCandlesFn: async () => replayCandles({ explicit: true }),
      clusterOptions: { rows: [row(7223, 'bobby'), row(7223, 'mancini'), row(7230, 'mancini')] },
    });

    expect(state.mode).toBe('replay');
    expect(state.market_data.replay).toBe(true);
    expect(state.live_arming_enabled).toBe(false);
    expect(state.clusters[0].state).toBe('ARMED');
    expect(state.candidates[0].warnings).toContain('Local/replay candles cannot arm live candidates');
  });

  it('unknown candles and last-price-only block candle states', async () => {
    const state = await buildTradingState({
      mode: 'live',
      marketData: { symbol: 'ES', instrument: 'ES', price: 7224.5, stale: false, delayed: false, confidence: 0.9, source: 'test_live', live: true },
      getCandlesFn: async () => ({ ...replayCandles(), candles: [], usable_for_replay: false, error: 'none' }),
      clusterOptions: { rows: [row(7223)] },
    });

    expect(state.clusters[0].state).toBe('APPROACHING_LEVEL');
    expect(state.warnings).toContain('insufficient candle data; engine will not arm fresh trade candidates from latest price alone');
    expect(state.candidates[0].status).toBe('WATCH_ONLY');
  });
});
