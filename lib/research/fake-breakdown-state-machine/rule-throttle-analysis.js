'use strict';

const { rounded, minutesBetween } = require('./states');

const DEFAULT_ACCOUNT = Object.freeze({
  name: '25k',
  target: 1250,
  max_eod_drawdown: 1000,
  trailing_drawdown: 1000,
  daily_kill_loss: 600,
  max_losses_per_day: 2,
});

function signalPnl(signal, mode = '2ES_FULL') {
  if (signal?.final_state !== 'TRADEABLE') return 0;
  const stopPoints = Number(signal.stop_points);
  const targetPoints = 2;
  const slippageRoundTrip = 0.5;
  if (!Number.isFinite(stopPoints)) return 0;
  if (mode === '1ES_STARTER') {
    if (signal.stop_first) return rounded(-(stopPoints + slippageRoundTrip) * 50);
    if (signal.tp2_hit) return rounded((targetPoints - slippageRoundTrip) * 50);
    return 0;
  }
  if (mode === '1ES_STARTER_ADD_AFTER_CONFIRMATION') {
    if (signal.stop_first) return rounded(-(stopPoints + slippageRoundTrip) * 50);
    if (!signal.tp2_hit) return 0;
    return rounded(((targetPoints - slippageRoundTrip) * 50) + ((targetPoints - 1 - slippageRoundTrip) * 50));
  }
  if (signal.stop_first) return rounded(-(stopPoints + slippageRoundTrip) * 100);
  if (signal.tp2_hit) return rounded((targetPoints - slippageRoundTrip) * 100);
  return 0;
}

function levelKey(signal) {
  if (Number.isFinite(signal.level)) return String(signal.level);
  if (Number.isFinite(signal.executable_level)) return String(signal.executable_level);
  const stateLevel = signal.state_events?.find(event => event.state === 'LEVEL_WATCH')?.next_target_above;
  return String(stateLevel || signal.setup_id || 'unknown');
}

function simulateThrottle(signals, options = {}) {
  const account = { ...DEFAULT_ACCOUNT, ...(options.account || {}) };
  const mode = options.mode || '2ES_FULL';
  const maxTradesPerDay = options.maxTradesPerDay ?? 2;
  const stopAfterFirstLoss = options.stopAfterFirstLoss === true;
  const dailyProfitStop = Number.isFinite(options.dailyProfitStop) ? options.dailyProfitStop : null;
  const noRepeatSameLevelAfterLoss = options.noRepeatSameLevelAfterLoss === true;
  const rows = (signals || [])
    .filter(signal => signal.final_state === 'TRADEABLE')
    .slice()
    .sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));

  const byDay = new Map();
  for (const row of rows) {
    if (!byDay.has(row.date)) byDay.set(row.date, []);
    byDay.get(row.date).push(row);
  }

  const day_results = [];
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let targetHit = false;
  let failed = false;
  let targetDate = null;
  let failDate = null;

  for (const [date, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let dayPnl = 0;
    let trades = 0;
    let losses = 0;
    let killed = false;
    const lossLevels = new Set();
    const taken = [];
    for (const signal of dayRows) {
      if (targetHit || failed || killed) continue;
      if (trades >= maxTradesPerDay) continue;
      if (losses >= account.max_losses_per_day) continue;
      if (stopAfterFirstLoss && losses > 0) continue;
      if (dailyProfitStop !== null && dayPnl >= dailyProfitStop) continue;
      if (noRepeatSameLevelAfterLoss && lossLevels.has(levelKey(signal))) continue;
      const pnl = signalPnl(signal, mode);
      trades += 1;
      dayPnl += pnl;
      cumulative += pnl;
      if (pnl < 0) {
        losses += 1;
        lossLevels.add(levelKey(signal));
      }
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
      taken.push({ setup_id: signal.setup_id, timestamp_et: signal.entry_timestamp_et, pnl: rounded(pnl), level: levelKey(signal) });
      if (dayPnl <= -account.daily_kill_loss) killed = true;
      if (cumulative >= account.target) {
        targetHit = true;
        targetDate = date;
      }
      if (cumulative <= -account.max_eod_drawdown || peak - cumulative >= account.trailing_drawdown) {
        failed = true;
        failDate = date;
      }
    }
    day_results.push({
      date,
      trades,
      losses,
      day_pnl: rounded(dayPnl),
      cumulative_pnl: rounded(cumulative),
      positive_day: dayPnl > 0,
      daily_kill_triggered: killed,
      taken,
    });
  }

  const activeDays = day_results.filter(day => day.trades > 0);
  const positiveDays = activeDays.filter(day => day.positive_day).length;
  return {
    name: options.name || 'custom',
    mode,
    max_trades_per_day: maxTradesPerDay,
    stop_after_first_loss: stopAfterFirstLoss,
    daily_profit_stop: dailyProfitStop,
    no_repeat_same_level_after_loss: noRepeatSameLevelAfterLoss,
    signals_available: rows.length,
    active_days: activeDays.length,
    positive_days: positiveDays,
    positive_day_rate: activeDays.length ? positiveDays / activeDays.length : null,
    cumulative_pnl: rounded(cumulative),
    target: account.target,
    target_hit: targetHit,
    target_date: targetDate,
    days_to_target: targetDate ? day_results.findIndex(day => day.date === targetDate) + 1 : null,
    failed,
    fail_date: failDate,
    fail_before_target: failed && !targetHit,
    fail_before_target_probability: failed && !targetHit ? 1 : 0,
    max_drawdown: rounded(maxDrawdown),
    day_results,
  };
}

