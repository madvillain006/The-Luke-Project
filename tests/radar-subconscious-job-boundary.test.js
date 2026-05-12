'use strict';

const {
  JobBoundaryError,
  buildApprovedJob,
  createCoderJobFromSignal,
  normalizeMainApproval,
  transitionCoderJob,
} = require('../lib/radar/subconscious-job-boundary');

function signal(overrides = {}) {
  return {
    slug: 'import-lock-watcher',
    title: 'Import lock watcher',
    raw_text: 'Watch imports from reference repos and flag boundary drift.',
    source: {
      agent: 'subconscious',
      mode: 'continue-project',
      source_label: 'luke-subconscious',
    },
    signal_types: ['return', 'evidence'],
    score: 8,
    positive_walk_count: 4,
    cooldown_state: 'clear',
    lock_state: 'none',
    status: 'ready_for_main_review',
    non_goals: ['no Coder dispatch', 'no runtime state writes'],
    forbidden_surfaces: ['trading', 'pine', 'ninjatrader', 'broker', 'risk', 'credentials', 'runtime-state'],
    review_only: true,
    created_at: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}

function approval(overrides = {}) {
  return {
    approved: true,
    owner: 'main',
    proposal_slug: 'import-lock-watcher',
    objective: 'Create a review-only import boundary checker design.',
    owned_paths: ['lib/radar/subconscious-job-boundary.js', 'tests/radar-subconscious-job-boundary.test.js'],
    forbidden_paths: ['trading/', 'tradingview/', 'ninjatrader/', 'lib/market-hours.js', '.env', 'state/events/', 'state/snapshots/'],
    stop_condition: 'Approved job object is produced but not executed.',
    required_tests: ['cmd /c npx vitest run tests/radar-subconscious-job-boundary.test.js'],
    rollback_path: 'Revert only the job boundary module and focused tests.',
    approval_source: 'main_approval_artifact',
    approved_at: '2026-05-10T14:00:00.000Z',
    explicit_promotion_statement: 'This signal may become a bounded Main plan, not an active Coder dispatch.',
    ...overrides,
  };
}

describe('Subconscious Main approval and Coder job boundary', () => {
  it('signal cannot become active job directly', () => {
    expect(() => createCoderJobFromSignal(signal(), {
      approval: approval(),
      target_state: 'active',
    })).toThrow(JobBoundaryError);
  });

  it('signal cannot become approved job without Main approval', () => {
    const result = createCoderJobFromSignal(signal());

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      blocked: true,
      reason: 'main_approval_required',
      state: 'blocked',
      creates_coder_job: false,
      executable: false,
    }));
  });

  it('Main approval can create approved job with required fields', () => {
    const result = createCoderJobFromSignal(signal(), { approval: approval() });

    expect(result.ok).toBe(true);
    expect(result.job).toEqual(expect.objectContaining({
      id: 'subconscious_job_import-lock-watcher',
      state: 'approved',
      signal_slug: 'import-lock-watcher',
      objective: 'Create a review-only import boundary checker design.',
      approval_source: 'main_approval_artifact',
      approval_timestamp: '2026-05-10T14:00:00.000Z',
      review_only_signal: true,
      executable: false,
      dispatched: false,
      auto_build: false,
      requires_sprint_lock: true,
    }));
    expect(result.job.owned_paths).toContain('lib/radar/subconscious-job-boundary.js');
    expect(result.job.required_tests).toHaveLength(1);
  });

  it('missing required approval fields fails', () => {
    expect(() => normalizeMainApproval(approval({ objective: '', required_tests: [] })))
      .toThrow(JobBoundaryError);
  });

  it('active sprint lock prevents second active job', () => {
    const job = buildApprovedJob(signal(), approval());

    expect(() => transitionCoderJob(job, 'active', {
      jobs: [{ id: 'other-job', state: 'active' }],
    })).toThrow(/Active sprint lock/);
  });

  it('forbidden no-touch path blocks job', () => {
    expect(() => buildApprovedJob(signal(), approval({
      owned_paths: ['trading/router.js'],
    }))).toThrow(/sensitive surfaces require explicit named operator approval/);
  });

  it('explicit approval metadata is required for any sensitive path', () => {
    expect(() => buildApprovedJob(signal(), approval({
      owned_paths: ['ninjatrader/LukeNativeShadowStrategy.cs'],
      explicitly_approved_surfaces: ['ninjatrader'],
    }))).toThrow(/sensitive surfaces require explicit named operator approval/);

    const job = buildApprovedJob(signal(), approval({
      owned_paths: ['ninjatrader/LukeNativeShadowStrategy.cs'],
      explicitly_approved_surfaces: ['ninjatrader'],
      sensitive_surface_override: true,
    }));

    expect(job.touched_surfaces).toContain('ninjatrader');
    expect(job.executable).toBe(false);
  });

  it('approved job still does not execute anything', () => {
    const job = buildApprovedJob(signal(), approval());
    const active = transitionCoderJob(job, 'active', { now: new Date('2026-05-10T14:05:00.000Z') });

    expect(job.executable).toBe(false);
    expect(job.dispatched).toBe(false);
    expect(active.state).toBe('active');
    expect(active.sprint_lock).toEqual(expect.objectContaining({
      active: true,
      job_id: job.id,
    }));
    expect(active.executable).toBe(false);
    expect(active.dispatched).toBe(false);
  });

  it('failed QA routes to qa_failed with repair_required state', () => {
    const job = buildApprovedJob(signal(), approval());
    const failed = transitionCoderJob(job, 'qa_failed');

    expect(failed.state).toBe('qa_failed');
    expect(failed.repair_state).toBe('repair_required');
    expect(failed.executable).toBe(false);
  });

  it('archived and complete jobs do not reactivate automatically', () => {
    const job = buildApprovedJob(signal(), approval());
    const archived = transitionCoderJob(job, 'archived');
    const complete = transitionCoderJob(job, 'complete');

    expect(() => transitionCoderJob(archived, 'active')).toThrow(/Terminal jobs do not reactivate/);
    expect(() => transitionCoderJob(complete, 'active')).toThrow(/Terminal jobs do not reactivate/);
  });
});
