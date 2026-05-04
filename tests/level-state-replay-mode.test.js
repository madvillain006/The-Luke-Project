'use strict';

const { buildTradingState } = require('../lib/trading-state/level-state-engine');
const { getLocalCsvCandles } = require('../lib/market-data/providers/local-csv-candles');

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
    evidence: [{ source, timestamp: '2026-04-29T08:00:00-04:00', snippet: `${price}` }],
  };
}

function replayFeed(symbol = 'ES') {
  return {
    symbol,
    instrument: symbol,
    timeframe: '1m',
    source: 'local_csv',
    source_label: 'local/replay',
    timestamp: '2026-04-29T08:33:00-04:00',
    stale: false,
    delayed: false,
    live: false,
    replay: true,
    usable_for_replay: true,
    usable_for_live_arming: false,
    confidence: 0.7,
    error: null,
    session: 'replay',
    raw: { rows: 5, files: ['test.csv'] },
    candles: [
      { timestamp: '2026-04-29T08:29:00-04:00', open: 7225, high: 7226, low: 7224, close: 7225, volume: 10, finalized: true, stale: false, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:30:00-04:00', open: 7225, high: 7225, low: 7221.5, close: 7222, volume: 10, finalized: true, stale: false, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:31:00-04:00', open: 7222, high: 7224, low: 7221.75, close: 7223.25, volume: 10, finalized: true, stale: false, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:32:00-04:00', open: 7223.25, high: 7225, low: 7223, close: 7224, volume: 10, finalized: true, stale: false, delayed: false, live: false, replay: true },
      { timestamp: '2026-04-29T08:33:00-04:00', open: 7224, high: 7225, low: 7223.25, close: 7224.5, volume: 10, finalized: true, stale: false, delayed: false, live: false, replay: true },
    ],
  };
}

describe('level-state replay mode', () => {
  it('uses local/replay candles for replay state proof without enabling live arming', async () => {
    const state = await buildTradingState({
      mode: 'replay',
      date: '2026-04-29',
      time: '08:33',
      getCandlesFn: async () => replayFeed(),
      clusterOptions: { rows: [row(7223, 'bobby'), row(7223, 'mancini'), row(7230, 'mancini')] },
    });

    expect(state.mode).toBe('replay');
    expect(state.replay.replay_timestamp).toBe('2026-04-29T08:33:00-04:00');
    expect(state.replay.candle_window.count).toBe(5);
    expect(state.replay.current_candle.close).toBe(7224.5);
    expect(state.market_data.live).toBe(false);
    expect(state.market_data.replay).toBe(true);
    expect(state.live_arming_enabled).toBe(false);
    expect(state.candle_feed.usable_for_live_arming).toBe(false);
    expect(state.clusters[0].state).toBe('ARMED');
    const replayArmedAlert = state.alerts.find(alert => alert.state === 'ARMED' && alert.level_cluster_id.includes('7223'));
    expect(replayArmedAlert.message).toContain('REPLAY/DEV');
    expect(replayArmedAlert.detail).toContain('Mode: replay/dev. Not live.');
    expect(state.candidates[0].bracket.live_enabled).toBe(false);
    expect(state.candidates[0].warnings).toContain('Local/replay candles cannot arm live candidates');
  });

  it('returns an explicit replay error when no candle matches the request', async () => {
    const state = await buildTradingState({
      mode: 'replay',
      date: '2099-01-01',
      time: '09:49',
      getCandlesFn: async () => ({
        ...replayFeed(),
        candles: [],
        timestamp: null,
        usable_for_replay: false,
        error: 'local_csv_candles_empty_after_filter',
      }),
      clusterOptions: { rows: [row(7223)] },
    });

    expect(state.mode).toBe('replay');
    expect(state.replay.current_candle).toBe(null);
    expect(state.replay.error).toBe('local_csv_candles_empty_after_filter');
    expect(state.market_data.status).toBe('UNKNOWN');
    expect(state.live_arming_enabled).toBe(false);
    expect(state.warnings).toContain('replay candle unavailable: local_csv_candles_empty_after_filter');
  });

  it('rejects invalid replay date and time without fabricating candles', async () => {
    const invalidDate = await getLocalCsvCandles('ES', { mode: 'replay', date: '2026-99-99', time: '09:49' });
    const invalidTime = await getLocalCsvCandles('ES', { mode: 'replay', date: '2026-04-20', time: '29:49' });

    expect(invalidDate.candles).toEqual([]);
    expect(invalidDate.error).toBe('invalid_replay_date_2026-99-99');
    expect(invalidDate.live).toBe(false);
    expect(invalidTime.candles).toEqual([]);
    expect(invalidTime.error).toBe('invalid_replay_time_29:49');
  });

  it('does not substitute SPX candles for ES replay requests', async () => {
    const es = await getLocalCsvCandles('ES', { mode: 'replay', date: '2026-04-20', time: '09:49', limit: 1 });
    const spx = await getLocalCsvCandles('SPX', { mode: 'replay', date: '2026-04-20', time: '09:49', limit: 1 });

    expect(es.symbol).toBe('ES');
    expect(spx.symbol).toBe('SPX');
    expect(es.candles[0]?.source_file).not.toBe(spx.candles[0]?.source_file);
  });
});
