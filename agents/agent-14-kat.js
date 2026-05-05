'use strict';
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const router   = express.Router();

//  Paths 
const KAT_DIR       = path.join(__dirname, '../data/kat');
const RAW_FEED      = path.join(KAT_DIR, 'raw-feed.jsonl');
const PROCESSED     = path.join(KAT_DIR, 'processed-signals.jsonl');
const ACTIVITY      = path.join(KAT_DIR, 'activity.json');
const CONFIG_FILE   = path.join(KAT_DIR, 'monitored-users.json');
const SYNTHESIS     = path.join(KAT_DIR, 'synthesis-report.json');

//  Helpers 
function ensureDir() {
  if (!fs.existsSync(KAT_DIR)) fs.mkdirSync(KAT_DIR, { recursive: true });
}

function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) return {
    enabled: false, monitored_users: [], monitored_channels: [], monitored_channel_ids: [],
    synthesis_schedule: 'EOD', vision_enabled: true, heatmap_detection: true,
    discord_responses_enabled: false, discord_posts_enabled: false
  };
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (e) { console.error('[kat] config parse error:', e.message); return { enabled: false, monitored_users: [], monitored_channels: [] }; }
}

function saveConfig(cfg) {
  ensureDir();
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}

function appendRawFeed(entry) {
  ensureDir();
  fs.appendFileSync(RAW_FEED, JSON.stringify(entry) + '\n', 'utf8');
}

function updateActivity(username) {
  ensureDir();
  let activity = {};
  if (fs.existsSync(ACTIVITY)) {
    try { activity = JSON.parse(fs.readFileSync(ACTIVITY, 'utf8')); } catch (e) {}
  }
  activity[username] = new Date().toISOString();
  const tmp = ACTIVITY + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(activity, null, 2), 'utf8');
  fs.renameSync(tmp, ACTIVITY);
}

function isMonitoredUser(userId, config) {
  return (config.monitored_users || []).some(u => u.discord_id === userId);
}

function isMonitoredChannel(channelId, channelName, config) {
  const ids   = config.monitored_channel_ids || [];
  const names = config.monitored_channels    || [];
  return ids.includes(channelId) || names.includes(channelName);
}

function rawFeedCount() {
  if (!fs.existsSync(RAW_FEED)) return 0;
  try {
    return fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim()).length;
  } catch (e) { return 0; }
}

function lastCapture() {
  if (!fs.existsSync(RAW_FEED)) return null;
  try {
    const lines = fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim());
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]).ts;
  } catch (e) { return null; }
}

function resolveAttachmentMediaType(att, buffer) {
  const declared = ((att && att.content_type) || '').split(';')[0].toLowerCase();
  const filename = ((att && att.filename) || '').toLowerCase();
  if (buffer && buffer.length >= 12) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  }
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (declared.startsWith('image/')) return declared;
  return 'image/png';
}

function normalizeKatTicker(ticker) {
  const raw = (ticker || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (['ESF', 'ES', 'MES', 'SPX', 'SPXW'].includes(raw)) return raw.startsWith('SPX') ? 'SPX' : raw.startsWith('MES') ? 'MES' : 'ES';
  if (['NQF', 'NQ', 'MNQ', 'NDX', 'QQQ'].includes(raw)) return raw === 'QQQ' ? 'QQQ' : raw === 'NDX' ? 'NDX' : raw.startsWith('MNQ') ? 'MNQ' : 'NQ';
  if (raw === 'SPY') return 'SPY';
  return raw || null;
}

function tickerMatches(targetTicker, candidateTicker) {
  const target = normalizeKatTicker(targetTicker);
  const candidate = normalizeKatTicker(candidateTicker);
  if (!target || !candidate) return false;
  if (target === candidate) return true;
  const aliasSets = [
    new Set(['SPX', 'ES', 'MES', 'SPXW']),
    new Set(['QQQ', 'NQ', 'MNQ', 'NDX']),
  ];
  return aliasSets.some(set => set.has(target) && set.has(candidate));
}

function loadRawFeedMap() {
  const map = new Map();
  if (!fs.existsSync(RAW_FEED)) return map;
  const lines = fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry && entry.message_id) map.set(entry.message_id, entry);
    } catch (e) {}
  }
  return map;
}

function getRecentImagePostsForSignals(signals, limit) {
  const rawMap = loadRawFeedMap();
  const posts = [];
  const seen = new Set();
  for (const sig of [...signals].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))) {
    const entry = rawMap.get(sig.message_id);
    const att = entry && Array.isArray(entry.attachments) ? entry.attachments.find(a => a && a.url) : null;
    if (!entry || !att || seen.has(entry.message_id)) continue;
    seen.add(entry.message_id);
    posts.push({ username: entry.username, ticker: sig.ticker || null, url: att.url, filename: att.filename || 'chart.png' });
    if (posts.length >= (limit || 2)) break;
  }
  return posts;
}

function isKatImageAttachment(att) {
  if (!att) return false;
  const type = String(att.content_type || att.contentType || '').toLowerCase();
  const filename = String(att.filename || att.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function katImageAttachments(entry) {
  return Array.isArray(entry && entry.attachments)
    ? entry.attachments.filter(isKatImageAttachment)
    : [];
}

const KAT_PUBLIC_INDEX_TICKERS = new Set(['SPX', 'SPY', 'ES', 'MES']);
const KAT_NON_EQUITY_TICKERS = new Set([
  'SPX', 'SPY', 'SPXW', 'ES', 'MES', 'QQQ', 'NQ', 'MNQ', 'NDX', 'VIX', 'DXY',
  'BTC', 'ETH', 'USD'
]);
const KAT_DISCORD_CONTENT_LIMIT = 1900;
const KAT_COMMAND_COOLDOWN_MS = 10 * 1000;
const KAT_OWNER_ONLY_SUBCOMMANDS = new Set(['status', 'summary', 'watchlist', 'tickers', 'options', 'option']);
const _lastKatCommand = {};

function publicKatTicker(ticker) {
  const normalized = normalizeKatTicker(ticker);
  if (!normalized) return null;
  if (KAT_PUBLIC_INDEX_TICKERS.has(normalized)) return 'SPX';
  if (/^[A-Z]{1,5}$/.test(normalized) && !KAT_NON_EQUITY_TICKERS.has(normalized)) return normalized;
  return null;
}

function katEntryTextMatchesTicker(entry, ticker) {
  const normalized = publicKatTicker(ticker);
  if (!normalized) return false;
  const content = String(entry && entry.content || '').toUpperCase();
  if (normalized === 'SPX') {
    return /\b(SPX|SPY|ES_F|#ES_F|ESM|ES1|SPXW)\b|\$SPX|\$SPY/i.test(content);
  }
  return new RegExp('(^|[^A-Z0-9])\\$?' + normalized + '([^A-Z0-9]|$)', 'i').test(content);
}

function compactKatText(value, maxLen) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'image-only post';
  const limit = maxLen || 160;
  return text.length > limit ? text.slice(0, limit - 1) + '...' : text;
}

function formatKatEt(ts) {
  const date = new Date(ts || 0);
  if (!Number.isFinite(date.getTime())) return 'unknown time';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) + ' ET';
}

function katDiscordMessageLink(entry) {
  if (!entry || !entry.guild_id || !entry.channel_id || !entry.message_id) return null;
  return 'https://discord.com/channels/' + entry.guild_id + '/' + entry.channel_id + '/' + entry.message_id;
}

function findKatChartEvidence(ticker, limit) {
  const canonical = publicKatTicker(ticker);
  if (!canonical || !fs.existsSync(RAW_FEED)) return [];
  const lines = fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim());
  const seen = new Set();
  const rows = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const images = katImageAttachments(entry);
      if (!images.length) continue;
      if (!katEntryTextMatchesTicker(entry, canonical)) continue;
      if (seen.has(entry.message_id)) continue;
      seen.add(entry.message_id);
      rows.push({ entry, images });
    } catch (e) {}
  }
  return rows
    .sort((a, b) => new Date(b.entry.ts || 0) - new Date(a.entry.ts || 0))
    .slice(0, limit || 3);
}

function katEvidenceLines(evidence) {
  if (!evidence || !evidence.length) return [];
  return evidence.map((item, index) => {
    const entry = item.entry;
    const link = katDiscordMessageLink(entry);
    const imageNames = (item.images || [])
      .map(image => image.filename || 'chart image')
      .slice(0, 3)
      .join(', ');
    return (index + 1) + '. ' +
      (entry.username || 'unknown') + ' - ' +
      formatKatEt(entry.ts) + ' - ' +
      (entry.channel_name || 'unknown channel') +
      (link ? ' - ' + link : '') + '\n' +
      '   "' + compactKatText(entry.content, 150) + '"\n' +
      '   image: attached below' + (imageNames ? ' (' + imageNames + ')' : '');
  });
}

function katEvidenceFiles(evidence, limit) {
  const files = [];
  for (const item of evidence || []) {
    for (const image of item.images || []) {
      if (!image.url) continue;
      files.push({
        attachment: image.url,
        name: image.filename || 'kat-chart.png'
      });
      if (files.length >= (limit || 4)) return files;
    }
  }
  return files;
}

