'use strict';

const fs = require('fs');
const path = require('path');

const { buildStatusPayload } = require('../trading/risk');

const ROOT = path.join(__dirname, '..');

describe('autonomous recommendation-only posture', () => {
  it('status payload labels autonomous as recommendation-only', () => {
    const payload = buildStatusPayload({
      mode: 'paper',
      running: false,
      kill_day: false,
      kill_week: false,
      daily_pnl: 0,
      weekly_pnl: 0,
      daily_loss_limit: -100,
      weekly_loss_limit: -300,
      paper_trades: 0,
      pending_signal: null,
      open_position: null,
      tradovate: {},
      apex: { enabled: false },
    });

    expect(payload.staged_only).toBe(true);
    expect(payload.recommendation_only).toBe(true);
    expect(payload.operator_note).toContain('recommendations to Luke chat');
    expect(payload.operator_note).toContain('no autonomous staging or execution');
  });

  it('evaluate path emits recommendations instead of staging trades', () => {
    const source = fs.readFileSync(path.join(ROOT, 'trading', 'router.js'), 'utf8');
    expect(source).toContain('autonomous-recommendation');
    expect(source).toContain('02B RECOMMENDATION ONLY');
    expect(source).toContain('No signal staged.');
    expect(source).not.toContain('await stageTrade(freshState, signal)');
  });

  it('keeps legacy staged execution behind an explicit disabled-by-default gate', () => {
    const router = fs.readFileSync(path.join(ROOT, 'trading', 'router.js'), 'utf8');
    const chat = fs.readFileSync(path.join(ROOT, 'chat.html'), 'utf8');

    expect(router).toContain('getStagedExecutionGate');
    expect(router).toContain('execute-staged-blocked');
    expect(router).toContain('getLiveExecutionGate');
    expect(router).toContain('live-execution-blocked');
    expect(chat).toContain('02B REVIEW ONLY - EXECUTION BLOCKED');
    expect(chat).toContain('Execution is blocked');
    expect(chat).not.toContain('/agent/autonomous/execute-staged');
  });
});
