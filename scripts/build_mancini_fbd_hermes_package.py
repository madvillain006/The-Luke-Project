#!/usr/bin/env python3
"""Build the Hermes input package for Mancini FBD algorithm review.

Offline research packaging only. This script copies deterministic local outputs
and writes a prompt/index for Hermes. It does not call Hermes, NinjaTrader, Pine,
broker, risk, credential, runtime, or execution paths.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "reports/mancini-algo-hermes-handoff-2026-05-12.md"
DIRECT_AUDIT = ROOT / "artifacts/research/mancini-direct-fbd-source-audit/direct_fbd_source_audit.json"
CHECKLIST = ROOT / "reports/mancini-fbd-chronological-canonical-checklist-2026-05-12.md"
EVENTS = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
QUICK_SUMMARY = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_summary.json"
QUICK_ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
GALLERY_MANIFEST = ROOT / "artifacts/research/mancini-real-packet-gallery/manifest.json"
VISUAL_AUDIT = ROOT / "artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json"
CHART_ARTIFACT_AUDIT = ROOT / "artifacts/research/mancini-chart-artifact-audit.json"
LABEL_RECOVERY_SUMMARY = ROOT / "artifacts/research/mancini-fbd-label-recovery/summary.json"
LABEL_RECOVERY_ROWS = ROOT / "artifacts/research/mancini-fbd-label-recovery/recovered_label_rows.jsonl"
SATY_COMPARISON = ROOT / "artifacts/research/mancini-fbd-saty-side-project/protocol_comparison.json"
SATY_ROWS = ROOT / "artifacts/research/mancini-fbd-saty-side-project/saty_protocol_rows.csv"
SATY_EXAMPLE_CONTEXT = ROOT / "artifacts/research/mancini-fbd-example-saty-context/example_saty_context.json"
SATY_EXAMPLE_ROWS = ROOT / "artifacts/research/mancini-fbd-example-saty-context/example_saty_rows.csv"
SATY_EXAMPLE_REPORT = ROOT / "artifacts/research/mancini-fbd-example-saty-context/example_saty_report.md"
SATY_EXAMPLE_CHART_MANIFEST = ROOT / "artifacts/research/mancini-fbd-example-saty-context/chart_manifest.json"
SATY_EXAMPLE_VALIDATION_OUTCOMES = ROOT / "artifacts/research/mancini-fbd-example-saty-context/example_saty_validation_outcomes.csv"
V2_DOC = ROOT / "docs/FAKE_BREAKDOWN_V2_RESEARCH.md"
V3_DOC = ROOT / "docs/FAKE_BREAKDOWN_V3_LIVE_FILTERS.md"
STATE_DOC = ROOT / "docs/FAKE_BREAKDOWN_STATE_MACHINE.md"
NINJA_PARITY_SPEC = ROOT / "reports/mancini-ninja-shadow-parity-spec-2026-05-12.md"

TRAINING_ROWS = ROOT / "artifacts/research/mancini-fbd-algo-training-table/training_rows.jsonl"
TRAINING_SUMMARY = ROOT / "artifacts/research/mancini-fbd-algo-training-table/summary.json"
FEATURES = ROOT / "artifacts/research/mancini-fbd-algo-math/features.csv"
LABELS = ROOT / "artifacts/research/mancini-fbd-algo-math/labels.csv"
CANDIDATE_RULE_SCORES = ROOT / "artifacts/research/mancini-fbd-algo-math/candidate_rule_scores.json"
WALK_FORWARD_REPORT = ROOT / "artifacts/research/mancini-fbd-algo-math/walk_forward_report.md"
EXACT_STRATEGY_GRID_CSV = ROOT / "artifacts/research/mancini-fbd-algo-math/exact_strategy_grid.csv"
EXACT_STRATEGY_GRID_JSON = ROOT / "artifacts/research/mancini-fbd-algo-math/exact_strategy_grid.json"

OUT_DIR = ROOT / "artifacts/research/mancini-fbd-hermes-input"
OUT_PROMPT = OUT_DIR / "HERMES_PROMPT.md"
OUT_MANIFEST = OUT_DIR / "manifest.json"
OUT_SELECTED_ROWS = OUT_DIR / "selected_training_rows.jsonl"
OUT_FEATURE_DICT = OUT_DIR / "feature_dictionary.md"
OUT_RULE_SCORES = OUT_DIR / "candidate_rule_scores.json"
OUT_WALK_FORWARD = OUT_DIR / "walk_forward_report.md"
OUT_EXACT_STRATEGY_GRID_CSV = OUT_DIR / "exact_strategy_grid.csv"
OUT_EXACT_STRATEGY_GRID_JSON = OUT_DIR / "exact_strategy_grid.json"
OUT_SOURCE_INDEX = OUT_DIR / "source_file_index.md"
OUT_COMPLETENESS_AUDIT = OUT_DIR / "pre_hermes_completeness_audit.md"
OUT_LABEL_RECOVERY_SUMMARY = OUT_DIR / "label_recovery_summary.json"
OUT_LABEL_RECOVERY_ROWS = OUT_DIR / "recovered_label_rows.jsonl"
OUT_SATY_COMPARISON = OUT_DIR / "saty_protocol_comparison.json"
OUT_SATY_ROWS = OUT_DIR / "saty_protocol_rows.csv"
OUT_SATY_EXAMPLE_CONTEXT = OUT_DIR / "example_saty_context.json"
OUT_SATY_EXAMPLE_ROWS = OUT_DIR / "example_saty_rows.csv"
OUT_SATY_EXAMPLE_REPORT = OUT_DIR / "example_saty_report.md"
OUT_SATY_EXAMPLE_CHART_MANIFEST = OUT_DIR / "example_saty_chart_manifest.json"
OUT_SATY_EXAMPLE_VALIDATION_OUTCOMES = OUT_DIR / "example_saty_validation_outcomes.csv"
OUT_NINJA_SHADOW_STUDY = OUT_DIR / "ManciniFbdShadowStudy.cs"
OUT_FLAGSHIP_RESULT = OUT_DIR / "FLAGSHIP_RESULT_2026-05-13.json"
OUT_FINAL_HERMES_AUDIT_PROMPT = OUT_DIR / "FINAL_HERMES_AUDIT_PROMPT_2026-05-13.md"
OUT_NINJATRADER_SHADOW_AUDIT_PROMPT = OUT_DIR / "NINJATRADER_SHADOW_AUDIT_PROMPT_2026-05-13.md"
OUT_MORNING_SANITY_REPORT = OUT_DIR / "MORNING_SANITY_REPORT_2026-05-13.md"
OUT_EXECUTIVE_REPORT_HTML = OUT_DIR / "MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.html"
OUT_EXECUTIVE_REPORT_PDF = OUT_DIR / "MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.pdf"
OUT_EXECUTIVE_REPORT_PNG = OUT_DIR / "MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.png"
OUT_BUILD_CANDIDATE_REPORT_HTML = OUT_DIR / "MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.html"
OUT_BUILD_CANDIDATE_REPORT_PDF = OUT_DIR / "MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.pdf"
OUT_BUILD_CANDIDATE_REPORT_PNG = OUT_DIR / "MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.png"
OUT_CHART_ARTIFACT_AUDIT = OUT_DIR / "chart_artifact_audit.json"
OUT_TRAINING_SUMMARY = OUT_DIR / "training_summary.json"
OUT_FEATURES = OUT_DIR / "features.csv"
OUT_LABELS = OUT_DIR / "labels.csv"
OUT_HANDOFF = OUT_DIR / "mancini_algo_hermes_handoff.md"
OUT_DIRECT_AUDIT = OUT_DIR / "direct_fbd_source_audit.json"
OUT_GALLERY_MANIFEST = OUT_DIR / "real_packet_gallery_manifest.json"
OUT_VISUAL_AUDIT = OUT_DIR / "visual_sanity_audit.json"
OUT_NINJA_PARITY_SPEC = OUT_DIR / "ninja_shadow_parity_spec.md"
OUT_V2_DOC = OUT_DIR / "fake_breakdown_v2_research.md"
OUT_V3_DOC = OUT_DIR / "fake_breakdown_v3_live_filters.md"
OUT_STATE_DOC = OUT_DIR / "fake_breakdown_state_machine.md"


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def file_entry(path: Path, role: str) -> dict[str, Any]:
    return {
        "path": rel(path),
        "role": role,
        "bytes": path.stat().st_size if path.exists() else 0,
        "sha256": sha256(path) if path.exists() else "",
    }


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def jsonl_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if line.strip():
                item = json.loads(line)
                if isinstance(item, dict):
                    rows.append(item)
    return rows


def required_inputs() -> list[Path]:
    return [
        HANDOFF,
        DIRECT_AUDIT,
        CHECKLIST,
        EVENTS,
        QUICK_SUMMARY,
        QUICK_ROWS,
        GALLERY_MANIFEST,
        VISUAL_AUDIT,
        CHART_ARTIFACT_AUDIT,
        LABEL_RECOVERY_SUMMARY,
        LABEL_RECOVERY_ROWS,
        SATY_COMPARISON,
        SATY_ROWS,
        SATY_EXAMPLE_CONTEXT,
        SATY_EXAMPLE_ROWS,
        SATY_EXAMPLE_REPORT,
        SATY_EXAMPLE_CHART_MANIFEST,
        SATY_EXAMPLE_VALIDATION_OUTCOMES,
        V2_DOC,
        V3_DOC,
        STATE_DOC,
        NINJA_PARITY_SPEC,
        TRAINING_ROWS,
        TRAINING_SUMMARY,
        FEATURES,
        LABELS,
        CANDIDATE_RULE_SCORES,
        WALK_FORWARD_REPORT,
        EXACT_STRATEGY_GRID_CSV,
        EXACT_STRATEGY_GRID_JSON,
    ]


def prompt_text(
    training_summary: dict[str, Any],
    scores: dict[str, Any],
    label_recovery: dict[str, Any],
    saty_comparison: dict[str, Any],
    saty_example_context: dict[str, Any],
    chart_audit: dict[str, Any],
) -> str:
    counts = training_summary["input_counts"]
    labels = training_summary["label_counts"]
    math_counts = scores["input_counts"]
    exact_strategy_grid = read_json(EXACT_STRATEGY_GRID_JSON)
    recovery_counts = label_recovery["counts"]
    saty_coverage = saty_comparison["coverage"]
    saty_example_coverage = saty_example_context["coverage"]
    saty_example_sanity = saty_example_context["sanity"]
    chart_counts = chart_audit["counts"]
    return f"""# Hermes Prompt: Mancini Fake-Breakdown Algorithm Math

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
- Direct audit rows: {counts["direct_source_audit_rows"]}
- Context events: {counts["events_rows"]}
- Packet rows: {counts["quick_reclaim_rows"]}
- Training rows: {training_summary["training_row_count"]}
- Feature rows: {math_counts["feature_rows"]}
- Hard-rejected feature rows: {math_counts["hard_rejected_rows"]}
- Unique setups: {math_counts["unique_setups"]}
- Exact scenario strategy-grid rows: {len(exact_strategy_grid.get("rows", []))}
- Real packet gallery SVG files: {counts["gallery_svg_files"]}
- Real packet gallery PNG files: {counts["gallery_png_files"]}
- Missing gallery PNG sidecars from manifest: {counts["gallery_manifest_missing_png_sidecars"]}
- Total chart/audit PNG files: {chart_counts["total_png"]}
- Chart artifact audit pass: {str(chart_audit["pass"]).lower()}

