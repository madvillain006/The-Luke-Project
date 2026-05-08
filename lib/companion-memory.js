'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const defaultPaths = require('./paths');
const { loadMemory, saveMemory } = require('./memory');
const { recordRadarIngest } = require('./radar/ingest');
const { appendJsonl } = require('../state/lib');

const STORE_KEY = 'luke_companion_memory';
const STORE_VERSION = 1;
const MAX_ENTRIES = 160;
const MAX_TEXT_CHARS = 700;

const KIND_LABELS = {
  appointment: 'Appointment',
  reminder: 'Reminder',
  thought: 'Thought',
  preference: 'Preference',
  note: 'Note',
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'but', 'by', 'can', 'do', 'for', 'from',
  'have', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the',
  'this', 'to', 'was', 'what', 'when', 'with', 'you',
]);

function compactText(value, max = MAX_TEXT_CHARS) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function nowDate(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function makeStore() {
  return {
    version: STORE_VERSION,
    updated_at: null,
    entries: [],
  };
}

function normalizeStore(value) {
  const store = value && typeof value === 'object' ? value : makeStore();
  return {
    version: STORE_VERSION,
    updated_at: store.updated_at || null,
    entries: Array.isArray(store.entries) ? store.entries.filter(Boolean) : [],
  };
}

function loadStore(options = {}) {
  const loadFn = options.loadMemoryFn || loadMemory;
  const memory = options.memory || loadFn();
  return {
    memory,
    store: normalizeStore(memory[STORE_KEY]),
  };
}

function capEntries(entries) {
  return entries
    .filter(Boolean)
    .sort((a, b) => new Date(a.updated_at || a.ts || 0).getTime() - new Date(b.updated_at || b.ts || 0).getTime())
    .slice(-MAX_ENTRIES);
}

function saveStore(memory, store, options = {}) {
  const saveFn = options.saveMemoryFn || saveMemory;
  const updated = {
    ...store,
    version: STORE_VERSION,
    entries: capEntries(store.entries),
  };
  memory[STORE_KEY] = updated;
  saveFn(memory);
  return updated;
}

function isLikelyQuestion(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return false;
  if (t.endsWith('?')) return true;
  return /^(what|when|where|who|why|how|do|did|does|can|could|should|would|is|are)\b/.test(t);
}

function looksLikeMemoryQuestion(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (/\b(?:what|when|where)\b.*\b(?:appointment|appt|meeting|call|reminder|remember|thinking|thought)\b/.test(t)) return true;
  if (/\b(?:do i|did i|have i)\b.*\b(?:have|tell|say|mention|remember|schedule)\b/.test(t)) return true;
  if (/\bwhat did i\b.*\b(?:tell|say|mention)\b/.test(t)) return true;
  if (/\bwhat.*\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/.test(t)) return true;
  if (/\b(?:any|my)\s+(?:appointments?|reminders?)\b/.test(t)) return true;
  return false;
}

function classifyMemory(text) {
  const t = String(text || '').toLowerCase();
  if (!t || t.length < 4) return null;
  if (t.length > 2400 && !/\b(?:remember|remind me|note that|for later)\b/.test(t)) return null;

  if (/\b(?:remind me to|remember to|don't let me forget|do not let me forget|follow up(?: with)?|check back(?: on)?)\b/.test(t)) {
    return { kind: 'reminder', confidence: 0.9 };
  }

  if (/\b(?:appointment|appt|meeting|doctor|dentist|therapy|interview|calendar)\b/.test(t)) {
    return { kind: 'appointment', confidence: 0.9 };
  }

  if (/\b(?:i have|i've got|i got|my)\b.{0,80}\b(?:call|appointment|appt|meeting)\b/.test(t)) {
    return { kind: 'appointment', confidence: 0.85 };
  }

  if (/\b(?:i have|i've got|i got|my)\b.{0,80}\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/.test(t)) {
    return { kind: 'appointment', confidence: 0.72 };
  }

  if (/\b(?:i'm thinking about|i am thinking about|i was thinking about|i keep thinking about|idea:|thesis:|note idea|i wonder if)\b/.test(t)) {
    return { kind: 'thought', confidence: 0.82 };
  }

  if (/\b(?:i prefer|i like|i don't like|i do not like|keep the|keep this|stop doing|always|never)\b/.test(t)) {
    return { kind: 'preference', confidence: 0.78 };
  }

  if (/\b(?:remember that|note that|save this|for later|log this)\b/.test(t)) {
    return { kind: 'note', confidence: 0.75 };
  }

  return null;
}

function extractTimeHint(text) {
  const source = String(text || '');
  const parts = [];
  const patterns = [
    /\b(?:at|around|by|before|after)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/ig,
    /\b(?:today|tomorrow|tonight|this morning|this afternoon|this evening|next week|this week|next month)\b/ig,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig,
    /\bon\s+(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[a-z]+ \d{1,2}(?:st|nd|rd|th)?)\b/ig,
  ];
  for (const pattern of patterns) {
    const matches = source.match(pattern) || [];
    for (const match of matches) parts.push(match.replace(/\s+/g, ' ').trim());
  }
  return [...new Set(parts.map(part => part.toLowerCase()))].slice(0, 3).join(', ') || null;
}

function extractTags(text, kind) {
  const tags = new Set([kind]);
  const t = String(text || '').toLowerCase();
  if (/\b(?:trade|trading|es|nq|spx|spy|qqq|market|pine|katbot|sybil|radar)\b/.test(t)) tags.add('trading-adjacent');
  if (/\b(?:doctor|dentist|therapy|health|gym)\b/.test(t)) tags.add('personal-logistics');
  if (/\b(?:work|job|interview|client|meeting|call)\b/.test(t)) tags.add('work');
  if (/\b(?:idea|thesis|thinking|wonder)\b/.test(t)) tags.add('idea');
  return [...tags];
}

function makeEntry(input = {}, classification, now) {
  const text = compactText(input.text || input.message || '');
  const surface = input.surface === 'system' ? 'system' : 'trading';
  const timeHint = extractTimeHint(text);
  const idHash = sha256([classification.kind, text.toLowerCase(), timeHint || ''].join('|')).slice(0, 16);
  return {
    id: `mem_${idHash}`,
    ts: now.toISOString(),
    updated_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    surfaces: [surface],
    surface,
    kind: classification.kind,
    confidence: classification.confidence,
    text,
    title: compactText(text, 90),
    time_hint: timeHint,
    tags: extractTags(text, classification.kind),
    active: true,
    source: 'chat',
  };
}

function writeMemoryEvent(entry, eventType, options = {}) {
  const paths = options.paths || defaultPaths;
  const eventPath = paths.events && paths.events.companionMemory;
  if (!eventPath) return;
  try {
    appendJsonl(eventPath, {
      ts: nowDate(options).toISOString(),
      event: eventType,
      entry_id: entry.id,
      kind: entry.kind,
      surface: entry.surface,
      text_preview: compactText(entry.text, 160),
    });
  } catch {}
}

function recordRadarMemory(entry, options = {}) {
  if (options.recordRadar === false) return null;
  const paths = options.paths || defaultPaths;
  try {
    const result = recordRadarIngest({
      text: entry.text,
      title: entry.title,
      source_label: 'luke-memory',
      source_type: entry.kind === 'appointment' || entry.kind === 'reminder' ? 'reminder' : 'manual_paste',
      relationship_ids: [entry.id],
    }, { paths, now: nowDate(options) });
    return result.item || null;
  } catch {
    return null;
  }
}

function captureCompanionMemory(input = {}, options = {}) {
  const text = compactText(input.text || input.message || '', MAX_TEXT_CHARS);
  if (!text) return { ok: true, captured: false, reason: 'empty' };
  if (looksLikeMemoryQuestion(text)) return { ok: true, captured: false, reason: 'question' };

  const classification = classifyMemory(text);
  if (!classification) return { ok: true, captured: false, reason: 'no-memory-signal' };

  const now = nowDate(options);
  const { memory, store } = loadStore(options);
  const nextEntry = makeEntry({ ...input, text }, classification, now);
  const existing = store.entries.find(entry => entry.id === nextEntry.id);

  let entry = nextEntry;
  let duplicate = false;
  if (existing) {
    duplicate = true;
    const surface = nextEntry.surface;
    entry = {
      ...existing,
      updated_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      surfaces: [...new Set([...(existing.surfaces || []), surface])],
      surface: existing.surface || surface,
      active: true,
    };
    store.entries = store.entries.map(item => item.id === entry.id ? entry : item);
  } else {
    const radarItem = recordRadarMemory(nextEntry, options);
    if (radarItem && radarItem.id) nextEntry.radar_item_id = radarItem.id;
    store.entries.push(nextEntry);
  }

  store.updated_at = now.toISOString();
  saveStore(memory, store, options);
  writeMemoryEvent(entry, duplicate ? 'seen-again' : 'captured', options);

  return {
    ok: true,
    captured: true,
    duplicate,
    entry,
    reply: formatCaptureAck(entry, duplicate),
  };
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length > 1 && !STOP_WORDS.has(token)) || [];
}

function scoreEntry(entry, queryTokens, queryText) {
  const entryTokens = new Set(tokenize([entry.text, entry.kind, entry.time_hint, ...(entry.tags || [])].join(' ')));
  let score = 0;
  for (const token of queryTokens) {
    if (entryTokens.has(token)) score += 3;
    if ((entry.time_hint || '').toLowerCase().includes(token)) score += 2;
  }
  const q = queryText.toLowerCase();
  if (/\bappointments?\b|\bmeetings?\b|\bcalls?\b/.test(q) && entry.kind === 'appointment') score += 8;
  if (/\breminders?\b|\bremember\b/.test(q) && entry.kind === 'reminder') score += 7;
  if (/\bthinking\b|\bthoughts?\b|\bideas?\b/.test(q) && entry.kind === 'thought') score += 7;
  if (/\bprefs?\b|\bpreferences?\b|\blike\b/.test(q) && entry.kind === 'preference') score += 6;
  const timeMatches = q.match(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/g) || [];
  for (const time of timeMatches) {
    const normalized = time.replace(/^at\s*/, '').trim();
    if ((entry.time_hint || '').includes(normalized) || entry.text.toLowerCase().includes(`at ${normalized}`)) score += 10;
  }
  if (entry.active === false) score -= 5;
  return score;
}

function searchCompanionMemory(input = {}, options = {}) {
  const query = compactText(input.query || input.message || input.text || '', 500);
  const queryTokens = tokenize(query);
  const { store } = loadStore(options);
  const limit = Number(options.limit || 6);
  return store.entries
    .map(entry => ({ entry, score: scoreEntry(entry, queryTokens, query) }))
    .filter(row => row.score > 0 || !query)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.entry.updated_at || b.entry.ts || 0).getTime() - new Date(a.entry.updated_at || a.entry.ts || 0).getTime();
    })
    .slice(0, limit)
    .map(row => ({ ...row.entry, score: row.score }));
}

function formatEntryLine(entry) {
  const label = KIND_LABELS[entry.kind] || 'Memory';
  const time = entry.time_hint ? ` (${entry.time_hint})` : '';
  return `${label}: ${entry.text}${time}`;
}

function formatCaptureAck(entry, duplicate = false) {
  const label = KIND_LABELS[entry.kind] || 'Memory';
  const verb = duplicate ? 'Refreshed' : 'Saved';
  const time = entry.time_hint ? ` Time hint: ${entry.time_hint}.` : '';
  return `${verb} shared memory. ${label}: ${entry.text}${time}`;
}

function answerCompanionMemoryQuestion(input = {}, options = {}) {
  const text = compactText(input.text || input.message || '', 500);
  if (!looksLikeMemoryQuestion(text)) return { ok: true, answered: false, reason: 'not-memory-question' };

  const matches = searchCompanionMemory({ query: text }, { ...options, limit: options.limit || 5 });
  if (matches.length === 0) {
    return {
      ok: true,
      answered: true,
      reply: "I don't have that in shared memory yet.",
      matches: [],
    };
  }
  const lines = matches.slice(0, 4).map(entry => `- ${formatEntryLine(entry)}`);
  return {
    ok: true,
    answered: true,
    reply: `Shared memory has this:\n${lines.join('\n')}`,
    matches,
  };
}

function shouldAckCapture(text) {
  const t = String(text || '').toLowerCase();
  if (isLikelyQuestion(t)) return false;
  if (/\b(?:what do you think|should i|can you|could you|how would|why)\b/.test(t)) return false;
  return true;
}

function handleCompanionMemoryTurn(input = {}, options = {}) {
  const text = compactText(input.text || input.message || '', MAX_TEXT_CHARS);
  const answer = answerCompanionMemoryQuestion({ text, surface: input.surface }, options);
  if (answer.answered) return { handled: true, reply: answer.reply, answer };

  const capture = captureCompanionMemory({ text, surface: input.surface }, options);
  if (capture.captured && shouldAckCapture(text)) {
    return { handled: true, reply: capture.reply, capture };
  }
  return { handled: false, capture };
}

function latestEntries(options = {}) {
  const { store } = loadStore(options);
  return [...store.entries]
    .filter(entry => entry.active !== false)
    .sort((a, b) => new Date(b.updated_at || b.ts || 0).getTime() - new Date(a.updated_at || a.ts || 0).getTime())
    .slice(0, Number(options.limit || 6));
}

function loadRoadmapBrief(options = {}) {
  const paths = options.paths || defaultPaths;
  const root = paths.ROOT || defaultPaths.ROOT;
  const files = [
    path.join(root, 'docs', 'CURRENT_STATUS.md'),
    path.join(root, 'docs', 'LUKE_90_DAY_NOW_ROADMAP.md'),
  ];
  const snippets = [];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^[-*]\s+/.test(line) && /(?:radar|daily|memory|trading|gate|roadmap|status|next|proof|blocked)/i.test(line))
        .slice(0, 3)
        .map(line => line.replace(/^[-*]\s+/, ''));
      snippets.push(...lines);
    } catch {}
  }
  return [...new Set(snippets)].slice(0, 5);
}

