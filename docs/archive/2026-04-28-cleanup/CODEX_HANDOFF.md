# Codex Handoff — Luke Trading Copilot

**Status:** Pre-handoff. This document captures the state of Luke at the conclusion of Sub-task 5f. Codex is taking over for ruthless audit, end-to-end validation, and finishing any work needed to get the system trade-ready for the user's Apex 50k EOD Trail eval.

**Repo:** `C:\Users\conor\luke` on `phase-1b5` branch (unmerged, unpushed).
**User:** Conor — independent futures trader, builds the levels and curates the data; you handle the code and the audit.
**Stakes:** This is a $50,717 funded eval account. The user is ~$2,283 from the $53k payout target. After payout, this becomes funded capital. **Do not break /alert or any code path that touches the live trading workflow.**

---

## 1. WHAT THIS PROJECT IS

Luke is a personal trading copilot. The user trades ES futures on the Apex eval and follows three Discord-based analysts:

- **Bobby** (BOBBY [SKY], `bobby-spx-coms` channel) — posts dealer gamma heatmaps as 3-panel screenshots showing SPXW + SPY + QQQ with king nodes, walls, floors. Vision-parsed.
- **Dubz** (RichyDubz [$OWL], `dubz-ximes` channel) — posts morning briefs with key levels for NQ/ES/SPY/QQQ + chart screenshots. Text-parsed + vision-parsed.
- **Ximes** (followthewhiterabblt, same channel) — posts LIVE_ENTRY trade alerts. Text-parsed only. **Drives `/alert` copy-trade pipeline. Do not touch this code.**

Plus two non-Discord level sources:

- **Saty ATR Levels** — TradingView indicator. User pastes 13 levels via `/saty`.
- **Mancini** — Adam Mancini SPX levels from Twitter. Currently a holding file (`fixtures/mancini/inbox.md`); parser deferred to Phase 3+ post-payout.

The system normalizes all level data into a single `Level Memory` store (`data/level-memory.json`), then a confluence engine (Phase 2, just shipped) produces a `/verdict` slash command output that grades each level A–F based on how many analysts agree on it.

**The user's workflow Monday morning** is:
1. Paste Saty levels → `/saty <text>`
2. Wait for Bobby to post first heatmap → drag image into chat → `/heatmap`
3. Wait for Dubz morning brief → paste text + image into chat → `/dubz`
4. Run `/verdict` to see ranked confluence
5. When Ximes posts LIVE_ENTRY → `/alert <text>` triggers the trade gate
6. Place the trade in Tradovate manually if Luke approves

**The trade-readiness bar is:** can Luke produce a sensible `/verdict` output Monday morning that the user can eyes-on-screen verify and trade off? Today the answer is "probably not without your audit."

---

## 2. ARCHITECTURE

**Stack:** Node.js / Express, pm2 (`luke-server`, `luke-scheduler`), localhost:3000. Electron desktop UI (`electron.js` + `chat.html` + `preload.js`). Vitest for tests. Anthropic SDK for chat + vision. Polygon ("Massive Market") for live prices.

**Critical files (read these first):**

