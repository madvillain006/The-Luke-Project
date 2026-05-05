# Fake Breakdown Goal Mode Progress

Date: 2026-05-03

Status: historical progress snapshot for the fake-breakdown watchlist work. Use `docs/HOSTILE_AUDIT_REPORT.md` and `docs/CURRENT_STATUS.md` for current readiness.

## Current Completed Work

- Existing fake-breakdown state-machine research remains runnable.
- Static fake-breakdown visual replay artifact exists and rebuilds.
- Read-only live watchlist adapter exists for Rule A/B/C.
- `/api/research/fake-breakdown-watchlist?instrument=ES` returns watchlist state and artifact summary.
- `/operator-v2` displays a read-only Fake Breakdown Watchlist card.
- `/research/fake-breakdown-watchlist` serves the static replay artifact.
- Virtual proof screenshots and API JSON were generated.
- Confluence parity is fixed: `/verdict ES` and `/api/confluence?instrument=ES` match.
- Futures-open status is fixed for ES operator context.
- History Career is nested under Research Leads in the shell UI.
- Shell proof at 1440x900 no longer requires a scroll wheel for the main board.

## Current Rule Status

- Rule A: WATCHLIST_ONLY.
- Rule B: WATCHLIST_ONLY.
- Rule C: WATCHLIST_ONLY.
- No rule is paper approved.
- No rule is live approved.

## Current Proof

- Full tests pass.
- Research scripts pass.
- Staged-flow proof passes.
- Browser/API proof passes for the old shell, operator-v2, watchlist route, and key APIs.
- Operator session DOM safety passes after escalation.

## Current Blockers

- Current ES market data remains stale/delayed from Yahoo.
- US500 Yahoo symbol returned HTTP 404; configure `SATY_US500_YAHOO_SYMBOLS` if a working US500 vendor symbol is available.
- Live execution is unproven and should stay blocked.

## Safety State

- `buildTradeDecision` unchanged.
- Live trading behavior unchanged.
- `/operator-v2` read-only.
- Watchlist read-only.
- No execution shortcut added.
- Artifacts ignored under `artifacts/`.

## Next Best Task

Configure a live-grade ES market-data provider or a working US500 reference symbol, then rerun the operator proof during approved cash trading hours.
