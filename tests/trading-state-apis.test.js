'use strict';

const fs = require('fs');
const path = require('path');

const { buildLevelStateResponse, buildTradeCandidatesResponse, buildTradingAlertsResponse, buildCandleStatusResponse } = require('../lib/operator/trading-state-adapter');

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

describe('trading state APIs', () => {
  it('builds read-only level-state payload with no_live_execution flag', async () => {
    const payload = await buildLevelStateResponse({
      getMarketSnapshotFn: async () => ({ ES: { symbol: 'ES', instrument: 'ES', price: 7224, stale: false, delayed: false, confidence: 0.9, source: 'test' } }),
      clusterOptions: { rows: [row(7223)] },
    });

    expect(payload.endpoint_type).toBe('trading_level_state');
    expect(payload.no_live_execution).toBe(true);
    expect(payload.read_only).toBe(true);
    expect(payload.clusters.length).toBe(1);
  });

  it('builds read-only trade-candidates and alerts payloads', async () => {
    const options = {
      marketData: { symbol: 'ES', instrument: 'ES', price: 7224, stale: false, delayed: false, confidence: 0.9, source: 'test' },
      clusterOptions: { rows: [row(7223)] },
    };

    const candidates = await buildTradeCandidatesResponse(options);
    const alerts = await buildTradingAlertsResponse(options);
    const candles = await buildCandleStatusResponse({ ...options, getCandlesFn: async () => ({
      symbol: 'ES',
      instrument: 'ES',
      timeframe: '1m',
      candles: [],
      source: 'UNKNOWN',
      source_label: 'UNKNOWN',
      timestamp: null,
      stale: true,
      delayed: false,
      live: false,
      replay: false,
      usable_for_replay: false,
      usable_for_live_arming: false,
      confidence: 0,
      error: 'none',
      session: 'UNKNOWN',
      raw: null,
    }) });

    expect(candidates.endpoint_type).toBe('trading_trade_candidates');
    expect(candidates.no_live_execution).toBe(true);
    expect(alerts.endpoint_type).toBe('trading_alerts');
    expect(alerts.no_live_execution).toBe(true);
    expect(candles.endpoint_type).toBe('trading_candle_status');
    expect(candles.no_live_execution).toBe(true);
  });

  it('adds only GET routes and does not import execution modules in trading adapters', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const adapter = fs.readFileSync(path.join(ROOT, 'lib', 'operator', 'trading-state-adapter.js'), 'utf8');
    const engine = fs.readFileSync(path.join(ROOT, 'lib', 'trading-state', 'level-state-engine.js'), 'utf8');

    expect(index).toContain('app.get("/api/trading/level-state"');
    expect(index).toContain('app.get("/api/trading/trade-candidates"');
    expect(index).toContain('app.get("/api/trading/alerts"');
    expect(index).toContain('app.get("/api/trading/candle-status"');
    expect(index).toContain('app.get("/api/trading/chart-data"');
    expect(index).toContain('app.get("/api/trading/source-health"');
    expect(index).toContain('app.get("/api/operator/heatmap-proof"');
    expect(index).not.toContain('app.post("/api/trading/level-state"');
    expect(index).not.toContain('app.post("/api/trading/trade-candidates"');
    expect(index).not.toContain('app.post("/api/trading/alerts"');
    expect(index).not.toContain('app.post("/api/trading/chart-data"');
    expect(index).not.toContain('app.post("/api/trading/source-health"');
    expect(index).not.toContain('app.post("/api/operator/heatmap-proof"');
    expect(`${adapter}\n${engine}`).not.toMatch(/execution-live|execution-paper|execution-shadow|broker-tradovate|executeLive|executePaper|executeShadow/);
  });
});
