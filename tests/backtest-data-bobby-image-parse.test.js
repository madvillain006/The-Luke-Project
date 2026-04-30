'use strict';

const {
  extractLevelsFromResult,
  parseImageRow,
  loadProcessedIds,
  summarizeParses,
  SPX_MIN,
  SPX_MAX,
} = require('../lib/backtest-data/bobby-image-parse');

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResult(overrides = {}) {
  return {
    parse_status: 'ok',
    panels: [
      {
        ticker: 'SPXW',
        current_price: 7100,
        king_nodes: [7100],
        walls:      [7150, 7200],
        floors:     [7050, 7000],
      },
      {
        ticker: 'SPY',       // should be ignored - wrong price scale
        current_price: 710,
        king_nodes: [710],
        walls:      [715],
        floors:     [705],
      },
      {
        ticker: 'QQQ',       // should be ignored
        current_price: 620,
        king_nodes: [620],
        walls:      [625],
        floors:     [615],
      },
    ],
    ...overrides,
  };
}

function makeCacheRow(overrides = {}) {
  return {
    messageId:     'msg-001',
    attachmentId:  'att-001',
    timestamp:     '2026-04-07T09:30:00-04:00',
    tradingDateET: '2026-04-07',
    localPath:     '/fake/path/image.png',
    fileName:      'image.png',
    status:        'local_matched',
    ...overrides,
  };
}

// ─── extractLevelsFromResult ──────────────────────────────────────────────────

describe('extractLevelsFromResult', () => {
  it('extracts king_node, resistance, and support from SPXW panel', () => {
    const levels = extractLevelsFromResult(makeResult(), '2026-04-07');
    const roles = levels.map(l => l.role);
    expect(roles).toContain('king_node');
    expect(roles).toContain('resistance');
    expect(roles).toContain('support');
  });

  it('filters out SPY and QQQ panels - wrong price scale for ES', () => {
    const levels = extractLevelsFromResult(makeResult(), '2026-04-07');
    expect(levels.every(l => l.ticker === 'SPXW' || l.ticker === 'SPX')).toBe(true);
    // SPY king node 710 and QQQ king node 620 must not appear
    expect(levels.some(l => l.price === 710)).toBe(false);
    expect(levels.some(l => l.price === 620)).toBe(false);
  });

  it('returns source: bobby_image on every level', () => {
    const levels = extractLevelsFromResult(makeResult(), '2026-04-07');
    expect(levels.every(l => l.source === 'bobby_image')).toBe(true);
  });

  it('attaches tradingDateET to every level', () => {
    const levels = extractLevelsFromResult(makeResult(), '2026-04-07');
    expect(levels.every(l => l.tradingDateET === '2026-04-07')).toBe(true);
  });

  it('rejects prices outside SPX_MIN-SPX_MAX sanity bounds', () => {
    const result = makeResult({
      panels: [{
        ticker: 'SPXW',
        current_price: 7100,
        king_nodes: [SPX_MIN - 1, 7100, SPX_MAX + 1],
        walls: [],
        floors: [],
      }],
    });
    const levels = extractLevelsFromResult(result, '2026-04-07');
    expect(levels.every(l => l.price >= SPX_MIN && l.price <= SPX_MAX)).toBe(true);
    expect(levels.map(l => l.price)).toContain(7100);
  });

  it('returns empty array when result is null', () => {
    expect(extractLevelsFromResult(null, '2026-04-07')).toEqual([]);
  });

  it('returns empty array when parse_status is failed', () => {
    expect(extractLevelsFromResult({ parse_status: 'failed', error: 'oops' }, '2026-04-07')).toEqual([]);
  });

  it('handles SPX ticker (not just SPXW)', () => {
    const result = makeResult({
      panels: [{ ticker: 'SPX', current_price: 7100, king_nodes: [7100], walls: [], floors: [] }],
    });
    const levels = extractLevelsFromResult(result, '2026-04-07');
    expect(levels.some(l => l.price === 7100 && l.source === 'bobby_image')).toBe(true);
  });
});

// ─── parseImageRow ────────────────────────────────────────────────────────────

