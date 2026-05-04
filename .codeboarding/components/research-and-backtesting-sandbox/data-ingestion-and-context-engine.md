---
component_id: 6.1
component_name: Data Ingestion & Context Engine
---

# Data Ingestion & Context Engine

## Component Description

Responsible for the extraction, normalization, and temporal alignment of market data. It transforms unstructured signals from external sources (Discord, text reports) and raw CSV bar data into a unified historical context, including session-based price structures and volatility metrics (ATR).

---

## Key References:

### c:\Users\conor\luke\lib\backtest-data\saty-historical.js (lines 103-117)
```
function buildFuturesSessionBars(intradayBars) {
  const groups = new Map();
  for (const bar of intradayBars || []) {
    if (!bar?.timestamp || !isInsideFuturesSession(bar)) continue;
    const sessionDate = futuresSessionDateForTimestamp(bar.timestamp);
    if (!sessionDate || isWeekend(sessionDate)) continue;
    if (!groups.has(sessionDate)) groups.set(sessionDate, []);
    groups.get(sessionDate).push(bar);
  }

  return [...groups.entries()]
    .map(([date, bars]) => summarizeBarsAsSession(date, bars))
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
```


## Source Files:

- `lib\backtest-data\bobby-export.js`
- `lib\backtest-data\mancini-text.js`
- `lib\backtest-data\saty-historical.js`
- `scripts\coverage-audit.js`
- `scripts\parse-discord-backtest.js`

