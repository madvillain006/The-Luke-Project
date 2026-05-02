# Live Blockers

## Classification Summary
- Code-fixable now: none known.
- Environment/provider proof: blockers 1, 2, 6.
- Human/trader design choice: blockers 3, 4, 5.
- Live-market observation required: blocker 7.
- Safety/policy blocker: blocker 6.

## 1. Tradovate Live Market Data Not Proven
- Why it matters: ES/MES/NQ/MNQ need futures-appropriate live quotes for live trading confidence.
- File/module: `lib/market-data/providers/tradovate.js`, `trading/market-context.js`.
- Required fix: configure Tradovate credentials/market-data subscription and run market-hours proof.
- Blocks code review: no.
- Blocks trading companion: no, if UNKNOWN/PASS behavior is accepted.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: environment/provider proof.

## 2. Provider Fallbacks Currently Return UNKNOWN In This Environment
- Why it matters: safe UNKNOWN is correct, but it cannot prove latest-close fallback behavior.
- File/module: `lib/market-data/`, `scripts/verify-market-data.js`.
- Required fix: run verification with network/provider access available.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: no.
- Blocks live execution: yes.
- Type: environment/provider proof.

## 3. Saty ATR Auto-Generation Needs Parity Proof
- Why it matters: existing code derives Saty-like levels, but live use needs known-output parity against the trusted Saty source.
- File/module: `lib/saty-auto-pull.js`, `lib/backtest-data/saty-historical.js`, `lib/saty-levels.js`.
- Required fix: compare generated levels against a known Saty output fixture for the same session.
- Blocks code review: no.
- Blocks trading companion: no if manual `/saty` remains used.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: human/trader design choice plus fixture.

## 4. SPX/ES And QQQ/NQ Equivalence Needs Trader Signoff
- Why it matters: confluence mapping is not the same as current-price substitution and must stay explicit.
- File/module: `lib/confluence-engine.js`, `tests/confluence-engine.test.js`.
- Required fix: trader-approved equivalence/basis policy and examples.
- Blocks code review: no.
- Blocks trading companion: no if labeled as confluence equivalence.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: human/trader design choice.

## 5. Dubz Persistence/Freshness Policy Needs Signoff
- Why it matters: Dubz structural levels may persist, while callouts are time-sensitive.
- File/module: `lib/parse-dubz.js`, `lib/decision-spine/index.js`, `lib/operator/ingestion-status-adapter.js`.
- Required fix: confirm trader policy for structural carry-forward versus same-day callout freshness.
- Blocks code review: no.
- Blocks trading companion: partially.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: human/trader design choice.

## 6. Live Execution Not Environment-Proven
- Why it matters: modules exist, but no live Tradovate execution should be assumed from unit tests.
- File/module: `trading/execution-live.js`, `trading/broker-tradovate.js`, `trading/router.js`.
- Required fix: paper/shadow drill, then credentialed sandbox/live micro proof with explicit confirmation and risk gates visible.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: no for staging only.
- Blocks live execution: yes.
- Type: environment plus safety/policy.

## 7. Pending Staged Signal / Active Chop Veto Not Naturally Observed
- Why it matters: staging path and chop veto are covered by tests, but live proof needs an observed market/session state.
- File/module: `trading/router.js`, `scripts/run-operator-session.js`, `lib/decision-spine/index.js`.
- Required fix: market-hours or controlled paper/shadow session that naturally produces aligned staging and active veto cases without executing.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: live-market observation required.
