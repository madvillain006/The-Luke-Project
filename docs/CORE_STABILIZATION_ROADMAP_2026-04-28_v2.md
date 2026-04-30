# Luke Core Stabilization Roadmap — 2026-04-28 v2
Updated after Phase 1F today-levels shim hardening session (2026-04-29). Replaces prior state.

---

## Current Verified State

**Test suite:** 264/264 passing, 1 skipped future short-strategy test. Vitest file parallelism is disabled because several legacy tests intentionally mutate shared runtime fixture files.

**Syntax checks passing:** index.js, scheduler.js, lib/slash-commands.js, lib/slash-commands-ingest.js, lib/daily-accumulator.js, lib/system-prompt.js, trading/router.js, agents/agent-14-kat.js, lib/es-bracket-strategy.js, lib/es-long-bracket-runner.js, lib/today-levels-shim.js, scripts/backtest-es-long-bracket.js.

**Live smoke passing:** /status, /balance, /saty, /mancini, /ready, /alert — all return clean ASCII, confirmed against running server after PM2 reload.

**Encoding rot:** Zero mojibake markers in all active runtime files. Unchanged from 1B.

**Split continuing:** lib/slash-commands-ingest.js now owns /saty, /mancini, /dubz, and /heatmap. slash-commands.js trimmed to 1570 lines (was 1715 after 1C).

**Offline strategy research lane:** ES long-only 3-contract bracket runner is now scaffolded and tested as a script/report path only. It is not wired into `/entries ES`, PM2, live alerts, or broker execution.

---

## Sacred Core Surface
Do not churn casually:

- **index.js** — Express/chat entrypoint; loads slash commands, Saty auto-pull endpoints, fallback route (now lazy), Kat sidecar (now lazy), dashboard/admin routes. Encoding rot cleared.
- **scheduler.js** — scheduled Saty auto-pull and jobs; PM2-managed. Encoding rot cleared.
- **lib/slash-commands.js** — sacred command router (1570 lines). Dispatches remaining commands; /saty, /mancini, /dubz, and /heatmap now delegate to ingest sub-module. checkSessionReadiness() now at module scope.
- **lib/slash-commands-ingest.js** — ingest sub-module (218 lines). Contains /saty, /mancini, /dubz, and /heatmap handlers. Holds ingest vision rate-limit state.
- **lib/saty-levels.js, lib/parse-dubz.js, lib/parse-bobby.js, lib/parse-ximes.js, lib/confluence-engine.js, lib/level-memory.js, lib/futures-entry-zones.js, trading/*** — core parsing, level memory, confluence, staging, and risk. Untouched.
- **chat.html** - live UI; large and historically fragile. Targeted paste/status mojibake cleanup completed; do not split/refactor without UI smoke coverage.
- **lib/daily-accumulator.js** — paste accumulator and checklist. Encoding rot cleared.

---

## Phase History

### Phase 1B — 2026-04-28 (complete)

- **Mojibake guard tests** added: 4 tests covering /alert, /status, /ready output cleanliness. Guard regex `/[ÃÂâƒÅ]/`.
- **Root residue deleted**: codex-bak files, truncated-bak, __pycache__, state/daily-context.json, jarvis logs, archive/crash-*.json, proposals/, workflow-recordings/, empty dirs.
- **Docs archived** to `docs/archive/2026-04-28-handoffs/`.
- **Gitignore**: added repo-map.json, jarvis logs, luke-log-drafts.json. repo-map.json untracked from git, still on disk (used by /luke/self-diagnose).
- **Katbot + fallback lazy loading**: agent-14-kat.js now lazy via route-level require; agent-12-fallback.js via `_requireFallback()` getter.
- **Encoding rot cleared**: index.js (34 lines), scheduler.js (2), daily-accumulator.js (27), agents/agent-14-kat.js (44, comments only), system-prompt.js, trading/router.js.
- **Test suite at end of 1B**: 239/239 (was 232).

### Phase 1B.5 — 2026-04-28 Codex pass (complete)

- **ET/UTC date split fix** in /heatmap and /dubz to prevent false-ready state during late-evening ET testing.
- **/dubz reply residue fix**: corrupted historical text no longer appears before fresh levels.
- **Legacy Bobby heatmap readiness bridge**: current-day today-levels.json data counts as loaded while old/new state stores coexist.
- **Alert UX fix**: "Afternoon window (23:50 PM)" → "Afternoon window (2:00-3:50 PM)".
- **/verdict and /entries fail-closed** unless fresh Saty + Dubz + Bobby are all loaded.
- **Bare /dubz returns stale warning** with today's ET date instead of silently showing old levels.
- **Browser checklist fix** in chat.html: `checkMC()` now runs after server reply; items only go green on confirmed success replies.
- **Test suite at end of 1B.5**: 243/243 (was 239).

