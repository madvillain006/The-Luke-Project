'use strict';

const { average, median, tsMs } = require('../common');
const {
  SLIPPAGE_MODE_NAMES,
  rounded,
  slippageModel,
  roundTripSlippageModel,
  applyLongSlippage,
} = require('./slippage-models');
const {
  SAME_BAR_POLICIES,
  normalizeSameBarPolicy,
  firstTouchOutcome,
} = require('./same-bar-policy');

const ES_POINT_VALUE = 50;
const DEFAULT_COMMISSION_PER_CONTRACT = 5;
const ACCOUNT_RULES = Object.freeze({
  '25k_eval': Object.freeze({
    id: '25k_eval',
    label: '25K Pro Eval',
    profitTarget: 1250,
    payoutTarget: null,
    maxDrawdown: 1000,
    dailyLossLimit: null,
    drawdownType: 'EOD',
    maxContracts: 2,
    consistencyLimit: null,
    minPayoutDays: null,
  }),
  '50k_eval': Object.freeze({
    id: '50k_eval',
    label: '50K Pro Eval',
    profitTarget: 3000,
    payoutTarget: null,
    maxDrawdown: 2000,
    dailyLossLimit: 1200,
    drawdownType: 'EOD',
    maxContracts: 4,
    consistencyLimit: null,
    minPayoutDays: null,
  }),
  '25k_funded': Object.freeze({
    id: '25k_funded',
    label: '25K Pro Funded',
    profitTarget: null,
    payoutTarget: 250,
    maxDrawdown: 1000,
    dailyLossLimit: null,
    drawdownType: 'EOD',
    maxContracts: 2,
    consistencyLimit: 0.4,
    minPayoutDays: 3,
  }),
  '50k_funded': Object.freeze({
    id: '50k_funded',
    label: '50K Pro Funded',
    profitTarget: null,
    payoutTarget: 500,
    maxDrawdown: 2000,
    dailyLossLimit: 1200,
    drawdownType: 'EOD',
    maxContracts: 4,
    consistencyLimit: 0.4,
    minPayoutDays: 3,
  }),
});
const ACCOUNT_25K = ACCOUNT_RULES['25k_eval'];

function resolveAccount(account = ACCOUNT_25K) {
  if (typeof account === 'string') return ACCOUNT_RULES[account] || ACCOUNT_25K;
  if (account && typeof account === 'object') return { ...ACCOUNT_25K, ...account };
  return ACCOUNT_25K;
}

function datePart(timestamp) {
  return String(timestamp || '').slice(0, 10);
}

function signalTime(signal) {
  return tsMs(signal.entry_timestamp_et) ?? tsMs(signal.signal_timestamp_et) ?? 0;
}

function maxDrawdown(values) {
  let peak = 0;
  let max = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    max = Math.max(max, peak - value);
  }
  return rounded(max);
}

