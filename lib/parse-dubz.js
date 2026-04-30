'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');
const { detectMediaType } = require('./parse-bobby');
const { getLivePrice }    = require('./live-price');
const { writeJsonAtomic } = require('../state/lib');
const { recordLevel }     = require('./level-memory');

const DUBZ_FILE = path.join(__dirname, '../data/dubz-levels.json');

function todayKeyET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// ── INSTRUMENT CONSTANTS ───────────────────────────────────────────────────────

const INSTRUMENT_CANON = {
  NQ: 'NQ', MNQ: 'NQ',
  ES: 'ES', MES: 'ES',
  QQQ: 'QQQ', QS: 'QQQ',
  SPY: 'SPY',
};

const PRICE_RANGES = {
  NQ:  { min: 10000, max: 50000 },
  ES:  { min: 3000,  max: 20000 },
  QQQ: { min: 100,   max: 2000  },
  SPY: { min: 100,   max: 1000  },
};

// Build ±5% bounds from live instrument prices. Keys are uppercase instrument names.
// Falls back to PRICE_RANGES (wide sanity bounds) when live data is absent.
function buildLiveBounds(instruments) {
  const bounds = {};
  const PCT = 0.05;
  for (const [key, instr] of Object.entries(instruments)) {
    if (!instr?.price) continue;
    const canon = key.toUpperCase();
    bounds[canon] = { min: instr.price * (1 - PCT), max: instr.price * (1 + PCT) };
  }
  return bounds;
}

// When text and image levels for the same instrument differ by (min, max] points, flag conflict.
const CONFLICT_TOL = {
  NQ:  { min: 1,    max: 30 },
  ES:  { min: 0.25, max: 10 },
  QQQ: { min: 0.10, max: 5  },
  SPY: { min: 0.10, max: 5  },
};

// ── TEXT PARSER PATTERNS ───────────────────────────────────────────────────────

// Instrument scan — also matches contract codes like NQM2026
const INSTR_RE = /\b(NQ(?:M\d+)?|MNQ|ES(?:M\d+)?|MES|QQQ|Qs|SPY)\b/gi;

// Significance signals
const KEY_SIGNIFICANCE_RE   = /\b(major\s+level|major|key\s+level|key|critical|significant\s+flip|significant|strong|must[\s-]hold|primary)\b/i;
const MINOR_SIGNIFICANCE_RE = /\b(minor|not\s+a\s+major|less\s+important|actionable|likely\s+actionable|secondary|not\s+major)\b/i;
const KEY_EMOJI_RE          = /[🔑⭐💎🌟✨]/;

// Direction signals
const FLIP_RE            = /\b(significant\s+flip|key\s+flip|flip)\b/i;
const SUPPORT_RE         = /\b(support|demand|floor|hold|bounce|buying|bid|long)\b/i;
const RESISTANCE_RE      = /\b(resistance|supply|ceiling|cap|wall|selling|ask|short|reject(?:ion)?)\b/i;
// Negation: "overhead resistance" and "resistance is thin" describe context above the level,
// not the level's own direction — suppress the resistance direction signal.
const RESISTANCE_NEGATE_RE = /\boverhead\s+resistance\b|resistance\s+is\s+thin\b/i;

// Intent signals
const LONG_RETEST_RE = /\b(long[\s-]term\s+retest|retest\s+long|long\s+retest|long\s+on\s+retest|buy\s+the\s+retest)\b/i;
const FADE_RE        = /\b(fade\s+rejection|fade\s+the\s+rejection|short\s+on\s+rejection)\b/i;

// Carry-forward: analyst posts that levels are unchanged from prior session
const CARRY_FORWARD_RE = /\b(no\s+changes?|same\s+levels?|no\s+updates?|levels?\s+are\s+the\s+same|tradingview\s+script\s+unchanged)\b/i;

// Phrase-direction: "calls off [price]" → support, "puts off [price]" → resistance
const CALLS_OFF_RE = /\bcalls\s+off\s+([\d,]{3,9}(?:\.\d{1,2})?)/gi;
const PUTS_OFF_RE  = /\bputs\s+off\s+([\d,]{3,9}(?:\.\d{1,2})?)/gi;

// Compound attribution: "A and B verbed X & Y" — if gap between two instruments
// is only a connector, extend the first instrument's window to cover the second's
// range so prices are attributed by the per-instrument price-range filter.
const COMPOUND_CONNECTOR_RE = /^\s*(?:and|or|&)\s*$/i;

// ── HELPERS ────────────────────────────────────────────────────────────────────

