'use strict';

const { normalizeSymbol } = require('./instruments');
const { compactText, sha256 } = require('./io');
const { parseOptionContracts } = require('./options');
const { isSybilMessage } = require('./sybil');

const SYMBOL_RE = /(?:[$#]\s*)?\b(SPXW|SPX|SPY|QQQ|NDX|ES|ES_F|MES|NQ|NQ_F|MNQ|[A-Z]{2,5})\b/i;
const PRICE_RE = /(?<![\w])(\d{1,5}(?:\.\d{1,2})?)(?![\w])/g;
const HEATMAP_RE = /\b(heatmap|heat map|gex|gamma|king node|gatekeeper|node|air pocket)\b/i;
const GAINS_RE = /\b(gains?|nice win|win(?:ner)?|paid|runner paid|from earlier)\b|[+]\s*\d+(?:\.\d+)?\s*(?:pts?|points?|handles?|r|%)?/i;
const UPDATE_RE = /\b(tp\s*\d*|target\s*\d*|trim|trimmed|take\s*\d+%|runner|move\s+stops?|stops?\s+to\s+(?:be|entry)|b\/e|breakeven|stopped|stop hit|cut|closed|out|cancel(?:led)?|added|scaled)\b/i;
const TRADE_WORD_RE = /\b(long|short|buy(?:ing)?|bought|sell(?:ing)?|calls?|puts?|reclaim|breakout|breakdown|over|under|above|below|entry|entered|starter)\b/i;
const CORE_SYMBOLS = new Set(['SPXW', 'SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'ES_F', 'MES', 'NQ', 'NQ_F', 'MNQ', 'VIX', 'IWM', 'DIA']);
const STOP_SYMBOLS = new Set([
  'A', 'AFTER', 'ALL', 'ALSO', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'ATR', 'ATH', 'BE', 'BEEN', 'BEFORE',
  'BELOW', 'BOSS', 'BUT', 'BUY', 'BUYING', 'BY', 'CALL', 'CALLS', 'CAN', 'CATCH', 'CONS',
  'CHART', 'DAY', 'DID', 'DIDN', 'DO', 'DOESN', 'DON', 'DOWN', 'DRAW', 'DTE', 'EL', 'EMA',
  'ENTRY', 'EOD', 'EVEN', 'FEELS', 'FIG', 'FOR', 'GAIN', 'GAINS', 'GEX', 'GIVES',
  'GOT', 'GUESS', 'HASN', 'HAVE', 'HE', 'HERE', 'HOD', 'HOW', 'HTTPS', 'IF', 'IN',
  'IS', 'IT', 'ITS', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP',
  'OCT', 'NOV', 'DEC', 'JUST', 'LAST', 'LEAPS', 'LET', 'LMAO', 'LOD', 'LOL', 'LONG',
  'LOW', 'MAN', 'MAP', 'MARCH', 'MMS', 'MY', 'NEED', 'NEXT', 'NO', 'NOC', 'NOT', 'NOTED',
  'NOW', 'OF', 'OH', 'OKAY', 'ON', 'ONE', 'ONLY', 'OR', 'OTM', 'OVER', 'PICK', 'PM',
  'PROB', 'PUT', 'PUTS', 'RTH', 'ROLL', 'SAID', 'SC', 'SEE', 'SELL', 'SELLING', 'SMA',
  'SHORT', 'SLOW', 'SO', 'SOLD', 'SOME', 'SSD', 'STEP', 'STOP', 'STOPS', 'TARGET',
  'TA', 'THAT', 'THE', 'THESE', 'THEY', 'THIS', 'TODAY', 'TOUGH', 'TREND', 'TRIED', 'TRIM',
  'UNDER', 'VE', 'VWAP', 'WAS', 'WE', 'WEEK', 'WELL', 'WHAT', 'WHERE', 'WHICH',
  'WICK', 'WILL', 'WITH', 'WOULD', 'WRITE', 'YOU', 'YUP', 'IV', 'CPI',
]);

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function words(text) {
  return cleanText(text).split(/\s+/).filter(Boolean);
}

function extractSymbol(text) {
  const source = String(text || '');
  const cashtag = source.match(/[$#]\s*(SPXW|SPX|SPY|QQQ|NDX|ES|ES_F|MES|NQ|NQ_F|MNQ|[A-Za-z]{1,5})\b/);
  if (cashtag) {
    const candidate = normalizeSymbol(cashtag[1]);
    return candidate && !STOP_SYMBOLS.has(candidate) ? candidate : null;
  }

  const coreRe = /\b(SPXW|SPX|SPY|QQQ|NDX|ES|ES_F|MES|NQ|NQ_F|MNQ|VIX|IWM|DIA)\b/ig;
  let core;
  while ((core = coreRe.exec(source)) !== null) {
    const candidate = normalizeSymbol(core[1]);
    if (candidate) return candidate;
  }

  const uppercaseRe = /\b([A-Z]{2,5})\b/g;
  let match;
  while ((match = uppercaseRe.exec(source)) !== null) {
    const candidate = normalizeSymbol(match[1]);
    if (candidate && !STOP_SYMBOLS.has(candidate)) return candidate;
  }
  return null;
}

function extractDirection(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(short|puts?|below|under|breakdown|reject(?:ion|ed)?|fade)\b/.test(lower)) return 'short';
  if (/\b(long|buy(?:ing)?|bought|calls?|above|over|reclaim|breakout|starter)\b/.test(lower)) return 'long';
  return 'unknown';
}

function extractPrices(text) {
  const out = [];
  for (const match of String(text || '').matchAll(PRICE_RE)) {
    const n = Number(match[1]);
    if (!Number.isFinite(n)) continue;
    if (n >= 2020 && n <= 2035) continue;
    out.push({ value: n, index: match.index || 0 });
  }
  return out;
}

function hasParsedNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function entryForOptionContract(optionContract, text) {
  if (!optionContract) return null;
  if (hasParsedNumber(optionContract.entry_premium)) {
    return {
      entry_type: 'limit',
      entry_price: Number(optionContract.entry_premium),
      entry_zone_low: null,
      entry_zone_high: null,
    };
  }
  if (/\b(here|now|mkt|market|buy(?:ing)?|bought|entered|entry|filled?)\b/i.test(text)) {
    return { entry_type: 'market', entry_price: null, entry_zone_low: null, entry_zone_high: null };
  }
  return { entry_type: 'unknown', entry_price: null, entry_zone_low: null, entry_zone_high: null };
}

function numbersNear(labelRe, text) {
  const results = [];
  const source = String(text || '');
  const re = new RegExp(labelRe.source + '[^\\d.]{0,20}(\\d{1,5}(?:\\.\\d{1,2})?|\\.\\d{1,2})', labelRe.flags.includes('i') ? 'ig' : 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) results.push(n);
  }
  return results;
}

function extractEntry(text, direction) {
  const source = String(text || '');
  const zone = source.match(/\b(?:zone|between|from)\s*(\d{1,5}(?:\.\d{1,2})?)\s*(?:-|to|and)\s*(\d{1,5}(?:\.\d{1,2})?)/i) ||
    source.match(/(\d{1,5}(?:\.\d{1,2})?)\s*-\s*(\d{1,5}(?:\.\d{1,2})?)\s*(?:zone|area)?/i);
  if (zone) {
    const a = Number(zone[1]);
    const b = Number(zone[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        entry_type: 'zone',
        entry_price: null,
        entry_zone_low: Math.min(a, b),
        entry_zone_high: Math.max(a, b),
      };
    }
  }

  const trigger = source.match(/\b(?:over|above|breakout|reclaim|through|under|below|breakdown|lose|lost)\s+(\d{1,5}(?:\.\d{1,2})?)/i);
  if (trigger) {
    const n = Number(trigger[1]);
    const word = trigger[0].toLowerCase();
    return {
      entry_type: /under|below|breakdown|lose|lost/.test(word) ? 'breakdown' : 'breakout',
      entry_price: Number.isFinite(n) ? n : null,
      entry_zone_low: null,
      entry_zone_high: null,
    };
  }

  if (/\b(here|now|mkt|market)\b/i.test(source)) {
    return { entry_type: 'market', entry_price: null, entry_zone_low: null, entry_zone_high: null };
  }

  const prices = extractPrices(source);
  if (prices.length) {
    return {
      entry_type: /\blimit\b/i.test(source) ? 'limit' : (direction === 'unknown' ? 'unknown' : 'market'),
      entry_price: prices[0].value,
      entry_zone_low: null,
      entry_zone_high: null,
    };
  }
  return { entry_type: 'unknown', entry_price: null, entry_zone_low: null, entry_zone_high: null };
}

function extractStopsTargets(text) {
  const stopCandidates = [
    ...numbersNear(/\b(?:stop|stops|sl|risk|invalid(?:ation)?|below|above)\b/i, text),
  ];
  const targetCandidates = [
    ...numbersNear(/\b(?:tp\s*\d*|target\s*\d*|pt\s*\d*|take\s*profit)\b/i, text),
  ];
  const takeProfitMore = [];
  const allTargets = [...new Set(targetCandidates)].slice(0, 4);
  for (let i = 3; i < allTargets.length; i += 1) takeProfitMore.push(allTargets[i]);
  return {
    stop_price: stopCandidates.length ? stopCandidates[0] : null,
    take_profit_1: allTargets[0] || null,
    take_profit_2: allTargets[1] || null,
    take_profit_3: allTargets[2] || null,
    take_profit_more: takeProfitMore,
  };
}

function extractPartialPlan(text) {
  const pct = String(text || '').match(/\b(?:take|trim|scale)\s*(\d{1,3})%/i);
  if (pct) return 'take ' + pct[1] + '%';
  if (/\btrim\b/i.test(text)) return 'trim stated';
  if (/\brunner\b/i.test(text)) return 'runner stated';
  return null;
}

function setupTags(text) {
  const lower = String(text || '').toLowerCase();
  const tags = [];
  for (const tag of ['heatmap', 'reclaim', 'breakout', 'breakdown', 'vwap', 'gap', 'support', 'resistance', 'calls', 'puts', 'runner']) {
    if (lower.includes(tag)) tags.push(tag);
  }
  if (/\bking node|gatekeeper|gamma|gex\b/i.test(text)) tags.push('heatmap_confluence');
  return [...new Set(tags)];
}

function confidenceForTrade(parsed) {
  let score = 0.15;
  if (parsed.symbol) score += 0.2;
  if (parsed.direction !== 'unknown') score += 0.2;
  if (parsed.entry_price !== null || parsed.entry_type === 'market' || parsed.entry_type === 'zone') score += 0.2;
  if (parsed.stop_price !== null) score += 0.1;
  if (parsed.take_profit_1 !== null) score += 0.1;
  if (parsed.setup_tags.length) score += 0.05;
  return Math.min(0.95, Math.round(score * 100) / 100);
}

function parseTradeCall(message) {
  if (isSybilMessage(message)) return null;
  const text = cleanText(message.raw_text);
  if (!text || !TRADE_WORD_RE.test(text)) return null;
  const symbol = extractSymbol(text);
  const direction = extractDirection(text);
  const entry = extractEntry(text, direction);
  const optionContracts = parseOptionContracts(text, symbol, message.timestamp_utc);
  if (GAINS_RE.test(text) && !optionContracts.length) return null;
  if (!symbol && entry.entry_price === null && entry.entry_zone_low === null && !extractPrices(text).length && optionContracts.length === 0) return null;
  const stopsTargets = extractStopsTargets(text);
  const primaryOption = optionContracts[0] || null;
  const normalizedSymbol = primaryOption?.underlying || normalizeSymbol(symbol);
  const optionDirection = primaryOption
    ? (primaryOption.option_side === 'PUT' ? 'short' : 'long')
    : direction;
  const optionEntry = entryForOptionContract(primaryOption, text);
  const parsed = {
    trade_id: 'trade_' + message.message_id,
    source_message_id: message.message_id,
    analyst_id: message.author_id || message.author_name || 'unknown',
    analyst_name: message.author_name || null,
    timestamp_utc: message.timestamp_utc,
    symbol: symbol || primaryOption?.underlying || null,
    normalized_symbol: normalizedSymbol,
    asset_class: symbol ? null : 'unknown',
    direction: optionDirection,
    entry_type: optionEntry ? optionEntry.entry_type : entry.entry_type,
    entry_price: optionEntry ? optionEntry.entry_price : entry.entry_price,
    entry_zone_low: optionEntry ? optionEntry.entry_zone_low : entry.entry_zone_low,
    entry_zone_high: optionEntry ? optionEntry.entry_zone_high : entry.entry_zone_high,
    stop_price: stopsTargets.stop_price,
    take_profit_1: stopsTargets.take_profit_1,
    take_profit_2: stopsTargets.take_profit_2,
    take_profit_3: stopsTargets.take_profit_3,
    take_profit_more: stopsTargets.take_profit_more,
    partial_exit_plan: extractPartialPlan(text),
    size_contracts: extractContracts(text),
    risk_amount: null,
    setup_text: compactText(text, 500),
    setup_tags: setupTags(text),
    option_contracts: optionContracts,
    option_contract: primaryOption,
    option_ticker: primaryOption?.option_ticker || null,
    invalidation_condition: /\binvalid/i.test(text) ? compactText(text, 160) : null,
    breakeven_instruction: /\b(b\/e|breakeven|break even|stops?\s+to\s+entry)\b/i.test(text) ? 'move stop to breakeven' : null,
    parser_confidence: 0,
    parse_status: 'valid',
    parse_notes: [],
  };
  parsed.asset_class = primaryOption ? 'option' : assetClassForSymbol(parsed.normalized_symbol);
  parsed.parser_confidence = confidenceForTrade(parsed);
  if (!parsed.symbol || parsed.direction === 'unknown') {
    parsed.parse_status = 'ambiguous';
    parsed.parse_notes.push('missing_symbol_or_direction');
  } else if (parsed.entry_type === 'unknown') {
    parsed.parse_status = 'partial';
    parsed.parse_notes.push('entry_not_explicit');
  } else if (parsed.stop_price === null) {
    parsed.parse_status = 'partial';
    parsed.parse_notes.push('stop_missing_so_r_multiple_unavailable');
  }
  return parsed;
}

function extractContracts(text) {
  const match = String(text || '').match(/\b(\d+)\s*(?:contracts?|cons?|ct)\b/i);
  return match ? Number(match[1]) : null;
}

function assetClassForSymbol(symbol) {
  if (!symbol) return 'unknown';
  if (['ES', 'MES', 'NQ', 'MNQ'].includes(symbol)) return 'future';
  if (['SPX', 'NDX', 'VIX'].includes(symbol)) return 'index_or_option_underlying';
  return 'equity_or_option_underlying';
}

function parseTradeUpdate(message) {
  if (isSybilMessage(message)) return null;
  const text = cleanText(message.raw_text);
  if (!text || !UPDATE_RE.test(text)) return null;
  const lower = text.toLowerCase();
  let updateType = 'unknown';
  if (/\bentered|in\b/.test(lower)) updateType = 'entered';
  if (/\badded|add\b/.test(lower)) updateType = 'added';
  if (/\bscaled\b/.test(lower)) updateType = 'scaled';
  if (/\btp\s*1|target\s*1|t1\b/.test(lower)) updateType = 'target_hit';
  if (/\btp\s*2|target\s*2|t2\b/.test(lower)) updateType = 'target_hit';
  if (/\btrim|take\s*\d+%|partial\b/.test(lower)) updateType = 'partial';
  if (/\bstopped|stop hit|stopped out\b/.test(lower)) updateType = 'stop_hit';
  if (/\bmove\s+stops?|stops?\s+to\b/.test(lower)) updateType = 'moved_stop';
  if (/\bb\/e\b|\bbe\b|breakeven|break even|stops?\s+to\s+(?:entry|be)\b/.test(lower)) updateType = 'moved_to_breakeven';
  if (/\bclosed|out|cut\b/.test(lower)) updateType = 'closed';
  if (/\bcancel/.test(lower)) updateType = 'cancelled';
  const prices = extractPrices(text);
  const targetNumber = text.match(/\b(?:tp|target|t)\s*(\d)\b/i);
  const qty = text.match(/\b(\d{1,3})%\b/);
  const points = text.match(/[+]?(-?\d+(?:\.\d+)?)\s*(?:pts?|points?|handles?)\b/i);
  const percent = text.match(/[+]?(-?\d+(?:\.\d+)?)\s*%/);
  const dollars = text.match(/[$]\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)/);
  const rClaimed = text.match(/[+]?(-?\d+(?:\.\d+)?)\s*r\b/i);
  const symbol = extractSymbol(text);
  const optionContracts = parseOptionContracts(text, symbol, message.timestamp_utc);
  const primaryOption = optionContracts[0] || null;
  const optionPrice = hasParsedNumber(primaryOption?.exit_premium)
    ? Number(primaryOption.exit_premium)
    : (hasParsedNumber(primaryOption?.entry_premium) ? Number(primaryOption.entry_premium) : null);
  return {
    update_id: 'update_' + message.message_id,
    trade_id: null,
    source_message_id: message.message_id,
    analyst_id: message.author_id || message.author_name || 'unknown',
    analyst_name: message.author_name || null,
    timestamp_utc: message.timestamp_utc,
    update_type: updateType,
    symbol: symbol || primaryOption?.underlying || null,
    price: optionPrice !== null ? optionPrice : (prices.length ? prices[0].value : null),
    option_contracts: optionContracts,
    option_contract: primaryOption,
    option_ticker: primaryOption?.option_ticker || null,
    target_number: targetNumber ? Number(targetNumber[1]) : null,
    quantity_fraction: qty ? Number(qty[1]) / 100 : null,
    points_claimed: points ? Number(points[1]) : null,
    percent_claimed: percent ? Number(percent[1]) : null,
    dollars_claimed: dollars ? Number(dollars[1].replace(/,/g, '')) : null,
    r_claimed: rClaimed ? Number(rClaimed[1]) : null,
    parser_confidence: updateType === 'unknown' ? 0.45 : 0.75,
    parse_notes: [],
  };
}

function parseGainsPost(message) {
  if (isSybilMessage(message)) return null;
  const text = cleanText(message.raw_text);
  if (!text || !GAINS_RE.test(text)) return null;
  const points = text.match(/[+]\s*(\d+(?:\.\d+)?)\s*(?:pts?|points?|handles?)\b/i);
  const percent = text.match(/[+]\s*(\d+(?:\.\d+)?)\s*%/);
  const dollars = text.match(/[$]\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)/);
  const rClaimed = text.match(/[+]\s*(\d+(?:\.\d+)?)\s*r\b/i);
  const symbol = extractSymbol(text);
  const optionContracts = parseOptionContracts(text, symbol, message.timestamp_utc);
  const primaryOption = optionContracts[0] || null;
  return {
    gains_id: 'gains_' + message.message_id,
    source_message_id: message.message_id,
    analyst_id: message.author_id || message.author_name || 'unknown',
    analyst_name: message.author_name || null,
    timestamp_utc: message.timestamp_utc,
    symbol: symbol || primaryOption?.underlying || null,
    direction: primaryOption ? (primaryOption.option_side === 'PUT' ? 'short' : 'long') : extractDirection(text),
    option_contracts: optionContracts,
    option_contract: primaryOption,
    option_ticker: primaryOption?.option_ticker || null,
    claimed_points: points ? Number(points[1]) : null,
    claimed_percent: percent ? Number(percent[1]) : null,
    claimed_dollars: dollars ? Number(dollars[1].replace(/,/g, '')) : null,
    claimed_r: rClaimed ? Number(rClaimed[1]) : null,
    screenshot_or_attachment: (message.attachments || []).length > 0,
    linked_trade_id: null,
    verification_status: 'gains_only_unverified',
    notes: compactText(text, 220),
  };
}

function parseHeatmapRecord(message) {
  if (isSybilMessage(message)) return null;
  const text = cleanText(message.raw_text);
  const hasAttachment = (message.attachments || []).length > 0;
  const channelHeatmap = /heatmap/i.test(message.channel_name || '');
  if (!hasAttachment && !HEATMAP_RE.test(text) && !channelHeatmap) return null;
  if (!HEATMAP_RE.test(text) && !channelHeatmap) return null;
  const levels = extractPrices(text).map(row => row.value).filter(n => n >= 100);
  return {
    heatmap_id: 'heatmap_' + message.message_id,
    source_message_id: message.message_id,
    analyst_id: message.author_id || message.author_name || 'unknown',
    analyst_name: message.author_name || null,
    timestamp_utc: message.timestamp_utc,
    symbol: extractSymbol(text) || (channelHeatmap ? 'SPX' : null),
    raw_text_caption: compactText(text, 500),
    attachments: message.attachments || [],
    image_path_or_reference: (message.attachments || [])[0]?.url || null,
    extracted_text: null,
    extracted_levels: levels,
    directional_bias: /\bbull|support|call\b/i.test(text) ? 'bullish' : (/\bbear|resistance|put\b/i.test(text) ? 'bearish' : 'unknown'),
    confluence_tags: setupTags(text),
    linked_trade_ids: [],
    link_confidence: 0,
    parse_confidence: hasAttachment ? 0.7 : 0.45,
    notes: hasAttachment ? 'metadata cataloged; OCR not assumed' : 'caption-only heatmap metadata',
  };
}

function buildAnalysts(messages) {
  const byId = new Map();
  for (const message of messages) {
    const id = message.author_id || message.author_name || 'unknown';
    const existing = byId.get(id) || {
      analyst_id: id,
      discord_user_id: message.author_id || null,
      display_name: message.author_name || id,
      known_aliases: new Set(),
      role_category: 'analyst_or_commentary_source',
      source_channels: new Set(),
      first_seen: message.timestamp_utc,
      last_seen: message.timestamp_utc,
      active_status: 'observed',
    };
    if (message.author_name) existing.known_aliases.add(message.author_name);
    if (message.channel_name) existing.source_channels.add(message.channel_name);
    if (message.timestamp_utc && (!existing.first_seen || message.timestamp_utc < existing.first_seen)) existing.first_seen = message.timestamp_utc;
    if (message.timestamp_utc && (!existing.last_seen || message.timestamp_utc > existing.last_seen)) existing.last_seen = message.timestamp_utc;
    byId.set(id, existing);
  }
  return [...byId.values()].map(row => ({
    ...row,
    known_aliases: [...row.known_aliases],
    source_channels: [...row.source_channels],
  }));
}

function parseStage2Messages(messages) {
  const trade_calls = [];
  const trade_updates = [];
  const gains_posts = [];
  const heatmaps = [];
  const rejected = [];
  for (const message of messages) {
    if (isSybilMessage(message)) {
      rejected.push({
        source_message_id: message.message_id,
        timestamp_utc: message.timestamp_utc,
        analyst_id: message.author_id || message.author_name || 'unknown',
        reason: 'sybil_context_only_not_trade_source',
        content_hash: message.content_hash || sha256(message.raw_text || ''),
      });
      continue;
    }
    const heatmap = parseHeatmapRecord(message);
    if (heatmap) heatmaps.push(heatmap);
    const gains = parseGainsPost(message);
    if (gains) gains_posts.push(gains);
    const trade = parseTradeCall(message);
    if (trade) trade_calls.push(trade);
    const update = (!trade && !gains) ? parseTradeUpdate(message) : null;
    if (update) trade_updates.push(update);
    if (!heatmap && !update && !gains && !trade) {
      rejected.push({
        source_message_id: message.message_id,
        timestamp_utc: message.timestamp_utc,
        analyst_id: message.author_id || message.author_name || 'unknown',
        reason: TRADE_WORD_RE.test(message.raw_text || '') ? 'trade_like_but_incomplete' : 'not_stage2_relevant',
        content_hash: message.content_hash || sha256(message.raw_text || ''),
      });
    }
  }
  return {
    analysts: buildAnalysts(messages),
    trade_calls,
    trade_updates,
    gains_posts,
    heatmaps,
    rejected,
    summary: {
      messages_processed: messages.length,
      trade_calls: trade_calls.length,
      valid_trade_calls: trade_calls.filter(row => row.parse_status === 'valid').length,
      partial_trade_calls: trade_calls.filter(row => row.parse_status === 'partial').length,
      ambiguous_trade_calls: trade_calls.filter(row => row.parse_status === 'ambiguous').length,
      trade_updates: trade_updates.length,
      gains_posts: gains_posts.length,
      heatmaps: heatmaps.length,
      rejected: rejected.length,
    },
  };
}

module.exports = {
  extractDirection,
  extractEntry,
  extractPrices,
  extractSymbol,
  parseGainsPost,
  parseHeatmapRecord,
  parseStage2Messages,
  parseTradeCall,
  parseTradeUpdate,
  setupTags,
};
