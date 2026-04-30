# JARVIS AUDIT — Consolidated Issues

**Source:** automated code audit of 25 files on 2026-04-19  
**Compiled:** 2026-04-22  
**Total issues found:** 73 (13 HIGH, 31 MED, 19 LOW — plus 1 config-level HIGH in `.claude/settings.local.json`)

---

## HOW TO USE THIS FILE

Each issue has:
- **What it is** — the raw technical finding
- **Plain English** — what it actually means if you don't read code
- **Why you care** — real-world impact on eval, trading, or costs
- **Fix complexity** — rough sizing (small / medium / large)
- **Triage suggestion** — Claude's recommendation (fix-now / brief-for-CC / future-ideas / won't-fix)

Your job in Chunk 2: add your decision in the `[Triage]` column. Just write one of: **NOW**, **CC**, **LATER**, **SKIP**.

---

## 🔴 HIGH SEVERITY (13 issues)

These are the ones most likely to actively hurt you if untouched.

---

### H1 — Window settings in electron.js have critical security holes

**File:** `electron.js:20`  
**Category:** schema_drift  
**Fix complexity:** small (1-line change + preload script shuffle)  
**[Triage]:** _____

**What it is:** `webPreferences` has `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`.

**Plain English:** The Jarvis UI window (`chat.html`) currently has full access to your Windows filesystem and can run any command on your machine. The normal security walls are turned off.

**Why you care:** If Jarvis ever loads a bad URL, an ad, or a compromised piece of content into that window, the attacker gets to run code on your computer. This is the kind of thing that could delete files, read your credentials, or install malware. It's a latent risk — probably fine right now because Jarvis only loads local content, but if anything ever changes (e.g. you add a TradingView iframe, a Twitter embed, a help link), the risk becomes real.

**Suggested fix:** Flip the three settings to safe defaults and use a preload script for any IPC communication needed. Standard Electron hardening.

---

### H2 — Hardcoded Finnhub API key in `intraday-scraper.js`

