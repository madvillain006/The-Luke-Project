'use strict';

const TICK_SIZE = 0.25;

const ACCOUNT_RULES = Object.freeze({
  '25K_EVAL': Object.freeze({
    label: '25K Pro Eval',
    profitTarget: 1250,
    maxLossLimit: 1000,
    dailyLossLimit: null,
    maxMiniContracts: 2,
    payoutTarget: null,
    consistencyLimit: null,
  }),
  '50K_EVAL': Object.freeze({
    label: '50K Pro Eval',
    profitTarget: 3000,
    maxLossLimit: 2000,
    dailyLossLimit: 1200,
    maxMiniContracts: 4,
    payoutTarget: null,
    consistencyLimit: null,
  }),
  '25K_FUNDED': Object.freeze({
    label: '25K Pro Funded',
    profitTarget: null,
    maxLossLimit: 1000,
    dailyLossLimit: null,
    maxMiniContracts: 2,
    payoutTarget: 250,
    consistencyLimit: 0.4,
  }),
  '50K_FUNDED': Object.freeze({
    label: '50K Pro Funded',
    profitTarget: null,
    maxLossLimit: 2000,
    dailyLossLimit: 1200,
    maxMiniContracts: 4,
    payoutTarget: 500,
    consistencyLimit: 0.4,
  }),
});

function normalizeSymbol(value) {
  const raw = String(value || '').toUpperCase().trim();
  if (raw.startsWith('MES')) return 'MES';
  if (raw.startsWith('ES')) return 'ES';
  return raw;
}

function pointValue(symbol) {
  return normalizeSymbol(symbol) === 'MES' ? 5 : 50;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isTickAligned(value, tickSize = TICK_SIZE) {
  const n = toNumber(value);
  if (n === null) return false;
  const ticks = n / tickSize;
  return Math.abs(ticks - Math.round(ticks)) < 1e-8;
}

function signalKey(signal = {}) {
  return String(signal.signal_id || signal.id || signal.alert_id || '').trim();
}

function validateDuplicateSignal(signal = {}, seenKeys = []) {
  const key = signalKey(signal);
  if (!key) return { ok: false, reason: 'missing_signal_id' };
  const seen = seenKeys instanceof Set ? seenKeys.has(key) : seenKeys.includes(key);
  return seen ? { ok: false, reason: 'duplicate_signal_id', key } : { ok: true, key };
}

function validateLukeWatchSignal(signal = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const maxAgeMs = options.maxAgeMs ?? 2 * 60 * 1000;
  const reasons = [];
  const warnings = [];

  const key = signalKey(signal);
  if (!key) reasons.push('missing_signal_id');

  const symbol = normalizeSymbol(signal.symbol || signal.ticker);
  if (!['ES', 'MES'].includes(symbol)) reasons.push(`unsupported_symbol:${symbol || 'missing'}`);

  const direction = String(signal.direction || '').toUpperCase();
  if (direction !== 'LONG') reasons.push(`unsupported_direction:${direction || 'missing'}`);

  const entry = toNumber(signal.entry);
  const stop = toNumber(signal.stop);
  const tp1 = toNumber(signal.tp1 ?? signal.target);
  const tp2 = toNumber(signal.tp2 ?? signal.runner_target ?? tp1);

  for (const [name, value] of [['entry', entry], ['stop', stop], ['tp1', tp1], ['tp2', tp2]]) {
    if (value === null) reasons.push(`missing_or_invalid_${name}`);
    else if (!isTickAligned(value)) reasons.push(`${name}_not_tick_aligned`);
  }

  if (entry !== null && stop !== null && !(stop < entry)) reasons.push('long_stop_must_be_below_entry');
  if (entry !== null && tp1 !== null && !(tp1 > entry)) reasons.push('long_tp1_must_be_above_entry');
  if (tp1 !== null && tp2 !== null && tp2 < tp1) reasons.push('tp2_must_be_at_or_above_tp1');

  if (signal.confirmed_bar !== true) reasons.push('confirmed_bar_required');
  if (signal.watch_only === true) reasons.push('watch_only_signal_not_tradeable');

  const timestampRaw = signal.timestamp || signal.bar_time || signal.time;
  if (!timestampRaw) {
    reasons.push('missing_timestamp');
  } else {
    const ts = new Date(timestampRaw);
    if (Number.isNaN(ts.getTime())) {
      reasons.push('invalid_timestamp');
    } else {
      const ageMs = now.getTime() - ts.getTime();
      if (ageMs < -1000) reasons.push('future_signal_timestamp');
      if (ageMs > maxAgeMs) reasons.push(`stale_signal:${Math.round(ageMs / 1000)}s`);
    }
  }

  for (const forbidden of ['api_key', 'access_token', 'broker_payload', 'place_order_payload', 'webhook_secret']) {
    if (Object.prototype.hasOwnProperty.call(signal, forbidden)) reasons.push(`forbidden_live_field:${forbidden}`);
  }

  if (!signal.level_cluster && !signal.cluster && !signal.level) warnings.push('missing_level_cluster_reference');
  if (!signal.accounting_mode) warnings.push('missing_accounting_mode');

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    normalized: {
      signal_id: key,
      symbol,
      direction,
      entry,
      stop,
      tp1,
      tp2,
      timestamp: timestampRaw || null,
      accounting_mode: signal.accounting_mode || null,
      source: signal.source || 'luke_watch',
    },
  };
}

