'use strict';

// ATM Machine Backtest Simulator - Engine (Pass 1)
//
// Pure functions only. No I/O. No side effects. All data flows in, structured
// results flow out. Wire up via scripts/run-atm-backtest.js (Pass 2).
//
// Apex 50k EOD Trail model:
//   Starting balance : $50,000
//   Trailing drawdown: $2,000 (trails EOD equity high-water mark upward only)
//   Breach condition : equity drops below (trailingHigh - $2,000) at EOD
//
// Standard 3c simplification: all 3 contracts exit at targets[0] (nearest
// mancini/saty level). No scale-out modeled. This gives the most conservative
// comparison baseline against the 2-contract scalp variants.

const POINT_VALUE = 50; // ES: $50 per point per contract

const STRATEGY_IDS = Object.freeze({
  STANDARD_3C: 'standard_3c',
  ATM_2PT:     'atm_2pt_scalp',
  ATM_3PT:     'atm_3pt_scalp',
});

const RESOLUTION_MODES = Object.freeze({
  STOP_FIRST:   'stop_first',
  TARGET_FIRST: 'target_first',
});

const EXECUTION_POLICIES = Object.freeze({
  EVERY_SIGNAL:          'every_signal',
  FIRST_PER_CLUSTER_DAY: 'first_per_cluster_day',
  ATM_TAP3_PLUS_ONLY:    'atm_tap3_plus_only',
  BLENDED_3C_FIRST_ATM_TAP3: 'blended_3c_first_atm_tap3',
});

const OUTCOMES = Object.freeze({
  WIN:      'win',
  LOSS:     'loss',
  TIMEOUT:  'timeout',  // session ended; exited at last bar close
  NO_SETUP: 'no_setup', // strategy not applicable to this candidate
});

const APEX_START_BALANCE       = 50_000;
const APEX_TRAILING_DRAWDOWN   = 2_000;

// ─── Strategy param extraction ────────────────────────────────────────────────
//
// Returns { entry, stop, target, contracts, riskPts, rewardPts } or null.
// Null means this candidate is ineligible for this strategy - logged as NO_SETUP.

function buildStrategyParams(candidate, strategyId) {
  if (strategyId === STRATEGY_IDS.STANDARD_3C) {
    const ps = candidate.preferredStop;
    if (!ps || !ps.accepted || !Number.isFinite(ps.stop) || !Number.isFinite(ps.riskPts)) {
      return null;
    }
    const firstTarget = (candidate.targets || [])[0];
    if (!firstTarget || !Number.isFinite(firstTarget.price)) return null;

    const rewardPts = firstTarget.price - candidate.entry;
    if (rewardPts <= 0) return null;

    return {
      entry:    candidate.entry,
      stop:     ps.stop,
      target:   firstTarget.price,
      contracts: 3,
      riskPts:  ps.riskPts,
      rewardPts,
    };
  }

  // ATM variants require tap 3+ eligibility
  if (!candidate.atmMachine) return null;

  const variantId =
    strategyId === STRATEGY_IDS.ATM_2PT
      ? 'atm_2_contract_2pt_scalp'
      : 'atm_2_contract_3pt_scalp';

  const variant = (candidate.scalpVariants || []).find(v => v.id === variantId);
  if (!variant || !variant.riskRewardOk) return null;
  if (!Number.isFinite(variant.entry) || !Number.isFinite(variant.stop) || !Number.isFinite(variant.target)) {
    return null;
  }

  return {
    entry:    variant.entry,
    stop:     variant.stop,
    target:   variant.target,
    contracts: variant.contracts,
    riskPts:  variant.riskPts,
    rewardPts: variant.rewardPts,
  };
}

// ─── Bar resolution ───────────────────────────────────────────────────────────

function barMs(bar) {
  return new Date(bar.timestamp).getTime();
}

