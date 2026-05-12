#!/usr/bin/env python3
"""Build a source-first Mancini failed-breakdown audit.

This is offline research only. It reads raw Mancini text plus existing local
Mancini artifacts and writes a review report. It does not create trading
signals, runtime state, broker actions, or Ninja/shadow trigger logic.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_FILES = [
    ROOT / "data/research/mancini/Longer Mancini Logs 2.txt",
    ROOT / "data/research/mancini/The Longer Mancini Logs.txt",
    ROOT / "data/research/mancini/methodology.txt",
    ROOT / "data/research/mancini/parsing text.txt",
]
ROWS_CSV = ROOT / "artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_rows.csv"
GALLERY_MANIFEST = ROOT / "artifacts/research/mancini-real-packet-gallery/manifest.json"
VISUAL_AUDIT = ROOT / "artifacts/research/mancini-visual-sanity-audit/visual_sanity_audit.json"
SESSIONS_DIR = ROOT / "data/backtest/es-long-bracket/sessions"
OUT_DIR = ROOT / "artifacts/research/mancini-direct-fbd-source-audit"
OUT_JSON = OUT_DIR / "direct_fbd_source_audit.json"
OUT_MD = ROOT / "reports/mancini-direct-fbd-source-audit-2026-05-12.md"
OUT_LEDGER = ROOT / "reports/mancini-fbd-chronological-source-ledger-2026-05-12.md"
OUT_CHECKLIST = ROOT / "reports/mancini-fbd-chronological-canonical-checklist-2026-05-12.md"

PRICE_RE = re.compile(r"\b([4-8]\d{3}(?:\.\d{1,2})?)\b")
TIME_RE = re.compile(r"\b(?:[01]?\d|2[0-3])(?::\d{2})?\s*(?:AM|PM|am|pm)\b|\b\d{1,2}:\d{2}\b")
DATE_LINE_RE = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+2026\b",
    re.IGNORECASE,
)
TITLE_DATE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
    r"\s+(\d{1,2})(?:st|nd|rd|th)?\s+Plan",
    re.IGNORECASE,
)
MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

DIRECT_SETUP_MARKERS = (
    "failed breakdown",
    "failed break down",
    "flush",
    "flushed",
    "sweep",
    "swept",
    "lost",
    "recover",
    "recovered",
    "reclaim",
    "reclaimed",
    "trap",
    "trapped",
    "ripped",
    "squeeze",
)
GENERIC_ONLY_MARKERS = (
    "readers know",
    "cycle repeats",
    "job description",
    "not about trading",
    "golden rule",
)
NEGATIVE_MARKERS = (
    "never recovered",
    "never got",
    "not a failed breakdown",
    "level reclaim long not a failed breakdown",
    "breakdown trades",
    "breakdown shorts",
)


def line_mode(line: str, path: Path) -> str:
    lowered = line.lower()
    if path.name == "methodology.txt":
        return "methodology_definition"
    if any(marker in lowered for marker in NEGATIVE_MARKERS):
        return "negative_control"
    if lowered.startswith("bull case") or lowered.startswith("in summary"):
        return "context_recap"
    actual_loss = any(
        re.search(pattern, lowered)
        for pattern in (
            r"\bwe\s+(?:swept|flushed|lost|sold)",
            r"\bes\s+(?:swept|flushed|lost|sold)",
            r"\bby\s+\d{1,2}:\d{2}[^.]{0,80}\brecovered",
            r"\brecovered[^.]{0,80}\b(?:ripped|ran|squeezed|rallied)",
            r"\bswept[^.]{0,120}\brecovered",
            r"\bflushed[^.]{0,120}\brecovered",
            r"\blost[^.]{0,120}\brecovered",
        )
    )
    actual_response = any(term in lowered for term in ("ripped", "ran", "squeezed", "rallied", "off to the races", "commencing"))
    if actual_loss and ("recover" in lowered or "reclaim" in lowered) and actual_response:
        return "actual_recap"
    if any(marker in lowered for marker in ("wait for", "if we", "would be", "would want", "possible", "candidate", "planned", "actionable")):
        return "planned_setup"
    if "failed breakdown" in lowered:
        return "context_recap"
    return "data_context"


@dataclass
class Article:
    path: Path
    start: int
    end: int
    title: str
    pub_date: str | None
    plan_date: str | None


def rel(path: Path | str | None) -> str | None:
    if path is None:
        return None
    p = Path(path)
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def parse_plan_date(title: str) -> str | None:
    match = TITLE_DATE_RE.search(title)
    if not match:
        return None
    month = MONTHS[match.group(1).lower()]
    day = int(match.group(2))
    return f"2026-{month:02d}-{day:02d}"


def parse_pub_date(text: str) -> str | None:
    try:
        return datetime.strptime(text.strip(), "%b %d, %Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def detect_articles(path: Path, lines: list[str]) -> list[Article]:
    starts: list[int] = []
    for idx in range(len(lines) - 1):
        if DATE_LINE_RE.match(lines[idx + 1].strip()) and lines[idx].strip():
            starts.append(idx + 1)
    if not starts:
        starts = [1]
    articles: list[Article] = []
    for pos, start in enumerate(starts):
        end = starts[pos + 1] - 1 if pos + 1 < len(starts) else len(lines)
        title = lines[start - 1].strip() if start - 1 < len(lines) else path.name
        pub = parse_pub_date(lines[start].strip()) if start < len(lines) else None
        articles.append(
            Article(
                path=path,
                start=start,
                end=end,
                title=title,
                pub_date=pub,
                plan_date=parse_plan_date(title),
            )
        )
    return articles


def article_for_line(articles: list[Article], line_number: int) -> Article:
    for article in articles:
        if article.start <= line_number <= article.end:
            return article
    return articles[-1]


def clean(text: str, limit: int = 360) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 3] + "..."


def prices(text: str) -> list[float]:
    out: list[float] = []
    seen: set[float] = set()
    for match in PRICE_RE.finditer(text):
        value = float(match.group(1))
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out


def time_mentions(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in TIME_RE.finditer(text):
        value = match.group(0)
        key = value.lower().replace(" ", "")
        if key not in seen:
            seen.add(key)
            out.append(value)
    return out


def expand_abbrev_range(left: str, right: str) -> tuple[float, float]:
    lo = float(left)
    if "." in right:
        hi = float(right)
    else:
        left_int = int(float(left))
        prefix = str(left_int)[: -len(right)]
        hi = float(prefix + right)
    return (min(lo, hi), max(lo, hi))


def zones_from_text(text: str) -> list[dict[str, Any]]:
    zones: list[dict[str, Any]] = []
    used_spans: list[tuple[int, int]] = []
    for match in re.finditer(r"\b([4-8]\d{3}(?:\.\d{1,2})?)-(\d{1,4}(?:\.\d{1,2})?)\b", text):
        lo, hi = expand_abbrev_range(match.group(1), match.group(2))
        zones.append({"low": lo, "high": hi, "text": match.group(0)})
        used_spans.append(match.span())
    for match in PRICE_RE.finditer(text):
        if any(start <= match.start() < end for start, end in used_spans):
            continue
        value = float(match.group(1))
        zones.append({"low": value, "high": value, "text": match.group(0)})
    return zones


def level_in_zone(level: float, zone: dict[str, Any], tolerance: float = 0.25) -> bool:
    return zone["low"] - tolerance <= level <= zone["high"] + tolerance


def direct_candidate(line: str, path: Path) -> bool:
    lowered = line.lower()
    if path.name == "methodology.txt":
        return "failed breakdown" in lowered and any(term in lowered for term in ("support", "trap", "low", "recover", "acceptance"))
    if lowered.startswith("supports are") or lowered.startswith("resistances are"):
        return False
    has_fbd = "failed breakdown" in lowered or "failed break down" in lowered
    has_action_pair = any(term in lowered for term in ("flush", "swept", "lost")) and any(
        term in lowered for term in ("recover", "recovered", "reclaim", "reclaimed", "ripped")
    )
    if not (has_fbd or has_action_pair):
        return False
    if not prices(line) and path.name != "methodology.txt":
        return False
    if has_fbd and any(term in lowered for term in GENERIC_ONLY_MARKERS) and not has_action_pair:
        return False
    return True


def extract_roles(text: str) -> dict[str, list[float]]:
    role_patterns = {
        "actual_setup_level": [
            r"failed\s+breakdown(?:\s+long)?\s+(?:of|at)\s+(?:[^\d]{0,80})?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"([4-8]\d{3}(?:\.\d{1,2})?)\s+failed\s+breakdown",
            r"(?:flushed|swept|lost)\s+(?:the\s+|that\s+|a\s+|an\s+|yesterday's\s+|today's\s+|friday's\s+|monday's\s+|tuesday's\s+|wednesday's\s+|thursday's\s+|sunday's\s+)?(?:major\s+|massive\s+|big\s+)?([4-8]\d{3}(?:\.\d{1,2})?)\s+(?:low|shelf|level)",
            r"(?:lost|swept|flushed)\s+(?:a\s+|the\s+)?[^.]{0,80}?\b([4-8]\d{3}(?:\.\d{1,2})?)\s+(?:low|shelf|level)",
            r"recovered\s+(?:that\s+|the\s+)?([4-8]\d{3}(?:\.\d{1,2})?)\s+(?:shelf|low|level)?",
            r"recovered\s+(?:a\s+|the\s+)?[^.]{0,80}?\b(?:low|shelf|level)(?:\s+set)?[^.]{0,40}?\s+at\s+([4-8]\d{3}(?:\.\d{1,2})?)",
            r"reclaim(?:ed|s|ing)?\s+(?:the\s+)?(?:significant\s+low\s*)?\(?([4-8]\d{3}(?:\.\d{1,2})?)\)?",
            r"(?:sold|selling)\s+to\s+([4-8]\d{3}(?:\.\d{1,2})?)\s+and\s+bounced",
            r"([4-8]\d{3}(?:\.\d{1,2})?)\s+(?:recovery|reclaim)\s+starts",
            r"daily\s+low(?:\s+at|\s+of)?\s+([4-8]\d{3}(?:\.\d{1,2})?)",
            r"significant\s+low\s+(?:at\s+)?([4-8]\d{3}(?:\.\d{1,2})?)",
        ],
        "swept_lost_low": [
            r"down\s+to\s+([4-8]\d{3}(?:\.\d{1,2})?)",
            r"swept\s+(?:it|that\s+low|this|the\s+[^\d]{0,30})?\s*(?:down\s+)?(?:to\s+)?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"flush(?:ed|es)?\s+(?:that\s+low|it|this|[^\d]{0,30})?\s*(?:down\s+)?(?:to\s+)?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"lost\s+(?:the\s+)?(?:[^\d]{0,40})?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"sold\s+(?:down\s+)?to\s+([4-8]\d{3}(?:\.\d{1,2})?)",
        ],
        "recovered_level": [
            r"recovered\s+(?:that\s+|the\s+)?([4-8]\d{3}(?:\.\d{1,2})?)\s+(?:shelf|low|level)?",
            r"recovered\s+(?:a\s+|the\s+)?[^.]{0,80}?\b(?:low|shelf|level)(?:\s+set)?[^.]{0,40}?\s+at\s+([4-8]\d{3}(?:\.\d{1,2})?)",
            r"reclaim(?:ed|s|ing)?\s+(?:the\s+)?(?:significant\s+low\s*)?\(?([4-8]\d{3}(?:\.\d{1,2})?)\)?",
        ],
        "non_acceptance_threshold": [
            r"by\s+5\s+points\s*\(?([4-8]\d{3}(?:\.\d{1,2})?)\)?",
            r"5\s+points\s*\(?([4-8]\d{3}(?:\.\d{1,2})?)\)?",
        ],
        "invalidation": [
            r"invalid(?:ation|ate|ates|ated)?\s+(?:is\s+|at\s+|below\s+|above\s+)?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"fails?\s+(?:below|above)\s+([4-8]\d{3}(?:\.\d{1,2})?)",
            r"failure\s+(?:below|above)\s+([4-8]\d{3}(?:\.\d{1,2})?)",
        ],
        "target_or_response": [
            r"(?:ripped|ran|squeezed|rally|rallied|push(?:ed)?)\s+(?:to|into|higher\s+to)\s+~?([4-8]\d{3}(?:\.\d{1,2})?)",
            r"targets?\s+(?:are\s+)?([4-8]\d{3}(?:\.\d{1,2})?)",
        ],
    }
    roles: dict[str, list[float]] = {key: [] for key in role_patterns}
    for role, patterns in role_patterns.items():
        seen: set[float] = set()
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                value = float(match.group(1))
                if value not in seen:
                    seen.add(value)
                    roles[role].append(value)
    return roles


def classify_price_roles(text: str, roles: dict[str, list[float]]) -> list[dict[str, Any]]:
    role_order = (
        "actual_setup_level",
        "swept_lost_low",
        "recovered_level",
        "non_acceptance_threshold",
        "invalidation",
        "target_or_response",
    )
    classified: list[dict[str, Any]] = []
    for value in prices(text):
        matched = [
            role
            for role in role_order
            if any(abs(value - role_value) <= 0.25 for role_value in roles.get(role, []))
        ]
        if not matched:
            matched = ["current_price_context"]
        classified.append(
            {
                "level": value,
                "roles": matched,
                "support_list_only": False,
            }
        )
    return classified


def context_lines(article: Article, lines: list[str], line_number: int) -> dict[str, Any]:
    support_rows = []
    resistance_rows = []
    prose_rows = []
    for number in range(article.start, article.end + 1):
        text = lines[number - 1].strip()
        lowered = text.lower()
        if lowered.startswith("supports are"):
            support_rows.append({"line": number, "text": clean(text), "zones": zones_from_text(text)})
        elif lowered.startswith("resistances are"):
            resistance_rows.append({"line": number, "text": clean(text), "zones": zones_from_text(text)})
        elif any(
            marker in lowered
            for marker in (
                "support",
                "resistance",
                "shelf",
                "daily low",
                "today's low",
                "yesterday's low",
                "friday's low",
                "monday's low",
                "major low",
                "significant low",
                "opening low",
                "low which held",
                "low at",
                "range",
                "bull case",
                "bear case",
                "summary",
            )
        ):
            if abs(number - line_number) <= 20 or any(term in lowered for term in ("bull case", "bear case", "summary")):
                prose_rows.append({"line": number, "text": clean(text), "zones": zones_from_text(text)})
    return {"supports": support_rows, "resistances": resistance_rows, "prose": prose_rows}


def sr_coincidence(levels: list[float], context: dict[str, Any]) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    for level in levels:
        hits = []
        for kind in ("supports", "resistances", "prose"):
            for row in context[kind]:
                for zone in row["zones"]:
                    if level_in_zone(level, zone):
                        hits.append({"kind": kind[:-1] if kind.endswith("s") else kind, "line": row["line"], "zone": zone["text"]})
                        break
        if any(hit["kind"] == "support" for hit in hits):
            status = "coincides_cleanly"
        elif hits:
            status = "coincides_partially"
        else:
            status = "does_not_coincide"
        checks.append({"level": level, "status": status, "matches": hits[:8]})
    return checks


def load_visual_audit() -> dict[str, dict[str, Any]]:
    if not VISUAL_AUDIT.exists():
        return {}
    try:
        data = json.loads(VISUAL_AUDIT.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {
        row.get("packet_id"): row
        for row in data.get("rows", [])
        if row.get("packet_id")
    }


def load_rows() -> tuple[list[dict[str, str]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    if not ROWS_CSV.exists():
        return [], {}, load_visual_audit()
    with ROWS_CSV.open("r", newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    manifest: dict[str, dict[str, Any]] = {}
    if GALLERY_MANIFEST.exists():
        for item in json.loads(GALLERY_MANIFEST.read_text(encoding="utf-8")):
            packet_id = item.get("packet_id")
            if packet_id:
                manifest[packet_id] = item
    return rows, manifest, load_visual_audit()


def parse_iso_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10])
    except ValueError:
        return None


def chart_matches(
    levels: list[float],
    article: Article,
    source_line: str,
    rows: list[dict[str, str]],
    manifest: dict[str, dict[str, Any]],
    visual_audit: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if not levels:
        return []
    plan = parse_iso_date(article.plan_date)
    pub = parse_iso_date(article.pub_date)
    matched = []
    for row in rows:
        level = as_float(row.get("level"))
        if level is None or not any(abs(level - candidate) <= 0.25 for candidate in levels):
            continue
        row_dt = parse_iso_date(row.get("source_timestamp_et"))
        date_distance = None
        if row_dt and plan:
            date_distance = abs((row_dt - plan).days)
        elif row_dt and pub:
            date_distance = abs((row_dt - pub).days)
        if date_distance is not None and date_distance > 7:
            continue
        overlap = text_overlap_score(source_line, row.get("source_label") or "")
        if overlap < 6:
            continue
        packet_id = row.get("packet_id") or ""
        item = manifest.get(packet_id, {})
        visual = visual_audit.get(packet_id, {})
        metrics = window_metrics(row.get("window_csv"), level)
        matched.append(
            {
                "packet_id": packet_id,
                "level": level,
                "source_timestamp_et": row.get("source_timestamp_et"),
                "source_label": clean(row.get("source_label") or "", 180),
                "source_text_overlap": overlap,
                "trigger_validation_status": row.get("trigger_validation_status"),
                "source_setup_evidence_status": row.get("source_setup_evidence_status"),
                "visual_sanity_status": visual.get("status"),
                "visual_sanity_reasons": visual.get("reasons") or [],
                "visual_sanity_cautions": visual.get("caution_notes") or [],
                "chart_path": item.get("chart_path"),
                "png_path": item.get("png_path"),
                "window_csv": row.get("window_csv"),
                "window_metrics": metrics,
            }
        )
    return matched[:12]


def text_overlap_score(left: str, right: str) -> int:
    stop = {
        "the", "and", "that", "this", "with", "from", "there", "then", "after",
        "before", "into", "today", "tomorrow", "yesterday", "failed", "breakdown",
        "recover", "recovered", "level", "levels", "support", "supports", "price",
        "mancini", "around", "would", "could", "should",
    }
    def terms(text: str) -> set[str]:
        out = set()
        for word in re.findall(r"[a-zA-Z0-9.]+", text.lower()):
            if len(word) < 3 or word in stop:
                continue
            out.add(word)
        return out
    lt = terms(left)
    rt = terms(right)
    # Numeric terms are more important than prose terms for these source rows.
    numeric_overlap = {term for term in lt & rt if re.fullmatch(r"\d{3,4}(?:\.\d+)?", term)}
    word_overlap = (lt & rt) - numeric_overlap
    return len(numeric_overlap) * 2 + len(word_overlap)


def as_float(value: Any) -> float | None:
    try:
        out = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def window_metrics(window_csv: str | None, level: float) -> dict[str, Any] | None:
    if not window_csv:
        return None
    path = ROOT / window_csv
    if not path.exists():
        return None
    with path.open("r", newline="", encoding="utf-8") as handle:
        bars = list(csv.DictReader(handle))
    if not bars:
        return None
    parsed = []
    for row in bars:
        low = as_float(row.get("low"))
        close = as_float(row.get("close"))
        high = as_float(row.get("high"))
        if low is None or close is None or high is None:
            continue
        parsed.append({"timestamp": row.get("timestamp_et"), "low": low, "high": high, "close": close})
    if not parsed:
        return None
    trap_index = min(range(len(parsed)), key=lambda idx: parsed[idx]["low"])
    trap = parsed[trap_index]
    reclaim_index = next((idx for idx in range(trap_index, len(parsed)) if parsed[idx]["close"] > level), None)
    threshold = level + 5
    threshold_index = next((idx for idx in range(trap_index, len(parsed)) if parsed[idx]["close"] >= threshold), None)
    hold = 0
    if reclaim_index is not None:
        for row in parsed[reclaim_index:]:
            if row["close"] > level:
                hold += 1
            else:
                break
    threshold_hold = 0
    if threshold_index is not None:
        for row in parsed[threshold_index:]:
            if row["close"] >= threshold:
                threshold_hold += 1
            else:
                break
    return {
        "bar_count": len(parsed),
        "trap_low": trap["low"],
        "trap_timestamp_et": trap["timestamp"],
        "flush_points": round(level - trap["low"], 2),
        "first_reclaim_close_timestamp_et": parsed[reclaim_index]["timestamp"] if reclaim_index is not None else None,
        "reclaim_hold_closes": hold,
        "non_acceptance_threshold": threshold,
        "first_threshold_close_timestamp_et": parsed[threshold_index]["timestamp"] if threshold_index is not None else None,
        "threshold_hold_closes": threshold_hold,
        "invalidation_low_minus_tick": round(trap["low"] - 0.25, 2),
    }


def session_availability(article: Article) -> list[str]:
    dates: set[str] = set()
    for value in (article.pub_date, article.plan_date):
        dt = parse_iso_date(value)
        if dt:
            for delta in range(-4, 2):
                dates.add((dt + timedelta(days=delta)).strftime("%Y-%m-%d"))
    return sorted(date for date in dates if (SESSIONS_DIR / f"{date}.json").exists())


def candidate_dates(article: Article) -> list[str]:
    dates: set[str] = set()
    for value in (article.pub_date, article.plan_date):
        dt = parse_iso_date(value)
        if not dt:
            continue
        for delta in range(-5, 2):
            dates.add((dt + timedelta(days=delta)).strftime("%Y-%m-%d"))
    return sorted(dates)


def load_session_bars(date: str) -> list[dict[str, Any]]:
    path = SESSIONS_DIR / f"{date}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    bars = (((data or {}).get("bars") or {}).get("es") or [])
    return [bar for bar in bars if all(key in bar for key in ("timestamp", "low", "high", "close"))]


def scan_session_for_setup(
    article: Article,
    setup_levels: list[float],
    swept_lows: list[float],
) -> list[dict[str, Any]]:
    if len(setup_levels) != 1:
        return []
    level = setup_levels[0]
    stated_sweeps = [low for low in swept_lows if level - low >= 0.25]
    candidates: list[dict[str, Any]] = []
    for date in candidate_dates(article):
        bars = load_session_bars(date)
        if not bars:
            continue
        for trap_index, bar in enumerate(bars):
            low = as_float(bar.get("low"))
            if low is None or low > level - 0.25:
                continue
            if stated_sweeps and not any(abs(low - sweep) <= 1.5 for sweep in stated_sweeps):
                continue
            reclaim_index = None
            for idx in range(trap_index + 1, min(len(bars), trap_index + 360)):
                close = as_float(bars[idx].get("close"))
                if close is not None and close > level:
                    reclaim_index = idx
                    break
            if reclaim_index is None:
                continue
            threshold = level + 5
            threshold_hold = 0
            threshold_index = None
            for idx in range(reclaim_index, min(len(bars), reclaim_index + 30)):
                close = as_float(bars[idx].get("close"))
                if close is not None and close >= threshold:
                    threshold_index = idx
                    for item in bars[idx: min(len(bars), idx + 30)]:
                        item_close = as_float(item.get("close"))
                        if item_close is not None and item_close >= threshold:
                            threshold_hold += 1
                        else:
                            break
                    break
            score = 0.0
            if stated_sweeps:
                score += max(0.0, 10.0 - min(abs(low - sweep) for sweep in stated_sweeps))
            score += min(10.0, max(0.0, level - low))
            score += min(5.0, threshold_hold)
            candidates.append(
                {
                    "session_date": date,
                    "setup_level": level,
                    "trap_timestamp_et": bar.get("timestamp"),
                    "trap_low": low,
                    "flush_points": round(level - low, 2),
                    "first_reclaim_close_timestamp_et": bars[reclaim_index].get("timestamp"),
                    "non_acceptance_threshold": threshold,
                    "first_threshold_close_timestamp_et": bars[threshold_index].get("timestamp") if threshold_index is not None else None,
                    "threshold_hold_closes": threshold_hold,
                    "crop_instruction": f"render ES 1m from {bar.get('timestamp')} minus 60 minutes through {bars[reclaim_index].get('timestamp')} plus 90 minutes",
                    "score": round(score, 2),
                }
            )
    candidates.sort(key=lambda item: (-item["score"], item["session_date"], item["trap_timestamp_et"] or ""))
    return candidates[:3]


def source_verdict(
    line: str,
    mode: str,
    roles: dict[str, list[float]],
    coincidence: list[dict[str, Any]],
    charts: list[dict[str, Any]],
) -> str:
    lowered = line.lower()
    if any(marker in lowered for marker in NEGATIVE_MARKERS):
        return "negative_control"
    if lowered.startswith("supports are") or lowered.startswith("resistances are"):
        return "reject"
    if not roles["actual_setup_level"]:
        return "data_only"
    if mode in {"methodology_definition", "planned_setup"}:
        return "needs_bigger_crop"
    if mode != "actual_recap":
        return "data_only"
    if len(roles["actual_setup_level"]) != 1:
        return "needs_bigger_crop"
    if not coincidence or all(item["status"] == "does_not_coincide" for item in coincidence):
        return "needs_bigger_crop"
    if not charts:
        return "needs_bigger_crop"
    setup_level = roles["actual_setup_level"][0]
    stated_sweep_lows = [
        value for value in roles.get("swept_lost_low", []) if setup_level - value >= 0.25
    ]
    if not stated_sweep_lows:
        return "needs_bigger_crop"
    matching_windows = []
    for match in charts:
        visual_status = match.get("visual_sanity_status")
        if visual_status and visual_status != "training_candidate":
            continue
        metrics = match.get("window_metrics") or {}
        if not metrics.get("first_reclaim_close_timestamp_et"):
            continue
        if (metrics.get("flush_points") or 0) < 0.25:
            continue
        if stated_sweep_lows:
            trap_low = metrics.get("trap_low")
            if trap_low is None or not any(abs(float(trap_low) - low) <= 1.0 for low in stated_sweep_lows):
                continue
        matching_windows.append(match)
    if matching_windows:
        return "positive_training_candidate"
    return "data_only"


def source_blockers(
    line: str,
    mode: str,
    roles: dict[str, list[float]],
    coincidence: list[dict[str, Any]],
    charts: list[dict[str, Any]],
) -> list[str]:
    lowered = line.lower()
    blockers: list[str] = []
    if any(marker in lowered for marker in NEGATIVE_MARKERS):
        return ["source_marks_no_trigger_or_non_fbd"]
    if lowered.startswith("supports are") or lowered.startswith("resistances are"):
        return ["support_resistance_list_only"]
    setup_levels = roles.get("actual_setup_level") or []
    if not setup_levels:
        blockers.append("no_actual_setup_level_extracted")
        return blockers
    if mode in {"methodology_definition", "planned_setup"}:
        blockers.append(f"source_mode_{mode}")
    elif mode != "actual_recap":
        blockers.append(f"source_mode_{mode}")
    if len(setup_levels) != 1:
        blockers.append("multi_setup_row_split_required")
    if not coincidence or all(item["status"] == "does_not_coincide" for item in coincidence):
        blockers.append("setup_level_does_not_coincide_with_sr_or_prose_context")
    if not charts:
        blockers.append("no_existing_chart_window_match")
    if len(setup_levels) == 1:
        setup_level = setup_levels[0]
        stated_sweep_lows = [
            value for value in roles.get("swept_lost_low", []) if setup_level - value >= 0.25
        ]
        if not stated_sweep_lows:
            blockers.append("no_source_stated_swept_low_below_setup")
        for match in charts:
            visual_status = match.get("visual_sanity_status")
            if visual_status and visual_status != "training_candidate":
                blockers.append(f"visual_sanity_{visual_status}")
            metrics = match.get("window_metrics") or {}
            if not metrics.get("first_reclaim_close_timestamp_et"):
                blockers.append("chart_missing_reclaim_close")
            if (metrics.get("flush_points") or 0) < 0.25:
                blockers.append("chart_missing_tick_sweep")
            if stated_sweep_lows and metrics.get("trap_low") is not None:
                trap_low = float(metrics["trap_low"])
                if not any(abs(trap_low - low) <= 1.0 for low in stated_sweep_lows):
                    blockers.append(f"chart_trap_low_{trap_low}_mismatch_stated_sweep_{fmt_values(stated_sweep_lows)}")
            elif stated_sweep_lows:
                blockers.append("chart_missing_trap_low")
    return sorted(set(blockers))


def build_audit() -> list[dict[str, Any]]:
    rows, manifest, visual_audit = load_rows()
    audit: list[dict[str, Any]] = []
    for path in RAW_FILES:
        if not path.exists():
            continue
        lines = read_lines(path)
        articles = detect_articles(path, lines)
        for line_number, line in enumerate(lines, start=1):
            if not direct_candidate(line, path):
                continue
            article = article_for_line(articles, line_number)
            context = context_lines(article, lines, line_number)
            roles = extract_roles(line)
            actual_levels = roles["actual_setup_level"]
            coincidence = sr_coincidence(actual_levels, context)
            charts = chart_matches(actual_levels + roles["non_acceptance_threshold"], article, line, rows, manifest, visual_audit)
            mode = line_mode(line, path)
            session_scan = scan_session_for_setup(article, actual_levels, roles["swept_lost_low"])
            verdict = source_verdict(line, mode, roles, coincidence, charts)
            blockers = source_blockers(line, mode, roles, coincidence, charts)
            audit.append(
                {
                    "raw_file": rel(path),
                    "line": line_number,
                    "mode": mode,
                    "article_title": article.title,
                    "plan_date": article.plan_date,
                    "pub_date": article.pub_date,
                    "snippet": clean(line),
                    "time_mentions": time_mentions(line),
                    "levels": roles,
                    "level_role_map": classify_price_roles(line, roles),
                    "support_context": [
                        {"line": row["line"], "text": row["text"]}
                        for row in sorted(context["supports"], key=lambda row: abs(row["line"] - line_number))[:3]
                    ],
                    "resistance_context": [
                        {"line": row["line"], "text": row["text"]}
                        for row in sorted(context["resistances"], key=lambda row: abs(row["line"] - line_number))[:3]
                    ],
                    "prose_context": [
                        {"line": row["line"], "text": row["text"]}
                        for row in sorted(context["prose"], key=lambda row: abs(row["line"] - line_number))[:4]
                    ],
                    "sr_coincidence": coincidence,
                    "chart_matches": charts,
                    "session_scan": session_scan,
                    "session_files_available": session_availability(article),
                    "verdict": verdict,
                    "blockers": blockers,
                }
            )
    return audit


def fmt_values(values: list[Any] | None) -> str:
    if not values:
        return "none"
    return ", ".join(str(value) for value in values)


def chronological_key(item: dict[str, Any]) -> tuple[str, str, int]:
    date = item.get("plan_date") or item.get("pub_date") or "9999-99-99"
    return (date, item.get("raw_file") or "", int(item.get("line") or 0))


def item_date(item: dict[str, Any]) -> str:
    return item.get("plan_date") or item.get("pub_date") or "undated"


def sr_summary(item: dict[str, Any]) -> str:
    checks = item.get("sr_coincidence") or []
    if not checks:
        return "none"
    chunks = []
    for check in checks:
        matches = check.get("matches") or []
        if matches:
            first = matches[0]
            chunks.append(
                f"{check.get('level')} {check.get('status')} via {first.get('kind')} L{first.get('line')} {first.get('zone')}"
            )
        else:
            chunks.append(f"{check.get('level')} {check.get('status')}")
    return "; ".join(chunks)


def level_role_summary(item: dict[str, Any]) -> str:
    levels = item.get("level_role_map") or []
    if not levels:
        return "none"
    return "; ".join(
        f"{entry.get('level')}={'+'.join(entry.get('roles') or ['current_price_context'])}"
        for entry in levels
    )


def chart_or_crop_summary(item: dict[str, Any]) -> str:
    charts = item.get("chart_matches") or []
    setup_levels = item.get("levels", {}).get("actual_setup_level") or []
    if len(setup_levels) > 1:
        if charts:
            matches = "; ".join(
                f"{match.get('level')}:{match.get('chart_path') or match.get('window_csv') or match.get('packet_id')} visual={match.get('visual_sanity_status') or 'not_audited'}"
                for match in charts[:4]
            )
            return f"multi-level split required; local matches by level only: {matches}"
        return "multi-level split required; crop each stated setup level separately"
    if charts:
        first = charts[0]
        metrics = first.get("window_metrics") or {}
        chart = first.get("chart_path") or first.get("window_csv") or first.get("packet_id") or "matched"
        bits = [str(chart)]
        if metrics:
            bits.append(f"trap={metrics.get('trap_low')}")
            bits.append(f"reclaim={metrics.get('first_reclaim_close_timestamp_et')}")
            bits.append(f"threshold_hold={metrics.get('threshold_hold_closes')}")
        if first.get("visual_sanity_status"):
            bits.append(f"visual={first.get('visual_sanity_status')}")
            reasons = first.get("visual_sanity_reasons") or []
            if reasons:
                bits.append(f"visual_reasons={','.join(str(reason) for reason in reasons[:3])}")
        bits.append(f"overlap={first.get('source_text_overlap')}")
        return " ".join(bits)
    scan = item.get("session_scan") or []
    if scan:
        best = scan[0]
        return (
            f"session scan crop: {best.get('crop_instruction')}; "
            f"trap={best.get('trap_low')}; "
            f"reclaim={best.get('first_reclaim_close_timestamp_et')}; "
            f"score={best.get('score')}"
        )
    available = ", ".join((item.get("session_files_available") or [])[:8]) or "none"
    source_times = ", ".join(item.get("time_mentions") or []) or "none"
    return f"crop required from ES 1m around source time; source_times={source_times}; nearby_sessions={available}"


def context_summary(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "none"
    return "; ".join(f"L{row['line']}: {row['text']}" for row in rows[:2])


def write_markdown(audit: list[dict[str, Any]], path: Path) -> None:
    verdict_counts: dict[str, int] = {}
    for item in audit:
        verdict_counts[item["verdict"]] = verdict_counts.get(item["verdict"], 0) + 1
    lines = [
        "# Mancini Direct Failed-Breakdown Source Audit",
        "",
        "Generated: 2026-05-12",
        "",
        "Scope: raw-source review only. No trading authority. No Ninja/shadow trigger promotion.",
        "",
        "Quant gate used here:",
        "- direct raw passage must identify failed-breakdown style price action, not only a support/resistance row",
        "- actual setup level must coincide with same-plan support/resistance/prose context",
        "- existing ES 1m window, when available, must show a sweep below level and reclaim close above level",
        "- existing visual sanity audit must mark a matched chart as training_candidate before this report can mark a row positive",
        "- non-acceptance is treated as source-confirmation only when source states +5 and local window can show the threshold hold",
        "- support-list-only rows stay rejected unless tied to explicit flush/recover language",
        "",
        "## Verdict Counts",
        "",
    ]
    for verdict, count in sorted(verdict_counts.items()):
        lines.append(f"- `{verdict}`: {count}")
    lines.extend(["", "## Strict Positive Groups", ""])
    groups: dict[tuple[tuple[float, ...], str], list[dict[str, Any]]] = {}
    for item in audit:
        if item["verdict"] != "positive_training_candidate":
            continue
        key = (
            tuple(item["levels"].get("actual_setup_level") or []),
            item["chart_matches"][0].get("chart_path") if item["chart_matches"] else "",
        )
        groups.setdefault(key, []).append(item)
    if not groups:
        lines.append("No strict positive groups passed.")
    for (levels, chart_path), rows in groups.items():
        first = rows[0]
        source_refs = ", ".join(f"{row['raw_file']}:{row['line']}" for row in rows)
        sr = "; ".join(f"{x['level']}={x['status']}" for x in first["sr_coincidence"]) or "none"
        metrics = first["chart_matches"][0].get("window_metrics") if first["chart_matches"] else None
        metric_text = "no-window"
        if metrics:
            metric_text = (
                f"trap_low={metrics.get('trap_low')}; "
                f"flush_points={metrics.get('flush_points')}; "
                f"reclaim={metrics.get('first_reclaim_close_timestamp_et')}; "
                f"threshold={metrics.get('non_acceptance_threshold')}; "
                f"threshold_hold={metrics.get('threshold_hold_closes')}"
            )
        lines.extend(
            [
                f"- levels={', '.join(str(level) for level in levels)} | rows={len(rows)} | S/R={sr}",
                f"  source_refs={source_refs}",
                f"  chart={chart_path or 'none'}",
                f"  metrics={metric_text}",
            ]
        )
    lines.extend(["", "## Direct Passage Rows", ""])
    for item in audit:
        setup = ", ".join(str(x) for x in item["levels"].get("actual_setup_level") or []) or "none"
        sweep = ", ".join(str(x) for x in item["levels"].get("swept_lost_low") or []) or "none"
        recovered = ", ".join(str(x) for x in item["levels"].get("recovered_level") or []) or "none"
        threshold = ", ".join(str(x) for x in item["levels"].get("non_acceptance_threshold") or []) or "none"
        invalidation = ", ".join(str(x) for x in item["levels"].get("invalidation") or []) or "none"
        target = ", ".join(str(x) for x in item["levels"].get("target_or_response") or []) or "none"
        sr = "; ".join(f"{x['level']}={x['status']}" for x in item["sr_coincidence"]) or "none"
        chart = "none"
        if item["chart_matches"]:
            chart = chart_or_crop_summary(item)
        lines.extend(
            [
                f"### {item['raw_file']}:{item['line']} `{item['verdict']}`",
                "",
                f"- Context: {item['article_title']} | pub={item['pub_date']} | plan={item['plan_date']}",
                f"- Source mode: {item['mode']}",
                f"- Levels: setup={setup}; swept/lost={sweep}; recovered={recovered}; non_acceptance={threshold}; invalidation={invalidation}; target/response={target}",
                f"- Level roles: {level_role_summary(item)}",
                f"- Time mentions: {', '.join(item.get('time_mentions') or []) or 'none'}",
                f"- S/R coincidence: {sr}",
                f"- Chart/window: {chart}",
                f"- Blockers: {fmt_values(item.get('blockers'))}",
                f"- Source: {item['snippet']}",
            ]
        )
        if item["support_context"]:
            ctx = "; ".join(f"line {row['line']}: {row['text']}" for row in item["support_context"][:1])
            lines.append(f"- Nearest support context: {ctx}")
        if item["resistance_context"]:
            ctx = "; ".join(f"line {row['line']}: {row['text']}" for row in item["resistance_context"][:1])
            lines.append(f"- Nearest resistance context: {ctx}")
        if not item["chart_matches"]:
            avail = ", ".join(item["session_files_available"][:8]) or "none"
            scan = item.get("session_scan") or []
            if scan:
                best = scan[0]
                lines.append(
                    "- Required crop: "
                    f"{best.get('crop_instruction')}; "
                    f"trap_low={best.get('trap_low')}; reclaim={best.get('first_reclaim_close_timestamp_et')}"
                )
            else:
                lines.append(f"- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: {avail}")
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def write_chronological_ledger(audit: list[dict[str, Any]], path: Path) -> None:
    sorted_rows = sorted(audit, key=chronological_key)
    verdict_counts: dict[str, int] = {}
    for item in sorted_rows:
        verdict_counts[item["verdict"]] = verdict_counts.get(item["verdict"], 0) + 1
    lines = [
        "# Mancini FBD Chronological Source Ledger",
        "",
        "Generated: 2026-05-12",
        "",
        "Chronological, source-first ledger of raw Mancini passages that directly mention failed-breakdown style price action. Broad support/resistance rows are excluded as examples and only used as context checks. Review/shadow/replay only.",
        "",
        "## Counts",
        "",
        f"- rows: {len(sorted_rows)}",
    ]
    for verdict, count in sorted(verdict_counts.items()):
        lines.append(f"- `{verdict}`: {count}")
    current_date = None
    for item in sorted_rows:
        date = item_date(item)
        if date != current_date:
            lines.extend(["", f"## {date}", ""])
            current_date = date
        levels = item["levels"]
        lines.extend(
            [
                f"### {item['raw_file']}:{item['line']} `{item['verdict']}`",
                "",
                f"- Plan/date context: {item['article_title']} | pub={item['pub_date']} | plan={item['plan_date']}",
                f"- Source mode: {item['mode']}",
                f"- Exact levels: setup={fmt_values(levels.get('actual_setup_level'))}; swept/lost={fmt_values(levels.get('swept_lost_low'))}; recovered={fmt_values(levels.get('recovered_level'))}; non_acceptance={fmt_values(levels.get('non_acceptance_threshold'))}; invalidation={fmt_values(levels.get('invalidation'))}; target/response={fmt_values(levels.get('target_or_response'))}",
                f"- Level roles: {level_role_summary(item)}",
                f"- S/R sanity: {sr_summary(item)}",
                f"- ES 1m window/chart: {chart_or_crop_summary(item)}",
                f"- Blockers: {fmt_values(item.get('blockers'))}",
                f"- Support context: {context_summary(item.get('support_context') or [])}",
                f"- Resistance context: {context_summary(item.get('resistance_context') or [])}",
                f"- Verdict: {item['verdict']}",
                f"- Raw passage: {item['snippet']}",
                "",
            ]
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def write_chronological_checklist(audit: list[dict[str, Any]], path: Path) -> None:
    sorted_rows = sorted(audit, key=chronological_key)
    positives = [item for item in sorted_rows if item["verdict"] == "positive_training_candidate"]
    crop_needed = [item for item in sorted_rows if item["verdict"] == "needs_bigger_crop"]
    negatives = [item for item in sorted_rows if item["verdict"] == "negative_control"]
    lines = [
        "# Mancini FBD Chronological Canonical Checklist",
        "",
        "Generated: 2026-05-12",
        "",
        "Working checklist in chronological order. A row is not a Ninja/shadow trigger unless the source role and price-action window both pass. Review/shadow/replay only.",
        "",
        f"Rows: {len(sorted_rows)}",
        f"Strict positives: {len(positives)}",
        f"Needs bigger crop: {len(crop_needed)}",
        f"Negative controls: {len(negatives)}",
        "",
    ]
    current_date = None
    for item in sorted_rows:
        date = item_date(item)
        if date != current_date:
            lines.extend([f"## {date}", ""])
            current_date = date
        levels = item["levels"]
        ref = f"{item['raw_file']}:{item['line']}"
        source_times = ", ".join(item.get("time_mentions") or []) or "none"
        lines.extend(
            [
                f"- `{item['verdict']}` {ref}",
                f"  - context: {item['article_title']} | pub={item['pub_date']} | plan={item['plan_date']} | mode={item['mode']}",
                f"  - levels: setup={fmt_values(levels.get('actual_setup_level'))}; swept/lost={fmt_values(levels.get('swept_lost_low'))}; recovered={fmt_values(levels.get('recovered_level'))}; +5={fmt_values(levels.get('non_acceptance_threshold'))}; invalidation={fmt_values(levels.get('invalidation'))}; target={fmt_values(levels.get('target_or_response'))}; source_times={source_times}",
                f"  - roles: {level_role_summary(item)}",
                f"  - S/R: {sr_summary(item)}",
                f"  - ES 1m: {chart_or_crop_summary(item)}",
                f"  - blockers: {fmt_values(item.get('blockers'))}",
                f"  - source: {item['snippet']}",
                "",
            ]
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-json", default=str(OUT_JSON))
    parser.add_argument("--out-md", default=str(OUT_MD))
    parser.add_argument("--out-ledger", default=str(OUT_LEDGER))
    parser.add_argument("--out-checklist", default=str(OUT_CHECKLIST))
    args = parser.parse_args()
    audit = build_audit()
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_ledger = Path(args.out_ledger)
    out_checklist = Path(args.out_checklist)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    write_markdown(audit, out_md)
    write_chronological_ledger(audit, out_ledger)
    write_chronological_checklist(audit, out_checklist)
    print(
        json.dumps(
            {
                "rows": len(audit),
                "out_json": rel(out_json),
                "out_md": rel(out_md),
                "out_ledger": rel(out_ledger),
                "out_checklist": rel(out_checklist),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