```
lib/
  level-memory.js         # Canonical level store. Append-only. Per-instrument tolerances.
  parse-bobby.js          # Bobby text + vision parsers. panels[] schema.
  parse-dubz.js           # Dubz text + vision parsers. Cross-source dedup.
  parse-ximes.js          # Ximes LIVE_ENTRY parser. UNTOUCHED IN PHASE 2 — do not modify.
  saty-levels.js          # Saty ATR parsing.
  live-price.js           # Polygon client. SPY/QQQ live; SPX/ES/NQ approximated.
  confluence-engine.js    # Phase 2: scoreLevel + queryLevelsAcrossEquivalents + buildVerdictMarkdown.
  confluence.js           # OLD confluence module. Used by /alert. Do not confuse with confluence-engine.js.
  slash-commands.js       # All /xxx command handlers. Mostly correct.
  bracket-calc.js         # Trade bracket calculator. Used by /alert.

index.js                  # Express server, WebSocket, route handlers.
chat.html                 # 79KB single-file UI. Drag-drop, paste-detect, slash commands.
electron.js               # Desktop wrapper.
preload.js                # Electron IPC bridge.

tests/                    # Vitest. Currently 143/143 (or 158/158 after 5f).
fixtures/bobby/           # 19 timestamped Bobby heatmap images + commentary log + synthetic bearish.
fixtures/dubz/            # 3 fixture sets (Apr 26 + Apr 27 morning).
fixtures/mancini/inbox.md # Holding file for Mancini SPX levels.

data/
  level-memory.json       # Canonical level store. Currently has only Saty entries.
  level-memory-backup-pre-5f.json  # Backup if 5f ran integration test.
  today-levels.json       # Legacy per-day file. Used by /confluence (the old engine).
  saty-levels.json        # Today's Saty paste.
  dubz-levels.json        # Today's Dubz state (cross-source-dedupped).

docs/
  MONDAY_OPS.md           # Pre-trading checklist.
  validation-5d-bobby-final.txt  # Real Bobby vision output against fixtures.
  validation-5d-dubz-final.txt   # Real Dubz vision output against fixtures.
  CODEX_HANDOFF.md        # This file.

TECH_DEBT.md              # Deferred decisions. READ THIS — it captures things that look like
                          # gaps but are intentional deferrals to post-payout.
```

**What you can ignore:**
- `agents/` — autonomous trading agents. Not part of the manual workflow Conor uses. Some are inert.
- `archive/` — archived old code paths.
- `discord-exports/` — historical exports, mostly with expired CDN images.
- `proposals/`, `ideas/`, `findings/` — historical artifacts.
- `workflows/`, `workflow-recordings/` — Claude in Chrome experiment, separate.
- `agents/agent-09-architect`, `agent-10-sweeper` — internal nightly housekeeping. Not trade-path.

---

## 3. WHAT JUST SHIPPED (5d + Phase 2 + 5f)

**5d (commit `903bb54`):** Bobby parser fixes — per-instrument panels schema, deterministic wall classification, king-node dedup, commentary-only bias, vision/text disagreement surfacing for Dubz.

**Phase 2 (commit `6d9f099`):** Correlation engine + `/verdict` slash command. Scoring formula: distinct-analyst count × 0.20 + key significance 0.15 + king node 0.10 + cross-source confirmation 0.15 + recency 0.10. Cross-instrument equivalence (ES↔SPX, NQ↔QQQ) handled at engine layer, not Level Memory.

**5f (latest commit, see git log):** Five correctness fixes:
1. parseBobby array-pollution dedup
2. pricesNear regex {3,7} → {3,9}
3. crossSourceConfirmed wired through Level Memory
4. ES↔SPX basis sign flipped (was inverted, 60pt offset on cross-instrument levels)
5. SPY/QQQ canonical tolerance 0.05 → 0.50

**Tests after 5f:** Should be ~158 passing. Confirm with `npx vitest run` first thing.

---

## 4. KNOWN ISSUES YOU SHOULD VERIFY OR FIX

The previous Claude (me) flagged these but did not personally inspect them under Codex's scrutiny. **Examine each independently.** I may be wrong on any of them.

### 4.1 Issues 5f attempted to fix — verify the fix actually works

For each fix, run the relevant test, then run an integration scenario:

**5f Gate 1 — parseBobby array pollution:**
- The synthetic bearish fixture (`fixtures/bobby/synthetic-bearish-bobby.txt`) used to return 7100 and 7180 in king_nodes AND support AND resistance simultaneously. Verify that no longer happens. Confirm by running parseBobby on that fixture and inspecting output.
- **Adversarial test:** craft text where keywords overlap but in non-obvious ways. E.g. "the gatekeeper at 7180 is the upper wall, which traders are using as a cushion above the support zone at 7150." Does the parser produce sensible output, or does keyword overlap still pollute?

