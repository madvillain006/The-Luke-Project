'use strict';

const { average, median } = require('../common');
const { buildPredicates, applyFilters } = require('./filters');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function rate(rows, predicate) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function uniqueCount(rows, key = 'setup_id') {
  return new Set((rows || []).map(row => row[key]).filter(Boolean)).size;
}

function confidence(uniqueSetups) {
  if (uniqueSetups >= 200) return 'high';
  if (uniqueSetups >= 50) return 'medium';
  return 'low';
}

function simulateDaily(rows, pnlSelector, account) {
  const byDay = new Map();
  for (const row of rows || []) {
    if (!byDay.has(row.date)) byDay.set(row.date, []);
    byDay.get(row.date).push(row);
  }
  let drawdownFailures = 0;
  let killDays = 0;
  let maxLossDays = 0;
  let cumulativePnl = 0;
  let accountFailed = false;
  let profitTargetHit = false;

  for (const dayRows of [...byDay.values()]) {
    dayRows.sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));
    let trades = 0;
    let losses = 0;
    let dayPnl = 0;
    let dayPeak = 0;
    let killed = false;
    let failed = false;
    for (const row of dayRows) {
      if (profitTargetHit || accountFailed) continue;
      if (trades >= account.max_trades_per_day || losses >= account.max_losses_per_day || killed || failed) continue;
      const pnl = pnlSelector(row);
      trades += 1;
      dayPnl += pnl;
      cumulativePnl += pnl;
      if (pnl < 0) losses += 1;
      dayPeak = Math.max(dayPeak, dayPnl);
      if (dayPnl <= -account.daily_kill_loss_dollars) killed = true;
      if (dayPnl <= -account.max_eod_drawdown || dayPeak - dayPnl >= account.max_intraday_trailing_drawdown) failed = true;
      if (cumulativePnl >= account.profit_target) profitTargetHit = true;
      if (cumulativePnl <= -account.max_eod_drawdown) accountFailed = true;
    }
    if (failed) drawdownFailures += 1;
    if (killed) killDays += 1;
    if (losses >= account.max_losses_per_day) maxLossDays += 1;
  }

  return {
    account: account.name,
    profit_target: account.profit_target,
    max_eod_drawdown: account.max_eod_drawdown,
    max_intraday_trailing_drawdown: account.max_intraday_trailing_drawdown,
    cumulative_pnl: rounded(cumulativePnl),
    profit_target_hit: profitTargetHit,
    account_failed: accountFailed,
    daily_drawdown_failures: drawdownFailures,
    daily_kill_days: killDays,
    max_loss_days: maxLossDays,
  };
}

function summarizeRows(rows, options = {}) {
  const account25k = options.account25k || DEFAULT_25K_ACCOUNT;
  const account50k = options.account50k || DEFAULT_50K_ACCOUNT;
  const taken = (rows || []).filter(row => row.valid_reclaim && !row.no_lookahead_violation && row.stop_within_hard);
  const full2es = taken.filter(row => row.stop_within_preferred);
  const starter1es = taken.filter(row => row.prop?.one_es_starter_ok);
  const uniqueSetups = uniqueCount(rows);
  return {
    unique_setup_count: uniqueSetups,
    variant_rows: rows.length,
    taken_setup_count: uniqueCount(taken),
    taken_rows: taken.length,
    two_es_preferred_rows: full2es.length,
    one_es_starter_rows: starter1es.length,
    tp2_hit_rate: rate(taken, row => row.outcome?.tp2_hit === true),
    tp3_hit_rate: rate(taken, row => row.outcome?.tp3_hit === true),
    stop_first_rate: rate(taken, row => row.outcome?.stop_first === true),
    average_mae_before_tp1: rounded(average(taken.map(row => row.outcome?.mae_before_tp1))),
    median_mae_before_tp1: rounded(median(taken.map(row => row.outcome?.mae_before_tp1))),
    median_time_to_tp1: median(taken.map(row => row.outcome?.time_to_tp1)),
    expectancy_2es_slip_0_25_side: rounded(average(full2es.map(row => row.prop?.pnl_2es_slip_0_25_side))),
    expectancy_2es_slip_0_5_round_trip: rounded(average(full2es.map(row => row.prop?.pnl_2es_slip_0_5_round_trip))),
    expectancy_1es_slip_0_25_side: rounded(average(starter1es.map(row => row.prop?.pnl_1es_slip_0_25_side))),
    expectancy_1es_slip_0_5_round_trip: rounded(average(starter1es.map(row => row.prop?.pnl_1es_slip_0_5_round_trip))),
    expectancy_staged_plus_1: rounded(average(starter1es.map(row => row.prop?.staged_add_plus_1_pnl))),
    expectancy_staged_plus_2: rounded(average(starter1es.map(row => row.prop?.staged_add_plus_2_pnl))),
    daily_drawdown_failures_25k_2es: simulateDaily(full2es, row => row.prop?.pnl_2es_slip_0_5_round_trip || 0, account25k).daily_drawdown_failures,
    daily_drawdown_failures_25k_1es: simulateDaily(starter1es, row => row.prop?.pnl_1es_slip_0_5_round_trip || 0, account25k).daily_drawdown_failures,
    account_25k_2es: simulateDaily(full2es, row => row.prop?.pnl_2es_slip_0_5_round_trip || 0, account25k),
    account_25k_1es: simulateDaily(starter1es, row => row.prop?.pnl_1es_slip_0_5_round_trip || 0, account25k),
    account_50k_2es: simulateDaily(full2es, row => row.prop?.pnl_2es_slip_0_5_round_trip || 0, account50k),
    account_50k_1es: simulateDaily(starter1es, row => row.prop?.pnl_1es_slip_0_5_round_trip || 0, account50k),
    confidence: confidence(uniqueSetups),
  };
}

