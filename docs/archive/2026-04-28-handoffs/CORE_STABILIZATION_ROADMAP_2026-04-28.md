# Luke Core Stabilization Roadmap - 2026-04-28

Purpose: keep core trading stabilization ahead of feature work. This roadmap is based on the current repo state, not old handoff docs.

## Sacred Core Surface

Do not churn casually:
- `index.js` - Express/chat entrypoint; loads slash commands, Saty auto-pull endpoints, fallback route, Kat sidecar, dashboard/admin routes.
- `scheduler.js` - scheduled Saty auto-pull and jobs; PM2-managed.
- `lib/slash-commands.js` - sacred command router for `/status`, `/balance`, `/saty`, `/dubz`, `/heatmap`, `/verdict`, `/entries`, `/alert`, `/ready`, active trade management.
- `lib/saty-levels.js`, `lib/parse-dubz.js`, `lib/parse-bobby.js`, `lib/parse-ximes.js`, `lib/confluence-engine.js`, `lib/level-memory.js`, `lib/futures-entry-zones.js`, `trading/*` - core parsing, level memory, confluence, staging, and risk.
- `chat.html` - live UI; currently large and historically fragile.

Current verification after today's cleanup:
- `node --check C:\Users\conor\luke\lib\slash-commands.js` passes.
- `npx vitest run tests/slash-commands.test.js tests/saty-auto-pull.test.js` passes: 8/8.
- `npx vitest run` passes: 232/232.

## Completed Today

- `lib/slash-commands.js`: removed catastrophic mojibake bloat. File dropped from 250,604,161 bytes to about 79,935 bytes.
- Same file: removed remaining `Ã`, `â`, `�`, `ƒ`, `Â` markers and all >1000-character source lines.
- Same file: cleaned live-trading reply labels after the mechanical strip: `SKIP:`, `WEAK:`, `BLOCKED:`, `APEX FLOOR:`, readable balance/readiness warnings, readable Dubz/heatmap partial parse text.
- Behavior guard: full test suite remains green at 232/232.

## Safe Deletions After One More Git Check

These are residue, not runtime dependencies. Delete only after `git status --short` confirms no user intent to keep them.

- `scripts/__pycache__/` - generated Python cache. Safe delete.
- `lib/saty-levels.js.codex-bak` - same-size backup next to active `lib/saty-levels.js`; active module has tests. Safe delete after diff confirms duplicate.
- `agents/agent-12-fallback.js.codex-bak` - same-size backup of active fallback agent. Safe delete after diff confirms duplicate.
- `chat.html.truncated-bak` - untracked truncated backup; not referenced by runtime. Safe delete or archive.
- `chat.html.ui-regression-backup` - untracked UI backup; archive first if still needed for comparison, then delete from root.
- `index.js.codex-bak`, `scheduler.js.codex-bak` - untracked backups; archive first because they document recent stabilization context, but do not leave in root.

## Safe Archives

Move out of repo root into `archive/` or `docs/archive/` once no active code references them.

- `docs/CLAUDE_HANDOFF_2026-04-28*.md` - useful historical notes, but stale handoff docs compete with current code. Archive under `docs/archive/2026-04-28-handoffs/`.
- `ARCHITECT_LOG.jsonl`, `SWEEPER_LOG.jsonl`, `SWEEPER_MAP.json`, `SWEEPER_STATE.json`, `architect-costs.json`, `sweeper-costs.json` - sidecar agent artifacts. Archive unless agent-09/agent-10 are intentionally active again.
- `repo-map.json` - generated map and currently dirty. Regenerate on demand; archive or gitignore if it keeps changing.
- `jarvis-stdout.log`, `jarvis-stderr.log`, `jarvis-log.jsonl`, `tool-*.jsonl`, `token-usage*`, `boot-checks.jsonl`, `schema-errors.jsonl` - diagnostics/logs. Keep recent operational logs only if actively used; otherwise archive by date.
- `discord-history.jsonl.bak`, `discord-exports/**` - historical corpus, large and valuable for later backtesting, but context-heavy. Keep under data/archive or external storage, not in core working context.

## Risky Before Removal

Do not delete until replacement/ownership is clear.

