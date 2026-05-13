#!/usr/bin/env python3
"""Grid-test Mancini FBD exact-scenario candidates.

Offline research only. This reads already-built source/math artifacts and frozen
ES bars, then writes replay-style CSV/JSON summaries. It does not create orders,
broker routes, risk checks, position sizing, Ninja/Pine code, or live execution.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import research_mancini_fbd_algo_math as math


ROOT = Path(__file__).resolve().parents[1]
MATH_DIR = ROOT / "artifacts/research/mancini-fbd-algo-math"
FEATURES_CSV = MATH_DIR / "features.csv"
LABELS_CSV = MATH_DIR / "labels.csv"
OUT_CSV = MATH_DIR / "exact_strategy_grid.csv"
OUT_JSON = MATH_DIR / "exact_strategy_grid.json"

RULES = [
    "non_acceptance_only",
    "candidate_score_055",
    "level_to_level_target_R",
    "ladder_first_reclaim",
]
SCOPES = [
    "deployable_planned_only",
    "confirmed_reconstruction",
    "all_source_nonrejected",
]
TIMEFRAMES_MINUTES = [1, 2, 5]
TARGET_POINTS = [2.0, 3.0, 5.0, 8.0]
STOP_POLICIES = ["risk_to_sweep", "fixed_2", "fixed_3", "fixed_5", "fixed_8", "fixed_10", "fixed_12", "fixed_15", "fixed_20"]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def as_float(value: Any) -> float | None:
    return math.as_float(value)


def as_bool(value: Any) -> bool:
    return math.as_bool(value)


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


def collapse_bucket(bucket: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "timestamp": bucket[0]["timestamp"],
        "open": bucket[0]["open"],
        "high": max(row["high"] for row in bucket),
        "low": min(row["low"] for row in bucket),
        "close": bucket[-1]["close"],
        "volume": sum(float(row.get("volume") or 0.0) for row in bucket),
    }


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


def dedupe_pairs(pairs: list[tuple[dict[str, str], dict[str, str]]]) -> list[tuple[dict[str, str], dict[str, str]]]:
    grouped: dict[str, list[tuple[dict[str, str], dict[str, str]]]] = defaultdict(list)
    for feature, label in pairs:
        grouped[packet_key(label)].append((feature, label))
    return [
        sorted(rows, key=lambda pair: source_priority(pair[1]))[0]
        for _, rows in sorted(grouped.items())
    ]


def in_scope(label: dict[str, str], scope: str) -> bool:
    if label.get("hard_reject") == "true":
        return False
    if scope == "deployable_planned_only":
        return as_bool(label.get("source_planned_fbd")) and label.get("source_mode") == "planned_setup"
    if scope == "confirmed_reconstruction":
        return as_bool(label.get("source_confirmed_fbd"))
    if scope == "all_source_nonrejected":
        return as_bool(label.get("source_confirmed_fbd")) or as_bool(label.get("source_planned_fbd"))
    return False


def stop_points(feature: dict[str, str], policy: str) -> float:
    if policy == "risk_to_sweep":
        return max(as_float(feature.get("risk_to_sweep")) or 2.0, 0.25)
    if policy == "fixed_2":
        return 2.0
    if policy == "fixed_3":
        return 3.0
    if policy == "fixed_5":
        return 5.0
    if policy == "fixed_8":
        return 8.0
    if policy == "fixed_10":
        return 10.0
    if policy == "fixed_12":
        return 12.0
    if policy == "fixed_15":
        return 15.0
    if policy == "fixed_20":
        return 20.0
    raise ValueError(policy)


def average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 4) if values else None


def summarize_outcomes(outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    if not outcomes:
        return {
            "rows": 0,
            "expectancy_points_slippage_0_5": None,
            "target_first_rate": None,
            "stop_first_rate": None,
            "timeout_rate": None,
            "same_bar_rate": None,
        }
    points = [
        as_float(item.get("expectancy_points_slippage_0_5"))
        for item in outcomes
        if as_float(item.get("expectancy_points_slippage_0_5")) is not None
    ]
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    current_losses = 0
    max_consecutive_losses = 0
    for point in points:
        equity += point
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)
        if point < 0:
            current_losses += 1
            max_consecutive_losses = max(max_consecutive_losses, current_losses)
        else:
            current_losses = 0
    return {
        "rows": len(outcomes),
        "expectancy_points_slippage_0_5": average(points),
        "total_points_slippage_0_5": round(sum(points), 4) if points else None,
        "max_drawdown_points": round(max_drawdown, 4),
        "max_consecutive_losses": max_consecutive_losses,
        "target_first_rate": round(sum(as_bool(item.get("target_first")) for item in outcomes) / len(outcomes), 4),
        "stop_first_rate": round(sum(as_bool(item.get("stop_first")) for item in outcomes) / len(outcomes), 4),
        "timeout_rate": round(sum(item.get("first_hit_event") == "timeout" for item in outcomes) / len(outcomes), 4),
        "same_bar_rate": round(sum(as_bool(item.get("same_bar_stop_and_target")) for item in outcomes) / len(outcomes), 4),
    }


def main() -> int:
    features = read_csv(FEATURES_CSV)
    labels = read_csv(LABELS_CSV)
    labels_by_id = {row["training_row_id"]: row for row in labels}
    sessions = math.load_sessions()
    rows: list[dict[str, Any]] = []
    detail_counts: dict[str, Any] = {}

    for rule in RULES:
        rule_pairs = [
            (feature, labels_by_id[feature["training_row_id"]])
            for feature in features
            if feature["training_row_id"] in labels_by_id
            and math.row_matches_rule(feature, labels_by_id[feature["training_row_id"]], rule)
        ]
        for scope in SCOPES:
            scoped_pairs = [(f, l) for f, l in rule_pairs if in_scope(l, scope)]
            deduped_pairs = dedupe_pairs(scoped_pairs)
            detail_counts[f"{rule}:{scope}"] = {
                "raw_rows": len(scoped_pairs),
                "packet_deduped_rows": len(deduped_pairs),
            }
            for timeframe in TIMEFRAMES_MINUTES:
                for target in TARGET_POINTS:
                    for stop_policy in STOP_POLICIES:
                        outcomes = []
                        for feature, _label in deduped_pairs:
                            session_date = feature.get("session_date") or feature.get("plan_date") or ""
                            bars = sessions.get(session_date) or []
                            bars = aggregate_bars(bars, timeframe)
                            entry_time = math.parse_dt(feature.get("entry_timestamp_et") or feature.get("candidate_fired_timestamp_et"))
                            entry_price = as_float(feature.get("entry_price"))
                            outcome = math.compute_first_hit_outcome(
                                bars,
                                entry_time,
                                entry_price,
                                stop_points(feature, stop_policy),
                                target,
                                60,
                            )
                            outcome["sort_timestamp_et"] = entry_time.isoformat() if entry_time else ""
                            outcomes.append(outcome)
                        outcomes.sort(key=lambda item: item.get("sort_timestamp_et") or "")
                        summary = summarize_outcomes(outcomes)
                        rows.append({
                            "rule": rule,
                            "scope": scope,
                            "timeframe_minutes": timeframe,
                            "target_points": target,
                            "stop_policy": stop_policy,
                            **summary,
                        })

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = list(rows[0].keys()) if rows else []
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    OUT_JSON.write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "scope": "research_historical_replay_shadow_only",
            "inputs": {
                "features_csv": str(FEATURES_CSV.relative_to(ROOT)),
                "labels_csv": str(LABELS_CSV.relative_to(ROOT)),
            },
            "detail_counts": detail_counts,
            "rows": rows,
        }, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(json.dumps({
        "rows": len(rows),
        "out_csv": str(OUT_CSV.relative_to(ROOT)),
        "out_json": str(OUT_JSON.relative_to(ROOT)),
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
