# Luke

Luke is a local AI companion and operations dashboard. It combines shared memory, daily planning, Radar intake, research synthesis, and supervised trading decision support in one front-facing app.

It turns daily analyst inputs into a cleaner decision surface:
- what levels matter
- where confluence exists
- where not to trade
- what trade is most worth taking
- when the system is not ready and should refuse to bluff

This README is the front door and table of contents for the repo.

## Launch

Double-click `Launch Luke.cmd` from this folder to open Luke.

The launcher opens the Electron shell at `http://localhost:3000/shell`. If the local server is not already running, Electron starts `node index.js`; if Luke is already running on port `3000`, it reuses that server and opens the dashboard.

Terminal fallback:

```powershell
npm start
```

## What Luke does

Primary workflow:
1. Capture user context into shared memory
2. Pull Radar/Daily material into the same operating picture
3. Load daily trading structure when the user is in the Trading surface
4. Store levels in Level Memory
5. Score confluence across analysts
6. Turn top levels into supervised futures entry recommendations
7. Optionally stage autonomous recommendations without unattended execution

Main user-facing commands:

- `/status`
  - shows market state, loaded context, manual blockers, and the next safe action
- `/balance`
  - load current eval/account balance for Apex-style guardrails
- `/saty`
  - manual override/debug view for Saty ATR levels
  - Saty is normally generated from previous close levels, stored as `SPX`, then surfaced to `ES` via equivalence
- `/dubz`
  - parse RichyDubz morning levels and write them into Level Memory
- `/heatmap`
  - parse Bobby text/heatmap context and write it into Level Memory
- `/mancini`
  - parse Adam Mancini ES/SPX levels, triggers, targets, and chop zones
- `/verdict`
  - broad confluence view across loaded levels
- `/entries ES`
  - the main "this is the trade" surface for futures
  - returns side, entry, acceptable zone, stop, target, sizing, and avoid zones
- `/backtest <INSTRUMENT> <YYYY-MM-DD>`
  - replay historical intraday bars against recorded levels
- `/trading-mode`
  - launch/arrange Luke in the active trading layout

## What feeds Luke

### Analyst inputs

- Saty
  - structural ATR/ribbon levels
  - generated automatically from previous close levels and stored as `SPX`
- Bobby
  - text + heatmap structure
  - stored in Level Memory as Bobby mentions
- RichyDubz
  - text/image morning levels
  - stored in modern Dubz state and Level Memory pathing
- Adam Mancini
  - text-only ES/SPX triggers, targets, and chop zones
- Katbot
  - Discord sidecar context from the existing monitored analyst pool only
  - useful as background swarm context, not primary truth

### Core state files

- `state/snapshots/memory.json`
  - shared Luke companion memory used by both Luke Chat and Trading
- `data/level-memory.json`
  - canonical store for levels and mentions
- `data/dubz-levels.json`
  - modern Dubz state
- `data/historical/`
  - intraday historical bars for backtest/replay
- `state/snapshots/trading-state.json`
  - primary trading risk/recommendation state snapshot
- `state/events/trading-events.jsonl`
  - append-only trading state event log
- `autonomous-state.json`
  - legacy compatibility mirror for recovery; not the primary state name

## Main subsystems

- `index.js`
  - main Express/Electron app entry
- `chat.html`
  - local UI
- `lib/level-memory.js`
  - append-only canonical level store
- `lib/confluence-engine.js`
  - scoring and cross-instrument equivalence
- `lib/parse-bobby.js`
  - Bobby text/image pipeline
- `lib/parse-dubz.js`
  - Dubz parser + state writer
- `lib/parse-mancini.js`
  - Mancini parser + Level Memory writer
- `lib/historical-data.js`
  - historical intraday CSV loader
- `lib/level-replay.js`
  - observational replay of price vs level behavior
- `lib/futures-entry-zones.js`
  - futures entry/abort zone builder
- `lib/slash-commands.js`
  - user-facing command surface
- `trading/router.js`
  - autonomous evaluation and explicit staged-execution routes
  - autonomous evaluation is recommendation-only through Luke chat
  - staged/paper/shadow execution remains a separate explicit confirmation flow
- `trading/signals.js`
  - Ximes-style signal parsing and scoring path
- `agents/agent-14-kat.js`
  - Katbot Discord ingest/context sidecar
- `lib/companion-memory.js`
  - shared memory capture, retrieval, and prompt context for Luke Chat and Trading
- `lib/command-recovery.js`
  - typo-aware command recovery for known Luke commands

## What Luke needs to function

- Node/Electron dependencies installed
- `pm2` for server/scheduler process management
- valid model/API credentials for LLM-backed paths
- live analyst inputs loaded each session
- structured market data provider ladder available for every core symbol
- writable local state files
- fresh same-day Bobby/Dubz context before recommendations should be trusted

## Morning workflow

Use this order:

1. `/balance`
2. `/dubz`
3. `/heatmap`
4. optional `/mancini`
5. `/status`
6. `/verdict`
7. `/entries ES`

If `/entries ES` refuses because inputs are stale or missing, trust the refusal.

## Important design truths

- Luke is a companion interface, not a memorial product surface
- the front-page memorial text stays in the UI; repo docs stay product-focused
- Luke Chat and Trading share companion memory
- Luke Chat and Trading are two doors into one merged conversation layer; explicit trading commands route internally
- Saty is SPX truth, not ES truth
- Saty is generated by Luke from previous close context; `/saty` is an override, not a daily prep requirement
- market-data routes return structured quotes or `UNKNOWN` with provider attempts instead of throwing operator-facing price errors
- ES views inherit SPX levels through equivalence mapping
- Mancini chop zones are exclusion zones, not entries
- `/entries ES` is the current highest-trust recommendation surface
- autonomous mode is supervised staging only
- if autonomous and `/entries` disagree, autonomous should lose

## Docs map

- `README.md`
  - this file
- `CHANGELOG.md`
  - main running log of meaningful changes
- `docs/MONDAY_OPS.md`
  - operational morning checklist
- `docs/ARCHITECTURE_CURRENT.md`
  - current routes, launch path, state locations, and agent boundaries
- `docs/STRATEGY_SOURCE_MAP.md`
  - analyst/source mapping for trading inputs
- `docs/LIVE_BLOCKERS.md`
  - known blockers before live confidence claims

## Current posture

Luke includes a real supervised trading tool, but the project is broader than trading.

Current best use:
- disciplined manual decision support
- futures recommendation support
- safe staged autonomous suggestions

Current wrong use:
- blind unattended trading
- trusting stale inputs
- trusting any output that contradicts eyes-on-screen market reality
