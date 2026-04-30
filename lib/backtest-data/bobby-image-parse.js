'use strict';

// Offline Bobby heatmap image parser for backtest data pipeline.
//
// Wraps parseBobbyImage() from lib/parse-bobby.js for batch historical use.
// Does NOT download images - expects locally cached files from bobby-image-cache.js.
// Does NOT use live prices - passes null so the parser uses static price ranges.
//
// SPX/SPXW levels map directly to ES price (both in 5000-7500 range in 2026).
// SPY and QQQ panels are filtered out - wrong price scale for ES clustering.
// Resistance (walls) are included but flagged so the candidate generator can
// filter them from long entry logic while still surfacing them as context.

const fs   = require('fs');
const path = require('path');

// SPX/SPXW price bounds sanity check. Reject levels outside this range to
// catch parser hallucinations or misread panel data.
const SPX_MIN = 4000;
const SPX_MAX = 9000;

// Tickers whose price scale maps directly to ES futures.
const ES_EQUIVALENT_TICKERS = new Set(['SPX', 'SPXW']);

// Role mapping from panel fields to session level roles.
const ROLE_MAP = {
  king_nodes:  'king_node',
  walls:       'resistance',
  floors:      'support',
};

// ─── Level extraction ─────────────────────────────────────────────────────────

// Extract ES-equivalent levels from a parseBobbyImage() result.
// Returns flat array of { price, source, role, ticker, tradingDateET }.
function extractLevelsFromResult(result, tradingDateET) {
  if (!result || result.parse_status === 'failed') return [];

  const levels = [];

  for (const panel of result.panels || []) {
    const ticker = String(panel.ticker || '').toUpperCase().replace(/W$/, ''); // SPXW -> SPX
    if (!ES_EQUIVALENT_TICKERS.has(ticker) && ticker !== 'SPXW') continue;

    const canonTicker = panel.ticker ? String(panel.ticker).toUpperCase() : 'SPXW';

    for (const [field, role] of Object.entries(ROLE_MAP)) {
      for (const rawPrice of panel[field] || []) {
        const price = Number(rawPrice);
        if (!Number.isFinite(price)) continue;
        if (price < SPX_MIN || price > SPX_MAX) continue;
        levels.push({
          price,
          source:       'bobby_image',
          role,
          ticker:       canonTicker,
          tradingDateET: tradingDateET || null,
        });
      }
    }
  }

  return levels;
}

// ─── Single image parse ───────────────────────────────────────────────────────

// Parse one locally cached image row.
// cacheRow: a local_matched row from bobby-image-cache.jsonl
// parseBobbyImageFn: injected to allow testing without live API calls
//
// Returns a parse result row suitable for writing to bobby-image-parses.jsonl.
async function parseImageRow(cacheRow, parseBobbyImageFn) {
  const base = {
    messageId:     cacheRow.messageId,
    attachmentId:  cacheRow.attachmentId,
    timestamp:     cacheRow.timestamp,
    tradingDateET: cacheRow.tradingDateET,
    localPath:     cacheRow.localPath || null,
    fileName:      cacheRow.fileName  || null,
  };

  if (!cacheRow.localPath) {
    return { ...base, parseStatus: 'skipped_no_local_path', levels: [], error: null };
  }

  let imageB64;
  try {
    const buf = fs.readFileSync(cacheRow.localPath);
    imageB64 = buf.toString('base64');
  } catch (e) {
    return { ...base, parseStatus: 'read_error', levels: [], error: e.message };
  }

  let result;
  try {
    // Pass null for livePrices - historical parse uses static price range hints
    result = await parseBobbyImageFn(imageB64, null);
  } catch (e) {
    return { ...base, parseStatus: 'parse_error', levels: [], error: e.message };
  }

  if (!result) {
    return { ...base, parseStatus: 'vision_null', levels: [], error: 'parseBobbyImage returned null' };
  }
  if (result.parse_status === 'failed') {
    return { ...base, parseStatus: 'vision_failed', levels: [], error: result.error || 'vision failed' };
  }

  const levels     = extractLevelsFromResult(result, cacheRow.tradingDateET);
  const panelCount = Array.isArray(result.panels) ? result.panels.length : 0;
  const spxPanels  = (result.panels || []).filter(p => {
    const t = String(p.ticker || '').toUpperCase();
    return t === 'SPX' || t === 'SPXW';
  }).length;

  return {
    ...base,
    parseStatus: 'ok',
    levels,
    levelCount:  levels.length,
    panelCount,
    spxPanels,
    error:       null,
  };
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

// Load existing parse output as a Set of already-processed attachmentIds.
// Used to skip rows in resume mode.
function loadProcessedIds(parsesPath) {
  if (!fs.existsSync(parsesPath)) return new Set();
  const lines = fs.readFileSync(parsesPath, 'utf8').split('\n').filter(Boolean);
  const ids = new Set();
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.attachmentId) ids.add(row.attachmentId);
    } catch (_) { /* skip malformed */ }
  }
  return ids;
}

// Count parse statuses in a parses JSONL file.
function summarizeParses(parsesPath) {
  if (!fs.existsSync(parsesPath)) return {};
  const lines = fs.readFileSync(parsesPath, 'utf8').split('\n').filter(Boolean);
  const counts = {};
  let totalLevels = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      counts[row.parseStatus] = (counts[row.parseStatus] || 0) + 1;
      totalLevels += (row.levels || []).length;
    } catch (_) { /* skip */ }
  }
  return { ...counts, totalLevels };
}

module.exports = {
  extractLevelsFromResult,
  parseImageRow,
  loadProcessedIds,
  summarizeParses,
  SPX_MIN,
  SPX_MAX,
  ES_EQUIVALENT_TICKERS,
};
