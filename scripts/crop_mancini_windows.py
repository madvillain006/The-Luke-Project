#!/usr/bin/env python3
"""Crop ES 1-minute bars around Mancini timestamps and summarize trap metrics.

This is an offline research helper. It reads local files only and never writes
runtime trading state. Event inputs may be JSON, JSONL, CSV, or free text.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
PRICE_RE = re.compile(r"\b([4-8]\d{3}(?:\.\d{1,2})?)\b")
ISO_TS_RE = re.compile(
    r"\b(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?(?:\s*(?:ET|EST|EDT))?(?:[+-]\d{2}:?\d{2})?\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    raw_timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None
    raw: dict[str, str]


@dataclass(frozen=True)
class Event:
    event_id: str
    timestamp: datetime
    level: float | None
    source_path: str
    source_line: int | None
    text: str


def parse_float(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if text == "":
        return None
    try:
        out = float(text)
    except ValueError:
        return None
    return out if math.isfinite(out) else None


def nth_weekday(year: int, month: int, weekday: int, occurrence: int) -> datetime:
    day = datetime(year, month, 1)
    offset = (weekday - day.weekday()) % 7
    return day + timedelta(days=offset + 7 * (occurrence - 1))


def et_tz_for_local(naive: datetime) -> timezone:
    """Return the US/Eastern offset for local naive time without tzdata."""
    dst_start = nth_weekday(naive.year, 3, 6, 2).replace(hour=2)
    dst_end = nth_weekday(naive.year, 11, 6, 1).replace(hour=2)
    offset_hours = -4 if dst_start <= naive < dst_end else -5
    return timezone(timedelta(hours=offset_hours))


def parse_timestamp(value: str) -> datetime:
    text = str(value).strip().strip('"')
    if not text:
        raise ValueError("empty timestamp")
    if text.endswith("Z"):
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.astimezone(et_tz_for_local(parsed.replace(tzinfo=None)))
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        parsed = datetime.strptime(text, "%Y-%m-%d %H:%M")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=et_tz_for_local(parsed))
    return parsed.astimezone(et_tz_for_local(parsed.replace(tzinfo=None)))


def parse_bars_csv(path: Path) -> list[Bar]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    bars: list[Bar] = []
    for row_number, row in enumerate(rows, start=2):
        normalized = {str(k).strip().lower(): v for k, v in row.items()}
        ts_raw = normalized.get("time") or normalized.get("timestamp") or normalized.get("date")
        close_raw = normalized.get("close") or normalized.get("latest") or normalized.get("last")
        if ts_raw and str(ts_raw).strip().lower().startswith("downloaded from"):
            continue
        if not any(str(value or "").strip() for value in row.values()):
            continue
        parsed = {
            "open": parse_float(normalized.get("open")),
            "high": parse_float(normalized.get("high")),
            "low": parse_float(normalized.get("low")),
            "close": parse_float(close_raw),
            "volume": parse_float(normalized.get("volume")),
        }
        if not ts_raw or any(parsed[key] is None for key in ("open", "high", "low", "close")):
            raise ValueError(f"{path}:{row_number} is missing required OHLC timestamp data")
        bars.append(
            Bar(
                timestamp=parse_timestamp(ts_raw),
                raw_timestamp=ts_raw,
                open=parsed["open"],
                high=parsed["high"],
                low=parsed["low"],
                close=parsed["close"],
                volume=parsed["volume"],
                raw=row,
            )
        )
    return sorted(bars, key=lambda bar: bar.timestamp)


def prices_from_text(text: str) -> list[float]:
    seen: set[float] = set()
    prices: list[float] = []
    for match in PRICE_RE.finditer(text):
        price = float(match.group(1))
        if price not in seen:
            seen.add(price)
            prices.append(price)
    return prices


def first_price(value: object, fallback_text: str) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    if isinstance(value, dict):
        for key in ("level", "price", "executable_level"):
            parsed = parse_float(value.get(key))
            if parsed is not None:
                return parsed
    if isinstance(value, list):
        for item in value:
            parsed = first_price(item, "")
            if parsed is not None:
                return parsed
    if isinstance(value, str):
        prices = prices_from_text(value)
        if prices:
            return prices[0]
    prices = prices_from_text(fallback_text)
    return prices[0] if prices else None


def event_from_mapping(item: dict, source_path: Path, index: int) -> Event | None:
    ts_value = (
        item.get("timestamp")
        or item.get("timestamp_et")
        or item.get("available_at_et")
        or item.get("entry_et")
        or item.get("reclaim_et")
        or item.get("flush_et")
        or item.get("sweep_et")
        or item.get("reclaim_timestamp")
        or item.get("breakdown_timestamp_et")
    )
    if not ts_value:
        return None
    text = item.get("text") or item.get("content") or item.get("notes") or json.dumps(item, sort_keys=True)
    level = first_price(
        item.get("level")
        or item.get("executable_level")
        or item.get("price")
        or item.get("levels")
        or item.get("supports")
        or item.get("trigger_guidance"),
        str(text),
    )
    return Event(
        event_id=str(item.get("id") or f"{source_path.name}:{index}"),
        timestamp=parse_timestamp(str(ts_value)),
        level=level,
        source_path=str(source_path),
        source_line=None,
        text=str(text).replace("\r\n", "\n").strip(),
    )


def load_events(path: Path) -> list[Event]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        items = data if isinstance(data, list) else data.get("events") or data.get("setups") or [data]
        return [event for i, item in enumerate(items, start=1) if isinstance(item, dict) for event in [event_from_mapping(item, path, i)] if event]
    if suffix == ".jsonl":
        events: list[Event] = []
        for i, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
            if line.strip():
                item = json.loads(line)
                if isinstance(item, dict):
                    event = event_from_mapping(item, path, i)
                    if event:
                        events.append(event)
        return events
    if suffix == ".csv":
        with path.open("r", newline="", encoding="utf-8-sig") as handle:
            return [event for i, row in enumerate(csv.DictReader(handle), start=1) for event in [event_from_mapping(row, path, i)] if event]

    events = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        for match in ISO_TS_RE.finditer(line):
            ts_text = f"{match.group(1)} {match.group(2)}"
            events.append(
                Event(
                    event_id=f"{path.name}:{line_number}:{len(events) + 1}",
                    timestamp=parse_timestamp(ts_text),
                    level=first_price(None, line),
                    source_path=str(path),
                    source_line=line_number,
                    text=line.strip(),
                )
            )
    return events


def crop_bars(bars: list[Bar], center: datetime, minutes: int) -> list[Bar]:
    start = center - timedelta(minutes=minutes)
    end = center + timedelta(minutes=minutes)
    return [bar for bar in bars if start <= bar.timestamp <= end]


def consecutive_closes_above(bars: list[Bar], start_index: int, level: float) -> int:
    count = 0
    for bar in bars[start_index:]:
        if bar.close >= level:
            count += 1
        else:
            break
    return count


def wick_body_ratio(bar: Bar) -> float | None:
    body = abs(bar.close - bar.open)
    wick = max(0.0, bar.high - bar.low - body)
    if body == 0:
        return None
    return round(wick / body, 4)


def summarize_event(event: Event, window: list[Bar]) -> dict:
    base = {
        "event_id": event.event_id,
        "event_timestamp_et": event.timestamp.isoformat(),
        "level": event.level,
        "source_path": event.source_path,
        "source_line": event.source_line,
        "window_bars": len(window),
        "window_first_timestamp_et": window[0].timestamp.isoformat() if window else None,
        "window_last_timestamp_et": window[-1].timestamp.isoformat() if window else None,
        "has_metric_level": event.level is not None,
    }
    if not window or event.level is None:
        return base

    break_candidates = [bar for bar in window if bar.low < event.level]
    trap = min(break_candidates, key=lambda bar: bar.low) if break_candidates else None
    reclaim_index = next((i for i, bar in enumerate(window) if bar.close >= event.level and bar.timestamp >= event.timestamp), None)
    if reclaim_index is None:
        reclaim_index = next((i for i, bar in enumerate(window) if bar.close >= event.level), None)

    return {
        **base,
        "flush_points": round(event.level - trap.low, 2) if trap else None,
        "flush_ticks": round((event.level - trap.low) / 0.25, 2) if trap else None,
        "trap_candle_timestamp_et": trap.timestamp.isoformat() if trap else None,
        "trap_candle_open": trap.open if trap else None,
        "trap_candle_high": trap.high if trap else None,
        "trap_candle_low": trap.low if trap else None,
        "trap_candle_close": trap.close if trap else None,
        "trap_candle_volume": trap.volume if trap else None,
        "trap_candle_wick_to_body": wick_body_ratio(trap) if trap else None,
        "first_reclaim_close_timestamp_et": window[reclaim_index].timestamp.isoformat() if reclaim_index is not None else None,
        "acceptance_consecutive_1m_closes_above_level": consecutive_closes_above(window, reclaim_index, event.level) if reclaim_index is not None else 0,
        "invalidation_sweep_low_minus_1tick": round(trap.low - 0.25, 2) if trap else None,
        "invalidation_level_minus_2points": round(event.level - 2.0, 2),
    }


def write_window_csv(path: Path, bars: list[Bar]) -> None:
    columns = ["timestamp_et", "open", "high", "low", "close", "volume"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for bar in bars:
            writer.writerow(
                {
                    "timestamp_et": bar.timestamp.isoformat(),
                    "open": bar.open,
                    "high": bar.high,
                    "low": bar.low,
                    "close": bar.close,
                    "volume": "" if bar.volume is None else bar.volume,
                }
            )


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", text).strip("_")[:120] or "event"


def run(args: argparse.Namespace) -> int:
    bars = parse_bars_csv(Path(args.bars_csv))
    events = []
    for event_path in args.events:
        events.extend(load_events(Path(event_path)))
    if not events:
        raise SystemExit("No timestamped events found.")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for event in events:
        window = crop_bars(bars, event.timestamp, args.minutes)
        name = slug(f"{event.timestamp.strftime('%Y%m%d_%H%M')}_{event.event_id}")
        window_path = out_dir / f"{name}.csv"
        write_window_csv(window_path, window)
        manifest.append({**summarize_event(event, window), "window_csv": str(window_path)})

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"events": len(events), "out_dir": str(out_dir), "manifest": str(manifest_path)}, indent=2))
    return 0


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        bars_path = root / "bars.csv"
        events_path = root / "events.json"
        out_dir = root / "out"
        bars_path.write_text(
            "\n".join(
                [
                    "Time,Open,High,Low,Latest,Change,%Change,Volume",
                    '"2026-05-07 09:29",7334,7335,7333,7334.5,0,0%,100',
                    '"2026-05-07 09:30",7334.5,7335,7326.5,7328,0,0%,900',
                    '"2026-05-07 09:31",7328,7333.5,7327.5,7332.25,0,0%,1200',
                    '"2026-05-07 09:32",7332.25,7334,7331.75,7333,0,0%,800',
                ]
            ),
            encoding="utf-8",
        )
        events_path.write_text(
            json.dumps([{"id": "shelf-test", "timestamp_et": "2026-05-07T09:30:00-04:00", "level": 7332}]),
            encoding="utf-8",
        )
        args = argparse.Namespace(bars_csv=str(bars_path), events=[str(events_path)], out_dir=str(out_dir), minutes=2)
        run(args)
        manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
        assert manifest[0]["flush_points"] == 5.5
        assert manifest[0]["acceptance_consecutive_1m_closes_above_level"] == 2
        assert manifest[0]["invalidation_sweep_low_minus_1tick"] == 7326.25
    print("self-test passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bars-csv", help="Barchart/local 1m OHLCV CSV")
    parser.add_argument("--events", nargs="+", help="Timestamped newsletter/event files: json, jsonl, csv, md, txt")
    parser.add_argument("--out-dir", default="artifacts/research/mancini-window-crops")
    parser.add_argument("--minutes", type=int, default=15, help="Minutes on each side of each event timestamp")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.bars_csv or not args.events:
        parser.error("--bars-csv and --events are required unless --self-test is used")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
