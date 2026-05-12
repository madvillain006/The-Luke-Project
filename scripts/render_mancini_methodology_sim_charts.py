#!/usr/bin/env python3
"""Render OCR-readable simulated Mancini methodology charts.

These charts are review-only training/reference examples. They intentionally
separate methodology diagrams from historical ES packet statistics.
"""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "artifacts/research/mancini-methodology/simulated-traditional-charts"


def candle(t: int, o: float, h: float, l: float, c: float) -> dict[str, float]:
    return {"t": t, "open": o, "high": h, "low": l, "close": c}


SCENARIOS = [
    {
        "scenario_id": "classic_failed_breakdown_prior_low",
        "title": "Classic Failed Breakdown - Prior Low Flush And Reclaim",
        "source_basis": [
            "Methodology image: classic failed breakdown",
            "Recent local Mancini packet scale: May 4 7212/7213 failed breakdown with flush toward 7199",
        ],
        "candles": [
            candle(1, 7226, 7230, 7217, 7220),
            candle(2, 7220, 7223, 7212, 7214),
            candle(3, 7214, 7218, 7209, 7216),
            candle(4, 7216, 7220, 7211, 7213),
            candle(5, 7213, 7216, 7199, 7204),
            candle(6, 7204, 7220, 7201, 7216),
            candle(7, 7216, 7228, 7214, 7225),
            candle(8, 7225, 7242, 7221, 7239),
            candle(9, 7239, 7256, 7235, 7250),
            candle(10, 7250, 7266, 7244, 7261),
        ],
        "levels": [
            {"price": 7213, "label": "Recent Mancini failed-breakdown level", "color": "#38d66b"},
            {"price": 7198.75, "label": "Invalidation below sweep low", "color": "#ef4444"},
            {"price": 7218, "label": "Level + 5 danger line", "color": "#f59e0b"},
        ],
        "callouts": [
            {"bar": 5, "text": "Trap candle: flushes low by 14 pts"},
            {"bar": 6, "text": "Reclaim close: back above level by 3 pts"},
            {"bar": 8, "text": "Acceptance / squeeze after recovery"},
        ],
        "machine_rule_fields": {
            "reference_level_type": "prior_day_low",
            "sweep_direction": "below_support",
            "reference_level_example": 7213,
            "flush_depth_points_example": 14,
            "reclaim_distance_points_example": 3,
            "invalidation_rule": "below sweep low plus buffer",
        },
    },
    {
        "scenario_id": "non_acceptance_protocol_level_plus_five",
        "title": "Non-Acceptance Protocol - Level + 5 Hold",
        "source_basis": [
            "Methodology text: in fast shallow cases, reclaim by about 5 points and hold a couple minutes",
            "Recent local Mancini packet scale: May 4 7205 quick reclaim and level+5 behavior",
        ],
        "candles": [
            candle(1, 7218, 7222, 7212, 7214),
            candle(2, 7214, 7216, 7205, 7207),
            candle(3, 7207, 7210, 7199.5, 7202),
            candle(4, 7202, 7214, 7201, 7210),
            candle(5, 7210, 7214, 7208, 7212),
            candle(6, 7212, 7216, 7209, 7213),
            candle(7, 7213, 7221, 7212, 7218),
            candle(8, 7218, 7228, 7216, 7225),
            candle(9, 7225, 7238, 7221, 7234),
        ],
        "levels": [
            {"price": 7205, "label": "Recent reclaimed failed-breakdown level", "color": "#38d66b"},
            {"price": 7210, "label": "Level + 5 danger zone / hold line", "color": "#f59e0b"},
            {"price": 7199.25, "label": "Invalidation below lowest low", "color": "#ef4444"},
        ],
        "callouts": [
            {"bar": 3, "text": "Sweep low: shallow flush under support"},
            {"bar": 4, "text": "First close clears level + 5"},
            {"bar": 6, "text": "2-3 min hold above danger line"},
        ],
        "machine_rule_fields": {
            "reference_level_type": "significant_low",
            "reference_level_example": 7205,
            "sweep_direction": "below_support",
            "non_acceptance_danger_zone_points": 5,
            "non_acceptance_hold_bars_example": 2,
            "timing_hypothesis": "2_to_3_5_minutes_after_trap",
        },
    },
    {
        "scenario_id": "classic_acceptance_backtest_from_below",
        "title": "Classic Acceptance - Backtest From Below Then Reclaim",
        "source_basis": [
            "Methodology text: price can backtest significant low from below, sell off, then return",
            "Recent local Mancini packet scale: May 7 7355 over 7345 failed-breakdown behavior",
        ],
        "candles": [
            candle(1, 7362, 7368, 7353, 7359),
            candle(2, 7359, 7364, 7354, 7356),
            candle(3, 7356, 7358, 7345.75, 7348),
            candle(4, 7348, 7355, 7344.75, 7353),
            candle(5, 7353, 7356, 7347, 7349),
            candle(6, 7349, 7354, 7346, 7352),
            candle(7, 7352, 7361, 7351, 7358),
            candle(8, 7358, 7370, 7356, 7367),
            candle(9, 7367, 7382, 7364, 7378),
        ],
        "levels": [
            {"price": 7355, "label": "Recent failed-breakdown reclaim level", "color": "#38d66b"},
            {"price": 7344.75, "label": "Invalidation under 7345 defensive area", "color": "#ef4444"},
        ],
        "callouts": [
            {"bar": 3, "text": "Breakdown below level"},
            {"bar": 4, "text": "Backtests level from below"},
            {"bar": 7, "text": "Second return/reclaim gives acceptance"},
        ],
        "machine_rule_fields": {
            "acceptance_family": "classic_acceptance_backtest_from_below",
            "reference_level_example": 7355,
            "requires_selloff_after_backtest": True,
            "entry_after": "return_to_reclaimed_level_after_backtest_failure",
        },
    },
    {
        "scenario_id": "level_acceptance_breakout_quality",
        "title": "Level Acceptance - Breakout Quality Filter",
        "source_basis": [
            "Methodology image: no acceptance breakout is likely to become a trap",
            "Methodology image: acceptance before breakout is less likely to trap",
            "Recent local Mancini packet scale: May 7 7369 first-support/reclaim area",
        ],
        "candles": [
            candle(1, 7358, 7366, 7355, 7363),
            candle(2, 7363, 7369, 7359, 7366),
            candle(3, 7366, 7371, 7361, 7368),
            candle(4, 7368, 7370, 7362, 7365),
            candle(5, 7365, 7372, 7363, 7370),
            candle(6, 7370, 7378, 7368, 7375),
            candle(7, 7375, 7388, 7373, 7385),
            candle(8, 7385, 7396, 7381, 7392),
        ],
        "levels": [
            {"price": 7369, "label": "Recent resistance / reclaim level", "color": "#a855f7"},
            {"price": 7364, "label": "Pre-breakout acceptance zone", "color": "#38d66b"},
        ],
        "callouts": [
            {"bar": 2, "text": "Repeated level touches build acceptance"},
            {"bar": 5, "text": "Compression near level"},
            {"bar": 7, "text": "Breakout after acceptance"},
        ],
        "machine_rule_fields": {
            "setup_type": "breakout_quality_filter",
            "reference_level_example": 7369,
            "pre_breakout_dwell_bars_example": 5,
            "touch_count_near_level_example": 4,
        },
    },
    {
        "scenario_id": "level_reclaim_sr_shelf",
        "title": "Level Reclaim - S/R Shelf Recovery",
        "source_basis": [
            "Methodology image: level reclaim of a support/resistance shelf",
            "Methodology text: horizontal shelf reclaim is related but not identical to single-low sweep",
            "Recent local Mancini packet scale: May 7 7345/7355 shelf and recovery area",
        ],
        "candles": [
            candle(1, 7352, 7360, 7348, 7357),
            candle(2, 7357, 7362, 7349, 7350),
            candle(3, 7350, 7353, 7336, 7339),
            candle(4, 7339, 7351, 7334, 7348),
            candle(5, 7348, 7355, 7340, 7343),
            candle(6, 7343, 7354, 7338, 7350),
            candle(7, 7350, 7360, 7347, 7357),
            candle(8, 7357, 7372, 7355, 7368),
            candle(9, 7368, 7386, 7364, 7379),
        ],
        "levels": [
            {"price": 7355, "label": "Recent S/R shelf reclaim level", "color": "#38d66b"},
            {"price": 7333.75, "label": "Invalidation under reclaim structure", "color": "#ef4444"},
        ],
        "callouts": [
            {"bar": 3, "text": "Shelf lost"},
            {"bar": 5, "text": "Failed reclaim attempt"},
            {"bar": 7, "text": "Final reclaim above shelf"},
        ],
        "machine_rule_fields": {
            "setup_type": "level_reclaim",
            "reference_level_example": 7355,
            "failed_reclaim_attempts_example": 2,
            "entry_after": "final_close_above_shelf_with_acceptance",
        },
    },
]


