#!/usr/bin/env python3
"""Generate deterministic Mancini FBD feature math and validation reports.

Offline research only. Features are generated from source-first training rows,
packet windows, and frozen ES session JSONs. Candidate scores avoid future
outcome fields; MFE/MAE and hit rates are emitted as labels/validation only.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "artifacts/research/mancini-fbd-algo-training-table"
TRAINING_ROWS = TRAINING_DIR / "training_rows.jsonl"
EVENTS_CSV = ROOT / "artifacts/research/mancini-context-protocol/events.csv"
SESSIONS_DIR = ROOT / "data/backtest/es-long-bracket/sessions"

OUT_DIR = ROOT / "artifacts/research/mancini-fbd-algo-math"
FEATURES_CSV = OUT_DIR / "features.csv"
LABELS_CSV = OUT_DIR / "labels.csv"
CANDIDATE_RULE_SCORES = OUT_DIR / "candidate_rule_scores.json"
WALK_FORWARD_REPORT = OUT_DIR / "walk_forward_report.md"

TICK = 0.25
ACCEPTANCE_FAMILIES = [
    "non_acceptance_protocol",
    "classic_acceptance_backtest_from_below",
    "classic_acceptance_second_attempt_reclaim",
    "ladder_first_reclaim",
    "simple_reclaim_unclassified",
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
        return str(p)
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def root_path(path: str | None) -> Path | None:
    if not path:
        return None
    p = Path(path)
    if p.is_absolute():
        return p
    return ROOT / p


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        if isinstance(value, str) and value.strip().lower() in {"nan", "none", "null"}:
            return None
        out = float(value)
        if math.isnan(out) or math.isinf(out):
            return None
        return out
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def clamp(value: float | None, low: float, high: float) -> float:
    if value is None:
        return low
    return max(low, min(high, value))


def indicator(value: bool) -> float:
    return 1.0 if value else 0.0


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def date_key(row: dict[str, Any]) -> str:
    return str(row.get("session_date") or row.get("plan_date") or row.get("pub_date") or "")


def source_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def load_window_bars(path_text: str | None) -> list[dict[str, Any]]:
    path = root_path(path_text)
    if not path or not path.exists():
        return []
    rows = read_csv(path)
    bars: list[dict[str, Any]] = []
    for row in rows:
        timestamp = parse_dt(row.get("timestamp_et") or row.get("timestamp"))
        open_ = as_float(row.get("open"))
        high = as_float(row.get("high"))
        low = as_float(row.get("low"))
        close = as_float(row.get("close"))
        if timestamp is None or open_ is None or high is None or low is None or close is None:
            continue
        bars.append({
            "timestamp": timestamp,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": as_float(row.get("volume")) or 0.0,
        })
    return bars


def load_sessions() -> dict[str, list[dict[str, Any]]]:
    sessions: dict[str, list[dict[str, Any]]] = {}
    if not SESSIONS_DIR.exists():
        return sessions
    for path in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("example"):
            continue
        bars_obj = data.get("bars") if isinstance(data, dict) else {}
        raw_bars = bars_obj.get("es") if isinstance(bars_obj, dict) else []
        parsed: list[dict[str, Any]] = []
        for row in raw_bars or []:
            timestamp = parse_dt(row.get("timestamp"))
            open_ = as_float(row.get("open"))
            high = as_float(row.get("high"))
            low = as_float(row.get("low"))
            close = as_float(row.get("close"))
            if timestamp is None or open_ is None or high is None or low is None or close is None:
                continue
            parsed.append({
                "timestamp": timestamp,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": as_float(row.get("volume")) or 0.0,
            })
        sessions[str(data.get("date") or path.stem)] = parsed
    return sessions


def load_event_levels() -> dict[str, list[dict[str, Any]]]:
    if not EVENTS_CSV.exists():
        return {}
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in read_csv(EVENTS_CSV):
        price = as_float(row.get("price") or row.get("zone_low"))
        plan_date = row.get("plan_date") or ""
        if price is None or not plan_date:
            continue
        out[plan_date].append({
            "price": price,
            "direction": row.get("direction") or "",
            "primary_role": row.get("primary_role") or "",
            "source_kind": row.get("source_kind") or "",
            "source_id": row.get("source_id") or "",
            "pub_date": row.get("pub_date") or "",
            "long_eligible": as_bool(row.get("long_eligible")),
            "saty_valid": as_bool(row.get("saty_valid")),
            "source_snippet": row.get("source_snippet") or "",
        })
    for rows in out.values():
        rows.sort(key=lambda item: item["price"])
    return out


def first_bar_at_or_after(bars: list[dict[str, Any]], timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None
    for index, bar in enumerate(bars):
        if bar["timestamp"] >= timestamp:
            return index
    return None


def window_until(bars: list[dict[str, Any]], start_index: int, minutes: int) -> list[dict[str, Any]]:
    if start_index is None or start_index >= len(bars):
        return []
    start = bars[start_index]["timestamp"]
    end = start + timedelta(minutes=minutes)
    return [bar for bar in bars[start_index:] if bar["timestamp"] <= end]


def iso_timestamp(value: datetime | None) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


def bar_at_time(bars: list[dict[str, Any]], timestamp: datetime | None) -> dict[str, Any] | None:
    index = first_bar_at_or_after(bars, timestamp)
    if index is None:
        return None
    return bars[index]


def median(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return float(statistics.median(clean))


def average(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 4)


def hit_rate(rows: list[dict[str, Any]], field: str) -> float | None:
    if not rows:
        return None
    return round(sum(1 for row in rows if as_bool(row.get(field))) / len(rows), 4)


def percentile_dates(dates: list[str]) -> list[tuple[str, list[str], list[str]]]:
    unique = sorted(d for d in set(dates) if d)
    if len(unique) < 3:
        return [("all_dates", unique, unique)]
    folds: list[tuple[str, list[str], list[str]]] = []
    cut_points = sorted(set([max(1, len(unique) // 3), max(2, (len(unique) * 2) // 3)]))
    for idx, cut in enumerate(cut_points, start=1):
        train = unique[:cut]
        test = unique[cut:]
        if train and test:
            folds.append((f"walk_forward_{idx}", train, test))
    return folds or [("all_dates", unique, unique)]


def bars_for_row(row: dict[str, Any], sessions: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    window_bars = load_window_bars(row.get("window_csv"))
    if window_bars:
        return window_bars
    session_date = row.get("session_date") or row.get("plan_date") or ""
    bars = sessions.get(str(session_date)) or []
    if bars:
        return bars
    return []


def count_levels_between(events_by_plan: dict[str, list[dict[str, Any]]], plan_date: str, low: float | None, high: float | None) -> int:
    if low is None or high is None:
        return 0
    lower, upper = sorted([low, high])
    return sum(
        1 for item in events_by_plan.get(plan_date, [])
        if lower < item["price"] < upper and item.get("direction") == "support"
    )


def next_trusted_level(events_by_plan: dict[str, list[dict[str, Any]]], plan_date: str, entry: float | None) -> dict[str, Any]:
    if entry is None:
        return {}
    candidates = [
        item for item in events_by_plan.get(plan_date, [])
        if item["price"] > entry + TICK
    ]
    if not candidates:
        return {}
    chosen = min(candidates, key=lambda item: item["price"])
    return {
        "next_trusted_level_above": chosen["price"],
        "next_trusted_level_source": chosen.get("source_kind") or "mancini",
        "next_trusted_level_role": chosen.get("primary_role") or "",
        "next_trusted_level_pub_date": chosen.get("pub_date") or "",
    }


def compute_prior_touch_stats(bars: list[dict[str, Any]], level: float | None, trap_time: datetime | None) -> dict[str, Any]:
    if level is None or not bars:
        return {"prior_touch_count": 0, "prior_hold_minutes": 0.0, "prior_bounce_points": 0.0}
    prior = [bar for bar in bars if trap_time is None or bar["timestamp"] < trap_time]
    touches = [
        bar for bar in prior
        if bar["low"] <= level + 1.0 and bar["high"] >= level - 1.0
    ]
    if not touches:
        return {"prior_touch_count": 0, "prior_hold_minutes": 0.0, "prior_bounce_points": 0.0}
    first = touches[0]["timestamp"]
    last = touches[-1]["timestamp"]
    after_first = [bar for bar in prior if bar["timestamp"] >= first and bar["timestamp"] <= (trap_time or prior[-1]["timestamp"])]
    return {
        "prior_touch_count": len(touches),
        "prior_hold_minutes": round(max((last - first).total_seconds() / 60.0, 0.0), 4),
        "prior_bounce_points": round(max([bar["high"] for bar in after_first] or [level]) - level, 4),
    }


def compute_reclaim_metrics(
    bars: list[dict[str, Any]],
    level: float | None,
    reclaim_time: datetime | None,
    trap_time: datetime | None,
) -> dict[str, Any]:
    if level is None or not bars:
        return {
            "reclaim_close_location": None,
            "reclaim_range": None,
            "acceptance_closes_above_L": 0,
            "acceptance_closes_used_for_score": 0,
            "non_acceptance_closes": 0,
            "non_acceptance_closes_used_for_score": 0,
            "any_close_above_L_plus_5_within_10m": False,
            "first_retest_of_L_holds_after_crossing_L_plus_5": False,
            "no_close_back_below_L_before_entry": False,
            "reclaim_price": None,
            "reclaim_timestamp_et": "",
            "acceptance_score_timestamp_et": "",
            "acceptance_classification_timestamp_et": "",
            "non_acceptance_score_timestamp_et": "",
            "non_acceptance_classification_timestamp_et": "",
        }
    index = first_bar_at_or_after(bars, reclaim_time) if reclaim_time else None
    if index is None:
        start_index = first_bar_at_or_after(bars, trap_time) if trap_time else None
        if start_index is None:
            return {
                "reclaim_close_location": None,
                "reclaim_range": None,
                "acceptance_closes_above_L": 0,
                "acceptance_closes_used_for_score": 0,
                "non_acceptance_closes": 0,
                "non_acceptance_closes_used_for_score": 0,
                "any_close_above_L_plus_5_within_10m": False,
                "first_retest_of_L_holds_after_crossing_L_plus_5": False,
                "no_close_back_below_L_before_entry": False,
                "reclaim_price": None,
                "reclaim_timestamp_et": "",
                "acceptance_score_timestamp_et": "",
                "acceptance_classification_timestamp_et": "",
                "non_acceptance_score_timestamp_et": "",
                "non_acceptance_classification_timestamp_et": "",
            }
        for i, bar in enumerate(bars[start_index + 1:], start=start_index + 1):
            if bar["close"] >= level:
                index = i
                break
    if index is None:
        return {
            "reclaim_close_location": None,
            "reclaim_range": None,
            "acceptance_closes_above_L": 0,
            "acceptance_closes_used_for_score": 0,
            "non_acceptance_closes": 0,
            "non_acceptance_closes_used_for_score": 0,
            "any_close_above_L_plus_5_within_10m": False,
            "first_retest_of_L_holds_after_crossing_L_plus_5": False,
            "no_close_back_below_L_before_entry": False,
            "reclaim_price": None,
            "reclaim_timestamp_et": "",
            "acceptance_score_timestamp_et": "",
            "acceptance_classification_timestamp_et": "",
            "non_acceptance_score_timestamp_et": "",
            "non_acceptance_classification_timestamp_et": "",
        }
    reclaim = bars[index]
    reclaim_range = max(reclaim["high"] - reclaim["low"], TICK)
    post = bars[index:index + 16]
    ten_min = bars[index:index + 11]
    acceptance_closes = 0
    acceptance_closes_used_for_score = 0
    acceptance_score_time = None
    acceptance_classification_time = None
    for bar in post:
        if bar["close"] >= level:
            acceptance_closes += 1
            if acceptance_closes <= 3:
                acceptance_closes_used_for_score = acceptance_closes
                acceptance_score_time = bar["timestamp"]
            if acceptance_closes >= 3 and acceptance_classification_time is None:
                acceptance_classification_time = bar["timestamp"]
        else:
            break
    threshold = level + 5
    non_acceptance_closes = 0
    non_acceptance_closes_used_for_score = 0
    threshold_started = False
    first_retest_holds = False
    first_threshold_close_time = None
    non_acceptance_score_time = None
    non_acceptance_classification_time = None
    for bar in post:
        if bar["close"] >= threshold:
            threshold_started = True
            if first_threshold_close_time is None:
                first_threshold_close_time = bar["timestamp"]
            non_acceptance_closes += 1
            if non_acceptance_closes <= 3:
                non_acceptance_closes_used_for_score = non_acceptance_closes
                non_acceptance_score_time = bar["timestamp"]
            score_available = 0.40 + 0.30 * clamp(non_acceptance_closes / 3, 0, 1)
            if score_available >= 0.50 and non_acceptance_classification_time is None:
                non_acceptance_classification_time = bar["timestamp"]
        elif threshold_started and bar["low"] <= level + 0.5:
            first_retest_holds = bar["close"] >= level
            if first_retest_holds:
                non_acceptance_score_time = bar["timestamp"]
            if first_retest_holds and non_acceptance_classification_time is None:
                non_acceptance_classification_time = bar["timestamp"]
            break
        elif threshold_started:
            break
    classification_time_candidates = [
        parse_dt(iso_timestamp(acceptance_classification_time)),
        parse_dt(iso_timestamp(non_acceptance_classification_time)),
    ]
    scored_times = [time for time in classification_time_candidates if time]
    if scored_times:
        latest_score_time = max(scored_times)
    else:
        latest_score_time = post[-1]["timestamp"] if post else reclaim["timestamp"]
    no_close_back_below = all(
        bar["close"] >= level
        for bar in bars[index:]
        if bar["timestamp"] <= latest_score_time
    )
    return {
        "reclaim_close_location": round((reclaim["close"] - reclaim["low"]) / reclaim_range, 4),
        "reclaim_range": round(reclaim["high"] - reclaim["low"], 4),
        "acceptance_closes_above_L": acceptance_closes,
        "acceptance_closes_used_for_score": acceptance_closes_used_for_score,
        "non_acceptance_closes": non_acceptance_closes,
        "non_acceptance_closes_used_for_score": non_acceptance_closes_used_for_score,
        "any_close_above_L_plus_5_within_10m": any(bar["close"] >= threshold for bar in ten_min),
        "first_retest_of_L_holds_after_crossing_L_plus_5": first_retest_holds,
        "no_close_back_below_L_before_entry": no_close_back_below,
        "reclaim_price": reclaim["close"],
        "reclaim_timestamp_et": reclaim["timestamp"].isoformat(),
        "acceptance_score_timestamp_et": iso_timestamp(acceptance_score_time),
        "acceptance_classification_timestamp_et": iso_timestamp(acceptance_classification_time),
        "non_acceptance_score_timestamp_et": iso_timestamp(non_acceptance_score_time),
        "non_acceptance_classification_timestamp_et": iso_timestamp(non_acceptance_classification_time),
        "first_threshold_close_timestamp_et": iso_timestamp(first_threshold_close_time),
    }


def compute_mfe_mae(bars: list[dict[str, Any]], entry_time: datetime | None, entry_price: float | None, minutes: int) -> tuple[float | None, float | None, bool]:
    if entry_time is None or entry_price is None or not bars:
        return None, None, False
    index = first_bar_at_or_after(bars, entry_time)
    if index is None:
        return None, None, False
    horizon = window_until(bars, index, minutes)
    if not horizon:
        return None, None, False
    max_high = max(bar["high"] for bar in horizon)
    min_low = min(bar["low"] for bar in horizon)
    complete = horizon[-1]["timestamp"] >= bars[index]["timestamp"] + timedelta(minutes=minutes)
    return round(max_high - entry_price, 4), round(entry_price - min_low, 4), complete


def compute_first_hit_outcome(
    bars: list[dict[str, Any]],
    entry_time: datetime | None,
    entry_price: float | None,
    stop_points: float | None,
    target_points: float | None,
    minutes: int = 60,
) -> dict[str, Any]:
    out = {
        "first_hit_event": "none",
        "first_hit_timestamp_et": "",
        "first_hit_points": 0.0,
        "stop_first": False,
        "target_first": False,
        "same_bar_stop_and_target": False,
        "expectancy_points_slippage_0_5": -0.5,
    }
    if entry_time is None or entry_price is None or not bars:
        out["first_hit_event"] = "missing"
        out["first_hit_points"] = None
        out["expectancy_points_slippage_0_5"] = None
        return out
    risk = stop_points if stop_points is not None and stop_points > 0 else 2.0
    target = target_points if target_points is not None and target_points > 0 else 3.0
    index = first_bar_at_or_after(bars, entry_time)
    if index is None:
        out["first_hit_event"] = "missing"
        out["first_hit_points"] = None
        out["expectancy_points_slippage_0_5"] = None
        return out
    horizon = window_until(bars, index, minutes)
    if not horizon:
        out["first_hit_event"] = "missing"
        out["first_hit_points"] = None
        out["expectancy_points_slippage_0_5"] = None
        return out
    stop_price = entry_price - risk
    target_price = entry_price + target
    for bar in horizon:
        hit_stop = bar["low"] <= stop_price
        hit_target = bar["high"] >= target_price
        if hit_stop and hit_target:
            out.update({
                "first_hit_event": "same_bar_stop_and_target",
                "first_hit_timestamp_et": iso_timestamp(bar["timestamp"]),
                "first_hit_points": -risk,
                "stop_first": True,
                "same_bar_stop_and_target": True,
                "expectancy_points_slippage_0_5": round(-risk - 0.5, 4),
            })
            return out
        if hit_stop:
            out.update({
                "first_hit_event": "stop",
                "first_hit_timestamp_et": iso_timestamp(bar["timestamp"]),
                "first_hit_points": -risk,
                "stop_first": True,
                "expectancy_points_slippage_0_5": round(-risk - 0.5, 4),
            })
            return out
        if hit_target:
            out.update({
                "first_hit_event": "target",
                "first_hit_timestamp_et": iso_timestamp(bar["timestamp"]),
                "first_hit_points": target,
                "target_first": True,
                "expectancy_points_slippage_0_5": round(target - 0.5, 4),
            })
            return out
    timeout_points = horizon[-1]["close"] - entry_price
    out["first_hit_event"] = "timeout"
    out["first_hit_timestamp_et"] = iso_timestamp(horizon[-1]["timestamp"])
    out["first_hit_points"] = round(timeout_points, 4)
    out["expectancy_points_slippage_0_5"] = round(timeout_points - 0.5, 4)
    return out


def time_bucket(timestamp: datetime | None) -> str:
    if timestamp is None:
        return "missing"
    hour = timestamp.hour
    minute = timestamp.minute
    minutes = hour * 60 + minute
    if minutes < 9 * 60 + 30:
        return "overnight_premarket"
    if minutes < 11 * 60:
        return "rth_open"
    if minutes < 14 * 60:
        return "midday"
    if minutes < 15 * 60:
        return "afternoon"
    if minutes < 16 * 60:
        return "power_hour"
    return "post_rth"


def time_bonus(bucket: str) -> float:
    return {
        "rth_open": 0.6,
        "power_hour": 1.0,
        "afternoon": 0.4,
        "overnight_premarket": 0.35,
        "midday": 0.15,
    }.get(bucket, 0.0)


def major_source_bonus(row: dict[str, Any]) -> float:
    text = " ".join([
        str(row.get("source_quote") or ""),
        str(row.get("level_role_map") or ""),
        str(row.get("support_context") or ""),
    ]).lower()
    markers = ["major", "massive", "significant", "daily low", "shelf", "low held", "big shelf"]
    return indicator(any(marker in text for marker in markers))


def hard_reject_reasons(row: dict[str, Any], feature: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    if as_bool(row.get("source_negative_control")):
        reasons.append("source_negative_control")
    if as_bool(row.get("sr_list_only")):
        reasons.append("sr_list_only")
    if as_bool(row.get("data_only")):
        reasons.append("no_source_data_only")
    if as_bool(row.get("chart_mismatch")):
        reasons.append("chart_mismatch")
    if feature.get("setup_level") is None:
        reasons.append("missing_setup_level")
    if not as_bool(row.get("es_window_available")) or as_int(row.get("bars_available")) in (None, 0):
        reasons.append("missing_bars")
    if not as_bool(row.get("chart_confirmed_reclaim")):
        reasons.append("no_reclaim")
    if as_bool(row.get("source_confirmed_fbd")) or as_bool(row.get("source_planned_fbd")):
        if not as_bool(row.get("accepted_for_timing_test")):
            reasons.append("not_accepted_for_timing_test")
    trap_time = parse_dt(feature.get("trap_detected_timestamp_et"))
    reclaim_time = parse_dt(feature.get("reclaim_detected_timestamp_et"))
    fire_time = parse_dt(feature.get("classification_complete_timestamp_et"))
    if trap_time and reclaim_time and reclaim_time <= trap_time:
        reasons.append("reclaim_not_after_trap")
    if trap_time and fire_time and fire_time <= trap_time:
        reasons.append("candidate_fire_not_after_trap")
    if reclaim_time and fire_time and fire_time < reclaim_time:
        reasons.append("candidate_fire_before_reclaim")
    if as_bool(row.get("chart_confirmed_reclaim")) and not feature.get("classification_complete_timestamp_et"):
        reasons.append("classification_incomplete")
    if feature.get("classification_complete_timestamp_et") and not as_bool(feature.get("outcome_window_available")):
        reasons.append("outcome_window_missing")
    pub_date = str(row.get("pub_date") or "")
    entry_date = str(feature.get("entry_timestamp_et") or "")[:10]
    target_pub = str(feature.get("next_trusted_level_pub_date") or "")
    if target_pub and entry_date and target_pub > entry_date:
        reasons.append("future_target_leakage")
    if pub_date and entry_date and pub_date > entry_date:
        reasons.append("source_after_entry_leakage")
    if as_bool(row.get("immediate_failure_after_reclaim")):
        reasons.append("immediate_failure_after_reclaim")
    return reasons


def family_model(row: dict[str, Any], feature: dict[str, Any]) -> str:
    family = str(row.get("acceptance_family") or row.get("candidate_acceptance_family") or "")
    if family in ACCEPTANCE_FAMILIES:
        return family
    if feature.get("multi_level_flush_count", 0) >= 2 and (feature.get("flush_depth") or 0) >= 4:
        return "ladder_first_reclaim"
    return "simple_reclaim_unclassified"


def passes_any_current_candidate_rule(feature: dict[str, Any]) -> bool:
    score = as_float(feature.get("candidate_score")) or 0.0
    family = feature.get("acceptance_family_model")
    non_acceptance_score = as_float(feature.get("non_acceptance_score")) or 0.0
    target_r = as_float(feature.get("target_R")) or 0.0
    target_room = as_float(feature.get("target_room")) or 0.0
    return (
        score >= 0.55
        or (family == "non_acceptance_protocol" and score >= 0.50 and non_acceptance_score >= 0.50)
        or (family == "classic_acceptance_backtest_from_below" and score >= 0.45)
        or (family == "classic_acceptance_second_attempt_reclaim" and score >= 0.55)
        or (family == "ladder_first_reclaim" and score >= 0.50)
        or (score >= 0.50 and target_r >= 1.25 and target_room >= 4)
    )


def score_driver_and_fire_time(reclaim: dict[str, Any], reclaim_score: float, non_acceptance_score: float) -> tuple[str, datetime | None]:
    if non_acceptance_score >= reclaim_score and non_acceptance_score > 0:
        return "non_acceptance_score", parse_dt(reclaim.get("non_acceptance_score_timestamp_et"))
    return "reclaim_score", parse_dt(reclaim.get("acceptance_score_timestamp_et") or reclaim.get("reclaim_timestamp_et"))


def compute_feature_row(
    row: dict[str, Any],
    sessions: dict[str, list[dict[str, Any]]],
    events_by_plan: dict[str, list[dict[str, Any]]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    level = as_float(row.get("setup_level"))
    swept_low = as_float(row.get("swept_low"))
    reclaim_time = parse_dt(row.get("first_reclaim_close_timestamp_et"))
    trap_time = parse_dt(row.get("trap_candle_timestamp_et"))
    bars = bars_for_row(row, sessions)
    if not bars and row.get("window_csv"):
        bars = load_window_bars(row.get("window_csv"))
    session_bars = sessions.get(str(row.get("session_date") or row.get("plan_date") or "")) or bars
    prior = compute_prior_touch_stats(bars, level, trap_time)
    reclaim = compute_reclaim_metrics(bars, level, reclaim_time, trap_time)
    if reclaim_time is None:
        reclaim_time = parse_dt(reclaim.get("reclaim_timestamp_et"))
    reclaim_price = as_float(reclaim.get("reclaim_price")) or level
    if reclaim_price is None and as_float(row.get("recovered_level")) is not None:
        reclaim_price = as_float(row.get("recovered_level"))
    if swept_low is None and level is not None and as_float(row.get("flush_points")) is not None:
        swept_low = level - float(as_float(row.get("flush_points")))
    flush_depth = (level - swept_low) if level is not None and swept_low is not None else None
    trap_index = first_bar_at_or_after(bars, trap_time) if trap_time else None
    recent_high = None
    minutes_from_recent_high = None
    median_volume_30m = None
    trap_volume = None
    if bars:
        use_index = trap_index if trap_index is not None else len(bars) - 1
        prior_bars = bars[max(0, use_index - 30):use_index + 1]
        if prior_bars:
            high_bar_index, high_bar = max(enumerate(prior_bars), key=lambda item: item[1]["high"])
            recent_high = high_bar["high"]
            trap_bar = bars[use_index]
            trap_volume = trap_bar["volume"]
            median_volume_30m = median([bar["volume"] for bar in prior_bars])
            minutes_from_recent_high = max((trap_bar["timestamp"] - high_bar["timestamp"]).total_seconds() / 60.0, 1.0)
    approach_velocity = None
    if recent_high is not None and swept_low is not None and minutes_from_recent_high is not None:
        approach_velocity = (recent_high - swept_low) / max(minutes_from_recent_high, 1.0)
    multi_level_flush_count = count_levels_between(events_by_plan, str(row.get("plan_date") or ""), swept_low, level)
    target_info: dict[str, Any] = {}
    target_level = None
    target_room = None
    risk_to_sweep = None
    target_r = None
    source_bonus = major_source_bonus(row)
    significant_low_score = (
        0.30 * clamp(prior["prior_touch_count"] / 3, 0, 1)
        + 0.25 * clamp(prior["prior_hold_minutes"] / 120, 0, 1)
        + 0.25 * clamp(prior["prior_bounce_points"] / 20, 0, 1)
        + 0.20 * source_bonus
    )
    volume_ratio_component = 0.0
    if trap_volume is not None and median_volume_30m:
        volume_ratio_component = clamp(trap_volume / median_volume_30m, 0, 2) / 2
    flush_score = (
        0.35 * clamp(flush_depth / 8 if flush_depth is not None else None, 0, 1)
        + 0.25 * clamp(approach_velocity / 2.0 if approach_velocity is not None else None, 0, 1)
        + 0.20 * clamp(multi_level_flush_count / 3, 0, 1)
        + 0.20 * volume_ratio_component
    )
    acceptance_closes_total = int(reclaim.get("acceptance_closes_above_L") or 0)
    acceptance_closes = int(reclaim.get("acceptance_closes_used_for_score") or 0)
    if acceptance_closes == 0 and as_int(row.get("acceptance_closes")) is not None:
        acceptance_closes_total = as_int(row.get("acceptance_closes")) or 0
        acceptance_closes = min(acceptance_closes_total, 3)
    reclaim_range = as_float(reclaim.get("reclaim_range")) or None
    reclaim_score = (
        0.25 * indicator(reclaim_price is not None and level is not None and reclaim_price > level)
        + 0.20 * indicator((as_float(reclaim.get("reclaim_close_location")) or 0) >= 0.5)
        + 0.20 * clamp(acceptance_closes / 3, 0, 1)
        + 0.20 * indicator(as_bool(reclaim.get("no_close_back_below_L_before_entry")))
        + 0.15 * indicator(reclaim_range is not None and reclaim_range <= 6)
    )
    non_acceptance_closes_total = int(reclaim.get("non_acceptance_closes") or 0)
    non_acceptance_closes = int(reclaim.get("non_acceptance_closes_used_for_score") or 0)
    if non_acceptance_closes == 0 and as_int(row.get("non_acceptance_held_bars")) is not None:
        non_acceptance_closes_total = as_int(row.get("non_acceptance_held_bars")) or 0
        non_acceptance_closes = min(non_acceptance_closes_total, 3)
    non_acceptance_score = (
        0.40 * indicator(bool(reclaim.get("first_threshold_close_timestamp_et")) or non_acceptance_closes > 0)
        + 0.30 * clamp(non_acceptance_closes / 3, 0, 1)
        + 0.20 * indicator(as_bool(reclaim.get("first_retest_of_L_holds_after_crossing_L_plus_5")))
        + 0.10 * 0.0
    )
    timing_driver, candidate_fire_time = score_driver_and_fire_time(reclaim, reclaim_score, non_acceptance_score)
    candidate_bar = bar_at_time(bars, candidate_fire_time) or bar_at_time(session_bars, candidate_fire_time)
    entry_price = as_float(candidate_bar.get("close")) if candidate_bar else reclaim_price
    if candidate_fire_time is None:
        entry_price = None
    target_info = next_trusted_level(events_by_plan, str(row.get("plan_date") or ""), entry_price)
    if not target_info and as_float(row.get("target_or_response_level")) is not None:
        target_info = {
            "next_trusted_level_above": as_float(row.get("target_or_response_level")),
            "next_trusted_level_source": "source_row_target",
            "next_trusted_level_role": "target_or_response",
            "next_trusted_level_pub_date": row.get("pub_date") or "",
        }
    target_level = as_float(row.get("target_or_response_level")) or as_float(target_info.get("next_trusted_level_above"))
    target_room = target_level - entry_price if target_level is not None and entry_price is not None else None
    risk_to_sweep = entry_price - (swept_low - TICK) if entry_price is not None and swept_low is not None else None
    target_r = target_room / max(risk_to_sweep or TICK, TICK) if target_room is not None else None
    mfe15_calc, mae15_calc, complete15 = compute_mfe_mae(session_bars, candidate_fire_time, entry_price, 15)
    mfe60_calc, mae60_calc, complete60 = compute_mfe_mae(session_bars, candidate_fire_time, entry_price, 60)
    mfe_15m = mfe15_calc
    mae_15m = mae15_calc
    mfe_60m = mfe60_calc
    mae_60m = mae60_calc
    non_acceptance_score_with_outcome_audit = non_acceptance_score + 0.10 * indicator(mae_15m is not None and mae_15m <= 3)
    bucket = time_bucket(candidate_fire_time)
    next_source = str(target_info.get("next_trusted_level_source") or "").lower()
    trusted_source = any(token in next_source for token in ("mancini", "bobby", "gex", "dubz", "saty"))
    no_trusted_level_within_2 = target_room is not None and target_room > 2
    squeeze_score = (
        0.30 * clamp(target_room / 8 if target_room is not None else None, 0, 1)
        + 0.25 * clamp(target_r / 2 if target_r is not None else None, 0, 1)
        + 0.20 * indicator(trusted_source)
        + 0.15 * indicator(no_trusted_level_within_2)
        + 0.10 * time_bonus(bucket)
    )
    source_confidence_score = as_float(row.get("source_confidence_score")) or 0.0
    candidate_score = (
        0.25 * significant_low_score
        + 0.20 * flush_score
        + 0.25 * max(reclaim_score, non_acceptance_score)
        + 0.20 * squeeze_score
        + 0.10 * source_confidence_score
    )
    feature = {
        "training_row_id": row.get("training_row_id"),
        "row_origin": row.get("row_origin"),
        "raw_file": row.get("raw_file") or "",
        "line": row.get("line") or "",
        "plan_date": row.get("plan_date") or "",
        "pub_date": row.get("pub_date") or "",
        "session_date": row.get("session_date") or "",
        "packet_id": row.get("packet_id") or "",
        "setup_level": level,
        "swept_low": swept_low,
        "recovered_level": as_float(row.get("recovered_level")) or level,
        "trap_detected_timestamp_et": iso_timestamp(trap_time),
        "reclaim_detected_timestamp_et": iso_timestamp(reclaim_time),
        "classification_complete_timestamp_et": iso_timestamp(candidate_fire_time),
        "candidate_fired_timestamp_et": "",
        "candidate_timing_driver": timing_driver,
        "outcome_window_available": mfe60_calc is not None and mae60_calc is not None,
        "horizon_15m_complete": complete15,
        "horizon_60m_complete": complete60,
        "reclaim_price": reclaim_price if reclaim_price is not None else "",
        "entry_price": entry_price,
        "entry_timestamp_et": iso_timestamp(candidate_fire_time),
        "source_mode": row.get("source_mode") or "",
        "source_label_status": row.get("source_label_status") or "",
        "accepted_for_timing_test": as_bool(row.get("accepted_for_timing_test")),
        "source_confidence_score": round(source_confidence_score, 4),
        "significant_low_score": round(significant_low_score, 4),
        "prior_touch_count": prior["prior_touch_count"],
        "prior_hold_minutes": round(prior["prior_hold_minutes"], 4),
        "prior_bounce_points": round(prior["prior_bounce_points"], 4),
        "major_source_bonus": source_bonus,
        "flush_depth": round(flush_depth, 4) if flush_depth is not None else "",
        "flush_depth_ticks": round(flush_depth / TICK, 4) if flush_depth is not None else "",
        "approach_velocity": round(approach_velocity, 4) if approach_velocity is not None else "",
        "multi_level_flush_count": multi_level_flush_count,
        "volume_on_trap_bar": round(trap_volume, 4) if trap_volume is not None else "",
        "median_volume_30m": round(median_volume_30m, 4) if median_volume_30m is not None else "",
        "flush_score": round(flush_score, 4),
        "reclaim_score": round(reclaim_score, 4),
        "reclaim_close_location": reclaim.get("reclaim_close_location") if reclaim.get("reclaim_close_location") is not None else "",
        "reclaim_range": round(reclaim_range, 4) if reclaim_range is not None else "",
        "acceptance_closes_above_L": acceptance_closes,
        "acceptance_score_timestamp_et": reclaim.get("acceptance_score_timestamp_et") or "",
        "non_acceptance_score_timestamp_et": reclaim.get("non_acceptance_score_timestamp_et") or "",
        "first_threshold_close_timestamp_et": reclaim.get("first_threshold_close_timestamp_et") or "",
        "non_acceptance_score": round(non_acceptance_score, 4),
        "non_acceptance_closes": non_acceptance_closes,
        "reclaim_minutes_from_trap": as_float(row.get("reclaim_minutes_from_trap")) or "",
        "squeeze_score": round(squeeze_score, 4),
        "candidate_score": round(candidate_score, 4),
        "target_room": round(target_room, 4) if target_room is not None else "",
        "target_invalid_for_level_to_level": target_room is None or target_room < 2.0,
        "risk_to_sweep": round(risk_to_sweep, 4) if risk_to_sweep is not None else "",
        "target_R": round(target_r, 4) if target_r is not None else "",
        "next_trusted_level_above": target_level if target_level is not None else "",
        "next_trusted_level_source": target_info.get("next_trusted_level_source") or "",
        "next_trusted_level_role": target_info.get("next_trusted_level_role") or "",
        "next_trusted_level_pub_date": target_info.get("next_trusted_level_pub_date") or "",
        "time_of_day_bucket": bucket,
        "visual_sanity_status": row.get("visual_sanity_status") or "",
        "source_blocker_count": len(row.get("blockers") or []) if isinstance(row.get("blockers"), list) else (1 if row.get("blockers") else 0),
        "bars_available": as_int(row.get("bars_available")) or 0,
        "window_csv": row.get("window_csv") or "",
    }
    family = family_model(row, feature)
    feature["acceptance_family_model"] = family
    reasons = hard_reject_reasons(row, feature)
    feature["hard_reject"] = bool(reasons)
    feature["hard_reject_reasons"] = ";".join(reasons)
    if not reasons and passes_any_current_candidate_rule(feature):
        feature["candidate_fired_timestamp_et"] = feature["classification_complete_timestamp_et"]
    unique_setup_key = source_hash([
        row.get("plan_date") or row.get("session_date"),
        level,
        row.get("source_quote") or row.get("packet_id"),
    ])
    target_for_next = as_float(feature.get("target_room"))
    risk = as_float(feature.get("risk_to_sweep")) or 2.0
    tp2 = mfe_60m is not None and mfe_60m >= 2
    tp3 = mfe_60m is not None and mfe_60m >= 3
    next_hit = target_for_next is not None and mfe_60m is not None and mfe_60m >= target_for_next
    adverse_excursion_stop_hit = mae_60m is not None and mae_60m >= risk
    first_hit = compute_first_hit_outcome(session_bars, candidate_fire_time, entry_price, risk, 3.0, 60)
    first_hit_tp2 = compute_first_hit_outcome(session_bars, candidate_fire_time, entry_price, risk, 2.0, 60)
    first_hit_tp3 = compute_first_hit_outcome(session_bars, candidate_fire_time, entry_price, risk, 3.0, 60)
    first_hit_next_level = compute_first_hit_outcome(session_bars, candidate_fire_time, entry_price, risk, target_for_next, 60) if target_for_next is not None else {}
    stop_first = as_bool(first_hit.get("stop_first"))
    false_armed = bool((not as_bool(first_hit.get("target_first"))) and (mae_15m is not None and mae_15m >= min(risk, 3.0)))
    expectancy_points_slippage_0_5 = as_float(first_hit.get("expectancy_points_slippage_0_5"))
    label = {
        "training_row_id": row.get("training_row_id"),
        "unique_setup_key": unique_setup_key,
        "plan_date": row.get("plan_date") or "",
        "session_date": row.get("session_date") or "",
        "packet_id": row.get("packet_id") or "",
        "acceptance_family_model": family,
        "source_label_status": row.get("source_label_status") or "",
        "source_mode": row.get("source_mode") or "",
        "accepted_for_timing_test": as_bool(row.get("accepted_for_timing_test")),
        "trap_detected_timestamp_et": iso_timestamp(trap_time),
        "reclaim_detected_timestamp_et": iso_timestamp(reclaim_time),
        "classification_complete_timestamp_et": iso_timestamp(candidate_fire_time),
        "candidate_fired_timestamp_et": feature.get("candidate_fired_timestamp_et") or "",
        "candidate_timing_driver": timing_driver,
        "entry_price": round(entry_price, 4) if entry_price is not None else "",
        "source_confirmed_fbd": as_bool(row.get("source_confirmed_fbd")),
        "source_planned_fbd": as_bool(row.get("source_planned_fbd")),
        "source_negative_control": as_bool(row.get("source_negative_control")),
        "sr_list_only": as_bool(row.get("sr_list_only")),
        "chart_confirmed_reclaim": as_bool(row.get("chart_confirmed_reclaim")),
        "chart_confirmed_non_acceptance": as_bool(row.get("chart_confirmed_non_acceptance")),
        "chart_mismatch": as_bool(row.get("chart_mismatch")),
        "needs_crop": as_bool(row.get("needs_crop")),
        "data_only": as_bool(row.get("data_only")),
        "hard_reject": bool(reasons),
        "hard_reject_reasons": ";".join(reasons),
        "mfe_15m": round(mfe_15m, 4) if mfe_15m is not None else "",
        "mae_15m": round(mae_15m, 4) if mae_15m is not None else "",
        "mfe_60m": round(mfe_60m, 4) if mfe_60m is not None else "",
        "mae_60m": round(mae_60m, 4) if mae_60m is not None else "",
        "horizon_15m_complete": complete15,
        "horizon_60m_complete": complete60,
        "acceptance_closes_total_audit": acceptance_closes_total,
        "non_acceptance_closes_total_audit": non_acceptance_closes_total,
        "tp2_hit": tp2,
        "tp3_hit": tp3,
        "next_level_hit": next_hit,
        "tp2_first": first_hit_tp2.get("first_hit_event") == "target",
        "tp3_first": first_hit_tp3.get("first_hit_event") == "target",
        "next_level_first": first_hit_next_level.get("first_hit_event") == "target" if first_hit_next_level else "",
        "adverse_excursion_stop_hit": adverse_excursion_stop_hit,
        "first_hit_event": first_hit.get("first_hit_event"),
        "first_hit_timestamp_et": first_hit.get("first_hit_timestamp_et"),
        "first_hit_points": round(as_float(first_hit.get("first_hit_points")), 4) if as_float(first_hit.get("first_hit_points")) is not None else "",
        "target_first": as_bool(first_hit.get("target_first")),
        "same_bar_stop_and_target": as_bool(first_hit.get("same_bar_stop_and_target")),
        "stop_first": stop_first,
        "false_armed": false_armed,
        "median_mae_before_tp1_component": mae_15m if tp2 and mae_15m is not None else "",
        "non_acceptance_score_with_outcome_audit": round(non_acceptance_score_with_outcome_audit, 4),
        "expectancy_points_slippage_0_5": round(expectancy_points_slippage_0_5, 4) if expectancy_points_slippage_0_5 is not None else "",
        "candidate_score": round(candidate_score, 4),
        "time_of_day_bucket": bucket,
    }
    return feature, label


def row_matches_rule(feature: dict[str, Any], label: dict[str, Any], rule: str) -> bool:
    if as_bool(feature.get("hard_reject")):
        return False
    family = feature.get("acceptance_family_model")
    score = as_float(feature.get("candidate_score")) or 0.0
    if rule == "candidate_score_055":
        return score >= 0.55
    if rule == "non_acceptance_only":
        return family == "non_acceptance_protocol" and score >= 0.50 and (as_float(feature.get("non_acceptance_score")) or 0) >= 0.50
    if rule == "classic_backtest_only":
        return family == "classic_acceptance_backtest_from_below" and score >= 0.45
    if rule == "second_attempt_review_only":
        return family == "classic_acceptance_second_attempt_reclaim" and score >= 0.55
    if rule == "ladder_first_reclaim":
        return family == "ladder_first_reclaim" and score >= 0.50
    if rule == "level_to_level_target_R":
        return score >= 0.50 and (as_float(feature.get("target_R")) or 0) >= 1.25 and (as_float(feature.get("target_room")) or 0) >= 4
    return False


def summarize_rows(labels: list[dict[str, Any]]) -> dict[str, Any]:
    unique_setups = len(set(str(row.get("unique_setup_key")) for row in labels))
    mae_before = [as_float(row.get("median_mae_before_tp1_component")) for row in labels if as_float(row.get("median_mae_before_tp1_component")) is not None]
    return {
        "rows": len(labels),
        "unique_setups": unique_setups,
        "tp_plus_2_hit_rate": hit_rate(labels, "tp2_hit"),
        "tp_plus_3_hit_rate": hit_rate(labels, "tp3_hit"),
        "next_level_hit_rate": hit_rate(labels, "next_level_hit"),
        "stop_first_rate": hit_rate(labels, "stop_first"),
        "false_armed_rate": hit_rate(labels, "false_armed"),
        "median_mae_before_tp1": round(median(mae_before), 4) if mae_before else None,
        "avg_mfe_15m": average([as_float(row.get("mfe_15m")) for row in labels]),
        "avg_mae_15m": average([as_float(row.get("mae_15m")) for row in labels]),
        "avg_mfe_60m": average([as_float(row.get("mfe_60m")) for row in labels]),
        "avg_mae_60m": average([as_float(row.get("mae_60m")) for row in labels]),
        "expectancy_points_with_0_5_es_point_slippage": average([as_float(row.get("expectancy_points_slippage_0_5")) for row in labels]),
    }


def packet_or_setup_key(row: dict[str, Any]) -> str:
    return str(row.get("packet_id") or row.get("unique_setup_key") or row.get("training_row_id") or "")


def source_priority(row: dict[str, Any]) -> tuple[int, str]:
    confirmed = as_bool(row.get("source_confirmed_fbd"))
    planned = as_bool(row.get("source_planned_fbd"))
    mode = str(row.get("source_mode") or "")
    if confirmed and mode == "actual_recap":
        rank = 0
    elif confirmed:
        rank = 1
    elif planned and mode == "planned_setup":
        rank = 2
    elif planned:
        rank = 3
    else:
        rank = 4
    return rank, str(row.get("training_row_id") or "")


def dedupe_packet_rows(labels: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in labels:
        grouped[packet_or_setup_key(row)].append(row)
    return [
        sorted(rows, key=source_priority)[0]
        for _, rows in sorted(grouped.items())
    ]


def summarize_by(labels: list[dict[str, Any]], field: str) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in labels:
        groups[str(row.get(field) or "missing")].append(row)
    return {key: summarize_rows(rows) for key, rows in sorted(groups.items())}


def build_rule_scores(features: list[dict[str, Any]], labels: list[dict[str, Any]]) -> dict[str, Any]:
    label_by_id = {row["training_row_id"]: row for row in labels}
    rule_names = [
        "candidate_score_055",
        "non_acceptance_only",
        "classic_backtest_only",
        "second_attempt_review_only",
        "ladder_first_reclaim",
        "level_to_level_target_R",
    ]
    rule_scores: dict[str, Any] = {}
    for rule in rule_names:
        selected = [
            label_by_id[feature["training_row_id"]]
            for feature in features
            if feature["training_row_id"] in label_by_id and row_matches_rule(feature, label_by_id[feature["training_row_id"]], rule)
        ]
        rule_scores[rule] = summarize_rows(selected)
        rule_scores[rule]["packet_deduped"] = summarize_rows(dedupe_packet_rows(selected))
        rule_scores[rule]["per_family"] = summarize_by(selected, "acceptance_family_model")
        rule_scores[rule]["per_time_of_day"] = summarize_by(selected, "time_of_day_bucket")
    return rule_scores


def build_walk_forward(features: list[dict[str, Any]], labels: list[dict[str, Any]]) -> dict[str, Any]:
    label_by_id = {row["training_row_id"]: row for row in labels}
    dates = [date_key(feature) for feature in features if date_key(feature)]
    folds = percentile_dates(dates)
    out: dict[str, Any] = {}
    for name, train_dates, test_dates in folds:
        train_ids = {
            feature["training_row_id"] for feature in features
            if date_key(feature) in train_dates and not as_bool(feature.get("hard_reject"))
        }
        test_ids = {
            feature["training_row_id"] for feature in features
            if date_key(feature) in test_dates and not as_bool(feature.get("hard_reject"))
        }
        train_labels = [label_by_id[row_id] for row_id in train_ids if row_id in label_by_id]
        test_labels = [label_by_id[row_id] for row_id in test_ids if row_id in label_by_id]
        out[name] = {
            "train_dates": train_dates,
            "test_dates": test_dates,
            "train": summarize_rows(train_labels),
            "test": summarize_rows(test_labels),
        }
    return out


def build_negative_controls(features: list[dict[str, Any]], labels: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {label["training_row_id"]: label for label in labels}
    controls: dict[str, list[dict[str, Any]]] = {
        "random_support_levels": [],
        "direct_support_bids_without_flush_reclaim": [],
        "late_reclaim_after_first_reclaim_already_moved": [],
        "saty_only_levels_no_mancini_source_setup": [],
        "shuffled_timestamps": [],
    }
    for feature in features:
        label = by_id.get(feature["training_row_id"])
        if not label:
            continue
        if as_bool(label.get("sr_list_only")):
            controls["random_support_levels"].append(label)
        if as_bool(label.get("sr_list_only")) and not as_bool(label.get("chart_confirmed_reclaim")):
            controls["direct_support_bids_without_flush_reclaim"].append(label)
        if feature.get("acceptance_family_model") == "classic_acceptance_second_attempt_reclaim" or (as_float(feature.get("reclaim_minutes_from_trap")) or 0) > 10:
            controls["late_reclaim_after_first_reclaim_already_moved"].append(label)
        if "saty" in str(feature.get("next_trusted_level_source") or "").lower() and (as_float(feature.get("source_confidence_score")) or 0) < 0.4:
            controls["saty_only_levels_no_mancini_source_setup"].append(label)
    accepted = [label for label in labels if not as_bool(label.get("hard_reject")) and as_float(label.get("candidate_score")) is not None]
    if accepted:
        rotated = accepted[1:] + accepted[:1]
        for base, shifted in zip(accepted, rotated):
            fake = dict(base)
            fake["tp2_hit"] = shifted.get("tp2_hit")
            fake["tp3_hit"] = shifted.get("tp3_hit")
            fake["next_level_hit"] = shifted.get("next_level_hit")
            fake["stop_first"] = shifted.get("stop_first")
            fake["false_armed"] = True
            fake["expectancy_points_slippage_0_5"] = shifted.get("expectancy_points_slippage_0_5")
            controls["shuffled_timestamps"].append(fake)
    return {name: summarize_rows(rows) for name, rows in controls.items()}


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields: list[str] = []
    seen = set()
    for row in rows:
        for key in row:
            if key not in seen:
                fields.append(key)
                seen.add(key)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({
                field: json.dumps(row.get(field), ensure_ascii=False, sort_keys=True) if isinstance(row.get(field), (dict, list)) else (
                    "true" if row.get(field) is True else "false" if row.get(field) is False else "" if row.get(field) is None else row.get(field)
                )
                for field in fields
            })


def report_markdown(scores: dict[str, Any]) -> str:
    lines = [
        "# Mancini FBD Algo Math Walk-Forward Report",
        "",
        f"Generated: {scores['generated_at']}",
        "",
        "Scope: deterministic offline research only. Candidate scores avoid MFE/MAE and other future outcome columns.",
        "",
        "## Input Counts",
        "",
        f"- Training rows: {scores['input_counts']['training_rows']}",
        f"- Feature rows: {scores['input_counts']['feature_rows']}",
        f"- Hard-rejected rows: {scores['input_counts']['hard_rejected_rows']}",
        f"- Unique setups: {scores['input_counts']['unique_setups']}",
        "",
        "## Overall Non-Rejected Results",
        "",
    ]
    overall = scores["overall_non_rejected"]
    for key, value in overall.items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Overall Packet-Deduped Results", ""])
    for key, value in scores["overall_non_rejected_packet_deduped"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Per Family", ""])
    for family, result in scores["per_family_results"].items():
        lines.append(
            f"- `{family}`: rows={result['rows']}, unique={result['unique_setups']}, "
            f"tp2={result['tp_plus_2_hit_rate']}, stop_first={result['stop_first_rate']}, "
            f"expectancy={result['expectancy_points_with_0_5_es_point_slippage']}"
        )
    lines.extend(["", "## Candidate Rules", ""])
    for rule, result in scores["candidate_rules"].items():
        deduped = result.get("packet_deduped") or {}
        lines.append(
            f"- `{rule}`: rows={result['rows']}, unique={result['unique_setups']}, "
            f"tp2={result['tp_plus_2_hit_rate']}, tp3={result['tp_plus_3_hit_rate']}, "
            f"next={result['next_level_hit_rate']}, stop_first={result['stop_first_rate']}, "
            f"false_armed={result['false_armed_rate']}, expectancy={result['expectancy_points_with_0_5_es_point_slippage']}; "
            f"packet_deduped_rows={deduped.get('rows')}, packet_deduped_expectancy={deduped.get('expectancy_points_with_0_5_es_point_slippage')}"
        )
    lines.extend(["", "## Negative Controls", ""])
    for control, result in scores["negative_controls"].items():
        lines.append(
            f"- `{control}`: rows={result['rows']}, unique={result['unique_setups']}, "
            f"tp2={result['tp_plus_2_hit_rate']}, stop_first={result['stop_first_rate']}, "
            f"false_armed={result['false_armed_rate']}, expectancy={result['expectancy_points_with_0_5_es_point_slippage']}"
        )
    lines.extend(["", "## Walk Forward", ""])
    for fold, result in scores["walk_forward"].items():
        train = result["train"]
        test = result["test"]
        lines.append(
            f"- `{fold}`: train_dates={len(result['train_dates'])}, test_dates={len(result['test_dates'])}, "
            f"train_unique={train['unique_setups']}, test_unique={test['unique_setups']}, "
            f"test_tp2={test['tp_plus_2_hit_rate']}, test_stop_first={test['stop_first_rate']}, "
            f"test_expectancy={test['expectancy_points_with_0_5_es_point_slippage']}"
        )
    lines.extend([
        "",
        "## Safety Gates",
        "",
        "- `sr_list_only` rows are hard-rejected before candidate rule scoring.",
        "- Negative controls are reported separately and are not promoted into positive examples.",
        "- Date-based walk-forward splits are used; no random row split is used.",
        "- MFE/MAE, hit rates, and stop-first are labels/outcomes, not candidate-score inputs.",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    if not TRAINING_ROWS.exists():
        raise SystemExit(f"Missing training rows: {TRAINING_ROWS}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    training_rows = read_jsonl(TRAINING_ROWS)
    sessions = load_sessions()
    events_by_plan = load_event_levels()
    features: list[dict[str, Any]] = []
    labels: list[dict[str, Any]] = []
    for row in training_rows:
        feature, label = compute_feature_row(row, sessions, events_by_plan)
        features.append(feature)
        labels.append(label)
    write_csv(FEATURES_CSV, features)
    write_csv(LABELS_CSV, labels)
    non_rejected = [label for label in labels if not as_bool(label.get("hard_reject"))]
    scores = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "research_historical_replay_shadow_only",
        "outputs": {
            "features_csv": rel(FEATURES_CSV),
            "labels_csv": rel(LABELS_CSV),
            "candidate_rule_scores_json": rel(CANDIDATE_RULE_SCORES),
            "walk_forward_report_md": rel(WALK_FORWARD_REPORT),
        },
        "input_counts": {
            "training_rows": len(training_rows),
            "feature_rows": len(features),
            "label_rows": len(labels),
            "hard_rejected_rows": sum(1 for feature in features if as_bool(feature.get("hard_reject"))),
            "unique_setups": len(set(label.get("unique_setup_key") for label in labels)),
        },
        "feature_formula_notes": {
            "candidate_score": "0.25 significant_low + 0.20 flush + 0.25 max(reclaim, non_acceptance_no_lookahead) + 0.20 squeeze + 0.10 source_confidence",
            "non_acceptance_score": "No-lookahead version leaves post_reclaim_MAE_15 outcome gate at zero; full audit variant is non_acceptance_score_with_outcome_audit.",
            "mfe_mae": "MFE/MAE are labels/outcomes computed from session bars when possible and never used in candidate_score.",
        },
        "family_counts": dict(Counter(str(feature.get("acceptance_family_model") or "missing") for feature in features)),
        "overall_non_rejected": summarize_rows(non_rejected),
        "overall_non_rejected_packet_deduped": summarize_rows(dedupe_packet_rows(non_rejected)),
        "per_family_results": summarize_by(non_rejected, "acceptance_family_model"),
        "per_time_of_day_results": summarize_by(non_rejected, "time_of_day_bucket"),
        "candidate_rules": build_rule_scores(features, labels),
        "negative_controls": build_negative_controls(features, labels),
        "walk_forward": build_walk_forward(features, labels),
        "hard_reject_reason_counts": dict(Counter(reason for feature in features for reason in str(feature.get("hard_reject_reasons") or "").split(";") if reason)),
        "safety": {
            "live_trading_behavior_introduced": False,
            "broker_risk_live_pine_credential_execution_touched": False,
            "random_splits_used": False,
            "sr_list_only_promoted_to_positive": False,
        },
    }
    CANDIDATE_RULE_SCORES.write_text(json.dumps(scores, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    WALK_FORWARD_REPORT.write_text(report_markdown(scores), encoding="utf-8", newline="\n")
    print(json.dumps({
        "feature_rows": len(features),
        "label_rows": len(labels),
        "hard_rejected_rows": scores["input_counts"]["hard_rejected_rows"],
        "unique_setups": scores["input_counts"]["unique_setups"],
        "outputs": scores["outputs"],
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
