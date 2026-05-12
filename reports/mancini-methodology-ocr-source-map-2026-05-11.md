# Mancini Fake Breakdown Methodology OCR Source Map

Generated: 2026-05-11

This is a research-only bridge between Mancini's methodology text, the new methodology images, and the Luke/Hermes packet pipeline. It does not authorize live trading or strategy deployment.

## What Changed

- `Longer Mancini Logs 2.txt` is now included as daily-plan text for level/event extraction.
- `methodology.txt` is treated as strategy-definition context, not as a level source.
- `parsing text.txt` is treated as mixed OCR/context and is blocked from daily-plan level extraction until section classification exists.
- Image OCR and visual interpretation were captured in `artifacts/research/mancini-methodology/source-map.json`.

## Core Correction

The prior machine framing was too close to "one or more 1-minute closes above the level equals acceptance." That is not Mancini's method.

The corrected rule is:

Acceptance is structure first, not a fixed close count. A failed breakdown long needs a qualified low or shelf, a sweep, a reclaim, and then either classic acceptance or the non-acceptance protocol.

## Methodology Rules Extracted

Failed breakdown:

- Significant low: prior day low, multi-hour low that produced a 20-30+ point move, or cluster/shelf of lows.
- Location: ideally a major trendline, horizontal support, or prior breakout area being back-tested.
- Flush: enough to trap shorts and run stops.
- Shallow/deep buckets: `<20` points is shallow, `>20` points is deep.
- Very shallow examples: under 10 points can use faster acceptance logic in high volatility.
- Entry context: reclaim plus acceptance, not blind support buying.
- Invalidation: stop several points below the failed-breakdown lowest low; methodology text gives roughly 5 points as an average example.

Acceptance forms:

- Backtest from below: price comes back to the significant low from below, sells, then returns again.
- Second-attempt reclaim: price reclaims, fails back below, then reclaims again.
- Non-acceptance protocol: in fast/high-volatility cases, price clears the reclaimed low by about 5 points and holds there for roughly 2-3 minutes.

Level reclaim:

- Not necessarily a low sweep.
- It is a recovery of an obvious horizontal S/R shelf with action on both sides.
- Entry handling still borrows failed-breakdown acceptance/non-acceptance logic.

Backtest entry:

- Strong breakout from a clearly defined zone.
- First retest/backtest is preferred.
- Later retests degrade.

## Image OCR Summary

The images support the same grammar:

- Prior-day low or daily/overnight low gets flushed.
- A cluster or shelf of lows can replace a single low.
- The flush should create trapped shorts/stops and often a wick.
- The recovery/reclaim is not enough by itself unless it clears the danger zone and holds.
- Stop/invalidation belongs below the trap low, not at the original support.
- Backtests after missed initial reclaims are common in major failed breakdowns.
- Failed breakout is the upside mirror: clear highs, trap breakout buyers, reverse.

## Pipeline Result After Adding New Sources

Latest deterministic run:

- Daily-plan sections parsed: 26
- Level/event rows: 2,547
- Entry-model available rows: 166
- Hermes packets built: 157
- Quick reclaim accepted timing rows: 115
- `2_to_3_5` bucket: 11 rows, still needs 19 more to pass the 30-row gate
- `3_5_to_10` bucket: 55 rows, passes gate
- `10_plus` bucket: 48 rows, passes gate

The 2-3.5 minute idea should now be reframed: it is not the whole strategy. It is one possible non-acceptance protocol signature when price is above level + 5 points and holding.

## Required Machine Fields

For the next implementation pass, Luke/Hermes should score these fields:

- `reference_level_type`: prior day low, overnight low, cluster low, daily low, S/R shelf, breakout zone.
- `reference_level_price`
- `reference_session`
- `sweep_extreme_price`
- `sweep_depth_points`
- `sweep_depth_atr`
- `bars_beyond_level`
- `wick_rejection_ratio`
- `first_reclaim_close_timestamp_et`
- `reclaim_distance_points`
- `classic_acceptance_type`: backtest_from_below, second_attempt_reclaim, none.
- `non_acceptance_protocol_match`: level + 5 points held for 2-3 minutes.
- `invalidation_price`: sweep low minus buffer.
- `mfe_15m`, `mae_15m`, `mfe_60m`, `mae_60m`.
- `nearest_saty_level`, `nearest_mancini_level`, `confluence_distance_points`.

## Loopholes Closed

- Mixed OCR/methodology text can no longer create levels.
- Packets now carry `source_map` metadata.
- Packet source text now prefers actual source snippets over generic role labels.
- Aggregation rows carry source identity and daily-plan eligibility.

## Still Open

- The images were manually/visually OCR'd because local OCR binaries are not installed.
- Section-level provenance is now present for daily-plan sections, but `parsing text.txt` still needs a classifier before it can safely contribute daily-plan rows.
- The current event model still overweights simple 1m reclaim mechanics compared with Mancini's structure-first acceptance.
- NinjaTrader tuning should wait until we add separate acceptance modules rather than forcing every setup through one reclaim-close rule.

## Next Hermes Prompt

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini

Read:
C:\Users\conor\luke\artifacts\research\mancini-methodology\source-map.json
C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\hermes_packets.jsonl
C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_rows.jsonl
C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_summary.json

Task:
Act as a review-only quant/methodology auditor. Reconcile Mancini's methodology source map with the ES 1-minute packet metrics.

Do not treat acceptance as a simple close count. Split failed-breakdown entry context into:
1. classic_acceptance_backtest_from_below
2. classic_acceptance_second_attempt_reclaim
3. non_acceptance_protocol: price reclaims level, clears level + 5 points, and remains above that danger-zone threshold for roughly 2-3 minutes

For every packet, label which of the three acceptance families is supported, unsupported, or unmeasurable from the packet fields. Then return:
- aggregate counts by acceptance family
- average flush depth, wick-to-body, volume, MFE/MAE by family
- examples where Luke's current reclaim-close model likely matched Mancini
- examples where Luke's current reclaim-close model likely missed Mancini structure
- exact missing fields required before NinjaScript tuning

Hard rules:
- Research only.
- No live trading authority.
- Do not invent thresholds beyond those in source-map.json or observed bar metrics.
- Distinguish observed_text, observed_bar_metric, existing_luke_rule, inference, and unsupported.
- Return compact JSON plus a short human-readable summary.
```
