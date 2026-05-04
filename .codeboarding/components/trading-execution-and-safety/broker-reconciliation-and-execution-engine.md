---
component_id: 5.1
component_name: Broker Reconciliation & Execution Engine
---

# Broker Reconciliation & Execution Engine

## Component Description

The core operational component responsible for synchronizing local trade state with the Tradovate broker. It fetches live positions and orders, reconciles them against internal memory, and manages the transition of trades from staged to executed status.

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

### c:\Users\conor\luke\trading\metrics.js (lines 174-203)
```
function buildTextSummary(m) {
  const lines = [
    `Luke 02B metrics — last ${m.range_hours}h (since ${m.since.slice(0, 16).replace("T", " ")} UTC):`,
    `Signals evaluated: ${m.signals_evaluated} | Staged: ${m.signals_staged}`,
  ];

  const rejectTotal = Object.values(m.rejects_by_reason).reduce((a, b) => a + b, 0);
  if (rejectTotal > 0) {
    const parts = Object.entries(m.rejects_by_reason).map(([k, v]) => `${k}×${v}`);
    lines.push(`Gate rejections: ${rejectTotal} (${parts.join(", ")})`);
  } else {
    lines.push("Gate rejections: 0");
  }

  lines.push(
    `Paper trades — opened: ${m.paper_trades_opened}, closed: ${m.paper_trades_closed}`,
    `Paper P&L — total: $${m.paper_pnl_total}, avg/trade: $${m.paper_pnl_avg_per_trade}`,
  );

  if (m.avg_time_to_protection_confirmed_ms !== null)
    lines.push(`Avg time entry→protected: ${(m.avg_time_to_protection_confirmed_ms / 1000).toFixed(1)}s`);

  lines.push(
    `Reconcile mismatches: ${m.reconciliation_mismatches_count}`,
    `Scheduler failed jobs: ${m.scheduler_jobs_failed_count}`,
    `Critical events: ${m.critical_events.length}${m.critical_events.length > 0 ? " — " + m.critical_events.map(e => e.type).join(", ") : ""}`,
  );

  return lines.join("  |  ");
}
```


## Source Files:

- `trading\broker-tradovate.js`
- `trading\metrics.js`

