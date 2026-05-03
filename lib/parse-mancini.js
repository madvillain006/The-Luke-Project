'use strict';

const { recordLevel } = require('./level-memory');

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const INTENT_PRIORITY = {
  failed_breakdown: 100,
  failed_breakout:  100,
  long_trigger:      90,
  short_trigger:     90,
  stop:              85,
  first_target:      80,
  second_target:     70,
  bonus_target:      60,
  chop_boundary:     50,
  null:              10,
};

const MANCINI_KEYWORDS_RE = /\b(trigger|target|reclaim|fail|fails|chop|failed breakdown|failed breakout|range res|range support|support|resistance|sell|backtest)\b/i;
const PRICE_RE = /\b(\d{4,5}(?:\.\d+)?)\b/g;

// Embedded timestamp format: "04/22/2026 07:56AM - "
const EMBEDDED_TS_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?:AM|PM)\s+-\s+/gi;

// ── DST helpers ─────────────────────────────────────────────────────────────
// Spring forward: 2026-03-08. Fall back: 2026-11-01.
const SPRING_FORWARD = new Date(2026, 2, 8);
const FALL_BACK      = new Date(2026, 10, 1);

function etOffset(dateStr) {
  if (!dateStr) return '-04:00';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return (d >= SPRING_FORWARD && d < FALL_BACK) ? '-04:00' : '-05:00';
}

// time: "HH:MM" 24h string, defaults to "12:00" (noon ET)
function dateToTweetTimestamp(dateStr, time = '12:00') {
  if (!dateStr) return null;
  return `${dateStr}T${time}:00${etOffset(dateStr)}`;
}

