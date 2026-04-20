# JARVIS SELF-REVIEW — FULL TECHNICAL AUDIT
Generated: 2026-04-20
Reviewed by: Claude (external code review, no context from prior sessions)
Scope: All files listed in the audit request

---

## 1. ARCHITECTURAL SOUNDNESS

**Does the structure hold together?**

The skeleton is correct: Express HTTP hub, sub-routers mounted as agents, JSONL for append-only event logs, JSON for mutable state, WebSocket for browser notifications. That's a sane design for a single-user system. Agent boundaries are mostly clean — each agent is a separate Express router with its own system prompt and endpoints. The exception is `agent-02b-autonomous.js` which is a one-line re-export of `trading/router.js` (line 1). That's fine structurally but the naming hides that the whole 718-line trading engine lives in `trading/router.js`, not in the agents directory.

The serious problem is `index.js` at 1512 lines. It currently owns: HTTP server setup, WebSocket, shell/read/write/search/look action execution, six slash commands with all their logic inline, two parallel emotional state systems (one inline in index.js at lines 204-248, one imported from `lib/emotional-exits.js`), memory management, repo map building, boot checks, canary tests, panic endpoint, proactive alerts, session memory, agent routing, fallback routing, and tool health. That is 15+ distinct concerns in one file. Any change carries high collision risk.

**State management under load:**

JSONL files (trades.jsonl, discord-history.jsonl, jarvis-log.jsonl, luke-log.jsonl) are append-only so individual line corruption requires a truly unlucky write — acceptable. The dangerous case is `memory.json`: `index.js` writes it via `writeJsonAtomic` (state/lib), but `agent-02-trader.js:18` writes it with a plain `fs.writeFileSync`. If both run concurrently, the non-atomic write can produce a partial file, or overwrite bytes mid-write. `memory.json` holds `luke_last_log` — Luke's last health entry. This is the highest-stakes file in the system and it has two writers with different safety guarantees.

**What should be merged, split, or deleted:**

- Split `index.js`: extract slash commands to `lib/slash-commands.js`, action executor to `lib/actions.js`, emotional layer to the existing `lib/emotional-exits.js` (remove the duplicate inline version)
- `trading/router.js` fault injection test hooks (lines 638-716) live in the production file under a `NODE_ENV !== "production"` guard — but `NODE_ENV` is never set in `ecosystem.config.js`, so these endpoints are ALWAYS active. Move them or explicitly set `NODE_ENV=production`
- The duplicate `log()` and `loadMemory()/saveMemory()` functions defined separately in `index.js`, `agents/agent-02-trader.js`, and `agents/agent-04-health.js` should be one shared module
- `agent-08-sienna.js` has no connection to any live trade path. It is currently a research tool only. Do not merge it in until a clean lane is defined

---

## 2. WHAT ACTUALLY WORKS END-TO-END

The following paths are fully wired and manually testable today:

1. **`/alert [text]`** → `parseXimes("followthewhiterabblt", text)` → `loadTodayContext()` → `checkEmotionalState()` (hard block or soft warning) → `detectConfluence()` → SETUP/WEAK/SKIP with stop and target. Inputs: pasted Discord text + today-levels.json. Output: verdict in chat.

2. **`/levels [text]`** → `parseXimes("richydubz", ...)` per line → `parseBobby(text)` → saved to `data/today-levels.json`. Input: RichyDubz morning paste. Output: confirmation count.

3. **`/heatmap [text]`** → `parseBobby(text)` → appended to `data/today-levels.json bobby` array. Input: Bobby text paste. Output: node count.

4. **`/confluence`** → loads `today-levels.json` + last 48h `discord-history.jsonl` bobby messages → `detectConfluence()` → HIGH zones only. Fully functional.

5. **`/trade LONG SPY 699 702 WIN`** → validates ticker/direction/entry/exit/result → appends to `trades.jsonl`. Manual trade log works. Note: only accepts `SPY, SPX, NQ, ES, QQQ` — not MNQ/MES.

6. **`/review`** → reads today's trades from `trades.jsonl` → P&L summary + emotional state. Works.

7. **`/status`** → levels loaded check, today's trade count, emotional state, last signal, Luke med countdown. Works.

8. **Main chat with Opus 4-7** → system prompt with memory summary, session history, signals (if trading message), emotional layer, action parsing. Fully functional. Action executor (shell, read, list, search, look, click, type) works.

