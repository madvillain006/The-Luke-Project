'use strict';

const {
  normalizeSubconsciousSignal,
  _internal: signalInternal,
} = require('./subconscious-signal');

const JOB_STATES = new Set([
  'pending_intent',
  'pending_plan',
  'approved',
  'active',
  'qa_failed',
  'complete',
  'archived',
  'rejected',
  'blocked',
  'repair_required',
]);

const REQUIRED_APPROVAL_FIELDS = [
  'objective',
  'owned_paths',
  'forbidden_paths',
  'stop_condition',
  'required_tests',
  'rollback_path',
  'approval_source',
  'approved_at',
];

const TERMINAL_STATES = new Set(['complete', 'archived', 'rejected']);
const SENSITIVE_SURFACES = new Set([
  'trading',
  'pine',
  'ninjatrader',
  'market-hours',
  'broker',
  'risk',
  'credentials',
  'execution',
  'runtime-state',
  'katbot',
]);

class JobBoundaryError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'JobBoundaryError';
    this.issues = issues;
  }
}

function issue(field, message) {
  return { field, message };
}

function asString(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return null;
  return value.map(item => asString(item)).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function approvalValue(approval = {}, key) {
  const alt = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  return approval[key] ?? approval[alt];
}

function normalizeMainApproval(approval = {}, options = {}) {
  const issues = [];
  if (!approval || typeof approval !== 'object') {
    throw new JobBoundaryError('Main approval metadata is required', [issue('approval', 'approval must be an object')]);
  }
  if (approval.approved !== true) issues.push(issue('approved', 'approval.approved must be true'));
  if (!asString(approval.owner || approval.approved_by || approval.approvedBy)) {
    issues.push(issue('owner', 'approval owner is required'));
  }
  if (!asString(approval.proposal_slug || approval.proposalSlug || approval.slug)) {
    issues.push(issue('proposal_slug', 'proposal_slug is required'));
  }
  for (const field of REQUIRED_APPROVAL_FIELDS) {
    const value = approvalValue(approval, field);
    if (field === 'owned_paths' || field === 'forbidden_paths' || field === 'required_tests') {
      if (!normalizeArray(value)?.length) issues.push(issue(field, `${field} must be a non-empty array`));
    } else if (!asString(value)) {
      issues.push(issue(field, `${field} is required`));
    }
  }
  if (!asString(approval.explicit_promotion_statement || approval.explicitPromotionStatement)) {
    issues.push(issue('explicit_promotion_statement', 'explicit statement allowing the signal to become a plan is required'));
  }

  if (issues.length) throw new JobBoundaryError('Invalid Main approval metadata', issues);

  return {
    approved: true,
    owner: asString(approval.owner || approval.approved_by || approval.approvedBy),
    proposal_slug: asString(approval.proposal_slug || approval.proposalSlug || approval.slug),
    objective: asString(approval.objective),
    owned_paths: normalizeArray(approval.owned_paths || approval.ownedPaths),
    forbidden_paths: normalizeArray(approval.forbidden_paths || approval.forbiddenPaths),
    stop_condition: asString(approval.stop_condition || approval.stopCondition),
    required_tests: normalizeArray(approval.required_tests || approval.requiredTests),
    rollback_path: asString(approval.rollback_path || approval.rollbackPath),
    approval_source: asString(approval.approval_source || approval.approvalSource),
    approved_at: asString(approval.approved_at || approval.approvedAt || approval.timestamp) || (options.now instanceof Date ? options.now.toISOString() : null),
    explicit_promotion_statement: asString(approval.explicit_promotion_statement || approval.explicitPromotionStatement),
    explicitly_approved_surfaces: normalizeArray(approval.explicitly_approved_surfaces || approval.explicitlyApprovedSurfaces || approval.approved_surfaces || approval.approvedSurfaces) || [],
    sensitive_surface_override: approval.sensitive_surface_override === true || approval.sensitiveSurfaceOverride === true,
  };
}

function detectSurfacesForJob(signal, approval) {
  return unique(signalInternal.protectedSurfaceHits({
    title: approval.objective,
    raw_text: [
      signal.raw_text,
      approval.objective,
      approval.stop_condition,
      approval.rollback_path,
      ...(approval.owned_paths || []),
    ].join('\n'),
    target_paths: approval.owned_paths,
    target_surfaces: approval.explicitly_approved_surfaces,
  }));
}

function sensitiveSurfaceBlockers(surfaces, approval) {
  if (!surfaces.length) return [];
  const approved = new Set((approval.explicitly_approved_surfaces || []).map(surface => surface.toLowerCase()));
  return surfaces.filter(surface => SENSITIVE_SURFACES.has(surface) && (!approval.sensitive_surface_override || !approved.has(surface)));
}

function jobIdFor(signal) {
  return `subconscious_job_${signal.slug}`;
}

function buildApprovedJob(signalInput, approvalInput, options = {}) {
  const signal = normalizeSubconsciousSignal(signalInput, options);
  const approval = normalizeMainApproval(approvalInput, options);
  const issues = [];

  if (signal.slug !== approval.proposal_slug) {
    issues.push(issue('proposal_slug', 'approval proposal_slug must match signal slug'));
  }
  if (signal.review_only !== true) issues.push(issue('review_only', 'source signal must remain review_only'));
  if (signal.creates_coder_job !== false) issues.push(issue('creates_coder_job', 'source signal cannot create Coder jobs'));
  if (signal.status === 'active') issues.push(issue('signal_status', 'signal cannot directly create active jobs'));

  const touchedSurfaces = detectSurfacesForJob(signal, approval);
  const blockedSurfaces = sensitiveSurfaceBlockers(touchedSurfaces, approval);
  if (blockedSurfaces.length) {
    issues.push(issue('sensitive_surfaces', `sensitive surfaces require explicit named operator approval: ${blockedSurfaces.join(', ')}`));
  }

  if (issues.length) {
    throw new JobBoundaryError(`Cannot create approved job from signal: ${issues.map(item => item.message).join('; ')}`, issues);
  }

  return {
    id: jobIdFor(signal),
    state: 'approved',
    signal_slug: signal.slug,
    title: signal.title,
    objective: approval.objective,
    owned_paths: approval.owned_paths,
    forbidden_paths: approval.forbidden_paths,
    stop_condition: approval.stop_condition,
    required_tests: approval.required_tests,
    rollback_path: approval.rollback_path,
    approval_source: approval.approval_source,
    approval_timestamp: approval.approved_at,
    approval_owner: approval.owner,
    explicit_promotion_statement: approval.explicit_promotion_statement,
    touched_surfaces: touchedSurfaces,
    review_only_signal: true,
    executable: false,
    dispatched: false,
    auto_build: false,
    requires_sprint_lock: true,
    created_at: options.now instanceof Date ? options.now.toISOString() : approval.approved_at,
  };
}

function createCoderJobFromSignal(signalInput, options = {}) {
  if (!options.approval) {
    return {
      ok: false,
      blocked: true,
      reason: 'main_approval_required',
      state: 'blocked',
      creates_coder_job: false,
      executable: false,
    };
  }
  const requestedState = asString(options.target_state || options.targetState || 'approved') || 'approved';
  if (requestedState === 'active') {
    throw new JobBoundaryError('Signals cannot directly create active jobs', [issue('target_state', 'target_state active requires approved job transition')]);
  }
  if (requestedState !== 'approved') {
    throw new JobBoundaryError('Unsupported initial job state', [issue('target_state', 'initial job state must be approved')]);
  }
  return {
    ok: true,
    job: buildApprovedJob(signalInput, options.approval, options),
  };
}

function hasActiveSprintLock(context = {}) {
  if (context.active_sprint_lock === true || context.activeSprintLock === true) return true;
  return (context.jobs || []).some(job => job && job.state === 'active');
}

function transitionCoderJob(job = {}, nextState, context = {}) {
  const target = asString(nextState);
  if (!JOB_STATES.has(target)) {
    throw new JobBoundaryError('Invalid job state', [issue('state', `state must be one of ${[...JOB_STATES].join(', ')}`)]);
  }
  if (TERMINAL_STATES.has(job.state)) {
    throw new JobBoundaryError('Terminal jobs do not reactivate automatically', [issue('state', `${job.state} is terminal`)]);
  }
  if (target === 'active') {
    if (job.state !== 'approved') {
      throw new JobBoundaryError('Only approved jobs can become active', [issue('state', 'job must be approved before active')]);
    }
    if (hasActiveSprintLock(context)) {
      throw new JobBoundaryError('Active sprint lock prevents activating another job', [issue('sprint_lock', 'one active sprint lock is allowed')]);
    }
    return {
      ...job,
      state: 'active',
      sprint_lock: {
        active: true,
        job_id: job.id,
        acquired_at: context.now instanceof Date ? context.now.toISOString() : (context.now || job.approval_timestamp || null),
      },
      executable: false,
      dispatched: false,
    };
  }
  if (target === 'qa_failed') {
    return {
      ...job,
      state: 'qa_failed',
      repair_state: 'repair_required',
      executable: false,
      dispatched: false,
    };
  }
  if (target === 'repair_required') {
    return {
      ...job,
      state: 'repair_required',
      executable: false,
      dispatched: false,
    };
  }
  return {
    ...job,
    state: target,
    executable: false,
    dispatched: false,
  };
}

module.exports = {
  JOB_STATES,
  JobBoundaryError,
  buildApprovedJob,
  createCoderJobFromSignal,
  normalizeMainApproval,
  transitionCoderJob,
  _internal: {
    detectSurfacesForJob,
    hasActiveSprintLock,
    sensitiveSurfaceBlockers,
  },
};
