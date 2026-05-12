#!/usr/bin/env python3
"""Build a source-first Mancini failed-breakdown algorithm training table.

Offline research only. This script reads existing Mancini source/corpus
artifacts and emits review labels for later deterministic math work. It does
not touch NinjaTrader, Pine, broker, risk, credential, runtime, or execution
paths.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

DIRECT_AUDIT = ROOT / "artifacts/research/mancini-direct-fbd-source-audit/direct_fbd_source_audit.json"
CHRONO_CHECKLIST = ROOT / "reports/mancini-fbd-chronological-canonical-checklist-2026-05-12.md"
EVENTS_CSV = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
QUICK_SUMMARY = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_summary.json"
QUICK_ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
GALLERY_MANIFEST = ROOT / "artifacts/research/mancini-real-packet-gallery/manifest.json"
VISUAL_AUDIT = ROOT / "artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json"
SESSIONS_DIR = ROOT / "data/backtest/es-long-bracket/sessions"
NINJA_STRATEGY = ROOT / "NinjaTrader/LukeNativeShadowStrategy.cs"

OUT_DIR = ROOT / "artifacts/research/mancini-fbd-algo-training-table"
OUT_JSONL = OUT_DIR / "training_rows.jsonl"
OUT_CSV = OUT_DIR / "training_rows.csv"
OUT_SUMMARY_JSON = OUT_DIR / "summary.json"
OUT_SUMMARY_MD = OUT_DIR / "summary.md"

LABEL_FIELDS = [
    "source_confirmed_fbd",
    "source_planned_fbd",
    "source_negative_control",
    "sr_list_only",
    "chart_confirmed_reclaim",
    "chart_confirmed_non_acceptance",
    "chart_mismatch",
    "needs_crop",
    "data_only",
]

REQUIRED_FIELD_ORDER = [
    "training_row_id",
    "row_origin",
    "raw_file",
    "line",
    "plan_date",
    "pub_date",
    "source_quote",
    "setup_level",
    "swept_low",
    "recovered_level",
    "non_acceptance_threshold",
    "invalidation_level",
    "target_or_response_level",
    "source_mode",
    "source_confidence_score",
    "level_role_map",
    "sr_coincidence",
    "chart_path",
    "png_path",
    "window_csv",
    "visual_sanity_status",
    "blockers",
    "es_window_available",
    "session_date",
    "bars_available",
    "packet_id",
    "acceptance_family",
    *LABEL_FIELDS,
]


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def rel(path: Path | str | None) -> str:
    if not path:
        return ""
    p = Path(path)
    if not p.is_absolute():
        return str(p)
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def root_path(path: str | None) -> Path | None:
    if not path:
        return None
    p = Path(path)
    if p.is_absolute():
        return p
    return ROOT / p


def compact_json(value: Any) -> str:
    if value in (None, ""):
        return ""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def source_hash(parts: list[Any]) -> str:
    raw = compact_json(parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def lower_text(*values: Any) -> str:
    return " ".join(str(v or "") for v in values).lower()


def first_number(values: Any) -> float | None:
    if isinstance(values, list) and values:
        return as_float(values[0])
    return as_float(values)


def load_session_index() -> dict[str, dict[str, Any]]:
    sessions: dict[str, dict[str, Any]] = {}
    if not SESSIONS_DIR.exists():
        return sessions
    for path in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            data = read_json(path)
        except json.JSONDecodeError:
            continue
        if data.get("example"):
            continue
        bars = data.get("bars") if isinstance(data, dict) else {}
        es_bars = bars.get("es") if isinstance(bars, dict) else []
        date = str(data.get("date") or path.stem)
        sessions[date] = {
            "path": rel(path),
            "date": date,
            "usable": bool(data.get("usable")),
            "excluded_reason": data.get("excludedReason") or "",
            "es_bar_count": len(es_bars) if isinstance(es_bars, list) else 0,
            "overnight_bar_count": len(bars.get("overnight") or []) if isinstance(bars, dict) else 0,
            "rth_bar_count": len(bars.get("rth") or []) if isinstance(bars, dict) else 0,
        }
    return sessions


def load_visual_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        rows = data.get("rows")
        if isinstance(rows, list):
            return [r for r in rows if isinstance(r, dict)]
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    return []


def event_plan_index(events: list[dict[str, str]]) -> dict[str, list[dict[str, Any]]]:
    by_plan: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        price = as_float(event.get("price") or event.get("zone_low"))
        plan_date = event.get("plan_date") or ""
        if price is None or not plan_date:
            continue
        by_plan[plan_date].append({
            "price": price,
            "source_id": event.get("source_id") or "",
            "source_kind": event.get("source_kind") or "",
            "source_path": event.get("source_path") or "",
            "primary_role": event.get("primary_role") or "",
            "direction": event.get("direction") or "",
            "long_eligible": as_bool(event.get("long_eligible")),
            "pub_date": event.get("pub_date") or "",
        })
    for rows in by_plan.values():
        rows.sort(key=lambda item: item["price"])
    return by_plan


def next_trusted_level(
    by_plan: dict[str, list[dict[str, Any]]],
    plan_date: str,
    level: float | None,
) -> dict[str, Any]:
    if level is None:
        return {}
    candidates = [
        item for item in by_plan.get(plan_date, [])
        if item["price"] > level + 0.25 and item.get("direction") != "support"
    ]
    if not candidates:
        candidates = [
            item for item in by_plan.get(plan_date, [])
            if item["price"] > level + 0.25
        ]
    if not candidates:
        return {}
    chosen = min(candidates, key=lambda item: item["price"])
    return {
        "next_trusted_level_above": chosen["price"],
        "next_trusted_level_source": chosen.get("source_kind") or "mancini",
        "next_trusted_level_role": chosen.get("primary_role") or "",
    }


def row_date_from_timestamp(value: str | None) -> str:
    if not value:
        return ""
    return str(value)[:10]


def support_resistance_list_text(text: str) -> bool:
    cleaned = text.strip().lower()
    return cleaned.startswith("supports are:") or cleaned.startswith("resistances are:")


def source_confidence(
    *,
    mode: str,
    quote: str,
    verdict: str,
    source_confirmed: bool,
    source_planned: bool,
    source_negative: bool,
    sr_list_only: bool,
    chart_confirmed_reclaim: bool,
    has_swept_low: bool,
    has_recovered_level: bool,
) -> float:
    text = quote.lower()
    if source_negative or verdict == "negative_control":
        return 0.0
    if sr_list_only:
        return 0.2
    if source_confirmed and has_swept_low and has_recovered_level:
        return 1.0
    if source_confirmed and has_recovered_level:
        return 0.8
    if source_planned and chart_confirmed_reclaim:
        return 0.65
    if source_planned:
        return 0.55
    if mode == "context_recap" or "failed breakdown" in text or "reclaim" in text:
        return 0.4
    return 0.2


def select_setup_levels(source_row: dict[str, Any]) -> list[float | None]:
    levels = source_row.get("levels") or {}
    for key in ("actual_setup_level", "recovered_level", "swept_lost_low"):
        values = [as_float(v) for v in levels.get(key) or []]
        values = [v for v in values if v is not None]
        if values:
            return values
    role_levels = []
    for item in source_row.get("level_role_map") or []:
        price = as_float(item.get("level"))
        roles = set(item.get("roles") or [])
        if price is not None and not roles.intersection({"target_or_response", "current_price_context"}):
            role_levels.append(price)
    if role_levels:
        return role_levels[:1]
    return [None]


def select_chart_match(source_row: dict[str, Any], setup_level: float | None) -> dict[str, Any] | None:
    matches = source_row.get("chart_matches") or []
    if not matches:
        return None
    if setup_level is not None:
        exact = [
            m for m in matches
            if as_float(m.get("level")) is not None and abs(as_float(m.get("level")) - setup_level) <= 0.26
        ]
        if exact:
            return exact[0]
    return matches[0]


def direct_training_rows(
    direct_rows: list[dict[str, Any]],
    quick_by_packet: dict[str, dict[str, str]],
    manifest_by_packet: dict[str, dict[str, Any]],
    visual_by_packet: dict[str, dict[str, Any]],
    sessions: dict[str, dict[str, Any]],
    events_by_plan: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source_index, source_row in enumerate(direct_rows, start=1):
        for setup_index, setup_level in enumerate(select_setup_levels(source_row), start=1):
            match = select_chart_match(source_row, setup_level) or {}
            packet_id = match.get("packet_id") or ""
            quick = quick_by_packet.get(packet_id, {})
            manifest = manifest_by_packet.get(packet_id, {})
            visual = visual_by_packet.get(packet_id, {})
            levels = source_row.get("levels") or {}
            blockers = list(source_row.get("blockers") or [])
            quote = source_row.get("snippet") or ""
            mode = source_row.get("mode") or ""
            verdict = source_row.get("verdict") or ""
            visual_status = (
                match.get("visual_sanity_status")
                or visual.get("status")
                or manifest.get("visual_sanity_status")
                or ""
            )
            window_metrics = match.get("window_metrics") or {}
            swept_low = (
                first_number(levels.get("swept_lost_low"))
                or as_float(window_metrics.get("trap_low"))
                or as_float(quick.get("trap_candle_low"))
            )
            recovered_level = first_number(levels.get("recovered_level")) or setup_level
            non_acceptance_threshold = (
                first_number(levels.get("non_acceptance_threshold"))
                or as_float(window_metrics.get("non_acceptance_threshold"))
                or (setup_level + 5 if setup_level is not None else None)
            )
            invalidation_level = (
                first_number(levels.get("invalidation"))
                or as_float(window_metrics.get("invalidation_low_minus_tick"))
                or as_float(quick.get("invalidation_sweep_low_minus_1tick"))
            )
            target_level = first_number(levels.get("target_or_response"))
            target_info = next_trusted_level(events_by_plan, source_row.get("plan_date") or "", setup_level)
            if target_level is None:
                target_level = as_float(target_info.get("next_trusted_level_above"))
            chart_mismatch = any(str(b).startswith("chart_trap_low_") for b in blockers)
            chart_confirmed_reclaim = bool(
                window_metrics.get("first_reclaim_close_timestamp_et")
                or quick.get("first_reclaim_close_timestamp_et")
            )
            chart_confirmed_non_acceptance = bool(
                as_int(window_metrics.get("threshold_hold_closes")) and as_int(window_metrics.get("threshold_hold_closes")) >= 2
            ) or as_int(quick.get("non_acceptance_held_bars")) is not None and as_int(quick.get("non_acceptance_held_bars")) >= 2
            source_negative = mode == "negative_control" or verdict == "negative_control" or "source_marks_no_trigger_or_non_fbd" in blockers
            quote_lower = quote.lower()
            source_confirmed = (
                mode == "actual_recap"
                and not source_negative
                and (
                    "failed breakdown" in quote_lower
                    or "failed break down" in quote_lower
                    or "recover" in quote_lower
                    or "reclaim" in quote_lower
                )
                and setup_level is not None
            )
            source_planned = mode == "planned_setup" and not source_negative
            sr_list_only = support_resistance_list_text(quote) or all(
                bool(item.get("support_list_only")) for item in source_row.get("level_role_map") or []
            )
            needs_crop = verdict == "needs_bigger_crop" or "no_existing_chart_window_match" in blockers or visual_status == "insufficient_visual_context"
            data_only = verdict == "data_only" or mode in {"context_recap", "methodology_definition", "data_context"}
            data_only = bool(data_only and not source_confirmed and not source_planned and not source_negative)
            session_date = ""
            if match.get("source_timestamp_et"):
                session_date = row_date_from_timestamp(match.get("source_timestamp_et"))
            if not session_date and source_row.get("session_scan"):
                first_scan = (source_row.get("session_scan") or [{}])[0]
                session_date = first_scan.get("session_date") or ""
            if not session_date:
                session_date = source_row.get("plan_date") or ""
            window_csv = match.get("window_csv") or quick.get("window_csv") or manifest.get("window_csv") or ""
            window_path = root_path(window_csv)
            window_available = bool(window_path and window_path.exists())
            session_info = sessions.get(session_date) or sessions.get(source_row.get("plan_date") or "") or {}
            bars_available = as_int(window_metrics.get("bar_count")) or as_int(quick.get("crop_bar_count"))
            if bars_available is None and window_available:
                with window_path.open("r", encoding="utf-8-sig") as handle:
                    bars_available = max(0, sum(1 for _ in handle) - 1)
            if bars_available is None:
                bars_available = int(session_info.get("es_bar_count") or 0)
            labels = {
                "source_confirmed_fbd": source_confirmed,
                "source_planned_fbd": source_planned,
                "source_negative_control": source_negative,
                "sr_list_only": sr_list_only,
                "chart_confirmed_reclaim": chart_confirmed_reclaim,
                "chart_confirmed_non_acceptance": chart_confirmed_non_acceptance,
                "chart_mismatch": chart_mismatch,
                "needs_crop": needs_crop,
                "data_only": data_only,
            }
            confidence = source_confidence(
                mode=mode,
                quote=quote,
                verdict=verdict,
                source_confirmed=source_confirmed,
                source_planned=source_planned,
                source_negative=source_negative,
                sr_list_only=sr_list_only,
                chart_confirmed_reclaim=chart_confirmed_reclaim,
                has_swept_low=swept_low is not None,
                has_recovered_level=recovered_level is not None,
            )
            row = {
                "training_row_id": "direct-" + source_hash([source_row.get("raw_file"), source_row.get("line"), setup_index, setup_level]),
                "row_origin": "direct_source_audit",
                "source_index": source_index,
                "raw_file": source_row.get("raw_file") or "",
                "line": source_row.get("line"),
                "plan_date": source_row.get("plan_date") or "",
                "pub_date": source_row.get("pub_date") or "",
                "source_quote": quote,
                "article_title": source_row.get("article_title") or "",
                "setup_level": setup_level,
                "swept_low": swept_low,
                "recovered_level": recovered_level,
                "non_acceptance_threshold": non_acceptance_threshold,
                "invalidation_level": invalidation_level,
                "target_or_response_level": target_level,
                "source_mode": mode,
                "source_audit_verdict": verdict,
                "source_confidence_score": round(confidence, 4),
                "level_role_map": source_row.get("level_role_map") or [],
                "sr_coincidence": source_row.get("sr_coincidence"),
                "support_context": source_row.get("support_context") or [],
                "resistance_context": source_row.get("resistance_context") or [],
                "prose_context": source_row.get("prose_context") or [],
                "chart_path": match.get("chart_path") or manifest.get("chart_path") or "",
                "png_path": match.get("png_path") or manifest.get("png_path") or "",
                "window_csv": window_csv,
                "visual_sanity_status": visual_status,
                "visual_sanity_reasons": match.get("visual_sanity_reasons") or visual.get("reasons") or [],
                "visual_sanity_cautions": match.get("visual_sanity_cautions") or visual.get("caution_notes") or [],
                "blockers": blockers,
                "es_window_available": window_available or int(session_info.get("es_bar_count") or 0) > 0,
                "session_date": session_date,
                "session_file": session_info.get("path") or "",
                "session_usable": session_info.get("usable"),
                "session_excluded_reason": session_info.get("excluded_reason") or "",
                "bars_available": bars_available,
                "packet_id": packet_id,
                "acceptance_family": match.get("acceptance_family") or quick.get("acceptance_family") or manifest.get("acceptance_family") or "",
                "candidate_acceptance_family": quick.get("candidate_acceptance_family") or manifest.get("candidate_acceptance_family") or "",
                "accepted_for_timing_test": as_bool(quick.get("accepted_for_timing_test") or manifest.get("accepted_for_timing_test")),
                "positive_training_example_from_packet": as_bool(quick.get("positive_training_example")),
                "first_reclaim_close_timestamp_et": window_metrics.get("first_reclaim_close_timestamp_et") or quick.get("first_reclaim_close_timestamp_et") or "",
                "trap_candle_timestamp_et": window_metrics.get("trap_timestamp_et") or quick.get("trap_candle_timestamp_et") or "",
                "flush_points": as_float(window_metrics.get("flush_points")) or as_float(quick.get("flush_points")),
                "acceptance_closes": as_int(quick.get("acceptance_closes")),
                "non_acceptance_held_bars": as_int(quick.get("non_acceptance_held_bars")),
                "prior_level_tests_before_trap": as_int(quick.get("prior_level_tests_before_trap")),
                "reclaim_hold_closes": as_int(quick.get("reclaim_hold_closes")),
                "reclaim_minutes_from_trap": as_float(quick.get("reclaim_minutes_from_trap")),
                "immediate_failure_after_reclaim": as_bool(quick.get("immediate_failure_after_reclaim")),
                "mfe_15m": as_float(quick.get("mfe_15m")),
                "mae_15m": as_float(quick.get("mae_15m")),
                "mfe_60m": as_float(quick.get("mfe_60m")),
                "mae_60m": as_float(quick.get("mae_60m")),
                **target_info,
                **labels,
            }
            rows.append(row)
    return rows


def packet_training_rows(
    quick_rows: list[dict[str, str]],
    manifest_by_packet: dict[str, dict[str, Any]],
    visual_by_packet: dict[str, dict[str, Any]],
    sessions: dict[str, dict[str, Any]],
    events_by_plan: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, quick in enumerate(quick_rows, start=1):
        packet_id = quick.get("packet_id") or f"packet-row-{index}"
        manifest = manifest_by_packet.get(packet_id, {})
        visual = visual_by_packet.get(packet_id, {})
        raw_source = manifest.get("raw_mancini_source") or {}
        derived = manifest.get("derived_source_evidence") or {}
        event_fields = manifest.get("event_fields") or {}
        level = as_float(quick.get("level") or manifest.get("level"))
        plan_date = event_fields.get("plan_date") or row_date_from_timestamp(quick.get("source_timestamp_et")) or ""
        quote = (
            quick.get("source_label")
            or manifest.get("mancini_source_text")
            or raw_source.get("quote")
            or derived.get("quote")
            or ""
        )
        source_setup_status = quick.get("source_setup_evidence_status") or ""
        explicitness = manifest.get("mancini_explicitness") or ""
        sr_list_only = (
            "level_list_only" in source_setup_status
            or explicitness == "support_resistance_list"
            or support_resistance_list_text(quote)
        )
        source_negative = False
        quote_lower = quote.lower()
        source_confirmed = bool(
            not sr_list_only
            and (
                "failed breakdown" in quote_lower
                or "recover" in quote_lower
                or "reclaim" in quote_lower
                or explicitness == "explicit_mancini_narrative"
            )
        )
        source_planned = False
        chart_confirmed_reclaim = bool(quick.get("first_reclaim_close_timestamp_et"))
        chart_confirmed_non_acceptance = as_int(quick.get("non_acceptance_held_bars")) is not None and as_int(quick.get("non_acceptance_held_bars")) >= 2
        chart_mismatch = "source_chart_mismatch" in lower_text(quick.get("trigger_validation_reasons"), quick.get("reject_reasons"))
        needs_crop = as_int(quick.get("crop_missing_bar_count")) not in (None, 0)
        data_only = bool(sr_list_only or not source_confirmed)
        swept_low = as_float(quick.get("trap_candle_low"))
        if swept_low is None and level is not None and as_float(quick.get("flush_points")) is not None:
            swept_low = level - float(as_float(quick.get("flush_points")))
        invalidation = as_float(quick.get("invalidation_sweep_low_minus_1tick")) or as_float(quick.get("invalidation_level_minus_2points"))
        target_info = next_trusted_level(events_by_plan, plan_date, level)
        target_level = as_float(target_info.get("next_trusted_level_above"))
        visual_status = visual.get("status") or ""
        window_csv = quick.get("window_csv") or manifest.get("window_csv") or ""
        window_path = root_path(window_csv)
        window_available = bool(window_path and window_path.exists())
        session_date = plan_date or row_date_from_timestamp(quick.get("source_timestamp_et"))
        session_info = sessions.get(session_date) or {}
        bars_available = as_int(quick.get("crop_bar_count"))
        if bars_available is None and window_available:
            with window_path.open("r", encoding="utf-8-sig") as handle:
                bars_available = max(0, sum(1 for _ in handle) - 1)
        if bars_available is None:
            bars_available = int(session_info.get("es_bar_count") or 0)
        confidence = source_confidence(
            mode="data_context",
            quote=quote,
            verdict="data_only",
            source_confirmed=source_confirmed,
            source_planned=source_planned,
            source_negative=source_negative,
            sr_list_only=sr_list_only,
            chart_confirmed_reclaim=chart_confirmed_reclaim,
            has_swept_low=swept_low is not None,
            has_recovered_level=level is not None,
        )
        labels = {
            "source_confirmed_fbd": source_confirmed,
            "source_planned_fbd": source_planned,
            "source_negative_control": source_negative,
            "sr_list_only": sr_list_only,
            "chart_confirmed_reclaim": chart_confirmed_reclaim,
            "chart_confirmed_non_acceptance": chart_confirmed_non_acceptance,
            "chart_mismatch": chart_mismatch,
            "needs_crop": needs_crop,
            "data_only": data_only,
        }
        rows.append({
            "training_row_id": "packet-" + source_hash([packet_id, index, level]),
            "row_origin": "packet_observation",
            "source_index": index,
            "raw_file": raw_source.get("source_path") or derived.get("source_path") or "",
            "line": raw_source.get("line_start") or derived.get("line_start") or "",
            "plan_date": plan_date,
            "pub_date": event_fields.get("pub_date") or "",
            "source_quote": quote,
            "article_title": "",
            "setup_level": level,
            "swept_low": swept_low,
            "recovered_level": level,
            "non_acceptance_threshold": level + 5 if level is not None else None,
            "invalidation_level": invalidation,
            "target_or_response_level": target_level,
            "source_mode": "data_context",
            "source_audit_verdict": "packet_observation",
            "source_confidence_score": round(confidence, 4),
            "level_role_map": [{
                "level": level,
                "roles": [event_fields.get("primary_role") or ""],
                "support_list_only": sr_list_only,
            }],
            "sr_coincidence": "",
            "support_context": [],
            "resistance_context": [],
            "prose_context": [],
            "chart_path": manifest.get("chart_path") or "",
            "png_path": manifest.get("png_path") or "",
            "window_csv": window_csv,
            "visual_sanity_status": visual_status,
            "visual_sanity_reasons": visual.get("reasons") or [],
            "visual_sanity_cautions": visual.get("caution_notes") or [],
            "blockers": quick.get("reject_reasons") or "",
            "es_window_available": window_available or int(session_info.get("es_bar_count") or 0) > 0,
            "session_date": session_date,
            "session_file": session_info.get("path") or "",
            "session_usable": session_info.get("usable"),
            "session_excluded_reason": session_info.get("excluded_reason") or "",
            "bars_available": bars_available,
            "packet_id": packet_id,
            "acceptance_family": quick.get("acceptance_family") or manifest.get("acceptance_family") or "",
            "candidate_acceptance_family": quick.get("candidate_acceptance_family") or manifest.get("candidate_acceptance_family") or "",
            "accepted_for_timing_test": as_bool(quick.get("accepted_for_timing_test")),
            "positive_training_example_from_packet": as_bool(quick.get("positive_training_example")),
            "first_reclaim_close_timestamp_et": quick.get("first_reclaim_close_timestamp_et") or "",
            "trap_candle_timestamp_et": quick.get("trap_candle_timestamp_et") or "",
            "flush_points": as_float(quick.get("flush_points")),
            "acceptance_closes": as_int(quick.get("acceptance_closes")),
            "non_acceptance_held_bars": as_int(quick.get("non_acceptance_held_bars")),
            "prior_level_tests_before_trap": as_int(quick.get("prior_level_tests_before_trap")),
            "reclaim_hold_closes": as_int(quick.get("reclaim_hold_closes")),
            "reclaim_minutes_from_trap": as_float(quick.get("reclaim_minutes_from_trap")),
            "immediate_failure_after_reclaim": as_bool(quick.get("immediate_failure_after_reclaim")),
            "mfe_15m": as_float(quick.get("mfe_15m")),
            "mae_15m": as_float(quick.get("mae_15m")),
            "mfe_60m": as_float(quick.get("mfe_60m")),
            "mae_60m": as_float(quick.get("mae_60m")),
            "source_setup_evidence_status": source_setup_status,
            "mancini_explicitness": explicitness,
            **target_info,
            **labels,
        })
    return rows


def csv_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return compact_json(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return value


def write_outputs(rows: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_JSONL.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    all_fields = list(REQUIRED_FIELD_ORDER)
    seen = set(all_fields)
    for row in rows:
        for key in row:
            if key not in seen:
                all_fields.append(key)
                seen.add(key)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=all_fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: csv_value(row.get(field)) for field in all_fields})
    OUT_SUMMARY_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_SUMMARY_MD.write_text(summary_markdown(summary), encoding="utf-8", newline="\n")


def summary_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# Mancini FBD Algo Training Table Summary",
        "",
        f"Generated: {summary['generated_at']}",
        "",
        "Scope: research, historical, replay, and shadow only. No live trading authority.",
        "",
        "## Counts",
        "",
        f"- Training rows: {summary['training_row_count']}",
        f"- Direct source audit input rows: {summary['input_counts']['direct_source_audit_rows']}",
        f"- Packet observation input rows: {summary['input_counts']['quick_reclaim_rows']}",
        f"- Context protocol events: {summary['input_counts']['events_rows']}",
        f"- ES session JSON files: {summary['input_counts']['session_json_files']}",
        f"- Gallery SVG files: {summary['input_counts']['gallery_svg_files']}",
        f"- Gallery PNG files: {summary['input_counts']['gallery_png_files']}",
        f"- Gallery manifest rows missing PNG sidecars: {summary['input_counts']['gallery_manifest_missing_png_sidecars']}",
        "",
        "## Labels",
        "",
    ]
    for label in LABEL_FIELDS:
        lines.append(f"- `{label}`: {summary['label_counts'].get(label, 0)}")
    lines.extend([
        "",
        "## Direct Audit Verdicts",
        "",
    ])
    for key, value in summary["direct_audit_verdict_counts"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend([
        "",
        "## Safety Notes",
        "",
        "- Support/resistance-list-only packet rows are labeled as `sr_list_only` and are not promoted into positive examples.",
        "- The current direct audit still has `0` strict positive training candidates; this is preserved as a safety-gate fact, not treated as proof the pattern is absent.",
        "- Real packet gallery PNG sidecars were checked from disk, not assumed from manifest prose.",
    ])
    return "\n".join(lines) + "\n"


def build_summary(
    rows: list[dict[str, Any]],
    direct_rows: list[dict[str, Any]],
    quick_rows: list[dict[str, str]],
    events: list[dict[str, str]],
    manifest_rows: list[dict[str, Any]],
    sessions: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    gallery_dir = GALLERY_MANIFEST.parent
    session_json_files = list(SESSIONS_DIR.glob("*.json")) if SESSIONS_DIR.exists() else []
    png_files = list(gallery_dir.glob("*.png")) if gallery_dir.exists() else []
    svg_files = list(gallery_dir.glob("*.svg")) if gallery_dir.exists() else []
    missing_png = 0
    for item in manifest_rows:
        png = root_path(item.get("png_path"))
        if png and not png.exists():
            missing_png += 1
    label_counts = {label: sum(1 for row in rows if bool(row.get(label))) for label in LABEL_FIELDS}
    direct_verdict_counts = dict(Counter(str(row.get("verdict") or "missing") for row in direct_rows))
    direct_positive_count = sum(1 for row in direct_rows if row.get("verdict") == "positive_training_candidate")
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "research_historical_replay_shadow_only",
        "output_paths": {
            "training_rows_jsonl": rel(OUT_JSONL),
            "training_rows_csv": rel(OUT_CSV),
            "summary_json": rel(OUT_SUMMARY_JSON),
            "summary_md": rel(OUT_SUMMARY_MD),
        },
        "input_paths": {
            "direct_fbd_source_audit": rel(DIRECT_AUDIT),
            "chronological_checklist": rel(CHRONO_CHECKLIST),
            "events_csv": rel(EVENTS_CSV),
            "quick_reclaim_acceptance_summary": rel(QUICK_SUMMARY),
            "quick_reclaim_acceptance_rows": rel(QUICK_ROWS),
            "gallery_manifest": rel(GALLERY_MANIFEST),
            "visual_sanity_audit": rel(VISUAL_AUDIT),
            "sessions_dir": rel(SESSIONS_DIR),
            "ninja_strategy_exists_checked_only": rel(NINJA_STRATEGY),
        },
        "input_counts": {
            "direct_source_audit_rows": len(direct_rows),
            "quick_reclaim_rows": len(quick_rows),
            "events_rows": len(events),
            "gallery_manifest_rows": len(manifest_rows),
            "session_json_files": len(session_json_files),
            "indexed_session_dates": len(sessions),
            "usable_sessions": sum(1 for item in sessions.values() if item.get("usable")),
            "gallery_svg_files": len(svg_files),
            "gallery_png_files": len(png_files),
            "gallery_manifest_missing_png_sidecars": missing_png,
        },
        "training_row_count": len(rows),
        "row_origin_counts": dict(Counter(str(row.get("row_origin") or "missing") for row in rows)),
        "source_mode_counts": dict(Counter(str(row.get("source_mode") or "missing") for row in rows)),
        "acceptance_family_counts": dict(Counter(str(row.get("acceptance_family") or "missing") for row in rows)),
        "visual_sanity_status_counts": dict(Counter(str(row.get("visual_sanity_status") or "missing") for row in rows)),
        "direct_audit_verdict_counts": direct_verdict_counts,
        "direct_audit_positive_training_candidate_count": direct_positive_count,
        "label_counts": label_counts,
        "safety": {
            "live_trading_behavior_introduced": False,
            "broker_risk_live_pine_credential_execution_touched": False,
            "sr_list_only_promoted_to_positive": False,
            "gallery_png_sidecars_exist": len(png_files) > 0,
        },
    }
    return summary


def verify_inputs() -> None:
    required = [
        DIRECT_AUDIT,
        CHRONO_CHECKLIST,
        EVENTS_CSV,
        QUICK_SUMMARY,
        QUICK_ROWS,
        GALLERY_MANIFEST,
        VISUAL_AUDIT,
        SESSIONS_DIR,
        NINJA_STRATEGY,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required input paths:\n" + "\n".join(missing))


def main() -> int:
    verify_inputs()
    direct_rows = [row for row in read_json(DIRECT_AUDIT) if isinstance(row, dict)]
    events = read_csv(EVENTS_CSV)
    quick_rows = read_csv(QUICK_ROWS)
    manifest_rows = [row for row in read_json(GALLERY_MANIFEST) if isinstance(row, dict)]
    visual_rows = load_visual_rows(read_json(VISUAL_AUDIT))
    sessions = load_session_index()
    events_by_plan = event_plan_index(events)
    quick_by_packet = {row.get("packet_id") or "": row for row in quick_rows}
    manifest_by_packet = {row.get("packet_id") or "": row for row in manifest_rows}
    visual_by_packet = {row.get("packet_id") or "": row for row in visual_rows}

    rows = direct_training_rows(direct_rows, quick_by_packet, manifest_by_packet, visual_by_packet, sessions, events_by_plan)
    rows.extend(packet_training_rows(quick_rows, manifest_by_packet, visual_by_packet, sessions, events_by_plan))

    summary = build_summary(rows, direct_rows, quick_rows, events, manifest_rows, sessions)
    write_outputs(rows, summary)
    print(json.dumps({
        "training_row_count": len(rows),
        "label_counts": summary["label_counts"],
        "gallery_png_files": summary["input_counts"]["gallery_png_files"],
        "gallery_manifest_missing_png_sidecars": summary["input_counts"]["gallery_manifest_missing_png_sidecars"],
        "outputs": summary["output_paths"],
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
