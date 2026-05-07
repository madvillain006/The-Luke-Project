'use strict';

const { normalizeSymbol } = require('./instruments');

const MONTHS = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, SEPT: 8, OCT: 9, NOV: 10, DEC: 11,
};

const OPTION_STOP_UNDERLYINGS = new Set([
  'AFTER', 'AND', 'ARE', 'BOT', 'BUY', 'CALL', 'CALLS', 'CONS', 'CPI', 'DTE',
  'FROM', 'GOT', 'IV', 'MARCH', 'NOW', 'OF', 'OFF', 'PUT', 'PUTS', 'ROLL',
  'SELL', 'SOLD', 'SPREAD', 'TA', 'THE', 'TO', 'TOOK', 'WAS', 'WERE',
]);

function pad2(value) {
  return String(value).padStart(2, '0');
}

function asDateOnly(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function expiryFromDte(timestampUtc, days) {
  const base = new Date(timestampUtc || Date.now());
  if (!Number.isFinite(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return asDateOnly(base);
}

function parseExpiryToken(token, timestampUtc) {
  const text = String(token || '').trim();
  if (!text) return null;
  const dte = text.match(/^(\d+)DTE$/i);
  if (dte) return expiryFromDte(timestampUtc, Number(dte[1]));
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slash) {
    const base = new Date(timestampUtc || Date.now());
    const yearRaw = slash[3] ? Number(slash[3]) : base.getUTCFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${pad2(slash[1])}-${pad2(slash[2])}`;
  }
  const named = text.match(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\s*(\d{1,2})(?:,?\s*(\d{2,4}))?$/i);
  if (named) {
    const base = new Date(timestampUtc || Date.now());
    const yearRaw = named[3] ? Number(named[3]) : base.getUTCFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${pad2(MONTHS[named[1].toUpperCase()] + 1)}-${pad2(named[2])}`;
  }
  return null;
}

function inferUnderlying(explicit, strike, timestampUtc, text) {
  const normalized = normalizeSymbol(explicit);
  const upper = String(text || '').toUpperCase();
  if (normalized && (!OPTION_STOP_UNDERLYINGS.has(normalized) || new RegExp('[$#]\\s*' + normalized + '\\b').test(upper))) {
    return normalized === 'SPXW' ? 'SPX' : normalized;
  }
  if (/\bSPXW?\b/.test(upper) && Number(strike) >= 1000) return 'SPX';
  if (/\bSPY\b/.test(upper)) return 'SPY';
  if (/\bQQQ\b/.test(upper)) return 'QQQ';
  if (Number(strike) >= 1000) return 'SPX';
  return null;
}

function optionRootForUnderlying(underlying) {
  const normalized = normalizeSymbol(underlying);
  if (normalized === 'SPX') return 'SPXW';
  return normalized;
}

function polygonOptionTicker(contract) {
  if (!contract || !contract.underlying || !contract.expiration_date || !contract.strike || !contract.option_side) return null;
  const root = optionRootForUnderlying(contract.underlying);
  const exp = String(contract.expiration_date).replace(/-/g, '').slice(2);
  const side = contract.option_side === 'PUT' ? 'P' : 'C';
  const strike = Math.round(Number(contract.strike) * 1000);
  return `O:${root}${exp}${side}${String(strike).padStart(8, '0')}`;
}

function plausibleStrike(underlying, strike) {
  const symbol = normalizeSymbol(underlying);
  const value = Number(strike);
  if (!Number.isFinite(value)) return false;
  if (symbol === 'SPX') return value >= 3000 && value <= 10000;
  if (symbol === 'SPY' || symbol === 'QQQ') return value >= 100 && value <= 1000;
  return value > 0;
}

function parsePremiums(text) {
  const source = String(text || '');
  const premiumPattern = '(?:\\d{1,3}(?:\\.\\d{1,2})?|\\.\\d{1,2})';
  const toPremium = value => {
    const raw = String(value || '');
    return Number(raw.startsWith('.') ? '0' + raw : raw);
  };
  const out = {};
  const entry = source.match(new RegExp('(?:\\b(?:bought|bot|entry|entered|paid|filled?|fill|from|at)\\b|@)\\s*\\$?(' + premiumPattern + ')(?!\\d)', 'i'));
  const exit = source.match(new RegExp('\\b(?:sold|closed?|trim(?:med)?|out|to|hit|now|is|are|was|were)\\b\\s*\\$?(' + premiumPattern + ')(?!\\d)', 'i'));
  const range = source.match(new RegExp('(?:^|\\s)(?:from\\s*)?\\$?(' + premiumPattern + ')\\s*(?:to|->)\\s*\\$?(' + premiumPattern + ')(?!\\d)', 'i'));
  if (range) {
    out.entry_premium = toPremium(range[1]);
    out.exit_premium = toPremium(range[2]);
  }
  if (entry && out.entry_premium === undefined) out.entry_premium = toPremium(entry[1]);
  if (exit && out.exit_premium === undefined) out.exit_premium = toPremium(exit[1]);
  return out;
}

function contractConfidence(contract) {
  let score = 0.25;
  if (contract.underlying) score += 0.2;
  if (contract.expiration_date) score += 0.2;
  if (contract.strike) score += 0.15;
  if (contract.option_side) score += 0.15;
  if (contract.entry_premium !== null || contract.exit_premium !== null) score += 0.05;
  return Math.round(Math.min(0.95, score) * 100) / 100;
}

function makeContract(input, timestampUtc, text) {
  const strike = Number(input.strike);
  const underlying = inferUnderlying(input.underlying, strike, timestampUtc, text);
  const expiration = input.expiration_date || parseExpiryToken(input.expiry_token, timestampUtc) ||
    (/\b0DTE\b/i.test(text) ? expiryFromDte(timestampUtc, 0) : null);
  const premiums = parsePremiums(text);
  const contract = {
    underlying,
    option_root: optionRootForUnderlying(underlying),
    option_side: String(input.side || '').toUpperCase() === 'P' || String(input.side || '').toUpperCase() === 'PUT' ? 'PUT' : 'CALL',
    strike: Number.isFinite(strike) ? strike : null,
    expiration_date: expiration,
    dte_label: input.expiry_token && /DTE/i.test(input.expiry_token) ? input.expiry_token.toUpperCase() : null,
    entry_premium: Number.isFinite(premiums.entry_premium) ? premiums.entry_premium : null,
    exit_premium: Number.isFinite(premiums.exit_premium) ? premiums.exit_premium : null,
    quantity_contracts: input.quantity_contracts || null,
    spread_legs: input.spread_legs || [],
    source_text: String(text || '').slice(0, 260),
    parse_notes: [],
  };
  if ((contract.spread_legs || []).length > 1) {
    contract.parse_notes.push('multi_leg_spread_requires_dedicated_pricing');
  }
  if (!plausibleStrike(contract.underlying, contract.strike)) {
    contract.parse_notes.push('implausible_strike_for_underlying');
  }
  contract.option_ticker = contract.parse_notes.includes('implausible_strike_for_underlying') ||
    contract.parse_notes.includes('multi_leg_spread_requires_dedicated_pricing')
    ? null
    : polygonOptionTicker(contract);
  contract.confidence = contractConfidence(contract);
  if (!contract.underlying) contract.parse_notes.push('underlying_missing');
  if (!contract.expiration_date) contract.parse_notes.push('expiration_missing');
  return contract;
}

function parseOptionContracts(text, fallbackUnderlying, timestampUtc) {
  const source = String(text || '');
  const contracts = [];
  const seen = new Set();

  function add(input) {
    const contract = makeContract({
      underlying: input.underlying || fallbackUnderlying,
      ...input,
    }, timestampUtc, source);
    const key = [contract.underlying, contract.expiration_date, contract.strike, contract.option_side].join('|');
    if (!contract.strike || seen.has(key)) return;
    seen.add(key);
    contracts.push(contract);
  }

  for (const match of source.matchAll(/\$?([A-Za-z]{1,5})?\s*(?:(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d+DTE)\s+)?(\d{1,5}(?:\.\d{1,2})?)\s*([cCpP])\b/g)) {
    if (match.index > 0 && source[match.index - 1] === '/') continue;
    add({ underlying: match[1], expiry_token: match[2], strike: match[3], side: match[4] });
  }

  for (const match of source.matchAll(/\$?([A-Za-z]{1,5})\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(\d{1,5}(?:\.\d{1,2})?)\s*(calls?|puts?)\b/ig)) {
    add({ underlying: match[1], expiry_token: match[2], strike: match[3], side: /^p/i.test(match[4]) ? 'P' : 'C' });
  }

  for (const match of source.matchAll(/\b(\d{1,5}(?:\.\d{1,2})?)\s*\/\s*(\d{1,5}(?:\.\d{1,2})?)\s*([cCpP])\s+spread\b/g)) {
    add({
      strike: match[1],
      side: match[3],
      spread_legs: [
        { strike: Number(match[1]), side: String(match[3]).toUpperCase() === 'P' ? 'PUT' : 'CALL' },
        { strike: Number(match[2]), side: String(match[3]).toUpperCase() === 'P' ? 'PUT' : 'CALL' },
      ],
    });
  }

  return contracts.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  expiryFromDte,
  parseExpiryToken,
  parseOptionContracts,
  polygonOptionTicker,
  _internal: {
    inferUnderlying,
    parsePremiums,
    plausibleStrike,
  },
};
