'use strict';

const fs = require('fs');
const path = require('path');
const { parseKatSignal } = require('./parse-kat');
const {
  classifyIndexTicker,
  extractIndexTickers,
  normalizeIndexTicker,
} = require('./kat-index-scope');
const {
  buildKatTickerWatchlist,
} = require('./kat-ticker-watchlist');
const {
  buildKatEquityOptionsUniverse,
} = require('./kat-equity-options');

const DEFAULT_MARKET_DATA_DIRS = [
  path.join('data', 'backtest'),
  path.join('data', 'historical'),
  path.join('data', 'prices'),
];

function readJsonl(file) {
  const result = { exists: fs.existsSync(file), lines: 0, bad_lines: 0, records: [] };
  if (!result.exists) return result;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  result.lines = lines.length;
  for (const line of lines) {
    try {
      result.records.push(JSON.parse(line));
    } catch (e) {
      result.bad_lines++;
    }
  }
  return result;
}

function increment(map, key, amount) {
  const safeKey = key || 'unknown';
  map[safeKey] = (map[safeKey] || 0) + (amount || 1);
}

function isImageAttachment(att) {
  if (!att) return false;
  const type = String(att.content_type || '').toLowerCase();
  const filename = String(att.filename || att.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function isHeatmapCandidate(entry, tickers) {
  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  const hasImage = attachments.some(isImageAttachment);
  if (!hasImage) return false;
  const content = String(entry.content || '');
  return tickers.length > 0 || /\b(heatmap|heat map|map|chart|levels?|node|king|gatekeeper)\b/i.test(content);
}

function collectDateRange(records) {
  let first = null;
  let last = null;
  for (const record of records) {
    if (!record.ts) continue;
    const ms = new Date(record.ts).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!first || ms < first.ms) first = { ms, ts: record.ts };
    if (!last || ms > last.ms) last = { ms, ts: record.ts };
  }
  return { first_ts: first ? first.ts : null, last_ts: last ? last.ts : null };
}

function auditRawFeed(records) {
  const analysts = new Set();
  const channels = new Set();
  const messageIds = new Set();
  const duplicateIds = new Set();
  const messageIdSamples = new Map();
  const duplicateExamples = [];
  const indexMentionCounts = {};
  const laneCounts = {};
  const heatmapByLane = {};
  const unsupportedExamples = [];

  let imagePosts = 0;
  let imagePostsWithIndexMentions = 0;
  let heatmapCandidates = 0;
  let indexMentionPosts = 0;
  let emptyTextImagePosts = 0;

  for (const entry of records) {
    if (entry.username) analysts.add(entry.username);
    if (entry.channel_name) channels.add(entry.channel_name);
    if (entry.message_id) {
      if (messageIds.has(entry.message_id)) {
        duplicateIds.add(entry.message_id);
        if (duplicateExamples.length < 5) {
          duplicateExamples.push({
            message_id: entry.message_id,
            first: messageIdSamples.get(entry.message_id),
            duplicate: {
              ts: entry.ts || null,
              analyst: entry.username || null,
              channel: entry.channel_name || null,
              snippet: String(entry.content || '').slice(0, 120),
            },
          });
        }
      } else {
        messageIdSamples.set(entry.message_id, {
          ts: entry.ts || null,
          analyst: entry.username || null,
          channel: entry.channel_name || null,
          snippet: String(entry.content || '').slice(0, 120),
        });
      }
      messageIds.add(entry.message_id);
    }

    const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    const hasImage = attachments.some(isImageAttachment);
    const tickers = extractIndexTickers(entry.content || '');
    const heatmapCandidate = isHeatmapCandidate(entry, tickers);

    if (hasImage) imagePosts++;
    if (hasImage && !String(entry.content || '').trim()) emptyTextImagePosts++;
    if (tickers.length > 0) indexMentionPosts++;
    if (hasImage && tickers.length > 0) imagePostsWithIndexMentions++;
    if (heatmapCandidate) heatmapCandidates++;

    for (const ticker of tickers) {
      const lane = classifyIndexTicker(ticker).lane;
      increment(indexMentionCounts, ticker);
      increment(laneCounts, lane);
      if (heatmapCandidate) increment(heatmapByLane, lane);
    }

    if (unsupportedExamples.length < 10) {
      const maybeTicker = String(entry.content || '').match(/\$([A-Z]{1,5})\b/);
      if (maybeTicker && !normalizeIndexTicker(maybeTicker[1])) {
        unsupportedExamples.push({
          ticker: maybeTicker[1],
          analyst: entry.username || null,
          ts: entry.ts || null,
          snippet: String(entry.content || '').slice(0, 120),
        });
      }
    }
  }

  return {
    total: records.length,
    ...collectDateRange(records),
    analysts_count: analysts.size,
    channels_count: channels.size,
    duplicate_message_ids: duplicateIds.size,
    image_posts: imagePosts,
    image_posts_with_index_mentions: imagePostsWithIndexMentions,
    image_posts_without_text: emptyTextImagePosts,
    heatmap_candidates: heatmapCandidates,
    index_mention_posts: indexMentionPosts,
    index_mentions: indexMentionCounts,
    lane_counts: laneCounts,
    heatmap_candidates_by_lane: heatmapByLane,
    duplicate_examples: duplicateExamples,
    ignored_ticker_examples: unsupportedExamples,
  };
}

function auditProcessedSignals(records) {
  const bySignalType = {};
  const byBias = {};
  const byTicker = {};
  const byLane = {};
  const analysts = new Set();

  let indexSignals = 0;
  let directSpxOptionSignals = 0;
  let imageSignals = 0;
  let nonIndexSignals = 0;

  for (const signal of records) {
    if (signal.analyst) analysts.add(signal.analyst);
    increment(bySignalType, signal.signal_type);
    increment(byBias, signal.bias);
    increment(byTicker, signal.ticker);
    if (signal.has_image) imageSignals++;

    const scope = classifyIndexTicker(signal.ticker);
    if (scope.ticker) {
      indexSignals++;
      increment(byLane, scope.lane);
      if (scope.spx_options_direct) directSpxOptionSignals++;
    } else {
      nonIndexSignals++;
    }
  }

  return {
    total: records.length,
    ...collectDateRange(records),
    analysts_count: analysts.size,
    by_signal_type: bySignalType,
    by_bias: byBias,
    by_ticker: byTicker,
    by_lane: byLane,
    index_signals: indexSignals,
    non_index_signals: nonIndexSignals,
    spx_options_direct_signals: directSpxOptionSignals,
    image_signals: imageSignals,
  };
}

function replayParser(records) {
  const summary = {
    attempted: records.length,
    parsed: 0,
    null_or_noise: 0,
    index_parsed: 0,
    spx_options_direct_parsed: 0,
    by_lane: {},
    by_signal_type: {},
    by_bias: {},
  };

  for (const entry of records) {
    const hasImage = Array.isArray(entry.attachments) && entry.attachments.some(isImageAttachment);
    const signal = parseKatSignal(entry.username, entry.content, hasImage);
    if (!signal) {
      summary.null_or_noise++;
      continue;
    }

    summary.parsed++;
    increment(summary.by_signal_type, signal.signal_type);
    increment(summary.by_bias, signal.bias);

    const scope = classifyIndexTicker(signal.ticker);
    if (!scope.ticker) continue;
    summary.index_parsed++;
    increment(summary.by_lane, scope.lane);
    if (scope.spx_options_direct) summary.spx_options_direct_parsed++;
  }

  return summary;
}

function detectTickerFromMarketFile(fileName) {
  const lower = fileName.toLowerCase();
  if (/\bspx\b|^spx_|_spx_|spx_/.test(lower)) return 'SPX';
  if (/\bspy\b|^spy_|_spy_|spy_/.test(lower)) return 'SPY';
  if (/\bqqq\b|^qqq_|_qqq_|qqq_/.test(lower)) return 'QQQ';
  if (/\bndx\b|^ndx_|_ndx_|ndx_/.test(lower)) return 'NDX';
  if (/^nq[hmuz]\d|nq[hmuz]\d|_nq|nq_/.test(lower)) return 'NQ';
  if (/^es[hmuz]\d|es[hmuz]\d|_es|es_/.test(lower)) return 'ES';
  return null;
}

function walkFiles(dir, results) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkFiles(full, results);
    } else {
      results.push(full);
    }
  }
}

