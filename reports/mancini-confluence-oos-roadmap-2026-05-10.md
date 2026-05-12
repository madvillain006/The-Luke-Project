# Mancini Confluence OOS Roadmap

Review-only. Trading authority: none. Working assumption: the failed-breakdown phenomenon is real and viable. Current question: whether Luke/Ninja is correctly tuned to capture it, especially around Mancini + Saty confluence zones.

## Current State

- Hermes/OpenAI route is fixed through `openai-direct`.
- Existing Mancini packet pipeline is deterministic and local.
- Current parsed Mancini coverage is 19 plan dates from `2026-03-23` through `2026-05-08`.
- Current Quick_Reclaim_Acceptance packet set has 104 packets and 77 usable reclaim-timing rows.
- Current `2_to_3_5` reclaim bucket has only 10 usable rows, so it remains a candidate timing signature, not a tuning target by itself.
- Existing NinjaTrader strategy already contains reclaim/flush/Saty machinery, but it is not yet proven to be tuned to the specific fake-breakdown confluence signature.

## Main Working Theory

The best machine signature may not be "Mancini level alone" or "Saty level alone." It may be a confluence zone where:

1. Price sweeps below a support/floor region.
2. The sweep interacts with either a Mancini level, a Saty ATR level, or both.
3. Price reclaims the level/zone within a measurable time window.
4. The reclaim shows acceptance through consecutive 1m closes or a higher-timeframe hold.
5. The invalidation is either the sweep low minus one tick, a fixed distance below the level, or a confluence-zone failure.

## Roadmap

### Phase 1: Data Expansion

Goal: reach enough rows for real OOS comparison.

Inputs needed:

- More Mancini logs / plan levels beyond the current 19 plan dates.
- Matching ES 1m Barchart CSVs for every plan date.
- ES 1m for `2026-03-23` if available; it may recover some existing local levels.

Keep separate:

- Main test: levels valid only on their `plan_date`.
- Separate stale-level test: old levels carried forward over later sessions.

Minimum data gate:

- At least 30 accepted timing rows in `2_to_3_5`.
- At least 30 accepted timing rows in each populated comparison bucket.
- Populate `0_to_1` and `1_to_2` if possible, or mark them untestable.

### Phase 2: Confluence Feature Builder

Add deterministic columns per candidate row:

- nearest Mancini level
- nearest Saty level
- distance to nearest Mancini level
- distance to nearest Saty level
- Mancini-Saty distance
- confluence bucket: `none`, `within_0_5`, `within_1`, `within_2`, `within_3`
- source bucket: `mancini_only`, `saty_only`, `mancini_saty_confluence`
- trap candle volume
- trap candle wick/body
- trap candle close location
- flush points and ticks
- reclaim minutes
- acceptance closes
- MFE/MAE windows

Critical guardrail:

Saty levels must be generated historically from data available before the target session. No current-day lookahead.

### Phase 3: OOS Aggregation

Compare buckets:

- `mancini_only`
- `saty_only`
- `mancini_saty_confluence`
- confluence distance buckets
- reclaim timing buckets
- acceptance close buckets
- flush-depth buckets

Primary comparison metrics:

- avg MFE 15m / 60m
- avg MAE 15m / 60m
- MFE-to-MAE ratio
- adverse excursion before reclaim
- false reclaim rate
- acceptance persistence
- sample size and missing-data rate

No profitability claims until an entry/stop/target model is explicitly defined.

### Phase 4: Stop/Invalidation Study

Test invalidation variants as separate hypotheses:

- sweep low minus 1 tick
- level minus 2 points
- zone low minus 1 tick
- ATR-scaled stop
- confluence-level failure

Do not pick one based on anecdote. Compare distributions.

### Phase 5: Ninja Alignment Audit

Only after the deterministic rows identify a candidate signature:

- Compare Ninja `FlushLookbackBars` to observed reclaim timing.
- Compare `ReclaimHoldBars` to acceptance closes.
- Compare `MinCloseAboveLevelPoints` to first reclaim closes.
- Compare Saty generated levels to historical Saty feature builder.
- Compare `ClusterTolerancePoints` to observed confluence distances.
- Check whether `Block stuffed reclaim candles`, wick filters, and impulse reclaim match the best observed rows.

### Phase 6: Replay-Only Ninja Modules

Module A: Static level reader

- Load Mancini levels by session.
- Load Saty levels by session.
- Expose confluence zones as read-only overlays first.

Module B: Trigger

- Detect sweep below level/zone.
- Detect reclaim close.
- Track reclaim timing bucket.
- Track acceptance closes.

