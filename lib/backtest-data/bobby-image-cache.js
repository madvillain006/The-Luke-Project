'use strict';

// Match Bobby Discord export attachment rows to locally-cached media files.
// Does NOT download from Discord CDN. All unmatched attachments are recorded
// explicitly with status 'unmatched_no_cdn' so nothing is silently dropped.
//
// Statuses:
//   local_matched        - found in manifest + file exists on disk
//   local_manifest_only  - in manifest but file is missing from disk
//   unmatched            - not in local manifest (would need CDN download)

const fs = require('fs');
const path = require('path');

function readManifest(manifestPath) {
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read manifest: ${manifestPath}: ${err.message}`);
  }
  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

// Build a lookup: messageId → manifest rows[]
function indexManifest(rows) {
  const byMsgId = new Map();
  for (const row of rows) {
    if (!byMsgId.has(row.messageId)) byMsgId.set(row.messageId, []);
    byMsgId.get(row.messageId).push(row);
  }
  return byMsgId;
}

// Attempt to match a single attachment to a local cached file.
// Returns a cache row describing the result.
function matchAttachment(att, manifestIndex, mediaDir) {
  const base = {
    messageId: att.messageId,
    attachmentId: att.attachmentId,
    timestamp: att.timestamp,
    tradingDateET: att.tradingDateET,
    fileName: att.fileName,
    url: att.url,
    fileSizeBytes: att.fileSizeBytes,
  };

  const rows = manifestIndex.get(att.messageId) || [];
  // Primary match: same messageId + same original filename
  let found = rows.find(r => r.originalFilename === att.fileName);
  // Fallback: same messageId, only one manifest row
  if (!found && rows.length === 1) found = rows[0];

  if (!found) {
    return { ...base, status: 'unmatched', localPath: null, manifestRow: null };
  }

  const localFile = path.join(mediaDir, found.localFilename);
  const exists = fs.existsSync(localFile);
  return {
    ...base,
    status: exists ? 'local_matched' : 'local_manifest_only',
    localPath: exists ? localFile : null,
    manifestRow: {
      localFilename: found.localFilename,
      downloadStatus: found.downloadStatus,
      authorName: found.authorName,
    },
  };
}

// Build the image cache manifest for a set of normalized Bobby messages.
//
// normalizedMessages: output of bobby-export.js normalizeBobbyMessages()
// manifestPath: path to discord-exports/bobby/media/manifest.json
// mediaDir: directory containing the local media files
//
// Returns { rows: CacheRow[], summary: { ... } }
function buildImageCache(normalizedMessages, manifestPath, mediaDir) {
  const manifest = readManifest(manifestPath);
  const manifestIndex = indexManifest(manifest);

  const rows = [];
  for (const msg of normalizedMessages) {
    for (const att of msg.attachments) {
      if (!att.isImage) {
        rows.push({
          messageId: msg.id,
          attachmentId: att.attachmentId,
          timestamp: msg.timestamp,
          tradingDateET: msg.tradingDateET,
          fileName: att.fileName,
          url: att.url,
          fileSizeBytes: att.fileSizeBytes,
          status: 'skipped_non_image',
          localPath: null,
          manifestRow: null,
        });
        continue;
      }
      const attWithMeta = {
        messageId: msg.id,
        attachmentId: att.attachmentId,
        timestamp: msg.timestamp,
        tradingDateET: msg.tradingDateET,
        fileName: att.fileName,
        url: att.url,
        fileSizeBytes: att.fileSizeBytes,
      };
      rows.push(matchAttachment(attWithMeta, manifestIndex, mediaDir));
    }
  }

  const statusCounts = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  return {
    rows,
    summary: {
      total: rows.length,
      ...statusCounts,
    },
  };
}

// Low-level helper for tests: read and return manifest array.
function _readManifestForTest(manifestPath) {
  return readManifest(manifestPath);
}

module.exports = {
  buildImageCache,
  _internal: { readManifest, indexManifest, matchAttachment },
};