function inventoryMarketData(rootDir, dirs) {
  const byTicker = {};
  const files = [];
  for (const relDir of dirs || DEFAULT_MARKET_DATA_DIRS) {
    walkFiles(path.join(rootDir, relDir), files);
  }

  for (const file of files) {
    const ticker = detectTickerFromMarketFile(path.basename(file));
    if (!ticker) continue;
    if (!byTicker[ticker]) byTicker[ticker] = [];
    byTicker[ticker].push({
      path: path.relative(rootDir, file),
      bytes: fs.statSync(file).size,
    });
  }

  for (const ticker of Object.keys(byTicker)) {
    byTicker[ticker].sort((a, b) => b.bytes - a.bytes);
  }

  return {
    searched_dirs: dirs || DEFAULT_MARKET_DATA_DIRS,
    by_ticker: byTicker,
    available_tickers: Object.keys(byTicker).sort(),
  };
}

function buildBlockers(audit) {
  const blockers = [];
  if (!audit.files.raw_feed.exists) blockers.push('Kat raw feed missing.');
  if (!audit.files.processed_signals.exists) blockers.push('Kat processed signal feed missing.');
  if (audit.files.raw_feed.bad_lines > 0) blockers.push(`${audit.files.raw_feed.bad_lines} malformed raw-feed JSONL lines.`);
  if (audit.files.processed_signals.bad_lines > 0) blockers.push(`${audit.files.processed_signals.bad_lines} malformed processed-signals JSONL lines.`);
  if (audit.raw.duplicate_message_ids > 0) blockers.push(`${audit.raw.duplicate_message_ids} duplicate Discord message ids in raw feed.`);
  if (audit.raw.image_posts > 0 && audit.raw.heatmap_candidates === 0) blockers.push('Image posts exist, but no heatmap candidates were detected.');
  if (!audit.market_data.available_tickers.includes('SPX') && !audit.market_data.available_tickers.includes('SPY')) {
    blockers.push('No SPX/SPY market data files found for direct options evaluation.');
  }
  return blockers;
}

