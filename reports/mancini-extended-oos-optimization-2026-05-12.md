# Mancini Extended OOS Optimization Report

Generated: 2026-05-12, 07:12 ET
Artifact QA refresh: latest generated artifacts checked through 2026-05-12, 09:30 ET.

Research-only. No live trading authority. The failed-breakdown market pattern is treated as viable per project assumption; this report evaluates whether Luke/Hermes/Ninja can represent it correctly.

## Current State

Local ES 1m coverage:

- ES files found: 8
- ES raw rows inspected: 145,865
- ES unique timestamps after dedupe: 67,540
- Actual covered calendar dates: 60
- Calendar coverage span: 2025-12-15 through 2026-05-07, with gaps
- Global gap ranges inside that span: 2025-12-20..2026-02-28, 2026-03-07, 2026-03-14, 2026-03-21..2026-03-25, 2026-03-28, 2026-04-04, 2026-04-11, 2026-04-18, 2026-04-25, 2026-05-02
- Parsed Mancini plan dates: 24
- Missing/weak ES coverage by plan date: 2026-02-20 and 2026-03-23 are true no-bars gaps; 2026-05-08 is a calendar-date audit artifact because futures session handling can still produce rows from 2026-05-07 evening.

Nightly-plan packet lane:

- Source files: `The Longer Mancini Logs.txt`, `Longer Mancini Logs 2.txt`
- Methodology/OCR files are blocked from level generation.
- Sections parsed: 25
- Source event rows: 2,456
- Entry-model available rows: 190
- Timestamp-bearing candidate rows before packet crop: 198 (= 172 packetized examples + 26 incomplete crop-window skips; also 2,456 source rows - 2,258 missing timestamp rows)
- Hermes candidate packets: 172
- Accepted timing rows: 128
- Excluded timing rows: 44
- Pre-packet skipped source rows: 2,284
- Pre-packet skipped reasons: 2,258 missing timestamp; 26 incomplete crop window
- Packet-level reject reason flags: 44 missing/nonpositive reclaim minutes; 2 of those same excluded rows also have missing flush points.

Count definitions:

- `Hermes candidate packets` are all generated packet examples with source text, crop-window bars, and bar metrics. They can be used for human/Hermes review and chart examples.
- `Accepted timing rows` are the subset with valid measured failed-breakdown/reclaim timing. These are the only rows allowed into timing buckets and aggregate comparisons.
- `Not accepted for timing tests` are still useful examples, but they are excluded from bucket statistics because a required timing field is missing or not measurable.

Count ladder:

`2,456 source event rows -> 198 timestamp-bearing candidates -> 172 packetized examples -> 128 accepted timing rows`

Social/live-update packet lane:

- Source file: `The Mancini Logs 3-15-2026 - 5-6-2026.txt`
- Timestamped social/live events extracted: 111
- Hermes packets built: 97
- Accepted timing rows: 0
- Reason: social packets are intentionally `source_not_daily_plan_eligible` and are examples/context only, not nightly-plan timing stats.
- This lane is not included in nightly-plan stats.

## Parser Fixes Completed

- Added explicit source map gating: only daily-plan sources create level rows.
- Blocked `methodology.txt` and `parsing text.txt` from level generation.
- Fixed suffix contamination: enrichment now requires full 4/5 digit price matches.
- Kept suffix expansion only inside parsed support/resistance list ranges.
- Added identical-section dedupe by `source_id + hash`.
- Added `Trade Plan Monday/Tuesday/...` plan-date correction when title dates are unsafe.
- Fixed support/resistance list evidence so packet snippets cite exact raw level tokens first.
- Blocked support/resistance list paragraphs from being re-ingested as narrative levels.
- Centered narrative snippets around the matched level price.

Important result:

- Before hardening, false levels were created by text like `10% runner` matching `6710`.
- After hardening, failed-breakdown rows dropped from 395 to 269, total rows dropped to 2,456, while usable entry rows rose from 166 to 190 because bad dates were corrected.
- Parser evidence QA now reports `snippet_without_full_price = 0 / 2,456`.
- Parser QA artifact: `artifacts/research/mancini-context-protocol/parser-quality-audit.json`.