function buildCompanionContext(input = {}, options = {}) {
  const surface = input.surface === 'system' ? 'system' : 'trading';
  const relevant = searchCompanionMemory({ query: input.message || input.text || '' }, { ...options, limit: 4 });
  const recent = latestEntries({ ...options, limit: 4 });
  const roadmap = loadRoadmapBrief(options);
  const seen = new Set();
  const memoryLines = [...relevant, ...recent]
    .filter(entry => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .slice(0, 6)
    .map(entry => `- ${formatEntryLine(entry)}`);

  return [
    'Luke companion context:',
    `- Active surface: ${surface}. System chat and Trading chat share one companion memory bin.`,
    '- Use shared memory for appointments, reminders, preferences, and active thoughts across both surfaces.',
    '- Be useful, direct, and honest. Do not placate. Say when data is missing or outside current scope.',
    '- Trading remains supervised and human-gated. Do not claim live execution, Pine compile, or broker readiness unless verified in the current runtime.',
    '- Current product direction: Radar intake, Daily planning, shared memory, and supervised trading support are being unified into the front-facing Luke experience.',
    roadmap.length ? `- Current roadmap signals: ${roadmap.join(' | ')}` : null,
    memoryLines.length ? 'Relevant shared memory:' : null,
    ...memoryLines,
  ].filter(Boolean).join('\n');
}

function buildCompanionMemorySnapshot(options = {}) {
  const recent = latestEntries({ ...options, limit: Number(options.limit || 12) });
  const counts = {};
  for (const entry of recent) counts[entry.kind] = (counts[entry.kind] || 0) + 1;
  return {
    ok: true,
    label: 'Luke Shared Memory',
    store_key: STORE_KEY,
    entries: recent,
    counts,
    summary_line: recent.length ? `${recent.length} recent shared memory entries` : 'ready / no shared entries',
  };
}

module.exports = {
  STORE_KEY,
  answerCompanionMemoryQuestion,
  buildCompanionContext,
  buildCompanionMemorySnapshot,
  captureCompanionMemory,
  handleCompanionMemoryTurn,
  searchCompanionMemory,
  _internal: {
    classifyMemory,
    extractTimeHint,
    looksLikeMemoryQuestion,
    scoreEntry,
    tokenize,
  },
};
