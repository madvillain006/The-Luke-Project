# Senior SWE + Trader Review Packet

## 1. Review Order
1. Decision spine + entries.
2. Market-data abstraction.
3. Autonomous spine gating.
4. Operator-v2 read-only shell/API.
5. Parser/input hardening.
6. State path normalization.
7. Proof/session tools.
8. Review docs and artifact ignore.

## 2. Product Summary
Luke trading is now packaged as a confluence/confidence trading companion plus staged bot path. Manual `/entries ES`, operator APIs, and `/operator-v2` are intended to reflect the same decision spine. Autonomous can propose/stage only through gated confirmation flow. It is not live-execution-proven yet.

## 3. Critical Safety Invariants
- No production fake/static current-price assumptions.
- UNKNOWN/missing/stale market data must produce WAIT/PASS/non-actionable state.
- Latest-close/weekend/fallback data must be labeled stale/delayed/reference.
- `buildTradeDecision(...)` is the authority for entries-style decisions.
- `/operator-v2` is read-only and not the default shell.
- Autonomous remains staged-only and confirmation-gated.
- No direct execution shortcut or operator-v2 execute button.
- Risk/Apex/open-position/pending-signal/kill/trading-window gates remain preserved.
- Mancini chop zones are veto/avoid/pass logic, not entries.

## 4. What Changed
- Decision spine extracted and wired into `/entries ES`.
- Autonomous compares candidate signals against the spine before staging.
- `/operator-v2` added as a read-only mirror with backend API adapters.
- Market-data layer added with source/timestamp/stale/delayed/confidence metadata.
- Old SPY/SPX/QQQ static price approximations removed from production price path.
- Bobby duplicate/idempotency and Level Memory/parser contract tests added.
- Generated state/proof artifacts moved to structured paths or ignored artifacts.
- Repeatable proof scripts added for operator surface parity and market-data safety.

## 5. Inspect First
- `lib/decision-spine/index.js`
- `lib/commands/entries-command.js`
- `lib/renderers/entries-renderer.js`
- `lib/operator/decision-adapter.js`
- `lib/market-data/index.js`
- `lib/market-data/providers/`
- `trading/router.js`
- `trading/signals.js`
- `operator-v2.html`
- `tests/decision-spine-regression.test.js`
- `tests/market-data.test.js`
- `tests/operator-api-adapters.test.js`

## 6. Commands To Run
- `npm test`
- `npm run prove:operator-v2`
- `npm run session:operator-v2`
- `npm run market:data:test`
- `node index.js`
- Inspect:
  - `http://127.0.0.1:3000/`
  - `http://127.0.0.1:3000/operator-v2`
  - `http://127.0.0.1:3000/api/operator/status`
  - `http://127.0.0.1:3000/api/operator/readiness`
  - `http://127.0.0.1:3000/api/decision?instrument=ES&mode=manual`
  - `http://127.0.0.1:3000/api/confluence?instrument=ES`
  - `http://127.0.0.1:3000/agent/autonomous/status`
  - `http://127.0.0.1:3000/agent/autonomous/preflight`
- Latest endpoint smoke returned HTTP 200 for all URLs above.

## 7. Known Unproven Areas
- Tradovate live market data.
- Provider fallback latest-close when network/provider access works.
- Live actionable LONG/SHORT with real current price.
- Pending staged signal produced naturally.
- Active chop-zone veto at live/current price.
- Saty ATR auto-generation parity with trusted Saty source.
- Dubz structural persistence versus same-day callout freshness policy.
- SPX/ES and QQQ/NQ confluence equivalence/basis policy.
- Live execution environment proof.

## 8. Do Not Approve For Live Yet
- Do not approve live execution.
- Do not approve autonomous self-driving.
- Do not approve Tradovate live data readiness without credentialed market-hours proof.
- Do not approve Saty auto-generation as production truth until parity fixture is signed off.
- Do not approve implicit SPX-to-ES or QQQ-to-NQ current-price substitution.
- Do not approve Dubz carry-forward policy until trader signs off.

## 9. Safe To Review / Merge Now
- Decision spine architecture and tests.
- `/entries ES` spine wiring.
- Operator-v2 read-only mirror and APIs.
- Market-data UNKNOWN/stale/delayed safety behavior.
- Bobby duplicate idempotency.
- Proof/session tooling.
- Artifact ignore and state path normalization, with focused review.

## 10. Reviewer Questions
SWE:
- Is the decision-spine API shape stable enough for all consumers?
- Are provider failures contained without throwing actionable trade plans?
- Are proof scripts acceptably read-only aside from ignored artifacts and normal `/chat` test ingestion?
- Is state path normalization too broad for this PR, or acceptable as a separate patch group?
- Are there import cycles or server startup risks around the new adapters?

Trader:
- Confirm Saty ATR source-of-truth and expected parity fixture.
- Confirm SPX/ES and QQQ/NQ confluence equivalence/basis policy.
- Confirm Dubz structural persistence versus same-day callout freshness.
- Confirm whether Bobby heatmap actionability should be required for all staged trades.
- Confirm whether current PASS/WAIT wording is clear enough for live use.
