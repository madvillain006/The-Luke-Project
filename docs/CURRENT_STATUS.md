# Current Status

Date: 2026-05-05 ET
Artifact timestamp: 2026-05-05 UTC

## Verdict

Luke is Conor's personal local AI assistant and clawbot, built in memory of Luke, his dog and best friend. Trading is one module inside Luke, not the whole system. The canonical trading audit is `docs/HOSTILE_AUDIT_REPORT.md`; this file is only the short operating snapshot.

## Current Proof

- `npm test`: 127 files passed; 799 tests passed; 1 skipped.
- Runtime health passed on port 3000.
- `/operator-v2`, `/trading-window`, replay level-state, live-shaped level-state, and staged-flow proofs passed.
- `prove:luke-ui-ux` passed across the main shell, embedded Daily panel, Daily window, Luke chat, trading chat, trading window, Operator V2, and brain dashboard PNG captures.
- `prove:brain-sections` passed against a fresh proof server; it clicked and captured brain brief, morning brief, afternoon brief, automation plan, developer plan, history searches, and automation artifact output.
- Screenshot sanity passed for the hostile-audit PNG set.
- `tradingview:export-levels` passed with no export issues.
- `market:data:test` returned ES/MES/NQ/MNQ/SPX/SPY/QQQ prices, but every result was stale/delayed and `usable_for_live_arming:false`.

## Local Replay Candles

- ES and SPX local/replay 1m candle sources exist.
- Local/replay candles are `live:false`, `replay:true`, and `usable_for_live_arming:false`.
- Local/replay candles may drive replay/dev proof only.
- Invalid or outside-range replay timestamps fail explicitly.

## Current Safe Surfaces

- `/operator-v2`: read-only operator surface.
- `/trading-window`: read-only live-shaped replay/dev surface.
- `/daily`: static Daily Brief window with date/time, Buffalo/current weather, Knoxville weather, Wilmington weather, Google Calendar week cache, Gmail cleanup status, Tennessee move prompt, and history job/lead scan.
- `/brain-dashboard`: non-trading brain surface with clickable brain brief, daily brief, automation-business, developer-stack, and history-career outputs.
- Legacy chat staged-trade UI is review-only; its execution button is disabled and does not call `/agent/autonomous/execute-staged`.
- Local staged/paper/shadow execution can be unlocked with `LUKE_ENABLE_STAGED_EXECUTION`; live broker submission still requires separate `LUKE_ENABLE_LIVE_EXECUTION` and the brokerage proof now in progress.
- Direct live executor calls also check the live gate before broker credentials or Tradovate order submission.
- Trading APIs are GET-only for level state, candidates, alerts, candle status, chart data, and source health.
- Server startup exits cleanly if port 3000 is already held by Luke or another process, and PM2 is configured not to crash-loop clean duplicate-start exits.
- Pine is a visual/watchlist indicator using `indicator()` and `alertcondition()` only.
- Luke Watch production-test Pine is tracked as a realistic-accounting visual indicator; the simulation strategy is TradingView Strategy Tester only.
- Hard-mode Pine research summary lives in `docs/TRADINGVIEW_HARDMODE_RESEARCH.md`; the strategy file is `tradingview/luke-level-reclaim-watch-hardmode.strategy.pine`.
- Hard mode supports entry-only, exit-only, both-side, round-trip, and custom slippage with stop-first same-bar accounting.
- Mancini current log filename now matches its header date: `data/research/mancini/The Mancini Logs 3-15-2026 - 5-4-2026.txt`.

## Current Blocks

- No credentialed/proven live or delayed ES 1m OHLC candle provider.
- Massive/Polygon key exists, but tested snapshot/index endpoints were not entitled or rate-limited.
- TradingView Pine has not been compiled inside TradingView.
- Luke Watch production-test Pine and its simulation-only strategy have not been compiled inside TradingView.
- Hard-mode Pine has not been compiled inside TradingView.
- Saty parity still needs human TradingView visual signoff.
- Research rules remain watchlist/research only.
- Live and staged execution remain blocked by default.
- Daily check-in is no longer the primary Daily UI; Daily is a static operating brief.
- Direct Google Calendar/Gmail hooks are installed. Calendar can use Google OAuth or an API key for public calendars; Gmail requires Google OAuth credentials with Gmail scopes. Existing Codex connector caches remain the fallback.

## Next Milestone

Wire a real delayed/live ES 1m OHLC candle provider and prove it during market hours without weakening replay/live separation.
