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
- `trading/execution-live.js` now checks the live execution gate directly before credentials or broker calls, so bypassing the router still fails closed.
- Operator clarification on 2026-05-05: Luke is a personal AI assistant/clawbot in memory of Luke, not merely a trading companion. The trading module should be described as one subsystem.

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
- Added duplicate-port startup handling in `index.js`: if `127.0.0.1:3000` is already owned, Luke logs a clear message and exits cleanly instead of feeding a relaunch loop.
- Added PM2 `stop_exit_codes: [0]` for the server and scheduler so clean duplicate-start exits do not restart forever.
- Updated `docs/SLOP_JANITOR_ADMIN_WORKFLOW.md` with the real 2026-05-05 install state and memory-related Codex build blocker.

### UI/UX Proofing

- Added `npm run prove:luke-ui-ux` as the broad UI proof command.
- The proof captures `/shell`, `/luke`, `/trading`, `/trading-window`, `/operator-v2`, and `/brain-dashboard` at desktop/mobile where relevant.
- The proof now waits for real rendered dashboard/brain/trading data instead of accepting static loading placeholders.
- Fixed mobile `trading-window.html` overflow:
  - watchlist/status pills now wrap inside cards.
  - active level and candidate tables become readable card rows on narrow screens.

### Non-Trading Brain Sections

- Added a direct `Brain Section Output` panel to `brain-dashboard.html`.
- The brain dashboard can now pull and render the non-trading section outputs without leaving the UI:
  - brain brief
  - morning brief
  - afternoon brief
  - automation plan
  - developer stack plan
  - history-career searches
- Added `npm run prove:brain-sections` to click those controls and capture PNG proof.
- Tightened daily RSS text cleanup so common HTML entities like `&apos;` and `&nbsp;` render as normal text in the daily brief.

### Daily Window, Calendar, And Mail

- Added `/daily` as a first-class static Daily Brief window, opened from the Luke shell like Trading and Luke Chat.
- The Daily window renders:
  - current date and time
  - Buffalo/current weather
  - Knoxville, TN weather
  - Wilmington, NC weather
  - `I love Kat`
  - current-week Google Calendar cache
  - history job/lead scan
  - Tennessee move prompt
  - Gmail cleanup status
  - automation/history attention signals
- Updated the outer Daily tile to show date/time and remove the duplicated weather-summary line.
- Added an in-shell Daily expand/compact control so the larger Daily window stays inside the Luke dashboard instead of sending the user to a backend-style page.
- Updated `brain-dashboard.html` so the Daily card hides the confusing `open` status pill and says what Luke actually needs from the operator.
- Connected Google Calendar through the Codex Google Calendar app for this run. Primary calendar returned no events for May 5-12, 2026, and Luke caches that result under ignored state.
- Connected Gmail through the Codex Gmail app for this run. The safe non-Substack unread subscription query labeled and archived 37,000 messages into `Luke/Cleanup/Unread Non-Substack Subscriptions`; no permanent deletion was done.
- Created Codex automation `sync-luke-daily-integrations` to refresh Luke's ignored Daily calendar/mail cache hourly.
- Added the Gemini API key to ignored local `.env`; it is not staged or committed.

### History And Automation Opportunity Direction

- Expanded the history-career spine with public-history source links and outreach-build angles tied to:
  - anniversary archive/timeline work
  - civil-rights school-history research packets
  - small-museum AI research assistants
