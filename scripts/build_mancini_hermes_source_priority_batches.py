#!/usr/bin/env python3
"""Build source-priority Mancini packet batches for Hermes review.

The output is intentionally review-only and compact: each row keeps Mancini
source evidence, derived OHLC metrics, chart paths, and classifier labels, while
omitting unrelated packet fields. This prevents simulated artifacts or derived
labels from outranking Mancini text.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl"
GALLERY = ROOT / "artifacts/research/mancini-real-packet-gallery/manifest.json"
VISUAL_AUDIT = ROOT / "artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json"
OUT_DIR = ROOT / "artifacts/research/mancini-hermes-source-priority-batches"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        rows[str(row.get("packet_id"))] = row
    return rows


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "\n".join(json.dumps(row, sort_keys=True) for row in rows) + ("\n" if rows else ""),
        encoding="utf-8",
    )


def compact_packet(
    gallery_row: dict[str, Any],
    packet: dict[str, Any],
    visual_row: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "review_only": True,
        "trading_authority": "none",
        "claim_priority_order": [
            "mancini_methodology_or_newsletter_text",
            "real_packet_window",
            "observed_bar_metric",
            "deterministic_classifier",
            "hypothesis",
        ],
        "packet_id": gallery_row.get("packet_id"),
        "mancini_source_priority": True,
        "mancini_explicitness": gallery_row.get("mancini_explicitness"),
        "source_text_evidence": gallery_row.get("source_text_evidence"),
        "derived_source_evidence": gallery_row.get("derived_source_evidence"),
        "raw_mancini_source": gallery_row.get("raw_mancini_source"),
        "source_derivation_chain": gallery_row.get("source_derivation_chain"),
        "source_map": packet.get("source_map"),
        "event_fields": gallery_row.get("event_fields"),
        "chart_evidence": {
            "chart_path": gallery_row.get("chart_path"),
            "png_path": gallery_row.get("png_path"),
            "window_csv": gallery_row.get("window_csv"),
            "artifact_kind": gallery_row.get("artifact_kind"),
            "data_class": gallery_row.get("data_class"),
        },
        "timing_stat_policy": {
            "accepted_for_timing_test": gallery_row.get("accepted_for_timing_test"),
            "excluded_from_timing_stats": gallery_row.get("excluded_from_timing_stats"),
            "reject_reasons": gallery_row.get("reject_reasons") or [],
        },
        "deterministic_classifier": {
            "acceptance_family": gallery_row.get("acceptance_family"),
            "candidate_acceptance_family": gallery_row.get("candidate_acceptance_family"),
            "family_label_status": gallery_row.get("family_label_status"),
            "acceptance_family_is_strategy_trigger": gallery_row.get("acceptance_family_is_strategy_trigger"),
            "reclaim_time_bucket": gallery_row.get("reclaim_time_bucket"),
        },
        "trigger_validation": gallery_row.get("trigger_validation"),
        "bar_metrics": packet.get("bar_metrics"),
        "source_outcome_metrics": packet.get("source_outcome_metrics"),
        "metric_interpretation": gallery_row.get("metric_interpretation") or "observational_only",
        "visual_training_sanity": None if visual_row is None else {
            "status": visual_row.get("status"),
            "reasons": visual_row.get("reasons") or [],
            "caution_notes": visual_row.get("caution_notes") or [],
            "manual_review_label": visual_row.get("manual_review_label"),
            "pre_trap_bars": visual_row.get("pre_trap_bars"),
            "post_reclaim_bars": visual_row.get("post_reclaim_bars"),
            "prior_visible_level_tests": visual_row.get("prior_visible_level_tests"),
            "visible_acceptance_closes": visual_row.get("visible_acceptance_closes"),
            "immediate_failure_after_reclaim": visual_row.get("immediate_failure_after_reclaim"),
        },
        "independent_theory_features": packet.get("independent_theory_features"),
        "existing_luke_rule_match": packet.get("existing_luke_rule_match"),
        "hallucination_checks": packet.get("hallucination_checks"),
    }


def write_batch(name: str, rows: list[dict[str, Any]], manifest: list[dict[str, Any]]) -> None:
    path = OUT_DIR / f"{name}.jsonl"
    write_jsonl(path, rows)
    family_counts = Counter(row.get("deterministic_classifier", {}).get("acceptance_family") for row in rows)
    explicitness_counts = Counter(row.get("mancini_explicitness") for row in rows)
    manifest.append({
        "name": name,
        "path": str(path.relative_to(ROOT)),
        "row_count": len(rows),
        "family_counts": dict(sorted(family_counts.items())),
        "source_explicitness_counts": dict(sorted(explicitness_counts.items())),
        "review_only": True,
        "trading_authority": "none",
    })


def select(rows: list[dict[str, Any]], predicate: Callable[[dict[str, Any]], bool]) -> list[dict[str, Any]]:
    return [row for row in rows if predicate(row)]


def render_prompt(manifest: list[dict[str, Any]]) -> str:
    batch_lines = "\n".join(f"- `{item['path']}` ({item['row_count']} rows)" for item in manifest)
    return f"""Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini

You are Hermes in review-only mode. Mancini is the source of truth.

