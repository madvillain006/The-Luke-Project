# Review Patch Plan

Review order: Saty/Yahoo fallback, Dubz carry-forward, root cleanup, decision spine, market data, autonomous gating, staged-flow proof, operator surfaces, parser hardening, state paths, proof tools, docs.

## 1. Decision Spine + Entries
- Purpose: make `/entries ES` consume one shared decision authority.
- Files included: `lib/decision-spine/`, `lib/commands/entries-command.js`, `lib/renderers/entries-renderer.js`, `lib/slash-commands.js`, `tests/decision-spine*.test.js`, `tests/slash-commands.test.js`.
- Risk level: high.
- Why necessary: removes split-brain between manual entries and older signal scoring.
- Behavior changes: `/entries ES` is rendered from `buildTradeDecision(...)`; refusal/chop/freshness behavior is preserved.
- Must not change: stale refusal, Mancini vetoes, sizing semantics, Level Memory inputs.
- Tests: `npm test`, decision-spine regression tests, slash-command tests.
- Manual/proof command: `npm run prove:operator-v2`, `npm run session:operator-v2`.
- Reviewer focus: `lib/decision-spine/index.js`, renderer output parity, freshness blockers.
- Known limitations: live actionable price not observed with current provider failures.
- Independent: mostly yes.
- Depends on: market-data metadata for live/current price truth.

## 2. Autonomous Spine Gating
- Purpose: make autonomous staging follow the spine instead of competing with it.
- Files included: `trading/router.js`, `trading/signals.js`, `trading/risk.js`, autonomous regression tests.
- Risk level: high.
- Why necessary: keeps `scoreSignals(...)` as candidate proposer while the spine remains authority.
- Behavior changes: candidate/spine disagreement and bad entry distance block staging.
- Must not change: staged-only behavior, risk gates, confirmation route, kill/open/pending checks.
- Tests: autonomous preflight/alignment tests in `tests/decision-spine-regression.test.js`.
- Manual/proof command: `npm run session:operator-v2` verifies Mancini chop veto observation; `npm run prove:staged-flow` verifies paper/shadow execute-staged routing.
- Reviewer focus: `buildAutonomousPreflight`, evaluate path, `/execute-staged` remains explicit.
- Known limitations: pending staged signal not naturally observed.
- Independent: partially.
- Depends on: decision spine.

## 3. Operator V2 Read-Only Shell
- Purpose: provide a visible read-only operator console that mirrors trusted backend truth.
- Files included: `operator-v2.html`, `lib/operator/`, `index.js`, `chat.html`, operator tests.
- Risk level: medium.
- Why necessary: makes status/readiness/decision/confluence readable without replacing old shell.
- Behavior changes: adds `/operator-v2` and read-only API routes.
- Must not change: `/` default chat shell, slash commands, state writes, execution flow.
- Tests: `tests/operator-v2-ui.test.js`, `tests/operator-api-adapters.test.js`.
- Manual/proof command: `npm run prove:operator-v2`, `npm run session:operator-v2`.
- Reviewer focus: no client-side decision computation, PASS is non-actionable, no execute button.
- Known limitations: mirror only; not a control surface.
- Independent: yes.
- Depends on: decision spine and market-data adapters.

## 4. Market-Data Abstraction
- Purpose: replace static price assumptions with structured provider truth.
- Files included: `lib/market-data/`, `lib/live-price.js`, `trading/market-context.js`, `lib/saty-auto-pull.js`, `lib/system-prompt.js`, `tests/market-data.test.js`, `tests/saty-auto-pull.test.js`, `scripts/verify-market-data.js`.
- Risk level: high.
- Why necessary: Luke must not use fake ES/SPX/NQ/MES/MNQ prices.
- Behavior changes: provider failure returns `UNKNOWN`; stale/delayed/latest-close metadata is explicit.
- Must not change: confluence scoring formula or strategy decisions except fake-price removal.
- Tests: `tests/market-data.test.js`.
- Manual/proof command: `npm run market:data:test`.
- Reviewer focus: provider priority, UNKNOWN handling, no SPX-to-ES silent substitution.
- Known limitations: current environment lacks Tradovate proof; Yahoo fallback requires network access and is stale/reference when market is closed.
- Independent: mostly.
- Depends on: operator and autonomous adapters for display.

