'use strict';

const fs = require('fs');
const path = require('path');
const { compactText, isoOrNull, readJson, readJsonl, rel, sha256 } = require('./io');

function attachmentRows(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment, index) => ({
    id: attachment.id || null,
    index,
    filename: attachment.filename || attachment.name || attachment.fileName || null,
    content_type: attachment.content_type || attachment.contentType || null,
    url: attachment.url || attachment.proxy_url || attachment.proxyUrl || null,
    width: attachment.width || null,
    height: attachment.height || null,
    size: attachment.size || attachment.fileSizeBytes || null,
  }));
}

function sourceCollectionForExport(sourceFile, channelName) {
  const text = [sourceFile, channelName].filter(Boolean).join(' ').toLowerCase();
  if (/[\\/]sybil[\\/]/i.test(sourceFile || '') || /\b(ask-sybil|narratives|vault-notes)\b/i.test(text)) return 'sybil';
  return 'discord_export';
}

function normalizeKatRawMessage(row, sourceFile) {
  const rawText = String(row.content || '');
  const ts = isoOrNull(row.ts || row.timestamp);
  const messageId = String(row.message_id || row.id || sha256([row.channel_id, ts, rawText].join(':')).slice(0, 24));
  return {
    message_id: messageId,
    channel_id: row.channel_id || null,
    channel_name: row.channel_name || row.channel || null,
    author_id: row.user_id || row.author_id || null,
    author_name: row.username || row.author_name || row.analyst || null,
    timestamp_utc: ts,
    raw_text: rawText,
    attachments: attachmentRows(row.attachments),
    embeds: Array.isArray(row.embeds) ? row.embeds : [],
    referenced_message_id: row.referenced_message_id || row.reference?.message_id || null,
    thread_id: row.thread_id || null,
    source_type: 'kat_raw_feed',
    source_file: rel(sourceFile),
    ingestion_timestamp: new Date().toISOString(),
    content_hash: sha256(rawText),
    dedupe_key: ['kat', row.guild_id || 'guild', row.channel_id || row.channel_name || 'channel', messageId].join(':'),
    backfill: row.backfill === true,
  };
}

function walkFiles(dir, predicate, maxDepth = 4) {
  const out = [];
  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  walk(dir, 0);
  return out;
}

function looksLikeDmPath(filePath) {
  return /(?:^|[\\/])dm(?:s)?(?:[\\/]|$)|direct[-_\s]?message|private/i.test(filePath);
}

function discoverDiscordExportJson(rootDir, options = {}) {
  const base = options.discordExportsDir || path.join(rootDir, 'discord-exports');
  const files = walkFiles(base, file => file.toLowerCase().endsWith('.json'), 4)
    .filter(file => options.includeDms === true || !looksLikeDmPath(file));
  const valid = [];
  const rejected = [];
  for (const file of files) {
    const json = readJson(file, null);
    if (json && Array.isArray(json.messages)) {
      valid.push({
        path: file,
        relative_path: rel(file),
        message_count: json.messages.length,
        guild: json.guild?.name || json.guild || null,
        channel: json.channel?.name || json.channel || null,
        exported_at: json.exportedAt || null,
      });
    } else {
      rejected.push({ path: rel(file), reason: 'not_discord_export_json_or_malformed' });
    }
  }
  return { valid, rejected };
}

function normalizeDiscordExportMessage(message, exportMeta, sourceFile) {
  const rawText = String(message.content || '');
  const author = message.author || {};
  const channel = exportMeta.channel || {};
  const guild = exportMeta.guild || {};
  const ts = isoOrNull(message.timestamp);
  const messageId = String(message.id || sha256([sourceFile, ts, rawText].join(':')).slice(0, 24));
  return {
    message_id: messageId,
    channel_id: channel.id || exportMeta.channelId || null,
    channel_name: channel.name || exportMeta.channelName || null,
    author_id: author.id || null,
    author_name: author.name || author.nickname || author.username || null,
    timestamp_utc: ts,
    raw_text: rawText,
    attachments: attachmentRows(message.attachments),
    embeds: Array.isArray(message.embeds) ? message.embeds : [],
    referenced_message_id: message.reference?.messageId || message.referencedMessage?.id || null,
    thread_id: message.thread?.id || null,
    source_type: 'discord_export_json',
    source_collection: sourceCollectionForExport(sourceFile, channel.name || exportMeta.channelName),
    source_file: rel(sourceFile),
    ingestion_timestamp: new Date().toISOString(),
    content_hash: sha256(rawText),
    dedupe_key: ['export', guild.id || guild.name || 'guild', channel.id || channel.name || 'channel', messageId].join(':'),
    backfill: true,
  };
}