## Acceptance-Family Classifier

New deterministic OHLC classifier in `aggregate_quick_reclaim_acceptance.py`:

- `classic_acceptance_backtest_from_below`
- `classic_acceptance_second_attempt_reclaim`
- `non_acceptance_protocol`
- `simple_reclaim_unclassified`
- `unmeasurable`

Classifier settings:

- Backtest tolerance: 0.5 points around level
- Classic selloff minimum: 2.0 points
- Non-acceptance danger zone: level + 5.0 points
- Non-acceptance hold: 2 consecutive 1m closes above danger zone

Nightly-plan accepted timing rows by family:

| Family | Count | Avg Flush | Avg MFE 15m | Avg MAE 15m | Avg MFE 60m | Avg MAE 60m |
|---|---:|---:|---:|---:|---:|---:|
| non_acceptance_protocol | 57 | 11.89 | 10.75 | 4.99 | 14.59 | 10.18 |
| classic_acceptance_backtest_from_below | 23 | 6.65 | 5.63 | 3.14 | 10.57 | 5.36 |
| classic_acceptance_second_attempt_reclaim | 24 | 6.71 | 3.33 | 5.74 | 7.01 | 11.49 |
| simple_reclaim_unclassified | 24 | 4.54 | 3.99 | 1.98 | 10.05 | 3.05 |

All nightly candidate packets by family:

| Family | Candidate Packets | Accepted Timing Rows |
|---|---:|---:|
| non_acceptance_protocol | 67 | 57 |
| classic_acceptance_second_attempt_reclaim | 41 | 24 |
| simple_reclaim_unclassified | 39 | 24 |
| classic_acceptance_backtest_from_below | 23 | 23 |
| unmeasurable | 2 | 0 |

Interpretation:

- The highest observed 15m MFE family in this sample is `non_acceptance_protocol`.
- The old `Quick_Reclaim_Acceptance` timing bucket is too blunt. Timing matters, but only after classifying acceptance structure.
- The current Ninja strategy likely needs separate modules, not just different values for `ReclaimHoldBars`.

## Timing Buckets After Parser Hardening

| Bucket | Accepted Rows | Gate |
|---|---:|---|
| 0_to_1 | 1 | insufficient |
| 1_to_2 | 0 | empty |
| 2_to_3_5 | 13 | needs +17 |
| 3_5_to_10 | 60 | passes |
| 10_plus | 54 | passes |

The 2-3.5 minute idea remains useful, but it should be treated as a sub-feature of non-acceptance, not the whole strategy.

## Chart Artifacts

PNG export helper:

- `scripts/export_svg_charts_to_png.js`
- Exported PNG charts: 233 total (12 nightly-plan + 8 social/live-update + 5 simulated methodology + 36 curated real case studies + 172 full real packet gallery)
- Chart artifact audit: `artifacts/research/mancini-chart-artifact-audit.json`
- Latest chart audit passed with zero errors. It intentionally reports 13 warnings for `price_only` raw-source matches; those rows remain usable as weak-provenance review items, not strong source citations.

Mancini source priority:

- Mancini methodology text and newsletter source text are the authority layer.
- Real packet windows are secondary evidence used to test whether the machine matched Mancini's source context.
- The 36 real case-study charts are a curated review set, not the full available universe.
- The full real packet gallery contains all 172 packetized nightly-plan windows: 128 accepted timing rows and 44 excluded timing rows.
- Simulated methodology charts are only OCR/schema aids. They are not performance data and must never override Mancini text or real packet windows.

Nightly-plan SVG chart examples:

- `artifacts/research/hermes-mancini-event-packets/charts/manifest.json`
- `artifacts/research/hermes-mancini-event-packets/charts/index.md`
- PNGs are in the same folder as the SVGs.

Social/live-update SVG chart examples:

