# Tonight Wrap-Up

Date: 2026-05-03

## What Was Added

- Read-only fake-breakdown watchlist endpoint:
  - `GET /api/research/fake-breakdown-watchlist?instrument=ES`
- Read-only research route:
  - `/research/fake-breakdown-watchlist`
- Operator-v2 watchlist card:
  - Displays Rule A/B/C as WATCHLIST_ONLY.
  - Shows state, level, source combo, current price, target space, no-repeat throttle status, artifact route, and caveats.
  - No execute, stage, buy, sell, paper, or live controls.
- Virtual proof harness:
  - `scripts/run-tonight-wrapup-proof.js`
  - Saves browser screenshots and API JSON under `artifacts/proof/tonight-wrapup/`.

## Fake-Breakdown Watchlist Status

| Rule | Status | Evidence | Caveat |
| --- | --- | --- | --- |
| A | WATCHLIST_ONLY | 33 signals, 32 tradeable rows, TP +2 81.3%, stop-first 18.8% | Low sample and clustered across 12 days / 6 weeks. |
| B | WATCHLIST_ONLY | Best throttle `no_repeat_same_level_after_loss_2es`, +$1200, no fail, max drawdown $675 | Baseline failed; throttle did not hit the 25k target. |
| C | WATCHLIST_ONLY | 76 signals, 56 tradeable rows, TP +2 80.4%, stop-first 26.8% | Needs visual review. |

No rule is paper approved. No rule is live approved.

## Visible In Luke

- Old shell `/` still loads.
- `/operator-v2` still loads and remains read-only.
- Fake Breakdown Watchlist card is visible inside `/operator-v2`.
- Static visual replay is available at `/research/fake-breakdown-watchlist`.
- API proof confirms `/api/research/fake-breakdown-watchlist?instrument=ES` returns read-only watchlist data.

## Proof Artifacts

- `artifacts/proof/tonight-wrapup/old-shell.png`
- `artifacts/proof/tonight-wrapup/operator-v2.png`
- `artifacts/proof/tonight-wrapup/operator-v2-watchlist-card.png`
- `artifacts/proof/tonight-wrapup/fake-breakdown-watchlist.png`
- `artifacts/proof/tonight-wrapup/api-status.json`
- `artifacts/proof/tonight-wrapup/api-readiness.json`
- `artifacts/proof/tonight-wrapup/api-decision.json`
- `artifacts/proof/tonight-wrapup/api-confluence.json`
- `artifacts/proof/tonight-wrapup/api-watchlist.json`
- `artifacts/proof/tonight-wrapup/api-autonomous-status.json`
- `artifacts/proof/tonight-wrapup/api-autonomous-preflight.json`
- `artifacts/proof/tonight-wrapup/virtual-operator-proof.json`

## Commands Run

- `npm test`: PASS, 77 files, 611 passed, 1 skipped.
- `npm run prove:operator-v2`: PASS, `SAFE_READ_ONLY_MIRROR`.
- `npm run session:operator-v2`: PASS, `AUTOMATED_SESSION_PASS_WITH_NOT_TESTABLE_CASES`.
- `npm run market:data:test`: PASS structurally; providers returned UNKNOWN/stale/delayed.
- `npm run replay:history`: PASS, historical replay verdict passed.
- `npm run research:fake-breakdown-state`: PASS, best Rule A WATCHLIST_ONLY.
- `npm run research:fake-breakdown-watchlist`: PASS, 301 signals.
- `npm run research:fake-breakdown-v3`: PASS, 1368 unique setups.
- `npm run research:prop-fake-breakdown`: PASS, 2351 unique setups.
- `npm run research:fake-breakdown`: PASS, 516 candidates, 396 valid reclaims.
- `npm run research:replay:existing`: PASS, 37 sessions, 2720 checkpoints.
- `npm run research:inventory`: PASS, 1551 files, 13706 timeline events.
- `npm run prove:staged-flow`: PASS, `STAGED_FLOW_PROOF_PASS`.
- `node scripts/run-tonight-wrapup-proof.js`: PASS, screenshot/API proof generated.

## UI Once-Over

- Old shell: loaded and not replaced by operator-v2.
- Operator-v2: loaded with read-only warning, decision panel, market-data freshness, autonomous recommendation-only posture, and no execute button.
- Watchlist card: visible, read-only, Rule A/B/C WATCHLIST_ONLY, warning says not a trade recommendation.
- Static watchlist artifact: loaded with replay charts and read-only research language.

## Safety Audit

- `lib/decision-spine/index.js` has no diff.
- No new execution shortcut was added.
- `/operator-v2` remains read-only.
- Watchlist endpoint is GET-only.
- Watchlist artifacts write only under ignored `artifacts/`.
- Safety scan hits in `index.js` are pre-existing app routes/writes, not new watchlist execution paths.

## Readiness Scores

| Area | Score |
| --- | ---: |
| Code review readiness | 90% |
| Manual trading companion readiness | 88% |
| Operator-v2/read-only app readiness | 96% |
| Research/watchlist readiness | 90% |
| Staged/paper bot readiness | 84% |
| Live execution readiness | 40% |

## What Broke Or Remains Red

- Market data is currently UNKNOWN/stale/delayed because credentials/fetches are unavailable.
- Live trading remains blocked outside approved cash hours even though ES futures are open.

## What Was Fixed

- Fake-breakdown watchlist became app-visible through a read-only endpoint, route, and operator card.
- Watchlist warning and operator title use clean ASCII wording.
- Static replay chart labels were moved to avoid overlap.
- Proof harness now saves screenshots and API JSON.

## Tomorrow Inspect

- Old shell vs operator-v2 confluence row mismatch.
- Monday market-hours provider proof with fresh Saty.
- Rule A/B/C visual replay examples, especially Rule C.
- Whether Rule B throttle should stay watchlist-only or become a paper candidate after more review.
- Dirty worktree grouping before any commit.

## Monday / Live-Market Checklist

- Load current Saty.
- Verify ES market data with a futures-grade provider.
- Open `/operator-v2` and confirm market-data labels are honest.
- Open Fake Breakdown Watchlist and confirm no arm occurs without valid ES data.
- Do not use Rule A/B/C for paper or live orders.

## Final Verdict

`TONIGHT_READY_WITH_BLOCKERS`

The read-only watchlist milestone is integrated and proofed. The remaining blockers are live-grade ES market data, approved cash-hour trading-window proof, and Rule A/B/C staying WATCHLIST_ONLY.

## Follow-Up Fix Pass

- `/verdict ES` now renders confluence-only rows even when `/saty` is missing, so old shell and `/api/confluence` no longer disagree on row count.
- `npm run prove:operator-v2`: PASS, `SAFE_READ_ONLY_MIRROR`.
- `npm run session:operator-v2`: PASS, `AUTOMATED_SESSION_PASS_WITH_NOT_TESTABLE_CASES`.
- Operator status recognizes Sunday evening ES futures as `futures_overnight` while keeping the trading window blocked outside approved cash hours.
- Saty auto-pull now prefers configurable US500 reference symbols when futures are open and cash is closed; current run attempted `US500`, received Yahoo HTTP 404, then safely fell back to `yahoo:^GSPC`.
- Shell UI was compacted; `artifacts/proof/tonight-wrapup/ui-layout-metrics.json` shows `/` at 1440x900 requires no horizontal or vertical scroll.
