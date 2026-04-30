'use strict';

const {
  STRATEGY_IDS,
  EXECUTION_POLICIES,
  RESOLUTION_MODES,
  OUTCOMES,
  APEX_TRAILING_DRAWDOWN,
  buildStrategyParams,
  resolveTrade,
  filterCandidatesByPolicy,
  policyForStrategy,
  simulateAllCandidates,
  computeMetrics,
  PORTFOLIO_CONFIGS,
  simulatePortfolio,
  simulateCombinedPortfolios,
} = require('../lib/backtest-data/atm-simulator');

function bar(timestamp, open, high, low, close) {
  return { timestamp, open, high, low, close, volume: 1000 };
}

function atmCandidate(overrides = {}) {
  return {
    id: '2026-04-23-support_hold-1',
    date: '2026-04-23',
    time: '2026-04-23T09:31:00-04:00',
    triggerType: 'support_hold',
    entry: 7150,
    preferredStop: {
      accepted: true,
      stop: 7147,
      riskPts: 3,
    },
    targets: [{ price: 7180 }],
    atmMachine: true,
    scalpVariants: [
      {
        id: 'atm_2_contract_2pt_scalp',
        contracts: 2,
        entry: 7150,
        stop: 7147,
        target: 7152,
        riskPts: 3,
        rewardPts: 2,
        riskRewardOk: false,
      },
      {
        id: 'atm_2_contract_3pt_scalp',
        contracts: 2,
        entry: 7150,
        stop: 7147,
        target: 7153,
        riskPts: 3,
        rewardPts: 3,
        riskRewardOk: true,
      },
    ],
    ...overrides,
  };
}

describe('atm-simulator', () => {
  it('uses the Apex 50k $2,000 EOD trailing drawdown constant', () => {
    expect(APEX_TRAILING_DRAWDOWN).toBe(2000);
  });

  it('skips ATM 2-point scalp when structural risk is larger than reward', () => {
    const params = buildStrategyParams(atmCandidate(), STRATEGY_IDS.ATM_2PT);
    expect(params).toBeNull();
  });

  it('allows ATM 3-point scalp when reward covers structural risk', () => {
    const params = buildStrategyParams(atmCandidate(), STRATEGY_IDS.ATM_3PT);
    expect(params).toMatchObject({
      entry: 7150,
      stop: 7147,
      target: 7153,
      contracts: 2,
      riskPts: 3,
      rewardPts: 3,
    });
  });

  it('resolves same-bar stop/target conflict pessimistically in stop-first mode', () => {
    const result = resolveTrade(
      { stop: 7147, target: 7153, entryTime: '2026-04-23T09:31:00-04:00' },
      [bar('2026-04-23T09:31:00-04:00', 7150, 7154, 7146.75, 7151)],
      RESOLUTION_MODES.STOP_FIRST
    );
    expect(result.outcome).toBe(OUTCOMES.LOSS);
    expect(result.exitPrice).toBe(7147);
    expect(result.conflictingBar).toBe(true);
  });

  it('resolves same-bar stop/target conflict optimistically in target-first mode', () => {
    const result = resolveTrade(
      { stop: 7147, target: 7153, entryTime: '2026-04-23T09:31:00-04:00' },
      [bar('2026-04-23T09:31:00-04:00', 7150, 7154, 7146.75, 7151)],
      RESOLUTION_MODES.TARGET_FIRST
    );
    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.exitPrice).toBe(7153);
    expect(result.conflictingBar).toBe(true);
  });

  it('flags Apex breach only when EOD equity falls below trailing high minus 2000', () => {
    const trades = [
      { date: '2026-04-23', outcome: OUTCOMES.LOSS, pnl: -1999, rMultiple: -1 },
      { date: '2026-04-24', outcome: OUTCOMES.LOSS, pnl: -2, rMultiple: -1 },
    ];
    const metrics = computeMetrics(trades);
    expect(metrics.apexBreached).toBe(true);
    expect(metrics.apexBreachDays).toHaveLength(1);
    expect(metrics.apexBreachDays[0]).toMatchObject({
      date: '2026-04-24',
      apexFloor: 48000,
      deficit: 1,
    });
  });

  it('filters to the first candidate per date and cluster when policy requires it', () => {
    const candidates = [
      atmCandidate({ id: 'a', time: '2026-04-23T09:33:00-04:00', cluster: { anchor: 7147 } }),
      atmCandidate({ id: 'b', time: '2026-04-23T09:31:00-04:00', cluster: { anchor: 7147 } }),
      atmCandidate({ id: 'c', time: '2026-04-23T09:32:00-04:00', cluster: { anchor: 7155 } }),
    ];

    const filtered = filterCandidatesByPolicy(candidates, EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY);
    expect(filtered.map(c => c.id)).toEqual(['b', 'c']);
  });

  it('filters to ATM tap 3+ candidates when policy requires it', () => {
    const candidates = [
      atmCandidate({ id: 'a', atmMachine: false }),
      atmCandidate({ id: 'b', atmMachine: true }),
    ];

    const filtered = filterCandidatesByPolicy(candidates, EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY);
    expect(filtered.map(c => c.id)).toEqual(['b']);
  });

  it('reports eligibleCandidateCount after applying execution policy', () => {
    const candidates = [
      atmCandidate({ id: 'a', atmMachine: false }),
      atmCandidate({ id: 'b', atmMachine: true }),
    ];
    const result = simulateAllCandidates(candidates, {}, {
      strategies: [STRATEGY_IDS.ATM_3PT],
      modes: [RESOLUTION_MODES.STOP_FIRST],
      executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY,
    });

    expect(result.candidateCount).toBe(2);
    expect(result.eligibleCandidateCount).toBe(1);
    expect(result.executionPolicy).toBe(EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY);
  });

  it('maps blended policy to first-touch 3c and tap3+ ATM strategy filters', () => {
    expect(policyForStrategy(
      EXECUTION_POLICIES.BLENDED_3C_FIRST_ATM_TAP3,
      STRATEGY_IDS.STANDARD_3C
    )).toBe(EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY);
    expect(policyForStrategy(
      EXECUTION_POLICIES.BLENDED_3C_FIRST_ATM_TAP3,
      STRATEGY_IDS.ATM_3PT
    )).toBe(EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY);
  });
});

