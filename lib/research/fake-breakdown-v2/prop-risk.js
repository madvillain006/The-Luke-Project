'use strict';

const DEFAULT_V2_PROP_CONFIG = {
  evaluation_account_size: 25000,
  dollars_per_point_per_contract: 50,
  base_contracts: 2,
  max_eod_drawdown: 1000,
  max_intraday_trailing_drawdown_funded: 1000,
  preferred_max_risk_dollars: 300,
  hard_max_risk_dollars: 500,
  preferred_max_stop_points: 3,
  hard_max_stop_points: 5,
  daily_kill_loss_dollars: 600,
  max_losses_per_day: 2,
  max_trades_per_day: 4,
};

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function stopPoints(entryPrice, stopPrice) {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopPrice)) return null;
  return rounded(entryPrice - stopPrice);
}

function riskDollars(stopPointValue, contracts = 2, config = DEFAULT_V2_PROP_CONFIG) {
  if (!Number.isFinite(stopPointValue) || stopPointValue <= 0) return null;
  return rounded(stopPointValue * contracts * config.dollars_per_point_per_contract);
}

function rewardRisk(entryPrice, stopPrice, targetPrice) {
  const risk = stopPoints(entryPrice, stopPrice);
  if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(targetPrice)) return null;
  return rounded((targetPrice - entryPrice) / risk);
}

function positionSafety({ stop_points, full_risk_dollars, staged_risk_dollars, starter_risk_dollars }, config = DEFAULT_V2_PROP_CONFIG) {
  if (!Number.isFinite(stop_points) || stop_points <= 0) return 'NOT_PROP_SAFE';
  if (stop_points > config.hard_max_stop_points) return 'NOT_PROP_SAFE';
  if (full_risk_dollars <= config.preferred_max_risk_dollars && stop_points <= config.preferred_max_stop_points) return '2ES_FULL_SAFE';
  if (Number.isFinite(staged_risk_dollars) && staged_risk_dollars <= config.preferred_max_risk_dollars) return 'STAGED_1_TO_2_BETTER';
  if (Number.isFinite(starter_risk_dollars) && starter_risk_dollars <= config.preferred_max_risk_dollars) return '1ES_ONLY_BETTER';
  if (full_risk_dollars > config.hard_max_risk_dollars && starter_risk_dollars > config.hard_max_risk_dollars) return 'NOT_PROP_SAFE';
  return 'WATCH_ONLY';
}

function baseReasons(row, config = DEFAULT_V2_PROP_CONFIG) {
  const reasons = [];
  if (!row.valid_reclaim) reasons.push('no_valid_reclaim');
  if (!Number.isFinite(row.entry_price)) reasons.push('no_entry_price');
  if (!Number.isFinite(row.stop_price) || !Number.isFinite(row.stop_points) || row.stop_points <= 0) reasons.push('no_safe_stop');
  if (row.basis_method === 'fixed_plus_30_proxy') reasons.push('fixed_plus_30_diagnostic_only');
  if (row.basis_method === 'reference_only') reasons.push('spx_reference_only_no_executable_level');
  if (row.no_lookahead_violation) reasons.push('no_lookahead_violation');
  if (row.stop_points > config.hard_max_stop_points) reasons.push('stop_exceeds_hard_max');
  if (row.full_risk_dollars > config.hard_max_risk_dollars) reasons.push('risk_exceeds_hard_max');
  if (row.inside_chop && !row.chop_allowed_variant) reasons.push('active_chop_veto');
  if (row.target_distance !== null && row.target_distance < 2) reasons.push('target_too_close');
  return reasons;
}

