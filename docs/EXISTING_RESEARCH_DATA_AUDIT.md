# Existing Research Data Audit

Generated from local repo data on 2026-05-03.

## 1. Data Found

- Inventory scanned `data`, `fixtures`, `archive`, `docs`, `agents`, `scripts`, `state`, `artifacts`, and `discord-exports`.
- Total relevant files inventoried: 1,506.
- Main buckets found:
  - ES 1-minute bars: 7 files.
  - Other market bars/reference data: 8 files.
  - Saty generated levels: 57 files.
  - Saty source inputs: 5 files.
  - Bobby text/commentary: 13 files.
  - Bobby heatmap images: 701 files.
  - Bobby cached parsed heatmaps: 33 files.
  - Mancini text/levels/chop zones: 9 files.
  - Dubz structural levels: 21 files.
  - Dubz same-day callouts/commentary: 492 files.
  - Katbot/Jefe context: 7 files.
  - GEX/Heatseeker/heatmap data: 10 files.
  - Existing replay outputs: 60 files.
  - Unknown potentially useful data: 83 files.

## 2. Data Date Ranges

- ES historical CSV bars: 52,927 bars from 2026-03-01T20:37:00-05:00 through 2026-04-29T08:29:00-04:00.
- SPX historical CSV bars: 19,999 bars from 2026-02-18T12:40:00-05:00 through 2026-04-28T16:38:00-04:00.
- Normalized ES replay sessions: 50 session JSON files from 2026-02-19 through 2026-05-01.
- Usable replay sessions with ES bars: 37 sessions from 2026-03-02 through 2026-04-28.

## 3. ES/SPX Bars

- ES bars exist in both raw historical CSVs and normalized session JSONs.
- SPX bars exist as raw historical CSVs, but the replay did not substitute SPX for ES price.
- Excluded sessions were missing ES RTH/session bars, mostly 2026-02-19 through 2026-02-27 plus 2026-03-20, 2026-03-23 through 2026-03-25, 2026-04-03, 2026-04-29, 2026-04-30, and 2026-05-01.

## 4. Analyst/Context Data

- Saty: generated historical ES futures-session levels exist in session JSONs and derived files.
- Bobby: exact-timestamp Discord message exports, heatmap images, and cached image parses exist.
- Mancini: parsed date-level posts and session-derived levels exist; raw date-only posts are quarantined unless already normalized into session context.
- Dubz: fixture text/images and Discord export media exist; much of it remains structural or image/text archive context, not fully normalized replay input.
- Katbot/Jefe: local JSON/JSONL context exists and was included when timestamped.
- GEX/Heatseeker: reference docs/JSON and heatmap-related data exist; unparsed images were not guessed.

## 5. Timestamp Quality

- ES/SPX bars have parseable ET timestamps with explicit offsets after normalization.
- Bobby Discord messages and cached image parses have exact timestamps.
- Mancini parsed posts often have estimated dates, so raw posts are not used as intraday source updates.
- Heatmap images without cached parsed levels are marked `image_unparsed`.
- Source events without timestamps are quarantined into `missing-data-report.json`.

## 6. Usable Now

- ES-only 1-minute replay with analyst context is usable now.
- SPX bars are usable for inventory/alignment checks, but not as silent ES price replacements.
- Saty generated levels are usable as historical levels when valid in session JSON.
- Bobby cached parsed heatmaps are usable only after their `available_at_et`.
- Mancini session-normalized date-only context is usable only for that session and labeled as a premarket assumption.

## 7. Unusable Now

- Unparsed heatmap images cannot be used as levels.
- Raw date-only or missing-timestamp source events cannot be used as intraday source updates.
- Sessions missing ES RTH bars cannot produce ES forward outcome metrics.
- Dubz media/text archives need more normalization before they can drive a precise intraday replay.

## 8. Generated From Existing Data

- `artifacts/research/existing-data-inventory.json`
- `artifacts/research/source-timeline.json`
- `artifacts/research/missing-data-report.json`
- `artifacts/research/replay-results.json`
- `artifacts/research/replay-summary.csv`
- `artifacts/research/source-attribution.json`
- `artifacts/research/veto-analysis.json`
- `artifacts/research/pass-miss-analysis.json`

## 9. No-Lookahead Replay

- Replay ran.
- It used only source events with `available_at_et <= checkpoint`.
- Bobby was restricted to same-session context to avoid stale heatmap attribution.
- Mancini date-only context was restricted to same session and labeled.
- ES outcomes were measured only from future ES bars after each checkpoint.

## 10. Biggest Missing Pieces

- More complete ES RTH 1-minute bars for excluded sessions.
- Better exact timestamps for Mancini and Dubz source events.
- Cached parses for more heatmap images.
- Explicit SPX-to-ES basis/alignment data if SPX context should be quantitatively linked to ES.

## 11. Commands

- `npm run research:inventory`
- `npm run research:replay:existing`
- `npm test`
- `npm run replay:history`
- `npm run market:data:test`
