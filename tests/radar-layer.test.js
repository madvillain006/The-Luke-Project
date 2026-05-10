'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildRadarBrief,
  buildRadarItemDetail,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
  recordRadarReview,
} = require('../lib/brain/radar-layer');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-radar-'));
  return {
    root,
    paths: {
      events: {
        radarIngest: path.join(root, 'events', 'radar-ingest.jsonl'),
        radarReviews: path.join(root, 'events', 'radar-reviews.jsonl'),
      },
      snapshots: {
        radarState: path.join(root, 'snapshots', 'radar-state.json'),
      },
    },
  };
}

describe('radar layer', () => {
  it('captures Radar items, dedupes them, and builds review-only briefs', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-07T10:00:00.000Z');
    const input = {
      source_label: 'sybil',
      source_url: 'https://x.com/example/status/1',
      text: '$NVDA data center capex note contradicts the old semi thesis. Remind me to verify before market open because the risk changed.',
    };

    const first = recordRadarIngest(input, { paths, now });
    const duplicate = recordRadarIngest(input, { paths, now });
    const snapshot = buildRadarSnapshot(paths, now);
    const brief = buildRadarBrief({ paths, now });
    const items = buildRadarItems({ paths, limit: 5 });

    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.item.symbols).toContain('NVDA');
    expect(first.item.themes).toEqual(expect.arrayContaining(['ai_capex', 'reminder', 'contradiction']));
    expect(first.item.review_priority).toBe('review');
    expect(first.item.scope).toBe('general');
    expect(first.item.status).toBe('captured');
    expect(first.item.recall_reason).toBe('contradiction_or_risk_signal');
    expect(first.item.trading_authority).toBe('none');
    expect(duplicate.ok).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(snapshot.counts).toMatchObject({ total: 1, fresh_24h: 1, review: 1 });
    expect(snapshot.summary_line).toBe('1 fresh / 1 review');
    expect(snapshot.recent[0].raw_text).toBeUndefined();
    expect(snapshot.payload_policy.raw_text_in_snapshot).toBe(false);
    expect(snapshot.source_health[0]).toEqual(expect.objectContaining({
      source_label: 'sybil',
      source_type: 'sybil_paste',
      items: 1,
    }));
    expect(brief.ideas_to_verify).toHaveLength(1);
    expect(brief.safety.trading_authority).toBe('none');
    expect(items.items).toHaveLength(1);
  });

  it('supports explicit source types and review states without mutating captured evidence', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-07T11:00:00.000Z');
    const captured = recordRadarIngest({
      source_label: 'pine',
      source_type: 'pine_trading_note',
      text: 'ES level 5900 support, Saty and Mancini overlap. Verify before action.',
      relationship_ids: ['mancini:5900', 'saty:5900'],
    }, { paths, now });

    expect(captured.item.source_type).toBe('pine_trading_note');
    expect(captured.item.relationship_ids).toEqual(['mancini:5900', 'saty:5900']);
    expect(buildRadarSnapshot(paths, now).counts.review).toBe(1);

    const accepted = recordRadarReview({
      item_id: captured.item.id,
      review_state: 'accepted',
      note: 'Useful context after manual check.',
      next_action: 'Feed Daily only; no trade trigger.',
    }, { paths, now: new Date('2026-05-07T11:05:00.000Z') });
    const snapshot = buildRadarSnapshot(paths, new Date('2026-05-07T11:06:00.000Z'));
    const detail = buildRadarItemDetail({ id: captured.item.id }, { paths });

    expect(accepted.ok).toBe(true);
    expect(accepted.item.review_state).toBe('accepted');
    expect(snapshot.counts.review).toBe(0);
    expect(snapshot.review_state_counts.accepted).toBe(1);
    expect(snapshot.source_health[0]).toEqual(expect.objectContaining({
      decision_count: 1,
      quality_score: null,
      quality_status: 'warming_up',
      freshness_status: 'fresh',
      decisions: expect.objectContaining({ accepted: 1 }),
    }));
    expect(snapshot.recent[0]).toEqual(expect.objectContaining({
      id: captured.item.id,
      review_state: 'accepted',
      review_only: true,
      trading_authority: 'none',
      raw_text_preview: expect.stringContaining('ES level 5900'),
    }));
    expect(snapshot.recent[0].raw_text).toBeUndefined();
    expect(detail.item.raw_text).toContain('ES level 5900');
    expect(detail.item.review_history).toHaveLength(1);
    expect(detail.payload_policy.raw_text_loaded_on_demand).toBe(true);
  });

  it('prioritizes contradictions ahead of newer normal review items in the brief', () => {
    const { paths } = tempPaths();
    recordRadarIngest({
      source_label: 'pine',
      source_type: 'pine_trading_note',
      text: 'ES 5900 support level from Pine and Saty. Put on watchlist.',
    }, { paths, now: new Date('2026-05-07T12:00:00.000Z') });
    recordRadarIngest({
      source_label: 'sybil',
      source_type: 'sybil_paste',
      text: '$NVDA bear case contradicts the active AI capex thesis.',
    }, { paths, now: new Date('2026-05-07T11:30:00.000Z') });

    const brief = buildRadarBrief({ paths, now: new Date('2026-05-07T12:05:00.000Z') });

    expect(brief.ideas_to_verify[0].themes).toContain('contradiction');
    expect(brief.ideas_to_verify[0].source_label).toBe('sybil');
    expect(brief.source_type_counts.pine_trading_note).toBe(1);
    expect(brief.source_type_counts.sybil_paste).toBe(1);
  });

  it('marks old sources stale in source health', () => {
    const { paths } = tempPaths();
    recordRadarIngest({
      source_label: 'old-feed',
      text: 'Old article to keep around.',
    }, { paths, now: new Date('2026-05-01T10:00:00.000Z') });

    const snapshot = buildRadarSnapshot(paths, new Date('2026-05-07T10:00:00.000Z'));

    expect(snapshot.source_health[0]).toEqual(expect.objectContaining({
      source_label: 'old-feed',
      freshness_status: 'stale',
    }));
  });
});