### Phase 1C — 2026-04-29 (complete)

- **6 command boundary tests added** to `tests/slash-commands.test.js`: /balance write + read, /saty parse+save, /heatmap text-parse+write, /ready with full prep, /reset file deletion. Test count: 249/249.
- **`checkSessionReadiness()` lifted to module scope** in lib/slash-commands.js. Was inner function of handleSlashCommand() but used no closure variables. Pure structural cleanup, zero behavior change.
- **lib/slash-commands-ingest.js created** (59 lines): /saty and /mancini handlers extracted verbatim. Pattern established for further extraction.
- **slash-commands.js wired to delegate** /saty and /mancini to ingest sub-module. Now-redundant saty-levels.js and parse-mancini.js imports trimmed from slash-commands.js. 1756 → 1715 lines.
- **PM2 reload + live smoke**: /saty and /mancini routing correctly through sub-module. No error log growth.

### Phase 1D — 2026-04-29 (complete)

- **/dubz + /heatmap extracted** to `lib/slash-commands-ingest.js` using the established ingest-module pattern.
- **Shim ownership preserved**: `data/today-levels.json` helpers remain in `lib/slash-commands.js` and are passed into ingest as context. No state-source migration was attempted.
- **Vision rate limiter moved** into ingest module for heatmap and Dubz image paths.
- **slash-commands.js reduced** from 1715 lines to 1570 lines.
- **slash-commands-ingest.js expanded** from 59 lines to 218 lines.
- **Syntax checks**: `lib/slash-commands.js` and `lib/slash-commands-ingest.js` passed `node --check`.
- **Tests**: focused slash tests passed `18/18`; full suite passed `249/249`.
- **PM2 reload + live smoke**: passed after reload. `/dubz`, `/heatmap`, `/ready`, `/verdict ES`, and `/entries ES` exercised against the running server.
- **Runtime note**: PM2 server error log grew only with known `[live-price] using ... close (pre-market or market closed)` warnings during smoke; scheduler error log remained empty.

### Phase 1E — 2026-04-29 (complete)

- **Pure ES bracket simulator retained** in `lib/es-bracket-strategy.js`. Long strategy behavior is covered; future short symmetry test remains skipped intentionally.
- **Data-backed offline runner added** in `lib/es-long-bracket-runner.js`.
- **CLI report script added** at `scripts/backtest-es-long-bracket.js`.
- **Dedicated drop zone added** at `data/backtest/es-long-bracket/`.
- **Session contract documented** in `data/backtest/es-long-bracket/README.md`.
- **Raw input folders created** for Bobby text/images, Dubz, Mancini, and Saty source material.
- **Example session added** at `data/backtest/es-long-bracket/sessions/example-session.json`. It is marked `example=true` and must not be treated as evidence.
- **Runner behavior tests added** in `tests/es-long-bracket-runner.test.js`.
- **CLI smoke** against existing `data/historical` 2026-04-27 ES bars loaded 357 RTH bars and produced a trade-by-trade report from the example session.
- **Tests**: focused ES runner tests passed `12/12` with `1` skipped future short test; full suite passed `261/261` with `1` skipped.

### Phase 1F — 2026-04-29 (complete)

