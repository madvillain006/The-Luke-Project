---
component_id: 5.3
component_name: Chaos Engineering & Resilience Suite
---

# Chaos Engineering & Resilience Suite

## Component Description

A specialized testing harness that simulates system failures, such as corrupted snapshots or broker-local state mismatches. It uses a dedicated utility library to manipulate the trading environment and verify that the system's recovery logic functions as expected.

---

## Key References:

### c:\Users\conor\luke\fault-injection\_lib.js (lines 12-34)
```
function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "localhost", port: 3000,
      path: endpoint, method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch   { resolve({ status: res.statusCode, body: raw });         }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
```

- fault-injection.07-broker-says-position-local-says-flat `c:\Users\conor\luke\fault-injection\07-broker-says-position-local-says-flat.js`

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