- `artifacts/research/hermes-mancini-social-event-packets/charts/manifest.json`
- `artifacts/research/hermes-mancini-social-event-packets/charts/index.md`
- PNGs are in the same folder as the SVGs.

Simulated methodology SVG chart examples:

- `artifacts/research/mancini-methodology/simulated-traditional-charts/manifest.json`
- `artifacts/research/mancini-methodology/simulated-traditional-charts/index.md`
- `artifacts/research/mancini-methodology/simulated-traditional-charts/methodology_sim_packets.jsonl`
- Simulated methodology PNG charts: 5 files in `artifacts/research/mancini-methodology/simulated-traditional-charts/*sim_review_only*.png`.
- Simulated packet rows include `performance_data=false` and `exclude_from_performance=true`.

Real Mancini case-study chart examples:

- Generator: `scripts/render_mancini_real_case_studies.py`
- `artifacts/research/mancini-real-case-studies/manifest.json`
- `artifacts/research/mancini-real-case-studies/index.md`
- Real case-study PNG charts: 36 files in `artifacts/research/mancini-real-case-studies/*.png`.
- Pinned cases: May 4 7212/7213, May 4 7205, May 5 7266 to 7213, May 7 7355 over 7345, May 7 7369 first-support caution.
- Auto-selected cases: 31 accepted packet-window examples balanced across acceptance families and ranked by deterministic MFE/flush/MAE criteria.

Full real Mancini packet gallery:

- Generator: `scripts/render_mancini_real_packet_gallery.py`
- `artifacts/research/mancini-real-packet-gallery/manifest.json`
- `artifacts/research/mancini-real-packet-gallery/summary.json`
- `artifacts/research/mancini-real-packet-gallery/index.md`
- Real packet gallery PNG charts: 172 files in `artifacts/research/mancini-real-packet-gallery/*.png`.
- Status split: 128 accepted timing rows, 44 excluded timing rows.
- Family split: 67 `non_acceptance_protocol`, 41 `classic_acceptance_second_attempt_reclaim`, 39 `simple_reclaim_unclassified`, 23 `classic_acceptance_backtest_from_below`, 2 `unmeasurable`.
- Source-text split: 50 explicit Mancini narrative rows, 98 support/resistance-list rows, 24 other Mancini context rows.
- Every manifest row is marked `mancini_source_priority=true`, `review_only=true`, and `trading_authority=none`.
- Every manifest row now includes `raw_mancini_source`, `derived_source_evidence`, `source_derivation_chain`, `event_fields`, and `metric_interpretation=observational_only`.
- Raw-source match quality: 50 exact snippet, 11 partial snippet, 98 price-and-role support/resistance-list matches, 13 price-only weak-provenance warnings.

Visual training sanity audit:

- Auditor: `scripts/audit_mancini_visual_training_examples.py`
- Summary: `artifacts/research/mancini-visual-sanity-audit/summary.md`
- JSON: `artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json`
- Training candidates: `artifacts/research/mancini-visual-sanity-audit/training_candidates.csv`
- Dangerous demotions: `artifacts/research/mancini-visual-sanity-audit/dangerous_demotions.csv`
- Result: 4 safe training candidates, 148 dangerous demotions, 18 insufficient-context rows, 2 review-only context rows.
- Important correction: the full 172-packet gallery is data/source evidence, not a set of positive teaching examples.
- Positive OCR/teaching examples should start from the 4 training candidates only.
- Demoted charts can still be useful as caution/control examples or as ordinary data packets, but they must not be presented to Hermes as clean Mancini failed-breakdown examples.
- The manually viewed May 4/May 7 charts that looked risky are now explicitly demoted for training use.

Hermes source-priority batches:

- Generator: `scripts/build_mancini_hermes_source_priority_batches.py`
- Batch manifest: `artifacts/research/mancini-hermes-source-priority-batches/batch_manifest.json`
- Batch audit: `artifacts/research/mancini-hermes-source-priority-batches/audit.json`
- Prompt: `artifacts/research/mancini-hermes-source-priority-batches/HERMES_SOURCE_PRIORITY_PROMPT.md`
- Batches: 13 JSONL files covering all packets, explicit narrative rows, support/resistance-list rows, context rows, recent May 2026 rows, accepted timing rows, excluded timing rows, price-only provenance warnings, and each acceptance family.
- This is the preferred next Hermes input because it orders Mancini source text before OHLC metrics and classifier labels.
- Batch audit passed with zero errors and 13 unique `price_only` provenance warnings.

Full level overlap audit:

- Generator: `scripts/analyze_mancini_full_level_overlap.py`
- Summary: `artifacts/research/mancini-full-level-overlap/summary.md`
- JSON: `artifacts/research/mancini-full-level-overlap/summary.json`
- CSV tables: `artifacts/research/mancini-full-level-overlap/by_role.csv`, `by_source.csv`, `by_saty_bucket.csv`
- Scope: all 2,456 parsed Mancini rows against the local ES 1m data, not just the 172 packet chart windows.
- Status split: 190 entry-model rows, 8 touched-without-entry-model rows, 993 not-touched rows, 239 no-bars rows, 1,026 not-long-eligible rows.
- Read: the existing parsed levels show measurable historical responses on covered plan dates. More ES data mainly repairs missing/partial plan-date coverage; more Mancini logs mainly improves out-of-sample sample size.
- Saty read: test Saty as a confluence filter first, not as a replacement level generator.

These SVGs are intentionally OCR-readable:

- title
- packet id
- acceptance family
- reclaimed level
- level + 5 danger line
- invalidation anchor
- trap candle marker
- first reclaim close marker
- flush/reclaim/MFE/MAE labels

User should visually verify examples before using them as OCR training/reference inputs.

## Ninja Implication

Current Ninja surface has:

- `ReclaimHoldBars`
- `FlushLookbackBars`
- `MinCloseAboveLevelPoints`
- tap lookback/tolerance
- failed-level cooldown/reset
- stuffed reclaim candle filters
- impulse reclaim long
- Saty ATR levels

Missing for Mancini parity:

- Module A: significant-low classifier: prior day low, overnight low, multi-hour low, cluster/shelf.
- Module B: classic acceptance backtest-from-below.
- Module C: second-attempt reclaim.
- Module D: non-acceptance protocol: level + 5 held for 2-3 bars/minutes.
- Module E: invalidation anchored below sweep low plus configurable buffer, not fixed `MaxStopPoints = 3`.
- Module F: confluence scoring between Mancini level, Saty ATR level, and shelf/cluster quality.

Do not tune live Ninja execution from this report. The next safe step is shadow/replay-only module parity.

## Hermes Prompt: Source-Priority Packets

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini

Read:
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_manifest.json
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_01_explicit_narrative.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_04_recent_may_2026.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_05_accepted_timing_only.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_06_excluded_timing_review.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\batch_07_raw_price_only_provenance_review.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\family_non_acceptance_protocol.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\family_classic_acceptance_backtest_from_below.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\family_classic_acceptance_second_attempt_reclaim.jsonl
C:\Users\conor\luke\artifacts\research\mancini-hermes-source-priority-batches\family_simple_reclaim_unclassified.jsonl
C:\Users\conor\luke\artifacts\research\mancini-methodology\source-map.json
C:\Users\conor\luke\artifacts\research\mancini-real-case-studies\manifest.json
C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery\manifest.json
C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\summary.md
C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\visual_sanity_audit.json
C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\training_candidates.csv
C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\dangerous_demotions.csv

Task:
Audit nightly-plan Mancini failed-breakdown packets using source-priority batches. Treat Mancini as the source of truth. Evaluate whether the machine labels correctly identify:
1. classic_acceptance_backtest_from_below
2. classic_acceptance_second_attempt_reclaim
3. non_acceptance_protocol
4. simple_reclaim_unclassified