Current label counts:
- `source_confirmed_fbd`: {labels["source_confirmed_fbd"]}
- `source_planned_fbd`: {labels["source_planned_fbd"]}
- `source_negative_control`: {labels["source_negative_control"]}
- `sr_list_only`: {labels["sr_list_only"]}
- `chart_confirmed_reclaim`: {labels["chart_confirmed_reclaim"]}
- `chart_confirmed_non_acceptance`: {labels["chart_confirmed_non_acceptance"]}
- `chart_mismatch`: {labels["chart_mismatch"]}
- `needs_crop`: {labels["needs_crop"]}
- `data_only`: {labels["data_only"]}

Completed label-recovery review:
- Source-qualified hard-reject rows reviewed: {recovery_counts["source_qualified_hard_reject_rows"]}
- Rows with available session/level scanned: {recovery_counts["rows_with_existing_session_and_level_scanned"]}
- Recovered flush/reclaim rows: {recovery_counts["recovered_flush_reclaim_rows"]}
- Recovered non-acceptance rows: {recovery_counts["recovered_non_acceptance_rows"]}
- Candidate-eligible rows after recovery: {recovery_counts["candidate_eligible_after_recovery_rows"]}
- Candidate-eligible unique setups after recovery: {recovery_counts["candidate_eligible_unique_setups"]}
- Recovery is review-only and did not modify the main package labels.

