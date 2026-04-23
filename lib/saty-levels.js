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
// Accepts any of:
//   JSON: {"up2":5900,"up1":5875,"mid":5850,"down1":5825,"down2":5800,"atr":25}
//   KV:   up2=5900 up1=5875 mid=5850 down1=5825 down2=5800 atr=25
//   Bare: 5900 5875 5850 5825 5800  (sorted top→bottom = up2 up1 mid down1 down2)
//
// Also accepts ribbon bias: ribbon=bullish or ribbon=bearish

function parseSatyText(text) {
  if (!text || !text.trim()) return { valid: false, error: 'empty input' };

  // ── JSON ──────────────────────────────────────────────────────────────────
  try {
    const parsed = JSON.parse(text.trim());
    if (typeof parsed === 'object' && parsed !== null) {
      const result = extractKnownKeys(parsed);
      if (Object.keys(result).length > 0) return { ...result, valid: true };
    }
  } catch {}

  // ── Key=Value ─────────────────────────────────────────────────────────────
  const kvRe = /\b(up2|up1|upper2|upper1|r2|r1|down2|down1|lower2|lower1|s2|s1|mid|midline|ribbon|atr|atr_val|atr_value|bias)\s*[=:]\s*([A-Za-z\d,.+-]+)/gi;
  const kvMatches = {};
  for (const m of text.matchAll(kvRe)) {
    kvMatches[normaliseKey(m[1])] = m[2];
  }
  if (Object.keys(kvMatches).length > 0) {
    const result = extractKnownKeys(kvMatches);
    if (Object.keys(result).length > 0) return { ...result, valid: true };
  }

  // ── Bare numbers (at least 3, assume top-to-bottom) ───────────────────────
  const nums = [...text.matchAll(/\b(\d{4,6}(?:\.\d{1,2})?)\b/g)]
    .map(m => parseFloat(m[1]))
    .filter(n => n > 1000 && n < 99999)
    .sort((a, b) => b - a); // descending

  if (nums.length >= 3) {
    const labels = ['up2', 'up1', 'mid', 'down1', 'down2'];
    const result = {};
    for (let i = 0; i < Math.min(nums.length, labels.length); i++) {
      result[labels[i]] = nums[i];
    }
    return { ...result, valid: true };
  }

  return { valid: false, error: 'could not parse — try: up1=5875 mid=5850 down1=5825' };
}

function normaliseKey(raw) {
  const k = raw.toLowerCase().replace(/[-_\s]/g, '');
  if (['upper2', 'r2'].includes(k)) return 'up2';
  if (['upper1', 'r1'].includes(k)) return 'up1';
  if (['lower2', 's2'].includes(k)) return 'down2';
  if (['lower1', 's1'].includes(k)) return 'down1';
  if (['midline'].includes(k)) return 'mid';
  if (['atrval', 'atrvalue'].includes(k)) return 'atr';
  return k;
}

function extractKnownKeys(obj) {
  const FLOAT_KEYS = ['up2', 'up1', 'mid', 'down1', 'down2', 'atr'];
  const STR_KEYS   = ['ribbon', 'bias', 'ticker'];
  const result = {};
  for (const k of FLOAT_KEYS) {
    if (obj[k] != null) {
      const v = parseFloat(String(obj[k]).replace(/,/g, ''));
      if (!isNaN(v) && v > 0) result[k] = v;
    }
  }
  for (const k of STR_KEYS) {
    if (obj[k]) result[k] = String(obj[k]).toLowerCase().slice(0, 20);
  }
  return result;
}

// ── LEVEL LIST ────────────────────────────────────────────────────────────────

function getAllLevels(satyData) {
  if (!satyData) return [];
  const MAP = [
    { key: 'up2',   label: 'ATR+2' },
    { key: 'up1',   label: 'ATR+1' },
    { key: 'mid',   label: 'Mid'   },
    { key: 'down1', label: 'ATR-1' },
    { key: 'down2', label: 'ATR-2' },
  ];
  return MAP
    .filter(m => satyData[m.key] != null)
    .map(m => ({ label: m.label, price: satyData[m.key] }));
}

// ── ENTRY RECOMMENDATION ──────────────────────────────────────────────────────
// Returns a one-line string to append to the /alert output, or null if nothing useful.

function getSatyRecommendation(entry, direction, stop, satyData) {
  if (!satyData) return null;
  const levels = getAllLevels(satyData);
  if (!levels.length) return null;

  // Find all levels within 20 pts of the entry price
  const nearby = levels
    .map(l => ({ ...l, dist: Math.abs(l.price - entry) }))
    .filter(l => l.dist <= 20)
    .sort((a, b) => a.dist - b.dist);

  if (!nearby.length) {
    // Nothing close — just show nearest
    const nearest = levels
      .map(l => ({ ...l, dist: Math.abs(l.price - entry) }))
      .sort((a, b) => a.dist - b.dist)[0];
    return `📐 Nearest Saty level: ${nearest.label} ${nearest.price} (${Math.round(nearest.dist)} pts away)`;
  }

  const best = nearby[0];

  // Exact hit
  if (best.dist <= 2) {
    return `⚡ Entry hits Saty ${best.label} (${best.price}) — structural entry`;
  }

  // Is this level a better entry? (between current entry and a tighter price)
  const betterForLong  = direction === 'LONG'  && best.price < entry && best.price > stop;
  const betterForShort = direction === 'SHORT' && best.price > entry && best.price < stop;

  if (betterForLong || betterForShort) {
    const improvement = Math.abs(best.price - entry).toFixed(1);
    return `📐 Saty ${best.label} at ${best.price} — bid that instead of ${entry} (+${improvement} pts to entry)`;
  }

  // Level is on the wrong side but close — still informative
  return `📐 Saty ${best.label} at ${best.price} (${Math.round(best.dist)} pts from entry)`;
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
  const levels = getAllLevels(satyData);
  const ribbon = getRibbonLine(satyData);
  const atr    = satyData.atr ? `ATR: ${satyData.atr} pts` : null;
  const age    = Math.round((Date.now() - new Date(satyData.updated).getTime()) / 60000);
  const lines  = [
    `📐 Saty ATR Levels (loaded ${age}m ago):`,
    ...levels.map(l => `  ${l.label}: ${l.price}`),
    ...(ribbon ? [ribbon] : []),
    ...(atr    ? [atr]    : []),
    `\nTo update: /saty up2=XXXX up1=XXXX mid=XXXX down1=XXXX down2=XXXX`,
  ];
  return lines.join('\n');
}

module.exports = {
  loadSatyLevels,
  saveSatyLevels,
  parseSatyText,
  getAllLevels,
  getSatyRecommendation,
  getRibbonLine,
  buildStatusSummary,
};
