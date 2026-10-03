'use strict';

// Stage 2 remains the diagnostic parser. This guard deliberately accepts less:
// its inferred symbols, generic numbers, and wall-clock expiry defaults are not
// authoritative normalized instructions.
const { extractSymbol, parseTradeCall, parseTradeUpdate } = require('../kat-stage2/parser');

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };
const EXPIRY = '(?:\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/-]\\d{1,2}(?:[/-](?:\\d{4}|\\d{2}))?|\\d+DTE|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\\s+\\d{1,2}(?:,?\\s+(?:\\d{4}|\\d{2}))?)';
const NUMBER = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const NUMBER_END = '(?![\\d.A-Za-z/%-])(?!\\s*[%/])';
const MANAGEMENT_WORDS = new Set(('tp target t hit tagged reached done has is trim trimmed trimming take taking partial partially exit exited exiting close closed closing stc scale scaled scaling out sold sell selling half quarter some all stopped stop stops triggered move moving moved raise raised raising lower lowered lowering set setting adjust to the at for price premium be entry breakeven break even b/e cancel cancelled canceled add added adding in off here now today contracts contract cons and then i m am we re this that position trade order setup').split(' '));
const CONTROL_WORDS = new Set(['BTO', 'STC', 'SL', 'DTE', ...[...MANAGEMENT_WORDS].map(word => word.toUpperCase())]);
const OPEN_RE = /\b(?:buy(?:ing)?|bought|bto|entry|entered|starter|long)\b/i;

