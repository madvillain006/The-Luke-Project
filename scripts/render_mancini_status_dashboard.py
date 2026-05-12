#!/usr/bin/env python3
"""Render a compact Mancini research status dashboard as SVG."""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "artifacts/research/mancini-status-dashboard"
GALLERY = ROOT / "artifacts/research/mancini-real-packet-gallery/summary.json"
CHART_AUDIT = ROOT / "artifacts/research/mancini-chart-artifact-audit.json"
BATCH_AUDIT = ROOT / "artifacts/research/mancini-hermes-source-priority-batches/audit.json"
OVERLAP = ROOT / "artifacts/research/mancini-full-level-overlap/summary.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def text(x: int, y: int, value: str, size: int = 22, fill: str = "#f8fafc", weight: str = "400") -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="Segoe UI, Arial, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" fill="{fill}">{html.escape(str(value))}</text>'
    )


def card(x: int, y: int, w: int, h: int, title: str, lines: list[str], accent: str) -> str:
    parts = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#111827" stroke="#334155" stroke-width="1"/>',
        f'<rect x="{x}" y="{y}" width="8" height="{h}" rx="4" fill="{accent}"/>',
        text(x + 26, y + 38, title, 24, "#ffffff", "700"),
    ]
    for idx, line in enumerate(lines):
        parts.append(text(x + 26, y + 76 + idx * 30, line, 18, "#cbd5e1"))
    return "\n".join(parts)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gallery = load_json(GALLERY)
    chart_audit = load_json(CHART_AUDIT)
    batch_audit = load_json(BATCH_AUDIT)
    overlap = load_json(OVERLAP)

    chart_counts = chart_audit["counts"]
    totals = overlap["totals"]
    status_counts = overlap["status_counts"]
    batch_counts = batch_audit["counts"]
    raw_counts = chart_audit["raw_match_quality_counts"]

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">',
        '<rect width="100%" height="100%" fill="#070b12"/>',
        text(48, 64, "Mancini Source-Priority Research Status", 36, "#ffffff", "800"),
        text(48, 98, "Research/replay only. Mancini text and real examples outrank generated labels.", 18, "#94a3b8"),
        card(
            48,
            140,
            405,
            210,
            "Data Coverage",
            [
                f"Parsed Mancini rows: {totals['rows']}",
                f"Entry-model rows: {totals['entry_model_available']}",
                f"Packet windows: {gallery['rows']}",
                f"Accepted / excluded: {gallery['accepted_timing_rows']} / {gallery['excluded_timing_rows']}",
            ],
            "#38bdf8",
        ),
        card(
            498,
            140,
            405,
            210,
            "Source Provenance",
            [
                f"Explicit narrative rows: {gallery['source_explicitness_counts']['explicit_mancini_narrative']}",
                f"Support/resistance rows: {gallery['source_explicitness_counts']['support_resistance_list']}",
                f"Exact/partial raw matches: {raw_counts['exact_snippet']} / {raw_counts['partial_snippet']}",
                f"Price-only warnings: {raw_counts['price_only']}",
            ],
            "#f59e0b",
        ),
        card(
            948,
            140,
            405,
            210,
            "Artifacts",
            [
                f"Total PNG charts: {chart_counts['total_png']}",
                f"Full real gallery PNGs: {chart_counts['real_packet_gallery_png']}",
                f"Hermes batches: {batch_counts['batches']}",
                f"Batch audit pass: {str(batch_audit['pass']).lower()}",
            ],
            "#22c55e",
        ),
        card(
            48,
            390,
            405,
            250,
            "Level Universe",
            [
                f"Not touched: {status_counts.get('not_touched')}",
                f"No bars for plan date: {status_counts.get('no_bars_for_plan_date')}",
                f"Touched no entry model: {status_counts.get('touched_no_entry_model')}",
                "More logs improve OOS sample.",
                "More ES repairs missing dates.",
            ],
            "#a78bfa",
        ),
        card(
            498,
            390,
            405,
            250,
            "Machine Rule Boundary",
            [
                "Phenomenon in replay scope.",
                "Machine parity not final yet.",
                "No universal close-count rule.",
                "No universal stop formula.",
                "No live trading authority.",
            ],
            "#ef4444",
        ),
        card(
            948,
            390,
            405,
            250,
            "Next Hermes Pass",
            [
                "Start explicit narrative batch.",
                "Then recent May 2026 cases.",
                "Then family comparison.",
                "Review price-only provenance.",
                "Return classifier disagreements.",
            ],
            "#14b8a6",
        ),
        text(48, 710, "Key paths", 24, "#ffffff", "700"),
        text(48, 745, "artifacts/research/mancini-hermes-source-priority-batches/HERMES_SOURCE_PRIORITY_PROMPT.md", 17, "#cbd5e1"),
        text(48, 775, "artifacts/research/mancini-real-packet-gallery/manifest.json", 17, "#cbd5e1"),
        text(48, 805, "artifacts/research/mancini-full-level-overlap/summary.md", 17, "#cbd5e1"),
        text(48, 835, "reports/mancini-extended-oos-optimization-2026-05-12.md", 17, "#cbd5e1"),
        "</svg>",
    ]
    out_path = OUT_DIR / "mancini_source_priority_dashboard.svg"
    out_path.write_text("\n".join(parts), encoding="utf-8")
    print(json.dumps({
        "svg": str(out_path.relative_to(ROOT)),
        "png": str(out_path.with_suffix(".png").relative_to(ROOT)),
        "review_only": True,
        "trading_authority": "none",
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
