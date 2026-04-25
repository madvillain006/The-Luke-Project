# LUKE FINAL AUDIT REPORT v2

## Date: 2026-04-21
## Auditor: Senior Quant Engineer (skeptical posture — commercial and eval readiness focus)
## Scope: Full codebase + commercial roadmap
## Prior audit: FINAL_AUDIT_REPORT.md (F1–F8 status verified below)

---

## PRIOR FINDINGS STATUS

| ID | Description | Status | Notes |
|----|-------------|--------|-------|
| F1 | state.daily_pnl only tracks 02B trades; Apex consistency cap unenforced for manual /trade | **UNFIXED** | /trade in slash-commands.js writes trades.jsonl but never touches state.daily_pnl |
| F2 | /balance missing from DAILY_OPS.md EOD section | **UNFIXED** | DAILY_OPS.md EOD section: /trade, /review, /reset only. No /balance. |
| F3 | NODE_ENV never set → test hooks always active | **UNFIXED** | trading/router.js:718 guard fires. Routes `/_test/inject-state`, `/_test/simulate-protection-failure`, `/_test/reconcile-phantom` reachable in production. |
| F4 | Apex floor check missing $200 safety buffer on manual /alert path | **UNFIXED** | slash-commands.js:406 uses raw balance − risk_dollars < trail_floor. trading/risk.js getApexPreTradeFloorBlock has $200 buffer; /alert does not. |
| F5 | getFuturesPrice() silently skips drift check on key failure | **PARTIALLY FIXED** | signals.js now returns null when price unavailable; levelsMakeSense rejects candidates with null price. Live mode blocks on missing price. Paper mode still bypasses sanity. |
| F6 | Finnhub key in git history — needs rotation | **UNFIXED** | agents/agent-02-trader.js:12: `const FINNHUB_KEY = process.env.FINNHUB_KEY \|\| "d7ibl19r01qu8vfo2410d7ibl19r01qu8vfo241g"`. Key hardcoded as fallback. |
| F7 | agent-13-workflows.js not mounted in index.js | **UNFIXED** | Confirmed. 13 agents mounted in index.js; agent-13 absent. All workflow routes unreachable. |
| F8 | EXECUTE button label cosmetic / confusing | **UNTESTED** | trade-popup.html not in audit scope files. Status unknown. |

---

## SECTION 1: COMPLIANCE (Deal-breakers for Apex eval)

### 1a. Human-execution gate
**PASS**

The only path to `executeLive()` is: `POST /agent/autonomous/execute-staged` (trading/router.js:174). This requires `state.pending_signal` to exist and `state.running = true`. `running` is set only by manual `POST /agent/autonomous/start`. The popup auto-closes after 60s (electron.js:118) without placing an order. Paper mode requires `executePaper()` which is also gated through execute-staged. No timer, no auto-confirm, no alternative code path to placeorder.

### 1b. EOD trail math
**PARTIAL — broken for SPX options, correct for futures**

Manual `/alert` floor check (slash-commands.js:405–410):
```javascript
const wouldBreach = (apexState.balance - bracket.risk_dollars) < apexState.trail_floor;
```
With balance=50553, floor=48053:
- risk_dollars=$400 → 50553−400=50153 > 48053 → **PASS** ✓
- risk_dollars=$2600 → 50553−2600=47953 < 48053 → **BLOCK** ✓

The math is arithmetically correct for futures. However, `bracket.risk_dollars` for SPX options is computed from strike differences × $100/point (INSTRUMENT_SPECS.SPX.dpt=100.0, tick=0.01). For a 20-point stop (e.g., entry 7070, stop 7090): 2000 ticks × $100 = **$200,000 risk** per contract. This always exceeds balance−floor, so the floor check always fires on SPX options signals, silently blocking legitimate trades. See A-02.

No safety buffer on manual path (F4 still unfixed, per above).

### 1c. Consistency cap enforcement
**FAIL — manual trades excluded**

The consistency cap is only enforced in `getApexConsistencyReason()` (trading/risk.js:71), called exclusively from the 02B `/evaluate` route. Manual `/trade` entries write to `trades.jsonl` but do NOT update `state.daily_pnl`. Conor can manually trade all day and the 50% daily cap is never checked. If 02B earns $1000 cumulative and Conor earns $400 manually in a single day, the cap enforcement sees $0 daily (manual) and potentially misses the violation. F1 confirmed unfixed.

### 1d. News blackout
**FAIL — no system protection**

No FOMC/NFP/CPI calendar integration exists anywhere in the codebase. No blackout window in `market-hours.js`. Conor's only protection is manual awareness. During an FOMC announcement, a Ximes signal could pass every Luke gate and display SETUP. This is a real eval-risk.

### 1e. isAutomated flag
**PASS**

Verified in three locations:
- `execution-live.js:93` (entry market order): `isAutomated: false`
- `execution-live.js:34, 43` (OCO protection order): `isAutomated: false`
- `broker-tradovate.js:125` (emergency flatten): `isAutomated: false`

All API calls to Tradovate correctly mark `isAutomated: false`.

### 1f. NODE_ENV test hooks
**FAIL — routes live in production**

`trading/router.js:718`: `if (process.env.NODE_ENV !== "production")` mounts three endpoints that can inject arbitrary state into the trading system:
- `POST /agent/autonomous/_test/inject-state` — patches any field in trading state
- `POST /agent/autonomous/_test/simulate-protection-failure` — writes critical_mismatch flags
- `POST /agent/autonomous/_test/reconcile-phantom` — simulates broker mismatches

`NODE_ENV` is never set in `package.json`, startup scripts, or Electron launcher. These routes are permanently live. An external request to `localhost:3000` can inject a fake open position and block all trading.

**Fix:**
```javascript
// trading/router.js — replace the if-block guard
if (process.env.NODE_ENV === "test") {
  // ...test routes
}
```
**And add to package.json scripts:**
```json
"start": "electron electron.js",
"start:prod": "NODE_ENV=production node index.js"
```

