# Mancini Context Protocol Research

Generated: 2026-05-12T11:19:28.129Z

## Inputs

- Mancini log: `undefined`
- ES files merged: 8
- ES bars merged: 67540
- ES coverage: 2025-12-15 00:00 CT to 2026-05-07 17:10 CT
- Time rule: Barchart export is treated as CT/CDT; report adds one hour for ET alignment.
- Session rule: event tests use futures sessions: 18:00 ET prior evening through 16:00 ET plan day.

## What Changed In The Research Model

The parser does not treat Mancini levels as equal. It attaches role tags from the surrounding newsletter language, then tests whether price touched, swept, reclaimed, accepted, or non-accepted the level.

Primary roles used: `FIRST_SUPPORT_CAUTION`, `FAILED_BREAKDOWN_RECLAIM`, `DIRECT_BID_CONDITIONAL`, `MAJOR_SUPPORT`, `SUPPORT_LEVEL`, `RESISTANCE_ONLY`, `TARGET_ONLY`.

## Confidence Checks

- Entry models generated: 190
- Entries with complete 30m horizon: 180
- Entry session violations: 0
- Same-1m sweep/reclaim cases: 74; these are entered only after later acceptance bars, not on the sweep bar.
- Acceptance windows now require completed bars after reclaim; pre-reclaim bars are not allowed to count toward 2m/3m acceptance.
- Resistance and target-only rows are classified for context but excluded from long-entry response stats.

## Introductory Response Numbers

| Role | Levels | Entries | Complete 30m | Hit +2 30m | Hit +4 30m | Hit +8 30m | Avg MFE 30m | Avg MAE 30m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| SUPPORT_LEVEL | 653 | 86 | 81 | 83.95% | 69.14% | 51.85% | 9.38 | 6.04 |
| FAILED_BREAKDOWN_RECLAIM | 269 | 77 | 74 | 91.89% | 64.86% | 41.89% | 8.83 | 7.5 |
| MAJOR_SUPPORT | 347 | 15 | 14 | 92.86% | 64.29% | 35.71% | 10.55 | 8.79 |
| FIRST_SUPPORT_CAUTION | 24 | 12 | 11 | 81.82% | 63.64% | 27.27% | 5.95 | 8.14 |
| DIRECT_BID_CONDITIONAL | 5 | 0 | 0 | 0% | 0% | 0% | 0 | 0 |
| RESISTANCE_ONLY | 1158 | 0 | 0 | 0% | 0% | 0% | 0 | 0 |

These are not production win rates. They are first-pass, one-minute OHLC response stats with next-open-after-confirmation entries. Hit/MFE/MAE rates are calculated only from entries with a complete horizon window.

## Initial Read

- `FAILED_BREAKDOWN_RECLAIM` is the cleanest candidate for automation expansion: strong +2 hit rate, meaningful 30m MFE, and enough samples to justify the next pass.
- `MAJOR_SUPPORT` produces larger average moves but also larger adverse excursion, so it should not automatically mean wider size; it needs context filters.
- `FIRST_SUPPORT_CAUTION` can still scalp, but its average 30m MAE is now larger than its average 30m MFE. That supports Mancini's warning: treat first support after a rally as manual/low-trust unless it becomes a cleaner reclaim.
- `SUPPORT_LEVEL` has lower MAE than the other long classes in this pass, so the small 2-4 point edge probably still exists as a separate scalp class.

## Flagship Improvement Direction

Do not make every level equal. The next Pine-facing pack should distinguish at least these actions:

- `SCALP_VALID`: ordinary support or shallow reclaim; keep current 2-contract / TP1-first behavior.
- `MANCINI_RECLAIM`: explicit failed-breakdown, shelf, or defend/recover language; wait for acceptance and allow a larger runner target.
- `MANUAL_CAUTION`: first support after rally, freefall warnings, or weak context; show visual context but suppress automation unless a stronger reclaim appears.
- `TARGET_ONLY`: resistance/targets/runner destinations; draw/label only, never fire a long.


## Specific Examples

### 2026-05-04 7213 FAILED_BREAKDOWN_RECLAIM_RETROSPECTIVE

- Event: narrative_example_aligned
- Flush ET: 2026-05-04 12:08 low 7199.5 depth 13.5
- Reclaim ET: 2026-05-04 12:11
- Entry ET: 2026-05-04 12:20 price 7218
- MFE/MAE 30m: 10.25 / 2.5
- MFE/MAE 60m: 17 / 5.25
- Note: Newsletter describes 12:20 ET recovery of Monday 6:20 ET 7213 major low after flush to 7199.

### 2026-05-07 7369 FIRST_SUPPORT_CAUTION_RETROSPECTIVE