Completed SATY side-project comparison:
- Sessions loaded: {saty_coverage["sessions_loaded"]}
- Valid SATY sessions: {saty_coverage["valid_saty_sessions"]}
- SATY protocol rows: {saty_coverage["saty_protocol_rows"]}
- SATY-only rows are negative/control/context rows only. They are included to compare geometry against Mancini-source rules, not to promote no-source setups.

Completed per-example SATY prior-close context overlay:
- Packet examples overlaid: {saty_example_coverage["packet_examples"]}
- Valid SATY derivations: {saty_example_coverage["valid_saty_rows"]}
- Invalid SATY derivations: {saty_example_coverage["invalid_saty_rows"]}
- Prior-close reference rows: {saty_example_coverage["prior_close_reference_rows"]}
- SVG context charts: {saty_example_coverage["svg_charts_written"]}
- PNG context charts: {saty_example_coverage["png_sidecars_present"]}
- Validation outcome label rows: {saty_example_coverage.get("validation_outcome_label_rows", 0)}
- Reference-before-target failures: {saty_example_sanity["reference_before_target_failures"]}
- Reference-field-not-close failures: {saty_example_sanity["reference_field_not_close_failures"]}
- Plan-date/session mismatches: {saty_example_sanity["plan_date_target_session_mismatch_rows"]}
- Reference-close mismatch failures: {saty_example_sanity["reference_close_mismatch_failures"]}
- SATY session anchor missing rows: {saty_example_sanity["saty_session_anchor_missing_rows"]}; these are 17:00-17:59 ET maintenance-gap edge cases and are hard-rejected from SATY-valid derivations.
- MFE/MAE leakage check: feature rows contain MFE/MAE = {saty_example_sanity.get("mfe_mae_present_in_feature_rows", "unknown")}; labels-only outcomes are in `example_saty_validation_outcomes.csv`.
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
{{
  "features": {{}},
  "state_machine": {{}},
  "entry_rules": [],
  "invalidation_rules": [],
  "target_rules": [],
  "risk_model": {{}},
  "training_labels": {{}},
  "negative_controls": {{}},
  "validation_plan": {{}},
  "ninja_shadow_telemetry_fields": []
}}
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
"""


def feature_dictionary_text() -> str:
    return """# Feature Dictionary

Scope: deterministic offline research features for Mancini FBD review. Candidate scoring avoids future outcome labels.

## Source Fields

- `training_row_id`: Stable local row id.
- `row_origin`: `direct_source_audit` or `packet_observation`.
- `raw_file`, `line`, `plan_date`, `pub_date`, `source_quote`: Mancini source provenance.
- `source_mode`: Source mode from direct audit or packet context.
- `source_confidence_score`: Source-first confidence. Negative controls and no-source `data_only` rows score 0, support/resistance list-only rows score 0.20, direct actual recaps can score up to 1.0.
- `level_role_map`, `sr_coincidence`: Source role and S/R context evidence.

## Level And Chart Fields

- `setup_level`: Candidate failed-breakdown level.
- `swept_low`: Trap/sweep low from source or chart window.
- `recovered_level`: Reclaimed level.
- `non_acceptance_threshold`: Usually `setup_level + 5`.
- `invalidation_level`: Sweep-low or source invalidation anchor.
- `target_or_response_level`: Next response/target from source or same-plan level universe.
- `chart_path`, `window_csv`, `visual_sanity_status`, `blockers`: Chart/window and source sanity evidence.
- `es_window_available`, `session_date`, `bars_available`: Local data availability checks.

## Labels

- `source_confirmed_fbd`: Direct source text describes failed breakdown, recovery, reclaim, or squeeze.
- `source_planned_fbd`: Mancini planned a future failed-breakdown style setup.
- `source_negative_control`: Source says no trigger, non-FBD, failed setup, or negative control.
- `sr_list_only`: Support/resistance list-only row; never a positive example by itself.
- `chart_confirmed_reclaim`: ES 1m confirms sweep/reclaim structure.
- `chart_confirmed_non_acceptance`: ES 1m confirms reclaim plus threshold behavior near `level + 5`.
- `chart_mismatch`: Chart/trap timing contradicts source.
- `needs_crop`: Usable source but chart/window is missing or too narrow.
- `data_only`: No-source/context row; hard-reject or control context, never a training positive.

