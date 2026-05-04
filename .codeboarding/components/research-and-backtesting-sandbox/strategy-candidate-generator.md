---
component_id: 6.2
component_name: Strategy Candidate Generator
---

# Strategy Candidate Generator

## Component Description

Identifies and clusters price levels to detect high-probability trade setups. It maps historical price action against ingested levels to generate "candidates"—discrete entry opportunities that serve as the input for the simulation engine.

---

## Key References:

### c:\Users\conor\luke\lib\backtest-data\long-candidate-generator.js (lines 75-103)
```
function clusterLevels(levels, tolerancePts = DEFAULTS.levelTolerancePts) {
  const sorted = normalizeLevels(levels);
  const clusters = [];
  for (const level of sorted) {
    const existing = clusters.find(cluster => Math.abs(cluster.anchor - level.price) <= tolerancePts);
    if (existing) {
      existing.levels.push(level);
      existing.low = Math.min(existing.low, level.price);
      existing.high = Math.max(existing.high, level.price);
      existing.anchor = existing.levels.reduce((sum, l) => sum + l.price, 0) / existing.levels.length;
      existing.sources = sourceSet(existing.levels);
    } else {
      clusters.push({
        anchor: level.price,
        low: level.price,
        high: level.price,
        levels: [level],
        sources: sourceSet([level]),
      });
    }
  }
  return clusters
    .map(cluster => ({
      ...cluster,
      anchor: roundToTick(cluster.anchor),
      sourceCount: cluster.sources.length,
    }))
    .sort((a, b) => a.anchor - b.anchor);
}
```


## Source Files:

- `lib\backtest-data\long-candidate-generator.js`
- `scripts\build-es-long-backtest-sessions.js`
- `scripts\inject-session-bobby-levels.js`

