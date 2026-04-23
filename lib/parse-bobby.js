'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { BOBBY_HEATMAP_RULES } = require('./bobby-heatmap-rules');
const { getLivePrice } = require('./live-price');

// Prices adjacent to a keyword (within ~80 chars forward/back)
function pricesNear(text, patterns) {
  const found = [];
  for (const pat of patterns) {
    const re = new RegExp(pat, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const window = text.slice(Math.max(0, m.index - 40), m.index + 80);
      for (const pm of window.matchAll(/\$?([\d,]{3,7}(?:\.\d+)?)/g)) {
        const n = parseFloat(pm[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 100 && !found.includes(n)) found.push(n);
      }
    }
  }
  return found;
}

function parseBias(text) {
  const t = text.toLowerCase();
  const bullSignals = ['upper king node', 'support node', 'support intact', 'cushion', 'pillow', 'bullish', 'higher', 'upside', 'bounce', 'deflection', 'upper node'];
  const bearSignals = ['lower node', 'downside node', 'resistance build', 'bearish', 'lower', 'rug', 'airpocket below', 'air pocket below', 'gatekeeper', 'no floor'];
  const chopSignals = ['choppy', 'chop', 'mid range', 'mid-range', 'purple zone', 'no alignment', 'hard to read', 'unclear'];

  let bull = 0, bear = 0, chop = 0;
  for (const s of bullSignals) if (t.includes(s)) bull++;
  for (const s of bearSignals) if (t.includes(s)) bear++;
  for (const s of chopSignals) if (t.includes(s)) chop++;

  if (chop > 0 && chop >= bull && chop >= bear) return 'NEUTRAL';
  if (bull > bear) return 'BULLISH';
  if (bear > bull) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Parse a Bobby SPX heatmap text message.
 * Returns null if no prices found.
 *
 * @param {string} messageText
 * @returns {object|null}
 */
function parseBobby(messageText) {
  if (!messageText || typeof messageText !== 'string') return null;
  if (messageText.length > 10000) return null; // enforce max paste size
  if (messageText.trim() === '') return null;

  const text = messageText;

  let king_nodes = pricesNear(text, ['king node', 'magnet', 'king\\s+node', 'dominant.*node', 'spx node', 'qqq node', 'spy node', 'sus node', 'node.*at']);
  let support    = pricesNear(text, ['support', 'cushion', 'pillow', 'floor', 'deflect', 'bounce', 'green']);
  let resistance = pricesNear(text, ['resistance', 'upper node', 'gatekeeper', 'ceiling', 'wall', 'upper\\s+stack', 'red']);

  // Fallback: if keyword search found nothing, extract any price-like numbers from plain text
  if (king_nodes.length + support.length + resistance.length === 0) {
    const plain = [];
    for (const pm of text.matchAll(/\$?([\d,]{3,7}(?:\.\d+)?)/g)) {
      const n = parseFloat(pm[1].replace(/,/g, ''));
      if (!isNaN(n) && n > 100 && !plain.includes(n)) plain.push(n);
    }
    if (plain.length === 0) return null;
    king_nodes = plain;
  }

  // Capture directional framing sentences as session bias context
  const framingMatch = text.match(/[^.!?\n]*\b(upper nodes?|lower nodes?|upside|downside)\b[^.!?\n]*/i);
  const bias_statement = framingMatch ? framingMatch[0].trim() : null;

  return {
    king_nodes,
    support,
    resistance,
    vix_mentioned: /\bvix\b/i.test(text),
    bias: parseBias(text),
    bias_statement,
    raw: text.slice(0, 150),
    source: 'bobby-text'
  };
}

/**
 * Parse a Bobby heatmap screenshot via Haiku vision.
 * Returns null on failure or if no prices extracted.
 *
 * @param {string} base64Image - base64-encoded PNG/JPG of the heatmap
 * @returns {Promise<object|null>}
 */
async function parseBobbyImage(base64Image) {
  if (!base64Image) return null;
  if (typeof base64Image !== 'string') return null;

  // Strip data URL prefix if present
  const raw64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');

  const client = new Anthropic();
  const livePrice = await getLivePrice();

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are analyzing a financial dealer gamma heatmap screenshot. This is NOT an audio spectrogram or waveform. It is a table-style options positioning heatmap showing dealer gamma exposure across price levels for one or more tickers.

VISUAL STRUCTURE:
- The image contains 1 to 3 vertical panels placed side by side
- Each panel has a ticker label at the top (e.g. SPXW, SPY, QQQ, SPX, IWM)
- Each panel has a "King" marker at the top pointing at one or two specific highlighted rows
- Each panel is a table with two columns:
  * LEFT column = price level (integer, e.g. 7120, 709, 653)
  * RIGHT column = dealer gamma dollar exposure (e.g. $48,418.7K, -$38,030.7K)
- Rows are highlighted by color:
  * YELLOW or BRIGHT GREEN highlighted row = king node (dominant positioning level)
  * PURPLE or MAGENTA highlighted row = major wall or resistance level
  * RED or ORANGE = strong negative exposure (wall/resistance)
  * Teal/blue rows = minor levels — IGNORE THESE

${livePrice ? `CURRENT PRICE RANGES (live):
- SPX: ${livePrice.spx}
- SPY: ${livePrice.spy.toFixed(2)}
- QQQ: 620 to 700
- IWM: 200 to 260` : ''}

EXTRACTION RULES:
- Only return levels from YELLOW, GREEN, PURPLE, MAGENTA, RED, or ORANGE highlighted rows
- The "King" label at the top of each panel identifies that panel's primary king_node level
- Purple/magenta rows are walls (resistance if above current price, support if below)
- If a current price is shown at the panel top (e.g. "$7117.52"), use it to classify walls vs floors
- If you cannot clearly read a price number, do NOT guess — return empty arrays
- Return ONLY the JSON below, no markdown fences, no explanation

{
  "tickers_detected": ["SPXW", "SPY", "QQQ"],
  "panels": [
    {
      "ticker": "SPXW",
      "current_price": 7117.52,
      "king_nodes": [7125, 7120],
      "walls": [7115],
      "floors": [7100, 7085]
    }
  ],
  "king_nodes": [7125, 7120, 709, 653],
  "walls": [7115, 705, 654],
  "floors": [7100, 7085, 700, 649],
  "air_pockets": [],
  "trinity": true,
  "overall_bias": "BULLISH",
  "notes": "one sentence observation"
}`,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: raw64 }
        }]
      }]
    });
  } catch {
    return null;
  }

  let parsed;
  try {
    const rawText = response.content[0].text.trim();
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  // Defensive fallback: if top-level arrays are empty but panels are present,
  // derive levels from panels (handles cases where model fills panels but not top-level)
  const panels = Array.isArray(parsed.panels) ? parsed.panels : [];
  function fromPanels(field) {
    return panels.flatMap(p => (p[field] || []).filter(n => typeof n === 'number' && n > 50));
  }

  const rawKings  = (parsed.king_nodes || []).filter(n => typeof n === 'number' && n > 50);
  const rawWalls  = (parsed.walls      || []).filter(n => typeof n === 'number' && n > 50);
  const rawFloors = (parsed.floors     || []).filter(n => typeof n === 'number' && n > 50);

  const king_nodes = rawKings.length  ? rawKings  : fromPanels('king_nodes');
  const walls      = rawWalls.length  ? rawWalls  : fromPanels('walls');
  const floors     = rawFloors.length ? rawFloors : fromPanels('floors');
  const air_pockets = (parsed.air_pockets || []).filter(n => typeof n === 'number' && n > 50);
  const trinity    = parsed.trinity === true;
  const bias       = parsed.overall_bias || 'NEUTRAL';
  const notes      = parsed.notes || '';
  const tickers_detected = parsed.tickers_detected || [];

  // Map to parseBobby-compatible structure
  const support    = floors;
  const resistance = walls;

  if (king_nodes.length === 0 && walls.length === 0 && floors.length === 0) {
    console.warn('[bobby-vision] No levels extracted — check image quality');
  }

  return {
    king_nodes,
    air_pockets,
    trinity,
    support,
    resistance,
    tickers_detected,
    vix_mentioned: false,
    bias,
    notes,
    raw: '',
    source: 'bobby-vision',
    vision_parsed: true
  };
}

/**
 * Merge text and vision results. Text wins on conflict.
 * Both may be null; returns null if both are null.
 *
 * @param {object|null} textResult
 * @param {object|null} visionResult
 * @returns {object|null}
 */
function mergeBobby(textResult, visionResult) {
  if (!textResult && !visionResult) return null;
  if (!visionResult) return textResult;
  if (!textResult) return visionResult;

  return {
    king_nodes:    textResult.king_nodes.length  ? textResult.king_nodes  : visionResult.king_nodes,
    support:       textResult.support.length      ? textResult.support      : visionResult.support,
    resistance:    textResult.resistance.length   ? textResult.resistance   : visionResult.resistance,
    vix_mentioned: textResult.vix_mentioned || visionResult.vix_mentioned,
    bias:          textResult.bias !== 'NEUTRAL'  ? textResult.bias         : visionResult.bias,
    raw:           textResult.raw,
    source:        'bobby-merged'
  };
}

module.exports = { parseBobby, parseBobbyImage, mergeBobby };
