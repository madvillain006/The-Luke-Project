'use strict';

const {
  DEFAULT_PROP_CONFIG,
  riskDollars,
  maxContractsForRisk,
  classifyVariant,
  annotateDailyPropMetrics,
} = require('../lib/research/prop-fake-breakdown/prop-risk');

describe('prop fake breakdown risk model', () => {
  it('models 2 ES contracts as $100 per point', () => {
    expect(DEFAULT_PROP_CONFIG.dollars_per_point_total).toBe(100);
    expect(riskDollars(3)).toBe(300);
    expect(maxContractsForRisk(3)).toBe(2);
  });

  it('classifies wide stops as WATCH_ONLY/PASS and enforces hard max', () => {
    const base = {
      valid_reclaim: true,
      entry_price: 100,
      stop_price: 96,
      stop_points: 4,
      tp1: 103,
      basis_method: 'native_es',
      inside_chop: false,
    };
    expect(classifyVariant(base).classification).toBe('WATCH_ONLY');
    expect(classifyVariant({ ...base, stop_points: 6, stop_price: 94 }).classification).toBe('PASS');
  });

  it('blocks fixed +30 diagnostic and reference-only as executable strategy truth', () => {
    const base = {
      valid_reclaim: true,
      entry_price: 100,
      stop_price: 97,
      stop_points: 3,
      tp1: 103,
      inside_chop: false,
    };
    expect(classifyVariant({ ...base, basis_method: 'fixed_plus_30_proxy' }).classification).toBe('PASS');
    expect(classifyVariant({ ...base, basis_method: 'reference_only' }).classification).toBe('PASS');
  });

  it('allows strict chop only after reclaim with level limit, sweep stop, and 2-4 point TP1', () => {
    const valid = {
      valid_reclaim: true,
      entry_model: 'level_reclaim_limit',
      entry_price: 100.25,
      stop_model: 'sweep_low_minus_1tick',
      stop_price: 97.25,
      stop_points: 3,
      tp1: 103.25,
      basis_method: 'native_es',
      inside_chop: true,
      chop_rule_variant: 'chop_allowed_after_reclaim',
    };
    expect(classifyVariant(valid).classification).toBe('TRADEABLE');
    expect(classifyVariant({ ...valid, entry_model: 'reclaim_close' }).classification).toBe('WATCH_ONLY');
    expect(classifyVariant({ ...valid, chop_rule_variant: 'chop_blocked' }).classification).toBe('PASS');
  });

  it('simulates daily kill, losses, and drawdown fields', () => {
    const rows = [
      tradeRow('2026-04-09T10:00:00-04:00', true),
      tradeRow('2026-04-09T10:05:00-04:00', true),
      tradeRow('2026-04-09T10:10:00-04:00', true),
    ];
    annotateDailyPropMetrics(rows);
    expect(rows[1].daily_loss_count).toBe(2);
    expect(rows[2].allowed_under_prop_rules).toBe(false);
  });
});

function tradeRow(timestamp, stopFirst) {
  return {
    date: '2026-04-09',
    entry_model: 'level_reclaim_limit',
    stop_model: 'sweep_low_minus_1tick',
    target_model: 'fixed_plus_3',
    chop_rule_variant: 'no_chop',
    basis_method: 'native_es',
    classification: 'TRADEABLE',
    allowed_under_prop_rules: true,
    entry_timestamp_et: timestamp,
    entry_price: 100,
    tp1: 103,
    stop_first: stopFirst,
    same_bar_ambiguity: false,
    risk_dollars: 300,
    r_multiple_60m: -1,
  };
}