function normalizeInstrument(raw) {
  const base = raw.toUpperCase().replace(/M\d+$/, '').replace(/[1!]$/, '').replace(/^\//, '');
  return INSTRUMENT_CANON[base] || null;
}

function isValidPrice(instrument, price, liveBounds = null) {
  if (liveBounds?.[instrument]) {
    const { min, max } = liveBounds[instrument];
    return price >= min && price <= max;
  }
  const range = PRICE_RANGES[instrument];
  return range ? price >= range.min && price <= range.max : false;
}

function parsePrice(str) {
  return parseFloat(str.replace(/,/g, ''));
}

function detectSig(ctx) {
  if (KEY_EMOJI_RE.test(ctx))
    return { significance: 'key', significance_signal: 'key_emoji' };
  if (KEY_SIGNIFICANCE_RE.test(ctx) && !MINOR_SIGNIFICANCE_RE.test(ctx))
    return { significance: 'key', significance_signal: 'language' };
  if (MINOR_SIGNIFICANCE_RE.test(ctx))
    return { significance: 'minor', significance_signal: 'language' };
  return { significance: 'unclear', significance_signal: 'unstated' };
}

function detectDir(ctx) {
  if (FLIP_RE.test(ctx)) return 'flip';
  const hasSupport = SUPPORT_RE.test(ctx);
  let hasResist    = RESISTANCE_RE.test(ctx);
  if (hasResist && RESISTANCE_NEGATE_RE.test(ctx)) hasResist = false;
  if (hasSupport && !hasResist) return 'support';
  if (hasResist && !hasSupport) return 'resistance';
  return null;
}

function detectIntent(ctx) {
  if (LONG_RETEST_RE.test(ctx)) return 'long_retest';
  if (FADE_RE.test(ctx)) return 'fade_rejection';
  return null;
}

// ── TEXT PARSER ────────────────────────────────────────────────────────────────

// Fallback reference prices when Polygon data is unavailable (rough 2026 mid-range values).
const INSTR_FALLBACK_PRICE = { NQ: 19000, ES: 5500, QQQ: 460, SPY: 540 };

/**
 * inferInstrumentFromPrice(price, livePrices)
 * Returns { instrument, confidence } for the best-match instrument within 10% of price,
 * or null if nothing is within 10%.
 * confidence = 1 - (abs distance / currentPrice), so 0.90 = 10% away, 1.0 = exact match.
 */
function inferInstrumentFromPrice(price, livePrices) {
  const instruments = livePrices?.instruments;
  let best = null;
  for (const key of ['nq', 'es', 'qqq', 'spy']) {
    const refPrice = instruments?.[key]?.price ?? INSTR_FALLBACK_PRICE[key.toUpperCase()];
    if (!refPrice) continue;
    const distance = Math.abs(price - refPrice) / refPrice;
    if (distance > 0.10) continue;
    const confidence = 1 - distance;
    if (!best || confidence > best.confidence) {
      best = { instrument: key.toUpperCase(), confidence };
    }
  }
  return best;
}

/**
 * parseDubzText(rawText, livePrices?)
 * Extracts per-instrument levels from Dubz prose.
 * livePrices: result of getLivePrice() — used to derive ±5% plausibility bounds.
 * Falls back to wide hardcoded PRICE_RANGES if null. Never blocks on Polygon failure.
 * Returns: { instruments: { NQ, ES, QQQ, SPY }, parse_errors: [] }
 */
function parseDubzText(rawText, livePrices = null) {
  const liveBounds = livePrices?.instruments ? buildLiveBounds(livePrices.instruments) : null;
  const emptyResult = {
    instruments: { NQ: { levels: [] }, ES: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] } },
    parse_errors: [],
  };
  if (!rawText || !rawText.trim()) {
    emptyResult.parse_errors.push('empty input');
    return emptyResult;
  }

  const text = rawText.replace(/\r\n/g, '\n');
  const result = {
    instruments: { NQ: { levels: [] }, ES: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] } },
    parse_errors: [],
  };

  if (CARRY_FORWARD_RE.test(text)) return { ...result, carry_forward: true };

  // Step 1: locate all instrument mentions
  const instrOccurrences = [];
  const instrScan = new RegExp(INSTR_RE.source, 'gi');
  let im;
  while ((im = instrScan.exec(text)) !== null) {
    const instrument = normalizeInstrument(im[1]);
    if (instrument) instrOccurrences.push({ instrument, start: im.index, end: im.index + im[0].length });
  }
  // Phrase-direction pre-scan — runs unconditionally so "calls off / puts off" directions
  // are available for both explicitly attributed and implicitly inferred levels.
  const phraseDirections = new Map();
  for (const [src, dir] of [[CALLS_OFF_RE.source, 'support'], [PUTS_OFF_RE.source, 'resistance']]) {
    const re = new RegExp(src, 'gi');
    let pmx;
    while ((pmx = re.exec(text)) !== null) phraseDirections.set(parsePrice(pmx[1]), dir);
  }

  if (instrOccurrences.length === 0) {
    result.parse_errors.push('no instruments detected in text');
    // No early return — fall through to Step 5 implicit inference below.
  }

  // Step 2: for each instrument occurrence, scan its forward window for prices
  const rawTuples = []; // { instrument, price, pricePos, instrPos }

  for (let i = 0; i < instrOccurrences.length; i++) {
    const { instrument, start: instrStart, end: windowStart } = instrOccurrences[i];
    // Window ends at the next instrument occurrence or +400 chars, whichever comes first
    let windowEnd = Math.min(
      instrOccurrences[i + 1]?.start ?? (windowStart + 400),
      windowStart + 400
    );
    // Compound attribution: "A and B verbed X & Y" — if the gap to the next
    // instrument is only a connector ("and", "or", "&"), extend this instrument's
    // window to cover the next instrument's price window too. The per-instrument
    // price-range filter then naturally assigns each price to the right instrument.
    if (instrOccurrences[i + 1]) {
      const gap = text.slice(windowStart, instrOccurrences[i + 1].start);
      if (COMPOUND_CONNECTOR_RE.test(gap)) {
        const nextEnd = instrOccurrences[i + 1].end;
        windowEnd = Math.min(
          instrOccurrences[i + 2]?.start ?? (nextEnd + 400),
          nextEnd + 400
        );
      }
    }
    const window = text.slice(windowStart, windowEnd);

    const foundInWindow = []; // { price, absPos }

    // Slash-separated pairs first (e.g. 698.34/702.65 → two separate levels)
    const slashRe = /\b([\d,]{3,9}(?:\.\d{1,2})?)\s*\/\s*([\d,]{3,9}(?:\.\d{1,2})?)\b/g;
    let sm;
    while ((sm = slashRe.exec(window)) !== null) {
      const p1 = parsePrice(sm[1]);
      const p2 = parsePrice(sm[2]);
      // p2 offset: find its raw position within the match
      const p2RelOffset = sm[0].lastIndexOf(sm[2]);
      if (isValidPrice(instrument, p1, liveBounds))
        foundInWindow.push({ price: p1, absPos: windowStart + sm.index });
      if (isValidPrice(instrument, p2, liveBounds))
        foundInWindow.push({ price: p2, absPos: windowStart + sm.index + p2RelOffset });
    }

    // Single prices not already covered by slash pairs
    const singleRe = /\b([\d,]{3,9}(?:\.\d{1,2})?)\b/g;
    let pm;
    while ((pm = singleRe.exec(window)) !== null) {
      const price = parsePrice(pm[1]);
      if (!isValidPrice(instrument, price, liveBounds)) continue;
      const alreadyCovered = foundInWindow.some(f => Math.abs(f.price - price) < 0.01);
      if (!alreadyCovered) foundInWindow.push({ price, absPos: windowStart + pm.index });
    }

    for (const { price, absPos } of foundInWindow) {
      // Next ANY instrument occurrence after this price — used to bound context windows
      // so that one instrument's description doesn't bleed into the next.
      const nextAnyInstr = instrOccurrences.find(io => io.start > absPos);
      rawTuples.push({ instrument, price, pricePos: absPos, instrPos: instrStart,
                       nextAnyInstrPos: nextAnyInstr?.start ?? Infinity });
    }
  }

  if (rawTuples.length === 0 && instrOccurrences.length > 0) {
    result.parse_errors.push('no price levels extracted from text');
    // No early return — fall through to Step 5 implicit inference below.
  }

  // Sort tuples by pricePos for next-price lookups
  rawTuples.sort((a, b) => a.pricePos - b.pricePos);

  // Step 3: group by (instrument, price) and collect contexts for best-wins
  const groups = new Map();
  for (let idx = 0; idx < rawTuples.length; idx++) {
    const t = rawTuples[idx];
    const key = `${t.instrument}:${t.price}`;

    // sigCtx: forward from this price, bounded by (a) next same-instrument price,
    // (b) next ANY instrument occurrence, (c) +200 chars.
    // Tight forward bound prevents "not a major level" from the next price bleeding
    // back, and prevents cross-instrument context pollution.
    const nextSameInstr = rawTuples.slice(idx + 1).find(x => x.instrument === t.instrument);
    const sigEnd = Math.min(
      nextSameInstr?.pricePos ?? Infinity,
      t.nextAnyInstrPos,
      t.pricePos + 200,
      text.length
    );
    const sigCtx = text.slice(t.pricePos, sigEnd);

    // broadCtx: forward-only from the instrument mention to next instrument boundary.
    // Starting at instrPos (not pricePos - 80) prevents earlier instrument descriptions
    // from contaminating direction/intent for the current instrument.
    const broadCtx = text.slice(
      t.instrPos,
      Math.min(t.nextAnyInstrPos, t.instrPos + 300, text.length)
    );

    // source_snippet: text from the instrument mention, ~150 chars
    const sourceSnippet = text
      .slice(t.instrPos, Math.min(text.length, t.instrPos + 160))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);

    if (!groups.has(key)) groups.set(key, { instrument: t.instrument, price: t.price, entries: [] });
    groups.get(key).entries.push({ sigCtx, broadCtx, sourceSnippet });
  }

  // Step 4: for each group, pick best metadata (key > minor > unclear; first explicit for dir/intent)
  for (const [, group] of groups) {
    const { instrument, price, entries } = group;

    let significance         = 'unclear';
    let significance_signal  = 'unstated';
    let direction            = null;
    let intent               = null;
    const sourceSnippet      = entries[0].sourceSnippet;

    for (const { sigCtx, broadCtx } of entries) {
      // Significance best-wins: key > minor > unclear.
      // Within 'key', key_emoji is stronger evidence than language — upgrade the signal.
      const sig = detectSig(sigCtx);
      if (sig.significance === 'key') {
        if (significance !== 'key') {
          significance        = 'key';
          significance_signal = sig.significance_signal;
        } else if (sig.significance_signal === 'key_emoji' && significance_signal !== 'key_emoji') {
          significance_signal = 'key_emoji';
        }
      } else if (sig.significance === 'minor' && significance === 'unclear') {
        significance        = 'minor';
        significance_signal = sig.significance_signal;
      }
      if (!direction) direction = phraseDirections.get(price) ?? detectDir(broadCtx);
      if (!intent)    intent    = detectIntent(broadCtx);
    }

    result.instruments[instrument].levels.push({
      price,
      significance,
      significance_signal,
      direction,
      intent,
      source: 'text',
      source_snippet: sourceSnippet,
    });
  }

  // Step 5: implicit instrument inference for prices not attributed to any explicit instrument.
  // Handles messages with no ticker mentions and prices that fall outside instrument windows.
  const attributedPrices = new Set(rawTuples.map(t => t.price));
  const allPriceRe = /\b([\d,]{3,9}(?:\.\d{1,2})?)\b/g;
  let cpm;
  while ((cpm = allPriceRe.exec(text)) !== null) {
    const price = parsePrice(cpm[1]);
    if (price <= 100) continue;
    if (attributedPrices.has(price)) continue;

    const inferred = inferInstrumentFromPrice(price, livePrices);
    if (!inferred || inferred.confidence < 0.70) {
      if (inferred) {
        result.parse_errors.push(
          `inference below threshold for ${price} (best: ${inferred.instrument} conf=${inferred.confidence.toFixed(3)})`
        );
      }
      continue;
    }

    const alreadyPresent = result.instruments[inferred.instrument].levels.some(
      l => Math.abs(l.price - price) < 0.01
    );
    if (alreadyPresent) continue;

    const snippet = text
      .slice(Math.max(0, cpm.index - 80), Math.min(text.length, cpm.index + 120))
      .replace(/\s+/g, ' ').trim().slice(0, 150);
    // Only apply language significance signals when confidence is high enough to trust context
    const sigCtx    = text.slice(cpm.index, Math.min(text.length, cpm.index + 200));
    const sigResult = inferred.confidence >= 0.85
      ? detectSig(sigCtx)
      : { significance: 'unclear', significance_signal: 'unstated' };

    result.instruments[inferred.instrument].levels.push({
      price,
      significance:         sigResult.significance,
      significance_signal:  sigResult.significance_signal,
      direction:            phraseDirections.get(price) ?? null,
      intent:               null,
      source:               'text',
      source_snippet:       snippet,
      inferred:             true,
      inference_confidence: Math.round(inferred.confidence * 1000) / 1000,
    });
    attributedPrices.add(price); // prevent duplicate inference across multiple occurrences
  }

  return result;
}

