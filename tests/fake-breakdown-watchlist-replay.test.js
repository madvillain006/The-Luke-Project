'use strict';

const {
  chartWindow,
  enrichSignal,
  resultLabel,
  renderWatchlistHtml,
} = require('../lib/research/fake-breakdown-state-machine/visual-replay');

function minuteBars(startMinute, endMinute) {
  const rows = [];
  for (let minute = startMinute; minute <= endMinute; minute += 1) {
    const mm = String(minute).padStart(2, '0');
    rows.push({
      timestamp: `2026-04-09T10:${mm}:00-04:00`,
      open: 100 + minute * 0.1,
      high: 101 + minute * 0.1,
      low: 99 + minute * 0.1,
      close: 100.5 + minute * 0.1,
      volume: 100,
    });
  }
  return rows;
}

function baseSignal(overrides = {}) {
  return {
    setup_id: 'setup-1',
    rule_id: 'A',
    rule_label: 'Rule A',
    date: '2026-04-09',
    entry_timestamp_et: '2026-04-09T10:15:00-04:00',
    source_combo: 'saty+bobby',
    entry_model: '3_candle_hold',
    final_state: 'TRADEABLE',
    stop_points: 3,
    stop_price: 100,
    tp2_hit: true,
    tp3_hit: false,
    stop_first: false,
    heat_before_tp1: 0.75,
    time_to_tp1: 3,
    state_events: [
      { state: 'LEVEL_WATCH', timestamp_et: '2026-04-09T09:55:00-04:00', next_target_above: 108 },
      { state: 'ZONE_WATCH', timestamp_et: '2026-04-09T10:00:00-04:00' },
      { state: 'BREAKDOWN_DETECTED', timestamp_et: '2026-04-09T10:05:00-04:00' },
      { state: 'RECLAIM_WATCH', timestamp_et: '2026-04-09T10:10:00-04:00' },
      { state: 'ARMED', timestamp_et: '2026-04-09T10:15:00-04:00' },
      { state: 'TRADEABLE', timestamp_et: '2026-04-09T10:15:00-04:00', entry_price: 103, stop_price: 100, tp1: 105, tp3: 106 },
    ],
    ...overrides,
  };
}

describe('fake breakdown watchlist replay', () => {
  it('builds the per-signal chart window from surrounding historical bars only', () => {
    const bars = minuteBars(0, 59);
    const window = chartWindow(bars, '2026-04-09T10:15:00-04:00', 15, 30);

    expect(window.at(0).timestamp).toBe('2026-04-09T10:00:00-04:00');
    expect(window.at(-1).timestamp).toBe('2026-04-09T10:45:00-04:00');
    expect(window).toHaveLength(46);
    expect(window.some(bar => bar.timestamp === '2026-04-09T10:46:00-04:00')).toBe(false);
  });

  it('preserves no-lookahead state timing and overlays without changing transitions', () => {
    const signal = baseSignal();
    const rows = new Map([[
      'setup-1|2026-04-09T10:15:00-04:00|3_candle_hold|3',
      {
        setup_id: 'setup-1',
        entry_timestamp_et: '2026-04-09T10:15:00-04:00',
        entry_model: '3_candle_hold',
        stop_points: 3,
        executable_level: 102,
        entry_price: 103,
        stop_price: 100,
        tp1: 105,
        tp3: 106,
        next_trusted_target_distance: 5,
        bobby_heatmap_target_present: true,
        basis_method: 'native_es',
      },
    ]]);
    const enriched = enrichSignal({
      signal,
      v3Index: rows,
      barsByDate: new Map([['2026-04-09', minuteBars(0, 59)]]),
      spxBarsByDate: new Map(),
    });

    expect(enriched.state_events.map(event => event.state)).toEqual(signal.state_events.map(event => event.state));
    expect(enriched.chart.markers).toEqual(signal.state_events);
    expect(enriched.chart.overlays).toEqual(expect.objectContaining({
      level: 102,
      entry: 103,
      stop: 100,
      tp1: 105,
      tp3: 106,
      next_trusted_target_above: 108,
    }));
    for (const event of enriched.state_events.filter(event => event.state !== 'TRADEABLE')) {
      expect(event.timestamp_et <= enriched.timestamp_et).toBe(true);
    }
  });

  it('labels outcomes and renders a standalone read-only HTML artifact', () => {
    expect(resultLabel(baseSignal({ tp2_hit: true, tp3_hit: true }))).toBe('tp_plus_3');
    expect(resultLabel(baseSignal({ tp2_hit: false, stop_first: true }))).toBe('stop_first');
    expect(resultLabel(baseSignal({ final_state: 'INVALIDATED', tp2_hit: false }))).toBe('invalidated');

    const html = renderWatchlistHtml({
      generated_at: '2026-04-09T00:00:00.000Z',
      summary: { by_rule: { A: { signals: 1, tp2_hit_rate: 1, stop_first_rate: 0, positive_pnl_2es: 150 } } },
      signals: [baseSignal()],
    });
    expect(html).toContain('Read-only research artifact');
    expect(html).not.toMatch(/<script[^>]+src=|executeOrder|broker-tradovate|execution-live/i);
  });
});
