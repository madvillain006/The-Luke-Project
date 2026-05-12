#!/usr/bin/env python3
"""Render every real Mancini packet window as source-priority chart evidence.

This gallery is broader than the curated case-study set. It includes every
packetized nightly-plan window, including rows excluded from timing stats.
All charts are research/replay-only and carry no live-trading authority.
"""

from __future__ import annotations

import json
import re
import sys
import csv
from ast import literal_eval
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import render_mancini_packet_charts as charts  # noqa: E402


ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
PACKETS = ROOT / "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl"
EVENTS = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
OUT_DIR = ROOT / "artifacts/research/mancini-real-packet-gallery"


EXPLICIT_SOURCE_MARKERS = [
    "failed breakdown",
    "recover",
    "reclaimed",
    "reclaim",
    "swept",
    "sweep",
    "wick",
    "defend",
    "trap",
    "backtest",
    "lost",
    "rallied",
    "squeezed",
    "why ",
    "i wrote",
]


def slug(value: str, max_len: int = 80) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(value or "").strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_.")
    return (cleaned or "missing")[:max_len]


def parse_reject_reasons(value: str) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        try:
            parsed = literal_eval(value)
        except (SyntaxError, ValueError):
            return [value]
    if isinstance(parsed, list):
        return [str(item) for item in parsed]
    return [str(parsed)]