// First bar index at or after entryMs. Returns -1 if none found.
function findEntryBarIndex(bars, entryMs) {
  for (let i = 0; i < bars.length; i++) {
    if (barMs(bars[i]) >= entryMs) return i;
  }
  return -1;
}

// Walk bars from entry bar onward. Check stop/target each bar.
//
// stop_first  (pessimistic): conflicting bar -> stop wins -> LOSS
// target_first (optimistic): conflicting bar -> target wins -> WIN
//
// Returns { outcome, exitPrice, barsHeld, exitTimestamp }.
function resolveTrade({ stop, target, entryTime }, bars, mode) {
  const entryMs = new Date(entryTime).getTime();
  const startIdx = findEntryBarIndex(bars, entryMs);

  if (startIdx === -1) {
    return { outcome: OUTCOMES.TIMEOUT, exitPrice: null, barsHeld: 0, exitTimestamp: null };
  }

  for (let i = startIdx; i < bars.length; i++) {
    const bar = bars[i];
    const stopHit   = bar.low  <= stop;
    const targetHit = bar.high >= target;

    if (stopHit && targetHit) {
      const isWin     = mode === RESOLUTION_MODES.TARGET_FIRST;
      const exitPrice = isWin ? target : stop;
      return {
        outcome:        isWin ? OUTCOMES.WIN : OUTCOMES.LOSS,
        exitPrice,
        barsHeld:       i - startIdx + 1,
        exitTimestamp:  bar.timestamp,
        conflictingBar: true,
      };
    }

    if (stopHit) {
      return { outcome: OUTCOMES.LOSS, exitPrice: stop, barsHeld: i - startIdx + 1, exitTimestamp: bar.timestamp };
    }

    if (targetHit) {
      return { outcome: OUTCOMES.WIN, exitPrice: target, barsHeld: i - startIdx + 1, exitTimestamp: bar.timestamp };
    }
  }

  // Session exhausted - exit at last bar close
  const last = bars[bars.length - 1];
  return {
    outcome:       OUTCOMES.TIMEOUT,
    exitPrice:     last ? last.close : null,
    barsHeld:      last ? bars.length - startIdx : 0,
    exitTimestamp: last ? last.timestamp : null,
  };
}

// ─── P&L and R-multiple ───────────────────────────────────────────────────────

// P&L formula: (exitPrice - entryPrice) * contracts * $50
// Works for wins (positive) and losses (negative).
// Timeout P&L uses last-bar close as exit - real open exposure.
function calcPnl(outcome, exitPrice, entry, contracts) {
  if (outcome === OUTCOMES.NO_SETUP || exitPrice === null) return 0;
  return roundDollar((exitPrice - entry) * contracts * POINT_VALUE);
}

// R-multiple: win -> reward/risk, loss -> -1.0, timeout/no_setup -> null
function calcR(outcome, rewardPts, riskPts) {
  if (outcome === OUTCOMES.WIN)  return roundR(rewardPts / riskPts);
  if (outcome === OUTCOMES.LOSS) return -1.0;
  return null;
}

function roundDollar(n) {
  return Math.round(n * 100) / 100;
}

function roundR(n) {
  return Math.round(n * 10000) / 10000;
}

// ─── Per-candidate simulation ─────────────────────────────────────────────────

