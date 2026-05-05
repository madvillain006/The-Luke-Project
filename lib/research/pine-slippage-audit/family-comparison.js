'use strict';

const path = require('path');
const { ROOT, readJson } = require('../common');
const { ACCOUNT_25K, ACCOUNT_50K } = require('../multi-source-ladder-reclaim/metrics');
const { analyzeStagedAdds } = require('../multi-source-ladder-reclaim/staged-add-analysis');
const { rowsToSignals } = require('./signal-loader');
const { evaluateMode } = require('./evaluator');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function confidenceForSample(size) {
  if (size >= 200) return 'high';
  if (size >= 50) return 'medium';
  return 'low';
}

function topDayDependency(dayResults, totalPnl) {
  const positive = (dayResults || []).filter(day => day.pnl > 0 || day.day_pnl > 0);
  const top = positive.reduce((best, day) => Math.max(best, day.pnl ?? day.day_pnl ?? 0), 0);
  if (!Number.isFinite(totalPnl) || totalPnl <= 0) return null;
  return rounded(top / totalPnl);
}

function compareSignalFamily({ name, signals, context, basis = 'recomputed_from_signals' }) {
  const noSlip = evaluateMode(signals, context, { slippageMode: 'none', sameBarPolicy: 'stop_first_hard' });
  const rt050 = evaluateMode(signals, context, { slippageMode: 'round_trip_0_50', sameBarPolicy: 'stop_first_hard' });
  const rt100 = evaluateMode(signals, context, { slippageMode: 'round_trip_1_00', sameBarPolicy: 'stop_first_hard' });
  const optimistic = evaluateMode(signals, context, { slippageMode: 'round_trip_0_50', sameBarPolicy: 'target_first_optimistic' });
  return {
    family: name,
    comparison_basis: basis,
    sample_size: rt050.one_es.filled_signals,
    signals_available: rt050.one_es.total_signals,
    no_slippage_result: noSlip.one_es.total_pnl,
    no_slippage_expectancy: noSlip.one_es.expectancy,
    round_trip_0_50_result: rt050.one_es.total_pnl,
    round_trip_0_50_expectancy: rt050.one_es.expectancy,
    round_trip_1_00_result: rt100.one_es.total_pnl,
    round_trip_1_00_expectancy: rt100.one_es.expectancy,
    same_bar_stop_first_result: rt050.one_es.total_pnl,
    same_bar_optimistic_result: optimistic.one_es.total_pnl,
    ambiguous_same_bar_count: rt050.one_es.ambiguous_same_bar_count,
    wins_converted_to_losses: rt050.one_es.wins_converted_to_losses,
    max_drawdown: rt050.one_es.max_drawdown,
    positive_day_rate: rt050.one_es.positive_day_rate,
    top_day_dependency: topDayDependency(rt050.one_es.day_results, rt050.one_es.total_pnl),
    account_fail: rt050.one_es.account_fail,
    account_viable_net_profitable: rt050.one_es.account_viable_net_profitable,
    one_es_account_result: rt050.one_es.total_pnl,
    two_es_account_result: rt050.two_es.total_pnl,
    one_es_50k_account_result: rt050.one_es_50k.total_pnl,
    two_es_50k_account_result: rt050.two_es_50k.total_pnl,
    one_es_50k_account_fail: rt050.one_es_50k.account_fail,
    two_es_50k_account_fail: rt050.two_es_50k.account_fail,
    one_es_50k_net_profitable: rt050.one_es_50k.net_profitable,
    two_es_50k_net_profitable: rt050.two_es_50k.net_profitable,
    confidence: confidenceForSample(rt050.one_es.filled_signals),
    one_es: rt050.one_es,
    two_es: rt050.two_es,
    one_es_50k: rt050.one_es_50k,
    two_es_50k: rt050.two_es_50k,
  };
}

