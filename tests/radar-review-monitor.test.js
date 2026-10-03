'use strict';

const { SAFETY_CONFIRMATIONS, validateQaPacket } = require('../lib/radar/qa-packet');
const { buildRuntimeMonitorReport } = require('../lib/radar/runtime-monitor');

function packet(overrides = {}) {
  return {
    job_id: 'review-job',
    phase_id: 'review-phase',
    files_changed: ['lib/radar/review-lane-status.js'],
    tests_run: ['vitest run review.test.js'],
    tests_skipped_with_reason: [],
    test_output_summary: 'Review checks passed.',
    behavior_proven: ['Read-only review report exposes QA evidence.'],
    regression_risks: [],
    rollback_path: 'Revert the report change.',
    safety_boundary_confirmation: Object.fromEntries(SAFETY_CONFIRMATIONS.map(key => [key, true])),
    result: 'pass',
    reviewer: 'qa',
    timestamp: '2026-05-14T17:10:00Z',
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    workflow: { owned_paths: ['lib/', 'tests/'], forbidden_paths: ['trading/', 'state/events/'] },
    worktree: { dirty_files: ['lib/radar/review-lane-status.js'] },
    jobs: [],
    signals: [],
    qa_packets: [packet()],
    ...overrides,
  };
}

describe('review QA evidence validation', () => {
  it('retains supplied proof without mutating it or making execution claims', () => {
    const input = packet();
    const before = JSON.stringify(input);
    const result = validateQaPacket(input);
    expect(result.ok).toBe(true);
    expect(result.packet.tests_run).toEqual(input.tests_run);
    expect(result.packet.tests_run).not.toBe(input.tests_run);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('rejects missing proof, empty pass claims, invalid dates, and absent safety confirmations', () => {
    expect(validateQaPacket(null).ok).toBe(false);
    expect(validateQaPacket(packet({ files_changed: undefined })).ok).toBe(false);
    expect(validateQaPacket(packet({ tests_run: [] })).ok).toBe(false);
    expect(validateQaPacket(packet({ behavior_proven: [] })).ok).toBe(false);
    expect(validateQaPacket(packet({ timestamp: 'invalid' })).ok).toBe(false);
    expect(validateQaPacket(packet({ safety_boundary_confirmation: {} })).ok).toBe(false);
    expect(validateQaPacket(packet({ safety_boundary_confirmation: { ...packet().safety_boundary_confirmation, risk_checks_not_weakened: false } })).ok).toBe(false);
    expect(validateQaPacket(packet({ result: 'success' })).ok).toBe(false);
  });

  it('keeps failure and blocked evidence distinct from a pass and requires a reason for structured skips', () => {
    expect(validateQaPacket(packet({ result: 'fail', tests_run: [] })).packet.result).toBe('fail');
    expect(validateQaPacket(packet({ result: 'blocked', tests_run: [] })).packet.result).toBe('blocked');
    expect(validateQaPacket(packet({ tests_skipped_with_reason: [{ test: 'integration', reason: 'No fixture available' }] })).ok).toBe(true);
    expect(validateQaPacket(packet({ tests_skipped_with_reason: [{ test: 'integration' }] })).ok).toBe(false);
  });
});

describe('report-only runtime monitor', () => {
  it('reports healthy scoped evidence without altering context or dispatching work', () => {
    const input = context();
    const before = JSON.stringify(input);
    const report = buildRuntimeMonitorReport(input);
    expect(report.status).toBe('healthy');
    expect(report.reasons).toEqual([]);
    expect(report.policy).toEqual({ review_only: true, runtime_state_writes: false, dispatch: false, automatic_repair: false });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('reports missing context and ownership violations including normalized and invalid paths', () => {
    expect(buildRuntimeMonitorReport().status).toBe('blocked');
    expect(buildRuntimeMonitorReport(context({ workflow: {}, worktree: {} })).status).toBe('blocked');
    expect(buildRuntimeMonitorReport(context({ jobs: [{ state: 'unknown' }] })).reasons.map(reason => reason.code)).toContain('unknown_job_state');
    const report = buildRuntimeMonitorReport(context({ worktree: { dirty_files: ['trading\\orders.js', 'state/./events/x.json', 'other.js', '../escape.js'] } }));
    expect(report.reasons.map(reason => reason.code)).toEqual(['forbidden_path_edit', 'forbidden_path_edit', 'unapproved_path_edit', 'invalid_dirty_path']);
  });

  it('reports QA failures and missing required tests even when a packet claims a pass', () => {
    const report = buildRuntimeMonitorReport(context({
      workflow: { owned_paths: ['lib/'], forbidden_paths: [], required_tests: ['required command'] },
      qa_packets: [packet({ result: 'fail' }), packet({ tests_run: [] })],
    }));
    expect(report.reasons.map(reason => reason.code)).toEqual(['qa_not_passed', 'invalid_qa_packet', 'missing_test']);
    expect(report.status).toBe('blocked');
  });

  it('reports conflicts, simultaneous jobs, repair states, and exhausted loops', () => {
    const report = buildRuntimeMonitorReport(context({
      workflow: { owned_paths: ['lib/'], forbidden_paths: [], max_iterations: 4 },
      worktree: { dirty_files: [], conflicted_files: ['lib/x.js'] },
      jobs: [{ state: 'active' }, { state: 'active' }, { state: 'qa_failed' }],
      loop_metrics: { iterations: 4, consecutive_failures: 3, stalled_iterations: 3 },
    }));
    expect(report.reasons.map(reason => reason.code)).toEqual(['worktree_conflict', 'multiple_active_jobs', 'repair_required', 'iteration_limit', 'repeated_failures', 'stalled_loop']);
    expect(report.recommended_next_action).toContain('operator review');
  });
});