function buildNextActions(audit) {
  const actions = [];
  actions.push('Replay raw Kat feed into a versioned processed file before scoring analysts.');
  actions.push('Parse historical image/heatmap posts and attach image evidence by message_id.');
  actions.push('Evaluate SPX/SPY direct signals against available SPX/SPY bars before producing recommendation objects.');
  if (audit.raw.lane_counts.qqq_ndx_nq_context) {
    actions.push('Keep QQQ/NDX/NQ as separate index confluence until market-data validation proves a conversion rule.');
  }
  if (audit.raw.ignored_ticker_examples.length > 0) {
    actions.push('Leave non-index tickers ignored unless the Kat scope is explicitly widened.');
  }
  return actions;
}

function buildKatAudit(options) {
  const rootDir = options && options.rootDir ? options.rootDir : path.join(__dirname, '..');
  const rawPath = options && options.rawPath ? options.rawPath : path.join(rootDir, 'data', 'kat', 'raw-feed.jsonl');
  const processedPath = options && options.processedPath ? options.processedPath : path.join(rootDir, 'data', 'kat', 'processed-signals.jsonl');

  const raw = readJsonl(rawPath);
  const processed = readJsonl(processedPath);
  const audit = {
    generated_at: new Date().toISOString(),
    scope: {
      watched_index_tickers: ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ', 'MES', 'MNQ'],
      spx_options_direct_only: ['SPX', 'SPY'],
      qqq_ndx_nq_policy: 'separate confluence lane; not SPX-equivalent without validated market-data conversion',
      single_name_policy: 'single-name equities are shadow-watch only until market data and scoring exist',
    },
    files: {
      raw_feed: {
        path: path.relative(rootDir, rawPath),
        exists: raw.exists,
        lines: raw.lines,
        bad_lines: raw.bad_lines,
      },
      processed_signals: {
        path: path.relative(rootDir, processedPath),
        exists: processed.exists,
        lines: processed.lines,
        bad_lines: processed.bad_lines,
      },
    },
    raw: auditRawFeed(raw.records),
    processed: auditProcessedSignals(processed.records),
    replay: replayParser(raw.records),
    market_data: inventoryMarketData(rootDir, options && options.marketDataDirs),
  };
  audit.watchlist = buildKatTickerWatchlist({
    rootDir,
    now: options && options.now,
    windowDays: 14,
    limit: 10,
    minMentions: 2,
  });
  audit.equity_options = buildKatEquityOptionsUniverse({
    rootDir,
    now: options && options.now,
    windowDays: 14,
    limit: 20,
  });

  audit.blockers = buildBlockers(audit);
  audit.next_actions = buildNextActions(audit);
  return audit;
}

module.exports = {
  buildKatAudit,
  readJsonl,
  auditRawFeed,
  auditProcessedSignals,
  replayParser,
  inventoryMarketData,
  _internal: {
    detectTickerFromMarketFile,
    isImageAttachment,
    isHeatmapCandidate,
  },
};