**5f Gate 3 — crossSourceConfirmed propagation:**
- Read `lib/level-memory.js` → does `recordLevel` accept and store the `crossSourceConfirmed` field?
- Read `lib/parse-dubz.js` `appendDubzToMemory` → does it pass `crossSourceConfirmed: level.crossSourceConfirmed` through?
- Read `lib/parse-bobby.js` `appendBobbyToMemory` → does it compute crossSourceConfirmed for the merged path correctly?
- **Integration test:** with empty Level Memory, run a Dubz fixture that has matching text+image levels. Query Level Memory. Confirm at least one mention has `crossSourceConfirmed: true`. Then run `/verdict` and verify the score for that level reflects the +0.15 weight.

**5f Gate 4 — ES↔SPX basis sign:**
- The basis was `-30` for both directions in the original Phase 2 commit, which is mathematically inverted. Real-world: ES futures trade ABOVE SPX cash by ~30 points (ES = SPX + 30, per `live-price.js` line 76).
- After 5f, ES querying SPX should return SPX 7100 → ES 7130. SPX querying ES should return ES 7130 → SPX 7100.
- **Verify the fix didn't break test T13** which originally asserted the wrong direction. The expected value should be 5130 (5100 + 30), not 5070.
- **Adversarial test:** add a Bobby SPXW king node at 7160, run `/verdict ES`, confirm output shows ES 7190 (not ES 7130).

**5f Gate 5 — SPY/QQQ tolerance:**
- CANONICAL_TOLERANCE for SPY and QQQ was 0.05. Bobby's vision returns integer-priced king nodes that drift 1-3pt between successive 5-minute reads (711 → 712 → 714).
- After 5f, tolerance should be 0.50.
- **Integration test:** simulate two appendBobbyToMemory calls 5 minutes apart with SPY king nodes at 711 and 712. Confirm Level Memory has ONE canonical record at 711 with two mentions, not two separate records.
- **Risk to verify:** Dubz's precise prices like SPY 712.38 used to land in their own canonical. With 0.50 tolerance, they'll attach to Bobby's 712 canonical. This is intentional cross-source confluence. Make sure the canonical_price displays sensibly in `/verdict` output (first-seen wins, so if Bobby seeded 712 first, the display will show "SPY 712" — correct behavior).

### 4.2 Issues that may still exist

**Live-price grounding integration:**
- `parseBobbyImage` and `parseDubzImage` accept `livePrices` parameter. Production path fetches via `getLivePrice()` if not provided.
- The validation harness in `docs/validation-5d-bobby-final.txt` was run with `MASSIVE_API_KEY` UNSET. Every fixture shows `[live-price] MASSIVE_API_KEY not set — live price unavailable`.
- **You need to test the grounded path with `MASSIVE_API_KEY` set against real Polygon data.** This has never been verified. Failure modes mocks don't catch: schema mismatches between `getGroundedPrice()` and `live-price.js` return shape, type coercion, missing fields when Polygon returns partial data, behavior when SPY but not QQQ is available.
- **Test:** set MASSIVE_API_KEY, run `node scripts/validate-bobby-fixtures.js`, confirm grounded prices flow into classification correctly. Document any deviations.

**`appendBobbyToMemory` source_type mislabeling:**
- When Bobby's source is `'bobby-merged'` (text + vision combined), every mention gets `source_type: 'vision'` regardless of whether the price came from text or vision.
- Currently no immediate harm — Phase 2's `scoreLevel` doesn't use source_type for Bobby. But Phase 5+ backtest will need accurate provenance.
- Captured as TECH_DEBT entry already (or should be — verify).

**Phase 2 has zero integration tests against actual `level-memory.json`:**
- All Phase 2 tests use `_setQueryLevels` to mock the data layer. No tests exercise the real `queryLevels` reading the real file.
- **Add at least one integration test:** spin up a temp Level Memory file, write fixture mentions via `recordLevel`, run `buildVerdictMarkdown`, assert output structure.

**The ES/SPX basis is hardcoded at 30 but observed at ~55:**
- `live-price.js` line 75 comment: "Observed 2026-04-24 actual basis was closer to SPX + 55."
- After 5f, the confluence engine uses +30. If the real basis is +55, every cross-instrument level is offset by ~25 points.
- **Decide:** stay with 30 (consistent with live-price.js) or update to 55 (closer to reality). My recommendation: ship with 30 to keep consistency, capture as TECH_DEBT, fix once rolling-basis calculation lands.