- `agents/agent-14-kat.js` - large mojibake-heavy Katbot sidecar. `index.js` currently requires it. Later priority only, but removal needs `index.js` route/load replacement or feature flag.
- `agents/agent-12-fallback.js` and `lib/llm-client.js` - fallback LLM path. Lower priority, but `index.js` and `lib/llm-client.js` reference it. Leave until sacred-path fallback policy is explicit.
- `lib/saty-auto-pull.js`, `tests/saty-auto-pull.test.js`, `scheduler.js`, `index.js` Saty endpoints - newly wired and tested. Keep; stabilize scheduler behavior before cleanup.
- `chat.html` - large live UI file. Needs targeted tests/screenshots before splitting or shrinking. Do not broad-refactor during core trading stabilization.
- `README.md`, `LUKE_STATUS.md`, `TECH_DEBT.md`, `CHANGELOG.md` - stale risk. Update or archive only after code-verified roadmap replaces them.

## Duplicate / Context-Wasting Systems

These are token/context drains and sources of drift:

- Multiple handoff docs in `docs/` plus archived handoffs: consolidate to this roadmap plus current `TECH_DEBT.md`.
- Architect/sweeper agents (`agents/agent-09-architect.js`, `agents/agent-10-sweeper.js`) and their root artifacts: useful historically, noisy operationally.
- Katbot/Discord corpus and sidecar ingestion: valuable later, but not part of current core path priority.
- Backup files in repo root (`*.codex-bak`, `*.truncated-bak`, `*.ui-regression-backup`): move to dated archive or delete after diff.
- Generated maps/logs in repo root: should be ignored or archived, not constantly re-read by agents.


## Audit Merge: Additional Confirmed Findings

The parallel read-only audit agrees with the core diagnosis and adds these items to keep in view:

- Split-brain state is a first-class stabilization risk. Current stores include `data/level-memory.json`, `data/dubz-levels.json`, `data/saty-levels.json`, `data/today-levels.json`, `data/daily-context.json`, and untracked `state/daily-context.json`. Recommendation: keep `data/daily-context.json`, treat `today-levels.json` as compatibility shim only, and remove `state/daily-context.json` after all consumers are verified.
- Additional safe archive/delete candidates to verify: `data/audit-backups/**`, old `archive/crash-2026-04-21*.json` through `archive/crash-2026-04-24*.json`, `findings/**`, `proposals/sweeper-*.md`, root `screenshot.png`, root `test-heatmap.png`, empty `workflow-recordings/`, and the oddly named `LOOK AT THIS ONE AND RENAME FOR DISCORD EXPORTS/` folder if empty.
- Additional risky areas: `discord-exports/**` is ugly and large but still referenced by `agents/agent-08-sienna.js` and `ingest-exports.js`; `fault-injection/**` may preserve useful failure-mode tests; `data/backtest/**` is mixed valuable input/output and needs pruning, not deletion.
- Additional encoding-rot surfaces to handle after core slash stability: `index.js`, `scheduler.js`, `agents/agent-14-kat.js`, `lib/daily-accumulator.js`, and `trading/signals.js`.
- `trading/broker-tradovate.js` may have external registration naming assumptions. Do not rename or delete blindly.

## Refactor Direction, Deferred Until Safe

These are correct directions but not Phase 1 cleanup actions:

- Split `lib/slash-commands.js` after behavior tests are added: `/status`, `/ready`, `/balance` into a core module; `/saty`, `/dubz`, `/heatmap`, `/mancini` into ingest; `/alert`, `/verdict`, `/entries`, `/review`, `/history` into trading; backtest separately.
- Split `index.js` route mounting later into chat, health/status, ops, agents/autonomous, and dashboard surfaces.
- Split `chat.html` only after UI smoke coverage exists; do not refactor the live UI blind.
- Collapse duplicate runtime truth so `/entries ES`, `/alert`, readiness, and autonomous staging agree on one recommendation contract.
## Next Stabilization Steps

1. Add small tests around actual `/alert` warning prefixes and `/status` clean output so mojibake cannot quietly return.
2. Run live smoke after restart for `/status`, `/balance`, `/saty`, `/ready`, `/alert` lunch/closed refusal.
3. Archive or delete only the safe residue above; do not touch `index.js`, `scheduler.js`, `chat.html`, or parser/risk modules without focused tests.
4. Then tackle Katbot/fallback side systems behind explicit feature flags or lazy loading so they stop taxing core startup/context.