- **today-levels index.js shim extracted** into `lib/today-levels-shim.js`.
- **index.js call sites covered** for the remaining shim consumers:
  - `/see-image` Bobby vision append path now uses `appendBobbyVisionResult()`.
  - WebSocket boot warning now uses `hasLevelsLoadedToday()` and `makeLevelsWarningPayload()`.
  - Startup "Levels loaded" log now uses `levelsLoadedLabel()`.
- **Bug fixed**: startup log previously converted loaded state to `"YES"`/`"NO"` and then used that string in a ternary, causing `"NO"` to print as `YES`.
- **Bug fixed**: `/see-image` no longer appends fresh Bobby vision results under a stale `today-levels.json` date.
- **Tests added**: `tests/today-levels-shim.test.js`.
- **Test isolation hardened**: `vitest.config.mjs` now sets `fileParallelism: false` because multiple legacy tests mutate shared `data/*.json` fixture files.
- **Verification**: focused shim/readiness tests passed `27/27`; full suite passed `264/264` with `1` skipped future short-strategy test.
- **PM2 reload + live smoke**: `/status`, `/ready`, and `/balance` passed after reload. Startup log now correctly prints `Levels loaded: NO` when the shim is stale/missing. No new server error-log growth; scheduler error log remains empty.

### Dormant Architect/Sweeper Audit — 2026-04-29

- `index.js` still mounts `/agent/architect` and `/agent/sweeper`.
- `chat.html` polls only `/agent/architect/status` and `/agent/sweeper/status`.
- Mutating routes still exist:
  - Architect: `POST /agent/architect/run`
  - Sweeper: `POST /agent/sweeper/run`, `/inventory`, `/scan-batch`, `/synthesize`, `/delta-scan`, `/reject`, `/reset-rejections`
- Root residue tied to these agents remains:
  - `ARCHITECT_LOG.jsonl`
  - `ARCH_TOKENS.jsonl`
  - `architect-costs.json`
  - `SWEEPER_LOG.jsonl`
  - `SWEEPER_MAP.json`
  - `SWEEPER_STATE.json`
  - `sweeper-costs.json`
- Current recommendation: status endpoints can stay for UI compatibility, but mutating architect/sweeper routes should be disabled or feature-flagged before archiving their root artifacts. Do not delete artifacts while mutating routes remain reachable.

---

## What Remains

### Priority 1 — data/today-levels.json Shim
The roadmap called for treating `data/today-levels.json` as a compatibility shim only. Consumer verification is now done:

**Active consumers (5 call sites):**
- `index.js` `/see-image` - heatmap ingestion writes Bobby levels through `lib/today-levels-shim.js`.
- `index.js` WebSocket connect warning - checks whether Bobby/Richy levels were loaded today through `lib/today-levels-shim.js`.
- `index.js` startup log - checks whether levels were loaded today through `lib/today-levels-shim.js`.
- `lib/daily-accumulator.js:13` - heatmap checklist compatibility shim; accepts current-day Bobby entries as loaded heatmap.
- `lib/slash-commands.js:33` - LEVELS_FILE constant; used by /heatmap (write via saveLevels), /reset (delete), getLegacyConfluenceState (read), getPhase2WorkflowLoadStatus (read fallback), checkSessionReadiness (stale age check).

**Tests in place:** `tests/slash-commands.test.js` covers the slash-commands.js write path (`/heatmap` saves to today-levels.json), delete path (`/reset` removes it), and readiness path (`/ready` with full prep using daily-context.json). `tests/daily-accumulator.test.js` covers the accumulator shim side. `tests/today-levels-shim.test.js` covers the index.js helper behavior for `/see-image`, WebSocket warning, and startup label.

**Still untested before bridging:** full Express/WebSocket integration around the actual mounted route/socket. Helper behavior is covered, but no server-level integration harness exists yet.

**Verdict:** Cannot remove until all call sites are bridged to modern `dubz-levels.json` / `level-memory.json` truth. Do not remove the file before that work.

