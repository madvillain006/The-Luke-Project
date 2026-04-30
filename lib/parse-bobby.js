'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { BOBBY_HEATMAP_RULES } = require('./bobby-heatmap-rules');
const { getLivePrice } = require('./live-price');
const { recordLevel }  = require('./level-memory');

// Detect image MIME type from magic bytes.
// Accepts either a plain base64 string (data URL prefix already stripped) or a raw Buffer.
// Throws a descriptive error rather than silently defaulting — silent default was the Phase 0 bug.
function detectMediaType(input) {
  let bytes;
  if (Buffer.isBuffer(input)) {
    bytes = input.slice(0, 12);
  } else if (typeof input === 'string') {
    bytes = Buffer.from(input.slice(0, 16), 'base64');
  } else {
    throw new Error(`detectMediaType: expected string or Buffer, got ${typeof input}`);
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  // WebP: RIFF????WEBP (12-byte signature)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  throw new Error(
    `detectMediaType: unrecognized image format (first bytes: ${bytes.slice(0, 4).toString('hex')})`
  );
}

// Prices adjacent to a keyword (within ~80 chars forward/back)
function pricesNear(text, patterns) {
  const found = [];
  for (const pat of patterns) {
    const re = new RegExp(pat, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      // Extend boundaries past any mid-number bisection so partial digits never match.
      let wStart = Math.max(0, m.index - 40);
      while (wStart > 0 && /\d/.test(text[wStart - 1])) wStart--;
      let wEnd = m.index + 80;
      while (wEnd < text.length && /\d/.test(text[wEnd])) wEnd++;
      const window = text.slice(wStart, wEnd);
      for (const pm of window.matchAll(/\$?\b([\d,]{3,9}(?:\.\d+)?)\b/g)) {
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

// ── PANEL HELPERS ──────────────────────────────────────────────────────────────

// Maps heatmap ticker labels to Level Memory instrument keys.
// SPXW is the SPXW/SPX weekly options product — same underlying as SPX for level tracking.
// IWM is not in level-memory's CANONICAL_TOLERANCE; writes are skipped.
const TICKER_TO_INSTRUMENT = {
  SPXW: 'SPX', SPX: 'SPX', SPY: 'SPY', QQQ: 'QQQ', IWM: null,
};

// Resolve grounded price for a panel ticker from getLivePrice() data.
function getGroundedPrice(ticker, livePrice) {
  if (!livePrice) return null;
  if (ticker === 'SPXW' || ticker === 'SPX')
    return typeof livePrice.spx === 'number' ? livePrice.spx : null;
  if (ticker === 'SPY')
    return typeof livePrice.spy === 'number' ? livePrice.spy : null;
  if (ticker === 'QQQ')
    return livePrice.instruments?.qqq?.price ?? null;
  return null;
}

/**
 * normalizePanels(rawPanels, livePrice)
 *
 * Converts raw model panel output into the normalized panel schema. Three steps:
 *   G1 (B-2): adds `instrument` field (SPXW→SPX, SPY→SPY, QQQ→QQQ, IWM→null)
 *   G3 (B-1): deduplicates king_nodes out of walls/floors (within ±0.5)
 *   G2 (B-3): deterministically reclassifies walls/floors using grounded current_price
 *             (level < price → support, level > price → resistance, ≈price → skip)
 *
 * Fails open when livePrice is null — no canonical price means model's classification
 * is preserved as-is (C1: live price is grounding, not a gate).
 *
 * Exported for unit testing.
 */
function normalizePanels(rawPanels, livePrice) {
  if (!Array.isArray(rawPanels)) return [];

  const KING_DEDUP_TOL = 0.5; // within ±0.5 of a king node = duplicate
  const AT_PRICE_TOL   = 0.5; // within ±0.5 of current price = skip from support/resistance

  return rawPanels.map(rawPanel => {
    const ticker     = typeof rawPanel.ticker === 'string' ? rawPanel.ticker.toUpperCase() : 'UNKNOWN';
    const instrument = TICKER_TO_INSTRUMENT[ticker] ?? null;

    const kingNodes = (rawPanel.king_nodes || []).filter(n => typeof n === 'number' && n > 50);
    const walls     = (rawPanel.walls     || []).filter(n => typeof n === 'number' && n > 50);
    const floors    = (rawPanel.floors    || []).filter(n => typeof n === 'number' && n > 50);
    const visionCurrentPrice = typeof rawPanel.current_price === 'number' ? rawPanel.current_price : null;

    // G3: remove from walls/floors any value that also appears in king_nodes (±0.5)
    const dedupedWalls  = walls.filter(w  => !kingNodes.some(k => Math.abs(k - w)  <= KING_DEDUP_TOL));
    const dedupedFloors = floors.filter(f => !kingNodes.some(k => Math.abs(k - f) <= KING_DEDUP_TOL));

    // G2: ground current_price; log when vision's value diverges meaningfully
    const groundedPrice  = getGroundedPrice(ticker, livePrice);
    const canonicalPrice = groundedPrice ?? visionCurrentPrice;

    if (groundedPrice != null && visionCurrentPrice != null) {
      const pctDiff = Math.abs(visionCurrentPrice - groundedPrice) / groundedPrice;
      if (pctDiff > 0.005) {
        console.warn(
          `[bobby-vision] ${ticker} current_price mismatch: vision=${visionCurrentPrice} ` +
          `grounded=${groundedPrice} (${(pctDiff * 100).toFixed(2)}% diff)`
        );
      }
    }

    let support, resistance;
    if (canonicalPrice != null) {
      // Deterministic reclassification overrides model's wall/floor assignment
      const allLevels = [...dedupedWalls, ...dedupedFloors];
      support    = [];
      resistance = [];
      for (const lvl of allLevels) {
        if (Math.abs(lvl - canonicalPrice) <= AT_PRICE_TOL) continue; // at-price → skip
        if (lvl < canonicalPrice) support.push(lvl);
        else resistance.push(lvl);
      }
    } else {
      // No canonical price — fall back to model's classification (C1: fail-open)
      support    = dedupedFloors;
      resistance = dedupedWalls;
    }

    return { ticker, instrument, current_price: canonicalPrice ?? visionCurrentPrice, king_nodes: kingNodes, support, resistance };
  });
}

// ── TEXT PARSER ────────────────────────────────────────────────────────────────

/**
 * parseBobby(messageText)
 * Parse a Bobby SPX heatmap text message.
 *
 * Gate B-4: returns a bias-only result (empty level arrays) when the text has
 * directional commentary signals but no prices. Previously returned null, silently
 * discarding Bobby's qualitative analysis.
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
    if (plain.length === 0) {
      // Gate B-4: no prices at all — surface bias signal if directional language is present.
      // Bobby's text posts are commentary; they carry bias even when prices are absent.
      const t = text.toLowerCase();
      const hasBullSignal = ['upper king node', 'support node', 'support intact', 'cushion', 'pillow',
        'bullish', 'higher', 'upside', 'bounce', 'deflection', 'upper node'].some(s => t.includes(s));
      const hasBearSignal = ['lower node', 'downside node', 'resistance build', 'bearish', 'lower',
        'rug', 'airpocket below', 'air pocket below', 'gatekeeper', 'no floor'].some(s => t.includes(s));
      const hasChopSignal = ['choppy', 'chop', 'mid range', 'mid-range', 'purple zone',
        'no alignment', 'hard to read', 'unclear'].some(s => t.includes(s));
      if (!hasBullSignal && !hasBearSignal && !hasChopSignal) return null;

      const bias = parseBias(text);
      const framingMatch = text.match(/[^.!?\n]*\b(upper nodes?|lower nodes?|upside|downside)\b[^.!?\n]*/i);
      return {
        king_nodes: [], support: [], resistance: [],
        vix_mentioned: /\bvix\b/i.test(text),
        bias,
        bias_statement: framingMatch ? framingMatch[0].trim() : null,
        raw: text.slice(0, 150),
        source: 'bobby-text',
      };
    }
    king_nodes = plain;
  }

  // Keyword overlap: same price pulled in by multiple keyword classes creates phantom level writes.
  // king_nodes is authoritative; non-king support+resistance overlap is treated as pure keyword pollution.
  const _kingSet = new Set(king_nodes);
  support    = support.filter(p => !_kingSet.has(p));
  resistance = resistance.filter(p => !_kingSet.has(p));
  const _supportSet = new Set(support);
  const _resistanceSet = new Set(resistance);
  support    = support.filter(p => !_resistanceSet.has(p));
  resistance = resistance.filter(p => !_supportSet.has(p));

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

// ── IMAGE PARSER ───────────────────────────────────────────────────────────────

/**
 * parseBobbyImage(base64Image, livePrices?)
 * Parse a Bobby heatmap screenshot via vision.
 *
 * livePrices: optional getLivePrice() result. If null, fetched internally.
 *   Pass it from caller context when already fetched to avoid a second API call.
 *   C1 (fail-open): null livePrices does NOT prevent parsing.
 *
 * Returns: { panels, king_nodes, support, resistance, ... } | { parse_status: 'failed', error }
 *
 * panels: per-instrument authoritative data (G1/B-2)
 * king_nodes/support/resistance: legacy flat arrays (backward compat for slash-commands/index.js)
 *
 * @param {string} base64Image - base64-encoded PNG/JPG of the heatmap
 * @param {object|null} livePrices - optional getLivePrice() result
 * @returns {Promise<object|null>}
 */
async function parseBobbyImage(base64Image, livePrices = null) {
  if (!base64Image) return null;
  if (typeof base64Image !== 'string') return null;

  // Strip data URL prefix if present
  const raw64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');

  const client = new Anthropic();

  // G2: use passed livePrices or fetch internally. getLivePrice() never throws — returns null on failure.
  const livePrice = livePrices ?? (await getLivePrice());

  // Build price range context. If live data has QQQ, use it; otherwise show a range.
  const qqqPrice = livePrice?.instruments?.qqq?.price;
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
  * PURPLE or MAGENTA highlighted row = major wall or floor
  * RED or ORANGE = strong negative exposure (wall/resistance)
  * Teal/blue rows = minor levels — IGNORE THESE

${livePrice
  ? `CURRENT PRICE RANGES (live):
- SPX / SPXW: ${livePrice.spx}
- SPY: ${livePrice.spy.toFixed(2)}
- QQQ: ${qqqPrice != null ? qqqPrice.toFixed(2) : '620–700'}
- IWM: 200 to 260`
  : `PRICE RANGES (approximate — live data unavailable):
- SPX / SPXW: 6500 to 7500 range in 2026
- SPY: 650 to 750 range in 2026
- QQQ: 600 to 700 range in 2026
- IWM: 200 to 260 range in 2026`}

EXTRACTION RULES:
- You must read the EXACT strike prices from the image columns (SPXW, SPY, QQQ). Do NOT guess or hallucinate corresponding ES or NQ futures levels. Only return the exact numerical nodes you see highlighted in yellow or marked with a star in the SPXW, SPY, and QQQ columns.
- Only return levels from YELLOW, GREEN, PURPLE, MAGENTA, RED, or ORANGE highlighted rows
- The "King" label at the top of each panel identifies that panel's primary king_node level
- king_nodes are gamma anchors — do NOT list them in walls or floors as well; they are separate
- Purple/magenta rows are classified by position relative to the panel's current_price:
  * row price ABOVE current_price → wall (resistance)
  * row price BELOW current_price → floor (support)
- If a current price is shown at the panel top (e.g. "$7117.52"), use it to classify walls vs floors
- If you cannot clearly read a price number, do NOT guess — return empty arrays
- SPXW levels map directly to SPX. Do NOT attempt to calculate or infer ES or NQ futures equivalents.
- Return ONLY the JSON below, no markdown fences, no explanation

{
  "tickers_detected": ["SPXW", "SPY", "QQQ"],
  "panels": [
    {
      "ticker": "SPXW",
      "current_price": 7117.52,
      "king_nodes": [7125],
      "walls": [7150, 7160],
      "floors": [7100, 7085]
    },
    {
      "ticker": "SPY",
      "current_price": 709.50,
      "king_nodes": [709],
      "walls": [715, 720],
      "floors": [705, 700]
    },
    {
      "ticker": "QQQ",
      "current_price": 654.20,
      "king_nodes": [654],
      "walls": [660, 665],
      "floors": [650, 648]
    }
  ],
  "air_pockets": [],
  "trinity": true,
  "overall_bias": "BULLISH",
  "notes": "one sentence observation"
}`,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: detectMediaType(raw64), data: raw64 }
        }]
      }]
    });
  } catch (err) {
    console.error('[bobby-vision] API call failed:', err.message);
    return { parse_status: 'failed', error: `API call failed: ${err.message}` };
  }

  let parsed;
  try {
    const rawText = response.content[0].text.trim();
    console.log('[bobby-vision] raw response:', rawText.slice(0, 300));
    // Strip code fences then fall back to extracting the first {...} block
    let jsonStr = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    if (!jsonStr.trimStart().startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('no JSON object found in response');
      jsonStr = m[0];
    }
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const rawSnippet = response.content[0]?.text?.slice(0, 150) || '';
    console.error('[bobby-vision] JSON parse failed:', err.message, '| raw:', rawSnippet);
    return { parse_status: 'failed', error: `JSON parse failed: ${err.message} | raw: ${rawSnippet}` };
  }

  // G1/G2/G3: normalize panels — adds instrument field, deduplicates king nodes,
  // and reclassifies walls/floors deterministically using grounded current_price.
  const rawPanels       = Array.isArray(parsed.panels) ? parsed.panels : [];
  const panels          = normalizePanels(rawPanels, livePrice);

  // Build legacy flat arrays from panels (backward compat — slash-commands.js, index.js read these)
  const king_nodes  = panels.flatMap(p => p.king_nodes);
  const support     = panels.flatMap(p => p.support);
  const resistance  = panels.flatMap(p => p.resistance);
  const air_pockets = (parsed.air_pockets || []).filter(n => typeof n === 'number' && n > 50);
  const trinity     = parsed.trinity === true;
  const bias        = parsed.overall_bias || 'NEUTRAL';
  const notes       = parsed.notes || '';
  const tickers_detected = parsed.tickers_detected || [];

  if (panels.length === 0) {
    console.warn('[bobby-vision] No panels extracted — check image quality');
  }

  return {
    panels,            // authoritative per-instrument data (G1/B-2)
    king_nodes,        // legacy flat arrays (backward compat)
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
    vision_parsed: true,
  };
}

// ── MERGE ──────────────────────────────────────────────────────────────────────

/**
 * mergeBobby(textResult, visionResult)
 * Merge text and vision results. Text wins on conflict.
 * Both may be null; returns null if both are null.
 *
 * G1 (B-2): propagates panels array from visionResult into merged output.
 * Text bias_statement and vix_mentioned are preserved in the merged result.
 * Legacy flat arrays (king_nodes/support/resistance) follow text-wins precedence
 * for backward compat with slash-commands.js/index.js callers.
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
    panels:           visionResult.panels || [],
    // Legacy flat arrays — text wins when non-empty (C2: text wins over image on metadata)
    king_nodes:       textResult.king_nodes.length  ? textResult.king_nodes  : visionResult.king_nodes,
    support:          textResult.support.length      ? textResult.support      : visionResult.support,
    resistance:       textResult.resistance.length   ? textResult.resistance   : visionResult.resistance,
    vix_mentioned:    textResult.vix_mentioned || visionResult.vix_mentioned,
    bias:             textResult.bias !== 'NEUTRAL'  ? textResult.bias         : visionResult.bias,
    bias_statement:   textResult.bias_statement || null,
    raw:              textResult.raw,
    trinity:          visionResult.trinity,
    notes:            visionResult.notes,
    tickers_detected: visionResult.tickers_detected || [],
    source:           'bobby-merged',
  };
}

// ── LEVEL MEMORY INTEGRATION ──────────────────────────────────────────────────

/**
 * appendBobbyToMemory(result)
 * Appends king_nodes, support, and resistance from a Bobby parse result to Level Memory.
 *
 * G1 (B-2): iterates panels for per-instrument writes (SPXW→SPX, SPY→SPY, QQQ→QQQ).
 * Falls back to flat array iteration with instrument='SPX' for text-only results.
 *
 * Per C3: append-only writes only.
 * Per C4: each recordLevel call is in its own try/catch. A Level Memory failure is logged
 * but NEVER blocks the Bobby state save — Bobby is the authoritative parse record.
 */
async function appendBobbyToMemory(result) {
  if (!result) return;

  const sourceType = (result.source === 'bobby-vision' || result.source === 'bobby-merged')
    ? 'vision' : 'text';
  const snippet   = result.notes ? String(result.notes).slice(0, 200) : null;
  const timestamp = new Date().toISOString();

  // Per-instrument path: vision/merged results carry panels with ticker→instrument mapping
  if (result.panels && result.panels.length > 0) {
    // For merged results, a king_node confirmed by both text and vision carries crossSourceConfirmed.
    const isMerged    = result.source === 'bobby-merged';
    const textKingSet = isMerged ? new Set(result.king_nodes || []) : new Set();

    for (const panel of result.panels) {
      const instrument = panel.instrument;
      if (!instrument) continue; // IWM or unknown ticker — skip (not in CANONICAL_TOLERANCE)

      const entries = [
        ...(panel.king_nodes || []).map(price => ({
          price, significance: 'key', direction: null,
          crossSourceConfirmed: isMerged && textKingSet.has(price),
        })),
        ...(panel.support    || []).map(price => ({
          price, significance: 'unclear', direction: 'support',
          crossSourceConfirmed: false,
        })),
        ...(panel.resistance || []).map(price => ({
          price, significance: 'unclear', direction: 'resistance',
          crossSourceConfirmed: false,
        })),
      ];
      for (const { price, significance, direction, crossSourceConfirmed } of entries) {
        try {
          await recordLevel({ analyst: 'bobby', instrument, price, significance, direction,
            intent: null, source_type: sourceType, source_snippet: snippet, timestamp,
            crossSourceConfirmed });
        } catch (err) {
          console.error('[level-memory] bobby write failed:', err.message);
        }
      }
    }
    return;
  }

  // Fallback path: text-only results (no panels) — write all levels as SPX
  // Bobby's text posts primarily discuss SPX positioning.
  const entries = [
    ...(result.king_nodes || []).map(price => ({ price, significance: 'key',     direction: null })),
    ...(result.support    || []).map(price => ({ price, significance: 'unclear', direction: 'support' })),
    ...(result.resistance || []).map(price => ({ price, significance: 'unclear', direction: 'resistance' })),
  ];
  for (const { price, significance, direction } of entries) {
    try {
      await recordLevel({ analyst: 'bobby', instrument: 'SPX', price, significance, direction,
        intent: null, source_type: sourceType, source_snippet: snippet, timestamp });
    } catch (err) {
      console.error('[level-memory] bobby write failed:', err.message);
    }
  }
}

module.exports = {
  parseBobby, parseBobbyImage, mergeBobby, appendBobbyToMemory, detectMediaType,
  // Exported for unit testing — not for production use outside tests
  normalizePanels, getGroundedPrice,
};
