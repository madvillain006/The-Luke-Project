'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeMarketSymbol } = require('../symbols');
const { _internal: historicalInternal } = require('../../historical-data');

const ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_SEARCH_DIRS = [
  path.join(ROOT, 'data', 'research', 'bars'),
  path.join(ROOT, 'data', 'historical'),
  path.join(ROOT, 'data', 'backtest'),
  path.join(ROOT, 'fixtures'),
];

const CANDLE_SOURCE = 'local_csv';
const PUBLIC_SOURCE_LABEL = 'local/replay';

const FILE_PATTERNS = [
  { regex: /^es[hmuz]\d{2}_intraday-1min_historical-data-download/i, symbol: 'ES' },
  { regex: /^spx_intraday-1min_historical-data-download/i, symbol: 'SPX' },
  { regex: /^ES[_-]?1m/i, symbol: 'ES' },
  { regex: /^SPX[_-]?1m/i, symbol: 'SPX' },
];

const _inventoryCache = new Map();

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function walkFiles(root, maxDepth = 3) {
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
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
        out.push(full);
      }
    }
  }
  walk(root, 0);
  return out;
}

function detectSymbolFromFile(filePath) {
  const name = path.basename(filePath);
  for (const pattern of FILE_PATTERNS) {
    if (pattern.regex.test(name)) return pattern.symbol;
  }
  const parent = path.basename(path.dirname(filePath)).toUpperCase();
  if (parent === 'ES' || parent === 'SPX') return parent;
  return null;
}