// ── IMAGE PARSER ───────────────────────────────────────────────────────────────

/**
 * parseDubzImage(base64Image)
 * Extracts levels from a TradingView chart screenshot via LLM vision.
 * Returns: { instrument, current_price, levels, zones, parse_status } | { parse_status: 'failed', error }
 */
async function parseDubzImage(base64Image) {
  if (!base64Image || typeof base64Image !== 'string') return null;
  const raw64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');

  const client     = new Anthropic();
  const livePrice  = await getLivePrice().catch(() => null);

  // Build live price context from per-instrument data. Omit any instrument where data is null
  // so stale fallback values don't poison the prompt. Falls back to static ranges if no live data.
  let priceContext;
  const instr = livePrice?.instruments;
  if (instr) {
    const lines = [];
    if (instr.nq?.price)  lines.push(`- NQ (NQM2026): around ${instr.nq.price}`);
    if (instr.es?.price)  lines.push(`- ES (ESM2026): around ${instr.es.price}`);
    if (instr.qqq?.price) lines.push(`- QQQ: around ${instr.qqq.price.toFixed(2)}`);
    if (instr.spy?.price) lines.push(`- SPY: around $${instr.spy.price.toFixed(2)}`);
    if (lines.length > 0) {
      priceContext =
        `Current price reference (delayed: ${livePrice.delayed}):\n${lines.join('\n')}`;
    }
  }
  if (!priceContext) {
    priceContext =
      `APPROXIMATE PRICE RANGES (April 2026):
- NQ (NQM2026): 15,000 – 30,000
- ES (ESM2026): 4,000 – 8,000
- QQQ: 400 – 800
- SPY: 400 – 750`;
  }

  // Build live bounds for post-parse level filtering (same ±5% logic as text parser)
  const visionBounds = instr ? buildLiveBounds(instr) : null;

  const systemPrompt =
    `You are analyzing a TradingView chart screenshot posted by a day trader in Discord. The chart uses TradingView's dark theme.

CHART STRUCTURE:
- Instrument ticker label in the TOP-LEFT corner (e.g. "NQM2026", "ESM2026", "NQ1!", "ES1!", "QQQ", "SPY")
- Current price shown as a highlighted label/tag on the RIGHT price axis
- Horizontal lines drawn by the trader mark key price levels
- Each line has a price label on the RIGHT EDGE of the chart (right-side price axis area)

LINE COLOR INTERPRETATION:
- GREEN thin horizontal line = support level → parse the price label on the right edge
- GREEN wider shaded band / region = support zone → parse top and bottom prices
- RED thin horizontal line = resistance level → parse the price label on the right edge
- RED wider shaded band / region = resistance zone → parse top and bottom prices
- WHITE or GRAY lines = neutral reference — include only if they have a clear price label

EXTRACTION RULES:
1. Read the instrument from the top-left. Normalize strictly to: NQ, ES, QQQ, or SPY
   - "NQM2026", "NQ1!", "/NQ", "NQ1!" → NQ
   - "ESM2026", "ES1!", "/ES", "ES1!" → ES
   - "QQQ", "/QQQ" → QQQ
   - "SPY", "/SPY" → SPY
2. Read the current price label on the right axis (highlighted or larger text)
3. For EACH green or red horizontal line: read the price label on the right edge
4. For EACH green or red shaded band: read the top price and bottom price
5. Do NOT guess or interpolate — if a label is illegible, skip it entirely
6. All prices must fall within the ranges below

${priceContext}

Return ONLY valid JSON. No markdown fences. No explanation. Schema:
{
  "instrument": "NQ",
  "current_price": 26884.75,
  "levels": [
    { "price": 26884.75, "type": "support", "color": "green" },
    { "price": 27200.00, "type": "resistance", "color": "red" }
  ],
  "zones": [
    { "top": 26950.00, "bottom": 26900.00, "type": "support", "color": "green" }
  ]
}`;

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: detectMediaType(raw64), data: raw64 }
        }]
      }]
    });
  } catch (err) {
    console.error('[dubz-vision] API call failed:', err.message);
    return { parse_status: 'failed', error: `API call failed: ${err.message}` };
  }

  let parsed;
  try {
    const rawText = response.content[0].text.trim();
    console.log('[dubz-vision] raw response:', rawText.slice(0, 300));
    let jsonStr = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    if (!jsonStr.trimStart().startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('no JSON object in response');
      jsonStr = m[0];
    }
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const rawSnippet = response.content[0]?.text?.slice(0, 150) || '';
    console.error('[dubz-vision] JSON parse failed:', err.message, '| raw:', rawSnippet);
    return { parse_status: 'failed', error: `JSON parse failed: ${err.message} | raw: ${rawSnippet}` };
  }

  // Normalize instrument label (strip contract codes, leading /, trailing !)
  const instrRaw = (parsed.instrument || '')
    .toUpperCase()
    .replace(/M\d+$/, '')
    .replace(/[1!]+$/, '')
    .replace(/^\//, '');
  const instrument = INSTRUMENT_CANON[instrRaw] || instrRaw || 'UNKNOWN';

  const levels = Array.isArray(parsed.levels)
    ? parsed.levels.filter(l => typeof l.price === 'number' && isValidPrice(instrument, l.price, visionBounds))
    : [];
  const zones = Array.isArray(parsed.zones)
    ? parsed.zones.filter(z =>
        typeof z.top === 'number' && typeof z.bottom === 'number' &&
        isValidPrice(instrument, z.top, visionBounds) && isValidPrice(instrument, z.bottom, visionBounds)
      )
    : [];

  return {
    instrument,
    current_price: typeof parsed.current_price === 'number' ? parsed.current_price : null,
    levels,
    zones,
    parse_status: 'ok',
  };
}