### 1g. Copy-trade detection surface
**PASS**

Execution timing is non-deterministic: signal arrives → Luke evaluates (milliseconds) → popup shown → Conor reads and decides → EXECUTE clicked (seconds to minutes). This is not a bot pattern. All orders are market orders with `isAutomated: false`. No fixed-interval firing or timestamp-correlated execution pattern.

---

## SECTION 2: CORRECTNESS — HOT PATH

### 2a. parseXimes against real Ximes messages

| Input | Result | Assessment |
|-------|--------|------------|
| `"added to 197.5 P .58 avg"` | MANAGEMENT/ADD, strike=197.5, dir=SHORT, entry_price=0.58 | Correct. Routes to ADD handler in /alert. |
| `"UPDATED STOPS TO 1.43"` | MANAGEMENT/STOP_UPDATE, price=1.43 | Parse correct. **UX broken** — /alert returns "❌ SKIP — no strike found in signal" instead of stop update info. |
| `"target on NVDA 199.5"` | MANAGEMENT/TARGET_UPDATE, ticker=NVDA, price=199.5 | Parse correct. **UX broken** — same SKIP response. |
| `"Could flush to 705 cluster here on spy"` | null | Correct drop. No direction marker; level-only mention. |
| `"skip this if you arent up massive wait for 3:00 with rest of bp"` | null | Correct. Noise/instruction, no actionable signal. |
| `"stops in check the stream for prices"` | null | Correct. None of the STOP_UPDATE patterns match "stops in". |
| `"monumental pivot"` | null | Correct. No prices, no direction. |
| `"If we can flush EOD break below 704 and reclaim 704 before close"` | null | Correct. No ticker+direction combination parseable. |
| `"NEW STL 1.43"` (kanabis16) | MANAGEMENT/STOP_UPDATE, price=1.43, analyst='kana' | Parse correct (relay user, management-only allowed). **UX broken** — same SKIP. |

Parse accuracy: ~90% correct. The critical failure is not in parsing but in what `/alert` does with STOP_UPDATE and TARGET_UPDATE results. Both are silently swallowed and presented as SKIP with a misleading error message during live trades.

### 2b. Bobby text parse

| Input | Result | Assessment |
|-------|--------|------------|
| `"$SPX heatmap, 7070 spx king node maintained its strength possible for lower"` | king_nodes=[7070], bias=BEARISH | Correct. "lower" hits bearSignals. |
| `"$SPX sitting near $15 lower since"` | null | Correct. No prices above 50 in king_node window. |
| `"SPX still has the same set up"` | null | Correct. No prices at all. |

### 2c. Confluence scoring — Bobby king_node=7070, Ximes entry SPX put near 7070

**FAIL — instrument mismatch produces zero clustering**

This is a P0 finding (A-01 below). In `detectConfluence()`, levels are grouped by instrument:
- Ximes signal: SPX put → `extractXiLevels` preserves ticker='SPX' → `inferInstrument(7070, 'SPX')` → returns **'SPX'** (via tickerHint path)
- Bobby king_node 7070: `extractBobbyLevels` → `inferInstrument(7070)` with NO tickerHint → price 7070 is ≥1000 and <10000 → returns **'ES'**

The clustering loop groups by instrument. xiGroup['SPX'] contains the Ximes signal; bobGroup['SPX'] is empty because the Bobby level landed in bobGroup['ES']. The zone score for the SPX cluster gets only `score += 2` from the Ximes signal itself — never the +2 from Bobby's king node or +2 from image confirmation.

**Result**: A HIGH-confidence Bobby king node at SPX 7070, directly aligned with Ximes's entry call, produces at best a LOW-confidence zone and likely a SKIP. This is the opposite of what the system is designed to do.

**Math**: With SPX Ximes entry (score +2) and no Bobby contribution: effective_score=2. Config threshold for MEDIUM is 3. The zone is LOW confidence → returns SKIP or WEAK at best.

**Fix** (surgical — add to `extractBobbyLevels` in confluence.js):
```javascript
function extractBobbyLevels(bob) {
  const bias     = bob.bias      || 'NEUTRAL';
  const hasImage = !!bob.has_image || bob.source === 'bobby-vision' || !!bob.vision_parsed;
  const ts_ms    = sigTimestampMs(bob);
  // Infer instrument with SPX range awareness
  function bobInfer(level) {
    if (level >= 7000 && level <= 8500) return 'SPX';  // SPX range
    return inferInstrument(level);
  }
  const results  = [];
  for (const l of (bob.king_nodes || [])) if (l > 0) results.push({ level: l, type: 'king_node', bias, hasImage, ts_ms, instrument: bobInfer(l) });
  for (const l of (bob.support   || [])) if (l > 0) results.push({ level: l, type: 'support',   bias, hasImage, ts_ms, instrument: bobInfer(l) });
  for (const l of (bob.resistance|| [])) if (l > 0) results.push({ level: l, type: 'resistance', bias, hasImage, ts_ms, instrument: bobInfer(l) });
  return results;
}
```
Then in `detectConfluence()`, use the pre-computed instrument instead of re-inferring:
```javascript
const bobLevels = (bobbyContext || []).flatMap(extractBobbyLevels);
// (remove the .map(b => ({...b, instrument: inferInstrument(b.level)})) step)
```

### 2d. Bracket calc — entry=7070, stop=7090, target=7040, SPX puts (SHORT)

**BROKEN for options pricing**

Execution:
- direction=SHORT, stop=7090 (above entry — correct for short)
- spec: SPX tick=0.01, dpt=100.0
- stop_ticks = |7070−7090| / 0.01 = **2,000 ticks**
- target_ticks = |7040−7070| / 0.01 = **3,000 ticks**
- risk_dollars = 2000 × $100 × 1 = **$200,000**
- reward_dollars = 3000 × $100 = **$300,000**
- rr_ratio = 1.5

