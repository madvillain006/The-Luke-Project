# Mancini Fake-Breakdown Algo Handoff For Hermes And Next Session

Generated: 2026-05-12

Status: research, historical, replay, and shadow only. No live trading authority. Do not touch broker routing, account routing, risk gates, credentials, Pine, or live order execution.

## End Goal

Build a NinjaTrader strategy, with an indicator only later if useful, based on Mancini's ES fake-breakdown / failed-breakdown logic:

1. Mancini identifies important ES levels, usually prior lows, shelves, support clusters, major supports, or level-to-level targets.
2. ES flushes or elevators down through a real support / prior low / shelf.
3. The flush traps shorts or exhausts sellers.
4. ES recovers the significant level, bases or shows acceptance, and then squeezes up into the next level or target.
5. The final algorithm must be historically tested first, then replay-tested inside NinjaTrader, before any Ninja strategy behavior is allowed to submit orders.

Hermes can be used to propose the actual math and rule candidates, but the next step is not "ask Hermes for a trading strategy" in the abstract. The next step is to feed Hermes a precise source-first training table and ask for deterministic, testable formulas that map Mancini examples plus ES 1m price action into replayable signal states.

Codex can also build the deterministic test harness. Hermes is useful for rule synthesis and feature selection; Codex should still verify every generated rule against local artifacts and Ninja replay.

## Current Truth

The market pattern is assumed viable as a project premise. The local machine implementation is not yet ready.

The newest source-first audit deliberately reports `0` strict positive training candidates. That does not mean the Mancini fake-breakdown pattern is false. It means the strict combined gate currently requires all of these to pass at once:

- direct raw Mancini passage with actual setup level
- source-stated sweep/flush low below the setup level
- same-plan S/R or prose context coincidence
- existing ES 1m chart/window match
- existing visual sanity status that does not demote the chart
- chart trap low matching the source-stated sweep low

This strict gate is useful because it prevents support-list-only rows and bad chart crops from becoming training positives. It is too strict to be the final algo label set. The next session must create the actual math and training labels from the broader source set.

## Verified File Locations

Root:

- `C:\Users\conor\luke`

Raw Mancini sources:

- `C:\Users\conor\luke\data\research\mancini\The Longer Mancini Logs.txt`
- `C:\Users\conor\luke\data\research\mancini\Longer Mancini Logs 2.txt`
- `C:\Users\conor\luke\data\research\mancini\The Mancini Logs 3-15-2026 - 5-6-2026.txt`
- `C:\Users\conor\luke\data\research\mancini\methodology.txt`
- `C:\Users\conor\luke\data\research\mancini\parsing text.txt`
- `C:\Users\conor\luke\data\backtest\es-long-bracket\raw\mancini\Mancini.txt`
- `C:\Users\conor\luke\data\mancini methodology`

Daily-plan parsed files:

- `C:\Users\conor\luke\data\research\mancini\daily-plans`
- Current sanity check found only two plan JSONs plus two markdown files in this folder:
  - `2026-05-07-thursday-es-plan.json`
  - `2026-05-07-thursday-es-plan.md`
  - `2026-05-08-may-11-es-plan.json`
  - `2026-05-08-may-11-es-plan.md`

Newest direct source audit:

- `C:\Users\conor\luke\reports\mancini-direct-fbd-source-audit-2026-05-12.md`
- `C:\Users\conor\luke\reports\mancini-fbd-chronological-source-ledger-2026-05-12.md`
- `C:\Users\conor\luke\reports\mancini-fbd-chronological-canonical-checklist-2026-05-12.md`
- `C:\Users\conor\luke\artifacts\research\mancini-direct-fbd-source-audit\direct_fbd_source_audit.json`
- `C:\Users\conor\luke\scripts\build_mancini_direct_fbd_source_audit.py`

Current direct audit counts:

- `478` direct rows
- `332 data_only`
- `114 needs_bigger_crop`
- `32 negative_control`
- `0 positive_training_candidate`
- Raw-file row split:
  - `The Longer Mancini Logs.txt`: `355`
  - `Longer Mancini Logs 2.txt`: `94`
  - `methodology.txt`: `17`
  - `parsing text.txt`: `12`
- Broad `Supports are:` / `Resistances are:` rows in the direct audit: `0`

ES 1m and session data:

- `C:\Users\conor\luke\data\historical`
- `C:\Users\conor\luke\data\backtest`
- `C:\Users\conor\luke\data\research\mancini\esm26_intraday-1min_historical-data-download-05-07-2026.csv`
- `C:\Users\conor\luke\data\backtest\es-long-bracket\sessions`
- Session sanity check: `51` JSON files total, including `example-session.json`.
- Existing context protocol metadata reports `67,540` ES bars from `2025-12-15 01:00` through `2026-05-07 18:10`.
- Known coverage gaps from existing reports include `2026-03-23`, `2026-03-24`, and `2026-03-25`.

Mancini context protocol artifacts:

- `C:\Users\conor\luke\artifacts\research\mancini-context-protocol\events.csv`
- `C:\Users\conor\luke\artifacts\research\mancini-context-protocol\metadata.json`
- `C:\Users\conor\luke\artifacts\research\mancini-context-protocol\parser-quality-audit.json`
- `C:\Users\conor\luke\artifacts\research\mancini-context-protocol\report.md`
- Current `events.csv` sanity count: `2,456` rows.

Packet and chart artifacts:

- `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets`
- `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\hermes_packets.jsonl`
- `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_rows.csv`
- `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_summary.json`
- `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\windows`
- Current packet sanity:
  - `172` packet rows
  - `128` accepted timing rows
  - `44` excluded timing rows
  - `302` crop-window CSVs under the main windows folder

Full real packet gallery:

- `C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery`
- `C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery\manifest.json`
- `C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery\summary.json`
- Current sanity:
  - `172` SVG charts exist.
  - The gallery `index.md` references PNG files, but the directory currently has `0` PNG files.
  - Do not claim gallery PNGs exist until `scripts\export_svg_charts_to_png.js` is run for that directory or the PNGs are restored.

Visual sanity audit:

- `C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\visual_sanity_audit.json`
- `C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\summary.md`
- Current visual sanity counts:
  - `training_candidate=4`
  - `review_only_context=2`
  - `insufficient_visual_context=18`
  - `dangerous_demote_for_training=148`

Existing fake-breakdown research:

- `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_V2_RESEARCH.md`
- `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_V3_LIVE_FILTERS.md`
- `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_STATE_MACHINE.md`
- `C:\Users\conor\luke\lib\research\fake-breakdown-v2`
- `C:\Users\conor\luke\lib\research\fake-breakdown-v3`
- `C:\Users\conor\luke\lib\research\fake-breakdown-state-machine`
- `C:\Users\conor\luke\artifacts\research\fake-breakdown-v2-results.json`
- `C:\Users\conor\luke\artifacts\research\fake-breakdown-v3-results.json`
- `C:\Users\conor\luke\artifacts\research\fake-breakdown-v3-best-rules.json`

NinjaTrader surfaces:

- `C:\Users\conor\luke\NinjaTrader\LukeNativeShadowStrategy.cs`
- `C:\Users\conor\luke\NinjaTrader\LukeParityOverlayIndicator.cs`
- `C:\Users\conor\luke\NinjaTrader\LukeAlertBridgeStrategy.cs`
- `C:\Users\conor\luke\NinjaTrader\README.md`
- `C:\Users\conor\luke\scripts\export-ninja-native-levels.js`
- `C:\Users\conor\luke\scripts\check-ninja-native-port.js`
- `C:\Users\conor\luke\scripts\install-ninja-native-shadow.js`
- `C:\Users\conor\luke\tests\ninja-native-source.test.js`
- `C:\Users\conor\luke\tests\ninja-native-level-export.test.js`
- `C:\Users\conor\luke\tests\ninja-native-telemetry.test.js`

