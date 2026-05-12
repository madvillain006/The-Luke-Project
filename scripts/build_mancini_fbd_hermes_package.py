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

OUT_DIR = ROOT / "artifacts/research/mancini-fbd-hermes-input"
OUT_PROMPT = OUT_DIR / "HERMES_PROMPT.md"
OUT_MANIFEST = OUT_DIR / "manifest.json"
OUT_SELECTED_ROWS = OUT_DIR / "selected_training_rows.jsonl"
OUT_FEATURE_DICT = OUT_DIR / "feature_dictionary.md"
OUT_RULE_SCORES = OUT_DIR / "candidate_rule_scores.json"
OUT_WALK_FORWARD = OUT_DIR / "walk_forward_report.md"
OUT_SOURCE_INDEX = OUT_DIR / "source_file_index.md"


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
    ]


def prompt_text(training_summary: dict[str, Any], scores: dict[str, Any]) -> str:
    counts = training_summary["input_counts"]
    labels = training_summary["label_counts"]
    math_counts = scores["input_counts"]
    return f"""# Hermes Prompt: Mancini Fake-Breakdown Algorithm Math

You are reviewing a research-only ES fake-breakdown / failed-breakdown package based on Mancini source text plus local ES 1m data. Do not create live trading instructions. Do not create NinjaTrader code first. Do not assume support/resistance-list-only rows are positive examples.

Goal: propose deterministic, testable math and rule candidates that Codex can verify locally before any NinjaTrader Strategy Analyzer, Playback, or Market Replay work.

Safety boundary:
- Research, historical, replay, and shadow only.
- No live trading behavior.
- Do not touch or route broker accounts, credentials, Pine, live execution, risk checks, kill switches, order validation, or position sizing.
- Hermes may propose math, but local artifacts and replay must verify it.
- Support/resistance-list-only rows remain negative/control/context rows unless direct source and chart evidence prove otherwise.

Important current safety-gate fact:
- The strict direct audit has 0 `positive_training_candidate` rows.
- That is a safety-gate result, not proof the pattern is absent.
- Build broader review labels from `source_confirmed_fbd`, `source_planned_fbd`, `chart_confirmed_reclaim`, `chart_confirmed_non_acceptance`, `source_negative_control`, `sr_list_only`, `chart_mismatch`, `needs_crop`, and `data_only`.

Current local counts:
- Direct audit rows: {counts["direct_source_audit_rows"]}
- Context events: {counts["events_rows"]}
- Packet rows: {counts["quick_reclaim_rows"]}
- Training rows: {training_summary["training_row_count"]}
- Feature rows: {math_counts["feature_rows"]}
- Hard-rejected feature rows: {math_counts["hard_rejected_rows"]}
- Unique setups: {math_counts["unique_setups"]}
- Real packet gallery SVG files: {counts["gallery_svg_files"]}
- Real packet gallery PNG files: {counts["gallery_png_files"]}
- Missing gallery PNG sidecars from manifest: {counts["gallery_manifest_missing_png_sidecars"]}

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

Use these package files:
1. `selected_training_rows.jsonl`
2. `feature_dictionary.md`
3. `candidate_rule_scores.json`
4. `walk_forward_report.md`
5. `source_file_index.md`

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
"""


def feature_dictionary_text() -> str:
    return """# Feature Dictionary

Scope: deterministic offline research features for Mancini FBD review. Candidate scoring avoids future outcome labels.

## Source Fields

- `training_row_id`: Stable local row id.
- `row_origin`: `direct_source_audit` or `packet_observation`.
- `raw_file`, `line`, `plan_date`, `pub_date`, `source_quote`: Mancini source provenance.
- `source_mode`: Source mode from direct audit or packet context.
- `source_confidence_score`: Source-first confidence. Negative controls score 0, support/resistance list-only rows score 0.20, direct actual recaps can score up to 1.0.
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
- `data_only`: Context row, not a training positive.

## Deterministic Feature Math

- `significant_low_score`: Prior touches, prior hold time, prior bounce points, and major-source bonus.
- `flush_score`: Flush depth, approach velocity, multi-level flush count, and trap-bar volume ratio.
- `reclaim_score`: Close above level, reclaim close location, acceptance closes, no immediate close back below, and reclaim range.
- `non_acceptance_score`: No-lookahead threshold/hold/retest score. The 15m MAE outcome gate is excluded from candidate scoring.
- `non_acceptance_score_with_outcome_audit`: Full audit score with the 15m MAE gate included for analysis only.
- `squeeze_score`: Target room, target R, trusted source level, no nearby overhead level, and time-of-day bonus.
- `candidate_score`: `0.25 significant_low + 0.20 flush + 0.25 max(reclaim, non_acceptance_no_lookahead) + 0.20 squeeze + 0.10 source_confidence`.

## Outcome Labels

- `mfe_15m`, `mae_15m`, `mfe_60m`, `mae_60m`: Labels only.
- `tp2_hit`, `tp3_hit`, `next_level_hit`, `stop_first`, `false_armed`: Validation labels only.
- `expectancy_points_slippage_0_5`: Outcome label using 0.5 ES point round-trip slippage.
"""


