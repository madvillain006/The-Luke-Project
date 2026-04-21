---
# JARVIS — LIVE STATUS DOCUMENT
Last updated: 2026-04-20 (session6 — bracket + popup chart + safe layout)
Maintained by: Conor Kastan

## WHAT JARVIS IS
Trading decision-support copilot + personal assistant.
Human (Conor) makes ALL final decisions.
Jarvis prepares, alerts, suggests. Never executes autonomously.
Apex 50k EOD Trail eval compliant.

## HARD RULES — NEVER CHANGE
- No autonomous trading ever
- Human presses execute always
- Every trade needs stop + target
- No both-side brackets
- Directional only
- Low confidence = no trade
- Apex rules enforced always
- Agent-04 (Luke meds) excluded from all self-modification forever

## CURRENT STATE
Phase 1.1 ingestion audit — DONE
Phase 1.2 parse-signal.js — DONE (replaced by new parsers below)
Phase 1.3 signal ingest — DONE (1605 entries in discord-history.jsonl)
Phase 1.4 replay alignment — DONE (old parser 0.8% pass rate, now replaced)
Phase 1.5 new parsers — DONE
  - lib/parse-ximes.js (trusted: followthewhiterabblt, richydubz, ximestrades)
  - lib/parse-bobby.js (text + vision paths)
  - lib/bobby-heatmap-rules.js (Bobby's actual terminology)
Phase 1.6 ingest rewire — DONE
Phase 1.7 gym session — DONE 2026-04-20
  - [P1] all P1 fixes verified (ximestrades, source filter, MNQ/MES, NODE_ENV)
  - [refactor] detectEmotionalState inline removed, using checkEmotionalState
  - [signals] loadRecentSignals rewired to pre-parsed fields + bobby-context.jsonl
  - [02B] confluence check wired into /evaluate (HIGH zone required)
  - [UI] live status panel added to chat.html (auto-refresh 60s)
  - [safety] agent-02-trader.js saveMemory uses atomic tmp+rename
  - [security] Finnhub key moved to process.env.FINNHUB_KEY (.env created)

Phase refactor — DONE 2026-04-20
  - [refactor] index.js split into 5 lib modules
  - lib/logger.js — canonical log() for all 4 files
  - lib/memory.js — canonical atomic loadMemory/saveMemory (replaces 3 divergent copies)
  - lib/system-prompt.js — buildSystemPrompt + 5 helpers
  - lib/actions.js — handleAction, runPython, verifyScreen, screen ops
  - lib/slash-commands.js — all 8 slash handlers (/levels /heatmap /confluence /alert /trade /review /reset /status)
  - index.js reduced from ~1609 lines → verified OK, /status and /confluence pass live curl

Phase session2 — DONE 2026-04-20
  - [UX] boot levels warning: WS notification + status panel red on connect if no levels
  - [alert] auto-username detection: tries all trusted usernames, extracts timestamp
  - [alert] stop+target from confluence zones (not fixed tolerance); R:R shown in SETUP
  - [alert] edge matching from CONOR_EDGE.md: morning/afternoon window flags
  - [UX] /confluence reformatted: emoji indicators, human-readable sources, HIGH+MED zones
  - [UX] /reset command: clears levels + last-signal, preserves trades.jsonl
  - [02B] paper mode test: evaluated 37 ximes + 48 bobby signals → SKIP ("No ximes candidates passed intraday filters" — discord history signals are SPY/SPX, 02B filter requires NQ/MNQ/ES/MES)

## SIGNAL SOURCES
XIMES (primary — entry triggers):
- Channel: ximes-dubz
- Analysts: XImEs (followthewhiterabblt) + RichyDubz
- Parses: ticker, direction, strike, entry_price
- File: lib/parse-ximes.js

BOBBY (context only — never a trigger):
- Channel: bobby-spx-coms
- Analyst: bobbyaxl
- Parses: king nodes, support, resistance, VIX, bias
- Key terms: king node=magnet, air pocket=fast move, trinity=SPX+SPY+QQQ, purple=deflection floor
- Text path + vision path (for heatmap images)
- File: lib/parse-bobby.js, lib/bobby-heatmap-rules.js

SIENNA (regime filter — never a trigger):
- Agent: agent-08-sienna.js
- Status: not yet a clean lane, needs rebuild
- Role: adjusts selectivity only

Confluence rule: Ximes signal + Bobby context alignment = HIGH confidence
Ximes alone = MEDIUM
Bobby alone = context only, no trade

## WHAT'S DISABLED (do not re-enable without Conor's explicit instruction)
- intraday-scraper.js auto-run (line 287 commented out)
- scheduler.js setIntervals (commented out)
- trading/router.js auto-execute paper/shadow (lines 265-266 commented out)
- execution-live.js emergency flatten auto-call (commented out)
- index.js background intervals (lines 1195, 1202, 1219 commented out)
- ecosystem.config.js autorestart: false on all apps
- start-jarvis.bat renamed to start-jarvis.bat.disabled
- PM2 killed and saved empty

## AGENTS
02-trader — manual trading assist
02b-autonomous — NEUTERED, was autonomous, now decision-support only
03-income — Instacart shift tracking
04-health — Luke meds (SACRED, never auto-modify)
05-finance — Tennessee move fund tracking
06-research — signal synthesis
07-opportunity — RSS + pitch drafting
08-sienna — regime/quant (needs clean lane rebuild)
09-architect — housekeeper/self-improver (trading + health excluded)
10-sweeper — codebase optimizer
11-tokens — token usage tracking
12-fallback — free LLM fallback (Gemini/Groq/Ollama, no trading in fallback)
13-workflows — workflow runner

## TRADING STACK
trading/broker-tradovate.js — broker connection
trading/execution-live.js — NEUTERED auto-flatten
trading/execution-paper.js — paper mode
trading/execution-shadow.js — shadow mode
trading/risk.js — risk gate
trading/router.js — NEUTERED auto-execute
trading/signals.js — not yet wired to Sienna
trading/metrics.js — performance tracking
trading/market-context.js — market context

## KNOWN ISSUES / TECH DEBT
- SSRF risk: POST /research accepts any URL (index.js:840)
- Memory poisoning: POST /memory no key allowlist (index.js:893)
- Unvalidated WS broadcast: POST /notify (index.js:930)
- trading/signals.js not wired to Sienna context
- agent-08-sienna.js not a clean lane yet
- Bobby vision parser stub only — needs real image test
- Finnhub key still has hardcoded fallback in code (env preferred, fallback for safety)

## SESSION 6 NEW CAPABILITIES
- **Bracket calculator** (lib/bracket-calc.js): calculateBracket() derives stop/target from confluence zones per instrument spec (ES/NQ/MES/MNQ/SPY/SPX), returns ticks + dollar risk/reward + R:R ratio with warn/reject flags
- **/alert response** now includes full bracket: entry, stop (ticks + $), target (ticks + $), R:R 1:X — weak trades downgraded to WEAK, R:R <1.0 auto-rejected
- **Trade popup** (trade-popup.html) shows entry/stop/target with tick count and dollar risk, all bracket fields displayed
- **Mini chart in popup**: TradingView Lightweight Charts 4.1.3, 48 candles of 5-min data (sample), entry (white), stop (red dashed), target (green dashed) price lines
- **Safe layout script**: trading-layout.py rewritten — pyautogui completely removed, only subprocess + win32gui, opens 3 Edge windows (ximes/bobby/tradovate) + pins Jarvis bottom-right always-on-top

## WHAT'S NEXT (in order)
1. Phase 1.7 — replay alignment retest (target 15%+ pass rate, now using pre-parsed signals)
2. Phase 1.8 — Ximes execution model (02B signals need NQ/MNQ/ES/MES — discord history is SPY/SPX, need scraper to capture futures signals)
3. Phase 1.9 — emotional exit rules
4. Phase 1.10 — Bobby context layer wired to trade staging
5. Phase 1.11 — Sienna clean lane rebuild
6. Phase 1.12 — Phase 1 handoff doc
Then Phase 2 (assist layer), Phase 3 (smarter assist), Phase 4 (hardening)

## LUKE
Luke has PLE (protein-losing enteropathy).
Med schedule (agent-04, NEVER auto-modify):
- 4:00 AM: Omeprazole alone
- 4:30 AM: Mirtazapine + Prednisone with food
This agent is the most safety-critical non-trading component.

## THE POINT
Built by one person with ADHD, a sick dog, a trading eval deadline,
and a move across state lines by June 15 2026.
Jarvis exists because the alternative was losing.
---
