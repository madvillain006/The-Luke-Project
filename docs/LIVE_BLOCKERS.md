# Live Blockers

Date: 2026-05-04 ET
Artifact timestamp: 2026-05-05 UTC

Luke is `LIVE_BLOCKED`. Current audit detail lives in `docs/HOSTILE_AUDIT_REPORT.md`.

## Hard Blocks

1. Live-arming market data is not proven.
   `market:data:test` returns prices for ES/MES/NQ/MNQ/SPX/SPY/QQQ, but all are stale/delayed and `usable_for_live_arming:false`.

2. Live ES 1m OHLC candles are not proven.
   Latest-price data can support watch/approach context only. Flush, reclaim, retest hold, invalidation, and candidate arming require authorized 1m candles.

3. Replay/dev data is proof-only.
   Live mode requires `live:true` and `usable_for_live_arming:true`; replay/dev requires `replay:true` and `usable_for_replay:true`.

4. SPX reference conversion is blocked.
   No fixed `+30` SPX-to-ES conversion is strategy truth. SPX levels stay reference-only without a proven basis adapter.

5. TradingView is not an execution bypass.
   Pine uses `indicator()` and `alertcondition()` only, cannot submit orders, cannot read manual drawn lines, and has not been compiled in TradingView here.

6. Research is not live approval.
   Ladder reclaim 25k 2ES failed, fake breakdown remains `WATCHLIST_ONLY`, and false positives/same-bar ambiguity remain.

7. Existing execution remains env-locked and needs a separate audit.
   `trading/router.js` and `trading/execution-live.js` still exist by design. `/agent/autonomous/execute-staged` is blocked by default behind `LUKE_ENABLE_STAGED_EXECUTION`, and live mode/live execution also require `LUKE_ENABLE_LIVE_EXECUTION`.

## Allowed Read-Only Use

- `/operator-v2`, `/trading-window`, and trading-state APIs are read-only.
- Legacy chat can show pending signal context, but its execution control is disabled and review-only.
- Replay/local candles can support historical proof and visual review.
- TradingView export can support manual chart watching.
- Current allowed statuses are `WATCH_ONLY`, `PAPER_CANDIDATE_SIM`, `PAPER_CANDIDATE_LIVE_DATA`, `PASS_RISK`, `PASS_NO_TARGET`, `PASS_DATA_UNKNOWN`, and `INVALIDATED`.
- `LIVE_READY` is not allowed.

## Next Legitimate Step

Prove a fresh delayed/live ES 1m OHLC candle provider during market hours. Anything else is overclaiming.
