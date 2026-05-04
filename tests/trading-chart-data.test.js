'use strict';

const {
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
} = require('../lib/trading-state/chart-data');

describe('trading chart data API builders', () => {
  it('uses the candle feed and level-state engine path for replay chart data', async () => {
    const chart = await buildTradingChartDataResponse({
      instrument: 'ES',
      mode: 'replay',
      example: 'positive',
      limit: 180,
    });

    expect(chart.endpoint_type).toBe('trading_chart_data');
    expect(chart.read_only).toBe(true);
    expect(chart.no_live_execution).toBe(true);
    expect(chart.mode).toBe('replay');
    expect(chart.data_mode.live).toBe(false);
    expect(chart.data_mode.can_generate_live_candidate).toBe(false);
    expect(chart.candle_feed.source).toBe('local_csv');
    expect(chart.candles.length).toBeGreaterThan(0);
    expect(chart.levels.length).toBeGreaterThan(0);
    expect(chart.bracket_visual?.can_submit).toBe(false);
    expect((chart.candidates || []).every(candidate => candidate.can_execute_live !== true)).toBe(true);
  });

  it('returns source health with heatmap_gex and SPX reference basis policy', async () => {
    const health = await buildTradingSourceHealthResponse({
      instrument: 'ES',
      mode: 'replay',
      example: 'positive',
      limit: 180,
    });

    expect(health.endpoint_type).toBe('trading_source_health');
    expect(health.no_live_execution).toBe(true);
    expect(health.feeds.ES.source).toBe('local_csv');
    expect(health.feeds.SPX.source).toBe('local_csv');
    expect(health.heatmap_gex.family).toBe('heatmap_gex');
    expect(health.basis_status.fixed_spx_to_es_conversion_used).toBe(false);
    expect(health.usable_for_live_arming).toBe(false);
  });
});
