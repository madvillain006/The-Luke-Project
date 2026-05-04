# Review Readiness

Date: 2026-05-03
Branch: `refactor/decision-spine-cleanup`

## Current Scores

| Area | Score | Why not 99 |
| --- | ---: | --- |
| Code review readiness | 90% | Full tests pass, but the worktree contains many tracked and untracked research/Kat/operator changes that need human review as one packet. |
| Manual trading companion readiness | 88% | Old shell and operator APIs load, Saty is fresh, and futures-open state is labeled correctly, but ES market data is still stale/delayed. |
| Operator-v2/read-only app readiness | 96% | Browser proof, API proof, operator-v2 proof, and natural session proof now pass. |
| Research/watchlist readiness | 90% | Fake-breakdown research artifacts, state machine, and watchlist card exist and test, but Rule A/B/C remain WATCHLIST_ONLY. |
| Staged/paper bot readiness | 84% | `prove:staged-flow` passes, but staged behavior still needs a controlled market-hours proof with fresh market data. |
| Live execution readiness | 40% | No credentialed Tradovate/live broker proof was run or requested; live execution remains blocked. |

## Evidence Run Tonight

- `npm test`: PASS, 77 files, 611 passed, 1 skipped.
- `npm run prove:operator-v2`: PASS, `SAFE_READ_ONLY_MIRROR`.
- `npm run session:operator-v2`: PASS, `AUTOMATED_SESSION_PASS_WITH_NOT_TESTABLE_CASES`.
- `npm run market:data:test`: PASS structurally; ES/MES/NQ/MNQ/SPX/SPY/QQQ returned UNKNOWN/stale/delayed due missing credentials or fetch failures.
- `npm run replay:history`: PASS, 26 checkpoints, 0 actionable, 26 PASS/WAIT, 3 Mancini vetoes.
- `npm run research:fake-breakdown-state`: PASS, 1741 level watches, 1639 rows, best Rule A WATCHLIST_ONLY.
- `npm run research:fake-breakdown-watchlist`: PASS, 301 signals, Rule A 12 days, Rule B throttle +$1200 no fail.
- `npm run research:fake-breakdown-v3`: PASS, 1368 unique setups, 11368 observation rows, best V3 pre-entry rule 43 setups.
- `npm run prove:staged-flow`: PASS, `STAGED_FLOW_PROOF_PASS`.
- `node scripts/run-tonight-wrapup-proof.js`: PASS, screenshots and API JSON saved under `artifacts/proof/tonight-wrapup/`.

## Product Surfaces

- Old shell `/`: screenshot proof exists and the old shell still loads.
- `/operator-v2`: screenshot proof exists; it remains read-only with refresh as the only button.
- `/api/research/fake-breakdown-watchlist?instrument=ES`: read-only GET endpoint returns Rule A/B/C WATCHLIST_ONLY status, artifact summary, caveats, and no execution fields.
- `/research/fake-breakdown-watchlist`: serves the static read-only replay artifact.

## Review Blockers

- Review the dirty worktree as a packet before merge; there are many untracked research/Kat files.
- Re-run market-data and operator proof during approved cash hours with live-grade ES data.
- Keep Rule A/B/C as WATCHLIST_ONLY until more visual review and out-of-sample evidence exist.

## Safety Status

- `lib/decision-spine/index.js` has no diff.
- `/operator-v2` remains read-only.
- The fake-breakdown watchlist endpoint is GET-only and read-only.
- No direct execution shortcut was added.
- Rule A/B/C were not promoted to paper or live.

## Follow-Up Fix Evidence

- `/verdict ES` and `/api/confluence?instrument=ES` now both report 5 matching top confluence rows.
- Operator status now reports ES futures as `futures_overnight` when the Sunday session is open.
- Autonomous preflight no longer says `Weekend`; it remains blocked with `Futures overnight open - outside approved cash trading window`.
- Saty auto-pull attempted configurable US500 reference data during futures-open/cash-closed mode; Yahoo returned HTTP 404 for `US500`, so the saved source is the safe `yahoo:^GSPC` fallback.
- Shell layout proof shows no `/` scroll at 1440x900.

## Verdict

`REVIEW_PACKET_READY_WITH_BLOCKERS`

The code is testable and the read-only watchlist milestone is visible, but current evidence does not justify live execution readiness or paper/live promotion for fake-breakdown rules.
