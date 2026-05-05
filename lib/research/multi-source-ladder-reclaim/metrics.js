'use strict';

const { average, median } = require('../common');
const { computePlanOutcome } = require('../fake-breakdown-v2/metrics');
const { rounded } = require('./level-clusters');

const ACCOUNT_25K = Object.freeze({
  name: '25k',
  profit_target: 1250,
  success_mode: 'continuous_profitability',
  target_required_for_viability: false,
  max_eod_drawdown: 1000,
  max_intraday_trailing_drawdown: 1000,
  daily_kill_loss_dollars: null,
  max_losses_per_day: 2,
  max_trades_per_day: 2,
  min_profit_factor: 1.05,
  min_positive_day_rate: null,
  min_average_trade_pnl: 0,
});

const ACCOUNT_50K = Object.freeze({
  ...ACCOUNT_25K,
  name: '50k',
  profit_target: 3000,
  max_eod_drawdown: 2000,
  max_intraday_trailing_drawdown: 2000,
  daily_kill_loss_dollars: 1200,
});

function stopPoints(entryPrice, stopPrice) {
  return Number.isFinite(entryPrice) && Number.isFinite(stopPrice) ? rounded(entryPrice - stopPrice) : null;
}

function riskDollars(stop, contracts = 2) {
  if (!Number.isFinite(stop)) return null;
  return rounded(stop * 50 * contracts);
}

function classifyRow(row, config = {}) {
  const preferred = Number.isFinite(config.preferred_max_stop_points) ? config.preferred_max_stop_points : 3;
  const hard = Number.isFinite(config.hard_max_stop_points) ? config.hard_max_stop_points : 5;
  if (row.first_reclaimed_cluster_is_chop) return { classification: 'PASS_CHOP', classification_reason: 'first_reclaimed_cluster_is_chop_or_veto' };
  if (row.basis_method === 'fixed_plus_30_proxy') return { classification: 'PASS_NO_BASIS', classification_reason: 'fixed_plus_30_diagnostic_only' };
  if (!Number.isFinite(row.tp1)) return { classification: 'PASS_NO_TARGET', classification_reason: 'missing_tp1_target' };
  if (!Number.isFinite(row.stop_points) || row.stop_points <= 0) return { classification: 'PASS_RISK', classification_reason: 'invalid_stop' };
  if (row.stop_points > hard) return { classification: 'PASS_RISK', classification_reason: 'stop_wider_than_hard_max' };
  if (row.target_model.includes('cluster') && !row.next_cluster_target) {
    return { classification: 'PASS_NO_TARGET', classification_reason: 'missing_next_cluster_target' };
  }
  if (row.stop_points <= preferred && row.risk_dollars_2es <= 300) {
    return { classification: 'TRADEABLE_RESEARCH', classification_reason: 'first_reclaim_prop_risk_and_tp1_available' };
  }
  return { classification: 'WATCHLIST_ONLY', classification_reason: 'structure_exists_but_risk_or_confirmation_needs_review' };
}

function pnlForOutcome(row, contracts = 2, slippageRoundTripPoints = 0.5) {
  const dollarsPerPoint = 50 * contracts;
  if (row.same_bar_ambiguity || row.stop_first) return rounded(-(row.stop_points || 0) * dollarsPerPoint - slippageRoundTripPoints * dollarsPerPoint);
  if (row.tp1_hit) return rounded((row.tp1 - row.entry_price) * dollarsPerPoint - slippageRoundTripPoints * dollarsPerPoint);
  const r60 = Number.isFinite(row.r_60m) && Number.isFinite(row.stop_points)
    ? row.r_60m * row.stop_points * dollarsPerPoint
    : 0;
  return rounded(r60 - slippageRoundTripPoints * dollarsPerPoint);
}

