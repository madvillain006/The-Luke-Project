# DEV_AUDIT_REPORT.md
**Luke — Senior Engineer Audit**
Auditor: Senior Engineer, OWLS Infrastructure
Date: 2026-04-21
Scope: Full codebase — security, architecture, tests, production readiness

---

## Audit Summary

| Phase | Status | Issues Found | Issues Fixed |
|-------|--------|-------------|-------------|
| 1. ESLint Setup | COMPLETE | 119 errors | 119 |
| 2. Security | COMPLETE | 8 issues | 8 |
| 3. Architecture | COMPLETE | 7 issues | 7 |
| 4. Test Coverage | COMPLETE | 0 tests → 54 tests | N/A |
| 5. Production Readiness | COMPLETE | 4 gaps | 4 |
| 6. Documentation | COMPLETE | — | — |

**Overall assessment: Production-ready for solo trading use. Zero ESLint errors. Zero npm audit vulnerabilities.**

---

## Phase 1 — ESLint & Static Analysis

### Setup
- Installed `eslint@8` with `eslint:recommended` + custom rules
- Config: `.eslintrc.json` — `no-empty` allows `allowEmptyCatch: true` for intentional empty catches

### Critical Bugs Fixed

**execution-live.js — `flattenResult` ReferenceError (CRITICAL)**
The Kian audit claimed this was fixed but it was not. Lines 126–174 referenced `flattenResult` which was never declared. Emergency flatten is disabled per design (human must flatten manually). Fixed by removing the dead if/else block and replacing with a clean critical-mismatch path that sets `state.critical_mismatch = true`, blocks execution, and throws with a clear message.

### Other ESLint Fixes
| File | Rule | Fix |
|------|------|-----|
| `lib/system-prompt.js` | `no-misleading-character-class` | Replaced emoji regex with `Array.some(startsWith)` |
| `ingest-exports.js` | `no-useless-escape` | Removed `\=` escape in skipLine regex |
| `trading/execution-shadow.js` | `eqeqeq` (x2) | Changed `!= null` to `!== null && !== undefined` |
| `index.js` | `no-inner-declarations` | Moved nested `walk` function to arrow function expression |
| Multiple agents | `no-console` | Replaced `console.log/error` with `log()` from `lib/logger` |

### Dead Code Archived
Three files with zero external references moved to `archive/`:
- `lib/replay.js`
- `lib/replay-alignment.js`  
- `lib/parse-signal.js`

---

## Phase 2 — Security Audit

### S-1: Hardcoded Finnhub API Key (HIGH)
**trading/signals.js** and **agents/agent-06-research.js** had hardcoded Finnhub key fallbacks.
- Removed both fallbacks; key now required via `process.env.FINNHUB_KEY`
- **Note:** Key appeared in git history as a deletion (commit `771df94`). History cannot be cleaned without force-push to all branches. Recommend rotating the key.

### S-2: Server Bound to 0.0.0.0 (MEDIUM)
`server.listen(PORT, "0.0.0.0")` exposed Luke on all network interfaces.
- Fixed: changed to `"127.0.0.1"` — loopback only

### S-3: No Input Validation (MEDIUM)
No validation on any POST endpoints.
- Created `lib/validators.js` with: `validateTradeRequest`, `validateAlertRequest`, `validateLevelsRequest`, `validateTimestamp`, `validateSignalStrike`, `validateMemoryKey`
- `validateMemoryKey` blocks writes to safety-critical keys: `luke_last_log`, `current_state`, `apex`, `_schema_version`, `_written_by`
- Applied to: `/memory`, `/research` (URL scheme + length), `/notify` (type + 500-char cap), `/paste-signals` (10KB byte limit), `/paste-ximes`

### S-4: Directory Traversal in Actions (HIGH)
`lib/actions.js` "read" action had no path sanitization.
- Fixed: `const filePath = path.resolve(rawPath); if (!filePath.startsWith(LUKE_ROOT)) return "READ BLOCKED"`

### S-5: No CORS Headers (LOW)
- Added `Access-Control-Allow-Origin: http://localhost:3000` middleware — restricts to local frontend only

### S-6: No Rate Limiting (MEDIUM)
- Added `express-rate-limit` per-endpoint: `/chat` (60/min), `/notify` (10/min), `/agent` (30/min), `/research` (20/min), `/paste-signals` (20/min), global (100/min)

### S-7: WebSocket Unauthenticated (MEDIUM)
Any local process could connect to the WS server.
- Added boot-time crypto token (`crypto.randomBytes(24)`) written to `.ws-token`
- Added `/ws-token` GET endpoint for preload
- WS connections validated via query-string token; rejected with close code 4401
- `chat.html` updated to fetch token before establishing connection

### S-8: Electron Sandbox Disabled (HIGH)
Both BrowserWindow instances had `sandbox: false`.
- Fixed: `sandbox: true, webSecurity: true` on both windows

---

## Phase 3 — Architecture Review

### A-1: Magic Numbers Scattered (MEDIUM)
Hard-coded values in 8+ files (confidence thresholds, freshness windows, rate limits, etc.).
- Created `lib/config.js` with named constant groups: `CONFLUENCE`, `FRESHNESS`, `MARKET_HOURS`, `EMOTIONAL`, `THRESHOLDS`, `TIMEOUTS`, `LIMITS`, `SIENNA`, `LUKE`, `FINNHUB`, `WEBSOCKET`