9. **`POST /agent/health/draft-luke`** → draft → `GET /agent/health/drafts-luke` → `POST /agent/health/confirm-luke` → persisted to `luke-log.jsonl` + `memory.json`. Confirm-before-commit workflow works.

10. **`GET /agent/autonomous/status`** → reads `state/snapshots/trading-state.json` → status payload. Works. `POST /agent/autonomous/start|stop|kill` work.

11. **`POST /see`** / **`POST /see-image`** → screenshot via desktop.py → Haiku vision. Works.

12. **`POST /research [url]`** → fetches URL → Haiku summary → optionally saved to `memory.agent06_research`. Works (SSRF risk documented separately).

---

## 3. WHAT IS HALF-BUILT OR DISCONNECTED

**trading/signals.js — `loadRecentSignals()`**: Filters for `source === "intraday-scraper"` entries in `discord-history.jsonl`. The intraday scraper is disabled (scheduler entirely commented out). This means `loadRecentSignals()` returns `{ ximes: [], bobby: [] }` every single time it's called. `POST /agent/autonomous/evaluate` calls this, finds no signals, and always returns `action: "skip"`. Agent 02B cannot stage any trade in its current state unless the intraday scraper has been run manually recently.

**`parseBobbyImage()`** (lib/parse-bobby.js:78-127): Fully implemented — takes base64 image, calls Haiku vision with `BOBBY_HEATMAP_RULES`, returns structured levels. Never called from any HTTP endpoint. The `/heatmap` command only calls `parseBobby(text)`. The vision path is dead code.

**`scheduler.js`**: Every `setInterval` block is commented out. The file exports `runScheduler()` which does nothing at runtime. No automated jobs fire: no morning briefing, no pre-market scan, no apex EOD update, no Tradovate health check, no daily token reset. Everything is manual.

**Two parallel emotional state systems**: `lib/emotional-exits.js` (the clean version, used in `/alert` and `/review`) and `detectEmotionalState()` in `index.js:204-248` (a separate regex-based system used in main chat). They have different signal sets, different state categories, and different outputs. They will disagree. One should be deleted.

**`agent-08-sienna.js`**: Has three working endpoints (`/analyze`, `/profile`, `/score-signal`, `/model`) but zero integration with the trading pipeline. `trading/signals.js` does not call Sienna. The `SIENNA_PROFILE.md` is referenced but the regime filter role described in `JARVIS_STATUS.md` is not implemented anywhere.

**`agents/agent-13-workflows.js`**: Listed in status, not audited, not referenced in `index.js` router mounts. Possibly dead.

**`data/today-levels.json`**: Written by `/levels` and `/heatmap`. The file is date-checked in `/confluence` and `/alert` — if the date doesn't match today, those commands say "not loaded." But there is no explicit error if the file doesn't exist at startup. `/alert` will silently skip Bobby context if this file is missing.

**Canary test (`/agent/autonomous/canary`)**: Broadcasts a synthetic `staged_trade` WebSocket event and sets `auto_skipped: true` after 30 seconds. This tests that the WebSocket fires and the timer runs, but it does NOT test the actual signal evaluation, scoring, or execution path.

**`NODE_ENV` test hooks in `trading/router.js:638-716`**: Three routes (`_test/inject-state`, `_test/simulate-protection-failure`, `_test/reconcile-phantom`) are always active because `NODE_ENV` is never set to "production". Anyone who can reach localhost:3000 can inject arbitrary state into the 02B trading system.

---

## 4. DANGER ZONES

**CRITICAL — ReferenceError on live protection failure** (`trading/execution-live.js:122-128`):
```
// DISABLED - human must flatten manually
// const flattenResult = await emergencyFlatten(creds, accountId, contractId, signal.direction);
log("execution-emergency-flatten-result", flattenResult);  // ← flattenResult is NOT DEFINED
```
If an entry order fills at Tradovate but all OCO protection retries fail, this code path runs. `flattenResult` was never declared (the defining line is commented out). Node.js throws `ReferenceError: flattenResult is not defined`. The error is caught by the outer try/catch in `router.js:209`, logged as "execute-staged-error", and the position sits LIVE at Tradovate with NO stop and NO target. The system is blocked (`execution_blocked = true`) but you have an open futures position. This is the single most dangerous bug in the codebase. Must be fixed before any live mode attempt.

