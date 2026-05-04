# Fake Breakdown State Machine Research

## 1. Can Luke Produce Useful WATCH Signals?

Level-watch universe: 1741 historical setups. Valid reclaim watch count: 1062. State rows tested from named rules: 1639.

Best named rule: Rule A: power_hour + three_candle_hold + next target >=4. Recommendation: WATCHLIST_ONLY.

This is research-only. It does not change live trading behavior or `buildTradeDecision`.

## 2. Which ARMED Rules Work Best?

| Rule | Armed | Tradeable | False armed | TP +2 | TP +3 | Stop-first | Median heat | 2ES expectancy | 25k days target | 50k days target | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A | 32 | 32 | 18.8% | 81.3% | 46.9% | 18.8% | 0.75 | $59.38 | n/a | n/a | WATCHLIST_ONLY |
| B | 155 | 155 | 23.9% | 76.1% | 51.6% | 17.4% | 0.75 | $56.77 | n/a | n/a | WATCHLIST_ONLY |
| C | 67 | 56 | 23.9% | 80.4% | 75.0% | 26.8% | 1.25 | $16.07 | n/a | n/a | WATCHLIST_ONLY |
| F | 147 | 147 | 34.0% | 66.0% | 55.1% | 34.7% | 1.25 | $-13.27 | n/a | n/a | NOT_READY |
| D | 386 | 386 | 44.3% | 55.7% | 47.9% | 43.5% | 2.50 | $-70.66 | n/a | n/a | NOT_READY |
| E | 305 | 305 | 45.2% | 54.8% | 42.6% | 45.6% | 2.25 | $-77.13 | n/a | n/a | NOT_READY |

## 3. Which Rule Survives Slippage?

Rule A: power_hour + three_candle_hold + next target >=4 had 2ES expectancy $59.38 and 1ES expectancy $29.69 after 0.5 ES points round-trip slippage.

## 4. Does 2ES Full Work?

25k 2ES_FULL, daily stop none: PnL $600.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 75.0%

2ES full remains rule-dependent. It is not broadly viable from baseline V3, and state-machine output keeps it research-only.

## 5. Does 1ES Starter Work Better?

25k 1ES_STARTER, daily stop none: PnL $300.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 75.0%

1ES reduces loss size but does not automatically solve false armed signals. It remains a paper/research sizing variant.

## 6. False Armed Rate

Best-rule false armed rate: 18.8%. False armed means ARMED did not reach fixed +2 before the measured outcome window/stop logic.

## 7. Days To Pass 25K

Best 25k 2ES simulation: 25k 2ES_FULL, daily stop none: PnL $600.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 75.0%.

The 25k target in this state-machine run is +$1,250 with $1,000 drawdown limits.

## 8. Account Fail First

Best 25k 2ES fail-before-target probability: 0.0%. Best 50k 2ES fail-before-target probability: 0.0%.

This is deterministic replay probability over the current corpus, not a forward statistical estimate.

## 9. Live-Watchlist Candidates

- A: Rule A: power_hour + three_candle_hold + next target >=4
- B: Rule B: power_hour + reclaim range not excessive + next target >=3
- C: Rule C: Bobby/heatmap target above + two_candle_hold

## 10. Paper-Only Candidates

- None.

## 11. Research-Only / Not Ready

- F: Rule F: first_retest_hold + 1-2pt sweep + no overhead within 2
- D: Rule D: micro_pivot_break + no overhead level within 2
- E: Rule E: higher_low_after_reclaim + target >=4

## 12. 50K With Previous Rules

The 50k side simulation keeps the same signal, trade, daily kill, max losses, and max tradeable signal rules, but uses a $3,000 target and $2,000 EOD/funded trailing drawdown.

- A: 50k 2ES_FULL, daily stop none: PnL $600.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 75.0%
- B: 50k 2ES_FULL, daily stop none: PnL $-250.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 66.7%
- C: 50k 2ES_FULL, daily stop none: PnL $-1400.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 0.0%
- F: 50k 2ES_FULL, daily stop none: PnL $-1300.00, target hit false, days to target n/a, failed false, fail-before-target 0.0%, positive days 39.1%
- D: 50k 2ES_FULL, daily stop none: PnL $-1900.00, target hit false, days to target n/a, failed true, fail-before-target 100.0%, positive days 42.9%
- E: 50k 2ES_FULL, daily stop none: PnL $-2275.00, target hit false, days to target n/a, failed true, fail-before-target 100.0%, positive days 16.7%

## 13. Remaining Risks

- State reconstruction uses historical OHLC bars, not order-book fills.
- WATCH and ARMED states are reconstructed from existing V2/V3 research artifacts, not yet a live scanner.
- Same-bar ambiguity and slippage assumptions can still change apparent edge.
- Named-rule thresholds were chosen after V3 research and need more out-of-sample days.

## 14. Commands To Rerun

```bash
npm run research:fake-breakdown-state
npm run research:fake-breakdown-v3
npm test
```