function trimKatDiscordContent(content) {
  const text = String(content || '');
  if (text.length <= KAT_DISCORD_CONTENT_LIMIT) return text;
  return text.slice(0, KAT_DISCORD_CONTENT_LIMIT - 47).trimEnd() +
    '\n...trimmed. Open source message links above.';
}

function buildKatEvidencePayload(content, evidence, fileLimit) {
  return {
    content: trimKatDiscordContent(content),
    files: katEvidenceFiles(evidence, fileLimit || 4)
  };
}

function katCommandCooldownKey(message) {
  return [
    message && message.guildId ? message.guildId : 'dm',
    message && message.channelId ? message.channelId : 'unknown-channel',
    message && message.author && message.author.id ? message.author.id : 'unknown-user'
  ].join(':');
}

function katCommandCooldownRemaining(message, cooldownMs, nowMs) {
  const key = katCommandCooldownKey(message);
  const last = _lastKatCommand[key] || 0;
  if (!last) return 0;
  return Math.max(0, last + cooldownMs - nowMs);
}

function recordKatCommandCooldown(message, nowMs) {
  _lastKatCommand[katCommandCooldownKey(message)] = nowMs;
}

function resetKatCommandCooldownsForTest() {
  for (const key of Object.keys(_lastKatCommand)) delete _lastKatCommand[key];
}

function isKatOwnerCommandAllowed(message, config) {
  const allowed = new Set([
    ...(config.owner_user_ids || []),
    ...(config.admin_user_ids || []),
  ].map(String));
  const userId = message && message.author && message.author.id ? String(message.author.id) : '';
  return !!userId && allowed.has(userId);
}

function getKatOwnerOnlyMessage() {
  return [
    'That Kat command is owner-only during Phase 1.',
    'Public commands are: `!kat`, `!kat levels SPX`, `!kat bias`, `!kat heatmap SPX`, `!kat recent SPX`, and `!kat equity TICKER`.',
    '_Phase 1 only replies with sourced analyst evidence. No internal status, watchlist, options profile, or Luke-side data is exposed._'
  ].join('\n');
}

function getChartEvidencePayload(ticker) {
  const canonical = publicKatTicker(ticker);
  if (!canonical) {
    return {
      content: 'Kat is currently limited to SPX context and equity tickers with attached analyst charts.'
    };
  }

  const evidence = findKatChartEvidence(canonical, 4);
  if (!evidence.length) {
    return {
      content: 'No chart-backed analyst posts found for ' + canonical + '.\n' +
        '_Kat will not infer equity context without an attached analyst chart._'
    };
  }

  return buildKatEvidencePayload(
    ' **' + canonical + ' chart-backed analyst posts**\n' +
      katEvidenceLines(evidence).join('\n') + '\n' +
      '_Images are attached below from captured analyst posts. No prediction - source evidence only._',
    evidence,
    4
  );
}

function isIndexChannelName(channelName) {
  return /\b(spy|qqq|spx|ndx|es|nq|vix|breakdowns?|trade-floor)\b/i.test(channelName || '');
}

function buildKatSignalPayload(entry, signal) {
  const { classifyIndexTicker, extractIndexTickers } = require('../lib/kat-index-scope');
  const textTickers = extractIndexTickers(entry.content || '');
  const scope = classifyIndexTicker(signal && signal.ticker);
  const fallbackScope = textTickers.length ? classifyIndexTicker(textTickers[0]) : null;
  const finalScope = scope.ticker ? scope : fallbackScope;
  if (!finalScope || !finalScope.ticker) return null;

  return {
    type: 'kat_signal',
    source: 'katbot-discord',
    analyst: entry.username,
    user_id: entry.user_id || null,
    channel: entry.channel_name,
    channel_id: entry.channel_id || null,
    message_id: entry.message_id,
    ts: entry.ts,
    ticker: finalScope.ticker,
    original_ticker: signal?.ticker || finalScope.ticker,
    lane: finalScope.lane,
    family: finalScope.family,
    spx_options_direct: finalScope.spx_options_direct,
    qqq_market_context: finalScope.qqq_market_context,
    signal_type: signal?.signal_type || 'INDEX_CONTEXT',
    bias: signal?.bias || 'NEUTRAL',
    timeframe: signal?.timeframe || null,
    pattern: signal?.pattern || null,
    levels: Array.isArray(signal?.levels) ? signal.levels : [],
    has_image: Array.isArray(entry.attachments) && entry.attachments.length > 0,
    image_evidence: Array.isArray(entry.attachments) && entry.attachments.length > 0
      ? entry.attachments.map(att => ({
        id: att.id || null,
        filename: att.filename || null,
        content_type: att.content_type || null,
        url: att.url || null
      }))
      : [],
    raw_text: entry.content || '',
    provenance: {
      server: 'Elevated Charts',
      channel: entry.channel_name,
      analyst: entry.username,
      message_id: entry.message_id,
      captured_at: new Date().toISOString()
    },
    human_gate_required: true
  };
}

function buildKatChartPendingPayload(entry) {
  if (!Array.isArray(entry.attachments) || entry.attachments.length === 0) return null;
  const { extractIndexTickers, classifyIndexTicker } = require('../lib/kat-index-scope');
  const textTickers = extractIndexTickers(entry.content || '');
  let scope = textTickers.length ? classifyIndexTicker(textTickers[0]) : null;
  if ((!scope || !scope.ticker) && isIndexChannelName(entry.channel_name)) {
    scope = {
      ticker: null,
      lane: 'index_chart_pending',
      family: 'index',
      spx_options_direct: false,
      qqq_market_context: false
    };
  }
  if (!scope) return null;

  return {
    type: 'kat_chart_pending',
    source: 'katbot-discord',
    analyst: entry.username,
    user_id: entry.user_id || null,
    channel: entry.channel_name,
    channel_id: entry.channel_id || null,
    message_id: entry.message_id,
    ts: entry.ts,
    ticker: scope.ticker,
    lane: scope.lane,
    family: scope.family,
    spx_options_direct: !!scope.spx_options_direct,
    qqq_market_context: !!scope.qqq_market_context,
    signal_type: 'CHART_PENDING_VISION',
    bias: 'NEUTRAL',
    levels: [],
    has_image: true,
    image_evidence: entry.attachments.map(att => ({
      id: att.id || null,
      filename: att.filename || null,
      content_type: att.content_type || null,
      url: att.url || null
    })),
    raw_text: entry.content || '',
    provenance: {
      server: 'Elevated Charts',
      channel: entry.channel_name,
      analyst: entry.username,
      message_id: entry.message_id,
      captured_at: new Date().toISOString()
    },
    note: 'Chart/image received from monitored analyst; waiting for vision or text parse before treating as levels.',
    human_gate_required: true
  };
}

function buildKatWatchlistPayload(entry, signal) {
  if (!signal || !signal.ticker) return null;
  const { isWatchlistTicker } = require('../lib/kat-ticker-watchlist');
  const { classifyAssetClass } = require('../lib/kat-equity-options');
  const ticker = normalizeKatTicker(signal.ticker);
  if (!isWatchlistTicker(ticker)) return null;
  const assetContext = classifyAssetClass(entry.content || signal.raw || '', ticker);

  return {
    type: 'kat_watchlist_signal',
    source: 'katbot-discord',
    analyst: entry.username,
    user_id: entry.user_id || null,
    channel: entry.channel_name,
    channel_id: entry.channel_id || null,
    message_id: entry.message_id,
    ts: entry.ts,
    ticker,
    asset_class: assetContext ? assetContext.asset_class : 'equity',
    option_context: assetContext && assetContext.asset_class === 'option' ? assetContext : null,
    equity_context: assetContext && assetContext.asset_class === 'equity' ? assetContext : null,
    signal_type: signal.signal_type || 'WATCHLIST_CONTEXT',
    bias: signal.bias || 'NEUTRAL',
    timeframe: signal.timeframe || null,
    pattern: signal.pattern || null,
    levels: Array.isArray(signal.levels) ? signal.levels : [],
    has_image: Array.isArray(entry.attachments) && entry.attachments.length > 0,
    image_evidence: Array.isArray(entry.attachments) && entry.attachments.length > 0
      ? entry.attachments.map(att => ({
        id: att.id || null,
        filename: att.filename || null,
        content_type: att.content_type || null,
        url: att.url || null
      }))
      : [],
    raw_text: entry.content || '',
    provenance: {
      server: 'Elevated Charts',
      channel: entry.channel_name,
      analyst: entry.username,
      message_id: entry.message_id,
      captured_at: new Date().toISOString()
    },
    policy: 'equity/options shadow-watch only; not SPX-equivalent and not execution authority',
    human_gate_required: true
  };
}

function broadcastKatCapture(entry, signal) {
  if (typeof global.broadcast !== 'function') return false;
  const payload = signal
    ? (buildKatSignalPayload(entry, signal) || buildKatWatchlistPayload(entry, signal))
    : buildKatChartPendingPayload(entry);
  if (!payload) return false;
  global.broadcast(payload);
  return true;
}

const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false });
const KAT_QUEUE_SUBCOMMANDS = new Set(['queue', 'watch', 'track', 'monitor', 'add']);

function envFlagEnabled(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ''));
}

