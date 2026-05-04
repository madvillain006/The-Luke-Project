# Candle Feed And Runtime

Date: 2026-05-04

## Runtime Health

Commands:

- `npm run runtime:check`
- `npm run runtime:stop-dev`
- `npm run runtime:stop-dev -- --force`

`runtime:check` checks the configured `PORT`, defaulting to `3000`. It reports whether the port is free, occupied by Luke, or occupied by an unknown process. It also calls `/api/health`, `/health`, or `/` when possible.

`runtime:stop-dev` does not kill anything by default. It only reports a known Luke dev process that could be stopped. `--force` is required, and unknown processes are refused.

`/api/health` returns:

- `app: "Luke"`
- `version`
- `pid`
- `port`
- `started_at`
- `git_sha_if_available`
- `build_marker_if_available`

## Candle Provider Priority

The candle feed module lives at `lib/market-data/candle-feed.js`.

Provider order:

1. Safe configured Tradovate candle provider, when available later.
2. Existing market-data provider with real 1m OHLC support, when available later.
3. Local Barchart-style CSV candles.
4. Yahoo/Finnhub 1m support only if real OHLC candles are returned.
5. `UNKNOWN`.

This pass proves provider 3 first.

## Local Replay CSV Provider

The local provider lives at `lib/market-data/providers/local-csv-candles.js`.

It discovers ES and SPX 1m CSVs under:

- `data/research/bars`
- `data/historical`
- `data/backtest`
- `fixtures`

It parses Barchart-style columns such as `Time`, `Open`, `High`, `Low`, `Latest`, and `Volume`. `Latest` is treated as close. Timestamp handling reuses the repo historical-data parser conventions.

Local/replay candle labels:

- `source: "local_csv"`
- `source_label: "local/replay"`
- `live: false`
- `replay: true`
- `usable_for_replay: true`
- `usable_for_live_arming: false`
- `stale: true` in latest-local mode

In explicit replay mode with a date/start/end/time, the returned candles can be non-stale for replay proof only. They still cannot arm live candidates.

## Data Meanings

`live` means a provider has current market data suitable for live evaluation.

`replay` means historical/local data is being used for dev proof or replay.

`stale` means the feed cannot be used to arm live candidates.

`UNKNOWN` means no usable candle feed is available.

`usable_for_live_arming` must be true before candle-dependent live states may arm.

## Candle Gating

Latest price alone may show watch or approaching context.

1m OHLC candles are required for:

- `FLUSH_DETECTED`
- `FIRST_RECLAIM_WATCH`
- `RECLAIMED`
- `ACCEPTANCE_PENDING`
- `ARMED`
- `TRADE_CANDIDATE`

Local/replay candles can drive replay/dev state proof, bracket visualization proof, and UI proof. They cannot create live candidates.

Replay endpoints use the same `getCandles` and `buildTradingState` path that a future delayed/live provider must use. The provider swap point is the candle-feed module, not a separate strategy path.

`/api/trading/chart-data` and `/trading-window` also use that same path. The UI is therefore live-shaped now while still reading local/replay candles in replay/dev mode.

## Source Snapshot Contract

Replay level snapshots are built from `artifacts/research/source-timeline.json` when available.

At timestamp T:

- Include source events only when `available_at <= T`.
- Keep SPX levels reference-only unless explicit basis metadata exists.
- Expire/supersede `heatmap_gex` snapshots.
- Keep Saty as daily structural context.
- Keep Mancini as structural/commentary context.
- Keep Dubz structural carry-forward and Dubz callouts only while same-day/fresh.
- Keep Katbot context secondary unless parsed `heatmap_gex` levels exist.

## Future Live Provider Contract

A future delayed/live 1m candle provider must return:

- Real 1m OHLC candles.
- `timestamp`.
- `source`.
- `finalized`.
- `stale`, `delayed`, and `live` labels.
- `confidence`.
- `error` when unavailable.

Live arming requirements:

- ES candle source must be futures-appropriate.
- Latest ES candle age must be inside the configured freshness threshold.
- Source cannot be `local/replay`.
- Source cannot be `UNKNOWN`.
- Source cannot be stale.
- SPX cannot substitute for ES.
- Delayed data must be labeled and may only arm if explicitly allowed by config.
- Provider failure must not create a trade candidate.

## APIs

Read-only endpoints:

- `GET /api/health`
- `GET /api/trading/candle-status?instrument=ES`
- `GET /api/trading/level-state?instrument=ES`
- `GET /api/trading/level-state?instrument=ES&mode=replay&date=YYYY-MM-DD`
- `GET /api/trading/trade-candidates?instrument=ES&mode=replay&date=YYYY-MM-DD&time=HH:mm`
- `GET /api/trading/alerts?instrument=ES&mode=replay&date=YYYY-MM-DD&time=HH:mm`
- `GET /api/trading/trade-candidates?instrument=ES`
- `GET /api/trading/alerts?instrument=ES`
- `GET /api/trading/chart-data?instrument=ES`
- `GET /api/trading/source-health?instrument=ES`

No POST endpoint or broker route is added.

## Verification

Run:

- `npm run runtime:check`
- `npm test`
- `npm run market:data:test`
- `npm run prove:live-level-state`
- `npm run prove:operator-v2`
- `npm run prove:replay-level-state`
- `npm run prove:trading-window`

Proof artifacts are written under `artifacts/proof/candle-feed/`.
Replay proof artifacts are written under `artifacts/proof/replay-level-state/`.
Trading-window proof artifacts are written under `artifacts/proof/trading-window/`.
