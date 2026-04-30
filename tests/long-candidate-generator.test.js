'use strict';

const {
  generateLongCandidates,
  clusterLevels,
  buildStopPolicies,
  selectTargets,
  annotateAtmMachineCandidates,
} = require('../lib/backtest-data/long-candidate-generator');

function bar(timestamp, open, high, low, close) {
  return { timestamp, open, high, low, close, volume: 1000 };
}

function baseSession(overrides = {}) {
  return {
    date: '2026-04-23',
    usable: true,
    levels: [
      { price: 7147, source: 'mancini', role: 'support' },
      { price: 7148, source: 'bobby_text', role: 'king_node' },
      { price: 7147.25, source: 'saty', label: 'put_trigger' },
      { price: 7180, source: 'mancini', role: 'target' },
      { price: 7186, source: 'saty', label: 'call_trigger' },
      { price: 7193, source: 'mancini', role: 'target' },
    ],
    bars: {
      rth: [
        bar('2026-04-23T09:30:00-04:00', 7160, 7162, 7155, 7157),
        bar('2026-04-23T09:31:00-04:00', 7157, 7158, 7144.75, 7146.75),
        bar('2026-04-23T09:32:00-04:00', 7146.75, 7152, 7146.25, 7151.5),
        bar('2026-04-23T09:33:00-04:00', 7151.5, 7181, 7150, 7180),
      ],
    },
    ...overrides,
  };
}

describe('long-candidate-generator', () => {
  it('clusters nearby Saty/Bobby/Mancini levels into one confluence zone', () => {
    const clusters = clusterLevels(baseSession().levels, 3);
    const first = clusters[0];
    expect(first.sources).toEqual(['bobby', 'mancini', 'saty']);
    expect(first.sourceCount).toBe(3);
    expect(first.anchor).toBeGreaterThan(7146);
    expect(first.anchor).toBeLessThan(7148.5);
  });

  it('builds structural stop policies and rejects risk over cap', () => {
    const policies = buildStopPolicies({
      entry: 7151.5,
      invalidationLow: 7144.75,
      config: {
        tickSize: 0.25,
        pointValue: 50,
        contracts: 3,
        maxThreeContractRiskPts: 3,
      },
    });

    expect(policies.every(p => p.riskDollars > 0)).toBe(true);
    expect(policies.every(p => p.accepted === false)).toBe(true);
    expect(policies[0].rejectionReason).toBe('risk_over_cap');
  });

  it('selects next three targets above entry', () => {
    const targets = selectTargets(baseSession().levels, 7151.5, {
      tickSize: 0.25,
      minTargetDistancePts: 1,
    });
    expect(targets.map(t => t.price)).toEqual([7180, 7186, 7193]);
  });

  it('generates a trap-reclaim candidate when risk cap allows the structure', () => {
    const candidates = generateLongCandidates(baseSession(), {
      levelTolerancePts: 3,
      maxThreeContractRiskPts: 8,
      minSources: 2,
    });

    expect(candidates.length).toBeGreaterThan(0);
    const c = candidates.find(candidate => candidate.triggerType === 'trap_reclaim');
    expect(c).toBeTruthy();
    expect(c.confluenceSources).toEqual(['bobby', 'mancini', 'saty']);
    expect(c.targets.map(t => t.price)).toEqual([7180, 7186, 7193]);
    expect(c.preferredStop.riskPts).toBeLessThanOrEqual(8);
  });

  it('rejects the same trap-reclaim when 3-contract risk is too large', () => {
    const candidates = generateLongCandidates(baseSession(), {
      levelTolerancePts: 3,
      maxThreeContractRiskPts: 3,
      minSources: 2,
    });

    expect(candidates).toHaveLength(0);
  });

  it('generates a tighter support-hold candidate when structure risk is acceptable', () => {
    const session = baseSession({
      bars: {
        rth: [
          bar('2026-04-23T09:31:00-04:00', 7150, 7152, 7147, 7149),
          bar('2026-04-23T09:32:00-04:00', 7149, 7154, 7148, 7153),
        ],
      },
    });
    const candidates = generateLongCandidates(session, {
      levelTolerancePts: 3,
      maxThreeContractRiskPts: 3,
      minSources: 2,
    });

    expect(candidates.some(candidate => candidate.triggerType === 'support_hold')).toBe(true);
    expect(candidates[0].preferredStop.riskDollars).toBeLessThanOrEqual(450);
  });

  it('marks repeated level taps as an ATM-machine scalp variant', () => {
    const session = baseSession({
      bars: {
        rth: [
          bar('2026-04-23T09:31:00-04:00', 7150, 7152, 7147, 7149),
          bar('2026-04-23T09:32:00-04:00', 7149, 7153, 7147.25, 7150),
          bar('2026-04-23T09:33:00-04:00', 7150, 7154, 7147.5, 7151),
          bar('2026-04-23T09:34:00-04:00', 7151, 7155, 7148, 7152),
        ],
      },
    });

    const candidates = generateLongCandidates(session, {
      levelTolerancePts: 3,
      maxThreeContractRiskPts: 6,
      minSources: 2,
      atmTapThreshold: 3,
    });

    const atm = candidates.filter(candidate => candidate.atmMachine);
    expect(atm.length).toBeGreaterThanOrEqual(2);
    expect(atm[0].atmTapCount).toBe(3);
    expect(atm[0].atmTapIndex).toBe(3);
    expect(atm[0].scalpVariants.map(v => v.id)).toEqual([
      'atm_2_contract_2pt_scalp',
      'atm_2_contract_3pt_scalp',
    ]);
    expect(atm[0].scalpVariants[0].contracts).toBe(2);
    expect(atm[0].scalpVariants[0].rewardPts).toBe(2);
    expect(atm[0].scalpVariants[1].rewardPts).toBe(3);
    expect(atm[0].scalpVariants[0].riskDollars).toBe(
      atm[0].preferredStop.riskPts * 50 * 2
    );
    expect(atm[0].scalpVariants[0].riskRewardOk).toBe(false);
    expect(atm[0].scalpVariants[0].rejectionReason).toBe('scalp_reward_less_than_structural_risk');
    expect(atm[0].scalpVariants[1].riskRewardOk).toBe(false);
  });

  it('does not mark ATM-machine when taps are below threshold', () => {
    const candidates = [
      {
        date: '2026-04-23',
        time: '2026-04-23T09:31:00-04:00',
        entry: 7150,
        cluster: { anchor: 7147 },
        preferredStop: { stop: 7146, riskPts: 4 },
      },
      {
        date: '2026-04-23',
        time: '2026-04-23T09:32:00-04:00',
        entry: 7150.5,
        cluster: { anchor: 7147 },
        preferredStop: { stop: 7146.5, riskPts: 4 },
      },
    ];

    const out = annotateAtmMachineCandidates(candidates, {
      tickSize: 0.25,
      pointValue: 50,
      atmTapThreshold: 3,
    });

    expect(out.every(candidate => candidate.atmMachine !== true)).toBe(true);
  });
});