- Event: narrative_example_aligned
- Flush ET: 2026-05-07 12:20 low 7365.75 depth 3.25
- Reclaim ET: 2026-05-07 12:23
- Entry ET: 2026-05-07 12:24 price 7369.25
- MFE/MAE 30m: 17.25 / 1
- MFE/MAE 60m: 17.25 / 9.75
- Note: Newsletter calls this low quality first support but confirms wick/recover scalp potential.

### 2026-05-07 7355 FAILED_BREAKDOWN_RECLAIM_RETROSPECTIVE

- Event: narrative_example_aligned
- Flush ET: 2026-05-07 13:27 low 7345.75 depth 9.25
- Reclaim ET: 2026-05-07 13:36
- Entry ET: 2026-05-07 13:38 price 7362
- MFE/MAE 30m: 7.75 / 12.5
- MFE/MAE 60m: 8.5 / 12.5
- Note: Newsletter says defend 7345 then recover 7355; Mancini entry was 7362 at 1:38 ET.

### 2026-05-07 7369 FIRST_SUPPORT_CAUTION

- Event: entry_model_available
- Tags: major|first_support_caution|caution|failed_breakdown_reclaim
- Touch ET: 2026-05-07 12:15
- Sweep ET: 2026-05-07 12:15 low 7366.25 depth 2.75
- Reclaim ET: 2026-05-07 12:15
- Entry model: acceptance_3m_next_open at 2026-05-07 12:18 price 7373
- MFE/MAE 30m: 13.5 / 7.25
- Nearest Saty: PUT_TRIGGER 7365.61 distance 3.39 valid=true

### 2026-05-07 7355 FAILED_BREAKDOWN_RECLAIM

- Event: entry_model_available
- Tags: failed_breakdown_reclaim|defend_first
- Touch ET: 2026-05-07 13:26
- Sweep ET: 2026-05-07 13:26 low 7348.25 depth 6.75
- Reclaim ET: 2026-05-07 13:28
- Entry model: acceptance_3m_next_open at 2026-05-07 13:37 price 7360.5
- MFE/MAE 30m: 9.25 / 11
- Nearest Saty: ext-1 7352.54 distance 2.46 valid=true

### 2026-05-07 7345 FAILED_BREAKDOWN_RECLAIM

- Event: touched_no_entry_model
- Tags: major|failed_breakdown_reclaim|defend_first
- Touch ET: 2026-05-07 14:45
- Sweep ET: n/a low n/a depth n/a
- Reclaim ET: n/a
- Entry model: n/a at n/a price n/a
- MFE/MAE 30m: n/a / n/a
- Nearest Saty: ext-2 7341.97 distance 3.03 valid=true

### 2026-05-06 7279 FAILED_BREAKDOWN_RECLAIM

- Event: not_touched
- Tags: major|shelf_cluster_low
- Touch ET: n/a
- Sweep ET: n/a low n/a depth n/a
- Reclaim ET: n/a
- Entry model: n/a at n/a price n/a
- MFE/MAE 30m: n/a / n/a
- Nearest Saty: PUT_TRIGGER 7274.59 distance 4.41 valid=true

## Saty Caveat

Saty rows generated: 494. Valid warm rows: 156.
Rows are marked invalid when the ATR window includes partial sessions. Do not use invalid rows as proof; use them only as directional confluence candidates.

## Implementation Roadmap

1. Keep Pine unchanged until this protocol is validated.
2. Convert daily Mancini text into a compact daily protocol pack.
3. Feed Pine only distilled metadata: price, role, major flag, trigger type, and target-only exclusion.
4. Keep two trade classes separate: `SCALP_VALID` for 2-10 point opportunities and `SWING_VALID` for larger failed-breakdown runners/options.
5. Require different automation brackets by class instead of pretending every level gets the same stop/TP.

## Next Prompt Scaffold

```text
Parse this Mancini plan into JSON. For every ES level, classify role as DIRECT_BID, FIRST_SUPPORT_CAUTION, MAJOR_SUPPORT, SHELF_CLUSTER_LOW, FAILED_BREAKDOWN_RECLAIM, LEVEL_RECLAIM, TARGET_ONLY, RESISTANCE_ONLY, or NO_KNIFE_CATCH. Include the exact sentence that justified each role. Do not mark a level long-eligible unless the text gives support/direct-bid/reclaim context. Output a compact protocol pack for Luke/Pine and a richer audit table for research.
```

## Limitations

- 1m OHLC cannot prove intraminute order.
- Current parser is heuristic and must be reviewed against the raw snippets before trading changes.
- Saty ATR needs enough clean prior sessions; invalid rows are not proof.
- A level can be a good scalp and a bad swing. The report keeps those concepts separate.
