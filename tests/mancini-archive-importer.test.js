'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArchiveFile,
  eventFromText,
  normalizeTimestamp,
  parseLevels,
} = require('../lib/research/fake-breakdown/mancini-importer');

describe('mancini archive importer', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mancini-import-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('normalizes exact timestamps, references, levels, targets, and chop zones without raw content', () => {
    const file = path.join(tempDir, 'mancini.txt');
    fs.writeFileSync(file, [
      '2026-04-09 09:31 https://x.com/user/status/123456 ES 6800 support, 6815 target, chop 6790',
    ].join('\n'), 'utf8');
    const parsed = parseArchiveFile(file);
    expect(parsed.normalized).toHaveLength(1);
    expect(parsed.normalized[0]).toEqual(expect.objectContaining({
      timestamp_et: '2026-04-09T09:31:00-04:00',
      raw_content_redacted: true,
      usable_for_replay: true,
    }));
    expect(parsed.normalized[0].source_reference.post_id).toBe('123456');
    expect(parsed.normalized[0].levels.map(level => level.price)).toEqual([6800, 6815, 6790]);
  });

  it('quarantines missing timestamps and handles date-only timestamps conservatively', () => {
    const missing = eventFromText({ text: 'ES 6800 support', sourcePath: 'local.txt' });
    const dateOnly = eventFromText({ text: '2026-04-09 ES 6800 support', sourcePath: 'local.txt' });

    expect(missing.usable_for_replay).toBe(false);
    expect(missing.unusable_reason).toBe('timestamp_missing');
    expect(dateOnly.usable_for_replay).toBe(false);
    expect(dateOnly.unusable_reason).toBe('timestamp_date_only');
  });

  it('supports JSONL and CSV local files', () => {
    const jsonl = path.join(tempDir, 'mancini.jsonl');
    fs.writeFileSync(jsonl, JSON.stringify({ created_at: '2026-04-09T09:31:00-04:00', text: 'ES 6800 support' }) + '\n', 'utf8');
    expect(parseArchiveFile(jsonl).normalized).toHaveLength(1);

    const csv = path.join(tempDir, 'mancini.csv');
    fs.writeFileSync(csv, 'timestamp,text\n2026-04-09 09:31,ES 6800 support\n', 'utf8');
    expect(parseArchiveFile(csv).normalized).toHaveLength(1);
  });

  it('parses timestamp and level helpers', () => {
    expect(normalizeTimestamp('2026-04-09 09:31').quality).toBe('exact');
    expect(normalizeTimestamp('2026-04-09').quality).toBe('date_only');
    expect(parseLevels('6800 support 6815 target').map(level => level.role)).toEqual(['support', 'target']);
  });

  it('parses social-style timestamp blocks from local text archives', () => {
    const file = path.join(tempDir, 'mancini-social.txt');
    fs.writeFileSync(file, [
      'Plan: 7245 support sets up 7300 target.',
      '10:34 AM · May 2, 2026',
    ].join('\n'), 'utf8');
    const parsed = parseArchiveFile(file);
    expect(parsed.normalized).toHaveLength(1);
    expect(parsed.normalized[0].timestamp_et).toBe('2026-05-02T10:34:00-04:00');
    expect(parsed.normalized[0].levels.map(level => level.price)).toEqual([7245, 7300]);
  });
});
