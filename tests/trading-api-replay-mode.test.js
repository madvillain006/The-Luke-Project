'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildLevelStateResponse,
  buildTradeCandidatesResponse,
  buildTradingAlertsResponse,
} = require('../lib/operator/trading-state-adapter');

const ROOT = path.join(__dirname, '..');

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

function replayFeed() {
  return {
    symbol: 'ES',
    instrument: 'ES',
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

describe('trading API replay mode', () => {
  it('returns replay metadata from level-state, candidate, and alert adapters', async () => {
    const options = {
      mode: 'replay',
      date: '2026-04-29',
      time: '08:33',
      getCandlesFn: async () => replayFeed(),
      clusterOptions: { rows: [row(7223, 'bobby'), row(7223, 'mancini'), row(7230, 'mancini')] },
    };

    const levelState = await buildLevelStateResponse(options);
    const candidates = await buildTradeCandidatesResponse(options);
    const alerts = await buildTradingAlertsResponse(options);

    for (const payload of [levelState, candidates, alerts]) {
      expect(payload.mode).toBe('replay');
      expect(payload.no_live_execution).toBe(true);
      expect(payload.read_only).toBe(true);
      expect(payload.replay.live).toBe(false);
      expect(payload.replay.usable_for_live_arming).toBe(false);
      expect(payload.candle_feed.source).toBe('local_csv');
      expect(payload.candle_feed.usable_for_replay).toBe(true);
      expect(payload.candle_feed.usable_for_live_arming).toBe(false);
      expect(payload.live_arming_enabled).toBe(false);
    }
    expect(candidates.candidates[0].bracket.live_enabled).toBe(false);
  });

  it('keeps replay APIs GET-only and away from execution modules', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const adapter = fs.readFileSync(path.join(ROOT, 'lib', 'operator', 'trading-state-adapter.js'), 'utf8');
    const engine = fs.readFileSync(path.join(ROOT, 'lib', 'trading-state', 'level-state-engine.js'), 'utf8');

    expect(index).toContain('mode: req.query.mode');
    expect(index).not.toContain('app.post("/api/trading/level-state"');
    expect(index).not.toContain('app.post("/api/trading/trade-candidates"');
    expect(index).not.toContain('app.post("/api/trading/alerts"');
    expect(`${adapter}\n${engine}`).not.toMatch(/executeLive|executePaper|executeShadow|execution-live|execution-paper|execution-shadow|broker-tradovate/);
  });
});
