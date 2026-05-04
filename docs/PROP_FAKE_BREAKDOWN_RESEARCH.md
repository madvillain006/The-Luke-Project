# Prop Fake Breakdown Research

## 1. Goal

Test whether Luke can identify long-only ES fake-breakdown/reclaim setups around trusted levels and classify them as `TRADEABLE`, `WATCH_ONLY`, or `PASS` under a prop-account risk model.

This is research only. It does not change live trading behavior, `buildTradeDecision`, `/operator-v2`, or execution paths.

## 2. Prop Account Assumptions

- Account target: 25k evaluation account.
- Instrument: ES mini only.
- Size model: 2 ES contracts.
- Dollars per point: $50 per contract, $100 total.
- Max risk per trade: $300 default.
- Max stop: 3.0 ES points default.
- Hard max stop: 5.0 ES points.
- Evaluation EOD drawdown: $1,000.
- Funded trailing intraday drawdown: $1,000.
- Daily research kill loss: $600.
- Max trades per day: 4.
- Max losses per day: 2.

## 3. Strategy Definition

`prop_fake_breakdown_reclaim_long_v1` detects:

- A trusted ES executable level exists before the event.
- ES trades below the level by 1, 2, 3, or 5 points.
- ES closes back above the level within 3, 5, 10, or 15 minutes.
- Entry models tested: reclaim close, level reclaim limit at `L + 0.25`, and retest hold.
- Stop models tested: sweep low minus 1 tick, sweep low minus 1 point, level minus 2 points, and max prop stop capped.
- Target models tested: fixed +2, +3, +4, +5, +8, next trusted level above, TP1 +3 with TP2 next level, and TP1 +4 with TP2 next level.

## 4. Data Sources Used

- ES 1m bars: 52,927 rows, 2026-03-01 through 2026-04-29.
- SPX 1m bars: 19,999 rows, 2026-02-18 through 2026-04-28.
- Research sessions replayed: 37, from 2026-03-02 through 2026-04-28.
- Timeline events: 13,705 total, 13,467 usable.
- Saty: 28 generated session level events.
- Mancini: 242 total events, 23 usable in the current timeline; one imported exact-timestamp archive event was available but outside the replay session range.
- Bobby: 1,183 total events, 1,164 usable; 582 timestamped SPX heatmap image minutes had same-minute ES/SPX bars available.
- Katbot/Jefe: 12,252 context events, but not allowed to create executable levels alone.
- Dubz/GEX/Heatseeker: files exist in the inventory, but no normalized timestamped prop-level contribution was available in this evaluator run.

## 5. Date Range

The prop evaluator used sessions from 2026-03-02 through 2026-04-28.

## 6. Basis Methods Tested

The executable evaluator used `native_es` only.

SPX was not converted into ES executable levels. Fixed `SPX + 30` produced 0 strategy rows and was not used as truth. Timestamped Bobby SPX heatmaps were handled as reference-only same-minute comparisons:

- SPX heatmap minute comparisons: 582.
- Same-minute ES/SPX bars available: 582.
- Candidate setup minutes with attached heatmap comparison: 81.
- Conversion used: false.

## 7. Setup Counts

- Unique setups: 2,351.
- Variant rows: 147,472.
- `TRADEABLE`: 59,604.
- `WATCH_ONLY`: 24,532.
- `PASS`: 63,336.
- Chop-zone setups: 4.

## 8. Unique Setups vs Variant Rows

Variant rows are not independent trades. Each setup can expand into many entry, stop, target, reclaim-window, and chop-rule variants.

The useful sample size is 2,351 unique setups, not 147,472 trades.

## 9. Prop-Risk Rules

The evaluator required:

- Valid reclaim.
- ES executable level.
- Positive stop distance.
- Risk within or near prop constraints.
- Fixed +30 and SPX reference-only levels blocked from executable use.
- Chop entries blocked before reclaim.
- Chop-after-reclaim variants allowed only under strict level-entry, sweep-stop, 2-4 point TP1 conditions.

Daily simulation was run per entry/stop/target/basis policy group to avoid mixing all variants as one impossible strategy.

## 10. Results By TP1 Size

Tradeable fixed target rows:

| TP1 | Tradeable Rows | TP1 Hit Rate | Stop-First Rate | Avg Max Heat |
| --- | ---: | ---: | ---: | ---: |
| +2 ES | 7,717 | 59.2% | 40.6% | 6.40 |
| +3 ES | 14,767 | 46.0% | 48.2% | 7.63 |
| +4 ES | 14,855 | 37.7% | 54.4% | 8.98 |

The quick +2 scalp had the best hit rate, but average heat was still larger than the preferred 3-point stop. That is a prop-account problem.

