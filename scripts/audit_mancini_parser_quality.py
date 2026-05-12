#!/usr/bin/env python3
"""Audit Mancini parser artifact quality.

Checks are research-only and designed to catch source/level contamination before
Hermes packet generation.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LEVELS = ROOT / "artifacts/research/mancini-context-protocol/level-protocol.csv"
OUT = ROOT / "artifacts/research/mancini-context-protocol/parser-quality-audit.json"


def main() -> int:
    rows = list(csv.DictReader(LEVELS.open(newline="", encoding="utf-8-sig")))
    snippet_without_full_price = []
    direction_by_level: dict[tuple[str, str], set[str]] = defaultdict(set)
    source_kind_counts = defaultdict(int)
    role_counts = defaultdict(int)

    for row_number, row in enumerate(rows, start=2):
        price = str(int(float(row["price"]))) if row.get("price") else ""
        snippet = row.get("snippet") or ""
        if snippet and price and price not in snippet:
            snippet_without_full_price.append({
                "row": row_number,
                "plan_date": row.get("plan_date"),
                "price": row.get("price"),
                "source": row.get("source"),
                "snippet": snippet[:240],
            })
        direction_by_level[(row.get("plan_date") or "", row.get("price") or "")].add(row.get("direction") or "")
        source_kind_counts[row.get("source_kind") or "missing"] += 1
        role_counts[row.get("primary_role") or "missing"] += 1

    direction_conflicts = [
        {"plan_date": key[0], "price": key[1], "directions": sorted(value)}
        for key, value in sorted(direction_by_level.items())
        if len(value) > 1
    ]

    report = {
        "review_only": True,
        "trading_authority": "none",
        "level_rows": len(rows),
        "snippet_without_full_price_count": len(snippet_without_full_price),
        "snippet_without_full_price_examples": snippet_without_full_price[:25],
        "plan_date_price_direction_conflict_count": len(direction_conflicts),
        "plan_date_price_direction_conflict_examples": direction_conflicts[:25],
        "source_kind_counts": dict(sorted(source_kind_counts.items())),
        "primary_role_counts": dict(sorted(role_counts.items())),
        "pass": len(snippet_without_full_price) == 0,
        "notes": [
            "Direction conflicts are not always parser errors; a level can be support and resistance in different contexts.",
            "Snippet/full-price failures are hard failures because Hermes cannot audit evidence that omits the claimed level.",
        ],
    }
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
