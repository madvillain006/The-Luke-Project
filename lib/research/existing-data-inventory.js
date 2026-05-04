'use strict';

const fs = require('fs');
const path = require('path');
const { _internal: historicalInternal } = require('../historical-data');
const {
  ROOT,
  readJson,
  readJsonl,
  walkFiles,
  datePart,
  isParseableTimestamp,
  relativePath,
} = require('./common');

const RELEVANT_EXTENSIONS = new Set([
  '.csv', '.json', '.jsonl', '.md', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif',
]);

const SEARCH_ROOTS = [
  'data',
  'fixtures',
  'archive',
  'docs',
  'agents',
  'scripts',
  'state',
  'artifacts',
  'discord-exports',
];

function inferInstrument(text) {
  const hay = String(text || '').toUpperCase();
  if (/\bMES\b/.test(hay)) return 'MES';
  if (/\bES\b|ES_F|ESH\d{2}|ESM\d{2}|ESZ\d{2}/.test(hay)) return 'ES';
  if (/\bSPX\b|SPXW/.test(hay)) return 'SPX';
  if (/\bSPY\b/.test(hay)) return 'SPY';
  if (/\bMNQ\b/.test(hay)) return 'MNQ';
  if (/\bNQ\b|NQH\d{2}|NQM\d{2}/.test(hay)) return 'NQ';
  if (/\bQQQ\b/.test(hay)) return 'QQQ';
  return null;
}

function classifyFile(relPath, ext, contentSample = '') {
  const hay = `${relPath}\n${contentSample}`.toLowerCase();
  const instrument = inferInstrument(`${relPath}\n${contentSample}`);

  if (ext === '.csv' && /intraday-1min|_1m|1min|1-minute|minute/.test(hay)) {
    if (instrument === 'ES' || instrument === 'MES') return 'ES 1-minute bars';
    if (instrument === 'SPX') return 'SPX 1-minute bars';
    return 'Other market bars/reference data';
  }
  if (/saty/.test(hay)) {
    if (/level|atr|trigger/.test(hay)) return 'Saty generated levels';
    return 'Saty source inputs needed to generate levels';
  }
  if (/bobby/.test(hay) && /\.(png|jpg|jpeg|webp|gif)$/i.test(relPath)) return 'Bobby heatmap images';
  if (/bobby/.test(hay) && /parse|cache|level|jsonl/.test(hay)) return 'Bobby cached parsed heatmaps';
  if (/bobby/.test(hay)) return 'Bobby text/commentary';
  if (/mancini/.test(hay)) return 'Mancini text/levels/chop zones';
  if (/dubz|richydubz|ximes/.test(hay)) {
    if (/callout|commentary|discord|message|txt|jsonl/.test(hay)) return 'Dubz same-day callouts/commentary';
    return 'Dubz structural levels';
  }
  if (/katbot|jefe|\bkat\b/.test(hay)) return 'Katbot/Jefe context';
  if (/gex|heatseeker|heatmap|gamma|king node/.test(hay)) return 'GEX/Heatseeker/heatmap data';
  if (/replay|backtest|candidate|session-build|coverage-report|result/.test(hay)) return 'Existing replay outputs';
  if (/\bspx\b|\bspy\b|\bnq\b|\bqqq\b|ohlc|candle|bars/.test(hay)) return 'Other market bars/reference data';
  return 'Unknown potentially useful data';
}

function sampleText(filePath, ext) {
  if (!['.csv', '.json', '.jsonl', '.md', '.txt'].includes(ext)) return '';
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, 8000);
  } catch {
    return '';
  }
}

function summarizeBars(filePath) {
  const bars = historicalInternal.parseBarchartCsv(filePath) || [];
  const timestamps = bars.map(bar => bar.timestamp).filter(Boolean);
  return {
    row_count: bars.length,
    event_count: bars.length,
    date_range: timestamps.length ? { start: datePart(timestamps[0]), end: datePart(timestamps[timestamps.length - 1]) } : null,
    first_timestamp: timestamps[0] || null,
    last_timestamp: timestamps[timestamps.length - 1] || null,
    timestamp_granularity: bars.length ? '1 minute' : null,
    timestamps_parseable: timestamps.every(isParseableTimestamp),
    timezone_explicit: timestamps.some(ts => /[+-]\d{2}:\d{2}$|Z$/.test(ts)),
  };
}

