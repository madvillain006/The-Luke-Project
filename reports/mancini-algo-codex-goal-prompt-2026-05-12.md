# Codex `/goal` Prompt: Mancini Fake-Breakdown Algo To Hermes/Ninja Readiness

Use this as the exact `/goal` prompt in a fresh Codex session.

```text
/goal Work in C:\Users\conor\luke. Use C:\Users\conor\luke\reports\mancini-algo-hermes-handoff-2026-05-12.md as the source-of-truth handoff.

Goal: comprehensively complete the local research tasks needed to turn the Mancini fake-breakdown / failed-breakdown source corpus into a deterministic, testable algorithm package that is ready to give to Hermes, and then ready for NinjaTrader historical/replay strategy analysis only after the math is validated.

Hard completion boundary:
- Do not return to the user with a partial status.
- Return only when one of these is true:
  1. The local Codex work is complete and the package is ready to feed into Hermes, with exact file paths and verification results.
  2. The local Codex work is complete and the only remaining blocker is that the user must open NinjaTrader GUI to run Strategy Analyzer / Playback / Market Replay, with exact strategy settings, input files, and expected telemetry checks.

Safety boundary:
- Research, historical, replay, and shadow only.
- Do not introduce live trading behavior.
- Do not touch broker routing, account routing, credentials, Pine source, live execution, or risk/kill-switch gates.
- Do not promote support/resistance-list-only rows into positive examples.
- Do not let Hermes replace source truth. Hermes may propose math; local artifacts and replay must verify it.
- Protect the dirty worktree. Do not revert or normalize unrelated user changes.

Required orchestration:
- Use subagents for bounded read-only audits where useful: source/data inventory, algorithm math/spec review, and Ninja/replay integration sanity.
- Keep their tasks disjoint.
- Close subagents when finished.
- The parent agent owns final integration and verification.

Step 1: Verify current inputs.
- Verify these paths exist:
  - C:\Users\conor\luke\artifacts\research\mancini-direct-fbd-source-audit\direct_fbd_source_audit.json
  - C:\Users\conor\luke\reports\mancini-fbd-chronological-canonical-checklist-2026-05-12.md
  - C:\Users\conor\luke\artifacts\research\mancini-context-protocol\events.csv
  - C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_summary.json
  - C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_rows.csv
  - C:\Users\conor\luke\artifacts\research\mancini-real-packet-gallery\manifest.json
  - C:\Users\conor\luke\artifacts\research\mancini-visual-sanity-audit\visual_sanity_audit.json
  - C:\Users\conor\luke\data\backtest\es-long-bracket\sessions
  - C:\Users\conor\luke\NinjaTrader\LukeNativeShadowStrategy.cs
- Recompute and report the current row counts rather than trusting prose.
- Explicitly confirm whether real packet gallery PNG sidecars exist; do not assume they do.

Step 2: Build the source-first algo training table.
- Create C:\Users\conor\luke\scripts\build_mancini_fbd_algo_training_table.py.
- Inputs:
  - direct_fbd_source_audit.json
  - mancini-context-protocol/events.csv
  - quick_reclaim_acceptance_rows.csv
  - quick_reclaim_acceptance_summary.json
  - mancini-real-packet-gallery/manifest.json
  - visual_sanity_audit.json
  - ES session JSONs under data\backtest\es-long-bracket\sessions
- Outputs:
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\training_rows.jsonl
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\training_rows.csv
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\summary.json
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-training-table\summary.md
- Required labels:
  - source_confirmed_fbd
  - source_planned_fbd
  - source_negative_control
  - sr_list_only
  - chart_confirmed_reclaim
  - chart_confirmed_non_acceptance
  - chart_mismatch
  - needs_crop
  - data_only
- Required per-row fields:
  - raw_file, line, plan_date, pub_date, source_quote
  - setup_level, swept_low, recovered_level, non_acceptance_threshold, invalidation_level, target_or_response_level
  - source_mode, source_confidence_score, level_role_map, sr_coincidence
  - chart_path, window_csv, visual_sanity_status, blockers
  - ES window availability and session date

Step 3: Generate the actual algorithm math locally.
- Create C:\Users\conor\luke\scripts\research_mancini_fbd_algo_math.py.
- Implement deterministic feature math from the handoff:
  - significant_low_score
  - flush_score
  - reclaim_score
  - non_acceptance_score
  - squeeze_score
  - source_confidence_score
  - candidate_score
  - target_room
  - risk_to_sweep
  - target_R
  - MFE/MAE over 15m and 60m
- Model acceptance families separately:
  - non_acceptance_protocol
  - classic_acceptance_backtest_from_below
  - classic_acceptance_second_attempt_reclaim
  - ladder_first_reclaim
  - simple_reclaim_unclassified
- Outputs:
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-math\features.csv
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-math\labels.csv
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-math\candidate_rule_scores.json
  - C:\Users\conor\luke\artifacts\research\mancini-fbd-algo-math\walk_forward_report.md

Step 4: Validate historically with no lookahead.
- Use date-based splits, not random row splits.
- Validate exact level/source availability before any proposed entry.
- Reject future targets, target-only rows, support-list-only rows, missing bars, no reclaim, and chart/source mismatches.
- Compare against negative controls:
  - random support levels
  - direct support bids without flush/reclaim
  - late reclaim after the first reclaim already moved
  - Saty-only levels with no Mancini source setup
  - shuffled timestamps
- Report:
  - TP +2 hit rate
  - TP +3 hit rate
  - next-level hit rate
  - stop-first rate
  - false-armed rate
  - median MAE before TP1
  - 15m and 60m MFE/MAE
  - expectancy with 0.5 ES point round-trip slippage
  - per-family results
  - per-time-of-day results
  - sample sizes by unique setup, not just variant rows

Step 5: Build the Hermes-ready package.
- Create C:\Users\conor\luke\artifacts\research\mancini-fbd-hermes-input.
- Include:
  - HERMES_PROMPT.md
  - manifest.json
  - selected_training_rows.jsonl
  - feature_dictionary.md
  - candidate_rule_scores.json
  - walk_forward_report.md
  - source_file_index.md
- The Hermes prompt must ask for deterministic, testable math and rule candidates, not Ninja code first.
- The Hermes prompt must preserve the safety boundary and explicitly warn that 0 strict positives in the current audit is a safety-gate result, not proof the pattern is absent.

Step 6: Decide whether NinjaTrader GUI is needed now.
- If the math package is complete but no Ninja implementation is appropriate yet, stop with "ready for Hermes" and exact files.
- If the math has been validated enough to require Ninja Strategy Analyzer / Playback proof, prepare the Ninja instructions but do not claim GUI proof.
- Ninja settings must keep:
  - AutonomyMode=Shadow
  - RunHistoricalAudit=true
  - AllowHistoricalBacktestOrders=false unless explicitly testing Strategy Analyzer historical orders
  - no live account behavior
- Expected Ninja telemetry must include acceptance family, trap low, setup level, swept low, reclaim time, non-acceptance threshold, source quote id, source role, target level, invalidation anchor, and review label.

Verification requirements before final response:
- Run python syntax checks on new Python scripts.
- Run the new training-table and math scripts end to end.
- Run targeted tests if existing test surfaces are touched.
- If tests cannot be run, explain the exact blocker.
- Print final row counts and output paths.
- Confirm no broker/risk/live/Pine/credential/execution surfaces were touched.

Final response should be short and operational:
- Say whether the result is "ready for Hermes" or "ready for user-run NinjaTrader GUI analysis."
- List exact output files.
- List verification commands run.
- List the single remaining blocker, if any.
```
