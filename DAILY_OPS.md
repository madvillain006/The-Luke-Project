---
# JARVIS DAILY OPS
Quick reference. Read this before touching anything.

## BEFORE YOU START
1. Check Jarvis is NOT running:
   tasklist | findstr node
   If node.exe running → taskkill /F /IM node.exe /T

2. Start Jarvis manually only:
   cd C:\Users\conor\jarvis
   node index.js

## MORNING ROUTINE (8:30-9:20 AM)

### Step 1 — Paste RichyDubz levels (8:30-9:00 AM)
RichyDubz posts pre-market levels in ximes-dubz channel every morning.
Copy his morning message. In Jarvis chat type:
  /levels [paste message here]
Jarvis extracts: SPY/SPX/NQ/ES key levels, bias, support, resistance.

### Step 2 — Paste Bobby heatmap context (9:00-9:20 AM)
Bobby posts heatmap commentary in bobby-spx-coms.
Copy his text. In Jarvis chat type:
  /heatmap [paste message here]
Jarvis extracts: king nodes, support, resistance, VIX context.

### Step 3 — Check today's confluence
In Jarvis chat type:
  /confluence
Jarvis shows today's HIGH and MEDIUM zones only.
These are your levels for the day.

## DURING MARKET HOURS

### When Ximes posts an alert:
Copy the alert from ximes-dubz Discord.
In Jarvis chat type:
  /alert [paste alert here]
Jarvis responds with one of:
  ✅ SETUP — level, direction, confidence, stop, target
  ⚠️  WEAK — why it doesn't meet threshold
  ❌ SKIP — no confluence, do not trade

### If setup is ✅ SETUP:
YOU decide to trade or not.
YOU enter the trade manually in Tradovate.
YOU set stop and target per Jarvis output.
Jarvis NEVER places orders.

### Checking levels during day:
  /levels today    → today's RichyDubz levels
  /heatmap latest  → latest Bobby context
  /confluence      → current zone scores

## END OF DAY

### Log your trade (if you traded):
  /trade [LONG/SHORT] [ticker] [entry] [exit] [result]
Example:
  /trade LONG SPY 699 702 WIN

### Daily review:
  /review → shows today's setups, what you took, results

### Daily reset (run AFTER review, before next session):
  /reset → clears today-levels.json and last-signal.json (does NOT clear trades.jsonl)
  Then paste /levels and /heatmap fresh next morning.

## COMMANDS REFERENCE
/levels [text]     → parse and store RichyDubz levels
/heatmap [text]    → parse and store Bobby context
/confluence        → show today's confluence zones
/alert [text]      → check Ximes alert against confluence
/trade [details]   → log a completed trade
/review            → today's summary
/status            → Jarvis system status
/stop              → shut down Jarvis safely
/reset             → clear today's levels + last signal (not trades) — run EOD

## HARD RULES (read every day)
- Jarvis suggests. You decide. You execute.
- No trade without defined stop AND target.
- No trade if Jarvis says SKIP or WEAK.
- No more than 3 trades per day.
- Stop trading after 2 losses in one day.
- Never trade last 10 minutes of session (3:50 PM+).
- Luke meds: 4:00 AM omeprazole, 4:30 AM mirtazapine + prednisone WITH FOOD.

## WHEN THINGS BREAK
Jarvis won't start:
  pm2 kill
  node index.js

PowerShell windows keep popping up:
  taskkill /F /IM node.exe /T
  taskkill /F /IM electron.exe /T

Something acting weird:
  /status → check what's running
  Restart before trading. Never trade on a broken system.

## FILE LOCATIONS
Signals:     discord-history.jsonl
Bobby:       bobby-context.jsonl
Trades:      trades.jsonl
Logs:        logs/strategy-progress.log
This file:   DAILY_OPS.md
Status:      JARVIS_STATUS.md
Rules:       docs/ARCHITECTURE_RULES.md
---