// ── MERGE ──────────────────────────────────────────────────────────────────────

/**
 * mergeDubzInputs(textResult, imageResults, existingState, date, pasteRecord)
 * Merges a new text parse + array of image parse results into the existing daily state.
 * Same-day pastes accumulate; a new date starts fresh.
 */
function mergeDubzInputs(textResult, imageResults, existingState, date, pasteRecord) {
  const isSameDay = existingState?.date === date;
  const base = isSameDay ? existingState : {
    date,
    last_updated: null,
    source_pastes: [],
    instruments: { NQ: { levels: [] }, ES: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] } },
    conflicts: [],
    parse_errors: [],
  };

  /**
   * Schema precedence rule (defined Phase 1B.6.1):
   * - `carry_forward_failed` is the AUTHORITATIVE structured signal.
   *   Phase 2+ consumers MUST check this field first.
   * - `parse_errors` is INFORMATIONAL only — human-readable strings
   *   for the user-facing reply. Do not parse for control flow.
   * - When carry_forward_failed is set, parse_errors will also contain
   *   a redundant string. This is intentional for backward compatibility
   *   with the existing reply format.
   */
  // Carry-forward: no new levels; promote yesterday's instrument states
  if (textResult?.carry_forward) {
    const cfRecord = { ...pasteRecord, carry_forward: true };
    if (isSameDay) {
      // Today already has levels — record the paste but don't overwrite
      const st = JSON.parse(JSON.stringify(base));
      st.last_updated = new Date().toISOString();
      st.source_pastes.push(cfRecord);
      st.parse_errors.push('carry_forward: today already has levels — no import needed');
      st.conflicts = detectConflicts(st.instruments);
      for (const data of Object.values(st.instruments)) {
        for (const lvl of data.levels) {
          if (!Object.prototype.hasOwnProperty.call(lvl, 'crossSourceConfirmed'))
            lvl.crossSourceConfirmed = false;
        }
      }
      return st;
    }
    // Fresh day: carry levels from previous state (existingState is yesterday)
    const st = {
      date,
      last_updated: new Date().toISOString(),
      source_pastes: [cfRecord],
      instruments: { NQ: { levels: [] }, ES: { levels: [] }, QQQ: { levels: [] }, SPY: { levels: [] } },
      conflicts: [],
      parse_errors: [],
    };
    if (existingState?.instruments) {
      cfRecord.carried_from = existingState.date;
      for (const [instr, data] of Object.entries(existingState.instruments)) {
        for (const level of (data.levels || [])) {
          st.instruments[instr].levels.push({ ...level, source: 'carried_forward', crossSourceConfirmed: false });
        }
      }
    } else {
      st.parse_errors.push('carry_forward requested but no previous levels found');
      st.carry_forward_failed = { reason: 'no prior state to carry forward' };
    }
    st.conflicts = detectConflicts(st.instruments);
    return st;
  }

  const newState = JSON.parse(JSON.stringify(base)); // deep clone
  newState.last_updated = new Date().toISOString();
  newState.source_pastes.push(pasteRecord);

  // Merge text levels
  if (textResult) {
    for (const [instr, data] of Object.entries(textResult.instruments)) {
      if (!newState.instruments[instr]) newState.instruments[instr] = { levels: [] };
      for (const level of data.levels) {
        const dup = newState.instruments[instr].levels.some(
          l => Math.abs(l.price - level.price) < 0.01 && l.source === 'text'
        );
        if (!dup) newState.instruments[instr].levels.push(level);
      }
    }
    if (textResult.parse_errors?.length) newState.parse_errors.push(...textResult.parse_errors);
  }

  // Merge image levels
  for (const imgResult of (imageResults || [])) {
    if (!imgResult || imgResult.parse_status === 'failed') {
      if (imgResult?.error) newState.parse_errors.push(`image parse failed: ${imgResult.error}`);
      continue;
    }
    const { instrument: instr, levels: imgLevels, zones: imgZones } = imgResult;
    if (!instr || !newState.instruments[instr]) continue;

    for (const lvl of (imgLevels || [])) {
      const dup = newState.instruments[instr].levels.some(
        l => Math.abs(l.price - lvl.price) < 0.01 && l.source === 'image'
      );
      if (!dup) {
        newState.instruments[instr].levels.push({
          price:               lvl.price,
          significance:        'unclear',
          significance_signal: 'unstated',
          direction:           lvl.type === 'support' ? 'support'
                             : lvl.type === 'resistance' ? 'resistance' : null,
          intent:              null,
          source:              'image',
          source_snippet:      null,
        });
      }
    }

    for (const zone of (imgZones || [])) {
      for (const [price, edge] of [[zone.top, 'top'], [zone.bottom, 'bottom']]) {
        const dup = newState.instruments[instr].levels.some(
          l => Math.abs(l.price - price) < 0.01 && l.source === 'image'
        );
        if (!dup) {
          newState.instruments[instr].levels.push({
            price,
            significance:        'unclear',
            significance_signal: 'unstated',
            direction:           zone.type || null,
            intent:              null,
            source:              'image',
            source_snippet:      null,
            zone_edge:           edge,
          });
        }
      }
    }
  }

  // Cross-source dedup: collapse text+image pairs at the same canonical price.
  // Text source wins; image metadata fills only null/undefined text fields.
  // Every surviving level gets crossSourceConfirmed: true|false.
  const CROSS_TOL = 0.25;
  for (const data of Object.values(newState.instruments)) {
    const levels   = data.levels;
    const toRemove = new Set();

    for (let i = 0; i < levels.length; i++) {
      if (levels[i].source !== 'image') continue;
      const imgLvl = levels[i];
      let bestJ = -1, bestDiff = Infinity;
      for (let j = 0; j < levels.length; j++) {
        if (levels[j].source !== 'text') continue;
        const diff = Math.abs(levels[j].price - imgLvl.price);
        if (diff <= CROSS_TOL && diff < bestDiff) { bestDiff = diff; bestJ = j; }
      }
      if (bestJ !== -1) {
        const txtLvl = levels[bestJ];
        if (txtLvl.direction == null && imgLvl.direction != null) txtLvl.direction = imgLvl.direction;
        if (txtLvl.intent    == null && imgLvl.intent    != null) txtLvl.intent    = imgLvl.intent;
        txtLvl.crossSourceConfirmed = true;
        toRemove.add(i);
      }
    }

    data.levels = levels.filter((_, i) => !toRemove.has(i));
    for (const lvl of data.levels) {
      if (!Object.prototype.hasOwnProperty.call(lvl, 'crossSourceConfirmed'))
        lvl.crossSourceConfirmed = false;
    }
  }

  newState.conflicts = detectConflicts(newState.instruments);

  // G5: surface vision/text disagreements as parse_errors so they appear in the user-facing reply.
  // detectConflicts already records them structurally; this makes them human-readable in the reply.
  for (const c of newState.conflicts) {
    const diff = Math.abs(c.image_level - c.text_level).toFixed(2);
    newState.parse_errors.push(
      `vision/text disagreement on ${c.instrument}: text=${c.text_level} vs vision=${c.image_level} (diff=${diff} pts — review chart label)`
    );
  }

  return newState;
}