**Memory corruption risk** (`agents/agent-02-trader.js:18`):
`saveMemory()` in agent-02-trader uses `fs.writeFileSync(MEMORY_FILE, ...)` — not atomic. If `index.js` calls its atomic `saveMemory()` concurrently, you get a race. `memory.json` holds `luke_last_log`. A corrupted memory.json means the last Luke health log is lost and `loadMemory()` returns `{}` until it's rebuilt. Low probability per event, but it's a write that happens on every trade log.

**SSRF** (`index.js:1090-1141`):
`POST /research` accepts any URL in `req.body.url` and fetches it server-side. Documented and acknowledged but still live. On a local-only install this is lower risk, but if the server were ever exposed it fetches internal URLs.

**Memory poisoning** (`index.js:1143-1152`):
`POST /memory` accepts any `key` and sets it in `memory.json`. No allowlist. Can overwrite `luke_last_log`, `current_state`, `apex` state, etc.

**Finnhub API key hardcoded in two places**:
- `trading/signals.js:4`: `const FINNHUB_KEY = "d7ibl19r01qu8vfo2410..."`
- `agents/agent-02-trader.js:11`: same key
Move to `.env` / `process.env.FINNHUB_KEY`.

**Always-active test hooks** (`trading/router.js:638-716`):
`POST /agent/autonomous/_test/inject-state` lets any caller inject arbitrary state (pending signals, open positions, kill flags) into the trading system. Always active because `NODE_ENV` is never "production". A bug or accidental call here can corrupt the trading state file. Set `NODE_ENV=production` in ecosystem.config.js immediately.

**Luke med notifications: NONE**:
There are zero automated reminders for the 4:00 AM and 4:30 AM med schedule. The scheduler is fully disabled. Agent-04 has no timer. The system prompt mentions the meds, and `/status` shows a countdown, but both require Conor to be awake and actively using Jarvis. If he oversleeps or doesn't open the chat, no notification fires. This is not a code bug — it is a missing feature. It is the highest safety risk outside of trading because the consequence is a missed med window for a dog with PLE.

---

## 5. CODE QUALITY

**Pattern that repeats and should be a single helper:**

`log(type, data)` is defined identically in `index.js:144`, `scheduler.js:9`, `agents/agent-02-trader.js:21`, `agents/agent-04-health.js:24`. All four write JSON lines to `jarvis-log.jsonl`. One module, four copies. A path change breaks all four separately.

`loadMemory()`/`saveMemory()` is defined in `index.js:106-142`, `agents/agent-02-trader.js:13-19`, and `agents/agent-04-health.js:15-21`. Three implementations with different safety guarantees (atomic vs non-atomic). Any feature that touches memory has to know which agent calls which version.

The "read JSONL, filter by date, parse lines, catch errors" pattern appears at least 8 times across `index.js:184-202`, `signals.js:196-222`, `router.js:536-567`, `emotional-exits.js:38-47`, and more. Each copy has subtle differences in cutoff logic, field names, and error handling.

**Files doing too much:**

`index.js` (1512 lines): Covered in Section 1. It will become unmaintainable the moment two people (or two AI sessions) try to edit it simultaneously. Adding a new slash command requires navigating past 1000 lines of unrelated code.

`trading/router.js` (718 lines): The production trade router, Apex EOD update, daily reset, reconciliation, performance reporting, shadow mode management, replay, and fault injection test hooks all live here. Any of these can fail in ways that corrupt the others' state.

`trading/signals.js` (322 lines): Signal loading, price fetching, candidate building, sanity checks, and Claude API scoring all in one file. The `scoreSignals` function calls Claude, parses JSON, and does post-score sanity validation — three distinct concerns that make the function hard to test or debug when signals don't execute.

**Three worst files by maintainability:**
1. `index.js` — will break under any significant refactor
2. `trading/router.js` — test hooks active in production; fault path in execute-staged has a live bug
3. `trading/signals.js` — signal scoring is a black box with 7 early-return paths, all silent failures returning `execute: false`

---

## 6. TOKEN EFFICIENCY

**Main chat prompt is expensive every call:**
`buildSystemPrompt()` (index.js:289-354) includes: repoBlock (~300 tokens), persona (~250 tokens), session history (up to 10 × 300-char entries = ~750 tokens), Discord signal block (if trading message: up to 20 signals × 300 chars = ~1500 tokens), memory summary (up to 800 chars = ~200 tokens). That's roughly 3000 input tokens per main chat message before the user's actual message. At Opus 4-7, that adds up fast.

