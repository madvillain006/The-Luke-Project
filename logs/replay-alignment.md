# Phase 1.4 — Replay Alignment Report
**Date:** 2026-04-20  
**Input:** discord-history.jsonl (first 100 JSONL lines → 128 scroll-results)  
**Parser:** lib/parse-signal.js → parseSignal(insights, source)

---

## Counts

| Metric | Value |
|---|---|
| Scroll-results parsed | 128 |
| passToPipeline = true | **1 (0.8%)** |
| passToPipeline = false | 127 (99.2%) |

### Confidence Breakdown
| Level | Count |
|---|---|
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 127 |

### Bias Breakdown
| Bias | Count |
|---|---|
| LONG | 52 |
| SHORT | 24 |
| NEUTRAL | 23 |
| null (no bias) | 29 |

### Missing Level (null)
**91 of 128 entries (71%)** have `level = null`

---

## Root Cause: Why Everything Is Failing

### Bug 1 — Markdown bold formatting breaks regex (PRIMARY)
Haiku frequently outputs bold labels: `**LEVEL/STRIKE:** 22,491`  
The `parseLevel` regex is `LEVEL(?:\/STRIKE)?\s*:\s*([\d,]+...)` which requires whitespace after `:`.  
The bold closing `:**` means the value is preceded by `** ` not just ` ` — the `\s*` after `:` fails to skip `**`.

Same issue hits `parseConfidence` when Haiku writes `**CONVICTION:** MEDIUM` — the `:**` breaks that regex too.

**Evidence:** The 1 passing entry used plain text format without bold (`LEVEL/STRIKE: 22,491`). All bold-formatted entries produced level=null.

### Bug 2 — Non-numeric levels correctly return null, then trigger downgrade
Entries like `LEVEL/STRIKE: "Tight pink box"` or `LEVEL/STRIKE: $47 CALL` cannot be parsed as numbers.  
This is correct behavior — but since `level === null`, the confidence downgrade rule kicks in and overrides any valid CONVICTION value.

### Bug 3 — Confidence downgrade is a one-way gate
Rule: if `!bias || level === null || !confidence` → force `confidence = 'LOW'`  
This means a signal with `DIRECTION: LONG, CONVICTION: HIGH` but no numeric level is permanently blocked. Fully valid directional calls with option strike descriptions (e.g., `$47 CALL`) score as LOW and never reach the pipeline.

---

## 3 Worst Parse Failures

### Failure 1 — CONVICTION present, level is descriptive text
**Source:** Base#positions  
**Raw:** `DIRECTION: NEUTRAL (range-bound) | LEVEL/STRIKE: "Tight pink box" range | CONVICTION: MEDIUM`  
**Parsed:** `bias=NEUTRAL, level=null, confidence=LOW, passToPipeline=false`  
**Why it failed:** Level is a qualitative description, not a number. Parser returns null, triggers LOW downgrade, blocks pipeline despite valid bias + conviction.

### Failure 2 — Haiku bold formatting blocks all fields
**Source:** Base#spx-ndx-futures  
**Raw:** `**DIRECTION:** LONG | **LEVEL/STRIKE:** 22,491 (support zone) | **CONVICTION:** MEDIUM`  
**Parsed:** `bias=LONG, level=null, confidence=LOW, passToPipeline=false`  
**Why it failed:** `parseLevel` and `parseConfidence` regexes can't skip the bold markdown `**` suffix after `:`. Level and confidence both return null → LOW override.

### Failure 3 — Options strike notation not recognized as level
**Source:** Base#flow  
**Raw:** `DIRECTION: BULLISH | LEVEL/STRIKE: $47 CALL | CONVICTION: HIGH`  
**Parsed:** `bias=LONG, level=null, confidence=LOW, passToPipeline=false`  
**Why it failed:** `$47 CALL` doesn't match the numeric regex `[\d,]+(?:\.\d+)?` because of the `$` prefix. The dollar sign and trailing ` CALL` prevent extraction. A valid HIGH-conviction signal is killed.

---

## Verdict: NOT Fit for Replay As-Is

**Pass rate: 0.8% (1/128)** — effectively zero.

The data is present and contains real signals. The parser has two fixable bugs:

1. **Strip markdown bold before parsing** — add `text.replace(/\*\*/g, '')` at the top of `parseSignal`
2. **Handle dollar-prefixed strike notation** — update `parseLevel` to accept `\$?([\d,]+...)` 

Optional (bigger decision): reconsider whether a numeric level is required to pass the pipeline. Many valid directional signals (LONG/SHORT + HIGH conviction) from options flow lack a clean numeric level — requiring one blocks ~71% of entries before any other check runs.

**Recommended fix path:** Strip `**` in parseSignal → patch `$`-prefix in parseLevel → rerun this analysis. Expected pass rate should rise to 15–30% based on bias/conviction distribution.

---

*Written by Claude Code — phase 1.4 replay-alignment*
