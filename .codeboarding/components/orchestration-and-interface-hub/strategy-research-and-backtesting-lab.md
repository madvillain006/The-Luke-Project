---
component_id: 1.5
component_name: Strategy Research & Backtesting Lab
---

# Strategy Research & Backtesting Lab

## Component Description

An offline environment used to replay historical data and validate new state machines or strategies without affecting the live trading environment.

---

## Key References:

### c:\Users\conor\luke\lib\research\replay-engine.js (lines 213-335)
```
async function runExistingDataReplay(options = {}) {
  ensureDir(RESEARCH_ARTIFACT_DIR);
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const spxBars = loadHistoricalCsvBars('SPX');
  const esHistoricalCsvBars = loadHistoricalCsvBars('ES');
  const rows = [];
  const blocked = [];

  for (const session of sessions) {
    const checkpoints = collectCheckpointTimes(session, timeline.events, options);
    for (const checkpoint of checkpoints) {
      const bar = barAtOrBefore(session.replayBars, checkpoint.timestamp);
      if (!bar) {
        blocked.push(`${session.date} ${checkpoint.timestamp}: no ES bar at/before checkpoint`);
        continue;
      }
      const context = buildActiveSourceContext(timeline.events, checkpoint.timestamp);
      const response = await decideWithResearchContext({
        context,
        checkpoint: checkpoint.timestamp,
        currentPrice: bar.close,
      });
      const decision = flattenDecision(response);
      const outcome = computeOutcomeMetrics({
        bars: session.replayBars,
        timestamp: checkpoint.timestamp,
        price: bar.close,
        decision: response.decision,
      });
      const sourceCombo = sourceComboFromContext(context);
      const row = {
        date: session.date,
        timestamp_et: checkpoint.timestamp,
        instrument: 'ES',
        checkpoint_reasons: checkpoint.reasons,
        current_price_source: 'session_es_1m_close',
        es_price: bar.close,
        spx_price: null,
        active_source_counts: context.source_counts,
        source_freshness: context.source_freshness,
        source_combo: sourceCombo,
        action: decision.action,
        raw_spine_action: decision.raw_spine_action,
        adapter_action: decision.adapter_action,
        anchor: decision.anchor,
        entry: decision.entry,
        acceptable_entry: decision.acceptable_entry,
        stop: decision.stop,
        target: decision.target,
        sizing: decision.sizing,
        vetoes: decision.vetoes,
        evidence: decision.evidence,
        market_data: decision.market_data ? {
          ...decision.market_data,
          timestamp: checkpoint.timestamp,
          source: 'session_es_1m_close',
          confidence: 1,
        } : null,
        reason: decision.reason,
        outcome,
      };
      row.pass_missed_move = classifyPassMiss(row);
      row.veto_saved_bad_trade = classifyVetoSave(row);
      rows.push(row);
    }
  }

  const attribution = summarizeBySourceCombo(rows);
  const vetoAnalysis = rows.filter(row => row.vetoes?.length).map(row => ({
    date: row.date,
    timestamp_et: row.timestamp_et,
    vetoes: row.vetoes.map(veto => veto.type || veto),
    outcome: row.outcome,
    veto_saved_bad_trade: row.veto_saved_bad_trade,
  }));
  const passMissAnalysis = rows.filter(row => row.adapter_action === 'PASS' || row.pass_missed_move).map(row => ({
    date: row.date,
    timestamp_et: row.timestamp_et,
    reason: row.reason,
    source_combo: row.source_combo,
    mfe_15m: row.outcome?.mfe_15m,
    mfe_60m: row.outcome?.mfe_60m,
    pass_missed_move: row.pass_missed_move,
  }));

  const result = {
    generated_at: new Date().toISOString(),
    scope: 'ES 1-minute replay with existing analyst context; SPX CSV inventory available but not silently substituted for ES price.',
    sessions: sessions.length,
    excluded_sessions: excluded,
    checkpoint_strategy: '15-minute/opening checkpoints plus source updates plus near-level/touch events, capped per day.',
    checkpoint_count: rows.length,
    no_lookahead_enforced: true,
    es_session_bars: sessions.reduce((sum, session) => sum + session.replayBars.length, 0),
    es_historical_csv_bars: summarizeBars(esHistoricalCsvBars),
    spx_historical_csv_bars: summarizeBars(spxBars),
    counts: {
      actionable: rows.filter(row => row.adapter_action === 'LONG' || row.adapter_action === 'SHORT').length,
      pass_wait: rows.filter(row => !(row.adapter_action === 'LONG' || row.adapter_action === 'SHORT')).length,
      vetoes: rows.filter(row => row.vetoes?.length).length,
      pass_misses: rows.filter(row => row.pass_missed_move).length,
      veto_saves: rows.filter(row => row.veto_saved_bad_trade).length,
    },
    blocked,
    rows,
  };

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'replay-results.json'), result);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'source-attribution.json'), attribution);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'veto-analysis.json'), vetoAnalysis);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'pass-miss-analysis.json'), passMissAnalysis);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'missing-data-report.json'), {
    generated_at: new Date().toISOString(),
    excluded_sessions: excluded,
    timeline_missing: timeline.missing,
    replay_blocked: blocked,
    missing_spx_for_session_replay: spxBars.length === 0,
  });
  if (fs.existsSync(TEMP_MEMORY_FILE)) fs.unlinkSync(TEMP_MEMORY_FILE);

  return { result, attribution, vetoAnalysis, passMissAnalysis };
}
```