def y_for(price: float, min_price: float, max_price: float, top: int, bottom: int) -> float:
    span = max_price - min_price
    if span <= 0:
        return (top + bottom) / 2
    return bottom - ((price - min_price) / span) * (bottom - top)


def svg_text(x: float, y: float, text: str, size: int = 18, color: str = "#f8fafc", weight: str = "400") -> str:
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-family="Arial, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" fill="{color}">{html.escape(text)}</text>'
    )


def render_chart(scenario: dict, out_path: Path) -> None:
    width, height = 1400, 860
    left, right, top, bottom = 95, 1040, 95, 700
    candles = scenario["candles"]
    prices = []
    for bar in candles:
        prices.extend([bar["high"], bar["low"]])
    for level in scenario["levels"]:
        prices.append(level["price"])
    min_price = min(prices) - 6
    max_price = max(prices) + 6
    x_step = (right - left) / max(1, len(candles) - 1)

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">',
        '<rect width="1400" height="860" fill="#050505"/>',
        svg_text(36, 42, scenario["title"], 28, "#f8fafc", "700"),
        svg_text(36, 72, "SIMULATED METHODOLOGY CHART - REVIEW ONLY - NO TRADING AUTHORITY", 16, "#fbbf24", "700"),
        f'<rect x="{left}" y="{top}" width="{right-left}" height="{bottom-top}" fill="#070707" stroke="#334155" stroke-width="1"/>',
    ]

    for i in range(6):
        price = min_price + (max_price - min_price) * i / 5
        y = y_for(price, min_price, max_price, top, bottom)
        parts.append(f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="#1f2937" stroke-width="1"/>')
        parts.append(svg_text(right + 10, y + 5, f"{price:.2f}", 15, "#cbd5e1"))

    for level in scenario["levels"]:
        y = y_for(level["price"], min_price, max_price, top, bottom)
        color = level["color"]
        parts.append(f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="{color}" stroke-width="3"/>')
        parts.append(
            f'<rect x="{right + 10}" y="{y - 20:.1f}" width="315" height="28" rx="4" fill="#111827" stroke="{color}" stroke-width="1"/>'
        )
        parts.append(svg_text(right + 18, y, f'{level["price"]:.2f} - {level["label"]}', 14, "#f8fafc"))

    candle_width = 18
    x_by_bar = {}
    for idx, bar in enumerate(candles):
        x = left + idx * x_step
        x_by_bar[bar["t"]] = x
        yo = y_for(bar["open"], min_price, max_price, top, bottom)
        yh = y_for(bar["high"], min_price, max_price, top, bottom)
        yl = y_for(bar["low"], min_price, max_price, top, bottom)
        yc = y_for(bar["close"], min_price, max_price, top, bottom)
        color = "#22c55e" if bar["close"] >= bar["open"] else "#ef4444"
        body_y = min(yo, yc)
        body_h = max(4, abs(yc - yo))
        parts.append(f'<line x1="{x:.1f}" y1="{yh:.1f}" x2="{x:.1f}" y2="{yl:.1f}" stroke="{color}" stroke-width="3"/>')
        parts.append(
            f'<rect x="{x - candle_width/2:.1f}" y="{body_y:.1f}" width="{candle_width}" height="{body_h:.1f}" '
            f'fill="{color}" stroke="#e5e7eb" stroke-width="0.5"/>'
        )
        parts.append(svg_text(x - 6, bottom + 28, str(bar["t"]), 13, "#94a3b8"))

    for index, callout in enumerate(scenario["callouts"]):
        x = x_by_bar.get(callout["bar"], left)
        bar = candles[callout["bar"] - 1]
        y = y_for(bar["high"], min_price, max_price, top, bottom)
        box_x = 760 if index % 2 == 0 else 540
        box_y = 135 + index * 76
        parts.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{box_x:.1f}" y2="{box_y + 14:.1f}" stroke="#e5e7eb" stroke-width="2"/>')
        parts.append(f'<rect x="{box_x}" y="{box_y}" width="430" height="46" rx="6" fill="#1f2937" stroke="#f8fafc" stroke-width="1.4"/>')
        parts.append(svg_text(box_x + 12, box_y + 29, callout["text"], 17, "#f8fafc", "700"))

    parts.append(svg_text(36, 755, "OCR PACKET LABELS:", 17, "#fbbf24", "700"))
    labels = [
        f"scenario_id={scenario['scenario_id']}",
        "source=simulated_methodology_chart",
        "review_only=true",
        "trading_authority=none",
        "performance_data=false",
        "exclude_from_performance=true",
    ]
    for i, label in enumerate(labels):
        parts.append(svg_text(36, 782 + i * 20, label, 15, "#e5e7eb"))

    parts.append("</svg>")
    out_path.write_text("\n".join(parts), encoding="utf-8")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    packets_path = OUT_DIR / "methodology_sim_packets.jsonl"
    with packets_path.open("w", encoding="utf-8") as packets:
        for idx, scenario in enumerate(SCENARIOS, start=1):
            chart_path = OUT_DIR / f"{idx:02d}_sim_review_only_{scenario['scenario_id']}.svg"
            render_chart(scenario, chart_path)
            row = {
                "packet_id": f"mancini-methodology-sim:{scenario['scenario_id']}",
                "artifact_kind": "simulated_methodology_chart",
                "source_type": "simulated_methodology_chart",
                "data_class": "synthetic_review_only",
                "performance_data": False,
                "exclude_from_performance": True,
                "scenario_id": scenario["scenario_id"],
                "title": scenario["title"],
                "chart_path": str(chart_path.relative_to(ROOT)),
                "source_basis": scenario["source_basis"],
                "machine_rule_fields": scenario["machine_rule_fields"],
                "review_only": True,
                "trading_authority": "none",
                "hallucination_controls": [
                    "Simulated examples are not historical evidence.",
                    "Use these for OCR/schema validation only.",
                    "Do not include these rows in performance or timing statistics.",
                ],
            }
            packets.write(json.dumps(row, sort_keys=True) + "\n")
            manifest.append(row)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    index_lines = [
        "# Mancini Simulated Methodology Charts",
        "",
        "Review-only OCR/reference examples. Do not include these simulated rows in performance statistics.",
        "",
    ]
    for row in manifest:
        index_lines.append(f"## {row['title']}")
        index_lines.append("")
        index_lines.append(f"- Packet: `{row['packet_id']}`")
        index_lines.append(f"- Chart: `{row['chart_path']}`")
        index_lines.append("")
    (OUT_DIR / "index.md").write_text("\n".join(index_lines), encoding="utf-8")
    print(json.dumps({"charts": len(manifest), "out_dir": str(OUT_DIR), "packets": str(packets_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
