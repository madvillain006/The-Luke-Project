'use strict';

const DEFAULT_PROP_CONFIG = {
  evaluation_account_size: 25000,
  contracts: 2,
  dollars_per_point_per_contract: 50,
  dollars_per_point_total: 100,
  max_eod_drawdown: 1000,
  max_intraday_trailing_drawdown_funded: 1000,
  max_risk_dollars_per_trade: 300,
  max_stop_points: 3.0,
  hard_max_stop_points: 5.0,
  preferred_tp1_points_min: 2.0,
  preferred_tp1_points_max: 4.0,
  target_scalp_points_to_test: [2, 3, 4, 5, 8],
  max_trades_per_day: 4,
  max_losses_per_day: 2,
  daily_kill_loss_dollars: 600,
  require_positive_headroom_after_stop: true,
};

function riskDollars(stopPoints, config = DEFAULT_PROP_CONFIG) {
  if (!Number.isFinite(stopPoints)) return null;
  return stopPoints * config.dollars_per_point_total;
}

function maxContractsForRisk(stopPoints, config = DEFAULT_PROP_CONFIG) {
  if (!Number.isFinite(stopPoints) || stopPoints <= 0) return 0;
  const perContract = stopPoints * config.dollars_per_point_per_contract;
  return Math.min(config.contracts, Math.floor(config.max_risk_dollars_per_trade / perContract));
}

function classifyVariant(variant, config = DEFAULT_PROP_CONFIG) {
  const reasons = [];
  const stopPoints = variant.stop_points;
  const risk = riskDollars(stopPoints, config);
  const maxContracts = maxContractsForRisk(stopPoints, config);

  if (variant.no_lookahead_violation) reasons.push('no_lookahead_violation');
  if (!variant.valid_reclaim) reasons.push('no_valid_reclaim');
  if (!Number.isFinite(variant.entry_price)) reasons.push('no_entry_price');
  if (!Number.isFinite(variant.stop_price) || !Number.isFinite(stopPoints) || stopPoints <= 0) reasons.push('no_safe_stop');
  if (!Number.isFinite(variant.tp1) || variant.tp1 <= variant.entry_price) reasons.push('no_acceptable_tp1');
  if (variant.basis_method === 'fixed_plus_30_proxy') reasons.push('fixed_plus_30_diagnostic_only');
  if (variant.basis_method === 'reference_only') reasons.push('spx_reference_only_no_executable_level');
  if (Number.isFinite(stopPoints) && stopPoints > config.hard_max_stop_points) reasons.push('stop_exceeds_hard_max');
  if (Number.isFinite(risk) && risk > config.max_risk_dollars_per_trade) reasons.push('risk_exceeds_prop_trade_cap');
  if (maxContracts < config.contracts) reasons.push('two_contract_size_not_allowed_by_risk');
  if (variant.inside_chop && variant.chop_rule_variant === 'chop_blocked') reasons.push('chop_blocked_variant');
  if (variant.inside_chop && variant.chop_rule_variant === 'chop_allowed_after_reclaim') {
    if (variant.entry_model !== 'level_reclaim_limit') reasons.push('chop_requires_level_reclaim_limit_entry');
    if (!String(variant.stop_model || '').startsWith('sweep_low')) reasons.push('chop_requires_sweep_low_stop');
    const tpPoints = variant.tp1 - variant.entry_price;
    if (tpPoints < config.preferred_tp1_points_min || tpPoints > config.preferred_tp1_points_max) {
      reasons.push('chop_requires_2_to_4_point_tp1');
    }
  }
  if (config.require_positive_headroom_after_stop && Number.isFinite(risk) && risk >= config.max_eod_drawdown) {
    reasons.push('no_positive_drawdown_headroom_after_stop');
  }

  const passReasons = new Set([
    'no_lookahead_violation',
    'no_valid_reclaim',
    'no_entry_price',
    'no_safe_stop',
    'no_acceptable_tp1',
    'fixed_plus_30_diagnostic_only',
    'spx_reference_only_no_executable_level',
    'stop_exceeds_hard_max',
    'chop_blocked_variant',
    'no_positive_drawdown_headroom_after_stop',
  ]);

  let classification = 'TRADEABLE';
  if (reasons.some(reason => passReasons.has(reason))) classification = 'PASS';
  else if (reasons.length || stopPoints > config.max_stop_points || risk > config.max_risk_dollars_per_trade) classification = 'WATCH_ONLY';

  return {
    classification,
    classification_reason: reasons.length ? reasons.join(';') : 'prop_constraints_ok',
    risk_dollars: Number.isFinite(risk) ? Math.round(risk * 100) / 100 : null,
    max_contracts: maxContracts,
    allowed_under_prop_rules: classification === 'TRADEABLE',
  };
}

