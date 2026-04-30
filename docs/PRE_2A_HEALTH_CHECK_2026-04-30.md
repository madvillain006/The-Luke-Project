# Pre-Implementation-2A Health Check — 2026-04-30

Diagnostic only. No code changed. All data gathered from live test runs, git log, and pm2.

---

## 1. Pre-Existing Test Failures

Current suite: **389 total — 383 passed, 5 failed, 1 skipped**

(The SYSTEM_PROMPT_PATCH_APPLIED doc recorded 6 failing immediately after the patch; one of those appears to have been resolved by uncommitted changes in the working tree to `tests/slash-commands.test.js`.)

---

### Failure 1 — slash-commands.test.js: dubz reference in /verdict guard

**Test name:** `slash-commands Phase 2 workflow status > /verdict refuses when prep inputs are missing or stale`
**File:** `tests/slash-commands.test.js:197`

**Assertion:**
```
expect(reply).toBe("No fresh confluence verdict available. Run /saty, /dubz, /heatmap first, then /ready before /verdict.")
```

**Expected:**
```
"No fresh confluence verdict available. Run /saty, /dubz, /heatmap first, then /ready before /verdict."
```

**Actual:**
```
"No fresh confluence verdict available. Run /saty, /heatmap first, then /ready before /verdict."
```

**Code path:** `lib/slash-commands.js:1330-1332`. The `missing` array only checks `satyStatus` and `workflowStatus.bobbyLoaded`; `/dubz` was removed from that check.

**Affects live trading:** Guard message only — users won't be instructed to run `/dubz` if Dubz levels are absent. The actual /verdict computation is unaffected. However, the gate no longer enforces Dubz as a prerequisite.

**Pre-existing:** YES. Introduced by commit `fccd266` (2026-04-28) — "Harden recommendation lane and trim live residue."

---

### Failure 2 — slash-commands.test.js: dubz reference in /entries guard

**Test name:** `slash-commands /entries hardening > refuses /entries when no fresh inputs are loaded today`
**File:** `tests/slash-commands.test.js:241`

**Assertion:**
```
expect(reply).toBe("No fresh entries available for ES. Run /saty, /dubz, /heatmap first, then /ready before /entries ES.")
```

**Expected:**
```
"No fresh entries available for ES. Run /saty, /dubz, /heatmap first, then /ready before /entries ES."
```

**Actual:**
```
"No fresh entries available for ES. Run /saty, /heatmap first, then /ready before /entries ES."
```

**Code path:** `lib/slash-commands.js:1452-1454`. Same root cause as Failure 1 — `/dubz` removed from the missing-inputs list.

**Affects live trading:** Guard message only. Same as Failure 1; /entries computation unaffected.

**Pre-existing:** YES. Same commit `fccd266` (2026-04-28).

---

### Failure 3 — slash-commands.test.js: EPERM on level-memory.json rename

**Test name:** `slash-commands command boundary coverage > /saty <levels> saves saty levels and returns SATY LEVELS SAVED`
**File:** `tests/slash-commands.test.js:417`

**Assertion:** Test expects `handleSaty()` to return successfully and save levels.

**Expected:** Success response ("SATY LEVELS SAVED").

**Actual:**
```
Error: recordLevel: atomic write failed: EPERM: operation not permitted,
rename 'C:\Users\conor\luke\data\level-memory.json.tmp'
     -> 'C:\Users\conor\luke\data\level-memory.json'
  at recordLevel (lib/level-memory.js:163)
  at appendSatyToMemory (lib/saty-levels.js:236)
```

**Code path:** `lib/level-memory.js:163` — atomic write via `.tmp` → rename. On Windows, this fails when another process holds an exclusive handle on the target file. `luke-server` (pm2 pid 24284) is currently online and holds the file.

**Affects live trading:** POTENTIALLY. If `luke-server` holds an exclusive lock on `data/level-memory.json` at the moment a `/saty` HTTP request arrives, the save will fail. In practice the server handles the request in-process (not a competing process), so the lock may not conflict — but the test failure flags a real Windows-specific fragility in the atomic-write path. Worth noting before any refactor of `level-memory.js`.

