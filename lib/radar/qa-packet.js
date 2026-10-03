'use strict';

const SAFETY_CONFIRMATIONS = [
  'pine_untouched_unless_approved',
  'ninjatrader_untouched_unless_approved',
  'market_hours_untouched_unless_approved',
  'live_trading_paths_untouched',
  'risk_checks_not_weakened',
  'credentials_secrets_untouched',
  'broker_account_routing_untouched',
  'order_execution_unchanged',
  'runtime_state_not_overwritten',
  'no_unsafe_dependency_added',
];

function field(input, key) {
  return input[key] ?? input[key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Validation describes supplied evidence; it never runs tests or approves work.
function validateQaPacket(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, packet: null, errors: [{ field: 'packet', message: 'QA packet must be an object' }] };
  }
  const packet = { ...input };
  const issue = (key, message) => errors.push({ field: key, message });
  for (const key of ['job_id', 'plan_id', 'phase_id', 'reviewer', 'test_output_summary', 'rollback_path', 'timestamp', 'deterministic_equivalent']) {
    packet[key] = text(field(input, key));
  }
  packet.reviewer ||= text(input.source || input.reporter);
  packet.timestamp ||= text(input.ts || input.created_at || input.createdAt);
  if (!packet.job_id && !packet.plan_id) issue('job_id', 'job_id or plan_id is required');
  for (const key of ['phase_id', 'reviewer', 'test_output_summary', 'rollback_path']) {
    if (!packet[key]) issue(key, `${key} is required`);
  }
  if (!packet.timestamp && !packet.deterministic_equivalent) issue('timestamp', 'timestamp or deterministic_equivalent is required');
  if (packet.timestamp && !Number.isFinite(Date.parse(packet.timestamp))) issue('timestamp', 'timestamp must be a valid date');

  for (const key of ['files_changed', 'tests_run', 'tests_skipped_with_reason', 'behavior_proven', 'regression_risks']) {
    const values = field(input, key);
    if (!Array.isArray(values)) {
      issue(key, `${key} must be an array`);
      packet[key] = [];
      continue;
    }
    packet[key] = [...values];
    values.forEach((value, index) => {
      const valid = key === 'tests_skipped_with_reason' && value && typeof value === 'object'
        ? Boolean(text(value.test || value.command) && text(value.reason))
        : Boolean(text(value));
      if (!valid) issue(key, `${key}[${index}] must describe evidence${key === 'tests_skipped_with_reason' ? ' and a skip reason' : ''}`);
    });
  }
  packet.result = text(input.result).toLowerCase();
  if (!['pass', 'fail', 'blocked'].includes(packet.result)) issue('result', 'result must be pass, fail, or blocked');
  if (packet.result === 'pass') {
    if (!packet.tests_run.length) issue('tests_run', 'A passing result requires tests run');
    if (!packet.behavior_proven.length) issue('behavior_proven', 'A passing result requires behavior proven');
  }
  const confirmation = field(input, 'safety_boundary_confirmation');
  packet.safety_boundary_confirmation = { ...(confirmation || {}) };
  for (const key of SAFETY_CONFIRMATIONS) {
    if (confirmation?.[key] !== true) issue(`safety_boundary_confirmation.${key}`, `${key} must be explicitly true`);
  }
  return { ok: errors.length === 0, packet: errors.length ? null : packet, errors };
}

module.exports = { validateQaPacket, SAFETY_CONFIRMATIONS };
