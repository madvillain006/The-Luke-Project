'use strict';

const crypto = require('crypto');
const { captureManualSybilPaste, looksLikeManualSybilPaste } = require('../kat-stage2/manual-paste-capture');
const { extractSymbols } = require('../kat-stage2/sybil');
const defaultPaths = require('../paths');
const { appendJsonl, findByHash, readJsonl, writeJson } = require('./store');

const REVIEW_STATES = new Set(['new', 'reviewing', 'accepted', 'contradicted', 'archived']);
const ACTIVE_REVIEW_STATES = new Set(['new', 'reviewing', 'contradicted']);

const SOURCE_TYPES = new Set([
  'manual_paste',
  'sybil_paste',
  'katbot_paste',
  'discord_export',
  'voice_note',
  'article',
  'link',
  'screenshot_note',
  'pine_trading_note',
  'reminder',
  'reference_idea',
]);

const THEME_RULES = [
  ['ai_capex', /\b(?:ai|data.?center|capex|semis?|chips?|nvda|amd|avgo)\b/i],
  ['energy_rotation', /\b(?:energy|oil|crude|wti|xle)\b/i],
  ['macro_risk', /\b(?:fed|rates?|cpi|ppi|tariff|risk[-\s]?off|risk[-\s]?on)\b/i],
  ['trading_level', /\b(?:level|support|resistance|mancini|saty|pine|tradingview|watchlist|entry|stop|target)\b/i],
  ['reminder', /\b(?:remind|remember|follow up|check back|later|tomorrow|next week)\b/i],
  ['contradiction', /\b(?:contradict|but|however|risk|bear case|invalid|fails?|weakens?)\b/i],
  ['reference_insight', /\b(?:reference.?(?:repo|idea|concept|pattern)|from (?:hermes|mempalace|qlib|autoresearch))\b/i],
];

function compactText(value, max = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeSourceLabel(value) {
  const label = String(value || 'manual').trim().toLowerCase();
  return label.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
}

function normalizeSourceType(value) {
  const type = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!type || type === 'auto') return null;
  if (SOURCE_TYPES.has(type)) return type;
  if (type === 'sybil') return 'sybil_paste';
  if (type === 'katbot' || type === 'kat') return 'katbot_paste';
  if (type === 'discord') return 'discord_export';
  if (type === 'voice') return 'voice_note';
  if (type === 'screenshot') return 'screenshot_note';
  if (type === 'pine' || type === 'trading_note') return 'pine_trading_note';
  return null;
}

function inferSourceType(input = {}, text = '') {
  const explicit = normalizeSourceType(input.source_type || input.sourceType || input.source_kind || input.sourceKind);
  if (explicit) return explicit;
  const label = normalizeSourceLabel(input.source_label || input.sourceLabel || input.source);
  const haystack = `${label} ${text}`.toLowerCase();
  if (label.includes('sybil') || looksLikeManualSybilPaste(text)) return 'sybil_paste';
  if (/\b(?:katbot|kapri|kat)\b/i.test(haystack)) return 'katbot_paste';
  if (/\bdiscord\b/i.test(haystack)) return 'discord_export';
  if (label.includes('voice') || /\b(?:voice note|transcript|whisper)\b/i.test(text)) return 'voice_note';
  if (/\b(?:article|readwise|reader|kindle|newsletter|rss)\b/i.test(haystack)) return 'article';
  if (/\b(?:screenshot|image|ocr)\b/i.test(haystack)) return 'screenshot_note';
  if (/\b(?:pine|tradingview|mancini|saty|watchlist|level)\b/i.test(haystack)) return 'pine_trading_note';
  if (/\b(?:remind|remember|follow up|check back)\b/i.test(text)) return 'reminder';
  if (/^https?:\/\//i.test(String(input.source_url || input.url || '').trim())) return 'link';
  return 'manual_paste';
}

function extractThemes(text) {
  return [...new Set(THEME_RULES.filter(([, re]) => re.test(text)).map(([tag]) => tag))];
}

function reviewPriority(themes, sybilSummary, sourceType = 'manual_paste') {
  if (sourceType === 'reference_idea') return 'review';
  if (themes.includes('contradiction')) return 'review';
  if ((sybilSummary?.context_records || 0) > 0) return 'review';
  if (sourceType === 'pine_trading_note' || sourceType === 'katbot_paste') return 'review';
  if (themes.includes('reminder')) return 'reminder';
  if (sourceType === 'reminder') return 'reminder';
  return 'normal';
}

function normalizeRelationshipIds(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,|]+/);
  return [...new Set(raw.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 12);
}

function latestReviewsByItem(paths = defaultPaths) {
  const reviews = readJsonl(paths.events.radarReviews);
  const latest = new Map();
  for (const review of reviews) {
    if (!review.item_id) continue;
    latest.set(review.item_id, review);
  }
  return latest;
}

