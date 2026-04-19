# JARVIS SUGGESTIONS — PENDING

Items below are genuine future work not yet implemented. Everything else has been built.

---

## Signal Deduplication Filter
**Agent:** intraday-scraper / 02B
**Change:** Hash each signal by `ticker + direction + timeframe`. When the same signal appears from multiple sources in the same cycle, merge into one entry with a `conviction_count` field and list of source names. Add a `suppress_until: breakout` flag for range-bound conditions (e.g. SPX chop days) — skip that ticker until price breaks the defined range.
**Why:** 40% noise ratio in signal cycles from index chop. Conor reads the same SPX neutral call 4 times. Single hash dedup drops noise below 15% and surfaces conviction weighting.
**Effort:** LOW — no new deps, one function addition to intraday-scraper

---

## Inter-Agent Message Schema
**Agent:** scaffold / all
**Change:** Define a lightweight shared format `{from, to, task_type, payload, priority}` in a single `schemas/agent-message.js` file. Use it when Agent 06 research output needs to flow to 02B or trader, so handoffs are structured and traceable rather than ambient context.
**Why:** Currently agent handoffs are manual or via memory.json. Structured schema enables future automation of research→trade pipelines without copy-paste.
**Effort:** LOW — one schema file, no behavior change until wired

---

## Auto-Alert for High-Conviction Flow Trades
**Agent:** 06-research / 02-trader
**Change:** When background cycle identifies a high-conviction institutional flow signal (multi-source convergence, block trade + OI buildup + directional confirmation), automatically create a tracked entry with key levels, expiry context, and daily alert until either the trade triggers or thesis expires. APG pattern from April 2026 is the reference case.
**Why:** High-conviction signals currently live in TRADER_PROFILES.md and decay without follow-through. Need automated staleness tracking.
**Effort:** MEDIUM — requires Agent 06 output schema + Agent 02 alert wiring