function loadDiscordExportMessages(rootDir, options = {}) {
  const inventory = discoverDiscordExportJson(rootDir, options);
  const rows = [];
  for (const item of inventory.valid) {
    const json = readJson(item.path, null);
    for (const message of json.messages || []) {
      rows.push(normalizeDiscordExportMessage(message, json, item.path));
    }
  }
  return { rows, inventory };
}

function dedupeMessages(messages) {
  const seen = new Map();
  for (const message of messages) {
    const key = message.dedupe_key || message.message_id || sha256(JSON.stringify(message));
    const existing = seen.get(key);
    if (!existing || String(message.source_type).includes('kat_raw')) seen.set(key, message);
  }
  return [...seen.values()].sort((a, b) => String(a.timestamp_utc || '').localeCompare(String(b.timestamp_utc || '')));
}

function normalizeManualSybilMessage(row, sourceFile) {
  return {
    ...row,
    attachments: attachmentRows(row.attachments),
    embeds: Array.isArray(row.embeds) ? row.embeds : [],
    source_type: row.source_type || 'manual_paste',
    source_collection: 'sybil',
    source_file: row.source_file || rel(sourceFile),
    ingestion_timestamp: row.ingestion_timestamp || new Date().toISOString(),
    content_hash: row.content_hash || sha256(row.raw_text || ''),
    dedupe_key: row.dedupe_key || ['manual-sybil', row.channel_name || 'manual-sybil-paste', row.message_id || sha256(row.raw_text || '').slice(0, 16)].join(':'),
    backfill: row.backfill !== false,
  };
}

function normalizeManualAnalystMessage(row, sourceFile) {
  return {
    ...row,
    attachments: attachmentRows(row.attachments),
    embeds: Array.isArray(row.embeds) ? row.embeds : [],
    source_type: row.source_type || 'manual_paste',
    source_collection: 'manual_analyst',
    source_file: row.source_file || rel(sourceFile),
    ingestion_timestamp: row.ingestion_timestamp || new Date().toISOString(),
    content_hash: row.content_hash || sha256(row.raw_text || ''),
    dedupe_key: row.dedupe_key || ['manual-analyst', row.channel_name || 'manual-katbot-paste', row.message_id || sha256(row.raw_text || '').slice(0, 16)].join(':'),
    backfill: row.backfill !== false,
  };
}

function ingestStage2Messages(config, options = {}) {
  const katRaw = readJsonl(config.inputs.katRawFeed)
    .filter(row => !row._parse_error)
    .map(row => normalizeKatRawMessage(row, config.inputs.katRawFeed));
  const manualAnalyst = options.includeManualAnalyst === false
    ? []
    : readJsonl(config.inputs.manualAnalystMessages)
      .filter(row => !row._parse_error)
      .map(row => normalizeManualAnalystMessage(row, config.inputs.manualAnalystMessages));
  const manualSybil = options.includeManualSybil === false
    ? []
    : readJsonl(config.inputs.manualSybilMessages)
      .filter(row => !row._parse_error)
      .map(row => normalizeManualSybilMessage(row, config.inputs.manualSybilMessages));
  const exports = options.includeDiscordExports === false
    ? { rows: [], inventory: { valid: [], rejected: [] } }
    : loadDiscordExportMessages(config.rootDir, {
      includeDms: options.includeDms === true,
      discordExportsDir: options.discordExportsDir,
    });
  const messages = dedupeMessages([...katRaw, ...exports.rows, ...manualAnalyst, ...manualSybil]);
  const analysts = {};
  const channels = {};
  let attachments = 0;
  for (const message of messages) {
    analysts[message.author_name || message.author_id || 'unknown'] = (analysts[message.author_name || message.author_id || 'unknown'] || 0) + 1;
    channels[message.channel_name || message.channel_id || 'unknown'] = (channels[message.channel_name || message.channel_id || 'unknown'] || 0) + 1;
    attachments += message.attachments.length;
  }
  return {
    generated_at: new Date().toISOString(),
    messages,
    inventory: {
      kat_raw_messages: katRaw.length,
      manual_analyst_messages: manualAnalyst.length,
      manual_sybil_messages: manualSybil.length,
      discord_export_messages: exports.rows.length,
      deduped_messages: messages.length,
      analysts,
      channels,
      attachments,
      discord_exports: exports.inventory,
      sample: messages.slice(0, 3).map(message => ({
        message_id: message.message_id,
        timestamp_utc: message.timestamp_utc,
        author_name: message.author_name,
        channel_name: message.channel_name,
        raw_text_preview: compactText(message.raw_text, 80),
      })),
    },
  };
}

module.exports = {
  attachmentRows,
  dedupeMessages,
  discoverDiscordExportJson,
  ingestStage2Messages,
  looksLikeDmPath,
  normalizeDiscordExportMessage,
  normalizeManualAnalystMessage,
  normalizeKatRawMessage,
  normalizeManualSybilMessage,
  sourceCollectionForExport,
};
