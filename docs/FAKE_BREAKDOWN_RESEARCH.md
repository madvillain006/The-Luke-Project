# Fake Breakdown Reclaim Research

Generated from local Luke research data on 2026-05-03.

## 1. Research Hypothesis

The research-only hypothesis is that a long-only fake breakdown/reclaim around trusted ES/SPX levels may have measurable edge:

- Price breaks below a trusted level.
- Price fails to continue lower.
- Price reclaims the level within 3, 5, 10, or 15 minutes.
- Long entries are tested from reclaim close and retest-hold variants.

This is evidence only. It is not a trading recommendation and is not live.

## 2. Data Sources Used

- ES 1-minute bars from normalized historical sessions.
- SPX 1-minute bars were inventoried as reference data.
- Historical Saty levels from existing generated session data.
- Mancini session-normalized levels and local archive/import interface.
- Newly available local Mancini research file under `data/research/mancini/`.
- Bobby cached parsed heatmap/node data.
- Dubz/GEX/Heatseeker/Katbot context if present in the existing source timeline.

Raw X/Twitter content was not scraped. The Mancini importer accepts local files only by default and redacts raw content in artifacts.
The current local Mancini import produced 1 exact-timestamp normalized event and 1,086 quarantined rows/blocks. The exact imported event is outside the replayable ES window, so it did not change fake-breakdown results.

## 3. Date Range

- Replay sessions: 37.
- Replayed date range: 2026-03-02 through 2026-04-28.
- ES session bars used: 14,430.
- ES historical CSV inventory: 52,927 bars from 2026-03-01 through 2026-04-29.
- SPX historical CSV inventory: 19,999 bars from 2026-02-18 through 2026-04-28.

## 4. Sample Size

- Candidate breakdowns detected: 516.
- Valid reclaims within 15 minutes: 396.
- Invalid/no-reclaim candidates: 120.
- Result rows: 10,138.

Result rows are entry/stop/target variants, not unique setups.

## 5. No-Lookahead Enforcement

- Trusted levels are built from source events with `available_at_et <= bar timestamp`.
- Source events posted after the breakdown are excluded.
- Missing or date-only raw source timestamps are quarantined unless already normalized into session context.
- SPX reference levels are never tested as ES prices directly; when used, they carry an explicit `SPX_reference_to_ES_proxy` label with +30 ES basis.
- Outcomes use only bars after the entry timestamp.

## 6. Setup Definition

- Strategy name: `fake_breakdown_reclaim_long`.
- Default breakdown depth: ES 2.0 points below trusted level.
- Reclaim windows tested: 3, 5, 10, and 15 minutes.
- Entry models:
  - `reclaim_close`
  - `retest_hold`
- Stop models:
  - `sweep_low_minus_buffer`
  - `level_minus_fixed_buffer`
- Target models:
  - fixed +5, +10, +15 ES points
  - 1R, 2R, 3R
  - next trusted level above

## 7. Filters Tested

The artifacts aggregate by:

- source combination
- level type
- breakdown depth bucket
- reclaim time bucket
- time of day
- chop/no-chop
- Bobby confirmed/not
- GEX confirmed/not
- Dubz aligned/not
- Saty confirmed/not
- stop model
- target model

No filter was made live.

## 8. Outcome Metrics

Each result row records:

- MFE/MAE after 5, 15, 30, and 60 minutes.
- stop-first and target-first.
- time to +5/+10/+15 ES points.
- time to stop.
- R multiple after 5, 15, 30, and 60 minutes.
- source freshness and evidence labels.

Fees, slippage, commissions, queue priority, and fill quality are not modeled.

## 9. Results By Source Combo

Top result-row groups:

- `saty`: 5,292 rows, target-first 38.9%, stop-first 56.7%, avg 15m MFE 8.66, avg 15m MAE 7.48, avg R60 0.66.
- `mancini`: 3,240 rows, target-first 37.3%, stop-first 59.7%, avg 15m MFE 7.81, avg 15m MAE 8.00, avg R60 1.31.
- `bobby`: 1,550 rows, target-first 38.6%, stop-first 55.8%, avg 15m MFE 7.35, avg 15m MAE 5.90, avg R60 1.21.
- `bobby+mancini`: 56 rows, target-first 1.8%, stop-first 96.4%, avg 15m MFE 2.19, avg 15m MAE 20.44, avg R60 -11.31.

The `bobby+mancini` sample is small and bad in this corpus. Do not overread it.

## 10. Veto/Chop Findings

- Detected chop-zone cases: 0.
- The current normalized fake-breakdown corpus did not produce meaningful Mancini chop-veto analysis.
- Chop filtering remains an unproven dimension for this strategy until better chop-zone normalization exists.

## 11. What Saty Contributed

- Saty produced the largest result-row group.
- Saty-only fake breakdown/reclaim rows had positive average R60 across tested variants, but stop-first rate was still higher than target-first rate.
- Saty `prev_close` and trigger/extension levels behaved differently, so Saty level type matters.

## 12. What Mancini Contributed

- Mancini-only rows had the highest meaningful average R60 by source combo in this run.
- Mancini target-type levels looked stronger than Mancini support-type levels in the aggregate.
- Raw date-only Mancini posts remain quarantined unless normalized elsewhere with defensible availability.

## 13. Bobby/GEX/Dubz/Katbot Contribution

- Bobby-only rows showed lower average 15m MAE than Saty/Mancini groups, but stop-first rate still exceeded target-first rate.
- GEX/Heatseeker and Dubz did not produce enough clearly aligned fake-breakdown rows here to make a strong statement.
- Katbot/Jefe context may appear in source timelines, but this detector only trades trusted price levels, not narrative context alone.

## 14. Is Long-Only Strategy Supported?

Inconclusive.

There is enough evidence to keep researching fake breakdown/reclaim longs. There is not enough evidence to make it live or claim edge. The positive R averages are variant-level aggregates and may be sensitive to target/stop selection, same-bar ambiguity, and missing slippage.

## 15. What Is Not Proven

- Live profitability.
- Robustness across more months or regimes.
- Correct ES/SPX basis for every day.
- Correct target/stop ordering inside same-minute bars.
- That raw X/Mancini archive timestamps are precise.
- That fees/slippage would preserve any apparent edge.
- That the detector should change `buildTradeDecision`.

## 16. Next Data Worth Adding

- More ES RTH 1-minute bars for excluded sessions.
- Exact-timestamp Mancini and Dubz exports.
- Better normalized chop-zone boundaries.
- More cached Bobby/GEX/Heatseeker image parses.
- A daily ES/SPX basis series if SPX reference levels should be used quantitatively.

## 17. Commands

- `npm run research:fake-breakdown`
- `npm run research:import:mancini`
- `npm test`
- `npm run research:inventory`
- `npm run research:replay:existing`
- `npm run replay:history`
