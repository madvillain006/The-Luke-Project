'use strict';

const { buildReviewLaneStatusReport } = require('../lib/radar/review-lane-status');

function signal(overrides = {}) {
  return {
    slug: 'qa-monitor-signal',
    title: 'QA monitor signal',
    raw_text: 'Review-only signal for Luke QA panel.',
    source: {
      agent: 'subconscious',
      mode: 'dry-run-auto-think',
      source_label: 'luke-subconscious',
    },
    signal_types: ['return', 'evidence'],
    score: 8,
    positive_walk_count: 4,
    cooldown_state: 'clear',
    lock_state: 'none',
    status: 'watching',
    non_goals: ['no Coder dispatch'],
    forbidden_surfaces: ['trading', 'pine', 'ninjatrader', 'runtime-state'],
    review_only: true,
    created_at: '2026-05-14T17:00:00.000Z',
    ...overrides,
  };
}

function qaPacket(overrides = {}) {
  return {
    job_id: 'subconscious_job_qa-monitor-signal',
    phase_id: 'phase-qa',
    files_changed: ['lib/radar/review-lane-status.js', 'brain-dashboard.html'],
    tests_run: ['npx vitest run tests/review-lane-status.test.js tests/brain-dashboard.test.js'],
    test_output_summary: 'Focused dashboard review-lane tests passed.',
    tests_skipped_with_reason: [],
    behavior_proven: ['Dashboard exposes review-only status without dispatch or runtime writes.'],
    regression_risks: ['Live persisted review-lane evidence is not wired yet.'],
    rollback_path: 'Revert review-lane status module and dashboard panel changes.',
    safety_boundary_confirmation: {
      pine_untouched_unless_approved: true,
      ninjatrader_untouched_unless_approved: true,
      market_hours_untouched_unless_approved: true,
      live_trading_paths_untouched: true,
      risk_checks_not_weakened: true,
      credentials_secrets_untouched: true,
      broker_account_routing_untouched: true,
      order_execution_unchanged: true,
      runtime_state_not_overwritten: true,
      no_unsafe_dependency_added: true,
    },
    result: 'pass',
    reviewer: 'qa',
    timestamp: '2026-05-14T17:10:00.000Z',
    ...overrides,
  };
}

function radarItem(overrides = {}) {
  return {
    id: 'radar_item_qa-monitor-signal',
    ts: '2026-05-14T17:08:00.000Z',
    title: 'Luke QA monitor evidence',
    raw_text_preview: 'Read-only review lane evidence from Radar.',
    source_label: 'luke-radar',
    source_type: 'reference_idea',
    status: 'review_only',
    review_only: true,
    recall_reason: 'reference_idea_review_lane',
    review_state: 'accepted',
    latest_review: {
      ts: '2026-05-14T17:09:00.000Z',
      review_state: 'accepted',
      next_action: 'Hold for Main review',
    },
    ...overrides,
  };
}

describe('review lane status report', () => {
  it('reports capability, evidence, and safe AI readiness details for the dashboard', () => {
    const report = buildReviewLaneStatusReport({
      now: new Date('2026-05-14T17:12:00.000Z'),
      signals: [signal()],
      qa_packets: [qaPacket()],
      radar_items: [
        radarItem(),
        radarItem({ id: 'radar_item_hidden', review_only: false, status: 'captured', recall_reason: 'general_capture' }),
        radarItem({ id: 'radar_item_sneaky', review_only: false, status: 'captured', recall_reason: 'reference_idea_review_lane' }),
      ],
      env: {
        GEMINI_API_KEY: 'gemini-test',
        OLLAMA_HOST: 'http://ollama.test',
        OLLAMA_MODEL: 'llama3-test',
      },
      workflow: {
        owned_paths: ['lib/', 'tests/', 'docs/', 'brain-dashboard.html'],
        forbidden_paths: ['trading/', 'state/events/', 'state/snapshots/'],
      },
      worktree: {
        dirty_files: ['brain-dashboard.html', 'lib/radar/review-lane-status.js'],
      },
      jobs: [],
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe('review_only');
    expect(report.policy.review_only).toBe(true);
    expect(report.policy.runtime_state_writes).toBe(false);
    expect(report.capabilities.qa_packet).toBe(true);
    expect(report.subconscious.board_counts.total).toBe(1);
    expect(report.evidence.count).toBe(1);
    expect(report.evidence.items[0].id).toBe('radar_item_qa-monitor-signal');
    expect(report.evidence.items[0].detail_route).toBe('/agent/brain/radar/item/radar_item_qa-monitor-signal');
    expect(report.qa.latest_result).toBe('pass');
    expect(report.ai_readiness.configured_providers).toContain('gemini');
    expect(report.ai_readiness.summary_line).toContain('configured provider');
    expect(report.monitor.summary_line).toContain('healthy');
  });

  it('marks missing persisted evidence explicitly when no live inputs are wired', () => {
    const report = buildReviewLaneStatusReport({
      now: new Date('2026-05-14T17:12:00.000Z'),
    });

    expect(report.read_only).toBe(true);
    expect(report.persisted_state_available).toBe(false);
    expect(report.subconscious.persisted_state_available).toBe(false);
    expect(report.subconscious.missing_inputs).toContain('signals[]');
    expect(report.qa.missing_inputs).toContain('qa_packets[]');
    expect(report.monitor.missing_inputs).toContain('workflow');
    expect(report.evidence.missing_inputs).toContain('radar_items[]');
    expect(report.ai_readiness.configured_providers).toEqual([]);
  });
});