function discordOutputAllowed(kind, config) {
  const cfg = config || loadConfig();
  if (envFlagEnabled('KATBOT_ALLOW_DISCORD_OUTPUT')) return true;
  if (kind === 'reply') return cfg.discord_responses_enabled === true;
  if (kind === 'post') return cfg.discord_posts_enabled === true;
  return false;
}

function withSafeAllowedMentions(payload) {
  if (typeof payload === 'string') {
    return { content: payload, allowedMentions: SAFE_ALLOWED_MENTIONS };
  }
  return {
    ...(payload || {}),
    allowedMentions: SAFE_ALLOWED_MENTIONS,
  };
}

async function safeReply(message, payload) {
  const safePayload = withSafeAllowedMentions(payload);
  if (!discordOutputAllowed('reply')) {
    const { recordKatOutputBin } = require('../lib/kat-message-bin');
    recordKatOutputBin({
      kind: 'discord_reply_suppressed',
      reason: 'discord_output_gate',
      target: {
        channel_id: message.channelId || null,
        channel_name: message.channel && message.channel.name ? message.channel.name : null,
        source_message_id: message.id || null,
        author: message.author && message.author.username ? message.author.username : null,
      },
      payload: safePayload,
    });
    console.log('[kat] Discord reply suppressed by output gate');
    return null;
  }
  try {
    return await message.reply(safePayload);
  } catch (e) {
    if (safePayload && Array.isArray(safePayload.files) && safePayload.files.length) {
      console.error('[kat] Discord reply with image files failed:', e.message);
      const fallbackPayload = withSafeAllowedMentions({
        ...safePayload,
        files: [],
        content: trimKatDiscordContent(
          (safePayload.content || '') +
          '\n\n_Image attachment failed; use the source message links above._'
        )
      });
      return message.reply(fallbackPayload);
    }
    throw e;
  }
}

async function safeSend(channel, payload) {
  const safePayload = withSafeAllowedMentions(payload);
  if (!discordOutputAllowed('post')) {
    const { recordKatOutputBin } = require('../lib/kat-message-bin');
    recordKatOutputBin({
      kind: 'discord_channel_post_suppressed',
      reason: 'discord_output_gate',
      target: {
        channel_id: channel && channel.id ? channel.id : null,
        channel_name: channel && channel.name ? channel.name : null,
      },
      payload: safePayload,
    });
    console.log('[kat] Discord channel post suppressed by output gate');
    return null;
  }
  try {
    return await channel.send(safePayload);
  } catch (e) {
    if (safePayload && Array.isArray(safePayload.files) && safePayload.files.length) {
      console.error('[kat] Discord channel post with image files failed:', e.message);
      const fallbackPayload = withSafeAllowedMentions({
        ...safePayload,
        files: [],
        content: trimKatDiscordContent(
          (safePayload.content || '') +
          '\n\n_Image attachment failed; use the source message links above._'
        )
      });
      return channel.send(fallbackPayload);
    }
    throw e;
  }
}

function mentionsKatbot(message) {
  const botUser = discordClient && discordClient.user;
  if (!botUser) return false;
  if (message.mentions && message.mentions.users && message.mentions.users.has(botUser.id)) return true;
  const content = message.content || '';
  return content.includes('@' + botUser.username) || content.includes('@' + botUser.tag);
}

function getKatWelcomeMessage() {
  return [
    "Hey everyone. I'm Kat.",
    '',
    'I read analyst posts from monitored channels and surface patterns nobody has time to track manually - specifically SPX level confluence and chart-backed equity posts from analysts.',
    '',
    'How to use me:',
    '`!kat levels SPX` - top analyst-marked levels this week. Requires 2+ analysts or 3+ independent mentions to qualify. No guesses.',
    '`!kat bias` - SPX directional bias across monitored analysts, last 18 hours.',
    '`!kat heatmap SPX` - most recent heatmap image for that ticker with timestamp. Staleness warning if over 4 hours old.',
    '`!kat recent SPX` - latest chart-backed analyst posts for SPX/ES/SPY.',
    '`!kat equity UPS` - latest chart-backed analyst posts for that equity ticker. Images are attached when available.',
    '`!kat` - shows this list.',
    '',
    "What I don't do: predict, generate opinions, or make anything up. Everything I post is sourced from captured analyst posts with timestamps and image evidence attached where available.",
    '',
    'Level Magnet alerts run during market hours when 2+ analysts independently mark the same SPX level within 48 hours. Equity alerts stay chart-backed.',
    '',
    'Owner/debug commands are blocked from public Phase 1 replies unless an owner user id is configured.',
    'Luke bridge: source, analyst, channel, message id, ticker lane, bias, levels, and image evidence stay attached.',
    '_Human-gated confluence only. No autonomous execution._'
  ].join('\n');
}

//  Discord bot 
let discordClient = null;

if (process.env.KAT_BOT_TOKEN) {
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    discordClient.on('clientReady', () => {
      console.log('[kat] Bot online as ' + discordClient.user.tag);
      runBackfill(discordClient);
      startKatPoll();
    });

    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      const config = loadConfig();
      if (!config.enabled) return;

      // !kat command  any user, in command_channels
      if (message.content.trim().startsWith('!kat')) {
        const cmdChannels = config.command_channels || [];
        if (cmdChannels.includes(message.channelId) || cmdChannels.includes(message.channel.name)) {
          const cooldownMs = Number.isFinite(Number(config.command_cooldown_ms))
            ? Math.max(0, Number(config.command_cooldown_ms))
            : KAT_COMMAND_COOLDOWN_MS;
          const nowMs = Date.now();
          const remainingMs = katCommandCooldownRemaining(message, cooldownMs, nowMs);
          if (remainingMs > 0) {
            console.log('[kat] Command cooldown suppressing duplicate request for ' + Math.ceil(remainingMs / 1000) + 's');
            return;
          }
          recordKatCommandCooldown(message, nowMs);
          await handleKatCommand(message);
          return;
        }
      }

      if (!isMonitoredUser(message.author.id, config)) return;
      if (!isMonitoredChannel(message.channelId, message.channel.name, config)) return;

      const entry = {
        ts:           message.createdAt.toISOString(),
        message_id:   message.id,
        guild_id:     message.guildId,
        channel_id:   message.channelId,
        channel_name: message.channel.name,
        user_id:      message.author.id,
        username:     message.author.username,
        content:      message.content,
        attachments:  message.attachments.map(a => ({
          id:           a.id,
          url:          a.url,
          filename:     a.name || a.filename || 'image.png',
          content_type: a.contentType || 'unknown'
        }))
      };

      appendRawFeed(entry);
      updateActivity(message.author.username);
      console.log('[kat] Captured: ' + message.author.username + ' in #' + message.channel.name + '  ' + entry.content.slice(0, 60));

      const { parseKatSignal } = require('../lib/parse-kat');
      const hasAttachments = entry.attachments.length > 0;
      const signal = parseKatSignal(entry.username, entry.content, hasAttachments);
      if (signal) {
        signal.ts         = entry.ts;
        signal.message_id = entry.message_id;
        signal.channel    = entry.channel_name;
        signal.user_id    = entry.user_id;
        try {
          fs.appendFileSync(PROCESSED, JSON.stringify(signal) + '\n', 'utf8');
        } catch (e) {
          console.error('[kat] processed write error:', e.message);
        }
        broadcastKatCapture(entry, signal);
        console.log('[kat] Signal: ' + signal.signal_type + ' | ' + signal.analyst + ' | ' + (signal.ticker||'no ticker') + ' | ' + signal.bias);
      } else if (hasAttachments) {
        broadcastKatCapture(entry, null);
      }

      // Real-time vision  fires on new live captures with images
      // Market hours only. Fire-and-forget. Enriches active session.
      if (hasAttachments && entry.attachments.some(att => att && att.url) && config.vision_enabled !== false) {
        const { isMarketOpen } = require('../lib/market-hours');
        if (isMarketOpen().open) {
          setImmediate(() => processLiveVision(entry, signal));
        }
      }
    });

    discordClient.on('messageUpdate', async (oldMessage, newMessage) => {
      try {
        if (!newMessage.author || newMessage.author.bot) return;
        const config = loadConfig();
        if (!config.enabled) return;
        if (!isMonitoredUser(newMessage.author.id, config)) return;

        const channelIds = new Set(config.monitored_channel_ids || []);
        const channelNames = new Set(config.monitored_channels || []);
        const inTargetChannel = channelIds.has(newMessage.channelId) ||
                                channelNames.has(newMessage.channel?.name);
        if (!inTargetChannel) return;

        // Only process if content actually changed and is now non-empty
        if (!newMessage.content && newMessage.attachments.size === 0) return;
        if (oldMessage.content === newMessage.content &&
            oldMessage.attachments.size === newMessage.attachments.size) return;

        const entry = {
          ts:           newMessage.editedAt?.toISOString() || new Date().toISOString(),
          message_id:   newMessage.id + '_edited',
          guild_id:     newMessage.guildId,
          channel_id:   newMessage.channelId,
          channel_name: newMessage.channel?.name || 'unknown',
          user_id:      newMessage.author.id,
          username:     newMessage.author.username,
          content:      newMessage.content,
          attachments:  [...newMessage.attachments.values()].map(a => ({
            id:           a.id,
            url:          a.url,
            filename:     a.name || a.filename || 'image.png',
            content_type: a.contentType || 'unknown'
          })),
          edited:       true
        };

        appendRawFeed(entry);
        updateActivity(newMessage.author.username);

        // Parse immediately
        const { parseKatSignal } = require('../lib/parse-kat');
        const hasImg = entry.attachments.length > 0;
        const signal = parseKatSignal(entry.username, entry.content, hasImg);
        if (signal) {
          signal.ts         = entry.ts;
          signal.message_id = entry.message_id;
          signal.channel    = entry.channel_name;
          signal.user_id    = entry.user_id;
          fs.appendFileSync(PROCESSED, JSON.stringify(signal) + '\n', 'utf8');
          broadcastKatCapture(entry, signal);
          console.log('[kat] Edit signal: ' + signal.signal_type + ' | ' + signal.analyst + ' | ' + (signal.ticker||'?') + ' | ' + signal.bias);
        } else {
          if (hasImg) broadcastKatCapture(entry, null);
          console.log('[kat] Edit captured (no signal): ' + entry.username + '  ' + entry.content.slice(0,60));
        }
        if (hasImg && entry.attachments.some(att => att && att.url) && config.vision_enabled !== false) {
          const { isMarketOpen } = require('../lib/market-hours');
          if (isMarketOpen().open) {
            setImmediate(() => processLiveVision(entry, signal));
          }
        }
      } catch (e) {
        console.error('[kat] messageUpdate error:', e.message);
      }
    });

    discordClient.on('error', (err) => {
      console.error('[kat] Discord client error:', err.message);
    });

    discordClient.login(process.env.KAT_BOT_TOKEN).catch(err => {
      console.error('[kat] Login failed:', err.message);
    });

  } catch (e) {
    console.error('[kat] discord.js load error:', e.message);
  }
} else {
  console.log('[kat] KAT_BOT_TOKEN not set  bot offline, ready to deploy');
}

