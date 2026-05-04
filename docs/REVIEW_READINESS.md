# Review Readiness

Date: 2026-05-04

## Current Scores

| Area | Score | Current Evidence | Why Not 99 |
| --- | ---: | --- | --- |
| Code review readiness | 95% | New code is scoped to `lib/trading-state`, read-only API adapter/routes, `/trading-window`, operator-v2 link, tests, and requested docs. | Needs reviewer pass over state-machine assumptions and UI wording. |
| Manual trading companion readiness | 94% | Level-state, alerts, candidate queue, data health, chart/bracket visual, timestamp snapshots, and replay-mode 1m candle proof are available read-only. | Live ES candle feed proof remains blocked. |
| Read-only app/operator readiness | 96% | `/operator-v2` remains read-only and `/trading-window` uses GET APIs with replay/dev warnings. | Needs final screenshot proof review. |
| Live level-state readiness | 92% | Engine handles loaded levels, timestamp snapshots, approaching, flush, reclaim watch, armed, invalidated, stale/unknown pass states, local/replay 1m candles, and replay-mode API proof. | Live 1m candle provider is not proven. |
| Research/watchlist readiness | 95% | Bobby+Mancini staged candidate is represented as paper/research only with 1ES starter and add-confirmation logic. | Forward observation still needed. |
| Staged/paper bot readiness | 82% | Simulated bracket plan objects exist and risk gates are deterministic. | No paper/shadow state mutation route was added. |
| Live execution readiness | 35% | Live path intentionally untouched. | No broker proof, no live submit design, and live remains blocked. |

## Product Surfaces

- `/operator-v2`: read-only operator surface with live level state, trade candidates, bracket visual, alerts, and data health.
- `/api/trading/level-state?instrument=ES`: GET-only level-state endpoint.
- `/api/trading/trade-candidates?instrument=ES`: GET-only candidate endpoint.
- `/api/trading/alerts?instrument=ES`: GET-only alert endpoint.
- `/api/trading/candle-status?instrument=ES`: GET-only candle status endpoint.
- `/api/trading/chart-data?instrument=ES`: GET-only chart/candle/level/bracket endpoint.
- `/api/trading/source-health?instrument=ES`: GET-only source-family/freshness endpoint.
- `/api/trading/level-state?instrument=ES&mode=replay&date=YYYY-MM-DD&time=HH:mm`: GET-only replay endpoint using the same candle/state path.
- `/trading-window`: read-only live-shaped replay trading window.
- `/api/health`: runtime health endpoint with app/version/pid/port/start metadata.

## Safety Status

- `buildTradeDecision` unchanged.
- `/operator-v2` remains read-only.
- New trading APIs are GET-only.
- `/trading-window` has no execution controls.
- No live execution shortcut added.
- No broker/live execution module imported by the new adapter.
- Stale/UNKNOWN data cannot arm a candidate.
- Local/replay candles cannot arm live candidates.
- Replay mode returns `live: false` and `usable_for_live_arming: false`.
- Latest-price-only data cannot create candle-confirmed states.
- SPX fixed +30 is not used as strategy truth.

## Review Blockers

- Confirm operator wording still cannot be read as a live recommendation.
- Confirm candle-data absence keeps candidates watch-only.
- Confirm local/replay labels are visible and cannot be mistaken for live arming.
- Confirm historical replay responses are not presented as timestamp-valid live signals.
- Confirm future paper/shadow integration still requires explicit confirmation.
- Confirm proof screenshots match the implemented route.

## Verdict

`READY_FOR_REVIEW`