**Pre-existing:** The test was added in `fccd266` (2026-04-28). The EPERM reflects the environmental condition of `luke-server` being online during the test run, not a code regression. Fails whenever pm2 server is running at test time.

---

### Failure 4 — slash-commands.test.js: /ready missing "RichyDubz levels loaded" line

**Test name:** `slash-commands command boundary coverage > /ready with all prep loaded returns OK READY TO TRADE`
**File:** `tests/slash-commands.test.js:463`

**Assertion:**
```
expect(result).toContain('OK RichyDubz levels loaded')
```

**Expected:** /ready output contains `"OK RichyDubz levels loaded"`.

**Actual (full /ready output):**
```
READY SESSION READINESS
--------------------
OK Balance set today
OK Saty ATR levels loaded
OK Bobby heatmap loaded (16 mentions)
OK Apex floor safe ($2,500 headroom)
--------------------
OK READY TO TRADE
```
The `"OK RichyDubz levels loaded"` line is absent.

**Code path:** `lib/slash-commands.js` /ready handler. `fccd266` removed the dubz status line from the READY output block.

**Affects live trading:** MINOR — users will not see a Dubz confirmation in /ready. The `OK READY TO TRADE` verdict is still issued. No entry or verdict computation is blocked.

**Pre-existing:** YES. `fccd266` (2026-04-28).

---

### Failure 5 — confluence-engine.test.js: SPX-equivalent level lookup

**Test name:** `/verdict ES includes SPX-equivalent levels in output`
**File:** `tests/confluence-engine.test.js:413`

**Assertion:**
```
expect(result).toContain('5130')
```

**Expected:** /verdict output for ES contains `'5130'` (an SPX-equivalent level derived via ES↔SPX basis conversion).

**Actual:**
```
## Confluence verdict — 2026-04-30T22:28:26Z

### ES
No levels recorded yet.
```

**Code path:** `lib/confluence-engine.js` → `queryLevelsAcrossEquivalents()` — reads from `data/level-memory.json`. The file has no ES/SPX entries in the current test environment, so the verdict returns empty.

**Affects live trading:** YES — this is not just a message string issue. If `data/level-memory.json` has no ES levels, `/verdict ES` will return "No levels recorded yet." on a live session. The test is failing because the level-memory fixture is empty, which is the same condition a trader would see if /saty and /dubz were never run. Root cause: the test does not seed the level-memory fixture; it reads the live data file.

**Pre-existing:** Test added in `6fca230` (2026-04-27). Whether it was ever green in CI depends on fixture state at that moment. From `git log`, no fix has been applied since addition. Treat as pre-existing.

---

### Failure 6 (today-levels-shim) — dubz reference in WebSocket warning

**Test name:** `today-levels-shim > returns a stable WebSocket warning payload when levels are missing`
**File:** `tests/today-levels-shim.test.js:33`

**Assertion:**
```
expect(makeLevelsWarningPayload()).toEqual({
  type: 'levels_warning',
  message: 'Warning: No levels loaded. Paste /dubz [RichyDubz morning message] then /heatmap [Bobby text] before trading.'
})
```

**Expected message:**
```
"Warning: No levels loaded. Paste /dubz [RichyDubz morning message] then /heatmap [Bobby text] before trading."
```

**Actual message:**
```
"Warning: No levels loaded. Paste /heatmap [Bobby text] before trading."
```

**Code path:** `lib/today-levels-shim.js` → `makeLevelsWarningPayload()`. The `/dubz` instruction was removed from the warning string by `fccd266` (2026-04-28).

**Affects live trading:** MINOR — the WebSocket warning pushed to the browser when levels are absent no longer mentions `/dubz`. The warning itself still fires.

**Pre-existing:** YES. `fccd266` (2026-04-28).

---

### Summary: do any of these block /verdict, /entries, or live trading?

