# Goal Mode Review Update - 2026-05-05

## Prompt Scope

Continue the Luke cleanup/hardening plan without direct operator input where possible. Keep rollback commits, fix obvious non-live gaps, sanity-check work, force PNG UI proof, inspect those PNGs, and continue audit/fix cycles until the next step needs operator judgment.

## Starting Rollback Point

- Clean rollback commit before this continuation: `a77748b Clean Luke audit surface and runtime proof paths`.
- `slop-janitor` was installed, Rust/cargo was installed, and `openai/codex` was cloned, but the first Codex app-server build failed on local Windows paging/memory exhaustion and the low-memory retry timed out. This run continues manually from the same approved goal plan.

## Current Fix Slice

### Execution Boundary

- Legacy chat staged-trade overlay is now review-only.
- The old `EXECUTE` button is disabled and labeled `BLOCKED`.
- `chat.html` no longer calls `/agent/autonomous/execute-staged`.
- `/agent/autonomous/execute-staged` is blocked by default behind `LUKE_ENABLE_STAGED_EXECUTION`.
- Live mode/live execution is blocked by default behind `LUKE_ENABLE_LIVE_EXECUTION` after staged execution is explicitly unlocked.

### Risk Math

- `trading/common.js` now uses futures dollar point values:
  - ES: 50
  - MES: 5
  - NQ: 20
  - MNQ: 2
- Focused tests cover the point values and execution gates.

### Runtime Setup

- Added `.node-version` with the currently verified local Node runtime: `v24.15.0`.
- Added `.nvmrc` with the same runtime.
- Added `package.json` Node engine guard: `>=24 <25`.
- Added `.github/workflows/ci.yml` to run `npm ci` and `npm test` on Windows using `.node-version`.
- Changed `ecosystem.config.js` to use the repo directory dynamically instead of hardcoding `C:\Users\conor\luke`.
- Added timeouts to runtime process inspection so Windows `netstat`/`wmic` hangs cannot freeze `runtime:check` or proof scripts.
- Updated `docs/SLOP_JANITOR_ADMIN_WORKFLOW.md` with the real 2026-05-05 install state and memory-related Codex build blocker.

### UI/UX Proofing

- Added `npm run prove:luke-ui-ux` as the broad UI proof command.
- The proof captures `/shell`, `/luke`, `/trading`, `/trading-window`, `/operator-v2`, and `/brain-dashboard` at desktop/mobile where relevant.
- The proof now waits for real rendered dashboard/brain/trading data instead of accepting static loading placeholders.
- Fixed mobile `trading-window.html` overflow:
  - watchlist/status pills now wrap inside cards.
  - active level and candidate tables become readable card rows on narrow screens.

### Luke Watch Handoff

- Promoted the Luke Watch production-test Pine and simulation-only strategy into tracked repo files.
- Added export support for paste-ready generated production-test and simulation strategy artifacts.
- Added dry-run handoff safety checks for a future broker adapter; this layer validates signal shape, duplicates, account constraints, and risk, but returns `can_submit_live: false`.
- Added broker-automation audit and Claude handoff docs that stop before live order placement.

## Verification Log