## 5. Parser / Input Hardening
- Purpose: protect analyst ingestion contracts without changing strategy.
- Files included: `lib/bobby-heatmap-idempotency.js`, `lib/parse-bobby.js`, `lib/parse-dubz.js`, `lib/level-memory.js`, `tests/bobby-heatmap-idempotency.test.js`, `tests/level-memory-contract.test.js`, `tests/slash-commands.test.js`.
- Risk level: medium.
- Why necessary: duplicate Bobby input must not inflate Level Memory or alter decisions.
- Behavior changes: identical Bobby heatmap text/image is idempotent; Dubz structural levels carry forward until manually replaced/deleted.
- Must not change: parser strategy, Level Memory schema, confluence formula.
- Tests: Bobby idempotency, Level Memory contract, Dubz status, and decision-spine freshness tests.
- Manual/proof command: `npm run session:operator-v2`.
- Reviewer focus: source-id hashing, duplicate handling, fixture coverage.
- Known limitations: vision provider behavior still depends on external image parse path.
- Independent: yes.
- Depends on: Level Memory current schema.

## 6. State Path Normalization
- Purpose: move runtime/event/snapshot writes out of root and into structured paths.
- Files included: `lib/paths.js`, affected agents, scheduler, logger/memory/actions, `state/trading-store.js`, `.gitignore`, copied helper scripts under `scripts/`.
- Risk level: medium.
- Why necessary: reduces root dirty-state artifacts and makes generated files ignorable.
- Behavior changes: runtime writes go to `state/events`, `state/snapshots`, or `state/runtime`.
- Must not change: command behavior, trading state semantics, execution gates.
- Tests: full `npm test`, app/session proof.
- Manual/proof command: `npm run session:operator-v2`.
- Reviewer focus: path compatibility, no lost required boot files, no source files ignored.
- Known limitations: broad adjacent slice; inspect separately.
- Independent: partly.
- Depends on: none.

## 7. Proof / Verification Tools
- Purpose: make old shell/API/operator-v2 and market-data checks repeatable.
- Files included: `scripts/prove-operator-v2.js`, `scripts/prove-staged-flow.js`, `scripts/run-operator-session.js`, `scripts/compare-operator-surfaces.js`, `scripts/verify-market-data.js`, related tests, `package.json`.
- Risk level: low.
- Why necessary: reviewers can rerun claims without manual paste testing.
- Behavior changes: none in production.
- Must not change: trading state or execution paths.
- Tests: operator comparison tests plus npm scripts.
- Manual/proof command: all proof scripts, including `npm run prove:staged-flow`.
- Reviewer focus: scripts are read-only except ignored artifact reports/screenshots.
- Known limitations: session proof mutates normal local analyst state through `/chat` test inputs.
- Independent: yes.
- Depends on: app can start locally.

## 8. Review Docs
- Purpose: provide concise review entrypoints and honest blockers.
- Files included: `docs/REVIEW_PACKET.md`, `docs/REVIEW_PATCH_PLAN.md`, `docs/REVIEW_READINESS.md`, `docs/LIVE_BLOCKERS.md`, `docs/GOAL_MODE_PROGRESS.md`.
- Risk level: low.
- Why necessary: separates code-fixable work from environment/human proof.
- Behavior changes: none.
- Must not change: docs must not claim live readiness without proof.
- Tests: n/a.
- Manual/proof command: n/a.
- Reviewer focus: consistency with code and test results.
- Known limitations: live proof blockers remain.
- Independent: yes.
- Depends on: all groups for accuracy.

## 9. Cleanup / Artifact Ignore
- Purpose: keep generated proof output out of review and make the repo root inspectable.
- Files included: `.gitignore`, ignored `artifacts/` generated files, `docs/legacy-root/`, root duplicate/generated file removals.
- Risk level: low.
- Why necessary: screenshots/proof markdown should not dirty the repo, and root should not mix live entrypoints with old notes/generated runtime state.
- Behavior changes: root launch/helper duplicates are removed; live copies under `scripts/` and structured runtime paths remain.
- Must not change: do not ignore real source, tests, intended docs, or boot-critical files.
- Tests: `git status --short`, full `npm test`, proof/session commands.
- Manual/proof command: proof scripts write to ignored `artifacts/`.
- Reviewer focus: root deletion list, duplicate script coverage under `scripts/`, ignore patterns are scoped.
- Known limitations: local `.config/git/ignore` permission warning is environmental.
- Independent: yes.
- Depends on: proof scripts.

## REVIEW_NEEDS_ATTENTION
- Root cleanup intentionally includes tracked deletions. Review these as cleanup-only, not trading behavior.
- No ungrouped files are known after the final status check.
