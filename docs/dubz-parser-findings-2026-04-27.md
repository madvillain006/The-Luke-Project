# Dubz Parser Findings — 2026-04-27

**Produced by:** Sub-task 5a fixture validation harness  
**Harness:** `scripts/validate-dubz-fixtures.js`  
**Fixtures run:** 2 (April 26 + April 27)  
**Vision calls:** 7 / 7 succeeded  
**Branch:** phase-1b5

---

## 1. Executive Summary

Two Dubz fixture sets were run through the full parse pipeline (text → vision → merge) for the first time. The parsers handled both the April 26 bullet-style format and the April 27 narrative paragraph format without crashing, all 7 vision calls succeeded, and 0 `parse_errors` were raised by the pipeline. However, silent wrong-output conditions were found in both fixtures. The most critical is that the cross-source dedup logic in `mergeDubzInputs` allows the same price to appear twice in a merged instrument's level list when it was extracted by both text and vision — producing conflicting significance, direction, and source metadata with no conflict flag raised. A second blocking issue is that compound parallel attribution ("ES and SPY flipped 7185.75 & 712.38") causes the text parser to extract only the second instrument's level, silently dropping a confirmed key flip level for ES entirely. Both blocking bugs produce wrong output with no error signal, which is exactly the failure class Phase 2's correlation engine cannot tolerate.

---

## 2. What Worked

- **Instrument detection (vision):** All 7 vision calls returned the correct instrument. No mismatches between expected and detected instrument labels.
- **April 26 text parse:** NQ 26884.75 (key/flip), ES 7093.75 (key), QQQ 650, SPY 698.34 + 702.65 all extracted with correct price values.
- **April 27 text parse:** SPY 712.38 extracted as key/flip from "ES and SPY flipped 7185.75 & 712.38" — the SPY side of the compound sentence parsed correctly.
- **Significance detection:** `🔑` emoji correctly fired `sig=key` / `significance_signal=key_emoji` on NQ 26884.75 and ES 7093.75 (April 26) and SPY 712.38 (April 27). Language-based minor detection correctly fired on SPY 702.65 ("not a major level but likely actionable").
- **Intent detection:** `intent=long_retest` correctly populated on SPY 698.34 and 702.65 from "retest long" language.
- **Zone handling:** April 27 ES vision returned a 7100/7090 support zone; merge correctly split it into two entries with `zone_edge=top` and `zone_edge=bottom`.
- **Fail-open behavior:** No vision call crashed the harness. Pipeline continued across all images as designed.
- **No state corruption:** Harness produced zero writes to `data/dubz-levels.json` or `data/level-memory.json`.

---

## 3. Bugs Found

### BLOCKING

---

#### Bug #1 — Cross-source duplicate levels not deduplicated or conflict-flagged

**Severity:** Blocking — Phase 2 cannot start until fixed  
**File:** `lib/parse-dubz.js` → `mergeDubzInputs`

**Description:**  
`mergeDubzInputs` deduplicates levels within the same source (`l.source === 'text'` or `l.source === 'image'`), but does not deduplicate across sources. When text and vision both extract the same price for the same instrument, both entries survive into the final merged state. The `detectConflicts` function does not flag this condition. The result is silent duplicate entries with conflicting metadata (significance, direction, source) for the same price.

**Evidence — April 26 merged NQ:**
```
26884.75  sig=key    dir=flip     src=text   significance_signal=key_emoji
26884.75  sig=unclear dir=support  src=image  significance_signal=unstated
```

**Evidence — April 26 merged ES:**
```
7093.75   sig=key    dir=null     src=text   significance_signal=key_emoji
7093.75   sig=unclear dir=support  src=image  significance_signal=unstated
```

**Evidence — April 26 merged QQQ:**
```
650       sig=unclear dir=null     src=text
650       sig=unclear dir=support  src=image
```

**Evidence — April 27 merged SPY:**
```
712.38    sig=key    dir=flip      src=text   significance_signal=language
712.38    sig=unclear dir=resistance src=image significance_signal=unstated
```

**Impact on Phase 2:**  
A correlation engine iterating `instruments[instr].levels` will encounter two entries for the same price. If it aggregates significance scores, key levels will be double-counted. If it reads direction, it gets two contradictory values (flip vs support, null vs resistance) with no tiebreaker. No error is surfaced — the output is silently wrong.