The math applies a futures-style multiplier to option strike differences. SPX options premium does not move $100/point of underlying. A realistic risk on a single SPX put purchased at $3.50 with a 25% stop is $0.875 × 100 (multiplier) = $87.50. The calculated $200,000 is off by ~2,300×.

The direction inference for puts (SHORT) is correct: `rawDir === 'PUT' ? 'SHORT'` (slash-commands.js:384).

R:R of 1.5 passes the reject threshold (1.0) and warn threshold (1.5). The ratio math is incidentally correct because numerator and denominator are both wrong by the same factor. But the dollar values feed directly into the floor check and would always block SPX options trades (see 1b).

### 2e. Apex floor check — worked examples

| Scenario | Calculation | Result |
|----------|-------------|--------|
| balance=50553, floor=48053, risk=$400 | 50553−400=50153 > 48053 | PASS ✓ |
| balance=50553, floor=48053, risk=$2600 | 50553−2600=47953 < 48053 | BLOCK ✓ |
| balance=50553, floor=48053, risk=$2500 (exact) | 50553−2500=50053 > 48053 | PASS (no buffer — see F4) |

The arithmetic is correct. The missing $200 buffer means a trade can be taken that leaves Conor exactly at the floor, with no room for slippage or overnight adjustment.

---

## SECTION 3: CODE QUALITY — SURGICAL OPPORTUNITIES ONLY

### 3a. Agent reachability

| Agent | Mounted? | Hot path usage | Verdict |
|-------|----------|---------------|---------|
| agent-02-trader | ✓ | routeToAgent() on trading keywords in /chat | Reachable, rarely needed (slash path handles actual trading) |
| agent-02b-autonomous | ✓ | Core of 02B system | ESSENTIAL |
| agent-03-income | ✓ | routeToAgent() on instacart/shift keywords | Reachable, skeleton |
| agent-04-health | ✓ | routeToAgent() on luke/vet keywords | Reachable, used daily |
| agent-05-finance | ✓ | routeToAgent() on fund/tennessee keywords | Reachable |
| agent-06-research | ✓ | POST /research route | Reachable |
| agent-07-opportunity | ✓ | routeToAgent() on opportunity/job keywords | Reachable, skeleton |
| agent-08-sienna | ✓ | Manual POST /agent/sienna/analyze only | LOW USE, not auto-triggered |
| agent-09-architect | ✓ | Scheduled scan, manual /agent/architect/run | Functional |
| agent-10-sweeper | ✓ | Scheduled scan | Functional |
| agent-11-tokens | ✓ | trackUsage() called on every Claude call | ESSENTIAL |
| agent-12-fallback | ✓ | isFallbackActive() in /chat | Functional |
| agent-13-workflows | ✗ | **NOT MOUNTED** | PHANTOM — all routes unreachable |

### 3b. index.js extraction seams (top 3 by line savings)

1. **routeToAgent() + agentFetch()** (lines 195–318): ~124 lines. Clean self-contained function. No side effects on the surrounding context. Save as `lib/agent-router.js`.
2. **POST /research route** (lines 541–595): ~54 lines. Self-contained HTTP fetch + Claude call + memory write. No shared state with surrounding routes.
3. **Boot sanity, crash recovery, graceful shutdown** (lines 1002–1083): ~81 lines. Zero coupling to route handlers. Save as `lib/lifecycle.js`.

Total potential: ~259 lines removed from index.js (currently ~1,112 lines), bringing it to ~853 lines.

### 3c. Inline magic numbers not referenced from config.js

| Location | Value | Config equivalent | Status |
|----------|-------|------------------|--------|
| trading/broker-tradovate.js:28 | `55 * 60 * 1000` (token expiry) | None | NOT IN CONFIG |
| trading/signals.js:11 | `PREMARKET_WINDOW_MINUTES = 12 * 60` | None | NOT IN CONFIG |
| trading/signals.js:132 | `maxDrift = ticker === "MNQ" ? 180 : 45` | config.FINNHUB.MNQ_DRIFT_TICKS, ES_DRIFT_TICKS | **DUPLICATED — config not used** |
| trading/risk.js:94 | `drift_reject_ticks: 8, max_spread_ticks: 3, min_rr: 1.5` | config.THRESHOLDS.MARKET_GATE_DRIFT_TICKS etc. | **DUPLICATED — config not used** |
| lib/slash-commands.js:29 | `ALERT_DEDUP_MS = 60 * 1000` | config.TIMEOUTS.ALERT_DEDUP_MS = 60000 | **DUPLICATED — config not used** |
| lib/slash-commands.js:89 | `VISION_RATE_LIMIT_MS = 30 * 1000` | config.TIMEOUTS.VISION_RATE_LIMIT_MS = 30000 | **DUPLICATED — config not used** |
| agents/agent-09-architect.js:20 | `DAILY_BUDGET = 2.00` | None | NOT IN CONFIG |
| agents/agent-10-sweeper.js:22 | `COMBINED_DAILY_BUDGET = 5.00`, `MAX_OPEN_PROPOSALS = 10` | None | NOT IN CONFIG |
| agents/agent-11-tokens.js:12 | `SOFT_CAP = 5.00`, `HARD_CAP = 10.00` | None | NOT IN CONFIG |
| lib/emotional-exits.js:4 | `CAPITAL = 500` | config.EMOTIONAL.CAPITAL = 500 | **DUPLICATED — config not used** |

Pattern: config.js exists and has the right values, but the modules don't `require('./config')`. Dead config file for these modules.

### 3d. Claude API calls on hot paths

