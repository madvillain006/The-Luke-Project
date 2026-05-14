# Luke Hermes Console Tab Roadmap

Date: 2026-05-14

Purpose: add a Luke shell tab that can surface Hermes from inside the dashboard without weakening Electron sandboxing, route hygiene, or trading safety.

## Goal

Create a route-backed shell lane that behaves like existing Luke panels (`Trading`, `Luke System`, `Daily`, `Radar`) and can open a Hermes-facing console surface from the dashboard when needed.

## Non-negotiables

- `Process_narration=false`.
- Do not touch Pine, NinjaTrader, market-hours, trading execution, broker routing, risk checks, credentials, `.env`, or production runtime state.
- Do not embed raw OS PowerShell directly into the renderer as an unrestricted terminal.
- Preserve Electron/browser isolation (`sandbox`, `contextIsolation`, `webSecurity`).
- Preserve shell route hygiene: one direct front-door route per surface, no duplicate aliases unless explicitly justified.
- Hermes access must stay human-initiated and evidence-friendly.

## Current repo fit

Existing shell pattern already supports this safely:

- `index.js` serves route-backed HTML surfaces.
- `electron.js` opens `/shell` as the top-level desktop entry.
- `luke-shell.html` already embeds child surfaces via:
  - a tile/card with `data-route`
  - a hidden panel section
  - an `iframe` with `data-src="/route?embed=1"`
  - explicit `open...Panel()` / `close...Panel()` functions
- `tests/brain-dashboard.test.js` already guards shell routing, embedding, and safety copy.

Implication: the clean path is a new route-backed Hermes surface embedded with the same shell panel pattern.

## Recommended product shape

V1 should be a Hermes Console surface, not a raw unrestricted PowerShell terminal.

Recommended capability ladder:

1. Read-only/session-status surface
   - show Hermes availability, recent session output, status, last run, and known entrypoints
2. Controlled launcher
   - allow explicit human-launched Hermes workflows through brokered buttons/forms
3. Restricted command runner
   - only if needed, with allowlist, cwd restrictions, timeout, stdout/stderr capture, and no arbitrary environment dumping
4. Full PTY/terminal
   - defer until a separate security/IPC design is approved

## Target UX

Inside `luke-shell.html`:

- new Operations tile: `Hermes Console`
- new Missions lane card: `BUILD / Hermes`
- hidden embedded panel similar to Daily/Radar/System
- iframe-backed route such as `/hermes`
- `?embed=1` support for shell display

## Proposed phases

### Phase 0: Route and shell scaffold

Files:
- `index.js`
- `luke-shell.html`
- `tests/brain-dashboard.test.js`

Tasks:
- add one new route, preferably `/hermes`
- serve a dedicated HTML surface such as `hermes-console.html`
- add one new shell tile/card/panel/iframe
- add `openHermesPanel()` / `closeHermesPanel()`
- extend route interception for the new panel

Acceptance:
- desktop still opens `/shell`
- shell can open and close the Hermes panel without full-page navigation
- tests prove the new route and iframe wiring exist

### Phase 1: Read-only Hermes surface

Files:
- `hermes-console.html`
- optional backend read-only route/API if needed
- `tests/brain-dashboard.test.js`

Tasks:
- render a minimal Hermes panel with status/help text
- support embed mode
- if needed, expose read-only status/log metadata only

Acceptance:
- no arbitrary command execution
- no secrets shown
- no trading execution authority added

### Phase 2: Brokered human-launch controls

Files:
- `index.js` or a dedicated backend module
- `hermes-console.html`
- new focused tests for the route/API contract
- docs update

Tasks:
- add explicit human-triggered buttons/forms for approved Hermes actions
- validate/sanitize inputs server-side
- keep cwd/path scope explicit
- capture stdout/stderr safely

Acceptance:
- no raw shell passthrough
- commands are bounded and auditable
- failures surface clearly in the UI

### Phase 3: Optional restricted command lane

Only after explicit approval.

Requirements:
- allowlist/denylist policy
- cwd restriction
- timeout
- output truncation
- no secret/env dump
- no interactive PTY by default
- dedicated tests and safety review

### Phase 4: PTY/terminal escalation

Do not start here.

This phase requires a separate approved design for:
- PTY/session lifecycle
- resize/focus handling
- streaming transport
- auth/trust model
- crash recovery
- transcript retention policy
- command safety boundaries

## Likely file plan

Implementation files:
- `index.js`
- `luke-shell.html`
- `hermes-console.html` (new)

Test files:
- `tests/brain-dashboard.test.js`
- optional new backend/API contract test if interactive controls are added

Docs:
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/LUKE_HERMES_CONSOLE_TAB_ROADMAP.md`

## Primary risks

- renderer-to-shell privilege creep
- duplicate/unclear route ownership
- exposing cwd/env/secrets in the console surface
- mixing Hermes console authority with trading/operator surfaces
- overbuilding a full terminal before a route-backed safe scaffold exists

## Recommended first execution chunk

1. Add `/hermes` route and `hermes-console.html`
2. Embed it into `luke-shell.html` using the existing panel pattern
3. Extend `tests/brain-dashboard.test.js` to lock route/panel wiring
4. Keep V1 read-only

## Stop rules

Stop and re-scope if the implementation starts to require:
- direct renderer PowerShell access
- `.env` reads/writes for display
- trading-surface coupling
- background daemons/schedulers
- broad Electron IPC privileges
