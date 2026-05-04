'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, RESEARCH_ARTIFACT_DIR, writeJson, writeCsv, average, median } = require('../common');
const {
  ensureV2Artifacts,
  buildSessionBarsByDate,
  buildObservations,
} = require('../fake-breakdown-v3/evaluator');
const { NAMED_RULES, matchingRules, planClassification, chooseSignalForSetup } = require('./rules');
const { buildStateTimeline, minutesBetween, rounded } = require('./states');
const { ACCOUNT_25K, ACCOUNT_50K, simulateRuleSet } = require('./account-sim');
const { renderReport } = require('./report');

function rate(rows, predicate) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function confidence(count) {
  if (count >= 200) return 'high';
  if (count >= 50) return 'medium';
  return 'low';
}

function accountBest(accountRows, accountName, mode = '2ES_FULL') {
  return (accountRows || [])
    .filter(row => row.account === accountName && row.mode === mode)
    .slice()
    .sort((a, b) => {
      if (a.target_hit !== b.target_hit) return a.target_hit ? -1 : 1;
      if (a.account_failed !== b.account_failed) return a.account_failed ? 1 : -1;
      return (b.cumulative_pnl || -9999) - (a.cumulative_pnl || -9999);
    })[0] || null;
}

function canonicalSetupKey(setup) {
  return [
    setup?.date,
    setup?.timestamp_et,
    setup?.executable_level,
    setup?.source_combo,
  ].map(value => value == null ? 'unknown' : String(value)).join('|');
}

function canonicalSignalKey(row) {
  return [
    row?.rule_id,
    row?.date,
    row?.timestamp_et,
    row?.executable_level,
    row?.source_combo,
    row?.entry_model,
    row?.entry_timestamp_et,
  ].map(value => value == null ? 'unknown' : String(value)).join('|');
}

function statusForRule(summary) {
  const best25 = summary.account_25k_best_2es || {};
  if (
    summary.sample_size >= 50
    && summary.tp2_hit_rate >= 0.7
    && summary.stop_first_rate <= 0.25
    && summary.expectancy_2es >= 0
    && best25.target_hit
    && !best25.account_failed
  ) return 'PAPER_ONLY';
  if (
    summary.sample_size >= 30
    && summary.tp2_hit_rate >= 0.65
    && summary.expectancy_1es >= 0
  ) return 'WATCHLIST_ONLY';
  return 'NOT_READY';
}

function summarizeRule({ rule, signals, allSetupCount, validReclaimCount, accountRows }) {
  const armed = signals.filter(signal => signal.state_events?.some(event => event.state === 'ARMED'));
  const tradeable = signals.filter(signal => signal.final_state === 'TRADEABLE' && ['2ES_FULL', '1ES_STARTER', '1ES_ADD_LATER'].includes(signal.trade_plan.classification));
  const tp2HitRate = rate(tradeable, signal => signal.outcome?.tp2_hit === true);
  const summary = {
    rule_id: rule.id,
    rule_label: rule.label,
    watch_count: allSetupCount,
    reclaim_watch_count: validReclaimCount,
    signal_count: signals.length,
    sample_size: armed.length,
    tradeable_count: tradeable.length,
    watch_to_tradeable_rate: allSetupCount ? tradeable.length / allSetupCount : null,
    armed_to_tradeable_rate: armed.length ? tradeable.length / armed.length : null,
    armed_to_tp2_hit_rate: rate(armed, signal => signal.outcome?.tp2_hit === true),
    false_armed_rate: rate(armed, signal => signal.outcome?.tp2_hit !== true),
    invalidation_rate: rate(armed, signal => signal.final_state === 'INVALIDATED'),
    tp2_hit_rate: tp2HitRate,
    tp3_hit_rate: rate(tradeable, signal => signal.outcome?.tp3_hit === true),
    stop_first_rate: rate(tradeable, signal => signal.outcome?.stop_first === true),
    average_heat_before_tp1: rounded(average(tradeable.map(signal => signal.outcome?.mae_before_tp1))),
    median_heat_before_tp1: rounded(median(tradeable.map(signal => signal.outcome?.mae_before_tp1))),
    average_watch_to_tradeable_minutes: rounded(average(tradeable.map(signal => signal.state_timing?.watch_to_tradeable_minutes))),
    median_watch_to_tradeable_minutes: rounded(median(tradeable.map(signal => signal.state_timing?.watch_to_tradeable_minutes))),
    median_tradeable_to_tp1_minutes: median(tradeable.map(signal => signal.outcome?.time_to_tp1)),
    expectancy_2es: rounded(average(tradeable.filter(signal => signal.trade_plan.classification === '2ES_FULL').map(signal => signal.prop?.pnl_2es_slip_0_5_round_trip))),
    expectancy_1es: rounded(average(tradeable.map(signal => signal.prop?.pnl_1es_slip_0_5_round_trip))),
    confidence: confidence(armed.length),
  };
  summary.account_25k_best_2es = accountBest(accountRows, '25k', '2ES_FULL');
  summary.account_25k_best_1es = accountBest(accountRows, '25k', '1ES_STARTER');
  summary.account_50k_best_2es = accountBest(accountRows, '50k', '2ES_FULL');
  summary.account_50k_best_1es = accountBest(accountRows, '50k', '1ES_STARTER');
  summary.recommendation = statusForRule(summary);
  return summary;
}