| Path | Model | max_tokens | Cost/call (est.) | Notes |
|------|-------|-----------|-----------------|-------|
| /alert | **NONE** | — | **$0** | Pure local logic. Optimal. |
| /chat → routeToAgent hit | claude-haiku-4-5-20251001 | 80 | ~$0.000025 | Ack generation |
| /chat → simple message | claude-haiku-4-5-20251001 | 150 | ~$0.00005 | Fine |
| /chat → complex message | claude-opus-4-7 | 800 | ~$0.06 | **FLAG**: Opus 4.7 for general chat is expensive. Haiku would handle 90% of cases. |
| 02B scoreSignals | claude-haiku-4-5-20251001 | 420 | ~$0.00015 | Fine |
| Bobby vision | claude-sonnet-4-6 | 600 | ~$0.002 | Appropriate for vision task |
| /see (screenshot) | claude-haiku-4-5-20251001 | 384 | ~$0.0002 | Fine |
| agent-08 synthesis | claude-opus-4-6 | 1500 | ~$0.12 | **FLAG**: Uses old model ID `claude-opus-4-6`. Should be `claude-opus-4-7`. Also — Haiku can write structured profiles. |
| agent-10 sweeper synthesis | claude-opus-4-7 | 2000 | ~$0.15 | **FLAG**: Scheduled job using Opus. Haiku synthesis would cut cost 60×. |

**Key finding**: /alert has zero AI latency. This is the correct design.

**Cost risk**: The `/chat → complex` branch hitting Opus 4.7 for a generic question ("what are bobby's levels?") could run $0.06/call. The `isSimpleMessage()` gate (index.js:416) is the only filter. A sentence longer than 20 chars that doesn't match the simple keywords goes to Opus. Consider expanding the Haiku gate.

### 3e. Synchronous I/O on /alert hot path

Seven sync reads, two sync writes on every /alert call:
1. `fs.readFileSync(TRADES_FILE)` — loadTodayContext
2. `fs.readFileSync(ACTIVE_TRADE_FILE)` — loadActiveTrade
3. `fs.readFileSync(LEVELS_FILE)` — loadLevels
4. `fs.readFileSync(BOBBY_CONTEXT_FILE)` — getSiennaRegime
5. `fs.readFileSync(HISTORY_FILE)` — getSiennaRegime
6. `fs.readFileSync(TRADES_JSONL)` — todayTradeCount
7. `fs.readFileSync(APEX_STATE_FILE)` — loadApexState
8. `writeJsonAtomic(ACTIVE_TRADE_FILE)` — writeActiveTrade (write + rename)
9. `writeJsonAtomic(LAST_SIGNAL_FILE)` — saveLastSignal

On local SSD this adds ~10-20ms total. Not blocking for a human-paced workflow. Could be async but not worth the refactor risk during eval. Flag for post-eval cleanup only.

### 3f. Global state that leaks between requests

| Variable | Location | Risk |
|----------|----------|------|
| `lastInstrument`, `lastDirection`, `lastStrike`, `sessionCtx` | lib/parse-ximes.js (module-level) | Session context from one signal bleeds into the next. If Conor pastes an SPX signal then pastes a management-only message, the sessionCtx.instrument bleeds. Intentional but never reset between days unless `/reset` is run. |
| `recentAlerts` (Map) | lib/slash-commands.js | Cleaned on each call (entries > 5min removed). Bounded. Low risk. |
| `lastVisionCallMs` | lib/slash-commands.js | Simple number. No accumulation. Fine. |
| `_lastCapAlert` | agents/agent-11-tokens.js | Module-level alert state. Single-user system, no cross-request contamination. Fine. |

**Material risk**: `sessionCtx.tradeStartTime` is set on first entry signal and never reset between trading days unless `/reset` is explicitly run. If Conor forgets to run `/reset` overnight, tomorrow's first signal inherits yesterday's session context.

---

## SECTION 4: USER EXPERIENCE — SKEPTICAL EYE

### 4a. Time-to-verdict on /alert path

**~10-20ms. No AI latency. This is correct.**

The full /alert path is: paste detection → parseXimes (regex, 0ms) → loadTodayContext (1 sync read) → checkEmotionalState (pure) → loadActiveTrade (1 sync read) → loadLevels (1 sync read) → detectConfluence (pure computation) → getSiennaRegime (2 sync reads) → todayTradeCount (1 sync read) → calculateBracket (pure) → loadApexState (1 sync read) → writeActiveTrade + saveLastSignal (2 sync writes) → broadcast WS → JSON response.

Zero Claude API calls. Realistic latency: 15-25ms. For a time-sensitive Ximes alert, this is excellent.

### 4b. Morning routine friction points (step-by-step against DAILY_OPS.md)

| Step | Friction point |
|------|---------------|
| Step 1: Paste RichyDubz /levels | No guidance on WHICH part of his morning message to copy. If he posts in multiple messages, Conor must manually pick the right one. No error if he pastes the wrong section — just 0 levels extracted. |
| Step 2: Paste Bobby /heatmap | Same. If Bobby posts multiple heatmap updates pre-market, no guidance on which to use. Most recent is best but DAILY_OPS.md doesn't say this. |
| Step 3: /confluence | Manual step. Should auto-trigger after both /levels and /heatmap succeed. Conor has to remember to run it. |
| MISSING: /balance | Not in DAILY_OPS.md at all (F2). Apex floor is stale from yesterday unless he runs it. If he made money yesterday and didn't update, tomorrow's floor check uses the wrong balance. |
| MISSING: 02B status | No mention of checking 02B running/stopped state. If 02B is in wrong mode (paper vs live), Conor has no reminder. |
| MISSING: /status check | DAILY_OPS.md doesn't instruct a /status run before trading. Missing from the pre-trade checklist. |
| Hard rule: "No more than 3 trades per day" | DAILY_OPS.md says this but Luke doesn't enforce a hard 3-trade limit. In RISK_OFF regime, max_trades_today=1. In NEUTRAL, 2. In RISK_ON, 3. If Conor manually logs trades in a RISK_ON day, the regime gate allows 3 but the emotional gate (2-loss limit) might block sooner. The DAILY_OPS max and the system max are not synchronized. |

### 4c. Multi-message paste behavior

When Conor copies 5 Ximes messages at once and pastes into Luke:

1. detectPasteIntent() finds ximes username in first 200 chars → routes to /alert
2. parseXimes(detectedUsername, text) receives the entire 5-message blob as a single text
3. Parser finds the FIRST signal pattern and returns it
4. Remaining 4 signals are silently dropped — no error, no count, no indication