### Priority 2 — Dormant Agent Root Artifacts
These files remain in root and are still referenced by agent-09 (architect) and agent-10 (sweeper) which are mounted as routes but not called in normal trading flow:
- `ARCHITECT_LOG.jsonl`
- `SWEEPER_LOG.jsonl`
- `SWEEPER_MAP.json`
- `SWEEPER_STATE.json`
- `architect-costs.json`

**Verdict:** Safe to archive only after agent-09 and agent-10 routes are explicitly disabled or the agents are removed. Do not archive while routes remain mounted or silent route hits will create stale state files anyway.

### Priority 3 — agent-14-kat.js Full Gating
Lazy loading is now in place. The agent still runs when `/agent/kat` is hit. Full removal or feature-flag gating requires:
- Identifying all callers in chat.html and index.js that hit `/agent/kat`
- Replacing or disabling those calls
- Then removing the lazy-load route

Do not touch until that dependency map is clear.

### Priority 4 — Refactor (In Progress)
- **slash-commands.js split: STARTED.** /saty and /mancini extracted to lib/slash-commands-ingest.js. Behavior tests in place for /balance, /saty, /heatmap, /ready, /reset. Remaining extraction order (safest to riskiest): /dubz+/heatmap (needs shared vision rate-limiter and LEVELS_FILE), /verdict+/entries (needs confluence engine + live price), /alert (largest at ~437 lines, needs ximes/bracket/active-trade state), core (/status /ready /balance /session /reset).
- Split `index.js` route mounting — deferred, requires index.js behavior tests first.
- Split `chat.html` — deferred, requires UI smoke coverage.
- Collapse duplicate runtime truth — Priority 1 tests in place for slash-commands.js call sites; index.js call sites still need tests before bridging.

### Priority 5 - chat.html
Targeted mojibake cleanup completed in paste-prefix stripping and status-panel parsing. Scan now finds no `Ã`, `â`, `�`, `ƒ`, or `Â` markers in chat.html, and the inline script compiles with `vm.Script`. Still large and historically fragile; needs browser/UI smoke coverage before any split or broader refactor.

### Priority 6 - ES Long Bracket Backtest
Started after the 2026-04-29 strategy discussion.

**Current scope:** long-only ES strategy. Short support can exist in pure code for later symmetry, but active testing/model work should focus on long setups only.

**Thesis to test:**
- Enter at high-confluence long zones.
- Use stop placement wide enough to survive normal tick-to-tick chop, but not wide enough to turn a failed setup into a stubborn hold.
- Trade 3 ES contracts.
- Take off 1 contract at each of the next three levels reached.
- After TP1, move stop to breakeven.
- After TP2, move stop to TP1.
- Prefer aggressive profit-taking at next Saty/Mancini/Dubz/Bobby/confluence levels.

**Files added:**
- `lib/es-bracket-strategy.js` - pure deterministic simulator.
- `lib/es-long-bracket-runner.js` - session-level runner that consumes frozen dated levels and ES 1-minute bars.
- `scripts/backtest-es-long-bracket.js` - CLI report script.
- `tests/es-bracket-strategy.test.js` - long strategy tests plus skipped future short symmetry test.
- `tests/es-long-bracket-runner.test.js` - synthetic data-backed runner tests.
- `data/backtest/es-long-bracket/README.md` - data drop contract and run instructions.
- `data/backtest/es-long-bracket/sessions/example-session.json` - plumbing example only, marked `example=true`.

**Data drop locations:**
- Existing historical bars: `data/historical/`
- Frozen session JSON: `data/backtest/es-long-bracket/sessions/`
- Bobby text: `data/backtest/es-long-bracket/raw/bobby-text/`
- Bobby images: `data/backtest/es-long-bracket/raw/bobby-images/`
- Dubz raw/source: `data/backtest/es-long-bracket/raw/dubz/`
- Mancini raw/source: `data/backtest/es-long-bracket/raw/mancini/`
- Saty raw/source: `data/backtest/es-long-bracket/raw/saty/`
- Generated reports: `data/backtest/es-long-bracket/reports/`

