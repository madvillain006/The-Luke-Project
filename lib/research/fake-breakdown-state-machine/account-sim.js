'use strict';

const { rounded } = require('./states');

const ACCOUNT_25K = Object.freeze({
  name: '25k',
  profit_target: 1250,
  max_eod_drawdown: 1000,
  max_intraday_trailing_drawdown: 1000,
  max_preferred_risk_dollars: 300,
  hard_max_risk_dollars: 500,
  daily_kill_loss_dollars: 600,
  max_losses_per_day: 2,
  max_tradeable_signals_per_day: 2,
});

const ACCOUNT_50K = Object.freeze({
  ...ACCOUNT_25K,
  name: '50k',
  profit_target: 3000,
  max_eod_drawdown: 2000,
  max_intraday_trailing_drawdown: 2000,
});

function pnlForSignal(signal, mode = '2ES_FULL') {
  if (mode === '2ES_FULL') return signal?.prop?.pnl_2es_slip_0_5_round_trip || 0;
  if (mode === '1ES_STARTER') return signal?.prop?.pnl_1es_slip_0_5_round_trip || 0;
  if (mode === '1ES_ADD_LATER') return signal?.prop?.staged_add_plus_1_pnl || 0;
  return 0;
}

function signalAllowedForMode(signal, mode) {
  if (signal?.final_state !== 'TRADEABLE') return false;
  const c = signal?.trade_plan?.classification;
  if (mode === '2ES_FULL') return c === '2ES_FULL';
  if (mode === '1ES_STARTER') return ['2ES_FULL', '1ES_STARTER', '1ES_ADD_LATER'].includes(c);
  if (mode === '1ES_ADD_LATER') return ['2ES_FULL', '1ES_ADD_LATER'].includes(c);
  return false;
}

function simulateAccount(signals, options = {}) {
  const account = { ...ACCOUNT_25K, ...(options.account || {}) };
  const mode = options.mode || '2ES_FULL';
  const dailyProfitStop = Number.isFinite(options.dailyProfitStop) ? options.dailyProfitStop : null;
  const rows = (signals || [])
    .filter(signal => signalAllowedForMode(signal, mode))
    .slice()
    .sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));

  const byDay = new Map();
  for (const row of rows) {
    if (!byDay.has(row.date)) byDay.set(row.date, []);
    byDay.get(row.date).push(row);
  }

  const dayResults = [];
  let cumulativePnl = 0;
  let accountPeak = 0;
  let maxDrawdown = 0;
  let targetHit = false;
  let failed = false;
  let targetDate = null;
  let failDate = null;

  for (const [date, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let dayPnl = 0;
    let dayPeak = 0;
    let trades = 0;
    let losses = 0;
    let dailyKilled = false;
    const taken = [];

    for (const signal of dayRows) {
      if (targetHit || failed) continue;
      if (trades >= account.max_tradeable_signals_per_day) continue;
      if (losses >= account.max_losses_per_day) continue;
      if (dailyKilled) continue;
      if (dailyProfitStop !== null && dayPnl >= dailyProfitStop) continue;

      const pnl = pnlForSignal(signal, mode);
      trades += 1;
      dayPnl += pnl;
      cumulativePnl += pnl;
      if (pnl < 0) losses += 1;
      dayPeak = Math.max(dayPeak, dayPnl);
      accountPeak = Math.max(accountPeak, cumulativePnl);
      maxDrawdown = Math.max(maxDrawdown, accountPeak - cumulativePnl);
      taken.push({ setup_id: signal.setup_id, timestamp_et: signal.entry_timestamp_et, pnl: rounded(pnl) });

      if (dayPnl <= -account.daily_kill_loss_dollars) dailyKilled = true;
      if (cumulativePnl >= account.profit_target) {
        targetHit = true;
        targetDate = date;
      }
      const eodFail = cumulativePnl <= -account.max_eod_drawdown;
      const trailingFail = accountPeak - cumulativePnl >= account.max_intraday_trailing_drawdown;
      if (eodFail || trailingFail) {
        failed = true;
        failDate = date;
      }
    }

    dayResults.push({
      date,
      trades,
      losses,
      day_pnl: rounded(dayPnl),
      cumulative_pnl: rounded(cumulativePnl),
      positive_day: dayPnl > 0,
      daily_kill_triggered: dailyKilled,
      target_hit_by_day_end: targetHit,
      account_failed_by_day_end: failed,
      taken,
    });
  }

  const activeDays = dayResults.filter(day => day.trades > 0);
  const positiveDays = activeDays.filter(day => day.positive_day).length;
  return {
    account: account.name,
    mode,
    daily_profit_stop: dailyProfitStop,
    signals_available: rows.length,
    active_days: activeDays.length,
    positive_days: positiveDays,
    positive_day_rate: activeDays.length ? positiveDays / activeDays.length : null,
    cumulative_pnl: rounded(cumulativePnl),
    target: account.profit_target,
    target_hit: targetHit,
    target_date: targetDate,
    days_to_target: targetDate ? dayResults.findIndex(day => day.date === targetDate) + 1 : null,
    account_failed: failed,
    fail_date: failDate,
    fail_before_target: failed && !targetHit,
    fail_before_target_probability: failed && !targetHit ? 1 : 0,
    max_drawdown: rounded(maxDrawdown),
    day_results: dayResults,
  };
}

function simulateRuleSet(signals, options = {}) {
  const accounts = options.accounts || [ACCOUNT_25K, ACCOUNT_50K];
  const modes = options.modes || ['2ES_FULL', '1ES_STARTER'];
  const dailyProfitStops = options.dailyProfitStops || [null, 300, 500];
  const out = [];
  for (const account of accounts) {
    for (const mode of modes) {
      for (const dailyProfitStop of dailyProfitStops) {
        out.push(simulateAccount(signals, { account, mode, dailyProfitStop }));
      }
    }
  }
  return out;
}

module.exports = {
  ACCOUNT_25K,
  ACCOUNT_50K,
  pnlForSignal,
  signalAllowedForMode,
  simulateAccount,
  simulateRuleSet,
};
