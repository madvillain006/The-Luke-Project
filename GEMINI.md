# Luke Project Instructions

Luke is Conor's trading decision-support assistant. Conor makes all final trading decisions. Treat this repo as a live trading support system, not a playground.

## Current Mission

Stabilize and harden Luke's core trading workflow first:

1. Keep sacred trading paths reliable.
2. Reduce duplicate state, stale residue, mojibake, and dead systems.
3. Improve live-trading confidence through tests, smoke checks, and boring reliability.
4. Keep backtesting/research isolated until proven.
5. Defer Katbot, free LLM backup, and side systems unless explicitly requested.

Do not add features before protecting the core.

## Hard Safety Rules

- Never enable autonomous or unattended trading execution.
- Never call broker/live execution endpoints unless Conor explicitly asks.
- Never weaken stop/target requirements, stale-input refusals, Apex rule checks, chop-zone protections, low-confidence no-trade behavior, or human-in-the-loop gates.
- Never restart PM2 or mutate live trading state casually. For server/runtime changes, run tests first, explain the reload reason, then reload only when needed.
- Always check the current worktree before editing. Preserve unrelated user work and dirty files.
- Never auto-modify personal health/Agent-04 code without explicit approval.

## Start Here

Read this file first, then read the current roadmap:

`C:\Users\conor\luke\docs\CORE_STABILIZATION_ROADMAP_2026-04-28_v2.md`

Do not trust old docs over current code. Old docs may contain stale claims from earlier repair sessions.

## Sacred Core Surface

Do not churn casually:

- `index.js`
- `scheduler.js`
- `chat.html`
- `lib/slash-commands.js`
- `lib/slash-commands-ingest.js`
- `lib/level-memory.js`
- `lib/confluence-engine.js`
- `lib/parse-bobby.js`
- `lib/parse-dubz.js`
- `lib/parse-mancini.js`
- `lib/saty-levels.js`
- `lib/saty-auto-pull.js`
- `lib/futures-entry-zones.js`
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`

Core operator flow:

`/balance -> /saty -> /dubz -> /heatmap -> optional /mancini -> /status -> /verdict -> /entries ES -> /alert`

Do not weaken stale-input checks, chop-zone protections, readiness checks, Apex floor checks, or human-in-the-loop gates.

## Current Verified State

As of the latest stabilization pass:

- Full Vitest suite: `264 passed`, `1 skipped` future short-strategy test.
- `vitest.config.mjs` disables file parallelism because legacy tests mutate shared `data/*.json` fixture files.
- PM2 reload and live smoke passed for `/status`, `/ready`, and `/balance`.
- Scheduler error log was empty after reload.
- `lib/slash-commands-ingest.js` owns `/saty`, `/mancini`, `/dubz`, and `/heatmap`.
- `lib/slash-commands.js` remains the command router for the rest of the sacred commands.
- `data/today-levels.json` is still a compatibility shim. Do not delete it yet.
- `lib/today-levels-shim.js` now owns the index.js helper behavior for `/see-image`, WebSocket warning, and startup levels label.

## Backtest Lane

Backtesting is intentionally offline and isolated.

Relevant files:

- `lib/es-bracket-strategy.js`
- `lib/es-long-bracket-runner.js`
- `scripts/backtest-es-long-bracket.js`
- `tests/es-bracket-strategy.test.js`
- `tests/es-long-bracket-runner.test.js`
- `data/backtest/es-long-bracket/README.md`

Drop zones:

- Historical ES bars: `data/historical/`
- Frozen session JSON: `data/backtest/es-long-bracket/sessions/`
- Bobby text: `data/backtest/es-long-bracket/raw/bobby-text/`
- Bobby images: `data/backtest/es-long-bracket/raw/bobby-images/`
- Dubz raw/source: `data/backtest/es-long-bracket/raw/dubz/`
- Mancini raw/source: `data/backtest/es-long-bracket/raw/mancini/`
- Saty raw/source: `data/backtest/es-long-bracket/raw/saty/`
- Generated reports: `data/backtest/es-long-bracket/reports/`

Current strategy research scope:

- ES long-only.
- 3 contracts.
- Take 1 contract at each of the next 3 levels.
- Move stop to breakeven after TP1.
- Move stop to TP1 after TP2.
- Keep short support for later, but do not actively tune shorts now.
- Do not wire this into `/entries ES` until enough real dated sessions prove it.

Important: one example session exists only to prove plumbing. It is marked `example=true` and is not trading evidence.

## Cleanup Priorities

Work in this order unless Conor redirects:

1. Help assemble and run real backtest sessions when Bobby/Mancini/Saty/Dubz data lands.
2. Add full Express/WebSocket integration harness before removing `today-levels.json`.
3. Feature-flag or disable mutating architect/sweeper routes before archiving their root artifacts.
4. Continue splitting `lib/slash-commands.js` only with behavior tests around each move.
5. Run browser/UI smoke before splitting `chat.html`.
6. Gate Katbot only after caller audit.
7. Split `index.js` route mounting only after index behavior tests exist.

Dormant architect/sweeper residue:

- `ARCHITECT_LOG.jsonl`
- `ARCH_TOKENS.jsonl`
- `architect-costs.json`
- `SWEEPER_LOG.jsonl`
- `SWEEPER_MAP.json`
- `SWEEPER_STATE.json`
- `sweeper-costs.json`

Do not archive these while mutating `/agent/architect/*` or `/agent/sweeper/*` routes remain reachable.

## Testing Rules

Before claiming readiness, run focused tests for touched areas and then the full suite when feasible.

Common commands from repo root:

```powershell
npx vitest run
node --check index.js
node --check scheduler.js
node --check lib\slash-commands.js
node --check lib\slash-commands-ingest.js
```

For live server changes:

```powershell
pm2 reload C:\Users\conor\luke\ecosystem.config.js
pm2 logs luke-server --lines 20 --nostream
pm2 logs luke-scheduler --lines 20 --nostream
```

Smoke sacred routes after reload when relevant:

- `/status`
- `/ready`
- `/balance`
- `/saty`
- `/dubz`
- `/heatmap`
- `/verdict ES`
- `/entries ES`
- `/alert`

If tests or smoke fail, report the failure directly. Do not say "ready" unless the evidence supports it.

## Working Style

- Read current code before editing.
- Prefer small, reversible changes.
- Add tests before or with behavior changes.
- Use existing local patterns.
- Keep live trading behavior fail-closed.
- Keep reports and handoffs exact, with paths.
- Do not delete user data.
- Do not run destructive git commands.
- Do not rename Tradovate or broker-facing identifiers casually.
- Do not reintroduce garbled strings or mojibake.
- Keep generated research/backtest files out of live runtime paths.

Luke has been through long repair sessions and context drift. Tell the truth, reduce moving parts, and protect the trading day.
