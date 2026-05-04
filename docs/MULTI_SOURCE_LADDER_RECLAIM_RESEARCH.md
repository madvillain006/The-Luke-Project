# Multi-Source Ladder First-Reclaim Research

## 1. Why This Exists
- The prior fake-breakdown research could wait for upper-level reclaim, which can miss the earliest opportunity after a ladder flush.
- This pass tests the first lower trusted level reclaimed after price flushes through one or more trusted level clusters.

## 2. Difference From Fake-Breakdown V1/V2/V3
- V1/V2/V3 mainly evaluate reclaim behavior around a single trusted level and later confirmation filters.
- This archetype builds a timestamp-valid ladder from all trusted sources, detects levels lost during a flush, and evaluates the first reclaimed lower cluster.

## 3. Data Sources
- ES 1m bars: 52927 (2026-03-01 to 2026-04-29).
- SPX 1m bars: 19999 (2026-02-18 to 2026-04-28).
- Source timeline events: 13706, usable 13468.
- Sources considered: Saty, Mancini, Dubz, Bobby/heatmap, GEX/Heatseeker when present, SPX reference levels with explicit basis handling.

## 4. Level Clustering Approach
- ES cluster tolerance: 1.5 points.
- Nearby executable ES levels are clustered by price and source combo.
- Chop/veto clusters are labeled and not blindly used as entries.

## 5. SPX/ES Basis Handling
- ES-native levels are preferred for executable entries.
- SPX levels stay reference_only unless same-minute/session-open/prior-close/rolling-15m basis is available.
- fixed_plus_30_proxy is diagnostic only and produced no strategy-truth executable rows.

## 6. Flush Definitions
- single_level: one trusted cluster lost and reclaimed.
- multi_level: two or three trusted clusters lost before first reclaim.
- deep_flush: four or more trusted clusters lost.

## 7. First-Reclaim Definitions
- First reclaim is the first lower lost cluster that closes back above after the sweep low.
- The detector does not wait for mid/upper reclaim.
- Upper clusters become next-cluster and runner targets.

## 8. Sample Size
- Single-level flushes: 533.
- Multi-level flushes: 330.
- Deep flushes: 70.
- First-reclaim candidates: 933.
- Variant rows: 110956.

## 9. Results By Source Combo
- Top source combo: bobby, setups 366, TP +2 75.7%, stop-first 28.3%.

## 10. Results By Number Of Clusters Flushed
- Top cluster-count bucket: 1, setups 533, TP +2 79.5%, stop-first 26.2%.

## 11. Results By First Reclaimed Source Type
- Top first-reclaim source: bobby, setups 366, TP +2 75.7%, stop-first 28.3%.

## 12. Comparison Vs Late/Upper-Level Reclaim
- Comparable late-reclaim rows: 84268.
- Late reclaim too-late cases: 58672.
- Average points captured before late reclaim: 4.1.

## 13. Prop-Risk Findings
- Profit targets are diagnostic only. The research viability check is continuous positive PnL without drawdown failure, not one big trade or instant account pass.
- Positive-day rate is reported as a caution metric, but it is not a hard gate because the strategy can recover through small wins and controlled losses.
- 25k 2ES: PnL -1050, continuous profitable false, target hit false, failed true, max drawdown 1050, positive-day rate 14.0%.
- 25k 1ES: PnL 562.5, continuous profitable true, target hit false, failed false, max drawdown 525, positive-day rate 46.0%.
- 50k 2ES: PnL 1125, continuous profitable true, target hit false, failed false, max drawdown 1050, positive-day rate 46.0%.
- 50k 1ES: PnL 562.5, continuous profitable true, target hit false, failed false, max drawdown 525, positive-day rate 46.0%.

## 14. Whether First-Reclaim Catches The Move Earlier
- First reclaim better than late reclaim: yes.
- Points captured before late reclaim: 4.1.

## 15. Readiness
- Prop viability: WATCHLIST_ONLY.
- This remains research-only unless reviewed visually and retested on fresh data.

## 16. What Remains Unproven
- OHLC bars cannot prove realistic queue fills.
- Cluster tolerance may be too wide or too tight.
- Date-only Mancini/Dubz context may overstate availability precision.
- Same-bar stop/target ambiguity is treated pessimistically but still hides sequence.
- Visual pattern quality from the attached TradingView example is approximated, not truly understood by the rules.

## 17. Commands To Rerun
- `npm run research:ladder-reclaim`
- `npm test`
- `npm run research:fake-breakdown-state`
- `npm run research:fake-breakdown-v3`
- `npm run research:fake-breakdown-watchlist`
