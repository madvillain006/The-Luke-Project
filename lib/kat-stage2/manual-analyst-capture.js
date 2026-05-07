'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, compactText, sha256 } = require('./io');
const { parseManualDiscordPaste, splitPasteBlocks } = require('./manual-paste');
const { parseStage2Messages } = require('./parser');

const KATBOT_RESEARCH_BIN_DIR = path.join(ROOT, 'data', 'research', 'katbot', 'manual-stage2');
const MANUAL_ANALYST_MESSAGES_FILE = path.join(KATBOT_RESEARCH_BIN_DIR, 'manual-analyst-messages.jsonl');

const KNOWN_KATBOT_ANALYST_RE = /\b(?:barrysanders329|barry\s+sanders|general\s+dollars|kaprik0rn3|kaprikorn3|el\s+jefe|jefe|mathemeatloaf7)\b/i;
const KATBOT_CHANNEL_RE = /\b(?:trade-floor|barrys-breakdowns|spy-qqq-es-nq-vix|short-term|mid-long-term|heatmap-requests)\b/i;
const DISCORD_TIME_RE = /\[\d{1,2}:\d{2}\s*[AP]M\]/i;
const HEATMAP_RE = /\b(?:heatmap|heat\s+map|king\s+node|gatekeeper|air\s+pocket|spotgamma|hiro|gamma|call\s+wall|put\s+wall)\b/i;
const TRADE_LANGUAGE_RE = /\b(?:long|short|buy(?:ing)?|bought|sold|calls?|puts?|spread|entry|entered|trim|trimmed|target|tp\s*\d*|stop|stopped|runner|gains?|paid|premium|contracts?|risk|reclaim|breakout|breakdown|above|below|over|under)\b/i;
const CORE_SYMBOL_RE = /[$#]?\s*\b(?:SPXW|SPX|SPY|QQQ|NDX|IWM|DIA|ES|MES|NQ|MNQ|VIX)\b/i;
const OPTION_CONTRACT_RE = /\b(?:[A-Za-z]{1,5}\s+)?(?:(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d+DTE)\s+)?\d{2,5}(?:\.\d{1,2})?\s*[cCpP]\b/;
const CASH_TAG_RE = /[$#]\s*[A-Za-z]{1,5}\b/;
const QUESTION_RE = /^\s*(?:what|why|how|can|could|should|would|do|does|is|are|am)\b|[?]\s*$/i;

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

function normalizeChannelName(value) {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(KATBOT_CHANNEL_RE);
  return match ? match[0] : null;
}

function inferChannelName(text, options = {}) {
  return normalizeChannelName(options.channelName) ||
    normalizeChannelName(options.sourceLabel) ||
    normalizeChannelName(text) ||
    'manual-katbot-paste';
}

function looksLikePlainTradingPaste(text) {
  const source = String(text || '').trim();
  if (source.length < 12 || QUESTION_RE.test(source)) return false;
  const hasTradeLanguage = TRADE_LANGUAGE_RE.test(source);
  const hasTicker = CORE_SYMBOL_RE.test(source) || CASH_TAG_RE.test(source) || OPTION_CONTRACT_RE.test(source);
  const pasteShape = source.includes('\n') || source.length >= 28 || OPTION_CONTRACT_RE.test(source);
  return hasTradeLanguage && hasTicker && pasteShape;
}

function looksLikeManualAnalystPaste(text, options = {}) {
  const source = String(text || '');
  if (!source.trim()) return false;
  if (options.force === true) return true;
  const hasDiscordBlocks = DISCORD_TIME_RE.test(source) || splitPasteBlocks(source).length > 0;
  const hasKnownKatbotSource = KNOWN_KATBOT_ANALYST_RE.test(source) || KATBOT_CHANNEL_RE.test(source);
  if (hasDiscordBlocks && (hasKnownKatbotSource || HEATMAP_RE.test(source) || TRADE_LANGUAGE_RE.test(source))) return true;
  if (hasKnownKatbotSource && (HEATMAP_RE.test(source) || looksLikePlainTradingPaste(source))) return true;
  return looksLikePlainTradingPaste(source);
}

function singleManualRow(text, options = {}) {
  const pastedAtUtc = options.pastedAtUtc || new Date().toISOString();
  const channelName = inferChannelName(text, options);
  const rawText = String(text || '').trim();
  const hash = sha256(['manual_analyst', channelName, pastedAtUtc, rawText].join('|'));
  return {
    message_id: `${options.idPrefix || 'manual_analyst'}_${hash.slice(0, 16)}`,
    channel_id: options.channelId || null,
    channel_name: channelName,
    author_id: null,
    author_name: options.authorName || 'manual-paste',
    timestamp_utc: pastedAtUtc,
    timestamp_local: null,
    raw_text: rawText,
    attachments: [],
    embeds: [],
    referenced_message_id: null,
    thread_id: null,
    source_type: options.sourceType || 'manual_paste',
    source_collection: 'manual_analyst',
    source_file: null,
    provenance_note: options.provenanceNote || null,
    ingestion_timestamp: pastedAtUtc,
    content_hash: sha256(rawText),
    dedupe_key: ['manual-analyst', channelName, hash.slice(0, 20)].join(':'),
    backfill: true,
    app_message: false,
  };
}

function normalizeManualAnalystRows(text, options = {}) {
  const pastedAtUtc = options.pastedAtUtc || new Date().toISOString();
  const channelName = inferChannelName(text, options);
  const rows = parseManualDiscordPaste(text, {
    baseDate: options.baseDate || pastedAtUtc.slice(0, 10),
    utcOffset: options.utcOffset || '-04:00',
    channelName,
    channelId: options.channelId || null,
    sourceCollection: 'manual_analyst',
    sourceType: options.sourceType || 'manual_paste',
    provenanceNote: options.provenanceNote || 'manual KatBot analyst paste',
    pastedAtUtc,
    idPrefix: options.idPrefix || 'manual_analyst',
  });
  return rows.length ? rows : [singleManualRow(text, { ...options, pastedAtUtc, channelName })];
}

function summarizedRejected(parsed) {
  const counts = {};
  for (const row of parsed.rejected || []) counts[row.reason] = (counts[row.reason] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([reason, count]) => `${reason}=${count}`);
}

function buildManualAnalystReply(parsed, writeResult) {
  const s = parsed.summary || {};
  const lines = [
    `KatBot analyst paste captured: ${s.messages_processed || 0} message row${s.messages_processed === 1 ? '' : 's'}.`,
    `Parsed: ${s.valid_trade_calls || 0} valid call${s.valid_trade_calls === 1 ? '' : 's'}, ${s.partial_trade_calls || 0} partial, ${s.ambiguous_trade_calls || 0} ambiguous, ${s.trade_updates || 0} updates, ${s.gains_posts || 0} gains-only, ${s.heatmaps || 0} heatmaps.`,
  ];

  const missingRisk = (parsed.trade_calls || []).filter(row => row.parse_notes?.includes('stop_missing_so_r_multiple_unavailable')).length;
  if ((s.valid_trade_calls || 0) + (s.partial_trade_calls || 0) + (s.trade_updates || 0) + (s.gains_posts || 0) + (s.heatmaps || 0) === 0) {
    const rejected = summarizedRejected(parsed);
    lines.push(`Pushback: I would not count this yet${rejected.length ? ` (${rejected.join(', ')})` : ''}. Paste the full analyst line with ticker/contract, direction, entry, stop or invalidation, target/update, and timestamp.`);
  } else if ((s.partial_trade_calls || 0) > 0 || (s.ambiguous_trade_calls || 0) > 0 || missingRisk > 0) {
    lines.push(`Pushback: ${missingRisk ? `${missingRisk} call(s) are missing stop/invalidation. ` : ''}${s.partial_trade_calls || 0} partial and ${s.ambiguous_trade_calls || 0} ambiguous call(s) stay out of verified stats until clarified.`);
  }

  if (writeResult?.skipped) lines.push(`Dedupe: ${writeResult.skipped} duplicate row${writeResult.skipped === 1 ? '' : 's'} ignored.`);
  lines.push('No trade was staged.');
  return lines.join('\n');
}

function captureManualAnalystPaste(text, options = {}) {
  const rows = normalizeManualAnalystRows(text, options);
  const parsed = parseStage2Messages(rows);
  const writeResult = appendJsonlDedupe(options.messagesFile || MANUAL_ANALYST_MESSAGES_FILE, rows, 'dedupe_key');
  return {
    ok: true,
    rows,
    parsed,
    summary: parsed.summary,
    reply: buildManualAnalystReply(parsed, writeResult),
    writes: {
      messages: writeResult,
    },
    output_files: {
      messages: options.messagesFile || MANUAL_ANALYST_MESSAGES_FILE,
    },
  };
}

async function handleManualAnalystPaste(message, res, options = {}) {
  if (!looksLikeManualAnalystPaste(message, options)) return false;
  const result = captureManualAnalystPaste(message, options);
  res.json({
    reply: result.reply,
    state: 'regulated',
    manual_analyst_context: {
      messages: result.summary.messages_processed,
      valid_trade_calls: result.summary.valid_trade_calls,
      partial_trade_calls: result.summary.partial_trade_calls,
      ambiguous_trade_calls: result.summary.ambiguous_trade_calls,
      trade_updates: result.summary.trade_updates,
      gains_posts: result.summary.gains_posts,
      heatmaps: result.summary.heatmaps,
      raw_text_preview: compactText(message, 140),
    },
  });
  return true;
}

module.exports = {
  KATBOT_RESEARCH_BIN_DIR,
  MANUAL_ANALYST_MESSAGES_FILE,
  buildManualAnalystReply,
  captureManualAnalystPaste,
  handleManualAnalystPaste,
  looksLikeManualAnalystPaste,
  normalizeManualAnalystRows,
};