//  Real-time vision on live captures 

async function processLiveVision(entry, parsedSignal) {
  try {
    const Anthropic  = require('@anthropic-ai/sdk');
    const https      = require('https');
    const { buildHeatseekerReferencePrompt } = require('../lib/heatseeker-reference');
    const {
      appendKatVisionRecord,
      buildKatVisionRecord,
      isImageAttachment,
    } = require('../lib/kat-vision-store');
    const attachments = Array.isArray(entry.attachments)
      ? entry.attachments.filter(att => att && att.url && isImageAttachment(att))
      : [];
    if (!attachments.length) return;

    const client = new Anthropic();
    const heatseekerReference = buildHeatseekerReferencePrompt();

    for (let attachmentIndex = 0; attachmentIndex < attachments.length; attachmentIndex++) {
      const att = attachments[attachmentIndex];

      const imageBuffer = await new Promise((resolve, reject) => {
        const req = https.get(att.url, (res) => {
          if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const mediaType = resolveAttachmentMediaType(att, imageBuffer);
      const base64 = imageBuffer.toString('base64');
      const model = 'claude-sonnet-4-6';

      const response = await client.messages.create({
        model,
        max_tokens: 500,
        system: 'You are analyzing a financial chart or heatmap image posted by a trader. ' +
                'Extract key price levels and directional bias. ' +
                'For heatmap images, apply the Heatseeker node reference below. Treat it as confluence only, not a trade trigger. ' +
                'For candlestick or technical chart images, extract only visible levels, patterns, and directional context shown in the image. ' +
                '\n\nHEATSEEKER NODE REFERENCE:\n' + heatseekerReference + '\n\n' +
                'Return ONLY valid JSON: ' +
                '{"chart_type":"candlestick"|"heatmap"|"technical"|"unknown",' +
                '"ticker":string|null,"key_levels":[numbers],' +
                '"support_levels":[numbers],"resistance_levels":[numbers],' +
                '"heatmap_context":{"king_nodes":[numbers],"gatekeeper_nodes":[numbers],"air_pockets":[numbers],"node_read":string|null},' +
                '"bias":"BULLISH"|"BEARISH"|"NEUTRAL","patterns":[strings],' +
                '"notes":string}. ' +
                'Return empty arrays if not identifiable. No markdown.',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64',
              media_type: mediaType,
              data: base64 } },
            { type: 'text',
              text: 'Analyst: ' + entry.username +
                    '\nChannel: #' + entry.channel_name +
                    '\nPosted text: ' + (entry.content || '') }
          ]
        }]
      });

      const rawText = response.content[0]?.text || '';
      let vision = null;
      try {
        vision = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.error('[kat-vision] parse error:', rawText.slice(0, 80));
        continue;
      }

      if (!vision) continue;

      const record = buildKatVisionRecord({
        entry,
        attachment: att,
        attachmentIndex,
        parsedSignal,
        vision,
        rawModelText: rawText,
        model,
      });
      const stored = appendKatVisionRecord(record);

      console.log('[kat-vision] Live:', entry.username,
        '', record.chart_type, '| bias:', record.bias,
        '| levels:', record.levels.length, '| stored:', record.vision_id);

      if (typeof global.broadcast === 'function') {
        global.broadcast({
          type: 'kat_vision',
          source: record.source,
          source_class: record.source_class,
          parse_status: record.parse_status,
          vision_id: record.vision_id,
          analyst: record.analyst,
          ticker: record.ticker,
          bias: record.bias,
          levels: record.levels,
          entry_context: stored.processed ? stored.processed.entry_context : null,
          chart_type: record.chart_type,
          heatmap_context: vision.heatmap_context || null,
          notes: record.notes,
          ts: record.ts,
          message_id: record.message_id,
          attachment_id: record.attachment_id,
          channel: record.channel,
          image_evidence: [record.attachment],
          provenance: record.provenance,
          processed_signal: stored.processed,
          human_gate_required: true
        });
        console.log('[kat-vision] Broadcast to Luke:', record.levels.length, 'levels from', entry.username);
      }
    }

  } catch (e) {
    console.error('[kat-vision] processLiveVision error:', e.message);
  }
}

//  Proactive confluence alerting 
const ALERT_POLL_MS       = 5 * 60 * 1000;   // check every 5 minutes
const ALERT_WINDOW_MS     = 20 * 60 * 1000;  // signals within 20 minutes
const ALERT_MIN_ANALYSTS  = 2;               // minimum distinct analysts
const ALERT_COOLDOWN_MS   = 15 * 60 * 1000; // don't re-alert same instrument for 15 min

const _lastKatAlert = {};  // { instrument: timestamp }  dedup map

function checkKatConfluence() {
  try {
    // Gate: market hours only
    const { isMarketOpen } = require('../lib/market-hours');
    const marketStatus = isMarketOpen();
    if (!marketStatus.open) return;

    // Gate: no active trade (don't interrupt an open position)
    const activeTradeFile = path.join(__dirname, '../data/active-trade.json');
    if (fs.existsSync(activeTradeFile)) {
      try {
        const activeTrade = JSON.parse(fs.readFileSync(activeTradeFile, 'utf8'));
        if (activeTrade.status === 'open' && !activeTrade.runner) return;
      } catch (e) {}
    }

    const { getRecentKatSignals } = require('../lib/kat-confluence');
    const { levelContextForKatInstrument, formatLevelContextLine } = require('../lib/kat-level-context');
    const instruments = ['SPX', 'SPY_QQQ', 'ES_NQ'];

    for (const instrument of instruments) {
      // Cooldown check
      const lastAlert = _lastKatAlert[instrument] || 0;
      if (Date.now() - lastAlert < ALERT_COOLDOWN_MS) continue;

      const signals = getRecentKatSignals(instrument, ALERT_WINDOW_MS);
      if (signals.length < 2) continue;

      // Count distinct analysts per bias
      const bullSignals = signals.filter(s => s.bias === 'BULLISH');
      const bearSignals = signals.filter(s => s.bias === 'BEARISH');
      const bullAnalysts = new Set(bullSignals.map(s => s.analyst));
      const bearAnalysts = new Set(bearSignals.map(s => s.analyst));

      let dominantBias = null;
      let dominantAnalysts = null;

      if (bullAnalysts.size >= ALERT_MIN_ANALYSTS) {
        dominantBias     = 'BULLISH';
        dominantAnalysts = [...bullAnalysts];
      } else if (bearAnalysts.size >= ALERT_MIN_ANALYSTS) {
        dominantBias     = 'BEARISH';
        dominantAnalysts = [...bearAnalysts];
      }

      if (!dominantBias) continue;

      const levelContext = levelContextForKatInstrument(instrument);
      if (!levelContext.ready) continue;

      // Build alert message
      const dominantSignals = dominantBias === 'BULLISH' ? bullSignals : bearSignals;
      const withImages = dominantSignals.filter(s => s.has_image);
      const tickerCounts = {};
      for (const sig of dominantSignals) {
        const key = normalizeKatTicker(sig.ticker) || 'UNKNOWN';
        tickerCounts[key] = (tickerCounts[key] || 0) + 1;
      }
      const topTickers = Object.entries(tickerCounts)
        .filter(([ticker]) => ticker !== 'UNKNOWN')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([ticker, count]) => ticker + ' (' + count + ')')
        .join(', ');
      const recentImages = getRecentImagePostsForSignals(withImages, 2);
      const biasTag = dominantBias === 'BULLISH' ? 'BULL' : 'BEAR';
      const lines      = [
        biasTag + ' KAT ALERT - ' + instrument + ' confluence brewing',
        '- ' + dominantAnalysts.length + ' analysts ' + dominantBias.toLowerCase() + ': ' + dominantAnalysts.join(', '),
        topTickers ? '- Tickers: ' + topTickers : '',
        formatLevelContextLine(levelContext),
        withImages.length > 0 ? '- ' + withImages.length + ' chart(s) posted' : '',
        ...recentImages.map(img => '- Chart: ' + img.username + ' ' + (img.ticker || 'chart') + ' ' + img.url),
        '- No Ximes signal yet - watch for entry call',
        '- Run /entries ES or /verdict for Luke view'
      ].filter(Boolean).join('\n');

      // Broadcast to Luke chat via global WS
      if (typeof global.broadcast === 'function') {
        global.broadcast({
          type: 'kat_confluence',
          source: 'katbot-discord',
          instrument,
          bias: dominantBias,
          analysts: dominantAnalysts,
          tickers: topTickers,
          chart_count: withImages.length,
          level_context: levelContext,
          reply: lines,
          human_gate_required: true
        });
        global.broadcast({ type: 'kat_alert', reply: lines });
        console.log('[kat] Confluence alert broadcast: ' + instrument + ' ' + dominantBias);
      } else {
        console.log('[kat] broadcast not available - alert would be: ' + lines);
      }

      // Post to Discord magnet_channel
      const cfg = loadConfig();
      if (cfg.magnet_channel && discordClient && discordClient.isReady()) {
        discordClient.channels.fetch(cfg.magnet_channel)
          .then(ch => ch && safeSend(ch, lines))
          .catch(e => console.error('[kat] magnet_channel send error:', e.message));
      }

      // Set cooldown
      _lastKatAlert[instrument] = Date.now();
    }
  } catch (e) {
    console.error('[kat] checkKatConfluence error:', e.message);
  }
}

