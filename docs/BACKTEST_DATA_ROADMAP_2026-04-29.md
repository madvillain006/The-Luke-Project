# Luke ES Long Backtest Data Roadmap - 2026-04-29

Purpose: hand this to Claude/Gemini/Codex when the current session is low on context. This is a one-shot execution plan for converting the new Bobby + Mancini dumps and ES/SPX historical bars into a real offline backtest dataset.

Do not wire this into `/entries ES`, PM2, live alerts, broker execution, or the UI. This lane is offline research only until proven.

## Current Files

Repo:

`C:\Users\conor\luke`

Primary operating docs:

- `C:\Users\conor\luke\GEMINI.md`
- `C:\Users\conor\luke\docs\CORE_STABILIZATION_ROADMAP_2026-04-28_v2.md`

Offline backtest code:

- `C:\Users\conor\luke\lib\es-bracket-strategy.js`
- `C:\Users\conor\luke\lib\es-long-bracket-runner.js`
- `C:\Users\conor\luke\scripts\backtest-es-long-bracket.js`
- `C:\Users\conor\luke\tests\es-bracket-strategy.test.js`
- `C:\Users\conor\luke\tests\es-long-bracket-runner.test.js`

New source data:

- Bobby Discord export JSON:
  - `C:\Users\conor\luke\data\backtest\es-long-bracket\raw\bobby json.json`
  - Size observed: about 11.2 MB.
  - Shape observed: object with keys `guild`, `channel`, `dateRange`, `exportedAt`, `messages`, `messageCount`.
  - `messages` observed: 934.
  - Actual timestamp range observed: `2026-02-16T16:44:57.575-05:00` to `2026-04-28T16:02:35.309-04:00`.
  - Attachments observed: 730 messages have attachments, usually Discord CDN image URLs.

- Local Bobby media cache:
  - `C:\Users\conor\luke\discord-exports\bobby\media`
  - Observed files: 673 media files plus `manifest.json`.
  - Observed extensions: 669 `.png`, 2 `.jpg`, 1 `.webp`, 1 `.gif`, plus manifest.
  - Filename range observed: `2026-02-25_1018_bobbyaxl.png` through `2026-04-23_1537_bobbyaxl.png`.
  - Manifest path: `C:\Users\conor\luke\discord-exports\bobby\media\manifest.json`
  - Manifest has a UTF-8 BOM. Strip leading `\uFEFF` before `JSON.parse`.
  - Manifest shape observed: array of 673 rows with `messageId`, `timestamp`, `authorName`, `messageContent`, `originalFilename`, `localFilename`, `downloadStatus`.

- Mancini text:
  - `C:\Users\conor\luke\data\backtest\es-long-bracket\raw\mancini\Mancini.txt`
  - Size observed: about 110 KB.
  - Contains Reddit-scraped Adam Mancini commentary.
  - Encoding/mojibake exists in text, e.g. `[â€“]`, `Â©`.
  - Newest entries use relative timestamps like `an hour ago`, `17 hours ago`, `1 day ago`, then older entries use `1 month ago`.
  - The file is most-recent-first and should preserve chronological order after reconstruction.

Historical bars:

- `C:\Users\conor\luke\data\historical\esh26_intraday-1min_historical-data-download-04-29-2026.csv`
- `C:\Users\conor\luke\data\historical\esm26_intraday-1min_historical-data-download-04-29-2026.csv`
- `C:\Users\conor\luke\data\historical\spx_intraday-1min_historical-data-download-04-29-2026.csv`

Observed via current `lib/historical-data.js` loader:

- ES: 39,998 bars, `2026-03-01T20:37:00-05:00` through `2026-04-29T08:29:00-04:00`, 37 distinct dates.
- SPX: 19,999 bars, `2026-02-18T12:40:00-05:00` through `2026-04-28T16:38:00-04:00`, 49 distinct dates.

Important: user expected 1/1-4/29 coverage, but the currently visible files do not prove that. First task is a coverage report that identifies exact missing dates/sessions.

## Strategy Scope

Current strategy research is ES long-only:

- 3 ES contracts.
- Entry at high-confluence long zones.
- Take 1 contract off at each of next 3 levels.
- Move stop to breakeven after TP1.
- Move stop to TP1 after TP2.
- Profit targets should come from next Saty/Mancini/Dubz/Bobby/confluence levels.
- Stop must be wide enough to survive regular tick-to-tick chop, but not so wide that failed setups become stubborn holds.
- Include overnight ES session if historical bars contain it.
- Respect Apex-style constraints and human-in-the-loop assumptions.
- Keep short support dormant for later. Do not tune shorts now.

