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
