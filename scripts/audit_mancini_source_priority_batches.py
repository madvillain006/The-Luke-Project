#!/usr/bin/env python3
"""Audit Hermes source-priority batches for provenance and safety boundaries."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BATCH_DIR = ROOT / "artifacts/research/mancini-hermes-source-priority-batches"
OUT = ROOT / "artifacts/research/mancini-hermes-source-priority-batches/audit.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def main() -> int:
    manifest = load_json(BATCH_DIR / "batch_manifest.json")
    errors: list[str] = []
    warnings: set[str] = set()
    counts = {
        "batches": len(manifest.get("batches") or []),
        "all_real_packets": 0,
        "explicit_narrative": 0,
        "accepted_timing": 0,
        "excluded_timing": 0,
        "price_only_provenance": 0,
    }
    packet_ids = set()
    for batch in manifest.get("batches") or []:
        path = ROOT / batch["path"]
        if not path.exists():
            errors.append(f"missing_batch={batch['path']}")
            continue
        rows = load_jsonl(path)
        if len(rows) != batch.get("row_count"):
            errors.append(f"batch_count_mismatch={batch['name']} expected={batch.get('row_count')} got={len(rows)}")
        if batch["name"] == "batch_00_all_real_packets":
            counts["all_real_packets"] = len(rows)
            packet_ids = {row.get("packet_id") for row in rows}
        if batch["name"] == "batch_01_explicit_narrative":
            counts["explicit_narrative"] = len(rows)
        if batch["name"] == "batch_05_accepted_timing_only":
            counts["accepted_timing"] = len(rows)
        if batch["name"] == "batch_06_excluded_timing_review":
            counts["excluded_timing"] = len(rows)
        if batch["name"] == "batch_07_raw_price_only_provenance_review":
            counts["price_only_provenance"] = len(rows)
        for row in rows:
            packet_id = row.get("packet_id")
            if row.get("review_only") is not True or row.get("trading_authority") != "none":
                errors.append(f"missing_review_boundary={batch['name']}:{packet_id}")
            chart = row.get("chart_evidence") or {}
            if chart.get("data_class") != "historical_packet_window":
                errors.append(f"non_historical_chart_in_batch={batch['name']}:{packet_id}")
            if row.get("mancini_source_priority") is not True:
                errors.append(f"missing_mancini_source_priority={batch['name']}:{packet_id}")
            raw = row.get("raw_mancini_source") or {}
            if not raw.get("source_path"):
                errors.append(f"missing_raw_source_path={batch['name']}:{packet_id}")
            if raw.get("match_quality") in {"not_found", "missing_raw_source_path", None}:
                errors.append(f"bad_raw_match={batch['name']}:{packet_id}:{raw.get('match_quality')}")
            if raw.get("match_quality") == "price_only":
                warnings.add(f"price_only_raw_match={packet_id}")
            if row.get("metric_interpretation") != "observational_only":
                errors.append(f"bad_metric_interpretation={batch['name']}:{packet_id}")
            policy = row.get("timing_stat_policy") or {}
            if batch["name"] == "batch_05_accepted_timing_only" and policy.get("accepted_for_timing_test") is not True:
                errors.append(f"non_accepted_in_accepted_batch={packet_id}")
            if batch["name"] == "batch_06_excluded_timing_review" and policy.get("excluded_from_timing_stats") is not True:
                errors.append(f"non_excluded_in_excluded_batch={packet_id}")
            if batch["name"] == "batch_07_raw_price_only_provenance_review" and raw.get("match_quality") != "price_only":
                errors.append(f"non_price_only_in_price_only_batch={packet_id}")

    if counts["all_real_packets"] != 172:
        errors.append(f"all_packet_count_expected_172_got_{counts['all_real_packets']}")
    if len(packet_ids) != counts["all_real_packets"]:
        errors.append("duplicate_packet_ids_in_all_real_packets")
    if counts["accepted_timing"] != 128:
        errors.append(f"accepted_timing_expected_128_got_{counts['accepted_timing']}")
    if counts["excluded_timing"] != 44:
        errors.append(f"excluded_timing_expected_44_got_{counts['excluded_timing']}")
    if counts["price_only_provenance"] != 13:
        errors.append(f"price_only_expected_13_got_{counts['price_only_provenance']}")

    report = {
        "review_only": True,
        "trading_authority": "none",
        "counts": counts,
        "errors": errors,
        "warnings": sorted(warnings),
        "pass": not errors,
    }
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