**What Conor sees**: One SETUP or SKIP response. He doesn't know the other 4 signals were lost.

**When this hurts**: Ximes sometimes posts a series (entry → sizing update → management update) in quick succession. Conor pastes all 3. Luke processes the entry, ignores the sizing note and management signal. He gets a SETUP verdict but misses critical context (e.g., "only 2/5 contracts left").

### 4d. Management signal UX gap during live trades

When Ximes posts "UPDATED STOPS TO 1.43" during an active position:

1. Conor copies and pastes
2. detectPasteIntent detects ximes → routes to /alert
3. parseXimes returns MANAGEMENT/STOP_UPDATE correctly
4. /alert handler: checks for TRIM, RUNNER, CLOSE, ADD → none match STOP_UPDATE
5. Falls through to confluence check
6. `if (!strike)` fires → **returns "❌ SKIP — no strike found in signal"**

During a live trade, this is alarming and confusing. Conor sees a red SKIP when he should see "⏺ STOP UPDATED TO $1.43 — move your stop." This is the worst time for ambiguity.

**Same failure applies to TARGET_UPDATE** (Ximes: "target on NVDA 199.5" → "❌ SKIP — no strike found").

**Fix** (in slash-commands.js, after MANAGEMENT action checks at line ~310):
```javascript
if (signal.action === 'STOP_UPDATE') {
  return res.json({ reply:
    '⏺ STOP UPDATE — Move your stop to ' +
    (signal.price ? '$' + signal.price : 'price in message') + '.\n' +
    '→ Adjust in Tradovate now.'
  });
}
if (signal.action === 'TARGET_UPDATE') {
  return res.json({ reply:
    '🎯 TARGET UPDATE — ' +
    (signal.ticker ? signal.ticker + ' ' : '') +
    'new target: ' + (signal.price || 'see message') + '.\n' +
    '→ Adjust OCO target if needed.'
  });
}
```

### 4e. /status output — what's missing

Current output covers: market open/closed, levels loaded, today's trade count/P&L, emotional state, regime, Luke log age, last signal.

**Missing from /status that matters before trading:**
- Apex floor: current balance vs floor vs headroom. "You have $2,500 of risk budget before floor."
- 02B state: running/stopped, mode (paper/live/shadow), whether kill_day is active.
- Token budget: daily cost vs hard cap ($10). If at 85%, should not run expensive analysis.
- Active trade: if active-trade.json exists, show what's open. Prevents duplicate entries.
- /balance staleness: last time /balance was updated (if > 24h, flag it).

### 4f. SKIP reason transparency

| SKIP trigger | Message shown | Clear? |
|-------------|--------------|--------|
| Weekend | "❌ Market closed. Weekend." | ✓ |
| Pre/post market | "⏰ Market closed. Opens 9:30 AM ET." | ✓ |
| Lunch window | "⚠️ Lunch chop window..." | ✓ |
| Last 10 mins | "⚠️ Last 10 mins. Ximes says no responsibility..." | ✓ |
| HARD emotional block | emoji + message | ✓ |
| parseXimes returns null | "❌ SKIP — could not parse signal" | **VAGUE** — was it unknown analyst, length limit, or bad format? |
| STOP_UPDATE/TARGET_UPDATE | "❌ SKIP — no strike found in signal" | **MISLEADING** — this is a management signal, not a failed parse |
| No confluence | "❌ SKIP — no confluence at [strike] [instr] today" | ✓ |
| Regime max trades | "🚫 BLOCKED — max X trades today reached [REGIME]" | ✓ |
| Duplicate alert | "🔁 Duplicate alert (fired Xs ago)" | ✓ |
| Active trade open | "⚠️ Active trade detected..." | ✓ |
| Bracket error | "❌ SKIP — bracket error: [msg]" | ✓ |
| R:R too low | Shows R:R value | ✓ |
| Apex floor breach | "⛔ APEX FLOOR — risks breaching..." | ✓ |

Two SKIP paths need fixing: parse failure reason and management signal passthrough.

### 4g. EXECUTE button failure modes

| Scenario | Behavior | User experience |
|----------|----------|----------------|
| EXECUTE when 02B is OFF | execute-staged: `if (!state.running)` → `{ executed: false, reason: "02B not running" }`, pending_signal cleared | **Popup closes silently.** No notification to Conor. Trade is lost. He doesn't know if it executed or failed. |
| Double-click EXECUTE | First click clears pending_signal. Second click: "No pending signal" → returns false. | Safe — no double order. |
| Stale active-trade.json from crash | loadActiveTrade returns open trade → /alert blocks with "⚠️ Active trade detected". | User must run `/trade [details]` to close it. No recovery path is mentioned in DAILY_OPS.md. |
| Popup expires (60s) | Popup closes. Pending signal remains in state until cleaned on next execute-staged call. | **02B is now blocked** — `state.pending_signal` exists with valid expires_at. Next evaluate call skips because pending. Next execute-staged will find expired signal and clean it. Silent blocking for up to 5 minutes if evaluate runs first. |

---

## SECTION 5: SYBIL / ANALYST KNOWLEDGE BASE

### 5a. Historical pattern opportunities

From the discord-exports and current signal structure, these patterns repeat:
- **Ximes step-back language**: "skip this", "wait for 3pm", "stops in" (no price), "check stream for prices" — these are NOT signals. They should be detected and surfaced as "XIMES STEPPING BACK — hold or reduce risk."
- **Level repetition**: King nodes mentioned across multiple sessions (e.g., SPX 5000 in 2024) have proven magnetic. Level repetition count is untapped signal.
- **Management-only sessions**: When Ximes posts 3+ consecutive MANAGEMENT signals with no new entries, it signals a choppy session. This is already partially implemented in sienna-regime.js but only reads from `discord-history.jsonl` with `source: 'intraday-scraper'`, which requires the intraday scraper to be running.
- **Bobby's VIX language**: "VIX between two high-value nodes" = danger. Currently flagged via vix_mentioned boolean, but not weighted in confluence score.

