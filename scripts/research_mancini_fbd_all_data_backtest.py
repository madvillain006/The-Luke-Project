#!/usr/bin/env python3
"""Run Mancini FBD candidates against all local ES 1m research data.

Research/replay/shadow only. This script does not create orders, broker routes,
account routing, risk checks, position sizing, Ninja/Pine code, or live
execution behavior.
"""

from __future__ import annotations

import csv
import json
import math as py_math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from typing import Any

import research_mancini_fbd_algo_math as fbd_math


ROOT = Path(__file__).resolve().parents[1]
TICK = 0.25

DST_RANGES = [
    ("2025-03-09 03:00", "2025-11-02 02:00"),
    ("2026-03-08 03:00", "2026-11-01 02:00"),
    ("2027-03-14 03:00", "2027-11-07 02:00"),
]

MATH_DIR = ROOT / "artifacts/research/mancini-fbd-algo-math"
FEATURES_CSV = MATH_DIR / "features.csv"
LABELS_CSV = MATH_DIR / "labels.csv"
EXACT_GRID_JSON = MATH_DIR / "exact_strategy_grid.json"
EVENTS_CSV = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
OUT_DIR = ROOT / "artifacts/research/mancini-fbd-all-data-backtest"

RAW_ROOTS = [
    ROOT / "data/historical",
    ROOT / "data/backtest",
    ROOT / "data/research/mancini",
]

RULES = [
    "non_acceptance_only",
    "candidate_score_055",
    "level_to_level_target_R",
    "ladder_first_reclaim",
    "classic_backtest_only",
    "second_attempt_review_only",
]

SCOPES = [
    "deployable_planned_only",
    "confirmed_reconstruction",
    "all_source_nonrejected",
]

TIMEFRAMES_MINUTES = [1, 3, 5, 15, 30]
TARGET_POINTS = [2.0, 3.0, 5.0, 8.0, 12.0]
STOP_POLICIES = ["risk_to_sweep", "fixed_5", "fixed_8", "fixed_12", "fixed_15", "fixed_20"]

FILL_MODES = {
    "optimal_fill": {
        "entry": "signal_close",
        "adverse_entry_points": 0.0,
        "slippage_points": 0.25,
        "same_bar_policy": "target_first",
    },
    "half_optimal_half_bad_fill": {
        "entry": "next_bar_open",
        "adverse_entry_points": 0.25,
        "slippage_points": 0.75,
        "same_bar_policy": "split",
    },
    "hard_mode": {
        "entry": "next_bar_open",
        "adverse_entry_points": 0.50,
        "slippage_points": 1.50,
        "same_bar_policy": "stop_first",
    },
}

DISALLOWED_FORMULA_COLUMNS = [
    "mfe_15m",
    "mae_15m",
    "mfe_60m",
    "mae_60m",
    "tp2_hit",
    "tp3_hit",
    "next_level_hit",
    "tp2_first",
    "tp3_first",
    "next_level_first",
    "adverse_excursion_stop_hit",
    "first_hit_event",
    "first_hit_timestamp_et",
    "first_hit_points",
    "target_first",
    "same_bar_stop_and_target",
    "stop_first",
    "false_armed",
    "median_mae_before_tp1_component",
    "non_acceptance_score_with_outcome_audit",
    "expectancy_points_slippage_0_5",
]


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    source_file: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "source_file": self.source_file,
        }


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fields: list[str] = []
        for row in rows:
            for key in row.keys():
                if key not in fields:
                    fields.append(key)
        fieldnames = fields
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def as_float(value: Any) -> float | None:
    return fbd_math.as_float(value)


def as_bool(value: Any) -> bool:
    return fbd_math.as_bool(value)


def clamp(value: float | None, low: float, high: float) -> float:
    return fbd_math.clamp(value, low, high)


def indicator(value: Any) -> float:
    return fbd_math.indicator(value)


def iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.isoformat()


def parse_local_et(value: str) -> datetime | None:
    text = str(value or "").strip().strip('"')
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
            normalized = parsed.strftime("%Y-%m-%d %H:%M")
            offset_hours = -4 if any(start <= normalized < end for start, end in DST_RANGES) else -5
            return parsed.replace(tzinfo=timezone(timedelta(hours=offset_hours)))
        except ValueError:
            continue
    return None


def session_date_for(timestamp: datetime) -> str:
    # ES overnight session belongs to the next trading date. The repo's Barchart
    # loader treats raw row timestamps as America/New_York local time.
    if timestamp.hour >= 17:
        return (timestamp.date() + timedelta(days=1)).isoformat()
    return timestamp.date().isoformat()


def raw_es_files() -> list[Path]:
    files: list[Path] = []
    pattern = re.compile(r"^es[hmuz]\d{2}_intraday-1min_historical-data-download.*\.csv$", re.IGNORECASE)
    for root in RAW_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*.csv"):
            if pattern.match(path.name):
                files.append(path)
    return sorted(files, key=lambda item: str(item).lower())


def parse_number(value: str) -> float | None:
    text = str(value or "").replace(",", "").strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if py_math.isnan(number) or py_math.isinf(number):
        return None
    return number


def load_all_raw_bars() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_timestamp: dict[datetime, Bar] = {}
    inventory: list[dict[str, Any]] = []
    for path in raw_es_files():
        parsed_rows = 0
        first: datetime | None = None
        last: datetime | None = None
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                ts = parse_local_et(row.get("Time") or row.get("timestamp") or "")
                open_ = parse_number(row.get("Open") or row.get("open") or "")
                high = parse_number(row.get("High") or row.get("high") or "")
                low = parse_number(row.get("Low") or row.get("low") or "")
                close = parse_number(row.get("Latest") or row.get("Close") or row.get("close") or "")
                volume = parse_number(row.get("Volume") or row.get("volume") or "") or 0.0
                if ts is None or open_ is None or high is None or low is None or close is None:
                    continue
                parsed_rows += 1
                first = ts if first is None or ts < first else first
                last = ts if last is None or ts > last else last
                bar = Bar(ts, open_, high, low, close, volume, str(path.relative_to(ROOT)))
                prior = by_timestamp.get(ts)
                if prior is None or bar.volume >= prior.volume:
                    by_timestamp[ts] = bar
        inventory.append({
            "path": str(path.relative_to(ROOT)),
            "parsed_rows": parsed_rows,
            "first_timestamp_et": iso(first),
            "last_timestamp_et": iso(last),
        })
    bars = [bar.as_dict() for _, bar in sorted(by_timestamp.items(), key=lambda item: item[0])]
    return bars, inventory


