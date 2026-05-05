const { detectFlushesForSession } = require('../lib/research/multi-source-ladder-reclaim/flush-detector');
const { planRowsForFlush } = require('../lib/research/multi-source-ladder-reclaim/evaluator');
const { ACCOUNT_25K, ACCOUNT_50K, classifyRow, riskDollars, simulateAccount } = require('../lib/research/multi-source-ladder-reclaim/metrics');

function bar(minute, open, high, low, close) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open, high, low, close };
}

function fact(id, source, price, available = '2026-04-24T09:25:00-04:00', levelType = 'support') {
  return {
    id,
    source,
    source_type: 'fixture',
    level_type: levelType,
    role: levelType,
    original_level: price,
    original_level_instrument: 'ES',
    available_at_et: available,
  };
}

const CONFIG = {
  cluster_tolerance: 1,
  break_buffer: 0.25,
  preferred_max_stop_points: 3,
  hard_max_stop_points: 5,
  basis_methods: ['native_es', 'reference_only'],
};

describe('multi-source ladder first-reclaim evaluator', () => {
  it('selects the first lower reclaimed cluster before upper reclaim', () => {
    const bars = [
      bar('30', 105, 105, 104.5, 105),
      bar('31', 105, 105, 99, 99.5),
      bar('32', 99.5, 100.75, 99.25, 100.5),
      bar('33', 100.5, 102.75, 100.25, 102.5),
      bar('34', 102.5, 104.5, 102, 104),
    ];
    const facts = [
      fact('saty-104', 'saty', 104),
      fact('mancini-102', 'mancini', 102),
      fact('dubz-100', 'dubz', 100),
      fact('target-106', 'mancini', 106, '2026-04-24T09:25:00-04:00', 'target'),
    ];
    const [flush] = detectFlushesForSession({
      session: { date: '2026-04-24', replayBars: bars },
      facts,
      spxBars: [],
      options: { clusterTolerance: 1, basisMethods: ['reference_only'] },
    });
    expect(flush.first_reclaimed_price).toBe(100);
    expect(flush.upper_lost_clusters.map(row => row.canonical_price_es)).toContain(102);
    const rows = planRowsForFlush({ flush, bars, facts, spxBars: [], config: CONFIG });
    expect(rows.some(row => row.entry_model === 'reclaim_close_first_cluster')).toBe(true);
    expect(rows.some(row => row.first_reclaimed_level === 100)).toBe(true);
    expect(rows.some(row => row.next_cluster_target === 102)).toBe(true);
    expect(rows.some(row => row.points_captured_before_late_reclaim > 0)).toBe(true);
  });

  it('rejects missing cluster target rows and stops wider than hard max', () => {
    const missingTarget = classifyRow({
      target_model: 'next_trusted_cluster_above',
      next_cluster_target: null,
      tp1: 102,
      stop_points: 2,
      risk_dollars_2es: 200,
    });
    expect(missingTarget.classification).toBe('PASS_NO_TARGET');

    const wide = classifyRow({
      target_model: 'fixed_plus_2',
      tp1: 102,
      stop_points: 6,
      risk_dollars_2es: 600,
    });
    expect(wide.classification).toBe('PASS_RISK');
  });

  it('calculates prop risk for one and two ES contracts', () => {
    expect(riskDollars(3, 2)).toBe(300);
    expect(riskDollars(3, 1)).toBe(150);
  });

  it('treats prop target hit as diagnostic while continuing continuous profitability sim', () => {
    const rows = [
      {
        setup_id: 'a',
        date: '2026-04-24',
        entry_timestamp_et: '2026-04-24T15:00:00-04:00',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        stop_points: 2,
        pnl_2es_slip_0_5_round_trip: 150,
        pnl_1es_slip_0_5_round_trip: 75,
      },
      {
        setup_id: 'b',
        date: '2026-04-24',
        entry_timestamp_et: '2026-04-24T15:10:00-04:00',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        stop_points: 2,
        pnl_2es_slip_0_5_round_trip: -50,
        pnl_1es_slip_0_5_round_trip: -25,
      },
      {
        setup_id: 'c',
        date: '2026-04-24',
        entry_timestamp_et: '2026-04-24T15:20:00-04:00',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        stop_points: 2,
        pnl_2es_slip_0_5_round_trip: 50,
        pnl_1es_slip_0_5_round_trip: 25,
      },
    ];
    const sim = simulateAccount(rows, { ...ACCOUNT_25K, profit_target: 100, max_trades_per_day: 5 }, '2ES_FULL');
    expect(sim.target_hit).toBe(true);
    expect(sim.target_required_for_viability).toBe(false);
    expect(sim.total_trades).toBe(3);
    expect(sim.continuous_profitable).toBe(true);
  });

  it('labels chop clusters as pass context instead of blind entries', () => {
    const result = classifyRow({
      first_reclaimed_cluster_is_chop: true,
      target_model: 'fixed_plus_2',
      tp1: 102,
      stop_points: 2,
      risk_dollars_2es: 200,
    });
    expect(result.classification).toBe('PASS_CHOP');
  });

  it('models 25K as no DLL and 50K as 1200 DLL', () => {
    const rows = [
      {
        setup_id: 'a',
        date: '2026-04-24',
        entry_timestamp_et: '2026-04-24T10:00:00-04:00',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        pnl_2es_slip_0_5_round_trip: -700,
        pnl_1es_slip_0_5_round_trip: -350,
      },
      {
        setup_id: 'b',
        date: '2026-04-24',
        entry_timestamp_et: '2026-04-24T10:05:00-04:00',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        pnl_2es_slip_0_5_round_trip: -550,
        pnl_1es_slip_0_5_round_trip: -275,
      },
    ];

    const sim25 = simulateAccount(rows, { ...ACCOUNT_25K, max_eod_drawdown: 2000, max_intraday_trailing_drawdown: 2000 }, '2ES_FULL');
    const sim50 = simulateAccount(rows, { ...ACCOUNT_50K, max_eod_drawdown: 2000, max_intraday_trailing_drawdown: 2000 }, '2ES_FULL');

    expect(ACCOUNT_25K.daily_kill_loss_dollars).toBeNull();
    expect(ACCOUNT_50K.daily_kill_loss_dollars).toBe(1200);
    expect(sim25.day_results[0].daily_kill_triggered).toBe(false);
    expect(sim50.day_results[0].daily_kill_triggered).toBe(true);
  });
});