## Deterministic Feature Math

- `significant_low_score`: Prior touches, prior hold time, prior bounce points, and major-source bonus.
- `flush_score`: Flush depth, approach velocity, multi-level flush count, and trap-bar volume ratio.
- `reclaim_score`: Close above level, reclaim close location, acceptance closes known by classification time, no close back below the level before classification, and reclaim range.
- `non_acceptance_score`: No-lookahead threshold/hold/retest score. The 15m MAE outcome gate is excluded from candidate scoring.
- `squeeze_score`: Target room, target R, trusted source level, no nearby overhead level, and time-of-day bonus.
- `candidate_score`: `0.25 significant_low + 0.20 flush + 0.25 max(reclaim, non_acceptance_no_lookahead) + 0.20 squeeze + 0.10 source_confidence`, after source-label gates exclude `data_only` / no-source rows from candidate selection.

## Outcome Labels

- `mfe_15m`, `mae_15m`, `mfe_60m`, `mae_60m`: Labels only.
- `tp2_hit`, `tp3_hit`, `next_level_hit`, `stop_first`, `false_armed`: Validation labels only.
- `tp2_first`, `tp3_first`, `next_level_first`, `same_bar_stop_and_target`, `first_hit_event`: Chronological validation labels. Same-bar stop/target ambiguity is handled as conservative stop-first unless later tick replay proves otherwise.
- `expectancy_points_slippage_0_5`: Outcome label using 0.5 ES point round-trip slippage and chronological first-hit/timeout logic.
- `non_acceptance_score_with_outcome_audit`: Labels-only diagnostic score with the 15m MAE gate included for audit comparison. It is forbidden for candidate selection and absent from `features.csv`.

## Completeness And Review Artifacts

- `label_recovery_summary.json`: Review-only pass over source-qualified hard rejects using existing session/window/raw Barchart data.
- `recovered_label_rows.jsonl`: Recovered review labels and remaining hard rejects. Use as supplemental evidence, not as automatic promotion.
- `saty_protocol_comparison.json`: SATY ATR-generated side-project comparison. SATY-only/no Mancini-source rows remain negative/control/context rows.
- `saty_protocol_rows.csv`: SATY protocol rows for geometry comparison only.
- `example_saty_context.json`: Per-Mancini-packet SATY context overlay summary and rows. SATY levels are generated from the example's SATY session anchor using the prior completed ES session close and ATR(14).
- `example_saty_rows.csv`: Per-example SATY nearest-level distances and no-lookahead provenance checks.
- `example_saty_report.md`: Human sanity report for per-example prior-close SATY overlays.
- `example_saty_chart_manifest.json`: Paths and provenance for the corrected per-example SATY SVG/PNG chart overlays.
- `example_saty_validation_outcomes.csv`: Labels-only per-example MFE/MAE outcome export. Do not use these fields in candidate formulas.
- `chart_artifact_audit.json`: PNG/chart artifact coverage and warnings. Price-only raw-source matches are caveats, not blockers.
- `pre_hermes_completeness_audit.md`: Final package-completeness audit and response contract.
- `candidate_rule_scores.json`: Candidate rule scores and walk-forward summaries.
- `walk_forward_report.md`: Human-readable walk-forward report.
- `exact_strategy_grid.csv`: Parameter grid for Strategy Analyzer/Playback replay planning across rule scope, timeframe, target, and stop variants.
- `exact_strategy_grid.json`: JSON version of the exact strategy grid and aggregate metrics.
- `features.csv`: Full deterministic feature matrix.
- `labels.csv`: Full label/outcome matrix. Use future/outcome fields only in validation, never in candidate formulas.
- `training_summary.json`: Training-table counts and label counts.
- `mancini_algo_hermes_handoff.md`: Source-of-truth handoff narrative.
- `direct_fbd_source_audit.json`: Direct Mancini source audit.
- `real_packet_gallery_manifest.json`: Manifest for the 172 real packet gallery cases and chart sidecars.
- `visual_sanity_audit.json`: Visual/source sanity status for packet rows.
- `ninja_shadow_parity_spec.md`: Later shadow telemetry context only; do not write Ninja code.
"""


def completeness_audit_text(
    training_summary: dict[str, Any],
    scores: dict[str, Any],
    label_recovery: dict[str, Any],
    saty_comparison: dict[str, Any],
    saty_example_context: dict[str, Any],
    chart_audit: dict[str, Any],
) -> str:
    recovery_counts = label_recovery["counts"]
    saty_coverage = saty_comparison["coverage"]
    saty_example_coverage = saty_example_context["coverage"]
    saty_example_sanity = saty_example_context["sanity"]
    chart_counts = chart_audit["counts"]
    return f"""# Pre-Hermes Completeness Audit

Scope: final closed-package audit for research-only Hermes review.

## Decision

The package is complete enough for Hermes to produce deterministic, testable research math and rule candidates from the currently available Mancini source text, ES 1m data, generated labels, local feature matrix, gallery evidence, label-recovery review, SATY side-project comparison, and existing docs.

Hermes should not ask for more local work before producing the required JSON. Any weak evidence must be represented as lower confidence, a hard reject, a negative/control label, a sample-size gate, or a validation-plan item.

## Included Evidence

- Training rows: {training_summary['training_row_count']}
- Direct audit rows: {training_summary['input_counts']['direct_source_audit_rows']}
- Feature rows: {scores['input_counts']['feature_rows']}
- Label rows: {scores['input_counts']['label_rows']}
- Hard-rejected rows: {scores['input_counts']['hard_rejected_rows']}
- Unique setups: {scores['input_counts']['unique_setups']}
- Strict direct positive training candidates: {training_summary['direct_audit_positive_training_candidate_count']}
- Real packet gallery SVG files: {training_summary['input_counts']['gallery_svg_files']}
- Real packet gallery PNG files: {training_summary['input_counts']['gallery_png_files']}
- Missing gallery PNG sidecars: {training_summary['input_counts']['gallery_manifest_missing_png_sidecars']}
- Chart audit pass: {str(chart_audit['pass']).lower()}
- Total chart/audit PNG files: {chart_counts['total_png']}

