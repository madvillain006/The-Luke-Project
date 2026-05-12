#!/usr/bin/env python3
"""Build review-only Hermes packets for Mancini failed-breakdown analysis.

This is an offline research pathway. It reads local CSV/JSON/JSONL event files
and local ES 1m Barchart CSVs, writes crop windows plus JSONL packets, and does
not touch runtime trading state, NinjaTrader files, broker paths, or Radar state.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import tempfile
from datetime import timedelta
from pathlib import Path

import crop_mancini_windows as cropper


TIMESTAMP_FIELDS = [
    "timestamp",
    "timestamp_et",
    "signal_timestamp",
    "entry_timestamp",
    "signal_et",
    "entry_et",
    "reclaim_et",
    "flush_et",
    "sweep_et",
    "touch_et",
    "available_at_et",
    "breakdown_timestamp_et",
    "reclaim_timestamp",
]

CT_TIMESTAMP_FIELDS = [
    "entry_ct",
    "reclaim_ct",
    "flush_ct",
    "sweep_ct",
    "touch_ct",
]

LEVEL_FIELDS = [
    "level",
    "executable_level",
    "price",
    "entry_reference",
    "entry_price",
]


def read_csv_rows(path: Path) -> list[dict]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def read_json_rows(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        for key in ("events", "setups", "rows", "trades"):
            if isinstance(data.get(key), list):
                return [row for row in data[key] if isinstance(row, dict)]
        return [data]
    return []


def read_jsonl_rows(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        if isinstance(item, dict):
            rows.append(item)
    return rows


def read_event_rows(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return read_csv_rows(path)
    if suffix == ".json":
        return read_json_rows(path)
    if suffix == ".jsonl":
        return read_jsonl_rows(path)
    return []


def first_present(row: dict, keys: list[str]) -> object | None:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return None


def parse_level(row: dict, fallback_text: str) -> float | None:
    for key in LEVEL_FIELDS:
        value = row.get(key)
        parsed = cropper.parse_float(value)
        if parsed is not None:
            return parsed
    return cropper.first_price(None, fallback_text)


def normalized_text(row: dict) -> str:
    for key in ("source_snippet", "snippet", "source_quote", "observed_text", "note", "notes", "text", "content", "name", "primary_role", "role", "tags"):
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return json.dumps(row, sort_keys=True)


def timestamp_quality(row: dict, selected_field: str | None) -> str:
    if not selected_field:
        return "missing"
    if selected_field in set(CT_TIMESTAMP_FIELDS):
        return "exact_barchart_raw_time"
    if selected_field in {"entry_et", "reclaim_et", "flush_et", "sweep_et", "touch_et", "signal_et"}:
        return "exact"
    if selected_field in {"timestamp", "timestamp_et", "signal_timestamp", "entry_timestamp", "available_at_et", "breakdown_timestamp_et", "reclaim_timestamp"}:
        return "exact"
    return "inferred"


def event_from_row(row: dict, source_path: Path, index: int, timezone_policy: str) -> tuple[cropper.Event | None, str | None, str]:
    selected_field = None
    ts_value = None
    fields = CT_TIMESTAMP_FIELDS + TIMESTAMP_FIELDS if timezone_policy == "barchart-raw" else TIMESTAMP_FIELDS
    for key in fields:
        value = row.get(key)
        if value is not None and str(value).strip():
            selected_field = key
            ts_value = value
            break
    text = normalized_text(row)
    if not ts_value:
        return None, None, text
    level = parse_level(row, text)
    event = cropper.Event(
        event_id=str(row.get("id") or row.get("level_id") or row.get("name") or f"{source_path.name}:{index}"),
        timestamp=cropper.parse_timestamp(str(ts_value)),
        level=level,
        source_path=str(source_path),
        source_line=index + 1 if source_path.suffix.lower() == ".csv" else None,
        text=text,
    )
    return event, selected_field, text


def median(values: list[float]) -> float | None:
    clean = sorted(value for value in values if math.isfinite(value))
    if not clean:
        return None
    mid = len(clean) // 2
    if len(clean) % 2:
        return clean[mid]
    return (clean[mid - 1] + clean[mid]) / 2


def bar_index(window: list[cropper.Bar], timestamp_iso: str | None) -> int | None:
    if not timestamp_iso:
        return None
    for index, bar in enumerate(window):
        if bar.timestamp.isoformat() == timestamp_iso:
            return index
    return None


def independent_features(window: list[cropper.Bar], summary: dict) -> dict:
    trap_i = bar_index(window, summary.get("trap_candle_timestamp_et"))
    reclaim_i = bar_index(window, summary.get("first_reclaim_close_timestamp_et"))
    trap = window[trap_i] if trap_i is not None else None
    prior = window[max(0, (trap_i or 0) - 20):trap_i] if trap_i is not None else []
    median_range20 = median([bar.high - bar.low for bar in prior])
    median_volume20 = median([bar.volume for bar in prior if bar.volume is not None])
    volume_ratio = round(trap.volume / median_volume20, 4) if trap and trap.volume is not None and median_volume20 else None
    close_location = None
    if trap and trap.high > trap.low:
        close_location = round((trap.close - trap.low) / (trap.high - trap.low), 4)
    depth_norm = None
    if median_range20 and summary.get("flush_points") is not None:
        depth_norm = round(float(summary["flush_points"]) / median_range20, 4)
    reclaim_minutes = None
    if trap and reclaim_i is not None:
        reclaim_minutes = round((window[reclaim_i].timestamp - trap.timestamp).total_seconds() / 60, 2)
        if reclaim_minutes < 0:
            reclaim_minutes = None

    acceptance_count = summary.get("acceptance_consecutive_1m_closes_above_level") or 0
    if acceptance_count >= 3:
        acceptance_type = "three_plus_1m_closes"
    elif acceptance_count == 2:
        acceptance_type = "two_1m_closes"
    elif reclaim_i is not None:
        acceptance_type = "single_reclaim_close"
    else:
        acceptance_type = "none"

    return {
        "theory_name": "liquidity_sweep_reclaim",
        "floor_quality": "unknown",
        "technical_location": [],
        "flush_depth_normalized_by_median_range20": depth_norm,
        "trap_candle_volume_ratio_vs_median20": volume_ratio,
        "trap_candle_wick_to_body": summary.get("trap_candle_wick_to_body"),
        "trap_candle_close_location": close_location,
        "reclaim_minutes_from_trap_candle": reclaim_minutes,
        "reclaim_2_to_3_5_minute_hypothesis_match": reclaim_minutes is not None and 2 <= reclaim_minutes <= 3.5,
        "acceptance_type": acceptance_type,
        "danger_zone_behavior": "unknown",
        "unsupported_features": [
            "floor_quality_requires_prior_shelf_scan",
            "technical_location_requires_source_context_or_higher_timeframe",
        ],
    }


def existing_luke_rule_match(row: dict) -> dict:
    return {
        "source_row_status": row.get("event_status") or row.get("status") or None,
        "entry_model": row.get("entry_model") or row.get("entry_model_group") or None,
        "acceptance2_et": row.get("acceptance2_et") or None,
        "acceptance3_et": row.get("acceptance3_et") or None,
        "nonacceptance2_et": row.get("nonacceptance2_et") or None,
        "sweep_depth_points": cropper.parse_float(row.get("sweep_depth_points")),
        "no_lookahead": True,
        "important_boundary": "Existing Luke fields are implementation evidence, not Mancini source truth.",
    }


def source_outcome_metrics(row: dict) -> dict:
    fields = [
        "mfe_5m", "mae_5m", "hit_2pt_5m", "hit_4pt_5m", "hit_8pt_5m", "hit_10pt_5m",
        "mfe_15m", "mae_15m", "hit_2pt_15m", "hit_4pt_15m", "hit_8pt_15m", "hit_10pt_15m",
        "mfe_30m", "mae_30m", "hit_2pt_30m", "hit_4pt_30m", "hit_8pt_30m", "hit_10pt_30m",
        "mfe_60m", "mae_60m", "hit_2pt_60m", "hit_4pt_60m", "hit_8pt_60m", "hit_10pt_60m",
        "mfe_eod", "mae_eod", "hit_2pt_eod", "hit_4pt_eod", "hit_8pt_eod", "hit_10pt_eod",
    ]
    out = {}
    for field in fields:
        value = row.get(field)
        if value is None or str(value).strip() == "":
            out[field] = None
        elif str(value).strip().lower() in {"true", "false"}:
            out[field] = str(value).strip().lower() == "true"
        else:
            out[field] = cropper.parse_float(value)
    return out


def short_quote(text: str, max_chars: int = 260) -> str:
    flat = " ".join(str(text).split())
    return flat[:max_chars]


def build_packet(row: dict, event: cropper.Event, selected_ts_field: str | None, source_text: str, bars_source: str, window_path: Path, window: list[cropper.Bar], summary: dict, minutes: int, timezone_policy: str) -> dict:
    expected_bars = minutes * 2 + 1
    return {
        "schema_version": 1,
        "kind": "hermes_mancini_es1m_comparison",
        "packet_id": f"mancini-es1m:{event.timestamp.strftime('%Y-%m-%dT%H%M')}:{event.level or 'no-level'}:{event.event_id}",
        "review_only": True,
        "trading_authority": "none",
        "source_map": {
            "source_id": row.get("source_id") or None,
            "source_kind": row.get("source_kind") or None,
            "source_path": row.get("source_path") or event.source_path,
            "ocr_verified": str(row.get("ocr_verified") or "").strip().lower() == "true",
            "daily_plan_eligible": (row.get("source_kind") or "") == "daily_plan_text",
            "methodology_rules_are_context_only": True,
        },
        "source_text_evidence": {
            "source_path": event.source_path,
            "line_start": event.source_line,
            "line_end": event.source_line,
            "quote": short_quote(source_text),
            "normalized_text": source_text,
            "timestamp_et": event.timestamp.isoformat(),
            "timestamp_field": selected_ts_field,
            "timestamp_quality": timestamp_quality(row, selected_ts_field),
            "level": event.level,
            "instrument": row.get("instrument") or "ES",
            "evidence_type": row.get("evidence_type") or row.get("role") or row.get("primary_role") or "structured_research_row",
            "parser_warnings": [],
        },
        "crop_window": {
            "bars_source_path": bars_source,
            "window_csv": str(window_path),
            "center_timestamp_et": event.timestamp.isoformat(),
            "minutes_before": minutes,
            "minutes_after": minutes,
            "first_timestamp_et": window[0].timestamp.isoformat() if window else None,
            "last_timestamp_et": window[-1].timestamp.isoformat() if window else None,
            "bar_count": len(window),
            "expected_bar_count": expected_bars,
            "missing_bar_count": max(0, expected_bars - len(window)),
            "timezone_policy": timezone_policy,
        },
        "bar_metrics": {
            "level": summary.get("level"),
            "flush_points": summary.get("flush_points"),
            "flush_ticks": summary.get("flush_ticks"),
            "trap_candle_timestamp_et": summary.get("trap_candle_timestamp_et"),
            "trap_candle_open": summary.get("trap_candle_open"),
            "trap_candle_high": summary.get("trap_candle_high"),
            "trap_candle_low": summary.get("trap_candle_low"),
            "trap_candle_close": summary.get("trap_candle_close"),
            "trap_candle_volume": summary.get("trap_candle_volume"),
            "trap_candle_wick_to_body": summary.get("trap_candle_wick_to_body"),
            "first_reclaim_close_timestamp_et": summary.get("first_reclaim_close_timestamp_et"),
            "acceptance_consecutive_1m_closes_above_level": summary.get("acceptance_consecutive_1m_closes_above_level"),
            "invalidation_sweep_low_minus_1tick": summary.get("invalidation_sweep_low_minus_1tick"),
            "invalidation_level_minus_2points": summary.get("invalidation_level_minus_2points"),
        },
        "existing_luke_rule_match": existing_luke_rule_match(row),
        "source_outcome_metrics": source_outcome_metrics(row),
        "independent_theory_features": independent_features(window, summary),
        "hallucination_checks": {
            "allowed_claim_types": ["observed_text", "observed_bar_metric", "existing_luke_rule", "hypothesis", "unsupported"],
            "forbidden_claim_types": ["exact_new_rule", "win_rate", "live_trade_instruction", "position_size", "broker_action"],
            "must_cite_source_lines": True,
            "must_cite_metric_fields": True,
            "invented_rule_check": "No exact threshold may be asserted unless present in source_text_evidence, bar_metrics, or existing_luke_rule_match.",
            "output_must_include_uncertainty": True,
        },
    }


def slug(text: str) -> str:
    return cropper.slug(text)


def write_prompt(path: Path, packets_path: Path) -> None:
    prompt = f"""You are Hermes in review-only mode.

