#!/usr/bin/env python3
"""Audit local ES 1m coverage against parsed Mancini event dates.

Research-only. Reads local CSV/artifact files and writes a compact JSON report.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
OUT = ROOT / "artifacts/research/hermes-mancini-event-packets/es_coverage_audit.json"


def parse_ts(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text or text.lower().startswith("downloaded from"):
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def es_bar_files() -> list[Path]:
    files: list[Path] = []
    for root in [ROOT / "data", ROOT / "artifacts"]:
        if not root.exists():
            continue
        for path in root.rglob("*.csv"):
            name = path.name.lower()
            if name.startswith(("esh", "esm", "esu", "esz")) and "intraday-1min" in name:
                files.append(path)
    return sorted(set(files))


def inspect_csv(path: Path) -> dict:
    first = None
    last = None
    count = 0
    row_dates: set[str] = set()
    timestamp_keys: set[str] = set()
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            normalized = {str(k).strip().lower(): v for k, v in row.items()}
            ts = parse_ts(normalized.get("time") or normalized.get("timestamp") or normalized.get("date") or "")
            if ts is None:
                continue
            first = ts if first is None or ts < first else first
            last = ts if last is None or ts > last else last
            row_dates.add(ts.date().isoformat())
            timestamp_keys.add(ts.isoformat(sep=" "))
            count += 1
    return {
        "path": str(path.relative_to(ROOT)),
        "rows": count,
        "first_timestamp": first.isoformat(sep=" ") if first else None,
        "last_timestamp": last.isoformat(sep=" ") if last else None,
        "actual_row_date_count": len(row_dates),
        "_row_dates": sorted(row_dates),
        "_timestamp_keys": sorted(timestamp_keys),
    }


def session_date_from_event_timestamp(value: str) -> str | None:
    ts = parse_ts(value)
    if ts is None:
        return None
    return ts.date().isoformat()


def event_counts() -> dict:
    if not EVENTS.exists():
        return {}
    by_date: dict[str, Counter] = defaultdict(Counter)
    with EVENTS.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            plan_date = row.get("plan_date") or "missing"
            by_date[plan_date][row.get("event_status") or "missing"] += 1
    return {date: dict(counts) for date, counts in sorted(by_date.items())}


def event_source_counts() -> dict:
    if not EVENTS.exists():
        return {}
    by_date: dict[str, dict[str, Any]] = {}
    with EVENTS.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            plan_date = row.get("plan_date") or "missing"
            source_id = row.get("source_id") or "missing"
            item = by_date.setdefault(plan_date, {"rows": 0, "sources": Counter(), "max_bars_in_session": 0})
            item["rows"] += 1
            item["sources"][source_id] += 1
            try:
                bars = int(float(row.get("bars_in_session") or 0))
            except ValueError:
                bars = 0
            item["max_bars_in_session"] = max(item["max_bars_in_session"], bars)
    return {
        date: {
            "rows": item["rows"],
            "sources": dict(sorted(item["sources"].items())),
            "max_bars_in_session": item["max_bars_in_session"],
        }
        for date, item in sorted(by_date.items())
    }


def span_dates(files: list[dict]) -> list[str]:
    dates: set[str] = set()
    for item in files:
        first = parse_ts(item.get("first_timestamp") or "")
        last = parse_ts(item.get("last_timestamp") or "")
        if not first or not last:
            continue
        current = first.date()
        end = last.date()
        while current <= end:
            dates.add(current.isoformat())
            current += timedelta(days=1)
    return sorted(dates)


def actual_dates(files: list[dict]) -> list[str]:
    dates: set[str] = set()
    for item in files:
        dates.update(item.get("_row_dates") or [])
    return sorted(dates)


def unique_timestamp_count(files: list[dict]) -> int:
    keys: set[str] = set()
    for item in files:
        keys.update(item.get("_timestamp_keys") or [])
    return len(keys)


def compact_date_ranges(dates: list[str]) -> list[str]:
    if not dates:
        return []
    parsed = [datetime.strptime(date, "%Y-%m-%d").date() for date in dates]
    ranges: list[str] = []
    start = parsed[0]
    prev = parsed[0]
    for current in parsed[1:]:
        if current == prev + timedelta(days=1):
            prev = current
            continue
        ranges.append(start.isoformat() if start == prev else f"{start.isoformat()}..{prev.isoformat()}")
        start = current
        prev = current
    ranges.append(start.isoformat() if start == prev else f"{start.isoformat()}..{prev.isoformat()}")
    return ranges


def date_span(start: str | None, end: str | None) -> list[str]:
    if not start or not end:
        return []
    current = datetime.strptime(start, "%Y-%m-%d").date()
    final = datetime.strptime(end, "%Y-%m-%d").date()
    dates: list[str] = []
    while current <= final:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def main() -> int:
    inspected_files = [inspect_csv(path) for path in es_bar_files()]
    covered_dates = set(actual_dates(inspected_files))
    span_covered_dates = set(span_dates(inspected_files))
    counts = event_counts()
    source_counts = event_source_counts()
    plan_dates = set(counts)
    missing_plan_dates = sorted(date for date in plan_dates if date not in covered_dates)
    span_gap_dates = sorted(date for date in span_covered_dates if date not in covered_dates)
    first_covered = min(covered_dates) if covered_dates else None
    last_covered = max(covered_dates) if covered_dates else None
    global_gap_dates = sorted(date for date in date_span(first_covered, last_covered) if date not in covered_dates)
    files = [
        {key: value for key, value in item.items() if not key.startswith("_")}
        for item in inspected_files
    ]
    report = {
        "review_only": True,
        "trading_authority": "none",
        "es_file_count": len(files),
        "es_total_rows": sum(item["rows"] for item in files),
        "es_unique_timestamp_count": unique_timestamp_count(inspected_files),
        "es_files": files,
        "covered_date_count": len(covered_dates),
        "span_date_count_if_first_to_last_expanded": len(span_covered_dates),
        "first_covered_date": first_covered,
        "last_covered_date": last_covered,
        "calendar_gap_ranges_inside_file_spans": compact_date_ranges(span_gap_dates),
        "calendar_gap_ranges_global_first_to_last": compact_date_ranges(global_gap_dates),
        "mancini_plan_date_count": len(plan_dates),
        "mancini_plan_dates_missing_es_coverage": missing_plan_dates,
        "mancini_plan_date_status_counts": counts,
        "mancini_plan_date_source_counts": source_counts,
        "note": "Coverage dates are actual calendar dates present in CSV rows; context parser separately applies ET session rules.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