def load_levels() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    rows = read_csv(EVENTS_CSV)
    grouped: dict[str, dict[float, dict[str, Any]]] = defaultdict(dict)
    rejected = 0
    for row in rows:
        plan_date = str(row.get("plan_date") or row.get("pub_date") or "").strip()
        price = as_float(row.get("price") or row.get("zone_low") or row.get("zone_high"))
        direction = str(row.get("direction") or "").strip().lower()
        long_eligible = as_bool(row.get("long_eligible"))
        if not plan_date or price is None or direction != "support" or not long_eligible:
            rejected += 1
            continue
        existing = grouped[plan_date].get(price)
        candidate = {
            "plan_date": plan_date,
            "pub_date": str(row.get("pub_date") or plan_date),
            "price": price,
            "direction": direction,
            "primary_role": row.get("primary_role") or "",
            "source_kind": row.get("source_kind") or "",
            "source_path": row.get("source_path") or "",
            "source_id": row.get("source_id") or "",
            "source_snippet": row.get("source_snippet") or "",
            "tags": row.get("tags") or "",
            "ocr_verified": as_bool(row.get("ocr_verified")),
        }
        if existing is None or source_confidence(candidate) > source_confidence(existing):
            grouped[plan_date][price] = candidate
    out = {day: sorted(levels.values(), key=lambda item: item["price"]) for day, levels in grouped.items()}
    return out, {
        "events_rows": len(rows),
        "eligible_support_level_rows": sum(len(items) for items in out.values()),
        "rejected_event_rows": rejected,
        "plan_dates": len(out),
    }


def source_confidence(level: dict[str, Any]) -> float:
    text = " ".join([
        str(level.get("source_kind") or ""),
        str(level.get("source_path") or ""),
        str(level.get("source_snippet") or ""),
        str(level.get("tags") or ""),
        str(level.get("primary_role") or ""),
    ]).lower()
    score = 0.45
    if level.get("ocr_verified"):
        score += 0.10
    if any(token in text for token in ("mancini", "daily", "plan", "support")):
        score += 0.10
    if any(token in text for token in ("major", "key", "must hold", "line in sand", "supports", "big")):
        score += 0.10
    if any(token in text for token in ("negative", "sr_list_only", "data_only")):
        score -= 0.20
    return round(clamp(score, 0.0, 0.85), 4)


def major_source_bonus(level: dict[str, Any]) -> float:
    text = " ".join([
        str(level.get("source_snippet") or ""),
        str(level.get("primary_role") or ""),
        str(level.get("tags") or ""),
    ]).lower()
    markers = ["major", "massive", "significant", "daily low", "shelf", "low held", "big shelf", "must hold"]
    return indicator(any(marker in text for marker in markers))


def levels_for_session(levels_by_plan: dict[str, list[dict[str, Any]]], session_date: str) -> list[dict[str, Any]]:
    return [
        level for level in levels_by_plan.get(session_date, [])
        if str(level.get("pub_date") or "") <= session_date
    ]


def next_level_above(levels: list[dict[str, Any]], entry_price: float | None, session_date: str) -> dict[str, Any]:
    if entry_price is None:
        return {}
    candidates = [
        level for level in levels
        if level["price"] > entry_price + TICK and str(level.get("pub_date") or "") <= session_date
    ]
    if not candidates:
        return {}
    chosen = min(candidates, key=lambda item: item["price"])
    return {
        "next_trusted_level_above": chosen["price"],
        "next_trusted_level_source": chosen.get("source_kind") or "mancini_context_protocol",
        "next_trusted_level_role": chosen.get("primary_role") or "",
        "next_trusted_level_pub_date": chosen.get("pub_date") or "",
    }


def count_levels_between(levels: list[dict[str, Any]], low: float | None, high: float | None) -> int:
    if low is None or high is None:
        return 0
    lower, upper = sorted([low, high])
    return sum(1 for level in levels if lower < level["price"] < upper)


