# Replay Sufficiency Report
**Date:** 2026-04-20  
**Source file:** `logs/discord-history.jsonl`

## Counts

| Metric | Count |
|---|---|
| Total entries | 0 |
| Valid bias (LONG/SHORT/NEUTRAL) | 0 |
| Valid level (price number) | 0 |
| Confidence HIGH/MEDIUM | 0 |
| passToPipeline = true | 0 |

## Date Range
- None — file does not exist

## Gaps > 24hrs
- N/A

## Notes
`logs/discord-history.jsonl` was not found. The Discord scraper ([discord-scraper.js](../discord-scraper.js)) has not yet populated any history. The file must be created before replay testing can proceed.

`lib/parse-signal.js` is confirmed present and functional — `parseSignal()` is ready to consume entries once the history file exists.

## Verdict

**INSUFFICIENT** — 0 usable signals (need 50+).

### Required next step
Run the Discord scraper to populate `logs/discord-history.jsonl`, then re-run this check.
