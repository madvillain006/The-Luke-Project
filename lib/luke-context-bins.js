'use strict';

const crypto = require('crypto');

const defaultPaths = require('./paths');
const { appendJsonl, readJsonFile, writeJsonAtomic } = require('../state/lib');

const STORE_VERSION = 1;
const MAX_BIN_ENTRIES = 80;
const MAX_RECENT_ENTRIES = 160;
const MAX_TEXT_CHARS = 900;

const BIN_DEFS = {
  personal: 'appointments, reminders, preferences, active thoughts',
  daily: 'calendar, weather, daily planning, next actions',
  radar: 'source intake, links, Sybil, scraping, synthesis leads',
  trading: 'trading review, levels, Pine, Katbot, Saty, Mancini, heatmaps',
  project: 'Luke codebase, UI, roadmap, repo housekeeping, Jarvis scope',
  general: 'recent conversation context that does not fit a narrower bin',
};

const TRADING_COMMAND_RE = /^\/(?:alert|backtest|balance|confluence|dubz|entries|heatmap|history|layout|levels|mancini|ready|reset|review|runner|saty|session|status|trade|trading-mode|verdict)\b/i;

function compactText(value, max = MAX_TEXT_CHARS) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function sha(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function makeStore() {
  const bins = {};
  for (const [id, description] of Object.entries(BIN_DEFS)) {
    bins[id] = {
      id,
      label: id.replace(/\b\w/g, char => char.toUpperCase()),
      description,
      entries: [],
      updated_at: null,
    };
  }
  return {
    version: STORE_VERSION,
    updated_at: null,
    recent: [],
    bins,
  };
}

function normalizeStore(value) {
  const store = value && typeof value === 'object' ? value : {};
  const next = makeStore();
  next.updated_at = store.updated_at || null;
  next.recent = Array.isArray(store.recent) ? store.recent.filter(Boolean).slice(-MAX_RECENT_ENTRIES) : [];
  for (const [id, def] of Object.entries(next.bins)) {
    const existing = store.bins && store.bins[id] && typeof store.bins[id] === 'object' ? store.bins[id] : {};
    def.updated_at = existing.updated_at || null;
    def.entries = Array.isArray(existing.entries) ? existing.entries.filter(Boolean).slice(-MAX_BIN_ENTRIES) : [];
  }
  return next;
}

function loadStore(options = {}) {
  if (options.loadStoreFn) return normalizeStore(options.loadStoreFn());
  const paths = options.paths || defaultPaths;
  return normalizeStore(readJsonFile(paths.snapshots.contextBins, makeStore()));
}

function saveStore(store, options = {}) {
  const normalized = normalizeStore(store);
  if (options.saveStoreFn) {
    options.saveStoreFn(normalized);
    return normalized;
  }
  const paths = options.paths || defaultPaths;
  writeJsonAtomic(paths.snapshots.contextBins, normalized);
  return normalized;
}

function addBin(result, id, reason, amount = 0.18) {
  if (!BIN_DEFS[id]) return;
  result.bins.add(id);
  result.reasons.push(reason);
  result.confidence = Math.min(0.99, result.confidence + amount);
}

function classifyContextTurn(input = {}) {
  const text = compactText(input.text || input.message || '');
  const lower = text.toLowerCase();
  const surface = input.surface === 'trading' ? 'trading' : 'system';
  const result = {
    ok: true,
    surface,
    text_preview: compactText(text, 180),
    bins: new Set(),
    reasons: [],
    confidence: 0.12,
    intent: 'conversation',
    primary_bin: 'general',
    should_attempt_ingest: false,
    should_route_trading_command: false,
  };

  if (!text && !input.hasImage) {
    result.intent = 'ignore';
    result.confidence = 0;
    return { ...result, bins: [], reasons: [] };
  }

  if (TRADING_COMMAND_RE.test(text)) {
    addBin(result, 'trading', 'explicit trading command', 0.72);
    result.intent = 'trading_command';
    result.should_route_trading_command = true;
  }

  if (/\b(?:appointment|appt|meeting|doctor|dentist|therapy|interview|call at|i have .{0,80}\bat\s+\d|remind me|remember to|follow up|check back|i prefer|i like|i do not like|i don't like|i'?m thinking about|active thought)\b/i.test(text)) {
    addBin(result, 'personal', 'personal memory signal', 0.42);
    if (/\b(?:appointment|appt|meeting|doctor|dentist|therapy|interview|call at|remind me|remember to|follow up|check back|at\s+\d{1,2})\b/i.test(text)) {
      addBin(result, 'daily', 'time-bound personal context', 0.18);
    }
  }

  if (/\b(?:calendar|schedule|daily|today|tomorrow|this week|next week|weather|buffalo|knoxville|wilmington|job|jobs|next action|morning brief|brief)\b/i.test(text)) {
    addBin(result, 'daily', 'daily operations signal', 0.3);
  }

  if (/\b(?:radar|source|sources|scrape|scraping|sybil|article|newsletter|readwise|kindle|podcast|voice note|x\.com|twitter|tweet|link|url|contradict|contradiction|thesis|idea bin|obsidian|vault)\b/i.test(text)) {
    addBin(result, 'radar', 'source synthesis signal', 0.36);
  }

  if (/\b(?:trade|trading|market|markets|es|mes|nq|mnq|spx|spy|qqq|nvda|tesla|tsla|level|levels|mancini|saty|dubz|bobby|katbot|heatmap|pine|tradingview|verdict|entry|entries|stop|target|broker|tradovate|ninja|ninjatrader|apex)\b/i.test(text)) {
    addBin(result, 'trading', 'trading context signal', 0.38);
  }

  if (/\b(?:luke|jarvis|codex|claude|repo|repository|code|commit|ui|dashboard|front end|frontend|backend|roadmap|module|scaffold|folder|file|test|vitest|pm2|cleanup|housekeeping)\b/i.test(text)) {
    addBin(result, 'project', 'Luke project signal', 0.34);
  }

  if (input.hasImage && result.bins.size === 0) {
    addBin(result, 'radar', 'image or pasted evidence', 0.22);
  }

  if (result.bins.size === 0 && text.length >= 18 && !/^(hi|hey|hello|ok|okay|thanks|thank you|yes|no)$/i.test(text)) {
    addBin(result, 'general', 'recent conversation', 0.16);
  }

  const bins = [...result.bins];
  const priority = ['trading', 'radar', 'personal', 'daily', 'project', 'general'];
  result.primary_bin = priority.find(id => result.bins.has(id)) || 'general';

  if (result.intent !== 'trading_command') {
    if (result.bins.has('radar') && result.bins.has('trading')) result.intent = 'trading_source_context';
    else if (result.bins.has('radar')) result.intent = 'source_context';
    else if (result.bins.has('trading')) result.intent = 'trading_context';
    else if (result.bins.has('personal')) result.intent = 'personal_memory';
    else if (result.bins.has('daily')) result.intent = 'daily_ops';
    else if (result.bins.has('project')) result.intent = 'project_context';
  }

  result.should_attempt_ingest = result.intent === 'trading_source_context'
    || (result.bins.has('trading') && result.bins.has('radar') && text.length > 120)
    || /\b(?:paste|sybil|mancini|saty|dubz|bobby|heatmap|pine|tradingview alert|discord export)\b/i.test(text);

  return {
    ...result,
    bins,
    reasons: [...new Set(result.reasons)].slice(0, 5),
  };
}

function latestForPrompt(entries = [], limit = 4) {
  return entries
    .filter(entry => entry && entry.role === 'user')
    .slice(0, limit)
    .map(entry => `- ${entry.text_preview}`);
}

function recordContextTurn(input = {}, options = {}) {
  const text = compactText(input.text || input.message || '');
  const route = input.route || classifyContextTurn({
    text,
    surface: input.surface,
    hasImage: input.hasImage,
  });
  if (route.intent === 'ignore' || (!text && !input.hasImage)) {
    return { ok: true, captured: false, reason: 'not-relevant', route };
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const store = loadStore(options);
  const bins = route.bins && route.bins.length ? route.bins : ['general'];
  const entry = {
    id: `ctx_${sha([now.toISOString(), input.role || 'user', input.surface || 'system', text].join('|')).slice(0, 16)}`,
    ts: now.toISOString(),
    role: input.role === 'assistant' ? 'assistant' : 'user',
    surface: input.surface === 'trading' ? 'trading' : 'system',
    primary_bin: route.primary_bin || bins[0],
    bins,
    intent: route.intent || 'conversation',
    confidence: Number(route.confidence || 0),
    text_preview: compactText(text || '[image]', input.role === 'assistant' ? 420 : 700),
    source: input.source || 'chat',
  };

  store.updated_at = now.toISOString();
  store.recent = [...store.recent, entry].slice(-MAX_RECENT_ENTRIES);
  for (const bin of bins) {
    if (!store.bins[bin]) continue;
    store.bins[bin].updated_at = now.toISOString();
    store.bins[bin].entries = [...store.bins[bin].entries, entry].slice(-MAX_BIN_ENTRIES);
  }

  saveStore(store, options);
  try {
    const paths = options.paths || defaultPaths;
    if (paths.events?.contextBins) {
      appendJsonl(paths.events.contextBins, {
        ts: now.toISOString(),
        entry_id: entry.id,
        role: entry.role,
        surface: entry.surface,
        primary_bin: entry.primary_bin,
        bins: entry.bins,
        intent: entry.intent,
        text_preview: compactText(entry.text_preview, 220),
      });
    }
  } catch {}
  return { ok: true, captured: true, entry, route };
}

function buildContextBinsSnapshot(options = {}) {
  const store = loadStore(options);
  const bins = {};
  for (const [id, bin] of Object.entries(store.bins)) {
    const limit = Number(options.limit || 8);
    bins[id] = {
      id,
      label: bin.label,
      description: bin.description,
      updated_at: bin.updated_at,
      count: bin.entries.length,
      entries: bin.entries.slice(-limit).reverse(),
    };
  }
  const active = Object.values(bins).filter(bin => bin.count > 0);
  return {
    ok: true,
    label: 'Luke Context Bins',
    updated_at: store.updated_at,
    summary_line: active.length
      ? `${active.length} active bins / ${store.recent.length} rolling entries`
      : 'ready / no rolling context yet',
    bins,
    recent: store.recent.slice(-Number(options.recentLimit || 12)).reverse(),
  };
}

function buildContextBinPrompt(input = {}, options = {}) {
  const route = input.route || classifyContextTurn(input);
  const snapshot = buildContextBinsSnapshot({ ...options, limit: Number(options.limit || 5), recentLimit: 8 });
  const wanted = route.bins?.length ? route.bins : ['personal', 'daily', 'radar', 'trading', 'project'];
  const sections = [];
  for (const binId of wanted) {
    const bin = snapshot.bins[binId];
    const lines = latestForPrompt(bin?.entries || [], 3);
    if (lines.length) sections.push(`${bin.label} bin:\n${lines.join('\n')}`);
  }
  if (!sections.length) return 'Luke rolling context bins: no relevant prior bin entries yet.';
  return [
    'Luke rolling context bins:',
    `- Current route: ${route.intent} -> ${route.primary_bin}.`,
    '- Use these bins like a compact local vault index. Do not pretend they are complete.',
    ...sections,
  ].join('\n');
}

module.exports = {
  BIN_DEFS,
  TRADING_COMMAND_RE,
  buildContextBinPrompt,
  buildContextBinsSnapshot,
  classifyContextTurn,
  recordContextTurn,
  _internal: {
    compactText,
    makeStore,
    normalizeStore,
  },
};