function loadRuleSummaries(rootDir = ROOT) {
  const rules = readJson(path.join(rootDir, 'artifacts', 'research', 'fake-breakdown-state-rules.json'), []);
  return (rules || [])
    .filter(rule => ['A', 'B', 'C'].includes(rule.rule_id))
    .map(rule => {
      const rt050 = Number(rule.expectancy_1es);
      const oneEsAccount = rule.account_25k_best_1es || null;
      const twoEsAccount = rule.account_25k_best_2es || null;
      const oneEs50kAccount = rule.account_50k_best_1es || null;
      const twoEs50kAccount = rule.account_50k_best_2es || null;
      return {
        family: `Rule ${rule.rule_id}`,
        rule_label: rule.rule_label,
        comparison_basis: 'existing_fake_breakdown_state_summary_linear_slippage_derivation',
        sample_size: rule.tradeable_count,
        signals_available: rule.signal_count,
        no_slippage_result: rounded((rt050 + 25) * rule.tradeable_count),
        no_slippage_expectancy: rounded(rt050 + 25),
        round_trip_0_50_result: rounded(rt050 * rule.tradeable_count),
        round_trip_0_50_expectancy: rounded(rt050),
        round_trip_1_00_result: rounded((rt050 - 25) * rule.tradeable_count),
        round_trip_1_00_expectancy: rounded(rt050 - 25),
        same_bar_stop_first_result: rounded(rt050 * rule.tradeable_count),
        same_bar_optimistic_result: null,
        ambiguous_same_bar_count: null,
        wins_converted_to_losses: null,
        max_drawdown: oneEsAccount?.max_drawdown ?? twoEsAccount?.max_drawdown ?? null,
        positive_day_rate: oneEsAccount?.positive_day_rate ?? twoEsAccount?.positive_day_rate ?? null,
        top_day_dependency: topDayDependency(oneEsAccount?.day_results || twoEsAccount?.day_results, oneEsAccount?.cumulative_pnl ?? rounded(rt050 * rule.tradeable_count)),
        account_fail: oneEsAccount?.account_failed ?? twoEsAccount?.account_failed ?? null,
        account_viable_net_profitable: (oneEsAccount?.cumulative_pnl ?? null) > 0 && oneEsAccount?.account_failed !== true,
        one_es_account_result: oneEsAccount?.cumulative_pnl ?? null,
        two_es_account_result: twoEsAccount?.cumulative_pnl ?? null,
        one_es_50k_account_result: oneEs50kAccount?.cumulative_pnl ?? null,
        two_es_50k_account_result: twoEs50kAccount?.cumulative_pnl ?? null,
        one_es_50k_account_fail: oneEs50kAccount?.account_failed ?? null,
        two_es_50k_account_fail: twoEs50kAccount?.account_failed ?? null,
        one_es_50k_net_profitable: (oneEs50kAccount?.cumulative_pnl ?? null) > 0,
        two_es_50k_net_profitable: (twoEs50kAccount?.cumulative_pnl ?? null) > 0,
        confidence: rule.confidence || confidenceForSample(rule.tradeable_count),
        recommendation: rule.recommendation,
        source_warning: 'Rule A/B/C comparison uses existing state-machine artifacts; raw hard-mode repricing is not re-run from individual Rule rows in this audit.',
      };
    });
}

function ladderFamilyRows(rows, predicate) {
  return (rows || [])
    .filter(row => row.classification === 'TRADEABLE_RESEARCH')
    .filter(row => row.target_model === 'fixed_plus_2')
    .filter(predicate);
}

function firstBySetup(rows) {
  const seen = new Set();
  const out = [];
  for (const row of (rows || []).slice().sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)))) {
    if (seen.has(row.setup_id)) continue;
    seen.add(row.setup_id);
    out.push(row);
  }
  return out;
}