**Acknowledgment call doubles cost on routed messages:**
`index.js:950-966`: When a message routes to an agent, it calls the agent endpoint, gets a result, then makes a SECOND Claude API call (Haiku) with the full `buildSystemPrompt()` just to acknowledge the result in one sentence. So every Luke health log, every trade log, every income log = two Claude calls. The ack call could use a much shorter system prompt (50 tokens instead of 3000).

**Opus used for main chat:**
`index.js:987`: `model: "claude-opus-4-7"` for all non-routed chat. This is correct for complex reasoning but the same model handles "what time is it?" as it handles signal analysis. Consider routing low-complexity messages to Haiku based on keyword detection.

**Sienna `/analyze` call cost:**
`agent-08-sienna.js:86-99`: Up to 12 Haiku calls per file, then one Opus call for synthesis. If 5 files are present, that's 60+ Haiku + 1 Opus per analyze run. This endpoint is manual-only, not a concern for daily usage, but it will be expensive if triggered.

**Token tracking gap:**
`trackUsage()` is called after main chat Opus (line 993) and main chat ack Haiku (line 960). It is NOT called in: `/research` endpoint (line 1120), `verifyScreen()` inside action execution (line 373), Sienna calls. Actual token burn is higher than tracked.

**Estimate:** The ack wrapper adds approximately 40-50% overhead to all routed messages. If most chat interactions are routed (Luke health, income shifts, trade analysis), you're paying ~1.5x the necessary cost for those calls. Switching the ack to a minimal system prompt would halve ack costs.

---

## 7. SAFETY AUDIT

**Path: Ximes posts alert → Jarvis responds**

1. User copies Discord message, types `/alert [paste]`
2. `index.js:770`: loads `tradeCtx` from `loadTodayContext()` → reads `trades.jsonl`
3. `checkEmotionalState(tradeCtx)`: checks losses (≥2 = HARD block), drawdown (≥2% = HARD), time since last trade (<5 min = HARD, <15 min after loss = HARD). Hard blocks return immediately — correct.
4. `parseXimes("followthewhiterabblt", text, null, null, null)` — **silent failure point**: username is hardcoded as "followthewhiterabblt". If the user pastes an alert and ANALYST_MAP doesn't recognize the username (e.g. "ximestrades" — mentioned in JARVIS_STATUS.md:36 but NOT in lib/parse-ximes.js ANALYST_MAP), `parseXimes` returns null and the response is "❌ SKIP — could not parse signal". No error, no indication of the real problem.
5. `loadLevels()` → loads `today-levels.json`. If not loaded today, `obj.bobby = []`. Confluence check runs with empty Bobby context — will likely return SKIP silently.
6. `detectConfluence(...)` → `inferInstrument(strike)` → checks if strike > 3000 (ES/NQ), >= 500 (SPX), >= 100 (SPY). If strike is parsed as a premium price (e.g. $3.50) it returns null — **silent skip** with no explanation.
7. Output: SETUP/WEAK/SKIP with confidence and suggested stop.

The path is mostly safe. The main failure mode is silent mis-classification returning SKIP when the real issue is a missing username or stale levels.

**Path: /trade logged → trades.jsonl**

1. `index.js:809`: validates direction (LONG/SHORT), ticker (hardcoded list: SPY/SPX/NQ/ES/QQQ), entry/exit (float), result (WIN/LOSS/SCRATCH)
2. Computes pnl based on direction
3. `fs.appendFileSync(TRADES_JSONL, JSON.stringify(tradeEntry) + "\n")` — direct append, no atomic

**Silent failure point**: Ticker list does not include MNQ or MES. If you use 02B for MNQ paper trades and try to manually log one via `/trade`, it will respond with `VALID_FORMAT` with no explanation of why MNQ was rejected. The manual and autonomous trade logs are fundamentally mismatched.

**Silent failure point**: No duplicate detection. Rapid double-submit logs the same trade twice.

**Path: Luke med time → notification fires**

This path does not exist. There is no timer, cron, or process that fires at 4:00 AM or 4:30 AM. The only references to Luke's med schedule in live code are: (a) static text in `buildSystemPrompt()` (displayed to Claude, not Conor), (b) static text in `/status` output (requires Conor to ask), (c) static text in `scheduler.js:126` inside the morning briefing function — which is commented out. The `/status` command shows "⏰ upcoming" or "✅ due" based on ET time, but only if you type `/status`. **There is zero proactive notification for Luke's meds. This must be treated as a P0 gap.**