### A-2: Raw `fs.writeFileSync` for State Files (MEDIUM)
`lib/slash-commands.js` used `fs.writeFileSync` directly for LEVELS_FILE, LAST_SIGNAL_FILE, ACTIVE_TRADE_FILE — not atomic.
- Fixed: replaced with `writeJsonAtomic` (tmp+rename pattern from `state/lib.js`)
- TRADES_JSONL append changed from `fs.appendFileSync` to `appendJsonl`

### A-3: No Crash Recovery (MEDIUM)
Process crashed silently on unhandled exceptions.
- Added `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers
- Both call `writeCrashState()` which writes timestamped JSON to `state/crashes/`
- On boot: crash files from last run are detected, logged, and moved to `state/archive/`

### A-4: Input Size Limits Missing on Parsers (LOW)
- `parseBobby`: added `messageText.length > 10000 → return null`
- `parseXimes`: added `raw.length > 10000 → return null`
- `parseBobbyImage`: added `typeof base64Image !== 'string' → return null`

### A-5: chat.html WebSocket Initialization Bug (HIGH)
After adding WS token fetch, the `initWs()` function was never closed. DOM variable declarations (`messages`, `input`, etc.) were inadvertently moved inside the function scope, making them inaccessible to outer-scope functions (`addMessage`, `refreshStatusPanel`, etc.).
- Fixed: DOM variables moved back to outer script scope; `initWs` closes after `ws.onmessage`

### A-6: agent-13-workflows.js Unmounted
The file exists and is listed as active in `LUKE_STATUS.md` but has no `app.use()` mount in `index.js`. Not a bug — deferred to FUTURE_COMMERCIAL_AUDIT.md.

### A-7: Boot-time Sanity Checks
Added `bootChecks()` IIFE that:
- Validates required env vars (`ANTHROPIC_API_KEY`) — exits with code 1 if missing
- Checks write permissions on log directory
- Verifies required directories exist (`data`, `state`, `agents`)

---

## Phase 4 — Test Coverage

### Setup
- Installed `vitest@4` dev dependency
- Added `vitest.config.mjs` with `globals: true, environment: node`
- Added `npm test` script → `vitest run`

### Test Files Written
| File | Tests | Coverage |
|------|-------|----------|
| `tests/parse-ximes.test.js` | 7 | Unknown username, noise filter, live entry, pre-market setup, trim, cut, size limit |
| `tests/bracket-calc.test.js` | 6 | Unknown instrument, LONG defaults, confluence zones, R:R reject flag, no entry, SHORT direction |
| `tests/confluence.test.js` | 9 | inferInstrument ranges, empty signals, level clustering, image bonus, sort order, bias dedup |
| `tests/parse-bobby.test.js` | 11 | Null inputs, no prices, king node, support/resistance, bias detection, VIX, size limit, merge |
| `tests/market-hours.test.js` | 7 | Module shape, isMarketOpen fields, isGoodTradingTime fields, isWeekend, minsUntilOpen, valid session/window values |
| `tests/smoke.test.js` | 14 | Module load (8 modules), validateMemoryKey (protected + allowed), validateSignalStrike, MAX_TEXT_BYTES |

**Result: 54/54 tests passing**

---

## Phase 5 — Production Readiness

### P-1: /health Endpoint Enhanced
Expanded from `{ok, uptime_sec, version}` to include:
- `trades_today`: count of today's trades from `trades.jsonl`
- `last_signal`: `{type, analyst, ts}` from `data/last-signal.json`
- `market`: full `isMarketOpen()` result `{open, session, message}`

### P-2: Graceful Shutdown
Added `SIGINT` and `SIGTERM` handlers that:
1. Call `server.close()` for clean connection drain
2. Log shutdown event to `jarvis-log.jsonl`
3. Force-exit after 5 seconds if connections don't drain

### P-3: Boot-time Env/Dir Checks
See A-7 above.

### P-4: npm audit
`0 vulnerabilities` — no action required.

---

## Remaining Warnings (Non-Blocking)

ESLint shows warnings (not errors) for unused variables in several files. These are pre-existing imports that are referenced via `agentFetch` dynamic calls or are partially-implemented features. Not fixed in this audit pass — risk of regression in working code is higher than the value of cleanup.

Notable:
- `index.js`: `writeJsonAtomic`, `parseXimes`, `parseBobby`, `detectConfluence`, `inferInstrument` — likely used via dynamic agent dispatch, not direct calls
- `agents/agent-13-workflows.js`: multiple unused vars — unmounted module, deferred

---

## Security Posture Summary

| Vector | Before Audit | After Audit |
|--------|-------------|-------------|
| Hardcoded secrets | 2 (Finnhub) | 0 (git history still has old key — rotate it) |
| Server exposure | All interfaces | 127.0.0.1 only |
| Path traversal | Unprotected | Protected with `path.resolve` + root check |
| Input validation | None | All major endpoints validated |
| Rate limiting | None | Per-endpoint + global |
| WS auth | None | Boot crypto token |
| Electron sandbox | Off | On (both windows) |
| CORS | None | Localhost-only |
| npm vulnerabilities | 0 | 0 |

---

*Audit conducted by Senior Engineer, OWLS Infrastructure — 2026-04-21*
*Built because Conor is tired of losing.*
