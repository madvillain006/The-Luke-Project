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
