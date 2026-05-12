#!/usr/bin/env python3
"""Aggregate Quick_Reclaim_Acceptance research rows from Hermes Mancini packets.

Review-only output. This script does not create strategy code and does not imply
live trading authority.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime
from collections import defaultdict
from pathlib import Path
from typing import Any


BUCKETS = ("0_to_1", "1_to_2", "2_to_3_5", "3_5_to_10", "10_plus", "missing")
TICK = 0.25
BACKTEST_TOLERANCE_POINTS = 0.5
CLASSIC_SELLOFF_MIN_POINTS = 2.0
NON_ACCEPTANCE_DANGER_ZONE_POINTS = 5.0
NON_ACCEPTANCE_HOLD_BARS = 2
TRIGGER_RECLAIM_HOLD_BARS = 2
TRIGGER_PRIOR_TEST_TOLERANCE_POINTS = 1.0
TRIGGER_MIN_PRIOR_LEVEL_TESTS = 2
TRIGGER_IMMEDIATE_FAILURE_LOOKAHEAD_BARS = 3

EXPLICIT_SOURCE_MARKERS = (
    "failed breakdown",
    "trap",
    "non-acceptance protocol",
    "liquidity grab",
)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        if isinstance(row, dict):
            row["_line"] = line_number
            rows.append(row)
    return rows


def nested(row: dict[str, Any], *keys: str) -> Any:
    value: Any = row
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def load_window_bars(path_value: Any) -> list[dict[str, Any]]:
    if not path_value:
        return []
    path = Path(str(path_value))
    if not path.exists():
        return []
    bars: list[dict[str, Any]] = []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            ts = parse_dt(row.get("timestamp_et"))
            parsed = {
                "timestamp_et": row.get("timestamp_et"),
                "dt": ts,
                "open": number(row.get("open")),
                "high": number(row.get("high")),
                "low": number(row.get("low")),
                "close": number(row.get("close")),
                "volume": number(row.get("volume")),
            }
            if ts and all(parsed[key] is not None for key in ("open", "high", "low", "close")):
                bars.append(parsed)
    return bars


def first_index_at_or_after(bars: list[dict[str, Any]], timestamp: Any) -> int | None:
    dt = parse_dt(timestamp)
    if dt is None:
        return None
    for index, bar in enumerate(bars):
        if bar["dt"] >= dt:
            return index
    return None


def exact_index(bars: list[dict[str, Any]], timestamp: Any) -> int | None:
    dt = parse_dt(timestamp)
    if dt is None:
        return None
    for index, bar in enumerate(bars):
        if bar["dt"] == dt:
            return index
    return None


def consecutive_closes_at_or_above(bars: list[dict[str, Any]], start_index: int, threshold: float) -> int:
    count = 0
    for bar in bars[start_index:]:
        if (bar.get("close") or 0) >= threshold:
            count += 1
        else:
            break
    return count


def consecutive_closes_strictly_above(bars: list[dict[str, Any]], start_index: int, threshold: float) -> int:
    count = 0
    for bar in bars[start_index:]:
        if (bar.get("close") or 0) > threshold:
            count += 1
        else:
            break
    return count


def prior_level_tests(bars: list[dict[str, Any]], trap_index: int, level: float) -> int:
    tests = 0
    for bar in bars[:trap_index]:
        if abs((bar.get("low") or 0) - level) <= TRIGGER_PRIOR_TEST_TOLERANCE_POINTS:
            tests += 1
        elif abs((bar.get("close") or 0) - level) <= TRIGGER_PRIOR_TEST_TOLERANCE_POINTS:
            tests += 1
        elif (bar.get("low") or 0) <= level <= (bar.get("high") or 0):
            tests += 1
    return tests


def source_setup_evidence_status(source_label: Any) -> str:
    text = str(source_label or "").strip().lower()
    if not text:
        return "missing_source_text"
    if text.startswith("supports are") or text.startswith("resistances are"):
        return "level_list_only_not_setup_description"
    if any(marker in text for marker in EXPLICIT_SOURCE_MARKERS):
        return "explicit_setup_language_present"
    if "lost" in text and any(marker in text for marker in ("recover", "recovered", "reclaim", "reclaimed")):
        return "explicit_setup_language_present"
    if "swept" in text and any(marker in text for marker in ("recover", "recovered", "reclaim", "reclaimed")):
        return "explicit_setup_language_present"
    return "context_text_not_explicit_setup"


def same_price(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= 0.25


def source_level_role_status(source_label: Any, level: float | None) -> str:
    """Check whether the extracted level is actually the setup level.

    This prevents target/current-price mentions from becoming failed-breakdown
    trigger labels just because the same sentence also says "Failed Breakdown."
    """
    if level is None:
        return "missing_level"
    text = str(source_label or "").strip().lower()
    if not text:
        return "missing_source_text"

    def prices_for(pattern: str) -> list[float]:
        out = []
        for match in re.finditer(pattern, text):
            try:
                out.append(float(match.group(1)))
            except (TypeError, ValueError):
                continue
        return out

    non_acceptance_match = re.search(
        r"significant\s+low\s*\(?([0-9]+(?:\.[0-9]+)?)\)?.{0,120}?"
        r"by\s+5\s+points\s*\(?([0-9]+(?:\.[0-9]+)?)\)?",
        text,
    )
    if non_acceptance_match:
        significant_low = number(non_acceptance_match.group(1))
        threshold = number(non_acceptance_match.group(2))
        if same_price(threshold, level):
            return "matched_non_acceptance_threshold"
        if same_price(significant_low, level):
            return "matched_significant_low_not_non_acceptance_threshold"
        return "source_describes_different_non_acceptance_level"

    explicit_failed_breakdown_prices = (
        prices_for(r"failed\s+breakdown(?:\s+long)?\s+(?:of|at)\s+([0-9]+(?:\.[0-9]+)?)")
        + prices_for(r"([0-9]+(?:\.[0-9]+)?)\s+failed\s+breakdown")
    )
    if explicit_failed_breakdown_prices:
        if any(same_price(price, level) for price in explicit_failed_breakdown_prices):
            return "matched_explicit_failed_breakdown_level"
        return "source_describes_different_failed_breakdown_level"

    direct_recover_prices = prices_for(r"recover(?:ed|s|ing)?\s+([0-9]+(?:\.[0-9]+)?)")
    direct_reclaim_prices = prices_for(r"reclaim(?:ed|s|ing)?\s+([0-9]+(?:\.[0-9]+)?)")
    if any(same_price(price, level) for price in direct_recover_prices + direct_reclaim_prices):
        return "matched_direct_recover_reclaim_level"
    if direct_recover_prices or direct_reclaim_prices:
        return "source_describes_different_recover_reclaim_level"

    lost_low_prices = prices_for(r"lost\s+(?:the\s+)?([0-9]+(?:\.[0-9]+)?)\s+low")
    swept_prices = prices_for(r"swept\s+(?:it\s+to\s+)?([0-9]+(?:\.[0-9]+)?)")
    if any(same_price(price, level) for price in lost_low_prices + swept_prices):
        return "matched_lost_or_swept_low"
    if lost_low_prices or swept_prices:
        return "source_describes_different_lost_or_swept_low"

    target_context = (
        re.search(rf"(?:target|ripped to|ran to|around)\s+~?{int(level)}", text) is not None
        if float(level).is_integer()
        else False
    )
    if target_context:
        return "source_mentions_level_as_target_or_context"
    return "source_level_role_ambiguous"


def classify_acceptance_family(packet: dict[str, Any], bar: dict[str, Any], crop: dict[str, Any]) -> dict[str, Any]:
    level = number(bar.get("level")) or number(nested(packet, "source_text_evidence", "level"))
    window = load_window_bars(crop.get("window_csv"))
    trap_index = first_index_at_or_after(window, bar.get("trap_candle_timestamp_et"))
    reclaim_index = first_index_at_or_after(window, bar.get("first_reclaim_close_timestamp_et"))
    if level is None or not window or trap_index is None or reclaim_index is None:
        return {
            "acceptance_family": "unmeasurable",
            "classic_acceptance_backtest_from_below": False,
            "classic_acceptance_second_attempt_reclaim": False,
            "non_acceptance_protocol_match": False,
            "non_acceptance_held_bars": 0,
            "acceptance_classifier_notes": "missing_level_window_trap_or_reclaim",
        }

    danger_threshold = level + NON_ACCEPTANCE_DANGER_ZONE_POINTS
    non_acceptance_held_bars = 0
    for index in range(reclaim_index, min(len(window), reclaim_index + 5)):
        if (window[index].get("close") or 0) >= danger_threshold:
            non_acceptance_held_bars = max(non_acceptance_held_bars, consecutive_closes_at_or_above(window, index, danger_threshold))
    non_acceptance = non_acceptance_held_bars >= NON_ACCEPTANCE_HOLD_BARS

    between_trap_and_reclaim = window[trap_index : reclaim_index + 1]
    first_backtest_from_below_index = None
    for offset, item in enumerate(between_trap_and_reclaim):
        if (item.get("high") or 0) >= level - BACKTEST_TOLERANCE_POINTS and (item.get("close") or 0) < level:
            first_backtest_from_below_index = trap_index + offset
            break
    backtest_from_below = False
    if first_backtest_from_below_index is not None:
        selloff_low = min(item["low"] for item in window[first_backtest_from_below_index : reclaim_index + 1])
        backtest_from_below = selloff_low <= level - CLASSIC_SELLOFF_MIN_POINTS

    second_attempt = False
    post_first_reclaim = window[reclaim_index : min(len(window), reclaim_index + 12)]
    for offset, item in enumerate(post_first_reclaim[1:], start=1):
        if (item.get("close") or 0) < level:
            later = post_first_reclaim[offset + 1 :]
            second_attempt = any((later_item.get("close") or 0) >= level for later_item in later)
            break

    if non_acceptance:
        family = "non_acceptance_protocol"
    elif second_attempt:
        family = "classic_acceptance_second_attempt_reclaim"
    elif backtest_from_below:
        family = "classic_acceptance_backtest_from_below"
    else:
        family = "simple_reclaim_unclassified"

    return {
        "acceptance_family": family,
        "candidate_acceptance_family": family,
        "acceptance_family_is_strategy_trigger": False,
        "family_label_status": "heuristic_bucket_not_mancini_trigger",
        "classic_acceptance_backtest_from_below": backtest_from_below,
        "classic_acceptance_second_attempt_reclaim": second_attempt,
        "non_acceptance_protocol_match": non_acceptance,
        "non_acceptance_held_bars": non_acceptance_held_bars,
        "acceptance_classifier_notes": "deterministic_ohlc_heuristic_research_only",
    }


def validate_mancini_trigger(packet: dict[str, Any], bar: dict[str, Any], crop: dict[str, Any]) -> dict[str, Any]:
    """Strict replay label gate for Mancini failed-breakdown examples.

    This is deliberately stricter than the family bucket. It answers: "is this
    row safe to teach/model as a failed-breakdown reclaim sequence?" It does not
    answer profitability and does not authorize execution.
    """
    src = packet.get("source_text_evidence") or {}
    source_label = src.get("normalized_text") or src.get("quote") or ""
    source_status = source_setup_evidence_status(source_label)
    level = number(bar.get("level")) or number(src.get("level"))
    level_role_status = source_level_role_status(source_label, level)
    window = load_window_bars(crop.get("window_csv"))
    reasons: list[str] = []
    warnings: list[str] = []

    if source_status != "explicit_setup_language_present":
        reasons.append(source_status)
    if level_role_status not in {
        "matched_non_acceptance_threshold",
        "matched_explicit_failed_breakdown_level",
        "matched_direct_recover_reclaim_level",
        "matched_lost_or_swept_low",
    }:
        reasons.append(level_role_status)
    if level is None:
        reasons.append("missing_level")
    if not window:
        reasons.append("missing_window_bars")

    trap_index = exact_index(window, bar.get("trap_candle_timestamp_et")) if window else None
    reclaim_index = exact_index(window, bar.get("first_reclaim_close_timestamp_et")) if window else None
    if trap_index is None:
        reasons.append("trap_timestamp_not_exactly_visible")
    if reclaim_index is None:
        reasons.append("reclaim_timestamp_not_exactly_visible")
    if level is None or not window or trap_index is None or reclaim_index is None:
        return {
            "trigger_validation_status": "not_validated_for_trigger",
            "trigger_validation_reasons": reasons,
            "trigger_validation_warnings": warnings,
            "source_setup_evidence_status": source_status,
            "source_level_role_status": level_role_status,
            "prior_level_tests_before_trap": None,
            "reclaim_hold_closes": None,
            "trap_low_below_level_points": None,
            "immediate_failure_after_reclaim": None,
            "ninja_shadow_candidate": False,
            "positive_training_example": False,
        }

    if reclaim_index <= trap_index:
        reasons.append("reclaim_not_after_trap")
    trap_low = window[trap_index]["low"]
    trap_depth = level - trap_low
    if trap_depth < TICK:
        reasons.append("trap_did_not_break_level_by_one_tick")

    tests = prior_level_tests(window, trap_index, level)
    if tests < TRIGGER_MIN_PRIOR_LEVEL_TESTS:
        reasons.append("prior_shelf_or_cluster_not_visible_enough")

    reclaim_close = window[reclaim_index]["close"]
    if reclaim_close <= level:
        reasons.append("reclaim_bar_did_not_close_strictly_above_level")
    hold_closes = consecutive_closes_strictly_above(window, reclaim_index, level)
    if hold_closes < TRIGGER_RECLAIM_HOLD_BARS:
        reasons.append("reclaim_did_not_hold_required_closes")

    immediate_failure = any(
        (item.get("close") or 0) < level
        for item in window[reclaim_index + 1 : reclaim_index + 1 + TRIGGER_IMMEDIATE_FAILURE_LOOKAHEAD_BARS]
    )
    if immediate_failure:
        reasons.append("immediate_close_back_below_level_after_reclaim")

    if len(window[:trap_index]) < 5:
        warnings.append("limited_pre_trap_context")
    if len(window[reclaim_index + 1:]) < 5:
        warnings.append("limited_post_reclaim_context")

    if reasons:
        status = "not_validated_for_trigger"
    else:
        status = "validated_replay_trigger_candidate"

    return {
        "trigger_validation_status": status,
        "trigger_validation_reasons": reasons,
        "trigger_validation_warnings": warnings,
        "source_setup_evidence_status": source_status,
        "source_level_role_status": level_role_status,
        "prior_level_tests_before_trap": tests,
        "reclaim_hold_closes": hold_closes,
        "trap_low_below_level_points": round(trap_depth, 4),
        "immediate_failure_after_reclaim": immediate_failure,
        "ninja_shadow_candidate": status == "validated_replay_trigger_candidate",
        "positive_training_example": status == "validated_replay_trigger_candidate",
    }


def bucket_reclaim_minutes(value: Any) -> str:
    minutes = number(value)
    if minutes is None:
        return "missing"
    if minutes <= 0:
        return "missing"
    if minutes <= 1:
        return "0_to_1"
    if minutes <= 2:
        return "1_to_2"
    if minutes <= 3.5:
        return "2_to_3_5"
    if minutes <= 10:
        return "3_5_to_10"
    return "10_plus"


def reject_reasons(packet: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    crop = packet.get("crop_window") or {}
    bar = packet.get("bar_metrics") or {}
    theory = packet.get("independent_theory_features") or {}
    source_map = packet.get("source_map") or {}

    if source_map and not source_map.get("daily_plan_eligible"):
        reasons.append("source_not_daily_plan_eligible")
    if not crop.get("window_csv") or number(crop.get("bar_count")) is None:
        reasons.append("missing_crop_window")
    if number(bar.get("level")) is None and number(nested(packet, "source_text_evidence", "level")) is None:
        reasons.append("missing_level")
    if not bar.get("first_reclaim_close_timestamp_et"):
        reasons.append("missing_first_reclaim_close_timestamp_et")
    if theory.get("reclaim_minutes_from_trap_candle") is not None and not bar.get("trap_candle_timestamp_et"):
        reasons.append("missing_trap_candle_timestamp_et_for_reclaim_timing")
    if number(bar.get("flush_points")) is None:
        reasons.append("missing_flush_points")
    return reasons


def make_row(packet: dict[str, Any]) -> dict[str, Any]:
    reclaim_minutes = nested(packet, "independent_theory_features", "reclaim_minutes_from_trap_candle")
    reclaim_time_bucket = bucket_reclaim_minutes(reclaim_minutes)
    bar = packet.get("bar_metrics") or {}
    src = packet.get("source_text_evidence") or {}
    source_map = packet.get("source_map") or {}
    crop = packet.get("crop_window") or {}
    outcomes = packet.get("source_outcome_metrics") or {}
    reasons = reject_reasons(packet)
    if reclaim_time_bucket == "missing":
        reasons.append("missing_or_nonpositive_reclaim_minutes")
    acceptance_family = classify_acceptance_family(packet, bar, crop)
    trigger_validation = validate_mancini_trigger(packet, bar, crop)
    return {
        "schema_version": 1,
        "review_only": True,
        "trading_authority": "none",
        "packet_id": packet.get("packet_id"),
        "source_id": source_map.get("source_id"),
        "source_kind": source_map.get("source_kind"),
        "ocr_verified": source_map.get("ocr_verified"),
        "daily_plan_eligible": source_map.get("daily_plan_eligible"),
        "source_label": src.get("normalized_text") or src.get("quote"),
        "source_timestamp_et": src.get("timestamp_et"),
        "level": number(bar.get("level")) if number(bar.get("level")) is not None else number(src.get("level")),
        "window_csv": crop.get("window_csv"),
        "crop_bar_count": int(number(crop.get("bar_count")) or 0),
        "crop_missing_bar_count": int(number(crop.get("missing_bar_count")) or 0),
        "flush_points": number(bar.get("flush_points")),
        "flush_ticks": number(bar.get("flush_ticks")),
        "trap_candle_timestamp_et": bar.get("trap_candle_timestamp_et"),
        "trap_candle_open": number(bar.get("trap_candle_open")),
        "trap_candle_high": number(bar.get("trap_candle_high")),
        "trap_candle_low": number(bar.get("trap_candle_low")),
        "trap_candle_close": number(bar.get("trap_candle_close")),
        "trap_candle_volume": number(bar.get("trap_candle_volume")),
        "trap_candle_wick_to_body": number(bar.get("trap_candle_wick_to_body")),
        "first_reclaim_close_timestamp_et": bar.get("first_reclaim_close_timestamp_et"),
        "acceptance_closes": int(number(bar.get("acceptance_consecutive_1m_closes_above_level")) or 0),
        "reclaim_minutes_from_trap": number(reclaim_minutes),
        "reclaim_time_bucket": reclaim_time_bucket,
        "reclaim_2_to_3_5_match": bool(nested(packet, "independent_theory_features", "reclaim_2_to_3_5_minute_hypothesis_match")),
        **acceptance_family,
        **trigger_validation,
        "invalidation_sweep_low_minus_1tick": number(bar.get("invalidation_sweep_low_minus_1tick")),
        "invalidation_level_minus_2points": number(bar.get("invalidation_level_minus_2points")),
        "mfe_15m": number(outcomes.get("mfe_15m")),
        "mae_15m": number(outcomes.get("mae_15m")),
        "mfe_60m": number(outcomes.get("mfe_60m")),
        "mae_60m": number(outcomes.get("mae_60m")),
        "accepted_for_timing_test": not reasons and reclaim_time_bucket != "missing",
        "accepted_for_trigger_modeling": not reasons and trigger_validation["ninja_shadow_candidate"],
        "reject_reasons": reasons,
    }


def avg(values: list[float | None]) -> float | None:
    clean = [v for v in values if isinstance(v, (int, float))]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 4)


def summarize_family(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "packet_count": len(rows),
        "accepted_for_timing_test_count": len([row for row in rows if row["accepted_for_timing_test"]]),
        "avg_acceptance_closes": avg([row["acceptance_closes"] for row in rows]),
        "avg_flush_points": avg([row["flush_points"] for row in rows]),
        "avg_trap_candle_volume": avg([row["trap_candle_volume"] for row in rows]),
        "avg_trap_candle_wick_to_body": avg([row["trap_candle_wick_to_body"] for row in rows]),
        "avg_mfe_15m": avg([row["mfe_15m"] for row in rows]),
        "avg_mae_15m": avg([row["mae_15m"] for row in rows]),
        "avg_mfe_60m": avg([row["mfe_60m"] for row in rows]),
        "avg_mae_60m": avg([row["mae_60m"] for row in rows]),
    }


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    accepted = [row for row in rows if row["accepted_for_timing_test"]]
    for row in rows:
        groups[row["reclaim_time_bucket"]].append(row)

    bucket_summary = {}
    for bucket in BUCKETS:
        bucket_rows = groups.get(bucket, [])
        accepted_bucket_rows = [row for row in bucket_rows if row["accepted_for_timing_test"]]
        bucket_summary[bucket] = {
            "packet_count": len(bucket_rows),
            "accepted_for_timing_test_count": len(accepted_bucket_rows),
            "avg_acceptance_closes": avg([row["acceptance_closes"] for row in accepted_bucket_rows]),
            "avg_flush_points": avg([row["flush_points"] for row in accepted_bucket_rows]),
            "avg_trap_candle_volume": avg([row["trap_candle_volume"] for row in accepted_bucket_rows]),
            "avg_trap_candle_wick_to_body": avg([row["trap_candle_wick_to_body"] for row in accepted_bucket_rows]),
            "avg_mfe_15m": avg([row["mfe_15m"] for row in accepted_bucket_rows]),
            "avg_mae_15m": avg([row["mae_15m"] for row in accepted_bucket_rows]),
            "avg_mfe_60m": avg([row["mfe_60m"] for row in accepted_bucket_rows]),
            "avg_mae_60m": avg([row["mae_60m"] for row in accepted_bucket_rows]),
        }

    accepted_timing_family_summary = {}
    all_packet_family_summary = {}
    for family in sorted({str(row.get("acceptance_family") or "missing") for row in rows}):
        family_rows = [row for row in rows if row.get("acceptance_family") == family and row["accepted_for_timing_test"]]
        all_family_rows = [row for row in rows if row.get("acceptance_family") == family]
        accepted_timing_family_summary[family] = summarize_family(family_rows)
        all_packet_family_summary[family] = summarize_family(all_family_rows)

    reject_reason_counts: dict[str, int] = defaultdict(int)
    for row in rows:
        for reason in row.get("reject_reasons") or []:
            reject_reason_counts[reason] += 1

    return {
        "schema_version": 1,
        "review_only": True,
        "trading_authority": "none",
        "status": "research_viable_machine_tuning_not_final",
        "packet_count": len(rows),
        "accepted_for_timing_test_count": len(accepted),
        "not_accepted_for_timing_test_count": len(rows) - len(accepted),
        "reject_reason_counts": dict(sorted(reject_reason_counts.items())),
        "bucket_definitions": {
            "0_to_1": ">0 and <=1 minute",
            "1_to_2": ">1 and <=2 minutes",
            "2_to_3_5": ">2 and <=3.5 minutes",
            "3_5_to_10": ">3.5 and <=10 minutes",
            "10_plus": ">10 minutes",
            "missing": "reclaim_minutes_from_trap_candle is null or non-positive",
        },
        "bucket_summary": bucket_summary,
        "acceptance_family_classifier": {
            "research_only": True,
            "backtest_tolerance_points": BACKTEST_TOLERANCE_POINTS,
            "classic_selloff_min_points": CLASSIC_SELLOFF_MIN_POINTS,
            "non_acceptance_danger_zone_points": NON_ACCEPTANCE_DANGER_ZONE_POINTS,
            "non_acceptance_hold_bars": NON_ACCEPTANCE_HOLD_BARS,
            "note": "Classifier is deterministic OHLC research plumbing, not a live strategy rule.",
        },
        "accepted_timing_family_summary": accepted_timing_family_summary,
        "all_packet_family_summary": all_packet_family_summary,
        "acceptance_family_summary": accepted_timing_family_summary,
        "trigger_validation_summary": {
            "validated_replay_trigger_candidate": len([
                row for row in rows
                if row.get("trigger_validation_status") == "validated_replay_trigger_candidate"
            ]),
            "not_validated_for_trigger": len([
                row for row in rows
                if row.get("trigger_validation_status") == "not_validated_for_trigger"
            ]),
            "note": "Only validated_replay_trigger_candidate rows may be considered positive training/shadow-model examples. Timing acceptance and heuristic family labels are not sufficient.",
        },
        "unsupported_claims": [
            "No universal stop formula is proven.",
            "No universal volume threshold is proven.",
            "No universal acceptance close count is proven.",
            "No live trading authority is granted.",
        ],
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, sort_keys=True) for row in rows) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def run(args: argparse.Namespace) -> int:
    packets = load_jsonl(Path(args.input))
    rows = [make_row(packet) for packet in packets]
    summary = summarize(rows)

    out_jsonl = Path(args.out_jsonl)
    out_json = Path(args.out_json)
    out_csv = Path(args.out_csv)

    write_jsonl(out_jsonl, rows)
    write_csv(out_csv, rows)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

    print(json.dumps({
        "input": args.input,
        "out_jsonl": str(out_jsonl),
        "out_json": str(out_json),
        "out_csv": str(out_csv),
        "packet_count": summary["packet_count"],
        "accepted_for_timing_test_count": summary["accepted_for_timing_test_count"],
        "status": summary["status"],
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl")
    parser.add_argument("--out-jsonl", default="artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.jsonl")
    parser.add_argument("--out-json", default="artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_summary.json")
    parser.add_argument("--out-csv", default="artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
