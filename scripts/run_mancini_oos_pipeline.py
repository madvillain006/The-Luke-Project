#!/usr/bin/env python3
"""Run the review-only Mancini Quick_Reclaim_Acceptance research pipeline.

This is deterministic research plumbing only. It rebuilds local Mancini context
artifacts, packetizes crop-ready rows, aggregates reclaim buckets, and reports
sample-size gaps. It does not touch strategy code, broker paths, or runtime
trading state.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
CONTEXT_METADATA = ROOT / "artifacts/research/mancini-context-protocol/metadata.json"
PACKET_DIR = ROOT / "artifacts/research/hermes-mancini-event-packets"
PACKETS = PACKET_DIR / "hermes_packets.jsonl"
SUMMARY = PACKET_DIR / "quick_reclaim_acceptance_summary.json"
SKIPPED = PACKET_DIR / "skipped.json"


def run_command(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def es_bar_files() -> list[Path]:
    roots = [
        ROOT / "data/historical",
        ROOT / "data/backtest",
        ROOT / "data/research/mancini",
    ]
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        files.extend(
            path for path in root.rglob("*.csv")
            if path.name.lower().startswith(("esh", "esm", "esu", "esz"))
            and "intraday-1min" in path.name.lower()
        )
    return sorted(set(files))


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def event_status_counts() -> dict[str, int]:
    if not EVENTS.exists():
        return {}
    return dict(Counter(row.get("event_status") or "missing" for row in csv_rows(EVENTS)))


def plan_date_gaps() -> dict[str, dict[str, int]]:
    if not EVENTS.exists():
        return {}
    rows = csv_rows(EVENTS)
    out: dict[str, Counter] = {}
    for row in rows:
        plan_date = row.get("plan_date") or "missing"
        out.setdefault(plan_date, Counter())[row.get("event_status") or "missing"] += 1
    return {date: dict(counts) for date, counts in sorted(out.items())}


def load_summary() -> dict:
    if not SUMMARY.exists():
        return {}
    return json.loads(SUMMARY.read_text(encoding="utf-8"))


def packet_count() -> int:
    if not PACKETS.exists():
        return 0
    return len([line for line in PACKETS.read_text(encoding="utf-8-sig").splitlines() if line.strip()])


def skipped_reason_counts() -> dict[str, int]:
    if not SKIPPED.exists():
        return {}
    rows = json.loads(SKIPPED.read_text(encoding="utf-8"))
    return dict(Counter(row.get("reason") or "missing" for row in rows if isinstance(row, dict)))


def source_map_counts() -> dict[str, int]:
    if not CONTEXT_METADATA.exists():
        return {}
    metadata = json.loads(CONTEXT_METADATA.read_text(encoding="utf-8"))
    counts: Counter[str] = Counter()
    for source in metadata.get("source_map") or []:
        kind = source.get("source_kind") or "missing"
        counts[kind] += 1
        if source.get("include_in_daily_plan_extraction"):
            counts["daily_plan_extraction_enabled"] += 1
        if source.get("include_in_methodology_rules"):
            counts["methodology_rules_enabled"] += 1
    return dict(counts)


def run_pipeline(args: argparse.Namespace) -> int:
    files = es_bar_files()
    if not files:
        raise SystemExit("No ES intraday 1m CSV files found under data/historical, data/backtest, or data/research/mancini.")

    if not args.skip_context:
        run_command(["node", "scripts/research-mancini-context-protocol.js"])

    run_command([
        "python",
        "scripts/build_hermes_mancini_packets.py",
        "--bars-csv",
        *[str(path.relative_to(ROOT)) for path in files],
        "--events",
        str(EVENTS.relative_to(ROOT)),
        "--out-dir",
        str(PACKET_DIR.relative_to(ROOT)),
        "--minutes",
        str(args.minutes),
        "--timezone-policy",
        "barchart-raw",
        "--require-full-window",
    ])

    run_command(["python", "scripts/aggregate_quick_reclaim_acceptance.py"])
    summary = load_summary()
    bucket_summary = summary.get("bucket_summary") or {}
    accepted = {
        bucket: (bucket_summary.get(bucket) or {}).get("accepted_for_timing_test_count", 0)
        for bucket in ("0_to_1", "1_to_2", "2_to_3_5", "3_5_to_10", "10_plus")
    }
    sample_gate = {
        bucket: {
            "accepted_for_timing_test_count": count,
            "needs_30": max(0, 30 - int(count or 0)),
            "passes_minimum": int(count or 0) >= 30,
        }
        for bucket, count in accepted.items()
    }

    status = {
        "review_only": True,
        "trading_authority": "none",
        "es_1m_csv_files": len(files),
        "events_csv": str(EVENTS),
        "packets_jsonl": str(PACKETS),
        "source_event_rows": sum(event_status_counts().values()),
        "generated_packet_rows": packet_count(),
        "accepted_timing_rows": summary.get("accepted_for_timing_test_count"),
        "excluded_timing_rows": summary.get("not_accepted_for_timing_test_count"),
        "pre_packet_skipped_source_rows": sum(skipped_reason_counts().values()),
        "pre_packet_skipped_reason_counts": skipped_reason_counts(),
        "packet_reject_reason_counts": summary.get("reject_reason_counts") or {},
        "quick_reclaim_summary": str(SUMMARY),
        "event_status_counts": event_status_counts(),
        "plan_date_status_counts": plan_date_gaps(),
        "source_map_counts": source_map_counts(),
        "sample_gate": sample_gate,
        "strategy_assumption": "failed_breakdown_market_pattern_assumed_viable",
        "machine_implementation_confidence": "not_100_percent_until_acceptance_modules_and_oos_gates_pass",
        "pipeline_confidence": "deterministic_after_inputs_are_fixed",
        "next_data_requirement": "Add enough ES 1m CSV coverage and Mancini plan levels to reach at least 30 accepted timing rows in 2_to_3_5 plus each populated comparison bucket.",
    }
    out_path = PACKET_DIR / "quick_reclaim_oos_pipeline_status.json"
    out_path.write_text(json.dumps(status, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(status, indent=2, sort_keys=True))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minutes", type=int, default=15)
    parser.add_argument("--skip-context", action="store_true", help="Reuse existing mancini-context-protocol/events.csv")
    return run_pipeline(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