Current Ninja reality:

- `LukeNativeShadowStrategy.cs` defaults to `AutonomyMode=Shadow`.
- It has `AllowHistoricalBacktestOrders=false` by default.
- It parses `# target_session: YYYY-MM-DD` and emits `LEVEL_SESSION_MISMATCH` when the level file does not match chart session.
- Current Ninja signal math is generic reclaim/watch logic, not yet the source-priority Mancini fake-breakdown algorithm.
- Final Ninja proof still requires NinjaTrader GUI compile plus Playback/Market Replay. Shell-side proof is not final.

## Current Research Results That Matter

From `quick_reclaim_acceptance_summary.json`:

- `172` packet rows.
- `128` accepted timing rows.
- `44` excluded timing rows.

Accepted timing rows by family:

| Acceptance family | Accepted rows | Avg flush | Avg 15m MFE | Avg 15m MAE | Avg 60m MFE | Avg 60m MAE |
|---|---:|---:|---:|---:|---:|---:|
| `non_acceptance_protocol` | 57 | 11.89 | 10.75 | 4.99 | 14.59 | 10.18 |
| `classic_acceptance_backtest_from_below` | 23 | 6.65 | 5.63 | 3.14 | 10.57 | 5.36 |
| `classic_acceptance_second_attempt_reclaim` | 24 | 6.71 | 3.33 | 5.74 | 7.01 | 11.49 |
| `simple_reclaim_unclassified` | 24 | 4.54 | 3.99 | 1.98 | 10.05 | 3.05 |

From V3 fake-breakdown research:

- Best low-sample 2ES/1ES rule: `Three-candle hold above level + Next trusted target at least 4 points above + Power hour`
- That rule had `43` setups, `87.3%` TP +2, `12.7%` stop-first, median MAE `0.50`, but confidence is low.
- Best medium-or-better sample rule: `Reclaim range not excessive + Next trusted target at least 3 points above + Power hour`
- That rule had `66` setups, `78.6%` TP +2, `16.1%` stop-first, median MAE `0.75`, confidence medium.
- The current docs still mark these as research/watchlist, not production strategy rules.

From `mancini-vA-dynamic-level-grid`:

- `263` signals
- `237` tradable
- `147` filled
- `113` winners
- `76.87%` win rate
- `189.45` gross points
- `4327.5` net dollars
- `28` ambiguous 1m cases

Do not overread these results. They are promising, but they are not yet source-parity plus Ninja tick replay proof.

## The Missing Math We Need To Generate

The next session must turn the source-first corpus into a deterministic algorithm. Hermes should be asked to generate the math in a form Codex can test locally.

The output should be a candidate rule spec, not Ninja code first.

Required Hermes output format:

```json
{
  "features": {},
  "state_machine": {},
  "entry_rules": [],
  "invalidation_rules": [],
  "target_rules": [],
  "risk_model": {},
  "training_labels": {},
  "negative_controls": {},
  "validation_plan": {},
  "ninja_shadow_telemetry_fields": []
}
```

### Canonical Event Schema

Each candidate event should become one row with:

- `source_id`
- `raw_file`
- `line`
- `plan_date`
- `pub_date`
- `source_quote`
- `source_mode`: `actual_recap`, `planned_setup`, `context_recap`, `negative_control`, `methodology_definition`, `data_context`
- `verdict`: current audit verdict
- `setup_level`
- `swept_low`
- `recovered_level`
- `non_acceptance_threshold`
- `invalidation_level`
- `target_or_response_level`
- `level_role_map`
- `support_context`
- `resistance_context`
- `prose_context`
- `sr_coincidence`
- `chart_path`
- `window_csv`
- `session_scan`
- `visual_sanity_status`
- `blockers`
- `es_1m_window_start`
- `es_1m_window_end`
- `bars_available`

### Labels To Generate

Do not use current `positive_training_candidate` as the only positive label. It is too strict.

Generate at least these labels:

