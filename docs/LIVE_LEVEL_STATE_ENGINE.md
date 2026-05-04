# Live Level-State Engine

Date: 2026-05-04

## What It Does

Luke now has a read-only ES level-state engine for live/paper-safe operator visibility.

It:

- Loads active ES executable clusters from Level Memory and Dubz levels.
- Loads Saty ATR levels as native ES only if the source is ES.
- Keeps SPX Saty/reference levels reference-only unless an explicit basis adapter is supplied later.
- Labels market data as `FRESH`, `STALE`, `DELAYED`, or `UNKNOWN`.
- Evaluates level states from latest price and optional 1m candle bars.
- Builds simulated bracket plans for paper/research candidates only.
- Emits read-only operator alerts.
- Exposes GET-only APIs under `/api/trading/*`.

## What It Does Not Do

- Does not submit live orders.
- Does not call broker modules.
- Does not call `execution-live`, `execution-paper`, or `execution-shadow`.
- Does not create `LIVE_READY`.
- Does not change `buildTradeDecision`.
- Does not silently convert SPX to ES with fixed +30.
- Does not arm a trade candidate from stale, delayed, UNKNOWN, or latest-price-only data.

## States

- `NO_DATA`
- `LEVELS_LOADED`
- `WATCHING`
- `APPROACHING_LEVEL`
- `FLUSH_DETECTED`
- `FIRST_RECLAIM_WATCH`
- `RECLAIMED`
- `ACCEPTANCE_PENDING`
- `ARMED`
- `TRADE_CANDIDATE`
- `PASS_RISK`
- `PASS_NO_TARGET`
- `PASS_DATA_UNKNOWN`
- `INVALIDATED`
- `EXPIRED`
- `REFERENCE_ONLY`

With no candle bars, Luke can show `WATCHING` and `APPROACHING_LEVEL`, but it will not arm a paper candidate.

## Candidate Format

Main strategy labels:

- `ladder_reclaim_bobby_mancini_staged_v1`
- `multi_source_ladder_first_reclaim_long`

Supported statuses:

- `WATCH_ONLY`
- `PAPER_CANDIDATE_SIM`
- `PAPER_CANDIDATE_LIVE_DATA`
- `PASS_RISK`
- `PASS_NO_TARGET`
- `PASS_DATA_UNKNOWN`
- `INVALIDATED`
- `LIVE_BLOCKED`

The bracket object is always simulated:

```json
{
  "order_type": "simulated_bracket_plan",
  "live_enabled": false,
  "can_submit": false
}
```

`LIVE_READY` is not emitted.

## Source Snapshots

Replay mode uses timestamp-scoped source snapshots from `artifacts/research/source-timeline.json` when available.

At replay timestamp T, Luke includes only levels whose source event was available at or before T. It applies source lifecycle rules:

- Saty: daily structural ladder.
- Mancini: structural/commentary, can persist until replaced/invalidated.
- Dubz structural: carry-forward.
- Dubz callout: same-day/freshness-sensitive.
- `heatmap_gex`: intraday snapshot that expires and supersedes.
- Katbot context: secondary unless parsed `heatmap_gex` levels exist.

SPX levels remain reference-only unless future explicit basis metadata exists.

## 25K Prop Risk Defaults

- 1ES starter preferred.
- 2ES full blocked unless explicitly allowed and add confirmation exists.
- Add second ES requires retest-hold confirmation.
- Preferred risk: `$300`.
- Hard risk: `$500`.
- Daily kill reference: `$600`.
- No repeat at the same level after loss.

## APIs

- `GET /api/trading/level-state?instrument=ES`
- `GET /api/trading/trade-candidates?instrument=ES`
- `GET /api/trading/alerts?instrument=ES`
- `GET /api/trading/chart-data?instrument=ES`
- `GET /api/trading/source-health?instrument=ES`

Every response includes:

- `generated_at`
- `market_data`
- `source_freshness`
- `warnings`
- `read_only: true`
- `no_live_execution: true`

## UI

`/operator-v2` now includes:

- Live Level State
- Trade Candidates
- Bracket Plan Visual
- Trading Alerts
- Data Health

`/trading-window` adds a dedicated live-shaped replay trading surface with a candle chart, bracket lines, active clusters, candidate queue, alerts, source health, and replay example selector.

Hard labels are visible:

- `Read-only`
- `No execution controls`
- `Research/Paper Candidate only`
- `Not a live trade recommendation`

## Tests

New focused tests:

- `tests/level-state-engine.test.js`
- `tests/trade-candidate-builder.test.js`
- `tests/prop-risk-gate.test.js`
- `tests/trading-state-apis.test.js`
- `tests/bracket-plan-visual.test.js`
- `tests/trading-ui-readonly.test.js`
- `tests/source-normalization.test.js`
- `tests/heatmap-gex-lifecycle.test.js`
- `tests/level-snapshot-store.test.js`
- `tests/trading-chart-data.test.js`
- `tests/operator-v2-trading-window.test.js`
- `tests/bracket-plan-generator.test.js`
- `tests/live-shaped-data-modes.test.js`

Run:

```bash
cmd /c npm test
```
