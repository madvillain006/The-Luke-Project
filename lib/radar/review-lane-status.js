'use strict';

const fs = require('fs');
const path = require('path');

const { llmRoutingStatus } = require('../llm-routing-policy');
const { buildSubconsciousSignalBoard } = require('./subconscious-signal-board');
const { buildRuntimeMonitorReport } = require('./runtime-monitor');
const { validateQaPacket } = require('./qa-packet');

function asString(value) {
  return String(value || '').trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonlTail(file, limit = 20) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function capabilityRoot(options = {}) {
  return options.root || path.join(__dirname, '..', '..');
}

function buildCapabilities(options = {}) {
  const root = capabilityRoot(options);
  return {
    signal_schema: fs.existsSync(path.join(root, 'lib', 'radar', 'subconscious-signal.js')),
    signal_board: fs.existsSync(path.join(root, 'lib', 'radar', 'subconscious-signal-board.js')),
    main_approval_boundary: fs.existsSync(path.join(root, 'lib', 'radar', 'subconscious-job-boundary.js')),
    qa_packet: fs.existsSync(path.join(root, 'lib', 'radar', 'qa-packet.js')),
    runtime_monitor: fs.existsSync(path.join(root, 'lib', 'radar', 'runtime-monitor.js')),
    auto_think_dry_run: fs.existsSync(path.join(root, 'lib', 'radar', 'subconscious-auto-think.js')),
    auto_build_simulation: fs.existsSync(path.join(root, 'lib', 'radar', 'auto-build-simulation.js')),
  };
}

function buildCapabilitiesSummary(capabilities) {
  const ready = Object.entries(capabilities).filter(([, ok]) => ok).map(([key]) => key);
  return ready.length
    ? `Implemented review layers: ${ready.join(', ')}.`
    : 'No review-layer modules detected yet.';
}

function latestQaPacket(qaPackets = []) {
  return qaPackets.reduce((latest, packet) => {
    const currentStamp = asString(packet?.timestamp || packet?.deterministic_equivalent);
    if (!currentStamp) return latest;
    if (!latest) return packet;
    const latestStamp = asString(latest?.timestamp || latest?.deterministic_equivalent);
    return currentStamp > latestStamp ? packet : latest;
  }, null);
}

function qaPacketCandidateIdentity(packet = {}, fallback = '') {
  const scope = asString(packet.job_id || packet.jobId || packet.plan_id || packet.planId) || 'unknown_scope';
  const stamp = asString(
    packet.timestamp || packet.ts || packet.created_at || packet.createdAt || packet.deterministic_equivalent || packet.deterministicEquivalent,
  ) || fallback;
  return `${scope}::${stamp}`;
}

function extractQaPacketsFromReports(reports = []) {
  const seen = new Set();
  const packets = [];
  for (const report of toArray(reports)) {
    const data = report?.data || {};
    const candidates = [
      data.qa_packet,
      data.qaPacket,
      ...toArray(data.qa_packets),
      ...toArray(data.qaPackets),
    ].filter(item => item && typeof item === 'object' && !Array.isArray(item));
    for (const [index, candidate] of candidates.entries()) {
      const identity = qaPacketCandidateIdentity(candidate, `${asString(report?.ts) || 'report'}:${index}`);
      if (seen.has(identity)) continue;
      seen.add(identity);
      packets.push({
        ...candidate,
        source_reported_at: asString(report?.ts) || null,
        source_agent: asString(report?.agent) || null,
      });
    }
  }
  return packets;
}

function buildSubconsciousSection(signals = [], evidence = null) {
  if (!signals.length) {
    const evidenceNote = evidence?.count
      ? ` Radar evidence is available for ${evidence.count} review-lane item(s).`
      : '';
    return {
      available: true,
      persisted_state_available: Boolean(evidence?.count),
      summary_line: `Dry-run signal and board layers exist, but no live signal feed is wired into the dashboard yet.${evidenceNote}`,
      board_counts: null,
      latest_candidate_at: null,
      missing_inputs: ['signals[]'],
    };
  }

  const board = buildSubconsciousSignalBoard(signals, { now: new Date() });
  const latestCandidate = [...signals]
    .map(signal => asString(signal?.created_at || signal?.createdAt))
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const readyCount = board.counts?.by_state?.ready_for_main_review || 0;
  return {
    available: true,
    persisted_state_available: Boolean(evidence?.count),
    summary_line: `${board.counts?.total || 0} signal candidate(s); ${readyCount} ready for Main review; review-only lane remains active.`,
    board_counts: board.counts || null,
    latest_candidate_at: latestCandidate,
    missing_inputs: [],
  };
}

function buildQaSection(qaPackets = [], options = {}) {
  if (!qaPackets.length) {
    return {
      available: true,
      persisted_state_available: false,
      summary_line: 'QA packet validation exists, but no live QA packet feed is wired into the dashboard yet.',
      latest_packet_at: null,
      latest_result: null,
      counts: null,
      missing_inputs: ['qa_packets[]'],
    };
  }

  const validationResults = qaPackets.map(packet => validateQaPacket(packet));
  const feed = qaPackets.map((packet, index) => {
    const validation = validationResults[index];
    const normalized = validation.ok
      ? { ...(packet || {}), ...(validation.packet || {}) }
      : (packet || {});
    return {
      valid: validation.ok,
      errors: validation.errors || [],
      job_id: asString(normalized.job_id || normalized.jobId) || null,
      plan_id: asString(normalized.plan_id || normalized.planId) || null,
      phase_id: asString(normalized.phase_id || normalized.phaseId) || null,
      result: asString(normalized.result).toLowerCase() || null,
      reviewer: asString(normalized.reviewer || normalized.source || normalized.reporter) || null,
      timestamp: asString(normalized.timestamp || normalized.ts || normalized.created_at || normalized.createdAt) || null,
      deterministic_equivalent: asString(normalized.deterministic_equivalent || normalized.deterministicEquivalent) || null,
      source_reported_at: asString(normalized.source_reported_at) || null,
      source_agent: asString(normalized.source_agent) || null,
      files_changed_count: toArray(normalized.files_changed || normalized.filesChanged).length,
      tests_run_count: toArray(normalized.tests_run || normalized.testsRun).length,
      tests_skipped_count: toArray(normalized.tests_skipped_with_reason || normalized.testsSkippedWithReason).length,
      test_output_summary: asString(normalized.test_output_summary || normalized.testOutputSummary) || null,
      behavior_proven: toArray(normalized.behavior_proven || normalized.behaviorProven),
      regression_risks: toArray(normalized.regression_risks || normalized.regressionRisks),
      rollback_path: asString(normalized.rollback_path || normalized.rollbackPath) || null,
      blocker: asString(normalized.blocker || normalized.blocked_reason || normalized.blockedReason) || null,
    };
  }).sort((a, b) => {
    const aStamp = a.timestamp || a.deterministic_equivalent || a.source_reported_at || '';
    const bStamp = b.timestamp || b.deterministic_equivalent || b.source_reported_at || '';
    return String(bStamp).localeCompare(String(aStamp));
  });
  const counts = {
    total: qaPackets.length,
    valid: validationResults.filter(result => result.ok).length,
    invalid: validationResults.filter(result => !result.ok).length,
    pass: qaPackets.filter(packet => asString(packet?.result).toLowerCase() === 'pass').length,
    fail: qaPackets.filter(packet => asString(packet?.result).toLowerCase() === 'fail').length,
    blocked: qaPackets.filter(packet => asString(packet?.result).toLowerCase() === 'blocked').length,
  };
  const latestPacket = latestQaPacket(validationResults.filter(result => result.ok).map(result => result.packet));
  const latestFeed = feed[0] || null;
  const sourceLabel = options.sourceLabel || 'persisted reports';
  const reportSummary = `${counts.valid}/${counts.total} QA packet(s) valid from ${sourceLabel}; success claims remain evidence-bound.${counts.invalid ? ` ${counts.invalid} invalid packet(s) need repair.` : ''}`;
  return {
    available: true,
    persisted_state_available: qaPackets.length > 0,
    summary_line: reportSummary,
    latest_packet_at: asString(latestPacket?.timestamp || latestPacket?.deterministic_equivalent || latestFeed?.source_reported_at) || null,
    latest_result: asString(latestPacket?.result).toLowerCase() || null,
    latest_packet: latestFeed,
    counts,
    feed,
    missing_inputs: [],
  };
}

function buildMonitorSection(context = {}) {
  const hasWorkflow = !!context.workflow;
  const hasWorktree = !!context.worktree;
  const hasJobs = Array.isArray(context.jobs);
  const hasSignals = Array.isArray(context.signals);
  const hasQaPackets = Array.isArray(context.qa_packets || context.qaPackets);
  const missingInputs = [
    !hasWorkflow ? 'workflow' : null,
    !hasWorktree ? 'worktree' : null,
    !hasJobs ? 'jobs[]' : null,
    !hasSignals ? 'signals[]' : null,
    !hasQaPackets ? 'qa_packets[]' : null,
  ].filter(Boolean);

  if (missingInputs.length) {
    return {
      available: true,
      persisted_state_available: false,
      summary_line: 'Runtime monitor is report-only and waiting for explicit workflow/worktree/job inputs.',
      status: null,
      reason_count: 0,
      reasons: [],
      recommended_next_action: 'Provide workflow, worktree, jobs, signals, and QA packets to evaluate a live review lane.',
      missing_inputs: missingInputs,
    };
  }

  const report = buildRuntimeMonitorReport(context);
  return {
    available: true,
    persisted_state_available: false,
    summary_line: `Runtime monitor is ${report.status}; ${report.reasons.length} reason(s) currently attached to the review-only lane.`,
    status: report.status,
    reason_count: report.reasons.length,
    reasons: report.reasons,
    recommended_next_action: report.recommended_next_action,
    missing_inputs: [],
  };
}

function isReviewLaneEvidence(item = {}) {
  if (item.review_only === true) return true;
  const status = asString(item.status).toLowerCase();
  return status === 'review_only';
}

function evidenceTitle(item = {}) {
  return asString(item.title) || asString(item.raw_text_preview) || asString(item.source_label) || 'Untitled evidence';
}

function buildEvidenceSection(radarItems = []) {
  if (!radarItems.length) {
    return {
      available: true,
      persisted_state_available: false,
      summary_line: 'No read-only Radar evidence is wired into the review lane yet.',
      count: 0,
      items: [],
      missing_inputs: ['radar_items[]'],
    };
  }

  const items = radarItems
    .filter(isReviewLaneEvidence)
    .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
    .slice(0, 6)
    .map(item => ({
      id: asString(item.id),
      ts: asString(item.ts) || null,
      title: evidenceTitle(item),
      source_label: asString(item.source_label) || null,
      source_type: asString(item.source_type) || null,
      review_state: asString(item.latest_review?.review_state || item.review_state || 'new') || 'new',
      recall_reason: asString(item.recall_reason) || null,
      status: asString(item.status) || null,
      review_only: item.review_only === true,
      next_action: asString(item.latest_review?.next_action) || null,
      detail_route: asString(item.id) ? `/agent/brain/radar/item/${encodeURIComponent(asString(item.id))}` : null,
      ui_detail_route: asString(item.id) ? `/radar?detail=${encodeURIComponent(asString(item.id))}` : null,
    }));

  return {
    available: true,
    persisted_state_available: items.length > 0,
    summary_line: items.length
      ? `${items.length} read-only Radar evidence item(s) currently support the review lane.`
      : 'Radar feed is available, but it has no review-only evidence items yet.',
    count: items.length,
    items,
    missing_inputs: items.length ? [] : ['review_only_radar_items[]'],
  };
}

function providerLane(providerId) {
  return providerId === 'ollama' ? 'local/private' : 'remote/API';
}

function buildAiReadinessSection(input = {}) {
  const env = input.env || process.env;
  const status = input.routing_status || llmRoutingStatus(env);
  const defaultOrder = ['gemini', 'groq', 'deepseek', 'ollama'];
  const providerOrder = asString(env.FALLBACK_PROVIDER_ORDER)
    ? asString(env.FALLBACK_PROVIDER_ORDER).split(',').map(item => item.trim()).filter(Boolean)
    : toArray(status.fallback_readiness?.provider_order).length
      ? toArray(status.fallback_readiness?.provider_order)
      : defaultOrder;
  const configuredMap = {
    gemini: Boolean(asString(env.GEMINI_API_KEY)),
    groq: Boolean(asString(env.GROQ_API_KEY)),
    deepseek: Boolean(asString(env.DEEPSEEK_API_KEY)),
    ollama: Boolean(asString(env.OLLAMA_HOST) && asString(env.OLLAMA_MODEL)),
  };
  const configuredProviders = providerOrder.filter(id => configuredMap[id] === true);
  const missingProviders = providerOrder.filter(id => configuredMap[id] === false);
  const providers = providerOrder.map(id => ({
    id,
    lane: providerLane(id),
    configured: configuredMap[id] === true,
    status: configuredMap[id] === true ? 'configured' : 'missing',
  }));
  return {
    available: true,
    free_ai_first: status.free_ai_first,
    anthropic_mode: status.anthropic_mode,
    configured_providers: configuredProviders,
    missing_providers: missingProviders,
    blocked_features: toArray(status.fallback_readiness?.blocked_features),
    providers,
    summary_line: configuredProviders.length
      ? `${configuredProviders.length} configured provider(s): ${configuredProviders.join(', ')}.${missingProviders.length ? ` Missing: ${missingProviders.join(', ')}.` : ''}`
      : 'No fallback AI provider is configured yet; add at least one hosted key or a local Ollama lane.',
  };
}

function buildReviewLaneStatusReport(input = {}, options = {}) {
  const now = options.now || input.now || new Date();
  const capabilities = buildCapabilities(options);
  const signals = toArray(input.signals);
  const reports = toArray(input.reports);
  const explicitQaPackets = toArray(input.qa_packets || input.qaPackets);
  const qaPackets = explicitQaPackets.length ? explicitQaPackets : extractQaPacketsFromReports(reports);
  const radarItems = toArray(input.radar_items || input.radarItems);
  const monitorContext = {
    workflow: input.workflow,
    worktree: input.worktree,
    jobs: input.jobs,
    qa_packets: qaPackets,
    signals,
    loop_metrics: input.loop_metrics || input.loopMetrics,
  };

  const evidence = buildEvidenceSection(radarItems);
  const subconscious = buildSubconsciousSection(signals, evidence);
  const qa = buildQaSection(qaPackets, {
    sourceLabel: explicitQaPackets.length ? 'supplied input' : 'persisted reports',
  });
  const monitor = buildMonitorSection(monitorContext);
  const aiReadiness = buildAiReadinessSection({ env: input.env, routing_status: input.routing_status || input.routingStatus });
  const persistedStateAvailable = evidence.persisted_state_available || qa.persisted_state_available;

  return {
    ok: true,
    label: 'Luke review lane status',
    generated_at: now instanceof Date ? now.toISOString() : String(now),
    status: 'review_only',
    read_only: true,
    persisted_state_available: persistedStateAvailable,
    summary_line: [
      'Subconscious and QA remain review-only.',
      buildCapabilitiesSummary(capabilities),
      persistedStateAvailable
        ? 'Persisted review artifacts are available for read-only inspection.'
        : 'Live persisted review artifacts are not wired yet; dashboard data stays capability- and evidence-driven.',
    ].join(' '),
    policy: {
      review_only: true,
      runtime_state_writes: false,
      schedulers: false,
      dispatch: false,
      creates_coder_jobs: false,
      creates_main_approvals: false,
      automatic_repair: false,
    },
    capabilities,
    subconscious,
    qa,
    monitor,
    evidence,
    ai_readiness: aiReadiness,
    routes: {
      summary: '/agent/brain/status',
      detail: '/agent/brain/review-lane',
      evidence_detail_template: '/agent/brain/radar/item/:id',
      operator_check: '/luke/operator-check',
    },
  };
}

module.exports = {
  buildReviewLaneStatusReport,
  _internal: {
    buildAiReadinessSection,
    buildCapabilities,
    buildEvidenceSection,
    buildMonitorSection,
    buildQaSection,
    buildSubconsciousSection,
    extractQaPacketsFromReports,
    isReviewLaneEvidence,
    readJsonlTail,
  },
};