function annotateOutcome(row, bars, config = {}) {
  const outcome = computePlanOutcome({
    bars,
    entryTimestamp: row.entry_timestamp_et,
    entryPrice: row.entry_price,
    stopPrice: row.stop_price,
    tp1: row.tp1,
    tp2: row.tp2,
  });
  const stop = stopPoints(row.entry_price, row.stop_price);
  const annotated = {
    ...row,
    stop_points: stop,
    risk_dollars_2es: riskDollars(stop, 2),
    risk_dollars_1es: riskDollars(stop, 1),
    ...outcome,
  };
  annotated.next_cluster_hit = Boolean(annotated.tp2_hit && row.next_cluster_target);
  annotated.second_cluster_hit = Boolean(annotated.tp2_hit && row.second_cluster_target);
  annotated.pnl_2es_slip_0_5_round_trip = pnlForOutcome(annotated, 2, 0.5);
  annotated.pnl_1es_slip_0_5_round_trip = pnlForOutcome(annotated, 1, 0.5);
  return { ...annotated, ...classifyRow(annotated, config) };
}

function rate(rows, predicate) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function summarizeRows(rows) {
  const measured = rows.filter(row => Number.isFinite(row.entry_price));
  const tradeable = rows.filter(row => row.classification === 'TRADEABLE_RESEARCH');
  const sample = tradeable.length ? tradeable : measured;
  const plus2 = sample.filter(row => row.target_model === 'fixed_plus_2');
  const plus3 = sample.filter(row => row.target_model === 'fixed_plus_3');
  const nextCluster = sample.filter(row => row.next_cluster_target);
  return {
    rows: rows.length,
    unique_setups: new Set(rows.map(row => row.setup_id)).size,
    tradeable_research: tradeable.length,
    watchlist_only: rows.filter(row => row.classification === 'WATCHLIST_ONLY').length,
    pass_risk: rows.filter(row => row.classification === 'PASS_RISK').length,
    pass_no_target: rows.filter(row => row.classification === 'PASS_NO_TARGET').length,
    pass_no_basis: rows.filter(row => row.classification === 'PASS_NO_BASIS').length,
    pass_chop: rows.filter(row => row.classification === 'PASS_CHOP').length,
    tp2_hit_rate: rate(plus2, row => row.tp1_hit),
    tp3_hit_rate: rate(plus3, row => row.tp1_hit),
    tp1_hit_rate: rate(sample, row => row.tp1_hit),
    stop_first_rate: rate(sample, row => row.stop_first || row.same_bar_ambiguity),
    next_cluster_hit_rate: rate(nextCluster, row => row.next_cluster_hit),
    avg_heat_before_tp1: rounded(average(sample.map(row => row.max_heat_before_tp1))),
    median_heat_before_tp1: rounded(median(sample.map(row => row.max_heat_before_tp1))),
    avg_r_60m: rounded(average(sample.map(row => row.r_60m))),
    confidence: new Set(sample.map(row => row.setup_id)).size >= 100 ? 'medium' : 'low',
  };
}

function summarizeBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] == null ? 'unknown' : String(row[key]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([value, group]) => ({
    [key]: value,
    ...summarizeRows(group),
  })).sort((a, b) => b.unique_setups - a.unique_setups);
}

function accountRows(rows) {
  const bestBySetup = new Map();
  const candidates = rows
    .filter(row => row.classification === 'TRADEABLE_RESEARCH')
    .filter(row => row.target_model === 'fixed_plus_2')
    .sort((a, b) => {
      const t = String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et));
      if (t !== 0) return t;
      return (a.stop_points || 999) - (b.stop_points || 999);
    });
  for (const row of candidates) {
    if (!bestBySetup.has(row.setup_id)) bestBySetup.set(row.setup_id, row);
  }
  return [...bestBySetup.values()].sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));
}

