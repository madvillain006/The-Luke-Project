'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseKatSignal } = require('./parse-kat');
const {
  classifyIndexTicker,
  extractIndexTickers,
} = require('./kat-index-scope');
const { readJsonl, _internal: auditInternal } = require('./kat-audit');

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function increment(map, key, amount) {
  const safeKey = key || 'unknown';
  map[safeKey] = (map[safeKey] || 0) + (amount || 1);
}

function sanitizeAttachment(att) {
  return {
    id: att.id || null,
    filename: att.filename || att.name || null,
    content_type: att.content_type || null,
    url: att.url || null,
    image: auditInternal.isImageAttachment(att),
  };
}

function imageEvidence(entry, tickers, heatmapCandidate) {
  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  const images = attachments.filter(auditInternal.isImageAttachment).map(sanitizeAttachment);
  if (!images.length) return null;
  return {
    has_image: true,
    heatmap_candidate: !!heatmapCandidate,
    tickers_from_text: tickers,
    attachments: images,
    parse_status: 'metadata_only',
    parse_note: 'Historical image bytes were not fetched in replay; this preserves attachment provenance for later vision parsing.',
  };
}

function buildReplayRecord(entry, signal, opts) {
  const tickers = extractIndexTickers(entry.content || '');
  const heatmapCandidate = auditInternal.isHeatmapCandidate(entry, tickers);
  const scope = classifyIndexTicker(signal.ticker);
  const evidence = imageEvidence(entry, tickers, heatmapCandidate);
  const signalHash = sha1([
    entry.message_id || '',
    entry.ts || '',
    entry.username || '',
    signal.signal_type || '',
    signal.ticker || '',
    signal.bias || '',
    signal.raw || entry.content || '',
  ].join('|'));

  return {
    replay_id: 'kat-index:' + signalHash,
    parser_version: opts.parserVersion || 'parse-kat:v1',
    source: 'katbot-discord',
    message_id: entry.message_id || null,
    ts: entry.ts || null,
    analyst: entry.username || signal.analyst || null,
    user_id: entry.user_id || null,
    channel: entry.channel_name || null,
    guild_id: entry.guild_id || null,
    signal_type: signal.signal_type,
    ticker: scope.ticker,
    original_ticker: signal.ticker || null,
    lane: scope.lane,
    family: scope.family,
    spx_options_direct: scope.spx_options_direct,
    spx_market_context: scope.spx_market_context,
    qqq_market_context: scope.qqq_market_context,
    bias: signal.bias || 'NEUTRAL',
    timeframe: signal.timeframe || null,
    pattern: signal.pattern || null,
    levels: Array.isArray(signal.levels) ? signal.levels : [],
    management: signal.signal_type === 'MANAGEMENT'
      ? { action: signal.action || null, pct: signal.pct || null }
      : null,
    image_evidence: evidence,
    raw_text: signal.raw || entry.content || '',
  };
}

function buildImageOnlyRecord(entry, tickers, opts) {
  const heatmapCandidate = auditInternal.isHeatmapCandidate(entry, tickers);
  const evidence = imageEvidence(entry, tickers, heatmapCandidate);
  if (!evidence) return null;
  const scopedTickers = tickers
    .map(ticker => classifyIndexTicker(ticker))
    .filter(scope => scope.ticker);
  if (!scopedTickers.length) return null;
  const primary = scopedTickers[0];
  return {
    replay_id: 'kat-image:' + sha1((entry.message_id || '') + '|' + tickers.join(',')),
    parser_version: opts.parserVersion || 'parse-kat:v1',
    source: 'katbot-discord',
    message_id: entry.message_id || null,
    ts: entry.ts || null,
    analyst: entry.username || null,
    user_id: entry.user_id || null,
    channel: entry.channel_name || null,
    guild_id: entry.guild_id || null,
    signal_type: 'IMAGE_EVIDENCE',
    ticker: primary.ticker,
    original_ticker: primary.ticker,
    lane: primary.lane,
    family: primary.family,
    spx_options_direct: primary.spx_options_direct,
    spx_market_context: primary.spx_market_context,
    qqq_market_context: primary.qqq_market_context,
    bias: 'NEUTRAL',
    timeframe: null,
    pattern: null,
    levels: [],
    management: null,
    image_evidence: evidence,
    raw_text: entry.content || '',
  };
}