Input file:
{packets_path}

Goal:
Compare Adam Mancini failed-breakdown source evidence against ES 1-minute OHLCV crop windows and existing Luke deterministic rule outputs. Extract candidate mathematical signatures. Do not approve a live strategy.

Hard boundaries:
- Do not create live trading rules.
- Do not imply live readiness.
- Do not recommend position size.
- Do not touch broker, account, risk, execution, Pine, NinjaTrader, or live market-data paths.
- Do not convert a hypothesis into an approved Luke rule.
- Do not invent exact thresholds unless they are present in supplied source text, measured bar metrics, or existing Luke rule output.

Claim labels:
Every claim must be labeled as exactly one of:
- observed_text
- observed_bar_metric
- existing_luke_rule
- hypothesis
- unsupported

Known context:
- Mancini text supports meaningful low/support, sweep/flush, reclaim, acceptance, shallow under 20 points, deep over 20 points, +5 and hold a few minutes in non-acceptance examples, and rare lowest-low-holds invalidation examples.
- Mancini text does not prove a universal close count, universal volume threshold, universal stop formula, or live-trading readiness.
- Working inference to test: reclaim within roughly 2-3.5 minutes appears important. Treat this as a hypothesis unless a packet directly supports it.
- If timezone_policy is barchart-raw, timestamps are aligned to raw Barchart bar labels rather than asserted as true ET.
- This input file contains candidate packets. Do not treat packet count as accepted timing-row count. Bucket statistics must come from quick_reclaim_acceptance_summary.json after deterministic aggregation.