def load_events(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def price_pattern(value: Any) -> re.Pattern[str] | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if price.is_integer():
        token = str(int(price))
        pattern = rf"(?<![0-9.]){re.escape(token)}(?:\.0+)?(?![0-9.])"
    else:
        token = str(price).rstrip("0").rstrip(".")
        pattern = rf"(?<![0-9.]){re.escape(token)}0*(?![0-9.])"
    return re.compile(pattern)


def derived_event_for_packet(packet: dict[str, Any], events_rows: list[dict[str, str]]) -> dict[str, str] | None:
    evidence = packet.get("source_text_evidence") or {}
    line_start = evidence.get("line_start")
    try:
        # Packet source lines are CSV file line numbers, including the header.
        index = int(line_start) - 2
    except (TypeError, ValueError):
        index = -1
    if 0 <= index < len(events_rows):
        return events_rows[index]
    quote = normalize(evidence.get("quote") or "")
    timestamp = str(evidence.get("timestamp_et") or "")
    level = str(evidence.get("level") or "")
    for row in events_rows:
        if quote and normalize(row.get("source_snippet") or "") == quote:
            return row
        if timestamp and level and level == str(row.get("price") or ""):
            if timestamp[:10] in {str(row.get("entry_ct") or "")[:10], str(row.get("touch_ct") or "")[:10]}:
                return row
    return None


def raw_source_context(raw_path_text: str, event_row: dict[str, str] | None, fallback_quote: str, level: Any) -> dict[str, Any]:
    raw_path = ROOT / raw_path_text if raw_path_text and not Path(raw_path_text).is_absolute() else Path(raw_path_text or "")
    base = {
        "source_path": raw_path_text or None,
        "line_start": None,
        "line_end": None,
        "quote": None,
        "surrounding_source_context": None,
        "match_quality": "missing_raw_source_path" if not raw_path_text else "not_found",
        "match_count": 0,
    }
    if not raw_path_text or not raw_path.exists():
        return base

    lines = raw_path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    snippet = (event_row or {}).get("source_snippet") or fallback_quote or ""
    clean_snippet = snippet.strip().strip(".")
    normalized_snippet = normalize(clean_snippet)
    price_re = price_pattern((event_row or {}).get("price") or level)
    direction = normalize((event_row or {}).get("direction") or "")

    candidates: list[tuple[int, str]] = []
    if normalized_snippet and not clean_snippet.startswith("..."):
        for index, line in enumerate(lines, start=1):
            if normalized_snippet in normalize(line):
                candidates.append((index, "exact_snippet"))
    if not candidates and normalized_snippet:
        core = re.sub(r"^\.*|\.*$", "", clean_snippet).strip()
        core_words = " ".join(core.split()[:12])
        if len(core_words) >= 24:
            core_norm = normalize(core_words)
            for index, line in enumerate(lines, start=1):
                if core_norm in normalize(line):
                    candidates.append((index, "partial_snippet"))
    if not candidates and price_re:
        role_anchor = "supports are" if direction == "support" else "resistances are" if direction == "resistance" else ""
        for index, line in enumerate(lines, start=1):
            line_norm = normalize(line)
            if role_anchor and role_anchor not in line_norm:
                continue
            if price_re.search(line):
                candidates.append((index, "price_and_role"))
    if not candidates and price_re:
        for index, line in enumerate(lines, start=1):
            if price_re.search(line):
                candidates.append((index, "price_only"))

    if not candidates:
        return base
    line_no, quality = candidates[0]
    start = max(1, line_no - 2)
    end = min(len(lines), line_no + 2)
    quote = lines[line_no - 1].strip()
    context = "\n".join(f"{idx}: {lines[idx - 1]}" for idx in range(start, end + 1))
    return {
        "source_path": raw_path_text,
        "line_start": line_no,
        "line_end": line_no,
        "quote": quote,
        "surrounding_source_context": context,
        "match_quality": quality,
        "match_count": len(candidates),
    }


def classify_source_label(label: str) -> str:
    lower = str(label or "").lower()
    if lower.startswith("supports are") or lower.startswith("resistances are"):
        return "support_resistance_list"
    if any(marker in lower for marker in EXPLICIT_SOURCE_MARKERS):
        return "explicit_mancini_narrative"
    return "mancini_context_text"


def clean_output_dir() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.relative_to(ROOT)
    for path in OUT_DIR.iterdir():
        if path.is_file() and path.suffix.lower() in {".svg", ".png", ".json", ".md"}:
            path.unlink()


def build_case_title(row: dict[str, str], accepted: bool) -> str:
    status = "Accepted Timing" if accepted else "Excluded Timing"
    family = row.get("acceptance_family") or "unclassified"
    return f"Real Mancini Packet - {status} - {family} - level {row.get('level')}"


def build_case_note(row: dict[str, str], accepted: bool, reasons: list[str], explicitness: str) -> str:
    if accepted:
        stat_policy = "included in timing statistics"
    else:
        stat_policy = f"excluded from timing statistics: {', '.join(reasons) or 'missing deterministic timing field'}"
    return (
        "Source-priority real Mancini packet. Use the newsletter/source text first; "
        f"OHLC metrics and deterministic labels are secondary. Source class={explicitness}; "
        f"stat policy={stat_policy}."
    )


def packet_time_for_name(packet_id: str) -> str:
    parts = str(packet_id or "").split(":")
    if len(parts) >= 2:
        return parts[1].replace("-", "").replace("T", "_")
    return "unknown_time"


def manifest_row(
    row: dict[str, str],
    packet: dict[str, Any],
    event_row: dict[str, str] | None,
    out_path: Path,
    accepted: bool,
    reasons: list[str],
    explicitness: str,
) -> dict[str, Any]:
    source_text_evidence = packet.get("source_text_evidence") or {}
    source_map = packet.get("source_map") or {}
    raw_path = (event_row or {}).get("source_path") or source_map.get("source_path")
    raw_source = raw_source_context(raw_path, event_row, source_text_evidence.get("quote") or "", row.get("level"))
    return {
        "artifact_kind": "real_mancini_packet_chart",
        "data_class": "historical_packet_window",
        "performance_data_source": "quick_reclaim_acceptance_rows",
        "mancini_source_priority": True,
        "mancini_source_text": row.get("source_label") or "",
        "source_text_evidence": {
            "source_path": source_text_evidence.get("source_path"),
            "line_start": source_text_evidence.get("line_start"),
            "line_end": source_text_evidence.get("line_end"),
            "quote": source_text_evidence.get("quote"),
            "timestamp_et": source_text_evidence.get("timestamp_et"),
            "timestamp_field": source_text_evidence.get("timestamp_field"),
            "timestamp_quality": source_text_evidence.get("timestamp_quality"),
            "evidence_type": source_text_evidence.get("evidence_type"),
            "level": source_text_evidence.get("level"),
        },
        "derived_source_evidence": {
            "source_path": source_text_evidence.get("source_path"),
            "line_start": source_text_evidence.get("line_start"),
            "line_end": source_text_evidence.get("line_end"),
            "quote": source_text_evidence.get("quote"),
        },
        "raw_mancini_source": raw_source,
        "source_derivation_chain": [
            {
                "stage": "raw_mancini_text",
                "path": raw_source.get("source_path"),
                "line_start": raw_source.get("line_start"),
                "match_quality": raw_source.get("match_quality"),
            },
            {
                "stage": "derived_context_event",
                "path": source_text_evidence.get("source_path"),
                "line_start": source_text_evidence.get("line_start"),
            },
            {
                "stage": "hermes_packet",
                "path": "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl",
                "packet_id": row.get("packet_id"),
            },
            {
                "stage": "real_packet_gallery",
                "path": str((OUT_DIR / "manifest.json").relative_to(ROOT)),
            },
        ],
        "source_map": source_map,
        "event_fields": {
            "plan_date": (event_row or {}).get("plan_date"),
            "pub_date": (event_row or {}).get("pub_date"),
            "primary_role": (event_row or {}).get("primary_role"),
            "direction": (event_row or {}).get("direction"),
            "tags": (event_row or {}).get("tags"),
            "long_eligible": (event_row or {}).get("long_eligible"),
            "ocr_verified": (event_row or {}).get("ocr_verified"),
            "saty_valid": (event_row or {}).get("saty_valid"),
            "nearest_saty_label": (event_row or {}).get("nearest_saty_label"),
            "nearest_saty_price": (event_row or {}).get("nearest_saty_price"),
            "nearest_saty_distance": (event_row or {}).get("nearest_saty_distance"),
        },
        "metric_interpretation": "observational_only",
        "mancini_explicitness": explicitness,
        "accepted_for_timing_test": accepted,
        "excluded_from_timing_stats": not accepted,
        "reject_reasons": reasons,
        "label_safety_policy": "acceptance_family_is_heuristic_bucket_not_strategy_trigger",
        "candidate_acceptance_family": row.get("candidate_acceptance_family"),
        "acceptance_family_is_strategy_trigger": row.get("acceptance_family_is_strategy_trigger") == "True",
        "family_label_status": row.get("family_label_status"),
        "trigger_validation": {
            "status": row.get("trigger_validation_status"),
            "reasons": parse_reject_reasons(row.get("trigger_validation_reasons") or "[]"),
            "warnings": parse_reject_reasons(row.get("trigger_validation_warnings") or "[]"),
            "source_setup_evidence_status": row.get("source_setup_evidence_status"),
            "prior_level_tests_before_trap": charts.num(row.get("prior_level_tests_before_trap"), None),
            "reclaim_hold_closes": charts.num(row.get("reclaim_hold_closes"), None),
            "trap_low_below_level_points": charts.num(row.get("trap_low_below_level_points"), None),
            "immediate_failure_after_reclaim": row.get("immediate_failure_after_reclaim") == "True",
            "ninja_shadow_candidate": row.get("ninja_shadow_candidate") == "True",
            "positive_training_example": row.get("positive_training_example") == "True",
        },
        "packet_id": row.get("packet_id"),
        "source_id": row.get("source_id"),
        "source_kind": row.get("source_kind"),
        "source_timestamp_et": row.get("source_timestamp_et"),
        "level": charts.num(row.get("level")),
        "acceptance_family": row.get("acceptance_family"),
        "reclaim_time_bucket": row.get("reclaim_time_bucket"),
        "flush_points": charts.num(row.get("flush_points"), None),
        "reclaim_minutes_from_trap": charts.num(row.get("reclaim_minutes_from_trap"), None),
        "acceptance_closes": charts.num(row.get("acceptance_closes"), None),
        "trap_candle_timestamp_et": row.get("trap_candle_timestamp_et"),
        "first_reclaim_close_timestamp_et": row.get("first_reclaim_close_timestamp_et"),
        "chart_path": str(out_path.relative_to(ROOT)),
        "png_path": str(out_path.with_suffix(".png").relative_to(ROOT)),
        "window_csv": row.get("window_csv"),
        "review_only": True,
        "trading_authority": "none",
    }


def main() -> int:
    rows = charts.load_rows(ROWS)
    packets = charts.load_jsonl(PACKETS)
    events_rows = load_events(EVENTS)
    clean_output_dir()

    manifest: list[dict[str, Any]] = []
    source_counts: Counter[str] = Counter()
    family_counts: Counter[str] = Counter()
    accepted_counts: Counter[str] = Counter()
    index_lines = [
        "# Mancini Full Real Packet Gallery",
        "",
        "Every packetized nightly-plan Mancini 1m crop window.",
        "Mancini source text is the authority layer; OHLC metrics and deterministic labels are secondary.",
        "Research/replay only. No live trading authority.",
        "",
    ]

    for index, row in enumerate(rows, start=1):
        packet_id = row.get("packet_id") or ""
        if packet_id not in packets:
            raise SystemExit(f"Missing packet for packet_id: {packet_id}")
        if not row.get("window_csv"):
            raise SystemExit(f"Missing window_csv for packet_id: {packet_id}")

        accepted = row.get("accepted_for_timing_test") == "True"
        reasons = parse_reject_reasons(row.get("reject_reasons") or "[]")
        explicitness = classify_source_label(row.get("source_label") or "")
        family = row.get("acceptance_family") or "unclassified"
        source_counts[explicitness] += 1
        family_counts[family] += 1
        accepted_counts["accepted" if accepted else "excluded"] += 1

        status = "accepted" if accepted else "excluded"
        filename = (
            f"{index:03d}_{status}_{slug(family, 44)}_"
            f"{packet_time_for_name(packet_id)}_{slug(row.get('level') or 'level', 16)}.svg"
        )
        out_path = OUT_DIR / filename
        chart_row = dict(row)
        chart_row["case_title"] = build_case_title(row, accepted)
        chart_row["case_note"] = build_case_note(row, accepted, reasons, explicitness)
        chart_row["case_source_quote"] = row.get("source_label") or ""
        charts.render_chart(chart_row, packets[packet_id], out_path)

        packet = packets[packet_id]
        event_row = derived_event_for_packet(packet, events_rows)
        item = manifest_row(row, packet, event_row, out_path, accepted, reasons, explicitness)
        manifest.append(item)
        index_lines.append(f"## {index:03d}. {item['acceptance_family']} level {item['level']}")
        index_lines.append("")
        index_lines.append(f"- Packet: `{packet_id}`")
        index_lines.append(f"- Status: `{status}`")
        index_lines.append(f"- Mancini source class: `{explicitness}`")
        index_lines.append(f"- Chart: `{item['chart_path']}`")
        index_lines.append(f"- PNG: `{item['png_path']}`")
        if item["mancini_source_text"]:
            index_lines.append(f"- Source text: {item['mancini_source_text']}")
        evidence = item.get("source_text_evidence") or {}
        if evidence.get("source_path"):
            index_lines.append(
                f"- Source evidence: `{evidence.get('source_path')}` "
                f"lines `{evidence.get('line_start')}-{evidence.get('line_end')}`"
            )
        raw_source = item.get("raw_mancini_source") or {}
        if raw_source.get("source_path"):
            index_lines.append(
                f"- Raw Mancini source: `{raw_source.get('source_path')}` "
                f"line `{raw_source.get('line_start')}` match `{raw_source.get('match_quality')}`"
            )
        if reasons:
            index_lines.append(f"- Exclusion reason: `{', '.join(reasons)}`")
        index_lines.append("")

    summary = {
        "artifact_kind": "real_mancini_packet_gallery",
        "data_class": "historical_packet_window",
        "mancini_source_priority": True,
        "review_only": True,
        "trading_authority": "none",
        "rows": len(manifest),
        "accepted_timing_rows": accepted_counts["accepted"],
        "excluded_timing_rows": accepted_counts["excluded"],
        "source_explicitness_counts": dict(sorted(source_counts.items())),
        "acceptance_family_counts": dict(sorted(family_counts.items())),
        "manifest": str((OUT_DIR / "manifest.json").relative_to(ROOT)),
        "index": str((OUT_DIR / "index.md").relative_to(ROOT)),
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    (OUT_DIR / "index.md").write_text("\n".join(index_lines), encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