function classifyHistoricalPlan(row, config = DEFAULT_V2_PROP_CONFIG) {
  const reasons = baseReasons(row, config);
  const safety = positionSafety(row, config);
  if (safety === 'NOT_PROP_SAFE') reasons.push('not_prop_safe');

  if (reasons.some(reason => [
    'no_valid_reclaim',
    'no_entry_price',
    'no_safe_stop',
    'fixed_plus_30_diagnostic_only',
    'spx_reference_only_no_executable_level',
    'no_lookahead_violation',
    'stop_exceeds_hard_max',
    'risk_exceeds_hard_max',
    'active_chop_veto',
    'not_prop_safe',
  ].includes(reason))) {
    return {
      classification: 'PASS',
      classification_reason: reasons.join(';'),
      position_safety: safety,
    };
  }

  let classification = 'WATCH_ONLY';
  if (row.archetype === 'REACTION_SCALP') {
    if (row.tp1_hit && !row.stop_first && row.max_heat_before_tp1 <= Math.max(3, row.stop_points) && row.time_to_tp1 !== null && row.time_to_tp1 <= 15) {
      classification = 'TRADEABLE_REACTION_SCALP';
    } else {
      reasons.push('reaction_scalp_outcome_not_clean');
    }
  } else if (row.archetype === 'LEVEL_TO_LEVEL_LONG') {
    if (row.tp2_hit && !row.stop_first && row.reward_risk >= 1.5 && row.max_heat_before_tp2 <= Math.max(row.stop_points * 1.5, 4)) {
      classification = 'TRADEABLE_LEVEL_TO_LEVEL';
    } else {
      reasons.push('level_to_level_outcome_not_confirmed');
    }
  } else if (row.archetype === 'STAGED_LONG') {
    if ((row.tp1_hit || row.tp2_hit) && !row.stop_first && ['STAGED_1_TO_2_BETTER', '1ES_ONLY_BETTER', '2ES_FULL_SAFE'].includes(safety)) {
      classification = 'TRADEABLE_STAGED';
    } else {
      reasons.push('staged_outcome_not_better');
    }
  }

  return {
    classification,
    classification_reason: reasons.length ? reasons.join(';') : 'historical_rules_passed',
    position_safety: safety,
  };
}

function conservativePnl(row, config = DEFAULT_V2_PROP_CONFIG) {
  if (!String(row.classification || '').startsWith('TRADEABLE')) return 0;
  if (row.same_bar_ambiguity || row.stop_first) return -(row.active_risk_dollars || row.full_risk_dollars || 0);
  if (row.tp2_hit && Number.isFinite(row.tp2)) {
    if (row.archetype === 'STAGED_LONG') {
      const starter = (row.tp1 - row.entry_price) * config.dollars_per_point_per_contract;
      const runnerEntry = row.add_price || row.entry_price;
      const runner = (row.tp2 - runnerEntry) * config.dollars_per_point_per_contract;
      return rounded(starter + runner);
    }
    return rounded((row.tp2 - row.entry_price) * row.contracts * config.dollars_per_point_per_contract);
  }
  if (row.tp1_hit) return rounded((row.tp1 - row.entry_price) * row.contracts * config.dollars_per_point_per_contract);
  return rounded((row.r_60m || 0) * (row.active_risk_dollars || row.full_risk_dollars || 0));
}

function annotateDailyRisk(rows, config = DEFAULT_V2_PROP_CONFIG) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.archetype, row.entry_model, row.stop_model, row.target_model, row.position_model].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    const byDay = new Map();
    for (const row of group) {
      if (!byDay.has(row.date)) byDay.set(row.date, []);
      byDay.get(row.date).push(row);
    }
    for (const dayRows of byDay.values()) {
      dayRows.sort((a, b) => String(a.entry_timestamp_et).localeCompare(String(b.entry_timestamp_et)));
      let trades = 0;
      let losses = 0;
      let pnl = 0;
      let peak = 0;
      let killed = false;
      for (const row of dayRows) {
        const allowed = String(row.classification).startsWith('TRADEABLE') &&
          trades < config.max_trades_per_day &&
          losses < config.max_losses_per_day &&
          !killed;
        row.daily_pnl_before = rounded(pnl);
        row.daily_drawdown_used = rounded(peak - pnl);
        row.daily_kill_triggered = killed;
        row.max_losses_reached = losses >= config.max_losses_per_day;
        row.allowed_after_daily_rules = allowed;
        if (!allowed) continue;
        trades += 1;
        const tradePnl = conservativePnl(row, config);
        pnl += tradePnl;
        if (tradePnl < 0) losses += 1;
        peak = Math.max(peak, pnl);
        if (pnl <= -config.daily_kill_loss_dollars) killed = true;
        row.daily_pnl_after = rounded(pnl);
        row.daily_drawdown_used = rounded(peak - pnl);
        row.account_fail = pnl <= -config.max_eod_drawdown || (peak - pnl) >= config.max_intraday_trailing_drawdown_funded;
      }
    }
  }
  return rows;
}

module.exports = {
  DEFAULT_V2_PROP_CONFIG,
  stopPoints,
  riskDollars,
  rewardRisk,
  positionSafety,
  classifyHistoricalPlan,
  conservativePnl,
  annotateDailyRisk,
};