## Label Recovery Coverage

- Source-qualified hard-reject rows reviewed: {recovery_counts['source_qualified_hard_reject_rows']}
- Rows with existing session and level scanned: {recovery_counts['rows_with_existing_session_and_level_scanned']}
- Recovered flush/reclaim rows: {recovery_counts['recovered_flush_reclaim_rows']}
- Recovered non-acceptance rows: {recovery_counts['recovered_non_acceptance_rows']}
- Candidate-eligible rows after recovery: {recovery_counts['candidate_eligible_after_recovery_rows']}
- Candidate-eligible unique setups after recovery: {recovery_counts['candidate_eligible_unique_setups']}

Recovery remains supplemental review evidence. It does not erase the strict direct-audit safety gate and does not promote S/R-list-only rows.

## SATY Side-Project Coverage

- Sessions loaded: {saty_coverage['sessions_loaded']}
- Valid SATY sessions: {saty_coverage['valid_saty_sessions']}
- SATY protocol rows: {saty_coverage['saty_protocol_rows']}

SATY-only rows are geometry controls. They can compare protocol behavior against Mancini-source setups, but they are not positive training examples without Mancini source confirmation.

## Per-Example SATY Prior-Close Context

- Packet examples overlaid: {saty_example_coverage['packet_examples']}
- Valid SATY derivations: {saty_example_coverage['valid_saty_rows']}
- Invalid SATY derivations: {saty_example_coverage['invalid_saty_rows']}
- Prior-close reference rows: {saty_example_coverage['prior_close_reference_rows']}
- SVG context charts: {saty_example_coverage['svg_charts_written']}
- PNG context charts: {saty_example_coverage['png_sidecars_present']}
- Reference-before-target failures: {saty_example_sanity['reference_before_target_failures']}
- Reference-field-not-close failures: {saty_example_sanity['reference_field_not_close_failures']}
- Plan-date/session mismatches: {saty_example_sanity['plan_date_target_session_mismatch_rows']}
- Reference-close mismatch failures: {saty_example_sanity['reference_close_mismatch_failures']}
- SATY session anchor missing rows: {saty_example_sanity['saty_session_anchor_missing_rows']}

Rows with missing SATY session anchors are 17:00-17:59 ET maintenance-gap edge cases and remain review-only context. The per-example overlays use generated prior-close SATY levels for context comparison only; SATY proximity does not promote a row to Mancini source authority.

## Known Limits Already Accounted For

- 1m OHLC cannot prove intraminute order.
- `needs_crop` rows are represented as review labels rather than missing work.
- Some gallery rows have price-only raw-source matches; these are caveats and remain review-only.
- Small family sample sizes are validation gates.
- Future MFE/MAE, hit rates, stop-first, and target hits are labels only.
- Ninja Strategy Analyzer, Playback, and Market Replay are intentionally after Hermes and local deterministic verification.
- The Hermes input directory now includes raw features, labels, training summary, direct audit, handoff, gallery manifest, visual sanity audit, SATY comparison, label recovery, chart audit, and future Ninja shadow telemetry context.

## Required Hermes Behavior