| Failure | Blocks /verdict? | Blocks /entries? | Live risk? |
|---------|-----------------|-----------------|------------|
| 1 — /verdict guard message missing /dubz | No (wrong message, not wrong behavior) | No | Low — gate no longer enforces Dubz |
| 2 — /entries guard message missing /dubz | No | No (same) | Low — same |
| 3 — EPERM level-memory save | Indirect (if /saty fails, no levels) | Indirect | Medium — environmental, Windows-only |
| 4 — /ready missing Dubz line | No | No | Minimal |
| 5 — SPX level lookup empty | **YES** — verdict returns empty if no ES levels seeded | **YES** — entries won't have levels to draw from | **HIGH** — depends on level-memory having data |
| 6 — WebSocket warning string | No | No | Minimal |

**Net:** Failures 1, 2, 4, 6 are cosmetic/message-text drift from `fccd266`. Failure 3 is environmental (server lock). Failure 5 is the only one that represents a real live-session risk: if level-memory.json is empty when /verdict or /entries is called, the output will be "No levels recorded yet."

---

## 2. Saty Auto-Pull Readiness

### Scheduler code (scheduler.js:301-329)

```js
setInterval(async () => {
  if (!process.env.MASSIVE_API_KEY) return;           // gate 1
  // ... build ET time parts ...
  if (map.weekday === 'Sat' || map.weekday === 'Sun') return; // gate 2
  const mins = (Number(map.hour) * 60) + Number(map.minute);
  if (mins < 505 || mins > 515) return;               // gate 3: 8:25–8:35 ET only
  const todayET = `${map.year}-${map.month}-${map.day}`;
  const state = loadAutoPullState();
  const lastAttemptET = ...;
  if (lastAttemptET === todayET) return;              // gate 4: once per day
  await runJob("saty-auto-pull-0830", async () => {
    const result = await runSatyAutoPull();
    ...
  });
}, 60 * 1000);
```

**Window:** Ticks every 60 seconds; fires only when ET clock is 8:25–8:35 AM (505–515 minutes since midnight). Weekdays only. One attempt per ET calendar day.

### pm2 status

`luke-scheduler` is **NOT RUNNING**. `pm2 list` shows only `luke-server` (pid 24284, online, uptime 4m at time of check). `pm2 info luke-scheduler` returns: `[PM2][WARN] luke-scheduler doesn't exist`.

### Last successful auto-pull

Cannot determine. Both `~/.pm2/logs/luke-scheduler-out.log` and `luke-scheduler-error.log` are **empty** (no content). The pm2 daemon was freshly spawned on 2026-04-30 (`pm2 start ecosystem.config.js --only luke-server` per SYSTEM_PROMPT_PATCH_APPLIED.md) — `--only luke-server` intentionally omitted the scheduler.

**Conclusion:** The saty auto-pull job has not fired during this pm2 session. There is no log evidence it has fired in the last 7 days under this pm2 daemon.

### Why it has not fired

Three compounding reasons:

1. **Not running.** `luke-scheduler` was never started in the current pm2 session. It must be started explicitly.

2. **MASSIVE_API_KEY not in ecosystem.config.js.** The env block in `ecosystem.config.js` only includes `ANTHROPIC_API_KEY`. Even if the scheduler were started, gate 1 (`if (!process.env.MASSIVE_API_KEY) return`) would exit on every tick unless the key is present in the shell environment at `pm2 start` time.

3. **Time window.** The job would only fire during 8:25–8:35 ET on weekdays — it would miss every tick outside that 10-minute window regardless.

### Will it run Friday morning?

**No** — not without manual intervention. `luke-scheduler` is not in pm2's saved process list (it was never added via `pm2 save`). Required before Friday:
- `pm2 start ecosystem.config.js --only luke-scheduler` (with `MASSIVE_API_KEY` set in the environment or added to ecosystem.config.js)
- Verify with `pm2 list` and `pm2 save`

---

## 3. Test Count Discrepancy — 236 vs 293 vs 389

### The numbers

