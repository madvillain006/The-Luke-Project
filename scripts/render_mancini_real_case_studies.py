#!/usr/bin/env python3
"""Render curated real Mancini case-study charts from packet windows.

These are historical/research visual aids. They are not simulated and they do
not grant strategy or live-trading authority.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import render_mancini_packet_charts as charts  # noqa: E402


ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
PACKETS = ROOT / "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl"
OUT_DIR = ROOT / "artifacts/research/mancini-real-case-studies"
TARGET_CHART_COUNT = 36


CASES = [
    {
        "case_id": "may4_7212_7213_major_failed_breakdown",
        "packet_id": "mancini-es1m:2026-05-04T1120:7212.0:3aa4c0792b84",
        "case_title": "Real Case - May 4 7212/7213 Major Failed Breakdown",
        "case_note": (
            "Mancini later described this as the 12:20PM 7213 failed breakdown: "
            "big 6:20AM low swept, recovered, and ripped. Packet level is 7212 "
            "from the daily support list, effectively the same zone."
        ),
        "newsletter_reference": (
            "Why 7199 and where was the Failed Breakdown here? 7199 backtested the week long "
            "consolidation we broke out last Thursday, but shortly after - around 12:20PM Monday- "
            "ES recovered a major low set at 6:20AM Monday at 7213 and rallied."
        ),
    },
    {
        "case_id": "may4_7205_quick_reclaim",
        "packet_id": "mancini-es1m:2026-05-04T1111:7205.0:53db965edf54",
        "case_title": "Real Case - May 4 7205 Quick Reclaim",
        "case_note": (
            "Actual 1m packet in the same elevator-down sequence as the 7212/7213 case. "
            "Useful for the 2-3.5 minute reclaim hypothesis because it reclaims in 3 minutes."
        ),
        "newsletter_reference": "Supports are: 7205",
    },
    {
        "case_id": "may5_7266_to_7213_elevator_sell",
        "packet_id": "mancini-es1m:2026-05-05T0717:7266.0:91f893b01585",
        "case_title": "Real Case - May 5 7266 To 7213 Elevator Sell",
        "case_note": (
            "Newsletter text explicitly references the elevator-down move from 7266 to 7213. "
            "This chart is a real packet around the 7266 failed-breakdown level."
        ),
        "newsletter_reference": (
            "Monday Morning and the 8am 7240 Failed Breakdown ... elevator down sell at 6am "
            "from 7266 to 7213."
        ),
    },
    {
        "case_id": "may7_7355_over_7345_failed_breakdown",
        "packet_id": "mancini-es1m:2026-05-07T1237:7355.0:3a8cb95abc7c",
        "case_title": "Real Case - May 7 7355 Over 7345 Failed Breakdown",
        "case_note": (
            "Direct newsletter instruction: defend 7345, then recover 7355. "
            "The actual packet flushes to 7345.75 and reclaims 7355."
        ),
        "newsletter_reference": "A much safer entry is to wait for 7345 to defend, then recover 7355 to get long.",
    },
    {
        "case_id": "may7_7369_first_support_caution",
        "packet_id": "mancini-es1m:2026-05-07T1118:7369.0:4e3777c6272c",
        "case_title": "Real Case - May 7 7369 First Support Caution",
        "case_note": (
            "Mancini called 7369 first support and lower quality. This is useful as a caution/control "
            "visual, not as a clean accepted timing-row example."
        ),
        "newsletter_reference": (
            "7369 is 1st support down... If we can wick below 7369 and recover its a possible "
            "desperation long but not one I'd engage."
        ),
    },
]


def score_row(row: dict[str, str]) -> tuple[float, float, float]:
    def num(value: str) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    return (
        num(row.get("mfe_15m")),
        num(row.get("flush_points")),
        -num(row.get("mae_15m")),
    )


def auto_case_note(row: dict[str, str]) -> str:
    family = row.get("acceptance_family") or "unclassified"
    bucket = row.get("reclaim_time_bucket") or "missing"
    flush = row.get("flush_points") or "missing"
    return (
        f"Auto-selected real packet example. Family={family}; timing_bucket={bucket}; "
        f"flush_points={flush}. Use for visual/Hermes review, not standalone proof."
    )


def build_auto_cases(rows_by_id: dict[str, dict[str, str]], pinned_ids: set[str]) -> list[dict[str, str]]:
    candidates = [
        row for row in rows_by_id.values()
        if row.get("accepted_for_timing_test") == "True"
        and row.get("packet_id") not in pinned_ids
        and row.get("window_csv")
        and row.get("level")
    ]
    by_family: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in candidates:
        by_family[row.get("acceptance_family") or "missing"].append(row)
    for family_rows in by_family.values():
        family_rows.sort(key=score_row, reverse=True)

    selected: list[dict[str, str]] = []
    families = [
        "non_acceptance_protocol",
        "classic_acceptance_backtest_from_below",
        "classic_acceptance_second_attempt_reclaim",
        "simple_reclaim_unclassified",
    ]
    per_family_target = max(1, (TARGET_CHART_COUNT - len(CASES)) // len(families))
    for family in families:
        selected.extend(by_family.get(family, [])[:per_family_target])

    if len(selected) < TARGET_CHART_COUNT - len(CASES):
        remaining = [
            row for row in candidates
            if row.get("packet_id") not in {item.get("packet_id") for item in selected}
        ]
        remaining.sort(key=score_row, reverse=True)
        selected.extend(remaining[: TARGET_CHART_COUNT - len(CASES) - len(selected)])

    auto_cases = []
    for row in selected[: max(0, TARGET_CHART_COUNT - len(CASES))]:
        packet_id = row["packet_id"]
        level = str(row.get("level") or "level").replace(".", "_")
        timestamp_part = packet_id.split(":")[1].replace("-", "").replace("T", "_") if ":" in packet_id else "unknown_time"
        case_id = f"auto_{timestamp_part}_{level}_{row.get('acceptance_family')}"
        label = row.get("source_label") or "source text unavailable"
        auto_cases.append({
            "case_id": case_id,
            "packet_id": packet_id,
            "case_title": f"Real Case - {row.get('acceptance_family')} {row.get('level')}",
            "case_note": auto_case_note(row),
            "newsletter_reference": label[:500],
        })
    return auto_cases


def main() -> int:
    rows_by_id = {row["packet_id"]: row for row in charts.load_rows(ROWS)}
    packets = charts.load_jsonl(PACKETS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pinned_ids = {case["packet_id"] for case in CASES}
    all_cases = [*CASES, *build_auto_cases(rows_by_id, pinned_ids)]
    manifest = []
    index_lines = [
        "# Mancini Real Case Study Charts",
        "",
        "Historical packet-window charts tied to specific newsletter references.",
        "Review-only. No live trading authority.",
        "",
    ]
    for index, case in enumerate(all_cases, start=1):
        packet_id = case["packet_id"]
        if packet_id not in rows_by_id:
            raise SystemExit(f"Missing row for packet_id: {packet_id}")
        if packet_id not in packets:
            raise SystemExit(f"Missing packet for packet_id: {packet_id}")
        row = dict(rows_by_id[packet_id])
        row["case_title"] = case["case_title"]
        row["case_note"] = case["case_note"]
        row["case_source_quote"] = case["newsletter_reference"]
        if case["newsletter_reference"] and case["newsletter_reference"] not in (row.get("source_label") or ""):
            row["source_label"] = f"{row.get('source_label') or ''} | Newsletter reference: {case['newsletter_reference']}".strip(" |")
        out_path = OUT_DIR / f"{index:02d}_{case['case_id']}.svg"
        charts.render_chart(row, packets[packet_id], out_path)
        manifest_row = {
            **case,
            "chart_path": str(out_path.relative_to(ROOT)),
            "png_path": str(out_path.with_suffix(".png").relative_to(ROOT)),
            "level": row.get("level"),
            "acceptance_family": row.get("acceptance_family"),
            "reclaim_time_bucket": row.get("reclaim_time_bucket"),
            "accepted_for_timing_test": row.get("accepted_for_timing_test"),
            "flush_points": row.get("flush_points"),
            "reclaim_minutes_from_trap": row.get("reclaim_minutes_from_trap"),
            "mfe_15m": row.get("mfe_15m"),
            "mae_15m": row.get("mae_15m"),
            "review_only": True,
            "trading_authority": "none",
        }
        manifest.append(manifest_row)
        index_lines.append(f"## {case['case_title']}")
        index_lines.append("")
        index_lines.append(f"- Packet: `{packet_id}`")
        index_lines.append(f"- Chart: `{manifest_row['chart_path']}`")
        index_lines.append(f"- PNG: `{manifest_row['png_path']}`")
        index_lines.append(f"- Note: {case['case_note']}")
        index_lines.append("")
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    (OUT_DIR / "index.md").write_text("\n".join(index_lines), encoding="utf-8")
    print(json.dumps({
        "charts": len(manifest),
        "out_dir": str(OUT_DIR.relative_to(ROOT)),
        "manifest": str((OUT_DIR / "manifest.json").relative_to(ROOT)),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
