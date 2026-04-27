'use strict';

const fs   = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../state/lib');

const DEFAULT_MEMORY_FILE = path.join(__dirname, '../data/level-memory.json');

// Tolerance for matching a new level's price to an existing canonical_price.
// A new mention attaches to the nearest canonical within tolerance; otherwise creates a new record.
// Phase 2's correlation engine handles cross-instrument clustering — this module never collapses records.
const CANONICAL_TOLERANCE = {
  NQ:  0.25,
  ES:  0.25,
  SPX: 0.50,
  SPY: 0.50,
  QQQ: 0.50,
};

// Mutable module-level state to allow test-time path/write overrides via _internal.
let _memoryFile = DEFAULT_MEMORY_FILE;
let _writeFn    = (filePath, data) => writeJsonAtomic(filePath, data);

function _setMemoryFile(p)  { _memoryFile = p; }
function _setWriteFn(fn)    { _writeFn = fn; }
function _resetWriteFn()    { _writeFn = (filePath, data) => writeJsonAtomic(filePath, data); }

// US market holidays not yet handled — windows will count holidays as trading days, slight over-inclusion.
function tradingDayWindow(window) {
  if (window === null || window === undefined) return null;

  const DAY_COUNTS = { hot: 5, active: 21 };
  const days = DAY_COUNTS[window];
  if (days === undefined) throw new Error(`tradingDayWindow: unknown window "${window}"`);

  const cutoff  = new Date();
  let remaining = days;
  while (remaining > 0) {
    cutoff.setDate(cutoff.getDate() - 1);
    const dow = cutoff.getDay(); // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) remaining--;
  }

  return cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * loadMemory()
 * Returns empty default if file is missing. Throws on parse failure (C4).
 */
function loadMemory() {
  let raw;
  try {
    raw = fs.readFileSync(_memoryFile, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 1, last_updated: null, levels: [] };
    throw err;
  }
  // File exists — JSON.parse throws SyntaxError on bad data; caller must handle (C4).
  return JSON.parse(raw);
}

/**
 * recordLevel({ analyst, instrument, price, significance?, direction?, intent?,
 *               source_type, source_snippet?, timestamp? })
 *
 * Appends a mention. If price is within per-instrument tolerance of an existing
 * canonical_price for the same instrument, attaches to that record. Otherwise creates new.
 *
 * Returns { canonical_price, total_mentions, created_new } on success.
 * Throws on write failure (C4) — never silently swallows.
 */
async function recordLevel({
  analyst,
  instrument,
  price,
  significance          = null,
  direction             = null,
  intent                = null,
  source_type,
  source_snippet        = null,
  timestamp             = null,
  crossSourceConfirmed  = false,
}) {
  if (!instrument || typeof price !== 'number') {
    throw new Error('recordLevel: instrument and numeric price are required');
  }

  const tol = CANONICAL_TOLERANCE[instrument];
  if (tol === undefined) throw new Error(`recordLevel: unknown instrument "${instrument}"`);

  const ts      = timestamp || new Date().toISOString();
  const dateStr = ts.slice(0, 10); // "YYYY-MM-DD"

  // C4: load failure must surface to caller
  let memory;
  try {
    memory = loadMemory();
  } catch (err) {
    throw new Error(`recordLevel: failed to load memory: ${err.message}`);
  }

  // Find the nearest existing canonical for this instrument within tolerance
  let canonical = null;
  let minDist   = Infinity;
  for (const lvl of memory.levels) {
    if (lvl.instrument !== instrument) continue;
    const dist = Math.abs(lvl.canonical_price - price);
    if (dist <= tol && dist < minDist) {
      minDist   = dist;
      canonical = lvl;
    }
  }

  const mention = {
    analyst,
    date:                 dateStr,
    timestamp:            ts,
    significance:         significance  || null,
    direction:            direction     || null,
    intent:               intent        || null,
    source_type,
    source_snippet:       source_snippet || null,
    crossSourceConfirmed: crossSourceConfirmed === true,
  };

  let created_new = false;

  if (canonical) {
    // Append-only (C6): never modify existing mentions
    canonical.mentions.push(mention);
    canonical.total_mentions = canonical.mentions.length;
    canonical.last_seen      = ts;
  } else {
    canonical = {
      canonical_price: price,
      instrument,
      first_seen:      ts,
      last_seen:       ts,
      total_mentions:  1,
      mentions:        [mention],
    };
    memory.levels.push(canonical);
    created_new = true;
  }

  memory.last_updated = new Date().toISOString();

  // C4: write failure must throw — NOT swallowed. C5: atomic writes only.
  try {
    _writeFn(_memoryFile, memory);
  } catch (err) {
    throw new Error(`recordLevel: atomic write failed: ${err.message}`);
  }

  return {
    canonical_price: canonical.canonical_price,
    total_mentions:  canonical.total_mentions,
    created_new,
  };
}

/**
 * queryLevels({ instrument, window? })
 *
 * Returns canonical records for instrument filtered by window:
 *   'hot'        — mentions in the last 5 trading days
 *   'active'     — mentions in the last 21 trading days
 *   'historical' — mentions older than 21 trading days
 *   null         — all mentions (no filter)
 *
 * Canonical records with zero matching mentions are excluded.
 * total_mentions on returned records reflects only the filtered mention count.
 * Never throws on empty or missing state (C3).
 */
function queryLevels({ instrument, window = null } = {}) {
  if (!instrument) return [];

  // loadMemory returns the empty default on ENOENT; parse errors and other
  // read failures throw and propagate — Phase 2 must distinguish corrupt vs. empty.
  const memory = loadMemory();

  const isHistorical  = window === 'historical';
  const activeCutoff  = isHistorical ? tradingDayWindow('active') : null;
  const windowCutoff  = (!isHistorical && window) ? tradingDayWindow(window) : null;

  const results = [];
  for (const level of memory.levels) {
    if (level.instrument !== instrument) continue;

    let filtered;
    if (windowCutoff) {
      // hot / active: mentions on or after cutoff
      filtered = level.mentions.filter(m => m.date >= windowCutoff);
    } else if (isHistorical) {
      // historical: mentions strictly before the active cutoff
      filtered = level.mentions.filter(m => m.date < activeCutoff);
    } else {
      // null: all mentions
      filtered = level.mentions;
    }

    // Exclude record if no mentions fall in this window
    if (window && filtered.length === 0) continue;

    results.push({ ...level, mentions: filtered, total_mentions: filtered.length });
  }

  return results;
}

module.exports = {
  recordLevel,
  queryLevels,
  loadMemory,
  // _internal: test-only helpers. Never call from production code.
  _internal: { tradingDayWindow, _setMemoryFile, _setWriteFn, _resetWriteFn },
};
