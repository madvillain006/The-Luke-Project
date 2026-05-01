# Worktree Triage — 2026-04-30

Generated during Phase 2 of PROMPT-0B. 50+ files surveyed.
Last commit before triage: 3a5fc72

---

## GROUP A — Today's patch 1A  ✅ ready to commit

| File | Status | Notes |
|------|--------|-------|
| lib/system-prompt.js | M | DATA SOURCES section added |
| tests/system-prompt.test.js | ?? | Guard test (new) |
| docs/SYSTEM_PROMPT_PATCH_PROPOSAL_2026-04-30.md | ?? | Doc |
| docs/SYSTEM_PROMPT_PATCH_APPLIED_2026-04-30.md | ?? | Doc |
| docs/PRE_EVAL_HYPOTHESIS_CHECK_2026-04-30.md | ?? | Doc |

---

## GROUP B — Today's patch 1B  ✅ ready to commit

| File | Status | Notes |
|------|--------|-------|
| tests/slash-commands.test.js | M | 5 stale-test fixes for post-fccd266 recommendation lane |
| lib/level-memory.js | M | _setWriteFn injector (10 lines) |
| docs/PRE_2A_HEALTH_CHECK_2026-04-30.md | ?? | Doc |
| docs/STALE_TESTS_FIXED_2026-04-30.md | ?? | Doc |

---

## GROUP C — Cleanup artifacts  ✅ ready to commit

| File | Status | Notes |
|------|--------|-------|
| archive/crash-2026-04-21*.json (9 files) | D | Deleted |
| archive/crash-2026-04-22*.json (14 files) | D | Deleted |
| archive/crash-2026-04-23*.json (5 files) | D | Deleted |
| archive/crash-2026-04-24*.json (1 file) | D | Deleted |
| proposals/sweeper-2026-04-19-1776640518393.md | D | Deleted |
| jarvis-stderr.log | D | Deleted |
| jarvis-stdout.log | D | Deleted |
| .gitignore | M | Adds backtest dir patterns + repo-map.json + jarvis logs to ignore |

**Also needed in this commit:**
- Add `.ws-token` to .gitignore (runtime token, currently tracked, must be untracked)
- `git rm --cached .ws-token` — stops tracking the token
- `git rm --cached repo-map.json` — stops tracking generated file (already added to .gitignore)

---

## GROUP D — Backtest lane (multi-day)  ✅ ready to commit

| File | Status | Notes |
|------|--------|-------|
| lib/backtest-data/ | ?? | Backtest data loader module |
| lib/es-bracket-strategy.js | ?? | Bracket strategy engine |
| lib/es-long-bracket-runner.js | ?? | Runner |
| scripts/backtest-es-long-bracket.js | ?? | |
| scripts/build-es-long-backtest-dataset.js | ?? | |
| scripts/build-es-long-backtest-sessions.js | ?? | |
| scripts/coverage-audit.js | ?? | |
| scripts/diagnose-backtest-coverage.js | ?? | |
| scripts/generate-es-long-candidates.js | ?? | |
| scripts/inject-session-bobby-levels.js | ?? | |
| scripts/mancini-check.js | ?? | |
| scripts/parse-bobby-images.js | ?? | |
| scripts/run-atm-backtest.js | ?? | |
| scripts/run-combined-atm-backtest.js | ?? | |
| tests/atm-simulator.test.js | ?? | |
| tests/backtest-data-bobby-export.test.js | ?? | |
| tests/backtest-data-bobby-image-cache.test.js | ?? | |
| tests/backtest-data-bobby-image-parse.test.js | ?? | |
| tests/backtest-data-mancini-text.test.js | ?? | |
| tests/backtest-data-saty-historical.test.js | ?? | |
| tests/build-es-long-backtest-sessions.test.js | ?? | |
| tests/es-bracket-strategy.test.js | ?? | |
| tests/es-long-bracket-runner.test.js | ?? | |
| tests/long-candidate-generator.test.js | ?? | |
| docs/BACKTEST_DATA_ROADMAP_2026-04-29.md | ?? | |
| docs/OPTIMAL_STRATEGIES.md | ?? | |
| data/backtest/ | ?? | |

---

## GROUP E — Eval prep artifacts  ✅ ready to commit

