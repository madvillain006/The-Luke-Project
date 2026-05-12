'use strict';

const ALLOWED_SIGNAL_TYPES = new Set([
  'commit',
  'friction',
  'excitement',
  'reuse',
  'mention',
  'return',
  'cooling',
  'evidence',
  'operator_note',
]);

const ALLOWED_STATUSES = new Set([
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
]);

const ALLOWED_COOLDOWN_STATES = new Set(['clear', 'cooldown']);
const ALLOWED_LOCK_STATES = new Set(['none', 'active']);

const PROTECTED_SURFACE_RULES = [
  ['trading', /\btrading\b|(?:^|[\\/])trading(?:[\\/]|$)/i],
  ['pine', /\bpine\b|\btradingview\b|(?:^|[\\/])tradingview(?:[\\/]|$)/i],
  ['ninjatrader', /\bninja(?:trader)?\b|(?:^|[\\/])ninjatrader(?:[\\/]|$)/i],
  ['market-hours', /\bmarket[-_\s]?hours\b|lib[\\/]market-hours\.js/i],
  ['broker', /\bbroker\b|\baccount routing\b|\baccount\b/i],
  ['risk', /\brisk\b|\bkill[-_\s]?switch\b|\bposition[-_\s]?siz/i],
  ['credentials', /\bcredential\b|\bsecret\b|\bauth\b|\btoken\b|(?:^|[\\/])\.env(?:\.|$)?/i],
  ['execution', /\bexecution\b|\border\b|\blive[-_\s]?trade\b|\bsubmit\b/i],
  ['runtime-state', /state[\\/]events|state[\\/]snapshots/i],
  ['katbot', /agents[\\/]agent-14-kat\.js|lib[\\/]kat|(?:^|[\\/])katbot(?:[\\/]|$)/i],
];

class SubconsciousSignalValidationError extends Error {
  constructor(issues) {
    super(`Invalid Subconscious signal: ${issues.map(issue => issue.message).join('; ')}`);
    this.name = 'SubconsciousSignalValidationError';
    this.issues = issues;
  }
}

function issue(field, message) {
  return { field, message };
}

function asString(value) {
  return String(value || '').trim();
}