Read:
{batch_lines}
- `artifacts/research/mancini-methodology/source-map.json`
- `artifacts/research/mancini-real-case-studies/manifest.json`
- `artifacts/research/mancini-real-packet-gallery/manifest.json`
- `artifacts/research/mancini-real-packet-gallery/summary.json`
- `artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json`
- `artifacts/research/mancini-visual-sanity-audit/training_candidates.csv`
- `artifacts/research/mancini-visual-sanity-audit/dangerous_demotions.csv`
- `artifacts/research/mancini-visual-sanity-audit/summary.md`

Task:
Audit the Mancini failed-breakdown machine representation using source-priority batches.
Do not blend simulated methodology charts into performance or timing evidence.
Treat `acceptance_family` as a heuristic bucket only. It is not a strategy trigger.

Priority order:
1. Mancini methodology/newsletter/raw_mancini_source and source_text_evidence.
2. Real packet chart/window evidence.
3. observed_bar_metric fields.
4. deterministic_classifier fields.
5. hypotheses only after the first four are cited.

Required passes:
1. Explicit narrative pass: start with `batch_01_explicit_narrative.jsonl`.
2. Current/recent levels pass: review `batch_04_recent_may_2026.jsonl`.
3. Family pass: compare the family batches; treat `family_unmeasurable` as an exclusion/control family.
4. Exclusion pass: inspect excluded rows and explain why they must stay out of timing stats.
5. Provenance pass: inspect `batch_07_raw_price_only_provenance_review.jsonl` and flag rows where raw source matching is too weak for strong conclusions.
6. Visual sanity pass: start OCR/teaching-example review from `training_candidates.csv`; use `dangerous_demotions.csv` only as caution/control evidence.
7. Trigger validation pass: only rows with `trigger_validation.status=validated_replay_trigger_candidate` can be discussed as positive trigger-modeling candidates.

Return:
- source-priority findings
- classifier disagreements or weak labels
- best real examples for human chart review
- safe OCR/training candidates and demoted chart examples
- missing fields to improve Hermes and Ninja shadow parity
- next deterministic backtest fields
- hallucination audit

Hard rules:
- Review-only. No live trading authority.
- Do not invent exact rules.
- Do not turn support-list rows into narrative proof.
- Do not use excluded rows in timing statistics.
- Do not use `dangerous_demote_for_training` rows as positive teaching examples.
- Do not use heuristic `acceptance_family` labels as Ninja trigger logic.
- Do not promote any row to positive trigger modeling unless `trigger_validation.status` passes.
- Distinguish observed_text, observed_bar_metric, deterministic_classifier, hypothesis, and unsupported.
"""


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gallery_rows = load_json(GALLERY)
    packets = load_jsonl(PACKETS)
    visual_rows = {
        str(row.get("packet_id")): row
        for row in (load_json(VISUAL_AUDIT).get("rows") or [])
    }
    compact_rows = []
    for gallery_row in gallery_rows:
        packet_id = str(gallery_row.get("packet_id"))
        if packet_id not in packets:
            raise SystemExit(f"missing packet for gallery row: {packet_id}")
        compact_rows.append(compact_packet(gallery_row, packets[packet_id], visual_rows.get(packet_id)))

    manifest: list[dict[str, Any]] = []
    write_batch("batch_00_all_real_packets", compact_rows, manifest)
    write_batch("batch_01_explicit_narrative", select(compact_rows, lambda row: row.get("mancini_explicitness") == "explicit_mancini_narrative"), manifest)
    write_batch("batch_02_support_resistance_list", select(compact_rows, lambda row: row.get("mancini_explicitness") == "support_resistance_list"), manifest)
    write_batch("batch_03_context_text", select(compact_rows, lambda row: row.get("mancini_explicitness") == "mancini_context_text"), manifest)
    write_batch(
        "batch_04_recent_may_2026",
        select(compact_rows, lambda row: "2026-05" in str(row.get("source_text_evidence", {}).get("timestamp_et"))),
        manifest,
    )
    write_batch(
        "batch_05_accepted_timing_only",
        select(compact_rows, lambda row: row.get("timing_stat_policy", {}).get("accepted_for_timing_test") is True),
        manifest,
    )
    write_batch(
        "batch_06_excluded_timing_review",
        select(compact_rows, lambda row: row.get("timing_stat_policy", {}).get("excluded_from_timing_stats") is True),
        manifest,
    )
    write_batch(
        "batch_07_raw_price_only_provenance_review",
        select(compact_rows, lambda row: row.get("raw_mancini_source", {}).get("match_quality") == "price_only"),
        manifest,
    )
    for family in sorted({row.get("deterministic_classifier", {}).get("acceptance_family") for row in compact_rows}):
        write_batch(
            f"family_{family}",
            select(compact_rows, lambda row, family=family: row.get("deterministic_classifier", {}).get("acceptance_family") == family),
            manifest,
        )

    summary = {
        "artifact_kind": "mancini_hermes_source_priority_batches",
        "review_only": True,
        "trading_authority": "none",
        "source_priority": "mancini_text_then_real_packet_windows_then_metrics_then_classifier",
        "batch_count": len(manifest),
        "batches": manifest,
    }
    (OUT_DIR / "batch_manifest.json").write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    (OUT_DIR / "HERMES_SOURCE_PRIORITY_PROMPT.md").write_text(render_prompt(manifest), encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
