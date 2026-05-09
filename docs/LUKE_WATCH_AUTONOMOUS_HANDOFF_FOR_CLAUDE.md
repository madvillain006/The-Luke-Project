# Luke Watch Autonomous Handoff for Claude

This is the handoff package for the final broker-adapter step. It intentionally stops before live order submission. The goal is to give Claude a clean, testable boundary: Luke Watch produces a candidate, the dry-run safety layer validates it, and only a separately implemented broker adapter can turn the validated intent into live orders.

## Current Files

- `tradingview/history/production-ledger/luke-watch-production-test.pine`
  - Chart-facing indicator.
  - Realistic accounting default: `entry_only_0_25`.
  - Shows LONG entry boxes and per-trade result lines.
  - Does not submit orders.

- `tradingview/history/production-ledger/luke-watch-production-test-simulation.strategy.pine`
  - TradingView Strategy Tester version.
  - Emits `strategy.entry` / `strategy.exit` broker-emulator orders only.
  - Alerts are explicitly non-executable.
  - Not a broker bridge and not a webhook order script.

- `artifacts/tradingview/luke-watch-production-test.generated.pine`
  - Paste-ready generated production-test indicator after `npm run tradingview:export-levels`.

- `artifacts/tradingview/luke-watch-production-test-simulation.generated.strategy.pine`
  - Paste-ready generated Strategy Tester script after `npm run tradingview:export-levels`.

- `trading/luke-watch-safety-checks.js`
  - Broker-agnostic dry-run safety layer.
  - Validates signal payloads, idempotency, account rules, and risk limits.
  - Returns `can_submit_live: false`.
  - Does not call broker APIs.

- `tests/luke-watch-safety-checks.test.js`
  - Tests the handoff safety layer.

## What Claude Gets

Claude should receive:

1. `trading/luke-watch-safety-checks.js`
2. `tests/luke-watch-safety-checks.test.js`
3. `tradingview/history/production-ledger/luke-watch-production-test-simulation.strategy.pine`
4. this document
5. the selected broker API documentation

Public API docs are here: <https://public.com/api/docs/templates>. Confirm instrument support before using Public for this project. Luke Watch has been built around ES/MES futures behavior, while the Public templates shown there focus on stocks, options, crypto, bonds, and shorts.

## Required Live-Adapter Boundary

Claude’s live adapter must be a new file/module. It should not be mixed into the Pine files.

The adapter must call:

- `validateLukeWatchSignal(signal, options)`
- `validateDuplicateSignal(signal, seenKeys)`
- `evaluateRiskEnvelope(signal, context, policy)`
- `buildDryRunAutomationPlan(signal, context, policy)`

No broker preflight or order placement should happen unless the dry-run plan says `ok_for_handoff: true`.

## Required Safety Checks

The final live adapter must reject:

- missing signal id
- duplicate signal id
- unconfirmed signal
- stale signal
- future timestamp
- non-ES/MES symbol unless deliberately expanded
- non-LONG direction unless deliberately expanded
- non-tick-aligned entry, stop, TP1, or TP2
- long stop not below entry
- TP1 not above entry
- TP2 below TP1
- watch-only signal
- open local position
- broker position mismatch
- daily kill switch active
- weekly kill switch active
- max contract size breach
- per-trade risk breach
- 50K DLL breach risk
- max loss limit breach risk
- missing broker preflight approval
- missing protection order after entry
- reconnect/restart without reconciliation

## Account Rules Encoded

The safety module currently encodes:

- `25K_EVAL`: profit target `$1,250`, max loss `$1,000`, no DLL, max `2` mini contracts.
- `50K_EVAL`: profit target `$3,000`, max loss `$2,000`, DLL `$1,200`, max `4` mini contracts.
- `25K_FUNDED`: payout target `$250`, max loss `$1,000`, no DLL, consistency `40%`, max `2` mini contracts.
- `50K_FUNDED`: payout target `$500`, max loss `$2,000`, DLL `$1,200`, consistency `40%`, max `4` mini contracts.

These targets do not need to be reached in one day. The safety layer treats them as account constraints, not one-day goals.

## Expected Signal Shape

The final alert/webhook parser should normalize into this internal shape before any broker-specific code:

```json
{
  "signal_id": "luke-watch-2026-05-05T11:00:00Z-7252_50",
  "source": "luke_watch_production_test",
  "symbol": "ESM2026",
  "direction": "LONG",
  "timestamp": "2026-05-05T11:00:00.000Z",
  "confirmed_bar": true,
  "entry": 7253.0,
  "stop": 7249.5,
  "tp1": 7254.75,
  "tp2": 7260.0,
  "level_cluster": 7252.5,
  "accounting_mode": "entry_only_0_25",
  "contracts": 1
}
```

This is an internal intent object, not a broker payload.

## Final Adapter Requirements

The final adapter must implement, in this order:

1. Parse alert into the normalized signal shape.
2. Validate the signal with `trading/luke-watch-safety-checks.js`.
3. Load durable idempotency state and reject duplicates.
4. Load current local position state.
5. Query broker account state.
6. Query broker current positions.
7. Query broker working orders.
8. Reject any local/broker mismatch.
9. Run broker-side preflight.
10. Place entry only if protection can be attached immediately after fill.
11. Persist broker ack/order ids.
12. Submit protective stop/target bracket.
13. Reconcile entry plus protection.
14. Block further action if protection is missing.
15. Continue polling until flat.
16. Persist final outcome.

## Commands

Generate paste-ready TradingView files:

```powershell
npm run tradingview:export-levels
```

Copy the simulation strategy to clipboard:

```powershell
Get-Content -Raw .\artifacts\tradingview\luke-watch-production-test-simulation.generated.strategy.pine | Set-Clipboard
```

Run focused safety/export tests:

```powershell
cmd /c npx vitest run tests/luke-watch-safety-checks.test.js tests/tradingview-level-export.test.js
```

## Claude Stop Point

Claude should start from the dry-run plan and implement the broker-specific adapter after these checks. The first live-capable line should be isolated in the new adapter, covered by tests, gated by environment/config, and reviewed before use.