function summarizeJsonLike(filePath, ext) {
  let records = [];
  let raw = null;
  if (ext === '.jsonl') {
    records = readJsonl(filePath);
  } else if (ext === '.json') {
    raw = readJson(filePath);
    if (Array.isArray(raw)) records = raw;
    else if (Array.isArray(raw?.levels)) records = raw.levels;
    else if (Array.isArray(raw?.bars?.es)) records = raw.bars.es;
    else if (raw && typeof raw === 'object') records = [raw];
  }
  const timestamps = records
    .map(row => row.timestamp || row.time || row.ts || row.available_at_et || row.valid_from)
    .filter(Boolean);
  const dates = records
    .map(row => row.date || row.tradingDateET || row.estimatedDate || datePart(row.timestamp || row.time || row.ts))
    .filter(Boolean)
    .sort();
  const barCount = Array.isArray(raw?.bars?.es) ? raw.bars.es.length : null;
  return {
    row_count: barCount ?? records.length,
    event_count: records.length,
    date_range: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
    first_timestamp: timestamps.sort()[0] || null,
    last_timestamp: timestamps.sort().slice(-1)[0] || null,
    timestamp_granularity: timestamps.length ? 'event' : (dates.length ? 'date' : null),
    timestamps_parseable: timestamps.length ? timestamps.every(isParseableTimestamp) : false,
    timezone_explicit: timestamps.some(ts => /[+-]\d{2}:\d{2}$|Z$/.test(ts)),
  };
}

function inventoryFile(filePath) {
  const rel = relativePath(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const sample = sampleText(filePath, ext);
  const sourceType = /\.(png|jpg|jpeg|webp|gif)$/i.test(ext)
    ? 'raw'
    : (/derived|parsed|cache|report|result|artifact/.test(rel.toLowerCase()) ? 'derived' : 'raw');
  const category = classifyFile(rel, ext, sample);
  const instrument = inferInstrument(`${rel}\n${sample}`);
  let summary = {
    row_count: null,
    event_count: null,
    date_range: null,
    first_timestamp: null,
    last_timestamp: null,
    timestamp_granularity: null,
    timestamps_parseable: false,
    timezone_explicit: false,
  };
  try {
    if (ext === '.csv') summary = summarizeBars(filePath);
    else if (ext === '.json' || ext === '.jsonl') summary = summarizeJsonLike(filePath, ext);
  } catch {
    summary.timestamps_parseable = false;
  }

  const usableForReplay =
    category.includes('1-minute bars') ||
    (summary.timestamps_parseable && !/image/.test(category.toLowerCase())) ||
    (category.includes('Saty generated levels') && summary.date_range);

  let confidence = 'medium';
  if (category.includes('Unknown') || (!summary.timestamps_parseable && !category.includes('image') && !summary.date_range)) confidence = 'low';
  if (category.includes('1-minute bars') && summary.row_count > 0 && summary.timestamps_parseable) confidence = 'high';
  if (/sessions\/\d{4}-\d{2}-\d{2}\.json$/.test(rel) && summary.row_count > 0) confidence = 'high';

  return {
    path: rel,
    type: category,
    instrument,
    date_range: summary.date_range,
    timestamp_granularity: summary.timestamp_granularity,
    row_event_count: summary.event_count ?? summary.row_count,
    row_count: summary.row_count,
    timestamps_parseable: summary.timestamps_parseable,
    timezone_explicit: summary.timezone_explicit,
    usable_for_no_lookahead_replay: usableForReplay,
    source_stage: sourceType,
    appears_stale_generated_duplicate: /backup|corrupt|pre-|audit-backups|artifact|report|result/.test(rel.toLowerCase()),
    confidence,
    first_timestamp: summary.first_timestamp,
    last_timestamp: summary.last_timestamp,
    bytes: stat.size,
  };
}

function discoverResearchData(options = {}) {
  const files = [];
  for (const rootName of SEARCH_ROOTS) {
    const root = path.join(ROOT, rootName);
    if (!fs.existsSync(root)) continue;
    for (const filePath of walkFiles(root, { maxFiles: options.maxFilesPerRoot || Infinity })) {
      const ext = path.extname(filePath).toLowerCase();
      if (RELEVANT_EXTENSIONS.has(ext)) files.push(filePath);
    }
  }
  const entries = files.map(inventoryFile);
  const byType = entries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});
  return {
    generated_at: new Date().toISOString(),
    repo_root: ROOT,
    search_roots: SEARCH_ROOTS,
    total_files: entries.length,
    by_type: byType,
    entries,
  };
}

module.exports = {
  discoverResearchData,
  inventoryFile,
  classifyFile,
  inferInstrument,
};
