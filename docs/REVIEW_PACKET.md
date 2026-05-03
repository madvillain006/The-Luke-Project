# Senior SWE + Trader Review Packet

## 1. Review Order
1. Saty/Yahoo provider fallback.
2. Dubz carry-forward policy.
3. Root cleanup / legacy-root archive.
4. Decision spine + entries.
5. Market-data abstraction.
6. Autonomous recommendation-only gating.
7. Operator-v2 read-only shell/API.
8. Parser/input hardening.
9. Proof/session tools.
10. Historical replay proof command.
11. Staged-flow proof command.
12. Local brain agent reporting.

## 2. Product Summary
Luke trading is packaged as a confluence/confidence trading companion plus a separate explicit staged execution path. Manual `/entries ES`, operator APIs, and `/operator-v2` reflect the same decision spine. Autonomous evaluation is currently recommendation-only through Luke chat; it does not stage or execute. Live execution is not environment-proven yet.

## 3. Critical Safety Invariants
- No production fake/static current-price assumptions.
- UNKNOWN/missing/stale market data must produce WAIT/PASS/non-actionable state.
- Latest-close/weekend/fallback data must be labeled stale/delayed/reference.
- SPX/ES and QQQ/NQ are confluence-only references, not silent current-price substitutes.
- `buildTradeDecision(...)` is the authority for entries-style decisions.
- Bobby-style heatmap/actionability is required before a trade plan becomes actionable.
- `/operator-v2` is read-only and not the default shell.
- Autonomous evaluation is recommendation-only through Luke chat.
- Any staged execution remains separate, explicit, and confirmation-gated.
- No direct execution shortcut or operator-v2 execute button.
- Risk/Apex/open-position/pending-signal/kill/trading-window gates remain preserved.
- Mancini chop zones are veto/avoid/pass logic, not entries.

## 4. What Changed
- Saty auto-generation now uses Polygon/Massive when configured, then Yahoo `^GSPC` fallback.
- Saty day-mode 13-level coefficient parity is tested against the supplied Pine formula.
- Dubz structural levels now carry forward until manually replaced/deleted.
- Same-day callouts are treated separately from Dubz structural levels and expire same day.
- Legacy root docs moved to `docs/legacy-root/`.
- Duplicate/generated root files removed so root shows only live app/config entrypoints.
- Corrupted Dubz status glyphs replaced with ASCII live output.
- Added controlled paper/shadow staged-flow proof command.
- Routed stage/execution messages to plain ASCII safety wording.
- Added historical decision-spine replay over local ES minute bars plus Saty, Mancini, Bobby text, and cached Bobby image parses.
- Demoted autonomous evaluation from staging to recommendation-only Luke chat output.
- Decision spine, operator-v2, market data, proof tools, and idempotency work remain from the prior review package.

## 5. Inspect First
- `lib/saty-auto-pull.js`
- `lib/market-data/providers/yahoo.js`
- `tests/saty-auto-pull.test.js`
- `lib/decision-spine/index.js`
- `lib/parse-dubz.js`
- `tests/decision-spine.test.js`
- `tests/slash-commands.test.js`
- `scripts/prove-staged-flow.js`
- `scripts/replay-decision-spine-history.js`
- `scripts/run-operator-session.js`
- `trading/router.js`
- `agents/agent-00-brain.js`
- `brain-dashboard.html`
- `luke-shell.html`
- `docs/legacy-root/`
- root deletions in `git status --short`

## 6. Commands To Run
- `npm test`
- `npm run prove:operator-v2`
- `npm run session:operator-v2`
- `npm run market:data:test`
- `npm run replay:history`
- `npm run prove:staged-flow`
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

## 7. Known Unproven Areas
- Tradovate live market data.
- Futures-grade live provider behavior beyond Yahoo/Finnhub fallback/reference data.
- Live actionable LONG/SHORT with real current price.
- Live autonomous chat recommendation from real evaluation. Current posture is recommendation-only.
- Manual pending staged signal during market-hours paper/shadow proof. Controlled route proof exists.
- Live execution environment proof.

## 8. Do Not Approve For Live Yet
- Do not approve live execution.
- Do not approve autonomous self-driving.
- Do not approve autonomous staging; current autonomous posture is recommendation-only chat output.
- Do not approve Tradovate live data readiness without credentialed market-hours proof.
- Do not approve implicit SPX-to-ES or QQQ-to-NQ current-price substitution.
- Do not approve stale/latest-close data as live.

## 9. Safe To Review / Merge Now
- Saty formula implementation and provider fallback behavior.
- Dubz structural carry-forward behavior.
- Root cleanup if reviewers accept duplicate/generated root file removal.
- Decision spine architecture and tests.
- `/entries ES` spine wiring.
- Operator-v2 read-only mirror and APIs.
- Market-data UNKNOWN/stale/delayed safety behavior.
- Bobby duplicate idempotency.
- Proof/session tooling.
- Paper/shadow staged-flow route proof.
- Historical decision-spine replay against local ES minute bars and analyst corpus.
- Autonomous recommendation-only routing.
- Mancini chop-zone veto observation through automated session.

## 10. Reviewer Questions
SWE:
- Are root deletions safe given duplicate live files under `scripts/` and structured runtime paths?
- Are provider failures contained without throwing actionable trade plans?
- Is Yahoo fallback correctly labeled as fallback/stale/reference rather than authoritative futures truth?
- Are proof scripts acceptably read-only aside from ignored artifacts and normal `/chat` test ingestion?
- Is `scripts/prove-staged-flow.js` acceptable as route-level proof with state backup/restore?
- Is `scripts/replay-decision-spine-history.js` acceptable as historical proof with temp Level Memory and state backup/restore?
- Are there import cycles or server startup risks around the adapters?
- Does `/` still serving `chat.html` while `/shell` hosts the broader shell preserve the current operator workflow?

Trader:
- Confirm generated Saty levels match the expected TradingView script output in a live session.
- Confirm PASS/WAIT wording is clear enough when latest-close data is stale.
- Confirm Bobby/Jefe/Katbot heatmap actionability requirement is strict enough in `/entries` and autonomous recommendations.
- Confirm Dubz/Mancini carry-forward display is operationally clear.
