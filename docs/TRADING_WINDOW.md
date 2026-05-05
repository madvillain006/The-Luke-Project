# Read-Only Trading Window

Date: 2026-05-04

## What It Shows

`/trading-window` is a read-only, live-shaped trading companion surface for the ES level-state workflow.

It shows:

- ES 1m candles from the candle-feed interface.
- Active level clusters and source families.
- `heatmap_gex` freshness/supersession status.
- Flush/reclaim markers when the state machine detects them.
- Candidate queue.
- Simulated bracket plan lines: entry, stop, TP1, TP2.
- Alerts feed.
- Data health and live-arming eligibility.
- Research status for `ladder_reclaim_bobby_mancini_staged_v1`.

## Data Modes

Supported mode metadata:

- `live`
- `delayed`
- `replay`
- `dev`
- `unknown`

Replay/dev can generate `WATCH_ONLY` and `PAPER_CANDIDATE_SIM`. Replay/dev cannot create a live candidate.

Delayed/live mode is reserved for a future provider that returns verified real 1m ES candles. Delayed data must remain labeled and cannot arm unless explicitly allowed by config.

## Bracket Plan Meaning

The bracket visual is a plan object only.

- `can_execute_live: false`
- `bracket.live_enabled: false`
- `bracket.can_submit: false`
- `order_type: "simulated_bracket_plan"`

The current 25K default is 1ES starter. Add 1ES only after retest hold / confirmation. TP1 defaults to +2. TP2 uses the next trusted ES cluster when available.

## Source Families

Canonical source families:

- `saty`
- `mancini`
- `dubz_structural`
- `dubz_callout`
- `heatmap_gex`
- `katbot_context`
- `market_data`
- `unknown`

The following aliases normalize to `heatmap_gex`:

- Bobby heatmap/GEX
- Heatseeker
- Jefe heatmap
- mathemeatloaf heatmap
- Katbot heatmap/GEX

Transport is retained separately as `bobby`, `katbot`, `jefe`, `mathemeatloaf`, `manual`, `discord`, or `unknown`.

## heatmap_gex Policy

`heatmap_gex` is intraday-changing dealer-positioning data.

- Fresh: <= 60 minutes.
- Aging: 60-120 minutes.
- Stale: > 120 minutes.
- Superseded when a newer snapshot exists for the same transport.

Stale and superseded `heatmap_gex` snapshots are excluded from active replay snapshots and reported in source health.

## Replay/Dev Mode

Replay mode uses local Barchart-style ES/SPX 1m CSV candles through the same candle-feed and level-state engine path planned for future live providers.

Replay examples can be loaded with:

- `/trading-window`
- `/api/trading/chart-data?instrument=ES&mode=replay&example=positive`
- `/api/trading/source-health?instrument=ES&mode=replay&example=positive`

Replay mode is always `live: false` and `usable_for_live_arming: false`.

## Why No Execution

This pass intentionally adds no broker route, no direct order route, no autonomous live path, and no operator write controls.

`/operator-v2` remains read-only. The trading window only renders GET API data and simulated plan objects.

## Future Provider Swap

The live/delayed provider swap point is `lib/market-data/candle-feed.js`.

A future provider must return real 1m OHLC candles with source, timestamp, finalized/stale/delayed/live labels, confidence, and errors. SPX cannot substitute for ES, and provider failure must not create a trade candidate.

## Verification

Run:

- `npm test`
- `npm run runtime:check`
- `npm run market:data:test`
- `npm run prove:live-level-state`
- `npm run prove:replay-level-state`
- `npm run prove:operator-v2`
- `npm run prove:trading-window`

Proof artifacts are written under `artifacts/proof/trading-window/`.