function detectConflicts(instruments) {
  const conflicts = [];
  for (const [instr, data] of Object.entries(instruments)) {
    const textLevels  = data.levels.filter(l => l.source === 'text');
    const imageLevels = data.levels.filter(l => l.source === 'image');
    if (!textLevels.length || !imageLevels.length) continue;

    const tol = CONFLICT_TOL[instr] || { min: 0.25, max: 10 };

    for (const tl of textLevels) {
      // Exact-ish match in image? No conflict.
      const exactMatch = imageLevels.some(il => Math.abs(il.price - tl.price) <= tol.min);
      if (exactMatch) continue;

      // Find nearest image level
      const nearest = imageLevels.reduce(
        (best, il) => (!best || Math.abs(il.price - tl.price) < Math.abs(best.price - tl.price)) ? il : best,
        null
      );
      if (!nearest) continue;

      const diff = Math.abs(nearest.price - tl.price);
      if (diff > tol.min && diff <= tol.max) {
        conflicts.push({
          instrument:   instr,
          text_level:   tl.price,
          image_level:  nearest.price,
          text_snippet: tl.source_snippet || null,
          note:         `Image and text differ by ${diff.toFixed(2)} points — review`,
        });
      }
    }
  }
  return conflicts;
}

// ── LEVEL MEMORY INTEGRATION ──────────────────────────────────────────────────

