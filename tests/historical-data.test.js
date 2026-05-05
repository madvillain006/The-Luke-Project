'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadIntraday,
  findBarsNearTime,
  summarizeRange,
  getCurrentPriceAt,
  rthBarsOnly,
  detectInstrumentFiles,
  _internal: { _setHistoricalRoot, _resetHistoricalRoot, toIsoEt, parseBarchartCsv },
} = require('../lib/historical-data');

function writeLegacyCsv(root, date, instrument, lines) {
  const dir = path.join(root, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${instrument}_1m.csv`), lines.join('\n'), 'utf8');
}

function writeBarchartCsv(root, filename, lines) {
  fs.writeFileSync(path.join(root, filename), lines.join('\n'), 'utf8');
}

const BARCHART_HEADER = 'Time,Open,High,Low,Latest,Change,%Change,Volume';

describe('historical-data', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'historical-data-test-'));
    _setHistoricalRoot(root);
  });

  afterEach(() => {
    _resetHistoricalRoot();
    fs.rmSync(root, { recursive: true, force: true });
  });

  // ── Legacy simple format (back-compat) ────────────────────────────────────

  it('loads legacy intraday bars sorted ascending', () => {
    writeLegacyCsv(root, '2026-04-09', 'ES', [
      'timestamp,open,high,low,close,volume',
      '2026-04-09T09:31:00-04:00,10,12,9,11,200',
      '2026-04-09T09:30:00-04:00,9,11,8,10,100',
    ]);
    const bars = loadIntraday('ES', '2026-04-09');
    expect(bars).toHaveLength(2);
    expect(bars[0].timestamp).toContain('09:30:00');
    expect(bars[1].timestamp).toContain('09:31:00');
  });

  it('returns null on missing file', () => {
    expect(loadIntraday('ES', '2026-04-09')).toBeNull();
  });

  it('returns empty array for header-only legacy file', () => {
    writeLegacyCsv(root, '2026-04-09', 'ES', [
      'timestamp,open,high,low,close,volume',
    ]);
    expect(loadIntraday('ES', '2026-04-09')).toEqual([]);
  });

  // ── Helper utilities ──────────────────────────────────────────────────────

  it('finds bars near timestamp inside window', () => {
    const bars = [
      { timestamp: '2026-04-09T09:29:00-04:00' },
      { timestamp: '2026-04-09T09:30:00-04:00' },
      { timestamp: '2026-04-09T09:40:00-04:00' },
      { timestamp: '2026-04-09T10:20:00-04:00' },
    ];
    const found = findBarsNearTime(bars, '2026-04-09T09:35:00-04:00', 10);
    expect(found).toHaveLength(3);
  });

  it('returns empty near-time range on bad timestamp', () => {
    expect(findBarsNearTime([], 'bad', 10)).toEqual([]);
  });

  it('summarizes OHLC and vwap', () => {
    const summary = summarizeRange([
      { open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { open: 11, high: 13, low: 10, close: 12, volume: 300 },
    ]);
    expect(summary).toEqual(expect.objectContaining({
      open: 10,
      close: 12,
      high: 13,
      low: 9,
      range_pts: 4,
    }));
    expect(summary.vwap).toBeCloseTo(11.75, 5);
  });

  it('gets exact timestamp close', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', close: 10 },
      { timestamp: '2026-04-09T09:31:00-04:00', close: 11 },
    ];
    expect(getCurrentPriceAt(bars, '2026-04-09T09:31:00-04:00')).toBe(11);
  });

  it('gets just-before timestamp close', () => {
    const bars = [
      { timestamp: '2026-04-09T09:30:00-04:00', close: 10 },
      { timestamp: '2026-04-09T09:31:00-04:00', close: 11 },
    ];
    expect(getCurrentPriceAt(bars, '2026-04-09T09:31:30-04:00')).toBe(11);
    expect(getCurrentPriceAt(bars, '2026-04-09T09:29:30-04:00')).toBeNull();
  });

  // ── Barchart format (real Phase 5 path) ───────────────────────────────────

  it('detects instrument files from Barchart filename patterns', () => {
    fs.writeFileSync(path.join(root, 'esh26_intraday-1min_historical-data-download-04-27-2026.csv'), BARCHART_HEADER + '\n', 'utf8');
    fs.writeFileSync(path.join(root, 'esm26_intraday-1min_historical-data-download-04-27-2026.csv'), BARCHART_HEADER + '\n', 'utf8');
    fs.writeFileSync(path.join(root, 'spx_intraday-1min_historical-data-download-04-27-2026.csv'), BARCHART_HEADER + '\n', 'utf8');
    fs.writeFileSync(path.join(root, 'spy_intraday-1min_historical-data-download-04-27-2026.csv'), BARCHART_HEADER + '\n', 'utf8');
    const detected = detectInstrumentFiles();
    expect(detected.ES).toHaveLength(2);
    expect(detected.SPX).toHaveLength(1);
    expect(detected.SPY).toHaveLength(1);
    expect(detected.NQ).toHaveLength(0);
    expect(detected.QQQ).toHaveLength(0);
  });

  it('parses Barchart CSV with quoted timestamp and Latest=close column', () => {
    writeBarchartCsv(root, 'esh26_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-03-01 20:37",6843.5,6844.5,6843,6844,0.5,+0.01%,81',
      '"2026-03-01 20:38",6844.25,6846,6844.25,6845.5,1.5,+0.02%,211',
    ]);
    const bars = loadIntraday('ES', null);
    expect(bars).toHaveLength(2);
    expect(bars[0].timestamp).toBe('2026-03-01T20:37:00-05:00');
    expect(bars[0].open).toBe(6843.5);
    expect(bars[0].close).toBe(6844);
    expect(bars[0].volume).toBe(81);
  });

  it('parses Barchart column variants without quoted timestamps', () => {
    writeBarchartCsv(root, 'esm26_intraday-1min_historical-data-download-04-27-2026.csv', [
      'Time,Open,High,Low,Close,Change,%Change,Vol',
      '2026-04-29 08:28,7163,7164.25,7162.5,7164,1.0,+0.01%,1544',
      '2026-04-29 08:29,7164,7165,7162.75,7163.25,-0.75,-0.01%,1912',
    ]);
    const bars = loadIntraday('ES', '2026-04-29');

    expect(bars).toHaveLength(2);
    expect(bars[0].timestamp).toBe('2026-04-29T08:28:00-04:00');
    expect(bars[1].close).toBe(7163.25);
    expect(bars[1].volume).toBe(1912);
  });

  it('skips malformed, missing-timestamp, and missing-volume Barchart rows', () => {
    const file = path.join(root, 'esm26_intraday-1min_historical-data-download-04-27-2026.csv');
    writeBarchartCsv(root, path.basename(file), [
      BARCHART_HEADER,
      '"2026-02-30 09:30",7163,7164.25,7162.5,7164,1.0,+0.01%,1544',
      '"",7164,7165,7162.75,7163.25,-0.75,-0.01%,1912',
      '"2026-04-29 08:29",7164,7165,7162.75,7163.25,-0.75,-0.01%,',
      '"2026-04-29 08:30",7164,7165,7162.75,7163.25,-0.75,-0.01%,1912',
    ]);
    const bars = parseBarchartCsv(file);

    expect(bars).toHaveLength(1);
    expect(bars[0].timestamp).toBe('2026-04-29T08:30:00-04:00');
  });

  it('filters Barchart bars by date when date supplied', () => {
    writeBarchartCsv(root, 'spx_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-04-09 09:30",6800,6810,6790,6805,5,+0.07%,0',
      '"2026-04-09 09:31",6805,6815,6800,6812,7,+0.10%,0',
      '"2026-04-10 09:30",6900,6910,6890,6905,5,+0.07%,0',
    ]);
    const bars = loadIntraday('SPX', '2026-04-09');
    expect(bars).toHaveLength(2);
    expect(bars.every(b => b.timestamp.startsWith('2026-04-09'))).toBe(true);
  });

  it('merges multiple ES contract files chronologically', () => {
    writeBarchartCsv(root, 'esh26_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-03-15 10:00",6800,6810,6790,6805,5,+0.07%,500',
    ]);
    writeBarchartCsv(root, 'esm26_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-04-09 10:00",6900,6910,6890,6905,5,+0.07%,1000',
    ]);
    const bars = loadIntraday('ES', null);
    expect(bars).toHaveLength(2);
    expect(bars[0].timestamp.startsWith('2026-03-15')).toBe(true);
    expect(bars[1].timestamp.startsWith('2026-04-09')).toBe(true);
  });

  it('dedups overlapping ES contract timestamps preferring higher volume (rollover)', () => {
    writeBarchartCsv(root, 'esh26_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-03-15 10:00",6800,6810,6790,6805,5,+0.07%,200',
    ]);
    writeBarchartCsv(root, 'esm26_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-03-15 10:00",6800,6810,6790,6806,5,+0.07%,800',
    ]);
    const bars = loadIntraday('ES', null);
    expect(bars).toHaveLength(1);
    expect(bars[0].volume).toBe(800);
    expect(bars[0].close).toBe(6806);
  });

  it('applies DST boundary correctly across spring-forward', () => {
    // 2026-03-08 02:00 ET → DST kicks in. Pre-boundary = EST (-05:00).
    // Post-boundary = EDT (-04:00).
    writeBarchartCsv(root, 'spy_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-03-07 23:59",100,101,99,100,0,+0.00%,1000',
      '"2026-03-08 03:01",100,101,99,100,0,+0.00%,1000',
    ]);
    const bars = loadIntraday('SPY', null);
    expect(bars).toHaveLength(2);
    expect(bars[0].timestamp).toBe('2026-03-07T23:59:00-05:00');
    expect(bars[1].timestamp).toBe('2026-03-08T03:01:00-04:00');
  });

  it('toIsoEt: pre-DST 2026 returns -05:00', () => {
    expect(toIsoEt('2026-02-15 09:30')).toBe('2026-02-15T09:30:00-05:00');
  });

  it('toIsoEt: post-DST-spring 2026 returns -04:00', () => {
    expect(toIsoEt('2026-04-09 09:30')).toBe('2026-04-09T09:30:00-04:00');
  });

  it('toIsoEt: post-DST-fall 2026 returns -05:00', () => {
    expect(toIsoEt('2026-11-15 09:30')).toBe('2026-11-15T09:30:00-05:00');
  });

  it('rthBarsOnly filters to 09:30-16:00 ET window', () => {
    const bars = [
      { timestamp: '2026-04-09T08:00:00-04:00' },
      { timestamp: '2026-04-09T09:30:00-04:00' },
      { timestamp: '2026-04-09T12:00:00-04:00' },
      { timestamp: '2026-04-09T16:00:00-04:00' },
      { timestamp: '2026-04-09T20:00:00-04:00' },
    ];
    const rth = rthBarsOnly(bars);
    expect(rth).toHaveLength(3);
    expect(rth[0].timestamp).toContain('09:30:00');
    expect(rth[2].timestamp).toContain('16:00:00');
  });

  it('skips zero-volume SPX bars without filtering them out (cash index has 0 volume)', () => {
    writeBarchartCsv(root, 'spx_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-04-09 12:39",6834.96,6835.30,6832.57,6834.16,-1.23,-0.02%,0',
      '"2026-04-09 12:40",6834.28,6834.28,6829.20,6829.20,-4.96,-0.07%,0',
    ]);
    const bars = loadIntraday('SPX', '2026-04-09');
    expect(bars).toHaveLength(2);
    expect(bars[0].volume).toBe(0);
    expect(bars[0].close).toBe(6834.16);
  });

  it('returns null for instruments with no files (NQ, QQQ absent)', () => {
    writeBarchartCsv(root, 'spy_intraday-1min_historical-data-download-04-27-2026.csv', [
      BARCHART_HEADER,
      '"2026-04-09 09:30",100,101,99,100,0,+0.00%,1000',
    ]);
    expect(loadIntraday('NQ', '2026-04-09')).toBeNull();
    expect(loadIntraday('QQQ', '2026-04-09')).toBeNull();
  });
});