function evaluateSignal(signal, bars, options = {}) {
  const contracts = Number.isFinite(options.contracts) ? options.contracts : 1;
  const commission = Number.isFinite(options.commissionPerContract)
    ? options.commissionPerContract
    : DEFAULT_COMMISSION_PER_CONTRACT;
  const model = options.slippageModel || slippageModel(options.slippageMode, options.customSlippagePoints);
  const sameBarPolicy = normalizeSameBarPolicy(options.sameBarPolicy);
  const priced = applyLongSlippage(signal, model);
  const outcome = firstTouchOutcome({
    bars,
    entryTimestamp: signal.entry_timestamp_et,
    entryIndex: signal.entry_index,
    entryPrice: priced.entry_effective,
    stopPrice: priced.stop_effective,
    targetPrice: priced.tp1_effective,
    policy: sameBarPolicy,
  });
  const resultPointsPerContract = outcome.excluded ? 0 : rounded(outcome.exit_price - priced.entry_effective);
  const resultContractPoints = rounded(resultPointsPerContract * contracts);
  const pnlDollars = rounded(resultContractPoints * ES_POINT_VALUE - contracts * commission);
  const optimisticWouldWin = outcome.ambiguous && Number.isFinite(priced.tp1_effective) && priced.tp1_effective > priced.entry_effective;

  return {
    signal_id: signal.id,
    family: signal.family,
    date: signal.date || datePart(signal.entry_timestamp_et),
    setup_timestamp_et: signal.setup_timestamp_et || null,
    confirmation_timestamp_et: signal.confirmation_timestamp_et || null,
    signal_timestamp_et: signal.signal_timestamp_et || null,
    entry_timestamp_et: signal.entry_timestamp_et,
    exit_timestamp_et: outcome.exit_timestamp_et,
    level: signal.level,
    source_combo: signal.source_combo || signal.sources || null,
    raw_entry: signal.raw_entry,
    raw_stop: signal.raw_stop,
    raw_tp1: signal.raw_tp1,
    entry_effective: priced.entry_effective,
    stop_effective: priced.stop_effective,
    tp1_effective: priced.tp1_effective,
    slippage_mode: model.mode,
    slippage_round_trip_points: model.roundTrip,
    same_bar_policy: sameBarPolicy,
    contracts,
    outcome: outcome.outcome,
    touch: outcome.touch,
    ambiguous_same_bar: outcome.ambiguous === true,
    ambiguous_excluded: outcome.excluded === true,
    win_converted_to_loss: outcome.winConvertedToLoss === true && optimisticWouldWin,
    target_hit: outcome.targetHit === true,
    stop_hit: outcome.stopHit === true,
    target_first: outcome.outcome === 'target_first' || outcome.outcome === 'ambiguous_target_first',
    stop_first: outcome.outcome === 'stop_first' || outcome.outcome === 'ambiguous_stop_first',
    result_points_per_contract: resultPointsPerContract,
    result_contract_points: resultContractPoints,
    pnl_dollars: pnlDollars,
  };
}