function summarizeReplay(records, meta) {
  const summary = {
    generated_at: new Date().toISOString(),
    parser_version: meta.parserVersion,
    raw_messages: meta.rawMessages,
    raw_bad_lines: meta.rawBadLines,
    duplicate_message_ids_skipped: meta.duplicateSkipped,
    parsed_records: records.length,
    signal_records: records.filter(r => r.signal_type !== 'IMAGE_EVIDENCE').length,
    image_evidence_records: records.filter(r => r.signal_type === 'IMAGE_EVIDENCE').length,
    spx_options_direct_records: records.filter(r => r.spx_options_direct).length,
    by_lane: {},
    by_signal_type: {},
    by_bias: {},
    by_ticker: {},
    date_range: { first_ts: null, last_ts: null },
  };

  for (const record of records) {
    increment(summary.by_lane, record.lane);
    increment(summary.by_signal_type, record.signal_type);
    increment(summary.by_bias, record.bias);
    increment(summary.by_ticker, record.ticker);
    if (record.ts && (!summary.date_range.first_ts || record.ts < summary.date_range.first_ts)) {
      summary.date_range.first_ts = record.ts;
    }
    if (record.ts && (!summary.date_range.last_ts || record.ts > summary.date_range.last_ts)) {
      summary.date_range.last_ts = record.ts;
    }
  }

  return summary;
}

function buildKatReplay(options) {
  const opts = options || {};
  const rootDir = opts.rootDir || path.join(__dirname, '..');
  const rawPath = opts.rawPath || path.join(rootDir, 'data', 'kat', 'raw-feed.jsonl');
  const parsed = readJsonl(rawPath);
  const seen = new Set();
  const records = [];
  let duplicateSkipped = 0;

  for (const entry of parsed.records) {
    if (entry.message_id && seen.has(entry.message_id)) {
      duplicateSkipped++;
      continue;
    }
    if (entry.message_id) seen.add(entry.message_id);

    const tickers = extractIndexTickers(entry.content || '');
    const hasImage = Array.isArray(entry.attachments) && entry.attachments.some(auditInternal.isImageAttachment);
    const signal = parseKatSignal(entry.username, entry.content, hasImage);
    if (signal) {
      const scope = classifyIndexTicker(signal.ticker);
      if (scope.ticker) {
        records.push(buildReplayRecord(entry, signal, opts));
        continue;
      }
    }

    const imageRecord = buildImageOnlyRecord(entry, tickers, opts);
    if (imageRecord) records.push(imageRecord);
  }

  records.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  const summary = summarizeReplay(records, {
    parserVersion: opts.parserVersion || 'parse-kat:v1',
    rawMessages: parsed.records.length,
    rawBadLines: parsed.bad_lines,
    duplicateSkipped,
  });

  return { records, summary };
}

function writeKatReplay(result, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const replayPath = path.join(outDir, 'kat-index-replay.jsonl');
  const summaryPath = path.join(outDir, 'kat-replay-summary.json');
  fs.writeFileSync(
    replayPath,
    result.records.map(record => JSON.stringify(record)).join('\n') + (result.records.length ? '\n' : ''),
    'utf8'
  );
  fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2), 'utf8');
  return { replayPath, summaryPath };
}

module.exports = {
  buildKatReplay,
  writeKatReplay,
  _internal: {
    buildReplayRecord,
    buildImageOnlyRecord,
    imageEvidence,
    summarizeReplay,
  },
};
