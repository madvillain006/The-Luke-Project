'use strict';

const { assessPropRisk, starterSizeRecommendation } = require('../lib/trading-state/prop-risk-gate');

describe('prop risk gate', () => {
  it('allows 1ES starter risk inside 25K preferred risk', () => {
    const gate = assessPropRisk({ entry: 7223.25, stop: 7219.75, contracts: 1 });

    expect(gate.ok).toBe(true);
    expect(gate.contracts).toBe(1);
    expect(gate.dollars_per_point).toBe(50);
    expect(gate.risk_dollars).toBe(175);
    expect(gate.account_gate).toBe('PASS');
    expect(starterSizeRecommendation({ riskGate: gate }).contracts).toBe(1);
  });

  it('blocks stop risk above hard cap', () => {
    const gate = assessPropRisk({ entry: 7223.25, stop: 7210.75, contracts: 1 });

    expect(gate.ok).toBe(false);
    expect(gate.status).toBe('PASS_RISK');
    expect(gate.risk_dollars).toBeGreaterThan(500);
  });

  it('blocks 2ES without explicit retest-hold add confirmation', () => {
    const gate = assessPropRisk({ entry: 7223.25, stop: 7220.75, contracts: 2 });

    expect(gate.ok).toBe(false);
    expect(gate.warnings).toContain('add_second_es_requires_retest_hold_confirmation');
    expect(gate.add_second_requires_confirmation).toBe(true);
  });

  it('enforces no-repeat-after-loss at same level', () => {
    const gate = assessPropRisk({ entry: 7223.25, stop: 7220.75, contracts: 1, priorLossSameLevel: true });

    expect(gate.ok).toBe(false);
    expect(gate.warnings).toContain('no_repeat_after_loss');
  });
});
