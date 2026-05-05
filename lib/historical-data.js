'use strict';

// Historical 1-minute intraday bar loader for Phase 5 backtest.
//
// Handles two file formats out of the box:
//   1. Real Barchart export format (preferred):
//        Headers:  Time,Open,High,Low,Latest,Change,%Change,Volume
//        Time:     "YYYY-MM-DD HH:MM" quoted, no timezone (ET implied)
//        "Latest" column maps to bar.close
//        Files live flat in data/historical/ with names like
//        esh26_intraday-1min_historical-data-download-04-27-2026.csv
//   2. Legacy simple format (back-compat for tests):
//        Headers:  timestamp,open,high,low,close,volume
//        Files live at <root>/<date>/<INSTRUMENT>_1m.csv
//
// ET timezone offset is DST-aware for 2025-2027. Boundary table inline
// below — extend annually. Outside that range we default to EST (-05:00)
// to fail safely; backtest replay will still work on relative offsets,
// it'll just be 1hr off in absolute UTC for years we haven't tabled.
//
// ES contract files (esh26 = March, esm26 = June, etc.) are merged into
// a single chronological stream. Overlapping timestamps prefer the
// higher-volume bar (front month during rollover).
//
// File-level cache keyed by mtime. Re-read happens automatically when
// the user drops a new CSV onto an existing path.

const fs = require('fs');
const path = require('path');

const DEFAULT_HISTORICAL_ROOT = path.join(__dirname, '../data/historical');
let _historicalRoot = DEFAULT_HISTORICAL_ROOT;

const _fileCache = new Map(); // filePath → { mtimeMs, bars }

function _setHistoricalRoot(root) {
  _historicalRoot = root;
  _fileCache.clear();
}

function _resetHistoricalRoot() {
  _historicalRoot = DEFAULT_HISTORICAL_ROOT;
  _fileCache.clear();
}

// ── ET DST boundaries ────────────────────────────────────────────────────────
// Spring forward: 2nd Sunday of March 02:00 → 03:00 ET.
// Fall back: 1st Sunday of November 02:00 → 01:00 ET.
// String comparison works because the format is fixed YYYY-MM-DD HH:MM.
const DST_RANGES = [
  { start: '2025-03-09 03:00', end: '2025-11-02 02:00' },
  { start: '2026-03-08 03:00', end: '2026-11-01 02:00' },
  { start: '2027-03-14 03:00', end: '2027-11-07 02:00' },
];

function getETOffset(localDateStr) {
  for (const range of DST_RANGES) {
    if (localDateStr >= range.start && localDateStr < range.end) return '-04:00';
  }
  return '-05:00';
}