- `node --check trading/common.js`: passed.
- `node --check trading/router.js`: passed.
- `node --check scripts/prove-trading-window.js`: passed.
- `cmd /c npm run runtime:check`: passed; `/api/health` returned current Luke on port 3000.
- Focused Vitest execution/risk/UI suite: passed, 9 files, 35 tests.
- `cmd /c npm test`: passed, 123 files, 780 passed, 1 skipped.
- `cmd /c npm run prove:trading-window`: passed; wrote PNG proof under `artifacts/proof/trading-window/`.
- `cmd /c npm run prove:luke-dashboard-demo`: passed; wrote PNG proof under `artifacts/proof/luke-dashboard-demo/`.
- `cmd /c npm run prove:chat-execution-blocked`: passed; wrote PNG proof under `artifacts/proof/chat-execution-blocked/`.
- `cmd /c npm run prove:staged-flow`: passed as `STAGED_FLOW_LOCKED_PROOF_PASS`; paper/shadow staged execution refused by default, no position opened, pending signal remained available for review/skip.
- PM2 note: `pm2 reload ecosystem.config.js`, `pm2 status`, and `pm2 logs` hung from the CLI, but `runtime:check` stayed healthy on port 3000. This slice avoids killing the live PM2 process; server-side gate changes are code/test verified and will load on the next successful PM2 restart/reload.
- `node --check ecosystem.config.js`: passed.
- `node --check scripts/check-runtime-health.js`: passed.
- `node --check scripts/prove-luke-ui-ux.js`: passed.
- `cmd /c npx vitest run tests/runtime-health.test.js tests/trading-state-apis.test.js`: passed, 11 tests.
- `cmd /c npm run runtime:check`: passed after bounded process lookup; `/api/health` returned current Luke on port 3000.
- `cmd /c npm run prove:luke-ui-ux`: passed after responsive mobile fixes; wrote PNG proof under `artifacts/proof/luke-ui-ux/`.
- `cmd /c npm run prove:luke-dashboard-demo`: passed after responsive UI fixes; clicked shell/trading/system-chat PNG proof remained clean.
- `cmd /c npx vitest run tests/tradingview-level-export.test.js tests/pine-hardmode-slippage.test.js`: passed after removing banned `webhook` wording from the simulation-only Pine source.
- `cmd /c npx vitest run tests/luke-watch-safety-checks.test.js tests/tradingview-level-export.test.js`: covered the new dry-run handoff/export path through the full suite.

## PNG Review Log

Opened and visually inspected:

- `artifacts/proof/trading-window/trading-window.png`
  - Dense but readable trading window.
  - Read-only/replay/not-live labels visible.
  - Candidate queue and bracket panel show `LIVE_BLOCKED`, `WATCH_ONLY`, `Can submit false`, and no execution controls.
- `artifacts/proof/trading-window/replay-example.png`
  - Candidate queue is readable and shows blocked/watch-only statuses.
- `artifacts/proof/luke-dashboard-demo/outer-luke-before-trading-click.png`
  - Dashboard shell loads without obvious overlap.
  - Trading module says human-gated/read-only/no autonomous execution controls.
- `artifacts/proof/luke-dashboard-demo/outer-luke-clicked-trading-window-frame.png`
  - Embedded trading window renders correctly inside shell.
  - Read-only labels and blocked candidate state remain visible.
- `artifacts/proof/luke-dashboard-demo/outer-luke-system-chat-command-smoke.png`
  - System chat is readable and routes trading commands back to the isolated Trading tab.
- `artifacts/proof/chat-execution-blocked/chat-execution-blocked-overlay.png`
  - Legacy staged-trade overlay is review-only.
  - `BLOCKED` button is visible and disabled.
  - No submit/execute action is exposed from the overlay.
- `artifacts/proof/luke-ui-ux/shell-desktop.png`
  - Main dashboard waits for weather/brain/runtime data before capture.
  - No obvious overlap or stale loading text in the first viewport.
- `artifacts/proof/luke-ui-ux/trading-window-mobile.png`
  - Chart is visible, mobile tables are card rows, and no status pill leaks outside the viewport.
  - Candidate/bracket sections remain read-only and show blocked/watch-only state.
- `artifacts/proof/luke-ui-ux/operator-v2-desktop.png`
  - Operator V2 renders loaded replay/client-demo data, not loading placeholders.
  - No execution controls are exposed.
- `artifacts/proof/luke-ui-ux/brain-dashboard-mobile.png`
  - Brain dashboard renders real spine data on mobile.
  - Cards are readable and no loading placeholders remain in the proof capture.

## Remaining Without Operator Input

- Continue tightening UI/read-only language and proof harness behavior if tests or screenshots expose contradictions.
- Keep generated proof output in ignored artifact locations.
- Commit this slice after verification.
- Revisit PM2 CLI health/reload separately if it continues to hang; do not kill the live app during this hardening slice without a specific operator decision.

## Requires Operator Input Later

- Any actual live-data provider credentials, TradingView compile/signoff, Saty visual parity signoff, broker proof, or permission to unlock staged/live env gates.
- Luke Watch production-test Pine is now tracked and safety-tested, but still needs TradingView compile/signoff before use.
