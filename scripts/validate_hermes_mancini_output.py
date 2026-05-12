#!/usr/bin/env python3
"""Validate Hermes review output for Mancini ES 1m packets.

This is an offline guardrail. It checks that Hermes does not turn one-packet
observations into exact strategy thresholds or claim a clean hallucination audit
while unsupported exact rules are present.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


EXACT_RULE_RE = re.compile(r"(>=|<=|>|<|=|\bunder\b|\bover\b|\bbetween\b|\b\d+(?:\.\d+)?)", re.IGNORECASE)
UNIVERSAL_WORD_RE = re.compile(r"\b(always|must|required|never|universal|confirmed|proves?)\b", re.IGNORECASE)
LIVE_WORD_RE = re.compile(r"\b(live|tradeable|entry signal|buy|sell|position size|broker|order)\b", re.IGNORECASE)
NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            rows.append({"_line": line_number, "_parse_error": str(exc)})
            continue
        if isinstance(item, dict):
            item["_line"] = line_number
            rows.append(item)
    return rows


def audit_row(row: dict) -> list[dict]:
    issues = []
    packet_id = row.get("packet_id")

    if row.get("_parse_error"):
        return [{
            "packet_id": packet_id,
            "line": row.get("_line"),
            "severity": "error",
            "field": "json",
            "issue": row["_parse_error"],
        }]

    for index, signature in enumerate(row.get("hypothetical_signatures") or []):
        text = json.dumps(signature) if isinstance(signature, (dict, list)) else str(signature)
        if EXACT_RULE_RE.search(text):
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "error",
                "field": f"hypothetical_signatures[{index}]",
                "issue": "Exact threshold appears in hypothesis. It must be rewritten as a measured observation or explicitly marked unsupported until cross-packet evidence exists.",
                "text": text,
            })

    for index, hypothesis in enumerate(row.get("mathematical_signature_hypotheses") or []):
        text = json.dumps(hypothesis) if isinstance(hypothesis, (dict, list)) else str(hypothesis)
        if EXACT_RULE_RE.search(text) and "not_a_rule" not in text:
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "error",
                "field": f"mathematical_signature_hypotheses[{index}]",
                "issue": "Exact threshold hypothesis lacks not_a_rule guard.",
                "text": text,
            })

    for field in ("source_text_summary", "independent_theory_comparison", "luke_rule_comparison"):
        text = str(row.get(field) or "")
        if field == "source_text_summary" and "observed_bar_metric" in text:
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "warn",
                "field": field,
                "issue": "Source text summary is labeled as observed_bar_metric. Use observed_text unless the claim is a measured OHLCV field.",
                "text": text,
            })
        if field == "source_text_summary" and "raw_text_threshold" in text and not NUMBER_RE.search(text):
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "warn",
                "field": field,
                "issue": "raw_text_threshold label appears without a numeric threshold. Use observed_text or raw_text_level instead.",
                "text": text,
            })
        if UNIVERSAL_WORD_RE.search(text):
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "warn",
                "field": field,
                "issue": "Potential overclaim language; keep packet-level claims narrow.",
                "text": text,
            })
        if LIVE_WORD_RE.search(text):
            issues.append({
                "packet_id": packet_id,
                "line": row.get("_line"),
                "severity": "warn",
                "field": field,
                "issue": "Trading/live language detected; verify it is not implying execution readiness.",
                "text": text,
            })

    audit_text = json.dumps(row.get("hallucination_audit") or "")
    if issues and re.search(r"none detected|pass.*true", audit_text, re.IGNORECASE):
        issues.append({
            "packet_id": packet_id,
            "line": row.get("_line"),
            "severity": "error",
            "field": "hallucination_audit",
            "issue": "Self-audit claims clean despite validator issues.",
            "text": audit_text,
        })

    return issues


def run(args: argparse.Namespace) -> int:
    rows = load_jsonl(Path(args.input))
    issues = [issue for row in rows for issue in audit_row(row)]
    result = {
        "input": args.input,
        "rows": len(rows),
        "issue_count": len(issues),
        "errors": sum(1 for issue in issues if issue["severity"] == "error"),
        "warnings": sum(1 for issue in issues if issue["severity"] == "warn"),
        "issues": issues,
    }
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 1 if result["errors"] else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Hermes JSONL output")
    parser.add_argument("--out", help="Optional JSON report path")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