### c:\Users\conor\luke\lib\research\fake-breakdown-state-machine\evaluator.js (lines 198-296)
```
async function runFakeBreakdownStateMachineResearch(options = {}) {
  const { results, setups } = await ensureV2Artifacts();
  const barsByDate = buildSessionBarsByDate();
  const observations = buildObservations({
    rows: results.rows,
    setups,
    barsByDate,
    account25k: ACCOUNT_25K,
    account50k: ACCOUNT_50K,
  });
  const selectedByRule = buildRuleSignals({ observations, setups, barsByDate, rules: NAMED_RULES });
  const allSetupCount = new Set(setups.map(canonicalSetupKey)).size;
  const validReclaimCount = new Set(setups.filter(setup => setup.valid_reclaim).map(canonicalSetupKey)).size;

  const ruleResults = [];
  const accountSims = {};
  for (const rule of NAMED_RULES) {
    const signals = selectedByRule.get(rule.id) || [];
    const sims = simulateRuleSet(signals, options.accountOptions || {});
    accountSims[rule.id] = sims;
    ruleResults.push(summarizeRule({
      rule,
      signals,
      allSetupCount,
      validReclaimCount,
      accountRows: sims,
    }));
  }

  ruleResults.sort((a, b) => {
    const rank = { PAPER_ONLY: 0, WATCHLIST_ONLY: 1, NOT_READY: 2 };
    if (rank[a.recommendation] !== rank[b.recommendation]) return rank[a.recommendation] - rank[b.recommendation];
    return (b.expectancy_2es || -9999) - (a.expectancy_2es || -9999);
  });

  const bestRule = ruleResults[0] || null;
  const rows = [...selectedByRule.values()].flat();
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'fake_breakdown_state_machine_research',
    source_artifacts: [
      'artifacts/research/fake-breakdown-v2-results.json',
      'artifacts/research/fake-breakdown-v3-results.json',
    ],
    named_rules_only: true,
    no_combo_search: true,
    date_range: results.summary?.date_range || null,
    level_watch_count: allSetupCount,
    valid_reclaim_count: validReclaimCount,
    state_rows: rows.length,
    no_lookahead_enforced: rows.every(row => row.no_lookahead_state_machine),
    account_25k: ACCOUNT_25K,
    account_50k_previous_rules: ACCOUNT_50K,
    best_rule: bestRule,
    rules: ruleResults,
    failure_risks: [
      'state reconstruction uses OHLC bars, not order-book queue data',
      'V3 observations still come from historical setup detection rather than a running intraday scanner',
      'daily simulations are deterministic over this corpus, so fail probability is replay probability, not statistical probability',
      'same-bar stop/target ambiguity is already treated conservatively in V3 outcomes',
      'watchlist status is research output only and does not make any rule live',
    ],
  };

  const stateRows = rows.map(row => ({
    setup_id: row.setup_id,
    rule_id: row.rule_id,
    date: row.date,
    entry_timestamp_et: row.entry_timestamp_et,
    source_combo: row.source_combo,
    entry_model: row.entry_model,
    final_state: row.final_state,
    trade_classification: row.trade_plan.classification,
    trade_reason: row.trade_plan.reason,
    stop_points: row.stop_points,
    tp2_hit: row.outcome?.tp2_hit,
    tp3_hit: row.outcome?.tp3_hit,
    stop_first: row.outcome?.stop_first,
    heat_before_tp1: row.outcome?.mae_before_tp1,
    time_to_tp1: row.outcome?.time_to_tp1,
    state_timing: row.state_timing,
    state_events: row.state_events,
  }));

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-results.json'), { summary, rows: stateRows });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-rules.json'), ruleResults);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-account-sim.json'), accountSims);
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-summary.csv'), toCsvRows(ruleResults), [
    'rule_id', 'rule_label', 'sample_size', 'tradeable_count', 'watch_to_tradeable_rate',
    'false_armed_rate', 'invalidation_rate', 'tp2_hit_rate', 'tp3_hit_rate', 'stop_first_rate',
    'average_heat_before_tp1', 'median_heat_before_tp1', 'median_watch_to_tradeable_minutes',
    'median_tradeable_to_tp1_minutes', 'expectancy_2es', 'expectancy_1es',
    'positive_day_rate_25k_2es', 'days_to_target_25k_2es', 'fail_probability_25k_2es',
    'days_to_target_50k_2es', 'fail_probability_50k_2es', 'recommendation', 'confidence',
  ]);
  fs.writeFileSync(path.join(ROOT, 'docs', 'FAKE_BREAKDOWN_STATE_MACHINE.md'), renderReport({ summary, ruleResults, accountSims }), 'utf8');

  return { summary, ruleResults, accountSims, rows: stateRows };
}
```


