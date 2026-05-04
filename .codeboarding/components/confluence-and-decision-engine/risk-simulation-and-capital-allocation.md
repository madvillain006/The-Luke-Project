---
component_id: 4.2
component_name: Risk Simulation & Capital Allocation
---

# Risk Simulation & Capital Allocation

## Component Description

Normalizes price action across different instruments and simulates trade performance under specific financial constraints. It transforms raw 'setups' into 'executable trades' by calculating position sizing, max heat, and risk-to-reward ratios tailored for proprietary firm account rules.

---

## Key References:

### c:\Users\conor\luke\lib\research\prop-fake-breakdown\evaluator.js (lines 286-361)
```
async function runPropFakeBreakdownResearch(options = {}) {
  const config = { ...DEFAULT_PROP_CONFIG, ...(options.prop || {}) };
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esCsvBars = loadHistoricalCsvBars('ES');
  const setups = [];
  const variants = [];
  const spxHeatmapMinuteComparisons = [];
  for (const session of sessions) {
    spxHeatmapMinuteComparisons.push(...spxHeatmapComparisonsForSession({ session, timelineEvents: timeline.events, spxBars }));
    const sessionSetups = detectSetupsForSession({ session, timelineEvents: timeline.events, spxBars });
    setups.push(...sessionSetups);
    for (const setup of sessionSetups) variants.push(...variantRowsForSetup(setup, session.replayBars, config));
  }
  annotateDailyPropMetrics(variants, config);
  const aggregates = aggregate(variants);
  const propSim = buildPropSim(variants);
  const basisComparison = {
    generated_at: new Date().toISOString(),
    by_basis_method: aggregates.by_basis_method,
    fixed_plus_30_diagnostic_rows: variants.filter(row => row.basis_method === 'fixed_plus_30_proxy').length,
    spx_reference_only_cases: spxHeatmapMinuteComparisons.length,
    actual_basis_methods_tested: [...new Set(variants.map(row => row.basis_method).filter(method =>
      ['same_minute_basis', 'session_open_basis', 'prior_close_basis', 'rolling_15m_basis', 'native_es'].includes(method)
    ))].sort(),
    spx_heatmap_minute_comparisons: {
      total: spxHeatmapMinuteComparisons.length,
      same_minute_es_spx_available: spxHeatmapMinuteComparisons.filter(row => row.comparison_available).length,
      attached_to_candidate_setups: setups.filter(setup => setup.spx_heatmap_minute_comparison?.comparison_available).length,
      conversion_used: false,
    },
    note: 'The prop evaluator uses ES minute bars and native ES executable levels. SPX heatmap events are reference-only and receive same-minute ES/SPX comparison when a timestamped SPX heatmap image is attached to that minute.',
  };
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'prop_fake_breakdown_reclaim_long_v1',
    prop_config: config,
    sessions: sessions.length,
    excluded_sessions: excluded,
    date_range: sessions.length ? { start: sessions[0].date, end: sessions[sessions.length - 1].date } : null,
    es_1m_bars: summarizeBars(esCsvBars),
    spx_1m_bars: summarizeBars(spxBars),
    unique_setups: setups.length,
    variant_rows: variants.length,
    classification_counts: {
      TRADEABLE: variants.filter(row => row.classification === 'TRADEABLE').length,
      WATCH_ONLY: variants.filter(row => row.classification === 'WATCH_ONLY').length,
      PASS: variants.filter(row => row.classification === 'PASS').length,
    },
    chop_cases: setups.filter(setup => setup.inside_chop).length,
    no_lookahead_enforced: true,
    aggregates,
    basis_comparison: basisComparison,
    spx_heatmap_minute_comparisons: basisComparison.spx_heatmap_minute_comparisons,
    prop_sim: propSim,
    long_only_prop_strategy_supported: 'inconclusive',
    confidence: variants.length >= 1000 ? 'medium' : 'low',
  };
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-setups.json'), setups);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-variants.json'), { summary, rows: variants });
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-summary.csv'), toCsvRows(variants), [
    'setup_id', 'date', 'timestamp_et', 'basis_method', 'source_combo', 'classification', 'classification_reason',
    'executable_level', 'entry_model', 'entry_price', 'stop_model', 'stop_points', 'risk_dollars',
    'target_model', 'tp1', 'tp2', 'tp1_hit', 'stop_first', 'same_bar_ambiguity',
    'mfe_15m', 'mae_15m', 'max_heat_before_tp1', 'r_60m', 'allowed_under_prop_rules',
  ]);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-source-combos.json'), aggregates.by_source_combo);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-basis-comparison.json'), basisComparison);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-chop-analysis.json'), {
    chop_cases: setups.filter(setup => setup.inside_chop),
    by_chop: aggregates.by_chop,
  });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'prop-fake-breakdown-prop-sim.json'), propSim);
  return { summary, setups, variants };
}
```


## Source Files:

- `lib\research\prop-fake-breakdown\basis.js`
- `lib\research\prop-fake-breakdown\detector.js`
- `lib\research\prop-fake-breakdown\evaluator.js`
- `lib\research\prop-fake-breakdown\metrics.js`
- `lib\research\prop-fake-breakdown\prop-risk.js`
- `lib\research\prop-fake-breakdown\report.js`

