const {
  buildSignal,
  chartWindow,
  selectCaseSignals,
  selectReviewRows,
} = require('../lib/research/multi-source-ladder-reclaim/visual-replay');

function bar(minute, open, high, low, close) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open, high, low, close };
}

function row(overrides = {}) {
  return {
    setup_id: 'setup-1',
    date: '2026-04-24',
    timestamp_et: '2026-04-24T09:30:00-04:00',
    flush_start_timestamp_et: '2026-04-24T09:29:00-04:00',
    entry_timestamp_et: '2026-04-24T09:32:00-04:00',
    classification: 'TRADEABLE_RESEARCH',
    source_combo: 'bobby+mancini',
    flush_type: 'multi_level',
    clusters_lost_count: 2,
    clusters_lost: [100, 102],
    first_reclaimed_level: 100,
    first_reclaimed_source_type: 'bobby+mancini',
    entry_model: 'reclaim_close_first_cluster',
    entry_price: 100.5,
    stop_model: 'sweep_low_minus_1tick',
    stop_price: 98.5,
    stop_points: 2,
    target_model: 'fixed_plus_2',
    tp1: 102.5,
    next_cluster_target: 102,
    late_reclaim_level: 102,
    late_reclaim_timestamp_et: '2026-04-24T09:36:00-04:00',
    points_captured_before_late_reclaim: 1.5,
    tp1_hit: true,
    stop_first: false,
    same_bar_ambiguity: false,
    max_heat_before_tp1: 0.75,
    pnl_1es_slip_0_5_round_trip: 75,
    pnl_2es_slip_0_5_round_trip: 150,
    ...overrides,
  };
}

describe('ladder reclaim visual review', () => {
  it('builds a chart window from surrounding historical bars only', () => {
    const bars = [
      bar('10', 99, 100, 98, 99),
      bar('17', 99, 100, 98, 99),
      bar('32', 100, 102, 99, 101),
      bar('59', 101, 103, 100, 102),
    ];
    const window = chartWindow(bars, '2026-04-24T09:32:00-04:00', 15, 30);
    expect(window.map(item => item.timestamp)).toEqual([
      '2026-04-24T09:17:00-04:00',
      '2026-04-24T09:32:00-04:00',
      '2026-04-24T09:59:00-04:00',
    ]);
  });

  it('renders first reclaim overlays without promoting the setup', () => {
    const barsByDate = new Map([['2026-04-24', [bar('29', 102, 102, 99, 99.5), bar('32', 100, 103, 99.75, 102.5)]]]);
    const signal = buildSignal(row(), barsByDate, new Set());
    expect(signal.chart.overlays.clusters_lost).toEqual([100, 102]);
    expect(signal.chart.overlays.first_reclaimed_level).toBe(100);
    expect(signal.chart.overlays.late_reclaim_level).toBe(102);
    expect(signal.result).toBe('tp_plus_2');
  });

  it('selects Bobby+Mancini and 25k 1ES review rows', () => {
    const rows = [
      row(),
      row({ setup_id: 'setup-2', source_combo: 'saty', entry_timestamp_et: '2026-04-24T09:35:00-04:00' }),
    ];
    const summary = {
      account_sim: {
        '25k_1ES_STARTER': {
          day_results: [{ taken: [{ setup_id: 'setup-2', entry_timestamp_et: '2026-04-24T09:35:00-04:00' }] }],
        },
      },
    };
    const selected = selectReviewRows(rows, summary);
    expect(selected.bobbyMancini).toHaveLength(1);
    expect(selected.account25).toHaveLength(1);
  });

  it('separates positive and negative case-image candidates', () => {
    const result = {
      signals: [
        buildSignal(row(), new Map([['2026-04-24', [bar('32', 100, 103, 99, 102.5)]]]), new Set()),
        buildSignal(row({
          setup_id: 'bad',
          tp1_hit: false,
          stop_first: true,
          max_heat_before_tp1: 4,
        }), new Map([['2026-04-24', [bar('32', 100, 101, 98, 98.5)]]]), new Set()),
      ],
    };
    const cases = selectCaseSignals(result, 5);
    expect(cases.positives).toHaveLength(1);
    expect(cases.negatives).toHaveLength(1);
  });
});
