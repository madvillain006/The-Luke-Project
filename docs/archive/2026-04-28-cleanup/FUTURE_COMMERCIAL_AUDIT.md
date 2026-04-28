# FUTURE_COMMERCIAL_AUDIT.md
**Luke — Deferred Items for Commercial/Multi-User Hardening**
Date: 2026-04-21

This document tracks issues that are acceptable for solo-trader use but would need resolution before Luke is deployed as a shared or commercial service.

---

## Critical for Multi-User (Must Fix Before Sharing)

### C-1: No Authentication on HTTP Endpoints
All REST endpoints accept requests from any process that can reach `localhost:3000`. In a solo desktop app this is acceptable. For web or multi-user deployment, add session tokens or API keys on all POST endpoints.

### C-2: No Per-User Data Isolation
All data (trades, memory, state, levels) is global. There is no concept of a user ID. A multi-user deployment would require per-user namespacing throughout.

### C-3: Secrets in process.env Only
`ANTHROPIC_API_KEY`, `FINNHUB_KEY` are read from environment variables with no secrets manager, rotation mechanism, or audit trail. For commercial use: integrate AWS Secrets Manager, HashiCorp Vault, or equivalent.

### C-4: Finnhub API Key in Git History
The Finnhub key was committed and deleted in commit `771df94`. The key remains in git history. Before open-sourcing or sharing the repository: rotate the key immediately, then consider `git filter-repo` or BFG Repo Cleaner to scrub the history.

### C-5: Single-Tenant Architecture Throughout
Agents (02B, 04, 06, 08) read/write shared JSONL files. Concurrent multi-user writes would cause data corruption. No locking beyond atomic writes.

---

## High Priority for Production Scale

### H-1: agent-13-workflows.js Not Mounted
`agents/agent-13-workflows.js` is listed as active in `LUKE_STATUS.md` but has no `app.use()` mount in `index.js`. The workflow execution engine is unreachable. Before relying on it: add the mount and write integration tests.

### H-2: ESLint Warnings in Core Files
`index.js` has 7 unused-variable warnings for imports that may be used via dynamic dispatch but are not verified. Before scaling: audit these imports and either connect them to their intended routes or remove them.

### H-3: No Request Logging / Audit Trail
HTTP requests are not logged (only structured events via `lib/logger`). For compliance or debugging at scale, add morgan or equivalent middleware.

### H-4: Memory File Has No Schema Validation
`lib/memory.js` reads/writes arbitrary JSON. No schema versioning beyond `_schema_version` key. For multi-user use, add JSON Schema validation on read and write.

### H-5: WebSocket Token Not Rotated During Session
The WS token is generated once at boot. If it leaks, it's valid until the server restarts. For higher-security deployments: implement short-lived tokens with expiry.

### H-6: No Database — JSONL Files Only
All persistent storage uses append-only JSONL files. No indexing, no query capability, no foreign-key integrity. For scale beyond one trader: migrate to SQLite (at minimum) or PostgreSQL.

---

## Medium Priority / Quality of Life

### M-1: `lib/sienna-regime.js` Not Unit Tested
`getSiennaRegime()` reads live files and uses real time — not suitable for unit testing without mocking. Write tests using `vi.mock('fs')` to cover VIX detection, MANAGEMENT chop detection, and TRINITY boost paths.

### M-2: No Integration Tests for Agent Endpoints
The 10 agent Express routers have no integration tests. A test harness using `supertest` against a real Express instance would catch regressions on `/agent/autonomous/*` and `/agent/health/*`.

### M-3: console.log Still Used in server.listen Callback
The boot banner uses `console.log` instead of `log()`. Not harmful but inconsistent with structured logging elsewhere.

### M-4: `index.js` is 1000+ Lines
The main server file handles routing, scheduling, WebSocket, WS token, crash recovery, boot checks, and agent dispatch. Splitting into `server.js` (HTTP setup) + `scheduler.js` + `ws.js` would improve maintainability.

### M-5: `lib/config.js` Not Imported Anywhere Yet
Constants were centralized into `lib/config.js` but existing code still uses the original inline values. The constants file is ready — a subsequent pass should replace inline magic numbers with config references.

### M-6: `/luke/self-diagnose` Endpoint Is Broad
The self-diagnose endpoint returns internal file paths and state structure. Acceptable for solo use; would need access control for any shared deployment.

### M-7: Playwright Dependency Unused
`playwright` is listed in production `dependencies` but is not imported in any active code path (intraday scraper was previously present). Move to `devDependencies` or remove.

---

## Low Priority / Nice to Have

### L-1: No CI/CD
No GitHub Actions or equivalent. For a team: add a workflow that runs `npm test` and `npx eslint` on every push.

### L-2: No Structured Error Responses
Error responses from Express routes mix `{ error: string }` and `{ message: string }` formats. Standardize to `{ ok: false, error: string, code: string }`.

### L-3: WS `send()` Has No Error Handling
`broadcast()` calls `ws.send()` without catching errors. A broken client could theoretically cause an unhandled exception. Wrap in try/catch (the current WS library buffers, but defensive practice is good).

### L-4: `minsUntilOpen()` Doesn't Account for US Market Holidays
`lib/market-hours.js` uses weekday logic only. Federal holidays (Labor Day, Thanksgiving, etc.) show as open days. For a production trading system: integrate a holidays calendar.

### L-5: No Log Rotation
`jarvis-log.jsonl` grows unbounded. For long-running deployments: add log rotation (e.g., keep last 30 days).

---

## Deferred from This Audit (Out of Scope)

- Tradovate API integration hardening (agent-02b-autonomous) — live trading path, treat as production critical
- Signal replay and backtesting infrastructure — archive/ contains old replay.js, not revived here
- Mobile/web frontend — Electron-only for now

---

*Compiled 2026-04-21 — Senior Engineer, OWLS Infrastructure*
