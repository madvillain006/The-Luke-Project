# Hostile Audit Report

Date: 2026-05-04 ET
Artifact timestamp: 2026-05-05 UTC

## 1. Executive verdict

Luke is safer than it was, but it is not live-ready. The read-only/operator/replay surfaces have current proof. Delayed/stale market quotes are now proven for ES/MES/NQ/MNQ/SPX/SPY/QQQ, but every quote remains `live:false` and `usable_for_live_arming:false`. Any live-readiness claim above that is false.

## 2. What broke under hostile audit

- Pine used dynamic `alert()` calls and old candidate wording where the requirement was alertconditions-only.
- Live candidate building accepted fresh-looking market data without explicit live-arming authorization.
- Local/replay candle data could be passed too loosely into candidate generation without a hard live-arming flag check.
- Barchart CSV parsing was too brittle around header variants and invalid timestamps.
- Blank numeric CSV fields could become zero.
- `heatmap_gex` duplicate snapshots from transport aliases could still inflate evidence.
- The Mancini current log filename contradicted the header date.
- Existing docs overstated review/readiness for TradingView and live level-state.
- Market-data proof was collapsing to UNKNOWN under short provider timeouts and sandboxed network.

## 3. What was fixed

- Renamed `data/research/mancini/The Mancini Logs 3-15-2026 - 5-3-2026.txt` to `data/research/mancini/The Mancini Logs 3-15-2026 - 5-4-2026.txt`.
- Pine now uses `alertcondition()` only for `WATCH`, `ARMED`, `PAPER_CANDIDATE`, `INVALIDATED`, and `BLOCKED`.
- Pine tests reject `alert(`, `strategy(`, strategy order code, and `BUY`/`SELL` language.
- Hard-mode Pine research now lives as focused research detail in `docs/TRADINGVIEW_HARDMODE_RESEARCH.md`, with generated historical slippage output kept under `artifacts/research/pine-slippage-audit/` instead of a second top-level audit doc.
- Live candidate generation now requires `live:true` and `usable_for_live_arming:true`.
- Replay/dev candidate generation now requires `replay:true` and `usable_for_replay:true`.
- Candle feed authorization flags are carried into the candidate builder.
- Market data results expose `live`, `replay`, `usable_for_replay`, and `usable_for_live_arming`.
- Historical CSV parsing now handles quoted/unquoted Barchart rows, `Close`/`Latest`, `Vol`/`Volume`, invalid timestamps, and missing numeric values.
- `heatmap_gex` dedupes identical snapshots across transport aliases while retaining duplicate IDs and transport evidence.
- Level snapshots use deduped active heatmaps directly.
- Empty Pine inputs and local Saty reference existence are tested.
- Market-data provider timeout was raised, and `market:data:test` now proves delayed/stale Yahoo/Finnhub quotes when network is allowed.
- Polygon entitlement failures now report explicitly instead of hiding as missing closes.

## 4. What remains risky

- Live-grade ES 1m OHLC candles are not credentialed or proven.
- Massive/Polygon key exists, but tested snapshot/index endpoints returned NOT_AUTHORIZED.
- TradingView Pine was text-tested and export-tested, not compiled in TradingView.
- Saty source parity is reference-backed only; it still needs human TradingView visual parity signoff.
- Research is still regime/sample-sensitive.
- Existing staged/live execution modules remain in the repo and require a separate broker-state proof phase.
- SPX levels remain reference-only without an explicit live basis adapter.

## 5. Pine/TradingView cracks

- `VERIFIED_BY_CODE_AND_TEST`: indicator uses `indicator(`, not `strategy(`.
- `VERIFIED_BY_CODE_AND_TEST`: generated/base Pine has no `strategy.entry`, `strategy.order`, `submitOrder`, `placeOrder`, or broker calls.
- `VERIFIED_BY_CODE_AND_TEST`: alert wording excludes `BUY` and `SELL`.
- `VERIFIED_BY_CODE_AND_TEST`: dynamic `alert()` calls were removed.
- `PARTIALLY_VERIFIED`: Saty reference uses `request.security(... lookahead_on)` like the display-oriented source pattern, but Luke replay proof must not be confused with TradingView display semantics.
- `PARTIALLY_VERIFIED`: Hard-mode Pine research uses explicit slippage modes and stop-first same-bar accounting, but remains research/watchlist only.
- `NEEDS_HUMAN_TRADER_SIGNOFF`: Pine has not been compiled/visually compared inside TradingView.

## 6. Market data/candle cracks