- `source_confirmed_fbd`: raw Mancini directly says failed breakdown / flush / sweep / recovered.
- `source_planned_fbd`: Mancini planned a future fake-breakdown setup, but local data still needs proof.
- `source_negative_control`: Mancini says no trigger, not FBD, breakdown short, level reclaim only, or failed setup.
- `sr_list_only`: broad support/resistance row with no direct FBD source passage.
- `chart_confirmed_reclaim`: ES 1m confirms sweep below level and close back above level.
- `chart_confirmed_non_acceptance`: ES 1m confirms reclaim plus threshold behavior near `level + 5`.
- `chart_mismatch`: chart exists but trap/sweep/timing does not match source.
- `needs_crop`: source is usable but chart/window is missing or too narrow.
- `data_only`: useful context, not a training positive.

### Core Feature Math

Use ES points, not ticks, unless explicitly noted. One ES tick is `0.25`.

For each setup level `L`, swept low `S`, first reclaim bar `R`, and entry bar `E`:

```text
flush_depth = L - min_low_between_breakdown_and_reclaim
flush_depth_ticks = flush_depth / 0.25
time_below_minutes = minutes(first_breakdown_below_L, first_close_back_above_L)
reclaim_close_location = (R.close - R.low) / max(R.high - R.low, 0.25)
reclaim_range = R.high - R.low
acceptance_closes_above_L = consecutive_1m_closes(close >= L) after R
non_acceptance_threshold = L + 5
non_acceptance_closes = consecutive_1m_closes(close >= L + 5) after R
post_reclaim_MFE_15 = max(high - entry_price) over next 15 minutes
post_reclaim_MAE_15 = max(entry_price - low) over next 15 minutes
post_reclaim_MFE_60 = max(high - entry_price) over next 60 minutes
post_reclaim_MAE_60 = max(entry_price - low) over next 60 minutes
target_room = next_trusted_level_above - entry_price
risk_to_sweep = entry_price - (swept_low - 0.25)
target_R = target_room / max(risk_to_sweep, 0.25)
```

Shelf / significant-low score:

```text
prior_touch_count = count of prior bars where low/high/close interacts with L within 1.0 point
prior_hold_minutes = duration between first and last prior touch
prior_bounce_points = max(high after prior touch before breakdown) - L
major_source_bonus = 1 if Mancini source says major, massive, significant, daily low, shelf, or low held much of day

significant_low_score =
  0.30 * clamp(prior_touch_count / 3, 0, 1)
  + 0.25 * clamp(prior_hold_minutes / 120, 0, 1)
  + 0.25 * clamp(prior_bounce_points / 20, 0, 1)
  + 0.20 * major_source_bonus
```

Flush quality score:

```text
approach_velocity = points_sold_from_recent_high_to_swept_low / max(minutes_from_recent_high_to_swept_low, 1)
multi_level_flush_count = count of known support levels crossed before reclaim
flush_score =
  0.35 * clamp(flush_depth / 8, 0, 1)
  + 0.25 * clamp(approach_velocity / 2.0, 0, 1)
  + 0.20 * clamp(multi_level_flush_count / 3, 0, 1)
  + 0.20 * clamp(volume_on_trap_bar / median_volume_30m, 0, 2) / 2
```

Reclaim / acceptance score:

```text
reclaim_score =
  0.25 * indicator(R.close > L)
  + 0.20 * indicator(reclaim_close_location >= 0.5)
  + 0.20 * clamp(acceptance_closes_above_L / 3, 0, 1)
  + 0.20 * indicator(no_close_back_below_L_before_entry)
  + 0.15 * indicator(reclaim_range <= 6)
```

Non-acceptance score:

```text
non_acceptance_score =
  0.40 * indicator(any close >= L + 5 within 10 minutes after reclaim)
  + 0.30 * clamp(non_acceptance_closes / 3, 0, 1)
  + 0.20 * indicator(first_retest_of_L_holds_after_crossing_L_plus_5)
  + 0.10 * indicator(post_reclaim_MAE_15 <= 3)
```

