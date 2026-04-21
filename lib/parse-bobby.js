'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { BOBBY_HEATMAP_RULES } = require('./bobby-heatmap-rules');

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

  const king_nodes = pricesNear(text, ['king node', 'magnet', 'king\\s+node']);
  const support    = pricesNear(text, ['support', 'cushion', 'pillow', 'floor', 'deflect', 'bounce', 'green']);
  const resistance = pricesNear(text, ['resistance', 'upper node', 'gatekeeper', 'ceiling', 'wall', 'upper\\s+stack', 'red']);

  const anyPrices = king_nodes.length + support.length + resistance.length;
  if (anyPrices === 0) return null;

  return {
    king_nodes,
    support,
    resistance,
    vix_mentioned: /\bvix\b/i.test(text),
    bias: parseBias(text),
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

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `You are analyzing a SPX options dealer gamma heatmap image from Bobby, a professional market analyst. This is NOT an audio spectrogram. It is a financial heatmap showing options dealer positioning across SPX price levels.\n\nExtract and return ONLY valid JSON:\n{\n  "king_nodes": [numbers],\n  "air_pockets": [numbers],\n  "walls": [numbers],\n  "floors": [numbers],\n  "trinity": boolean,\n  "overall_bias": "BULLISH" | "BEARISH" | "NEUTRAL",\n  "notes": string\n}\n\nRules:\n- All price values must be numbers, not strings\n- SPX levels typically 4000–6000 range\n- Dominant colored bar/cluster = king node\n- Empty/thin zones between clusters = air pockets\n- Return empty arrays if levels not identifiable, never guess\n- Return ONLY the JSON object, no markdown, no explanation`,
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

  const king_nodes = (parsed.king_nodes || []).filter(n => typeof n === 'number' && n > 50);
  const air_pockets = (parsed.air_pockets || []).filter(n => typeof n === 'number' && n > 50);
  const walls      = (parsed.walls || []).filter(n => typeof n === 'number' && n > 50);
  const floors     = (parsed.floors || []).filter(n => typeof n === 'number' && n > 50);
  const trinity    = parsed.trinity === true;
  const bias       = parsed.overall_bias || 'NEUTRAL';
  const notes      = parsed.notes || '';

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
