'use strict';

const defaultPaths = require('../paths');
const { buildRadarItems, buildRadarSnapshot, recordRadarIngest } = require('../radar/ingest');

function buildRadarBrief(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const snapshot = buildRadarSnapshot(paths, now);
  const reviewItems = snapshot.review_queue || [];
  const ideas = reviewItems.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    title: item.title || item.raw_text_preview || item.source_label,
    source_label: item.source_label,
    symbols: item.symbols || [],
    themes: item.themes || [],
    confidence: item.review_priority === 'review' ? 0.72 : 0.5,
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
    theme_counts: snapshot.theme_counts,
    safety: {
      confidence_means: 'review_priority_not_trade_certainty',
      trading_authority: 'none',
    },
  };
}

module.exports = {
  buildRadarBrief,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
};
