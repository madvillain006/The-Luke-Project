---
component_id: 4.1
component_name: Strategy Detection & Confluence Engine
---

# Strategy Detection & Confluence Engine

## Component Description

Identifies high-probability trade setups by merging legacy mentor levels with modern structural analysis. It acts as the primary detector, scanning for 'Fake Breakdown' patterns across multiple timeframes and validating them against trusted external levels.

---

## Key References:

### c:\Users\conor\luke\lib\research\fake-breakdown-v2\setup-detector.js (lines 6-14)
```
function detectV2SetupsForSession({ session, timelineEvents, spxBars }) {
  const bars = session.replayBars || session.bars?.rth || session.bars?.es || [];
  return detectSetupsForSession({ session, timelineEvents, spxBars }).map(setup => ({
    ...setup,
    strategy: 'fake_breakdown_reclaim_long_v2',
    entry_models_v2: buildEntryModels(setup, bars),
    accumulation: accumulationMetrics(setup, bars),
  }));
}
```

### c:\Users\conor\luke\lib\research\fake-breakdown-v2\entry-models.js (lines 124-145)
```
function microPivotBreakEntry(setup, bars, maxWait = 12) {
  if (!setup.valid_reclaim) return null;
  const reclaimIndex = indexAtOrAfter(bars, setup.reclaim_timestamp);
  if (reclaimIndex < 0 || reclaimIndex + 2 >= bars.length) return null;
  const pivotWindow = bars.slice(reclaimIndex, reclaimIndex + 3);
  const pivot = Math.max(...pivotWindow.map(bar => bar.high));
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 3; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].high >= pivot + 0.25 && bars[i].close >= setup.executable_level) {
      return {
        entry_model: 'micro_pivot_break',
        entry_timestamp_et: bars[i].timestamp,
        entry_price: rounded(pivot + 0.25),
        entry_index: i,
        fill_assumption: 'break of first post-reclaim micro pivot',
      };
    }
  }
  return null;
}
```


## Source Files:

- `lib\research\fake-breakdown-v2\entry-models.js`
- `lib\research\fake-breakdown-v2\evaluator.js`
- `lib\research\fake-breakdown-v2\level-ladder.js`
- `lib\research\fake-breakdown-v2\metrics.js`
- `lib\research\fake-breakdown-v2\prop-risk.js`
- `lib\research\fake-breakdown-v2\report.js`
- `lib\research\fake-breakdown-v2\setup-detector.js`
- `lib\research\fake-breakdown-v2\staged-sizing.js`
- `lib\research\fake-breakdown-v2\target-selector.js`
- `lib\research\fake-breakdown\detector.js`
- `lib\research\fake-breakdown\filters.js`
- `lib\research\fake-breakdown\mancini-importer.js`
- `lib\research\fake-breakdown\metrics.js`
- `lib\research\fake-breakdown\report.js`
- `lib\research\fake-breakdown\strategy.js`