// ── Time-of-day inference ────────────────────────────────────────────────────
// Mancini uses phrases and comment hints that imply the time slot. Order matters.
function inferTimeOfDay(text) {
  if (/closing update|newsletter out soon|~?4\s*pm\b/i.test(text)) return '16:00';
  if (/\b8am\b|\b8:00\s*am\b|\b07:[45]\d\s*am\b|\bpre-market\b/i.test(text)) return '08:00';
  if (/mid-morning|10am|\b10:0\d\s*am\b/i.test(text)) return '10:00';
  if (/mid-session|11am/i.test(text)) return '11:00';
  if (/\blunch\b|midday|mid-day|\bnoon\b|12pm/i.test(text)) return '12:00';
  if (/\bafternoon\b|2pm/i.test(text)) return '14:00';
  if (/\bmorning\b|pre-trigger|early morning/i.test(text)) return '09:00';
  // Explicit "9:10AM" type extractions for mid-session updates
  const explicit = text.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if (explicit) {
    let h = Number(explicit[1]);
    const m = Number(explicit[2]);
    if (explicit[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (explicit[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return '12:00'; // default noon
}

// ── Embedded timestamp parsing ───────────────────────────────────────────────
function parseEmbeddedTimestamp(str) {
  // str like "04/22/2026 07:56AM - "
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)/i);
  if (!m) return null;
  const [, month, day, year, rawH, rawM, ampm] = m;
  let h = Number(rawH);
  const mins = Number(rawM);
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  const dateStr = `${year}-${month}-${day}`;
  const time    = `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return { dateStr, time, iso: dateToTweetTimestamp(dateStr, time) };
}

function currentTradingYear() {
  return new Date().getFullYear();
}

function shorthandToFull(basePrice, suffix) {
  const prefix = Math.floor(basePrice / 100) * 100;
  let value = prefix + Number(suffix);
  if (value > basePrice) value -= 100;
  return value;
}

function rangeEndToFull(startPrice, endSuffix) {
  const endNum = Number(endSuffix);
  if (String(endSuffix).length >= String(Math.trunc(startPrice)).length) return endNum;
  let prefix = Math.floor(startPrice / (10 ** String(endSuffix).length)) * (10 ** String(endSuffix).length);
  let candidate = prefix + endNum;
  if (candidate < startPrice) candidate += 10 ** String(endSuffix).length;
  return candidate;
}

function normalizeInstrument(rawText) {
  const text = String(rawText || '');
  if (/\b(#ES_F|\$ES\b|\bES_F\b|\bES\b)\b/i.test(text)) return 'ES';
  if (/\$SPX\b|\bSPX\b/i.test(text)) return 'SPX';
  return 'ES';
}

function extractDate(rawText) {
  const text = String(rawText || '');
  const isoHeader = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoHeader) return `${isoHeader[1]}-${isoHeader[2]}-${isoHeader[3]}`;
  // Embedded US-format timestamp: "04/22/2026 ..."
  const usTs = text.match(/(\d{2})\/(\d{2})\/(20\d{2})\s+\d{1,2}:\d{2}(?:AM|PM)/i);
  if (usTs) return `${usTs[3]}-${usTs[1]}-${usTs[2]}`;
  const match = text.match(/(?:@AdamMancini4\s*[·\-]\s*|^)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i)
    || text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?/i);
  if (!match) return new Date().toISOString().slice(0, 10);

  const month = MONTH_MAP[match[1].slice(0, 3).toLowerCase()];
  const day   = Number(match[2]);
  const year  = currentTradingYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getSnippet(text, start, end, radius = 60) {
  const from = Math.max(0, start - radius);
  const to   = Math.min(text.length, end + radius);
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

function validatePrice(instrument, price, parse_errors, source_snippet) {
  if (price < 3000 || price > 20000) {
    parse_errors.push(`discarded out-of-range ${instrument} price ${price} from "${source_snippet}"`);
    return false;
  }
  return true;
}

function pushOrUpgrade(levelMap, level) {
  const key = String(level.price);
  const existing = levelMap.get(key);
  if (!existing) {
    levelMap.set(key, level);
    return;
  }

  const existingPriority = INTENT_PRIORITY[existing.intent || 'null'] || 0;
  const nextPriority     = INTENT_PRIORITY[level.intent    || 'null'] || 0;
  if (nextPriority > existingPriority) {
    levelMap.set(key, { ...existing, ...level });
    return;
  }
  if (nextPriority === existingPriority) {
    levelMap.set(key, {
      ...existing,
      significance:   existing.significance === 'key' || level.significance !== 'key' ? existing.significance : level.significance,
      direction:      existing.direction || level.direction,
      trigger_type:   existing.trigger_type || level.trigger_type,
      trap_warning:   existing.trap_warning || level.trap_warning,
      source_snippet: existing.source_snippet || level.source_snippet,
    });
  }
}

function buildLevel(price, source_snippet, fields = {}) {
  return {
    price,
    significance:         fields.significance        ?? 'unclear',
    direction:            Object.prototype.hasOwnProperty.call(fields, 'direction')     ? fields.direction     : null,
    intent:               Object.prototype.hasOwnProperty.call(fields, 'intent')        ? fields.intent        : null,
    trigger_type:         Object.prototype.hasOwnProperty.call(fields, 'trigger_type')  ? fields.trigger_type  : null,
    hit_status:           null,
    trap_warning:         false,
    source:               'text',
    source_snippet,
    crossSourceConfirmed: false,
  };
}

function extractPrices(text) {
  const prices = [];

  const rangeRe = /\b(\d{4,5})-(\d{2})(?!\d)\b/g;
  let rm;
  while ((rm = rangeRe.exec(text)) !== null) {
    prices.push(Number(rm[1]), rangeEndToFull(Number(rm[1]), rm[2]));
  }

  const slashRe = /\b(\d{4,5})\/(\d{2})(?!\d)\b/g;
  let sm;
  while ((sm = slashRe.exec(text)) !== null) {
    const first  = Number(sm[1]);
    const second = shorthandToFull(first, sm[2]);
    prices.push(first, second);
  }

  let pm;
  while ((pm = PRICE_RE.exec(text)) !== null) {
    prices.push(Number(pm[1]));
  }

  return [...new Set(prices)];
}

function inferTargetDirection(context) {
  return /\b(short|sell|fails?|failed breakout|breakdown)\b/i.test(context) ? 'support' : 'resistance';
}

function addClauseTargets(levelMap, parse_errors, instrument, text, clauseText, source_snippet, kind) {
  const prices = extractPrices(clauseText).filter(price => validatePrice(instrument, price, parse_errors, source_snippet));
  prices.forEach((price, idx) => {
    const intent = kind === 'bonus'
      ? 'bonus_target'
      : idx === 0 ? 'first_target' : 'second_target';
    pushOrUpgrade(levelMap, buildLevel(price, source_snippet, {
      significance: kind === 'bonus' ? 'unclear' : 'key',
      direction:    inferTargetDirection(text),
      intent,
    }));
  });
}

// ── Chop zone / flag zone parser ─────────────────────────────────────────────
// Width rule: spread ≤ 10 pts → two level entries (tight S/R band, not an exclusion).
//             spread > 10 pts → proper chop_zone entry (do not trade inside).
// This is non-obvious because "=chop" and "=flag" both appear with tight bands
// in Mancini's writing. Only the wide ranges are true exclusion zones.
function parseChopZones(text, instrument, levelMap, chopZones, parse_errors) {
  // Matches: RANGE=<chop or flag marker>  (explicit = marker)
  const chopEqRe = /(\d{4,5})(?:\/(\d{2}))?\s*(?:to|-)\s*(\d{4,5})(?:-(\d{2}))?\s*=\s*(?:[a-z/ ]*(?:chop|flag)[a-z/ ]*)/gi;
  // Matches: RANGE remains/is/was a <chop or flag> (descriptive, no =)
  const chopDescRe = /(\d{4,5})(?:\/(\d{2}))?\s*(?:to|-)\s*(\d{4,5})(?:-(\d{2}))?\s+(?:is|remains?|was)\s+(?:[a-z ]*(?:chop|flag)[a-z ]*)/gi;

  function processChopMatch(match, g1, g2, g3, g4) {
    let low = Number(g1);
    if (g2) low = shorthandToFull(low, g2);
    let high = Number(g3);
    if (g4) high = rangeEndToFull(high, g4);
    const spread = Math.abs(high - low);
    const snippet = getSnippet(text, match.index, match.index + match[0].length, 40);

    if (!validatePrice(instrument, low, parse_errors, snippet) ||
        !validatePrice(instrument, high, parse_errors, snippet)) return;

    const lo = Math.min(low, high);
    const hi = Math.max(low, high);

    if (spread <= 10) {
      // Tight chop/flag band → two individual level entries (both boundaries are S/R levels)
      pushOrUpgrade(levelMap, buildLevel(lo, snippet, { significance: 'unclear', direction: null, intent: null }));
      pushOrUpgrade(levelMap, buildLevel(hi, snippet, { significance: 'unclear', direction: null, intent: null }));
      // Also record as narrow chop zone so /entries can surface the tight range
      chopZones.push({ lo, hi, low: lo, high: hi, source_snippet: snippet });
    } else {
      // Wide range → exclusion chop zone
      chopZones.push({ low: lo, high: hi, source_snippet: snippet });
      pushOrUpgrade(levelMap, buildLevel(lo, snippet, { significance: 'unclear', direction: null, intent: 'chop_boundary' }));
      pushOrUpgrade(levelMap, buildLevel(hi, snippet, { significance: 'unclear', direction: null, intent: 'chop_boundary' }));
    }
  }

  let match;
  while ((match = chopEqRe.exec(text)) !== null) {
    processChopMatch(match, match[1], match[2], match[3], match[4]);
  }
  while ((match = chopDescRe.exec(text)) !== null) {
    processChopMatch(match, match[1], match[2], match[3], match[4]);
  }
}

// Tight S/R ranges without explicit chop/flag marker: "7147-53 was support", "6848-52=support"
// These are NOT chop zones — they're support/resistance bands with two observable price points.
function parseTightRangeContexts(text, instrument, levelMap, parse_errors) {
  const tightRe = /\b(\d{4,5})-(\d{2})(?!\d)\b[^.\n]{0,40}\b(support|holds?|floor|resistance|ceiling)\b/gi;
  let match;
  while ((match = tightRe.exec(text)) !== null) {
    const lo  = Number(match[1]);
    const hi  = rangeEndToFull(lo, match[2]);
    const dir = /resistance|ceiling/.test(match[3].toLowerCase()) ? 'resistance' : 'support';
    const snippet = getSnippet(text, match.index, match.index + match[0].length, 40);
    if (Math.abs(hi - lo) > 10) continue; // Wide ranges handled by parseChopZones
    if (validatePrice(instrument, lo, parse_errors, snippet)) {
      pushOrUpgrade(levelMap, buildLevel(lo, snippet, { significance: 'unclear', direction: dir, intent: null }));
    }
    if (validatePrice(instrument, hi, parse_errors, snippet)) {
      pushOrUpgrade(levelMap, buildLevel(hi, snippet, { significance: 'unclear', direction: dir, intent: null }));
    }
  }
}

// ── No-trade signal detection ─────────────────────────────────────────────────
function detectNoTradeSignal(text) {
  return /elevator down/i.test(text) ||
    /no trading for me/i.test(text) ||
    /\b0 to do\b/i.test(text) ||
    /just nothing to do now/i.test(text);
}

// ── Runner-active extraction ──────────────────────────────────────────────────
function extractRunnerActive(text) {
  const patterns = [
    /\+(\d+)\s*points?\s*from\s+[^0-9]*(\d{4,5})\s+(?:reclaim|Failed Breakdown)/i,
    /\+(\d+)\s*from\s+[^0-9]*(\d{4,5})\s+(?:reclaim|Failed Breakdown)/i,
    /now\s+\+(\d+)\s*points?\s+from[^0-9]*(\d{4,5})/i,
    // "+N from Sunday's 6793" / "+N from Tuesday's 6592"
    /\+(\d+)\s*points?\s+from\s+(?:\w+day(?:'s)?|last\s+\w+(?:'s)?)\s+(\d{4,5})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return { trigger_price: Number(m[2]), points_paid: Number(m[1]) };
  }
  return null;
}

// ── Weekly pattern detection ──────────────────────────────────────────────────
function detectWeeklyPattern(text) {
  if (/sunday gap down/i.test(text) || /weekly sunday long/i.test(text)) return 'sunday_gap_long';
  return null;
}

// ── Hit-status + near-miss + pending post-processing ─────────────────────────
function applyHitStatus(levels, text) {
  const hitRe      = /(\d{4,5}(?:\.\d+)?)\s*\(hit(?: exact)?\)/gi;
  const nearMissRe = /(\d{4,5}(?:\.\d+)?)\s*\((?:almost|2\s*points?\s*shy)\)/gi;
  const pendingRe  = /(\d{4,5}(?:\.\d+)?)\s*\((?:here(?: now)?|stuck here)\)/gi;

  const hitPrices      = new Set();
  const nearMissPrices = new Set();
  const pendingPrices  = new Set();

  let m;
  while ((m = hitRe.exec(text))      !== null) hitPrices.add(Number(m[1]));
  while ((m = nearMissRe.exec(text)) !== null) nearMissPrices.add(Number(m[1]));
  while ((m = pendingRe.exec(text))  !== null) pendingPrices.add(Number(m[1]));

  return levels.map(level => ({
    ...level,
    hit_status: hitPrices.has(level.price)      ? 'hit'
              : nearMissPrices.has(level.price) ? 'near_miss'
              : pendingPrices.has(level.price)  ? 'pending'
              : 'pending',
  }));
}

// ── Trap-warning post-processing ──────────────────────────────────────────────
function applyTrapWarning(levels, text) {
  return levels.map(level => {
    const p  = String(Math.round(level.price));
    const re = new RegExp(`(?:${p}.{0,20}watch traps|watch traps.{0,20}${p})`, 'i');
    return { ...level, trap_warning: re.test(text) };
  });
}

// ── Core single-tweet parse ───────────────────────────────────────────────────
function parseManciniText(rawText, livePrices = null) {
  void livePrices;
  const text         = String(rawText || '').replace(/\r\n/g, '\n');
  const analysisText = text
    .replace(/^#+\s+[^\n]*\n/m, '')   // strip markdown headers (## or ###)
    .replace(/^>\s?/gm, '')           // strip blockquote markers
    .replace(/^Source:.*$/gm, '')
    .replace(/^Tickers:.*$/gm, '')
    .replace(/^Note:.*$/gm, '')
    .replace(/^Levels:.*$/gm, '')
    .trim();

  const instrument   = normalizeInstrument(text);
  const date         = extractDate(text);
  const time         = inferTimeOfDay(text);
  const parse_errors = [];
  const levelMap     = new Map();
  const chop_zones   = [];
  const pattern_entries = [];

  const rawNumbers = [...analysisText.matchAll(PRICE_RE)].map(m => Number(m[1]));
  const priceCount = rawNumbers.filter(n => n > 3000).length;

  // Narrative-only: no prices and no trading keywords → skip level extraction
  if (priceCount === 0 && !MANCINI_KEYWORDS_RE.test(analysisText)) {
    return {
      instrument,
      date,
      tweet_timestamp: dateToTweetTimestamp(date, time),
      levels:          [],
      chop_zones:      [],
      no_trade_signal: detectNoTradeSignal(text),
      runner_active:   extractRunnerActive(text),
      pattern_entries: [],
      weekly_pattern:  detectWeeklyPattern(text),
      narrative_only:  true,
      // Both messages kept: 'no Mancini-format content detected' for backward compat,
      // 'narrative-only post' for the new narrative detection flag.
      parse_errors:    ['narrative-only post — no levels detected', 'no Mancini-format content detected'],
    };
  }
  if (MANCINI_KEYWORDS_RE.test(analysisText)) {
    rawNumbers
      .filter(n => n > 0 && n < 3000)
      .forEach(n => parse_errors.push(`discarded out-of-range ${instrument} price ${n} from "${analysisText.slice(0, 80).replace(/\s+/g, ' ').trim()}"`));
  }

  parseChopZones(analysisText, instrument, levelMap, chop_zones, parse_errors);
  parseTightRangeContexts(analysisText, instrument, levelMap, parse_errors);

  // "Failed Breakdown of NNNN" / "Failed Breakout of NNNN"
  const failedOfRe = /\b(Failed Breakdown|Failed Breakout)\s+of\s+(\d{4,5}(?:\.\d+)?)/gi;
  let failedOf;
  while ((failedOf = failedOfRe.exec(analysisText)) !== null) {
    const label   = failedOf[1].toLowerCase();
    const price   = Number(failedOf[2]);
    const snippet = getSnippet(analysisText, failedOf.index, failedOf.index + failedOf[0].length, 40);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    const pattern = label === 'failed breakdown' ? 'failed_breakdown' : 'failed_breakout';
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: pattern,
      trigger_type: label === 'failed breakdown' ? 'breakdown' : 'breakout',
    }));
    pattern_entries.push({ price, pattern, source_snippet: snippet });
  }

  // "NNNN Failed Breakdown long" / "NNNN Failed Breakout"
  const failedPatternRe = /(\d{4,5}(?:\.\d+)?)\s+(Failed Breakdown|Failed Breakout)\s*(long|short)?/gi;
  let failed;
  while ((failed = failedPatternRe.exec(analysisText)) !== null) {
    const price   = Number(failed[1]);
    const label   = failed[2].toLowerCase();
    const snippet = getSnippet(analysisText, failed.index, failed.index + failed[0].length, 40);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    const pattern = label === 'failed breakdown' ? 'failed_breakdown' : 'failed_breakout';
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: pattern,
      trigger_type: label === 'failed breakdown' ? 'breakdown' : 'breakout',
    }));
    if (!pattern_entries.some(pe => pe.price === price)) {
      pattern_entries.push({ price, pattern, source_snippet: snippet });
    }
  }

  // "<price> reclaims? see <targets>" — long trigger with inline targets
  const reclaimTriggerRe = /(\d{4,5}(?:\.\d+)?)\s+reclaims?\b(?:[^.\n]{0,40}\bsee\b([^.\n]+))?/gi;
  let reclaim;
  while ((reclaim = reclaimTriggerRe.exec(analysisText)) !== null) {
    const price   = Number(reclaim[1]);
    const snippet = getSnippet(analysisText, reclaim.index, reclaim.index + reclaim[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: 'long_trigger', trigger_type: 'reclaim',
    }));
    if (reclaim[2]) addClauseTargets(levelMap, parse_errors, instrument, analysisText, reclaim[2], snippet, 'core');
  }

  // "long trigger ... NNN" or "NNN ... long trigger"
  const explicitLongAfterRe = /(?:long trigger|long entry)[^.\n]{0,50}(\d{4,5}(?:\.\d+)?)/gi;
  let explicitLong;
  while ((explicitLong = explicitLongAfterRe.exec(analysisText)) !== null) {
    const price   = Number(explicitLong[1]);
    const snippet = getSnippet(analysisText, explicitLong.index, explicitLong.index + explicitLong[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: 'long_trigger',
      trigger_type: /\breclaim\b/i.test(snippet) ? 'reclaim' : null,
    }));
  }

  const explicitPriceLongRe = /(\d{4,5}(?:\.\d+)?)[^.\n]{0,40}(?:long trigger|long entry)/gi;
  let explicitPriceLong;
  while ((explicitPriceLong = explicitPriceLongRe.exec(analysisText)) !== null) {
    const price   = Number(explicitPriceLong[1]);
    const snippet = getSnippet(analysisText, explicitPriceLong.index, explicitPriceLong.index + explicitPriceLong[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: 'long_trigger',
      trigger_type: /\breclaim\b/i.test(snippet) ? 'reclaim' : null,
    }));
  }

  // "short trigger ... NNN"
  const explicitShortRe = /(?:short trigger|short entry)[^.\n]{0,50}(\d{4,5}(?:\.\d+)?)/gi;
  let explicitShort;
  while ((explicitShort = explicitShortRe.exec(analysisText)) !== null) {
    const price   = Number(explicitShort[1]);
    const snippet = getSnippet(analysisText, explicitShort.index, explicitShort.index + explicitShort[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: 'short_trigger',
      trigger_type: /\bfails?\b/i.test(snippet) ? 'fail' : null,
    }));
  }

  // "sell NNN"
  const sellRe = /\bsell\s+(\d{4,5}(?:\.\d+)?)/gi;
  let sell;
  while ((sell = sellRe.exec(analysisText)) !== null) {
    const price   = Number(sell[1]);
    const snippet = getSnippet(analysisText, sell.index, sell.index + sell[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: 'flip', intent: 'short_trigger',
      trigger_type: /\bfails?\b/i.test(snippet) ? 'fail' : null,
    }));
  }

  // "NNN fails" — stop / failure level
  const stopRe = /(\d{4,5})(?:\/(\d{2}))?\s+fails?\b/gi;
  let stop;
  while ((stop = stopRe.exec(analysisText)) !== null) {
    let price = Number(stop[1]);
    if (stop[2]) price = shorthandToFull(price, stop[2]);
    const snippet = getSnippet(analysisText, stop.index, stop.index + stop[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: null, intent: 'stop', trigger_type: 'fail',
    }));
  }

  // 1st / first target — also "target was NNN" (singular, no ordinal) from Reddit bare-prose comments
  const firstTargetRe = /(?:1st target(?:\s+was)?|targets?\s+(?:was|were))\s*~?(\d{4,5}(?:\.\d+)?)|(\d{4,5}(?:\.\d+)?)\s*1st\b/gi;
  let firstTarget;
  while ((firstTarget = firstTargetRe.exec(analysisText)) !== null) {
    const price   = Number(firstTarget[1] || firstTarget[2]);
    const snippet = getSnippet(analysisText, firstTarget.index, firstTarget.index + firstTarget[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: inferTargetDirection(snippet), intent: 'first_target',
    }));
  }

  // 2nd / second / core / main target
  const secondTargetRe = /(?:2nd target(?:\s+was)?|core target(?:s)?(?:\s+was|\s+were)?|main target(?:\s+was)?)\s*~?(\d{4,5}(?:\.\d+)?)|(\d{4,5}(?:\.\d+)?)\s*2nd\b/gi;
  let secondTarget;
  while ((secondTarget = secondTargetRe.exec(analysisText)) !== null) {
    const price   = Number(secondTarget[1] || secondTarget[2]);
    const snippet = getSnippet(analysisText, secondTarget.index, secondTarget.index + secondTarget[0].length, 50);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, {
      significance: 'key', direction: inferTargetDirection(snippet), intent: 'second_target',
    }));
  }

  // Bonus / stretch targets
  const bonusRe = /\bbonus(?:\/breakout)?\s+(?:target(?:s)?|slate|set)\b([^\n.]*)/gi;
  let bonus;
  while ((bonus = bonusRe.exec(analysisText)) !== null) {
    const snippet = getSnippet(analysisText, bonus.index, bonus.index + bonus[0].length, 50);
    addClauseTargets(levelMap, parse_errors, instrument, analysisText, bonus[1], snippet, 'bonus');
  }

  // Core targets clause
  const coreTargetsRe = /\bcore targets?\b[^.\n:]*[:=]?\s*([^\n.]+)/gi;
  let core;
  while ((core = coreTargetsRe.exec(analysisText)) !== null) {
    const snippet = getSnippet(analysisText, core.index, core.index + core[0].length, 50);
    addClauseTargets(levelMap, parse_errors, instrument, analysisText, core[1], snippet, 'core');
  }

  // "see NNN, NNN" after a trigger / reclaim context
  const seeClauseRe = /\bsee\s+([^\n.]+)/gi;
  let seeClause;
  while ((seeClause = seeClauseRe.exec(analysisText)) !== null) {
    const snippet = getSnippet(analysisText, seeClause.index, seeClause.index + seeClause[0].length, 40);
    if (!/\breclaims?\b|\bfails?\b|\blong trigger\b|\bshort trigger\b/i.test(snippet)) continue;
    const prices = extractPrices(seeClause[1]).filter(price => validatePrice(instrument, price, parse_errors, snippet));
    prices.forEach((price, idx) => {
      pushOrUpgrade(levelMap, buildLevel(price, snippet, {
        significance: idx < 2 ? 'key' : 'unclear',
        direction:    inferTargetDirection(snippet),
        intent:       idx === 0 ? 'first_target' : idx === 1 ? 'second_target' : 'bonus_target',
      }));
    });
  }

  // Range resistance / resistance
  const rangeResRe = /(\d{4,5}(?:\.\d+)?)[^.\n]{0,25}\b(?:range res|resistance)\b/gi;
  let rangeRes;
  while ((rangeRes = rangeResRe.exec(analysisText)) !== null) {
    const price   = Number(rangeRes[1]);
    const snippet = getSnippet(analysisText, rangeRes.index, rangeRes.index + rangeRes[0].length, 40);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, { significance: 'unclear', direction: 'resistance', intent: null }));
  }

  // Range support / support
  const rangeSupportRe = /(\d{4,5}(?:\.\d+)?)[^.\n]{0,25}\b(?:range support|support)\b/gi;
  let rangeSupport;
  while ((rangeSupport = rangeSupportRe.exec(analysisText)) !== null) {
    const price   = Number(rangeSupport[1]);
    const snippet = getSnippet(analysisText, rangeSupport.index, rangeSupport.index + rangeSupport[0].length, 40);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, { significance: 'unclear', direction: 'support', intent: null }));
  }

  // "NNN backtest" — price that was used as a backtest long trigger (support)
  const backtestRe = /(\d{4,5}(?:\.\d+)?)\s+backtest\b/gi;
  let bt;
  while ((bt = backtestRe.exec(analysisText)) !== null) {
    const price   = Number(bt[1]);
    const snippet = getSnippet(analysisText, bt.index, bt.index + bt[0].length, 40);
    if (!validatePrice(instrument, price, parse_errors, snippet)) continue;
    pushOrUpgrade(levelMap, buildLevel(price, snippet, { significance: 'key', direction: 'support', intent: null }));
  }

  if (levelMap.size === 0 && chop_zones.length === 0) {
    parse_errors.push('no Mancini-format content detected');
  }

  const no_trade_signal = detectNoTradeSignal(text);
  const runner_active   = extractRunnerActive(text);
  const weekly_pattern  = detectWeeklyPattern(text);

  let levels = [...levelMap.values()].sort((a, b) => a.price - b.price);
  if (runner_active) {
    const before = levels.length;
    levels = levels.filter(level => level.price !== runner_active.trigger_price);
    if (levels.length !== before) {
      parse_errors.push(`runner reference ${runner_active.trigger_price} recorded as context only, not a fresh entry level`);
    }
  }
  levels = applyHitStatus(levels, text);
  levels = applyTrapWarning(levels, text);

  return {
    instrument,
    date,
    tweet_timestamp: dateToTweetTimestamp(date, time),
    levels,
    chop_zones,
    no_trade_signal,
    runner_active,
    pattern_entries,
    weekly_pattern:  weekly_pattern || null,
    narrative_only:  false,
    parse_errors,
  };
}

// ── Sub-result merger (used by multi-tweet split) ─────────────────────────────
function mergeSubResults(results) {
  if (!results.length) return results[0];
  const priceMap    = new Map();
  const chop_zones  = [];
  const pattern_entries = [];
  const parse_errors = [];
  let no_trade_signal = false;
  let runner_active   = null;
  let tweet_timestamp = null;
  let weekly_pattern  = null;
  let narrative_only  = true; // true only if ALL sub-tweets are narrative

  for (const r of results) {
    if (!r.narrative_only) narrative_only = false;
    if (r.no_trade_signal) no_trade_signal = true;
    if (!runner_active && r.runner_active) runner_active = r.runner_active;
    if (!weekly_pattern && r.weekly_pattern) weekly_pattern = r.weekly_pattern;
    // Keep EARLIEST tweet_timestamp
    if (!tweet_timestamp || (r.tweet_timestamp && r.tweet_timestamp < tweet_timestamp)) {
      tweet_timestamp = r.tweet_timestamp;
    }
    for (const z of r.chop_zones) {
      if (!chop_zones.some(c => c.low === z.low && c.high === z.high)) chop_zones.push(z);
    }
    for (const pe of r.pattern_entries) {
      if (!pattern_entries.some(p => p.price === pe.price)) pattern_entries.push(pe);
    }
    parse_errors.push(...r.parse_errors.filter(e => e !== 'narrative-only post — no levels detected'));

    for (const level of r.levels) {
      const key = String(level.price);
      const existing = priceMap.get(key);
      if (!existing) {
        priceMap.set(key, { ...level, tweet_count: 1 });
      } else {
        existing.tweet_count = (existing.tweet_count || 1) + 1;
        const ep = INTENT_PRIORITY[existing.intent || 'null'] || 0;
        const np = INTENT_PRIORITY[level.intent     || 'null'] || 0;
        if (np > ep) {
          priceMap.set(key, { ...level, tweet_count: existing.tweet_count });
        } else if (np === ep && level.hit_status === 'hit') {
          priceMap.get(key).hit_status = 'hit';
        }
        if (level.trap_warning) priceMap.get(key).trap_warning = true;
      }
    }
  }

  return {
    instrument:     results[0].instrument,
    date:           results[0].date,
    tweet_timestamp,
    levels:         [...priceMap.values()].sort((a, b) => a.price - b.price),
    chop_zones,
    no_trade_signal,
    runner_active,
    pattern_entries,
    weekly_pattern:  weekly_pattern || null,
    narrative_only,
    parse_errors:   [...new Set(parse_errors)],
  };
}

// ── parseManciniTweet: primary export ────────────────────────────────────────
// Handles Twitter format, bare Reddit prose, and multi-tweet Reddit comments
// (those containing 2+ embedded "MM/DD/YYYY HH:MMAM - " timestamp prefixes).
function parseManciniTweet(rawText, contextOpts = {}) {
  const text = String(rawText || '');
  const embeddedMatches = [...text.matchAll(/\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?:AM|PM)\s+-\s+/gi)];

  if (embeddedMatches.length >= 2) {
    // Multi-tweet Reddit comment: split at each embedded timestamp prefix
    const splitRe = /(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?:AM|PM)\s+-\s+)/gi;
    const parts = text.split(splitRe).filter(p => p.trim());

    const subResults = parts.map(part => {
      const tsMatch = part.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)\s+-\s+/i);
      const subResult = parseManciniText(part);
      if (tsMatch) {
        const ts = parseEmbeddedTimestamp(tsMatch[0]);
        if (ts) subResult.tweet_timestamp = ts.iso;
      }
      return subResult;
    });

    const merged = mergeSubResults(subResults);
    merged.sub_tweets = subResults;
    if (contextOpts.instrument) merged.instrument = contextOpts.instrument;
    return merged;
  }

  const result = parseManciniText(text);
  if (contextOpts.tweetTimestamp) result.tweet_timestamp = contextOpts.tweetTimestamp;
  if (contextOpts.instrument)     result.instrument      = contextOpts.instrument;
  return result;
}

// ── parseManciniBatch ─────────────────────────────────────────────────────────
// Processes multi-tweet / multi-date files in two formats:
//   1. Twitter inbox format:  ## [YYYY-MM-DD — ...] sections
//   2. Reddit archive format: ## YYYY-MM-DD (Day) → ### Comment N sub-sections
function parseManciniBatch(rawText) {
  const text = String(rawText || '');
  const tweets       = [];
  const parse_errors = [];

  // Detect Reddit-archive structure: contains "### Comment N" headers
  const hasRedditComments = /^### Comment \d+/m.test(text);

  if (hasRedditComments) {
    // Reddit format: split on ## YYYY-MM-DD date headers first, then ### Comment N
    const dateSections = text.split(/(?=^## \d{4}-\d{2}-\d{2})/m).filter(s => s.trim());

    for (const dateSection of dateSections) {
      const dateMatch = dateSection.match(/^## (\d{4}-\d{2}-\d{2})/);
      const sectionDate = dateMatch ? dateMatch[1] : null;

      // Extract time-of-day hint from the section bracket, e.g. "[Friday session — chop day]"
      const sectionHint = dateSection.match(/^\[([^\]]+)\]/m)?.[1] || '';

      // Split into individual comments
      const commentBlocks = dateSection.split(/(?=^### Comment \d+)/m).filter(c => c.trim());

      for (const block of commentBlocks) {
        if (/^## /.test(block.trim())) continue; // date header itself
        // Extract comment-level hint, e.g. "(early morning, pre-CPI)"
        const commentHint = block.match(/^### Comment \d+[^)]*\(([^)]+)\)/)?.[1] || '';
        const hintText    = `${sectionHint} ${commentHint}`.trim();
        // Infer time from hint + block body
        const inferredTime = inferTimeOfDay(`${hintText}\n${block}`);
        const tweetTimestamp = sectionDate ? dateToTweetTimestamp(sectionDate, inferredTime) : null;

        try {
          const parsed = parseManciniTweet(block, {
            tweetTimestamp,
            instrument: 'ES', // Reddit archive is all ES
          });
          // Always use the section date — comment bodies rarely contain a parseable date
          if (sectionDate) parsed.date = sectionDate;
          if (!parsed.narrative_only && (parsed.levels.length > 0 || parsed.chop_zones.length > 0 || parsed.no_trade_signal)) {
            tweets.push(parsed);
          }
          parsed.parse_errors
            .filter(e => !e.includes('narrative-only post') && !e.includes('no Mancini-format content'))
            .forEach(e => parse_errors.push(`[${sectionDate || 'unknown'}] ${e}`));
        } catch (err) {
          parse_errors.push(`[${sectionDate || 'unknown'}] section parse error: ${err.message}`);
        }
      }
    }
  } else {
    // Twitter inbox format: split on ## [YYYY-MM-DD...] or @AdamMancini4 · boundaries
    const sectionBoundary = /(?=^## \[|^@AdamMancini4\s*[·\-])/m;
    const sections = text.split(sectionBoundary).filter(s => s.trim());

    for (const section of sections) {
      if (!section.trim()) continue;
      try {
        const parsed = parseManciniText(section);
        if (!parsed.narrative_only && (parsed.levels.length > 0 || parsed.chop_zones.length > 0 || parsed.no_trade_signal)) {
          tweets.push(parsed);
        }
        parsed.parse_errors
          .filter(e => !e.includes('narrative-only post') && !e.includes('no Mancini-format content'))
          .forEach(e => parse_errors.push(`[${parsed.date}] ${e}`));
      } catch (err) {
        parse_errors.push(`section parse error: ${err.message}`);
      }
    }
  }

  // Cross-tweet dedup: one canonical entry per (date, price), most-specific intent
  const priceMap = new Map();
  for (const tweet of tweets) {
    for (const level of tweet.levels) {
      const key      = `${tweet.date}:${level.price}`;
      const existing = priceMap.get(key);
      if (!existing) {
        priceMap.set(key, { ...level, tweet_count: 1, tweet_timestamp: tweet.tweet_timestamp });
      } else {
        existing.tweet_count = (existing.tweet_count || 1) + 1;
        const ep = INTENT_PRIORITY[existing.intent || 'null'] || 0;
        const np = INTENT_PRIORITY[level.intent     || 'null'] || 0;
        if (np > ep) {
          priceMap.set(key, { ...level, tweet_count: existing.tweet_count, tweet_timestamp: existing.tweet_timestamp });
        } else {
          // Keep earliest timestamp
          if (tweet.tweet_timestamp && (!existing.tweet_timestamp || tweet.tweet_timestamp < existing.tweet_timestamp)) {
            existing.tweet_timestamp = tweet.tweet_timestamp;
          }
          // hit=hit wins
          if (level.hit_status === 'hit') existing.hit_status = 'hit';
          // trap_warning propagates
          if (level.trap_warning) existing.trap_warning = true;
          // Append source snippets for audit trail
          if (level.source_snippet && !existing.source_snippet.includes(level.source_snippet)) {
            existing.source_snippet = `${existing.source_snippet}\n${level.source_snippet}`;
          }
        }
      }
    }
  }

  const deduped_levels = [...priceMap.values()].sort((a, b) => a.price - b.price);

  return { tweets, deduped_levels, parse_errors };
}

// ── Memory writer ─────────────────────────────────────────────────────────────
async function appendManciniToMemory(parsed) {
  if (!parsed || !Array.isArray(parsed.levels)) return;
  if (parsed.narrative_only) return; // nothing to write for pure narrative posts

  // Build set of prices that are chop zone boundaries (wide exclusion zones)
  const chopPrices = new Set(
    (parsed.chop_zones || [])
      .filter(z => (z.high - z.low) > 10) // only wide zones are exclusions
      .flatMap(z => [z.low, z.high])
  );

  const timestamp = parsed.tweet_timestamp || new Date().toISOString();

  for (const level of parsed.levels) {
    if (level.intent === 'chop_boundary') continue;
    if (chopPrices.has(level.price)) continue;

    await recordLevel({
      analyst:              'mancini',
      instrument:           parsed.instrument,
      price:                level.price,
      significance:         level.significance,
      direction:            level.direction,
      intent:               level.intent,
      source_type:          'text',
      source_snippet:       level.source_snippet,
      crossSourceConfirmed: false,
      timestamp,
    });
  }
}

module.exports = {
  parseManciniText,
  parseManciniTweet,
  parseManciniBatch,
  appendManciniToMemory,
  _internal: {
    extractDate,
    normalizeInstrument,
    shorthandToFull,
    extractPrices,
    detectNoTradeSignal,
    extractRunnerActive,
    dateToTweetTimestamp,
    inferTimeOfDay,
    parseEmbeddedTimestamp,
    mergeSubResults,
  },
};
