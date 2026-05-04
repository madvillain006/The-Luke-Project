'use strict';

const {
  STATES,
  buildStateTimeline,
  transitionOrderValid,
} = require('../lib/research/fake-breakdown-state-machine/states');
const {
  NAMED_RULES,
  planClassification,
} = require('../lib/research/fake-breakdown-state-machine/rules');

function fixture() {
  const setup = {
    id: 'setup-1',
    source_combo: 'saty+bobby',
    source_freshness: { available_at_et: '2026-04-09T09:25:00-04:00' },
    timestamp_et: '2026-04-09T10:00:00-04:00',
    breakdown_timestamp_et: '2026-04-09T10:00:00-04:00',
    reclaim_timestamp: '2026-04-09T10:03:00-04:00',
    executable_level: 100,
    next_trusted_level_above: 104,
    breakdown_depth_actual: 2,
    minutes_below_level: 3,
  };
  const bars = [
    { timestamp: '2026-04-09T09:58:00-04:00', high: 104, low: 100.5, close: 102 },
    { timestamp: '2026-04-09T10:00:00-04:00', high: 100.5, low: 98, close: 98.5 },
    { timestamp: '2026-04-09T10:03:00-04:00', high: 101, low: 99.25, close: 100.75 },
    { timestamp: '2026-04-09T10:04:00-04:00', high: 101.5, low: 100.25, close: 101 },
  ];
  const observation = {
    setup_id: 'setup-1',
    entry_timestamp_et: '2026-04-09T10:04:00-04:00',
    entry_model: '2_candle_hold',
    entry_model_group: 'two_candle_hold_above_level',
    stop_points: 3,
    stop_price: 98,
    entry_price: 101,
    tp1: 103,
    tp3: 104,
    valid_reclaim: true,
    basis_method: 'native_es',
    next_trusted_target_distance: 3,
    next_trusted_target_at_least_4: false,
    no_lookahead_violation: false,
    chop_status: 'outside_chop',
  };
  return { setup, bars, observation };
}

describe('fake breakdown state machine', () => {
  it('orders WATCH before BREAKDOWN before RECLAIM before ARMED/TRADEABLE', () => {
    const { setup, bars, observation } = fixture();
    const tradePlan = planClassification(observation);
    const timeline = buildStateTimeline({
      setup,
      observation,
      bars,
      rule: NAMED_RULES[2],
      tradePlan,
    });
    expect(timeline.events.map(event => event.state)).toEqual([
      STATES.LEVEL_WATCH,
      STATES.ZONE_WATCH,
      STATES.BREAKDOWN_DETECTED,
      STATES.RECLAIM_WATCH,
      STATES.ARMED,
      STATES.TRADEABLE,
    ]);
    expect(transitionOrderValid(timeline.events)).toBe(true);
    expect(timeline.watch_to_tradeable_minutes).toBeGreaterThan(0);
  });

  it('invalidates when price closes back below reclaimed level before arming', () => {
    const { setup, bars, observation } = fixture();
    const badBars = bars.concat({ timestamp: '2026-04-09T10:03:30-04:00', high: 100.25, low: 99, close: 99.5 });
    const tradePlan = planClassification(observation);
    const timeline = buildStateTimeline({
      setup,
      observation: { ...observation, entry_timestamp_et: '2026-04-09T10:05:00-04:00' },
      bars: badBars,
      rule: NAMED_RULES[2],
      tradePlan,
    });
    expect(timeline.events.at(-1)).toEqual(expect.objectContaining({
      state: STATES.INVALIDATED,
      reason: 'close_back_below_reclaimed_level_before_armed',
    }));
  });

  it('uses only pre-entry fields for named rules and not future TP/stop outcomes', () => {
    const forbidden = ['tp1_hit', 'tp2_hit', 'stop_first', 'max_heat_before_tp1', 'mfe_5m', 'mae_5m', 'classification'];
    for (const rule of NAMED_RULES) {
      for (const key of forbidden) expect(rule.uses).not.toContain(key);
    }
    const base = {
      valid_reclaim: true,
      no_lookahead_violation: false,
      basis_method: 'native_es',
      entry_price: 101,
      stop_points: 3,
      next_trusted_target_distance: 4,
      chop_status: 'outside_chop',
    };
    expect(planClassification({ ...base, outcome: { tp2_hit: true } })).toEqual(planClassification({ ...base, outcome: { tp2_hit: false, stop_first: true } }));
  });

  it('does not import live execution or buildTradeDecision modules', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', 'lib', 'research', 'fake-breakdown-state-machine');
    const text = fs.readdirSync(dir).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
    expect(text).not.toMatch(/require\(.*buildTradeDecision/);
    expect(text).not.toMatch(/from .*buildTradeDecision/);
    expect(text).not.toMatch(/executeOrder|broker-tradovate|execution-live/i);
  });
});
