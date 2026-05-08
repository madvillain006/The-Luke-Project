#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildDailyBrief } = require('../lib/brain/daily-brief');
const { buildDailySpine } = require('../lib/brain/daily-spine');
const {
  buildRadarBrief,
  buildRadarItemDetail,
  buildRadarSnapshot,
  recordRadarIngest,
  recordRadarReview,
} = require('../lib/brain/radar-layer');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'radar-daily-loop');
const OUT_FILE = path.join(OUT_DIR, 'radar-daily-loop-proof.json');

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-radar-daily-'));
  const eventsDir = path.join(root, 'events');
  const snapshotsDir = path.join(root, 'snapshots');
  return {
    root,
    events: {
      dailyCheckins: path.join(eventsDir, 'daily-checkins.jsonl'),
      radarIngest: path.join(eventsDir, 'radar-ingest.jsonl'),
      radarReviews: path.join(eventsDir, 'radar-reviews.jsonl'),
    },
    snapshots: {
      dailyCalendarWeek: path.join(snapshotsDir, 'daily-calendar-week.json'),
      dailyGmailAttention: path.join(snapshotsDir, 'daily-gmail-attention.json'),
      dailySpine: path.join(snapshotsDir, 'daily-spine.json'),
      radarState: path.join(snapshotsDir, 'radar-state.json'),
    },
  };
}

function assertCheck(condition, label, detail = null) {
  return { label, ok: Boolean(condition), detail };
}

function main() {
  const paths = makePaths();
  const now = new Date('2026-05-07T14:00:00.000Z');

  const contradiction = recordRadarIngest({
    source_label: 'sybil',
    source_type: 'sybil_paste',
    text: '$NVDA bear case contradicts the active AI capex thesis. Verify before market open.',
  }, { paths, now });

  const reminder = recordRadarIngest({
    source_label: 'manual',
    source_type: 'reminder',
    text: 'Remind me to review the Knoxville lease notes tomorrow.',
  }, { paths, now: new Date('2026-05-07T14:01:00.000Z') });

  const pine = recordRadarIngest({
    source_label: 'pine',
    source_type: 'pine_trading_note',
    text: 'ES 5900 support from Saty and Mancini overlap. Watchlist only.',
    relationship_ids: ['saty:5900', 'mancini:5900'],
  }, { paths, now: new Date('2026-05-07T14:02:00.000Z') });

  recordRadarReview({
    item_id: pine.item.id,
    review_state: 'accepted',
    note: 'Useful context, not a trade trigger.',
    next_action: 'Feed Daily and Trading review only.',
  }, { paths, now: new Date('2026-05-07T14:03:00.000Z') });

  recordRadarReview({
    item_id: contradiction.item.id,
    review_state: 'contradicted',
    note: 'Contradiction must stay high priority.',
    next_action: 'Review before any NVDA thesis work.',
  }, { paths, now: new Date('2026-05-07T14:04:00.000Z') });

  const snapshot = buildRadarSnapshot(paths, new Date('2026-05-07T14:05:00.000Z'));
  const detail = buildRadarItemDetail({ id: contradiction.item.id }, { paths });
  const radarBrief = buildRadarBrief({ paths, now: new Date('2026-05-07T14:06:00.000Z') });
  const daily = buildDailySpine({ paths, now: new Date('2026-05-07T14:07:00.000Z') });
  const dailyBrief = buildDailyBrief({
    kind: 'morning',
    radarBrief,
    news: { status: 'unavailable', by_category: {}, sources: [] },
    now: new Date('2026-05-07T14:08:00.000Z'),
  });

  const checks = [
    assertCheck(snapshot.counts.total === 3, 'radar captured three items', snapshot.counts),
    assertCheck(snapshot.payload_policy.raw_text_in_snapshot === false, 'snapshot omits raw text'),
    assertCheck(!Object.prototype.hasOwnProperty.call(snapshot.recent[0] || {}, 'raw_text'), 'recent snapshot item has no raw_text'),
    assertCheck(Boolean(detail.item.raw_text), 'raw evidence loads on demand', detail.payload_policy),
    assertCheck(detail.item.review_history.length === 1, 'detail includes review history', detail.item.review_history),
    assertCheck(radarBrief.ideas_to_verify[0]?.themes?.includes('contradiction'), 'Radar brief prioritizes contradiction', radarBrief.ideas_to_verify[0]),
    assertCheck(daily.pipeline.radar_review_items >= 2, 'Daily sees Radar review items', daily.pipeline),
    assertCheck(daily.pipeline.radar_reminders === 1, 'Daily sees Radar reminders', daily.pipeline),
    assertCheck(dailyBrief.sections[0]?.id === 'radar-review', 'Daily brief starts with Radar review', dailyBrief.sections[0]),
    assertCheck(snapshot.source_health.some(row => row.source_label === 'pine' && row.decisions.accepted === 1), 'source quality tracks accepted Pine context'),
  ];

  const proof = {
    ok: checks.every(check => check.ok),
    generated_at: new Date().toISOString(),
    checks,
    summary: {
      radar_counts: snapshot.counts,
      review_state_counts: snapshot.review_state_counts,
      first_radar_idea: radarBrief.ideas_to_verify[0]?.title || null,
      daily_radar: daily.radar,
      daily_brief_first_section: dailyBrief.sections[0],
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(proof, null, 2), 'utf8');
  console.log(`radar-daily-loop proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
  if (!proof.ok) process.exit(1);
}

main();
