#!/usr/bin/env python3
"""Render OCR-readable Mancini packet chart examples as SVG.

The charts are research-only visual aids built from local packet crop windows.
They do not create strategy code or trading authority.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
DEFAULT_PACKETS = ROOT / "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl"
DEFAULT_OUT_DIR = ROOT / "artifacts/research/hermes-mancini-event-packets/charts"


FAMILY_ORDER = [
    "non_acceptance_protocol",
    "classic_acceptance_backtest_from_below",
    "classic_acceptance_second_attempt_reclaim",
    "simple_reclaim_unclassified",
]


def num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        out[str(row.get("packet_id"))] = row
    return out


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def load_window(path_value: str) -> list[dict[str, Any]]:
    path = Path(path_value)
    if not path.is_absolute():
        path = ROOT / path
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        rows = []
        for row in csv.DictReader(handle):
            rows.append({
                "timestamp": row.get("timestamp_et") or "",
                "open": num(row.get("open")),
                "high": num(row.get("high")),
                "low": num(row.get("low")),
                "close": num(row.get("close")),
                "volume": num(row.get("volume")),
            })
    return rows


def choose_examples(rows: list[dict[str, str]], per_family: int) -> list[dict[str, str]]:
    selected: list[dict[str, str]] = []
    for family in FAMILY_ORDER:
        family_rows = [
            row for row in rows
            if row.get("acceptance_family") == family
            and (row.get("accepted_for_timing_test") == "True" or row.get("daily_plan_eligible") == "False")
        ]
        family_rows.sort(key=lambda row: (num(row.get("mfe_15m")), -num(row.get("mae_15m"))), reverse=True)
        selected.extend(family_rows[:per_family])
    return selected


def scale(value: float, low: float, high: float, top: float, height: float) -> float:
    if high <= low:
        return top + height / 2
    return top + (high - value) / (high - low) * height


def line(x1: float, y1: float, x2: float, y2: float, stroke: str, width: float = 1, dash: str = "") -> str:
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{width}"{dash_attr}/>'


def text(x: float, y: float, content: str, size: int = 14, fill: str = "#f5f5f5", anchor: str = "start") -> str:
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-family="Arial, sans-serif">{html.escape(content)}</text>'


def wrap_words(content: str, max_chars: int) -> list[str]:
    words = str(content or "").split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if current and len(candidate) > max_chars:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def render_chart(row: dict[str, str], packet: dict[str, Any], out_path: Path) -> None:
    bars = load_window(row["window_csv"])
    level = num(row.get("level"))
    danger = level + 5
    trap_low = num(row.get("trap_candle_low"), None)
    invalidation = num(row.get("invalidation_sweep_low_minus_1tick"), None)
    highs = [bar["high"] for bar in bars] + [level, danger]
    lows = [bar["low"] for bar in bars] + [level]
    if trap_low is not None and trap_low > 0:
        lows.append(trap_low)
    if invalidation is not None and invalidation > 0:
        lows.append(invalidation)
    y_low = min(lows) - 2
    y_high = max(highs) + 2

    width = 1200
    height = 980
    plot_left = 70
    plot_top = 90
    plot_width = 1040
    plot_height = 500
    candle_gap = 4
    candle_w = max(5, (plot_width / max(1, len(bars))) - candle_gap)
    x_step = plot_width / max(1, len(bars))

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#0b0d10"/>',
        text(28, 38, row.get("case_title") or "Mancini Failed Breakdown Packet Example", 24, "#ffffff"),
        text(28, 65, f"{row.get('acceptance_family')} | level {level:.2f} | packet {row.get('packet_id')}", 15, "#d9e6ff"),
    ]

    for i in range(6):
        y = plot_top + i * plot_height / 5
        price = y_high - i * (y_high - y_low) / 5
        parts.append(line(plot_left, y, plot_left + plot_width, y, "#263241", 1))
        parts.append(text(plot_left + plot_width + 10, y + 5, f"{price:.2f}", 12, "#aeb9c8"))

    level_y = scale(level, y_low, y_high, plot_top, plot_height)
    danger_y = scale(danger, y_low, y_high, plot_top, plot_height)
    parts.append(line(plot_left, level_y, plot_left + plot_width, level_y, "#f4d35e", 2))
    parts.append(text(plot_left + 8, level_y - 8, f"reclaimed level {level:.2f}", 13, "#f4d35e"))
    parts.append(line(plot_left, danger_y, plot_left + plot_width, danger_y, "#5bc0eb", 1.5, "8 6"))
    parts.append(text(plot_left + 8, danger_y - 8, f"non-acceptance danger line level + 5 = {danger:.2f}", 13, "#5bc0eb"))
    if invalidation is not None and invalidation > 0:
        invalid_y = scale(invalidation, y_low, y_high, plot_top, plot_height)
        parts.append(line(plot_left, invalid_y, plot_left + plot_width, invalid_y, "#f25f5c", 1.5, "5 5"))
        parts.append(text(plot_left + 8, invalid_y + 18, f"invalidation anchor {invalidation:.2f}", 13, "#f25f5c"))

    trap_ts = row.get("trap_candle_timestamp_et")
    reclaim_ts = row.get("first_reclaim_close_timestamp_et")
    for idx, bar in enumerate(bars):
        x = plot_left + idx * x_step + x_step / 2
        y_open = scale(bar["open"], y_low, y_high, plot_top, plot_height)
        y_high_bar = scale(bar["high"], y_low, y_high, plot_top, plot_height)
        y_low_bar = scale(bar["low"], y_low, y_high, plot_top, plot_height)
        y_close = scale(bar["close"], y_low, y_high, plot_top, plot_height)
        color = "#32d074" if bar["close"] >= bar["open"] else "#ff5c5c"
        parts.append(line(x, y_high_bar, x, y_low_bar, color, 1))
        rect_y = min(y_open, y_close)
        rect_h = max(2, abs(y_close - y_open))
        parts.append(f'<rect x="{x - candle_w / 2:.1f}" y="{rect_y:.1f}" width="{candle_w:.1f}" height="{rect_h:.1f}" fill="{color}" opacity="0.9"/>')
        if bar["timestamp"] == trap_ts:
            parts.append(line(x, plot_top, x, plot_top + plot_height, "#ff8c42", 2, "4 4"))
            parts.append(text(x + 6, plot_top + 18, "trap candle", 12, "#ffb37a"))
        if bar["timestamp"] == reclaim_ts:
            parts.append(line(x, plot_top, x, plot_top + plot_height, "#7bd88f", 2, "4 4"))
            parts.append(text(x + 6, plot_top + 36, "first reclaim close", 12, "#a7f3b7"))

    labels = [
        f"source: {packet.get('source_map', {}).get('source_id')}",
        f"source kind: {packet.get('source_map', {}).get('source_kind')}",
        f"timezone policy: {(packet.get('crop_window') or {}).get('timezone_policy') or 'unspecified'}",
        f"flush points: {num(row.get('flush_points')):.2f}",
        f"reclaim minutes from trap: {num(row.get('reclaim_minutes_from_trap')):.2f}",
        f"acceptance closes: {row.get('acceptance_closes')}",
        f"non-acceptance held bars: {row.get('non_acceptance_held_bars')}",
        f"MFE 15m: {num(row.get('mfe_15m')):.2f} | MAE 15m: {num(row.get('mae_15m')):.2f}",
        "research only - verify visually before OCR reuse",
    ]
    box_x = 70
    box_y = 610
    parts.append(f'<rect x="{box_x}" y="{box_y}" width="1040" height="340" fill="#141922" stroke="#344156" rx="6"/>')
    for i, label in enumerate(labels):
        parts.append(text(box_x + 16 + (i % 2) * 520, box_y + 26 + (i // 2) * 24, label, 14, "#f1f5f9"))
    source_label = row.get("source_label") or row.get("case_source_quote") or ""
    case_note = row.get("case_note") or ""
    label_rows = (len(labels) + 1) // 2
    y = box_y + 26 + label_rows * 24 + 14
    if source_label:
        parts.append(text(box_x + 16, y, "newsletter/source text:", 13, "#f4d35e"))
        for line_index, wrapped in enumerate(wrap_words(source_label, 142)[:3]):
            parts.append(text(box_x + 16, y + 20 + line_index * 18, wrapped, 13, "#f1f5f9"))
        y += 74
    if case_note:
        parts.append(text(box_x + 16, y, "case note:", 13, "#5bc0eb"))
        for line_index, wrapped in enumerate(wrap_words(case_note, 142)[:4]):
            parts.append(text(box_x + 16, y + 20 + line_index * 18, wrapped, 13, "#f1f5f9"))

    parts.append("</svg>")
    out_path.write_text("\n".join(parts), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-family", type=int, default=3)
    parser.add_argument("--rows", default=str(DEFAULT_ROWS))
    parser.add_argument("--packets", default=str(DEFAULT_PACKETS))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    args = parser.parse_args()
    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = load_rows(Path(args.rows))
    packets = load_jsonl(Path(args.packets))
    selected = choose_examples(rows, args.per_family)
    index_lines = ["# Mancini Packet Chart Examples", "", "Research-only OCR review images.", ""]
    manifest = []
    for i, row in enumerate(selected, start=1):
        packet = packets.get(row["packet_id"]) or {}
        family = row.get("acceptance_family") or "unknown"
        out_path = out_dir / f"{i:02d}_{family}_{row.get('level')}.svg"
        render_chart(row, packet, out_path)
        rel = out_path.relative_to(ROOT)
        index_lines.append(f"- [{out_path.name}](../charts/{out_path.name}) - {row.get('packet_id')}")
        manifest.append({
            "packet_id": row.get("packet_id"),
            "acceptance_family": family,
            "level": num(row.get("level")),
            "chart_path": str(rel),
            "mfe_15m": num(row.get("mfe_15m")),
            "mae_15m": num(row.get("mae_15m")),
            "review_only": True,
        })
    (out_dir / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"charts": len(manifest), "out_dir": str(out_dir.relative_to(ROOT)), "manifest": str((out_dir / "manifest.json").relative_to(ROOT))}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
