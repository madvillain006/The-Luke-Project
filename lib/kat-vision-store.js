'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractIndexTickers, classifyIndexTicker } = require('./kat-index-scope');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function appendJsonl(file, record) {
  ensureDir(file);
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function katVisionPaths(rootDir) {
  const root = rootDir || path.join(__dirname, '..');
  const katDir = path.join(root, 'data', 'kat');
  return {
    katDir,
    visionSignals: path.join(katDir, 'vision-signals.jsonl'),
    processedSignals: path.join(katDir, 'processed-signals.jsonl'),
  };
}

function isImageAttachment(att) {
  if (!att) return false;
  const type = String(att.content_type || att.contentType || '').toLowerCase();
  const filename = String(att.filename || att.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function normalizeChartType(value) {
  const chartType = String(value || '').toLowerCase();
  if (chartType === 'heatmap') return 'heatmap';
  if (chartType === 'candlestick') return 'candlestick';
  if (chartType === 'technical') return 'technical';
  return 'unknown';
}

function normalizeBias(value) {
  const bias = String(value || '').toUpperCase();
  if (bias === 'BULLISH' || bias === 'BEARISH') return bias;
  return 'NEUTRAL';
}

function normalizeLevels(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) continue;
    const rounded = Math.round(number * 100) / 100;
    const key = String(rounded);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rounded);
  }
  return out;
}

function collectVisionLevels(vision) {
  const heatmap = vision && vision.heatmap_context ? vision.heatmap_context : {};
  return normalizeLevels([
    ...(vision && Array.isArray(vision.key_levels) ? vision.key_levels : []),
    ...(vision && Array.isArray(vision.support_levels) ? vision.support_levels : []),
    ...(vision && Array.isArray(vision.resistance_levels) ? vision.resistance_levels : []),
    ...(Array.isArray(heatmap.king_nodes) ? heatmap.king_nodes : []),
    ...(Array.isArray(heatmap.gatekeeper_nodes) ? heatmap.gatekeeper_nodes : []),
    ...(Array.isArray(heatmap.air_pockets) ? heatmap.air_pockets : []),
  ]).filter(level => level > 50);
}

function inferTicker(entry, parsedSignal, vision) {
  const explicit = vision && vision.ticker ? String(vision.ticker).toUpperCase().replace(/[^A-Z]/g, '') : null;
  if (explicit) return explicit;
  if (parsedSignal && parsedSignal.ticker) return String(parsedSignal.ticker).toUpperCase();
  const tickers = extractIndexTickers(entry && entry.content || '');
  if (tickers.length) return classifyIndexTicker(tickers[0]).ticker || tickers[0];
  return null;
}

function sourceClassForChartType(chartType) {
  if (chartType === 'heatmap') return 'heatmap';
  if (chartType === 'candlestick' || chartType === 'technical') return 'chart';
  return 'image';
}

function buildKatVisionRecord(input) {
  const entry = input.entry || {};
  const attachment = input.attachment || {};
  const vision = input.vision || {};
  const chartType = normalizeChartType(vision.chart_type);
  const ticker = inferTicker(entry, input.parsedSignal, vision);
  const levels = collectVisionLevels(vision);
  const ts = input.now ? input.now.toISOString() : new Date().toISOString();
  const attachmentId = attachment.id || `attachment-${input.attachmentIndex || 0}`;
  const visionId = 'kat-vision:' + sha1([
    entry.message_id || '',
    attachmentId,
    chartType,
    ticker || '',
    levels.join(','),
  ].join('|'));

  return {
    vision_id: visionId,
    type: 'kat_vision_signal',
    source: 'katbot-discord',
    source_class: sourceClassForChartType(chartType),
    parse_status: levels.length ? 'parsed_levels' : 'parsed_no_levels',
    model: input.model || null,
    parsed_at: ts,
    ts: entry.ts || ts,
    analyst: entry.username || (input.parsedSignal && input.parsedSignal.analyst) || null,
    user_id: entry.user_id || null,
    channel: entry.channel_name || null,
    channel_id: entry.channel_id || null,
    guild_id: entry.guild_id || null,
    message_id: entry.message_id || null,
    attachment_id: attachmentId,
    attachment_index: input.attachmentIndex || 0,
    attachment: {
      id: attachment.id || null,
      filename: attachment.filename || attachment.name || null,
      content_type: attachment.content_type || attachment.contentType || null,
      url: attachment.url || null,
    },
    ticker,
    bias: normalizeBias(vision.bias),
    chart_type: chartType,
    levels,
    key_levels: normalizeLevels(vision.key_levels || []),
    support_levels: normalizeLevels(vision.support_levels || []),
    resistance_levels: normalizeLevels(vision.resistance_levels || []),
    heatmap_context: vision.heatmap_context || null,
    patterns: Array.isArray(vision.patterns) ? vision.patterns : [],
    notes: vision.notes || null,
    raw_text: entry.content || '',
    raw_model_text: input.rawModelText || null,
    provenance: {
      server: 'Elevated Charts',
      channel: entry.channel_name || null,
      analyst: entry.username || null,
      message_id: entry.message_id || null,
      attachment_id: attachmentId,
      captured_at: ts,
    },
    human_gate_required: true,
  };
}

function buildProcessedSignalFromVision(record) {
  if (!record || !record.ticker || !Array.isArray(record.levels) || record.levels.length === 0) {
    return null;
  }
  return {
    signal_type: 'CHART_ANALYSIS',
    source_type: 'vision',
    vision_id: record.vision_id,
    vision_chart_type: record.chart_type,
    vision_source_class: record.source_class,
    analyst: record.analyst,
    ticker: record.ticker,
    timeframe: null,
    bias: record.bias || 'NEUTRAL',
    pattern: record.patterns && record.patterns.length ? record.patterns.join(', ') : null,
    levels: record.levels,
    entry_context: {
      source: 'analyst_chart_or_heatmap_image',
      mode: 'human_gated_confluence_only',
      candidate_levels: record.levels,
      note: 'Image-read levels are confluence inputs for Luke entries/verdicts, not autonomous execution.',
    },
    has_image: true,
    raw: record.raw_text || '',
    ts: record.ts,
    message_id: `${record.message_id || record.vision_id}:vision:${record.attachment_id || record.attachment_index}`,
    source_message_id: record.message_id || null,
    channel: record.channel || null,
    user_id: record.user_id || null,
    image_evidence: [record.attachment],
    heatmap_context: record.heatmap_context || null,
    human_gate_required: true,
  };
}

function appendKatVisionRecord(record, options = {}) {
  const paths = katVisionPaths(options.rootDir);
  appendJsonl(options.visionFile || paths.visionSignals, record);
  const processed = buildProcessedSignalFromVision(record);
  if (processed && options.appendProcessed !== false) {
    appendJsonl(options.processedFile || paths.processedSignals, processed);
  }
  return { record, processed, paths };
}

function readKatVisionSignals(options = {}) {
  const paths = katVisionPaths(options.rootDir);
  const file = options.visionFile || paths.visionSignals;
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

module.exports = {
  katVisionPaths,
  isImageAttachment,
  buildKatVisionRecord,
  buildProcessedSignalFromVision,
  appendKatVisionRecord,
  readKatVisionSignals,
  _internal: {
    normalizeChartType,
    normalizeBias,
    normalizeLevels,
    collectVisionLevels,
    inferTicker,
    sourceClassForChartType,
  },
};