### 5b. Right home for historical knowledge

`agent-08-sienna.js` is the correct home. It already has `analyze` and `score-signal` endpoints and the `SIENNA_PROFILE.md` structure. The gap is it requires manual triggering (`POST /agent/sienna/analyze`) and isn't auto-integrated into the daily confluence calculation.

A static JSON knowledge base read by `confluence.js` would be more efficient than real-time AI scoring for historical patterns:
```
data/analyst-patterns.json
{
  "ximes_step_back_phrases": [...],
  "high_conviction_phrases": ["trinity aligned", "king node clearing"],
  "repeat_levels": { "5000": 12, "5500": 8 },
  "bobby_danger_phrases": ["VIX between two", "no floor on SPY"]
}
```

### 5c. Minimum viable fields (5) to improve verdict quality today

1. **`step_back_rate_today`**: Count of "skip/wait/no responsibility" Ximes messages today ÷ total Ximes messages. If > 0.5, reduce confluence score multiplier by 0.5. Low effort, high signal.
2. **`level_repetition_score`**: For each confluence zone, count how many times that price ±10 pts has appeared in the last 30 days of discord history. Add score += log(count) to zone scoring. Repeated levels have proven gravity.
3. **`vix_weight`**: If Bobby mentions VIX in today's context, current system sets RISK_OFF (already done). Enhancement: also reduce confluence HIGH → MEDIUM across the board for the day. One-line change.
4. **`analyst_silent_hours`**: Track hours since last Ximes signal. If >2h during market hours, regime → RISK_OFF automatically. Ximes stepping away often precedes session ending.
5. **`pre_market_alignment`**: Whether Ximes pre-market setup direction matches the first live entry direction. If mismatch, reduce confidence by one level. This is extractable from `signal_type='PRE_MARKET_SETUP'` in today's signals.

### 5d. Bobby image+text auto-correlation — next step

Current state: Bobby posts → Conor manually pastes /heatmap → vision runs on demand.

The correct next step is not just better parsing — it's **eliminating the manual step entirely**:

1. Add Bobby-specific message detection to the intraday Discord scraper (detect posts from username containing "bobby" or in `#bobby-spx-coms`)
2. When Bobby posts a new message with an attached image, auto-trigger `parseBobbyImage()` in the background
3. Auto-append the result to `bobby-context.jsonl` with `auto_parsed: true`
4. Broadcast a WS notification: "Bobby heatmap updated — N nodes found. Run /confluence to refresh."
5. On the next `/alert`, `detectConfluence` will use the updated Bobby context automatically

This removes a required manual action from the pre-trade workflow and ensures Bobby's intraday heatmap updates (which he posts multiple times during the session) are captured without Conor having to monitor Discord manually.

---

## SECTION 6: COMMERCIAL ROADMAP

### 6a. Conor-specific items to strip or make configurable

