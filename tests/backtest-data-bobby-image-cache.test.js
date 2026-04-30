import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildImageCache, _internal } from '../lib/backtest-data/bobby-image-cache.js';

const { readManifest, indexManifest, matchAttachment } = _internal;

// ── Test fixtures ─────────────────────────────────────────────────────────────
// We write a small temp manifest + media dir to disk for tests.
let tmpDir;

const MANIFEST_ROWS = [
  {
    messageId: 'msg1',
    timestamp: '2026-03-10T09:15:00.000-04:00',
    authorName: 'BOBBY',
    messageContent: '',
    originalFilename: 'screen_A.png',
    localFilename: 'local_A.png',
    downloadStatus: 'downloaded',
  },
  {
    messageId: 'msg2',
    timestamp: '2026-03-11T08:30:00.000-04:00',
    authorName: 'BOBBY',
    messageContent: '',
    originalFilename: 'screen_B.png',
    localFilename: 'local_B.png',
    downloadStatus: 'downloaded',
  },
];

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-test-'));
  // Write manifest (with UTF-8 BOM)
  const bom = '﻿';
  fs.writeFileSync(path.join(tmpDir, 'manifest.json'), bom + JSON.stringify(MANIFEST_ROWS), 'utf8');
  // Write only local_A.png (not local_B.png — to test missing-file case)
  fs.writeFileSync(path.join(tmpDir, 'local_A.png'), Buffer.from('PNG_BYTES'), 'binary');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── readManifest ──────────────────────────────────────────────────────────────
describe('readManifest', () => {
  it('strips UTF-8 BOM and parses JSON', () => {
    const rows = readManifest(path.join(tmpDir, 'manifest.json'));
    expect(rows).toHaveLength(2);
    expect(rows[0].messageId).toBe('msg1');
  });

  it('throws on missing file', () => {
    expect(() => readManifest('/nonexistent/manifest.json')).toThrow();
  });
});

// ── indexManifest ─────────────────────────────────────────────────────────────
describe('indexManifest', () => {
  it('groups rows by messageId', () => {
    const idx = indexManifest(MANIFEST_ROWS);
    expect(idx.get('msg1')).toHaveLength(1);
    expect(idx.get('msg1')[0].originalFilename).toBe('screen_A.png');
  });
});

// ── matchAttachment ───────────────────────────────────────────────────────────
describe('matchAttachment', () => {
  let manifestIndex;

  beforeAll(() => {
    manifestIndex = indexManifest(MANIFEST_ROWS);
  });

  const baseAtt = {
    messageId: 'msg1',
    attachmentId: 'att1',
    timestamp: '2026-03-10T09:15:00.000-04:00',
    tradingDateET: '2026-03-10',
    fileName: 'screen_A.png',
    url: 'https://cdn.discordapp.com/att/screen_A.png',
    fileSizeBytes: 50000,
  };

  it('returns local_matched when file exists on disk', () => {
    const row = matchAttachment(baseAtt, manifestIndex, tmpDir);
    expect(row.status).toBe('local_matched');
    expect(row.localPath).toBeTruthy();
  });

  it('returns local_manifest_only when manifest entry exists but file is missing', () => {
    const att = { ...baseAtt, messageId: 'msg2', fileName: 'screen_B.png', attachmentId: 'att2' };
    const row = matchAttachment(att, manifestIndex, tmpDir);
    expect(row.status).toBe('local_manifest_only');
    expect(row.localPath).toBeNull();
  });

  it('returns unmatched when not in manifest', () => {
    const att = { ...baseAtt, messageId: 'msg_unknown', attachmentId: 'att_unknown', fileName: 'unknown.png' };
    const row = matchAttachment(att, manifestIndex, tmpDir);
    expect(row.status).toBe('unmatched');
    expect(row.localPath).toBeNull();
    expect(row.manifestRow).toBeNull();
  });
});

// ── buildImageCache ───────────────────────────────────────────────────────────
describe('buildImageCache', () => {
  const normalizedMessages = [
    {
      id: 'msg1',
      timestamp: '2026-03-10T09:15:00.000-04:00',
      tradingDateET: '2026-03-10',
      attachments: [
        { attachmentId: 'att1', fileName: 'screen_A.png', url: 'https://cdn/screen_A.png', fileSizeBytes: 50000, isImage: true },
        { attachmentId: 'att2', fileName: 'data.txt', url: 'https://cdn/data.txt', fileSizeBytes: 100, isImage: false },
      ],
    },
    {
      id: 'msg2',
      timestamp: '2026-03-11T08:30:00.000-04:00',
      tradingDateET: '2026-03-11',
      attachments: [
        { attachmentId: 'att3', fileName: 'screen_B.png', url: 'https://cdn/screen_B.png', fileSizeBytes: 60000, isImage: true },
      ],
    },
    {
      id: 'msg_unknown',
      timestamp: '2026-03-12T09:00:00.000-04:00',
      tradingDateET: '2026-03-12',
      attachments: [
        { attachmentId: 'att4', fileName: 'chart.png', url: 'https://cdn/chart.png', fileSizeBytes: 70000, isImage: true },
      ],
    },
  ];

  it('produces a row for every attachment (no silent drops)', () => {
    const { rows } = buildImageCache(
      normalizedMessages,
      path.join(tmpDir, 'manifest.json'),
      tmpDir
    );
    // 4 total attachments: att1(img), att2(non-img), att3(img), att4(img unmatched)
    expect(rows).toHaveLength(4);
  });

  it('marks non-image attachments as skipped_non_image', () => {
    const { rows } = buildImageCache(normalizedMessages, path.join(tmpDir, 'manifest.json'), tmpDir);
    const skipped = rows.filter(r => r.status === 'skipped_non_image');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].fileName).toBe('data.txt');
  });

  it('marks msg1 image as local_matched', () => {
    const { rows } = buildImageCache(normalizedMessages, path.join(tmpDir, 'manifest.json'), tmpDir);
    const matched = rows.find(r => r.attachmentId === 'att1');
    expect(matched.status).toBe('local_matched');
  });

  it('marks msg2 image as local_manifest_only (file missing)', () => {
    const { rows } = buildImageCache(normalizedMessages, path.join(tmpDir, 'manifest.json'), tmpDir);
    const r = rows.find(r => r.attachmentId === 'att3');
    expect(r.status).toBe('local_manifest_only');
  });

  it('marks unknown message image as unmatched', () => {
    const { rows } = buildImageCache(normalizedMessages, path.join(tmpDir, 'manifest.json'), tmpDir);
    const r = rows.find(r => r.attachmentId === 'att4');
    expect(r.status).toBe('unmatched');
  });

  it('summary counts match row statuses', () => {
    const { summary } = buildImageCache(normalizedMessages, path.join(tmpDir, 'manifest.json'), tmpDir);
    expect(summary.total).toBe(4);
    expect(summary.local_matched).toBe(1);
    expect(summary.local_manifest_only).toBe(1);
    expect(summary.unmatched).toBe(1);
    expect(summary.skipped_non_image).toBe(1);
  });
});
