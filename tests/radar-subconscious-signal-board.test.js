'use strict';

const { buildSubconsciousSignalBoard } = require('../lib/radar/subconscious-signal-board');

function signal(overrides = {}) {
  return {
    slug: 'signal-a',
    title: 'Signal A',
    raw_text: 'A review-only idea for Luke workflow hygiene.',
    source: {
      agent: 'subconscious',
      mode: 'continue-project',
      source_label: 'luke-subconscious',
    },
    signal_types: ['return', 'evidence'],
    score: 6,
    positive_walk_count: 3,
    cooldown_state: 'clear',
    lock_state: 'none',
    status: 'watching',
    non_goals: ['no Coder job'],
    forbidden_surfaces: ['trading', 'pine', 'ninjatrader', 'broker', 'risk', 'credentials', 'runtime-state'],
    review_only: true,
    created_at: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('Subconscious signal board', () => {
  it('keeps a low score signal in watching', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'low-score', score: 5 }),
    ], { now: new Date('2026-05-10T13:00:00.000Z') });

    expect(board.generated_at).toBe('2026-05-10T13:00:00.000Z');
    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.watching[0]).toEqual(expect.objectContaining({
      slug: 'low-score',
      state: 'watching',
      approved_to_build: false,
      executable: false,
    }));
    expect(board.watching[0].readiness.reasons).toContain('score_below_6');
  });

  it('keeps score >= 6 with too few positive walks out of ready lane', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'not-enough-walks', score: 8, positive_walk_count: 2 }),
    ]);

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.watching[0].readiness.reasons).toContain('positive_walk_count_below_3');
  });

  it('keeps enough score and walks with one signal type out of ready lane', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'one-type', score: 8, positive_walk_count: 3, signal_types: ['return'] }),
    ]);

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.watching[0].readiness.reasons).toContain('fewer_than_2_signal_types');
  });

  it('puts cooldown signals in the cooldown lane', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'cooling', score: 9, positive_walk_count: 4, cooldown_state: 'cooldown' }),
    ]);

    expect(board.cooldown[0]).toEqual(expect.objectContaining({ slug: 'cooling', state: 'cooldown' }));
    expect(board.cooldown[0].readiness.reasons).toContain('cooldown');
    expect(board.ready_for_main_review).toHaveLength(0);
  });

  it('active sprint lock blocks readiness', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'locked', score: 9, positive_walk_count: 4 }),
    ], { sprintLockActive: true });

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.watching[0].readiness.reasons).toContain('active_sprint_lock');
  });

  it('forbidden trading, Pine, Ninja, broker, risk, credential, and execution target blocks readiness', () => {
    const board = buildSubconsciousSignalBoard([
      signal({
        slug: 'unsafe-target',
        score: 9,
        positive_walk_count: 4,
        raw_text: 'Change Pine, NinjaTrader, broker execution, risk, and credential token handling.',
        target_paths: ['trading/router.js', 'tradingview/foo.pine', 'ninjatrader/Strategy.cs'],
      }),
    ]);

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.blocked[0]).toEqual(expect.objectContaining({ slug: 'unsafe-target', state: 'blocked' }));
    expect(board.blocked[0].blocked_surfaces).toEqual(expect.arrayContaining([
      'trading',
      'pine',
      'ninjatrader',
      'broker',
      'risk',
      'credentials',
      'execution',
    ]));
    expect(board.blocked[0].readiness.reasons).toContain('hard_block');
  });

  it('ready_for_main_review is not active or approved', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'ready-only', score: 8, positive_walk_count: 3, signal_types: ['return', 'evidence'] }),
    ]);

    expect(board.ready_for_main_review[0]).toEqual(expect.objectContaining({
      slug: 'ready-only',
      state: 'ready_for_main_review',
      approved_to_build: false,
      creates_coder_job: false,
      executable: false,
      requires_main_approval: true,
    }));
    expect(board.active).toHaveLength(0);
    expect(board.queued_after_approval).toHaveLength(0);
    expect(board.policy.ready_for_main_review_is_approval).toBe(false);
  });

  it('orders lanes deterministically by score, walks, created_at, then slug', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'older', score: 7, positive_walk_count: 3, created_at: '2026-05-10T10:00:00.000Z' }),
      signal({ slug: 'newer', score: 7, positive_walk_count: 3, created_at: '2026-05-10T11:00:00.000Z' }),
      signal({ slug: 'highest', score: 9, positive_walk_count: 3, created_at: '2026-05-10T12:00:00.000Z' }),
      signal({ slug: 'more-walks', score: 7, positive_walk_count: 4, created_at: '2026-05-10T09:00:00.000Z' }),
    ]);

    expect(board.ready_for_main_review.map(item => item.slug)).toEqual([
      'highest',
      'more-walks',
      'older',
      'newer',
    ]);
  });

  it('reports malformed signals safely without throwing', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'valid-ready' }),
      { slug: '', score: 'bad', review_only: false },
    ]);

    expect(board.kind).toBe('subconscious_signal_board');
    expect(board.counts.total).toBe(2);
    expect(board.counts.valid).toBe(1);
    expect(board.counts.malformed).toBe(1);
    expect(board.malformed).toHaveLength(1);
    expect(board.groups.malformed).toHaveLength(1);
    expect(board.warnings[0]).toEqual(expect.objectContaining({
      code: 'malformed_signal',
      creates_coder_job: false,
      writes_runtime_state: false,
      executable: false,
    }));
    expect(board.warnings[0].errors.length).toBeGreaterThan(0);
  });

  it('keeps already approved job signals out of ready lane', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'already-job', score: 10, positive_walk_count: 8, approved_as_job: true, job_id: 'job-1' }),
    ]);

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.watching[0].readiness.reasons).toContain('already_approved_as_job');
    expect(board.watching[0].approved_to_build).toBe(false);
  });

  it('does not re-enter archived or built signals into the ready lane', () => {
    const board = buildSubconsciousSignalBoard([
      signal({ slug: 'archived-one', status: 'archived', score: 10, positive_walk_count: 10 }),
      signal({ slug: 'built-one', status: 'built', score: 10, positive_walk_count: 10 }),
      signal({ slug: 'failed-one', status: 'failed_qa', score: 10, positive_walk_count: 10 }),
    ]);

    expect(board.ready_for_main_review).toHaveLength(0);
    expect(board.archived[0].slug).toBe('archived-one');
    expect(board.built[0].slug).toBe('built-one');
    expect(board.failed_qa[0].slug).toBe('failed-one');
  });
});
