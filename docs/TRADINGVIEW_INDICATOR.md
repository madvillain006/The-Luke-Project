# TradingView Indicator

Date: 2026-05-04 ET
Artifact timestamp: 2026-05-05 UTC

The TradingView bridge is a visual/watchlist indicator. It is not a strategy and not an execution system.

Hard-mode research strategy detail lives in `docs/TRADINGVIEW_HARDMODE_RESEARCH.md`.

## Files

- Base Pine: `tradingview/luke-level-reclaim-watch.pine`
- Saty reference: `tradingview/saty-atr-levels-source.pine`
- Export script: `scripts/export-tradingview-levels.js`
- Generated Pine: `artifacts/tradingview/luke-level-reclaim-watch.generated.pine`
- Hard-mode strategy: `tradingview/luke-level-reclaim-watch-hardmode.strategy.pine`
- Generated hard-mode strategy: `artifacts/tradingview/luke-level-reclaim-watch-hardmode.generated.strategy.pine`
- Export summary: `artifacts/tradingview/export-summary.json`
- Historical slippage detail: `artifacts/research/pine-slippage-audit/PINE_SLIPPAGE_HISTORICAL_AUDIT.md`

## Verified

- Export command passed with no issues: `cmd /c npm run tradingview:export-levels`.
- Current export: Saty 13, Mancini active 42, Mancini full-log 249, Mancini posts 280, Dubz 7, active heatmap_gex 2, clusters 35.
- Pine uses `indicator(`, not `strategy(`.
- Pine contains no strategy order calls or dynamic `alert(` calls.
- Pine alert text excludes `BUY` and `SELL`.
- Pine handles empty level input strings.
- Pine does not assume it can read manually drawn TradingView lines.
- Pine labels are `WATCH`, `ARMED`, `PAPER_CANDIDATE`, `INVALIDATED`, and `BLOCKED`.
- Heatmap/GEX levels are freshness-sensitive, alias-normalized, and deduped before export.
- Hard-mode strategy uses `strategy()` in a separate research file with manual slippage and same-bar accounting.

## Not Proven

- Generated Pine has not been compiled inside TradingView in this environment.
- Hard-mode strategy has not been compiled inside TradingView in this environment.
- Saty visual parity still needs human TradingView signoff.
- Saty source and Luke Pine use TradingView display semantics with `request.security(..., barmerge.lookahead_on)`; that must not be confused with Luke replay/no-lookahead proof.
- Hard-mode Saty uses `lookahead_off`, so it intentionally differs from the display reference for strategy safety.
- Pine cannot prove live ES 1m candle data for Luke.
- Pine cannot make SPX reference levels ES-executable.

## Clustering

- Default tolerance: 1.25 ES points.
- Hard cap: 3.0 ES points.
- Too-wide tolerance can merge distinct rungs; too-tight tolerance can hide useful confluence.

## Rerun

```powershell
cmd /c npm run tradingview:export-levels
cmd /c npx vitest run tests/tradingview-level-export.test.js tests/pine-hardmode-slippage.test.js tests/pine-same-bar-ambiguity.test.js tests/pine-signal-timing.test.js tests/pine-level-clustering.test.js
```
