#!/usr/bin/env python3
"""Recheck Mancini FBD candidates under prop-account-sized Pine-style risk.

Research/replay only. This reads the existing all-data FBD signals and local ES
1m bars, then tests smaller Pine-like brackets instead of the earlier fixed-12
hard-mode stress stop.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import research_mancini_fbd_algo_math as fbd_math
import research_mancini_fbd_all_data_backtest as all_data


ROOT = Path(__file__).resolve().parents[1]
SIGNALS_CSV = ROOT / "artifacts/research/mancini-fbd-all-data-backtest/all_data_signals.csv"
OUT_DIR = ROOT / "artifacts/research/mancini-fbd-prop-risk-recheck"
OUTCOMES_CSV = OUT_DIR / "prop_risk_outcomes.csv"
SUMMARY_CSV = OUT_DIR / "prop_risk_summary.csv"
SUMMARY_JSON = OUT_DIR / "prop_risk_summary.json"
REPORT_MD = OUT_DIR / "MANCINI_FBD_PROP_RISK_RECHECK_2026-05-14.md"

TICK = 0.25
POINT_VALUE = 50.0
COMMISSION_PER_CONTRACT = 5.0
ENTRY_SLIPPAGE_POINTS = 0.25

PROFILES = [
    {
        "name": "pine_signal_bar_limit_split_tp1_runner",
        "entry_start": "signal_bar",
        "entry_mode": "level_plus_tick",
        "stop_below_level": 3.0,
        "tp1_points": 2.0,
        "tp2_mode": "next_level_or_4",
        "contracts": 2,
    },
    {
        "name": "pine_next_bar_limit_split_tp1_runner",
        "entry_start": "next_bar",
        "entry_mode": "level_plus_tick",
        "stop_below_level": 3.0,
        "tp1_points": 2.0,
        "tp2_mode": "next_level_or_4",
        "contracts": 2,
    },
    {
        "name": "prop_fast_scalp_1es_target2_stop3",
        "entry_start": "signal_bar",
        "entry_mode": "level_plus_tick",
        "stop_below_level": 3.0,
        "tp1_points": 2.0,
        "tp2_mode": "none",
        "contracts": 1,
    },
    {
        "name": "signal_close_1es_target2_stop3",
        "entry_start": "signal_bar",
        "entry_mode": "signal_close",
        "stop_below_level": 3.0,
        "tp1_points": 2.0,
        "tp2_mode": "none",
        "contracts": 1,
    },
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields: list[str] = []
    for row in rows:
        for key in row:
            if key not in fields:
                fields.append(key)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def as_float(value: Any) -> float | None:
    return fbd_math.as_float(value)


def as_bool(value: Any) -> bool:
    return fbd_math.as_bool(value)


def iso(value: datetime | None) -> str:
    return "" if value is None else value.isoformat()


def first_bar_at_or_after(bars: list[dict[str, Any]], timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None
    for index, bar in enumerate(bars):
        if bar["timestamp"] >= timestamp:
            return index
    return None


def max_drawdown(points: list[float]) -> float:
    equity = 0.0
    peak = 0.0
    drawdown = 0.0
    for point in points:
        equity += point
        peak = max(peak, equity)
        drawdown = max(drawdown, peak - equity)
    return round(drawdown, 4)


def max_losses(points: list[float]) -> int:
    current = 0
    max_seen = 0
    for point in points:
        if point < 0:
            current += 1
            max_seen = max(max_seen, current)
        else:
            current = 0
    return max_seen


def find_entry(
    bars: list[dict[str, Any]],
    start_index: int,
    signal: dict[str, str],
    profile: dict[str, Any],
) -> tuple[int | None, float | None]:
    setup = as_float(signal.get("setup_level"))
    signal_entry = as_float(signal.get("entry_price"))
    if setup is None:
        return None, None
    entry_price = signal_entry if profile["entry_mode"] == "signal_close" else setup + TICK
    if entry_price is None:
        return None, None
    start = start_index if profile["entry_start"] == "signal_bar" else start_index + 1
    end = min(len(bars), start + 61)
    for index in range(start, end):
        bar = bars[index]
        if bar["low"] <= entry_price <= bar["high"]:
            return index, entry_price
    return None, entry_price


def target2_price(signal: dict[str, str], entry: float, tp1: float) -> float:
    next_level = as_float(signal.get("next_trusted_level_above"))
    if next_level is not None and next_level > entry + tp1:
        return next_level
    return entry + (tp1 * 2.0)


def simulate(signal: dict[str, str], bars: list[dict[str, Any]], profile: dict[str, Any]) -> dict[str, Any]:
    fire_time = fbd_math.parse_dt(signal.get("candidate_fired_timestamp_et"))
    signal_index = first_bar_at_or_after(bars, fire_time)
    base = {
        "profile": profile["name"],
        "rule": signal.get("rule"),
        "session_date": signal.get("session_date"),
        "setup_level": signal.get("setup_level"),
        "candidate_fired_timestamp_et": signal.get("candidate_fired_timestamp_et"),
        "candidate_score": signal.get("candidate_score"),
        "non_acceptance_score": signal.get("non_acceptance_score"),
        "contracts": profile["contracts"],
        "entry_start": profile["entry_start"],
        "entry_mode": profile["entry_mode"],
        "stop_below_level": profile["stop_below_level"],
        "tp1_points": profile["tp1_points"],
        "tp2_mode": profile["tp2_mode"],
    }
    if signal_index is None:
        return {**base, "outcome": "missing_signal_bar", "net_contract_points": "", "net_dollars": ""}

    entry_index, entry = find_entry(bars, signal_index, signal, profile)
    if entry_index is None or entry is None:
        return {**base, "outcome": "no_limit_fill", "net_contract_points": 0.0, "net_dollars": 0.0}

    setup = as_float(signal.get("setup_level")) or entry
    stop = setup - profile["stop_below_level"]
    risk = entry - stop
    tp1 = entry + profile["tp1_points"]
    tp2 = target2_price(signal, entry, profile["tp1_points"])
    contracts = int(profile["contracts"])
    remaining = contracts
    banked_points = 0.0
    tp1_hit = False
    first_hit_event = "timeout"
    first_hit_time: datetime | None = None
    same_bar = False
    horizon_end = bars[entry_index]["timestamp"] + timedelta(minutes=60)
    horizon = [bar for bar in bars[entry_index:] if bar["timestamp"] <= horizon_end]

    for bar in horizon:
        hit_stop = bar["low"] <= stop
        hit_tp1 = bar["high"] >= tp1
        hit_tp2 = contracts > 1 and profile["tp2_mode"] != "none" and bar["high"] >= tp2

        if not tp1_hit:
            if hit_stop and (hit_tp1 or hit_tp2):
                same_bar = True
                first_hit_event = "same_bar_stop_first_before_tp1"
                first_hit_time = bar["timestamp"]
                banked_points += -risk * remaining
                remaining = 0
                break
            if hit_stop:
                first_hit_event = "stop_before_tp1"
                first_hit_time = bar["timestamp"]
                banked_points += -risk * remaining
                remaining = 0
                break
            if hit_tp2 and contracts > 1 and profile["tp2_mode"] != "none":
                first_hit_event = "tp2_before_tp1_branch"
                first_hit_time = bar["timestamp"]
                banked_points += profile["tp1_points"] + (tp2 - entry)
                remaining = 0
                break
            if hit_tp1:
                tp1_hit = True
                first_hit_event = "tp1"
                first_hit_time = bar["timestamp"]
                banked_points += profile["tp1_points"]
                remaining -= 1
                stop = entry
                if remaining <= 0:
                    break
                continue
        else:
            hit_runner_stop = bar["low"] <= stop
            hit_runner_target = profile["tp2_mode"] != "none" and bar["high"] >= tp2
            if hit_runner_target:
                first_hit_event = "tp1_then_tp2"
                first_hit_time = bar["timestamp"]
                banked_points += (tp2 - entry) * remaining
                remaining = 0
                break
            if hit_runner_stop:
                first_hit_event = "tp1_then_runner_be"
                first_hit_time = bar["timestamp"]
                remaining = 0
                break

    if remaining > 0 and horizon:
        close = horizon[-1]["close"]
        banked_points += (close - entry) * remaining
        first_hit_event = first_hit_event if first_hit_event != "timeout" else "timeout_close"
        first_hit_time = horizon[-1]["timestamp"]

    cost_points = (ENTRY_SLIPPAGE_POINTS + COMMISSION_PER_CONTRACT / POINT_VALUE) * contracts
    net_points = banked_points - cost_points
    return {
        **base,
        "outcome": first_hit_event,
        "entry_timestamp_et": iso(bars[entry_index]["timestamp"]),
        "entry_price": round(entry, 4),
        "stop_price": round(setup - profile["stop_below_level"], 4),
        "tp1_price": round(tp1, 4),
        "tp2_price": round(tp2, 4) if profile["tp2_mode"] != "none" else "",
        "risk_points_per_contract": round(risk, 4),
        "first_hit_timestamp_et": iso(first_hit_time),
        "same_bar_stop_and_target": same_bar,
        "gross_contract_points": round(banked_points, 4),
        "cost_contract_points": round(cost_points, 4),
        "net_contract_points": round(net_points, 4),
        "net_dollars": round(net_points * POINT_VALUE, 2),
    }


def summarize(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[row["profile"]].append(row)
    summaries = []
    for profile, items in sorted(groups.items()):
        filled = [row for row in items if row.get("outcome") not in ("no_limit_fill", "missing_signal_bar")]
        points = [as_float(row.get("net_contract_points")) or 0.0 for row in items]
        dollars = [as_float(row.get("net_dollars")) or 0.0 for row in items]
        losses = [value for value in dollars if value < 0]
        summaries.append({
            "profile": profile,
            "signals": len(items),
            "fills": len(filled),
            "fill_rate": round(len(filled) / len(items), 4) if items else 0.0,
            "net_contract_points": round(sum(points), 4),
            "expectancy_contract_points": round(sum(points) / len(items), 4) if items else 0.0,
            "net_dollars": round(sum(dollars), 2),
            "expectancy_dollars": round(sum(dollars) / len(items), 2) if items else 0.0,
            "max_drawdown_dollars": round(max_drawdown(dollars), 2),
            "max_consecutive_losses": max_losses(dollars),
            "worst_trade_dollars": round(min(dollars), 2) if dollars else 0.0,
            "two_loss_streak_dollars": round(sum(sorted(losses)[:2]), 2) if len(losses) >= 2 else "",
            "no_fill_count": sum(1 for row in items if row.get("outcome") == "no_limit_fill"),
            "stop_before_tp1_count": sum(1 for row in items if "stop_before_tp1" in str(row.get("outcome"))),
            "tp1_count": sum(1 for row in items if str(row.get("outcome")).startswith("tp1") or row.get("outcome") == "tp2_before_tp1_branch"),
        })
    return summaries


def render_report(summary_rows: list[dict[str, Any]]) -> str:
    lines = [
        "# Mancini FBD Prop Risk Recheck",
        "",
        "Research/replay only. This rechecks the existing `non_acceptance_only` 1m all-data signals using Pine-style smaller brackets and prop-account drawdown constraints.",
        "",
        "## Pine Baseline Used",
        "",
        "- Entry: `setup_level + 0.25` for limit-style profiles.",
        "- Stop: `setup_level - 3.0`, matching Pine default `max_stop_points=3.0` and `hard_stop_points=5.0`.",
        "- TP1: `entry + 2.0`.",
        "- Split profile: 2 contracts, bank one at TP1, move runner stop to breakeven, runner target is next trusted level or `entry + 4.0`.",
        "- Costs: 0.25 point entry slippage plus $5 commission per contract.",
        "",
        "## Summary",
        "",
        "| Profile | Signals | Fills | Fill Rate | Net $ | Exp $ | Max DD $ | Worst Trade $ | Max Losses | No Fill | Stop Before TP1 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in summary_rows:
        lines.append(
            f"| `{row['profile']}` | {row['signals']} | {row['fills']} | {row['fill_rate']} | "
            f"{row['net_dollars']} | {row['expectancy_dollars']} | {row['max_drawdown_dollars']} | "
            f"{row['worst_trade_dollars']} | {row['max_consecutive_losses']} | {row['no_fill_count']} | {row['stop_before_tp1_count']} |"
        )
    lines += [
        "",
        "## Prop Constraint Read",
        "",
        "- A two-contract Pine stop at roughly 3.25 points of risk is about $325 gross risk before costs, not the roughly $1200 loss from a 12-point two-contract stop.",
        "- Any profile with max drawdown near or above $2000 is not prop-account safe without additional daily stop and size throttles.",
        "- Profiles with many `no_limit_fill` rows are safer but may undertrade; that is expected if we require pullback fills instead of chasing the classification close.",
        "",
        "## Files",
        "",
        f"- `outcomes_csv`: `{OUTCOMES_CSV.relative_to(ROOT)}`",
        f"- `summary_csv`: `{SUMMARY_CSV.relative_to(ROOT)}`",
        f"- `summary_json`: `{SUMMARY_JSON.relative_to(ROOT)}`",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    bars, _inventory = all_data.load_all_raw_bars()
    sessions = all_data.group_by_session(bars)
    signals = [
        row for row in read_csv(SIGNALS_CSV)
        if row.get("rule") == "non_acceptance_only" and row.get("timeframe_minutes") == "1"
    ]
    outcomes = []
    for signal in signals:
        session_bars = sessions.get(signal.get("session_date") or "")
        if not session_bars:
            continue
        for profile in PROFILES:
            outcomes.append(simulate(signal, session_bars, profile))
    summary_rows = summarize(outcomes)
    write_csv(OUTCOMES_CSV, outcomes)
    write_csv(SUMMARY_CSV, summary_rows)
    SUMMARY_JSON.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_signals_csv": str(SIGNALS_CSV.relative_to(ROOT)),
        "signals": len(signals),
        "profiles": PROFILES,
        "summary": summary_rows,
        "risk_context": {
            "prop_max_drawdown_dollars": 2000,
            "prop_profit_target_dollars": 3000,
            "point_value": POINT_VALUE,
            "commission_per_contract": COMMISSION_PER_CONTRACT,
            "entry_slippage_points": ENTRY_SLIPPAGE_POINTS,
        },
    }, indent=2, sort_keys=True), encoding="utf-8")
    REPORT_MD.write_text(render_report(summary_rows), encoding="utf-8")
    print(json.dumps({
        "out_dir": str(OUT_DIR.relative_to(ROOT)),
        "signals": len(signals),
        "summary": summary_rows,
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