For each packet:
1. Summarize what the source text explicitly says.
2. Summarize what the ES 1m bar metrics show.
3. Compare source text to existing Luke rules.
4. Compare source text to independent OHLCV theory features.
5. Identify supported, conflicting, and unsupported assumptions.
6. Propose candidate mathematical signatures as hypotheses only.
7. Return a hallucination audit.

Output JSONL, one object per packet:
{{
  "packet_id": "...",
  "summary": "...",
  "claim_table": [
    {{
      "claim": "...",
      "claim_type": "observed_text|observed_bar_metric|existing_luke_rule|hypothesis|unsupported",
      "citation_or_field": "..."
    }}
  ],
  "rule_alignment": {{
    "existing_luke_rule_supported": true,
    "supported_parts": [],
    "unsupported_parts": [],
    "conflicts": []
  }},
  "mathematical_signature_hypotheses": [
    {{
      "name": "...",
      "conditions": [],
      "confidence": "low|medium|high",
      "evidence_fields": [],
      "not_a_rule": true
    }}
  ],
  "missing_evidence": [],
  "hallucination_audit": {{
    "invented_exact_rules": [],
    "uncited_claims": [],
    "live_trading_language_found": false,
    "pass": true
  }}
}}
"""
    path.write_text(prompt, encoding="utf-8")


def load_merged_bars(paths: list[str]) -> list[cropper.Bar]:
    by_timestamp: dict[str, cropper.Bar] = {}
    for path_text in paths:
        for bar in cropper.parse_bars_csv(Path(path_text)):
            key = bar.timestamp.isoformat()
            existing = by_timestamp.get(key)
            if existing is None or (bar.volume or 0) > (existing.volume or 0):
                by_timestamp[key] = bar
    return sorted(by_timestamp.values(), key=lambda bar: bar.timestamp)


def run(args: argparse.Namespace) -> int:
    bars_paths = [str(Path(path)) for path in args.bars_csv]
    bars_source = ";".join(bars_paths)
    bars = load_merged_bars(bars_paths)
    out_dir = Path(args.out_dir)
    windows_dir = out_dir / "windows"
    out_dir.mkdir(parents=True, exist_ok=True)
    windows_dir.mkdir(parents=True, exist_ok=True)

    packets = []
    skipped = []
    for event_path_text in args.events:
        event_path = Path(event_path_text)
        for index, row in enumerate(read_event_rows(event_path), start=1):
            event, selected_ts_field, text = event_from_row(row, event_path, index, args.timezone_policy)
            if not event:
                skipped.append({"source_path": str(event_path), "row_index": index, "reason": "missing_timestamp"})
                continue
            if event.level is None:
                skipped.append({"source_path": str(event_path), "row_index": index, "reason": "missing_level"})
                continue
            window = cropper.crop_bars(bars, event.timestamp, args.minutes)
            if args.require_full_window and len(window) < args.minutes * 2 + 1:
                skipped.append({"source_path": str(event_path), "row_index": index, "reason": "incomplete_window", "window_bars": len(window)})
                continue
            window_name = slug(f"{event.timestamp.strftime('%Y%m%d_%H%M')}_{event.level}_{event.event_id}") + ".csv"
            window_path = windows_dir / window_name
            cropper.write_window_csv(window_path, window)
            summary = cropper.summarize_event(event, window)
            packets.append(build_packet(row, event, selected_ts_field, text, bars_source, window_path, window, summary, args.minutes, args.timezone_policy))
            if args.limit and len(packets) >= args.limit:
                break
        if args.limit and len(packets) >= args.limit:
            break

    packets_path = out_dir / "hermes_packets.jsonl"
    with packets_path.open("w", encoding="utf-8") as handle:
        for packet in packets:
            handle.write(json.dumps(packet, separators=(",", ":")) + "\n")

    skipped_path = out_dir / "skipped.json"
    skipped_path.write_text(json.dumps(skipped, indent=2), encoding="utf-8")
    prompt_path = out_dir / "HERMES_PROMPT.md"
    write_prompt(prompt_path, packets_path)

    print(json.dumps({
        "packets": len(packets),
        "skipped": len(skipped),
        "out_dir": str(out_dir),
        "packets_path": str(packets_path),
        "prompt_path": str(prompt_path),
        "skipped_path": str(skipped_path),
    }, indent=2))
    return 0


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        bars_path = root / "bars.csv"
        events_path = root / "events.csv"
        out_dir = root / "out"
        bars_path.write_text("\n".join([
            "Time,Open,High,Low,Latest,Change,%Change,Volume",
            '"2026-05-07 09:29",7334,7335,7333,7334.5,0,0%,100',
            '"2026-05-07 09:30",7334.5,7335,7326.5,7328,0,0%,900',
            '"2026-05-07 09:31",7328,7333.5,7327.5,7332.25,0,0%,1200',
            '"2026-05-07 09:32",7332.25,7334,7331.75,7333,0,0%,800',
        ]), encoding="utf-8")
        events_path.write_text("\n".join([
            "name,entry_et,level,note,entry_model,acceptance2_et",
            "test,2026-05-07 09:30,7332,shelf sweep then recover 7332,acceptance_2m,2026-05-07 09:32",
        ]), encoding="utf-8")
        args = argparse.Namespace(
            bars_csv=[str(bars_path)],
            events=[str(events_path)],
            out_dir=str(out_dir),
            minutes=2,
            limit=0,
            require_full_window=False,
            timezone_policy="et",
        )
        run(args)
        packets = (out_dir / "hermes_packets.jsonl").read_text(encoding="utf-8").splitlines()
        assert len(packets) == 1
        packet = json.loads(packets[0])
        assert packet["review_only"] is True
        assert packet["trading_authority"] == "none"
        assert packet["bar_metrics"]["flush_points"] == 5.5
        assert packet["independent_theory_features"]["reclaim_2_to_3_5_minute_hypothesis_match"] is False
        assert (out_dir / "HERMES_PROMPT.md").exists()
    print("self-test passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bars-csv", nargs="+", help="Local Barchart ES 1m CSV file(s)")
    parser.add_argument("--events", nargs="+", help="Timestamped event CSV/JSON/JSONL files")
    parser.add_argument("--out-dir", default="artifacts/research/hermes-mancini-packets")
    parser.add_argument("--minutes", type=int, default=15)
    parser.add_argument("--limit", type=int, default=0, help="Optional packet limit for smoke runs")
    parser.add_argument("--timezone-policy", default="et", choices=["et", "ct-to-et", "strict", "barchart-raw"])
    parser.add_argument("--require-full-window", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.bars_csv or not args.events:
        parser.error("--bars-csv and --events are required unless --self-test is used")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
