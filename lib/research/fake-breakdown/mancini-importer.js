'use strict';

const fs = require('fs');
const path = require('path');
const { etIso, isParseableTimestamp } = require('../common');

const SUPPORTED = new Set(['.md', '.txt', '.json', '.csv', '.jsonl']);
const MONTHS = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

function normalizeTimestamp(raw) {
  if (!raw) return { timestamp_et: null, quality: 'missing' };
  const text = String(raw).trim();
  if (isParseableTimestamp(text) && /T/.test(text)) return { timestamp_et: text, quality: 'exact' };
  const dateTime = text.match(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dateTime) {
    const hh = dateTime[2].padStart(2, '0');
    const ss = dateTime[4] || '00';
    return { timestamp_et: etIso(dateTime[1], `${hh}:${dateTime[3]}:${ss}`), quality: 'exact' };
  }
  const social = text.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\s*[·•]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (social) {
    let hour = Number(social[1]);
    const minute = social[2];
    const ampm = social[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const month = MONTHS[social[4].toLowerCase()];
    if (month) {
      const day = social[5].padStart(2, '0');
      return {
        timestamp_et: etIso(`${social[6]}-${month}-${day}`, `${String(hour).padStart(2, '0')}:${minute}:00`),
        quality: 'exact',
      };
    }
  }
  const dateOnly = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateOnly) return { timestamp_et: etIso(dateOnly[1], '09:25:00'), quality: 'date_only' };
  return { timestamp_et: null, quality: 'missing' };
}

function parseLevels(text) {
  const nums = String(text || '').match(/\b[5-8]\d{3}(?:\.\d{1,2})?\b/g) || [];
  const seen = new Set();
  return nums.map(Number).filter(n => {
    const key = n.toFixed(2);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(price => ({
    price,
    role: inferRole(text, price),
  }));
}

function inferRole(text, price) {
  const lower = String(text || '').toLowerCase();
  const idx = lower.indexOf(String(Math.round(price)));
  const afterRaw = idx >= 0 ? lower.slice(idx + String(Math.round(price)).length, idx + 80) : lower;
  const nextNumber = afterRaw.search(/\b[5-8]\d{3}(?:\.\d{1,2})?\b/);
  const after = nextNumber >= 0 ? afterRaw.slice(0, nextNumber) : afterRaw;
  const around = idx >= 0 ? lower.slice(Math.max(0, idx - 50), idx + 80) : lower;
  if (/chop/.test(after) || /chop/.test(around)) return 'chop_zone';
  if (/target|resistance|short/.test(after)) return 'target';
  if (/support|hold|reclaim|long/.test(after)) return 'support';
  if (/trigger/.test(after)) return 'trigger';
  if (/target|resistance|short/.test(around)) return 'target';
  if (/support|hold|reclaim|long/.test(around)) return 'support';
  if (/trigger/.test(around)) return 'trigger';
  return 'level';
}

function sourceReference(text) {
  const url = String(text || '').match(/https?:\/\/\S+/);
  const postId = String(text || '').match(/\bstatus\/(\d+)\b/) || String(text || '').match(/\bpost[_ -]?id[:=]\s*(\d+)\b/i);
  return {
    url: url ? url[0].replace(/[)\].,]+$/, '') : null,
    post_id: postId ? postId[1] : null,
  };
}

function eventFromText({ text, sourcePath, rowIndex = 0 }) {
  const timestamp = normalizeTimestamp(text);
  const levels = parseLevels(text);
  const ref = sourceReference(text);
  const usable = timestamp.quality === 'exact' && levels.length > 0;
  const base = {
    id: `mancini-import:${path.basename(sourcePath)}:${rowIndex}`,
    source: 'mancini',
    source_type: 'mancini_imported_archive',
    timestamp_et: timestamp.timestamp_et,
    available_at_et: timestamp.timestamp_et,
    timestamp_quality: timestamp.quality,
    levels,
    source_reference: ref,
    raw_path: sourcePath,
    raw_content_redacted: true,
  };
  if (!usable) {
    return {
      ...base,
      usable_for_replay: false,
      unusable_reason: timestamp.quality !== 'exact'
        ? `timestamp_${timestamp.quality}`
        : 'no_levels_found',
    };
  }
  return { ...base, usable_for_replay: true, unusable_reason: null };
}

function parseDelimited(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return lines.map((line, index) => ({ text: line, rowIndex: index + 1 }));
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const textIdx = header.findIndex(h => /content|text|body|post/.test(h));
  const timeIdx = header.findIndex(h => /time|date|created/.test(h));
  return lines.slice(1).map((line, index) => {
    const parts = line.split(',');
    return {
      text: [parts[timeIdx], parts[textIdx]].filter(Boolean).join(' '),
      rowIndex: index + 2,
    };
  });
}

function splitTextArchive(raw) {
  const lines = raw.split(/\r?\n/);
  const chunks = [];
  let buffer = [];
  const timestampLine = /\b\d{1,2}:\d{2}\s*(?:AM|PM)\s*[·•]\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}\b/i;
  for (const line of lines) {
    buffer.push(line);
    if (timestampLine.test(line)) {
      chunks.push(buffer.join('\n').trim());
      buffer = [];
    }
  }
  if (chunks.length) {
    const tail = buffer.join('\n').trim();
    if (tail) chunks.push(tail);
    return chunks.map((text, index) => ({ text, rowIndex: index + 1 }));
  }
  return raw.split(/\n\s*\n/).filter(Boolean).map((text, index) => ({ text, rowIndex: index + 1 }));
}

function parseArchiveFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED.has(ext)) throw new Error(`unsupported Mancini archive format: ${ext}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  let chunks = [];
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    chunks = rows.map((row, index) => ({ text: JSON.stringify(row), rowIndex: index + 1 }));
  } else if (ext === '.jsonl') {
    chunks = raw.split(/\r?\n/).filter(Boolean).map((line, index) => ({ text: line, rowIndex: index + 1 }));
  } else if (ext === '.csv') {
    chunks = parseDelimited(raw);
  } else {
    chunks = splitTextArchive(raw);
  }
  const events = chunks.map(chunk => eventFromText({ text: chunk.text, sourcePath: filePath, rowIndex: chunk.rowIndex }));
  return {
    normalized: events.filter(event => event.usable_for_replay),
    quarantine: events.filter(event => !event.usable_for_replay),
  };
}

module.exports = {
  parseArchiveFile,
  eventFromText,
  normalizeTimestamp,
  parseLevels,
};
