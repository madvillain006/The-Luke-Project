'use strict';

const DEFAULT_PROP_ACCOUNT = {
  name: '25K prop',
  mode: 'prop_25k',
  preferredRiskDollars: 300,
  hardRiskDollars: 500,
  dailyKillDollars: 600,
  dollarsPerPointPerEs: 50,
  starterContracts: 1,
  maxContracts: 2,
  allowFullSize: false,
};

function round(value, places = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeAccountConfig(config = {}) {
  return { ...DEFAULT_PROP_ACCOUNT, ...(config || {}) };
}

function assessPropRisk({
  entry,
  stop,
  contracts = 1,
  accountConfig = {},
  addSecondConfirmed = false,
  priorLossSameLevel = false,
} = {}) {
  const account = normalizeAccountConfig(accountConfig);
  const warnings = [];
  const parsedContracts = Number.isFinite(Number(contracts)) ? Number(contracts) : account.starterContracts;
  const dollarsPerPoint = parsedContracts * account.dollarsPerPointPerEs;
  const stopPoints = Number.isFinite(entry) && Number.isFinite(stop) ? round(entry - stop) : null;
  const riskDollars = Number.isFinite(stopPoints) && stopPoints > 0 ? round(stopPoints * dollarsPerPoint) : null;

  if (!Number.isFinite(entry) || !Number.isFinite(stop)) warnings.push('entry_or_stop_unknown');
  if (Number.isFinite(stopPoints) && stopPoints <= 0) warnings.push('stop_not_below_entry');
  if (priorLossSameLevel) warnings.push('no_repeat_after_loss');
  if (parsedContracts > account.starterContracts && !addSecondConfirmed) warnings.push('add_second_es_requires_retest_hold_confirmation');
  if (parsedContracts > account.maxContracts) warnings.push('contract_count_above_account_max');

  let status = 'PASS_DATA_UNKNOWN';
  if (Number.isFinite(riskDollars) && stopPoints > 0) {
    if (priorLossSameLevel) status = 'PASS_RISK';
    else if (riskDollars > account.hardRiskDollars) status = 'PASS_RISK';
    else if (parsedContracts > account.starterContracts && (!account.allowFullSize || !addSecondConfirmed)) status = 'PASS_RISK';
    else status = riskDollars <= account.preferredRiskDollars ? 'PASS' : 'WARN';
  }

  return {
    ok: status === 'PASS' || status === 'WARN',
    status,
    account_gate: status,
    account: account.name,
    mode: account.mode,
    contracts: parsedContracts,
    dollars_per_point: dollarsPerPoint,
    stop_points: stopPoints,
    risk_dollars: riskDollars,
    max_allowed_risk: account.hardRiskDollars,
    preferred_risk: account.preferredRiskDollars,
    daily_kill: account.dailyKillDollars,
    add_second_requires_confirmation: parsedContracts > account.starterContracts && !addSecondConfirmed,
    prior_loss_same_level: priorLossSameLevel,
    warnings,
  };
}

function starterSizeRecommendation({ riskGate, accountConfig = {} } = {}) {
  const account = normalizeAccountConfig(accountConfig);
  if (!riskGate || riskGate.ok !== true) {
    return {
      mode: account.mode,
      contracts: 0,
      reason: riskGate?.status === 'PASS_RISK' ? 'risk gate blocked starter size' : 'market data or bracket incomplete',
    };
  }
  return {
    mode: account.mode,
    contracts: account.starterContracts,
    reason: '1ES starter preferred for 25K prop mode; add second ES only after retest-hold confirmation',
  };
}

module.exports = {
  DEFAULT_PROP_ACCOUNT,
  assessPropRisk,
  normalizeAccountConfig,
  starterSizeRecommendation,
  round,
};