## 11. Results By Stop Model

Tradeable rows:

| Stop Model | Rows | Unique Setups | TP1 Hit Rate | Stop-First Rate | Avg Max Heat |
| --- | ---: | ---: | ---: | ---: | ---: |
| max_prop_stop_capped | 29,965 | 1,500 | 41.5% | 53.9% | 9.57 |
| level_minus_2points | 21,434 | 1,333 | 36.3% | 58.6% | 9.77 |
| sweep_low_minus_1tick | 5,468 | 334 | 40.1% | 54.4% | 9.03 |
| sweep_low_minus_1point | 2,737 | 173 | 41.8% | 50.2% | 9.40 |

No stop model made the setup obviously prop-safe.

## 12. Results By Source Combo

Tradeable rows:

| Source Combo | Setups | Rows | TP1 Hit | Stop First | Avg Heat | Avg R60 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mancini | 755 | 31,514 | 40.6% | 54.6% | 9.62 | 1.70 |
| Saty | 665 | 25,212 | 37.7% | 56.8% | 8.98 | 0.55 |
| Bobby | 30 | 926 | 40.3% | 57.6% | 14.76 | 0.19 |
| Bobby + Saty | 26 | 912 | 49.0% | 49.2% | 13.29 | -2.72 |
| Bobby + Mancini | 24 | 1,040 | 43.6% | 54.1% | 15.23 | 2.36 |

Bobby heatmap overlap improved some TP1 hit rates, but the sample is small and heat was too large to call this prop-safe.

## 13. Results By Basis Method

Only `native_es` was used for executable setup evaluation:

- Unique setups: 2,351.
- Variant rows: 147,472.
- TP1 hit rate across all rows: 24.0%.
- Stop-first rate across all rows: 30.0%.
- Average MFE 15m: 6.90.
- Average MAE 15m: 6.12.

SPX remained reference-only except for same-minute heatmap comparison metadata.

## 14. Chop-Zone Findings

- Chop setups: 4.
- Chop variant rows: 616.
- `TRADEABLE` chop rows: 0.
- `WATCH_ONLY` chop rows: 213.
- `PASS` chop rows: 403.

The current evidence does not support blindly trading inside chop. The strict reclaim rule prevented live-style tradeability.

## 15. Saty Contribution

Saty produced 1,085 unique setup candidates and 25,212 tradeable variant rows.

Top Saty level contributors included put trigger, extension levels, and previous close. Saty alone produced many valid structures, but stop-first rates remained too high for prop-account confidence.

## 16. Mancini Contribution

Mancini produced 1,143 unique setup candidates and 31,514 tradeable variant rows.

Mancini support and target levels contributed the largest setup count. Results were directionally interesting, but the current Mancini archive remains timestamp-thin, so more exact post-time data is needed before trusting intraday conclusions.

## 17. Bobby/Dubz/GEX/Katbot Contribution

Bobby contributed timestamped SPX heatmap comparison context on 582 minutes and attached to 81 candidate setup minutes.

Dubz and GEX files exist in the repo inventory, but this prop evaluator did not find normalized timestamped executable levels from them. Katbot/Jefe context was present but only allowed as secondary context, not level creation.

## 18. Prop Simulation Result

- Allowed rows after daily rules: 6,063.
- Daily drawdown failures: 0.
- Daily kill triggers: 15,972 variant rows.
- Max drawdown used: $600.

This does not prove the strategy passes a prop account because variant rows are not independent trades and fills/slippage/commissions are not modeled.

## 19. Whether Long-Only Fake Breakdown Is Supported

Inconclusive.

The structure exists often, especially around Saty and Mancini levels, and +2 ES scalp variants hit most often. The problem is risk quality: stop-first rates and average heat are too high relative to a tight 2-contract prop model.

## 20. What Is Inconclusive

- Whether Bobby heatmap overlap creates real edge.
- Whether a human-discretion filter can reduce stop-first outcomes enough.
- Whether retest-limit fills are realistic during fast reclaims.
- Whether commission, slippage, and queue priority would erase +2 point scalps.
- Whether exact-timestamp Mancini data materially changes the result.

## 21. What Needs More Data

- More exact-timestamp Mancini posts covering the ES bar date range.
- Normalized timestamped Dubz structural/callout levels.
- Normalized GEX/Heatseeker level exports with timestamps.
- More parsed Bobby heatmap levels tied to exact post minutes.
- Fees/slippage assumptions for the prop account.
- More ES/SPX 1m sessions across regimes beyond March-April 2026.

## 22. Commands To Rerun

```bash
npm run research:prop-fake-breakdown
npm test
npm run research:fake-breakdown
npm run research:replay:existing
npm run replay:history
```