describe('parseImageRow', () => {
  it('returns skipped_no_local_path when localPath is missing', async () => {
    const row = makeCacheRow({ localPath: null });
    const result = await parseImageRow(row, async () => makeResult());
    expect(result.parseStatus).toBe('skipped_no_local_path');
    expect(result.levels).toEqual([]);
  });

  it('returns read_error when image file cannot be read', async () => {
    const row = makeCacheRow({ localPath: '/nonexistent/path/image.png' });
    const result = await parseImageRow(row, async () => makeResult());
    expect(result.parseStatus).toBe('read_error');
    expect(result.error).toBeTruthy();
    expect(result.levels).toEqual([]);
  });

  it('returns vision_failed when parseBobbyImage returns parse_status: failed', async () => {
    // Write a tiny real image file so the read succeeds
    const tmpPath = path.join(os.tmpdir(), 'test-image-parse-dummy.png');
    fs.writeFileSync(tmpPath, Buffer.from('iVBORw0KGgo=', 'base64'));
    const row = makeCacheRow({ localPath: tmpPath });

    const mockParse = async () => ({ parse_status: 'failed', error: 'model refused' });
    const result = await parseImageRow(row, mockParse);

    fs.unlinkSync(tmpPath);
    expect(result.parseStatus).toBe('vision_failed');
    expect(result.error).toMatch(/model refused/);
    expect(result.levels).toEqual([]);
  });

  it('returns ok with extracted levels on successful parse', async () => {
    const tmpPath = path.join(os.tmpdir(), 'test-image-parse-ok.png');
    fs.writeFileSync(tmpPath, Buffer.from('iVBORw0KGgo=', 'base64'));
    const row = makeCacheRow({ localPath: tmpPath });

    const mockParse = async () => makeResult();
    const result = await parseImageRow(row, mockParse);

    fs.unlinkSync(tmpPath);
    expect(result.parseStatus).toBe('ok');
    expect(result.levels.length).toBeGreaterThan(0);
    expect(result.levelCount).toBe(result.levels.length);
    expect(result.spxPanels).toBeGreaterThan(0);
  });

  it('propagates messageId, attachmentId, tradingDateET to parse result', async () => {
    const row = makeCacheRow({ localPath: null });
    const result = await parseImageRow(row, async () => makeResult());
    expect(result.messageId).toBe('msg-001');
    expect(result.attachmentId).toBe('att-001');
    expect(result.tradingDateET).toBe('2026-04-07');
  });
});

// ─── loadProcessedIds / summarizeParses ──────────────────────────────────────

describe('loadProcessedIds', () => {
  it('returns empty set for nonexistent file', () => {
    const ids = loadProcessedIds('/nonexistent/path.jsonl');
    expect(ids.size).toBe(0);
  });

  it('returns set of attachmentIds from existing file', () => {
    const tmpPath = path.join(os.tmpdir(), 'test-processed-ids.jsonl');
    fs.writeFileSync(tmpPath, [
      JSON.stringify({ attachmentId: 'att-a', parseStatus: 'ok', levels: [] }),
      JSON.stringify({ attachmentId: 'att-b', parseStatus: 'vision_failed', levels: [] }),
    ].join('\n') + '\n');

    const ids = loadProcessedIds(tmpPath);
    fs.unlinkSync(tmpPath);

    expect(ids.has('att-a')).toBe(true);
    expect(ids.has('att-b')).toBe(true);
    expect(ids.size).toBe(2);
  });
});

describe('summarizeParses', () => {
  it('returns empty object for nonexistent file', () => {
    expect(summarizeParses('/nonexistent/path.jsonl')).toEqual({});
  });

  it('counts parse statuses and total levels', () => {
    const tmpPath = path.join(os.tmpdir(), 'test-summarize.jsonl');
    fs.writeFileSync(tmpPath, [
      JSON.stringify({ parseStatus: 'ok',           levels: [{ price: 7100 }, { price: 7050 }] }),
      JSON.stringify({ parseStatus: 'ok',           levels: [{ price: 7000 }] }),
      JSON.stringify({ parseStatus: 'vision_failed', levels: [] }),
    ].join('\n') + '\n');

    const summary = summarizeParses(tmpPath);
    fs.unlinkSync(tmpPath);

    expect(summary.ok).toBe(2);
    expect(summary.vision_failed).toBe(1);
    expect(summary.totalLevels).toBe(3);
  });
});
