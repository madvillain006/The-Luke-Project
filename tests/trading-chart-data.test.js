'use strict';

const { DEFAULT_SEARCH_DIRS } = require('../lib/market-data/providers/local-csv-candles');
const { createChartLevelFixtures, syntheticLevelRow } = require('./helpers/ci-chart-level-fixtures');
const {
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
} = require('../lib/trading-state/chart-data');

describe('trading chart data API builders', () => {
  let fixture;
  let originalSearchDirs;

  beforeEach(() => {
    fixture = createChartLevelFixtures();
    originalSearchDirs = [...DEFAULT_SEARCH_DIRS];
    // The chart's secondary feed reads use the exported provider defaults.
    // Limit them to test inputs, and restore the defaults even on failure.
    DEFAULT_SEARCH_DIRS.splice(0, DEFAULT_SEARCH_DIRS.length, fixture.candleDir);
  });

  afterEach(() => {
    DEFAULT_SEARCH_DIRS.splice(0, DEFAULT_SEARCH_DIRS.length, ...originalSearchDirs);
    fixture.cleanup();
  });

  function replayRequest() {
    return {
      instrument: 'ES', mode: 'replay', example: 'positive',
      date: '2026-04-29', time: '08:33', limit: 180,
      clusterOptions: { rows: [syntheticLevelRow(7223, 'bobby'), syntheticLevelRow(7223), syntheticLevelRow(7230)] },
    };
  }

  it('uses the candle feed and level-state engine path for replay chart data', async () => {
    const chart = await buildTradingChartDataResponse(replayRequest());

    expect(chart.endpoint_type).toBe('trading_chart_data');
    expect(chart.read_only).toBe(true);
    expect(chart.no_live_execution).toBe(true);
    expect(chart.mode).toBe('replay');
    expect(chart.data_mode.live).toBe(false);
    expect(chart.data_mode.can_generate_live_candidate).toBe(false);
    expect(chart.candle_feed.source).toBe('local_csv');
    expect(chart.candles.length).toBeGreaterThan(0);
    expect(chart.levels.length).toBeGreaterThan(0);
    expect(chart.candles).toHaveLength(5);
    expect(chart.candles.at(-1).close).toBe(7224.5);
    expect(chart.levels.some(level => level.price === 7223 && level.state === 'ARMED')).toBe(true);
    expect(chart.bracket_visual?.can_submit).toBe(false);
    expect((chart.candidates || []).every(candidate => candidate.can_execute_live !== true)).toBe(true);
  }, 15000);

  it('returns source health with heatmap_gex and SPX reference basis policy', async () => {
    const health = await buildTradingSourceHealthResponse(replayRequest());

    expect(health.endpoint_type).toBe('trading_source_health');
    expect(health.no_live_execution).toBe(true);
    expect(health.feeds.ES.source).toBe('local_csv');
    expect(health.feeds.SPX.source).toBe('local_csv');
    expect(health.feeds.ES.candle_count).toBe(1);
    expect(health.feeds.SPX.candle_count).toBe(1);
    expect(health.heatmap_gex.family).toBe('heatmap_gex');
    expect(health.basis_status.fixed_spx_to_es_conversion_used).toBe(false);
    expect(health.usable_for_live_arming).toBe(false);
  });
});
