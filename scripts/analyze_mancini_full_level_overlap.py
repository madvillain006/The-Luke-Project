#!/usr/bin/env python3
"""Summarize all parsed Mancini levels against available ES 1m data.

This is research-only. It does not create strategy rules or trading authority.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
ES_AUDIT = ROOT / "artifacts/research/hermes-mancini-event-packets/es_coverage_audit.json"
OUT_DIR = ROOT / "artifacts/research/mancini-full-level-overlap"


ENTRY_STATUS = "entry_model_available"
TOUCHED_STATUSES = {ENTRY_STATUS, "touched_no_entry_model"}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def as_float(value: Any) -> float | None:
    try:
        if value is None or str(value).strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def as_bool(value: Any) -> bool | None:
    if value is None:
        return None
    clean = str(value).strip().lower()
    if clean == "true":
        return True
    if clean == "false":
        return False
    return None


def avg(values: list[float]) -> float | None:
    clean = [value for value in values if value is not None]
    return round(sum(clean) / len(clean), 4) if clean else None


def med(values: list[float]) -> float | None:
    clean = [value for value in values if value is not None]
    return round(median(clean), 4) if clean else None


def pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 2) if whole else None


def hit_rate(rows: list[dict[str, str]], field: str) -> float | None:
    complete = [row for row in rows if as_bool(row.get(field)) is not None]
    if not complete:
        return None
    hits = sum(1 for row in complete if as_bool(row.get(field)) is True)
    return pct(hits, len(complete))


def metric_summary(rows: list[dict[str, str]]) -> dict[str, Any]:
    entry_rows = [row for row in rows if row.get("event_status") == ENTRY_STATUS]
    complete_30m = [row for row in entry_rows if as_bool(row.get("horizon_30m_complete")) is True]
    complete_60m = [row for row in entry_rows if as_bool(row.get("horizon_60m_complete")) is True]
    touched = [row for row in rows if row.get("event_status") in TOUCHED_STATUSES]
    return {
        "levels": len(rows),
        "long_eligible": sum(1 for row in rows if as_bool(row.get("long_eligible")) is True),
        "touched": len(touched),
        "entry_model_available": len(entry_rows),
        "touched_no_entry_model": sum(1 for row in rows if row.get("event_status") == "touched_no_entry_model"),
        "touch_rate_pct": pct(len(touched), len(rows)),
        "entry_rate_vs_levels_pct": pct(len(entry_rows), len(rows)),
        "entry_rate_vs_touched_pct": pct(len(entry_rows), len(touched)),
        "complete_30m_entries": len(complete_30m),
        "complete_60m_entries": len(complete_60m),
        "avg_mfe_15m": avg([as_float(row.get("mfe_15m")) for row in complete_30m]),
        "median_mfe_15m": med([as_float(row.get("mfe_15m")) for row in complete_30m]),
        "avg_mfe_30m": avg([as_float(row.get("mfe_30m")) for row in complete_30m]),
        "median_mfe_30m": med([as_float(row.get("mfe_30m")) for row in complete_30m]),
        "avg_mae_30m": avg([as_float(row.get("mae_30m")) for row in complete_30m]),
        "median_mae_30m": med([as_float(row.get("mae_30m")) for row in complete_30m]),
        "avg_mfe_60m": avg([as_float(row.get("mfe_60m")) for row in complete_60m]),
        "median_mfe_60m": med([as_float(row.get("mfe_60m")) for row in complete_60m]),
        "avg_mae_60m": avg([as_float(row.get("mae_60m")) for row in complete_60m]),
        "median_mae_60m": med([as_float(row.get("mae_60m")) for row in complete_60m]),
        "hit_2pt_30m_rate": hit_rate(complete_30m, "hit_2pt_30m"),
        "hit_4pt_30m_rate": hit_rate(complete_30m, "hit_4pt_30m"),
        "hit_8pt_30m_rate": hit_rate(complete_30m, "hit_8pt_30m"),
        "hit_10pt_60m_rate": hit_rate(complete_60m, "hit_10pt_60m"),
        "mae_over_5pt_30m_rate": pct(sum(1 for row in complete_30m if (as_float(row.get("mae_30m")) or 0) > 5), len(complete_30m)),
    }


def group_summary(rows: list[dict[str, str]], field: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row.get(field) or "missing"].append(row)
    return [
        {"group": key, **metric_summary(value)}
        for key, value in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0]))
    ]


def saty_bucket(row: dict[str, str]) -> str:
    if as_bool(row.get("saty_valid")) is not True:
        return "saty_invalid_or_missing"
    distance = as_float(row.get("nearest_saty_distance"))
    if distance is None:
        return "saty_valid_no_distance"
    if distance <= 1:
        return "saty_within_1pt"
    if distance <= 2:
        return "saty_within_2pt"
    if distance <= 3:
        return "saty_within_3pt"
    if distance <= 5:
        return "saty_within_5pt"
    return "saty_over_5pt"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def markdown_table(rows: list[dict[str, Any]], fields: list[str]) -> list[str]:
    lines = [
        "| " + " | ".join(fields) + " |",
        "| " + " | ".join("---" for _ in fields) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(field, "")) for field in fields) + " |")
    return lines


def write_report(summary: dict[str, Any]) -> None:
    role_fields = [
        "group", "levels", "touched", "entry_model_available", "touch_rate_pct",
        "entry_rate_vs_touched_pct", "avg_mfe_30m", "avg_mae_30m", "hit_4pt_30m_rate",
    ]
    saty_fields = [
        "group", "levels", "entry_model_available", "avg_mfe_30m", "avg_mae_30m",
        "hit_4pt_30m_rate", "mae_over_5pt_30m_rate",
    ]
    lines = [
        "# Mancini Full Level Overlap",
        "",
        "Research-only. No live trading authority.",
        "",
        "## Coverage",
        "",
        f"- Parsed Mancini event rows: {summary['totals']['rows']}",
        f"- Entry-model rows: {summary['totals']['entry_model_available']}",
        f"- Touched without entry model: {summary['totals']['touched_no_entry_model']}",
        f"- No-bars rows: {summary['status_counts'].get('no_bars_for_plan_date', 0)}",
        f"- ES unique timestamps: {summary['es_coverage'].get('es_unique_timestamp_count')}",
        f"- ES covered date span: {summary['es_coverage'].get('first_covered_date')} to {summary['es_coverage'].get('last_covered_date')}",
        "",
        "## Role Summary",
        "",
        *markdown_table(summary["by_role"], role_fields),
        "",
        "## Saty Confluence Buckets",
        "",
        *markdown_table(summary["by_saty_bucket"], saty_fields),
        "",
        "## Read",
        "",
        "- The existing levels show measurable historical responses on covered plan dates.",
        "- More ES data helps mainly where plan dates have no bars or partial coverage.",
        "- More Mancini logs help sample size more than squeezing the same 25 parsed sections harder.",
        "- Saty confluence should be tested as a filter first, not as a replacement level generator.",
        "- These are response stats, not production win rates or live-trading permission.",
    ]
    (OUT_DIR / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = read_csv(EVENTS)
    es_coverage = read_json(ES_AUDIT)
    status_counts = Counter(row.get("event_status") or "missing" for row in rows)
    role_summary = group_summary(rows, "primary_role")
    source_summary = group_summary(rows, "source_id")

    rows_with_saty = [dict(row, saty_bucket=saty_bucket(row)) for row in rows]
    saty_summary = group_summary(rows_with_saty, "saty_bucket")

    totals = metric_summary(rows)
    totals["rows"] = len(rows)
    summary = {
        "schema_version": 1,
        "review_only": True,
        "trading_authority": "none",
        "input_events": str(EVENTS.relative_to(ROOT)),
        "status_counts": dict(status_counts),
        "totals": totals,
        "by_role": role_summary,
        "by_source": source_summary,
        "by_saty_bucket": saty_summary,
        "es_coverage": es_coverage,
        "interpretation": {
            "existing_levels_show_historical_responses_on_covered_dates": True,
            "need_more_es_data_for_missing_or_partial_plan_dates": True,
            "need_more_mancini_logs_for_stronger_oos_sample": True,
            "saty_recommendation": "test_as_filter_before_level_generator",
            "metric_interpretation": "historical_response_stats_only",
        },
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    write_csv(OUT_DIR / "by_role.csv", role_summary)
    write_csv(OUT_DIR / "by_source.csv", source_summary)
    write_csv(OUT_DIR / "by_saty_bucket.csv", saty_summary)
    write_report(summary)
    print(json.dumps({
        "out_dir": str(OUT_DIR.relative_to(ROOT)),
        "rows": len(rows),
        "entry_model_available": totals["entry_model_available"],
        "status_counts": dict(status_counts),
        "review_only": True,
        "trading_authority": "none",
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
