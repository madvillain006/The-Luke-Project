#!/usr/bin/env python3
"""Audit Mancini chart images for visual-training suitability.

This is a market-structure sanity pass, not a strategy backtest. It flags
generated images that are risky as OCR/training examples when the crop window
does not visibly teach the Mancini fake-breakdown idea.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "artifacts/research/mancini-real-packet-gallery/manifest.json"
OUT_DIR = ROOT / "artifacts/research/mancini-visual-sanity-audit"


REVIEWED_PACKET_IDS = {
    "mancini-es1m:2026-05-04T1111:7205.0:53db965edf54": "viewed_7205_quick_reclaim",
    "mancini-es1m:2026-05-04T1120:7212.0:3aa4c0792b84": "viewed_7212_major_failed_breakdown_zone",
    "mancini-es1m:2026-05-07T1237:7355.0:3a8cb95abc7c": "viewed_7355_defend_7345_recover_7355",
    "mancini-es1m:2026-05-07T1118:7369.0:4e3777c6272c": "viewed_7369_first_support_caution",
}


HARD_DEMOTE_PACKET_IDS = {
    "mancini-es1m:2026-05-05T0717:7266.0:91f893b01585": "quant_agent_demote_late_elevator_context_not_clean_accumulation",
    "mancini-es1m:2026-05-07T1237:7355.0:3a8cb95abc7c": "quant_agent_demote_late_reclaim_rolls_back_through_level",
    "mancini-es1m:2026-05-07T1118:7369.0:4e3777c6272c": "quant_agent_demote_first_support_desperation_caution",
    "mancini-es1m:2026-03-18T0933:6673.0:3968093a577f": "quant_agent_demote_last_ditch_support_immediate_failure_risk",
    "mancini-es1m:2026-04-21T1009:7125.0:f658c3c64aec": "price_action_audit_reclaim_not_durable_negative_control",
}


FORCE_REVIEW_ONLY_PACKET_IDS = {
    "mancini-es1m:2026-04-05T1958:6608.0:ba0d8c969158": "price_action_audit_shallow_chop_data_only",
    "mancini-es1m:2026-04-23T1256:7097.0:30dca8a80e9c": "price_action_audit_missing_prior_day_shelf_context_data_only",
}


SOURCE_CONTEXT_FLAG_PACKET_IDS = {
    "mancini-es1m:2026-04-28T0734:7149.0:2b460ce02af9",
    "mancini-es1m:2026-04-29T1718:7186.0:88c265e86f37",
    "mancini-es1m:2026-04-29T1719:7188.0:27f9c20985cb",
    "mancini-es1m:2026-04-30T1233:7213.0:532a03df99ad",
    "mancini-es1m:2026-04-30T1233:7214.0:08789e63503b",
    "mancini-es1m:2026-04-30T1249:7221.0:97231e7109c1",
    "mancini-es1m:2026-04-30T1333:7234.0:3c00cd0b2ac2",
    "mancini-es1m:2026-04-30T1414:7244.0:9e791381d366",
    "mancini-es1m:2026-04-30T1825:7252.0:74a393d62e09",
    "mancini-es1m:2026-05-01T0834:7267.0:a3d3e3c826de",
    "mancini-es1m:2026-05-04T0721:7252.0:69e875eda5ec",
    "mancini-es1m:2026-05-05T0830:7267.0:bfed98aa1b3b",
}


HIGH_RISK_LATE_WEAK_SOURCE_INDEXES = {
    7, 10, 21, 38, 42, 48, 49, 51, 52, 53, 55, 66, 69, 73, 75,
    77, 80, 86, 88, 90, 91, 111, 130, 152, 155, 156, 158, 171,
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def as_float(value: Any) -> float | None:
    try:
        if value is None or str(value).strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def load_window(path_text: str) -> list[dict[str, Any]]:
    path = Path(path_text)
    if not path.is_absolute():
        path = ROOT / path
    rows = []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            rows.append({
                "timestamp": row.get("timestamp_et") or "",
                "open": as_float(row.get("open")) or 0.0,
                "high": as_float(row.get("high")) or 0.0,
                "low": as_float(row.get("low")) or 0.0,
                "close": as_float(row.get("close")) or 0.0,
                "volume": as_float(row.get("volume")) or 0.0,
            })
    return rows


def find_index(bars: list[dict[str, Any]], timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    for index, bar in enumerate(bars):
        if bar["timestamp"] == timestamp:
            return index
    return None


def consecutive_closes_above(bars: list[dict[str, Any]], start_index: int, level: float) -> int:
    count = 0
    for bar in bars[start_index:]:
        if bar["close"] > level:
            count += 1
        else:
            break
    return count


def count_prior_level_tests(bars: list[dict[str, Any]], trap_index: int, level: float, tolerance: float = 1.0) -> int:
    tests = 0
    for bar in bars[:trap_index]:
        if abs(bar["low"] - level) <= tolerance or abs(bar["close"] - level) <= tolerance:
            tests += 1
        elif bar["low"] <= level <= bar["high"]:
            tests += 1
    return tests


def immediate_failure_after_reclaim(bars: list[dict[str, Any]], reclaim_index: int, level: float, lookahead: int = 5) -> bool:
    for bar in bars[reclaim_index + 1: reclaim_index + 1 + lookahead]:
        if bar["close"] < level:
            return True
    return False


def post_reclaim_mae_mfe(bars: list[dict[str, Any]], reclaim_index: int, level: float, lookahead: int = 15) -> tuple[float, float]:
    future = bars[reclaim_index: reclaim_index + lookahead + 1]
    if not future:
        return 0.0, 0.0
    mfe = max(bar["high"] - level for bar in future)
    mae = max(level - bar["low"] for bar in future)
    return round(mfe, 2), round(mae, 2)


def audit_row(row: dict[str, Any]) -> dict[str, Any]:
    packet_id = row.get("packet_id")
    level = as_float(row.get("level")) or 0.0
    bars = load_window(row.get("window_csv") or "")
    trap_index = find_index(bars, row.get("trap_candle_timestamp_et"))
    reclaim_index = find_index(bars, row.get("first_reclaim_close_timestamp_et"))
    accepted = row.get("accepted_for_timing_test") is True
    family = row.get("acceptance_family") or "missing"
    explicitness = row.get("mancini_explicitness") or "missing"
    raw_quality = (row.get("raw_mancini_source") or {}).get("match_quality") or "missing"
    event_fields = row.get("event_fields") or {}
    primary_role = event_fields.get("primary_role") or ""
    trigger_validation = row.get("trigger_validation") or {}
    trigger_status = trigger_validation.get("status") or "missing_trigger_validation"

    reasons: list[str] = []
    caution_notes: list[str] = []
    if trigger_status != "validated_replay_trigger_candidate":
        reasons.append(f"trigger_validation_{trigger_status}")
        for reason in trigger_validation.get("reasons") or []:
            reasons.append(f"trigger_reason_{reason}")
    if not accepted:
        reasons.append("excluded_from_timing_stats")
    if packet_id in HARD_DEMOTE_PACKET_IDS:
        reasons.append(HARD_DEMOTE_PACKET_IDS[packet_id])
    if packet_id in FORCE_REVIEW_ONLY_PACKET_IDS:
        caution_notes.append(FORCE_REVIEW_ONLY_PACKET_IDS[packet_id])
    if packet_id in SOURCE_CONTEXT_FLAG_PACKET_IDS:
        reasons.append("source_text_is_target_or_context_not_failed_breakdown_proof")
    try:
        chart_index = int(str(row.get("png_path") or "").split("\\")[-1].split("_", 1)[0])
    except (ValueError, IndexError):
        chart_index = None
    if chart_index in HIGH_RISK_LATE_WEAK_SOURCE_INDEXES:
        reasons.append("quant_agent_high_risk_late_or_weak_source_subset")
    if family == "unmeasurable":
        reasons.append("unmeasurable_family")
    if family == "simple_reclaim_unclassified":
        caution_notes.append("unclassified_reclaim_not_a_clean_mancini_family")
    if accepted and explicitness == "support_resistance_list":
        reasons.append("support_resistance_list_only_not_training_proof")
    if primary_role == "FIRST_SUPPORT_CAUTION":
        reasons.append("mancini_first_support_caution")
    if raw_quality == "price_only":
        reasons.append("weak_raw_price_only_provenance")
    elif raw_quality in {"price_and_role", "partial_snippet"}:
        caution_notes.append(f"raw_source_match_quality_{raw_quality}")

    if trap_index is None:
        reasons.append("trap_candle_not_visible")
        trap_index = 0
    if reclaim_index is None:
        reasons.append("reclaim_bar_not_visible")
        reclaim_index = trap_index
    if reclaim_index <= trap_index:
        reasons.append("reclaim_not_after_trap_in_crop")

    pre_bars = trap_index
    post_bars = max(0, len(bars) - reclaim_index - 1)
    prior_tests = count_prior_level_tests(bars, trap_index, level)
    acceptance_closes_visible = consecutive_closes_above(bars, reclaim_index, level)
    immediate_failure = immediate_failure_after_reclaim(bars, reclaim_index, level)
    post_mfe, post_mae = post_reclaim_mae_mfe(bars, reclaim_index, level)

    if pre_bars < 5:
        caution_notes.append("limited_pre_trap_context_in_crop")
    if post_bars < 5:
        caution_notes.append("limited_post_reclaim_context_in_crop")
    if prior_tests < 2:
        caution_notes.append("prior_shelf_or_cluster_not_visible_in_crop")
    if acceptance_closes_visible < 2:
        reasons.append("weak_visible_acceptance_after_reclaim")
    if immediate_failure:
        reasons.append("closed_back_below_level_soon_after_reclaim")
    if post_mae > post_mfe and family != "simple_reclaim_unclassified":
        reasons.append("post_reclaim_adverse_excursion_exceeds_favorable_move")

    strong_source = explicitness == "explicit_mancini_narrative" and raw_quality in {"exact_snippet", "partial_snippet"}
    visible_structure = prior_tests >= 2 and pre_bars >= 5 and post_bars >= 5 and acceptance_closes_visible >= 3
    if reasons:
        status = "dangerous_demote_for_training"
    elif strong_source and visible_structure:
        status = "training_candidate"
    elif visible_structure:
        status = "review_only_context"
    else:
        status = "insufficient_visual_context"

    if packet_id in FORCE_REVIEW_ONLY_PACKET_IDS and status == "training_candidate":
        status = "review_only_context"

    if row.get("packet_id") in REVIEWED_PACKET_IDS and status == "training_candidate":
        # The manually inspected examples need stricter handling because they
        # were already observed to be easy to misread without broader context.
        status = "review_only_context"
        caution_notes.append("manually_viewed_demoted_from_training_until_user_confirms")

    return {
        "packet_id": packet_id,
        "png_path": row.get("png_path"),
        "level": level,
        "status": status,
        "acceptance_family": family,
        "mancini_explicitness": explicitness,
        "raw_match_quality": raw_quality,
        "primary_role": primary_role,
        "accepted_for_timing_test": accepted,
        "trigger_validation_status": trigger_status,
        "trigger_validation_reasons": trigger_validation.get("reasons") or [],
        "pre_trap_bars": pre_bars,
        "post_reclaim_bars": post_bars,
        "prior_visible_level_tests": prior_tests,
        "visible_acceptance_closes": acceptance_closes_visible,
        "post_reclaim_mfe_from_level": post_mfe,
        "post_reclaim_mae_from_level": post_mae,
        "immediate_failure_after_reclaim": immediate_failure,
        "reasons": reasons,
        "caution_notes": caution_notes,
        "manual_review_label": REVIEWED_PACKET_IDS.get(packet_id),
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = [
        "packet_id", "png_path", "level", "status", "acceptance_family", "mancini_explicitness",
        "raw_match_quality", "primary_role", "accepted_for_timing_test", "trigger_validation_status",
        "trigger_validation_reasons", "pre_trap_bars",
        "post_reclaim_bars", "prior_visible_level_tests", "visible_acceptance_closes",
        "post_reclaim_mfe_from_level", "post_reclaim_mae_from_level", "immediate_failure_after_reclaim",
        "reasons", "caution_notes", "manual_review_label",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            out = dict(row)
            out["reasons"] = ";".join(row["reasons"])
            out["caution_notes"] = ";".join(row["caution_notes"])
            out["trigger_validation_reasons"] = ";".join(row["trigger_validation_reasons"])
            writer.writerow(out)


def write_report(rows: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    demoted = [row for row in rows if row["status"] == "dangerous_demote_for_training"]
    candidates = [row for row in rows if row["status"] == "training_candidate"]
    reviewed = [row for row in rows if row.get("manual_review_label")]
    lines = [
        "# Mancini Visual Training Sanity Audit",
        "",
        "Research-only. This does not validate a strategy. It only checks whether generated charts are safe teaching/OCR examples.",
        "",
        "## Counts",
        "",
    ]
    for key, value in summary["status_counts"].items():
        lines.append(f"- {key}: {value}")
    lines.extend([
        "",
        "## Acceptable Training Example Criteria",
        "",
        "- Mancini source text must be explicit, not only a support/resistance list.",
        "- Trigger validation must pass; heuristic family labels are not enough.",
        "- Raw source match should be exact or partial snippet, not price-only.",
        "- Crop should visibly include prior shelf/cluster or repeated level interaction.",
        "- Trap candle must occur before reclaim in the crop.",
        "- Reclaim should show visible acceptance and should not immediately close back below the level.",
        "- First-support caution rows and timing-excluded rows are not generic training examples.",
        "",
        "## Manually Viewed Examples",
        "",
    ])
    for row in reviewed:
        lines.append(f"- `{row['manual_review_label']}` `{row['packet_id']}` -> `{row['status']}`; reasons={row['reasons']}; cautions={row['caution_notes']}; image=`{row['png_path']}`")
    lines.extend([
        "",
        "## Top Candidate Examples",
        "",
    ])
    for row in candidates[:20]:
        lines.append(f"- `{row['packet_id']}` family={row['acceptance_family']} level={row['level']} image=`{row['png_path']}`")
    lines.extend([
        "",
        "## First Demotions",
        "",
    ])
    for row in demoted[:30]:
        lines.append(f"- `{row['packet_id']}` status=`{row['status']}` reasons={row['reasons']} image=`{row['png_path']}`")
    (OUT_DIR / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_json(GALLERY)
    rows = [audit_row(row) for row in manifest]
    status_counts = Counter(row["status"] for row in rows)
    reason_counts = Counter(reason for row in rows for reason in row["reasons"])
    summary = {
        "review_only": True,
        "trading_authority": "none",
        "rows": len(rows),
        "status_counts": dict(sorted(status_counts.items())),
        "reason_counts": dict(sorted(reason_counts.items())),
        "training_candidate_count": status_counts.get("training_candidate", 0),
        "dangerous_demote_count": status_counts.get("dangerous_demote_for_training", 0),
        "manual_reviewed_packet_ids": REVIEWED_PACKET_IDS,
    }
    (OUT_DIR / "visual_sanity_audit.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=2, sort_keys=True), encoding="utf-8")
    write_csv(OUT_DIR / "visual_sanity_audit.csv", rows)
    write_csv(OUT_DIR / "training_candidates.csv", [row for row in rows if row["status"] == "training_candidate"])
    write_csv(OUT_DIR / "dangerous_demotions.csv", [row for row in rows if row["status"] == "dangerous_demote_for_training"])
    write_report(rows, summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