function simulateTrade(candidate, bars, strategyId, mode) {
  const base = {
    candidateId:  candidate.id,
    date:         candidate.date,
    time:         candidate.time,
    cluster:      candidate.cluster ? candidate.cluster.anchor : null,
    triggerType:  candidate.triggerType,
    atmTapIndex:  candidate.atmTapIndex,
    strategyId,
    mode,
  };

  const params = buildStrategyParams(candidate, strategyId);
  if (!params) {
    return { ...base, outcome: OUTCOMES.NO_SETUP, pnl: 0, rMultiple: null,
      entry: null, stop: null, target: null, contracts: null,
      riskPts: null, rewardPts: null, exitPrice: null, exitTimestamp: null,
      barsHeld: 0, conflictingBar: false };
  }

  const res = resolveTrade(
    { stop: params.stop, target: params.target, entryTime: candidate.time },
    bars,
    mode
  );

  const pnl      = calcPnl(res.outcome, res.exitPrice, params.entry, params.contracts);
  const rMultiple = calcR(res.outcome, params.rewardPts, params.riskPts);

  return {
    ...base,
    outcome:        res.outcome,
    entry:          params.entry,
    stop:           params.stop,
    target:         params.target,
    contracts:      params.contracts,
    riskPts:        params.riskPts,
    rewardPts:      params.rewardPts,
    exitPrice:      res.exitPrice,
    exitTimestamp:  res.exitTimestamp,
    barsHeld:       res.barsHeld,
    conflictingBar: res.conflictingBar || false,
    pnl,
    rMultiple,
  };
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
//
// Processes trades in date order. Computes:
//   - Win rate (settled trades only)
//   - Avg R-multiple (settled trades only)
//   - Max drawdown $ (EOD equity curve, peak-to-trough)
//   - Apex EOD trail breach detection ($2,000 trailing limit)
//
// NOTE: Multiple candidates fire per day from the same cluster.
//       The simulator treats each independently (every signal taken).
//       Daily P&L is the SUM of all same-day trade results, which will
//       surface the worst-case exposure naturally.

function filterCandidatesByPolicy(candidates, policy = EXECUTION_POLICIES.EVERY_SIGNAL) {
  const sorted = [...(candidates || [])].sort((a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''));
    return d !== 0 ? d : String(a.time || '').localeCompare(String(b.time || ''));
  });

  if (policy === EXECUTION_POLICIES.EVERY_SIGNAL) return sorted;
  if (policy === EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY) {
    return sorted.filter(candidate => candidate.atmMachine === true);
  }
  if (policy === EXECUTION_POLICIES.BLENDED_3C_FIRST_ATM_TAP3) return sorted;
  if (policy === EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY) {
    const seen = new Set();
    return sorted.filter(candidate => {
      const cluster = candidate.cluster ? candidate.cluster.anchor : 'unknown';
      const key = `${candidate.date}|${cluster}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  throw new Error(`Unknown execution policy: ${policy}`);
}

function policyForStrategy(globalPolicy, strategyId) {
  if (globalPolicy !== EXECUTION_POLICIES.BLENDED_3C_FIRST_ATM_TAP3) return globalPolicy;
  if (strategyId === STRATEGY_IDS.STANDARD_3C) return EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY;
  return EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY;
}

function computeMetrics(trades) {
  const settled  = trades.filter(t => t.outcome === OUTCOMES.WIN || t.outcome === OUTCOMES.LOSS);
  const wins     = settled.filter(t => t.outcome === OUTCOMES.WIN);
  const losses   = settled.filter(t => t.outcome === OUTCOMES.LOSS);
  const timeouts = trades.filter(t => t.outcome === OUTCOMES.TIMEOUT);
  const noSetup  = trades.filter(t => t.outcome === OUTCOMES.NO_SETUP);

  const winRate = settled.length > 0 ? wins.length / settled.length : 0;

  const rValues = settled.map(t => t.rMultiple).filter(r => r !== null);
  const avgR    = rValues.length > 0
    ? rValues.reduce((a, b) => a + b, 0) / rValues.length
    : 0;

  // Build EOD equity curve - aggregate daily P&L then walk chronologically.
  const dailyMap = {};
  for (const t of trades) {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + t.pnl;
  }
  const sortedDates = Object.keys(dailyMap).sort();

  let equity       = APEX_START_BALANCE;
  let peakEquity   = APEX_START_BALANCE;
  let trailingHigh = APEX_START_BALANCE;
  let maxDrawdown  = 0;

  const equityCurve    = [];
  const apexBreachDays = [];

  for (const date of sortedDates) {
    const dayPnl = dailyMap[date];
    equity += dayPnl;

    // Peak-to-trough drawdown (standard backtest metric)
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Apex EOD trail: floor = trailingHigh - $2,000
    const apexFloor = trailingHigh - APEX_TRAILING_DRAWDOWN;
    if (equity < apexFloor) {
      apexBreachDays.push({
        date,
        equity:   roundDollar(equity),
        apexFloor: roundDollar(apexFloor),
        deficit:  roundDollar(apexFloor - equity),
        dayPnl:   roundDollar(dayPnl),
      });
    }

    // Trail the high-water mark upward only (EOD, not intraday)
    if (equity > trailingHigh) trailingHigh = equity;

    equityCurve.push({
      date,
      dayPnl:        roundDollar(dayPnl),
      equity:        roundDollar(equity),
      trailingHigh:  roundDollar(trailingHigh),
      apexFloor:     roundDollar(trailingHigh - APEX_TRAILING_DRAWDOWN),
      drawdown:      roundDollar(peakEquity - equity),
    });
  }

  return {
    totalTrades:   trades.length,
    settledTrades: settled.length,
    wins:          wins.length,
    losses:        losses.length,
    timeouts:      timeouts.length,
    noSetup:       noSetup.length,
    winRate:       parseFloat((winRate * 100).toFixed(2)),
    avgR:          parseFloat(avgR.toFixed(4)),
    totalPnl:      roundDollar(trades.reduce((s, t) => s + t.pnl, 0)),
    maxDrawdown:   roundDollar(maxDrawdown),
    apexBreached:  apexBreachDays.length > 0,
    apexBreachDays,
    equityCurve,
  };
}

// ─── Full simulation ──────────────────────────────────────────────────────────
//
// candidates  : array of parsed long-candidates.jsonl objects
// barsByDate  : { 'YYYY-MM-DD': bar[] } - 1-min OHLC bars per session date
// options     : { strategies?, modes? } - defaults to all 3 strategies x 2 modes

const ALL_STRATEGIES = Object.values(STRATEGY_IDS);
const ALL_MODES      = Object.values(RESOLUTION_MODES);

function simulateAllCandidates(candidates, barsByDate, options = {}) {
  const strategies = options.strategies || ALL_STRATEGIES;
  const modes      = options.modes      || ALL_MODES;
  const executionPolicy = options.executionPolicy || EXECUTION_POLICIES.EVERY_SIGNAL;
  const eligibleCandidates = filterCandidatesByPolicy(candidates, executionPolicy);

  const runs = {};

  for (const strategyId of strategies) {
    for (const mode of modes) {
      const key    = `${strategyId}__${mode}`;
      const trades = [];
      const runCandidates = filterCandidatesByPolicy(eligibleCandidates, policyForStrategy(executionPolicy, strategyId));

      for (const candidate of runCandidates) {
        const bars = barsByDate[candidate.date] || [];
        trades.push(simulateTrade(candidate, bars, strategyId, mode));
      }

      // Ensure chronological order before equity curve computation
      trades.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.time.localeCompare(b.time);
      });

      runs[key] = {
        strategyId,
        mode,
        executionPolicy: policyForStrategy(executionPolicy, strategyId),
        eligibleCandidateCount: runCandidates.length,
        metrics: computeMetrics(trades),
        trades,
      };
    }
  }

  return {
    generatedAt:    new Date().toISOString(),
    candidateCount: candidates.length,
    eligibleCandidateCount: eligibleCandidates.length,
    executionPolicy,
    apexConfig: {
      startingBalance:      APEX_START_BALANCE,
      trailingDrawdownLimit: APEX_TRAILING_DRAWDOWN,
    },
    runs,
  };
}

// ─── Combined portfolio simulation ────────────────────────────────────────────
//
// A portfolio is a list of lanes: [{ strategyId, executionPolicy }].
// All lanes run simultaneously; trades are deduplicated by candidateId+strategyId.
// One chronological equity curve reflects the combined account-level P&L.

const PORTFOLIO_CONFIGS = Object.freeze({
  standard_3c_only: Object.freeze([
    { strategyId: STRATEGY_IDS.STANDARD_3C, executionPolicy: EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY },
  ]),
  atm_3pt_only: Object.freeze([
    { strategyId: STRATEGY_IDS.ATM_3PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
  ]),
  standard_3c_plus_atm_3pt: Object.freeze([
    { strategyId: STRATEGY_IDS.STANDARD_3C, executionPolicy: EXECUTION_POLICIES.FIRST_PER_CLUSTER_DAY },
    { strategyId: STRATEGY_IDS.ATM_3PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
  ]),
  atm_2pt_plus_atm_3pt: Object.freeze([
    { strategyId: STRATEGY_IDS.ATM_2PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
    { strategyId: STRATEGY_IDS.ATM_3PT, executionPolicy: EXECUTION_POLICIES.ATM_TAP3_PLUS_ONLY },
  ]),
});

// Run all lanes in one portfolio for one resolution mode.
// Deduplicates by candidateId+strategyId to prevent double-counting.
// Returns { lanes, mode, tradeCount, metrics, trades }.
function simulatePortfolio(candidates, barsByDate, lanes, mode) {
  const seenTradeIds = new Set();
  const allTrades    = [];

  for (const lane of lanes) {
    const filtered = filterCandidatesByPolicy(candidates, lane.executionPolicy);
    for (const candidate of filtered) {
      const tradeKey = `${candidate.id}__${lane.strategyId}`;
      if (seenTradeIds.has(tradeKey)) continue;
      seenTradeIds.add(tradeKey);
      const bars = barsByDate[candidate.date] || [];
      allTrades.push(simulateTrade(candidate, bars, lane.strategyId, mode));
    }
  }

  allTrades.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });

  return {
    lanes,
    mode,
    tradeCount: allTrades.length,
    metrics:    computeMetrics(allTrades),
    trades:     allTrades,
  };
}

// Run multiple named portfolios across all requested modes.
// options: { portfolios?: string[], modes?: string[] }
// Returns { generatedAt, candidateCount, apexConfig, runs }.
function simulateCombinedPortfolios(candidates, barsByDate, options = {}) {
  const portfolioNames = options.portfolios || Object.keys(PORTFOLIO_CONFIGS);
  const modes          = options.modes      || ALL_MODES;
  const runs           = {};

  for (const name of portfolioNames) {
    const lanes = PORTFOLIO_CONFIGS[name];
    if (!lanes) {
      throw new Error(
        `Unknown portfolio config: "${name}". Valid: ${Object.keys(PORTFOLIO_CONFIGS).join(', ')}`
      );
    }
    for (const mode of modes) {
      const key  = `${name}__${mode}`;
      runs[key]  = simulatePortfolio(candidates, barsByDate, lanes, mode);
    }
  }

  return {
    generatedAt:    new Date().toISOString(),
    candidateCount: candidates.length,
    apexConfig: {
      startingBalance:       APEX_START_BALANCE,
      trailingDrawdownLimit: APEX_TRAILING_DRAWDOWN,
    },
    runs,
  };
}

module.exports = {
  // Constants
  STRATEGY_IDS,
  RESOLUTION_MODES,
  EXECUTION_POLICIES,
  OUTCOMES,
  APEX_START_BALANCE,
  APEX_TRAILING_DRAWDOWN,
  POINT_VALUE,

  // Pure functions (exported for unit tests)
  buildStrategyParams,
  findEntryBarIndex,
  resolveTrade,
  calcPnl,
  calcR,
  simulateTrade,
  filterCandidatesByPolicy,
  policyForStrategy,
  computeMetrics,

  // Top-level runners
  simulateAllCandidates,

  // Combined portfolio
  PORTFOLIO_CONFIGS,
  simulatePortfolio,
  simulateCombinedPortfolios,
};