---

## 8. READINESS FOR LIVE USE

**Manual /alert workflow (paste signals):** Ready to test tomorrow. The full path from paste → parse → confluence → emotional gate → SETUP/WEAK/SKIP is wired. You need to run `/levels` and `/heatmap` first each morning. If those aren't done, all signals will return SKIP silently.

**Agent 02B paper mode:** NOT ready. `loadRecentSignals()` in `trading/signals.js` filters for `source === "intraday-scraper"` entries. The intraday scraper is disabled. Every call to `POST /agent/autonomous/evaluate` returns "No ximes signals in last 2 hours" or "No bobby signals." 02B will never stage a trade until the intraday scraper is running and producing entries with `source: "intraday-scraper"`. The 25 paper trades required before live will never accumulate at this rate.

**Agent 02B live mode:** NOT safe. The `ReferenceError: flattenResult is not defined` bug in `execution-live.js:126` MUST be fixed before any live trade. If it fires in production, you have an open futures position with no protection and a crashed error handler.

**What breaks first in a morning session:**
If `/levels` and `/heatmap` aren't pasted before the first `/alert`, every single signal will return SKIP. The system gives no indication that this is why — it just says "no confluence at [level] today." You will interpret legitimate setups as poor signals.

**Highest single risk moment:**
Switching 02B from paper to live mode without fixing the `flattenResult` ReferenceError. A single OCO retry failure results in an open position, no stop, and a crashed execution handler — with no automated flatten.

**Safe to test tomorrow? YES, with the manual `/alert` workflow only.** Do not start 02B in any mode until: (1) intraday scraper is running and feeding history, (2) the flattenResult bug is fixed, (3) the test hooks are disabled in production.

---

## 9. IF YOU WERE CONOR

Six weeks. Two hard deadlines: Apex eval passed, Luke meds never missed. Here is the exact next move.

Fix the Luke med notification today, before anything else. Not tomorrow, today. You have a dog with PLE whose meds depend on you being awake at 4AM — and right now the system you built to handle everything requiring selling yourself does exactly nothing at 4AM. Wire a 4:00 AM WebSocket notification via `POST /notify` using any method that will actually wake you: the existing Electron shell, a cron on your machine, a Windows Task Scheduler entry, anything. One push notification that says "Luke: Omeprazole NOW" and another at 4:30 that says "Luke: Mirtazapine + Prednisone WITH FOOD." That's 30 minutes of work and it is the most important thing in this codebase.

After that, fix the `flattenResult` ReferenceError in `execution-live.js:126` — delete that line entirely since the emergency flatten is disabled anyway — and set `NODE_ENV=production` in `ecosystem.config.js` to disable the test injection hooks. Then get the intraday scraper running manually before each session so 02B can actually evaluate signals and start accumulating paper trades toward the 25-trade requirement. The Apex eval cannot be passed if 02B never stages a trade. You have the pieces. The ingest is done. The confluence engine works. The risk gates are solid. The one thing that prevents paper mode from functioning is that `loadRecentSignals()` is looking for data that a disabled scraper never produces. Run the scraper, check that `discord-history.jsonl` has entries with `source: "intraday-scraper"`, and 02B will start working.

The manual `/alert` workflow is your fallback during all of this and it is production-ready today. Use it every morning session regardless of what else you're building.

---

## SUMMARY TABLE

| Area | Status | Priority |
|------|--------|----------|
| Luke med notifications | ❌ MISSING — zero automation | P0 |
| execution-live.js ReferenceError | 🔴 CRASHES on protection failure | P0 before live mode |
| Test hooks in production | 🟡 Always active, state-injectable | P1 |
| 02B intraday signal feed | ❌ Always empty — scraper disabled | P1 for paper mode |
| /alert manual workflow | ✅ Fully wired, testable today | — |
| Trade logging (/trade) | ✅ Works, MNQ/MES not in ticker list | P2 |
| Memory.json race condition | 🟡 agent-02-trader non-atomic write | P2 |
| Finnhub key hardcoded | 🟡 Two files | P2 |
| ximestrades missing from ANALYST_MAP | 🟡 Silent misses | P2 |
| Dual emotional state systems | 🟡 Will diverge | P3 |
| index.js God file | 🟡 Maintainability risk | P3 |
| Token efficiency (ack calls) | 🟡 ~40% overhead | P3 |