| File | Status | Notes |
|------|--------|-------|
| docs/PRE_EVAL_VERIFICATION_2026-04-30/ | ?? | Eval verification dir |
| docs/CODEX_HANDOFF_2026-04-28_LIVE_READINESS.md | ?? | Handoff doc |
| docs/CORE_STABILIZATION_ROADMAP_2026-04-28_v2.md | ?? | Roadmap |
| docs/archive/2026-04-28-handoffs/ | ?? | Archive dir |
| GEMINI.md | ?? | Intentional (Gemini eval context) |
| LAUNCH-LUKE.cmd | ?? | Intentional (launch script) |
| LAUNCH-LUKE.vbs | ?? | Intentional (launch script) |
| archive/chat.html.ui-regression-backup.2026-04-28 | ?? | Safety backup |
| archive/findings-2026-04-28/ | ?? | Findings dir |
| archive/index.js.codex-bak.2026-04-28 | ?? | Safety backup |
| archive/scheduler.js.codex-bak.2026-04-28 | ?? | Safety backup |

---

## GROUP F — SAFE items (reviewed individually)

### F1 — Encoding/mojibake cleanup (cosmetic only, no behavior change)

| File | Verdict | Origin |
|------|---------|--------|
| chat.html | **SAFE** | Em-dash and box-drawing Unicode mojibake replaced with plain ASCII. ~8 comment lines only. Zero logic change. |
| lib/daily-accumulator.js | **SAFE** | Same mojibake cleanup. Box-drawing section headers replaced with plain `// label`. Zero logic change. |
| agents/agent-14-kat.js | **SAFE** | Same mojibake cleanup. Section-header comments only. Zero logic change. |

Planned commit: *"Fix mojibake in CSS/JS comments (encoding artifact cleanup)"*

---

### F2 — today-levels-shim (new module)

| File | Verdict | Notes |
|------|---------|-------|
| lib/today-levels-shim.js | **SAFE** | 79 lines. Clean new module: getTodayLevelsFile, hasLevelsLoadedToday, levelsLoadedLabel, makeLevelsWarningPayload, appendBobbyVisionResult. No debug markers. |
| tests/today-levels-shim.test.js | **SAFE** | Tests for the shim. Paired with the lib file. |

---

### F3 — index.js: shim integration + encoding cleanup

| File | Verdict | Notes |
|------|---------|-------|
| index.js | **SAFE** | Imports 5 functions from lib/today-levels-shim.js. Also encoding cleanup on comments. console.log lines in the startup banner are long-standing and expected (not debug). |

Planned commit: *"Wire today-levels-shim into index.js startup"*

---

### F4 — slash-commands refactor: ingest extraction

| File | Verdict | Notes |
|------|---------|-------|
| lib/slash-commands.js | **SAFE** | 221 insertions, 345 deletions. Ingest handlers (/saty, /bobby, /dubz, /mancini) extracted to slash-commands-ingest.js. Imports trimmed from full parse libs to read-only: `loadSatyLevels, getSatyRecommendation` and `loadDubzState`. No debug markers. Consistent with lib/slash-commands-ingest.js. |
| lib/slash-commands-ingest.js | **SAFE** | 218 lines. Hosts the extracted ingest handlers. Direct counterpart to the slash-commands.js refactor. No debug markers. |
| lib/parse-bobby.js | **SAFE** | 2 lines added to LLM extraction prompt. Prevents hallucinated ES/NQ futures levels from SPXW data. Intentional prompt hardening. |
| lib/parse-dubz.js | **SAFE** | 14 lines. Adds todayKeyET() and stale-date guard to buildDubzStatus(). Returns STALE warning if saved levels are from a prior day. Clean and complete. |

Planned commit: *"Extract slash-command ingest handlers to slash-commands-ingest.js"*

---

### F5 — saty-auto-pull (new module + scheduler integration)

| File | Verdict | Notes |
|------|---------|-------|
| lib/saty-auto-pull.js | **SAFE** | 326 lines. Fetches SPX daily bars from Polygon, computes ATR ladder, stores as Saty levels. No debug markers. Guards: MASSIVE_API_KEY check, deduplicated via loadAutoPullState. |
| tests/saty-auto-pull.test.js | **SAFE** | Tests for the auto-pull module. Paired with lib file. |
| scheduler.js | **SAFE** | 37 lines added: setInterval at 8:25–8:35 ET window, weekday guard, dedup via lastAttemptET. Also encoding cleanup on 3 comment lines. Complete and self-contained. |

Planned commit: *"Add saty-auto-pull: automated Saty ATR ladder from Polygon at 8:30 ET"*

---

### F6 — llm-client (new fallback wrapper)

| File | Verdict | Notes |
|------|---------|-------|
| lib/llm-client.js | **SAFE** | 70 lines. Anthropic SDK wrapper with createMessageWithFallback(). Guards: allowFallback flag, isFallbackEligibleError() for 429/5xx. TECH_DEBT.md item "LLM failsafe" — this is the implementation. No debug markers. |

