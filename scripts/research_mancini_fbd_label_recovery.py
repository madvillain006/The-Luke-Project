#!/usr/bin/env python3
"""Recover chart labels from existing Mancini rows and local ES 1m sessions.

Offline research only. This script does not modify the gated Hermes package and
does not touch Pine, NinjaTrader, broker, risk, credentials, or execution paths.

The output is a pre-Hermes review artifact: it finds source-qualified rows that
were hard-rejected mostly because the first pass lacked chart/window evidence,
then tests the full local ES session for deterministic flush/reclaim structure.
Recovered rows are still review candidates; they are only candidate-eligible
when all hard gates remain clean.
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRAINING_ROWS = ROOT / "artifacts/research/mancini-fbd-hermes-input/selected_training_rows.jsonl"
FEATURES_CSV = ROOT / "artifacts/research/mancini-fbd-algo-math/features.csv"
EVENTS_CSV = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
SESSIONS_DIR = ROOT / "data/backtest/es-long-bracket/sessions"
RAW_BAR_ROOTS = [
    ROOT / "data/historical",
    ROOT / "data/backtest",
    ROOT / "data/research/mancini",
]

OUT_DIR = ROOT / "artifacts/research/mancini-fbd-label-recovery"
OUT_ROWS_JSONL = OUT_DIR / "recovered_label_rows.jsonl"
OUT_ROWS_CSV = OUT_DIR / "recovered_label_rows.csv"
OUT_SUMMARY_JSON = OUT_DIR / "summary.json"
OUT_SUMMARY_MD = OUT_DIR / "summary.md"

TICK = 0.25
MIN_FLUSH_DEPTH = 0.25
CLOSE_ABOVE_LEVEL = 0.25
MAX_RECLAIM_WAIT_MINUTES = 180
MAX_SOURCE_ANCHOR_SCAN_MINUTES = 360
MFE_MAE_HORIZON_MINUTES = 60

ACCEPTANCE_FAMILIES = [
    "non_acceptance_protocol",
    "classic_acceptance_backtest_from_below",
    "classic_acceptance_second_attempt_reclaim",
    "ladder_first_reclaim",
    "simple_reclaim_unclassified",
]

LABEL_FIELDS = [
    "source_confirmed_fbd",
    "source_planned_fbd",
    "source_negative_control",
    "sr_list_only",
    "chart_confirmed_reclaim",
    "chart_confirmed_non_acceptance",
    "chart_mismatch",
    "needs_crop",
    "data_only",
]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if line.strip():
                item = json.loads(line)
                if isinstance(item, dict):
                    rows.append(item)
    return rows


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def rel(path: Path | str | None) -> str:
    if not path:
        return ""
    p = Path(path)
    if not p.is_absolute():
        return str(p).replace("\\", "/")
    try:
        return str(p.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(p)


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def as_int(value: Any) -> int | None:
    number = as_float(value)
    return int(number) if number is not None else None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def round4(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value + 0.0, 4)


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def same_minute(a: datetime, b: datetime) -> bool:
    return a.replace(second=0, microsecond=0, tzinfo=None) == b.replace(second=0, microsecond=0, tzinfo=None)


def date_text(value: Any) -> str:
    if not value:
        return ""
    return str(value)[:10]


def load_features() -> dict[str, dict[str, str]]:
    if not FEATURES_CSV.exists():
        return {}
    return {row["training_row_id"]: row for row in read_csv(FEATURES_CSV) if row.get("training_row_id")}


def load_sessions() -> dict[str, list[dict[str, Any]]]:
    sessions: dict[str, list[dict[str, Any]]] = {}
    if not SESSIONS_DIR.exists():
        return sessions
    for path in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get("example") or data.get("usable") is False:
            continue
        raw_bars = data.get("bars", {}).get("es") if isinstance(data.get("bars"), dict) else []
        bars: list[dict[str, Any]] = []
        for raw in raw_bars or []:
            timestamp = parse_dt(raw.get("timestamp"))
            open_ = as_float(raw.get("open"))
            high = as_float(raw.get("high"))
            low = as_float(raw.get("low"))
            close = as_float(raw.get("close"))
            if timestamp is None or any(v is None for v in (open_, high, low, close)):
                continue
            bars.append({
                "timestamp": timestamp,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": as_float(raw.get("volume")) or 0.0,
            })
        if bars:
            bars.sort(key=lambda bar: bar["timestamp"])
            sessions[str(data.get("date") or path.stem)] = bars
    return sessions


def pad2(value: int) -> str:
    return str(value).zfill(2)


def add_one_hour_ct_to_et(value: str) -> str | None:
    try:
        date_part, time_part = str(value).strip().split(" ")
        year, month, day = [int(part) for part in date_part.split("-")]
        hour, minute = [int(part) for part in time_part.split(":")]
    except (ValueError, TypeError):
        return None
    parsed = datetime(year, month, day, hour, minute) + timedelta(hours=1)
    return f"{parsed.year}-{pad2(parsed.month)}-{pad2(parsed.day)}T{pad2(parsed.hour)}:{pad2(parsed.minute)}:00"


def minute_of_day(timestamp: datetime) -> int:
    return timestamp.hour * 60 + timestamp.minute


def add_days(date_text_value: str, days: int) -> str:
    parsed = datetime.strptime(date_text_value, "%Y-%m-%d") + timedelta(days=days)
    return parsed.strftime("%Y-%m-%d")


def session_date_for_bar(timestamp: datetime) -> str:
    current = timestamp.strftime("%Y-%m-%d")
    return add_days(current, 1) if minute_of_day(timestamp) >= 18 * 60 else current


def is_raw_es_barchart_file(path: Path) -> bool:
    name = path.name.lower()
    return (
        name.endswith(".csv")
        and (
            name.startswith("esh26_intraday-1min_historical-data-download")
            or name.startswith("esm26_intraday-1min_historical-data-download")
            or name.startswith("esz25_intraday-1min_historical-data-download")
        )
    )


def parse_raw_barchart_csv(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        csv_rows = read_csv(path)
    except (OSError, UnicodeDecodeError, csv.Error):
        return rows
    for raw in csv_rows:
        ct_time = raw.get("Time") or raw.get("time")
        et_text = add_one_hour_ct_to_et(str(ct_time or "").replace('"', ""))
        timestamp = parse_dt(et_text)
        open_ = as_float(raw.get("Open") or raw.get("open"))
        high = as_float(raw.get("High") or raw.get("high"))
        low = as_float(raw.get("Low") or raw.get("low"))
        close = as_float(raw.get("Latest") or raw.get("Last") or raw.get("Close") or raw.get("latest") or raw.get("close"))
        if timestamp is None or any(v is None for v in (open_, high, low, close)):
            continue
        minute = minute_of_day(timestamp)
        if 17 * 60 < minute < 18 * 60:
            continue
        rows.append({
            "timestamp": timestamp,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": as_float(str(raw.get("Volume") or raw.get("volume") or "0").replace(",", "")) or 0.0,
            "source_file": rel(path),
        })
    return rows


def load_raw_bar_sessions() -> dict[str, list[dict[str, Any]]]:
    files: list[Path] = []
    for root in RAW_BAR_ROOTS:
        if root.exists():
            files.extend(path for path in root.rglob("*.csv") if is_raw_es_barchart_file(path))
    by_timestamp: dict[str, dict[str, Any]] = {}
    for path in sorted(set(files)):
        for bar in parse_raw_barchart_csv(path):
            key = bar["timestamp"].replace(tzinfo=None).isoformat(timespec="minutes")
            existing = by_timestamp.get(key)
            if existing is None or bar["volume"] >= existing["volume"]:
                by_timestamp[key] = bar
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bar in by_timestamp.values():
        grouped[session_date_for_bar(bar["timestamp"])].append({
            "timestamp": bar["timestamp"],
            "open": bar["open"],
            "high": bar["high"],
            "low": bar["low"],
            "close": bar["close"],
            "volume": bar["volume"],
        })
    for bars in grouped.values():
        bars.sort(key=lambda bar: bar["timestamp"])
    return dict(grouped)


def root_path(path_text: Any) -> Path | None:
    if not path_text:
        return None
    path = Path(str(path_text))
    return path if path.is_absolute() else ROOT / path


def load_window_bars(path_text: Any) -> list[dict[str, Any]]:
    path = root_path(path_text)
    if not path or not path.exists():
        return []
    bars: list[dict[str, Any]] = []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            timestamp = parse_dt(row.get("timestamp_et") or row.get("timestamp") or row.get("time"))
            open_ = as_float(row.get("open"))
            high = as_float(row.get("high"))
            low = as_float(row.get("low"))
            close = as_float(row.get("close") or row.get("latest") or row.get("last"))
            if timestamp is None or any(v is None for v in (open_, high, low, close)):
                continue
            bars.append({
                "timestamp": timestamp,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": as_float(row.get("volume")) or 0.0,
            })
    bars.sort(key=lambda bar: bar["timestamp"])
    return bars


def load_event_levels() -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if not EVENTS_CSV.exists():
        return out
    for row in read_csv(EVENTS_CSV):
        plan_date = row.get("plan_date") or ""
        price = as_float(row.get("price") or row.get("zone_low"))
        if not plan_date or price is None:
            continue
        out[plan_date].append({
            "price": price,
            "direction": row.get("direction") or "",
            "primary_role": row.get("primary_role") or "",
            "source_kind": row.get("source_kind") or "mancini",
            "source_id": row.get("source_id") or "",
            "pub_date": row.get("pub_date") or "",
        })
    for values in out.values():
        values.sort(key=lambda item: item["price"])
    return out


def index_at_or_after(bars: list[dict[str, Any]], timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None
    needle = timestamp.replace(tzinfo=None)
    for index, bar in enumerate(bars):
        current = bar["timestamp"].replace(tzinfo=None)
        if current >= needle or same_minute(bar["timestamp"], timestamp):
            return index
    return None


def prior_touch_count(bars: list[dict[str, Any]], index: int, level: float) -> int:
    touches = 0
    in_group = False
    for bar in bars[:index]:
        touching = bar["low"] <= level + 1.0 and bar["high"] >= level - 1.0
        if touching and not in_group:
            touches += 1
        in_group = touching
    return touches


def consecutive_closes_at_or_above(bars: list[dict[str, Any]], start: int, threshold: float, limit: int = 16) -> int:
    count = 0
    for bar in bars[start:start + limit]:
        if bar["close"] >= threshold:
            count += 1
        else:
            break
    return count


def first_close_at_or_above(bars: list[dict[str, Any]], start: int, threshold: float, limit: int) -> int | None:
    for index in range(start, min(len(bars), start + limit)):
        if bars[index]["close"] >= threshold:
            return index
    return None


def first_close_below(bars: list[dict[str, Any]], start: int, threshold: float, limit: int) -> int | None:
    for index in range(start, min(len(bars), start + limit)):
        if bars[index]["close"] < threshold:
            return index
    return None


def first_retest_hold(bars: list[dict[str, Any]], start: int, level: float, limit: int) -> int | None:
    for index in range(start, min(len(bars), start + limit)):
        bar = bars[index]
        if bar["low"] <= level + 0.5:
            return index if bar["close"] >= level else None
    return None


def find_next_target(levels: dict[str, list[dict[str, Any]]], plan_date: str, entry: float, signal_date: str) -> dict[str, Any]:
    candidates = []
    for item in levels.get(plan_date, []):
        if item["price"] <= entry + TICK:
            continue
        pub_date = date_text(item.get("pub_date"))
        if pub_date and signal_date and pub_date > signal_date:
            continue
        candidates.append(item)
    if not candidates:
        return {}
    return min(candidates, key=lambda item: item["price"])


def count_levels_between(levels: dict[str, list[dict[str, Any]]], plan_date: str, low: float, high: float) -> int:
    lower, upper = sorted([low, high])
    return sum(1 for item in levels.get(plan_date, []) if lower < item["price"] < upper)


def mfe_mae(bars: list[dict[str, Any]], index: int, entry: float, minutes: int = MFE_MAE_HORIZON_MINUTES) -> tuple[float | None, float | None]:
    if index >= len(bars):
        return None, None
    start = bars[index]["timestamp"]
    end = start + timedelta(minutes=minutes)
    horizon = [bar for bar in bars[index:] if bar["timestamp"] <= end]
    if not horizon:
        return None, None
    return max(bar["high"] for bar in horizon) - entry, entry - min(bar["low"] for bar in horizon)


def classify_family(
    bars: list[dict[str, Any]],
    flush_index: int,
    reclaim_index: int,
    level: float,
    swept_low: float,
    multi_level_flush_count: int,
) -> tuple[str, dict[str, Any]]:
    acceptance_closes = consecutive_closes_at_or_above(bars, reclaim_index, level)
    threshold_index = first_close_at_or_above(bars, reclaim_index, level + 5.0, 11)
    non_acceptance_closes = 0
    first_retest_holds = False
    if threshold_index is not None:
        non_acceptance_closes = consecutive_closes_at_or_above(bars, threshold_index, level + 5.0, 6)
        first_retest_holds = first_retest_hold(bars, threshold_index + 1, level, 12) is not None
    retest_hold = first_retest_hold(bars, reclaim_index + 1, level, 10) is not None
    first_failure_index = first_close_below(bars, reclaim_index + 1, level, 4)
    second_reclaim_index = (
        first_close_at_or_above(bars, first_failure_index + 1, level + CLOSE_ABOVE_LEVEL, 40)
        if first_failure_index is not None else None
    )
    immediate_failure = first_failure_index is not None
    if threshold_index is not None and (non_acceptance_closes >= 2 or first_retest_holds):
        family = "non_acceptance_protocol"
    elif (level - swept_low) >= 2.0 and retest_hold:
        family = "classic_acceptance_backtest_from_below"
    elif second_reclaim_index is not None:
        family = "classic_acceptance_second_attempt_reclaim"
    elif multi_level_flush_count >= 2 and acceptance_closes >= 1:
        family = "ladder_first_reclaim"
    else:
        family = "simple_reclaim_unclassified"
    return family, {
        "acceptance_closes_above_L": acceptance_closes,
        "non_acceptance_closes": non_acceptance_closes,
        "first_retest_holds": first_retest_holds,
        "classic_retest_holds": retest_hold,
        "immediate_failure_after_reclaim": immediate_failure,
        "second_reclaim_index": second_reclaim_index,
    }


def find_flush_reclaim(
    row: dict[str, Any],
    bars: list[dict[str, Any]],
    level: float,
) -> dict[str, Any] | None:
    trap_time = parse_dt(row.get("trap_candle_timestamp_et"))
    reclaim_time = parse_dt(row.get("first_reclaim_close_timestamp_et"))
    anchor_index = index_at_or_after(bars, trap_time) if trap_time else None
    if anchor_index is None:
        anchor_index = 0
    anchor_index = anchor_index or 0
    if reclaim_time:
        reclaim_hint_index = index_at_or_after(bars, reclaim_time)
        if reclaim_hint_index is not None:
            scan_start = max(0, reclaim_hint_index - MAX_RECLAIM_WAIT_MINUTES)
            scan_end = min(len(bars), reclaim_hint_index + 2)
        else:
            scan_start = anchor_index
            scan_end = min(len(bars), anchor_index + MAX_SOURCE_ANCHOR_SCAN_MINUTES)
    else:
        scan_start = anchor_index
        scan_end = len(bars)
    best: dict[str, Any] | None = None
    for flush_index in range(scan_start, max(scan_start, scan_end - 1)):
        bar = bars[flush_index]
        if bar["low"] > level - MIN_FLUSH_DEPTH:
            continue
        swept_low = bar["low"]
        max_reclaim_index = min(len(bars), flush_index + MAX_RECLAIM_WAIT_MINUTES)
        for reclaim_index in range(flush_index + 1, max_reclaim_index):
            swept_low = min(swept_low, bars[reclaim_index]["low"])
            if bars[reclaim_index]["close"] >= level + CLOSE_ABOVE_LEVEL:
                depth = level - swept_low
                candidate = {
                    "flush_index": flush_index,
                    "reclaim_index": reclaim_index,
                    "swept_low": swept_low,
                    "flush_depth": depth,
                    "reclaim_wait_minutes": (bars[reclaim_index]["timestamp"] - bars[flush_index]["timestamp"]).total_seconds() / 60.0,
                }
                if best is None or candidate["flush_depth"] > best["flush_depth"]:
                    best = candidate
                break
    return best


def base_reject_reasons(row: dict[str, Any], feature: dict[str, str]) -> list[str]:
    text = feature.get("hard_reject_reasons") or ""
    return [item for item in text.split(";") if item]


def eligible_source(row: dict[str, Any]) -> bool:
    if not (as_bool(row.get("source_confirmed_fbd")) or as_bool(row.get("source_planned_fbd"))):
        return False
    if as_bool(row.get("sr_list_only")) or as_bool(row.get("source_negative_control")) or as_bool(row.get("chart_mismatch")):
        return False
    return as_float(row.get("setup_level")) is not None


def recovery_row(
    row: dict[str, Any],
    feature: dict[str, str],
    sessions: dict[str, list[dict[str, Any]]],
    raw_sessions: dict[str, list[dict[str, Any]]],
    levels: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    session_date = date_text(row.get("session_date") or row.get("plan_date"))
    plan_date = date_text(row.get("plan_date") or row.get("session_date"))
    level = as_float(row.get("setup_level"))
    old_reasons = base_reject_reasons(row, feature)
    out: dict[str, Any] = {
        "training_row_id": row.get("training_row_id"),
        "row_origin": row.get("row_origin") or "",
        "raw_file": row.get("raw_file") or "",
        "line": row.get("line") or "",
        "source_mode": row.get("source_mode") or "",
        "source_quote": row.get("source_quote") or "",
        "plan_date": plan_date,
        "pub_date": row.get("pub_date") or "",
        "session_date": session_date,
        "setup_level": level,
        "old_hard_reject_reasons": ";".join(old_reasons),
        "old_acceptance_family_model": feature.get("acceptance_family_model") or "",
        **{name: as_bool(row.get(name)) for name in LABEL_FIELDS},
    }
    bars = sessions.get(session_date)
    bar_source = "session_json" if bars else ""
    if not bars:
        bars = load_window_bars(row.get("window_csv"))
        bar_source = "window_csv" if bars else ""
    if not bars:
        bars = raw_sessions.get(session_date)
        bar_source = "raw_barchart_csv" if bars else ""
    if not bars:
        out.update({
            "recovery_status": "not_recoverable_missing_session",
            "new_hard_reject_reasons": "missing_bars",
            "candidate_eligible_after_recovery": False,
        })
        return out
    if level is None:
        out.update({
            "recovery_status": "not_recoverable_missing_setup_level",
            "new_hard_reject_reasons": "missing_setup_level",
            "candidate_eligible_after_recovery": False,
        })
        return out
    found = find_flush_reclaim(row, bars, level)
    if not found:
        out.update({
            "recovery_status": "not_recovered_no_flush_reclaim_in_session",
            "new_hard_reject_reasons": "no_reclaim",
            "candidate_eligible_after_recovery": False,
        })
        return out
    flush_index = int(found["flush_index"])
    reclaim_index = int(found["reclaim_index"])
    swept_low = float(found["swept_low"])
    multi_level_flush_count = count_levels_between(levels, plan_date, swept_low, level)
    family, details = classify_family(bars, flush_index, reclaim_index, level, swept_low, multi_level_flush_count)
    entry_price = bars[reclaim_index]["close"]
    signal_date = date_text(bars[reclaim_index]["timestamp"].isoformat())
    target = find_next_target(levels, plan_date, entry_price, signal_date)
    target_level = as_float(row.get("target_or_response_level"))
    target_source = "source_row_target" if target_level is not None else ""
    target_pub_date = date_text(row.get("pub_date"))
    if target_level is None and target:
        target_level = as_float(target.get("price"))
        target_source = target.get("source_kind") or "mancini"
        target_pub_date = date_text(target.get("pub_date"))
    target_room = target_level - entry_price if target_level is not None else None
    risk_to_sweep = entry_price - (swept_low - TICK)
    mfe60, mae60 = mfe_mae(bars, reclaim_index, entry_price)
    new_reasons: list[str] = []
    if target_room is None or target_room <= 0:
        new_reasons.append("target_missing_or_below_entry")
    elif target_room < 2.0:
        new_reasons.append("target_too_close_for_slippage")
    if target_pub_date and signal_date and target_pub_date > signal_date:
        new_reasons.append("future_target_leakage")
    pub_date = date_text(row.get("pub_date"))
    if pub_date and signal_date and pub_date > signal_date:
        new_reasons.append("source_after_entry_leakage")
    if details["immediate_failure_after_reclaim"]:
        new_reasons.append("immediate_failure_after_reclaim")
    if risk_to_sweep <= 0:
        new_reasons.append("invalid_risk_to_sweep")
    source_mode = str(row.get("source_mode") or "")
    review_only_reasons: list[str] = []
    if as_bool(row.get("data_only")) or source_mode == "data_context":
        review_only_reasons.append("data_context_review_only")
    if source_mode == "actual_recap" and not as_bool(row.get("source_planned_fbd")):
        review_only_reasons.append("actual_recap_review_label_not_planned_entry")
    source_candidate_allowed = not review_only_reasons and (
        as_bool(row.get("source_planned_fbd")) or source_mode == "planned_setup"
    )
    out.update({
        "recovery_status": "recovered_flush_reclaim",
        "bar_source": bar_source,
        "recovered_acceptance_family": family,
        "recovered_chart_confirmed_reclaim": True,
        "recovered_chart_confirmed_non_acceptance": family == "non_acceptance_protocol",
        "flush_timestamp_et": bars[flush_index]["timestamp"].isoformat(),
        "reclaim_timestamp_et": bars[reclaim_index]["timestamp"].isoformat(),
        "entry_price": round4(entry_price),
        "swept_low": round4(swept_low),
        "flush_depth": round4(found["flush_depth"]),
        "reclaim_wait_minutes": round4(found["reclaim_wait_minutes"]),
        "prior_touch_groups": prior_touch_count(bars, flush_index, level),
        "multi_level_flush_count": multi_level_flush_count,
        "acceptance_closes_above_L": details["acceptance_closes_above_L"],
        "non_acceptance_closes": details["non_acceptance_closes"],
        "first_retest_holds": details["first_retest_holds"],
        "classic_retest_holds": details["classic_retest_holds"],
        "immediate_failure_after_reclaim": details["immediate_failure_after_reclaim"],
        "target_level": round4(target_level) if target_level is not None else "",
        "target_source": target_source,
        "target_room": round4(target_room) if target_room is not None else "",
        "risk_to_sweep": round4(risk_to_sweep),
        "mfe_60m": round4(mfe60),
        "mae_60m": round4(mae60),
        "new_hard_reject_reasons": ";".join(new_reasons),
        "review_only_reasons": ";".join(review_only_reasons),
        "candidate_eligible_after_recovery": (not new_reasons) and source_candidate_allowed,
    })
    return out


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fields: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                fields.append(key)
                seen.add(key)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def unique_setup_key(row: dict[str, Any]) -> str:
    return "|".join([
        str(row.get("session_date") or ""),
        str(row.get("setup_level") or ""),
        str(row.get("recovered_acceptance_family") or ""),
        str(row.get("flush_timestamp_et") or ""),
        str(row.get("reclaim_timestamp_et") or ""),
    ])


def summarize(rows: list[dict[str, Any]], scanned_count: int) -> dict[str, Any]:
    recovered = [row for row in rows if row.get("recovery_status") == "recovered_flush_reclaim"]
    eligible = [row for row in recovered if as_bool(row.get("candidate_eligible_after_recovery"))]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "research_historical_replay_shadow_only",
        "inputs": {
            "training_rows": rel(TRAINING_ROWS),
            "features_csv": rel(FEATURES_CSV),
            "events_csv": rel(EVENTS_CSV),
            "sessions_dir": rel(SESSIONS_DIR),
        },
        "outputs": {
            "rows_jsonl": rel(OUT_ROWS_JSONL),
            "rows_csv": rel(OUT_ROWS_CSV),
            "summary_json": rel(OUT_SUMMARY_JSON),
            "summary_md": rel(OUT_SUMMARY_MD),
        },
        "counts": {
            "source_qualified_hard_reject_rows": scanned_count,
            "rows_with_existing_session_and_level_scanned": len(rows),
            "recovered_flush_reclaim_rows": len(recovered),
            "recovered_unique_setups": len(set(unique_setup_key(row) for row in recovered)),
            "candidate_eligible_after_recovery_rows": len(eligible),
            "candidate_eligible_unique_setups": len(set(unique_setup_key(row) for row in eligible)),
            "recovered_non_acceptance_rows": sum(1 for row in recovered if as_bool(row.get("recovered_chart_confirmed_non_acceptance"))),
        },
        "recovered_by_family": dict(Counter(str(row.get("recovered_acceptance_family") or "missing") for row in recovered)),
        "eligible_by_family": dict(Counter(str(row.get("recovered_acceptance_family") or "missing") for row in eligible)),
        "recovery_status_counts": dict(Counter(str(row.get("recovery_status") or "missing") for row in rows)),
        "new_hard_reject_reason_counts": dict(Counter(
            reason
            for row in recovered
            for reason in str(row.get("new_hard_reject_reasons") or "").split(";")
            if reason
        )),
        "review_only_reason_counts": dict(Counter(
            reason
            for row in recovered
            for reason in str(row.get("review_only_reasons") or "").split(";")
            if reason
        )),
        "old_hard_reject_reason_counts": dict(Counter(
            reason
            for row in rows
            for reason in str(row.get("old_hard_reject_reasons") or "").split(";")
            if reason
        )),
        "by_source_mode": dict(Counter(str(row.get("source_mode") or "missing") for row in rows)),
        "by_bar_source": dict(Counter(str(row.get("bar_source") or "missing") for row in recovered)),
        "eligible_by_source_mode": dict(Counter(str(row.get("source_mode") or "missing") for row in eligible)),
        "safety": {
            "live_trading_behavior_introduced": False,
            "broker_risk_live_pine_credential_execution_touched": False,
            "ninja_code_written": False,
            "sr_list_only_promoted_to_positive": False,
            "mfe_mae_used_as_candidate_inputs": False,
            "main_hermes_package_modified": False,
        },
    }


def markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# Mancini FBD Label Recovery",
        "",
        f"Generated: {summary['generated_at']}",
        "",
        "Scope: pre-Hermes research only. Recovered rows require review before merging into the gated package.",
        "",
        "## Counts",
        "",
    ]
    for key, value in summary["counts"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Recovered By Family", ""])
    for key in ACCEPTANCE_FAMILIES:
        lines.append(f"- `{key}`: {summary['recovered_by_family'].get(key, 0)} recovered; {summary['eligible_by_family'].get(key, 0)} candidate-eligible")
    lines.extend(["", "## Remaining Reject Reasons", ""])
    for key, value in sorted(summary["new_hard_reject_reason_counts"].items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- `{key}`: {value}")
    lines.extend([
        "",
        "## Safety",
        "",
        "- This does not modify `mancini-fbd-hermes-input`.",
        "- SR-list-only rows remain excluded.",
        "- MFE/MAE are emitted as validation labels only.",
        "- No Pine, NinjaTrader, broker, risk, credential, or live execution path is touched.",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    training = read_jsonl(TRAINING_ROWS)
    features = load_features()
    sessions = load_sessions()
    raw_sessions = load_raw_bar_sessions()
    levels = load_event_levels()
    source_qualified_hard_rejects = [
        row for row in training
        if as_bool(features.get(str(row.get("training_row_id")), {}).get("hard_reject"))
        and eligible_source(row)
    ]
    rows_to_scan = [
        row for row in source_qualified_hard_rejects
        if date_text(row.get("session_date") or row.get("plan_date")) in sessions
        or (root_path(row.get("window_csv")) is not None and root_path(row.get("window_csv")).exists())
        or date_text(row.get("session_date") or row.get("plan_date")) in raw_sessions
    ]
    recovered_rows = [
        recovery_row(row, features.get(str(row.get("training_row_id")), {}), sessions, raw_sessions, levels)
        for row in rows_to_scan
    ]
    summary = summarize(recovered_rows, len(source_qualified_hard_rejects))
    write_jsonl(OUT_ROWS_JSONL, recovered_rows)
    write_csv(OUT_ROWS_CSV, recovered_rows)
    OUT_SUMMARY_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_SUMMARY_MD.write_text(markdown(summary), encoding="utf-8", newline="\n")
    print(json.dumps({
        "source_qualified_hard_reject_rows": summary["counts"]["source_qualified_hard_reject_rows"],
        "rows_with_existing_session_and_level_scanned": summary["counts"]["rows_with_existing_session_and_level_scanned"],
        "recovered_flush_reclaim_rows": summary["counts"]["recovered_flush_reclaim_rows"],
        "candidate_eligible_after_recovery_rows": summary["counts"]["candidate_eligible_after_recovery_rows"],
        "recovered_by_family": summary["recovered_by_family"],
        "eligible_by_family": summary["eligible_by_family"],
        "outputs": summary["outputs"],
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
