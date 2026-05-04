# Live Blockers

Date: 2026-05-04

## Summary

Luke is not live-execution ready. The current surface is a read-only level-state companion with simulated bracket-plan objects and local/replay 1m candle proof only.

## Current Candidate Status

- Candidate: `ladder_reclaim_bobby_mancini_staged_v1`
- Generic strategy: `multi_source_ladder_first_reclaim_long`
- Statuses allowed: `WATCH_ONLY`, `PAPER_CANDIDATE_SIM`, `PAPER_CANDIDATE_LIVE_DATA`, `PASS_RISK`, `PASS_NO_TARGET`, `PASS_DATA_UNKNOWN`, `INVALIDATED`, `LIVE_BLOCKED`
- Not `LIVE_READY`.
- No automation or live execution route was added.
- TradingView `WATCH`, `ARMED`, `PAPER_CANDIDATE`, and `INVALIDATED` alerts are visual/watchlist alerts only.

## Blocking Items

### 1. Live-Grade ES Data Still Not Proven

- The engine uses current market data only when it is fresh enough.
- `STALE`, `DELAYED`, and `UNKNOWN` data cannot arm a candidate.
- Local/replay CSV candles are labeled `live: false` and `usable_for_live_arming: false`.
- Next proof: credentialed live ES data verification during the target trading window.

### 2. Live 1m Candle Structure Is Required To Arm

- Latest price can show watch/approach only.
- Flush, reclaim, retest hold, and two-candle hold require bar/candle structure.
- If 1m candles are unavailable, Luke must show insufficient candle data and stay watch-only.
- Local/replay candles may drive replay/dev state proof, but they cannot arm live candidates.
- Replay-mode API responses are read-only and return `live: false`.

### 3. SPX Reference Conversion Is Blocked

- Current Saty ATR levels are SPX reference data.
- The new engine keeps SPX levels reference-only.
- No fixed +30 SPX-to-ES conversion is used as strategy truth.
- Future ES conversion needs an explicit live basis adapter.

### 4. Trading Window Is Still Read-Only

- `/trading-window` shows live-shaped replay candles, level states, candidate queue, and bracket visuals.
- It has no broker route, no submit control, and no live order path.
- `PAPER_CANDIDATE_SIM` means simulated bracket plan and human review only.
- `PAPER_CANDIDATE_LIVE_DATA` remains a future read-only paper candidate status, not execution approval.

### 5. Paper Automation Is Not Approved

- No paper/shadow submit path was wired.
- Human confirmation remains mandatory for any future paper state mutation.

### 6. 25K 2ES Broad Promotion Is Blocked

- 1ES starter is the default 25K mode.
- Add 1ES requires retest-hold confirmation.
- 2ES full remains blocked unless risk gate and explicit config allow it.

### 7. Live Execution Was Not Tested Or Changed

- No broker execution was called.
- No direct execute shortcut was added.
- No live order route was added.
- Any future live proof needs a separate explicit phase.

### 8. TradingView Bridge Is Not A Live Bypass

- Pine cannot submit Luke orders.
- Pine cannot read user-drawn horizontal lines.
- The generated indicator uses `indicator`, not `strategy`.
- The TradingView exporter writes JSON/CSV/input/Pine artifacts only.
- Fixed SPX-to-ES `+30` conversion is not used as strategy truth.
- Heatmap/GEX levels are intraday snapshots and stale snapshots cannot strengthen Pine clusters.

## Not Blockers For Read-Only Use

- `/api/trading/level-state` is GET-only.
- `/api/trading/trade-candidates` is GET-only.
- `/api/trading/alerts` is GET-only.
- `/api/trading/candle-status` is GET-only.
- `/api/trading/chart-data` is GET-only.
- `/api/trading/source-health` is GET-only.
- `/api/health` is read-only.
- `/operator-v2` displays the read-only level-state surface.
- `/trading-window` displays the read-only replay/dev trading window.
- ES and SPX local/replay 1m CSV ingestion is available for historical proof.
- Replay-mode level-state, candidate, and alert APIs use the same candle/state engine path planned for future delayed/live providers.
- Simulated bracket visual exists without submit controls.
- TradingView generated Pine can show watchlist-only bracket visuals without submit controls.

## Safety Verdict

`LIVE_BLOCKED`

Luke can now watch level states and show paper/research bracket plans, but it must not execute or auto-paper this candidate from the current evidence.