function validDate(year, month, day) {
  if (!Number.isInteger(year) || year < 2000 || year > 2199 || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function publishedDateET(timestamp) {
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return null;
  const dateParts = timestamp.slice(0, 10).split('-').map(Number);
  if (!validDate(...dateParts)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = type => Number(parts.find(part => part.type === type)?.value);
  return validDate(get('year'), get('month'), get('day'));
}

function resolveExpiry(token, publishedDate) {
  if (!token) return { date: null, provenance: null };
  const dte = token.match(/^(\d+)DTE$/i);
  if (dte) {
    if (Number(dte[1]) !== 0) return { error: 'nonzero_dte_requires_explicit_expiry' };
    if (!publishedDate) return { error: 'expiry_requires_published_timestamp' };
    return { date: publishedDate, provenance: 'explicit_0dte_published_timestamp_et' };
  }
  const iso = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = token.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?$/);
  const named = token.match(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\s+(\d{1,2})(?:,?\s+(\d{4}|\d{2}))?$/i);
  let year, month, day, inferredYear = false;
  if (iso) [year, month, day] = iso.slice(1).map(Number);
  else if (slash || named) {
    const match = slash || named;
    month = slash ? Number(match[1]) : MONTHS[match[1].toUpperCase()];
    day = Number(match[2]);
    if (match[3]) year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    else {
      if (!publishedDate) return { error: 'expiry_requires_published_timestamp' };
      year = Number(publishedDate.slice(0, 4));
      inferredYear = true;
    }
  } else return { error: 'invalid_expiration_date' };
  const date = validDate(year, month, day);
  return date ? { date, provenance: inferredYear ? 'explicit_month_day_year_from_published_timestamp_et' : 'explicit_calendar_date' } : { error: 'invalid_expiration_date' };
}

function explicitSymbol(token) {
  if (!token) return null;
  const symbol = token.replace(/^[$#]/, '').toUpperCase();
  if (CONTROL_WORDS.has(symbol) && !/^[$#]/.test(token)) return null;
  if (extractSymbol(symbol) !== symbol && !/^[$#]/.test(token)) return null;
  return symbol === 'SPXW' ? 'SPX' : symbol;
}

function identities(text, publishedDate) {
  const re = new RegExp('(?<![\\w./])(?:([$#]?[A-Za-z]{1,5})\\s+)?(?:(' + EXPIRY + ')\\s+)?(' + NUMBER + ')\\s*(c(?:alls?)?|p(?:uts?)?)\\b(?:\\s+(' + EXPIRY + '))?', 'ig');
  const hints = [], provenance = [];
  for (const match of text.matchAll(re)) {
    const before = resolveExpiry(match[2], publishedDate);
    const after = resolveExpiry(match[5], publishedDate);
    if (before.error || after.error) return { error: before.error || after.error };
    if (before.date && after.date && before.date !== after.date) return { error: 'conflicting_expiration_dates' };
    const strike = Number(match[3]);
    if (!Number.isFinite(strike) || strike <= 0) return { error: 'invalid_strike' };
    const hint = { underlying: explicitSymbol(match[1]), expiration_date: before.date || after.date, strike, option_side: /^p/i.test(match[4]) ? 'PUT' : 'CALL' };
    const key = JSON.stringify(hint);
    if (!hints.some(existing => JSON.stringify(existing) === key)) hints.push(hint);
    provenance.push({ expiry_token: match[2] || match[5] || null, resolution: before.provenance || after.provenance });
  }
  if (/\b(?:spread|straddle|strangle|condor|butterfly|calendar|diagonal|roll(?:ing)?)\b/i.test(text) || /\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*[cp]\b/i.test(text)) return { error: 'multi_leg_or_roll_requires_review' };
  if (hints.length > 1) return { error: 'multiple_or_conflicting_contracts' };
  const hint = hints[0] || null;
  const symbols = new Set([...text.matchAll(/(?<![\w])[$#]?[A-Z]{1,5}\b/g)].map(match => explicitSymbol(match[0])).filter(Boolean));
  if (hint?.underlying) symbols.add(hint.underlying);
  if (symbols.size > 1) return { error: 'conflicting_underlying_mentions' };
  const symbol = hint?.underlying || [...symbols][0] || null;
  if (hint && !hint.underlying && symbol) hint.underlying = symbol;
  if (hint && ((hint.option_side === 'CALL' && /\bputs?\b/i.test(text)) || (hint.option_side === 'PUT' && /\bcalls?\b/i.test(text)))) return { error: 'conflicting_option_side_mentions' };
  // A dated management selector can omit strike/side, but the expiry still
  // constrains ledger linking. Do not discard it and link by ticker alone.
  if (!hint && symbol) {
    const dated = text.match(new RegExp('[$#]?\\b' + symbol + '\\s+(' + EXPIRY + ')(?![\\d/-])', 'i'));
    if (dated) {
      const expiry = resolveExpiry(dated[1], publishedDate);
      if (expiry.error) return { error: expiry.error };
      provenance.push({ expiry_token: dated[1], resolution: expiry.provenance });
      return { hint: { underlying: symbol, expiration_date: expiry.date }, symbol, provenance };
    }
  }
  return { hint, symbol, provenance };
}

function matches(text, re, action) {
  return [...text.matchAll(re)].map(match => ({ action, index: match.index, end: match.index + match[0].length, match }));
}

function managementActions(text) {
  const actions = [
    ...matches(text, /\b(?:tp|target|t)\s*([123])\b\s*(?:(?:has|is)\s+)?(?:hit|tagged|reached|done)\b/ig, 'TARGET_HIT'),
    ...matches(text, /\b(?:hit|tagged|reached)\s+(?:tp|target|t)\s*([123])\b/ig, 'TARGET_HIT'),
    ...matches(text, /\b(?:trim(?:med|ming)?|(?:take|taking)\s+(?:\d+(?:\.\d+)?\s*%|half|partial)|partial(?:ly)?(?:\s+(?:exit|close))?|(?:scale(?:d)?|scaling)\s+out|(?:sold|sell(?:ing)?|close(?:d)?)\s+(?:\d+(?:\.\d+)?\s*%|half|some|partial))(?=\s|[.!,:;]|$)/ig, 'TRIM'),
    ...matches(text, /\b(?:stopped(?:\s+out)?|stops?\s+(?:hit|triggered))\b/ig, 'STOP_HIT'),
    ...matches(text, /\b(?:(?:move|moving|moved|raise|raised|raising|lower|lowered|lowering|set|setting|adjust)\s+(?:the\s+)?stops?|stops?\s+to)\b/ig, 'MOVE_STOP'),
    ...matches(text, /\b(?:breakeven|break\s+even|b\/e)\b|\b(?:stops?\s+to|move\s+stops?\s+to)\s+(?:be|entry)\b|^\s*BE\s*[.!]?\s*$/ig, 'BREAKEVEN'),
    ...matches(text, /\b(?:(?:close(?:d)?|closing)(?:\s+(?:all|position|trade))?|stc|all\s+out|out\s+of\s+(?:the\s+)?(?:trade|position)|exit(?:ed|ing)?(?:\s+(?:all|position|trade))?|cut|trim(?:med)?\s+all|sell\s+(?:all|to\s+close)|sold\s+all|flat)\b|^\s*out(?=\s+(?:at|@|\$|\d)|[.!]|$)|\b(?:i'?m|we'?re)\s+out\b/ig, 'CLOSE'),
    ...matches(text, /\bcancel(?:led|ed)?\b/ig, 'CANCEL'),
    ...matches(text, /\b(?:add(?:ed|ing)?|(?:scale(?:d)?|scaling)\s+in)\b/ig, 'ADD'),
  ];
  // A stop moved to BE is one instruction; "stopped out" is one exit.
  const hasBE = actions.some(item => item.action === 'BREAKEVEN');
  const fullTrim = item => /^(?:trim|trimmed)\s+all\b/i.test(text.slice(item.index));
  const filtered = actions.filter(item => !(hasBE && item.action === 'MOVE_STOP') && !(item.action === 'CLOSE' && actions.some(trim => trim.action === 'TRIM' && !fullTrim(trim) && item.index >= trim.index && item.index < trim.end)) && !(item.action === 'TRIM' && fullTrim(item)));
  return filtered.sort((a, b) => a.index - b.index || a.action.localeCompare(b.action));
}

function labeledNumbers(text, labels) {
  const re = new RegExp('(?:' + labels + ')\\s*\\$?(' + NUMBER + ')' + NUMBER_END, 'ig');
  return [...text.matchAll(re)].map(match => Number(match[1])).filter(value => Number.isFinite(value) && value >= 0);
}

function premium(text, entry = false) {
  const values = labeledNumbers(text, entry
    ? '@|\\b(?:entry|paid|filled?|bought|premium|price)\\b\\s*(?:(?:at|for|is)\\s*|[:=]\\s*)?|\\bat\\b'
    : '@|\\b(?:at|price|premium)\\b\\s*(?:[:=]\\s*)?');
  const unique = [...new Set(values)];
  if (unique.includes(0)) return { error: 'invalid_zero_premium' };
  return unique.length > 1 ? { error: 'conflicting_premiums' } : { value: unique[0] ?? null };
}

function fraction(text) {
  const values = [];
  // A gains percentage elsewhere in the sentence is not a trim quantity.
  const anchored = text.match(/^(?:trim(?:med|ming)?|take|taking|partial(?:ly)?(?:\s+(?:exit|close))?|(?:scale(?:d)?|scaling)\s+out|sold|sell(?:ing)?|close(?:d)?)\s*(?:(?:off|out)\s+)?(?:(\d+(?:\.\d+)?)\s*%|(half|quarter)|(\d+)\s*\/\s*(\d+))/i);
  if (anchored?.[1]) values.push(Number(anchored[1]) / 100);
  if (anchored?.[2]) values.push(anchored[2].toLowerCase() === 'half' ? 0.5 : 0.25);
  if (anchored?.[3]) values.push(Number(anchored[3]) / Number(anchored[4]));
  if (values.some(value => !Number.isFinite(value) || value <= 0 || value > 1)) return { error: 'invalid_trim_fraction' };
  return { value: values[0] ?? null };
}

function plan(text) {
  const stops = [...new Set(labeledNumbers(text, '\\b(?:stop|stops|sl)\\b\\s*(?:(?:at|to|is)\\s*|[:=]\\s*)?'))];
  if (stops.length > 1) return { error: 'conflicting_stop_prices' };
  if (stops.includes(0)) return { error: 'invalid_zero_stop' };
  const targets = [];
  for (const match of text.matchAll(/\b(?:tp|target|t)\s*([123])\b(?!\.\d)\s*(?:(?:at|is)\s*|[:=]\s*)?/ig)) {
    const tail = text.slice(match.index + match[0].length);
    const value = tail.match(new RegExp('^\\$?(' + NUMBER + ')' + NUMBER_END));
    const target = { target_number: Number(match[1]), premium: value ? Number(value[1]) : null };
    if (target.premium === 0) return { error: 'invalid_zero_target' };
    const previous = targets.find(item => item.target_number === target.target_number);
    if (previous && previous.premium !== target.premium) return { error: 'conflicting_target_prices' };
    if (!previous) targets.push(target);
  }
  if (!targets.length) {
    const values = labeledNumbers(text, '\\b(?:target|take\\s+profit)\\b\\s*(?:(?:at|is)\\s*|[:=]\\s*)?');
    values.forEach((value, index) => targets.push({ target_number: index + 1, premium: value }));
  }
  return { stop: stops[0] ?? null, targets };
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object' || typeof message.raw_text !== 'string') return { status: 'review', reason: 'invalid_message', instructions: [] };
  const text = message.raw_text.replace(/\s+/g, ' ').trim();
  if (!text) return { status: 'ignored', reason: 'empty_message', instructions: [] };
  const actions = managementActions(text);
  const publishedDate = publishedDateET(message.timestamp_utc);
  const parserMessage = { ...message, timestamp_utc: publishedDate ? message.timestamp_utc : '2000-01-01T00:00:00.000Z' };
  const sourceParser = actions.length ? 'parseTradeUpdate' : 'parseTradeCall';
  const stage2 = actions.length ? parseTradeUpdate(parserMessage) : parseTradeCall(parserMessage);
  const identity = identities(text, publishedDate);
  const parsed = { ...(stage2 || {}), normalization_provenance: { source_parser: sourceParser, timestamp_utc: message.timestamp_utc ?? null, published_date_et: publishedDate, expiry: identity.provenance || [] } };
  const review = reason => ({ status: 'review', reason, instructions: [], parsed });
  const ignored = reason => ({ status: 'ignored', reason, instructions: [], parsed });
  if (!actions.length && /\b(?:gains?|nice\s+win|winner|from\s+earlier|yesterday'?s)\b|\+\s*\d+(?:\.\d+)?\s*%/i.test(text) && !/\b(?:buy(?:ing)?|bto|entry|entered|starter)\b/i.test(text)) return ignored('gains_only');
  const open = !actions.length && OPEN_RE.test(text);
  if (!actions.length && !open) return /\b(?:tp\s*[123]|target\s*[123]|sell|short|calls?|puts?)\b/i.test(text) || identity.hint ? review('trade_like_without_explicit_action') : ignored('not_a_trade_instruction');
  if (identity.error) return review(identity.error);
  if ([...text.matchAll(/\b(?:tp|target|t)\s*(\d+)\b(?!\.\d)/ig)].some(match => Number(match[1]) < 1 || Number(match[1]) > 3)) return review('unsupported_target_number');
  if (/\b(?:yesterday|earlier|previously|repost(?:ing|ed)?|recap|last\s+(?:week|month)|tomorrow)\b/i.test(text)) return review('retrospective_or_future_instruction');
  if (/\b(?:if|when|unless|maybe|might|would|could|watch(?:ing)?|consider(?:ing)?|idea|looking|waiting)\b/i.test(text)) return review('conditional_or_watchlist_instruction');
  if (/\b(?:not|never|don'?t|won'?t|do\s+not|ignore|disregard)\b/i.test(text)) return review('negated_or_retracted_instruction');
  if (/\b(?:sell|selling|short)\b/i.test(text) && (open || /\b(?:buy(?:ing)?|bought|bto)\b/i.test(text))) return review('conflicting_or_unsupported_entry_direction');
  if (actions.length && OPEN_RE.test(text.replace(/\b(?:stops?\s+to|at)\s+entry\b/ig, ''))) return review('mixed_open_and_management_instruction');
  if (actions.some(item => item.action === 'BREAKEVEN') && labeledNumbers(text, '\\bstops?\\b\\s*(?:(?:at|to|is)\\s*|[:=]\\s*)?').length) return review('conflicting_stop_instructions');
  if (/\bcancel(?:led|ed)?\s+(?:the\s+)?(?:stop|tp|target)\b/i.test(text)) return review('unsupported_cancel_scope');
  if (actions.length) {
    if (/\b(?:half|quarter|\d+(?:\.\d+)?\s*%)\s+(?:trim|partial)\b/i.test(text)) return review('quantity_before_action_requires_review');
    if (/\b(?:close|closer)\s+to\s+(?:the\s+)?(?:target|tp|entry|stop|breakeven)\b/i.test(text)) return review('comparison_not_management_instruction');
    const allowed = new Set([...MANAGEMENT_WORDS, 'cut', 'flat', 'dte', ...Object.keys(MONTHS).map(month => month.toLowerCase()), identity.symbol?.toLowerCase(), ...(identity.symbol === 'SPX' ? ['spxw'] : []), 'c', 'p', 'call', 'calls', 'put', 'puts']);
    if ([...text.matchAll(/[A-Za-z]+(?:\/[A-Za-z]+)?/g)].some(match => !allowed.has(match[0].toLowerCase()))) return review('unsupported_management_text');
  }
  const hint = identity.hint;
  const complete = hint && hint.underlying && hint.expiration_date && hint.strike && hint.option_side;
  const contract = complete ? { ...hint } : null;
  const base = { contract, symbol: identity.symbol, premium: null, ...(message.reply_to_message_id ? { reply_to_message_id: message.reply_to_message_id } : {}) };
  if (!complete && hint) base.contract_hint = Object.fromEntries(Object.entries(hint).filter(([, value]) => value !== null));
  if (open) {
    if (!hint) return review('explicit_option_contract_required');
    if (!hint.underlying) return review('explicit_underlying_required');
    if (!hint.expiration_date) return review('explicit_expiration_required');
    if (publishedDate && hint.expiration_date < publishedDate) return review('expiration_precedes_published_date');
    const entryText = text.split(/\b(?:stop|stops|sl|tp\s*[123]|target|take\s+profit)\b/i)[0];
    if (new RegExp('(?:@|\\b(?:entry|paid|premium|price|at)\\b)\\s*\\$?-\\s*' + NUMBER, 'i').test(entryText) || new RegExp('(?:@|\\b(?:entry|paid|premium|price|at)\\b)\\s*\\$?' + NUMBER + '\\s*(?:-|to)\\s*\\$?' + NUMBER, 'i').test(entryText)) return review('unsupported_entry_premium_sign_or_range');
    const price = premium(entryText, true);
    const planned = plan(text);
    if (price.error || planned.error) return review(price.error || planned.error);
    return { status: 'normalized', instructions: [{ action: 'OPEN', ...base, premium: price.value, stop: planned.stop, targets: planned.targets }], parsed };
  }
  const terminal = new Set(actions.filter(item => ['CLOSE', 'CANCEL', 'STOP_HIT'].includes(item.action)).map(item => item.action));
  if (terminal.size > 1) return review('conflicting_terminal_instructions');
  if (terminal.size && actions.some(item => item.action === 'ADD')) return review('conflicting_add_and_exit_instructions');
  if (actions.filter(item => item.action === 'MOVE_STOP').length > 1) return review('multiple_stop_move_instructions');
  const instructions = [], seen = new Map();
  for (let index = 0; index < actions.length; index += 1) {
    const item = actions[index];
    const key = item.action + ':' + (item.action === 'TARGET_HIT' ? item.match[1] : '');
    const segment = text.slice(item.index, actions[index + 1]?.index ?? text.length);
    const price = premium(segment);
    if (price.error) return review(price.error);
    const instruction = { action: item.action, ...base, premium: price.value };
    if (item.action === 'TARGET_HIT') instruction.target_number = Number(item.match[1]);
    if (item.action === 'TRIM') {
      const amount = fraction(segment);
      if (amount.error) return review(amount.error);
      instruction.fraction = amount.value;
    }
    if (item.action === 'MOVE_STOP') {
      const stop = labeledNumbers(segment, '\\bstops?\\b\\s*(?:(?:at|to|is)\\s*|[:=]\\s*)?');
      if (new Set(stop).size > 1) return review('conflicting_stop_prices');
      if (!stop.length) return review('stop_move_price_required');
      if (stop[0] === 0) return review('invalid_zero_stop');
      instruction.stop = stop[0];
      instruction.premium = null;
    }
    if (item.action === 'BREAKEVEN') instruction.premium = null;
    if (seen.has(key)) {
      if (JSON.stringify(seen.get(key)) !== JSON.stringify(instruction)) return review('conflicting_duplicate_instructions');
      continue;
    }
    seen.set(key, instruction);
    instructions.push(instruction);
  }
  // Terminal state comes last even when an analyst writes "all out, TP3 hit".
  instructions.sort((a, b) => Number(['CLOSE', 'CANCEL', 'STOP_HIT'].includes(a.action)) - Number(['CLOSE', 'CANCEL', 'STOP_HIT'].includes(b.action)));
  return { status: 'normalized', instructions, parsed };
}

module.exports = { normalizeMessage };
