'use strict';

const crypto = require('crypto');
const { captureManualSybilPaste, looksLikeManualSybilPaste } = require('../kat-stage2/manual-paste-capture');
const { extractSymbols } = require('../kat-stage2/sybil');
const defaultPaths = require('../paths');
const { appendJsonl, findByHash, readJsonl, writeJson } = require('./store');

const THEME_RULES = [
  ['ai_capex', /\b(?:ai|data.?center|capex|semis?|chips?|nvda|amd|avgo)\b/i],
  ['energy_rotation', /\b(?:energy|oil|crude|wti|xle)\b/i],
  ['macro_risk', /\b(?:fed|rates?|cpi|ppi|tariff|risk[-\s]?off|risk[-\s]?on)\b/i],
  ['reminder', /\b(?:remind|remember|follow up|check back|later|tomorrow|next week)\b/i],
  ['contradiction', /\b(?:contradict|but|however|risk|bear case|invalid|fails?|weakens?)\b/i],
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

function inferSourceType(input = {}, text = '') {
  const label = normalizeSourceLabel(input.source_label || input.sourceLabel || input.source);
  if (/^https?:\/\//i.test(String(input.source_url || input.url || '').trim())) return 'link';
  if (label.includes('sybil') || looksLikeManualSybilPaste(text)) return 'sybil_paste';
  if (label.includes('voice')) return 'voice_note';
  return 'manual_paste';
}

function extractThemes(text) {
  return [...new Set(THEME_RULES.filter(([, re]) => re.test(text)).map(([tag]) => tag))];
}

function reviewPriority(themes, sybilSummary) {
  if (themes.includes('contradiction')) return 'review';
  if ((sybilSummary?.context_records || 0) > 0) return 'review';
  if (themes.includes('reminder')) return 'reminder';
  return 'normal';
}

function buildRadarSnapshot(paths = defaultPaths, now = new Date()) {
  const rows = readJsonl(paths.events.radarIngest);
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  const fresh = rows.filter(row => {
    const ms = new Date(row.ts).getTime();
    return Number.isFinite(ms) && ms >= since;
  });
  const review = rows.filter(row => ['review', 'reminder'].includes(row.review_priority));
  const sourceCounts = {};
  const themeCounts = {};
  for (const row of rows) {
    sourceCounts[row.source_label || 'manual'] = (sourceCounts[row.source_label || 'manual'] || 0) + 1;
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
    source_counts: sourceCounts,
    theme_counts: themeCounts,
    recent: rows.slice(-12).reverse(),
    review_queue: review.slice(-8).reverse(),
    summary_line: rows.length ? `${fresh.length} fresh / ${review.length} review` : 'ready / no items',
  };
  writeJson(paths.snapshots.radarState, snapshot);
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
    review_priority: reviewPriority(themes, sybil?.summary),
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
  return {
    ok: true,
    items: readJsonl(paths.events.radarIngest).slice(-Number(options.limit || 50)).reverse(),
  };
}

module.exports = {
  buildRadarItems,
  buildRadarSnapshot,
  recordRadarIngest,
  _internal: {
    compactText,
    extractThemes,
    inferSourceType,
    normalizeSourceLabel,
    sha256,
  },
};