describe('reference_idea source lane', () => {
  it('reference_idea items always get review_priority review', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T10:00:00.000Z');
    const result = recordRadarIngest({
      source_label: 'mempalace-ref',
      source_type: 'reference_idea',
      text: 'MemPalace uses hybrid keyword plus temporal boosting for context retrieval.',
      reference_repo: 'mempalace',
      scope: 'memory-retrieval',
      status: 'candidate',
      recall_reason: 'Hermes-style context retrieval pattern',
    }, { paths, now });

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.item.source_type).toBe('reference_idea');
    expect(result.item.review_priority).toBe('review');
    expect(result.item.scope).toBe('memory-retrieval');
    expect(result.item.status).toBe('candidate');
    expect(result.item.recall_reason).toBe('Hermes-style context retrieval pattern');
    expect(result.item.review_only).toBe(true);
    expect(result.item.trading_authority).toBe('none');
  });

  it('reference_idea items appear in snapshot source_type_counts', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T10:00:00.000Z');
    recordRadarIngest({
      source_label: 'hermes-ref',
      source_type: 'reference_idea',
      text: 'Hermes agent uses skill persistence and session recall across conversations.',
    }, { paths, now });

    const snapshot = buildRadarSnapshot(paths, now);
    expect(snapshot.source_type_counts.reference_idea).toBe(1);
    expect(snapshot.review_queue[0]).toEqual(expect.objectContaining({
      review_only: true,
      trading_authority: 'none',
      recall_reason: 'reference_idea_review_lane',
    }));
  });

  it('existing source types are unaffected by the new reference_idea type', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T10:00:00.000Z');
    recordRadarIngest({
      source_label: 'sybil',
      source_type: 'sybil_paste',
      text: '$NVDA data center capex note.',
    }, { paths, now });

    const result = recordRadarIngest({
      source_label: 'pine',
      source_type: 'pine_trading_note',
      text: 'ES 5900 support level watch.',
    }, { paths, now });

    const snapshot = buildRadarSnapshot(paths, now);
    expect(snapshot.source_type_counts.sybil_paste).toBe(1);
    expect(snapshot.source_type_counts.pine_trading_note).toBe(1);
    expect(result.item.review_priority).toBe('review');
  });
});