function compactText(value, max = 2400) {
  const text = asString(value).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function normalizeSlug(value) {
  return asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return null;
  return value.map(item => asString(item)).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function getReviewOnly(input) {
  if (hasOwn(input, 'review_only')) return input.review_only;
  if (hasOwn(input, 'reviewOnly')) return input.reviewOnly;
  if (hasOwn(input.review, 'review_only')) return input.review.review_only;
  if (hasOwn(input.review, 'reviewOnly')) return input.review.reviewOnly;
  return undefined;
}

function getSignalStatus(input) {
  const explicit = input.status || input.lifecycle_status || input.lifecycleStatus || input.signals?.status;
  if (explicit) return asString(explicit).toLowerCase();
  if (asString(input.review?.status).toLowerCase() === 'review_only') return 'watching';
  return '';
}

function normalizeSource(source) {
  if (typeof source === 'string') {
    return {
      agent: source,
      mode: null,
      source_label: 'luke-subconscious',
      source_url: null,
    };
  }
  if (!source || typeof source !== 'object') return null;
  return {
    agent: asString(source.agent || source.name || 'subconscious') || 'subconscious',
    mode: asString(source.mode) || null,
    source_label: asString(source.source_label || source.sourceLabel || source.label || 'luke-subconscious') || 'luke-subconscious',
    source_url: asString(source.source_url || source.sourceUrl || source.url) || null,
  };
}

function getCandidateText(input) {
  return compactText(input.raw_text || input.rawText || input.text || input.message);
}

function getSignals(input) {
  return {
    signal_types: normalizeStringArray(input.signal_types || input.signalTypes || input.signals?.types),
    score: input.score ?? input.signals?.score,
    positive_walk_count: input.positive_walk_count ?? input.positiveWalkCount ?? input.signals?.positive_walk_count ?? input.signals?.positiveWalkCount,
    cooldown_state: asString(input.cooldown_state || input.cooldownState || input.signals?.cooldown_state || input.signals?.cooldownState).toLowerCase(),
    lock_state: asString(input.lock_state || input.lockState || input.signals?.lock_state || input.signals?.lockState).toLowerCase(),
  };
}

function getBoundaries(input) {
  return {
    non_goals: normalizeStringArray(input.non_goals || input.nonGoals || input.boundaries?.non_goals || input.boundaries?.nonGoals),
    forbidden_surfaces: normalizeStringArray(input.forbidden_surfaces || input.forbiddenSurfaces || input.boundaries?.forbidden_surfaces || input.boundaries?.forbiddenSurfaces),
  };
}

function explicitApprovalCovers(input, surfaces) {
  const approval = input.explicit_approval || input.explicitApproval || input.main_approval || input.mainApproval || input.approval;
  if (!approval || approval.approved !== true) return false;
  if (!asString(approval.owner || approval.approved_by || approval.approvedBy)) return false;
  const approvedSurfaces = normalizeStringArray(approval.surfaces || approval.approved_surfaces || approval.approvedSurfaces) || [];
  const approved = new Set(approvedSurfaces.map(surface => surface.toLowerCase()));
  return surfaces.every(surface => approved.has(surface));
}

function protectedSurfaceHits(input) {
  const targetValues = [
    input.title,
    input.raw_text,
    input.rawText,
    input.text,
    input.message,
    ...(normalizeStringArray(input.target_surfaces || input.targetSurfaces || input.requested_surfaces || input.requestedSurfaces || input.surfaces) || []),
    ...(normalizeStringArray(input.target_paths || input.targetPaths || input.paths || input.files) || []),
  ];
  const haystack = targetValues.map(asString).filter(Boolean).join('\n');
  return PROTECTED_SURFACE_RULES
    .filter(([, re]) => re.test(haystack))
    .map(([surface]) => surface);
}

function normalizeSubconsciousSignal(input = {}, options = {}) {
  const issues = [];
  const slug = normalizeSlug(input.slug || input.id);
  const source = normalizeSource(input.source);
  const rawText = getCandidateText(input);
  const title = compactText(input.title || slug, 140);
  const status = getSignalStatus(input);
  const reviewOnly = getReviewOnly(input);
  const recallReason = compactText(input.recall_reason || input.recallReason || input.why_recalled || input.whyRecalled || input.radar_mapping?.recall_reason || 'subconscious_signal_review_lane', 180);
  const createdAtRaw = input.created_at || input.createdAt || input.timestamp || input.ts;
  const createdAt = createdAtRaw ? asString(createdAtRaw) : (options.now instanceof Date ? options.now : new Date()).toISOString();
  const signals = getSignals(input);
  const boundaries = getBoundaries(input);

  if (!slug) issues.push(issue('slug', 'slug is required'));
  if (!source) issues.push(issue('source', 'source is required'));
  if (!rawText) issues.push(issue('raw_text', 'raw_text or text is required'));

  if (!signals.signal_types) {
    issues.push(issue('signal_types', 'signal_types must be an array'));
  } else if (!signals.signal_types.length) {
    issues.push(issue('signal_types', 'signal_types must not be empty'));
  } else {
    for (const type of signals.signal_types) {
      if (!ALLOWED_SIGNAL_TYPES.has(type)) {
        issues.push(issue('signal_types', `unsupported signal type: ${type}`));
      }
    }
  }

  const score = Number(signals.score);
  if (signals.score === undefined || signals.score === null || signals.score === '') {
    issues.push(issue('score', 'score is required'));
  } else if (!Number.isFinite(score)) {
    issues.push(issue('score', 'score must be numeric'));
  } else if (score < 0 || score > 10) {
    issues.push(issue('score', 'score must be between 0 and 10'));
  }

  const positiveWalkCount = Number(signals.positive_walk_count);
  if (signals.positive_walk_count === undefined || signals.positive_walk_count === null || signals.positive_walk_count === '') {
    issues.push(issue('positive_walk_count', 'positive_walk_count is required'));
  } else if (!Number.isInteger(positiveWalkCount) || positiveWalkCount < 0) {
    issues.push(issue('positive_walk_count', 'positive_walk_count must be a non-negative integer'));
  }

  if (!ALLOWED_COOLDOWN_STATES.has(signals.cooldown_state)) {
    issues.push(issue('cooldown_state', 'cooldown_state must be clear or cooldown'));
  }
  if (!ALLOWED_LOCK_STATES.has(signals.lock_state)) {
    issues.push(issue('lock_state', 'lock_state must be none or active'));
  }
  if (!status) {
    issues.push(issue('status', 'status is required'));
  } else if (!ALLOWED_STATUSES.has(status)) {
    issues.push(issue('status', `status must be one of ${[...ALLOWED_STATUSES].join(', ')}`));
  }
  if (reviewOnly !== true) {
    issues.push(issue('review_only', 'review_only must be true'));
  }
  if (!boundaries.non_goals) {
    issues.push(issue('non_goals', 'non_goals must be an array'));
  }
  if (!boundaries.forbidden_surfaces) {
    issues.push(issue('forbidden_surfaces', 'forbidden_surfaces must be an array'));
  }

  if (issues.length) throw new SubconsciousSignalValidationError(issues);

  const blockedSurfaces = unique(protectedSurfaceHits(input));
  const approvalCoversProtected = blockedSurfaces.length ? explicitApprovalCovers(input, blockedSurfaces) : false;
  const safeStatus = blockedSurfaces.length && !approvalCoversProtected ? 'blocked' : status;

  return {
    schema_version: 1,
    kind: 'subconscious_signal',
    slug,
    title,
    raw_text: rawText,
    source,
    signal_types: unique(signals.signal_types),
    score,
    positive_walk_count: positiveWalkCount,
    cooldown_state: signals.cooldown_state,
    lock_state: signals.lock_state,
    status: safeStatus,
    requested_status: status,
    non_goals: boundaries.non_goals,
    forbidden_surfaces: boundaries.forbidden_surfaces,
    blocked_surfaces: blockedSurfaces,
    blocked_reason: blockedSurfaces.length && !approvalCoversProtected ? 'protected_surface_requires_explicit_named_approval' : null,
    review_only: true,
    requires_main_approval: true,
    trading_authority: 'none',
    recall_reason: recallReason,
    created_at: createdAt,
    creates_coder_job: false,
    creates_schedule: false,
    writes_runtime_state: false,
    approval: {
      explicit_named_approval_present: approvalCoversProtected,
      main_approval_required: true,
    },
  };
}

function formatMetadataBlock(signal) {
  return [
    `[SUBCONSCIOUS_PROPOSAL: ${signal.slug}]`,
    `title: ${signal.title}`,
    `signal_types: ${signal.signal_types.join(', ')}`,
    `score: ${signal.score}`,
    `positive_walk_count: ${signal.positive_walk_count}`,
    `cooldown_state: ${signal.cooldown_state}`,
    `lock_state: ${signal.lock_state}`,
    `status: ${signal.status}`,
    `requested_status: ${signal.requested_status}`,
    `review_only: ${signal.review_only}`,
    `requires_main_approval: ${signal.requires_main_approval}`,
    `trading_authority: ${signal.trading_authority}`,
    `non_goals: ${signal.non_goals.join(', ') || 'none'}`,
    `forbidden_surfaces: ${signal.forbidden_surfaces.join(', ') || 'none'}`,
    signal.blocked_surfaces.length ? `blocked_surfaces: ${signal.blocked_surfaces.join(', ')}` : null,
    signal.blocked_reason ? `blocked_reason: ${signal.blocked_reason}` : null,
    `why_recalled: ${signal.recall_reason}`,
    '',
    signal.raw_text,
  ].filter(line => line !== null).join('\n');
}

function mapSubconsciousSignalToRadarInput(signalInput, options = {}) {
  const signal = signalInput?.kind === 'subconscious_signal'
    ? signalInput
    : normalizeSubconsciousSignal(signalInput, options);
  return {
    source_type: 'reference_idea',
    source_label: 'luke-subconscious',
    scope: 'subconscious_review',
    status: 'review_only',
    review_only: true,
    trading_authority: 'none',
    title: signal.title,
    text: formatMetadataBlock(signal),
    recall_reason: signal.recall_reason,
    relationship_ids: unique([
      `subconscious:${signal.slug}`,
      signal.source.mode ? `walk-mode:${signal.source.mode}` : null,
    ].filter(Boolean)),
    _normalized_signal: signal,
    _does_not_write_state: true,
  };
}

function validateSubconsciousSignal(input = {}, options = {}) {
  try {
    return { ok: true, signal: normalizeSubconsciousSignal(input, options), errors: [] };
  } catch (err) {
    if (err instanceof SubconsciousSignalValidationError) {
      return { ok: false, signal: null, errors: err.issues };
    }
    throw err;
  }
}

module.exports = {
  ALLOWED_SIGNAL_TYPES,
  ALLOWED_STATUSES,
  SubconsciousSignalValidationError,
  mapSubconsciousSignalToRadarInput,
  normalizeSubconsciousSignal,
  validateSubconsciousSignal,
  _internal: {
    formatMetadataBlock,
    protectedSurfaceHits,
  },
};
