# Live Blockers

## Classification Summary
- Code-fixable now: none known.
- Environment/provider proof: blockers 1, 2, 4.
- Live-market observation required: blocker 3.
- Human/trader design choice: none currently blocking code review.

## 1. Tradovate Live Market Data Not Proven
- Why it matters: ES/MES/NQ/MNQ need futures-appropriate live quotes for live trading confidence.
- File/module: `lib/market-data/providers/tradovate.js`, `lib/market-data/index.js`, `trading/market-context.js`.
- Required fix: configure Tradovate credentials/market-data subscription and run market-hours proof.
- Blocks code review: no.
- Blocks trading companion: no, if UNKNOWN/PASS behavior is accepted.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: environment/provider proof.

## 2. Non-Tradovate Provider Is Fallback/Reference Only
- Why it matters: Yahoo/Finnhub fallback currently returns stale/delayed latest-close/reference data, not authoritative live futures truth.
- File/module: `lib/market-data/providers/yahoo.js`, `lib/market-data/providers/polygon.js`, `scripts/verify-market-data.js`, `lib/saty-auto-pull.js`.
- Required fix: keep fallback clearly labeled; use Tradovate or another futures-grade provider before live execution confidence.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: no.
- Blocks live execution: yes.
- Type: provider limitation.

## 3. Pending Staged Signal / Active Chop Veto Not Naturally Observed
- Why it matters: staging path and chop veto are covered by tests, but live proof needs observed market/session states.
- File/module: `trading/router.js`, `scripts/run-operator-session.js`, `lib/decision-spine/index.js`.
- Required fix: market-hours or controlled paper/shadow session that naturally produces aligned staging and active veto cases without executing live.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: partially.
- Blocks live execution: yes.
- Type: live-market observation required.

## 4. Live Execution Not Environment-Proven
- Why it matters: modules exist, but no live Tradovate execution should be assumed from unit tests.
- File/module: `trading/execution-live.js`, `trading/broker-tradovate.js`, `trading/router.js`.
- Required fix: paper/shadow drill first; live remains credentialed, explicit-confirmation gated, and separate.
- Blocks code review: no.
- Blocks trading companion: no.
- Blocks staged bot: no for staging/paper/shadow.
- Blocks live execution: yes.
- Type: environment plus safety/policy.

## Resolved By Current Goal-Mode Inputs
- Saty source: user supplied Pine source-of-truth; tests now cover the 13 stored day-mode coefficients against that formula.
- SPX/ES and QQQ/NQ policy: confluence-only reference; no silent price substitution.
- Dubz/Mancini policy: structural levels carry forward until manually replaced/deleted; same-day callouts expire same day.
- Bobby/Katbot/Jefe heatmap policy: Bobby-style heatmap/actionability remains required before trade plans are actionable.
