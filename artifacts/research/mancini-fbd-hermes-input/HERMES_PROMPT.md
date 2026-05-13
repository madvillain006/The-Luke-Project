# Hermes Prompt: Mancini Fake-Breakdown Algorithm Math

You are reviewing a research-only ES fake-breakdown / failed-breakdown package based on Mancini source text plus local ES 1m data. Do not create live trading instructions. Do not create NinjaTrader code first. Do not assume support/resistance-list-only rows are positive examples.

Goal: propose deterministic, testable math and rule candidates that Codex can verify locally before any NinjaTrader Strategy Analyzer, Playback, or Market Replay work.

Safety boundary:
- Research, historical, replay, and shadow only.
- No live trading behavior.
- Do not touch or route broker accounts, credentials, Pine, live execution, risk checks, kill switches, order validation, or position sizing.
- Hermes may propose math, but local artifacts and replay must verify it.
- Support/resistance-list-only rows remain negative/control/context rows unless direct source and chart evidence prove otherwise.
- `risk_model` in the required JSON means research-only false-positive, invalidation, and validation-risk logic. It must not include account risk, sizing, order placement, or live-trading instructions.

Completeness contract:
- Treat this package as complete for the requested research math review based on the currently available local source text, ES 1m data, chart windows, audits, label recovery, SATY comparison, and docs.
- Do not answer with a request for more local work, more files, more chart crops, more Ninja work, more broker data, or more data collection before producing the required JSON.
- If evidence is insufficient for a stronger claim, encode that as lower confidence, a hard reject, a negative/control label, a minimum sample-size gate, or a validation-plan item. Do not block the response.
- Known limits such as 1m OHLC ordering, `needs_crop`, price-only gallery matches, zero strict direct positives, and small family sample sizes are already represented in the files below; use them as constraints, not as missing-input reasons.
- Use only no-lookahead fields for candidate math. Keep MFE/MAE, hit rates, stop-first, and future targets in labels/validation.

Important current safety-gate fact:
- The strict direct audit has 0 `positive_training_candidate` rows.
- That is a safety-gate result, not proof the pattern is absent.
- Build broader review labels from `source_confirmed_fbd`, `source_planned_fbd`, `chart_confirmed_reclaim`, `chart_confirmed_non_acceptance`, `source_negative_control`, `sr_list_only`, `chart_mismatch`, `needs_crop`, and `data_only`; keep `data_only` / no-source rows as hard-reject or control context.

Current local counts:
- Direct audit rows: 842
- Context events: 2456
- Packet rows: 172
- Training rows: 1129
- Feature rows: 1129
- Hard-rejected feature rows: 1072
- Unique setups: 973
- Exact scenario strategy-grid rows: 1296
- Real packet gallery SVG files: 172
- Real packet gallery PNG files: 172
- Missing gallery PNG sidecars from manifest: 0
- Total chart/audit PNG files: 233
- Chart artifact audit pass: true

Current label counts:
- `source_confirmed_fbd`: 472
- `source_planned_fbd`: 131
- `source_negative_control`: 30
- `sr_list_only`: 98
- `chart_confirmed_reclaim`: 300
- `chart_confirmed_non_acceptance`: 158
- `chart_mismatch`: 3
- `needs_crop`: 591
- `data_only`: 496

Completed label-recovery review:
- Source-qualified hard-reject rows reviewed: 427
- Rows with available session/level scanned: 263
- Recovered flush/reclaim rows: 125
- Recovered non-acceptance rows: 67
- Candidate-eligible rows after recovery: 11
- Candidate-eligible unique setups after recovery: 10
- Recovery is review-only and did not modify the main package labels.

Completed SATY side-project comparison:
- Sessions loaded: 37
- Valid SATY sessions: 22
- SATY protocol rows: 526
- SATY-only rows are negative/control/context rows only. They are included to compare geometry against Mancini-source rules, not to promote no-source setups.