function listLocalCandleFiles(options = {}) {
  const searchDirs = options.searchDirs || DEFAULT_SEARCH_DIRS;
  const files = [];
  for (const dir of searchDirs) {
    for (const filePath of walkFiles(dir, options.maxDepth ?? 3)) {
      const symbol = detectSymbolFromFile(filePath);
      if (!symbol) continue;
      files.push({
        symbol,
        instrument: symbol,
        path: filePath,
        relative_path: rel(filePath),
        bytes: fs.statSync(filePath).size,
      });
    }
  }
  return files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

function parseCsvFile(filePath) {
  const bars = historicalInternal.parseBarchartCsv(filePath) || [];
  return bars.map(bar => ({ ...bar, source_file: rel(filePath) }));
}

function mergeBars(bars) {
  const byTs = new Map();
  for (const bar of bars) {
    const existing = byTs.get(bar.timestamp);
    if (!existing || (Number(bar.volume) || 0) > (Number(existing.volume) || 0)) {
      byTs.set(bar.timestamp, bar);
    }
  }
  return [...byTs.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function summarizeBars(bars) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return {
      rows: 0,
      first_timestamp: null,
      last_timestamp: null,
      date_range: null,
    };
  }
  return {
    rows: bars.length,
    first_timestamp: bars[0].timestamp,
    last_timestamp: bars[bars.length - 1].timestamp,
    date_range: {
      start: bars[0].timestamp.slice(0, 10),
      end: bars[bars.length - 1].timestamp.slice(0, 10),
    },
  };
}

function loadBarsForSymbol(symbol, options = {}) {
  const normalized = normalizeMarketSymbol(symbol).symbol;
  const files = listLocalCandleFiles(options).filter(file => file.symbol === normalized);
  const bars = mergeBars(files.flatMap(file => parseCsvFile(file.path)));
  return { files, bars };
}

function getLocalCandleInventory(options = {}) {
  const key = JSON.stringify({
    searchDirs: (options.searchDirs || DEFAULT_SEARCH_DIRS).map(dir => path.resolve(dir)),
    maxDepth: options.maxDepth ?? 3,
  });
  if (_inventoryCache.has(key) && options.cache !== false) return _inventoryCache.get(key);

  const files = listLocalCandleFiles(options);
  const symbols = {};
  for (const symbol of ['ES', 'SPX']) {
    const symbolFiles = files.filter(file => file.symbol === symbol);
    const bars = mergeBars(symbolFiles.flatMap(file => parseCsvFile(file.path)));
    symbols[symbol] = {
      symbol,
      found: symbolFiles.length > 0 && bars.length > 0,
      file_count: symbolFiles.length,
      files: symbolFiles.map(file => file.relative_path),
      ...summarizeBars(bars),
      source: CANDLE_SOURCE,
      source_label: PUBLIC_SOURCE_LABEL,
      timezone: 'America/New_York',
      timezone_assumption: 'Barchart timestamps are local ET per existing historical-data loader convention',
      live: false,
      replay: true,
      usable_for_replay: bars.length > 0,
      usable_for_live_arming: false,
    };
  }
  const inventory = {
    generated_at: new Date().toISOString(),
    search_dirs: (options.searchDirs || DEFAULT_SEARCH_DIRS).map(dir => rel(path.resolve(dir))),
    symbols,
  };
  _inventoryCache.set(key, inventory);
  return inventory;
}

function toMillis(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampFromDateTime(date, time) {
  if (!date || !time) return null;
  const normalizedTime = String(time).length === 5 ? `${time}:00` : String(time);
  const offset = historicalInternal.getETOffset(`${date} ${String(time).slice(0, 5)}`);
  return `${date}T${normalizedTime}${offset}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(value || ''))) return false;
  const [hour, minute, second = '0'] = String(value).split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function replayValidationError(options = {}) {
  if (options.mode !== 'replay') return null;
  if (options.date && !validDate(options.date)) return `invalid_replay_date_${options.date}`;
  if (options.time && !options.date) return 'replay_time_requires_date';
  if (options.time && !validTime(options.time)) return `invalid_replay_time_${options.time}`;
  return null;
}

function filterBars(bars, options = {}) {
  const date = options.date || null;
  const endFromTime = timestampFromDateTime(date, options.time);
  const startMs = toMillis(options.start);
  const endMs = toMillis(options.end || endFromTime);
  return bars.filter(bar => {
    if (date && !bar.timestamp.startsWith(date)) return false;
    const ts = toMillis(bar.timestamp);
    if (!Number.isFinite(ts)) return false;
    if (Number.isFinite(startMs) && ts < startMs) return false;
    if (Number.isFinite(endMs) && ts > endMs) return false;
    return true;
  });
}

function labelCandles(bars, explicitReplay) {
  return bars.map(bar => ({
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    source: CANDLE_SOURCE,
    source_label: PUBLIC_SOURCE_LABEL,
    source_file: bar.source_file || null,
    finalized: true,
    stale: explicitReplay ? false : true,
    delayed: false,
    live: false,
    replay: true,
  }));
}

function unknownLocalResult(symbol, error) {
  const normalized = normalizeMarketSymbol(symbol).symbol;
  return {
    symbol: normalized,
    instrument: normalized,
    timeframe: '1m',
    candles: [],
    source: CANDLE_SOURCE,
    source_label: PUBLIC_SOURCE_LABEL,
    timestamp: null,
    stale: true,
    delayed: false,
    live: false,
    replay: true,
    usable_for_replay: false,
    usable_for_live_arming: false,
    confidence: 0,
    error,
    session: 'UNKNOWN',
    raw: {
      files: [],
      rows: 0,
      timezone: 'America/New_York',
    },
  };
}

async function getLocalCsvCandles(symbol, options = {}) {
  const normalized = normalizeMarketSymbol(symbol).symbol;
  if (!['ES', 'SPX'].includes(normalized)) {
    return unknownLocalResult(normalized, `local_csv_candles_unsupported_symbol_${normalized}`);
  }

  const mode = options.mode === 'replay' ? 'replay' : 'latest-local';
  const validationError = replayValidationError({ ...options, mode });
  if (validationError) {
    return {
      ...unknownLocalResult(normalized, validationError),
      session: 'replay',
      raw: {
        files: [],
        rows: 0,
        timezone: 'America/New_York',
        mode,
      },
    };
  }
  const explicitReplay = mode === 'replay' && Boolean(options.date || options.start || options.end || options.time);
  const { files, bars } = loadBarsForSymbol(normalized, options);
  if (!files.length || !bars.length) return unknownLocalResult(normalized, 'local_csv_candles_not_found');

  const filtered = filterBars(bars, options);
  const hasLimit = options.limit !== null && options.limit !== undefined && Number.isFinite(Number(options.limit));
  const limited = filtered.slice(-(hasLimit ? Number(options.limit) : 240));
  const candles = labelCandles(limited, explicitReplay);
  const latest = candles[candles.length - 1] || null;
  const summary = summarizeBars(bars);

  return {
    symbol: normalized,
    instrument: normalized,
    timeframe: '1m',
    candles,
    source: CANDLE_SOURCE,
    source_label: PUBLIC_SOURCE_LABEL,
    timestamp: latest?.timestamp || null,
    stale: explicitReplay ? false : true,
    delayed: false,
    live: false,
    replay: true,
    usable_for_replay: candles.length > 0,
    usable_for_live_arming: false,
    confidence: candles.length > 0 ? 0.7 : 0,
    error: candles.length > 0 ? null : 'local_csv_candles_empty_after_filter',
    session: explicitReplay ? 'replay' : 'latest-local',
    raw: {
      files: files.map(file => file.relative_path),
      file_count: files.length,
      rows: summary.rows,
      first_timestamp: summary.first_timestamp,
      last_timestamp: summary.last_timestamp,
      date_range: summary.date_range,
      timezone: 'America/New_York',
      timezone_assumption: 'Barchart timestamps are local ET per existing historical-data loader convention',
      mode,
    },
  };
}

async function getLatestLocalCsvCandle(symbol, options = {}) {
  const result = await getLocalCsvCandles(symbol, { ...options, limit: 1 });
  return result.candles[0] || null;
}

module.exports = {
  CANDLE_SOURCE,
  PUBLIC_SOURCE_LABEL,
  DEFAULT_SEARCH_DIRS,
  listLocalCandleFiles,
  getLocalCandleInventory,
  getLocalCsvCandles,
  getLatestLocalCsvCandle,
  _internal: {
    detectSymbolFromFile,
    parseCsvFile,
    mergeBars,
    timestampFromDateTime,
    filterBars,
    summarizeBars,
    validDate,
    validTime,
    replayValidationError,
    _inventoryCache,
  },
};
