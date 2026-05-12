'use strict';

const {
  ALLOWED_STATUSES,
  normalizeSubconsciousSignal,
  validateSubconsciousSignal,
} = require('./subconscious-signal');

const BOARD_STATES = [
  'watching',
  'ready_for_main_review',
  'blocked',
  'cooldown',
  'queued_after_approval',
  'active',
  'built',
  'failed_qa',
  'repaired',
  'archived',
];

const BOARD_GROUPS = [...BOARD_STATES, 'malformed'];
const TERMINAL_STATES = new Set(['built', 'failed_qa', 'repaired', 'archived']);
const APPROVAL_STATES = new Set(['queued_after_approval', 'active']);

function emptyGroups() {
  return Object.fromEntries(BOARD_GROUPS.map(state => [state, []]));
}

function emptyCounts() {
  return Object.fromEntries(BOARD_GROUPS.map(state => [state, 0]));
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (value) return String(value);
  return new Date(0).toISOString();
}

function summarizeSignal(signal, boardState, readiness) {
  return {
    slug: signal.slug,
    title: signal.title,
    state: boardState,
    original_status: signal.status,
    requested_status: signal.requested_status,
    score: signal.score,
    positive_walk_count: signal.positive_walk_count,
    signal_types: signal.signal_types,
    cooldown_state: signal.cooldown_state,
    lock_state: signal.lock_state,
    review_only: signal.review_only === true,
    requires_main_approval: signal.requires_main_approval === true,
    trading_authority: signal.trading_authority || 'none',
    non_goals: signal.non_goals || [],
    forbidden_surfaces: signal.forbidden_surfaces || [],
    blocked_surfaces: signal.blocked_surfaces || [],
    blocked_reason: signal.blocked_reason || null,
    created_at: signal.created_at,
    recall_reason: signal.recall_reason || null,
    readiness,
    approved_to_build: false,
    creates_coder_job: false,
    executable: false,
  };
}

function readinessFor(signal, options = {}) {
  const reasons = [];
  const sprintLockActive = options.sprintLockActive === true || options.activeSprintLock === true;
  const approvedAsJob = signal.approved_as_job === true || signal.job_id || signal.jobId;

  if (signal.score < 6) reasons.push('score_below_6');
  if (signal.positive_walk_count < 3) reasons.push('positive_walk_count_below_3');
  if ((signal.signal_types || []).length < 2) reasons.push('fewer_than_2_signal_types');
  if (sprintLockActive || signal.lock_state === 'active') reasons.push('active_sprint_lock');
  if (signal.cooldown_state === 'cooldown' || signal.status === 'cooldown') reasons.push('cooldown');
  if ((signal.blocked_surfaces || []).length || signal.blocked_reason) reasons.push('hard_block');
  if (signal.review_only !== true) reasons.push('not_review_only');
  if (approvedAsJob) reasons.push('already_approved_as_job');

  return {
    ready_for_main_review: reasons.length === 0,
    reasons,
  };
}

function classifySignal(signal, options = {}) {
  if (!ALLOWED_STATUSES.has(signal.status)) return 'blocked';
  if (TERMINAL_STATES.has(signal.status)) return signal.status;
  if (APPROVAL_STATES.has(signal.status)) return signal.status;
  if (signal.status === 'blocked' || (signal.blocked_surfaces || []).length || signal.blocked_reason) return 'blocked';
  if (signal.status === 'cooldown' || signal.cooldown_state === 'cooldown') return 'cooldown';

  const readiness = readinessFor(signal, options);
  if (readiness.ready_for_main_review) return 'ready_for_main_review';
  return 'watching';
}

function sortBoardItems(items = []) {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.positive_walk_count !== a.positive_walk_count) return b.positive_walk_count - a.positive_walk_count;
    const dateDiff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    if (dateDiff) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

function buildSubconsciousSignalBoard(inputs = [], options = {}) {
  const groups = emptyGroups();
  const warnings = [];
  const generatedAt = toIso(options.now || options.generated_at || options.generatedAt);

  const values = Array.isArray(inputs) ? inputs : [];
  values.forEach((input, index) => {
    const validation = validateSubconsciousSignal(input, options);
    if (!validation.ok) {
      const malformed = {
        index,
        slug: input && (input.slug || input.id) ? String(input.slug || input.id) : null,
        title: input && input.title ? String(input.title) : null,
        code: 'malformed_signal',
        errors: validation.errors,
        creates_coder_job: false,
        writes_runtime_state: false,
        executable: false,
      };
      groups.malformed.push(malformed);
      warnings.push(malformed);
      return;
    }

    const signal = {
      ...normalizeSubconsciousSignal(input, options),
      approved_as_job: input.approved_as_job === true || Boolean(input.job_id || input.jobId),
      job_id: input.job_id || input.jobId || null,
    };
    const readiness = readinessFor(signal, options);
    const boardState = classifySignal(signal, options);
    groups[boardState].push(summarizeSignal(signal, boardState, readiness));
  });

  for (const state of BOARD_STATES) groups[state] = sortBoardItems(groups[state]);

  const counts = emptyCounts();
  for (const state of BOARD_GROUPS) counts[state] = groups[state].length;

  return {
    ok: true,
    kind: 'subconscious_signal_board',
    label: 'Subconscious signal board',
    generated_at: generatedAt,
    counts: {
      total: values.length,
      valid: values.length - warnings.length,
      malformed: warnings.length,
      by_state: counts,
    },
    ready_for_main_review: groups.ready_for_main_review,
    blocked: groups.blocked,
    cooldown: groups.cooldown,
    watching: groups.watching,
    queued_after_approval: groups.queued_after_approval,
    active: groups.active,
    built: groups.built,
    failed_qa: groups.failed_qa,
    repaired: groups.repaired,
    archived: groups.archived,
    malformed: groups.malformed,
    groups,
    warnings,
    policy: {
      review_only: true,
      ready_for_main_review_is_approval: false,
      creates_coder_jobs: false,
      writes_runtime_state: false,
      scheduled_thinking: false,
      auto_build: false,
    },
  };
}

module.exports = {
  BOARD_STATES,
  buildSubconsciousSignalBoard,
  _internal: {
    classifySignal,
    readinessFor,
    sortBoardItems,
  },
};