function normalizeLocalDateTime(localDateStr) {
  const match = String(localDateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const asUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (
    asUtc.getUTCFullYear() !== Number(year) ||
    asUtc.getUTCMonth() + 1 !== Number(month) ||
    asUtc.getUTCDate() !== Number(day) ||
    asUtc.getUTCHours() !== Number(hour) ||
    asUtc.getUTCMinutes() !== Number(minute) ||
    asUtc.getUTCSeconds() !== Number(second)
  ) {
    return null;
  }
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function toIsoEt(localDateStr) {
  // "2026-03-01 20:37" → "2026-03-01T20:37:00-05:00"
  const normalized = normalizeLocalDateTime(localDateStr);
  if (!normalized) return null;
  return normalized.replace(' ', 'T') + getETOffset(normalized.slice(0, 16));
}

// ── Barchart filename → instrument detection ─────────────────────────────────
const INSTRUMENT_PATTERNS = [
  { regex: /^es[hmuz]\d{2}_intraday-1min_historical-data-download/i, instrument: 'ES' },
  { regex: /^nq[hmuz]\d{2}_intraday-1min_historical-data-download/i, instrument: 'NQ' },
  { regex: /^spx_intraday-1min_historical-data-download/i,           instrument: 'SPX' },
  { regex: /^spy_intraday-1min_historical-data-download/i,           instrument: 'SPY' },
  { regex: /^qqq_intraday-1min_historical-data-download/i,           instrument: 'QQQ' },
];

function detectInstrumentFiles() {
  const out = { ES: [], NQ: [], SPX: [], SPY: [], QQQ: [] };
  let entries;
  try {
    entries = fs.readdirSync(_historicalRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    for (const pattern of INSTRUMENT_PATTERNS) {
      if (pattern.regex.test(e.name)) {
        out[pattern.instrument].push(path.join(_historicalRoot, e.name));
        break;
      }
    }
  }
  return out;
}

// ── CSV parsing ──────────────────────────────────────────────────────────────
function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < String(line || '').length; index += 1) {
    const ch = line[index];
    if (ch === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeaders(line) {
  return splitCsvLine(line).map(header => header.trim().toLowerCase().replace(/\s+/g, '_'));
}

function headerIndex(headers, names) {
  return headers.findIndex(header => names.includes(header));
}

function parseNumberCell(value) {
  const text = String(value ?? '').trim();
  if (!text) return NaN;
  return Number(text.replace(/,/g, ''));
}

function parseBarchartCsv(filePath) {
  let stat;
  try { stat = fs.statSync(filePath); } catch { return null; }

  const cached = _fileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.bars;

  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return null; }

  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = normalizeHeaders(lines[0]);
  const timeIndex = headerIndex(headers, ['time', 'date_time', 'datetime']);
  const timestampIndex = headerIndex(headers, ['timestamp']);
  const openIndex = headerIndex(headers, ['open']);
  const highIndex = headerIndex(headers, ['high']);
  const lowIndex = headerIndex(headers, ['low']);
  const closeIndex = headerIndex(headers, ['latest', 'close', 'last']);
  const volumeIndex = headerIndex(headers, ['volume', 'vol']);
  const isBarchart = timeIndex >= 0 && openIndex >= 0 && highIndex >= 0 && lowIndex >= 0 && closeIndex >= 0;
  const isLegacy = timestampIndex >= 0 && openIndex >= 0 && highIndex >= 0 && lowIndex >= 0 && closeIndex >= 0;
  if (!isBarchart && !isLegacy) return [];

  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let timestamp, open, high, low, close, volume;
    const parts = splitCsvLine(line);

    if (isBarchart) {
      timestamp = toIsoEt(parts[timeIndex]);
      open   = parseNumberCell(parts[openIndex]);
      high   = parseNumberCell(parts[highIndex]);
      low    = parseNumberCell(parts[lowIndex]);
      close  = parseNumberCell(parts[closeIndex]);
      volume = volumeIndex >= 0 ? parseNumberCell(parts[volumeIndex]) : NaN;
    } else {
      timestamp = parts[timestampIndex];
      open   = parseNumberCell(parts[openIndex]);
      high   = parseNumberCell(parts[highIndex]);
      low    = parseNumberCell(parts[lowIndex]);
      close  = parseNumberCell(parts[closeIndex]);
      volume = volumeIndex >= 0 ? parseNumberCell(parts[volumeIndex]) : NaN;
    }

    if (!timestamp ||
        !Number.isFinite(open) || !Number.isFinite(high) ||
        !Number.isFinite(low)  || !Number.isFinite(close) ||
        !Number.isFinite(volume)) continue;

    bars.push({ timestamp, open, high, low, close, volume });
  }

  bars.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  _fileCache.set(filePath, { mtimeMs: stat.mtimeMs, bars });
  return bars;
}

// ── ES / NQ contract merge ───────────────────────────────────────────────────
// Combines multiple contract files into one chronological stream.
// During rollover overlap, prefers the higher-volume bar (front month).
function mergeContractStreams(barsArrays) {
  if (barsArrays.length === 0) return [];
  if (barsArrays.length === 1) return barsArrays[0];

  const byTs = new Map();
  for (const arr of barsArrays) {
    for (const bar of arr) {
      const existing = byTs.get(bar.timestamp);
      if (!existing || bar.volume > existing.volume) {
        byTs.set(bar.timestamp, bar);
      }
    }
  }
  return [...byTs.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  );
}

// ── Public API ───────────────────────────────────────────────────────────────
//
// loadIntraday(instrument, date)
//   instrument: 'ES' | 'NQ' | 'SPX' | 'SPY' | 'QQQ' (case-insensitive)
//   date:       'YYYY-MM-DD' to filter, or null/undefined for full stream
//   returns:    bars[] sorted ascending by timestamp, or null if no data
//
// Resolution order:
//   1. Look for Barchart files in _historicalRoot. If found, parse them
//      (merged for ES/NQ multi-contract), filter by date if given.
//   2. Fall back to legacy date-subdir layout (<root>/<date>/<INSTR>_1m.csv).
//      Used by tests with synthetic data; not used in production.
//   3. Return null if neither exists.
function loadIntraday(instrument, date) {
  if (!instrument) return null;
  const upper = String(instrument).toUpperCase();

  const detected = detectInstrumentFiles();
  const files = detected[upper] || [];

  if (files.length > 0) {
    const allBars = files.map(f => parseBarchartCsv(f) || []);
    const merged = mergeContractStreams(allBars);
    if (!date) return merged;
    return merged.filter(bar => bar.timestamp.startsWith(date));
  }

  if (!date) return null;
  const legacyPath = path.join(_historicalRoot, date, `${upper}_1m.csv`);
  if (fs.existsSync(legacyPath)) {
    return parseBarchartCsv(legacyPath);
  }
  return null;
}

function findBarsNearTime(bars, isoTimestamp, windowMinutes = 30) {
  if (!Array.isArray(bars) || !isoTimestamp) return [];
  const center = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(center)) return [];
  const radius = windowMinutes * 60 * 1000;
  return bars.filter(bar => {
    const t = new Date(bar.timestamp).getTime();
    return Number.isFinite(t) && Math.abs(t - center) <= radius;
  });
}

function summarizeRange(bars) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { high: null, low: null, open: null, close: null, vwap: null, range_pts: null };
  }
  const high = Math.max(...bars.map(b => b.high));
  const low  = Math.min(...bars.map(b => b.low));
  const open  = bars[0].open;
  const close = bars[bars.length - 1].close;
  const totalVol = bars.reduce((s, b) => s + b.volume, 0);
  const vwap = totalVol > 0
    ? bars.reduce((s, b) => s + b.close * b.volume, 0) / totalVol
    : bars.reduce((s, b) => s + b.close, 0) / bars.length;
  return { high, low, open, close, vwap, range_pts: high - low };
}

function getCurrentPriceAt(bars, isoTimestamp) {
  if (!Array.isArray(bars) || bars.length === 0 || !isoTimestamp) return null;
  const target = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(target)) return null;
  let best = null;
  for (const bar of bars) {
    const ts = new Date(bar.timestamp).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts <= target) best = bar;
    if (ts > target) break;
  }
  return best ? best.close : null;
}

// rthBarsOnly — filter to 09:30-16:00 ET regular trading hours
function rthBarsOnly(bars) {
  if (!Array.isArray(bars)) return [];
  return bars.filter(bar => {
    const m = String(bar.timestamp).match(/T(\d{2}):(\d{2})/);
    if (!m) return false;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const total = hh * 60 + mm;
    return total >= 570 && total <= 960; // 9:30 to 16:00
  });
}

module.exports = {
  loadIntraday,
  findBarsNearTime,
  summarizeRange,
  getCurrentPriceAt,
  rthBarsOnly,
  detectInstrumentFiles,
  _internal: {
    _setHistoricalRoot,
    _resetHistoricalRoot,
    parseBarchartCsv,
    mergeContractStreams,
    toIsoEt,
    getETOffset,
  },
};