**parseBobby's keyword regex still has overlap issues even after 5f Gate 1:**
- The dedup happens AFTER pricesNear extraction. But pricesNear's window-extension logic itself may be picking up prices from ambiguous contexts.
- **Adversarial test:** "support holding at 7100, resistance came in at 7150, but watch for failure of 7100 if we lose 7080." Does the parser correctly split these?

### 4.3 Things I never verified

**The UI:**
- `chat.html` is 79KB. I never opened it. The user has never tested:
  - Drag-and-drop image into chat
  - Copy-paste large blocks of text
  - Slash command typing
  - Buttons / status chips / regime indicators
  - Whether the chat actually displays /verdict output as markdown (it should, but verify)
- **Open the Electron app, run through the full Monday workflow manually. Document everything broken.**

**The WebSocket integration:**
- `index.js` broadcasts `staged_trade` events to the trade popup. Never tested whether the popup actually pops up. The popup HTML exists at `trade-popup.html`.
- **Test:** trigger a `/alert` with valid SETUP confluence. Does the popup fire? Does it show the right info?

**`/heatmap` image upload path:**
- The user's intent is "drag image, type /heatmap, hit send." Server-side: `index.js` line 215 reads `req.body.image` for /chat with image content-type. `slash-commands.js` line 247-248 checks `res._heatmapImage` and `res._dubzImage`.
- **Verify the path actually works end-to-end.** Drag a fixture PNG, type /heatmap, confirm vision parses and the panel data flows through.

**Drag-drop file naming:**
- When the user drops an image, what does the server see? Is it the file path? The base64? Does the type matter?
- The MIME-type detection in `parse-bobby.js detectMediaType` is robust to PNG/JPEG/GIF/WebP. But test the actual drop event.

**Discord ingest pipeline:**
- `agents/agent-14-kat.js` is a Discord client that listens to specific channels and writes to Level Memory. Never verified end-to-end. Probably untouched by 5d/Phase 2/5f.
- **You can ignore this for trade-readiness.** Manual workflow does not depend on it. If it's broken, that's a separate cleanup task.

**`/alert` path under real Ximes signal:**
- The /alert handler is the most battle-tested path in the system but I haven't verified it still works after Phase 2 changes. It calls `detectConfluence` from the OLD `lib/confluence.js`, NOT the new `lib/confluence-engine.js`.
- **Check:** does `/alert` still produce a SETUP/SKIP verdict against real fixture data? Does the popup fire?

---

## 5. THINGS THAT ARE INTENTIONAL — DO NOT "FIX"

These will look wrong. They are not.

1. **The OLD `lib/confluence.js` and the NEW `lib/confluence-engine.js` coexist.** `/alert` uses the old one. `/verdict` uses the new one. Migrating `/alert` to use the new engine is OUT OF SCOPE — it's working, it's been in production, the user is on a $50k floor.

2. **`fixtures/mancini/inbox.md` has no parser.** Mancini integration is deferred to Phase 3+ post-payout per TECH_DEBT.md. The user is pasting Mancini levels manually into the holding file. Do not build a parser.

3. **`crossSourceConfirmed` is computed in parsers but Bobby's text + vision rarely both have prices.** For Bobby, this flag only fires when text DOES have prices that match vision panel king_nodes. Most Bobby commentary is bias-only. This is by design.

4. **`ecosystem.config.js` does NOT include `luke-intraday`.** It was archived in Phase 1B.6.2. The `/intraday/start` and `/premarket` endpoints exist but the `/premarket` route returns 503 deliberately.

5. **`live-price.js` uses ES = SPX + 30, observed real basis is ~+55.** This is a known approximation. Fix is gated on rolling-basis calculation work which is post-payout.

6. **The `archive/` directory has old code.** Don't delete or refactor it. It's there for traceability.

7. **`scheduler.js` has cron jobs for nightly tasks.** Some of those tasks are inert because dependent agents are stubbed. Not a priority.

8. **`SPX_W` panels in Bobby vision get mapped to `SPX` instrument key in Level Memory.** This is intentional — same underlying for level tracking purposes. See `TICKER_TO_INSTRUMENT` in `parse-bobby.js`.

