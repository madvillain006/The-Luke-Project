# Review Readiness

Date: 2026-05-02  
Branch: `refactor/decision-spine-cleanup`

## Git Status Summary
- Root directory was cleaned for review: live app/config files remain at root; legacy notes moved to `docs/legacy-root/`.
- Removed root duplicate/generated files after confirming live copies or structured runtime paths exist.
- Remaining worktree is intentional product/test/doc cleanup, ready to review as a follow-up commit.
- Generated proof outputs remain ignored under `artifacts/`.

## Patch Groups
- Decision spine + entries.
- Autonomous spine gating.
- Operator-v2 read-only shell/API.
- Market-data abstraction.
- Saty/Yahoo provider fallback.
- Parser/input hardening and Dubz carry-forward.
- State path normalization.
- Local brain agent reporting layer.
- Root cleanup / legacy-root archive.
- Proof/session tools.
- Review docs.

## Tests Run
- `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe -Command "cd 'C:\Users\conor\luke'; npx vitest run"`: PASS, 40 files, 454 tests passed, 1 skipped.
- `npm run prove:operator-v2`: PASS, read-only mirror proof starts/connects to Luke and exits clean.
- `npm run session:operator-v2`: PASS, automated old-shell/API/operator-v2 session proof.
- `npm run market:data:test`: PASS, safe UNKNOWN behavior when providers fail in this sandbox.
- `npm run prove:staged-flow`: PASS, controlled local paper/shadow route drill.
- `npm run replay:history`: PASS, 7 historical sessions, 26 checkpoints, 19 Bobby-parsed checkpoints, 3 Mancini vetoes, 0 actionable adapter decisions.

## Decision Spine
- `buildTradeDecision(...)` exists in `lib/decision-spine/index.js`.
- `/entries ES` uses `buildTradeDecision(...)`.
- `/api/decision` calls the same spine through `lib/operator/decision-adapter.js`.
- `/operator-v2` displays backend API payloads; it does not compute trade side, entry, stop, target, sizing, freshness, or vetoes client-side.
- Autonomous preflight/evaluate consumes or compares against the spine before emitting chat recommendations.
- `scoreSignals(...)` remains secondary/proposer evidence, not lead authority.
- WAIT/PASS/refusal states remain covered for stale/missing/UNKNOWN context.

## Market Data
- Central provider layer exists at `lib/market-data/`.
- Price results include symbol, instrument, price fields, timestamp, source, session, stale, delayed, confidence, error, and raw.
- Production SPY*10, SPX+30, and QQQ*41.3 live-price approximations were removed earlier.
- Provider failure returns structured `UNKNOWN`, stale/delayed, confidence 0.
- Yahoo fallback is wired for SPX daily bars in Saty auto-pull and direct Yahoo market-data verification.
- Latest provider run produced stale/delayed Yahoo/Finnhub data safely labeled as non-live.
- ES/MES/NQ/MNQ do not silently use SPX/QQQ as live futures truth.
- Live Tradovate proof remains external.

## Strategy Pipeline
- Saty: user supplied Pine source-of-truth; day-mode 13-level coefficient parity is tested. Yahoo `^GSPC` generated SPX levels successfully when network access was allowed.
- Mancini: parser covers triggers, targets, chop zones, narrative-only posts, and timestamp/year traps; chop zones reach spine vetoes/operator display.
- Dubz: structural levels now carry forward across days until manually replaced/deleted; same-day callouts are separate and expire same day.
- Bobby: duplicate heatmap idempotency prevents repeated identical input from inflating Level Memory or changing decisions.
- Katbot/Jefe: secondary context only; missing context is nonfatal and must not outrank spine.
- Historical corpus: `npm run replay:history` runs local ES minute bars, historical Saty, Mancini levels/chop zones, Bobby text, and cached Bobby image parses through the current spine without live data.

## Execution Capability
- `executeLive`, `executePaper`, `executeShadow`, Tradovate broker path, staged signal path, and explicit `/execute-staged` confirmation route exist.
- `npm run prove:staged-flow` proves `/execute-staged` accepts a seeded paper signal, opens paper only, clears pending, and proves shadow rejects safely without credentials/live execution.
- `/operator-v2` remains read-only and has no execute button.
- Autonomous is currently recommendation-only: evaluation may notify Luke chat, but it does not stage or execute trades.
- Manual staged flow remains explicit-confirmation gated and still checks risk, pending/open position, kill flags, trading window, and market context.
- Live execution is not environment-proven and must remain blocked without credentials/risk proof.

## Old/New Surface Agreement
- Proof script previously reported no remaining old shell/API/operator-v2 mismatches.
- Automated session runs old shell commands through `POST /chat`, checks APIs, checks `/operator-v2` DOM, and handles local 429 proof-rate limits without hiding real mismatches.
- Historical replay observed local Bobby/Mancini/Saty data through the spine; adapter correctly kept all replay checkpoints PASS/WAIT.
- Not naturally observed: live actionable price, autonomous chat recommendation from live evaluation.

## Readiness Scores
- Code review readiness: 98%.
- Why not 99: this commit intentionally removes/archives many root files; reviewer should inspect that cleanup group.
- To reach 99: review the root cleanup group and confirm no external workflow depended on root duplicates.

- Trading companion readiness: 94%.
- Why not 99: live Tradovate data and market-hours behavior still need environment proof.
- To reach 99: futures-grade provider proof plus one market-hours/manual companion proof.

- Staged bot readiness: 94%.
- Why not 99: route-level paper/shadow proof passes, but manual staged flow still needs a controlled market-hours proof with real/latest market data.
- To reach 99: market-hours paper/shadow proof where a human-confirmed staged signal validates price/risk gates without live execution.

- Live execution readiness: 42%.
- Why not 99: no credentialed Tradovate market-data or execution proof.
- To reach 99: broker credential proof, paper/shadow drill, then explicit confirmation-gated live micro proof.

## Inspect First
- `lib/saty-auto-pull.js`
- `lib/market-data/providers/yahoo.js`
- `lib/decision-spine/index.js`
- `lib/parse-dubz.js`
- `trading/router.js`
- `scripts/replay-decision-spine-history.js`
- `agents/agent-00-brain.js`
- `brain-dashboard.html`
- `luke-shell.html`
- `docs/legacy-root/`
- staged root deletions in `git status --short`

## Failure-Oriented Findings
- Root mess is now reduced; remaining root files are app/config entrypoints.
- Fake static price assumptions remain removed from production live-price paths.
- Provider failure degrades to UNKNOWN; Luke should WAIT/PASS rather than guess.
- SPX/ES and QQQ/NQ are confluence-only references, not price substitutes.
- Tests cover safety behavior but cannot prove live market data or broker execution without credentials.
- Historical replay found current adapter safety is conservative: raw spine plans were converted to PASS/WAIT when the live-style entry timing was not acceptable.

## Verdict
`REVIEW_PACKET_READY` for senior SWE/trader review.  
Not live-execution ready until external provider/broker proof and market-hours observation are completed.
