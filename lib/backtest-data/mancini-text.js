'use strict';

// Normalize Adam Mancini Reddit posts from the ThePiratesDen scrape.
//
// File format (most-recent-first):
//   Thread header line
//   blank line
//   [–]Adam_Mankini N points RELATIVE_TIMESTAMP
//   blank line
//   CONTENT (one or more paragraphs)
//   blank line
//   permalinksa...report
//   Thread header for NEXT post
//   ...
//
// Timestamps are relative (e.g. "an hour ago", "1 day ago", "1 month ago").
// Date reconstruction anchors on thread header week + relative offset from scrapeDate.
// Posts that cannot be dated within ±1 day receive timestampConfidence: 'low'.

const fs = require('fs');

// ── Mojibake normalizer ───────────────────────────────────────────────────────
// Defensive fix for Windows-1252 chars mis-decoded as UTF-8.
// The current Mancini.txt is clean but future re-exports may not be.
const MOJIBAKE_MAP = [
  [/â€"/g,  '–'],   // en dash
  [/â€"/g,  '—'],   // em dash
  [/â€˜/g,  '‘'], // left single quote
  [/â€™/g,  '’'], // right single quote
  [/â€œ/g,  '“'], // left double quote
  [/â€/g,   '”'], // right double quote
  [/Â©/g,   '©'],
  [/Ã©/g,   'é'],
  [/Ã /g,   'à'],
];

function normalizeMojibake(text) {
  let s = text;
  for (const [pat, rep] of MOJIBAKE_MAP) s = s.replace(pat, rep);
  return s;
}

// ── Thread header parsing ─────────────────────────────────────────────────────
const THREAD_HEADER_RE =
  /The (?:\w+ )+for (?:Week of |Weekend Lounge for |Egg Hunt Weekend Lounge for )?(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function parseThreadHeader(text) {
  const m = THREAD_HEADER_RE.exec(text);
  if (!m) return null;
  const [, month, day, year] = m;
  // "Week of M/D/YYYY" — the date given is typically a Sunday.
  // The trading week starts the following Monday.
  const anchorDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { raw: text.trim(), anchorDate };
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function candidateTradingDatesFromThreadHeader(threadHeader) {
  if (!threadHeader?.anchorDate) return [];
  return [1, 2, 3, 4, 5].map(offset => addDays(threadHeader.anchorDate, offset));
}

// ── Relative timestamp parsing ────────────────────────────────────────────────
// Returns { value, unit, confidence } or null.
const REL_TS_RE = /^(\d+)\s+(hour|day|month)s?\s+ago$/i;
const AN_HOUR_RE = /^an\s+hour\s+ago$/i;

function parseRelativeTimestamp(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (AN_HOUR_RE.test(s)) return { value: 1, unit: 'hour', raw: s };
  const m = REL_TS_RE.exec(s);
  if (!m) return null;
  return { value: parseInt(m[1], 10), unit: m[2].toLowerCase(), raw: s };
}

// Reconstruct calendar date from relative timestamp + scrapeDate.
// scrapeDate: 'YYYY-MM-DD' string (the day the scrape was taken).
// Returns { date: 'YYYY-MM-DD', confidence: 'high'|'low' }
function reconstructDate(relTs, scrapeDate) {
  if (!relTs || !scrapeDate) return { date: null, confidence: 'low' };
  const { value, unit } = relTs;
  if (unit === 'month') return { date: null, confidence: 'week' };

  const base = new Date(scrapeDate + 'T12:00:00Z');
  if (unit === 'hour') {
    // Same calendar day (ET) as scrape
    return { date: scrapeDate, confidence: 'high' };
  }
  if (unit === 'day') {
    base.setUTCDate(base.getUTCDate() - value);
    return { date: base.toISOString().slice(0, 10), confidence: value <= 31 ? 'high' : 'low' };
  }
  return { date: null, confidence: 'low' };
}

// ── Level + role extraction ───────────────────────────────────────────────────
// Extracts ES/SPX price levels from post content with best-effort role tagging.
// Roles: support | resistance | target | chop_zone | watch_trap | reclaim | unclassified

// Price numbers in futures/index range: 4000–8999
const PRICE_RE = /\b([4-8]\d{3}(?:\.\d{1,2})?)\b/g;

const ROLE_HINTS = [
  { re: /support/i,                              role: 'support' },
  { re: /resistance/i,                           role: 'resistance' },
  { re: /target/i,                               role: 'target' },
  { re: /chop(?:\s+zone)?/i,                     role: 'chop_zone' },
  { re: /watch\s+trap|trap/i,                    role: 'watch_trap' },
  { re: /reclaim|must\s+recover|must\s+clear/i,  role: 'reclaim' },
];

// Find the role keyword nearest to the price number in the post text.
function inferRole(text, matchIndex) {
  const WINDOW = 80; // characters to look before/after the price
  const snippet = text.slice(Math.max(0, matchIndex - WINDOW), matchIndex + WINDOW);
  for (const { re, role } of ROLE_HINTS) {
    if (re.test(snippet)) return role;
  }
  return 'unclassified';
}

function extractLevels(content) {
  PRICE_RE.lastIndex = 0;
  const levels = [];
  let m;
  while ((m = PRICE_RE.exec(content)) !== null) {
    levels.push({
      price: parseFloat(m[1]),
      role: inferRole(content, m.index),
    });
  }
  // Deduplicate by price, keeping the first occurrence's role
  const seen = new Map();
  for (const l of levels) {
    if (!seen.has(l.price)) seen.set(l.price, l);
  }
  return [...seen.values()];
}

// ── Post header parsing ───────────────────────────────────────────────────────
// Chunk starts with: " N points RELATIVE_TIMESTAMP \n\n"
const POST_HEADER_RE = /^[\s\S]*?(\d+)\s+points?\s+((?:an\s+hour|[\d]+\s+(?:hour|day|month)s?)\s+ago)/i;

function parsePostHeader(chunk) {
  const m = POST_HEADER_RE.exec(chunk);
  if (!m) return { score: null, relativeTimestampRaw: null };
  return { score: parseInt(m[1], 10), relativeTimestampRaw: m[2].trim() };
}

// Extract post body: text between first blank line and "permalinksa..." footer
function extractContent(chunk) {
  // After the first line (points/timestamp) there's a blank line, then content
  const lines = chunk.split(/\r?\n/);
  let bodyStart = -1;
  let bodyEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (bodyStart === -1 && trimmed === '' && i > 0) {
      bodyStart = i + 1;
      continue;
    }
    if (bodyStart !== -1 && trimmed.startsWith('permalink')) {
      bodyEnd = i;
      break;
    }
  }

  if (bodyStart === -1) return chunk.trim();
  return lines.slice(bodyStart, bodyEnd).join('\n').trim();
}

// Extract the thread header that appears at the end of a preceding chunk
// (or in the preamble chunk for the first post).
function extractTrailingHeader(chunk) {
  const lines = chunk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (THREAD_HEADER_RE.test(lines[i])) return parseThreadHeader(lines[i]);
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Parse Mancini text (string) into normalized post records.
// scrapeDate: 'YYYY-MM-DD' — the day the file was scraped. Used for relative timestamp reconstruction.
//   Pass null if unknown; all timestamps will be low-confidence.
function parseManciniText(text, { scrapeDate = null } = {}) {
  const normalized = normalizeMojibake(text);
  const POST_DELIM = '[–]Adam_Mankini';
  const chunks = normalized.split(POST_DELIM);
  // chunk[0] is the preamble (before first post). chunks[1+] are posts.

  const posts = [];
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const precedingChunk = chunks[i - 1]; // contains thread header for this post

    const { score, relativeTimestampRaw } = parsePostHeader(chunk);
    const content = extractContent(chunk);
    const threadHeader = extractTrailingHeader(precedingChunk);
    const relTs = parseRelativeTimestamp(relativeTimestampRaw);
    const { date, confidence } = reconstructDate(relTs, scrapeDate);
    const candidateTradingDates = candidateTradingDatesFromThreadHeader(threadHeader);

    posts.push({
      postIndex: i,
      threadHeader: threadHeader ? { raw: threadHeader.raw, anchorDate: threadHeader.anchorDate } : null,
      score,
      relativeTimestampRaw: relativeTimestampRaw ?? null,
      estimatedDate: date,
      timestampConfidence: confidence,
      candidateTradingDates,
      content,
      levels: extractLevels(content),
      parseWarnings: [
        ...(score === null ? ['no_score_parsed'] : []),
        ...(relativeTimestampRaw === null ? ['no_timestamp_parsed'] : []),
        ...(content.length === 0 ? ['empty_content'] : []),
      ],
    });
  }

  return posts;
}

// Load and parse from file path.
function loadManciniText(filePath, options = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parseManciniText(text, options);
}

module.exports = {
  loadManciniText,
  parseManciniText,
  _internal: {
    normalizeMojibake,
    parseThreadHeader,
    candidateTradingDatesFromThreadHeader,
    parseRelativeTimestamp,
    reconstructDate,
    extractLevels,
    extractContent,
    extractTrailingHeader,
  },
};
