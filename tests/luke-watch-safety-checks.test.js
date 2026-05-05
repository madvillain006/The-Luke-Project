'use strict';

const fs = require('fs');
const path = require('path');

const {
  ACCOUNT_RULES,
  buildClaudeHandoffChecklist,
  buildDryRunAutomationPlan,
  evaluateRiskEnvelope,
  validateDuplicateSignal,
  validateLukeWatchSignal,
} = require('../trading/luke-watch-safety-checks');

function validSignal(overrides = {}) {
  return {
    signal_id: 'luke-watch-2026-05-05T11:00:00Z-7252_50',
    source: 'luke_watch_production_test',
    symbol: 'ESM2026',
    direction: 'LONG',
    timestamp: '2026-05-05T11:00:00.000Z',
    confirmed_bar: true,
    entry: 7253.0,
    stop: 7249.5,
    tp1: 7254.75,
    tp2: 7260.0,
    level_cluster: 7252.5,
    accounting_mode: 'entry_only_0_25',
    contracts: 1,
    ...overrides,
  };
}

describe('Luke Watch automation handoff safety checks', () => {
  it('accepts a confirmed tick-aligned ES long signal for dry-run handoff', () => {
    const result = validateLukeWatchSignal(validSignal(), { now: '2026-05-05T11:00:30.000Z' });

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.normalized.symbol).toBe('ES');
    expect(result.normalized.tp1).toBe(7254.75);
  });

  it('rejects unconfirmed, stale, future, malformed, and watch-only signals', () => {
    const unconfirmed = validateLukeWatchSignal(validSignal({ confirmed_bar: false }), { now: '2026-05-05T11:00:30.000Z' });
    expect(unconfirmed.reasons).toContain('confirmed_bar_required');

    const stale = validateLukeWatchSignal(validSignal(), { now: '2026-05-05T11:10:30.000Z' });
    expect(stale.reasons.some(reason => reason.startsWith('stale_signal'))).toBe(true);

    const future = validateLukeWatchSignal(validSignal({ timestamp: '2026-05-05T11:02:00.000Z' }), { now: '2026-05-05T11:00:30.000Z' });
    expect(future.reasons).toContain('future_signal_timestamp');

    const malformed = validateLukeWatchSignal(validSignal({ entry: 7253.1, stop: 7254.0, tp1: 7252.0 }), { now: '2026-05-05T11:00:30.000Z' });
    expect(malformed.reasons).toContain('entry_not_tick_aligned');
    expect(malformed.reasons).toContain('long_stop_must_be_below_entry');
    expect(malformed.reasons).toContain('long_tp1_must_be_above_entry');

    const watchOnly = validateLukeWatchSignal(validSignal({ watch_only: true }), { now: '2026-05-05T11:00:30.000Z' });
    expect(watchOnly.reasons).toContain('watch_only_signal_not_tradeable');
  });

  it('rejects duplicate signal ids before any broker handoff', () => {
    const duplicate = validateDuplicateSignal(validSignal(), new Set(['luke-watch-2026-05-05T11:00:00Z-7252_50']));
    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('duplicate_signal_id');
  });

  it('models 25K and 50K eval/funded rules without one-day target assumptions', () => {
    expect(ACCOUNT_RULES['25K_EVAL'].profitTarget).toBe(1250);
    expect(ACCOUNT_RULES['25K_EVAL'].dailyLossLimit).toBeNull();
    expect(ACCOUNT_RULES['50K_EVAL'].profitTarget).toBe(3000);
    expect(ACCOUNT_RULES['50K_EVAL'].dailyLossLimit).toBe(1200);
    expect(ACCOUNT_RULES['25K_FUNDED'].payoutTarget).toBe(250);
    expect(ACCOUNT_RULES['50K_FUNDED'].payoutTarget).toBe(500);
    expect(ACCOUNT_RULES['50K_FUNDED'].consistencyLimit).toBe(0.4);
  });

  it('calculates 1ES and 2ES risk and enforces account constraints', () => {
    const oneEs = evaluateRiskEnvelope(validSignal({ contracts: 1 }), {}, { account: '25K_EVAL', contracts: 1 });
    expect(oneEs.ok).toBe(true);
    expect(oneEs.risk_points).toBe(3.5);
    expect(oneEs.risk_dollars).toBe(175);

    const twoEs = evaluateRiskEnvelope(validSignal({ contracts: 2 }), {}, { account: '25K_EVAL', contracts: 2, maxRiskDollars: 500 });
    expect(twoEs.ok).toBe(true);
    expect(twoEs.risk_dollars).toBe(350);

    const tooLarge = evaluateRiskEnvelope(validSignal({ contracts: 3 }), {}, { account: '25K_EVAL', contracts: 3, maxRiskDollars: 1000 });
    expect(tooLarge.reasons).toContain('contracts_exceed_account_max:3>2');

    const dllRisk = evaluateRiskEnvelope(validSignal({ contracts: 4 }), { currentDayPnl: -900 }, { account: '50K_EVAL', contracts: 4, maxRiskDollars: 1000 });
    expect(dllRisk.reasons).toContain('daily_loss_limit_at_risk:1200');
  });

  it('builds a dry-run handoff plan that cannot submit live orders', () => {
    const plan = buildDryRunAutomationPlan(
      validSignal(),
      { now: '2026-05-05T11:00:30.000Z', seenSignalIds: [] },
      { account: '50K_EVAL', contracts: 1, maxRiskDollars: 500 }
    );

    expect(plan.ok_for_handoff).toBe(true);
    expect(plan.dry_run_only).toBe(true);
    expect(plan.can_submit_live).toBe(false);
    expect(plan.handoff_block).toBe('BROKER_ADAPTER_NOT_IMPLEMENTED_BY_CODEX');
    expect(plan.order_intent.symbol).toBe('ES');
    expect(plan.order_intent.idempotency_key).toBe(validSignal().signal_id);
    expect(JSON.stringify(plan)).not.toMatch(/access_token|api_key|placeorder|place order|broker_payload/i);
  });

  it('keeps the safety module free of broker order placement calls', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'trading', 'luke-watch-safety-checks.js'), 'utf8');
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/place(order|Order|OSO)|submitOrder|Public\.|Tradovate/i);
    expect(source).toContain('can_submit_live: false');
  });

  it('lists the final Claude live-adapter checklist without implementing it', () => {
    const checklist = buildClaudeHandoffChecklist();
    expect(checklist.length).toBeGreaterThanOrEqual(8);
    expect(checklist.join('\n')).toContain('broker preflight');
    expect(checklist.join('\n')).toContain('Persist entry');
  });
});
