# Luke Broker Automation Audit

This audit covers the files Claude will need to inspect before implementing the final live adapter. No live trading behavior was changed here.

## Existing Live-Capable Surfaces

- `trading/router.js`
  - Contains staged execution route logic.
  - Has live-mode gates through `getLiveExecutionGate()`.
  - Calls `executeLive()` only after staged execution gate, live gate, and reconciliation pass.

- `trading/execution-live.js`
  - Contains Tradovate entry and protection submission logic.
  - Uses market entry, then submits protection separately.
  - If protection fails, it hard-blocks and requires manual flatten.

- `trading/broker-tradovate.js`
  - Contains Tradovate auth, account/contract lookup, positions/orders listing, reconcile helpers, and emergency flatten.

- `trading/execution-paper.js`
  - Paper mode only.
  - Tracks local open position and closes from observed price crossing stop/target.

- `trading/luke-watch-safety-checks.js`
  - New dry-run safety layer for Luke Watch handoff.
  - No broker calls.
  - Should be called before any final live adapter.

## Main Risks To Fix Before Any Live Use

- Entry and protection are separated.
  - A live adapter must prove protection exists after entry fill.
  - If protection cannot be attached, it must block and reconcile immediately.

- Duplicate alert handling must be durable.
  - In-memory duplicate checks are not enough.
  - Signal ids must persist across process restart.

- Broker/local reconciliation must run before and after every order action.
  - Start/reconnect/retry paths must not assume local state is correct.

- Strategy signal timing can diverge from broker fill timing.
  - TradingView Strategy Tester fills are not live queue fills.
  - Same-bar TP/stop order cannot be proven from 1m OHLC.

- Account rules must be constraints, not daily targets.
  - 25K/50K eval/funded profit targets do not need to be reached in one day.
  - DLL and max loss limit are the real hard risk constraints.

- Public API instrument support must be confirmed.
  - The Public templates cover stocks/options/crypto/bonds/shorts.
  - Luke Watch is ES/MES futures-oriented.
  - If Public cannot route ES/MES futures, use a futures-capable adapter target.

## Minimum Live-Adapter Test Matrix

- Reject stale signal.
- Reject future signal.
- Reject duplicate signal id.
- Reject non-confirmed signal.
- Reject invalid stop/target ordering.
- Reject non-tick-aligned levels.
- Reject position already open.
- Reject broker position mismatch.
- Reject working-order mismatch.
- Reject max-contract breach.
- Reject per-trade risk breach.
- Reject 50K DLL breach risk.
- Reject account max-loss breach risk.
- Reject missing broker preflight approval.
- Reject entry if bracket/protection cannot be confirmed.
- Block on reconnect until broker/local reconciliation succeeds.
- Do not resend on process restart.

## Safe Handoff Status

Current status: handoff-ready for a separate live-adapter implementation.

What is done:

- Chart indicator exists.
- Strategy Tester version exists.
- Generated TradingView artifacts are exportable.
- Dry-run safety validator exists.
- Tests cover the validator and generated strategy classification.

What remains for Claude:

- Select broker target.
- Confirm instrument support.
- Implement broker-specific preflight.
- Implement broker-specific order placement.
- Implement broker-specific cancel/replace/flatten/reconcile.
- Add durable idempotency storage.
- Add integration tests with mocked broker responses.
- Run a paper/sandbox-only burn-in before any real money.
