'use strict';

const fs = require('fs');
const path = require('path');
const { events, ROOT } = require('../paths');
const { parseManualDiscordPaste } = require('./manual-paste');
const { parseSybilContexts } = require('./sybil');

const SYBIL_RESEARCH_BIN_DIR = path.join(ROOT, 'data', 'research', 'sybil-katbot');
const SYBIL_MANUAL_MESSAGES_FILE = path.join(SYBIL_RESEARCH_BIN_DIR, 'manual-sybil-messages.jsonl');
const SYBIL_CONTEXT_FILE = path.join(SYBIL_RESEARCH_BIN_DIR, 'manual-sybil-context.jsonl');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function appendJsonl(file, rows) {
  const safeRows = rows || [];
  if (!safeRows.length) return;
  ensureDir(file);
  fs.appendFileSync(file, safeRows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

function existingJsonlKeys(file, keyName) {
  const keys = new Set();
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        const key = row?.[keyName];
        if (key) keys.add(String(key));
      } catch {}
    }
  } catch {}
  return keys;
}

function appendJsonlDedupe(file, rows, keyName) {
  const safeRows = rows || [];
  if (!safeRows.length) return { written: 0, skipped: 0 };
  const seen = existingJsonlKeys(file, keyName);
  const toWrite = [];
  for (const row of safeRows) {
    const key = row?.[keyName];
    if (key && seen.has(String(key))) continue;
    if (key) seen.add(String(key));
    toWrite.push(row);
  }
  appendJsonl(file, toWrite);
  return { written: toWrite.length, skipped: safeRows.length - toWrite.length };
}

function looksLikeManualSybilPaste(text) {
  const source = String(text || '');
  if (source.length < 20) return false;
  const hasDiscordBlocks = /\[\d{1,2}:\d{2}\s*[AP]M\]/i.test(source);
  const hasSybil = /\b(?:@?Sybil|Sibyl Research Pipeline|APP\s*\n\s*Sybil\s*:)/i.test(source);
  const hasResearchArm = /\bresearch arm\b|\bevent stack\b|\bSpotGamma\b|\bHIRO\b|\bLow Vol Point\b|\bCall Wall\b/i.test(source);
  return hasSybil || (hasDiscordBlocks && hasResearchArm);
}

function buildSybilCaptureReply(parsed) {
  const summary = parsed?.summary || {};
  const tags = Object.entries(summary.tag_counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([tag, count]) => `${tag}=${count}`);
  const channels = Object.keys(summary.channels || {});
  return [
    `Sybil/server context captured: ${summary.messages || 0} message rows, ${summary.context_records || 0} context records.`,
    tags.length ? `Top tags: ${tags.join(', ')}.` : 'No strong tags yet.',
    channels.length ? `Source lane: ${channels.join(', ')}.` : 'Source lane: manual-sybil-paste.',
    'Stored as context only. No trade was staged.',
  ].join('\n');
}

function captureManualSybilPaste(text, options = {}) {
  const pastedAtUtc = options.pastedAtUtc || new Date().toISOString();
  const rows = parseManualDiscordPaste(text, {
    baseDate: options.baseDate || pastedAtUtc.slice(0, 10),
    utcOffset: options.utcOffset || '-04:00',
    channelName: options.channelName || 'manual-sybil-paste',
    channelId: options.channelId || null,
    sourceCollection: options.sourceCollection || 'sybil',
    sourceType: options.sourceType || 'manual_paste',
    provenanceNote: options.provenanceNote || 'trading chat manual paste',
    pastedAtUtc,
    idPrefix: options.idPrefix || 'manual_sybil',
  });
  const parsed = parseSybilContexts(rows);
  const messageWrite = appendJsonlDedupe(options.messagesFile || SYBIL_MANUAL_MESSAGES_FILE, rows, 'dedupe_key');
  const contextWrite = appendJsonlDedupe(options.contextFile || SYBIL_CONTEXT_FILE, parsed.contexts, 'context_id');
  return {
    ok: true,
    rows,
    contexts: parsed.contexts,
    summary: parsed.summary,
    reply: buildSybilCaptureReply(parsed),
    writes: {
      messages: messageWrite,
      contexts: contextWrite,
    },
    output_files: {
      messages: options.messagesFile || SYBIL_MANUAL_MESSAGES_FILE,
      contexts: options.contextFile || SYBIL_CONTEXT_FILE,
      session: events.session,
    },
  };
}

async function handleManualSybilPaste(message, res, options = {}) {
  if (options.force !== true && !looksLikeManualSybilPaste(message)) return false;
  const result = captureManualSybilPaste(message, options);
  res.json({
    reply: result.reply,
    state: 'regulated',
    sybil_context: {
      messages: result.summary.messages,
      context_records: result.summary.context_records,
      low_signal_records: result.summary.low_signal_records,
      tag_counts: result.summary.tag_counts,
    },
  });
  return true;
}

module.exports = {
  SYBIL_RESEARCH_BIN_DIR,
  SYBIL_CONTEXT_FILE,
  SYBIL_MANUAL_MESSAGES_FILE,
  buildSybilCaptureReply,
  captureManualSybilPaste,
  handleManualSybilPaste,
  looksLikeManualSybilPaste,
};
