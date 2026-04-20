'use strict';

// Haiku outputs two labeled formats:
//   intraday:    "DIRECTION: LONG\nLEVEL: 5480\nCONVICTION: HIGH"
//   pre-market:  "BIAS: bull | KEY LEVELS: 5480, 5500 | ..."
// Both also fall through to free-text fallback patterns.

const BIAS_MAP = { BULL: 'LONG', BEAR: 'SHORT', LONG: 'LONG', SHORT: 'SHORT', NEUTRAL: 'NEUTRAL' };

function parseBias(text) {
  const m = text.match(/(?:DIRECTION|BIAS)\s*:\s*\[?(LONG|SHORT|BULL|BEAR|NEUTRAL)\]?/i);
  if (m) return BIAS_MAP[m[1].toUpperCase()] || null;
  // free-text fallback: standalone LONG/SHORT/BULLISH/BEARISH
  const f = text.match(/\b(BULLISH|BEARISH|LONG|SHORT|NEUTRAL)\b/i);
  if (f) {
    const v = f[1].toUpperCase();
    if (v === 'BULLISH') return 'LONG';
    if (v === 'BEARISH') return 'SHORT';
    return BIAS_MAP[v] || null;
  }
  return null;
}

function parseLevel(text) {
  // labeled: LEVEL: 5480.25 or LEVEL/STRIKE: $47 or LEVEL/STRIKE: 19,250
  const m = text.match(/LEVEL(?:\/STRIKE)?\s*:\s*\$?([\d,]+(?:\.\d+)?)/i);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  // pre-market labeled: GEX FLIP: 5480 or MAGNET: 5500
  const gex = text.match(/(?:GEX\s*FLIP|MAGNET|KEY\s*LEVELS?)\s*:\s*\[?\$?([\d,]+(?:\.\d+)?)/i);
  if (gex) {
    const n = parseFloat(gex[1].replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

function parseConfidence(text) {
  const m = text.match(/CONVICTION\s*:\s*(HIGH|MEDIUM|LOW)/i);
  if (m) return m[1].toUpperCase();
  return null;
}

/**
 * Parse raw Haiku vision text into a structured signal.
 * @param {string} rawText - unstructured text from Haiku extraction stage
 * @param {string} source  - Discord channel name (e.g. "ximes-dubz")
 * @returns {{ bias, level, confidence, needs_level, source, raw, passToPipeline }}
 */
function parseSignal(rawText, source) {
  // strip bold markdown before any regex runs
  const text = (rawText || '').replace(/\*\*/g, '').replace(/\*/g, '');
  const raw = (rawText || '').slice(0, 200);

  const bias = parseBias(text);
  const level = parseLevel(text);
  let confidence = parseConfidence(text);
  let needs_level = false;

  if (!bias || !confidence) {
    confidence = 'LOW';
  } else if (level === null) {
    if (confidence === 'HIGH') {
      // valid directional + HIGH conviction with no numeric level — pass as partial
      needs_level = true;
    } else {
      confidence = 'LOW';
    }
  }

  const passToPipeline = confidence !== 'LOW';

  return { bias, level, confidence, needs_level, source: source || null, raw, passToPipeline };
}

module.exports = { parseSignal };