let _katPollInterval = null;

function startKatPoll() {
  if (_katPollInterval) return; // already running
  _katPollInterval = setInterval(async () => {
    checkKatConfluence();
    await checkLevelMagnets();
  }, ALERT_POLL_MS);
  console.log('[kat] Confluence poll started - every ' + (ALERT_POLL_MS/60000) + 'min during market hours');
}

function stopKatPoll() {
  if (_katPollInterval) {
    clearInterval(_katPollInterval);
    _katPollInterval = null;
    console.log('[kat] Confluence poll stopped');
  }
}

//  Backfill 
async function runBackfill(client) {
  const config = loadConfig();
  if (!config.enabled) {
    console.log('[kat] Backfill skipped  bot not enabled');
    return;
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  console.log('[kat] Backfill starting  cutoff: ' + cutoff.toISOString());

  // Load existing message IDs to avoid duplicates
  const seen = new Set();
  if (fs.existsSync(RAW_FEED)) {
    const lines = fs.readFileSync(RAW_FEED, 'utf8')
      .split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.message_id) seen.add(entry.message_id);
      } catch (e) {}
    }
  }
  console.log('[kat] Backfill  ' + seen.size + ' existing entries in feed (dedup set loaded)');

  const monitoredIds = new Set((config.monitored_users || []).map(u => u.discord_id));

  let totalCaptured = 0;
  let totalSkipped  = 0;

  for (const guild of client.guilds.cache.values()) {
    await guild.fetch();
    await guild.channels.fetch();

    const channelIds   = new Set(config.monitored_channel_ids || []);
    const channelNames = new Set(config.monitored_channels    || []);

    const targetChannels = [];
    for (const [, c] of guild.channels.cache) {
      if (!c) continue;
      try {
        const isText = typeof c.isTextBased === 'function' ? c.isTextBased() : false;
        if (!isText) continue;
        if (channelIds.size > 0 && channelIds.has(c.id)) {
          targetChannels.push(c);
          console.log('[kat] Backfill target (by ID): #' + c.name);
        } else if (channelIds.size === 0 && channelNames.has(c.name)) {
          targetChannels.push(c);
          console.log('[kat] Backfill target (by name): #' + c.name);
        }
      } catch (e) {
        console.error('[kat] Channel check error:', e.message);
      }
    }

    for (const channel of targetChannels) {
      const channelName = channel.name;
      console.log('[kat] Backfilling #' + channelName + ' in ' + guild.name);

      let lastId        = null;
      let reachedCutoff = false;
      let pageCount     = 0;

      while (!reachedCutoff) {
        try {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (!messages.size) break;

          const sorted = [...messages.values()].sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
          );

          for (const msg of sorted) {
            if (msg.createdAt < cutoff) { reachedCutoff = true; break; }
            if (!monitoredIds.has(msg.author.id)) continue;
            if (seen.has(msg.id)) { totalSkipped++; continue; }

            const entry = {
              ts:           msg.createdAt.toISOString(),
              message_id:   msg.id,
              guild_id:     msg.guildId,
              channel_id:   msg.channelId,
              channel_name: channelName,
              user_id:      msg.author.id,
              username:     msg.author.username,
              content:      msg.content,
              attachments:  msg.attachments.map(a => ({
                id:           a.id,
                url:          a.url,
                filename:     a.name || a.filename || 'image.png',
                content_type: a.contentType || 'unknown'
              })),
              backfill:     true
            };

            appendRawFeed(entry);
            seen.add(msg.id);
            updateActivity(msg.author.username);
            totalCaptured++;
          }

          lastId = sorted[0].id;
          pageCount++;

          // Rate limit courtesy pause  500ms between pages
          await new Promise(r => setTimeout(r, 500));

          if (pageCount >= 200) {
            console.log('[kat] Backfill page limit reached for #' + channelName);
            break;
          }

        } catch (e) {
          console.error('[kat] Backfill error in #' + channelName + ':', e.message);
          break;
        }
      }

      console.log('[kat] #' + channelName + ' backfill done  page ' + pageCount);
    }
  }

  console.log('[kat] Backfill complete  captured: ' + totalCaptured + ', skipped (dedup): ' + totalSkipped);
}

//  Targeted Backfill 
async function runTargetedBackfill(client, targetChannelsOrIds) {
  const config = loadConfig();
  if (!config.enabled) {
    console.log('[kat] Targeted backfill skipped  bot not enabled');
    return;
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  const targetSet = new Set(targetChannelsOrIds);
  console.log('[kat] TARGETED BACKFILL starting for: ' + targetChannelsOrIds.join(', '));

  const seen = new Set();
  if (fs.existsSync(RAW_FEED)) {
    const lines = fs.readFileSync(RAW_FEED, 'utf8')
      .split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.message_id) seen.add(entry.message_id);
      } catch (e) {}
    }
  }
  console.log('[kat] TARGETED BACKFILL  ' + seen.size + ' existing entries in feed (dedup set loaded)');

  const monitoredIds = new Set((config.monitored_users || []).map(u => u.discord_id));

  let totalCaptured = 0;
  let totalSkipped  = 0;

  for (const guild of client.guilds.cache.values()) {
    await guild.fetch();
    await guild.channels.fetch();

    const targetChannels = [];
    for (const [, c] of guild.channels.cache) {
      if (!c) continue;
      try {
        const isText = typeof c.isTextBased === 'function' ? c.isTextBased() : false;
        if (!isText) continue;
        if (targetSet.has(c.name) || targetSet.has(c.id)) {
          targetChannels.push(c);
          console.log('[kat] TARGETED BACKFILL target: #' + c.name + ' (' + c.id + ')');
        }
      } catch (e) {
        console.error('[kat] Channel check error:', e.message);
      }
    }

    for (const channel of targetChannels) {
      const channelName = channel.name;
      console.log('[kat] TARGETED BACKFILL backfilling #' + channelName + ' in ' + guild.name);

      let lastId        = null;
      let reachedCutoff = false;
      let pageCount     = 0;
      let channelCaptured = 0;

      while (!reachedCutoff) {
        try {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (!messages.size) break;

          const sorted = [...messages.values()].sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
          );

          for (const msg of sorted) {
            if (msg.createdAt < cutoff) { reachedCutoff = true; break; }
            if (!monitoredIds.has(msg.author.id)) continue;
            if (seen.has(msg.id)) { totalSkipped++; continue; }

            const entry = {
              ts:           msg.createdAt.toISOString(),
              message_id:   msg.id,
              guild_id:     msg.guildId,
              channel_id:   msg.channelId,
              channel_name: channelName,
              user_id:      msg.author.id,
              username:     msg.author.username,
              content:      msg.content,
              attachments:  msg.attachments.map(a => ({
                id:           a.id,
                url:          a.url,
                filename:     a.name || a.filename || 'image.png',
                content_type: a.contentType || 'unknown'
              })),
              backfill:     true
            };

            appendRawFeed(entry);
            seen.add(msg.id);
            updateActivity(msg.author.username);
            totalCaptured++;
            channelCaptured++;
          }

          lastId = sorted[0].id;
          pageCount++;

          await new Promise(r => setTimeout(r, 500));

          if (pageCount >= 200) {
            console.log('[kat] TARGETED BACKFILL page limit reached for #' + channelName);
            break;
          }

        } catch (e) {
          console.error('[kat] TARGETED BACKFILL error in #' + channelName + ':', e.message);
          break;
        }
      }

      console.log('[kat] #' + channelName + ' targeted backfill done  captured: ' + channelCaptured + ', pages: ' + pageCount);
    }
  }

  console.log('[kat] TARGETED BACKFILL complete  captured: ' + totalCaptured + ', skipped (dedup): ' + totalSkipped);
}

