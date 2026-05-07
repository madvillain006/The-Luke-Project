'use strict';

const { normalizeSymbol } = require('./instruments');
const { compactText, sha256, toMs } = require('./io');

const SPX_FAMILY = new Set(['SPX', 'SPY', 'ES', 'MES']);
const QQQ_FAMILY = new Set(['QQQ', 'NDX', 'NQ', 'MNQ']);
const PRESERVED_SYMBOLS = new Set(['SPX', 'SPXW', 'SPY', 'ES', 'MES', 'QQQ', 'NDX', 'NQ', 'MNQ', 'VIX']);
const CONTEXT_SYMBOL_WATCHLIST = new Set([
  ...PRESERVED_SYMBOLS,
  'AAPL', 'ADBE', 'AMD', 'AMZN', 'ASHR', 'AVGO', 'BABA', 'BAC', 'COIN', 'DIA',
  'FIG', 'FIGS', 'FXI', 'GOOG', 'GOOGL', 'GS', 'IWM', 'JPM', 'KWEB', 'MDB',
  'META', 'MSFT', 'NVDA', 'PLTR', 'SMH', 'SNOW', 'SOFI', 'TEAM', 'TSLA', 'UBS',
  'XLK', 'XLF', 'XLE', 'XLI', 'XLV', 'XLY',
]);
const STOP_WORDS = new Set([
  'A', 'ABOUT', 'AFTER', 'ALL', 'ALSO', 'AM', 'AN', 'AND', 'APP', 'ARE', 'ARM',
  'ASK', 'AT', 'BEST', 'BUT', 'BUY', 'CAN', 'CEO', 'CFO', 'CLOSE', 'COULD',
  'DAY', 'DD', 'DID', 'DO', 'DOES', 'DOWN', 'EDGE', 'EVENT', 'EXACT', 'FOR',
  'FROM', 'HAS', 'HIGH', 'HOW', 'IF', 'IN', 'INTO', 'IS', 'IT', 'ITS', 'JAN',
  'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'SEPT', 'OCT', 'NOV',
  'DEC', 'KEY', 'LAST', 'LOW', 'MIXED', 'NO', 'NOT', 'NOW', 'OF', 'OFF', 'ON',
  'ONE', 'OR', 'OUR', 'PM', 'PROPER', 'REAL', 'RSI', 'SELL', 'SEND', 'SO',
  'STACK', 'THE', 'THIS', 'TO', 'TREND', 'UP', 'US', 'USA', 'WANT', 'WEAK',
  'WHAT', 'WHY', 'WITH', 'YOU', 'YOUR', 'ZONE', 'AI',
]);
const STRUCTURED_DD_LABELS = [
  ['trend', /\btrend\s*:\s*([^\n]+)/i],
  ['momentum', /\bmomentum\s*:\s*([^\n]+)/i],
  ['last_close', /\blast\s+close\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
  ['rsi', /\brsi\s*:\s*(-?\d+(?:\.\d+)?)/i],
  ['buy_zone', /\bbuy\s+zone\s*:\s*([^\n]+)/i],
  ['sell_resistance_zone', /\b(?:sell\s*\/\s*)?resistance\s+zone\s*:\s*([^\n]+)/i],
];
const SPOTGAMMA_LABELS = [
  ['low_vol_point', /\blow\s+vol\s+point\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
  ['high_vol_point', /\bhigh\s+vol\s+point\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
  ['call_gamma', /\bcall\s+gamma\s*:\s*([+-]?\d+(?:\.\d+)?\s*[KMB]?)/i],
  ['put_gamma', /\bput\s+gamma\s*:\s*([+-]?\d+(?:\.\d+)?\s*[KMB]?)/i],
  ['hiro', /\bhiro\s*:\s*([+-]?\d+(?:\.\d+)?\s*[KMB]?)/i],
  ['call_wall', /\bcall\s+wall\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
  ['put_wall', /\bput\s+wall\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
  ['key_gamma_delta_call_wall', /\bkey\s+gamma\s*\/\s*key\s+delta\s*\/\s*call\s+wall\s*:\s*\$?(-?\d+(?:\.\d+)?)/i],
];

const REGIME_RULES = [
  ['risk_on', /\brisk[-\s]?on|breadth (?:expanding|strong)|rotation into growth|soft landing|liquidity\b/i],
  ['risk_off', /\brisk[-\s]?off|de[-\s]?risk|flight to safety|defensive|selloff|drawdown|hard landing\b/i],
  ['volatility', /\bvol(?:atility)?|vix|iv|implied vol|realized vol|vol crush|vol expansion\b/i],
  ['gamma_gex', /\bgamma|gex|dealer|charm|vanna|pinning|zero gamma|call wall|put wall\b/i],
  ['rates', /\brates?|yields?|treasury|tnx|fed|fomc|cuts?|hikes?|duration\b/i],
  ['inflation', /\bcpi|ppi|inflation|deflation|disinflation|pce\b/i],
  ['dollar', /\bdxy|dollar|usd\b/i],
  ['oil', /\boil|crude|wti|brent|energy\b/i],
  ['breadth', /\bbreadth|advance.?decline|participation|new highs|new lows\b/i],
  ['earnings', /\bearnings?|guidance|eps|revenue|margin\b/i],
  ['positioning', /\bpositioning|flows?|crowded|short interest|squeeze|hedging\b/i],
  ['trend', /\btrend|breakout|breakdown|higher highs?|lower lows?|momentum\b/i],
  ['chop', /\bchop|range|sideways|compression|mean reversion\b/i],
];

const EQUITY_THEME_RULES = [
  ['ai_software', /\bai|software|saas|cloud|semis?|chips?|nvda|amd|avgo|msft\b/i],
  ['mega_cap', /\bmega.?cap|aapl|msft|amzn|googl?|meta|nvda|tsla\b/i],
  ['financials', /\bbanks?|financials?|credit|lending|jpm|bac|gs|ms\b/i],
  ['defensives', /\bdefensives?|utilities|staples|healthcare|xlv|xlu|xlp\b/i],
  ['consumer', /\bconsumer|retail|discretionary|xly|wmt|cost|tgt\b/i],
  ['industrial', /\bindustrials?|xli|transport|manufacturing\b/i],
  ['crypto_beta', /\bcrypto|bitcoin|btc|coin|mstr|miners?\b/i],
];

function isSybilMessage(message) {
  if (!message) return false;
  if (message.source_collection === 'sybil') return true;
  const file = String(message.source_file || '').toLowerCase();
  const channel = String(message.channel_name || '').toLowerCase();
  return file.includes('discord-exports/sybil') || file.includes('discord-exports\\sybil') ||
    ['ask-sybil', 'narratives', 'vault-notes'].includes(channel);
}

function extractSymbols(text) {
  const out = new Set();
  const source = String(text || '');
  const lower = source.toLowerCase();
  for (const match of source.matchAll(/[$#]\s*([A-Za-z]{1,5})\b/g)) {
    const symbol = normalizeSymbol(match[1]);
    if (symbol && !STOP_WORDS.has(symbol)) out.add(symbol);
  }
  for (const match of source.matchAll(/\b(SPXW|SPX|SPY|ES|MES|QQQ|NDX|NQ|MNQ|VIX)\b/ig)) {
    const symbol = normalizeSymbol(match[1]);
    if (symbol) out.add(symbol);
  }
  for (const symbol of CONTEXT_SYMBOL_WATCHLIST) {
    if (PRESERVED_SYMBOLS.has(symbol)) continue;
    const re = new RegExp(`(?:^|[^A-Za-z0-9])${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`, 'i');
    if (re.test(lower) && symbolHasContext(source, symbol)) out.add(symbol);
  }
  for (const match of source.matchAll(/\b([A-Z][A-Z0-9]{0,4})\b/g)) {
    const symbol = normalizeSymbol(match[1]);
    if (!symbol || STOP_WORDS.has(symbol) || !CONTEXT_SYMBOL_WATCHLIST.has(symbol)) continue;
    if (PRESERVED_SYMBOLS.has(symbol) || symbolHasContext(source, symbol)) out.add(symbol);
  }
  return [...out].slice(0, 20);
}

function symbolHasContext(text, symbol) {
  const source = String(text || '');
  const idx = source.toUpperCase().indexOf(String(symbol || '').toUpperCase());
  if (idx < 0) return false;
  const windowText = source.slice(Math.max(0, idx - 80), idx + String(symbol).length + 120);
  return /[$#@]|ticker|stock|shares?|calls?|puts?|flow|spotgamma|gamma|hiro|wall|dd|trend|momentum|rsi|last close|buy zone|sell|resistance|valuation|earnings|event|expression|straddle|spread/i.test(windowText);
}

function cleanValue(value) {
  return compactText(String(value || '').replace(/^[\s:-]+/, ''), 160);
}

function numberOrText(value) {
  const raw = cleanValue(value);
  const n = Number(raw.replace(/[$,%]/g, ''));
  return Number.isFinite(n) && /^[$,\d.%-]+$/.test(raw) ? n : raw;
}

function valuesForLabels(text, labels) {
  const out = {};
  for (const [key, re] of labels) {
    const match = String(text || '').match(re);
    if (match) out[key] = numberOrText(match[1]);
  }
  return out;
}

function linesMatching(text, re, max = 8) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => cleanValue(line))
    .filter(Boolean)
    .filter(line => re.test(line))
    .slice(0, max);
}

function extractValuationMetrics(text) {
  return linesMatching(text, /\b(?:valuation|p\/e|pe\b|ev\/ebitda|fcf|free cash flow|revenue|sales|margin|eps|ebitda|multiple|guidance)\b/i, 10);
}

function extractStructuredDd(text) {
  const source = String(text || '');
  const chartTape = valuesForLabels(source, STRUCTURED_DD_LABELS);
  const spotgamma = valuesForLabels(source, SPOTGAMMA_LABELS);
  const eventStack = linesMatching(source, /\b(?:event stack|cpi|ppi|fomc|fed|nfp|earnings|guidance|tariff|court|approval|data|catalyst|macro)\b/i, 10);
  const expressionMap = linesMatching(source, /\b(?:expression|calls?|puts?|straddle|spread|debit|credit|shares?|upside|downside|vol expression|beta)\b/i, 10);
  const riskNotes = linesMatching(source, /\b(?:what kills|kills it|risk|invalid|invalidation|bear case|bull case fails|unless|if wrong|downside|rug|gap down)\b/i, 10);
  const valuationMetrics = extractValuationMetrics(source);
  const out = {};
  if (Object.keys(chartTape).length) out.chart_tape_metrics = chartTape;
  if (valuationMetrics.length) out.valuation_metrics = valuationMetrics;
  if (Object.keys(spotgamma).length) out.spotgamma_metrics = spotgamma;
  if (eventStack.length) out.event_stack = eventStack;
  if (expressionMap.length) out.expression_map = expressionMap;
  if (riskNotes.length) out.what_kills_it = riskNotes;
  return out;
}

function tagsForRules(text, rules) {
  return rules.filter(([, re]) => re.test(text)).map(([tag]) => tag);
}

function attachmentRefs(message) {
  return (message.attachments || []).map(att => ({
    id: att.id || null,
    filename: att.filename || null,
    content_type: att.content_type || null,
    size: att.size || null,
    has_url: Boolean(att.url),
  }));
}

function parseSybilContext(message) {
  if (!isSybilMessage(message)) return null;
  const text = String(message.raw_text || '');
  const symbols = extractSymbols(text);
  const regimeTags = tagsForRules(text, REGIME_RULES);
  const equityThemeTags = tagsForRules(text, EQUITY_THEME_RULES);
  const spxFamily = symbols.filter(symbol => SPX_FAMILY.has(symbol));
  const qqqFamily = symbols.filter(symbol => QQQ_FAMILY.has(symbol));
  const refs = attachmentRefs(message);
  const contextTags = [...new Set([...regimeTags, ...equityThemeTags])];
  const structured = extractStructuredDd(text);
  return {
    context_id: 'sybil_' + (message.message_id || sha256([message.timestamp_utc, text].join('|')).slice(0, 16)),
    source_message_id: message.message_id || null,
    timestamp_utc: message.timestamp_utc || null,
    channel_id: message.channel_id || null,
    channel_name: message.channel_name || null,
    author_id: message.author_id || null,
    author_name: message.author_name || null,
    source_collection: message.source_collection || 'sybil',
    source_type: message.source_type || null,
    source_file: message.source_file || null,
    symbols_mentioned: symbols,
    spx_family_mentions: spxFamily,
    qqq_family_mentions: qqqFamily,
    regime_tags: regimeTags,
    equity_theme_tags: equityThemeTags,
    context_tags: contextTags,
    attachment_refs: refs,
    attachment_count: refs.length,
    structured_dd: structured,
    raw_text_preview: compactText(text, 240),
    parse_status: contextTags.length || symbols.length || refs.length || Object.keys(structured).length ? 'context' : 'low_signal',
    confidence: Math.min(0.9, 0.35 + (contextTags.length ? 0.25 : 0) + (symbols.length ? 0.15 : 0) + (refs.length ? 0.1 : 0) + (Object.keys(structured).length ? 0.15 : 0)),
  };
}

function parseSybilContexts(messages) {
  const contexts = (messages || []).map(parseSybilContext).filter(Boolean);
  const byChannel = {};
  const tagCounts = {};
  let attachments = 0;
  for (const context of contexts) {
    byChannel[context.channel_name || 'unknown'] = (byChannel[context.channel_name || 'unknown'] || 0) + 1;
    attachments += context.attachment_count || 0;
    for (const tag of context.context_tags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  return {
    contexts,
    summary: {
      messages: contexts.length,
      context_records: contexts.filter(row => row.parse_status === 'context').length,
      low_signal_records: contexts.filter(row => row.parse_status === 'low_signal').length,
      attachments,
      channels: byChannel,
      tag_counts: tagCounts,
    },
  };
}

function sameTradeFamily(tradeSymbol, context) {
  const symbol = normalizeSymbol(tradeSymbol);
  if (!symbol) return false;
  const syms = new Set(context.symbols_mentioned || []);
  if (syms.has(symbol)) return true;
  if (SPX_FAMILY.has(symbol) && (context.spx_family_mentions || []).length) return true;
  if (QQQ_FAMILY.has(symbol) && (context.qqq_family_mentions || []).length) return true;
  return false;
}

function filterOutSybilMessages(messages) {
  return (messages || []).filter(message => !isSybilMessage(message));
}

function contextsBeforeTrade(trade, contexts, maxHours = 24) {
  const tradeMs = toMs(trade.timestamp_utc);
  if (!Number.isFinite(tradeMs)) return [];
  return (contexts || []).filter(context => {
    const contextMs = toMs(context.timestamp_utc);
    if (!Number.isFinite(contextMs) || contextMs > tradeMs) return false;
    if (tradeMs - contextMs > maxHours * 60 * 60 * 1000) return false;
    return sameTradeFamily(trade.normalized_symbol, context) || !(context.symbols_mentioned || []).length;
  });
}

module.exports = {
  contextsBeforeTrade,
  extractSymbols,
  extractStructuredDd,
  filterOutSybilMessages,
  isSybilMessage,
  parseSybilContext,
  parseSybilContexts,
  sameTradeFamily,
};
