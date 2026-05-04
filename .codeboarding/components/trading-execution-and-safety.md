---
component_id: 5
component_name: Trading Execution & Safety
---

# Trading Execution & Safety

## Component Description

Manages trade lifecycle including order reconciliation with Tradovate broker and risk management. Includes Chaos Engineering module for fault injection to ensure graceful recovery.

---

## Key References:

### c:\Users\conor\luke\trading\broker-tradovate.js (lines 66-105)
```
async function reconcileState(state) {
  const creds = state.tradovate;
  if (!creds || !creds.username || !creds.cid || !creds.sec) {
    return { ok: false, configured: false, critical: true, reason: "Tradovate credentials not configured" };
  }

  const [accounts, positions, orders] = await Promise.all([
    getAccounts(creds),
    listPositions(creds).catch(() => []),
    listOrders(creds).catch(() => []),
  ]);

  const accountCount = Array.isArray(accounts) ? accounts.length : 0;
  const openPositions = Array.isArray(positions)
    ? positions.filter(p => Number(p.netPos || p.netPosition || p.position || 0) !== 0)
    : [];
  const workingOrders = Array.isArray(orders)
    ? orders.filter(o => {
        const text = String(o.ordStatus || o.orderStatus || o.status || "").toLowerCase();
        return text.includes("working") || text.includes("open") || text.includes("pending");
      })
    : [];

  const mismatches = [];
  if (state.open_position && openPositions.length === 0) mismatches.push("Local state shows open position but broker shows none");
  if (!state.open_position && openPositions.length > 0) mismatches.push("Broker shows open position but local state is flat");
  if (state.open_position && state.open_position.mode === "live" && workingOrders.length === 0) {
    mismatches.push("Live position has no visible working protection orders");
  }

  return {
    ok: mismatches.length === 0,
    configured: true,
    critical: mismatches.length > 0,
    account_count: accountCount,
    open_positions: openPositions.length,
    working_orders: workingOrders.length,
    mismatches,
  };
}
```


## Source Files:

- `fault-injection\01-corrupt-trading-snapshot.js`
- `fault-injection\02-delete-trading-snapshot.js`
- `fault-injection\03-tradovate-auth-failure.js`
- `fault-injection\04-entry-confirmed-protection-fails.js`
- `fault-injection\05-scheduler-job-fails-3x.js`
- `fault-injection\06-stale-pending-signal.js`
- `fault-injection\07-broker-says-position-local-says-flat.js`
- `fault-injection\08-kill-during-staged-execution.js`
- `fault-injection\09-luke-med-out-of-order.js`
- `fault-injection\10-panic-during-active-trade.js`
- `fault-injection\_lib.js`
- `trading\broker-tradovate.js`
- `trading\metrics.js`
- `trading\router.js`