- Expanded the automation-business default profile with relevant Conor examples and cold-offer angles for public history, museums, cultural organizations, and research teams.

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
- `cmd /c npm test`: passed, 123 files, 781 passed, 1 skipped.
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
- `node --check lib/brain/daily-brief.js`: passed.
- `node --check scripts/prove-brain-sections.js`: passed.
- `cmd /c npx vitest run tests/brain-agent.test.js tests/brain-dashboard.test.js`: passed, 32 tests.
- `npm run prove:brain-sections` against a fresh proof server on port 3991: passed; wrote PNG proof under `artifacts/proof/brain-sections/`.
- `cmd /c npm run prove:luke-ui-ux`: passed again after the brain-section UI addition; wrote PNG proof under `artifacts/proof/luke-ui-ux/`.
- `node --check agents/agent-00-brain.js`: passed.
- `node --check lib/brain/daily-spine.js`: passed.
- `node --check lib/brain/history-career-spine.js`: passed.
- `node --check lib/brain/automation-business-spine.js`: passed.
- `node --check scripts/prove-luke-ui-ux.js`: passed.
- `cmd /c npx vitest run tests/brain-agent.test.js tests/brain-dashboard.test.js`: passed after Daily window changes, 34 tests.
- `cmd /c npx vitest run tests/runtime-launch.test.js tests/runtime-health.test.js tests/windows-runtime-spawn.test.js`: passed, 12 tests.
- `cmd /c npx vitest run tests/autonomous-recommendation-only.test.js tests/trading-common.test.js tests/runtime-launch.test.js`: passed, 9 tests.
- `cmd /c npm test`: passed, 127 test files, 799 tests, 1 skipped after all checkpoint commits.
- `cmd /c npm run prove:luke-ui-ux`: passed after the Daily tile polish fix.

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
- `artifacts/proof/brain-sections/brain-dashboard-loaded.png`
  - Brain dashboard loads real spine data with no layout issues.
- `artifacts/proof/brain-sections/brain-brief.png`
  - Brain brief button renders attention and next-action output.
- `artifacts/proof/brain-sections/morning-brief.png`
  - Morning brief renders weather, market, NFL, and Bills sections.
  - RSS apostrophe entities render as normal apostrophes in the captured output.
- `artifacts/proof/brain-sections/automation-plan.png`
  - Automation plan button renders first-30-days and sub-agent statuses.
- `artifacts/proof/brain-sections/developer-plan.png`
  - Developer plan button renders provider order and setup plan.
- `artifacts/proof/brain-sections/history-searches.png`
  - History-career button renders tracks and next search queries.
- `artifacts/proof/brain-sections/automation-context-file.png`
  - Existing automation factory artifact still renders after the section-output addition.
- `artifacts/proof/brain-sections/mobile-developer-plan.png`
  - Mobile brain section controls wrap cleanly and the developer plan remains readable.
- `artifacts/proof/luke-ui-ux/daily-window-desktop.png`
  - Daily window renders date/time, three weather locations, calendar state, move prompt, Gmail cleanup status, and attention signals.
- `artifacts/proof/luke-ui-ux/daily-window-mobile.png`
  - Daily window remains readable on mobile.
- `artifacts/proof/luke-ui-ux/shell-daily-panel-desktop.png`
  - Luke shell opens Daily as an embedded panel rather than sending the operator into backend-style brain routes.
- `artifacts/proof/luke-ui-ux/shell-desktop.png`
  - Daily tile date/time and compact weather summary fit without clipping after the final polish pass.

## Remaining Without Operator Input

- Continue tightening UI/read-only language and proof harness behavior if tests or screenshots expose contradictions.
- Keep generated proof output in ignored artifact locations.
- Commit this slice after verification.
- Revisit PM2 CLI health/reload separately if it continues to hang; startup duplicate-port crash loops are now fail-closed, but killing unknown live processes still needs an explicit operator decision.
- The brain dashboard now exposes the current non-trading brain sections through clickable UI; deeper usefulness depends on configured providers/data and your preferred operating workflows.
- Daily calendar/mail integration now has direct Google hooks plus connector-cache fallback. Calendar can use Google OAuth or public-calendar API-key access; Gmail needs Google OAuth credentials with Gmail scopes.

## Requires Operator Input Later

- Brokerage proof remains the missing trading unlock item. Live broker submission remains gated behind `LUKE_ENABLE_LIVE_EXECUTION`.
- Luke Watch production-test Pine is now tracked and safety-tested, but still needs TradingView compile/signoff before use.
- Non-trading brain sections are wired and proofed, but final scope choices still need your judgment: which automation niche to actually pursue, which history-career search targets matter most, and which AI provider keys/models you want Luke to use.
- Direct Gmail/Calendar cannot use the Gemini API key; it needs Google OAuth access/refresh credentials or a public-calendar API key path.