function evaluateRiskEnvelope(signal = {}, context = {}, policy = {}) {
  const accountKey = policy.account || context.account || '25K_EVAL';
  const account = ACCOUNT_RULES[accountKey] || ACCOUNT_RULES['25K_EVAL'];
  const contracts = Number(policy.contracts ?? signal.contracts ?? 1);
  const symbol = normalizeSymbol(signal.symbol || signal.ticker);
  const pv = pointValue(symbol);
  const entry = toNumber(signal.entry);
  const stop = toNumber(signal.stop);
  const reasons = [];

  if (!Number.isFinite(contracts) || contracts <= 0) reasons.push('contracts_must_be_positive');
  if (contracts > account.maxMiniContracts && symbol === 'ES') reasons.push(`contracts_exceed_account_max:${contracts}>${account.maxMiniContracts}`);
  if (context.openPosition) reasons.push('existing_position_open');
  if (context.killDay) reasons.push('daily_kill_switch_active');
  if (context.killWeek) reasons.push('weekly_kill_switch_active');

  const riskPoints = entry !== null && stop !== null ? Math.abs(entry - stop) : null;
  const riskDollars = riskPoints !== null && Number.isFinite(contracts) ? riskPoints * pv * contracts : null;
  const maxRiskDollars = Number(policy.maxRiskDollars ?? account.maxLossLimit * 0.25);
  if (riskDollars !== null && riskDollars > maxRiskDollars) reasons.push(`risk_exceeds_policy:${riskDollars}>${maxRiskDollars}`);

  const currentDayPnl = Number(context.currentDayPnl || 0);
  if (account.dailyLossLimit !== null && riskDollars !== null && currentDayPnl - riskDollars <= -account.dailyLossLimit) {
    reasons.push(`daily_loss_limit_at_risk:${account.dailyLossLimit}`);
  }

  const currentAccountDrawdown = Number(context.currentDrawdown || 0);
  if (riskDollars !== null && currentAccountDrawdown + riskDollars >= account.maxLossLimit) {
    reasons.push(`max_loss_limit_at_risk:${account.maxLossLimit}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    account: accountKey,
    account_rules: account,
    contracts,
    point_value: pv,
    risk_points: riskPoints,
    risk_dollars: riskDollars,
    max_risk_dollars: maxRiskDollars,
  };
}

function buildDryRunAutomationPlan(signal = {}, context = {}, policy = {}) {
  const validation = validateLukeWatchSignal(signal, { now: context.now, maxAgeMs: policy.maxSignalAgeMs });
  const duplicate = validateDuplicateSignal(signal, context.seenSignalIds || []);
  const risk = evaluateRiskEnvelope(signal, context, policy);
  const ok = validation.ok && duplicate.ok && risk.ok;

  return {
    dry_run_only: true,
    can_submit_live: false,
    handoff_block: 'BROKER_ADAPTER_NOT_IMPLEMENTED_BY_CODEX',
    ok_for_handoff: ok,
    checks: {
      signal: validation,
      duplicate,
      risk,
    },
    order_intent: validation.normalized ? {
      idempotency_key: duplicate.key || validation.normalized.signal_id,
      symbol: validation.normalized.symbol,
      direction: validation.normalized.direction,
      contracts: risk.contracts,
      entry: validation.normalized.entry,
      stop: validation.normalized.stop,
      tp1: validation.normalized.tp1,
      tp2: validation.normalized.tp2,
      source: validation.normalized.source,
      accounting_mode: validation.normalized.accounting_mode,
    } : null,
    claude_live_step: 'Implement broker-specific preflight/place/cancel/reconcile adapter after these checks pass.',
  };
}

function buildClaudeHandoffChecklist() {
  return [
    'Run validateLukeWatchSignal and reject any failed reason.',
    'Run validateDuplicateSignal using durable idempotency storage before any broker call.',
    'Run evaluateRiskEnvelope against the selected 25K/50K eval or funded rules.',
    'Run broker preflight with account, buying power, instrument, quantity, and bracket validation.',
    'Submit entry only if bracket protection can be submitted immediately after fill.',
    'Persist entry, stop, targets, order ids, and broker acknowledgements before returning success.',
    'Poll/reconcile broker position and working orders after every submit, replace, cancel, reconnect, and restart.',
    'Flatten or block further action on any local/broker mismatch, missing protection, duplicate alert, stale signal, or DLL breach.',
  ];
}

module.exports = {
  ACCOUNT_RULES,
  TICK_SIZE,
  normalizeSymbol,
  pointValue,
  isTickAligned,
  signalKey,
  validateDuplicateSignal,
  validateLukeWatchSignal,
  evaluateRiskEnvelope,
  buildDryRunAutomationPlan,
  buildClaudeHandoffChecklist,
};