function buildRuleSignals({ observations, setups, barsByDate, rules = NAMED_RULES }) {
  const setupMap = new Map((setups || []).map(setup => [setup.id, setup]));
  const byRule = new Map(rules.map(rule => [rule.id, []]));

  for (const observation of observations || []) {
    for (const rule of matchingRules(observation, rules)) {
      const setup = setupMap.get(observation.setup_id);
      if (!setup) continue;
      const tradePlan = planClassification(observation);
      const timeline = buildStateTimeline({
        setup,
        observation,
        bars: barsByDate.get(observation.date) || [],
        rule,
        tradePlan,
      });
      const events = timeline.events;
      const finalState = events[events.length - 1]?.state || null;
      byRule.get(rule.id).push({
        ...observation,
        rule_id: rule.id,
        rule_label: rule.label,
        trade_plan: tradePlan,
        state_events: events,
        final_state: finalState,
        state_order_valid: timeline.order_valid,
        state_timing: {
          level_watch_lead_minutes: timeline.level_watch_lead_minutes,
          zone_watch_lead_minutes: timeline.zone_watch_lead_minutes,
          watch_to_tradeable_minutes: timeline.watch_to_tradeable_minutes,
          breakdown_to_reclaim_minutes: timeline.breakdown_to_reclaim_minutes,
          reclaim_to_armed_minutes: timeline.reclaim_to_armed_minutes,
          tradeable_to_tp1_minutes: observation.outcome?.time_to_tp1 ?? null,
        },
        no_lookahead_state_machine: timeline.order_valid && events.every(event => {
          if (!event.timestamp_et || !observation.entry_timestamp_et) return true;
          if (event.state === 'TRADEABLE' || event.state === 'INVALIDATED' || event.state === 'EXPIRED') return true;
          return minutesBetween(event.timestamp_et, observation.entry_timestamp_et) >= 0;
        }),
      });
    }
  }

  const selectedByRule = new Map();
  for (const [ruleId, rows] of byRule.entries()) {
    const grouped = new Map();
    for (const row of rows) {
      const key = canonicalSignalKey(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    selectedByRule.set(ruleId, [...grouped.values()].map(chooseSignalForSetup).filter(Boolean));
  }
  return selectedByRule;
}

function toCsvRows(ruleSummaries) {
  return ruleSummaries.map(row => ({
    rule_id: row.rule_id,
    rule_label: row.rule_label,
    sample_size: row.sample_size,
    tradeable_count: row.tradeable_count,
    watch_to_tradeable_rate: row.watch_to_tradeable_rate,
    false_armed_rate: row.false_armed_rate,
    invalidation_rate: row.invalidation_rate,
    tp2_hit_rate: row.tp2_hit_rate,
    tp3_hit_rate: row.tp3_hit_rate,
    stop_first_rate: row.stop_first_rate,
    average_heat_before_tp1: row.average_heat_before_tp1,
    median_heat_before_tp1: row.median_heat_before_tp1,
    median_watch_to_tradeable_minutes: row.median_watch_to_tradeable_minutes,
    median_tradeable_to_tp1_minutes: row.median_tradeable_to_tp1_minutes,
    expectancy_2es: row.expectancy_2es,
    expectancy_1es: row.expectancy_1es,
    positive_day_rate_25k_2es: row.account_25k_best_2es?.positive_day_rate,
    days_to_target_25k_2es: row.account_25k_best_2es?.days_to_target,
    fail_probability_25k_2es: row.account_25k_best_2es?.fail_before_target_probability,
    days_to_target_50k_2es: row.account_50k_best_2es?.days_to_target,
    fail_probability_50k_2es: row.account_50k_best_2es?.fail_before_target_probability,
    recommendation: row.recommendation,
    confidence: row.confidence,
  }));
}

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

module.exports = {
  rate,
  confidence,
  accountBest,
  canonicalSetupKey,
  canonicalSignalKey,
  statusForRule,
  summarizeRule,
  buildRuleSignals,
  runFakeBreakdownStateMachineResearch,
};