9. **The user runs `/balance <amount>` daily to set the Apex floor.** This is captured in MONDAY_OPS.md gate. Don't try to automate it; the user wants the manual ritual.

10. **The OLD `/confluence` slash command coexists with `/verdict`.** They do different things. Don't merge them.

---

## 6. AUDIT PROTOCOL — WHAT I'M ASKING YOU TO DO

In order:

### Phase A — verify 5f shipped clean
1. `git log --oneline -10` and confirm 5f commit is there.
2. `npx vitest run` — all tests pass.
3. Re-read each 5f gate's tests. For each, write one adversarial test that probes the boundary. Confirm the fix holds.

### Phase B — UI smoke test (HIGHEST PRIORITY)
This is the part I never touched. The user has never confirmed any of it works.

1. Open Electron app: `npm start` from project root.
2. Type `/status` → confirm output renders.
3. Paste a Saty fixture into chat without leading slash → does paste-detect route it correctly?
4. Type `/saty <13 levels>` → does the chat display confirmation?
5. Drag a Bobby PNG fixture into chat (use `fixtures/bobby/2026-04-27_1003_bobby_3panel.png`). Does the image preview show? Does the slash command type-ahead work?
6. Type `/heatmap` after dragging → does vision fire? Does the response render?
7. Run `/dubz` with a Dubz fixture (text + image).
8. Run `/verdict` → does the markdown render correctly in chat? Are scores displayed? Are flags shown?
9. Run `/alert` with a fixture LIVE_ENTRY signal → does the trade popup fire? Does the bracket calc render?
10. Test `/balance 50717` → does it update?
11. Test `/ready` → does it return correct status?
12. Test `/reset` → does it clear daily state?

**Document EVERY thing that breaks, every UX issue, every confusing display.** The user has never seen this UI work end-to-end. You are the first set of eyes on it.

### Phase C — End-to-end production data integration test
1. Set `MASSIVE_API_KEY` in `.env` (user provides).
2. Backup `data/level-memory.json` to `data/level-memory-backup-pre-codex-test.json`.
3. Reset `data/level-memory.json` to `{"version":1,"last_updated":null,"levels":[]}`.
4. `pm2 reload ecosystem.config.js`.
5. Run the full Monday workflow against fixtures:
   - `/saty <Apr 23 levels from level-memory-backup>`
   - `/heatmap` with `fixtures/bobby/2026-04-27_1003_bobby_3panel.png`
   - `/dubz` with `fixtures/dubz/2026-04-27_0859_dubz.txt` + image
   - `/verdict`
6. Confirm `data/level-memory.json` has Saty + Bobby + Dubz mentions.
7. Confirm `/verdict` output shows confluent levels correctly graded.
8. **Specifically verify the ES↔SPX basis fix:** Saty SPX 7105 should appear in `/verdict ES` output as ES 7135 (NOT ES 7075).
9. Restore from backup if needed.

### Phase D — Adversarial edge cases
For each, document behavior:
1. What happens if the user pastes garbage into `/dubz`? Does it crash?
2. What happens if vision API returns malformed JSON? (Inject by mocking.)
3. What happens if Polygon returns 429 rate limit?
4. What happens if `data/level-memory.json` is corrupted JSON?
5. What happens if the user runs `/verdict` before any analyst pastes?
6. What happens if Bobby posts an image with no text and the parser returns null?
7. What happens during the lunch chop window (12-1 PM ET) — does `/alert` block correctly?
8. What happens if pm2 restart loses in-memory state mid-session (e.g. recentAlerts, lastVisionCallMs)?
9. What happens with NQ at 26,884.75 (5-digit comma price) through Bobby text path post-5f?
10. What happens if the user's Apex floor is breached mid-day — does `/alert` correctly block all subsequent SETUPs?

### Phase E — Code-level audit
After A through D, do a deep read pass of these files. Look for things I missed:

