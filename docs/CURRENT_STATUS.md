# Current Status

Date: 2026-05-04

## Architecture Status

- Luke has a read-only level-state engine under `lib/trading-state`.
- Runtime health is available at `/api/health`.
- Port checks and safe stale-Luke stop reporting are available through `npm run runtime:check` and `npm run runtime:stop-dev`.
- Trading APIs are GET-only:
  - `/api/trading/level-state?instrument=ES`
  - `/api/trading/trade-candidates?instrument=ES`
  - `/api/trading/alerts?instrument=ES`
  - `/api/trading/candle-status?instrument=ES`
  - `/api/trading/chart-data?instrument=ES`
  - `/api/trading/source-health?instrument=ES`
- `/trading-window` provides the live-shaped read-only replay trading surface.

## Local Replay Candles

- ES local/replay 1m source: found, 58,799 rows, 2025-12-15 to 2026-04-29.
- SPX local/replay 1m source: found, 21,841 rows, 2026-02-10 to 2026-04-28.
- Local/replay candles are labeled `live: false`, `replay: true`, and `usable_for_live_arming: false`.
- Local/replay candles can drive replay/dev state proof.
- Local/replay candles cannot arm live candidates.

## Level-State Engine

- Latest-price-only mode can show watch/approaching context.
- Candle-confirmed states require 1m OHLC candles.
- Replay mode uses the same candle feed and state engine path as future live candles.
- Replay mode can use timestamp-scoped level snapshots from `artifacts/research/source-timeline.json`.
- Replay APIs return replay timestamp, candle window, current replay candle, and replay-only warnings.
- Stale, UNKNOWN, and replay-only data cannot enable live arming.
- Candidate statuses now use `PAPER_CANDIDATE_SIM` for replay/dev and `PAPER_CANDIDATE_LIVE_DATA` for future verified live-data paper candidates.

## Source Normalization

- Bobby GEX/heatmaps, Heatseeker, Jefe heatmap, mathemeatloaf heatmap, and Katbot heatmap/GEX normalize to `heatmap_gex`.
- Transport is retained separately.
- `heatmap_gex` snapshots are intraday, timestamped, and expire/supersede.
- SPX reference levels remain reference-only unless a future explicit basis adapter exists.

## Operator UI

- `/operator-v2` remains read-only.
- The Trading area shows level state, candidates, bracket visual, alerts, data health, candle source, and live-arming eligibility.
- `/operator-v2` links to `/trading-window`.
- `/trading-window` shows replay candles, active levels, state markers, candidate queue, bracket plan, alerts, source health, and research status.
- The UI labels local/replay candles as proof-only and not live arming.

## Research And Watchlist

- `multi_source_ladder_first_reclaim_long` remains a research/watchlist strategy.
- `ladder_reclaim_bobby_mancini_staged_v1` remains paper/research only.
- 1ES starter logic is represented; second ES requires confirmation logic.
- No paper/shadow/live submit path was added.

## TradingView Bridge

- TradingView visual bridge file: `tradingview/luke-level-reclaim-watch.pine`.
- Saty ATR reference file: `tradingview/saty-atr-levels-source.pine`.
- Export script: `scripts/export-tradingview-levels.js`.
- NPM command: `cmd /c npm run tradingview:export-levels`.
- Current artifacts are written under `artifacts/tradingview/`.
- The exporter reads the full edited Mancini log and detects the current header date even though the filename is stale.
- Latest export pulled 42 active Mancini levels from 249 full-log parsed Mancini levels.
- Generated Pine copy: `artifacts/tradingview/luke-level-reclaim-watch.generated.pine`.
- Pine alerts are `WATCH`, `ARMED`, `PAPER_CANDIDATE`, and `INVALIDATED`; they are watchlist-only and not orders.

## Remaining Blockers

- Live or delayed 1m ES candle provider is not credentialed/proven.
- Live market provider checks currently return UNKNOWN in this environment.
- Paper/shadow state mutation remains intentionally blocked.
- Live execution remains blocked.
- TradingView bridge is visual/alert-only and does not remove any live-execution blocker.

## Verify

- `npm test`
- `npm run runtime:check`
- `npm run market:data:test`
- `npm run tradingview:export-levels`
- `npm run prove:live-level-state`
- `npm run prove:operator-v2`
- `npm run prove:replay-level-state`
- `npm run prove:trading-window`

## Next Milestone

Wire a real delayed/live 1m ES candle provider behind the existing candle-feed interface while preserving the replay/stale/UNKNOWN live-arming gates and the read-only trading-window contract.