function reviewsForItem(paths = defaultPaths, itemId) {
  return readJsonl(paths.events.radarReviews)
    .filter(review => review.item_id === itemId)
    .sort((a, b) => new Date(a.ts || 0).getTime() - new Date(b.ts || 0).getTime());
}

function summarizeRadarItem(row, review = null) {
  const reviewState = review?.review_state || row.review_state || 'new';
  return {
    id: row.id,
    ts: row.ts,
    source_type: row.source_type,
    source_label: row.source_label,
    source_url: row.source_url,
    title: row.title,
    raw_text_preview: row.raw_text_preview,
    symbols: row.symbols || [],
    themes: row.themes || [],
    review_priority: row.review_priority || 'normal',
    review_state: reviewState,
    relationship_ids: row.relationship_ids || [],
    latest_review: review ? {
      ts: review.ts,
      review_state: review.review_state,
      note: review.note || null,
      next_action: review.next_action || null,
    } : null,
    sybil_context: row.sybil_context,
  };
}

function isActiveReviewItem(item) {
  if (!ACTIVE_REVIEW_STATES.has(item.review_state || 'new')) return false;
  return ['review', 'reminder'].includes(item.review_priority) || item.review_state !== 'new';
}

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildSourceHealth(rows, now = new Date()) {
  const latestBySource = new Map();
  const counts = {};
  const decisions = {};
  for (const row of rows) {
    const source = row.source_label || 'manual';
    counts[source] = (counts[source] || 0) + 1;
    if (!decisions[source]) {
      decisions[source] = { accepted: 0, contradicted: 0, archived: 0 };
    }
    if (row.review_state === 'accepted') decisions[source].accepted += 1;
    if (row.review_state === 'contradicted') decisions[source].contradicted += 1;
    if (row.review_state === 'archived') decisions[source].archived += 1;
    const current = latestBySource.get(source);
    if (!current || new Date(row.ts).getTime() > new Date(current.last_seen_at).getTime()) {
      latestBySource.set(source, {
        source_label: source,
        source_type: row.source_type || 'manual_paste',
        last_seen_at: row.ts,
      });
    }
  }
  return [...latestBySource.values()]
    .map(row => {
      const sourceDecisions = decisions[row.source_label] || { accepted: 0, contradicted: 0, archived: 0 };
      const decisionCount = sourceDecisions.accepted + sourceDecisions.contradicted + sourceDecisions.archived;
      const qualityScore = decisionCount >= 3
        ? Number((sourceDecisions.accepted / decisionCount).toFixed(2))
        : null;
      const ageHours = Math.max(0, (now.getTime() - new Date(row.last_seen_at || 0).getTime()) / 3600000);
      return {
        ...row,
        items: counts[row.source_label] || 0,
        decisions: sourceDecisions,
        decision_count: decisionCount,
        quality_score: qualityScore,
        quality_status: decisionCount >= 3 ? 'scored' : 'warming_up',
        age_hours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(1)) : null,
        freshness_status: ageHours > 48 ? 'stale' : 'fresh',
      };
    })
    .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
    .slice(0, 12);
}

function buildRadarSnapshot(paths = defaultPaths, now = new Date(), options = {}) {
  const rows = readJsonl(paths.events.radarIngest);
  const latestReviews = latestReviewsByItem(paths);
  const summarized = rows.map(row => summarizeRadarItem(row, latestReviews.get(row.id)));
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  const fresh = summarized.filter(row => {
    const ms = new Date(row.ts).getTime();
    return Number.isFinite(ms) && ms >= since;
  });
  const review = summarized.filter(isActiveReviewItem);
  const themeCounts = {};
  for (const row of summarized) {
    for (const theme of row.themes || []) themeCounts[theme] = (themeCounts[theme] || 0) + 1;
  }
  const snapshot = {
    ok: true,
    label: 'Radar',
    generated_at: now.toISOString(),
    counts: {
      total: rows.length,
      fresh_24h: fresh.length,
      review: review.length,
    },
    source_counts: countBy(summarized, row => row.source_label || 'manual'),
    source_type_counts: countBy(summarized, row => row.source_type || 'manual_paste'),
    review_state_counts: countBy(summarized, row => row.review_state || 'new'),
    source_health: buildSourceHealth(summarized, now),
    theme_counts: themeCounts,
    recent: summarized.slice(-12).reverse(),
    review_queue: review.slice(-8).reverse(),
    summary_line: rows.length ? `${fresh.length} fresh / ${review.length} review` : 'ready / no items',
    payload_policy: {
      raw_text_in_snapshot: false,
      reason: 'UI and brain summaries use previews to keep polling payloads small.',
    },
  };
  if (options.writeSnapshot !== false) writeJson(paths.snapshots.radarState, snapshot);
  return snapshot;
}