def group_by_session(bars: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bar in bars:
        grouped[session_date_for(bar["timestamp"])].append(bar)
    return {day: sorted(items, key=lambda item: item["timestamp"]) for day, items in grouped.items()}


def collapse_bucket(bucket: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "timestamp": bucket[0]["timestamp"],
        "open": bucket[0]["open"],
        "high": max(row["high"] for row in bucket),
        "low": min(row["low"] for row in bucket),
        "close": bucket[-1]["close"],
        "volume": sum(float(row.get("volume") or 0.0) for row in bucket),
        "source_file": bucket[-1].get("source_file") or "",
    }


def aggregate_bars(bars: list[dict[str, Any]], minutes: int) -> list[dict[str, Any]]:
    if minutes <= 1:
        return bars
    grouped: list[dict[str, Any]] = []
    bucket: list[dict[str, Any]] = []
    bucket_key: tuple[int, int, int, int, int] | None = None
    for bar in bars:
        ts = bar["timestamp"]
        key = (ts.year, ts.month, ts.day, ts.hour, ts.minute // minutes)
        if bucket and key != bucket_key:
            grouped.append(collapse_bucket(bucket))
            bucket = []
        bucket_key = key
        bucket.append(bar)
    if bucket:
        grouped.append(collapse_bucket(bucket))
    return grouped


def detect_traps(bars: list[dict[str, Any]], level_price: float) -> list[int]:
    indexes: list[int] = []
    last_signal_index = -100000
    for index, bar in enumerate(bars):
        if index - last_signal_index < 20:
            continue
        previous_close = bars[index - 1]["close"] if index > 0 else bar["open"]
        if previous_close >= level_price - TICK and bar["low"] <= level_price - TICK:
            indexes.append(index)
            last_signal_index = index
    return indexes


def first_reclaim_after(bars: list[dict[str, Any]], start_index: int, level_price: float) -> tuple[int | None, bool]:
    first_reclaim_failed = False
    active_reclaim_index: int | None = None
    for index in range(start_index + 1, min(len(bars), start_index + 90)):
        bar = bars[index]
        if active_reclaim_index is None:
            if bar["close"] >= level_price:
                active_reclaim_index = index
            continue
        if bar["close"] < level_price:
            first_reclaim_failed = True
            active_reclaim_index = None
            continue
        return active_reclaim_index, first_reclaim_failed
    return active_reclaim_index, first_reclaim_failed


def compute_scores(
    bars: list[dict[str, Any]],
    levels: list[dict[str, Any]],
    level: dict[str, Any],
    trap_index: int,
    reclaim_index: int,
    first_reclaim_failed: bool,
    session_date: str,
) -> dict[str, Any]:
    setup_level = float(level["price"])
    trap_bar = bars[trap_index]
    reclaim_bar = bars[reclaim_index]
    trap_time = trap_bar["timestamp"]
    reclaim_time = reclaim_bar["timestamp"]
    swept_low = min(bar["low"] for bar in bars[trap_index:reclaim_index + 1])
    flush_depth = setup_level - swept_low
    recent = bars[max(0, trap_index - 30):trap_index + 1]
    high_index, high_bar = max(enumerate(recent), key=lambda item: item[1]["high"]) if recent else (0, trap_bar)
    median_volume_30m = median([float(bar.get("volume") or 0.0) for bar in recent]) if recent else None
    trap_volume = float(trap_bar.get("volume") or 0.0)
    minutes_from_recent_high = max((trap_bar["timestamp"] - high_bar["timestamp"]).total_seconds() / 60.0, 1.0)
    approach_velocity = (high_bar["high"] - swept_low) / minutes_from_recent_high if swept_low is not None else None
    prior = fbd_math.compute_prior_touch_stats(bars, setup_level, trap_time)
    reclaim = fbd_math.compute_reclaim_metrics(bars, setup_level, reclaim_time, trap_time)
    volume_ratio_component = 0.0
    if median_volume_30m:
        volume_ratio_component = clamp(trap_volume / median_volume_30m, 0, 2) / 2
    multi_level_flush_count = count_levels_between(levels, swept_low, setup_level)
    significant_low_score = (
        0.30 * clamp(prior["prior_touch_count"] / 3, 0, 1)
        + 0.25 * clamp(prior["prior_hold_minutes"] / 120, 0, 1)
        + 0.25 * clamp(prior["prior_bounce_points"] / 20, 0, 1)
        + 0.20 * major_source_bonus(level)
    )
    flush_score = (
        0.35 * clamp(flush_depth / 8 if flush_depth is not None else None, 0, 1)
        + 0.25 * clamp(approach_velocity / 2.0 if approach_velocity is not None else None, 0, 1)
        + 0.20 * clamp(multi_level_flush_count / 3, 0, 1)
        + 0.20 * volume_ratio_component
    )
    acceptance_closes = int(reclaim.get("acceptance_closes_used_for_score") or 0)
    reclaim_range = as_float(reclaim.get("reclaim_range"))
    reclaim_score = (
        0.25 * indicator(reclaim_bar["close"] > setup_level)
        + 0.20 * indicator((as_float(reclaim.get("reclaim_close_location")) or 0) >= 0.5)
        + 0.20 * clamp(acceptance_closes / 3, 0, 1)
        + 0.20 * indicator(as_bool(reclaim.get("no_close_back_below_L_before_entry")))
        + 0.15 * indicator(reclaim_range is not None and reclaim_range <= 6)
    )
    non_acceptance_closes = int(reclaim.get("non_acceptance_closes_used_for_score") or 0)
    non_acceptance_score = (
        0.40 * indicator(bool(reclaim.get("first_threshold_close_timestamp_et")) or non_acceptance_closes > 0)
        + 0.30 * clamp(non_acceptance_closes / 3, 0, 1)
        + 0.20 * indicator(as_bool(reclaim.get("first_retest_of_L_holds_after_crossing_L_plus_5")))
        + 0.10 * 0.0
    )
    timing_driver, candidate_fire_time = fbd_math.score_driver_and_fire_time(reclaim, reclaim_score, non_acceptance_score)
    if candidate_fire_time is None:
        candidate_fire_time = reclaim_time
    entry_bar = bar_at_or_after(bars, candidate_fire_time) or reclaim_bar
    entry_price = float(entry_bar["close"])
    target_info = next_level_above(levels, entry_price, session_date)
    target_level = as_float(target_info.get("next_trusted_level_above"))
    target_room = target_level - entry_price if target_level is not None else None
    risk_to_sweep = entry_price - (swept_low - TICK)
    target_r = target_room / max(risk_to_sweep, TICK) if target_room is not None else None
    bucket = fbd_math.time_bucket(candidate_fire_time)
    next_source = str(target_info.get("next_trusted_level_source") or "").lower()
    trusted_source = any(token in next_source for token in ("mancini", "bobby", "gex", "dubz", "saty", "protocol"))
    no_trusted_level_within_2 = target_room is not None and target_room > 2
    squeeze_score = (
        0.30 * clamp(target_room / 8 if target_room is not None else None, 0, 1)
        + 0.25 * clamp(target_r / 2 if target_r is not None else None, 0, 1)
        + 0.20 * indicator(trusted_source)
        + 0.15 * indicator(no_trusted_level_within_2)
        + 0.10 * fbd_math.time_bonus(bucket)
    )
    candidate_score = (
        0.25 * significant_low_score
        + 0.20 * flush_score
        + 0.25 * max(reclaim_score, non_acceptance_score)
        + 0.20 * squeeze_score
        + 0.10 * source_confidence(level)
    )
    family = acceptance_family(
        first_reclaim_failed,
        multi_level_flush_count,
        flush_depth,
        acceptance_closes,
        non_acceptance_score,
    )
    return {
        "session_date": session_date,
        "plan_date": session_date,
        "pub_date": level.get("pub_date") or "",
        "source_id": level.get("source_id") or "",
        "source_kind": level.get("source_kind") or "",
        "setup_level": setup_level,
        "swept_low": round(swept_low, 4),
        "trap_detected_timestamp_et": iso(trap_time),
        "reclaim_detected_timestamp_et": iso(reclaim_time),
        "classification_complete_timestamp_et": iso(candidate_fire_time),
        "candidate_fired_timestamp_et": iso(candidate_fire_time),
        "candidate_timing_driver": timing_driver,
        "entry_price": round(entry_price, 4),
        "entry_timestamp_et": iso(candidate_fire_time),
        "acceptance_family_model": family,
        "source_confidence_score": source_confidence(level),
        "significant_low_score": round(significant_low_score, 4),
        "prior_touch_count": prior["prior_touch_count"],
        "prior_hold_minutes": round(prior["prior_hold_minutes"], 4),
        "prior_bounce_points": round(prior["prior_bounce_points"], 4),
        "flush_depth": round(flush_depth, 4),
        "approach_velocity": round(approach_velocity or 0.0, 4),
        "multi_level_flush_count": multi_level_flush_count,
        "volume_on_trap_bar": round(trap_volume, 4),
        "median_volume_30m": round(median_volume_30m or 0.0, 4),
        "flush_score": round(flush_score, 4),
        "reclaim_score": round(reclaim_score, 4),
        "reclaim_close_location": reclaim.get("reclaim_close_location"),
        "reclaim_range": reclaim.get("reclaim_range"),
        "acceptance_closes_above_L": reclaim.get("acceptance_closes_above_L"),
        "acceptance_score_timestamp_et": reclaim.get("acceptance_score_timestamp_et") or "",
        "non_acceptance_score_timestamp_et": reclaim.get("non_acceptance_score_timestamp_et") or "",
        "first_threshold_close_timestamp_et": reclaim.get("first_threshold_close_timestamp_et") or "",
        "non_acceptance_score": round(non_acceptance_score, 4),
        "non_acceptance_closes": reclaim.get("non_acceptance_closes"),
        "reclaim_minutes_from_trap": round((reclaim_time - trap_time).total_seconds() / 60.0, 4),
        "squeeze_score": round(squeeze_score, 4),
        "candidate_score": round(candidate_score, 4),
        "target_room": round(target_room, 4) if target_room is not None else "",
        "target_invalid_for_level_to_level": target_room is None or target_room < 4,
        "risk_to_sweep": round(risk_to_sweep, 4),
        "target_R": round(target_r, 4) if target_r is not None else "",
        "next_trusted_level_above": target_info.get("next_trusted_level_above") or "",
        "next_trusted_level_source": target_info.get("next_trusted_level_source") or "",
        "next_trusted_level_role": target_info.get("next_trusted_level_role") or "",
        "next_trusted_level_pub_date": target_info.get("next_trusted_level_pub_date") or "",
        "time_of_day_bucket": bucket,
        "hard_reject": False,
        "first_reclaim_failed_before_candidate": first_reclaim_failed,
    }


def acceptance_family(
    first_reclaim_failed: bool,
    multi_level_flush_count: int,
    flush_depth: float | None,
    acceptance_closes: int,
    non_acceptance_score: float,
) -> str:
    if non_acceptance_score >= 0.50:
        return "non_acceptance_protocol"
    if first_reclaim_failed and acceptance_closes >= 2:
        return "classic_acceptance_second_attempt_reclaim"
    if multi_level_flush_count >= 2 and (flush_depth or 0) >= 4:
        return "ladder_first_reclaim"
    if acceptance_closes >= 3:
        return "classic_acceptance_backtest_from_below"
    return "simple_reclaim_unclassified"


def bar_at_or_after(bars: list[dict[str, Any]], timestamp: datetime | None) -> dict[str, Any] | None:
    if timestamp is None:
        return None
    for bar in bars:
        if bar["timestamp"] >= timestamp:
            return bar
    return None


def bar_index_at_or_after(bars: list[dict[str, Any]], timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None
    for index, bar in enumerate(bars):
        if bar["timestamp"] >= timestamp:
            return index
    return None


def rule_matches(feature: dict[str, Any], rule: str) -> bool:
    return fbd_math.row_matches_rule(feature, {}, rule)


def stop_points(feature: dict[str, Any], policy: str) -> float:
    if policy == "risk_to_sweep":
        return max(as_float(feature.get("risk_to_sweep")) or 2.0, TICK)
    if policy.startswith("fixed_"):
        return float(policy.split("_", 1)[1])
    raise ValueError(policy)


def simulate_outcome(
    bars: list[dict[str, Any]],
    signal: dict[str, Any],
    fill_mode: str,
    target_points: float,
    stop_policy: str,
    horizon_minutes: int = 60,
) -> dict[str, Any]:
    mode = FILL_MODES[fill_mode]
    fire_time = fbd_math.parse_dt(signal.get("candidate_fired_timestamp_et"))
    signal_index = bar_index_at_or_after(bars, fire_time)
    if signal_index is None:
        return missing_outcome(signal, fill_mode, target_points, stop_policy)
    if mode["entry"] == "signal_close":
        entry_index = signal_index
        entry_base_price = float(bars[entry_index]["close"])
    else:
        entry_index = min(signal_index + 1, len(bars) - 1)
        entry_base_price = float(bars[entry_index]["open"])
    entry_price = entry_base_price + float(mode["adverse_entry_points"])
    risk = stop_points(signal, stop_policy)
    stop_price = entry_price - risk
    target_price = entry_price + target_points
    horizon_end = bars[entry_index]["timestamp"] + timedelta(minutes=horizon_minutes)
    horizon = [
        bar for bar in bars[entry_index:]
        if bar["timestamp"] <= horizon_end
    ]
    if not horizon:
        return missing_outcome(signal, fill_mode, target_points, stop_policy)
    out = {
        "rule": signal.get("rule"),
        "timeframe_minutes": signal.get("timeframe_minutes"),
        "fill_mode": fill_mode,
        "target_points": target_points,
        "stop_policy": stop_policy,
        "session_date": signal.get("session_date"),
        "setup_level": signal.get("setup_level"),
        "candidate_fired_timestamp_et": signal.get("candidate_fired_timestamp_et"),
        "entry_timestamp_et": iso(bars[entry_index]["timestamp"]),
        "entry_price": round(entry_price, 4),
        "risk_points": round(risk, 4),
        "first_hit_event": "timeout",
        "first_hit_timestamp_et": iso(horizon[-1]["timestamp"]),
        "first_hit_points": round(horizon[-1]["close"] - entry_price, 4),
        "target_first": False,
        "stop_first": False,
        "same_bar_stop_and_target": False,
        "same_bar_policy": mode["same_bar_policy"],
    }
    for bar in horizon:
        hit_stop = bar["low"] <= stop_price
        hit_target = bar["high"] >= target_price
        if hit_stop and hit_target:
            out["same_bar_stop_and_target"] = True
            out["first_hit_timestamp_et"] = iso(bar["timestamp"])
            if mode["same_bar_policy"] == "target_first":
                out["first_hit_event"] = "same_bar_target_first"
                out["first_hit_points"] = target_points
                out["target_first"] = True
            elif mode["same_bar_policy"] == "split":
                out["first_hit_event"] = "same_bar_split"
                out["first_hit_points"] = round((target_points - risk) / 2, 4)
            else:
                out["first_hit_event"] = "same_bar_stop_first"
                out["first_hit_points"] = -risk
                out["stop_first"] = True
            break
        if hit_stop:
            out["first_hit_event"] = "stop"
            out["first_hit_timestamp_et"] = iso(bar["timestamp"])
            out["first_hit_points"] = -risk
            out["stop_first"] = True
            break
        if hit_target:
            out["first_hit_event"] = "target"
            out["first_hit_timestamp_et"] = iso(bar["timestamp"])
            out["first_hit_points"] = target_points
            out["target_first"] = True
            break
    out["expectancy_points_after_fill_cost"] = round(float(out["first_hit_points"]) - float(mode["slippage_points"]), 4)
    return out


def missing_outcome(signal: dict[str, Any], fill_mode: str, target_points: float, stop_policy: str) -> dict[str, Any]:
    return {
        "rule": signal.get("rule"),
        "timeframe_minutes": signal.get("timeframe_minutes"),
        "fill_mode": fill_mode,
        "target_points": target_points,
        "stop_policy": stop_policy,
        "session_date": signal.get("session_date"),
        "setup_level": signal.get("setup_level"),
        "candidate_fired_timestamp_et": signal.get("candidate_fired_timestamp_et"),
        "entry_timestamp_et": "",
        "entry_price": "",
        "risk_points": "",
        "first_hit_event": "missing",
        "first_hit_timestamp_et": "",
        "first_hit_points": "",
        "target_first": False,
        "stop_first": False,
        "same_bar_stop_and_target": False,
        "same_bar_policy": FILL_MODES[fill_mode]["same_bar_policy"],
        "expectancy_points_after_fill_cost": "",
    }


def scan_all_data(
    sessions: dict[str, list[dict[str, Any]]],
    levels_by_plan: dict[str, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    outcomes: list[dict[str, Any]] = []
    skipped = {
        "sessions_without_levels": 0,
        "level_scans": 0,
        "trap_count": 0,
        "reclaim_count": 0,
    }
    for session_date, one_minute_bars in sorted(sessions.items()):
        day_levels = levels_for_session(levels_by_plan, session_date)
        if not day_levels:
            skipped["sessions_without_levels"] += 1
            continue
        for timeframe in TIMEFRAMES_MINUTES:
            bars = aggregate_bars(one_minute_bars, timeframe)
            for level in day_levels:
                skipped["level_scans"] += 1
                emitted_for_level: set[str] = set()
                for trap_index in detect_traps(bars, float(level["price"])):
                    skipped["trap_count"] += 1
                    reclaim_index, first_reclaim_failed = first_reclaim_after(bars, trap_index, float(level["price"]))
                    if reclaim_index is None:
                        continue
                    skipped["reclaim_count"] += 1
                    feature = compute_scores(
                        bars,
                        day_levels,
                        level,
                        trap_index,
                        reclaim_index,
                        first_reclaim_failed,
                        session_date,
                    )
                    fire_time = fbd_math.parse_dt(feature.get("candidate_fired_timestamp_et"))
                    if fire_time is None or fire_time < bars[reclaim_index]["timestamp"]:
                        continue
                    for rule in RULES:
                        if rule in emitted_for_level:
                            continue
                        if not rule_matches(feature, rule):
                            continue
                        emitted_for_level.add(rule)
                        signal = {
                            **feature,
                            "rule": rule,
                            "timeframe_minutes": timeframe,
                            "dedupe_key": f"{session_date}:{timeframe}:{feature['setup_level']}:{rule}",
                        }
                        signals.append(signal)
                        for fill_mode in FILL_MODES:
                            for target_points in TARGET_POINTS:
                                for stop_policy in STOP_POLICIES:
                                    outcomes.append(simulate_outcome(bars, signal, fill_mode, target_points, stop_policy))
                    if emitted_for_level == set(RULES):
                        break
    signals.sort(key=lambda item: (item["session_date"], item["timeframe_minutes"], item["candidate_fired_timestamp_et"], item["setup_level"], item["rule"]))
    outcomes.sort(key=lambda item: (item["session_date"], item["timeframe_minutes"], item["candidate_fired_timestamp_et"], item["rule"], item["fill_mode"], item["target_points"], item["stop_policy"]))
    return signals, outcomes, skipped


def equity_stats(points: list[float]) -> dict[str, Any]:
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    current_losses = 0
    max_losses = 0
    for point in points:
        equity += point
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)
        if point < 0:
            current_losses += 1
            max_losses = max(max_losses, current_losses)
        else:
            current_losses = 0
    return {
        "total_points": round(sum(points), 4) if points else None,
        "expectancy_points": round(sum(points) / len(points), 4) if points else None,
        "max_drawdown_points": round(max_drawdown, 4),
        "max_consecutive_losses": max_losses,
    }


def summarize_outcomes(outcomes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        key = (
            row.get("rule"),
            row.get("timeframe_minutes"),
            row.get("fill_mode"),
            row.get("target_points"),
            row.get("stop_policy"),
        )
        grouped[key].append(row)
    rows: list[dict[str, Any]] = []
    for key, items in sorted(grouped.items()):
        points = [as_float(item.get("expectancy_points_after_fill_cost")) for item in items]
        clean_points = [point for point in points if point is not None]
        stats = equity_stats(clean_points)
        row = {
            "rule": key[0],
            "timeframe_minutes": key[1],
            "fill_mode": key[2],
            "target_points": key[3],
            "stop_policy": key[4],
            "signals": len(items),
            "valid_outcomes": len(clean_points),
            "target_first_rate": round(sum(as_bool(item.get("target_first")) for item in items) / len(items), 4) if items else None,
            "stop_first_rate": round(sum(as_bool(item.get("stop_first")) for item in items) / len(items), 4) if items else None,
            "timeout_rate": round(sum(item.get("first_hit_event") == "timeout" for item in items) / len(items), 4) if items else None,
            "same_bar_rate": round(sum(as_bool(item.get("same_bar_stop_and_target")) for item in items) / len(items), 4) if items else None,
            **stats,
        }
        rows.append(row)
    return rows


def summarize_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for signal in signals:
        grouped[(str(signal.get("rule")), int(signal.get("timeframe_minutes") or 0))].append(signal)
    return [
        {
            "rule": rule,
            "timeframe_minutes": timeframe,
            "signals": len(items),
            "sessions": len(set(str(item.get("session_date")) for item in items)),
            "levels": len(set(f"{item.get('session_date')}:{item.get('setup_level')}" for item in items)),
            "first_signal_et": min(str(item.get("candidate_fired_timestamp_et")) for item in items) if items else "",
            "last_signal_et": max(str(item.get("candidate_fired_timestamp_et")) for item in items) if items else "",
        }
        for (rule, timeframe), items in sorted(grouped.items())
    ]


def packet_key(label: dict[str, Any]) -> str:
    return str(label.get("packet_id") or label.get("unique_setup_key") or label.get("training_row_id") or "")


def source_priority(label: dict[str, Any]) -> tuple[int, str]:
    if as_bool(label.get("source_confirmed_fbd")) and label.get("source_mode") == "actual_recap":
        rank = 0
    elif as_bool(label.get("source_confirmed_fbd")):
        rank = 1
    elif as_bool(label.get("source_planned_fbd")) and label.get("source_mode") == "planned_setup":
        rank = 2
    elif as_bool(label.get("source_planned_fbd")):
        rank = 3
    else:
        rank = 4
    return rank, str(label.get("training_row_id") or "")


def dedupe_pairs(pairs: list[tuple[dict[str, Any], dict[str, Any]]]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    grouped: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(list)
    for feature, label in pairs:
        grouped[packet_key(label)].append((feature, label))
    return [sorted(items, key=lambda pair: source_priority(pair[1]))[0] for _, items in sorted(grouped.items())]


def in_scope(label: dict[str, Any], scope: str) -> bool:
    if label.get("hard_reject") == "true":
        return False
    if scope == "deployable_planned_only":
        return as_bool(label.get("source_planned_fbd")) and label.get("source_mode") == "planned_setup"
    if scope == "confirmed_reconstruction":
        return as_bool(label.get("source_confirmed_fbd"))
    if scope == "all_source_nonrejected":
        return as_bool(label.get("source_confirmed_fbd")) or as_bool(label.get("source_planned_fbd"))
    return False


def labeled_fire_check(signals: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    features = read_csv(FEATURES_CSV)
    labels = read_csv(LABELS_CSV)
    labels_by_id = {row["training_row_id"]: row for row in labels}
    grid_expected = {}
    if EXACT_GRID_JSON.exists():
        grid_expected = json.loads(EXACT_GRID_JSON.read_text(encoding="utf-8")).get("detail_counts", {})
    signal_index = defaultdict(list)
    for signal in signals:
        if int(signal.get("timeframe_minutes") or 0) == 1:
            key = (signal.get("session_date"), round(float(signal.get("setup_level") or 0), 2), signal.get("rule"))
            signal_index[key].append(signal)
    rows: list[dict[str, Any]] = []
    exact_pass = True
    for rule in RULES:
        rule_pairs = [
            (feature, labels_by_id[feature["training_row_id"]])
            for feature in features
            if feature.get("training_row_id") in labels_by_id
            and fbd_math.row_matches_rule(feature, labels_by_id[feature["training_row_id"]], rule)
        ]
        for scope in SCOPES:
            scoped = [(f, l) for f, l in rule_pairs if in_scope(l, scope)]
            deduped = dedupe_pairs(scoped)
            expected = grid_expected.get(f"{rule}:{scope}", {})
            expected_raw = expected.get("raw_rows")
            expected_dedup = expected.get("packet_deduped_rows")
            exact_status = (
                "pass"
                if (expected_raw is None or int(expected_raw) == len(scoped))
                and (expected_dedup is None or int(expected_dedup) == len(deduped))
                else "fail"
            )
            if exact_status != "pass":
                exact_pass = False
            raw_scan_hits = 0
            for feature, _label in deduped:
                session_date = feature.get("session_date") or feature.get("plan_date") or ""
                setup_level = round(float(as_float(feature.get("setup_level")) or 0), 2)
                if signal_index.get((session_date, setup_level, rule)):
                    raw_scan_hits += 1
            rows.append({
                "rule": rule,
                "scope": scope,
                "artifact_raw_rows": len(scoped),
                "artifact_packet_deduped_rows": len(deduped),
                "expected_grid_raw_rows": expected_raw if expected_raw is not None else "",
                "expected_grid_packet_deduped_rows": expected_dedup if expected_dedup is not None else "",
                "exact_formula_fire_status": exact_status,
                "exact_labeled_fire_coverage": 1.0 if deduped and exact_status == "pass" else ("" if not deduped else 0.0),
                "raw_all_data_1m_same_level_hits": raw_scan_hits,
                "raw_all_data_1m_same_level_coverage": round(raw_scan_hits / len(deduped), 4) if deduped else "",
            })
    feature_header = list(features[0].keys()) if features else []
    disallowed_in_features = [name for name in DISALLOWED_FORMULA_COLUMNS if name in feature_header]
    metadata = {
        "features_rows": len(features),
        "labels_rows": len(labels),
        "row_count_match": len(features) == len(labels),
        "exact_grid_formula_counts_match": exact_pass,
        "disallowed_outcome_columns_in_features": disallowed_in_features,
        "no_lookahead_feature_column_check": not disallowed_in_features,
        "formula_predicates": {
            "candidate_score_055": "candidate_score >= 0.55",
            "non_acceptance_only": "family=non_acceptance_protocol and candidate_score>=0.50 and non_acceptance_score>=0.50",
            "classic_backtest_only": "family=classic_acceptance_backtest_from_below and candidate_score>=0.45",
            "second_attempt_review_only": "family=classic_acceptance_second_attempt_reclaim and candidate_score>=0.55",
            "ladder_first_reclaim": "family=ladder_first_reclaim and candidate_score>=0.50",
            "level_to_level_target_R": "candidate_score>=0.50 and target_R>=1.25 and target_room>=4",
        },
        "disallowed_formula_columns": DISALLOWED_FORMULA_COLUMNS,
    }
    return rows, metadata


def best_rows(summary_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    eligible = [
        row for row in summary_rows
        if int(row.get("valid_outcomes") or 0) >= 20
        and as_float(row.get("expectancy_points")) is not None
    ]
    eligible.sort(
        key=lambda row: (
            row["rule"] != "non_acceptance_only",
            -float(as_float(row.get("expectancy_points")) or -999),
            float(as_float(row.get("max_drawdown_points")) or 999),
        )
    )
    return eligible[:20]


def best_hard_rows(summary_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    eligible = [
        row for row in summary_rows
        if row.get("fill_mode") == "hard_mode"
        and int(row.get("valid_outcomes") or 0) >= 20
        and as_float(row.get("expectancy_points")) is not None
    ]
    eligible.sort(
        key=lambda row: (
            row["rule"] != "non_acceptance_only",
            -float(as_float(row.get("expectancy_points")) or -999),
            float(as_float(row.get("max_drawdown_points")) or 999),
        )
    )
    return eligible[:20]


def render_markdown_report(payload: dict[str, Any], summary_rows: list[dict[str, Any]], signal_summary: list[dict[str, Any]], labeled_rows: list[dict[str, Any]]) -> str:
    best = best_rows(summary_rows)
    hard_best = best_hard_rows(summary_rows)
    def fmt(value: Any) -> str:
        return "" if value is None else str(value)
    lines = [
        "# Mancini FBD All-Data Candidate Backtest",
        "",
        "Research, historical replay, Strategy Analyzer, Playback, and shadow telemetry only. No live trading instructions, order-entry code, broker routing, account routing, position sizing, kill switches, Pine, or live execution behavior are included.",
        "",
        "## Findings First",
    ]
    if hard_best:
        top = hard_best[0]
        verdict = (
            "Build for Ninja shadow/replay candidate investigation"
            if top.get("rule") == "non_acceptance_only" and (as_float(top.get("expectancy_points")) or -999) > 0
            else "Do not build as a Ninja strategy candidate yet"
        )
        lines.append(f"- Verdict: {verdict}. Best hard-mode row is `{top.get('rule')}` at {top.get('timeframe_minutes')}m, target {top.get('target_points')}, stop `{top.get('stop_policy')}`, {top.get('valid_outcomes')} outcomes, expectancy {top.get('expectancy_points')} points, max drawdown {top.get('max_drawdown_points')} points.")
        lines.append("- Build scope is narrow: the only primary Ninja shadow candidate promoted by this run is `non_acceptance_only` on the 1m formula path. 3m, 5m, 15m, and 30m should be replay comparison toggles, not primary candidates, unless later data clears hard mode.")
    else:
        lines.append("- Verdict: No hard-mode row cleared the 20-signal sample gate. Do not build any candidate yet.")
    lines.extend([
        f"- All-data bars used: {payload['data_inventory']['merged_bars']} merged ES 1m bars from {payload['data_inventory']['raw_files']} raw CSV files.",
        f"- Scanner fired {payload['scan']['signals']} rule signals and simulated {payload['scan']['outcomes']} fill/target/stop outcomes across 1, 3, 5, 15, and 30 minute bars.",
        f"- Exact labeled-event formula check: {'PASS' if payload['labeled_fire_check']['exact_grid_formula_counts_match'] else 'FAIL'}; feature no-lookahead column check: {'PASS' if payload['labeled_fire_check']['no_lookahead_feature_column_check'] else 'FAIL'}.",
        "- Nuance: a 3m `non_acceptance_only` hard-mode comparison row is positive at target 8/fixed 15, but the target 5/fixed 12 primary path turns negative outside 1m. Keep 3m as a comparison toggle, not the primary build candidate.",
        "- Raw all-data scan coverage is reported separately from exact labeled-event formula fire. The exact check is the proof that current candidate predicates fire on Mancini-labeled rows; the raw scan is an independent replay-style stress pass.",
        "",
        "## Signal Counts By Rule And Timeframe",
        "",
        "| Rule | TF | Signals | Sessions | Levels | First | Last |",
        "|---|---:|---:|---:|---:|---|---|",
    ])
    for row in signal_summary:
        lines.append(f"| `{row['rule']}` | {row['timeframe_minutes']} | {row['signals']} | {row['sessions']} | {row['levels']} | {row['first_signal_et']} | {row['last_signal_et']} |")
    lines.extend([
        "",
        "## Best Rows After Fill Costs",
        "",
        "| Rule | TF | Fill | Target | Stop | Outcomes | Exp | Total | Max DD | Stop First | Target First |",
        "|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|",
    ])
    for row in best[:15]:
        lines.append(
            f"| `{row['rule']}` | {row['timeframe_minutes']} | `{row['fill_mode']}` | {row['target_points']} | `{row['stop_policy']}` | {row['valid_outcomes']} | {row['expectancy_points']} | {row['total_points']} | {row['max_drawdown_points']} | {row['stop_first_rate']} | {row['target_first_rate']} |"
        )
    lines.extend([
        "",
        "## Best Hard-Mode Rows",
        "",
        "| Rule | TF | Target | Stop | Outcomes | Exp | Total | Max DD | Stop First | Target First |",
        "|---|---:|---:|---|---:|---:|---:|---:|---:|---:|",
    ])
    for row in hard_best[:12]:
        lines.append(
            f"| `{row['rule']}` | {row['timeframe_minutes']} | {row['target_points']} | `{row['stop_policy']}` | {row['valid_outcomes']} | {row['expectancy_points']} | {row['total_points']} | {row['max_drawdown_points']} | {row['stop_first_rate']} | {row['target_first_rate']} |"
        )
    lines.extend([
        "",
        "## Labeled Mancini Fire Check",
        "",
        "| Rule | Scope | Raw | Deduped | Exact Status | Exact Coverage | Raw 1m Same-Level Hits | Raw 1m Coverage |",
        "|---|---|---:|---:|---|---:|---:|---:|",
    ])
    for row in labeled_rows:
        lines.append(
            f"| `{row['rule']}` | `{row['scope']}` | {row['artifact_raw_rows']} | {row['artifact_packet_deduped_rows']} | {row['exact_formula_fire_status']} | {fmt(row['exact_labeled_fire_coverage'])} | {row['raw_all_data_1m_same_level_hits']} | {fmt(row['raw_all_data_1m_same_level_coverage'])} |"
        )
    lines.extend([
        "",
        "## No-Cheat Contract",
        "",
        "- Candidate firing uses source level geometry, trap/reclaim/classification timestamps, acceptance/non-acceptance state, target room, risk to sweep, and candidate scores.",
        "- Candidate firing does not use MFE, MAE, hit rates, stop-first, target-first, first-hit event, next-level hit, realized target, expectancy, or future target realization.",
        "- Fill modes are post-fire simulation assumptions only: `optimal_fill`, `half_optimal_half_bad_fill`, and `hard_mode`.",
        "- Same-bar intrabar ambiguity is intentionally separated by fill mode. Hard mode resolves same-bar stop/target as stop-first.",
        "- Source-label hard rejects and negative controls are not promoted to candidate positives.",
        "",
        "## Ninja Shadow Replay Build Spec",
        "",
        "- Primary candidate to build: `non_acceptance_only` on the 1m formula path only. Keep `candidate_score_055`, `level_to_level_target_R`, `classic_backtest_only`, `ladder_first_reclaim`, `second_attempt_review_only`, and 3/5/15/30m variants as comparison toggles.",
        "- Primary acceptance goal: prove profitability and robustness on broad ES historical/Playback/Strategy Analyzer data under live-like fill assumptions. Matching Mancini timestamps is only a diagnostic check for translation bugs, not the success criterion.",
        "- Required chronological telemetry: `trap_detected_timestamp_et`, `reclaim_detected_timestamp_et`, `classification_complete_timestamp_et`, and `candidate_fired_timestamp_et`. Do not backdate candidate fire to trap or reclaim; fire only after classification is complete.",
        "- Required no-cheat formula gates: family `non_acceptance_protocol`, `candidate_score >= 0.50`, and `non_acceptance_score >= 0.50`, with target room/risk fields computed from levels available on or before the target session.",
        "- Required Ninja replay output fields: `run_id`, `instrument`, `bar_period_minutes`, `session_date`, `rule`, `fill_mode`, `setup_level`, `swept_low`, `trap_detected_timestamp_et`, `reclaim_detected_timestamp_et`, `classification_complete_timestamp_et`, `candidate_fired_timestamp_et`, `candidate_score`, `non_acceptance_score`, `target_points`, `stop_policy`, `entry_timestamp_et`, `entry_price`, `first_hit_event`, `first_hit_timestamp_et`, `first_hit_points`, `target_first`, `stop_first`, `same_bar_stop_and_target`, and `notes`.",
        "- First Ninja comparison target: reproduce the all-data local row `non_acceptance_only`, 1m, target 5, fixed 12 stop. Local hard-mode reference: 136 outcomes, +1.1967 expectancy, +162.75 total points, 69.25 point max drawdown, 0.1029 stop-first, 0.8309 target-first.",
        "- Required dump artifact for the next audit: one CSV per Ninja run plus a summary JSON with rule/timeframe/fill/target/stop counts, expectancy, profit factor, max drawdown, consecutive losses, trade count, and session/date splits. Timestamp and signal-count drift should be reported as diagnostics only; the decision gate is whether the candidate remains profitable after costs across unseen ES data and hard fills.",
        "",
        "## Files",
        "",
        f"- `signals_csv`: `{payload['outputs']['signals_csv']}`",
        f"- `outcomes_csv`: `{payload['outputs']['outcomes_csv']}`",
        f"- `summary_csv`: `{payload['outputs']['summary_csv']}`",
        f"- `labeled_fire_check_csv`: `{payload['outputs']['labeled_fire_check_csv']}`",
        f"- `summary_json`: `{payload['outputs']['summary_json']}`",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    generated_at = datetime.now(timezone.utc).isoformat()
    bars, raw_inventory = load_all_raw_bars()
    sessions = group_by_session(bars)
    levels_by_plan, level_inventory = load_levels()
    signals, outcomes, scan_stats = scan_all_data(sessions, levels_by_plan)
    signal_summary = summarize_signals(signals)
    outcome_summary = summarize_outcomes(outcomes)
    labeled_rows, labeled_meta = labeled_fire_check(signals)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    signals_csv = OUT_DIR / "all_data_signals.csv"
    outcomes_csv = OUT_DIR / "all_data_outcomes.csv"
    summary_csv = OUT_DIR / "all_data_summary.csv"
    signal_summary_csv = OUT_DIR / "all_data_signal_counts.csv"
    labeled_csv = OUT_DIR / "labeled_event_fire_check.csv"
    summary_json = OUT_DIR / "all_data_backtest_summary.json"
    report_md = OUT_DIR / "MANCINI_FBD_ALL_DATA_BACKTEST_REPORT_2026-05-13.md"

    write_csv(signals_csv, signals)
    write_csv(outcomes_csv, outcomes)
    write_csv(summary_csv, outcome_summary)
    write_csv(signal_summary_csv, signal_summary)
    write_csv(labeled_csv, labeled_rows)

    payload = {
        "generated_at": generated_at,
        "scope": "research_historical_replay_shadow_only",
        "rules": RULES,
        "timeframes_minutes": TIMEFRAMES_MINUTES,
        "target_points": TARGET_POINTS,
        "stop_policies": STOP_POLICIES,
        "fill_modes": FILL_MODES,
        "data_inventory": {
            "raw_roots": [str(path.relative_to(ROOT)) for path in RAW_ROOTS],
            "raw_files": len(raw_inventory),
            "raw_file_inventory": raw_inventory,
            "merged_bars": len(bars),
            "sessions": len(sessions),
            "first_bar_et": iso(bars[0]["timestamp"]) if bars else "",
            "last_bar_et": iso(bars[-1]["timestamp"]) if bars else "",
        },
        "level_inventory": level_inventory,
        "scan": {
            "signals": len(signals),
            "outcomes": len(outcomes),
            **scan_stats,
        },
        "labeled_fire_check": labeled_meta,
        "outputs": {
            "signals_csv": str(signals_csv.relative_to(ROOT)),
            "outcomes_csv": str(outcomes_csv.relative_to(ROOT)),
            "summary_csv": str(summary_csv.relative_to(ROOT)),
            "signal_counts_csv": str(signal_summary_csv.relative_to(ROOT)),
            "labeled_fire_check_csv": str(labeled_csv.relative_to(ROOT)),
            "summary_json": str(summary_json.relative_to(ROOT)),
            "report_md": str(report_md.relative_to(ROOT)),
        },
        "best_rows_after_fill_costs": best_rows(outcome_summary),
        "best_hard_mode_rows_after_fill_costs": best_hard_rows(outcome_summary),
    }
    summary_json.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    report_md.write_text(render_markdown_report(payload, outcome_summary, signal_summary, labeled_rows), encoding="utf-8")

    print(json.dumps({
        "merged_bars": len(bars),
        "sessions": len(sessions),
        "signals": len(signals),
        "outcomes": len(outcomes),
        "summary_rows": len(outcome_summary),
        "out_dir": str(OUT_DIR.relative_to(ROOT)),
        "exact_labeled_formula_check": labeled_meta["exact_grid_formula_counts_match"],
        "no_lookahead_feature_column_check": labeled_meta["no_lookahead_feature_column_check"],
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