/**
 * appendDubzToMemory(newState)
 * Appends all levels from a merged Dubz state to Level Memory.
 * Per C4: each write is in its own try/catch. A Level Memory failure logs to
 * newState.parse_errors but NEVER blocks the Dubz state save — Dubz is authoritative.
 */
async function appendDubzToMemory(newState) {
  const timestamp = new Date().toISOString();
  for (const [instrument, data] of Object.entries(newState.instruments)) {
    for (const level of (data.levels || [])) {
      try {
        await recordLevel({
          analyst:              'dubz',
          instrument,
          price:                level.price,
          significance:         level.significance   || null,
          direction:            level.direction      || null,
          intent:               level.intent         || null,
          source_type:          level.source,
          source_snippet:       level.source_snippet || null,
          timestamp,
          crossSourceConfirmed: level.crossSourceConfirmed === true,
        });
      } catch (err) {
        newState.parse_errors.push(`level-memory write failed: ${err.message}`);
      }
    }
  }
}

// ── LOAD / SAVE ────────────────────────────────────────────────────────────────

function loadDubzState() {
  try {
    if (!fs.existsSync(DUBZ_FILE)) return null;
    return JSON.parse(fs.readFileSync(DUBZ_FILE, 'utf8'));
  } catch { return null; }
}

