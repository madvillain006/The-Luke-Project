# Fake Breakdown V2 Research

## 1. Why V1 Was Insufficient

V1 mostly answered whether fake breakdown/reclaim could become a quick prop scalp. That was too narrow.

The real discretionary pattern has at least two outputs: a fast reaction scalp and a level-to-level continuation attempt. V2 adds continuation and staged-entry research without changing live trading behavior.

## 2. Strategy Archetypes Tested

V2 strategy family: `fake_breakdown_reclaim_long_v2`.

Archetypes:

- `REACTION_SCALP`: reclaim/retest entries with fixed +2/+3/+4 ES targets.
- `LEVEL_TO_LEVEL_LONG`: post-reclaim acceptance entries with TP1 trim and TP2 at next trusted level above.
- `STAGED_LONG`: 1ES starter, add 1ES after +2, TP1 trim, TP2 next trusted level.

The `taken_rows` in artifacts are hindsight-qualified research rows, not live trade recommendations.

## 3. Data Sources

- ES 1m bars: 52,927 rows.
- SPX 1m bars: 19,999 rows.
- Saty generated levels: 28 session events.
- Mancini: 242 events, 23 usable in the current no-lookahead timeline.
- Bobby: 1,183 events, 582 timestamped SPX heatmap minute comparisons.
- Katbot/Jefe: 12,252 context events, secondary only.
- Dubz/GEX/Heatseeker: inventory exists, but no normalized timestamped executable contribution in this V2 run.

## 4. Date Range

Research sessions: 2026-03-02 through 2026-04-28.

## 5. Unique Setup Count

- Unique fake-breakdown setups: 2,351.
- Valid reclaim setups: 1,504.
- Candidate rows: 58,063.
- Reaction scalp candidate setups: 1,504.
- Level-to-level candidate setups: 1,350.
- Staged long candidate setups: 1,487.

Variant rows are not independent trades.

## 6. Reaction Scalp Results

Candidate-level results:

- Candidate rows: 30,870.
- Candidate TP1 hit rate: 58.0%.
- Candidate stop-first rate: 40.7%.
- Candidate average heat before TP1: 7.66 ES points.

Hindsight-qualified rows:

- Taken rows: 10,870.
- Average heat before TP1: 1.05 ES points.
- Median time to TP1: 2 minutes.

This confirms the scalp pattern exists, but the live problem is filtering out the other 40% before they stop first.

## 7. Level-To-Level Results

Candidate-level results:

- Candidate rows: 22,476.
- Candidate TP1 hit rate: 61.0%.
- Candidate TP2 hit rate: 11.0%.
- Candidate stop-first rate: 36.7%.
- Candidate average heat before TP2: 13.57 ES points.

Hindsight-qualified rows:

- Taken rows: 170.
- Average heat before TP2: 0.95 ES points.
- Median time to TP2: 2 minutes.

The continuation idea appears, but only a small subset was clean under current mechanical rules.

## 8. Staged Long Results

Candidate-level results:

- Candidate rows: 3,870.
- Candidate TP1 hit rate: 65.8%.
- Candidate TP2 hit rate: 8.0%.
- Candidate stop-first rate: 32.4%.
- Candidate average heat before TP2: 14.08 ES points.

Hindsight-qualified rows:

- Taken rows: 844.
- Average heat before TP1: 1.25 ES points.
- Average heat before TP2: 8.62 ES points.
- TP2 hit rate among hindsight-qualified rows: 4.7%.

Staging reduced initial risk, but the add leg did not prove strong continuation.

## 9. Entry Model Comparison

Candidate TP2 rates:

- Micro pivot break: 16.7% TP2, 32.2% stop-first.
- Higher-low after reclaim: 11.1% TP2, 37.0% stop-first.
- Three-candle hold: 10.4% TP2, 34.7% stop-first.
- Retest hold: 3.8% TP2, 39.2% stop-first.
- Reclaim close: 1.1% TP2, 39.8% stop-first.
- Level reclaim limit: 1.0% TP2, 42.6% stop-first.

Delayed confirmation entries improved TP2 behavior, but sample quality remains mixed.

## 10. Target Model Comparison

Candidate-level results:

- Fixed +2: 67.3% TP1, 32.5% stop-first, 6.23 average heat before TP1.
- Fixed +3: 57.1% TP1, 41.7% stop-first, 7.60 average heat before TP1.
- Fixed +4: 49.6% TP1, 48.0% stop-first, 9.15 average heat before TP1.
- Trim +3 then next level: 10.4% TP2, 33.6% stop-first.
- Trim +4 then next level: 10.9% TP2, 39.3% stop-first.

Quick +2 remains easiest to hit. Level-to-level requires a much better filter.

## 11. Level Ladder Findings

V2 builds a no-lookahead ladder of:

- Below: nearest invalidation levels and sweep low.
- Current: reclaimed ES executable level.
- Above: next trusted Saty/Mancini/Bobby/GEX/Dubz level if available and not too close.

The evaluator rejects targets below entry, targets too close, chop targets unless explicitly allowed, reference-only SPX levels, and diagnostic fixed +30 levels.

## 12. Bobby/Heatmap Higher Target Findings

Bobby heatmap target present:

- Unique setups: 141.
- Candidate rows: 5,476.
- Candidate TP1 hit rate: 72.7%.
- Candidate TP2 hit rate: 11.8%.
- Candidate stop-first rate: 26.8%.

No Bobby heatmap target:

- Candidate TP1 hit rate: 58.3%.
- Candidate TP2 hit rate: 4.1%.
- Candidate stop-first rate: 39.8%.

Bobby/heatmap overlap is promising but still a small sample.

## 13. Saty Findings

Saty source combo:

- Unique setups: 1,085.
- Candidate rows: 24,898.
- Candidate TP1 hit rate: 60.1%.
- Candidate TP2 hit rate: 3.9%.
- Candidate stop-first rate: 36.8%.

Saty is useful for location, but Saty alone did not prove level-to-level continuation.

## 14. Mancini Findings

Mancini source combo:

- Unique setups: 1,143.
- Candidate rows: 30,081.
- Candidate TP1 hit rate: 59.1%.
- Candidate TP2 hit rate: 5.7%.
- Candidate stop-first rate: 40.2%.

Mancini created the most setups and most level-to-level hindsight-qualified rows, but exact timestamp quality is still a limiting factor.

## 15. Dubz/GEX/Katbot Findings

Katbot/Jefe context exists but was not allowed to create standalone levels.

Dubz and GEX/Heatseeker files are present in the inventory, but this run did not have normalized timestamped levels usable as executable targets.

## 16. Prop-Risk Findings

- 2ES risk uses $100 per ES point.
- 1ES starter risk uses $50 per ES point.
- Hard risk cap: $500.
- Daily kill: $600.
- Max full losses per day: 2.
- Daily drawdown failures in V2 artifact: 0.

The lack of drawdown failures should not be overread because the rows are policy-group simulations, not one executable live schedule.

## 17. Whether Immediate 2ES Is Viable

Inconclusive.

Immediate 2ES can work for selected reaction scalps, but raw candidate stop-first rates remain too high.

## 18. Whether Staged 1ES->2ES Is Viable

Inconclusive.

Staging reduces initial risk and may fit prop constraints better, but the add leg did not show strong TP2 follow-through in this corpus.

## 19. Whether Level-To-Level Is More Promising Than Scalp

Inconclusive.

Level-to-level has a real signal in a small mechanically clean subset. Reaction scalp has a broader and easier-to-measure signal. The current machine rules do not yet prove continuation is better.

## 20. What Remains Inconclusive

- Whether the hindsight-qualified rows can become live-safe rules.
- Whether micro-pivot and higher-low entries fill realistically.
- Whether heatmap/GEX target confluence improves continuation enough.
- Whether exact-timestamp Mancini/Dubz data changes target selection.
- Whether slippage/fees erase +2 scalp edge.

## 21. What Data Is Missing

- More exact-timestamp Mancini archives.
- Normalized Dubz structural and same-day callout levels.
- Normalized GEX/Heatseeker target files.
- More parsed Bobby heatmap levels with exact post timestamps.
- Fill/slippage assumptions for ES prop execution.
- More market regimes beyond March-April 2026.

## 22. Commands To Rerun

```bash
npm run research:fake-breakdown-v2
npm test
npm run research:prop-fake-breakdown
npm run research:fake-breakdown
npm run research:replay:existing
npm run replay:history
```
