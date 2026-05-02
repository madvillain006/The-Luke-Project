# Luke

Luke is a local trading copilot for Conor's index/futures workflow.

It turns daily analyst inputs into a cleaner decision surface:
- what levels matter
- where confluence exists
- where not to trade
- what trade is most worth taking
- when the system is not ready and should refuse to bluff

This README is the front door and table of contents for the repo.

## What Luke does

Primary workflow:
1. Load daily structure
2. Store levels in Level Memory
3. Score confluence across analysts
4. Turn top levels into futures entry recommendations
5. Optionally stage autonomous recommendations without executing them

Main user-facing commands:

- `/status`
  - shows market state, what is loaded, what is missing, and what to do next
- `/balance`
  - load current eval/account balance for Apex-style guardrails
- `/saty`
  - load Saty ATR levels
  - these are treated as `SPX` levels, then surfaced to `ES` via equivalence
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
  - stored as `SPX`
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

- `data/level-memory.json`
  - canonical store for levels and mentions
- `data/dubz-levels.json`
  - modern Dubz state
- `data/historical/`
  - intraday historical bars for backtest/replay
- `state/snapshots/trading-state.json`
  - primary autonomous staging/risk state snapshot
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
  - autonomous staging system
  - stage-only, not blind execution
- `trading/signals.js`
  - Ximes-style signal parsing and scoring path
- `agents/agent-14-kat.js`
  - Katbot Discord ingest/context sidecar

## What Luke needs to function

- Node/Electron dependencies installed
- `pm2` for server/scheduler process management
- valid model/API credentials for LLM-backed paths
- live analyst inputs loaded each session
- writable local state files
- fresh same-day Bobby/Dubz context before recommendations or autonomous staging should be trusted

## Morning workflow

Use this order:

1. `/balance`
2. `/saty`
3. `/dubz`
4. `/heatmap`
5. optional `/mancini`
6. `/status`
7. `/verdict`
8. `/entries ES`

If `/entries ES` refuses because inputs are stale or missing, trust the refusal.

## Important design truths

- Saty is SPX truth, not ES truth
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
- `docs/legacy-root/TECH_DEBT.md`
  - historical deferred work and known future-phase needs
- `docs/NAMING_CLEANUP.md`
  - current naming decisions and preserved compatibility names

## Current posture

Luke is a real supervised trading tool.

Current best use:
- disciplined manual decision support
- futures recommendation support
- safe staged autonomous suggestions

Current wrong use:
- blind unattended trading
- trusting stale inputs
- trusting any output that contradicts eyes-on-screen market reality
