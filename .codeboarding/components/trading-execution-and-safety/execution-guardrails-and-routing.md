---
component_id: 5.2
component_name: Execution Guardrails & Routing
---

# Execution Guardrails & Routing

## Component Description

Acts as the safety boundary manager for the execution engine. It calculates "Avoid Zones" and price boundaries based on market context to prevent orders from being placed in high-risk or invalid areas.

---

## Key References:

### c:\Users\conor\luke\trading\router.js (lines 1326-1326)
```
  deriveAvoidZones,
```

### c:\Users\conor\luke\trading\router.js (lines 167-170)
```
  const avoidBoundaries = records
    .filter(record => (record.mentions || []).some(m => m.analyst === "mancini" && m.intent === "chop_boundary"))
    .map(record => record.canonical_price)
    .sort((a, b) => a - b);
```


## Source Files:

- `trading\router.js`

