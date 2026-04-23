/**
 * lib/saty-levels.js
 *
 * Saty ATR + Ribbon level storage and recommendation engine.
 *
 * Input paths:
 *   1. /saty [text]  — manual paste from TradingView
 *   2. POST /webhook/saty — TradingView alert webhook (needs ngrok or port forward)
 *
 * Output: integrated into /alert response as entry refinement suggestion.
 * "Entry at 5865, Saty ATR1 at 5858 — bid 5858 instead (+7pt improvement)"
 *
 * Stale after 8 trading hours (one session).
 */

const fs   = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../state/lib');

const SATY_FILE = path.join(__dirname, '../data/saty-levels.json');
const STALE_MS  = 8 * 60 * 60 * 1000; // 8 hours

// ── LOAD / SAVE ──────────────────────────────────────────────────────────────

function loadSatyLevels() {
  try {
    if (!fs.existsSync(SATY_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SATY_FILE, 'utf8'));
    if (!data || !data.updated) return null;
    const age = Date.now() - new Date(data.updated).getTime();
    if (age > STALE_MS) return null; // stale
    return data;
  } catch { return null; }
}

function saveSatyLevels(levels) {
  writeJsonAtomic(SATY_FILE, {
    ...levels,
    updated: new Date().toISOString()
  });
}

// ── PARSER ───────────────────────────────────────────────────────────────────
// Accepts 13 bare numbers (space or newline separated), positional order:
//   1: atr_plus_1      ATR+1 outer band
//   2: ext_plus_4
//   3: ext_plus_3
//   4: ext_plus_2
//   5: ext_plus_1
//   6: call_trigger    always position 6
//   7: prev_close      always position 7
//   8: put_trigger     always position 8
//   9: ext_minus_1
//  10: ext_minus_2
//  11: ext_minus_3
//  12: ext_minus_4
//  13: atr_minus_1     ATR-1 outer band

const SATY_POSITIONS = [
  'atr_plus_1',
  'ext_plus_4',
  'ext_plus_3',
  'ext_plus_2',
  'ext_plus_1',
  'call_trigger',
  'prev_close',
  'put_trigger',
  'ext_minus_1',
  'ext_minus_2',
  'ext_minus_3',
  'ext_minus_4',
  'atr_minus_1',
];

function parseSatyText(text) {
  if (!text || !text.trim()) return { valid: false, error: 'empty input' };

  const nums = [...text.matchAll(/\b(\d{3,6}(?:\.\d{1,2})?)\b/g)]
    .map(m => parseFloat(m[1]))
    .filter(n => n > 100 && n < 999999)
    .sort((a, b) => b - a);

  if (nums.length !== 13) {
    return { valid: false, error: `expected 13 levels, got ${nums.length} — paste the full Saty output` };
  }

  const result = { valid: true };
  for (let i = 0; i < 13; i++) {
    result[SATY_POSITIONS[i]] = nums[i];
  }
  return result;
}

// ── LEVEL LIST ────────────────────────────────────────────────────────────────

function getAllLevels(satyData) {
  if (!satyData) return [];
  return SATY_POSITIONS
    .filter(k => satyData[k] != null)
    .map(k => ({ key: k, price: satyData[k] }));
}

// ── ENTRY RECOMMENDATION ──────────────────────────────────────────────────────

const LABEL_MAP = {
  atr_plus_1:   'ATR+1',
  ext_plus_4:   'ext+4',
  ext_plus_3:   'ext+3',
  ext_plus_2:   'ext+2',
  ext_plus_1:   'ext+1',
  call_trigger: 'CALL TRIGGER',
  prev_close:   'PREV CLOSE',
  put_trigger:  'PUT TRIGGER',
  ext_minus_1:  'ext-1',
  ext_minus_2:  'ext-2',
  ext_minus_3:  'ext-3',
  ext_minus_4:  'ext-4',
  atr_minus_1:  'ATR-1',
};

function getSatyRecommendation(entry, direction, stop, satyData) {
  if (!satyData) return null;

  const callTrigger = satyData.call_trigger;
  const putTrigger  = satyData.put_trigger;
  const prevClose   = satyData.prev_close;
  if (!callTrigger || !putTrigger || !prevClose) return null;

  // Chop zone check
  if (entry > putTrigger && entry < callTrigger) {
    return `⚠️ Entry ${entry} is in the chop zone (${putTrigger}–${callTrigger}) — no edge`;
  }

  // Candidate levels based on direction
  let candidates;
  if (direction === 'LONG' && entry >= prevClose) {
    candidates = SATY_POSITIONS
      .filter(k => satyData[k] != null && satyData[k] >= callTrigger)
      .map(k => ({ key: k, price: satyData[k] }));
  } else if (direction === 'SHORT' && entry <= prevClose) {
    candidates = SATY_POSITIONS
      .filter(k => satyData[k] != null && satyData[k] <= putTrigger)
      .map(k => ({ key: k, price: satyData[k] }));
  } else {
    candidates = getAllLevels(satyData);
  }

  const withDist = candidates.map(l => ({ ...l, dist: Math.abs(l.price - entry) }));
  const nearest  = withDist.sort((a, b) => a.dist - b.dist)[0];
  if (!nearest) return null;

  const label = LABEL_MAP[nearest.key] || nearest.key;

  if (nearest.dist <= 2) {
    return `⚡ Entry hits Saty ${label} (${nearest.price}) — structural entry`;
  }

  if (nearest.dist <= 15) {
    const improvement = Math.abs(nearest.price - entry).toFixed(1);
    return `📐 Saty ${label} at ${nearest.price} — bid that instead of ${entry} (+${improvement} pts to entry)`;
  }

  return `📐 Nearest Saty level: ${label} ${nearest.price} (${Math.round(nearest.dist)} pts away)`;
}

// ── RIBBON BIAS ────────────────────────────────────────────────────────────────

function getRibbonLine(satyData) {
  if (!satyData || !satyData.ribbon) return null;
  const r = satyData.ribbon.toLowerCase();
  if (r.includes('bull')) return '🟢 Ribbon: BULLISH';
  if (r.includes('bear')) return '🔴 Ribbon: BEARISH';
  if (r.includes('flat') || r.includes('neutral')) return '⚪ Ribbon: FLAT';
  return `Ribbon: ${satyData.ribbon}`;
}

// ── STATUS SUMMARY (for /saty bare command) ───────────────────────────────────

function buildStatusSummary(satyData) {
  if (!satyData) return '⚠️ No Saty levels loaded.';
  const age   = Math.round((Date.now() - new Date(satyData.updated).getTime()) / 60000);
  const lines = [`📐 Saty Levels (loaded ${age}m ago):`];

  for (const k of SATY_POSITIONS) {
    if (satyData[k] == null) continue;
    const label = LABEL_MAP[k] || k;
    const price = satyData[k];
    if (k === 'atr_plus_1' || k === 'atr_minus_1') {
      lines.push(`${label.padEnd(14)}: ${price}`);
    } else if (k === 'call_trigger' || k === 'prev_close' || k === 'put_trigger') {
      lines.push(`${label.padEnd(14)}: ${price}`);
    } else {
      lines.push(`  — ${label.padEnd(10)}: ${price}`);
    }
  }

  lines.push(`\nTo update: paste 13 Saty levels (space or newline separated)`);
  return lines.join('\n');
}

module.exports = {
  loadSatyLevels,
  saveSatyLevels,
  parseSatyText,
  getAllLevels,
  getSatyRecommendation,
  buildStatusSummary,
};
