#!/usr/bin/env python3
"""Extract timestamped Mancini social/live-update events for Hermes review packets.

This is intentionally separate from nightly plan parsing. The output is useful
for Hermes/examples, but is not a daily-plan source and should not drive core
statistics without manual review.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/research/mancini/The Mancini Logs 3-15-2026 - 5-6-2026.txt"
OUT_DIR = ROOT / "artifacts/research/mancini-social-events"
OUT_CSV = OUT_DIR / "events.csv"
OUT_JSON = OUT_DIR / "summary.json"

STAMP_RE = re.compile(r"(?P<date>\d{2}/\d{2}/20\d{2})\s+(?P<time>\d{1,2}:\d{2})(?P<ampm>AM|PM)", re.I)
PRICE_RE = re.compile(r"\b([6-8]\d{3}(?:\.\d{1,2})?)\b")
SETUP_RE = re.compile(r"failed breakdown|reclaim|recovered|swept|sweep|trap|traps|daily low|support", re.I)


def iso_et(date_text: str, time_text: str, ampm: str) -> str:
    month, day, year = [int(part) for part in date_text.split("/")]
    hour, minute = [int(part) for part in time_text.split(":")]
    ampm = ampm.upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00-04:00"


def classify(text: str) -> str:
    lower = text.lower()
    if "failed breakdown" in lower:
        return "FAILED_BREAKDOWN_RECLAIM"
    if "reclaim" in lower or "recovered" in lower:
        return "LEVEL_RECLAIM_OR_RECOVERY"
    if "support" in lower:
        return "SUPPORT_CONTEXT"
    return "SOCIAL_PRICE_ACTION_CONTEXT"


def main() -> int:
    rows = []
    for line_number, line in enumerate(SOURCE.read_text(encoding="utf-8-sig").splitlines(), start=1):
        stamp = STAMP_RE.search(line)
        if not stamp or not SETUP_RE.search(line):
            continue
        prices = []
        for match in PRICE_RE.finditer(line):
            price = float(match.group(1))
            if price not in prices:
                prices.append(price)
        if not prices:
            continue
        timestamp = iso_et(stamp.group("date"), stamp.group("time"), stamp.group("ampm"))
        for price in prices:
            rows.append({
                "id": f"social:{line_number}:{price}",
                "source_id": "mancini-social-live-log",
                "source_kind": "social_event_text",
                "source_path": str(SOURCE.relative_to(ROOT)),
                "source_line": line_number,
                "timestamp_et": timestamp,
                "price": price,
                "primary_role": classify(line),
                "source_snippet": line.strip()[:500],
                "review_only": True,
                "trading_authority": "none",
            })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else ["id"])
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "review_only": True,
        "trading_authority": "none",
        "source": str(SOURCE.relative_to(ROOT)),
        "events": len(rows),
        "unique_lines": len(set(row["source_line"] for row in rows)),
        "note": "Timestamped social/live-update events only. Not daily-plan extraction.",
    }
    OUT_JSON.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