function saveDubzState(state) {
  writeJsonAtomic(DUBZ_FILE, state);
}

// ── STATUS DISPLAY ─────────────────────────────────────────────────────────────

function buildDubzStatus(state) {
  if (!state) {
    return [
      '⚠️ No Dubz levels loaded today.',
      'Paste the morning brief:  /dubz [text]',
      'Or paste a TradingView chart with /dubz attached.',
    ].join('\n');
  }

  const age   = Math.round((Date.now() - new Date(state.last_updated).getTime()) / 60000);
  const today = todayKeyET();
  if (state.date !== today) {
    return [
      `STALE Dubz levels saved for ${state.date || 'unknown date'} (updated ${age}m ago).`,
      `Today is ${today} ET. /ready will NOT count these levels.`,
      'Paste the current RichyDubz morning brief:  /dubz [text]',
    ].join('\n');
  }
  const SEP   = '━━━━━━━━━━━━━━━━━━━━';
  const lines = [`📊 Dubz Levels — ${state.date} (updated ${age}m ago):`, SEP];

  for (const [instr, data] of Object.entries(state.instruments)) {
    if (!data.levels.length) { lines.push(`${instr}: —`); continue; }
    const parts = data.levels.map(l => {
      const icon   = l.significance === 'key' ? '🔑' : l.significance === 'minor' ? '·' : '';
      const dir    = l.direction ? ` (${l.direction})` : '';
      const intent = l.intent    ? ` [${l.intent}]`   : '';
      const src    = l.source === 'image' ? ' 📷' : '';
      return `${l.price}${icon}${dir}${intent}${src}`;
    });
    lines.push(`${instr}: ${parts.join('  |  ')}`);
  }

  lines.push(SEP);

  if (state.conflicts.length > 0) {
    lines.push(`⚠️ ${state.conflicts.length} conflict(s):`);
    for (const c of state.conflicts) {
      lines.push(`  ${c.instrument}: text ${c.text_level} vs image ${c.image_level} — ${c.note}`);
    }
  } else {
    lines.push('No conflicts.');
  }

  lines.push(`${state.source_pastes.length} paste(s) today.`);
  return lines.join('\n');
}

module.exports = {
  parseDubzText,
  parseDubzImage,
  mergeDubzInputs,
  appendDubzToMemory,
  loadDubzState,
  saveDubzState,
  buildDubzStatus,
  inferInstrumentFromPrice,
};