//  Batch processor 

function batchProcess() {
  const { parseKatSignal } = require('../lib/parse-kat');
  if (!fs.existsSync(RAW_FEED)) {
    console.log('[kat] No raw feed to process'); return;
  }
  const processed = new Set();
  if (fs.existsSync(PROCESSED)) {
    fs.readFileSync(PROCESSED, 'utf8').split('\n')
      .filter(l => l.trim()).forEach(l => {
        try { const e = JSON.parse(l); if (e.message_id) processed.add(e.message_id); } catch(e){}
      });
  }
  const raw = fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim());
  let parsed = 0; let skipped = 0; let noise = 0;
  for (const line of raw) {
    try {
      const entry = JSON.parse(line);
      if (processed.has(entry.message_id)) { skipped++; continue; }
      const hasImg = (entry.attachments || []).length > 0;
      const signal = parseKatSignal(entry.username, entry.content, hasImg);
      if (signal) {
        signal.ts         = entry.ts;
        signal.message_id = entry.message_id;
        signal.channel    = entry.channel_name;
        signal.user_id    = entry.user_id;
        fs.appendFileSync(PROCESSED, JSON.stringify(signal) + '\n', 'utf8');
        parsed++;
      } else {
        noise++;
      }
      processed.add(entry.message_id);
    } catch (e) { console.error('[kat] batch parse error:', e.message); }
  }
  console.log('[kat] Batch complete  parsed: ' + parsed + ', noise: ' + noise + ', skipped: ' + skipped);
}

//  Command helpers 

function getTopLevels(ticker) {
  try {
    const canonical = publicKatTicker(ticker);
    if (!canonical) {
      return {
        content: 'Kat levels are currently scoped to SPX and chart-backed equity tickers only.'
      };
    }

    const evidence = findKatChartEvidence(canonical, 3);
    if (!fs.existsSync(PROCESSED)) {
      return {
        content: 'No signal data yet. Check back soon.' +
          (evidence.length ? '\n\nRecent chart evidence:\n' + katEvidenceLines(evidence).join('\n') : ''),
        files: katEvidenceFiles(evidence, 3)
      };
    }

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const cutoff     = Date.now() - SEVEN_DAYS;
    const lines      = fs.readFileSync(PROCESSED, 'utf8')
      .split('\n').filter(l => l.trim());
    const rawMap     = loadRawFeedMap();

    const levelMap = {};
    for (const line of lines) {
      try {
        const sig = JSON.parse(line);
        if (!sig.ts || !sig.ticker) continue;
        if (new Date(sig.ts).getTime() < cutoff) continue;
        if (!tickerMatches(canonical, sig.ticker)) continue;
        if (!sig.levels || sig.levels.length === 0) continue;
        for (const level of sig.levels) {
          const bucket = Math.round(level / 5) * 5;
          if (!levelMap[bucket]) {
            levelMap[bucket] = { count: 0, analysts: new Set(), biases: new Set(), examples: [] };
          }
          levelMap[bucket].count++;
          if (sig.analyst) levelMap[bucket].analysts.add(sig.analyst);
          if (sig.bias)    levelMap[bucket].biases.add(sig.bias);
          if (levelMap[bucket].examples.length < 2) {
            const rawEntry = rawMap.get(sig.message_id);
            levelMap[bucket].examples.push({
              analyst: sig.analyst || (rawEntry && rawEntry.username) || 'unknown',
              ts: sig.ts,
              link: katDiscordMessageLink(rawEntry)
            });
          }
        }
      } catch (e) {}
    }

    // Anti-hallucination: 2+ analysts OR 3+ mentions required
    const qualified = Object.entries(levelMap)
      .filter(([, v]) => v.analysts.size >= 2 || v.count >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    if (qualified.length === 0) {
      return {
        content: trimKatDiscordContent('No confirmed confluence levels for ' + canonical +
          ' in the last 7 days.\n' +
          '_Levels need 2+ analysts or 3+ mentions to qualify. No guesses._' +
          (evidence.length ? '\n\nRecent chart-backed source posts:\n' + katEvidenceLines(evidence).join('\n') : '')),
        files: katEvidenceFiles(evidence, 3)
      };
    }

    const rows = qualified.map(([level, data]) => {
      const tag = data.biases.has('BEARISH') && data.biases.has('BULLISH')
        ? 'contested'
        : data.biases.has('BEARISH') ? 'resistance' : 'support';
      return '`' + level + '`  ' +
        data.count + ' mention' + (data.count > 1 ? 's' : '') +
        ', ' + data.analysts.size + ' analyst' + (data.analysts.size > 1 ? 's' : '') +
        ' (' + tag + ')' +
        (data.examples && data.examples.length
          ? '\n   sources: ' + data.examples.map(example =>
            example.analyst + ' ' + formatKatEt(example.ts) +
            (example.link ? ' ' + example.link : '')
          ).join('; ')
          : '');
    });

    return buildKatEvidencePayload(
      ' **' + canonical + ' levels  last 7 days**\n' +
        rows.join('\n') + '\n' +
        '_Source: Elevated Charts analyst posts. 2+ analysts or 3+ mentions required._' +
        (evidence.length ? '\n\nRecent chart-backed source posts:\n' + katEvidenceLines(evidence).join('\n') : ''),
      evidence,
      3
    );
  } catch (e) {
    console.error('[kat] getTopLevels error:', e.message);
    return { content: 'Error reading level data. Try again shortly.' };
  }
}

function getBiasReport(ticker) {
  try {
    const canonical = publicKatTicker(ticker || 'SPX') || 'SPX';
    const evidence = findKatChartEvidence(canonical, 3);
    if (!fs.existsSync(PROCESSED)) return { content: 'No signal data yet.' };

    const EIGHTEEN_HRS = 18 * 60 * 60 * 1000;
    const cutoff       = Date.now() - EIGHTEEN_HRS;
    const lines        = fs.readFileSync(PROCESSED, 'utf8')
      .split('\n').filter(l => l.trim());

    let bullish = 0; let bearish = 0; let neutral = 0;
    const bullAnalysts = new Set();
    const bearAnalysts = new Set();
    const tickerCounts = {};

    for (const line of lines) {
      try {
        const sig = JSON.parse(line);
        if (!sig.ts) continue;
        if (new Date(sig.ts).getTime() < cutoff) continue;
        if (!tickerMatches(canonical, sig.ticker)) continue;
        if (!['CHART_ANALYSIS','DIRECTIONAL','LEVEL_WATCH'].includes(sig.signal_type)) continue;
        if (sig.bias === 'BULLISH') {
          bullish++;
          if (sig.analyst) bullAnalysts.add(sig.analyst);
        } else if (sig.bias === 'BEARISH') {
          bearish++;
          if (sig.analyst) bearAnalysts.add(sig.analyst);
        } else {
          neutral++;
        }
        if (sig.ticker) tickerCounts[sig.ticker] = (tickerCounts[sig.ticker] || 0) + 1;
      } catch (e) {}
    }

    const total = bullish + bearish + neutral;

    // Anti-hallucination: minimum 3 signals
    if (total < 3) {
      return {
        content: trimKatDiscordContent('Not enough ' + canonical + ' signal data in the last 18 hours.\n' +
          '_Need at least 3 signals. Current: ' + total + '._' +
          (evidence.length ? '\n\nRecent chart-backed source posts:\n' + katEvidenceLines(evidence).join('\n') : '')),
        files: katEvidenceFiles(evidence, 3)
      };
    }

    const dominant = bullish > bearish ? 'BULLISH '
      : bearish > bullish ? 'BEARISH ' : 'MIXED ';
    const ratio = bullish + bearish > 0
      ? Math.round((Math.max(bullish, bearish) / (bullish + bearish)) * 100)
      : 50;

    return buildKatEvidencePayload(
      ' **Elevated Charts  ' + canonical + ' Last 18h Regime**\n' +
      'Collective bias: **' + dominant + '** (' + ratio + '%)\n' +
      'Bullish: ' + bullish + ' signals from ' + bullAnalysts.size + ' analyst(s)\n' +
      'Bearish: ' + bearish + ' signals from ' + bearAnalysts.size + ' analyst(s)\n' +
      'Neutral/context: ' + neutral + '\n' +
      '_Based on ' + total + ' ' + canonical + ' signals. Not a prediction  synthesis only._' +
      (evidence.length ? '\n\nRecent chart-backed source posts:\n' + katEvidenceLines(evidence).join('\n') : ''),
      evidence,
      3
    );
  } catch (e) {
    console.error('[kat] getBiasReport error:', e.message);
    return { content: 'Error reading bias data.' };
  }
}

async function getHeatmap(ticker) {
  try {
    const config = loadConfig();
    if (config.heatmap_detection === false) return { content: 'Kat heatmap lookup is disabled in config.' };
    if (!fs.existsSync(RAW_FEED)) return { content: 'No heatmap data yet.' };

    const lines = fs.readFileSync(RAW_FEED, 'utf8')
      .split('\n').filter(l => l.trim());
    const processedMatches = new Set();
    if (fs.existsSync(PROCESSED)) {
      for (const line of fs.readFileSync(PROCESSED, 'utf8').split('\n').filter(l => l.trim())) {
        try {
          const sig = JSON.parse(line);
          if (sig && sig.has_image && sig.message_id && tickerMatches(ticker, sig.ticker)) processedMatches.add(sig.message_id);
        } catch (e) {}
      }
    }

    const candidates = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const images = katImageAttachments(entry);
        if (!images.length) continue;
        const att = images[0];
        if (!att.url) continue;

        const contentUpper = (entry.content || '').toUpperCase();
        const textMatches =
          contentUpper.includes(ticker) ||
          contentUpper.includes('$' + ticker) ||
          contentUpper.includes('#' + ticker) ||
          (ticker === 'SPX' && (contentUpper.includes('SPX') || contentUpper.includes('ES_F') || contentUpper.includes('#ES_F'))) ||
          (ticker === 'QQQ' && (contentUpper.includes('QQQ') || contentUpper.includes('NDX') || contentUpper.includes('NQ_F') || contentUpper.includes('#NQ_F')));
        const processedMatch = processedMatches.has(entry.message_id);
        const heatmapish = /\b(heatmap|heat map|node|king|gatekeeper|gex|gamma)\b/i.test(entry.content || '') ||
          entry.channel_id === '1482431257441996850' ||
          entry.channel_name === 'heatmap-requests';
        const heatmapChannel = entry.channel_id === '1482431257441996850' ||
          entry.channel_name === 'heatmap-requests';
        if (!textMatches && !processedMatch && !heatmapChannel) continue;
        candidates.push({ entry, image: att, heatmapish });
      } catch (e) {}
    }
    candidates.sort((a, b) => {
      if (a.heatmapish !== b.heatmapish) return a.heatmapish ? -1 : 1;
      return new Date(b.entry.ts || 0) - new Date(a.entry.ts || 0);
    });
    const best = candidates[0];

    if (!best) {
      return {
        content: 'No recent heatmap found for ' + ticker + '.\n' +
          '_Kat looks for image posts from monitored analysts mentioning ' + ticker + '._'
      };
    }

    const bestEntry = best.entry;
    const ts      = new Date(bestEntry.ts);
    const ageMs   = Date.now() - ts.getTime();
    const ageMins = Math.round(ageMs / 60000);
    const ageStr  = ageMins < 60
      ? ageMins + 'm ago'
      : Math.floor(ageMins / 60) + 'h ' + (ageMins % 60) + 'm ago';
    const stale   = ageMs > 4 * 60 * 60 * 1000
      ? '\n _Over 4 hours old  levels may have shifted._' : '';

    const caption =
      ' **Most recent ' + ticker + ' heatmap**\n' +
      'Posted by: ' + bestEntry.username + '\n' +
      'Time: ' + ts.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }) +
      ' ET (' + ageStr + ')' +
      (katDiscordMessageLink(bestEntry) ? '\nSource message: ' + katDiscordMessageLink(bestEntry) : '') +
      (bestEntry.content ? '\n"' + compactKatText(bestEntry.content, 140) + '"' : '') +
      '\nImage: attached below (' + (best.image.filename || 'heatmap.png') + ')' +
      stale + '\n_Source: Elevated Charts analyst post via Kat_';

    return {
      content: trimKatDiscordContent(caption),
      files: [{
        attachment: best.image.url,
        name: best.image.filename || 'heatmap.png'
      }]
    };
  } catch (e) {
    console.error('[kat] getHeatmap error:', e.message);
    return { content: 'Error fetching heatmap. CDN link may have expired.' };
  }
}