**Verification:**
- `node --check lib/es-bracket-strategy.js` passed.
- `node --check lib/es-long-bracket-runner.js` passed.
- `node --check scripts/backtest-es-long-bracket.js` passed.
- Direct Node sanity check of a long ladder returned TP1/TP2/TP3 fills, `18.25` ES points, `$912.50` gross.
- Focused ES bracket/runner tests: `12 passed`, `1 skipped` future short-strategy test.
- CLI smoke using `sessions/example-session.json` and existing 2026-04-27 historical ES bars loaded 357 RTH bars and generated a trade-by-trade markdown report to stdout.
- Full suite: `19` files, `261 passed`, `1 skipped`.

**Next needed before using this for decisions:**
- Replace the example session with real dated session files in `data/backtest/es-long-bracket/sessions/`.
- Keep Bobby/Dubz/Mancini/Saty source material beside the session files in `data/backtest/es-long-bracket/raw/`.
- Run enough dated sessions to compare stop width, TP ladder quality, and stopped-after-TP behavior before tuning.
- Keep this out of `/entries ES` until the backtest proves it.

---

## Split-Brain State — Current Picture

| Store | Status |
|---|---|
| `data/daily-context.json` | Primary truth — keep |
| `data/dubz-levels.json` | Primary truth — keep |
| `data/level-memory.json` | Primary truth — keep |
| `data/saty-levels.json` | Primary truth — keep |
| `data/today-levels.json` | Compatibility shim — 5 active consumers, do not remove until bridged |
| `state/daily-context.json` | Deleted — was orphaned, zero code references |

---

## Next Steps (In Order)

1. Assemble real ES long session files in `data/backtest/es-long-bracket/sessions/` and raw source material in `data/backtest/es-long-bracket/raw/`.
2. Run the offline bracket runner across dated sessions and inspect trade-by-trade reports before any live integration.
3. Add full Express/WebSocket integration harness before bridging `today-levels.json` out of index.js entirely.
4. Decide architect/sweeper route fate - either disable the routes or accept the root artifact files are permanent.
5. Continue slash-commands.js split: next candidates are /verdict + /entries or /alert. /verdict+/entries require confluence engine + live price context; /alert is largest and needs ximes/bracket/active-trade state.
6. Run browser/UI smoke on chat.html before any larger UI refactor.
7. Then: Katbot full gating / lazy-load verification.
8. Then: split index.js route mounting after index.js behavior tests exist.

---

## Risky Before Removal (Unchanged)
- `agents/agent-14-kat.js` — lazy loaded now, but route still mounted. Removal needs caller audit.
- `agents/agent-12-fallback.js` and `lib/llm-client.js` — lazy loaded now, fallback path still wired.
- `lib/saty-auto-pull.js`, `tests/saty-auto-pull.test.js`, `scheduler.js`, `index.js` Saty endpoints — newly wired and tested. Keep; stabilize scheduler behavior before cleanup.
- `chat.html` — do not refactor without UI smoke coverage.
- `README.md`, `LUKE_STATUS.md`, `TECH_DEBT.md`, `CHANGELOG.md` — stale risk. Update or archive only after code-verified roadmap replaces them.

---

## Encoding Rot Surfaces — Resolved

All original five surfaces are now clean:
- `index.js` ✓
- `scheduler.js` ✓
- `lib/daily-accumulator.js` ✓
- `trading/signals.js` ✓ (was already clean)
- `agents/agent-14-kat.js` ✓

`chat.html` encoding rot status: targeted paste/status mojibake cleaned; no known markers remain after scan.

Additional active runtime cleanup:
- `lib/system-prompt.js` ✓
- `trading/router.js` ✓

Remaining active non-core mojibake:
- `scripts/dry-fire.js` - dry-fire harness output/comments are garbled; useful but not live runtime. Clean before using as operator smoke evidence.
- `logs/strategy-progress.log` - historical log residue only.
- `tests/slash-commands.test.js` and this roadmap intentionally contain mojibake marker patterns for guard coverage/documentation.