Continuation / squeeze score:

```text
squeeze_score =
  0.30 * clamp(target_room / 8, 0, 1)
  + 0.25 * clamp(target_R / 2, 0, 1)
  + 0.20 * indicator(next_trusted_level_source in [mancini, bobby, gex, dubz, saty+mancini])
  + 0.15 * indicator(no_trusted_level_within_2_points_above_entry)
  + 0.10 * time_of_day_bonus
```

Candidate trade score:

```text
candidate_score =
  0.25 * significant_low_score
  + 0.20 * flush_score
  + 0.25 * max(reclaim_score, non_acceptance_score)
  + 0.20 * squeeze_score
  + 0.10 * source_confidence_score
```

Source confidence score:

```text
source_confidence_score =
  1.00 if direct Mancini actual recap with setup, swept low, and recovery
  0.80 if direct Mancini actual recap with setup and recovery but swept low must be inferred from bars
  0.65 if direct planned setup and bars later confirm the structure
  0.40 if context recap only
  0.20 if support/resistance list only
  0.00 if negative control
```

Hard rejects:

- source is `negative_control`
- source is support/resistance list only
- no setup level
- no ES 1m bars for the relevant session
- source target or level availability is after proposed entry
- chart trap low contradicts source-stated sweep low by more than tolerance
- first close back above level never occurs
- reclaimed level immediately loses again before arming
- target is below entry or too close to cover spread/slippage

### Acceptance Families To Model Separately

Hermes should not collapse all failed breakdowns into one timing rule.

Model these separately:

1. `non_acceptance_protocol`
   - flush below `L`
   - reclaim above `L`
   - push and hold near/above `L + 5`
   - usually stronger 15m MFE in current packet stats

2. `classic_acceptance_backtest_from_below`
   - reclaim `L`
   - backtest from above or from below
   - hold and launch

3. `classic_acceptance_second_attempt_reclaim`
   - first reclaim fails
   - second reclaim becomes the actionable state
   - needs stricter heat and stop handling

4. `ladder_first_reclaim`
   - multi-level elevator down
   - do not wait for an upper stale level if first lower trusted cluster is reclaimed and target room exists

5. `simple_reclaim_unclassified`
   - keep as review-only until it is split or demoted

## Proposed Deterministic State Machine

Use this as the math-to-code target:

```text
SOURCE_LEVEL_LOADED
  -> LEVEL_WATCH
  -> ZONE_WATCH
  -> BREAKDOWN_DETECTED
  -> SWEEP_CONFIRMED
  -> RECLAIM_WATCH
  -> ACCEPTANCE_CLASSIFIED
  -> ARMED_SHADOW
  -> TRADEABLE_CANDIDATE_SHADOW
```

Terminal states:

```text
REJECTED_SOURCE
REJECTED_LOOKAHEAD
REJECTED_NO_BARS
REJECTED_NO_SIGNIFICANT_LOW
REJECTED_CHART_MISMATCH
INVALIDATED
EXPIRED
DATA_ONLY
NEGATIVE_CONTROL
```

Existing related implementation:

- `C:\Users\conor\luke\lib\research\fake-breakdown-state-machine\states.js`
- Existing states include `LEVEL_WATCH`, `ZONE_WATCH`, `BREAKDOWN_DETECTED`, `RECLAIM_WATCH`, `ARMED`, `TRADEABLE`, `INVALIDATED`, and `EXPIRED`.
- Next session should extend this research state model first, not edit Ninja order logic first.

## Historical Testing Plan

Phase 1: Build a training table.

Proposed new script:

- `C:\Users\conor\luke\scripts\build_mancini_fbd_algo_training_table.py`

Proposed output:

- `C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\training_rows.jsonl`
- `C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\training_rows.csv`
- `C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\summary.md`

Inputs:

- `direct_fbd_source_audit.json`
- `mancini-context-protocol/events.csv`
- ES session JSONs under `data\backtest\es-long-bracket\sessions`
- packet windows under `hermes-mancini-event-packets\windows`
- visual sanity audit JSON

Phase 2: Generate feature matrix.

Proposed new script:

- `C:\Users\conor\luke\scripts\research_mancini_fbd_algo_math.py`

Outputs:

- `features.csv`
- `labels.csv`
- `candidate_rule_scores.json`
- `walk_forward_report.md`

Minimum feature columns:

- source confidence
- significant low score
- prior touch count
- prior hold minutes
- prior bounce points
- flush depth
- approach velocity
- time below level
- reclaim range
- reclaim close location
- acceptance closes above level
- non-acceptance closes above `L + 5`
- target room
- risk to sweep
- target R
- time-of-day bucket
- market regime bucket
- visual sanity status
- source blocker count

Phase 3: Walk-forward validation.

Use date splits, not random row splits.

Required gates:

- train on older dates, test on later dates
- no future levels or future targets
- exact level availability must be before entry
- same-bar TP/stop ambiguity resolved conservatively
- each accepted rule needs enough unique setups, not just variant rows
- compare against negative controls and random support levels

Recommended validation metrics:

- TP +2 hit rate
- TP +3 hit rate
- next-level hit rate
- stop-first rate
- median MAE before TP1
- median time to TP1
- 15m MFE/MAE
- 60m MFE/MAE
- expectancy with 0.5 ES point round-trip slippage
- max daily drawdown
- false-armed rate
- per-family results
- per-time-of-day results

Phase 4: Candidate rule selection.

Hermes should propose multiple candidates:

- high-frequency scalp candidate
- cleaner lower-frequency level-to-level candidate
- non-acceptance-only candidate
- classic-backtest-only candidate
- ladder-first-reclaim candidate

The selected rule should be the one that survives source parity and OOS validation, not necessarily the highest in-sample PnL.

## NinjaTrader Path

Do not jump straight to Ninja order code.

Correct path:

1. Build the source-first training table.
2. Generate and validate deterministic math in Python/JS.
3. Add shadow-only telemetry fields to Ninja.
4. Replay in NinjaTrader with orders disabled.
5. Compare Ninja labels to the Python/JS labels.
6. Only after parity, implement historical strategy orders for Ninja backtest.
7. Only after Ninja historical backtest, consider a chart indicator.

Likely Ninja strategy surface:

- `C:\Users\conor\luke\NinjaTrader\LukeNativeShadowStrategy.cs`

Why:

- It already defaults to `Shadow`.
- It already reads external Mancini levels.
- It already derives Saty internally.
- It already has historical-audit/backtest gates.
- It already fails closed on target-session mismatch.

But current Ninja signal math is not the target Mancini fake-breakdown math. It is generic reclaim/watch logic and should be treated as a shell for future telemetry/parity.

Ninja replay settings when that phase begins:

- `AutonomyMode=Shadow`
- `RunHistoricalAudit=true`
- `AllowHistoricalBacktestOrders=false`
- compile in NinjaTrader GUI
- run Playback/Market Replay
- compare emitted telemetry to local research labels

## Hermes Input Bundle

Give Hermes these files first:

1. `C:\Users\conor\luke\reports\mancini-algo-hermes-handoff-2026-05-12.md`
2. `C:\Users\conor\luke\artifacts\research\mancini-direct-fbd-source-audit\direct_fbd_source_audit.json`
3. `C:\Users\conor\luke\reports\mancini-fbd-chronological-canonical-checklist-2026-05-12.md`
4. `C:\Users\conor\luke\artifacts\research\mancini-context-protocol\events.csv`
5. `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_summary.json`
6. `C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_rows.csv`
7. `C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery\manifest.json`
8. `C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\visual_sanity_audit.json`
9. `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_V2_RESEARCH.md`
10. `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_V3_LIVE_FILTERS.md`
11. `C:\Users\conor\luke\docs\FAKE_BREAKDOWN_STATE_MACHINE.md`
12. `C:\Users\conor\luke\reports\mancini-ninja-shadow-parity-spec-2026-05-12.md`