1. `lib/level-memory.js` — is the canonical-match logic resilient to floating-point edge cases?
2. `lib/parse-bobby.js normalizePanels` — is the deterministic reclassification truly deterministic, or does it depend on input array order?
3. `lib/parse-dubz.js mergeDubzInputs` — the cross-source dedup loop is O(N²). Is that acceptable at production scale?
4. `lib/confluence-engine.js scoreLevel` — does the recency calculation handle DST transitions correctly?
5. `lib/confluence-engine.js queryLevelsAcrossEquivalents` — does the cross-instrument layer handle the case where the same canonical price exists in BOTH instruments natively?
6. `lib/slash-commands.js handleSlashCommand` — is there a routing collision when a slash command name is a prefix of another (e.g. `/dubz` and `/dubz-something`)?
7. `index.js` — the `/chat` body parser has a 10MB limit for images and 100KB for everything else. Is that enough for Bobby's 3-panel high-res screenshots?
8. `chat.html` — paste-detection logic. Does it correctly route Bobby paste vs Dubz paste vs raw text?
9. `electron.js` — does the trade popup IPC actually work?
10. `preload.js` — minimal but verify the contextBridge is secure.

### Phase F — Hand back
Write `docs/CODEX_AUDIT_REPORT.md` with:
- Verified working: list every component you confirmed works end-to-end.
- Verified broken: list every issue you found, with reproduction steps.
- Verified unfixable in scope: anything that needs user decision.
- Trade-readiness percentage: your honest number, with reasoning.

If you fix things during the audit, commit each fix as its own commit on `phase-1b5`. Use clear messages. Reference this handoff doc.

---

## 7. CAVEMAN CONTEXT FOR YOU AND USER

The user prefers extreme conciseness. They've explicitly asked for "caveman" responses — short, factual, no preamble, no excessive explanations.

**Your responses to user should be:**
- Short. 5-10 lines for normal updates. Longer only when summarizing audit findings.
- No "I'll start by..." or "Let me first..." — just do it and report results.
- No apology. No re-affirmation of stakes.
- When you ship a fix, give: commit hash, what changed, what was tested, what's next. That's it.
- When you find a bug, give: file:line, what's wrong, what should happen, severity. That's it.

**The user pushes back hard.** If they say something is broken, believe them and dig in. If you disagree, push back ONCE with your reasoning. If they hold their position, defer.

**The user is not a coder.** They architect, decide, and curate. You execute. Don't ask them to read code. Don't ask them to debug. Don't ask them to verify pull requests by reading diffs. Show them outputs, ask yes/no questions, summarize impact in trader's terms.

**Do not say "the system is ready" without empirical proof.** The previous Claude said this many times and was wrong. The user is rightly skeptical of any claim that sounds final. Earn the claim with test output, integration runs, and adversarial probes.

---

## 8. SKILLS YOU SHOULD HAVE LOADED

These are skills the previous Claude developed working with this user. Mirror equivalent behaviors in your operating mode:

1. **Anti-hallucination.** Before claiming any code, file, or capability exists, verify by reading. Do not pattern-match from project knowledge. If you have not READ the file or RUN the test in this session, you do not know it works.

2. **Caveman responses.** Concise. Direct. No filler. The user has explicitly tested for response sprawl and hates it.

3. **Senior SWE perspective.** Focus on correctness, maintainability, edge cases. Test isolation. Atomic state writes. Idempotence. Race conditions. Floating-point pitfalls.

4. **Quant auditor perspective.** When evaluating trading code, ask: how does this fail under adversarial conditions? What happens at market open/close boundaries? What happens during rate limits? What happens when prices are stale? Is there silent inflation/deflation of confluence scores?

5. **Self-correction.** If you make an assertion and later realize it's wrong, retract immediately. Don't double down. The user values honest correction over false confidence.

6. **Session lifecycle.** Start: read this doc, run tests, verify clean working tree. End: update audit report, commit, hand off cleanly.

7. **Gate discipline.** Don't bundle multiple changes per commit. Each commit should have a clear single purpose. Ship small. Verify each ship. Move to next.

8. **Jarvis-consultant mindset for the user.** Push back on scope creep. Push back on premature optimization. Push back on building features before validating existing ones. The user appreciates being told "no, do this first" with reasoning.

9. **Apex eval awareness.** Every code change near the trading path is gated on Apex eval clearance. Never break `/alert`. Never break `/balance`. Never break the floor check. The user is ~$2,283 from payout. A bug there costs real money.

