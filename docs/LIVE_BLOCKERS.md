# Live Blockers

Date: 2026-05-03

## Summary

Luke is not live-execution ready. Tonight's work added read-only research/watchlist visibility only. No fake-breakdown rule is approved for paper or live trading.

## Blocking Items

### 1. Futures Live Market Data Not Proven

- Current proof: `npm run market:data:test` passed structurally but returned UNKNOWN/stale/delayed for ES/MES/NQ/MNQ due missing Tradovate credentials and failed fallback fetches.
- Blocks: live execution and high-confidence staged/paper proof.
- Next proof: run market-hours provider verification with credentialed futures data.

### 2. Live-Grade ES Market Data Still Missing

- Current proof: Saty is fresh, but ES market data still comes from delayed/stale Yahoo chart data.
- Blocks: actionable manual/operator confidence and any watchlist arming.
- Next proof: configure/live-test futures-grade ES quotes.

### 3. Trading Window Is Still Not Approved

- Current proof: ES futures are open, but autonomous preflight correctly remains blocked outside approved cash trading hours.
- Blocks: staged/paper/live action.
- Next proof: repeat during approved cash window with fresh market data.

### 4. Fake-Breakdown Rules Remain Research Only

- Rule A: WATCHLIST_ONLY; strong TP +2 rate but only 33 signals and clustered days.
- Rule B: WATCHLIST_ONLY; no-repeat throttle improved survival but did not hit the 25k target.
- Rule C: WATCHLIST_ONLY; promising TP +2 rate but needs visual review.
- Blocks: paper/live promotion.
- Next proof: visual review plus fresh-market watchlist observation without execution.

### 5. Live Execution Was Not Tested

- Current proof: `prove:staged-flow` passes staged paper/shadow proof only.
- Blocks: live execution readiness.
- Next proof: explicit credentialed broker proof, paper/shadow proof under live market data, then separate human-approved live micro proof if ever desired.

## Not Blockers For Read-Only Use

- The fake-breakdown watchlist endpoint is read-only.
- `/operator-v2` has no execute button.
- The static replay artifact is served read-only.
- Research artifacts live under ignored `artifacts/`.

## Safety Verdict

`LIVE_BLOCKED`

Luke can be used as a read-only research/operator surface with caveats. It should not be used as a live execution system from the current evidence.

## Resolved Tonight

- Old shell `/verdict ES` and `/api/confluence?instrument=ES` now match on confluence row count and top rows.
- Operator-v2 proof and automated natural session proof pass.
- Sunday evening ES futures open is labeled as futures overnight instead of plain Weekend.
- Saty is fresh from auto-pull; US500 was attempted first and `^GSPC` was used only after Yahoo returned HTTP 404 for `US500`.