**File:** `intraday-scraper.js:8`  
**Category:** token_waste (mis-labeled — it's a security issue)  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** Finnhub API key written directly into the source file.

**Plain English:** Your Finnhub API key is in the code as plain text. If this repo is ever pushed to a public GitHub, or if someone sees your screen, the key is exposed.

**Why you care:** Your repo IS on GitHub (`github.com/madvillain006/Jarvis`). If this file is in the public repo, the key may already be leaked. Finnhub keys on free tier aren't expensive, but once leaked they can be scraped and abused. Also: if Finnhub revokes/rate-limits you because of abuse, your intraday scraper dies.

**Suggested fix:** Move to `.env` file, reference via `process.env.FINNHUB_KEY`. Rotate the key with Finnhub after moving.

**Verify first:** check if the repo is actually public and whether the key is actually leaked before panicking.

---

### H3 — Same issue: Hardcoded Finnhub key in `agents/agent-06-research.js`

**File:** `agents/agent-06-research.js:17`  
**Category:** same as H2  
**Fix complexity:** small (same fix as H2)  
**[Triage]:** _____

**What it is:** Second copy of the Finnhub key, also hardcoded.

**Plain English:** Same bug, different file.

**Why you care:** Same as H2, but worse because it means the fix needs to happen in TWO places, and the next time you add a file that needs the key, you'll likely make the same mistake.

**Suggested fix:** Environment variable (once), referenced from both places. Delete the hardcoded copies.

---

### H4 — CONOR_EDGE: `-25% hard stop` rule is ambiguous

**File:** `CONOR_EDGE.md:18`  
**Category:** error_gap  
**Fix complexity:** small (rewrite one line)  
**[Triage]:** _____

**What it is:** The rule "-25% hard stop at entry" doesn't specify whether it's -25% of the option premium, -25% of the underlying, or something else. No calculation method.

**Plain English:** Your risk rule is written in a way that could be interpreted three different ways. Jarvis can't enforce it programmatically because it doesn't know what "-25%" means.

**Why you care:** This is your own risk rule. If Jarvis ever tries to block you from a trade for violating it, or if you ask Jarvis "is this within my rules?", it'll either guess wrong or skip the check. A blown eval could come from this kind of ambiguity.

**Suggested fix:** Rewrite to something like "Stop loss at entry_price × 0.75 for options, or stop-distance equivalent of 25% of premium for futures." State explicitly how it integrates with the bracket OCO order.

**Note:** This is a spec question, not code. You need to decide what the rule actually means, then I file it.

---

### H5 — `MEMORY_SUMMARY.md` has an incomplete sentence

**File:** `MEMORY_SUMMARY.md:18`  
**Category:** error_gap  
**Fix complexity:** tiny  
**[Triage]:** _____

**What it is:** "Cancer-clear (Feb/Mar 2" — sentence cuts off mid-thought.

**Plain English:** A health-context sentence in Jarvis's memory file is literally truncated mid-word.

**Why you care:** When Jarvis pulls context about you, it might read this broken sentence and either hallucinate a completion or get confused about a real health fact. Doesn't affect trading directly but affects every agent that reads memory.

**Suggested fix:** Complete the sentence. You know what it should say.

---

### H6 — `routeToAgent()` in index.js silently swallows agent errors

**File:** `index.js:348`  
**Category:** error_gap  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** When an agent (like agent-06-research) has an error, `routeToAgent` catches it and returns `null`. The caller then thinks "no agent handled this" instead of "this agent crashed."

**Plain English:** If any of your agents dies (crashes, returns weird data, times out), Jarvis pretends like the request just wasn't agent-appropriate. You never get an error message.

**Why you care:** You lose visibility. If agent-06 research starts failing silently, you won't know until you notice signals aren't being researched anymore — and by then you've probably lost days of data.

**Suggested fix:** Log the error, and return a structured error object so you see `"Agent error: X"` in the UI instead of silence.

---

### H7 — `isTradingMessage` regex is noisy (false positive risk)

**File:** `index.js:91`  
**Category:** search_trap  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** 51-term regex that matches on any of the words. Will trigger on "long day," "short answer," "cut the grass," etc.

**Plain English:** Jarvis decides "this is a trading message, I should route it" too easily. Any casual conversation with the words "long," "short," "cut," "trim," etc. gets treated as trading input.

**Why you care:** Every false positive costs you a Haiku API call and potentially pollutes your signal history with noise. Over time this accumulates token waste AND dilutes the signal-to-noise ratio on your actual trading signals.

**Suggested fix:** Require 2+ matching terms OR stricter word boundaries. Straightforward regex improvement.

---

### H8 — Discord scraper uses wrong model for insight extraction

**File:** `discord-scraper.js:73`  
**Category:** token_waste  
**Fix complexity:** tiny (one-line model change) — or stay with Haiku and fix the function name  
**[Triage]:** _____

**What it is:** Function called `extractInsightsWithOpus` actually uses Haiku. Either it should use Opus, or the name is wrong.

**Plain English:** A function promises to use Claude Opus (smart model) for extracting trading insights, but silently uses Haiku (smaller model) instead.

**Why you care:** This is subtle. IF the task actually needs Opus-level reasoning, you're getting worse signal extraction than you thought. IF Haiku is fine for it (plausible), the function name is lying and you'll trust its output more than you should.

**Suggested fix:** Decide which is correct — are we using Haiku intentionally or is this a bug? Then either change the model OR rename the function to reflect reality.

**Conor's call:** This depends on whether you've noticed Discord scraping quality being off. If extractions have been good, keep Haiku + rename. If they've been missing things, upgrade to Opus.

---

### H9 — Scheduler double-fires EOD update at 17:00

**File:** `scheduler.js:193`  
**Category:** scheduler_waste  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** One `setInterval` fires at 16:59. Another block (line 329-337) hits the same endpoint at 17:00. Both trigger EOD.

**Plain English:** The end-of-day process runs twice. Once at 4:59 PM, once at 5:00 PM.

**Why you care:** Two problems. First, race condition — the two calls might overwrite each other's state writes, corrupting your EOD balance log. Second, wasted API calls each day.

**Suggested fix:** Pick one. Remove the other. Easy.

---

### H10 — `agent-08-sienna` truncates synthesis at 14k chars with no pagination

**File:** `agents/agent-08-sienna.js:108`  
**Category:** token_waste  
**Fix complexity:** medium  
**[Triage]:** _____

**What it is:** Combined trader profile data gets cut at 14,000 characters, possibly mid-sentence. No pagination.

**Plain English:** When Sienna (agent-08) builds the trader synthesis profile, if the combined data is too long, it just chops the end off. No warning. The stuff after the cutoff is gone.

**Why you care:** This is the agent generating `SIENNA_PROFILE.md` which feeds into your confluence scoring. If the cutoff is dropping crucial trader methodology data, your confluence scores are running on incomplete information.

**Suggested fix:** Either summarize chunks before synthesis (2-step), or chunk the synthesis itself and combine results.

**Note:** Since you've flagged agent-08 for Haiku migration anyway, this fix could happen at the same time.

---

### H11 — `agent-07-opportunity` uses Opus for a task Haiku can do

**File:** `agents/agent-07-opportunity.js:119`  
**Category:** token_waste  
**Fix complexity:** tiny (one-line model change)  
**[Triage]:** _____

**What it is:** `/draft-pitch` endpoint uses `claude-opus-4-6` for structured text generation. Haiku would produce equivalent output at 1/3 the cost.

**Plain English:** An agent is using the expensive brain for a task that doesn't need it.

**Why you care:** This endpoint runs whenever you ask for a pitch draft. Over time that's real money. Intake endpoint (same file) already uses Haiku and works fine for similar analysis.

**Suggested fix:** Change model string to `claude-haiku-4-5-20251001`. Single line.

---

### H12 — `agent-09-architect` has unhandled promise rejections on notify

**File:** `agents/agent-09-architect.js:261,271`  
**Category:** token_waste (mis-labeled — it's a resource leak)  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** Two `fetch()` calls to `/notify` are not awaited and have no `.catch()` handler. When the notify endpoint is slow or down, the promises hang.

**Plain English:** When the architect agent wants to send you a notification, if the notification service is down or slow, those calls pile up in memory and never clean up.

**Why you care:** Small memory leak per notification. Over a long session, can accumulate. More importantly, you never find out notifications failed.

**Suggested fix:** Either await the fetch, or add `.catch(err => log(err))`. Standard Node.js cleanup.

---

### H13 — `agent-10-sweeper` has inconsistent truncation wasting tokens

**File:** `agents/agent-10-sweeper.js:293`  
**Category:** token_waste  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** Synthesis prompt slices findings to 12,000 chars but loads rejected patterns un-sliced. Meaning: rejected (low-value) data can balloon past budget while good data gets cut.

**Plain English:** When the sweeper agent summarizes what it found, it's being inconsistent — it truncates the useful stuff but keeps all the rejected stuff uncut.

**Why you care:** Wasted tokens (~500-1000 per synthesis run) AND lower quality summaries because good findings are getting cut while noise stays.

**Suggested fix:** Apply same slice to both. Or priority order: findings first, rejected only if budget remains.

---

### H14 — `desktop.py` `open_url()` closes active window before opening URL

**File:** `desktop.py:24`  
**Category:** error_gap  
**Fix complexity:** tiny (delete one line)  
**[Triage]:** _____

**What it is:** `open_url()` runs `ctrl+w` (close window) before opening the new URL. Any unsaved state in the current window is lost.

**Plain English:** When Jarvis opens a URL via the desktop automation, it closes whatever window you had open first. If you had a trading platform, chart, or text document open — gone.

**Why you care:** This is actively dangerous during a live trading session. If Jarvis opens a URL mid-trade, it could close your trading platform window. Data loss, potentially missed trade management.

**Suggested fix:** Remove the `pyautogui.hotkey('ctrl', 'w')` line.

---

### H15 — `research-agent.py` has bare except clauses masking real errors

**File:** `research-agent.py:14`  
**Category:** error_gap  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** `load_memory()` has `except:` with no specific error type. Catches EVERYTHING — corrupt JSON, permission denied, disk full — and silently returns default.

**Plain English:** If the memory file gets corrupted or the disk is full, the research agent pretends everything is fine and starts with blank memory.

**Why you care:** Silent corruption. You could lose accumulated research context without knowing it. When you later wonder "why isn't Jarvis remembering X," the trail is cold.

**Suggested fix:** Catch specific exceptions: `FileNotFoundError`, `json.JSONDecodeError`. Let anything else crash so you know something real is wrong.

---

### H16 — `.claude/settings.local.json` has overly broad grep allow

**File:** `.claude/settings.local.json:10`  
**Category:** search_trap  
**Fix complexity:** small  
**[Triage]:** _____

**What it is:** Permissions allow `Bash(grep -E "\\.js$|agents|index")` — this pattern matches almost any file.

**Plain English:** You gave Claude Code permission to run grep on "JS files OR anything named agents OR anything named index" — which is basically everything in the repo.

**Why you care:** Security-wise: allows CC to search anywhere, including `.env`, `.git/`, `node_modules/`. Performance-wise: broad searches are slow and spammy.

**Suggested fix:** Replace with specific paths like `grep -E "src/agents/.*\.js$"`. Scope the allow to real use cases.

---

## 🟡 MEDIUM SEVERITY (31 issues)

Grouped to keep this scannable. Details available on request per issue.

### Code quality / maintainability (8 issues)

| File | Line | Issue | Plain English |
|---|---|---|---|
| `CONOR_EDGE.md` | 6 | Entry Criteria TBD | You have a "TBD" on your entry rules that should be filled in. |
| `CONOR_EDGE.md` | 20 | No-Instacart-trading not enforced | Behavioral rule with no code to enforce it. |
| `JARVIS SELF KNOWLEDGE.md` | 59 | discord-history.jsonl no cleanup | File will grow forever, no 7-day rotation exists. |
| `MEMORY_SUMMARY.md` | 1 | Redundant timestamp in markdown body | Small token waste, clean up. |
| `MEMORY_SUMMARY.md` | 8 | Luke health entry has no schema | Inconsistent fields make it hard to parse reliably. |
| `package.json` | 6 | Test script is a placeholder | You don't have real `npm test` configured for the root package. |
| `ecosystem.config.js` | 7 | Env var duplicated | `ANTHROPIC_API_KEY` copied across 3 app configs. |
| `ecosystem.config.js` | 6 | Inconsistent restart_delay | Some apps have it, some don't. |

### Token waste / cost issues (9 issues)

| File | Line | Issue | Plain English |
|---|---|---|---|
| `index.js` | 157 | System prompt rebuilt every call | 2000 tokens wasted per chat request. |
| `index.js` | 510 | Every chat logged to disk unnecessarily | I/O overhead on routine queries. |
| `index.js` | 486 | Research endpoint makes 2 API calls when 1 would do | Wasted API call per research. |
| `agent-03-income.js` | 115 | Haiku call for simple math | Weekly summary doesn't need AI. |
| `agent-05-finance.js` | 115 | Forecast endpoint makes redundant AI call | Basic arithmetic wrapped in an LLM call. |
| `agent-05-finance.js` | 135 | `/assess` repeats same pattern | Same as above. |
| `agent-06-research.js` | 107 | System prompt built on every request | Repeated work, 800+ tokens each time. |
| `agent-08-sienna.js` | 88 | No batching of haiku calls | Sequential with 400ms delays. |
| `ingest-exports.js` | 26 | Structured output not parsed | Claude told to output structure, then it gets thrown away and re-parsed later. |

### Error handling gaps (10 issues)

| File | Line | Issue | Plain English |
|---|---|---|---|
| `CONOR_EDGE.md` | 20 | Instacart rule enforcement | Covered above but also error-gap category. |
| `electron.js` | 8 | loadWinState swallows all errors | Can't tell "first run" from "corrupted file." |
| `electron.js` | 12 | saveWinState swallows errors | Window state may not save without you knowing. |
| `chat.html` | 768 | WebSocket onmessage silent on parse errors | Malformed WS messages disappear. |
| `index.js` | 505 | /chat doesn't distinguish error types | JSON parse vs timeout vs exec — all same. |
| `scheduler.js` | 265 | RSS double-call when first rejects | Wasted bandwidth + API calls. |
| `discord-scraper.js` | 120 | runPython success not validated | Stale screenshots may be used as valid. |
| `intraday-scraper.js` | 42 | runPython null not checked | Could crash on screenshot failure. |
| `intraday-scraper.js` | 81 | notifyJarvis swallows errors | Silent comms failures. |
| `desktop.py` | 18/49/70 | type/click/scroll error gaps | Various silent failure modes. |

### Duplication / config sprawl (4 issues)

| File | Line | Issue | Plain English |
|---|---|---|---|
| `index.js` | 77 | `loadDiscordSignals` repeats work | Signal list rebuilt on every trading message. |
| `scheduler.js` | 281 | `post()` helper unused | 8+ raw fetch calls instead of using the helper. |
| `agent-06-research.js` | 49 | Two loader functions do similar work | Should share parsing. |
| `agent-07-opportunity.js` | 147 | File rewrite logic in 2 places | Easy bug vector. |
| `.claude/settings.local.json` | 3 | localhost:3000 hardcoded | Hard to change ports if ever needed. |

---

## 🟢 LOW SEVERITY (19 issues)

One-line summaries. Most are cleanup items — small improvements that add up.

| File | Line | Category | Summary |
|---|---|---|---|
| `CONOR_EDGE.md` | 3 | dead_code | "Initialize manually" placeholder, no automation |
| `JARVIS SELF KNOWLEDGE.md` | 77 | duplication | KNOWLEDGE-STRUCTURING-SKILL listed twice |
| `JARVIS SELF KNOWLEDGE.md` | 106 | dead_code | Agents 02-05 listed as endpoints but are STUB |
| `electron.js` | 29 | duplication | saveWinState called twice per event |
| `chat.html` | 458 | dead_code | `history` variable unused/unbounded |
| `chat.html` | 604 | token_waste | TradingView widget recreated every 15s |
| `chat.html` | 657 | token_waste | Repeated JSON.stringify().slice() pattern (6 sites) |
| `index.js` | 435 | dead_code | `/do` endpoint duplicates handleAction logic |
| `scheduler.js` | 313 | token_waste | Discord scrape errors silent |
| `discord-scraper.js` | 144 | dead_code | SCREENSHOT_PATH written but never read |
| `intraday-scraper.js` | 96 | duplication | getLiveQuote repeats ticker logic |
| `ingest-exports.js` | 79 | config_sprawl | Source mapping in ternary chain |
| `agent-03-income.js` | 128 | dead_code | Missing empty-week guard |
| `agent-05-finance.js` | 30 | dead_code | Redundant TONE guidance in system prompt |
| `agent-05-finance.js` | 73 | schema_drift | fund_log accumulates but never read |
| `agent-06-research.js` | 280 | dead_code | marketContext built but used only once |
| `agent-07-opportunity.js` | 20 | dead_code | loadOpportunities swallows errors |
| `agent-08-sienna.js` | 42 | dead_code | NO_ACTIONABLE filter never triggers |
| `agent-09-architect.js` | 297 | dead_code | REJECTED constant never used |
| `agent-10-sweeper.js` | 475 | dead_code | loadCosts called twice per check |
| `monitor.py` | 67 | token_waste | Screenshot captured but unused |
| `monitor.py` | 100 | search_trap | Case-sensitive alert filter inconsistency |
| `research-agent.py` | various | error_gap | Multiple bare except clauses |
| `package.json` | 4 | config_sprawl | Empty description field |

---

## CLAUDE'S TRIAGE RECOMMENDATIONS

If you want a starting point, here's how I'd triage:

**NOW (fix today/tomorrow, ~1 hour each):**
- H14 — desktop.py open_url bug (could break mid-trade, 1 line fix)
- H9 — scheduler double-EOD (race condition on balance log)
- H4 — CONOR_EDGE -25% stop rule (spec clarification, needed before any rule-enforcement work)
- H5 — MEMORY_SUMMARY truncated sentence (30 seconds)

**CC (brief and ship, pace of Chunks 3-4):**
- H1 — electron security (1-hour CC task)
- H2 + H3 — Finnhub key extraction (one PR covers both)
- H8 — Opus/Haiku naming/model reconciliation
- H11 — agent-07 Opus→Haiku (one-line change, fits with Haiku migration chunk)
- H10 + H13 — agent-08 and agent-10 truncation (same character as Haiku migration)
- H12 — agent-09 unhandled rejections
- H6 — index.js routeToAgent error visibility
- H15 — research-agent.py bare excepts
- H16 — .claude permissions tightening

**LATER (filed to future-ideas):**
- H7 — isTradingMessage regex (low urgency, future tuning)
- All MED items unless they group with a HIGH fix

**SKIP (not worth the effort):**
- Most LOWs — flag only if you notice them actively biting

---

## CRITICAL NOTE ON ORDER

One audit finding changes everything if real:

**H2/H3 (Finnhub key leak).** Before any other work, check if the repo is public and the key is exposed. If yes: rotate the Finnhub key with Finnhub.io FIRST, then fix the code. If the repo is private, proceed normally.

That's a 2-minute check worth doing before you start Chunk 3.

---

## NEXT STEPS

Your Chunk 2:
1. Read through HIGH section, mark each with NOW/CC/LATER/SKIP
2. (Optional) mark MEDs you care about
3. Tell me when you're done → Chunk 3 writes build-briefs for the NOW + CC items

No rush. This file lives in `findings/AUDIT_ISSUES.md` — you can come back to it.
