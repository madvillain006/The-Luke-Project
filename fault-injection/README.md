# Fault Injection — Luke

Proves Luke fails safely. Each script runs against a live local server on `localhost:3000`.

## Prerequisites

```
node index.js &         # Luke must be running
# Do NOT set NODE_ENV=production — test hooks require it unset
```

Scripts 04, 06, 07, 08, 10 use `/_test/*` hooks added to `trading/router.js` (guarded by `NODE_ENV !== "production"`).

## Run

```
node fault-injection/NN-name.js
```

Exit code 0 = PASS. Exit code 1 = FAIL (with reason). Exit code 2 = Luke not running.

---

## Scenarios

| # | Script | What it does | Expected PASS behavior |
|---|--------|-------------|----------------------|
| 01 | `01-corrupt-trading-snapshot.js` | Writes malformed JSON to `state/snapshots/trading-state.json` | Recovery logged as `TRADING_STATE_INITIALIZED` or `TRADING_STATE_RECOVERED_FROM_LEGACY`; status endpoint still returns valid JSON |
| 02 | `02-delete-trading-snapshot.js` | Deletes the snapshot file | Falls back to legacy file or defaults; recovery event logged in `trading-events.jsonl` |
| 03 | `03-tradovate-auth-failure.js` | Sets bad Tradovate credentials, calls test-connection | Returns `connected:false` — not silent success |
| 04 | `04-entry-confirmed-protection-fails.js` | Simulates entry-confirmed → protection retries × 2 → emergencyFlatten (both success and failure paths) | Retry events logged, correct phase set, `execution_blocked=true`; flatten failure sets `critical_mismatch=true` |
| 05 | `05-scheduler-job-fails-3x.js` | Injects a job with 3 failures and 48h-old last run into `scheduler-jobs.json` | `/scheduler/status` returns `state=failed`, `stale=true` for that job |
| 06 | `06-stale-pending-signal.js` | Injects a pending signal that expired 60 seconds ago | `/pending` returns `{ pending:false, reason:"expired" }`; `pending_signal` cleared from state |
| 07 | `07-broker-says-position-local-says-flat.js` | Synthetic broker reconcile with phantom position, local state flat | `ok:false`, `critical:true`, mismatch message present — no silent pass |
| 08 | `08-kill-during-staged-execution.js` | Stages a trade, fires kill switch, calls execute-staged | `execute-staged` returns `executed:false`; `kill_day=true`; `pending_signal=null` |
| 09 | `09-luke-med-out-of-order.js` | Logs Mirtazapine+Prednisone without prior Omeprazole | **Currently FAILS** — `persistLukeEntry` only checks `meds.includes("combined")`, has no same-day ordering check. Fix: track today's med sequence and reject Mirt+Pred if Omeprazole not logged first today |
| 10 | `10-panic-during-active-trade.js` | Opens a paper position, triggers `/panic` | `panic-dump-*.json` created with memory snapshot; `ok:true` returned; 02B kill sent |

---

## Notes

- Scripts restore state on exit (via `finally` blocks). If a script crashes mid-run, call `POST /agent/autonomous/reset-kill` and `POST /agent/autonomous/clear-critical` manually.
- Scenario 03 will overwrite Tradovate credentials with a bad test set. If you have real creds configured, restore them after with `POST /agent/autonomous/set-mode`.
- Scenario 09 will write two real Luke log entries (test data). Remove from `luke-log.jsonl` if needed.