function comboKey(filters) {
  return filters.map(filter => filter.id).join('+') || 'baseline_all_v3_entries';
}

function buildFilterCombos(predicates = buildPredicates(), maxSize = 3) {
  const combos = [{ id: 'baseline_all_v3_entries', label: 'Baseline all V3 entry rows', filters: [] }];
  function visit(start, chosen) {
    if (chosen.length) {
      combos.push({
        id: comboKey(chosen),
        label: chosen.map(filter => filter.label).join(' + '),
        filters: chosen,
      });
    }
    if (chosen.length >= maxSize) return;
    for (let i = start; i < predicates.length; i += 1) {
      visit(i + 1, chosen.concat(predicates[i]));
    }
  }
  visit(0, []);
  return combos;
}

function searchCombos(rows, options = {}) {
  const minRows = options.minRows || 10;
  const combos = options.combos || buildFilterCombos(buildPredicates(), options.maxSize || 3);
  const summaries = [];
  for (const combo of combos) {
    const matched = applyFilters(rows, combo.filters);
    if (matched.length < minRows && combo.filters.length > 0) continue;
    summaries.push({
      combo_id: combo.id,
      label: combo.label,
      filter_ids: combo.filters.map(filter => filter.id),
      filter_uses: [...new Set(combo.filters.flatMap(filter => filter.uses || []))],
      ...summarizeRows(matched, options),
    });
  }
  summaries.sort((a, b) => {
    const confScore = { high: 3, medium: 2, low: 1 };
    const aScore = (a.expectancy_2es_slip_0_5_round_trip || -9999) + (a.tp2_hit_rate || 0) * 100 - (a.stop_first_rate || 0) * 100;
    const bScore = (b.expectancy_2es_slip_0_5_round_trip || -9999) + (b.tp2_hit_rate || 0) * 100 - (b.stop_first_rate || 0) * 100;
    if (confScore[b.confidence] !== confScore[a.confidence]) return confScore[b.confidence] - confScore[a.confidence];
    return bScore - aScore;
  });
  return summaries;
}

const DEFAULT_25K_ACCOUNT = {
  name: '25k',
  profit_target: 1000,
  max_eod_drawdown: 1000,
  max_intraday_trailing_drawdown: 1000,
  daily_kill_loss_dollars: 600,
  max_losses_per_day: 2,
  max_trades_per_day: 4,
};

const DEFAULT_50K_ACCOUNT = {
  ...DEFAULT_25K_ACCOUNT,
  name: '50k',
  profit_target: 3000,
  max_eod_drawdown: 2000,
  max_intraday_trailing_drawdown: 2000,
};

module.exports = {
  DEFAULT_25K_ACCOUNT,
  DEFAULT_50K_ACCOUNT,
  rate,
  uniqueCount,
  confidence,
  simulateDaily,
  summarizeRows,
  buildFilterCombos,
  searchCombos,
};