Return the required JSON object. Do not return a blocker that asks Codex/user to gather more files, run Ninja, collect broker data, write Pine/Ninja code, open charts, or do more local preprocessing first.
"""


def source_index_text(training_summary: dict[str, Any], scores: dict[str, Any], files: list[dict[str, Any]]) -> str:
    lines = [
        "# Source File Index",
        "",
        "Scope: source-first Mancini FBD Hermes package.",
        "",
        "## Counts",
        "",
        f"- Direct audit rows: {training_summary['input_counts']['direct_source_audit_rows']}",
        f"- Training rows: {training_summary['training_row_count']}",
        f"- Feature rows: {scores['input_counts']['feature_rows']}",
        f"- Label rows: {scores['input_counts']['label_rows']}",
        f"- Hard-rejected rows: {scores['input_counts']['hard_rejected_rows']}",
        f"- Unique setups: {scores['input_counts']['unique_setups']}",
        f"- Gallery SVG files: {training_summary['input_counts']['gallery_svg_files']}",
        f"- Gallery PNG files: {training_summary['input_counts']['gallery_png_files']}",
        f"- Gallery manifest missing PNG sidecars: {training_summary['input_counts']['gallery_manifest_missing_png_sidecars']}",
        "",
        "## Files",
        "",
    ]
    for item in files:
        lines.append(f"- `{item['path']}`: {item['role']}; bytes={item['bytes']}; sha256={item['sha256']}")
    lines.extend([
        "",
        "## Package Contract",
        "",
        "- The Hermes input directory is a closed package for deterministic research-rule proposal.",
        "- Hermes should return the required JSON even when evidence is weak; weak evidence belongs in confidence, rejects, negative controls, and validation gates.",
        "- Do not ask for more local work, Ninja proof, broker data, Pine code, or extra data collection before producing the requested research JSON.",
        "",
        "## Boundary",
        "",
        "- Ready for Hermes deterministic math review.",
        "- Not Ninja GUI-proofed.",
        "- Ninja Strategy Analyzer / Playback / Market Replay is premature until a rule survives local math validation with adequate sample size and source parity.",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    missing = [str(path) for path in required_inputs() if not path.exists()]
    if missing:
        raise SystemExit("Missing package inputs:\n" + "\n".join(missing))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    training_summary = read_json(TRAINING_SUMMARY)
    scores = read_json(CANDIDATE_RULE_SCORES)
    exact_strategy_grid = read_json(EXACT_STRATEGY_GRID_JSON)
    label_recovery = read_json(LABEL_RECOVERY_SUMMARY)
    saty_comparison = read_json(SATY_COMPARISON)
    saty_example_context = read_json(SATY_EXAMPLE_CONTEXT)
    chart_audit = read_json(CHART_ARTIFACT_AUDIT)
    rows = jsonl_rows(TRAINING_ROWS)
    with OUT_SELECTED_ROWS.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    OUT_PROMPT.write_text(
        prompt_text(training_summary, scores, label_recovery, saty_comparison, saty_example_context, chart_audit),
        encoding="utf-8",
        newline="\n",
    )
    OUT_FEATURE_DICT.write_text(feature_dictionary_text(), encoding="utf-8", newline="\n")
    shutil.copy2(CANDIDATE_RULE_SCORES, OUT_RULE_SCORES)
    shutil.copy2(WALK_FORWARD_REPORT, OUT_WALK_FORWARD)
    shutil.copy2(EXACT_STRATEGY_GRID_CSV, OUT_EXACT_STRATEGY_GRID_CSV)
    shutil.copy2(EXACT_STRATEGY_GRID_JSON, OUT_EXACT_STRATEGY_GRID_JSON)
    shutil.copy2(TRAINING_SUMMARY, OUT_TRAINING_SUMMARY)
    shutil.copy2(FEATURES, OUT_FEATURES)
    shutil.copy2(LABELS, OUT_LABELS)
    shutil.copy2(HANDOFF, OUT_HANDOFF)
    shutil.copy2(DIRECT_AUDIT, OUT_DIRECT_AUDIT)
    shutil.copy2(GALLERY_MANIFEST, OUT_GALLERY_MANIFEST)
    shutil.copy2(VISUAL_AUDIT, OUT_VISUAL_AUDIT)
    shutil.copy2(NINJA_PARITY_SPEC, OUT_NINJA_PARITY_SPEC)
    shutil.copy2(V2_DOC, OUT_V2_DOC)
    shutil.copy2(V3_DOC, OUT_V3_DOC)
    shutil.copy2(STATE_DOC, OUT_STATE_DOC)
    shutil.copy2(LABEL_RECOVERY_SUMMARY, OUT_LABEL_RECOVERY_SUMMARY)
    shutil.copy2(LABEL_RECOVERY_ROWS, OUT_LABEL_RECOVERY_ROWS)
    shutil.copy2(SATY_COMPARISON, OUT_SATY_COMPARISON)
    shutil.copy2(SATY_ROWS, OUT_SATY_ROWS)
    shutil.copy2(SATY_EXAMPLE_CONTEXT, OUT_SATY_EXAMPLE_CONTEXT)
    shutil.copy2(SATY_EXAMPLE_ROWS, OUT_SATY_EXAMPLE_ROWS)
    shutil.copy2(SATY_EXAMPLE_REPORT, OUT_SATY_EXAMPLE_REPORT)
    shutil.copy2(SATY_EXAMPLE_CHART_MANIFEST, OUT_SATY_EXAMPLE_CHART_MANIFEST)
    shutil.copy2(SATY_EXAMPLE_VALIDATION_OUTCOMES, OUT_SATY_EXAMPLE_VALIDATION_OUTCOMES)
    shutil.copy2(CHART_ARTIFACT_AUDIT, OUT_CHART_ARTIFACT_AUDIT)
    OUT_COMPLETENESS_AUDIT.write_text(
        completeness_audit_text(training_summary, scores, label_recovery, saty_comparison, saty_example_context, chart_audit),
        encoding="utf-8",
        newline="\n",
    )

    source_files = [
        file_entry(HANDOFF, "source-of-truth handoff"),
        file_entry(DIRECT_AUDIT, "direct source audit"),
        file_entry(CHECKLIST, "chronological source checklist"),
        file_entry(EVENTS, "Mancini context level universe"),
        file_entry(QUICK_SUMMARY, "quick reclaim acceptance summary"),
        file_entry(QUICK_ROWS, "quick reclaim acceptance rows"),
        file_entry(GALLERY_MANIFEST, "real packet gallery manifest"),
        file_entry(VISUAL_AUDIT, "visual sanity audit"),
        file_entry(CHART_ARTIFACT_AUDIT, "chart artifact audit"),
        file_entry(LABEL_RECOVERY_SUMMARY, "label recovery summary"),
        file_entry(LABEL_RECOVERY_ROWS, "label recovery rows"),
        file_entry(SATY_COMPARISON, "SATY protocol comparison"),
        file_entry(SATY_ROWS, "SATY protocol rows"),
        file_entry(SATY_EXAMPLE_CONTEXT, "per-example SATY prior-close context"),
        file_entry(SATY_EXAMPLE_ROWS, "per-example SATY prior-close rows"),
        file_entry(SATY_EXAMPLE_REPORT, "per-example SATY sanity report"),
        file_entry(SATY_EXAMPLE_CHART_MANIFEST, "per-example SATY chart manifest"),
        file_entry(SATY_EXAMPLE_VALIDATION_OUTCOMES, "per-example SATY labels-only validation outcomes"),
        file_entry(V2_DOC, "prior V2 research context"),
        file_entry(V3_DOC, "prior V3 research context"),
        file_entry(STATE_DOC, "state-machine research context"),
        file_entry(NINJA_PARITY_SPEC, "future Ninja shadow parity context"),
        file_entry(TRAINING_ROWS, "generated source-first training rows"),
        file_entry(FEATURES, "generated deterministic feature matrix"),
        file_entry(LABELS, "generated labels and outcomes"),
        file_entry(EXACT_STRATEGY_GRID_CSV, "generated exact Strategy Analyzer/Playback grid CSV"),
        file_entry(EXACT_STRATEGY_GRID_JSON, "generated exact Strategy Analyzer/Playback grid JSON"),
        file_entry(OUT_SELECTED_ROWS, "Hermes selected training rows"),
        file_entry(OUT_FEATURE_DICT, "Hermes feature dictionary"),
        file_entry(OUT_RULE_SCORES, "Hermes candidate rule scores"),
        file_entry(OUT_WALK_FORWARD, "Hermes walk-forward report"),
        file_entry(OUT_EXACT_STRATEGY_GRID_CSV, "Hermes exact Strategy Analyzer/Playback grid CSV"),
        file_entry(OUT_EXACT_STRATEGY_GRID_JSON, "Hermes exact Strategy Analyzer/Playback grid JSON"),
        file_entry(OUT_TRAINING_SUMMARY, "Hermes training summary"),
        file_entry(OUT_FEATURES, "Hermes deterministic feature matrix"),
        file_entry(OUT_LABELS, "Hermes labels and outcomes"),
        file_entry(OUT_HANDOFF, "Hermes source-of-truth handoff copy"),
        file_entry(OUT_DIRECT_AUDIT, "Hermes direct source audit copy"),
        file_entry(OUT_GALLERY_MANIFEST, "Hermes real packet gallery manifest copy"),
        file_entry(OUT_VISUAL_AUDIT, "Hermes visual sanity audit copy"),
        file_entry(OUT_NINJA_PARITY_SPEC, "Hermes future Ninja shadow parity context copy"),
        file_entry(OUT_V2_DOC, "Hermes V2 research context copy"),
        file_entry(OUT_V3_DOC, "Hermes V3 research context copy"),
        file_entry(OUT_STATE_DOC, "Hermes state-machine context copy"),
        file_entry(OUT_LABEL_RECOVERY_SUMMARY, "Hermes label recovery summary"),
        file_entry(OUT_LABEL_RECOVERY_ROWS, "Hermes label recovery rows"),
        file_entry(OUT_SATY_COMPARISON, "Hermes SATY protocol comparison"),
        file_entry(OUT_SATY_ROWS, "Hermes SATY protocol rows"),
        file_entry(OUT_SATY_EXAMPLE_CONTEXT, "Hermes per-example SATY prior-close context"),
        file_entry(OUT_SATY_EXAMPLE_ROWS, "Hermes per-example SATY prior-close rows"),
        file_entry(OUT_SATY_EXAMPLE_REPORT, "Hermes per-example SATY sanity report"),
        file_entry(OUT_SATY_EXAMPLE_CHART_MANIFEST, "Hermes per-example SATY chart manifest"),
        file_entry(OUT_SATY_EXAMPLE_VALIDATION_OUTCOMES, "Hermes per-example SATY labels-only validation outcomes"),
        file_entry(OUT_NINJA_SHADOW_STUDY, "NinjaTrader shadow-only telemetry study artifact"),
        file_entry(OUT_FLAGSHIP_RESULT, "flagship deterministic research math JSON"),
        file_entry(OUT_FINAL_HERMES_AUDIT_PROMPT, "Final Hermes audit prompt for flagship JSON and package"),
        file_entry(OUT_NINJATRADER_SHADOW_AUDIT_PROMPT, "NinjaTrader shadow audit prompt"),
        file_entry(OUT_MORNING_SANITY_REPORT, "Morning sanity report for package handoff"),
        file_entry(OUT_EXECUTIVE_REPORT_HTML, "Human-friendly executive report HTML"),
        file_entry(OUT_EXECUTIVE_REPORT_PDF, "Human-friendly executive report PDF"),
        file_entry(OUT_EXECUTIVE_REPORT_PNG, "Human-friendly executive report PNG preview"),
        file_entry(OUT_BUILD_CANDIDATE_REPORT_HTML, "Human-readable build candidate audit and roadmap HTML"),
        file_entry(OUT_BUILD_CANDIDATE_REPORT_PDF, "Human-readable build candidate audit and roadmap PDF"),
        file_entry(OUT_BUILD_CANDIDATE_REPORT_PNG, "Human-readable build candidate audit and roadmap PNG preview"),
        file_entry(OUT_CHART_ARTIFACT_AUDIT, "Hermes chart artifact audit"),
        file_entry(OUT_COMPLETENESS_AUDIT, "Hermes completeness audit"),
        file_entry(OUT_PROMPT, "Hermes prompt"),
    ]
    OUT_SOURCE_INDEX.write_text(source_index_text(training_summary, scores, source_files), encoding="utf-8", newline="\n")
    source_files.append(file_entry(OUT_SOURCE_INDEX, "Hermes source file index"))
    outputs = {
        "HERMES_PROMPT": rel(OUT_PROMPT),
        "manifest": rel(OUT_MANIFEST),
        "selected_training_rows": rel(OUT_SELECTED_ROWS),
        "feature_dictionary": rel(OUT_FEATURE_DICT),
        "candidate_rule_scores": rel(OUT_RULE_SCORES),
        "walk_forward_report": rel(OUT_WALK_FORWARD),
        "exact_strategy_grid_csv": rel(OUT_EXACT_STRATEGY_GRID_CSV),
        "exact_strategy_grid_json": rel(OUT_EXACT_STRATEGY_GRID_JSON),
        "training_summary": rel(OUT_TRAINING_SUMMARY),
        "features": rel(OUT_FEATURES),
        "labels": rel(OUT_LABELS),
        "handoff": rel(OUT_HANDOFF),
        "direct_source_audit": rel(OUT_DIRECT_AUDIT),
        "real_packet_gallery_manifest": rel(OUT_GALLERY_MANIFEST),
        "visual_sanity_audit": rel(OUT_VISUAL_AUDIT),
        "ninja_shadow_parity_spec": rel(OUT_NINJA_PARITY_SPEC),
        "v2_research_context": rel(OUT_V2_DOC),
        "v3_research_context": rel(OUT_V3_DOC),
        "state_machine_context": rel(OUT_STATE_DOC),
        "label_recovery_summary": rel(OUT_LABEL_RECOVERY_SUMMARY),
        "recovered_label_rows": rel(OUT_LABEL_RECOVERY_ROWS),
        "saty_protocol_comparison": rel(OUT_SATY_COMPARISON),
        "saty_protocol_rows": rel(OUT_SATY_ROWS),
        "example_saty_context": rel(OUT_SATY_EXAMPLE_CONTEXT),
        "example_saty_rows": rel(OUT_SATY_EXAMPLE_ROWS),
        "example_saty_report": rel(OUT_SATY_EXAMPLE_REPORT),
        "example_saty_chart_manifest": rel(OUT_SATY_EXAMPLE_CHART_MANIFEST),
        "example_saty_validation_outcomes": rel(OUT_SATY_EXAMPLE_VALIDATION_OUTCOMES),
        "ninja_shadow_study": rel(OUT_NINJA_SHADOW_STUDY),
        "flagship_result": rel(OUT_FLAGSHIP_RESULT),
        "final_hermes_audit_prompt": rel(OUT_FINAL_HERMES_AUDIT_PROMPT),
        "ninjatrader_shadow_audit_prompt": rel(OUT_NINJATRADER_SHADOW_AUDIT_PROMPT),
        "morning_sanity_report": rel(OUT_MORNING_SANITY_REPORT),
        "executive_report_html": rel(OUT_EXECUTIVE_REPORT_HTML),
        "executive_report_pdf": rel(OUT_EXECUTIVE_REPORT_PDF),
        "executive_report_png": rel(OUT_EXECUTIVE_REPORT_PNG),
        "build_candidate_report_html": rel(OUT_BUILD_CANDIDATE_REPORT_HTML),
        "build_candidate_report_pdf": rel(OUT_BUILD_CANDIDATE_REPORT_PDF),
        "build_candidate_report_png": rel(OUT_BUILD_CANDIDATE_REPORT_PNG),
        "chart_artifact_audit": rel(OUT_CHART_ARTIFACT_AUDIT),
        "pre_hermes_completeness_audit": rel(OUT_COMPLETENESS_AUDIT),
        "source_file_index": rel(OUT_SOURCE_INDEX),
    }
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "research_historical_replay_shadow_only",
        "status": "ready_for_hermes",
        "selected_training_rows": len(rows),
        "counts": {
            "direct_audit_rows": training_summary["input_counts"]["direct_source_audit_rows"],
            "direct_audit_source_label_counts": training_summary.get("direct_audit_source_label_counts", {}),
            "training_rows": training_summary["training_row_count"],
            "feature_rows": scores["input_counts"]["feature_rows"],
            "label_rows": scores["input_counts"]["label_rows"],
            "training_label_counts": training_summary.get("label_counts", {}),
            "hard_rejected_rows": scores["input_counts"]["hard_rejected_rows"],
            "unique_setups": scores["input_counts"]["unique_setups"],
            "exact_strategy_grid_rows": len(exact_strategy_grid.get("rows", [])),
            "strict_positive_training_candidate_rows": training_summary["direct_audit_positive_training_candidate_count"],
            "gallery_svg_files": training_summary["input_counts"]["gallery_svg_files"],
            "gallery_png_files": training_summary["input_counts"]["gallery_png_files"],
            "gallery_manifest_missing_png_sidecars": training_summary["input_counts"]["gallery_manifest_missing_png_sidecars"],
            "label_recovery_candidate_eligible_rows": label_recovery["counts"]["candidate_eligible_after_recovery_rows"],
            "label_recovery_candidate_eligible_unique_setups": label_recovery["counts"]["candidate_eligible_unique_setups"],
            "label_recovery_recovered_flush_reclaim_rows": label_recovery["counts"]["recovered_flush_reclaim_rows"],
            "saty_protocol_rows": saty_comparison["coverage"]["saty_protocol_rows"],
            "saty_valid_sessions": saty_comparison["coverage"]["valid_saty_sessions"],
            "example_saty_packet_examples": saty_example_context["coverage"]["packet_examples"],
            "example_saty_valid_derivations": saty_example_context["coverage"]["valid_saty_rows"],
            "example_saty_invalid_derivations": saty_example_context["coverage"]["invalid_saty_rows"],
            "example_saty_prior_close_reference_rows": saty_example_context["coverage"]["prior_close_reference_rows"],
            "example_saty_svg_charts": saty_example_context["coverage"]["svg_charts_written"],
            "example_saty_png_charts": saty_example_context["coverage"]["png_sidecars_present"],
            "example_saty_anchor_missing_rows": saty_example_context["sanity"]["saty_session_anchor_missing_rows"],
            "example_saty_validation_outcome_label_rows": saty_example_context["coverage"].get("validation_outcome_label_rows", 0),
            "chart_artifact_audit_pass": chart_audit["pass"],
            "chart_artifact_total_png": chart_audit["counts"]["total_png"],
        },
        "safety": {
            "live_trading_behavior_introduced": False,
            "broker_risk_live_pine_credential_execution_touched": False,
            "sr_list_only_promoted_to_positive": False,
            "data_only_promoted_to_positive": False,
            "ninja_gui_proof_claimed": False,
            "package_complete_for_research_math_review": True,
            "hermes_should_not_request_more_local_preprocessing": True,
        },
        "outputs": outputs,
        "files": source_files,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "ready_for_hermes",
        "package_dir": rel(OUT_DIR),
        "selected_training_rows": len(rows),
        "outputs": outputs,
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
