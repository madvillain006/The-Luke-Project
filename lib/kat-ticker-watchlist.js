'use strict';

const fs = require('fs');
const path = require('path');
const { parseKatSignal } = require('./parse-kat');
const { classifyIndexTicker } = require('./kat-index-scope');

const CORE_INDEX_TICKERS = new Set(['SPXW', 'SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'MES', 'NQ', 'MNQ', 'VIX', 'IWM', 'DIA']);
const STOP_TICKERS = new Set([
  'A', 'I', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BY', 'CAN', 'CEO', 'CFO',
  'CPI', 'DAY', 'DD', 'DMA', 'DO', 'EOD', 'EPS', 'ER', 'ETF', 'FOMC', 'FOR', 'GDP',
  'HE', 'HOD', 'IF', 'IN', 'IT', 'LOD', 'LOL', 'MA', 'MACD', 'ME', 'NO', 'NOT',
  'OR', 'PM', 'RTH', 'SEC', 'SMA', 'THE', 'THIS', 'TO', 'VWAP', 'WE', 'YOU',
]);

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

function normalizeTicker(ticker) {
  const normalized = String(ticker || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized || normalized.length > 5) return null;
  if (STOP_TICKERS.has(normalized)) return null;
  return normalized;
}

function isCoreIndexTicker(ticker) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return false;
  if (CORE_INDEX_TICKERS.has(normalized)) return true;
  return !!classifyIndexTicker(normalized).ticker;
}

function isWatchlistTicker(ticker) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return false;
  return !isCoreIndexTicker(normalized);
}

