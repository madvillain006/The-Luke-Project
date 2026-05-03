# Current Architecture

Luke runs as a local Electron shell around an Express server on port `3000`.

## Launch Path

- Root launcher: `Launch Luke.cmd`
- Electron entry: `electron.js`
- Server entry: `index.js`
- Default shell route: `/shell`
- Trading chat route: `/trading`
- General Luke chat route: `/luke`

The launcher uses the repo-local Electron dependency. Electron starts `node index.js` when port `3000` is free, or reuses the existing local server when it is already running.

## User-Facing Surfaces

- `/shell` - main dashboard shell and agent tiles
- `/trading` - trading analysis chat, human-gated and read-only
- `/luke` - general system chat outside the trading context
- `/brain-dashboard` - brain/spine status dashboard
- `/operator-v2` - operator/test surface

## Agent Boundaries

- `agent-00-brain` owns dashboard status and telemetry.
- `agent-02` and `agent-02B` are trading/autonomous-adjacent surfaces and should stay human-gated.
- `agent-14-kat` is a confluence sidecar, not a trade execution authority.
- Architect/sweeper routes are maintenance surfaces only.

## State Boundaries

- Canonical level memory: `data/level-memory.json`
- Trading snapshot: `state/snapshots/trading-state.json`
- Trading event stream: `state/events/trading-events.jsonl`
- General Luke event stream: `state/events/luke-log.jsonl`

Generated runtime files under `state/events`, `state/snapshots`, `artifacts`, and Discord exports are ignored unless explicitly promoted into tests or fixtures.

## Safety Posture

Luke is a decision-support system. It should recommend, refuse, or ask for missing context. It should not execute trades without explicit human action and confirmed broker wiring.