describe('combined portfolio simulator', () => {
  it('PORTFOLIO_CONFIGS standard_3c_plus_atm_3pt uses first_per_cluster_day for 3c and atm_tap3_plus_only for ATM', () => {
    const lanes = PORTFOLIO_CONFIGS.standard_3c_plus_atm_3pt;
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toMatchObject({
      strategyId:      STRATEGY_IDS.STANDARD_3C,
      executionPolicy: EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY,
    });
    expect(lanes[1]).toMatchObject({
      strategyId:      STRATEGY_IDS.ATM_3PT,
      executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY,
    });
  });

  it('combined portfolio sums daily P&L from standard_3c and atm_3pt lanes correctly', () => {
    // standard_3c WIN: 3c * 30 pts = $4,500
    // atm_3pt WIN:     2c *  3 pts = $300
    // combined day P&L: $4,800
    const std = {
      id: 'std-candidate', date: '2026-04-23', time: '2026-04-23T09:30:00-04:00',
      cluster: { anchor: 7150 }, triggerType: 'support_hold', entry: 7150,
      preferredStop: { accepted: true, stop: 7147, riskPts: 3 },
      targets: [{ price: 7180 }], atmMachine: false, scalpVariants: [],
    };
    const atm = {
      id: 'atm-candidate', date: '2026-04-23', time: '2026-04-23T09:30:00-04:00',
      cluster: { anchor: 7150 }, triggerType: 'support_hold', entry: 7150,
      preferredStop: { accepted: true, stop: 7147, riskPts: 3 },
      targets: [{ price: 7180 }], atmMachine: true,
      scalpVariants: [
        { id: 'atm_2_contract_3pt_scalp', contracts: 2, entry: 7150, stop: 7147,
          target: 7153, riskPts: 3, rewardPts: 3, riskRewardOk: true },
      ],
    };
    // Bar: stop=7147 not hit (low=7148), target=7180 and 7153 both hit (high=7190)
    const testBars = {
      '2026-04-23': [bar('2026-04-23T09:30:00-04:00', 7150, 7190, 7148, 7185)],
    };

    const result = simulateCombinedPortfolios([std, atm], testBars, {
      portfolios: ['standard_3c_plus_atm_3pt'],
      modes:      [RESOLUTION_MODES.TARGET_FIRST],
    });

    const run = result.runs['standard_3c_plus_atm_3pt__target_first'];
    expect(run).toBeDefined();
    expect(run.metrics.equityCurve).toHaveLength(1);
    expect(run.metrics.equityCurve[0].dayPnl).toBe(4800);
    expect(run.metrics.totalPnl).toBe(4800);
  });

  it('deduplicates candidateId+strategyId across lanes - same trade cannot appear twice', () => {
    const candidate = atmCandidate({ id: 'dup-test', atmMachine: true });
    // Two identical lanes - same candidate+strategy should only produce one trade
    const result = simulatePortfolio(
      [candidate],
      {},
      [
        { strategyId: STRATEGY_IDS.ATM_3PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
        { strategyId: STRATEGY_IDS.ATM_3PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
      ],
      RESOLUTION_MODES.STOP_FIRST
    );
    const tradeKeys = result.trades.map(t => `${t.candidateId}__${t.strategyId}`);
    expect(new Set(tradeKeys).size).toBe(tradeKeys.length);
    expect(result.trades).toHaveLength(1);
  });

  it('Apex breach threshold in combined portfolio uses $2,000', () => {
    // Day 1: combined loss of $2,225 -> breach (floor = $50,000 - $2,000 = $48,000, equity = $47,775)
    const trades = [
      { date: '2026-04-07', outcome: OUTCOMES.LOSS, pnl: -450,   rMultiple: -1 },
      { date: '2026-04-07', outcome: OUTCOMES.LOSS, pnl: -1775,  rMultiple: -1 },
    ];
    const metrics = computeMetrics(trades);
    expect(metrics.apexBreached).toBe(true);
    expect(metrics.apexBreachDays[0]).toMatchObject({
      date:      '2026-04-07',
      apexFloor: 48000,
    });
  });
});