## Source Files:

- `lib\kat-market-evaluation.js`
- `lib\research\corpus-loader.js`
- `lib\research\fake-breakdown-state-machine\account-sim.js`
- `lib\research\fake-breakdown-state-machine\evaluator.js`
- `lib\research\fake-breakdown-state-machine\live-watchlist.js`
- `lib\research\fake-breakdown-state-machine\report.js`
- `lib\research\fake-breakdown-state-machine\rule-throttle-analysis.js`
- `lib\research\fake-breakdown-state-machine\rules.js`
- `lib\research\fake-breakdown-state-machine\states.js`
- `lib\research\fake-breakdown-state-machine\visual-replay.js`
- `lib\research\fake-breakdown-state-machine\watchlist-report.js`
- `lib\research\fake-breakdown-v3\combo-search.js`
- `lib\research\fake-breakdown-v3\evaluator.js`
- `lib\research\fake-breakdown-v3\feature-extractor.js`
- `lib\research\fake-breakdown-v3\filters.js`
- `lib\research\fake-breakdown-v3\report.js`
- `lib\research\no-lookahead-context.js`
- `lib\research\source-timeline.js`
- `scripts\audit-kat.js`
- `scripts\backfill-saty-to-memory.js`
- `scripts\backtest-es-long-bracket.js`
- `scripts\backtest-session.js`
- `scripts\build-es-long-backtest-dataset.js`
- `scripts\build-es-long-backtest-sessions.js`
- `scripts\build-fake-breakdown-watchlist-replay.js`
- `scripts\build-kat-owner-proof-pack.js`
- `scripts\build-level-frequency.js`
- `scripts\compare-operator-surfaces.js`
- `scripts\coverage-audit.js`
- `scripts\diagnose-backtest-coverage.js`
- `scripts\discord-scraper.js`
- `scripts\dry-fire.js`
- `scripts\generate-es-long-candidates.js`
- `scripts\import-mancini-archive.js`
- `scripts\ingest-exports.js`
- `scripts\inject-session-bobby-levels.js`
- `scripts\inventory-existing-research-data.js`
- `scripts\mancini-check.js`
- `scripts\parse-bobby-images.js`
- `scripts\parse-discord-backtest.js`
- `scripts\prove-operator-v2.js`
- `scripts\prove-staged-flow.js`
- `scripts\replay-decision-spine-history.js`
- `scripts\replay-kat.js`
- `scripts\run-atm-backtest.js`
- `scripts\run-combined-atm-backtest.js`
- `scripts\run-existing-data-replay.js`
- `scripts\run-fake-breakdown-research.js`
- `scripts\run-fake-breakdown-state-machine.js`
- `scripts\run-fake-breakdown-v2-research.js`
- `scripts\run-fake-breakdown-v3-live-filters.js`
- `scripts\run-historical-operator-replay.js`
- `scripts\run-operator-session.js`
- `scripts\run-prop-fake-breakdown-research.js`
- `scripts\run-tonight-wrapup-proof.js`
- `scripts\run-virtual-trading-workday-showcase.js`
- `scripts\test-bobby-vision.js`
- `scripts\test-dubz-paste.js`
- `scripts\validate-bobby-fixtures.js`
- `scripts\validate-dubz-fixtures.js`
- `scripts\verify-gate4-dubz-memory.js`
- `scripts\verify-gate5-bobby-memory.js`
- `scripts\verify-market-data.js`

