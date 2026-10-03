'use strict';

const { validateQaPacket } = require('./qa-packet');
const { JOB_STATES } = require('./subconscious-job-boundary');

const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === 'string' ? value.trim() : '';

function relativePath(value) {
  const file = asText(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!file || file.startsWith('/') || /^[a-z]:/i.test(file) || file.split('/').includes('..')) return null;
  const normalized = file.split('/').filter(part => part && part !== '.').join('/');
  return normalized ? normalized + (file.endsWith('/') ? '/' : '') : null;
}

function matchesPath(file, scope) {
  const normalized = relativePath(scope);
  return normalized && (file === normalized || (normalized.endsWith('/') && file.startsWith(normalized)));
}

// Pure review-lane report: recommendations do not stop, dispatch, or repair agents.
function buildRuntimeMonitorReport(context = {}) {
  const reasons = [];
  const reason = (code, message) => reasons.push({ code, message });
  const workflow = context.workflow || {};
  const worktree = context.worktree || {};
  const owned = asArray(workflow.owned_paths || workflow.ownedPaths);
  const forbidden = asArray(workflow.forbidden_paths || workflow.forbiddenPaths);
  if (!context.workflow || !context.worktree || !Array.isArray(context.jobs) || !Array.isArray(context.signals) || !Array.isArray(context.qa_packets || context.qaPackets)) {
    reason('missing_inputs', 'Explicit workflow, worktree, jobs, signals, and QA packets are required.');
  }
  if (!owned.length || owned.some(scope => !relativePath(scope))) reason('missing_owned_paths', 'Workflow requires valid repository-relative owned paths.');
  if (!Array.isArray(workflow.forbidden_paths || workflow.forbiddenPaths)) reason('missing_forbidden_paths', 'Workflow requires an explicit forbidden-path list.');
  if (forbidden.some(scope => !relativePath(scope))) reason('invalid_forbidden_paths', 'Forbidden paths must be repository-relative.');
  if (!Array.isArray(worktree.dirty_files || worktree.dirtyFiles)) reason('missing_dirty_files', 'Worktree requires an explicit dirty-file list.');
  for (const raw of asArray(worktree.dirty_files || worktree.dirtyFiles)) {
    const file = relativePath(raw);
    if (!file) reason('invalid_dirty_path', 'A dirty path is not repository-relative.');
    else if (forbidden.some(scope => matchesPath(file, scope))) reason('forbidden_path_edit', `Forbidden path is dirty: ${file}`);
    else if (!owned.some(scope => matchesPath(file, scope))) reason('unapproved_path_edit', `Dirty path is outside workflow ownership: ${file}`);
  }
  if (asArray(worktree.conflicted_files || worktree.conflictedFiles).length) reason('worktree_conflict', 'Worktree has unresolved conflicts.');
  if (asArray(context.jobs).some(job => !JOB_STATES.has(job?.state))) reason('unknown_job_state', 'A job has an unknown or missing state.');
  const activeJobs = asArray(context.jobs).filter(job => job?.state === 'active');
  if (activeJobs.length > 1) reason('multiple_active_jobs', 'More than one job holds the active sprint lane.');
  if (asArray(context.jobs).some(job => ['qa_failed', 'repair_required'].includes(job?.state))) reason('repair_required', 'A job requires review and repair planning.');

  const qaPackets = asArray(context.qa_packets || context.qaPackets);
  for (const packet of qaPackets) {
    const validation = validateQaPacket(packet);
    if (!validation.ok) reason('invalid_qa_packet', 'QA evidence is malformed or missing required confirmations.');
    else if (validation.packet.result !== 'pass') reason('qa_not_passed', `QA result is ${validation.packet.result}; review is required.`);
  }
  const requiredTests = asArray(workflow.required_tests || workflow.requiredTests);
  const testsRun = new Set(qaPackets.flatMap(packet => {
    const validation = validateQaPacket(packet);
    return validation.ok && validation.packet.result === 'pass' ? validation.packet.tests_run : [];
  }));
  for (const test of requiredTests) {
    if (!testsRun.has(test)) reason('missing_test', `No passing QA evidence for required test: ${test}`);
  }
  const metrics = context.loop_metrics || context.loopMetrics || {};
  const maxIterations = workflow.max_iterations ?? workflow.maxIterations;
  if (Number.isFinite(maxIterations) && Number.isFinite(metrics.iterations) && metrics.iterations >= maxIterations) reason('iteration_limit', 'Workflow iteration limit has been reached.');
  if (Number.isFinite(metrics.consecutive_failures) && metrics.consecutive_failures >= 3) reason('repeated_failures', 'Three or more consecutive failures require review.');
  if (Number.isFinite(metrics.stalled_iterations) && metrics.stalled_iterations >= 3) reason('stalled_loop', 'Three or more iterations without progress require review.');

  return {
    ok: true,
    kind: 'runtime_monitor_report',
    status: reasons.length ? 'blocked' : 'healthy',
    reasons,
    recommended_next_action: reasons.length ? 'Pause for operator review; resolve the reported evidence or ownership issues.' : 'Continue the approved review lane; retain QA evidence for operator inspection.',
    policy: { review_only: true, runtime_state_writes: false, dispatch: false, automatic_repair: false },
  };
}

module.exports = { buildRuntimeMonitorReport };
