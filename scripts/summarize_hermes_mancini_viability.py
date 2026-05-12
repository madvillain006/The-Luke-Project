#!/usr/bin/env python3
"""Summarize clean Hermes Mancini output into review-only viability hypotheses."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    if not path or str(path) in {"", "."} or not path.exists() or path.is_dir():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def by_packet(rows: list[dict]) -> dict[str, dict]:
    return {row.get("packet_id"): row for row in rows}


def metric(row: dict, name: str):
    return (row.get("bar_metrics") or {}).get(name)


def theory(row: dict, name: str):
    return (row.get("independent_theory_features") or {}).get(name)


def bucket_flush(value):
    if value is None:
        return "missing"
    if value < 5:
        return "shallow_under_5"
    if value < 10:
        return "medium_5_to_10"
    if value < 20:
        return "large_10_to_20"
    return "deep_20_plus"


def bucket_acceptance(value):
    if value is None:
        return "missing"
    if value <= 1:
        return "weak_0_to_1"
    if value <= 3:
        return "moderate_2_to_3"
    if value <= 10:
        return "strong_4_to_10"
    return "very_strong_10_plus"


def bucket_reclaim_minutes(value):
    if value is None:
        return "missing"
    if value <= 1:
        return "0_to_1"
    if value <= 3.5:
        return "2_to_3_5"
    if value <= 10:
        return "3_5_to_10"
    return "10_plus"


def bool_rate(rows: list[dict], field: str):
    values = [(row.get("source_outcome_metrics") or {}).get(field) for row in rows]
    clean = [value for value in values if isinstance(value, bool)]
    if not clean:
        return None
    return round(sum(1 for value in clean if value) / len(clean), 4)


def avg_metric(rows: list[dict], field: str):
    values = [(row.get("source_outcome_metrics") or {}).get(field) for row in rows]
    clean = [float(value) for value in values if isinstance(value, (int, float))]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 4)


def grouped_outcomes(rows: list[dict], key: str) -> dict:
    groups = defaultdict(list)
    for row in rows:
        groups[row[key]].append(row["_packet"])
    out = {}
    for bucket, packets in sorted(groups.items()):
        out[bucket] = {
            "count": len(packets),
            "hit_2pt_15m_rate": bool_rate(packets, "hit_2pt_15m"),
            "hit_4pt_15m_rate": bool_rate(packets, "hit_4pt_15m"),
            "avg_mfe_15m": avg_metric(packets, "mfe_15m"),
            "avg_mae_15m": avg_metric(packets, "mae_15m"),
            "hit_2pt_60m_rate": bool_rate(packets, "hit_2pt_60m"),
            "hit_4pt_60m_rate": bool_rate(packets, "hit_4pt_60m"),
            "avg_mfe_60m": avg_metric(packets, "mfe_60m"),
            "avg_mae_60m": avg_metric(packets, "mae_60m"),
        }
    return out


def make_summary(packets: list[dict], hermes_rows: list[dict]) -> dict:
    hermes_by_id = by_packet(hermes_rows)
    rows = []
    for packet in packets:
        packet_id = packet.get("packet_id")
        hermes = hermes_by_id.get(packet_id, {})
        rows.append({
            "_packet": packet,
            "packet_id": packet_id,
            "level": metric(packet, "level"),
            "flush_points": metric(packet, "flush_points"),
            "flush_bucket": bucket_flush(metric(packet, "flush_points")),
            "trap_volume": metric(packet, "trap_candle_volume"),
            "wick_to_body": metric(packet, "trap_candle_wick_to_body"),
            "acceptance_closes": metric(packet, "acceptance_consecutive_1m_closes_above_level"),
            "acceptance_bucket": bucket_acceptance(metric(packet, "acceptance_consecutive_1m_closes_above_level")),
            "reclaim_minutes_from_trap": theory(packet, "reclaim_minutes_from_trap_candle"),
            "reclaim_time_bucket": bucket_reclaim_minutes(theory(packet, "reclaim_minutes_from_trap_candle")),
            "reclaim_2_to_3_5_match": theory(packet, "reclaim_2_to_3_5_minute_hypothesis_match"),
            "unsupported": (hermes.get("assumptions_audit") or {}).get("unsupported", []),
            "overfit_risks": (hermes.get("hallucination_audit") or {}).get("single_packet_overfit_risks", []),
        })

    counters = {
        "flush_buckets": Counter(row["flush_bucket"] for row in rows),
        "acceptance_buckets": Counter(row["acceptance_bucket"] for row in rows),
        "unsupported": Counter(item for row in rows for item in row["unsupported"]),
        "hypothesis_names": Counter(item for row in hermes_rows for item in row.get("hypothetical_signatures", [])),
    }

    why = [
        "Pattern evidence exists in multiple packets.",
        "Universal close count, stop formula, and volume threshold remain unsupported.",
    ]
    if hermes_rows:
        why.insert(0, "Clean Hermes baseline has no validator issues.")
    else:
        why.insert(0, "This is a pre-Hermes packet/outcome summary.")
    why.append("Sample is still research-only and must not be promoted to NinjaScript.")

    return {
        "review_only": True,
        "trading_authority": "none",
        "packet_count": len(rows),
        "rows": [{key: value for key, value in row.items() if key != "_packet"} for row in rows],
        "aggregate": {
            "flush_buckets": dict(counters["flush_buckets"]),
            "acceptance_buckets": dict(counters["acceptance_buckets"]),
            "reclaim_time_buckets": dict(Counter(row["reclaim_time_bucket"] for row in rows)),
            "unsupported_assumptions": dict(counters["unsupported"]),
            "hypotheses_to_test": dict(counters["hypothesis_names"]),
            "outcomes_by_reclaim_time_bucket": grouped_outcomes(rows, "reclaim_time_bucket"),
            "outcomes_by_acceptance_bucket": grouped_outcomes(rows, "acceptance_bucket"),
            "outcomes_by_flush_bucket": grouped_outcomes(rows, "flush_bucket"),
        },
        "viability_readout": {
            "status": "research_viable_not_strategy_viable",
            "why": why,
            "next_tests": [
                "Run packet builder over crop-ready events.csv rows, not only examples.csv.",
                "Bucket outcomes by reclaim time, especially 0-1, 2-3.5, 3.5-10, and 10+ minutes.",
                "Compare acceptance closes 1, 2-3, 4-10, and 10+ against post-entry MFE/MAE.",
                "Test trap candle volume ratio and wick/body as filters, not rules.",
                "Keep NinjaScript blocked until out-of-sample review-only evidence survives.",
            ],
        },
    }


def write_markdown(summary: dict, path: Path) -> None:
    lines = [
        "# Hermes Mancini Viability Summary",
        "",
        "Review-only. Trading authority: none.",
        "",
        f"Packets: {summary['packet_count']}",
        "",
        "## Status",
        "",
        f"{summary['viability_readout']['status']}",
        "",
        "## Why",
        "",
    ]
    lines.extend(f"- {item}" for item in summary["viability_readout"]["why"])
    lines.extend(["", "## Aggregate", ""])
    for key, value in summary["aggregate"].items():
        lines.append(f"- {key}: `{json.dumps(value, sort_keys=True)}`")
    lines.extend(["", "## Next Tests", ""])
    lines.extend(f"- {item}" for item in summary["viability_readout"]["next_tests"])
    lines.extend(["", "## Packet Rows", ""])
    for row in summary["rows"]:
        lines.append(f"- `{row['packet_id']}`: flush={row['flush_points']}, acceptance_closes={row['acceptance_closes']}, reclaim_minutes={row['reclaim_minutes_from_trap']}, unsupported={row['unsupported']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    packets = load_jsonl(Path(args.packets))
    hermes = load_jsonl(Path(args.hermes)) if args.hermes else []
    summary = make_summary(packets, hermes)
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_markdown(summary, out_md)
    print(json.dumps({"out_json": str(out_json), "out_md": str(out_md), "packet_count": summary["packet_count"]}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packets", default="artifacts/research/hermes-mancini-packets/hermes_packets.jsonl")
    parser.add_argument("--hermes", default="", help="Optional clean Hermes JSONL output")
    parser.add_argument("--out-json", default="artifacts/research/hermes-mancini-packets/viability_summary.json")
    parser.add_argument("--out-md", default="artifacts/research/hermes-mancini-packets/VIABILITY_SUMMARY.md")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
