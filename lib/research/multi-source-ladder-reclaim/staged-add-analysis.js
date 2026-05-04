'use strict';

const { tsMs } = require('../common');
const { firstHitRows } = require('../fake-breakdown-v2/metrics');
const { ACCOUNT_25K, accountRows } = require('./metrics');
const { rounded } = require('./level-clusters');

const VARIANTS = Object.freeze([
  '1ES_ONLY',
  '1ES_ADD_AFTER_PLUS_1',
  '1ES_ADD_AFTER_PLUS_2',
  '1ES_ADD_AFTER_RETEST_HOLD',
  '1ES_ADD_AFTER_NEXT_CLUSTER_BREAK',
]);

function futureBars(bars, timestamp, maxMinutes = 90) {
  const start = tsMs(timestamp);
  if (!Number.isFinite(start)) return [];
  const end = start + maxMinutes * 60000;
  return (bars || []).filter(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t >= start && t <= end;
  });
}

function starterPnl(row) {
  if (row.same_bar_ambiguity || row.stop_first) return rounded(-((row.stop_points || 0) + 0.5) * 50);
  if (row.tp1_hit) return rounded((2 - 0.5) * 50);
  return 0;
}

function findTrigger(row, bars, variant) {
  const entry = row.entry_price;
  const stop = row.stop_price;
  if (!Number.isFinite(entry) || !Number.isFinite(stop)) return null;
  const window = futureBars(bars, row.entry_timestamp_et, 60);
  if (variant === '1ES_ADD_AFTER_PLUS_1') return priceTrigger(window, row, entry + 1);
  if (variant === '1ES_ADD_AFTER_PLUS_2') return priceTrigger(window, row, entry + 2);
  if (variant === '1ES_ADD_AFTER_NEXT_CLUSTER_BREAK') {
    if (!Number.isFinite(row.next_cluster_target) || row.next_cluster_target <= entry + 0.5) return null;
    return priceTrigger(window, row, row.next_cluster_target);
  }
  if (variant === '1ES_ADD_AFTER_RETEST_HOLD') {
    for (const bar of window) {
      if (bar.timestamp === row.entry_timestamp_et) continue;
      if (bar.low <= entry + 0.25 && bar.close >= entry) {
        return { timestamp: bar.timestamp, price: rounded(entry + 0.25), trigger: 'retest_hold' };
      }
      if (bar.low <= stop) return null;
    }
  }
  return null;
}

function priceTrigger(window, row, price) {
  for (const bar of window) {
    const hitStop = Number.isFinite(row.stop_price) && bar.low <= row.stop_price;
    const hitTrigger = bar.high >= price;
    if (hitStop && hitTrigger) return null;
    if (hitStop) return null;
    if (hitTrigger) return { timestamp: bar.timestamp, price: rounded(price), trigger: 'price' };
  }
  return null;
}

function addTargetStop(row, trigger, variant) {
  const entry = row.entry_price;
  if (variant === '1ES_ADD_AFTER_NEXT_CLUSTER_BREAK') {
    const target = Number.isFinite(row.second_cluster_target) && row.second_cluster_target > trigger.price + 0.5
      ? row.second_cluster_target
      : trigger.price + 2;
    return { target: rounded(target), stop: rounded(trigger.price - 2) };
  }
  if (variant === '1ES_ADD_AFTER_PLUS_2') return { target: rounded(entry + 3), stop: rounded(entry + 1) };
  if (variant === '1ES_ADD_AFTER_PLUS_1') return { target: rounded(entry + 3), stop: rounded(entry) };
  return { target: rounded(entry + 3), stop: row.stop_price };
}

function addLegPnl(row, bars, variant) {
  const trigger = findTrigger(row, bars, variant);
  if (!trigger) return { add_triggered: false, add_pnl: 0, add_time_in_trade: null };
  const { target, stop } = addTargetStop(row, trigger, variant);
  const hits = firstHitRows(futureBars(bars, trigger.timestamp, 90), { stopPrice: stop, tp1: target, tp2: null });
  if (hits.sameBarAmbiguity || hits.first === 'STOP_FIRST') {
    return {
      add_triggered: true,
      add_price: trigger.price,
      add_target: target,
      add_stop: stop,
      add_pnl: rounded(-(trigger.price - stop + 0.5) * 50),
      add_time_in_trade: timeTo(trigger.timestamp, hits.stopAt),
    };
  }
  if (hits.tp1At) {
    return {
      add_triggered: true,
      add_price: trigger.price,
      add_target: target,
      add_stop: stop,
      add_pnl: rounded((target - trigger.price - 0.5) * 50),
      add_time_in_trade: timeTo(trigger.timestamp, hits.tp1At),
    };
  }
  return {
    add_triggered: true,
    add_price: trigger.price,
    add_target: target,
    add_stop: stop,
    add_pnl: 0,
    add_time_in_trade: null,
  };
}