- `npm run market:data:test` passed and returned prices for ES/MES/NQ/MNQ/SPX/SPY/QQQ with network allowed.
- All returned rows were delayed/stale and `usable_for_live_arming:false`.
- Current local ES replay inventory exists, but it is stale and marked proof-only.
- Replay candles can generate `PAPER_CANDIDATE_SIM`; they cannot arm live candidates.
- Invalid replay date/time and outside-range requests now fail explicitly instead of fabricating candles.

## 7. Source normalization cracks

- `heatmap_gex` aliases normalize as one source family.
- Transport remains separate evidence.
- Duplicate Bobby/Katbot/Jefe/mathemeatloaf copies no longer double-count as source strength.
- Stale heatmap snapshots are excluded from active state.
- SPX reference-only levels stay non-executable for ES.

## 8. UI cracks

- `/operator-v2` and `/trading-window` proof screenshots exist.
- Screenshot sanity passed for old shell, operator-v2, level-state, bracket visual, alerts, data-health, replay mode, trading window, and heatmap proof images.
- The UI proof is read-only. It does not prove live data.

## 9. Execution safety cracks

- Existing `trading/router.js` still has staged/paper/shadow/live execution paths.
- No new direct execution shortcut was added.
- `/operator-v2` trading APIs remain GET-only.
- Staged-flow proof passed.
- Live execution readiness remains low because broker/live-state proof is absent.

## 10. Research claim cracks

- Ladder reclaim: 25k 2ES failed; 25k 1ES survived. Broad 2ES promotion is blocked.
- Pine hard-mode historical reconstruction remains `WATCHLIST_ONLY`; latest artifact summary showed 0.50 round-trip 1ES expectancy -20 and total -9018.5, while staged add after retest hold remained the best net-profitable related family.
- Ladder reclaim review found 230 false-positive rows.
- Fake breakdown state best recommendation remains `WATCHLIST_ONLY`.
- Fake breakdown v3 still has only 43 best-rule setups and remains research/watchlist.
- No research rule is live-ready.

## 11. Readiness scores

| Area | Score | Why |
| --- | ---: | --- |
| Code review readiness | 95% | Full tests pass, syntax checks pass, provider bugs fixed, proof artifacts current. |
| Manual trading companion readiness | 92% | Read-only/replay proof plus delayed/stale market quote proof; live arming blocked. |
| Read-only app/operator readiness | 95% | Reloaded server passed operator, trading-window, virtual dashboard, and client-demo proofs. |
| TradingView indicator readiness | 85% | Text/export tests pass and export issues are clean; not compiled in TradingView. |
| Live level-state readiness | 72% | Engine works in replay/local proof and delayed quotes exist; live 1m OHLC proof missing. |
| Research/watchlist readiness | 88% | Useful watchlist evidence; false positives and sample risk remain. |
| Staged/paper bot readiness | 72% | Staged proof passes; paper automation is not approved. |
| Live execution readiness | 20% | Existing path only; no broker/live proof and no new live execution work. |

## 12. Commands run

- `git status --short`
- `git diff --stat`
- `git diff --name-status`
- `cmd /c npm test`
- `cmd /c npm run runtime:check`
- `cmd /c npm run market:data:test`
- `cmd /c npm run prove:operator-v2`
- `cmd /c npm run session:operator-v2`
- `cmd /c npm run prove:live-level-state`
- `cmd /c npm run prove:replay-level-state`
- `cmd /c npm run prove:trading-window`
- `cmd /c npm run tradingview:export-levels`
- `cmd /c npm run research:pine-slippage-audit`
- `cmd /c npm run research:ladder-reclaim`
- `cmd /c npm run research:ladder-reclaim-review`
- `cmd /c npm run research:fake-breakdown-watchlist`
- `cmd /c npm run research:fake-breakdown-state`
- `cmd /c npm run research:fake-breakdown-v3`
- `cmd /c npm run prove:staged-flow`

## 13. Proof artifacts

- `artifacts/proof/hostile-audit/audit-summary.json`
- `artifacts/proof/hostile-audit/command-results.json`
- `artifacts/proof/hostile-audit/pine-audit.json`
- `artifacts/proof/hostile-audit/safety-scan.json`
- `artifacts/proof/hostile-audit/failures-fixed.json`
- `artifacts/proof/hostile-audit/remaining-risks.json`
- `artifacts/proof/hostile-audit/market-data-diagnostics.json`
- `artifacts/proof/hostile-audit/api-samples/`
- `artifacts/proof/hostile-audit/ui-screenshots/`
- `artifacts/proof/hostile-audit/ui-screenshots/sanity-check.json`

## 14. Next highest-leverage fix

Wire and prove a real delayed/live ES 1m OHLC candle provider behind the existing candle-feed interface, then rerun the same hostile suite during market hours.
