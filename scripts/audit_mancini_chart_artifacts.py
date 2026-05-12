#!/usr/bin/env python3
"""Audit Mancini chart artifacts for count and safety-label consistency."""

from __future__ import annotations

import json
import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/research/mancini-chart-artifact-audit.json"

SIM_DIR = ROOT / "artifacts/research/mancini-methodology/simulated-traditional-charts"
REAL_DIR = ROOT / "artifacts/research/mancini-real-case-studies"
GALLERY_DIR = ROOT / "artifacts/research/mancini-real-packet-gallery"
NIGHTLY_DIR = ROOT / "artifacts/research/hermes-mancini-event-packets/charts"
SOCIAL_DIR = ROOT / "artifacts/research/hermes-mancini-social-event-packets/charts"
PACKETS = ROOT / "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl"
ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def load_csv(path: Path) -> list[dict]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def count_files(path: Path, suffix: str) -> int:
    return len(list(path.glob(f"*{suffix}")))


def exists_relative(path_text: str) -> bool:
    return (ROOT / path_text).exists()


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    sim_manifest = load_json(SIM_DIR / "manifest.json")
    sim_packets = load_jsonl(SIM_DIR / "methodology_sim_packets.jsonl")
    real_manifest = load_json(REAL_DIR / "manifest.json")
    gallery_manifest = load_json(GALLERY_DIR / "manifest.json")
    gallery_summary = load_json(GALLERY_DIR / "summary.json")
    nightly_manifest = load_json(NIGHTLY_DIR / "manifest.json")
    social_manifest = load_json(SOCIAL_DIR / "manifest.json")
    nightly_packets = {row.get("packet_id") for row in load_jsonl(PACKETS)}
    packet_rows = load_csv(ROWS)
    packet_row_ids = {row.get("packet_id") for row in packet_rows}

    if len(sim_manifest) != 5:
        errors.append(f"simulated_manifest_count_expected_5_got_{len(sim_manifest)}")
    if len(sim_packets) != 5:
        errors.append(f"simulated_packet_count_expected_5_got_{len(sim_packets)}")
    if len(real_manifest) < 30:
        errors.append(f"real_case_count_expected_at_least_30_got_{len(real_manifest)}")
    if len(gallery_manifest) != len(packet_rows):
        errors.append(f"gallery_count_expected_{len(packet_rows)}_got_{len(gallery_manifest)}")
    if gallery_summary.get("rows") != len(packet_rows):
        errors.append(f"gallery_summary_rows_expected_{len(packet_rows)}_got_{gallery_summary.get('rows')}")

    old_sim_files = [
        path.name for path in [*SIM_DIR.glob("*.svg"), *SIM_DIR.glob("*.png")]
        if "sim_review_only" not in path.name
        and path.name not in {"index.md", "manifest.json", "methodology_sim_packets.jsonl"}
    ]
    if old_sim_files:
        errors.append(f"ambiguous_simulated_filenames_remaining={old_sim_files[:10]}")

    for row in sim_packets:
        if row.get("performance_data") is not False:
            errors.append(f"simulated_packet_missing_performance_data_false={row.get('packet_id')}")
        if row.get("exclude_from_performance") is not True:
            errors.append(f"simulated_packet_missing_exclude_from_performance={row.get('packet_id')}")
        if row.get("data_class") != "synthetic_review_only":
            errors.append(f"simulated_packet_wrong_data_class={row.get('packet_id')}")
        chart_path = row.get("chart_path") or ""
        if "sim_review_only" not in chart_path:
            errors.append(f"simulated_chart_path_missing_sim_review_only={chart_path}")
        if chart_path and not exists_relative(chart_path):
            errors.append(f"missing_simulated_chart={chart_path}")
        png_path = str(ROOT / chart_path).replace(".svg", ".png") if chart_path else ""
        if png_path and not Path(png_path).exists():
            errors.append(f"missing_simulated_png={png_path}")

    for row in real_manifest:
        packet_id = row.get("packet_id")
        if packet_id not in nightly_packets:
            errors.append(f"real_case_packet_missing_from_hermes_packets={packet_id}")
        for field in ("chart_path", "png_path"):
            path_text = row.get(field) or ""
            if not path_text or not exists_relative(path_text):
                errors.append(f"real_case_missing_{field}={packet_id}:{path_text}")
        if not row.get("newsletter_reference"):
            warnings.append(f"real_case_missing_newsletter_reference={packet_id}")
        if row.get("review_only") is not True or row.get("trading_authority") != "none":
            errors.append(f"real_case_missing_review_only_boundary={packet_id}")

    gallery_packet_ids = set()
    raw_match_quality_counts: dict[str, int] = {}
    for row in gallery_manifest:
        packet_id = row.get("packet_id")
        gallery_packet_ids.add(packet_id)
        if packet_id not in nightly_packets:
            errors.append(f"gallery_packet_missing_from_hermes_packets={packet_id}")
        if packet_id not in packet_row_ids:
            errors.append(f"gallery_packet_missing_from_acceptance_rows={packet_id}")
        for field in ("chart_path", "png_path"):
            path_text = row.get(field) or ""
            if not path_text or not exists_relative(path_text):
                errors.append(f"gallery_missing_{field}={packet_id}:{path_text}")
        if row.get("mancini_source_priority") is not True:
            errors.append(f"gallery_missing_mancini_source_priority={packet_id}")
        raw_source = row.get("raw_mancini_source") or {}
        match_quality = raw_source.get("match_quality") or "missing"
        raw_match_quality_counts[match_quality] = raw_match_quality_counts.get(match_quality, 0) + 1
        if not raw_source.get("source_path"):
            errors.append(f"gallery_missing_raw_source_path={packet_id}")
        if match_quality in {"missing_raw_source_path", "not_found", "missing"}:
            errors.append(f"gallery_raw_source_not_found={packet_id}:{match_quality}")
        if match_quality == "price_only":
            warnings.append(f"gallery_raw_source_price_only_match={packet_id}")
        if not row.get("derived_source_evidence", {}).get("source_path"):
            errors.append(f"gallery_missing_derived_source_evidence={packet_id}")
        if not row.get("source_derivation_chain"):
            errors.append(f"gallery_missing_source_derivation_chain={packet_id}")
        if row.get("metric_interpretation") != "observational_only":
            errors.append(f"gallery_missing_observational_metric_interpretation={packet_id}")
        if row.get("artifact_kind") != "real_mancini_packet_chart":
            errors.append(f"gallery_wrong_artifact_kind={packet_id}")
        if row.get("data_class") != "historical_packet_window":
            errors.append(f"gallery_wrong_data_class={packet_id}")
        if row.get("review_only") is not True or row.get("trading_authority") != "none":
            errors.append(f"gallery_missing_review_only_boundary={packet_id}")
        if not row.get("mancini_source_text"):
            warnings.append(f"gallery_missing_mancini_source_text={packet_id}")
    if gallery_packet_ids != packet_row_ids:
        errors.append("gallery_packet_id_set_mismatch_acceptance_rows")

    counts = {
        "nightly_png": count_files(NIGHTLY_DIR, ".png"),
        "social_png": count_files(SOCIAL_DIR, ".png"),
        "simulated_png": count_files(SIM_DIR, ".png"),
        "real_case_png": count_files(REAL_DIR, ".png"),
        "real_packet_gallery_png": count_files(GALLERY_DIR, ".png"),
        "nightly_manifest": len(nightly_manifest),
        "social_manifest": len(social_manifest),
        "simulated_manifest": len(sim_manifest),
        "real_case_manifest": len(real_manifest),
        "real_packet_gallery_manifest": len(gallery_manifest),
    }
    counts["total_png"] = (
        counts["nightly_png"]
        + counts["social_png"]
        + counts["simulated_png"]
        + counts["real_case_png"]
        + counts["real_packet_gallery_png"]
    )

    report = {
        "review_only": True,
        "trading_authority": "none",
        "counts": counts,
        "raw_match_quality_counts": dict(sorted(raw_match_quality_counts.items())),
        "errors": errors,
        "warnings": warnings,
        "pass": not errors,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
