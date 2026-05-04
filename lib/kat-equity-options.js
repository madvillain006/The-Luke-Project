'use strict';

const fs = require('fs');
const path = require('path');
const { parseKatSignal } = require('./parse-kat');
const {
  extractTickerMentions,
  isWatchlistTicker,
  _internal: watchlistInternal,
} = require('./kat-ticker-watchlist');

const OPTION_WORD_RE = /\b(calls?|puts?|contracts?|sweeps?|premium|debit|credit|expiry|expires?|exp|strike|lotto|weeklies|0dte|1dte)\b/i;
const EXPIRY_RE = /\b(?:exp(?:iry|ires?)?\s*)?(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;
const CONTRACT_RE = /\b([A-Z]{1,5})?\s*(\d{1,5}(?:\.\d{1,2})?)\s*([CP])\b/i;
const STRIKE_WORD_RE = /\b(?:strike|strikes?|at)\s*(\d{1,5}(?:\.\d{1,2})?)\b/i;
const PREMIUM_RE = /(?:\b(?:premium|debit|credit|paid|entry|fills?|fill)\b|@)\s*\$?(\d{1,3}(?:\.\d{1,2})?)\b/i;

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
  return watchlistInternal.normalizeTicker(ticker);
}

function normalizeSide(side) {
  const raw = String(side || '').toLowerCase();
  if (raw === 'c' || raw.includes('call')) return 'CALL';
  if (raw === 'p' || raw.includes('put')) return 'PUT';
  return null;
}

function inferOptionSide(text) {
  const content = String(text || '');
  const contract = content.match(CONTRACT_RE);
  if (contract) return normalizeSide(contract[3]);
  if (/\bcalls?\b/i.test(content)) return 'CALL';
  if (/\bputs?\b/i.test(content)) return 'PUT';
  return null;
}

function inferStrike(text) {
  const content = String(text || '');
  const contract = content.match(CONTRACT_RE);
  if (contract) return Number(contract[2]);
  const strike = content.match(STRIKE_WORD_RE);
  if (strike) return Number(strike[1]);
  return null;
}

function extractOptionContext(text, fallbackTicker) {
  const content = String(text || '');
  const side = inferOptionSide(content);
  const hasOptionLanguage = OPTION_WORD_RE.test(content) || !!side;
  if (!hasOptionLanguage) return null;

  const contract = content.match(CONTRACT_RE);
  const contractTicker = contract && contract[1] ? normalizeTicker(contract[1]) : null;
  const ticker = normalizeTicker(contractTicker || fallbackTicker || extractTickerMentions(content)[0]);
  if (!ticker || !isWatchlistTicker(ticker)) return null;

  const expiry = content.match(EXPIRY_RE);
  const premium = content.match(PREMIUM_RE);
  const strike = inferStrike(content);

  return {
    asset_class: 'option',
    underlying: ticker,
    side,
    strike: Number.isFinite(strike) ? strike : null,
    expiry: expiry ? expiry[1].replace(/-/g, '/') : null,
    premium: premium ? Number(premium[1]) : null,
    confidence: side || strike || expiry ? 'medium' : 'low',
    parse_note: 'Options shadow context only; contract details may be partial until validated.',
  };
}

function classifyAssetClass(text, ticker) {
  const option = extractOptionContext(text, ticker);
  if (option) return option;
  const normalized = normalizeTicker(ticker || extractTickerMentions(text)[0]);
  if (!normalized || !isWatchlistTicker(normalized)) return null;
  return {
    asset_class: 'equity',
    underlying: normalized,
    side: null,
    strike: null,
    expiry: null,
    premium: null,
    confidence: 'low',
    parse_note: 'Equity shadow context only; needs market data and scoring before recommendations.',
  };
}

function newProfile(ticker) {
  return {
    ticker,
    mentions: 0,
    parsed_signals: 0,
    equity_mentions: 0,
    option_mentions: 0,
    image_posts: 0,
    analysts: new Set(),
    channels: new Set(),
    bias_counts: {},
    option_sides: {},
    option_contracts: [],
    levels: new Set(),
    latest_ts: null,
    latest_snippet: null,
  };
}