**Fix direction (Sub-task 5b):**  
When merging image levels, check for an existing level within `±0.01` regardless of source. On collision, apply a promotion rule: preserve the text entry's significance/significance_signal/source_snippet, merge in the image entry's direction if the text entry's direction is null, and discard the image duplicate rather than creating a second row.

---

#### Bug #2 — Compound parallel attribution miss

**Severity:** Blocking — Phase 2 cannot start until fixed  
**File:** `lib/parse-dubz.js` → `parseDubzText`

**Description:**  
The text parser does not handle the pattern "INSTR_A and INSTR_B flipped PRICE_A & PRICE_B" where the two prices are listed sequentially after both instruments. The parser extracted the SPY side (712.38) correctly but silently dropped the ES side (7185.75). Zero ES levels appear in the April 27 text parse result, and zero errors were raised.

**Evidence — April 27 text input:**
```
ES and SPY flipped 7185.75 & 712.38 in this pre-market this morning
```

**Evidence — April 27 text parse output:**
```
ES: 0 levels
SPY: 1 level  (712.38, sig=key, dir=flip)
```

**Combined impact with Bug #3:**  
7185.75 is also misread by vision as 7190 (see Bug #3). The net result is that ES 7185.75 — explicitly named as a key flip level in the April 27 text — is completely absent from the final merged state in any form. A confirmed, named flip level produces zero output with no error raised.

**Fix direction (Sub-task 5b):**  
Add a regex pattern for the compound "INSTR_A and INSTR_B [flip verb] PRICE_A & PRICE_B" structure. The simplest approach is a pre-scan that detects the `and` conjunction between two instrument names and zips prices to instruments by position. This pattern also appears in April 27 as "ES/SPY levels" — both slash-separated and "and"-separated variants are in the corpus.

---

### IMPORTANT

---

#### Bug #3 — Vision rounded ES 7185.75 to 7190

**Severity:** Important — fix soon, not blocking Phase 2  
**File:** `lib/parse-dubz.js` → `parseDubzImage` (prompt)

**Description:**  
The April 27 ES vision call returned `7190.00` as the resistance level. The actual chart label is `7185.75` (confirmed by text). This is a 4.25-point / ~17-tick miss. The error is likely a combination of chart label density (small font, adjacent labels) and the vision model rounding to the nearest round number.

**Evidence:**
```
Vision returned:   7190.00  (resistance)
Text confirmed:    7185.75  (flip)
Delta:             +4.25 pts (~17 NQ-equivalent ticks)
```

**Impact:**  
Even if Bug #2 is fixed and the text parser extracts 7185.75, the cross-source dedup (Bug #1 fix) would compare 7185.75 vs 7190.00 — a delta of 4.25, outside the `±0.01` dedup threshold. Both would survive as separate entries, and 7185.75 would not be enriched by the image read. A looser dedup tolerance (e.g. `±1.0` for image-vs-text matching) could catch this class of rounding error, but requires careful calibration per instrument.

**Fix direction (Sub-task 5b):**  
Revise the vision prompt to explicitly instruct the model to read label text character-by-character rather than rounding, and to prefer `.25`/`.50`/`.75` endings over round numbers for futures contracts. Separately, consider a fuzzy match tolerance in cross-source dedup for image vs text comparisons.

---

### MINOR

---

#### Bug #4 — Null direction on text-extracted levels with implicit directional cues

**Severity:** Minor — deferred  
**File:** `lib/parse-dubz.js` → `parseDubzText`

**Description:**  
Several text-extracted levels have `direction: null` despite surrounding language implying directionality. April 26 ES 7093.75: surrounding text says "better for continuation longs than shorts." April 26 QQQ 650: no explicit direction, but positioned alongside key support levels. April 27 ES (if extracted): "flipped" implies a flip/support context.

**Impact:**  
Direction null is not wrong — it accurately reflects that no explicit direction token was present. However, it reduces Phase 2's ability to filter or weight levels by direction. This is a contextual NLP gap, not a parser logic error.

**Fix direction:**  
Not scoped for Sub-task 5b. Addressed when Phase 2's direction-weighting requirements are defined.

---

## 4. Phase 2 Design Surfaces Exposed

### Vision-only level volume vs text-mentioned level count

The April 26 fixture produced a significant asymmetry: text extracted 1 ES level and 1 QQQ level, while vision extracted 7 ES levels and 7 QQQ levels. The vision levels are structurally valid (horizontal lines on the chart) but carry no significance signal, no source_snippet, and no direction from Dubz's commentary.

| Source | ES levels | QQQ levels |
|--------|-----------|------------|
| Text   | 1         | 1          |
| Vision | 7         | 7          |
| Merged | 8         | 8          |

Phase 2's correlation engine needs an explicit design decision on how to treat vision-only levels:

- **Option A — Noise filter:** Vision-only levels below a minimum significance threshold are excluded from Phase 2 output. Only levels corroborated by text are surfaced.
- **Option B — Confluence boost:** A vision-only level that also appears in text (cross-source match) gets a higher confluence weight than either source alone.
- **Option C — Tiered output:** Levels are presented in tiers: text-sourced (primary), cross-corroborated (high confidence), vision-only (supplemental / unverified).

Option C is the most defensible for a first Phase 2 implementation. This fixture run provides the concrete data needed to make the decision — 7 vision-only ES levels with no significance metadata is a real example of the noise problem.

---

## 5. Coverage Gaps

The following fixture types do not yet exist in `fixtures/dubz/` and represent known parser paths that have not been validated:

| Gap | Description | Parser path affected |
|-----|-------------|----------------------|
| Carry-forward | "Levels unchanged from yesterday / same as Friday" | `parseDubzText` carry-forward regex → `mergeDubzInputs` carry-forward branch |
| Multi-paste same day | Second Dubz paste on the same calendar date | `mergeDubzInputs` `isSameDay=true` path |
| Bobby fixtures | Any Bobby text/image input | `lib/parse-bobby.js` entirely untested against real fixtures |
| Vision failure | Corrupt PNG, malformed JSON response from vision model | `parseDubzImage` error branch |
| Slash-separated compound | "ES/SPY at X/Y" style attribution | Variant of Bug #2 pattern — not yet validated in isolation |
| No-image paste | Dubz text paste with no accompanying charts | Text-only merge path |
| Four-instrument text paste | All four instruments explicitly named and priced in one paste | Full instrument coverage from text alone |

---

## 6. Recommendations for Next Fixture Additions

Add fixtures organically from daily Dubz pastes. Priority order for maximum coverage expansion:

1. **Next carry-forward paste** — Capture the first "no new levels" message. Validates the carry-forward path and ensures `mergeDubzInputs` same-day behavior doesn't overwrite good levels.
2. **Same-day second paste** — If Dubz posts a follow-up update the same morning, capture it. Tests the `isSameDay=true` accumulation path.
3. **Four-instrument text paste** — A paste where NQ, ES, QQQ, and SPY all appear with explicit prices. Validates full-instrument text extraction in one run.
4. **Slash-compound format** — A paste containing "ES/SPY at X/Y" phrasing to validate Bug #2 fix coverage beyond the "and" variant.

Do not manufacture synthetic fixtures. All fixtures must be authentic Dubz pastes to ensure the parser is validated against real production input, not hand-crafted test cases.

---

## 7. Recommendations for Sub-task 5b (Parser Fix Scope)

Sub-task 5b should address the two blocking bugs in order. Bug #1 fix is a prerequisite for Bug #3 fix (the fuzzy dedup tolerance change only makes sense after the cross-source dedup architecture is settled).

**Priority 1 — Bug #1: Cross-source dedup in `mergeDubzInputs`**  
Change the image-level merge loop to check for an existing level within `±0.01` across all sources, not just within `src=image`. On collision: keep the text entry, promote its significance/significance_signal/source_snippet to the merged level, and apply image direction only if text direction is null. Do not create a second row.

**Priority 2 — Bug #2: Compound parallel attribution in `parseDubzText`**  
Add a pre-scan pass for the pattern `INSTR_A (and|/) INSTR_B [flip-verb] PRICE_A (and|&) PRICE_B`. Zip instruments to prices by position. This must handle at minimum: "and"-separated instrument pairs, "/"-separated instrument pairs, and "&"-vs-"and" price separators.

**Priority 3 — Bug #3: Vision prompt revision for label precision**  
After Bugs #1 and #2 are fixed and re-validated against these two fixtures, revise the `parseDubzImage` system prompt to add explicit instruction to read price labels character-by-character and not round to whole or half-point numbers. Re-run the April 27 ES image to verify 7185.75 is now returned.

**Out of scope for 5b:** Bug #4 (null direction), vision-only level volume design decision, new fixtures, Bobby parser work.

---

*Generated by Sub-task 5a validation harness. Fixture evidence at `fixtures/dubz/`. Harness at `scripts/validate-dubz-fixtures.js`.*
