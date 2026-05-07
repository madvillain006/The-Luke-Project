'use strict';

const { sha256 } = require('./io');

const TIMESTAMP_RE = /^\[(\d{1,2}:\d{2}\s*[AP]M)\]\s*(.*)$/i;
const APP_AUTHOR_RE = /^\s*Sybil\s*:\s*(.*)$/i;

function parseLocalClock(clock, options = {}) {
  const baseDate = options.baseDate || String(options.pastedAtUtc || new Date().toISOString()).slice(0, 10);
  const offset = options.utcOffset || '-04:00';
  const match = String(clock || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const iso = `${baseDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offset}`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function normalizeAuthorName(value) {
  const raw = String(value || '').replace(/\s*\[[^\]]+\]\s*,?\s*$/g, '').trim();
  const ascii = raw.replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
  return ascii || raw || 'unknown';
}

function parseUserLine(rest, bodyLines) {
  const source = [rest, ...(bodyLines || [])].join('\n').trim();
  const match = source.match(/^(.+?)\s*,?\s*:\s*([\s\S]*)$/);
  if (!match) {
    return { authorName: 'unknown', rawText: source };
  }
  return {
    authorName: normalizeAuthorName(match[1]),
    rawText: match[2].trim(),
  };
}

function parseAppBlock(bodyLines) {
  const lines = [...(bodyLines || [])];
  if (lines[0] && lines[0].trim().toUpperCase() === 'APP') lines.shift();
  const first = lines.shift() || '';
  const match = first.match(APP_AUTHOR_RE);
  if (!match) {
    return {
      authorName: 'Sybil',
      rawText: [first, ...lines].join('\n').trim(),
      isApp: true,
    };
  }
  return {
    authorName: 'Sybil',
    rawText: [match[1], ...lines].join('\n').trim(),
    isApp: true,
  };
}

function splitPasteBlocks(text) {
  const blocks = [];
  let current = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(TIMESTAMP_RE);
    if (match) {
      if (current) blocks.push(current);
      current = { clock: match[1], rest: match[2] || '', lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseManualDiscordPaste(text, options = {}) {
  const sourceCollection = options.sourceCollection || 'sybil';
  const channelName = options.channelName || 'manual-sybil-paste';
  const sourceType = options.sourceType || 'manual_paste';
  const pastedAtUtc = options.pastedAtUtc || new Date().toISOString();
  return splitPasteBlocks(text).map((block, index) => {
    const body = block.rest.trim()
      ? parseUserLine(block.rest, block.lines)
      : parseAppBlock(block.lines);
    const rawText = String(body.rawText || '').trim();
    const timestampUtc = parseLocalClock(block.clock, options);
    const hash = sha256([sourceCollection, channelName, index, block.clock, body.authorName, rawText].join('|'));
    return {
      message_id: options.idPrefix ? `${options.idPrefix}_${hash.slice(0, 16)}` : `manual_${hash.slice(0, 20)}`,
      channel_id: options.channelId || null,
      channel_name: channelName,
      author_id: null,
      author_name: body.authorName,
      timestamp_utc: timestampUtc,
      timestamp_local: block.clock,
      raw_text: rawText,
      attachments: [],
      embeds: [],
      referenced_message_id: null,
      thread_id: null,
      source_type: sourceType,
      source_collection: sourceCollection,
      source_file: null,
      provenance_note: options.provenanceNote || null,
      ingestion_timestamp: pastedAtUtc,
      content_hash: sha256(rawText),
      dedupe_key: [sourceType, sourceCollection, channelName, timestampUtc || block.clock, hash.slice(0, 20)].join(':'),
      backfill: true,
      app_message: body.isApp === true,
    };
  }).filter(row => row.raw_text);
}

module.exports = {
  parseLocalClock,
  parseManualDiscordPaste,
  splitPasteBlocks,
};