function recordRadarIngest(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const text = String(input.text || input.raw_text || input.message || '').trim();
  const sourceUrl = String(input.source_url || input.url || '').trim() || null;
  if (!text && !sourceUrl) {
    const err = new Error('text or source_url is required');
    err.statusCode = 400;
    throw err;
  }

  const sourceLabel = normalizeSourceLabel(input.source_label || input.sourceLabel || input.source);
  const sourceType = inferSourceType(input, text);
  const rawHash = sha256([sourceType, sourceLabel, sourceUrl || '', text].join('|'));
  const duplicate = findByHash(paths.events.radarIngest, rawHash);
  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      item: duplicate,
      snapshot: buildRadarSnapshot(paths, now),
    };
  }

  let sybil = null;
  if (sourceType === 'sybil_paste' && text) {
    sybil = captureManualSybilPaste(text, {
      channelName: sourceLabel.includes('sybil') ? 'manual-sybil-paste' : sourceLabel,
      provenanceNote: 'radar capture',
      pastedAtUtc: now.toISOString(),
      idPrefix: 'radar_sybil',
    });
  }

  const themes = extractThemes(text);
  const item = {
    id: `radar_${rawHash.slice(0, 16)}`,
    ts: now.toISOString(),
    source_type: sourceType,
    source_label: sourceLabel,
    source_url: sourceUrl,
    title: input.title || null,
    raw_text: text,
    raw_text_preview: compactText(text || sourceUrl, 360),
    raw_hash: rawHash,
    symbols: text ? extractSymbols(text) : [],
    themes,
    review_priority: reviewPriority(themes, sybil?.summary, sourceType),
    review_state: 'new',
    relationship_ids: normalizeRelationshipIds(input.relationship_ids || input.relationshipIds || input.related_to || input.relatedTo),
    provenance: {
      captured_by: 'luke',
      capture_route: '/agent/brain/radar/ingest',
    },
    sybil_context: sybil ? {
      messages: sybil.summary.messages,
      context_records: sybil.summary.context_records,
      low_signal_records: sybil.summary.low_signal_records,
      tag_counts: sybil.summary.tag_counts,
    } : null,
  };

  appendJsonl(paths.events.radarIngest, item);
  return {
    ok: true,
    duplicate: false,
    item,
    snapshot: buildRadarSnapshot(paths, now),
  };
}

function buildRadarItems(options = {}) {
  const paths = options.paths || defaultPaths;
  const rows = readJsonl(paths.events.radarIngest).slice(-Number(options.limit || 50)).reverse();
  if (options.includeRaw) {
    return { ok: true, items: rows };
  }
  const latestReviews = latestReviewsByItem(paths);
  return {
    ok: true,
    items: rows.map(row => summarizeRadarItem(row, latestReviews.get(row.id))),
  };
}

function buildRadarItemDetail(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const itemId = String(input.item_id || input.itemId || input.id || '').trim();
  if (!itemId) {
    const err = new Error('item_id is required');
    err.statusCode = 400;
    throw err;
  }
  const item = readJsonl(paths.events.radarIngest).find(row => row.id === itemId);
  if (!item) {
    const err = new Error('Radar item not found');
    err.statusCode = 404;
    throw err;
  }
  const reviewHistory = reviewsForItem(paths, itemId);
  const latestReview = reviewHistory[reviewHistory.length - 1] || null;
  return {
    ok: true,
    item: {
      ...item,
      review_state: latestReview?.review_state || item.review_state || 'new',
      latest_review: latestReview,
      review_history: reviewHistory,
    },
    payload_policy: {
      raw_text_loaded_on_demand: true,
    },
  };
}

function recordRadarReview(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const itemId = String(input.item_id || input.itemId || '').trim();
  const reviewState = String(input.review_state || input.reviewState || input.state || '').trim().toLowerCase();
  if (!itemId) {
    const err = new Error('item_id is required');
    err.statusCode = 400;
    throw err;
  }
  if (!REVIEW_STATES.has(reviewState)) {
    const err = new Error(`review_state must be one of ${[...REVIEW_STATES].join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const item = readJsonl(paths.events.radarIngest).find(row => row.id === itemId);
  if (!item) {
    const err = new Error('Radar item not found');
    err.statusCode = 404;
    throw err;
  }

  const review = {
    id: `radar_review_${sha256([itemId, reviewState, now.toISOString(), input.note || ''].join('|')).slice(0, 16)}`,
    ts: now.toISOString(),
    item_id: itemId,
    review_state: reviewState,
    note: compactText(input.note || '', 240) || null,
    next_action: compactText(input.next_action || input.nextAction || '', 180) || null,
    reviewer: compactText(input.reviewer || 'conor', 60),
  };
  appendJsonl(paths.events.radarReviews, review);
  return {
    ok: true,
    review,
    item: summarizeRadarItem(item, review),
    snapshot: buildRadarSnapshot(paths, now),
  };
}

module.exports = {
  buildRadarItemDetail,
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarReview,
  recordRadarIngest,
  _internal: {
    compactText,
    extractThemes,
    inferSourceType,
    normalizeRelationshipIds,
    normalizeSourceLabel,
    normalizeSourceType,
    reviewsForItem,
    summarizeRadarItem,
    sha256,
  },
};