Priority order:
1. Mancini methodology/newsletter text, `raw_mancini_source`, and `source_text_evidence`.
2. Real packet windows and real case-study charts.
3. Deterministic OHLC metrics and classifier labels.
4. Simulated methodology charts only for OCR/schema sanity checks.

Count ladder:
2,456 source event rows -> 198 timestamp-bearing candidates -> 172 packetized examples -> 128 accepted timing rows. Use all 172 packetized examples for visual/source review. Use only the 128 accepted timing rows for bucket statistics. Keep the 44 excluded rows visible but excluded from timing aggregates. Use simulated charts only for OCR/schema sanity checks, never as performance data.

Real case-study charts are historical packet windows tied to specific newsletter references. Prioritize them over simulated charts when judging whether the machine is matching the human methodology. For OCR/teaching examples, start with `training_candidates.csv`; treat dangerous demotions as caution/control examples, not positive examples.

Return:
- JSON summary by acceptance family
- strongest and weakest examples
- examples where the chart likely contradicts the label
- missing fields needed for Ninja shadow module parity
- whether Saty/Mancini confluence should be tested as a filter or as a level generator
- whether the curated real case-study charts and full 172-packet gallery correctly represent the newsletter examples
- whether the 13 `price_only` raw-provenance rows should be demoted, repaired, or excluded from strong source claims
- whether the 4 visual training candidates are sufficient as positive OCR examples, and which demotions are useful as negative/control examples

Hard rules:
- Research/replay only.
- No live trading authority.
- Do not invent thresholds beyond source-map or observed OHLC metrics.
- Distinguish observed_text, observed_bar_metric, deterministic_classifier, inference, and unsupported.
- Do not treat candidate packet count as accepted timing-row count.
- Do not treat support/resistance-list rows as narrative proof unless raw/source context supports that interpretation.
- Do not use `dangerous_demote_for_training` rows as positive Mancini teaching examples.
```

## Hermes Prompt: Social/Live Update Packets

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini

Read:
C:\Users\conor\luke\artifacts\research\mancini-methodology\source-map.json
C:\Users\conor\luke\artifacts\research\mancini-social-events\events.csv
C:\Users\conor\luke\artifacts\research\hermes-mancini-social-event-packets\hermes_packets.jsonl
C:\Users\conor\luke\artifacts\research\hermes-mancini-social-event-packets\quick_reclaim_acceptance_rows.jsonl
C:\Users\conor\luke\artifacts\research\hermes-mancini-social-event-packets\charts\manifest.json
C:\Users\conor\luke\artifacts\research\mancini-methodology\simulated-traditional-charts\manifest.json

Task:
Audit timestamped social/live-update Mancini events separately from nightly plan stats. These are examples and human-verification aids, not plan-derived statistical rows. Identify which packets are useful OCR/reference examples for failed breakdown, level reclaim, non-acceptance, and backtest behavior.

Return:
- packets suitable for user visual verification
- packets unsuitable because timestamp/level source is ambiguous
- any social events that strongly corroborate nightly-plan packet labels
- a compact list of recommended OCR example captions

Hard rules:
- Do not merge social/live examples into nightly-plan statistics.
- No live trading authority.
- Label source kind as social_event_text.
```

## Next Code Step

Create a replay-only Ninja module plan:

1. Add a shadow-only `ManciniAcceptanceFamily` enum.
2. Add separate booleans/telemetry for each acceptance family.
3. Add configurable non-acceptance params: danger-zone points and hold bars.
4. Add sweep-low invalidation telemetry without changing order behavior.
5. Run Market Replay/Playback manually in NinjaTrader before any order-path consideration.

## Confidence

Research assumption: the failed-breakdown phenomenon is in scope for replay/shadow review.

Machine implementation: not 100% yet. The strongest remaining blockers are:

- need visual verification of generated SVG examples
- need more 2-3.5 minute examples or reframing as only a non-acceptance sub-feature
- need Ninja shadow module parity before tuning execution
- need decision on whether social/live events can become labeled examples after user verification