function variantOutcome(row, bars, variant) {
  const starter = starterPnl(row);
  if (variant === '1ES_ONLY') {
    return {
      variant,
      pnl: starter,
      add_triggered: false,
      time_in_trade: row.time_to_tp1 ?? row.time_to_stop ?? null,
    };
  }
  const add = addLegPnl(row, bars, variant);
  return {
    variant,
    pnl: rounded(starter + add.add_pnl),
    add_triggered: add.add_triggered,
    add_price: add.add_price ?? null,
    add_target: add.add_target ?? null,
    add_stop: add.add_stop ?? null,
    add_pnl: add.add_pnl,
    time_in_trade: Math.max(row.time_to_tp1 ?? 0, add.add_time_in_trade ?? 0) || null,
  };
}

function simulateStagedVariant(rows, barsByDate, variant, account = ACCOUNT_25K) {
  const candidates = accountRows(rows).sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));
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
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let addTriggers = 0;
  const day_results = [];
  const row_results = [];

  for (const [date, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let trades = 0;
    let dayLosses = 0;
    let dayPnl = 0;
    let dailyKilled = false;
    for (const row of dayRows) {
      if (failed || dailyKilled) continue;
      if (trades >= account.max_trades_per_day || dayLosses >= account.max_losses_per_day) continue;
      const outcome = variantOutcome(row, barsByDate.get(row.date) || [], variant);
      trades += 1;
      totalTrades += 1;
      if (outcome.add_triggered) addTriggers += 1;
      if (outcome.pnl > 0) {
        wins += 1;
        grossProfit += outcome.pnl;
      } else if (outcome.pnl < 0) {
        losses += 1;
        dayLosses += 1;
        grossLoss += Math.abs(outcome.pnl);
      }
      dayPnl += outcome.pnl;
      cumulative += outcome.pnl;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
      row_results.push({ setup_id: row.setup_id, date: row.date, entry_timestamp_et: row.entry_timestamp_et, ...outcome });
      if (dayPnl <= -account.daily_kill_loss_dollars) dailyKilled = true;
      if (!targetHit && cumulative >= account.profit_target) targetHit = true;
      if (cumulative <= -account.max_eod_drawdown || peak - cumulative >= account.max_intraday_trailing_drawdown) failed = true;
    }
    day_results.push({
      date,
      trades,
      losses: dayLosses,
      day_pnl: rounded(dayPnl),
      cumulative_pnl: rounded(cumulative),
      positive_day: dayPnl > 0,
      daily_kill_triggered: dailyKilled,
    });
  }

  const activeDays = day_results.filter(day => day.trades > 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  const continuousProfitable = !failed && cumulative > 0 && profitFactor >= account.min_profit_factor && totalTrades > 0 && cumulative / totalTrades > 0;
  return {
    variant,
    account: account.name,
    trades: totalTrades,
    add_triggers: addTriggers,
    win_rate: totalTrades ? wins / totalTrades : null,
    cumulative_pnl: rounded(cumulative),
    gross_profit: rounded(grossProfit),
    gross_loss: rounded(grossLoss),
    profit_factor: Number.isFinite(profitFactor) ? rounded(profitFactor) : 'Infinity',
    average_trade_pnl: totalTrades ? rounded(cumulative / totalTrades) : null,
    max_drawdown: rounded(maxDrawdown),
    target_hit: targetHit,
    failed,
    continuous_profitable: continuousProfitable,
    positive_day_rate: activeDays.length ? activeDays.filter(day => day.positive_day).length / activeDays.length : null,
    average_time_in_trade: averageTime(row_results),
    day_results,
    row_results: row_results.slice(0, 250),
  };
}

function analyzeStagedAdds(rows, barsByDate, account = ACCOUNT_25K) {
  const variants = VARIANTS.map(variant => simulateStagedVariant(rows, barsByDate, variant, account));
  const best = variants.slice().sort((a, b) => {
    if (a.continuous_profitable !== b.continuous_profitable) return a.continuous_profitable ? -1 : 1;
    if (a.failed !== b.failed) return a.failed ? 1 : -1;
    return b.cumulative_pnl - a.cumulative_pnl;
  })[0] || null;
  return {
    account: account.name,
    variants,
    best_variant: best,
    conclusion: best?.variant === '1ES_ONLY'
      ? '1ES_only_remains_best_or_simplest'
      : 'staged_add_improves_selected_metric_but_requires_visual_review',
  };
}

function timeTo(start, end) {
  const a = tsMs(start);
  const b = tsMs(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

function averageTime(rows) {
  const times = rows.map(row => row.time_in_trade).filter(Number.isFinite);
  return times.length ? rounded(times.reduce((sum, value) => sum + value, 0) / times.length) : null;
}

module.exports = {
  VARIANTS,
  futureBars,
  starterPnl,
  findTrigger,
  variantOutcome,
  simulateStagedVariant,
  analyzeStagedAdds,
};