Module C: Filter

- Optional Saty/Mancini confluence.
- Optional trap candle volume ratio.
- Optional wick/body and close-location filters.
- Optional 5m confirmation.

Module D: Diagnostics

- Emit every candidate row.
- Emit rejection reason.
- Emit selected level source and distances.
- No live execution until replay diagnostics match the deterministic research table.

## Loopholes To Close

- Timezone drift between Barchart CT labels and ET event labels.
- Contract roll / symbol mismatch across ES files.
- Duplicate bars from overlapping CSV exports.
- Saty ATR lookahead.
- Stale Mancini levels accidentally mixed into plan-date test.
- Current Ninja filters blocking the exact fake-breakdown signature.
- Overfitting to `2_to_3_5` with only 10 rows.
- Hermes turning summaries into rules.
- Confluence distance tuned after seeing outcomes.
- Entry/stop/target model selected without slippage and fill assumptions.

## Codex Prompt 1: Build Confluence Aggregator

```text
Process_narration=false.

Working assumption: failed-breakdown strategy is viable. Do not debate viability. The task is to make the machine-readable research pipeline capture Mancini/Saty confluence correctly.

In C:\Users\conor\luke, inspect:
- scripts/run_mancini_oos_pipeline.py
- scripts/aggregate_quick_reclaim_acceptance.py
- lib/backtest-data/saty-historical.js
- lib/backtest-data/saty-pine-watch.js
- artifacts/research/mancini-context-protocol/events.csv

Implement a review-only confluence aggregator that reads the existing Quick_Reclaim rows and adds:
- nearest Saty level
- nearest Mancini level
- distance fields
- confluence bucket
- source bucket
- Saty provenance fields

Do not touch NinjaTrader strategy code.
Do not touch broker/risk/execution paths.
Run focused syntax/tests.
Return output file paths and sample-size gaps.
```

## Codex Prompt 2: OOS Expansion Run

```text
Process_narration=false.

Assume the user has added more Mancini logs and matching ES 1m CSV files.

Run the deterministic OOS pipeline:
1. Rebuild Mancini context protocol.
2. Rebuild Hermes packets.
3. Rebuild Quick_Reclaim aggregation.
4. Rebuild confluence aggregation.
5. Report sample gates by bucket.

Do not use Hermes for row generation.
Do not edit strategy code.
Do not claim profitability.
Return exact counts, missing dates, and next blockers.
```

## Codex Prompt 3: Ninja Alignment Audit

```text
Process_narration=false.

Inspect only. Do not edit NinjaTrader files.

Compare the deterministic confluence/reclaim research outputs against:
- ninjatrader/LukeNativeShadowStrategy.cs
- lib/backtest-data/saty-pine-watch.js

Report whether current Ninja parameters are likely capturing:
- sweep below Mancini/Saty confluence
- reclaim timing
- acceptance closes
- trap candle quality
- confluence distance

Return a tuning matrix with current Ninja parameter, research field, likely mismatch, and proposed replay-only diagnostic.
```

## Hermes Prompt 1: Review Confluence Summary

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini.

Read only summary artifacts, not raw CSV windows:
- quick_reclaim_acceptance_summary.json
- quick_reclaim_acceptance_rows.jsonl
- confluence aggregation summary when available

Task:
Review whether Mancini/Saty confluence improves the failed-breakdown reclaim signature.

Rules:
- Treat failed-breakdown viability as a working assumption.
- Do not claim live readiness.
- Do not invent thresholds.
- Label every claim as observed_metric, hypothesis, unsupported, or implementation_gap.
- Return loopholes and exact next deterministic tests.
```

## Hermes Prompt 2: Stop/Invalidation Review

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini.

Read:
- confluence OOS summary
- invalidation-variant summary when available

Task:
Compare stop/invalidation candidates:
- sweep low minus 1 tick
- level minus 2 points
- zone low minus 1 tick
- ATR-scaled stop
- confluence failure

Return:
- which variants are mechanically testable
- which variants are unsupported
- which variant should be replay-diagnosed first
- what evidence would falsify each variant

Do not write NinjaScript.
Do not claim profitability.
```

## Hermes Prompt 3: Ninja Module Spec Review

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini.

Read:
- final confluence summary
- Ninja alignment audit
- proposed module spec

Task:
Review whether the proposed Ninja modules faithfully implement the deterministic failed-breakdown confluence signature.

Return:
- missing fields
- ambiguous definitions
- likely replay mismatches
- diagnostics required before any live behavior

Do not approve live trading.
Do not broaden scope.
```