Completed per-example SATY prior-close context overlay:
- Packet examples overlaid: 172
- Valid SATY derivations: 108
- Invalid SATY derivations: 64
- Prior-close reference rows: 172
- SVG context charts: 172
- PNG context charts: 172
- Validation outcome label rows: 172
- Reference-before-target failures: 0
- Reference-field-not-close failures: 0
- Plan-date/session mismatches: 0
- Reference-close mismatch failures: 0
- SATY session anchor missing rows: 16; these are 17:00-17:59 ET maintenance-gap edge cases and are hard-rejected from SATY-valid derivations.
- MFE/MAE leakage check: feature rows contain MFE/MAE = False; labels-only outcomes are in `example_saty_validation_outcomes.csv`.
- Per-example SATY rows compare generated prior-close levels against each Mancini packet example. This does not make SATY a source authority and does not promote S/R-list-only examples.

Seed Ninja shadow telemetry field names for later, without writing Ninja code:
- `research_session_id`
- `instrument`
- `chart_time_et`
- `bar_time_utc`
- `mancini_plan_date`
- `source_pub_date`
- `source_path`
- `source_line`
- `source_quote`
- `source_mode`
- `source_role`
- `source_tags`
- `source_confidence_score`
- `setup_family`
- `setup_level`
- `swept_low`
- `flush_depth_points`
- `flush_depth_atr`
- `trap_bar_open`
- `trap_bar_high`
- `trap_bar_low`
- `trap_bar_close`
- `trap_bar_volume`
- `trap_bar_body_points`
- `trap_bar_wick_ratio`
- `reclaim_time_et`
- `reclaim_minutes_from_flush`
- `first_reclaim_close`
- `acceptance_close_count`
- `non_acceptance_threshold`
- `threshold_hold_minutes`
- `first_retest_holds`
- `saty_nearest_level_name`
- `saty_nearest_level_price`
- `saty_distance_points`
- `saty_atr_valid`
- `target_or_response_level`
- `target_room_points`
- `invalidation_anchor`
- `invalidation_buffer_points`
- `hard_reject_reason`
- `review_label`
- `accepted_for_timing_stats`
- `no_live_execution`
- `no_order_submitted`

Use these package files:
1. `selected_training_rows.jsonl`
2. `feature_dictionary.md`
3. `candidate_rule_scores.json`
4. `walk_forward_report.md`
5. `label_recovery_summary.json`
6. `recovered_label_rows.jsonl`
7. `saty_protocol_comparison.json`
8. `saty_protocol_rows.csv`
9. `example_saty_context.json`
10. `example_saty_rows.csv`
11. `example_saty_report.md`
12. `example_saty_chart_manifest.json`
13. `example_saty_validation_outcomes.csv`
14. `chart_artifact_audit.json`
15. `features.csv`
16. `labels.csv`
17. `exact_strategy_grid.csv`
18. `exact_strategy_grid.json`
19. `training_summary.json`
20. `mancini_algo_hermes_handoff.md`
21. `direct_fbd_source_audit.json`
22. `real_packet_gallery_manifest.json`
23. `visual_sanity_audit.json`
24. `ninja_shadow_parity_spec.md`
25. `fake_breakdown_state_machine.md`
26. `fake_breakdown_v2_research.md`
27. `fake_breakdown_v3_live_filters.md`
28. `pre_hermes_completeness_audit.md`
29. `manifest.json`
30. `source_file_index.md`

The files above are sufficient to produce the requested JSON. `source_file_index.md` also records source paths and checksums for provenance, but Hermes should not need additional local preprocessing before answering.

Required output format:

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

Required analysis:
1. Propose deterministic formulas for significant low score, flush quality, reclaim acceptance, non-acceptance, squeeze/target room, source confidence, and candidate score.
2. Keep no-lookahead math separate from outcome labels. MFE/MAE, hit rates, stop-first, and future targets are labels/validation only.
3. Model these families separately: `non_acceptance_protocol`, `classic_acceptance_backtest_from_below`, `classic_acceptance_second_attempt_reclaim`, `ladder_first_reclaim`, and `simple_reclaim_unclassified`.
4. Preserve hard rejects for support-list-only, no source, no bars, no reclaim, chart/source mismatch, future target leakage, source-after-entry leakage, target below/too close, and immediate reclaim failure.
5. Compare against negative controls: random support levels, direct support bids without flush/reclaim, late reclaim, Saty-only/no Mancini source setup, and shuffled timestamps.
6. Recommend top 3 rule families to test next, including minimum sample-size requirements and what would invalidate each rule.
7. List exact Ninja shadow telemetry fields needed later, but do not write Ninja code.
8. Do not return a "need more on your end" answer. Return the required JSON with confidence, reject, and validation gates where evidence is weak.
