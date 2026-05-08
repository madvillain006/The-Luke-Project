'use strict';

const defaultPaths = require('../paths');
const {
  buildRadarItemDetail,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
  recordRadarReview,
} = require('../radar/ingest');

function radarBriefScore(item) {
  let score = 0;
  if (item.review_state === 'contradicted') score += 60;
  if ((item.themes || []).includes('contradiction')) score += 45;
  if (item.review_priority === 'review') score += 25;
  if (item.review_priority === 'reminder') score += 15;
  if ((item.sybil_context?.context_records || 0) > 0) score += 10;
  if ((item.symbols || []).length) score += 5;
  const ageMs = Date.now() - new Date(item.ts || 0).getTime();
  const ageHours = Number.isFinite(ageMs) ? Math.max(0, ageMs / 3600000) : 999;
  return score - Math.min(12, ageHours / 2);
}

function sortRadarBriefItems(items = []) {
  return [...items].sort((a, b) => {
    const scoreDiff = radarBriefScore(b) - radarBriefScore(a);
    if (scoreDiff) return scoreDiff;
    return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
  });
}

function buildRadarBrief(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const snapshot = buildRadarSnapshot(paths, now);
  const reviewItems = sortRadarBriefItems(snapshot.review_queue || []);
  const ideas = reviewItems.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    title: item.title || item.raw_text_preview || item.source_label,
    source_label: item.source_label,
    source_type: item.source_type,
    review_state: item.review_state,
    symbols: item.symbols || [],
    themes: item.themes || [],
    confidence: item.review_state === 'contradicted' ? 0.8 : item.review_priority === 'review' ? 0.72 : 0.5,
    action: 'verify_before_action',
    evidence: [
      item.source_type,
      item.sybil_context?.context_records ? `${item.sybil_context.context_records} Sybil context records` : null,
      (item.themes || []).length ? `themes: ${item.themes.join(', ')}` : null,
    ].filter(Boolean),
  }));

  return {
    ok: true,
    label: 'Radar brief',
    generated_at: now.toISOString(),
    summary_line: snapshot.summary_line,
    ideas_to_verify: ideas,
    empty_note: ideas.length ? null : 'Radar is ready. Capture sources to build the morning intel queue.',
    review_queue: reviewItems,
    source_counts: snapshot.source_counts,
    source_type_counts: snapshot.source_type_counts,
    review_state_counts: snapshot.review_state_counts,
    theme_counts: snapshot.theme_counts,
    safety: {
      confidence_means: 'review_priority_not_trade_certainty',
      trading_authority: 'none',
    },
  };
}

module.exports = {
  buildRadarBrief,
  buildRadarItemDetail,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
  recordRadarReview,
  _internal: {
    radarBriefScore,
    sortRadarBriefItems,
  },
};