function simulateAccount(rows, account, mode = '2ES_FULL') {
  const candidates = accountRows(rows);
  const byDay = new Map();
  for (const row of candidates) {
    if (!byDay.has(row.date)) byDay.set(row.date, []);
    byDay.get(row.date).push(row);
  }
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let failed = false;
  let targetHit = false;
  let failDate = null;
  let targetDate = null;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  const dayResults = [];
  const hasDailyKill = Number.isFinite(account.daily_kill_loss_dollars);
  for (const [date, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let trades = 0;
    let losses = 0;
    let dayPnl = 0;
    let dailyKilled = false;
    const taken = [];
    for (const row of dayRows) {
      if (failed || dailyKilled) continue;
      if (trades >= account.max_trades_per_day || losses >= account.max_losses_per_day) continue;
      const pnl = mode === '1ES_STARTER' ? row.pnl_1es_slip_0_5_round_trip : row.pnl_2es_slip_0_5_round_trip;
      trades += 1;
      totalTrades += 1;
      if (pnl < 0) losses += 1;
      if (pnl > 0) {
        winningTrades += 1;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losingTrades += 1;
        grossLoss += Math.abs(pnl);
      }
      dayPnl += pnl;
      cumulative += pnl;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
      taken.push({ setup_id: row.setup_id, entry_timestamp_et: row.entry_timestamp_et, pnl });
      if (hasDailyKill && dayPnl <= -account.daily_kill_loss_dollars) dailyKilled = true;
      if (!targetHit && cumulative >= account.profit_target) {
        targetHit = true;
        targetDate = date;
      }
      if (cumulative <= -account.max_eod_drawdown || peak - cumulative >= account.max_intraday_trailing_drawdown) {
        failed = true;
        failDate = date;
      }
    }
    dayResults.push({
      date,
      trades,
      losses,
      day_pnl: rounded(dayPnl),
      cumulative_pnl: rounded(cumulative),
      daily_kill_triggered: dailyKilled,
      positive_day: dayPnl > 0,
      taken,
    });
  }
  const tradedDays = dayResults.filter(day => day.trades > 0);
  const positiveDays = tradedDays.filter(day => day.positive_day).length;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  const averageTradePnl = totalTrades ? cumulative / totalTrades : 0;
  const positiveDayRate = tradedDays.length ? positiveDays / tradedDays.length : null;
  const continuousProfitable = Boolean(
    !failed
    && cumulative > 0
    && profitFactor >= account.min_profit_factor
    && averageTradePnl > account.min_average_trade_pnl
    && (!Number.isFinite(account.min_positive_day_rate) || positiveDayRate == null || positiveDayRate >= account.min_positive_day_rate)
  );
  return {
    account: account.name,
    mode,
    success_mode: account.success_mode,
    signals_available: candidates.length,
    active_days: tradedDays.length,
    total_trades: totalTrades,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    win_rate: totalTrades ? winningTrades / totalTrades : null,
    gross_profit: rounded(grossProfit),
    gross_loss: rounded(grossLoss),
    profit_factor: Number.isFinite(profitFactor) ? rounded(profitFactor) : 'Infinity',
    average_trade_pnl: rounded(averageTradePnl),
    positive_days: positiveDays,
    positive_day_rate: positiveDayRate == null ? null : rounded(positiveDayRate),
    cumulative_pnl: rounded(cumulative),
    target: account.profit_target,
    target_required_for_viability: account.target_required_for_viability,
    target_hit: targetHit,
    target_date: targetDate,
    days_to_target: targetDate ? dayResults.findIndex(day => day.date === targetDate) + 1 : null,
    account_failed: failed,
    fail_date: failDate,
    fail_before_target: failed && !targetHit,
    max_drawdown: rounded(maxDrawdown),
    survived_without_blowup: !failed,
    continuous_profitable: continuousProfitable,
    viability_reason: continuousProfitable
      ? 'positive_continuous_pnl_without_drawdown_failure'
      : 'not_continuously_profitable_or_drawdown_failed',
    day_results: dayResults,
  };
}

module.exports = {
  ACCOUNT_25K,
  ACCOUNT_50K,
  stopPoints,
  riskDollars,
  classifyRow,
  annotateOutcome,
  summarizeRows,
  summarizeBy,
  accountRows,
  simulateAccount,
};