async function checkLevelMagnets() {
  try {
    const config = loadConfig();
    if (!config.enabled || !config.magnet_channel) return;
    if (!discordClient || !discordClient.isReady()) return;

    const { isMarketOpen } = require('../lib/market-hours');
    if (!isMarketOpen().open) return;

    if (!fs.existsSync(PROCESSED)) return;

    const FORTYEIGHT_HRS = 48 * 60 * 60 * 1000;
    const cutoff         = Date.now() - FORTYEIGHT_HRS;
    const lines          = fs.readFileSync(PROCESSED, 'utf8')
      .split('\n').filter(l => l.trim());
    const rawMap         = loadRawFeedMap();

    const levelMap = {};
    for (const line of lines) {
      try {
        const sig = JSON.parse(line);
        if (!sig.ts || !sig.levels || !sig.levels.length) continue;
        if (!sig.ticker) continue;
        if (!['LEVEL_WATCH','CHART_ANALYSIS'].includes(sig.signal_type)) continue;
        if (new Date(sig.ts).getTime() < cutoff) continue;
        const canonical = publicKatTicker(sig.ticker);
        if (!canonical) continue;
        const rawEntry = rawMap.get(sig.message_id);
        const chartBacked = sig.has_image === true || katImageAttachments(rawEntry).length > 0;
        if (canonical !== 'SPX' && !chartBacked) continue;
        for (const level of sig.levels) {
          const bucket = Math.round(level / 5) * 5;
          const key    = canonical + ':' + bucket;
          if (!levelMap[key]) {
            levelMap[key] = {
              level: bucket, ticker: canonical,
              analysts: new Set(), count: 0,
              biases: new Set(), lastTs: sig.ts,
              chartBacked: false,
              examples: []
            };
          }
          levelMap[key].count++;
          levelMap[key].analysts.add(sig.analyst);
          levelMap[key].biases.add(sig.bias);
          if (chartBacked) levelMap[key].chartBacked = true;
          if (levelMap[key].examples.length < 3) {
            levelMap[key].examples.push({
              analyst: sig.analyst || (rawEntry && rawEntry.username) || 'unknown',
              ts: sig.ts,
              link: katDiscordMessageLink(rawEntry),
              text: compactKatText((rawEntry && rawEntry.content) || sig.raw || '', 90)
            });
          }
          if (sig.ts > levelMap[key].lastTs) levelMap[key].lastTs = sig.ts;
        }
      } catch (e) {}
    }

    for (const [key, data] of Object.entries(levelMap)) {
      if (data.analysts.size < 2) continue;
      if (data.ticker !== 'SPX' && !data.chartBacked) continue;

      const cooldownKey = 'magnet:' + key;
      const lastAlert   = _lastKatAlert[cooldownKey] || 0;
      if (Date.now() - lastAlert < 4 * 60 * 60 * 1000) continue;

      const biasStr = data.biases.has('BEARISH') && data.biases.has('BULLISH')
        ? 'CONTESTED '
        : data.biases.has('BEARISH') ? 'resistance ' : 'support ';

      const msg =
        ' **Level Magnet  ' + data.ticker + ' ' + data.level + '**\n' +
        data.analysts.size + ' analysts independently marked this level\n' +
        'Bias: ' + biasStr + ' | Mentions: ' + data.count + '\n' +
        'Last marked: ' + new Date(data.lastTs).toLocaleTimeString('en-US',
          { timeZone: 'America/New_York' }) + ' ET\n' +
        (data.examples.length ? 'Sources:\n' + data.examples.map((example, index) =>
          (index + 1) + '. ' + example.analyst + ' - ' +
          formatKatEt(example.ts) +
          (example.link ? ' - ' + example.link : '') +
          (example.text ? '\n   "' + example.text + '"' : '')
        ).join('\n') + '\n' : '') +
        '_Source: Elevated Charts analyst posts via Kat_';

      try {
        const guild   = discordClient.guilds.cache.first();
        const channel = guild?.channels.cache.find(
          c => c.name === config.magnet_channel ||
               c.id   === config.magnet_channel
        );
        if (channel && channel.isTextBased()) {
          await safeSend(channel, trimKatDiscordContent(msg));
          _lastKatAlert[cooldownKey] = Date.now();
          console.log('[kat] Level magnet posted: ' + data.ticker + ' ' + data.level);
        }
      } catch (e) {
        console.error('[kat] magnet post error:', e.message);
      }
    }
  } catch (e) {
    console.error('[kat] checkLevelMagnets error:', e.message);
  }
}