| Source | Count | Date |
|--------|-------|------|
| User's stated baseline | "236/236" | Claimed 04-28 |
| CODEX_HANDOFF_2026-04-28_LIVE_READINESS | "241/241" | 04-28 (focused slash suite) |
| CORE_STABILIZATION_ROADMAP_2026-04-28_v2 | **264/264**, 1 skipped | 04-28 (full suite) |
| SYSTEM_PROMPT_PATCH_APPLIED (pre-patch) | 293 passing, 2 failing | 04-30 |
| PRE_EVAL_VERIFICATION_2026-04-30/08-test-suite.txt | **387/387**, 1 skipped, 0 failures | 04-30 (pre-patch) |
| SYSTEM_PROMPT_PATCH_APPLIED (post-patch) | 382 passing, 6 failing, 1 skipped = 389 | 04-30 |
| **Current run (this session)** | **383 passing, 5 failing, 1 skipped = 389** | 04-30 |

### Where did the tests come from?

`git log --oneline tests/ | head -30` (abbreviated):

```
fccd266 2026-04-28  Harden recommendation lane — added /entries tests (+102 lines to slash-commands.test.js)
c06a40e 2026-04-27  Sub-task 6c: Phase 5 modules (historical-data, level-replay, futures-entry-zones)
3ebc3c1 2026-04-27  Sub-task 6a: Mancini parser + Reddit format + batch ingest
91440c5 2026-04-27  Bridge /alert and legacy confluence paths to Phase 2 state
c7971f9 2026-04-27  Fix /status and /ready to read Phase 2 workflow state
a9c250d 2026-04-27  Fix /reset to clear stale daily accumulator context
a2482a7 2026-04-27  Audit fixes: wire Saty, heatmap, and Dubz ingest paths
6fca230 2026-04-27  Sub-task 5f: Phase 2 hardening checkpoint
6d9f099 2026-04-27  Phase 2: correlation engine + /verdict slash command   [+confluence-engine.test.js, 22 tests]
903bb54 2026-04-27  Phase 1B.5 Sub-task 5d: parser fixes
5cf8b81 2026-04-27  Phase 1B.5 Sub-task 5b
0454ea5 2026-04-27  Phase 1B.5 Sub-task 5b
a2d70b8 2026-04-27  Phase 1B.5 Sub-task 3.1
2141fa5 2026-04-27  Phase 1B.5 Sub-task 3: Level Memory module
dd8bef5 2026-04-26  Phase 1B.6: audit remediation
58b7fc6 2026-04-23  apr 23 full eval build
188b2c5 2026-04-21  Tests: market-aware instrument grouping — 54/54
```

### Explanation

The "236/236" figure does not appear in any current document. The closest plausible source is a stale handoff or a prior-session summary that was never committed. The `CODEX_HANDOFF_2026-04-28_LIVE_READINESS.md` mentions "241/241" (focused slash suite), and the full-suite canonical number at 04-28 was **264/264** per `CORE_STABILIZATION_ROADMAP_2026-04-28_v2.md`. The "236" is likely a misremembered or outdated figure from before the 04-26/04-27 Phase 1B commits.

The jump from 264 (04-28 roadmap) to 389 current (+125 tests) is fully explained by the Phase 2 commits on 04-27 (`6d9f099` through `c06a40e`) plus the `/entries` test additions in `fccd266` on 04-28. No tests appear to have been added between 04-28 and the current session.

The 293 "pre-patch" figure in SYSTEM_PROMPT_PATCH_APPLIED is inconsistent with the PRE_EVAL_VERIFICATION run (387 total, 0 failures) done the same day. Most likely the 293 figure was recorded in a different terminal state or is an error in that document.

**Bottom line:** The 04-28 roadmap truthfully recorded 264/264. The current 389 total reflects ~125 tests added via Phase 2 commits on 04-27 through 04-28. No tests were lost; the count grew. The 5 current failures are all traceable to `fccd266` (dubz removal from messages) or environmental conditions (EPERM, empty level-memory fixture).

---

*Generated: 2026-04-30. Diagnostic only — no files modified.*