def source_index_text(training_summary: dict[str, Any], scores: dict[str, Any], files: list[dict[str, Any]]) -> str:
    lines = [
        "# Source File Index",
        "",
        "Scope: source-first Mancini FBD Hermes package.",
        "",
        "## Counts",
        "",
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
    rows = jsonl_rows(TRAINING_ROWS)
    with OUT_SELECTED_ROWS.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    OUT_PROMPT.write_text(prompt_text(training_summary, scores), encoding="utf-8", newline="\n")
    OUT_FEATURE_DICT.write_text(feature_dictionary_text(), encoding="utf-8", newline="\n")
    shutil.copy2(CANDIDATE_RULE_SCORES, OUT_RULE_SCORES)
    shutil.copy2(WALK_FORWARD_REPORT, OUT_WALK_FORWARD)

    source_files = [
        file_entry(HANDOFF, "source-of-truth handoff"),
        file_entry(DIRECT_AUDIT, "direct source audit"),
        file_entry(CHECKLIST, "chronological source checklist"),
        file_entry(EVENTS, "Mancini context level universe"),
        file_entry(QUICK_SUMMARY, "quick reclaim acceptance summary"),
        file_entry(QUICK_ROWS, "quick reclaim acceptance rows"),
        file_entry(GALLERY_MANIFEST, "real packet gallery manifest"),
        file_entry(VISUAL_AUDIT, "visual sanity audit"),
        file_entry(V2_DOC, "prior V2 research context"),
        file_entry(V3_DOC, "prior V3 research context"),
        file_entry(STATE_DOC, "state-machine research context"),
        file_entry(NINJA_PARITY_SPEC, "future Ninja shadow parity context"),
        file_entry(TRAINING_ROWS, "generated source-first training rows"),
        file_entry(FEATURES, "generated deterministic feature matrix"),
        file_entry(LABELS, "generated labels and outcomes"),
        file_entry(OUT_SELECTED_ROWS, "Hermes selected training rows"),
        file_entry(OUT_FEATURE_DICT, "Hermes feature dictionary"),
        file_entry(OUT_RULE_SCORES, "Hermes candidate rule scores"),
        file_entry(OUT_WALK_FORWARD, "Hermes walk-forward report"),
        file_entry(OUT_PROMPT, "Hermes prompt"),
    ]
    OUT_SOURCE_INDEX.write_text(source_index_text(training_summary, scores, source_files), encoding="utf-8", newline="\n")
    source_files.append(file_entry(OUT_SOURCE_INDEX, "Hermes source file index"))
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "research_historical_replay_shadow_only",
        "status": "ready_for_hermes",
        "selected_training_rows": len(rows),
        "counts": {
            "training_rows": training_summary["training_row_count"],
            "feature_rows": scores["input_counts"]["feature_rows"],
            "label_rows": scores["input_counts"]["label_rows"],
            "hard_rejected_rows": scores["input_counts"]["hard_rejected_rows"],
            "unique_setups": scores["input_counts"]["unique_setups"],
            "strict_positive_training_candidate_rows": training_summary["direct_audit_positive_training_candidate_count"],
            "gallery_svg_files": training_summary["input_counts"]["gallery_svg_files"],
            "gallery_png_files": training_summary["input_counts"]["gallery_png_files"],
            "gallery_manifest_missing_png_sidecars": training_summary["input_counts"]["gallery_manifest_missing_png_sidecars"],
        },
        "safety": {
            "live_trading_behavior_introduced": False,
            "broker_risk_live_pine_credential_execution_touched": False,
            "sr_list_only_promoted_to_positive": False,
            "ninja_gui_proof_claimed": False,
        },
        "files": source_files,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "ready_for_hermes",
        "package_dir": rel(OUT_DIR),
        "selected_training_rows": len(rows),
        "outputs": {
            "HERMES_PROMPT": rel(OUT_PROMPT),
            "manifest": rel(OUT_MANIFEST),
            "selected_training_rows": rel(OUT_SELECTED_ROWS),
            "feature_dictionary": rel(OUT_FEATURE_DICT),
            "candidate_rule_scores": rel(OUT_RULE_SCORES),
            "walk_forward_report": rel(OUT_WALK_FORWARD),
            "source_file_index": rel(OUT_SOURCE_INDEX),
        },
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