Do not start Hermes with only the support/resistance level files. That will recreate the same failure mode.

## Hermes Prompt

Use this prompt in the next Hermes session:

```text
You are working on a research-only ES fake-breakdown algorithm based on Mancini newsletter examples and local ES 1m data. Do not create live trading instructions. Do not assume support/resistance rows are positive examples. Use source-first evidence only.

Goal: generate deterministic, testable math for a future NinjaTrader strategy. Output formulas, features, labels, state transitions, hard rejects, and validation gates. Do not output Ninja code yet.

Inputs:
- direct_fbd_source_audit.json: source-first raw Mancini direct failed-breakdown passages with levels, roles, chart matches, blockers, and verdicts.
- chronological checklist: human-readable source ledger.
- events.csv: parsed Mancini level universe.
- quick_reclaim_acceptance_summary.json and rows CSV: packetized ES 1m timing metrics.
- visual_sanity_audit.json: chart demotions and training candidates.
- V2/V3 fake-breakdown docs: prior research and risks.

Required output:
1. a canonical training-row schema
2. label definitions beyond the too-strict positive_training_candidate gate
3. math formulas for significant low score, flush quality, reclaim acceptance, non-acceptance, squeeze target room, source confidence, and candidate trade score
4. separate acceptance-family models for non_acceptance_protocol, classic_backtest, second_attempt, ladder_first_reclaim, and simple_reclaim_unclassified
5. hard reject rules for support-list-only, no source, no bars, no reclaim, chart/source mismatch, future target leakage, and target too close
6. walk-forward historical validation plan
7. exact telemetry fields needed later in Ninja shadow mode
8. top 3 candidate rule families to test first, with why

Important: Current strict audit has 0 positive_training_candidate rows because it combines source, chart, visual sanity, and trap-low agreement gates. Treat this as a safety gate, not as proof the pattern is absent. Build a broader supervised/review label system from source_confirmed_fbd, chart_confirmed_reclaim, chart_confirmed_non_acceptance, source_planned_fbd, negative_control, data_only, and needs_crop.

Output JSON plus concise explanation.
```

## What The Next Codex Session Should Do

Use this ready-made `/goal` prompt for a fresh Codex session:

- `C:\Users\conor\luke\reports\mancini-algo-codex-goal-prompt-2026-05-12.md`

1. Read this handoff.
2. Verify paths with `Test-Path` and counts from the JSON/CSV files.
3. Build `scripts\build_mancini_fbd_algo_training_table.py`.
4. Produce `training_rows.jsonl` and `training_rows.csv`.
5. Feed Hermes the training table and prompt above.
6. Implement the Hermes math in a deterministic local research script.
7. Run date-based walk-forward validation.
8. Write a new report with rule candidates and failure analysis.
9. Only then plan Ninja shadow telemetry changes.

## Safety Boundaries

- Trading work stays research, replay, historical, or shadow.
- Do not introduce live trading behavior.
- Do not modify broker, account routing, risk, credentials, Pine, or execution gates.
- Do not promote broad support/resistance rows into training positives.
- Do not let Hermes replace source truth. Hermes proposes math; local artifacts and replay verify it.
- Do not use current V2/V3 positive-looking results as final proof. They are research signals, not Ninja tick replay proof.

## Immediate Open Problems

1. The strict direct source audit has `0` positives after visual/trap agreement gates.
2. Many good-looking source rows need larger or better crop windows.
3. The real packet gallery has SVGs but missing PNG sidecars.
4. Existing Ninja strategy does not implement Mancini source-priority fake-breakdown math yet.
5. Current research uses OHLC 1m bars; Ninja tick replay still has to confirm fills and same-bar ambiguity.
6. Level-to-level continuation exists in the data, but current mechanical rules have not yet proven a robust continuation edge.
7. The actual algorithm math still needs to be generated and tested.
