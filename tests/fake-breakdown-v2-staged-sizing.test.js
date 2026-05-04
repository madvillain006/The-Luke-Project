'use strict';

const fs = require('fs');
const path = require('path');
const {
  findAddAfterMove,
  findAddAfterHold,
  riskDollars: stagedRiskDollars,
  stagedPlan,
} = require('../lib/research/fake-breakdown-v2/staged-sizing');
const {
  riskDollars,
  positionSafety,
  classifyHistoricalPlan,
  annotateDailyRisk,
} = require('../lib/research/fake-breakdown-v2/prop-risk');

const ROOT = path.join(__dirname, '..');

describe('fake breakdown v2 staged sizing and prop risk', () => {
  const bars = [
    { timestamp: '2026-04-09T10:00:00-04:00', high: 101, low: 99.5, close: 100.5 },
    { timestamp: '2026-04-09T10:01:00-04:00', high: 101.5, low: 100.25, close: 101 },
    { timestamp: '2026-04-09T10:02:00-04:00', high: 102.25, low: 100.75, close: 102 },
    { timestamp: '2026-04-09T10:03:00-04:00', high: 103, low: 101.5, close: 102.5 },
  ];
  const entry = {
    entry_timestamp_et: '2026-04-09T10:00:00-04:00',
    entry_price: 100,
  };

  it('finds 1ES add triggers after +2 and after hold', () => {
    expect(findAddAfterMove({ bars, entryTimestamp: entry.entry_timestamp_et, entryPrice: 100, points: 2 })).toEqual(expect.objectContaining({
      add_model: 'add_after_plus_2',
      add_price: 102,
    }));
    expect(findAddAfterHold({ bars, entryTimestamp: entry.entry_timestamp_et, level: 100, candles: 2 })).toEqual(expect.objectContaining({
      add_model: 'add_after_2_candle_hold',
    }));
  });

  it('models 1ES and 2ES risk and staged risk reduction', () => {
    expect(riskDollars(3, 2)).toBe(300);
    expect(riskDollars(3, 1)).toBe(150);
    expect(stagedRiskDollars({ entryPrice: 100, stopPrice: 97, contracts: 1 })).toBe(150);
    const plan = stagedPlan({ bars, entry, level: 100, stopPrice: 97, addRule: 'plus_2' });
    expect(plan.position_model).toBe('1ES_STARTER_PLUS_1ES_ADD');
    expect(plan.starter_1es_risk_dollars).toBe(150);
    expect(plan.risk_reduction_vs_full).toBe(150);
  });

  it('classifies position safety across full, staged, 1ES only, watch, and not prop safe cases', () => {
    expect(positionSafety({ stop_points: 3, full_risk_dollars: 300, starter_risk_dollars: 150 })).toBe('2ES_FULL_SAFE');
    expect(positionSafety({ stop_points: 4, full_risk_dollars: 400, staged_risk_dollars: 250, starter_risk_dollars: 200 })).toBe('STAGED_1_TO_2_BETTER');
    expect(positionSafety({ stop_points: 4, full_risk_dollars: 400, starter_risk_dollars: 200 })).toBe('1ES_ONLY_BETTER');
    expect(positionSafety({ stop_points: 4, full_risk_dollars: 400, starter_risk_dollars: 350 })).toBe('WATCH_ONLY');
    expect(positionSafety({ stop_points: 6, full_risk_dollars: 600, starter_risk_dollars: 300 })).toBe('NOT_PROP_SAFE');
  });

  it('simulates daily kill, max losses, and account fail flags', () => {
    const rows = [0, 1, 2].map(i => ({
      classification: 'TRADEABLE_REACTION_SCALP',
      archetype: 'REACTION_SCALP',
      date: '2026-04-09',
      entry_model: 'reclaim_close',
      stop_model: 'max_prop_stop_capped',
      target_model: 'fixed_plus_2',
      position_model: '2ES_FULL_ENTRY',
      entry_timestamp_et: `2026-04-09T10:0${i}:00-04:00`,
      same_bar_ambiguity: false,
      stop_first: true,
      active_risk_dollars: 300,
      full_risk_dollars: 300,
    }));
    annotateDailyRisk(rows);
    expect(rows[0].allowed_after_daily_rules).toBe(true);
    expect(rows[1].allowed_after_daily_rules).toBe(true);
    expect(rows[2].allowed_after_daily_rules).toBe(false);
    expect(rows[2].max_losses_reached).toBe(true);
  });

  it('keeps V2 research modules away from live execution and buildTradeDecision', () => {
    const files = [
      'lib/research/fake-breakdown-v2/evaluator.js',
      'lib/research/fake-breakdown-v2/setup-detector.js',
      'scripts/run-fake-breakdown-v2-research.js',
    ].map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
    expect(files).not.toContain('execution-live');
    expect(files).not.toContain('broker-tradovate');
    expect(files).not.toContain('buildTradeDecision');
    expect(files).not.toContain('recordLevel(');

    const classified = classifyHistoricalPlan({
      archetype: 'REACTION_SCALP',
      valid_reclaim: true,
      entry_price: 100,
      stop_price: 97,
      stop_points: 3,
      full_risk_dollars: 300,
      starter_risk_dollars: 150,
      tp1: 102,
      target_distance: 2,
      tp1_hit: true,
      stop_first: false,
      max_heat_before_tp1: 1,
      time_to_tp1: 3,
    });
    expect(classified.classification).toBe('TRADEABLE_REACTION_SCALP');
  });
});