function isImageAttachment(att) {
  if (!att) return false;
  const type = String(att.content_type || '').toLowerCase();
  const filename = String(att.filename || att.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function extractTickerMentions(text) {
  const content = String(text || '');
  const found = new Set();

  for (const match of content.matchAll(/[$#]([A-Z]{1,5})\b/g)) {
    const ticker = normalizeTicker(match[1]);
    if (isWatchlistTicker(ticker)) found.add(ticker);
  }

  const start = content.match(/^\s*([A-Z]{2,5})\b(?=.*\b(?:1m|3m|5m|10m|15m|30m|1h|2h|4h|1d|daily|weekly|calls?|puts?|long|short|breakout|breakdown|support|resistance)\b)/i);
  if (start) {
    const ticker = normalizeTicker(start[1]);
    if (isWatchlistTicker(ticker)) found.add(ticker);
  }

  return [...found];
}

function ensureCandidate(map, ticker) {
  if (!map[ticker]) {
    map[ticker] = {
      ticker,
      mentions: 0,
      signal_count: 0,
      image_posts: 0,
      analysts: new Set(),
      channels: new Set(),
      bias_counts: {},
      latest_ts: null,
      latest_snippet: null,
    };
  }
  return map[ticker];
}

function increment(map, key) {
  const safeKey = key || 'unknown';
  map[safeKey] = (map[safeKey] || 0) + 1;
}

function newerThan(ts, cutoffMs) {
  if (!ts) return false;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) && ms >= cutoffMs;
}

function addRawMentions(candidates, records, cutoffMs) {
  for (const entry of records) {
    if (!newerThan(entry.ts, cutoffMs)) continue;
    const hasImage = Array.isArray(entry.attachments) && entry.attachments.some(isImageAttachment);
    const tickers = extractTickerMentions(entry.content || '');
    const parsed = parseKatSignal(entry.username, entry.content, hasImage);
    if (parsed && isWatchlistTicker(parsed.ticker)) tickers.push(normalizeTicker(parsed.ticker));

    for (const ticker of [...new Set(tickers.filter(Boolean))]) {
      const candidate = ensureCandidate(candidates, ticker);
      candidate.mentions++;
      if (hasImage) candidate.image_posts++;
      if (entry.username) candidate.analysts.add(entry.username);
      if (entry.channel_name) candidate.channels.add(entry.channel_name);
      if (!candidate.latest_ts || String(entry.ts) > String(candidate.latest_ts)) {
        candidate.latest_ts = entry.ts || null;
        candidate.latest_snippet = String(entry.content || '').slice(0, 160);
      }
    }
  }
}

function addProcessedSignals(candidates, records, cutoffMs) {
  for (const signal of records) {
    if (!newerThan(signal.ts, cutoffMs)) continue;
    const ticker = normalizeTicker(signal.ticker);
    if (!isWatchlistTicker(ticker)) continue;
    const candidate = ensureCandidate(candidates, ticker);
    candidate.signal_count++;
    if (signal.analyst) candidate.analysts.add(signal.analyst);
    if (signal.channel) candidate.channels.add(signal.channel);
    increment(candidate.bias_counts, signal.bias || 'NEUTRAL');
    if (!candidate.latest_ts || String(signal.ts) > String(candidate.latest_ts)) {
      candidate.latest_ts = signal.ts || null;
      candidate.latest_snippet = String(signal.raw || '').slice(0, 160);
    }
  }
}

function finalizeCandidate(candidate) {
  const biasEntries = Object.entries(candidate.bias_counts).sort((a, b) => b[1] - a[1]);
  return {
    ticker: candidate.ticker,
    mentions: candidate.mentions,
    signal_count: candidate.signal_count,
    image_posts: candidate.image_posts,
    analysts: [...candidate.analysts].sort(),
    analyst_count: candidate.analysts.size,
    channels: [...candidate.channels].sort(),
    dominant_bias: biasEntries.length ? biasEntries[0][0] : 'NEUTRAL',
    bias_counts: candidate.bias_counts,
    latest_ts: candidate.latest_ts,
    latest_snippet: candidate.latest_snippet,
    status: 'shadow_watch',
    policy: 'single-name watchlist only; not SPX-equivalent and not execution authority',
  };
}

function buildKatTickerWatchlist(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const now = options.now || new Date();
  const windowDays = options.windowDays || 14;
  const minMentions = options.minMentions || 2;
  const limit = options.limit || 10;
  const cutoffMs = now.getTime() - (windowDays * 24 * 60 * 60 * 1000);
  const katDir = path.join(rootDir, 'data', 'kat');
  const raw = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const processed = readJsonl(path.join(katDir, 'processed-signals.jsonl'));
  const candidates = {};

  addRawMentions(candidates, raw, cutoffMs);
  addProcessedSignals(candidates, processed, cutoffMs);

  const sorted = Object.values(candidates)
    .map(finalizeCandidate)
    .filter(candidate => (candidate.mentions + candidate.signal_count) >= minMentions)
    .sort((a, b) => {
      const scoreA = (a.mentions * 2) + a.signal_count + a.analyst_count + a.image_posts;
      const scoreB = (b.mentions * 2) + b.signal_count + b.analyst_count + b.image_posts;
      return scoreB - scoreA || a.ticker.localeCompare(b.ticker);
    })
    .slice(0, limit);

  return {
    generated_at: now.toISOString(),
    window_days: windowDays,
    min_mentions: minMentions,
    candidates: sorted,
    next_action: sorted.length
      ? 'Start shadow evaluation for these tickers only after matching market data is available.'
      : 'No non-index ticker has enough repeated mention evidence yet.',
  };
}

function formatKatTickerWatchlistForDiscord(watchlist) {
  const candidates = (watchlist && watchlist.candidates) || [];
  if (!candidates.length) {
    return 'No repeated non-index ticker mentions yet.\n_Shadow watchlist needs repeated mentions before Kat follows it._';
  }

  const rows = candidates.slice(0, 8).map(candidate => {
    return '`' + candidate.ticker + '` ' +
      candidate.mentions + ' mentions, ' +
      candidate.signal_count + ' parsed signal(s), ' +
      candidate.analyst_count + ' analyst(s)' +
      (candidate.image_posts ? ', ' + candidate.image_posts + ' image(s)' : '');
  });

  return '**Kat shadow watchlist**\n' +
    rows.join('\n') + '\n' +
    '_Single names are observation only. They do not feed SPX confluence._';
}

module.exports = {
  buildKatTickerWatchlist,
  formatKatTickerWatchlistForDiscord,
  extractTickerMentions,
  isWatchlistTicker,
  _internal: {
    normalizeTicker,
    isCoreIndexTicker,
    isImageAttachment,
    addRawMentions,
    addProcessedSignals,
  },
};