function conservativePnl(row, config = DEFAULT_PROP_CONFIG) {
  if (row.same_bar_ambiguity || row.stop_first) return -row.risk_dollars;
  if (row.tp1_hit && !row.stop_first) {
    const tp1Points = row.tp1 - row.entry_price;
    if (Number.isFinite(row.tp2) && row.tp2_hit) {
      const tp2Points = row.tp2 - row.entry_price;
      return (tp1Points + tp2Points) * config.dollars_per_point_per_contract;
    }
    return tp1Points * config.dollars_per_point_total;
  }
  const r = Number.isFinite(row.r_multiple_60m) ? row.r_multiple_60m : 0;
  return r * row.risk_dollars;
}

function annotateDailyPropMetrics(rows, config = DEFAULT_PROP_CONFIG) {
  const grouped = new Map();
  for (const row of rows) {
    const key = [
      row.entry_model,
      row.stop_model,
      row.target_model,
      row.chop_rule_variant,
      row.basis_method,
    ].join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  for (const group of grouped.values()) {
    const byDay = new Map();
    for (const row of group) {
      if (!byDay.has(row.date)) byDay.set(row.date, []);
      byDay.get(row.date).push(row);
    }
    for (const dayRows of byDay.values()) {
      dayRows.sort((a, b) => a.entry_timestamp_et < b.entry_timestamp_et ? -1 : a.entry_timestamp_et > b.entry_timestamp_et ? 1 : 0);
      let trades = 0;
      let losses = 0;
      let pnl = 0;
      let peak = 0;
      let minPnl = 0;
      let killed = false;
      for (const row of dayRows) {
        const canTrade = row.classification === 'TRADEABLE' &&
          trades < config.max_trades_per_day &&
          losses < config.max_losses_per_day &&
          !killed;
        row.daily_trade_count = trades;
        row.daily_loss_count = losses;
        row.daily_realized_research_pnl = Math.round(pnl * 100) / 100;
        row.drawdown_used = Math.round((peak - pnl) * 100) / 100;
        row.daily_kill_triggered = killed;
        row.allowed_under_prop_rules = row.allowed_under_prop_rules && canTrade;
        if (!canTrade) continue;
        trades += 1;
        const tradePnl = conservativePnl(row, config);
        pnl += tradePnl;
        if (tradePnl < 0) losses += 1;
        peak = Math.max(peak, pnl);
        minPnl = Math.min(minPnl, pnl);
        if (pnl <= -config.daily_kill_loss_dollars) killed = true;
        row.daily_trade_count = trades;
        row.daily_loss_count = losses;
        row.daily_realized_research_pnl = Math.round(pnl * 100) / 100;
        row.drawdown_used = Math.round((peak - pnl) * 100) / 100;
        row.would_eod_drawdown_fail = minPnl <= -config.max_eod_drawdown;
        row.would_intraday_trailing_fail = (peak - pnl) >= config.max_intraday_trailing_drawdown_funded;
        row.daily_kill_triggered = killed;
      }
    }
  }
  return rows;
}

module.exports = {
  DEFAULT_PROP_CONFIG,
  riskDollars,
  maxContractsForRisk,
  classifyVariant,
  conservativePnl,
  annotateDailyPropMetrics,
};