function summarizeTrades({ totalSignals, trades, skippedSignals = 0, account = ACCOUNT_25K }) {
  const accountRules = resolveAccount(account);
  const pnls = trades.map(trade => trade.pnl_dollars).filter(Number.isFinite);
  let cumulative = 0;
  let targetDate = null;
  let payoutTargetDate = null;
  let failDate = null;
  const equity = [];
  const dayMap = new Map();
  const hasDll = Number.isFinite(accountRules.dailyLossLimit);

  for (const trade of trades) {
    cumulative = rounded(cumulative + trade.pnl_dollars);
    equity.push(cumulative);
    const date = trade.date || datePart(trade.entry_timestamp_et);
    if (!dayMap.has(date)) dayMap.set(date, { date, trades: 0, pnl: 0, wins: 0, losses: 0 });
    const day = dayMap.get(date);
    day.trades += 1;
    day.pnl = rounded(day.pnl + trade.pnl_dollars);
    if (trade.pnl_dollars > 0) day.wins += 1;
    if (trade.pnl_dollars < 0) day.losses += 1;
    if (!targetDate && Number.isFinite(accountRules.profitTarget) && cumulative >= accountRules.profitTarget) targetDate = date;
    if (!payoutTargetDate && Number.isFinite(accountRules.payoutTarget) && cumulative >= accountRules.payoutTarget) payoutTargetDate = date;
    const drawdown = maxDrawdown(equity);
    if (!failDate && (
      cumulative <= -accountRules.maxDrawdown
      || drawdown >= accountRules.maxDrawdown
      || (hasDll && day.pnl <= -accountRules.dailyLossLimit)
    )) {
      failDate = date;
    }
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const positiveDays = days.filter(day => day.pnl > 0).length;
  const grossProfit = rounded(pnls.filter(value => value > 0).reduce((sum, value) => sum + value, 0));
  const grossLoss = rounded(Math.abs(pnls.filter(value => value < 0).reduce((sum, value) => sum + value, 0)));
  const profitFactor = grossLoss > 0 ? rounded(grossProfit / grossLoss) : (grossProfit > 0 ? 'Infinity' : 0);
  const totalPnl = rounded(pnls.reduce((sum, value) => sum + value, 0));
  const topWinningDayPnl = rounded(days.reduce((best, day) => Math.max(best, day.pnl > 0 ? day.pnl : 0), 0));
  const consistencyRatio = totalPnl > 0 && topWinningDayPnl > 0 ? rounded(topWinningDayPnl / totalPnl) : null;
  const consistencyPass = Number.isFinite(accountRules.consistencyLimit) && consistencyRatio !== null
    ? consistencyRatio <= accountRules.consistencyLimit
    : null;
  const daysToEvalTarget = targetDate ? days.findIndex(day => day.date === targetDate) + 1 : null;
  const daysToPayoutTarget = payoutTargetDate ? days.findIndex(day => day.date === payoutTargetDate) + 1 : null;
  const accountFail = Boolean(failDate);

  return {
    account_id: accountRules.id || null,
    account_label: accountRules.label || null,
    account_profit_target: Number.isFinite(accountRules.profitTarget) ? accountRules.profitTarget : null,
    account_payout_target: Number.isFinite(accountRules.payoutTarget) ? accountRules.payoutTarget : null,
    account_max_drawdown_limit: accountRules.maxDrawdown,
    account_daily_loss_limit: hasDll ? accountRules.dailyLossLimit : null,
    account_drawdown_type: accountRules.drawdownType || null,
    account_max_contracts: accountRules.maxContracts || null,
    total_signals: totalSignals,
    filled_signals: trades.length,
    skipped_overlap_signals: skippedSignals,
    tp1_hit: trades.filter(trade => trade.target_hit).length,
    stop_hit: trades.filter(trade => trade.stop_hit).length,
    stop_first: trades.filter(trade => trade.stop_first).length,
    target_first: trades.filter(trade => trade.target_first).length,
    ambiguous_same_bar_count: trades.filter(trade => trade.ambiguous_same_bar).length,
    ambiguous_excluded_count: trades.filter(trade => trade.ambiguous_excluded).length,
    wins_converted_to_losses: trades.filter(trade => trade.win_converted_to_loss).length,
    average_pnl: rounded(average(pnls)),
    median_pnl: rounded(median(pnls)),
    total_pnl: rounded(pnls.reduce((sum, value) => sum + value, 0)),
    gross_profit: grossProfit,
    gross_loss: grossLoss,
    profit_factor: profitFactor,
    expectancy: rounded(average(pnls)),
    max_drawdown: maxDrawdown(equity),
    daily_drawdown_failures: hasDll ? days.filter(day => day.pnl <= -accountRules.dailyLossLimit).length : 0,
    positive_days: positiveDays,
    active_days: days.length,
    positive_day_rate: days.length ? rounded(positiveDays / days.length) : null,
    net_profitable: totalPnl > 0,
    account_survives: !accountFail,
    account_viable_net_profitable: totalPnl > 0 && !accountFail,
    eval_target_hit: Boolean(targetDate),
    funded_payout_target_hit: Boolean(payoutTargetDate),
    days_to_profit_target: daysToEvalTarget,
    days_to_eval_target: daysToEvalTarget,
    days_to_payout_target: daysToPayoutTarget,
    days_to_1250: accountRules.profitTarget === 1250 ? daysToEvalTarget : null,
    target_date: targetDate,
    payout_target_date: payoutTargetDate,
    consistency_limit: accountRules.consistencyLimit,
    consistency_ratio: consistencyRatio,
    consistency_pass: consistencyPass,
    top_winning_day_pnl: topWinningDayPnl,
    account_fail: accountFail,
    fail_date: failDate,
    fail_before_target: Boolean(failDate && !targetDate),
    day_results: days,
  };
}

function evaluateSignals(signals, context, options = {}) {
  const sorted = (signals || []).slice().sort((a, b) => signalTime(a) - signalTime(b));
  const barsByDate = context?.barsByDate || new Map();
  const trades = [];
  let skippedSignals = 0;
  let availableAfter = -Infinity;

  for (const signal of sorted) {
    const entryMs = signalTime(signal);
    if (options.enforceSingleOpen !== false && entryMs <= availableAfter) {
      skippedSignals += 1;
      continue;
    }
    const bars = barsByDate.get(signal.date || datePart(signal.entry_timestamp_et)) || [];
    const trade = evaluateSignal(signal, bars, options);
    trades.push(trade);
    const exitMs = tsMs(trade.exit_timestamp_et);
    availableAfter = Number.isFinite(exitMs) ? exitMs : entryMs;
  }

  return {
    config: {
      slippage_mode: options.slippageModel?.mode || options.slippageMode || 'both_sides_0_25_each',
      same_bar_policy: normalizeSameBarPolicy(options.sameBarPolicy),
      contracts: Number.isFinite(options.contracts) ? options.contracts : 1,
      enforce_single_open: options.enforceSingleOpen !== false,
    },
    summary: summarizeTrades({
      totalSignals: sorted.length,
      trades,
      skippedSignals,
      account: options.account || ACCOUNT_25K,
    }),
    trades,
  };
}

function evaluateMode(signals, context, options = {}) {
  const one = evaluateSignals(signals, context, { ...options, contracts: 1, account: options.account || '25k_eval' });
  const two = evaluateSignals(signals, context, { ...options, contracts: 2, account: options.account || '25k_eval' });
  const one50 = evaluateSignals(signals, context, { ...options, contracts: 1, account: '50k_eval' });
  const two50 = evaluateSignals(signals, context, { ...options, contracts: 2, account: '50k_eval' });
  return {
    mode: options.slippageModel?.mode || options.slippageMode || 'both_sides_0_25_each',
    same_bar_policy: normalizeSameBarPolicy(options.sameBarPolicy),
    one_es: one.summary,
    two_es: two.summary,
    one_es_50k: one50.summary,
    two_es_50k: two50.summary,
    one_es_trades: one.trades,
    two_es_trades: two.trades,
    one_es_50k_trades: one50.trades,
    two_es_50k_trades: two50.trades,
  };
}

function evaluateSlippageModes(signals, context, options = {}) {
  return SLIPPAGE_MODE_NAMES.map(mode => evaluateMode(signals, context, {
    ...options,
    slippageMode: mode,
    sameBarPolicy: options.sameBarPolicy || 'stop_first_hard',
  }));
}

function evaluateSameBarPolicies(signals, context, options = {}) {
  return SAME_BAR_POLICIES.map(policy => evaluateMode(signals, context, {
    ...options,
    slippageMode: options.slippageMode || 'round_trip_0_50',
    sameBarPolicy: policy,
  }));
}

function slippageSensitivity(signals, context, roundTrips = [0, 0.25, 0.5, 0.75, 1, 1.5, 2], options = {}) {
  return roundTrips.map(roundTrip => evaluateMode(signals, context, {
    ...options,
    slippageModel: roundTripSlippageModel(roundTrip),
    sameBarPolicy: options.sameBarPolicy || 'stop_first_hard',
  })).map(result => ({
    round_trip_slippage: result.one_es.slippage_round_trip_points ?? Number(result.mode.replace('round_trip_', '').replace('_', '.')),
    mode: result.mode,
    expectancy: result.one_es.expectancy,
    tp1_hit: result.one_es.tp1_hit,
    stop_first: result.one_es.stop_first,
    total_pnl: result.one_es.total_pnl,
    max_drawdown: result.one_es.max_drawdown,
    account_fail: result.one_es.account_fail,
    account_viable_net_profitable: result.one_es.account_viable_net_profitable,
    positive_day_rate: result.one_es.positive_day_rate,
    one_es: result.one_es,
    two_es: result.two_es,
    one_es_50k: result.one_es_50k,
    two_es_50k: result.two_es_50k,
  }));
}

function breakEvenSlippage(curve) {
  const rows = (curve || []).slice().sort((a, b) => a.round_trip_slippage - b.round_trip_slippage);
  if (!rows.length) return null;
  if (rows[0].expectancy <= 0) return 0;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const next = rows[i];
    if (next.expectancy === 0) return next.round_trip_slippage;
    if (prev.expectancy > 0 && next.expectancy < 0) {
      const span = next.round_trip_slippage - prev.round_trip_slippage;
      const ratio = prev.expectancy / (prev.expectancy - next.expectancy);
      return rounded(prev.round_trip_slippage + span * ratio);
    }
  }
  return `>${rows[rows.length - 1].round_trip_slippage}`;
}

module.exports = {
  ES_POINT_VALUE,
  DEFAULT_COMMISSION_PER_CONTRACT,
  ACCOUNT_RULES,
  ACCOUNT_25K,
  resolveAccount,
  evaluateSignal,
  evaluateSignals,
  evaluateMode,
  evaluateSlippageModes,
  evaluateSameBarPolicies,
  slippageSensitivity,
  breakEvenSlippage,
  summarizeTrades,
};
