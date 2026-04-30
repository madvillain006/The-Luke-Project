'use strict';

// Normalize Bobby Discord export JSON into per-message records.
// Does NOT call Anthropic vision or download Discord CDN.
// Bobby text and Bobby image sources are kept separate in the output.

const fs = require('fs');

const BOBBY_AUTHOR_NAMES = new Set(['BOBBY', 'BOBBYAXL']);

const INSTRUMENT_RE = /#?ES_F\b|#?NQ_F\b|\bES\b|\bSPX\b|\bNQ\b|\bSPY\b|\bQQQ\b/gi;

// ES futures and SPX are in the 3000–9999 range during this period.
// Avoid matching things like "1790" (comment counts) by requiring 4+ digits in 4000–8999.
const LEVEL_RE = /\b([4-8]\d{3}(?:\.\d{1,2})?)\b/g;

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

function isBobbyAuthor(author) {
  if (!author) return false;
  const nick = (author.nickname || '').toUpperCase();
  const name = (author.name || '').toUpperCase();
  return BOBBY_AUTHOR_NAMES.has(nick) || BOBBY_AUTHOR_NAMES.has(name);
}

// Convert a Discord timestamp string (ISO-8601 with ET offset) to a trading date ET.
// Uses the calendar date of the timestamp in ET. Does not roll forward at session boundary.
function tradingDateET(ts) {
  if (!ts) return null;
  // Extract offset: -04:00 or -05:00
  const offMatch = ts.match(/([+-]\d{2}:\d{2})$/);
  const offsetHours = offMatch ? parseInt(offMatch[1], 10) : -5;
  const utcMs = new Date(ts).getTime();
  if (!Number.isFinite(utcMs)) return null;
  const etMs = utcMs + offsetHours * 3600000;
  return new Date(etMs).toISOString().slice(0, 10);
}

function extractMentionedInstruments(content) {
  if (!content) return [];
  const matches = content.match(INSTRUMENT_RE) || [];
  const normalized = matches.map(m => m.replace(/^#/, '').replace(/_F$/, '').toUpperCase());
  return [...new Set(normalized)];
}

function extractLevelCandidates(content) {
  if (!content) return [];
  LEVEL_RE.lastIndex = 0;
  const seen = new Set();
  let m;
  while ((m = LEVEL_RE.exec(content)) !== null) {
    seen.add(parseFloat(m[1]));
  }
  return [...seen].sort((a, b) => a - b);
}

function normalizeAttachment(att) {
  const ext = (att.fileName || '').split('.').pop().toLowerCase();
  return {
    attachmentId: att.id,
    url: att.url || null,
    fileName: att.fileName || null,
    fileSizeBytes: att.fileSizeBytes || null,
    isImage: IMAGE_EXTS.has(ext),
  };
}

// Normalize one Bobby message into a structured record.
function normalizeMessage(msg) {
  const warnings = [];
  const content = msg.content || '';
  if (!content.trim()) warnings.push('empty_content');

  const attachments = (msg.attachments || []).map(normalizeAttachment);
  const imageUrls = attachments.filter(a => a.isImage).map(a => a.url).filter(Boolean);

  return {
    id: msg.id,
    timestamp: msg.timestamp,
    tradingDateET: tradingDateET(msg.timestamp),
    author: {
      id: msg.author?.id,
      name: msg.author?.name,
      nickname: msg.author?.nickname,
    },
    content,
    attachments,
    imageUrls,
    mentionedInstruments: extractMentionedInstruments(content),
    levelCandidates: extractLevelCandidates(content),
    parseWarnings: warnings,
  };
}

// Load and normalize all Bobby messages from a Discord export JSON file.
// Returns { messages: NormalizedMessage[], meta: { ... } }
function loadBobbyExport(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  const allMessages = (data.messages || []).sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  );

  const bobbyMessages = allMessages.filter(m => isBobbyAuthor(m.author));
  const normalized = bobbyMessages.map(normalizeMessage);

  const totalAttachments = normalized.reduce((s, m) => s + m.attachments.length, 0);
  const totalImageAtts   = normalized.reduce((s, m) => s + m.imageUrls.length, 0);

  return {
    messages: normalized,
    meta: {
      totalExportMessages: allMessages.length,
      bobbyMessages: normalized.length,
      firstTimestamp: normalized[0]?.timestamp ?? null,
      lastTimestamp:  normalized[normalized.length - 1]?.timestamp ?? null,
      totalAttachments,
      totalImageAttachments: totalImageAtts,
    },
  };
}

// Accept a pre-parsed array (for use in tests without hitting disk).
function normalizeBobbyMessages(messages) {
  const sorted = [...messages].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  );
  const bobby = sorted.filter(m => isBobbyAuthor(m.author));
  return bobby.map(normalizeMessage);
}

module.exports = {
  loadBobbyExport,
  normalizeBobbyMessages,
  tradingDateET,
  extractLevelCandidates,
  extractMentionedInstruments,
  _internal: { isBobbyAuthor, normalizeMessage, normalizeAttachment },
};