async function handleKatCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const sub = args[1] ? args[1].toLowerCase() : '';
  const ticker = (args[2] || 'SPX').toUpperCase();

  try {
    const config = loadConfig();
    if (KAT_QUEUE_SUBCOMMANDS.has(sub) && !mentionsKatbot(message)) {
      return;
    }
    if (KAT_OWNER_ONLY_SUBCOMMANDS.has(sub) && !isKatOwnerCommandAllowed(message, config)) {
      await safeReply(message, getKatOwnerOnlyMessage());
      return;
    }

    if (sub === 'levels') {
      await safeReply(message, getTopLevels(ticker));
    } else if (sub === 'bias') {
      await safeReply(message, getBiasReport(ticker));
    } else if (sub === 'heatmap') {
      const heatmapPayload = await getHeatmap(ticker);
      await safeReply(message, heatmapPayload);
    } else if (sub === 'chart' || sub === 'charts' || sub === 'recent' || sub === 'source' || sub === 'sources') {
      await safeReply(message, getChartEvidencePayload(ticker));
    } else if (sub === 'watchlist' || sub === 'tickers') {
      const { buildKatTickerWatchlist, formatKatTickerWatchlistForDiscord } = require('../lib/kat-ticker-watchlist');
      await safeReply(message, formatKatTickerWatchlistForDiscord(buildKatTickerWatchlist()));
    } else if (sub === 'equity') {
      await safeReply(message, getChartEvidencePayload(ticker));
    } else if (sub === 'options' || sub === 'option') {
      const { buildKatEquityOptionsProfile, formatKatEquityOptionsForDiscord } = require('../lib/kat-equity-options');
      await safeReply(message, formatKatEquityOptionsForDiscord(buildKatEquityOptionsProfile(ticker)));
    } else if (sub === 'status' || sub === 'summary') {
      const { buildKatInsights, formatKatInsightsForDiscord } = require('../lib/kat-insights');
      await safeReply(message, formatKatInsightsForDiscord(buildKatInsights({
        runtime: {
          bot_online: !!(discordClient && discordClient.isReady()),
          poll_active: _katPollInterval !== null,
          bot_tag: discordClient && discordClient.isReady() ? discordClient.user.tag : null
        }
      })));
    } else {
      await safeReply(message, getKatWelcomeMessage());
    }
  } catch (e) {
    console.error('[kat] handleKatCommand error:', e.message);
  }
}

//  Routes 

// POST /agent/kat/backfill-channels  { channels: ["barrys-breakdowns", ...] }
router.post('/backfill-channels', async (req, res) => {
  const { channels } = req.body;
  if (!channels || !Array.isArray(channels)) {
    return res.status(400).json({ error: 'channels array required' });
  }
  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'Bot not online' });
  }
  res.json({ ok: true, message: 'Backfill started for: ' + channels.join(', ') });
  setImmediate(() => runTargetedBackfill(discordClient, channels));
});

// GET /agent/kat/status
router.get('/status', (req, res) => {
  const config   = loadConfig();
  const activity = fs.existsSync(ACTIVITY)
    ? JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'))
    : {};
  res.json({
    enabled:               config.enabled,
    bot_online:            !!(discordClient && discordClient.isReady()),
    bot_tag:               discordClient && discordClient.isReady() ? discordClient.user.tag : null,
    monitored_users_count: (config.monitored_users || []).length,
    monitored_users:       (config.monitored_users || []).map(u => u.username),
    monitored_channels:    config.monitored_channels || [],
    discord_output: {
      responses_enabled: discordOutputAllowed('reply', config),
      posts_enabled: discordOutputAllowed('post', config),
      env_override: envFlagEnabled('KATBOT_ALLOW_DISCORD_OUTPUT')
    },
    raw_feed_count:        rawFeedCount(),
    processed_signal_count: fs.existsSync(PROCESSED)
      ? fs.readFileSync(PROCESSED, 'utf8').split('\n').filter(l => l.trim()).length
      : 0,
    last_capture:          lastCapture(),
    activity,
    poll_active:           _katPollInterval !== null,
    last_alerts:           _lastKatAlert
  });
});

// POST /agent/kat/enable  { enabled: bool }
router.post('/enable', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  const config = loadConfig();
  config.enabled = enabled;
  saveConfig(config);
  console.log('[kat] ' + (enabled ? 'ENABLED  bot now capturing' : 'DISABLED  bot paused'));
  if (config.enabled && discordClient && discordClient.isReady()) {
    startKatPoll();
  } else {
    stopKatPoll();
  }
  res.json({ ok: true, enabled: config.enabled });
});

// POST /agent/kat/configure  { monitored_users, monitored_channels, monitored_channel_ids, magnet_channel, command_channels }
router.post('/configure', (req, res) => {
  const config = loadConfig();
  if (req.body.monitored_users)    config.monitored_users    = req.body.monitored_users;
  if (req.body.monitored_channels) config.monitored_channels = req.body.monitored_channels;
  if (req.body.monitored_channel_ids) config.monitored_channel_ids = req.body.monitored_channel_ids;
  if (req.body.magnet_channel)     config.magnet_channel     = req.body.magnet_channel;
  if (req.body.command_channels)   config.command_channels   = req.body.command_channels;
  if (typeof req.body.discord_responses_enabled === 'boolean') {
    config.discord_responses_enabled = req.body.discord_responses_enabled;
  }
  if (typeof req.body.discord_posts_enabled === 'boolean') {
    config.discord_posts_enabled = req.body.discord_posts_enabled;
  }
  saveConfig(config);
  console.log('[kat] Config updated:', JSON.stringify({
    users: config.monitored_users.map(u => u.username),
    channels: config.monitored_channels,
    channel_ids: config.monitored_channel_ids || [],
    magnet_channel: config.magnet_channel,
    command_channels: config.command_channels,
    discord_responses_enabled: config.discord_responses_enabled === true,
    discord_posts_enabled: config.discord_posts_enabled === true
  }));
  res.json({ ok: true, config });
});

// POST /agent/kat/process-backfill
router.post('/process-backfill', (req, res) => {
  res.json({ ok: true, message: 'Batch processing started' });
  setImmediate(() => batchProcess());
});

// GET /agent/kat/signals?limit=50
router.get('/signals', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  if (!fs.existsSync(PROCESSED)) return res.json({ signals: [], count: 0 });
  const lines = fs.readFileSync(PROCESSED, 'utf8')
    .split('\n').filter(l => l.trim());
  const signals = lines.slice(-limit).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  res.json({ signals, count: lines.length });
});

// GET /agent/kat/feed?limit=50
router.get('/feed', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  if (!fs.existsSync(RAW_FEED)) return res.json({ entries: [], count: 0 });
  const lines = fs.readFileSync(RAW_FEED, 'utf8')
    .split('\n').filter(l => l.trim());
  const entries = lines.slice(-limit).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  res.json({ entries, count: lines.length });
});

// GET /agent/kat/activity
router.get('/activity', (req, res) => {
  if (!fs.existsSync(ACTIVITY)) return res.json({});
  try { res.json(JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'))); }
  catch (e) { res.json({}); }
});

// GET /agent/kat/insights
router.get('/insights', (req, res) => {
  try {
    const { buildKatInsights } = require('../lib/kat-insights');
    res.json(buildKatInsights({
      runtime: {
        bot_online: !!(discordClient && discordClient.isReady()),
        poll_active: _katPollInterval !== null,
        bot_tag: discordClient && discordClient.isReady() ? discordClient.user.tag : null
      }
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/readiness
router.get('/readiness', (req, res) => {
  try {
    const { buildKatReadiness } = require('../lib/kat-readiness');
    res.json(buildKatReadiness({
      runtime: {
        bot_online: !!(discordClient && discordClient.isReady()),
        poll_active: _katPollInterval !== null,
        bot_tag: discordClient && discordClient.isReady() ? discordClient.user.tag : null
      }
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/readiness.md
router.get('/readiness.md', (req, res) => {
  try {
    const { buildKatReadiness, formatKatReadinessMarkdown } = require('../lib/kat-readiness');
    res.type('text/markdown').send(formatKatReadinessMarkdown(buildKatReadiness({
      runtime: {
        bot_online: !!(discordClient && discordClient.isReady()),
        poll_active: _katPollInterval !== null,
        bot_tag: discordClient && discordClient.isReady() ? discordClient.user.tag : null
      }
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/equity-options
router.get('/equity-options', (req, res) => {
  try {
    const { buildKatEquityOptionsUniverse } = require('../lib/kat-equity-options');
    res.json(buildKatEquityOptionsUniverse({
      limit: req.query.limit ? Number(req.query.limit) : 20,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/equity-options/:ticker
router.get('/equity-options/:ticker', (req, res) => {
  try {
    const { buildKatEquityOptionsProfile } = require('../lib/kat-equity-options');
    res.json(buildKatEquityOptionsProfile(req.params.ticker));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/handoff
router.get('/handoff', (req, res) => {
  try {
    const { buildKatInsights, buildKatHandoffMarkdown } = require('../lib/kat-insights');
    res.type('text/markdown').send(buildKatHandoffMarkdown(buildKatInsights({
      runtime: {
        bot_online: !!(discordClient && discordClient.isReady()),
        poll_active: _katPollInterval !== null,
        bot_tag: discordClient && discordClient.isReady() ? discordClient.user.tag : null
      }
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /agent/kat/welcome
router.get('/welcome', (req, res) => {
  res.type('text/markdown').send(getKatWelcomeMessage());
});

router._test = {
  buildKatEvidencePayload,
  katDiscordMessageLink,
  katEvidenceFiles,
  katEvidenceLines,
  katCommandCooldownKey,
  katCommandCooldownRemaining,
  getKatOwnerOnlyMessage,
  isKatOwnerCommandAllowed,
  recordKatCommandCooldown,
  resetKatCommandCooldownsForTest,
  trimKatDiscordContent,
  withSafeAllowedMentions
};

module.exports = router;