function buildFamilyComparison(inputs) {
  const context = { barsByDate: inputs.barsByDate };
  const families = [];
  families.push(...loadRuleSummaries());

  families.push(compareSignalFamily({
    name: 'Pine hard-mode family',
    signals: inputs.pine_signals,
    context,
    basis: 'Luke-equivalent Pine hard-mode reconstruction',
  }));

  const bobbyManciniRows = firstBySetup(ladderFamilyRows(inputs.ladder_rows, row => {
    const combo = String(row.source_combo || row.first_reclaimed_source_type || '');
    return combo.includes('bobby') && combo.includes('mancini');
  }));
  families.push(compareSignalFamily({
    name: 'Bobby+Mancini ladder reclaim',
    signals: rowsToSignals(bobbyManciniRows, 'bobby_mancini_ladder_reclaim', inputs.barsByDate),
    context,
  }));

  families.push(compareSignalFamily({
    name: '25K 1ES ladder reclaim',
    signals: rowsToSignals(inputs.account_ladder_rows, '25k_1es_ladder_reclaim', inputs.barsByDate),
    context,
  }));

  const staged25Analysis = analyzeStagedAdds(inputs.ladder_rows, inputs.barsByDate, ACCOUNT_25K);
  const staged50Analysis = analyzeStagedAdds(inputs.ladder_rows, inputs.barsByDate, ACCOUNT_50K);
  const staged = {
    ...staged25Analysis,
    account_25k: staged25Analysis,
    account_50k: staged50Analysis,
    best_variant_25k: staged25Analysis.best_variant,
    best_variant_50k: staged50Analysis.best_variant,
  };
  const staged25 = staged.best_variant_25k || null;
  const staged50 = staged.best_variant_50k || null;
  families.push({
    family: 'staged add after retest hold',
    comparison_basis: 'existing staged-add analyzer after ladder reclaim rows',
    sample_size: staged25?.trades ?? 0,
    signals_available: staged25?.trades ?? 0,
    no_slippage_result: null,
    no_slippage_expectancy: null,
    round_trip_0_50_result: staged25?.cumulative_pnl ?? null,
    round_trip_0_50_expectancy: staged25?.average_trade_pnl ?? null,
    round_trip_1_00_result: null,
    round_trip_1_00_expectancy: null,
    same_bar_stop_first_result: staged25?.cumulative_pnl ?? null,
    max_drawdown: staged25?.max_drawdown ?? null,
    positive_day_rate: staged25?.positive_day_rate == null ? null : rounded(staged25.positive_day_rate),
    top_day_dependency: topDayDependency(staged25?.day_results, staged25?.cumulative_pnl),
    account_fail: staged25?.failed ?? null,
    account_viable_net_profitable: (staged25?.cumulative_pnl ?? null) > 0 && staged25?.failed !== true,
    one_es_account_result: staged25?.cumulative_pnl ?? null,
    two_es_account_result: null,
    one_es_50k_account_result: staged50?.cumulative_pnl ?? null,
    two_es_50k_account_result: null,
    one_es_50k_account_fail: staged50?.failed ?? null,
    two_es_50k_account_fail: null,
    one_es_50k_net_profitable: (staged50?.cumulative_pnl ?? null) > 0,
    two_es_50k_net_profitable: null,
    confidence: confidenceForSample(staged25?.trades ?? 0),
    staged,
  });

  const viable = families
    .filter(family => Number.isFinite(family.round_trip_0_50_expectancy) && family.round_trip_0_50_expectancy > 0)
    .filter(family => {
      const accountOrRaw = Number.isFinite(family.one_es_account_result)
        ? family.one_es_account_result
        : family.round_trip_0_50_result;
      return accountOrRaw > 0;
    })
    .filter(family => family.account_fail !== true)
    .sort((a, b) => {
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      const ca = confidenceRank[a.confidence] || 0;
      const cb = confidenceRank[b.confidence] || 0;
      if (ca !== cb) return cb - ca;
      const ar = Number.isFinite(a.one_es_account_result) ? a.one_es_account_result : a.round_trip_0_50_result;
      const br = Number.isFinite(b.one_es_account_result) ? b.one_es_account_result : b.round_trip_0_50_result;
      return (br || 0) - (ar || 0);
    });
  const viable50k = families
    .filter(family => {
      const one = Number.isFinite(family.one_es_50k_account_result) ? family.one_es_50k_account_result : null;
      const two = Number.isFinite(family.two_es_50k_account_result) ? family.two_es_50k_account_result : null;
      return (one > 0 && family.one_es_50k_account_fail !== true)
        || (two > 0 && family.two_es_50k_account_fail !== true);
    })
    .sort((a, b) => {
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      const ca = confidenceRank[a.confidence] || 0;
      const cb = confidenceRank[b.confidence] || 0;
      if (ca !== cb) return cb - ca;
      const ar = Math.max(a.one_es_50k_account_result || -Infinity, a.two_es_50k_account_result || -Infinity);
      const br = Math.max(b.one_es_50k_account_result || -Infinity, b.two_es_50k_account_result || -Infinity);
      return (br || 0) - (ar || 0);
    });

  return {
    families,
    best_family: viable[0] || null,
    best_family_50k: viable50k[0] || null,
  };
}

module.exports = {
  compareSignalFamily,
  loadRuleSummaries,
  buildFamilyComparison,
};