## Main Risks

1. Historical coverage mismatch.
   - Current loader sees ES only from March 1 onward, not Jan 1.
   - Do not run a "months-long" conclusion until coverage gaps are reported.

2. Bobby images are linked by Discord CDN URLs.
   - URLs may expire or need download before parsing.
   - Do not rely on future CDN availability without caching images locally.
   - Existing parser `lib/parse-bobby.js::parseBobbyImage()` accepts base64 image bytes, not Discord CDN URLs.
   - Prefer the existing local media cache at `discord-exports\bobby\media` before attempting any network download.
   - The dataset builder must match JSON attachments to local media by message id / local manifest / filename before falling back to CDN download.
   - Every attachment must produce a manifest row with status: `downloaded`, `download_failed`, `vision_parsed`, `vision_failed`, or `skipped_non_image`.

3. Bobby JSON contains exact timestamps, but Mancini text contains relative timestamps.
   - Bobby can be parsed by message timestamp.
   - Mancini requires date reconstruction from post headers/order/context.

4. Saty levels are formula-derived.
   - Do not fake Saty data.
   - Existing `lib/saty-auto-pull.js` exposes `_internal.deriveSatyLevelsFromBars()` using Wilder ATR and `DEFAULT_TRIGGER_PCT = 0.236`.
   - Historical backtest needs deterministic per-date Saty generation from historical daily bars. Do not use `loadSatyLevels()` for backtest because it is live/stale-session storage.
   - If user-provided Saty source code differs from `deriveSatyLevelsFromBars()`, stop and reconcile the formula before using Saty in confluence scoring.

5. Current runner is session-file based.
   - Need a dataset build step that generates frozen dated session JSON files from raw data before running the strategy.

## Required Output Folders

Create generated files under:

- `C:\Users\conor\luke\data\backtest\es-long-bracket\derived\`
- `C:\Users\conor\luke\data\backtest\es-long-bracket\sessions\`
- `C:\Users\conor\luke\data\backtest\es-long-bracket\reports\`

Suggested derived outputs:

- `derived\coverage-report.json`
- `derived\coverage-report.md`
- `derived\bobby-messages.normalized.jsonl`
- `derived\bobby-attachments.jsonl`
- `derived\bobby-image-cache-manifest.jsonl`
- `derived\bobby-image-parses.jsonl`
- `derived\mancini-posts.normalized.jsonl`
- `derived\saty-levels-by-date.json`
- `derived\daily-level-candidates.json`
- `derived\parse-warnings.jsonl`

Do not commit or assume large generated files are tracked; `data/*` is mostly ignored.

## Phase 0 - Read-Only Audit

Commands/logic to run first:

1. Parse all historical CSVs with existing `lib/historical-data.js`.
2. Produce day/session coverage:
   - ES full bars by date.
   - ES RTH bars by date.
   - ES overnight bars by date.
   - SPX full/RTH bars by date.
   - missing weekdays from expected range.
3. Inspect Bobby JSON:
   - message count.
   - timestamp range.
   - author counts.
   - attachment count.
   - image URL count.
   - attachment file types.
   - match count against local `discord-exports\bobby\media\manifest.json`.
   - unmatched JSON attachments.
   - local media files not referenced by current Bobby JSON.
   - first/last 5 messages after sorting ascending.
4. Inspect Mancini text:
   - split candidate posts.
   - count posts.
   - list first/last snippets.
   - estimate date range based on weekly thread headers and relative timestamps.

Stop and report if historical bars do not cover the desired date range.

Do not claim Bobby image data is usable until `bobby-image-cache-manifest.jsonl` and `bobby-image-parses.jsonl` exist with explicit per-image pass/fail statuses. The preferred path is local media match first, CDN download second.

## Phase 1 - Build Data Normalizers

Add scripts/modules, with tests:

- `lib/backtest-data/bobby-export.js`
  - Load Discord export JSON.
  - Sort messages ascending by timestamp.
  - Filter likely Bobby messages by author/name/nickname/content/channel context.
  - Extract:
    - `id`
    - `timestamp`
    - `tradingDateET`
    - `author`
    - `content`
    - `attachments[]`
    - `imageUrls[]`
    - `mentionedInstruments`
    - `levelCandidates`
    - `parseWarnings`

- `lib/backtest-data/bobby-image-cache.js`
  - Read normalized Bobby attachment rows.
  - Read `discord-exports\bobby\media\manifest.json`, stripping UTF-8 BOM if present.
  - Match Bobby JSON attachment rows to local cached files by `messageId`, `originalFilename`, `localFilename`, and timestamp/author fallback.
  - Copy or reference matched local files from:
    - `discord-exports\bobby\media\`
  - Only download Discord CDN image URLs for attachments not already present locally, into:
    - `data/backtest/es-long-bracket/derived/bobby-image-cache/`
  - Preserve message id, attachment id, timestamp, original URL, local path, content type, byte size, and error if failed.
  - Never silently drop an image. Missing local files or expired URLs must be explicit rows in `bobby-image-cache-manifest.jsonl`.

- `lib/backtest-data/bobby-image-parse.js`
  - Read cached image files.
  - Convert local image bytes to base64.
  - Call existing `parseBobbyImage(base64, livePricesForThatDateOrNull)`.
  - Record one parse row per image with `messageId`, `attachmentId`, `timestamp`, `tradingDateET`, `localPath`, `parseStatus`, `panels`, `king_nodes`, `support`, `resistance`, and `error`.
  - If the parser returns `{ parse_status: 'failed' }`, record it as failure and continue. Do not throw away the message.
  - Add an aggregate fail threshold option. Recommended: fail the job if more than 20% of heatmap image downloads or parses fail unless `--allow-image-failures` is passed.

- `lib/backtest-data/mancini-text.js`
  - Normalize mojibake enough for parsing/readability.
  - Split posts.
  - Extract raw relative timestamp, score, content.
  - Extract ES levels with roles:
    - support
    - resistance
    - target
    - chop zone
    - trap/watch-trap
    - reclaim/clear level
  - Reconstruct approximate dates conservatively.
  - Mark uncertain timestamps with `timestampConfidence: low`.

- `lib/backtest-data/coverage.js`
  - Use `loadIntraday()`.
  - Report bar coverage and missing dates.
  - Separate RTH and overnight coverage.

- `lib/backtest-data/saty-historical.js`
  - Use historical daily bars to derive Saty levels for each test date.
  - Prefer existing `lib/saty-auto-pull.js` `_internal.deriveSatyLevelsFromBars()` unless user-provided source code proves a different formula.
  - For date D, use daily bars through the prior completed session/reference bar, never future data.
  - Output `saty-levels-by-date.json`.

- `scripts/build-es-long-backtest-dataset.js`
  - CLI orchestrator.
  - Inputs:
    - `--bobby <path>`
    - `--mancini <path>`
    - `--out <dir>`
    - optional `--start YYYY-MM-DD`
    - optional `--end YYYY-MM-DD`
  - Outputs normalized JSONL and daily session candidates.
  - Must include image cache/parse status counts in the final console summary.

Tests:

- `tests/backtest-data-bobby-export.test.js`
- `tests/backtest-data-bobby-image-cache.test.js`
- `tests/backtest-data-bobby-image-parse.test.js` using a mocked `parseBobbyImage`, not live API calls.
- `tests/backtest-data-mancini-text.test.js`
- `tests/backtest-data-coverage.test.js`
- `tests/backtest-data-saty-historical.test.js`

Use small inline fixtures. Do not make tests depend on the full 11 MB Bobby file.
Do not make tests call Anthropic vision or Discord CDN.

## Phase 2 - Build Daily Session Generator

Add:

- `lib/backtest-data/session-builder.js`
- tests in `tests/backtest-session-builder.test.js`

For each trading date, generate:

```json
{
  "date": "YYYY-MM-DD",
  "instrument": "ES",
  "rthOnly": false,
  "sourceFiles": {
    "bobby": "...",
    "mancini": "...",
    "saty": "formula",
    "historical": "data/historical"
  },
  "levels": [
    { "price": 7147, "source": "mancini", "role": "support", "timestamp": "...", "confidence": 0.8 },
    { "price": 7180, "source": "mancini", "role": "target", "timestamp": "...", "confidence": 0.8 },
    { "price": 7193, "source": "bobby-text", "role": "king_node", "timestamp": "...", "confidence": 0.6 },
    { "price": 7200, "source": "bobby-image", "role": "king_node", "timestamp": "...", "confidence": 0.6 },
    { "price": 7186, "source": "saty", "role": "call_trigger", "timestamp": "...", "confidence": 0.8 }
  ],
  "setups": []
}
```

Bobby text and Bobby image levels should be tracked separately first, then included with equal strategy importance once parsing quality is proven. Do not collapse them into one undifferentiated `bobby` source before reports can show whether text or image carried the signal.

Mancini levels must be included wherever date reconstruction is confident enough. Low-confidence Mancini timestamps can be included as context but must not create entries unless a sensitivity report explicitly allows them.

Saty levels must be included only after historical per-date generation is verified against known/manual Saty outputs or the user-provided source formula.

Do not invent entries yet. First generate daily level context and coverage.

## Phase 3 - Entry Candidate Builder

Only after Phase 2:

Add a candidate generator that proposes long setup times/entries from historical bar interaction with levels.

Rules to explore:

- Support hold/trap/reclaim from Mancini levels.
- Bobby king/support nodes near price.
- Confluence between Mancini/Bobby/Saty.
- Avoid FOMC/major volatility commentary windows unless explicitly marked.
- Avoid chop zones or mark them as chop-risk.
- Overnight interactions count if ES bars exist.

Candidate output should include:

- entry timestamp.
- entry price.
- initial stop candidate(s).
- reason.
- source levels used.
- invalidation level.
- chop risk.

Do not tune on final PnL first. First produce auditable candidates.

## Phase 4 - Multi-Day Runner

Extend current runner without touching live trading:

- Add `scripts/run-es-long-backtest-range.js`.
- Load generated session files over a range.
- Use `lib/es-long-bracket-runner.js`.
- Produce:
  - trade-by-trade CSV/JSON.
  - markdown summary.
  - by-day summary.
  - by-source/confluence summary.
  - stopped-after-TP stats.
  - max adverse/favorable excursion stats.
  - missing-data exclusions.

Required report fields:

- date.
- setup id.
- entry time.
- entry.
- stop.
- targets.
- source/confluence reason.
- fill sequence.
- TP1/TP2/TP3 times.
- stop movement.
- net points.
- net dollars.
- max adverse excursion.
- max favorable excursion.
- result class.

## Phase 5 - Stop/Target Research

Only after a baseline report exists:

Compare stop policies:

- fixed 2.0/3.0/4.0/5.0 point stops.
- stop just below source support.
- ATR-derived stop if Saty/source supports it.
- prior 1m/5m swing low.
- chop-zone widened or excluded.

Compare target policies:

- next 3 levels above entry.
- next 3 confluence-weighted levels.
- skip targets less than minimum distance.
- prioritize Mancini/Saty/Dubz/Bobby source order variants.

Report must separate in-sample/exploratory results from anything claimed as robust.

## First Prompt For Claude

```text
Read C:\Users\conor\luke\GEMINI.md and C:\Users\conor\luke\docs\BACKTEST_DATA_ROADMAP_2026-04-29.md.

You are working in C:\Users\conor\luke.

Mode: offline backtest data build only. Do not touch live trading routes, PM2, /entries ES, broker execution, chat.html, or scheduler.

First task:
Create a read-only coverage and source-shape report for:
- C:\Users\conor\luke\data\historical
- C:\Users\conor\luke\data\backtest\es-long-bracket\raw\bobby json.json
- C:\Users\conor\luke\discord-exports\bobby\media
- C:\Users\conor\luke\data\backtest\es-long-bracket\raw\mancini\Mancini.txt

Output the report to:
C:\Users\conor\luke\data\backtest\es-long-bracket\derived\coverage-report.md
and machine-readable data to:
C:\Users\conor\luke\data\backtest\es-long-bracket\derived\coverage-report.json

Do not build entry logic yet. Do not make trading claims. First prove exact data coverage, date ranges, missing days, overnight/RTH bar availability, Bobby message/attachment counts, Bobby local media manifest match rate, Bobby image URL/cache/parse feasibility, Mancini timestamp reconstruction risks, and whether historical Saty generation can be derived without future leakage.

Required gates:
- Prefer matching Bobby attachments to C:\Users\conor\luke\discord-exports\bobby\media before trying network downloads.
- Strip UTF-8 BOM from media\manifest.json before parsing.
- If Bobby image URLs cannot be downloaded/cached, the report must say exactly how many failed and why.
- If Bobby images are cached but not parseable by `parseBobbyImage`, the report must say exactly how many failed and why.
- If Mancini timestamps cannot be reconstructed confidently, mark affected posts `timestampConfidence: low` and keep them out of entry generation.
- If Saty formula/source cannot be verified, do not include Saty in confluence scoring yet.

Add tests only if you create reusable parser/helper modules. Run focused tests and report exact commands/results.
```

## Definition Of Done For First Claude Pass

- Coverage report exists.
- No live files/routes changed.
- Historical ES/SPX coverage is quantified by date and session type.
- Bobby export shape is documented and sorted ascending.
- Bobby image attachment feasibility is documented with explicit pass/fail counts.
- Mancini parsing/timestamp risk is documented.
- Saty historical generation status is documented.
- Next implementation step is explicit and based on observed data, not assumptions.