Planned commit: *"Add llm-client: Anthropic SDK wrapper with fallback routing"*

---

### F7 — confluence-engine: priceError handling

| File | Verdict | Notes |
|------|---------|-------|
| lib/confluence-engine.js | **SAFE** | Adds `priceError` option to buildVerdictMarkdown(). Shows "API Error" instead of blank when price fetch fails. Uses `_queryLevelsFn` (injectable, defined at line 6 as `let _queryLevelsFn = queryLevels`). No debug markers. |

Planned commit: *"Show API Error in verdict when live price fetch fails"*

---

### F8 — trading/router.js: atm_3pt lane B + freshness gate removal

| File | Verdict | Notes |
|------|---------|-------|
| trading/router.js | **SAFE** | Two changes: (1) removes Bobby/Dubz freshness gate in buildEntriesAlignment — consistent with fccd266 direction; (2) adds atm_3pt_scalp Lane B logic in stageTrade() with TP/SL caps and exposure guard (blocks if daily_pnl ≤ -$1000). Also encoding cleanup on 2 lines. **LIVE TRADING PATH** — both changes are complete with guards. No half-finished code. No TODOs. |

Planned commit: *"Add atm_3pt_scalp Lane B and remove stale Bobby/Dubz freshness gate"*

---

### F9 — test + config hygiene

| File | Verdict | Notes |
|------|---------|-------|
| tests/daily-accumulator.test.js | **SAFE** | 61 lines added. Adds describe block for heatmap readiness bridge with 3 tests. Clean, complete, no debug markers. |
| vitest.config.mjs | **SAFE** | 1 line: `fileParallelism: false`. Prevents EPERM atomic-rename collision on Windows. Consistent with the 1B EPERM fix rationale. |

Planned commit: *"Add heatmap bridge tests and disable vitest file parallelism"*

---

### F10 — TECH_DEBT.md doc

| File | Verdict | Notes |
|------|---------|-------|
| TECH_DEBT.md | **SAFE** | Adds 2026-04-28 Pre-Open Deferrals section (Saty auto-load + LLM failsafe). Both items are now implemented (lib/saty-auto-pull.js, lib/llm-client.js). |

Planned commit: *"Document 2026-04-28 pre-open deferrals in TECH_DEBT"*

---

## GROUP F — UNSAFE items (1 total)

### ⚠️ lib/saty-levels.js — UNSAFE

**Suspect line (line 96):**
```js
const rawData = text;
console.log("Raw Saty Data:", rawData);
```

This is a debug logging statement left in the production Saty text parser. Every call to `parseSatyText()` will dump the raw paste to stdout. The same diff also contains real functionality (thousands-separator strip: `text.replace(/(\d),(\d{3})(?!\d)/g, '$1$2')` and a tightened regex). The real changes should be committed; the console.log should be removed first.

**Recommendation:** Remove lines 95–96 (`const rawData = text; console.log(...)`) then commit. Do NOT stash the whole file — the comma-strip and regex fixes are real and needed.

**Planned action:** Per instructions, stash the whole file. User should remove the console.log and re-apply via `git stash pop`, then commit.

---

## FILES NOT COMMITTED (intentional)

| File | Reason |
|------|--------|
| .ws-token | Runtime auth token. Will add to .gitignore and git rm --cached. |
| repo-map.json | Generated file. .gitignore already adding it. Will git rm --cached. |

---

## UNSAFE ITEM COUNT: 1

Below the STOP threshold of 5. Phase 3 may proceed on explicit approval.

---

## PROPOSED COMMIT ORDER (Phase 3)

1. **Group C** — Remove archived crash logs and stale proposals
2. **Group A** — Add DATA SOURCES section to system prompt (Patch 1A)
3. **Group B** — Update stale tests for post-fccd266 recommendation lane (Patch 1B)
4. **Group D** — Add ES long bracket backtest infrastructure
5. **Group E** — Eval prep documentation and 2026-04-28 handoff archive
6. **F1** — Fix mojibake in CSS/JS comments
7. **F2+F3** — Wire today-levels-shim into index.js
8. **F4** — Extract slash-command ingest handlers
9. **F5** — Add saty-auto-pull
10. **F6** — Add llm-client
11. **F7** — confluence-engine priceError
12. **F8** — trading/router.js atm_3pt lane B
13. **F9** — heatmap bridge tests + vitest parallelism
14. **F10** — TECH_DEBT.md doc

**UNSAFE — awaiting manual fix:** lib/saty-levels.js (remove console.log at line 96 before committing)