function summarizeSignals(signals) {
  const rows = (signals || []).filter(signal => signal.final_state === 'TRADEABLE');
  const rate = pred => rows.length ? rows.filter(pred).length / rows.length : null;
  const nums = values => values.filter(Number.isFinite);
  const avg = values => {
    const n = nums(values);
    return n.length ? rounded(n.reduce((sum, value) => sum + value, 0) / n.length) : null;
  };
  return {
    signals: signals.length,
    tradeable: rows.length,
    tp2_hit_rate: rate(row => row.tp2_hit === true),
    tp3_hit_rate: rate(row => row.tp3_hit === true),
    stop_first_rate: rate(row => row.stop_first === true),
    average_heat_before_tp1: avg(rows.map(row => row.heat_before_tp1)),
  };
}

function analyzeRuleBThrottles(signals, options = {}) {
  const ruleB = (signals || []).filter(signal => signal.rule_id === 'B');
  const variants = [
    { name: 'baseline_2_trades_2es', maxTradesPerDay: 2, mode: '2ES_FULL' },
    { name: 'max_1_trade_per_day_2es', maxTradesPerDay: 1, mode: '2ES_FULL' },
    { name: 'stop_after_first_loss_2es', maxTradesPerDay: 2, stopAfterFirstLoss: true, mode: '2ES_FULL' },
    { name: 'stop_after_300_day_2es', maxTradesPerDay: 2, dailyProfitStop: 300, mode: '2ES_FULL' },
    { name: 'stop_after_500_day_2es', maxTradesPerDay: 2, dailyProfitStop: 500, mode: '2ES_FULL' },
    { name: 'starter_1es_only', maxTradesPerDay: 2, mode: '1ES_STARTER' },
    { name: 'starter_1es_add_after_confirmation', maxTradesPerDay: 2, mode: '1ES_STARTER_ADD_AFTER_CONFIRMATION' },
    { name: 'power_hour_only_same_as_rule_b', maxTradesPerDay: 2, mode: '2ES_FULL' },
    { name: 'no_repeat_same_level_after_loss_2es', maxTradesPerDay: 2, noRepeatSameLevelAfterLoss: true, mode: '2ES_FULL' },
  ].map(variant => simulateThrottle(ruleB, { ...variant, account: options.account }));
  const best = variants.slice().sort((a, b) => {
    if (a.target_hit !== b.target_hit) return a.target_hit ? -1 : 1;
    if (a.failed !== b.failed) return a.failed ? 1 : -1;
    return (b.cumulative_pnl || -9999) - (a.cumulative_pnl || -9999);
  })[0] || null;
  return {
    rule_id: 'B',
    base_stats: summarizeSignals(ruleB),
    variants,
    best_variant: best,
  };
}

function clusterRuleSignals(signals, ruleId) {
  const rows = (signals || []).filter(signal => signal.rule_id === ruleId);
  const byDay = new Map();
  const byWeek = new Map();
  for (const row of rows) {
    const day = row.date || String(row.entry_timestamp_et || '').slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(row);
    const week = weekKey(day);
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week).push(row);
  }
  return {
    rule_id: ruleId,
    total_signals: rows.length,
    by_day: [...byDay.entries()].map(([date, group]) => clusterGroup({ date, rows: group })),
    by_week: [...byWeek.entries()].map(([week, group]) => clusterGroup({ week, rows: group })),
  };
}

function clusterGroup({ date = null, week = null, rows }) {
  const pnl = rows.reduce((sum, row) => sum + signalPnl(row, '2ES_FULL'), 0);
  return {
    date,
    week,
    signals: rows.length,
    winners: rows.filter(row => row.tp2_hit).length,
    losers: rows.filter(row => row.stop_first).length,
    pnl_2es: rounded(pnl),
  };
}

function weekKey(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return 'unknown';
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  DEFAULT_ACCOUNT,
  signalPnl,
  levelKey,
  simulateThrottle,
  summarizeSignals,
  analyzeRuleBThrottles,
  clusterRuleSignals,
  weekKey,
};
