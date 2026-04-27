# Tech Debt — Deferred Decisions

Running list of architectural decisions deferred to a specific milestone.
Add entries here when something is intentionally skipped, not when something is broken.

---

- Post-payout: design v1 automated ingestion. v0 archived in /archive/intraday-scraper-v0-screenshot-based.js.
  Re-evaluate approach (Discord API / headless browser / paid feeds) — do not assume screenshot scraping is the right path.

- Crash logging consolidated to crash.log at project root (Phase 1B.6.3). Historical archive/crash-*.json files
  preserved as record (written by old logger → logs/crash-*.json → migrated to archive/ on each boot). Old logger
  was active before Phase 1B.6.3 fix; unhandledRejection was dual-logging. Both process.on handlers in the old
  system now commented out in index.js.

## Post-payout: Per-analyst historical corpus

Build complete historical archives for every analyst the system
follows: Dubz, Ximes, Bobby, plus each analyst Katbot relays from
(Jefe / mathemeatloaf7 from Elevated Charts and any others). Each
analyst's corpus contains:
- All historical text posts (timestamps, channel attribution)
- All historical image attachments (chart screenshots, GEX heatmaps)
- Paired intraday price action data covering the windows each post
  references

The Discord CDN expires attachment URLs ~24 hours after export. The
existing dubz-ximes archive already has dead images. To rebuild this
properly, options are: (a) DCE re-export with --media flag (hours of
download time, replaces stale images), (b) build real-time forward-
capture into the existing Discord ingest pipeline (organic build over
weeks/months), (c) paid Discord scraper service post-payout.

This is prerequisite for empirical confluence weight tuning in Phase
5+. The system can ship Apex eval clearance without it. Estimated
weeks of work. Do NOT start before payout.

---

## Pre-payout (deferred from 5a): Vision quality logging

Build a vision quality log that captures every Bobby/Dubz vision parse
with: input image hash, full vision output (king_nodes, support,
resistance, bias, panels[] for Bobby), live grounded price context at
time of parse, and an optional user-flag for ground-truth accuracy.

This is logging, not vision improvement. It is prerequisite data for
ANY future vision improvement work AND for validation of direct GEX
feeds post-payout (when vision becomes legacy fallback or is dropped
entirely). Do NOT scope vision improvement itself before this log
exists. Speculative tuning without ground-truth data is wasted effort.

---

## Phase 5+: Backtest harness

Once historical corpus exists (post-payout) and Phase 2 correlation
engine is in production, build a backtest harness that replays
historical analyst signals through the current parser/Level Memory/
correlation pipeline, then measures performance against historical
intraday price action.

Output: per-analyst edge measurement, per-confluence-grade hit rate,
per-instrument win/loss distribution. This drives empirical tuning of
confluence weights and per-analyst trust scores.

Stash any pre-payout-collected intraday CSV data at
data/historical/<date>/<instrument>_1min.csv until this harness is
built. Do not wire into anything before Phase 5.

---

## Phase 3+ (post-Phase-2): Mancini analyst integration

Adam Mancini posts SPX levels on Twitter that have proven reliable.
Add as a fourth analyst alongside Dubz / Bobby / Saty (Ximes is
trade-execution, not level-source).

Required pieces (estimated 1-2 days of work):
- fixtures/mancini/ directory + README documenting format
- lib/parse-mancini.js — text parser. Mancini posts in tweet format,
  short. SPX levels primarily. May need a separate parser path or could
  potentially reuse parts of parseDubz.
- /mancini slash command in lib/slash-commands.js
- appendManciniToMemory function writing to Level Memory under SPX key
- Confluence engine (lib/confluence-engine.js once Phase 2 ships) needs
  to recognize 'mancini' as a valid analyst in mentions[]
- Tests for parser + memory integration

Do NOT add Mancini before Phase 2 ships. Adding a fourth analyst to a
correlation engine that hasn't validated against three is scope creep.
Conor will paste Mancini levels manually into a temporary holding file
until the parser is built.

Holding file: fixtures/mancini/inbox.md (centralized append-only log,
Conor pastes here, parser is built later to read this file).

---

## Phase 3+: Centralized per-analyst commentary log files

Adopted 2026-04-27. Pattern: instead of one .txt per snapshot, each
analyst has a single rolling log file per day with all timestamped
commentary inline. Image attachments stay in their own files with
timestamps that cross-reference into the log.

Format:
  fixtures/<analyst>/<YYYY-MM-DD>_<analyst>_log.md

Per-entry shape:
  ## [HH:MM AM/PM]
  > <message text>
  Image: <filename or "none">
  Tickers: <list or "all">
  Note: <Conor's eyes-on observation>

Rationale: makes intraday narrative legible end-to-end. Phase 5
backtest harness reads these chronologically and pairs with intraday
price data for empirical edge measurement.

For Phase 2: parsers continue to read individual .txt files for
structured parsing. The log file is a parallel human-readable record,
not a parser input. Phase 5+ work converts the log files into a
structured ingest pipeline.

Files already created:
- fixtures/bobby/2026-04-27_bobby_log.md (seeded with 6 entries from
  the morning's snapshots)

---

## Phase 5+: Futures-vs-options tolerance differentiation

In Phase 2 confluence scoring, all instruments use the same scoring
formula. In production trading, Conor trades ES futures (eval account)
which has tighter drawdown tolerance than options.

Phase 2 v1 treats all levels equivalently. Future enhancement: per-
instrument scoring weight adjustments where ES/NQ futures levels
require tighter cross-source agreement (e.g. crossSourceConfirmed
within 0.10pt instead of 0.25pt) before earning the +0.15 weight.
SPY/QQQ/SPX options-driven scoring stays as currently specified.

This is a tuning question, not a bug. Acceptable to defer until
post-payout when backtest data exists to validate the right tolerances
empirically. Adding futures-tightness now without data is guessing.

---

## Phase 5+: Intraday price action vs analyst signal validation

Once historical intraday data is collected (currently being downloaded
by Conor) and the Phase 5 backtest harness exists, run every Bobby
king_node, every Dubz key+flip, and every Ximes LIVE_ENTRY against the
intraday price action that followed.

Specifically:
- Bobby king nodes: did price actually pin near the node, or did it
  break through? Pin rate per node, time-to-break, post-break drift.
- Dubz key flips: did the level act as flip (break + retest)? Flip
  hold rate vs failure rate.
- Ximes LIVE_ENTRY: did the entry produce a runner, scalp, or stop?
  R-multiple distribution per signal.

Conor noted: futures drawdown tolerance is tighter than options. The
"wiggle room" allowed by an options contract spread is not present on
futures. So a Bobby king node that's ±2 points imprecise might be
acceptable confluence for SPY options but unacceptable for ES futures
on a $48k floor. Phase 5 metrics need to capture this asymmetry.

Output: per-analyst, per-signal-type, per-instrument edge measurement.
Drives both confluence-weight tuning and the futures-tightness
adjustment above.