function ensureProfile(map, ticker) {
  if (!map[ticker]) map[ticker] = newProfile(ticker);
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

function updateLatest(profile, ts, snippet) {
  if (!ts) return;
  if (!profile.latest_ts || String(ts) > String(profile.latest_ts)) {
    profile.latest_ts = ts;
    profile.latest_snippet = String(snippet || '').slice(0, 200);
  }
}

function addEvidence(profile, entry, context, signal) {
  profile.mentions++;
  if (signal) profile.parsed_signals++;
  if (context.asset_class === 'option') {
    profile.option_mentions++;
    if (context.side) increment(profile.option_sides, context.side);
    profile.option_contracts.push({
      side: context.side,
      strike: context.strike,
      expiry: context.expiry,
      premium: context.premium,
      analyst: entry.username || signal?.analyst || null,
      ts: entry.ts || signal?.ts || null,
      message_id: entry.message_id || signal?.message_id || null,
    });
  } else {
    profile.equity_mentions++;
  }

  if (Array.isArray(entry.attachments) && entry.attachments.some(watchlistInternal.isImageAttachment)) {
    profile.image_posts++;
  }
  if (entry.username || signal?.analyst) profile.analysts.add(entry.username || signal.analyst);
  if (entry.channel_name || signal?.channel) profile.channels.add(entry.channel_name || signal.channel);
  if (signal && signal.bias) increment(profile.bias_counts, signal.bias);
  for (const level of signal && Array.isArray(signal.levels) ? signal.levels : []) {
    profile.levels.add(level);
  }
  updateLatest(profile, entry.ts || signal?.ts, entry.content || signal?.raw);
}

function addRaw(records, profiles, cutoffMs) {
  for (const entry of records) {
    if (!newerThan(entry.ts, cutoffMs)) continue;
    const hasImage = Array.isArray(entry.attachments) && entry.attachments.some(watchlistInternal.isImageAttachment);
    const signal = parseKatSignal(entry.username, entry.content, hasImage);
    const tickers = new Set(extractTickerMentions(entry.content || ''));
    if (signal && isWatchlistTicker(signal.ticker)) tickers.add(normalizeTicker(signal.ticker));

    for (const ticker of [...tickers].filter(Boolean)) {
      const context = classifyAssetClass(entry.content || '', ticker);
      if (!context) continue;
      addEvidence(ensureProfile(profiles, context.underlying), entry, context, signal);
    }
  }
}

function addProcessed(records, profiles, cutoffMs) {
  for (const signal of records) {
    if (!newerThan(signal.ts, cutoffMs)) continue;
    const ticker = normalizeTicker(signal.ticker);
    if (!isWatchlistTicker(ticker)) continue;
    const context = classifyAssetClass(signal.raw || '', ticker);
    if (!context) continue;
    addEvidence(
      ensureProfile(profiles, context.underlying),
      {
        ts: signal.ts,
        username: signal.analyst,
        channel_name: signal.channel,
        message_id: signal.message_id,
        content: signal.raw || '',
        attachments: signal.has_image ? [{ filename: 'signal-image.png', content_type: 'image/png' }] : [],
      },
      context,
      signal
    );
  }
}

function finalProfile(profile) {
  const biasEntries = Object.entries(profile.bias_counts).sort((a, b) => b[1] - a[1]);
  const sides = Object.entries(profile.option_sides).sort((a, b) => b[1] - a[1]);
  const analystCount = profile.analysts.size;
  const evidenceCount = profile.mentions + profile.parsed_signals;
  const shadowReady = evidenceCount >= 4 && analystCount >= 2;

  return {
    ticker: profile.ticker,
    status: shadowReady ? 'shadow_ready' : 'shadow_collecting',
    asset_scope: profile.option_mentions > 0 ? 'equity_and_options' : 'equity',
    mentions: profile.mentions,
    parsed_signals: profile.parsed_signals,
    equity_mentions: profile.equity_mentions,
    option_mentions: profile.option_mentions,
    image_posts: profile.image_posts,
    analysts: [...profile.analysts].sort(),
    analyst_count: analystCount,
    channels: [...profile.channels].sort(),
    dominant_bias: biasEntries.length ? biasEntries[0][0] : 'NEUTRAL',
    dominant_option_side: sides.length ? sides[0][0] : null,
    option_contracts: profile.option_contracts.slice(-10).reverse(),
    levels: [...profile.levels].sort((a, b) => a - b).slice(0, 20),
    latest_ts: profile.latest_ts,
    latest_snippet: profile.latest_snippet,
    policy: 'equity/options shadow input only; not SPX-equivalent and not execution authority',
    next_step: shadowReady
      ? 'Ready for downstream market-data validation by the backtesting lane.'
      : 'Keep collecting analyst and chart evidence before scoring.',
  };
}

function profileScore(profile) {
  return (profile.mentions * 2) +
    profile.parsed_signals +
    (profile.option_mentions * 2) +
    profile.image_posts +
    profile.analyst_count;
}

function buildKatEquityOptionsUniverse(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const now = options.now || new Date();
  const windowDays = options.windowDays || 14;
  const cutoffMs = now.getTime() - (windowDays * 24 * 60 * 60 * 1000);
  const limit = options.limit || 20;
  const katDir = path.join(rootDir, 'data', 'kat');
  const profiles = {};

  addRaw(readJsonl(path.join(katDir, 'raw-feed.jsonl')), profiles, cutoffMs);
  addProcessed(readJsonl(path.join(katDir, 'processed-signals.jsonl')), profiles, cutoffMs);

  const tickers = Object.values(profiles)
    .map(finalProfile)
    .sort((a, b) => profileScore(b) - profileScore(a) || a.ticker.localeCompare(b.ticker))
    .slice(0, limit);

  return {
    generated_at: now.toISOString(),
    window_days: windowDays,
    tickers,
    ready_for_backtest: tickers.filter(ticker => ticker.status === 'shadow_ready').map(ticker => ticker.ticker),
    policy: 'Shadow evidence only. Backtesting/scoring stays in the separate backtesting lane.',
  };
}

function buildKatEquityOptionsProfile(ticker, options = {}) {
  const normalized = normalizeTicker(ticker);
  const universe = buildKatEquityOptionsUniverse({ ...options, limit: options.limit || 200 });
  return universe.tickers.find(profile => profile.ticker === normalized) || {
    ticker: normalized,
    status: 'not_seen',
    asset_scope: null,
    mentions: 0,
    parsed_signals: 0,
    equity_mentions: 0,
    option_mentions: 0,
    image_posts: 0,
    analysts: [],
    analyst_count: 0,
    channels: [],
    dominant_bias: 'NEUTRAL',
    dominant_option_side: null,
    option_contracts: [],
    levels: [],
    latest_ts: null,
    latest_snippet: null,
    policy: 'equity/options shadow input only; not SPX-equivalent and not execution authority',
    next_step: 'No repeated Kat evidence found yet.',
  };
}

function formatKatEquityOptionsForDiscord(profile) {
  if (!profile || profile.status === 'not_seen') {
    return 'No equity/options shadow profile found for that ticker yet.';
  }
  const lines = [
    '**Kat equity/options shadow profile: ' + profile.ticker + '**',
    'Status: ' + profile.status + ' | scope: ' + profile.asset_scope,
    'Evidence: ' + profile.mentions + ' mention(s), ' + profile.parsed_signals + ' parsed signal(s), ' + profile.analyst_count + ' analyst(s)',
    'Options: ' + profile.option_mentions + ' mention(s)' + (profile.dominant_option_side ? ' | dominant side: ' + profile.dominant_option_side : ''),
    'Bias: ' + profile.dominant_bias + (profile.levels.length ? ' | levels: ' + profile.levels.slice(0, 5).join(', ') : ''),
    profile.latest_snippet ? 'Latest: ' + profile.latest_snippet : '',
    '_Shadow evidence only. No execution authority._',
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  extractOptionContext,
  classifyAssetClass,
  buildKatEquityOptionsUniverse,
  buildKatEquityOptionsProfile,
  formatKatEquityOptionsForDiscord,
  _internal: {
    normalizeSide,
    inferOptionSide,
    inferStrike,
    finalProfile,
  },
};
