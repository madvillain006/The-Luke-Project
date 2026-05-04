'use strict';

const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '../scripts/compare-operator-surfaces.js');
const {
  OLD_COMMANDS,
  NEW_ENDPOINTS,
  AUTONOMOUS_ENDPOINTS,
  parseStatusReply,
  parseEntriesReply,
  parseVerdictReply,
  normalizeDecisionApi,
  normalizeOperatorStatus,
  compareField,
  buildComparison,
  renderReport,
} = require('../scripts/compare-operator-surfaces');

describe('operator surface comparison script', () => {
  it('parses old shell status, entries, and verdict facts', () => {
    const status = parseStatusReply([
      'LUKE ONLINE',
      'Freshness: Dubz OK (3) | Bobby OK (26) | Saty OK',
      'Autonomous: recommendation-only; no autonomous staging or execution',
    ].join('\n'));

    expect(status.freshness.dubz).toEqual({ loaded: true, count: 3 });
    expect(status.freshness.bobby).toEqual({ loaded: true, count: 26 });
    expect(status.freshness.saty).toEqual({ loaded: true, count: null });
    expect(status.recommendation_only).toBe(true);
    expect(status.staged_only).toBe(true);

    const entries = parseEntriesReply([
      '## Futures Entries ES',
      'Freshness: Saty OK | Dubz OK (3) | Bobby OK (26) | ET 2026-05-02',
      'Recommendation: SKIP CHASE - above 7157 | LONG ES 7155 | C grade | quarter size',
      'Anchor: ES 7155 | C grade | quarter size | side LONG',
      'Vetoes: none active',
      'Plan: entry 7156 | ok 7157 | stop 7153 | target 7178 | RR 7.3',
    ].join('\n'));

    expect(entries).toEqual(expect.objectContaining({
      action: 'PASS',
      anchor: 7155,
      side: 'LONG',
      entry: 7156,
      acceptable_entry: 7157,
      stop: 7153,
      target: 7178,
      sizing: 'quarter',
      vetoes: ['none active'],
    }));

    const verdict = parseVerdictReply([
      'Context warning: missing /saty. This is confluence-only; use /entries for PASS/trade truth.',
      '## Confluence Verdict',
      '- **ES 7155**  ->  **C** (0.45)  bobby vision',
      '- **ES 7180**  ->  **C** (0.42)  dubz key',
    ].join('\n'));

    expect(verdict.row_count).toBe(2);
    expect(verdict.top_rows[0]).toContain('ES 7155');
  });

  it('normalizes new operator API facts without implying action on PASS', () => {
    const decision = normalizeDecisionApi({
      actionable: false,
      decision: {
        action: 'PASS',
        reason: 'No fresh decision available',
        entry: null,
        acceptable_entry: null,
        stop: null,
        target: null,
        sizing: 'pass',
        freshness: {
          saty: { loaded: false },
          dubz: { loaded: false, count: 0 },
          bobby: { loaded: false, count: 0 },
        },
        vetoes: [{ type: 'stale_or_missing_input' }],
      },
    });

    expect(decision.action).toBe('PASS');
    expect(decision.entry).toBeNull();
    expect(decision.sizing).toBe('pass');
    expect(decision.vetoes).toEqual(['stale_or_missing_input']);

    const status = normalizeOperatorStatus({
      blockers: ['fresh Saty context missing'],
      autonomous: { recommendation_only: true, staged_only: true },
      freshness: {
        saty: { loaded: false },
        dubz: { loaded: true, count: 1 },
        bobby: { loaded: true, count: 3 },
      },
    });
    expect(status.recommendation_only).toBe(true);
    expect(status.staged_only).toBe(true);
    expect(status.risk_blockers).toEqual(['fresh Saty context missing']);
  });

  it('marks field comparison statuses', () => {
    expect(compareField('PASS', 'PASS')).toBe('MATCH');
    expect(compareField('PASS', 'LONG')).toBe('MISMATCH');
    expect(compareField(null, 'LONG')).toBe('MISSING_OLD');
    expect(compareField('PASS', null)).toBe('MISSING_NEW');
    expect(compareField(null, null)).toBe('NOT_APPLICABLE');
  });

  it('builds comparison rows and renders a markdown report', () => {
    const collected = {
      baseUrl: 'http://127.0.0.1:3000',
      collected_at: '2026-05-02T19:00:00.000Z',
      errors: [],
      limitations: ['test limitation'],
      old: {
        status: { response: { ok: true, status: 200, body: { reply: 'Freshness: Dubz OK (1) | Bobby OK (1) | Saty OK\nAutonomous: recommendation-only' } } },
        entries: { response: { ok: true, status: 200, body: { reply: 'Recommendation: LONG ES 6809 | A grade | full size\nAnchor: ES 6809 | A grade | full size | side LONG\nVetoes: none active\nPlan: entry 6810 | ok 6811 | stop 6807 | target 6860' } } },
        verdict: { response: { ok: true, status: 200, body: { reply: '- **ES 6809**  ->  **A** (0.90)  dubz, bobby' } } },
      },
      autonomous: {
        preflight: { response: { ok: true, status: 200, body: { recommendation_only: true, staged_only: true, blockers: [], decision: { action: 'LONG', confluence: { anchor: 6809 }, entry: 6810, acceptable_entry: 6811, stop: 6807, target: 6860, sizing: 'full', vetoes: [] } } } },
      },
      new: {
        operatorStatus: { response: { ok: true, status: 200, body: { autonomous: { recommendation_only: true, staged_only: true }, freshness: { saty: { loaded: true }, dubz: { loaded: true, count: 1 }, bobby: { loaded: true, count: 1 } }, blockers: [] } } },
        operatorReadiness: { response: { ok: true, status: 200, body: { recommendation_only: true, staged_only: true, blockers: [], decision: { action: 'LONG', confluence: { anchor: 6809 }, entry: 6810, acceptable_entry: 6811, stop: 6807, target: 6860, sizing: 'full', vetoes: [] } } } },
        decision: { response: { ok: true, status: 200, body: { decision: { action: 'LONG', confluence: { anchor: 6809 }, entry: 6810, acceptable_entry: 6811, stop: 6807, target: 6860, sizing: 'full', vetoes: [], freshness: { saty: { loaded: true }, dubz: { loaded: true, count: 1 }, bobby: { loaded: true, count: 1 } } } } } },
        confluence: { response: { ok: true, status: 200, body: { rows: [{ markdown: '- **ES 6809**  ->  **A** (0.90)  dubz, bobby' }] } } },
      },
    };

    const comparison = buildComparison(collected);
    expect(comparison.rows.find(row => row.field === 'action').status).toBe('MATCH');
    const report = renderReport(collected, comparison);
    expect(report).toContain('# Operator Surface Comparison - Latest');
    expect(report).toContain('| action | MATCH | LONG | LONG |');
    expect(report).toContain('This script does not call execution endpoints.');
  });

  it('is limited to read-only comparison endpoints and commands', () => {
    expect(OLD_COMMANDS).toEqual({
      status: '/status',
      entries: '/entries ES',
      verdict: '/verdict ES',
    });
    expect(NEW_ENDPOINTS).toEqual(expect.objectContaining({
      operatorStatus: '/api/operator/status',
      operatorReadiness: '/api/operator/readiness',
      decision: '/api/decision?instrument=ES&mode=manual',
      confluence: '/api/confluence?instrument=ES',
    }));
    expect(AUTONOMOUS_ENDPOINTS).toEqual({ preflight: '/agent/autonomous/preflight' });

    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).not.toContain('/agent/autonomous/execute');
    expect(source).not.toContain('/agent/autonomous/confirm');
    expect(source).not.toContain('/agent/autonomous/start');
    expect(source).not.toContain('/agent/autonomous/stop');
    expect(source).not.toContain('/agent/autonomous/set-mode');
    expect(source).not.toContain('/heatmap ');
    expect(source).not.toContain('/dubz ');
    expect(source).not.toContain('/saty ');
    expect(source).not.toContain('/mancini ');
  });
});