10. **Read TECH_DEBT.md before starting.** It documents intentional deferrals. Don't try to "fix" things that are intentionally parked.

---

## 9. PROJECT BACKGROUND CONTEXT

This is a personal project. The user named the project after his dog Luke who passed away on 2026-04-24, three days before this handoff. Treat the project name with respect. Don't introduce mock content like "Luke is here to help you" or anything that feels disrespectful.

The user has a Master's in Public History and is a self-taught trader. He has been working on this project intensely for ~2 weeks. He has bridge income from Instacart that he's trying to exit. The Apex payout closes that loop.

His partner (Kat) and other animals (Yoda, Leia) come up occasionally in conversation. Don't engage as if it's relevant to code unless he raises it.

---

## 10. STARTER COMMANDS

**Get oriented:**
```
git log --oneline -10
npx vitest run
pm2 list
ls fixtures/bobby
ls fixtures/dubz
cat docs/MONDAY_OPS.md
cat TECH_DEBT.md
```

**Verify production state:**
```
cat data/level-memory.json | jq '.levels | length'
cat data/saty-levels.json | jq .
cat data/dubz-levels.json | jq .
```

**Run validation harnesses:**
```
node scripts/validate-bobby-fixtures.js | tee /tmp/codex-bobby-baseline.txt
node scripts/validate-dubz-fixtures.js  | tee /tmp/codex-dubz-baseline.txt
```

**Set up for UI test:**
```
# In .env, confirm ANTHROPIC_API_KEY and MASSIVE_API_KEY are set
pm2 restart ecosystem.config.js
npm start  # Launches Electron
```

---

## 11. ESCALATION TRIGGERS

Stop and ask the user before proceeding if:

1. You find a bug in `/alert` or `parse-ximes.js` that requires modification. The user has explicitly said this code is sacred until payout.
2. You find a bug in `lib/level-memory.js recordLevel` that requires changing the canonical-match algorithm. This affects all stored data.
3. You find that real Polygon data via MASSIVE_API_KEY is fundamentally incompatible with the live-price approximations. This is a major architectural surface.
4. You find that the chat UI is fundamentally broken (e.g. drag-drop doesn't work at all, slash commands don't render). This blocks everything else.
5. You discover that `/verdict` produces output that would actively mislead a trader — e.g. shows a B-grade for a level that has zero real signal.
6. You find evidence that `data/level-memory.json` has been corrupted by past writes.
7. The user's Apex floor logic depends on something that's about to break in 5f.

For everything else: just ship the fix, commit, document, move on.

---

## 12. WHAT "READY" LOOKS LIKE

Trade-ready Monday morning means:
- Tests pass.
- pm2 processes are healthy.
- `/verdict` produces sensible output against real fixtures.
- Drag-drop image upload works.
- `/alert` produces correct SETUP/SKIP verdicts.
- Trade popup fires on SETUP.
- Apex floor check blocks correctly.
- No crash.log entries since last reset.
- MONDAY_OPS.md gates 1-6 all pass.
- Codex audit report says "trade-ready ≥ 90%."

If any of those are missing on Monday morning, the user trades manually without Luke and reverts to eyes-on-screen + spreadsheet.

---

## 13. CONTACT POINTS IN THE CODEBASE

If you need to add a feature, the right place to put it is usually:
- New parser: `lib/parse-<analyst>.js` + tests in `tests/parse-<analyst>.test.js`.
- New slash command: `lib/slash-commands.js` `handleSlashCommand` function. Add at the end before the final `return null;`.
- New scoring rule: `lib/confluence-engine.js` `scoreLevel`.
- New UI behavior: `chat.html` (it's monolithic; ctrl-f for relevant section).
- New scheduled task: `scheduler.js`. But verify the scheduler is actually running first.
- New deferred decision: append to `TECH_DEBT.md` with explicit phase tag.

If you need to make a decision about scope or architecture, write a short proposal in `proposals/<YYYY-MM-DD>-<topic>.md` and ask the user before implementing.

---

**End of handoff. Good hunting.**