| Location | Content | Action |
|----------|---------|--------|
| lib/system-prompt.js:118 | "Conor, 32 on June 17th... Kat... Luke PLE... Buffalo... Tennessee... Instacart... Public History" | Extract to `user-profile.json`, load at runtime |
| lib/emotional-exits.js:4 | `CAPITAL = 500` | Move to user config |
| agents/agent-04-health.js | Entire Luke medical tracking system | Personal module, ship separately or feature-flag |
| agents/agent-03-income.js | Instacart-specific patterns | Generic gig-income agent with platform config |
| agents/agent-05-finance.js | Tennessee fund, $6k goal, mid-June 2026 | Replace with generic savings goal config |
| lib/parse-ximes.js:20 | `ANALYST_MAP` (ximestrades, followthewhiterabblt, kanabis16 hardcoded) | Move to analyst-config.json, loadable per user |
| ingest-exports.js:72 | `server: 'OWLS Capital'` hardcoded | Config-driven |
| DAILY_OPS.md | "Luke meds" section | Personal document, not shipped |
| index.js:118 | "I was built because you're tired of losing." | Keep (it's good copy) |

Agents that are personal-only: 03 (Instacart), 04 (Luke health), 05 (Tennessee fund).
Agents that are generalizable: 02 (trader), 02B (autonomous), 06 (research), 08 (sienna), 09 (architect), 10 (sweeper), 11 (tokens), 12 (fallback), 13 (workflows).

### 6b. Analyst ingestion config schema (minimum viable)

```json
{
  "analysts": [
    {
      "id": "ximes",
      "usernames": ["ximestrades", "followthewhiterabblt"],
      "relay_usernames": ["kanabis16"],
      "role": "signal_primary",
      "channels": ["ximes-dubz"],
      "signal_parser": "ximes_v1",
      "enabled": true
    },
    {
      "id": "bobby",
      "usernames": ["bobby-spx"],
      "role": "heatmap_context",
      "channels": ["bobby-spx-coms"],
      "signal_parser": "bobby_heatmap",
      "auto_parse_images": true,
      "enabled": true
    }
  ],
  "instruments": ["SPX", "SPY", "MNQ", "MES"],
  "account": {
    "size": 500,
    "broker": "tradovate",
    "eval_type": "apex_50k_eod_trail"
  }
}
```

### 6c. Screen-based execution for Tradovate

**Current state**: `desktop.py` uses win32 for screen actions. The click-path for a Tradovate market order:

1. `win32gui.FindWindow(None, "Tradovate")` → get window handle
2. `win32gui.SetForegroundWindow(hwnd)` → focus window
3. Image recognition (via PyAutoGUI or template matching) to locate Order Entry panel
4. Locate Buy/Sell button by pixel coordinate or OCR
5. Set quantity field (click → type "1")
6. Click Market order type radio
7. Click Submit/Confirm button
8. Screenshot verify: order confirmation message visible

**Risks**:
- Screen coordinates break on resolution change or window resize
- Confirmation dialogs (not always present) create state machine complexity
- OCR/template matching false positives can click wrong UI element
- Concurrent screen use (Conor scrolling Discord) can intercept click

**Verdict**: The Tradovate REST API (already implemented in execution-live.js) is more reliable, faster, and auditable. Screen-based execution is a fallback for brokers with no API (IBKR desktop-only workflows). Do not build screen-based Tradovate execution — you have a better path.

### 6d. Options execution — realistic path

Tradovate does not support options trading. For options (SPY/SPX contracts Ximes calls):

**Broker API options**:
- **IBKR (Interactive Brokers)**: Full options support via `ib_insync` Python library. Requires account, TWS running, or IB Gateway. Latency: 50-200ms via local TWS.
- **Schwab API**: Options supported. Free but rate-limited (120 requests/minute).
- **Tastytrade API**: Options-focused, developer-friendly, documented REST API.

**Minimum requirements for execution**:
1. Expiry selection: algorithm to pick nearest weekly (0DTE or 1DTE based on Ximes's call)
2. Strike selection: use parsed strike from Ximes signal or closest liquid strike
3. Quantity: 1 contract default
4. Order type: limit at mid or market for fast fills
5. Greeks: at minimum, check delta > 0.2 to avoid deep OTM. No full greeks engine needed.

**Realistic build time**: 4-6 weeks for IBKR integration with basic execution. This is post-eval work.

### 6e. Multi-user architecture — minimum change set

Current single-user constraints:
- State in local JSON files (atomic writes)
- Port 3000 hardcoded
- Electron desktop delivery
- WS token per boot, single set of clients

For 100 concurrent users following the same analyst:

| Component | Current | Multi-user target |
|-----------|---------|-----------------|
| Signal ingestion | Manual paste per user | One Discord poller → Redis pub/sub fan-out |
| Confluence state | Local JSON files | Redis or Postgres per user |
| Trading state | `autonomous-state.json` | Per-user document in Postgres |
| Auth | None (localhost only) | JWT per user, broker credentials encrypted |
| Delivery | Electron (desktop) | Web app (React) + Express API |
| Execution | Per-user broker API | Unchanged — each user's own broker creds |
| WS | Single broadcast | Per-user room via socket.io rooms |

What stays local: broker API calls (user's own credentials, latency-sensitive).
What moves to server: signal ingestion, confluence calculation, regime detection, token tracking.

Minimum architecture change: separate the ingest/evaluate pipeline from the execution layer. Ingest runs on the server; execution runs locally (or via managed broker API). This preserves the human-execution gate while scaling signal processing.

### 6f. Fully functional income optimization for Conor

**Agent-03 (Instacart) — functional build**:
- Input: shift log via `/agent/income/log-shift` (exists), GPS data (if available from phone)
- Analysis: hourly rate by zone, batch rate by time of day, weather correlation (OpenWeather API)
- Recommendation engine: "Zone A yields $28/hr on weekday mornings vs $19/hr Zone B — prioritize A until 11am"
- Alert: PM notify when high-demand windows approaching (Friday 5pm, Sunday 12pm)
- Data sources: Instacart earnings via screenshot OCR or manual log; Yahoo Weather API; historical shift log

**Agent-07 (Opportunity) — functional build**:
- Data sources: Upwork RSS feed (jobs tagged AI, trading, fintech), Toptal application form (if approved), LinkedIn API (limited free tier)
- Filter: keyword match against Conor's skill profile (Claude API, Node.js, Python, trading systems)
- Score: match quality (0-10), estimated rate, project length
- Output format: morning briefing push notification with top 3 opportunities + draft proposal opening line per project
- Actions: draft full proposal via Claude API (already wired); would need platform-specific submit mechanism

---

## SECTION 7: SCORING

### New findings (this audit)

| ID | Severity | File | Issue | Impact |
|----|----------|------|-------|--------|
| A-01 | **P0** | lib/confluence.js:78-86 | Bobby levels classified as 'ES' instead of 'SPX' due to missing tickerHint — prevents Ximes/Bobby clustering for SPX options | All SPX options signals get LOW confidence or no confluence. Core use case broken. |
| A-02 | **P0** | lib/bracket-calc.js:11 | SPX.dpt=100.0 applied to strike differences → $200,000+ risk per contract calculation → always triggers Apex floor block | SPX options bracket is unusable. Floor check always fires. All SPX option trades blocked. |
| A-03 | **P0** | index.js:341-363 | `/chat` parseXimes intercept calls `parseXimes(message)` with 1 arg; function expects 2 → always returns null. Both LIVE_ENTRY and MANAGEMENT intercepts are dead code. | Signals typed directly into chat (not via paste detection) never route to /alert. Falls through to Claude. |
| A-04 | **P1** | lib/slash-commands.js:291-314 | STOP_UPDATE and TARGET_UPDATE management signals not handled → fall through to "❌ SKIP — no strike found" | During live trades, critical stop/target updates display as SKIP. Confusing and alarming. |
| A-05 | **P1** | lib/slash-commands.js (multi-paste) | Multi-message paste from Discord: only first parseable signal processed; remaining silently dropped | Ximes rapid-fire sequences (entry + sizing + management) partially processed. Conor misses context. |
| A-06 | **P1** | ingest-exports.js:68 | `parseXimes(msg.username, msg.text, lastSignal, lastSignalTime)` passes 4 args; function signature accepts 2 | 3rd and 4th args silently ignored. lastSignal context for sequential signal chaining never applied. Historical ingestion may miss signals that depend on previous context. |
| A-07 | **P2** | trading/router.js:345-348 | Dangling `else await stageTrade(...)` attaches to `if (floorBlock)` not to the commented-out mode checks. Incidentally correct but maintenance trap. | If floor check is refactored, stageTrade may stop being called. Silent logic break risk. |
| A-08 | **P2** | agents/agent-02-trader.js:12 | Finnhub API key hardcoded as fallback value | Live credentials in source code. Rotation risk. (F6 confirmed still present in this file.) |

### Scoring table

| Category | Base | P0 deductions (−3 each) | P1 deductions (−1.5 each) | P2 deductions (−0.5 each) | Score |
|----------|------|------------------------|--------------------------|--------------------------|-------|
| **Compliance** | 10 | A-02 SPX floor always fires (−3) | F1 consistency cap (−1.5), F3 test hooks (−1.5), F4 no buffer (−1.5), 1d no news blackout (−1.5) | | **1/10** |
| **Correctness** | 10 | A-01 SPX confluence broken (−3), A-03 /chat intercept dead (−3) | A-04 STOP_UPDATE UX (−1.5), A-05 multi-paste (−1.5), A-06 ingest args (−1.5), F5 partial (−0.75) | A-07 dangling else (−0.5) | **-1 → 1/10** |
| **Code Quality** | 10 | | F7 agent-13 not mounted (−1.5), A-08 hardcoded key (−1.5) | config.js not referenced (−0.5), dead code /chat (−0.5), duplicate magic numbers (−0.5) | **5.5/10** |
| **UX Under Pressure** | 10 | | A-04 STOP_UPDATE SKIP (−1.5), A-05 multi-paste loss (−1.5), 4g EXECUTE silent failure (−1.5) | 4e /status missing info (−0.5), 4b missing /balance in OPS (−0.5), 4c multi-paste UX (−0.5) | **4/10** |
| **Eval Readiness** | 10 | A-01 SPX confluence broken (−3), A-02 SPX bracket broken (−3) | F1 consistency cap (−1.5), F3 test hooks (−1.5), F4 no buffer (−1.5) | | **0 → 1/10** |

### P0 findings — exact fixes

**A-01 Fix** (confluence.js — add SPX range to Bobby level inference):
```javascript
// confluence.js — in extractBobbyLevels(), replace the push calls:
function extractBobbyLevels(bob) {
  const bias     = bob.bias      || 'NEUTRAL';
  const hasImage = !!bob.has_image || bob.source === 'bobby-vision' || !!bob.vision_parsed;
  const ts_ms    = sigTimestampMs(bob);
  const results  = [];
  function inferBobbyInstrument(level) {
    // Bobby exclusively covers SPX. Levels in the 7000-8500 range are SPX, not ES.
    if (level >= 6000 && level <= 9000) return 'SPX';
    if (level >= 4000 && level <= 6000) return 'SPX'; // lower SPX range
    return inferInstrument(level);
  }
  for (const l of (bob.king_nodes || [])) if (l > 0) results.push({ level: l, type: 'king_node', bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  for (const l of (bob.support   || [])) if (l > 0) results.push({ level: l, type: 'support',   bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  for (const l of (bob.resistance|| [])) if (l > 0) results.push({ level: l, type: 'resistance', bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  return results;
}
// In detectConfluence(), change bobLevels line to:
const bobLevels = (bobbyContext || []).flatMap(extractBobbyLevels)
  .map(b => ({ ...b, instrument: b._instrument || inferInstrument(b.level) }))
  .filter(b => b.instrument !== null);
```

**A-02 Fix** (bracket-calc.js — SPX options use premium-based risk, not strike-based):
This requires a design decision. Options bracket calculation cannot use the same model as futures. Two approaches:
1. Use a separate `OPTION_SPECS` model with premium as entry (not strike) and `-25%` stop
2. Cap SPX/SPY risk_dollars at a sane maximum (e.g., `Math.min(risk_dollars, account_size * 0.10)`) as a guard

Option 1 requires Ximes to report premium, which he sometimes does (`entry_price` field). Option 2 is a safety band. This is a **design decision** — stopping here. Do not implement without Conor input.

**A-03 Fix** (index.js:341 — fix parseXimes argument count):
```javascript
// index.js line 341 — change:
const parsed = parseXimes(message);
// to:
const parsed = parseXimes(null, message);

// index.js line 342 — change:
if (parsed && parsed.type === "signal" && parsed.strike) {
// to:
if (parsed && parsed.signal_type === "LIVE_ENTRY" && parsed.strike) {

// index.js line 348 — change:
if (parsed && parsed.type === "MANAGEMENT") {
// to:
if (parsed && parsed.signal_type === "MANAGEMENT") {
```

**F3 Fix** (NODE_ENV test hooks):
```javascript
// trading/router.js line 718 — change:
if (process.env.NODE_ENV !== "production") {
// to:
if (process.env.NODE_ENV === "test") {
```
**And set NODE_ENV for the production run path. In electron.js startServer():**
```javascript
serverProcess = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: 'ignore',
  detached: false,
  env: { ...process.env, NODE_ENV: 'production' }  // ADD THIS
})
```

---

## FINAL SCORING TABLE

| Category | Score |
|----------|-------|
| Compliance | 1/10 |
| Correctness | 1/10 |
| Code Quality | 5.5/10 |
| UX Under Pressure | 4/10 |
| Eval Readiness | 1/10 |

## OVERALL VERDICT: NOT READY

**Blocking reasons (must fix before live trading):**

1. **SPX options trades cannot work** (A-01 + A-02): Confluence never clusters SPX Ximes signals with Bobby context. Bracket calc returns $200k risk for every SPX option. All SPX trades are either LOW confluence or floor-blocked. Ximes calls SPX options exclusively. The entire primary use case is broken.

2. **Consistency cap not enforced for manual trades** (F1): Apex rules require the cap apply to all trading, not just 02B. A manual win day followed by a 02B session could silently violate the rule with no warning.

3. **Test injection routes live in production** (F3): POST to `/_test/inject-state` can set any field in trading state. One misrouted request could disable kill switches or fabricate an open position. This is a latent risk that costs one line to fix.

**After fixing A-01, A-02 design decision, A-03, and F3 — verdict upgrades to READY WITH CAVEATS.**

Remaining P1 items (STOP_UPDATE UX, multi-paste, Finnhub hardcoded key, agent-13 not mounted) are quality-of-life issues that do not break the eval but will frustrate live trading. Fix A-04 (STOP_UPDATE) before your first live session — it will fire during a trade and you will misread it.
