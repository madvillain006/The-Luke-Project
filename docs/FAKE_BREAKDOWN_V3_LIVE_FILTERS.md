# Fake Breakdown V3 Pre-Entry Filter Research

Status: research/watchlist only. "Live filters" in older artifact names means pre-entry filters tested on historical/replay data, not live execution.

## 1. Which Pre-Entry Filters Worked Best?

Best 2ES rule: Three-candle hold above level + Next trusted target at least 4 points above + Power hour: 43 setups, TP +2 87.3%, stop-first 12.7%, median MAE 0.50, 2ES expectancy $68.52, 1ES expectancy $44.01, confidence low.

Best medium-or-better sample rule: Reclaim range not excessive + Next trusted target at least 3 points above + Power hour: 66 setups, TP +2 78.6%, stop-first 16.1%, median MAE 0.75, 2ES expectancy $48.39, 1ES expectancy $30.89, confidence medium.

Best high-confidence sample rule: First retest hold + Sweep depth 1-2 points + No trusted level within 2 points overhead: 227 setups, TP +2 66.6%, stop-first 34.4%, median MAE 1.25, 2ES expectancy $-12.35, 1ES expectancy $-9.87, confidence high.

Best 1ES/starter rule: Three-candle hold above level + Next trusted target at least 4 points above + Power hour: 43 setups, TP +2 87.3%, stop-first 12.7%, median MAE 0.50, 2ES expectancy $68.52, 1ES expectancy $44.01, confidence low.

The rule search uses only allowlisted pre-entry fields: source/target presence, entry model, sweep depth, time below level, reclaim candle quality, acceptance before entry, overhead distance, chop status, time of day, and stop size.

## 2. Did Bobby/Heatmap Target Presence Remain Useful?

Best Bobby/heatmap rule: Bobby/heatmap target present + Micro-pivot break + Reclaim range not excessive: 43 setups, TP +2 83.3%, stop-first 18.8%, median MAE 1.38, 2ES expectancy $59.09, 1ES expectancy $27.34, confidence low.

Bobby present baseline: 136 setups, TP +2 67.2%, stop-first 46.3%.
Bobby absent baseline: 1232 setups, TP +2 60.5%, stop-first 41.3%.
In V3, Bobby/heatmap presence improved TP +2 hit rate but did not broadly reduce stop-first rate across all requested entry models. The best Bobby combinations are still low-sample.

## 3. Did Micro-Pivot/Higher-Low/Hold Entries Reduce Heat?

| Entry filter | Setups | TP +2 | Stop-first | Median MAE | 2ES expectancy |
| --- | ---: | ---: | ---: | ---: | ---: |
| two_candle_hold_above_level | 1224 | 63.4% | 40.4% | 2.00 | $-56.70 |
| first_retest_hold | 1134 | 62.8% | 39.6% | 2.00 | $-53.30 |
| higher_low_after_reclaim | 1251 | 59.6% | 43.4% | 2.25 | $-75.51 |
| three_candle_hold_above_level | 1076 | 58.9% | 45.1% | 2.25 | $-81.44 |
| micro_pivot_break | 999 | 59.8% | 40.3% | 2.25 | $-62.28 |

## 4. Is TP +2 Prop-Safe Under Slippage?

Baseline taken setups: 1368. TP +2 hit rate 61.1%, stop-first 41.7%, median MAE 2.00.
With 0.25 ES points per side, equivalent to 0.5 round trip, baseline 2ES expectancy is $-65.62 and baseline 1ES expectancy is $-31.83.

## 5. Is 2ES Full-Size Viable?

Research verdict: no. Full 2ES rows are only counted as preferred when stop <= 3 ES points. Hard-stop rows up to 5 points are measured but not treated as clean full-size prop entries.

## 6. Is 1ES Starter Better?

Research verdict: inconclusive. 1ES uses the same entry/stop evidence but halves point-dollar exposure. Staged add-after-confirmation remains diagnostic, not a live rule.

## 7. Are There Enough Samples To Trust This?

Unique setups: 1368. Observation rows: 11368. Date range: 2026-03-19 to 2026-04-28. Best-rule confidence: low.

Variant rows are not independent trades. Confidence is based on unique setups, and small source-combo samples stay low confidence.

## 8. What Remains Discretionary?

- Whether a visual fake breakdown is clean versus ordinary chop noise.
- Whether a fast retest or micro-pivot fill is realistic in live order flow.
- Whether the next heatmap/Bobby level is still active liquidity, not stale context.
- Whether a prop trader should skip after emotional or high-volatility conditions not represented in the bars.

## 9. 50k Side Project

The 50k account uses the same rules with a $3,000 profit target and $2,000 EOD/funded intraday drawdown. Best 2ES rule 50k cumulative PnL: $2050.00, profit target hit: false, account failed: false.

## 10. Failure-Oriented Risks

- V3 consumes V2 OHLC artifacts; fills are still bar assumptions, not queue-level executions
- slippage is simplified to 0.5 ES points round trip and does not include commissions
- rows are filtered by observable features, but the selected thresholds were still chosen after seeing V2 research
- Bobby target distance is unavailable for some target-present rows and is labeled present_distance_unknown
- same-bar TP/stop ambiguity is treated conservatively as stop-first
- 50k side project changes drawdown/profit target only; it does not prove account-passing reliability

## 11. Commands To Rerun

```bash
npm run research:fake-breakdown-v3
npm run research:fake-breakdown-v2
npm test
```

This research does not change live trading behavior, does not change `buildTradeDecision`, and does not add execution.
