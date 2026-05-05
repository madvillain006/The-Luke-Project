# TradingView Hard-Mode Research

Date: 2026-05-05 ET

## 1. What Hard Mode Is

`tradingview/luke-level-reclaim-watch-hardmode.strategy.pine` is a research/backtest harness for Luke-style reclaim signals. It uses `strategy()` so TradingView can run a Strategy Tester comparison, but its manual hard-mode table is the pessimistic accounting source of record.

It is not broker automation, not live readiness, and not an execution recommendation.

## 2. Slippage Modes

The hard-mode strategy exposes:

- `none`
- `entry_only_0_25`
- `exit_only_0_25`
- `both_sides_0_25_each`
- `round_trip_0_50`
- `round_trip_1_00`
- `custom_points`

Built-in TradingView slippage is set to zero. Luke hard mode calculates effective long prices manually:

- `entry_effective = raw_entry + entry_slippage`
- `tp_effective = raw_tp - target_exit_slippage`
- `stop_effective = raw_stop - stop_exit_slippage`

## 3. Entry/Exit/Both-Side Testing

Default mode is `both_sides_0_25_each`. `round_trip_0_50` maps to 0.25 point adverse entry and 0.25 point adverse exit. `round_trip_1_00` maps to 0.50 point adverse entry and 0.50 point adverse exit.

For ES, the manual model uses $50 per point per contract:

- `1ES_starter`: $50/point
- `2ES_full`: $100/point

## 4. Same-Bar Ambiguity

Default same-bar policy is `stop_first_hard_mode`.

Available policies:

- `target_first`
- `stop_first_hard_mode`
- `ambiguous_exclude`
- `ambiguous_report_only`

The table surfaces ambiguous count, wins converted to losses, and excluded ambiguous trades. A candle that touches both stop and target is not silently counted as a clean win under the default.

## 5. Signal Timing / Repaint Checks

Hard mode gates candidate creation on `barstate.isconfirmed` and defaults to `next_bar_open` entry timing. The table shows setup bar, confirmation bar, signal bar, and entry bar.

The strategy-safe Saty calculation uses `barmerge.lookahead_off`. It does not plot arrows backward and does not use negative plot offsets.

## 6. Saty Source Risk

`tradingview/saty-atr-levels-source.pine` remains the display/reference file and still uses the Saty-style `request.security(..., barmerge.lookahead_on)` behavior. Hard mode deliberately does not reuse that display lookahead for backtest signals.

Difference:

- Visual/reference Saty: display parity risk, `lookahead_on`.
- Hard-mode Saty: strategy-safe backtest risk, `lookahead_off`.

This difference is intentional and needs human TradingView visual signoff before claiming Saty parity.

## 7. Clustering Risks

Default cluster tolerance is 1.25 ES points. Values above 3.0 are capped and warned. Clusters require final width to stay inside tolerance, so far rungs such as 7248 and 7258 do not merge.

Stale `heatmap_gex` does not strengthen source counts.

## 8. What Pine Can And Cannot Prove

Can prove:

- TradingView-chart backtest behavior under explicit pessimistic assumptions.
- Whether the signal still survives selected slippage and same-bar policies.
- Whether generated Luke levels can be pasted into a repeatable script.

Cannot prove:

- Luke live-market data validity.
- Broker fills.
- Manual TradingView line ingestion.
- SPX-to-ES executable conversion.
- Saty visual parity without human chart review.

## 9. How To Run/Export

```powershell
cmd /c npm run tradingview:export-levels
cmd /c npx vitest run tests/pine-hardmode-slippage.test.js tests/pine-same-bar-ambiguity.test.js tests/pine-signal-timing.test.js tests/tradingview-level-export.test.js tests/pine-level-clustering.test.js
cmd /c npm run research:pine-slippage-audit
```

Generated hard-mode file:

`artifacts/tradingview/luke-level-reclaim-watch-hardmode.generated.strategy.pine`

Audit artifacts:

- `artifacts/tradingview/pine-hardmode-audit.json`
- `artifacts/tradingview/slippage-modes-summary.json`
- `artifacts/tradingview/pine-files-summary.json`
- `artifacts/research/pine-slippage-audit/PINE_SLIPPAGE_HISTORICAL_AUDIT.md`
- `artifacts/research/pine-slippage-audit/slippage-summary.json`
- `artifacts/research/pine-slippage-audit/pine-vs-luke-parity.json`

## 10. Historical Slippage Result

The historical slippage audit is generated artifact data, not a separate canonical docs verdict.

- Comparison type: Luke-equivalent reconstruction.
- Default hard mode: confirmed-bar timing, next-bar-open entry, stop-first same-bar policy, and explicit adverse slippage.
- 0.50 round-trip 1ES result from the latest run: expectancy -20, total -9018.5, max drawdown 9309.5.
- 1.00 round-trip 1ES stress: expectancy -41.05, total -18758.5, max drawdown 18759.
- Same-bar ambiguity under stop-first: 3 ambiguous trades, 2 wins converted to losses.
- Broad Pine-style reconstruction is not enough for promotion; keep this `WATCHLIST_ONLY` until TradingView compilation, human visual parity, and source-data risk checks are complete.

## 11. What To Send To Luke Historical Audit

Send the hard-mode Pine results with:

- Slippage mode.
- Same-bar policy.
- Contract mode.
- Ambiguous trade count.
- Wins converted to losses.
- Net result after effective prices.
- Screenshot or exported Strategy Tester range.
- The generated Pine file used for the run.
