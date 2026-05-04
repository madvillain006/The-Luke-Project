---
component_id: 6
component_name: Research & Backtesting Sandbox
---

# Research & Backtesting Sandbox

## Component Description

Isolated environment for validating strategies against historical data. Simulates trade management and audits system coverage, providing feedback loop for Intelligence System refinement.

---

## Key References:

### c:\Users\conor\luke\lib\backtest-data\atm-simulator.js (lines 189-234)
```
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
```


## Source Files:

- `lib\backtest-data\atm-simulator.js`
- `lib\backtest-data\bobby-export.js`
- `lib\backtest-data\bobby-image-cache.js`
- `lib\backtest-data\bobby-image-parse.js`
- `lib\backtest-data\long-candidate-generator.js`
- `lib\backtest-data\mancini-text.js`
- `lib\backtest-data\saty-historical.js`
- `scripts\backtest-session.js`
- `scripts\build-es-long-backtest-sessions.js`
- `scripts\build-level-frequency.js`
- `scripts\coverage-audit.js`
- `scripts\inject-session-bobby-levels.js`
- `scripts\parse-discord-backtest.js`
- `scripts\run-atm-backtest.js`
- `scripts\run-combined-atm-backtest.js`

