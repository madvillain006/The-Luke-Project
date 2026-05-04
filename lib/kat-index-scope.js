'use strict';

const TICKER_ALIASES = {
  SPXW: 'SPX',
  SPX: 'SPX',
  SPY: 'SPY',
  ES_F: 'ES',
  ESF: 'ES',
  ES: 'ES',
  MES: 'MES',
  QQQ: 'QQQ',
  NDX: 'NDX',
  NQ_F: 'NQ',
  NQF: 'NQ',
  NQ: 'NQ',
  MNQ: 'MNQ',
};

const INDEX_TICKERS = new Set(Object.values(TICKER_ALIASES));
const SPX_DIRECT_TRADE_TICKERS = new Set(['SPX', 'SPY']);
const SPX_CONTEXT_TICKERS = new Set(['ES', 'MES']);
const QQQ_CONTEXT_TICKERS = new Set(['QQQ', 'NDX', 'NQ', 'MNQ']);

function normalizeIndexTicker(ticker) {
  if (!ticker) return null;
  const raw = String(ticker).toUpperCase().replace(/^[#$]/, '').replace(/[^A-Z_]/g, '');
  return TICKER_ALIASES[raw] || null;
}

function isIndexTicker(ticker) {
  return INDEX_TICKERS.has(normalizeIndexTicker(ticker));
}

function classifyIndexTicker(ticker) {
  const normalized = normalizeIndexTicker(ticker);
  if (!normalized) {
    return {
      ticker: null,
      lane: 'ignored',
      family: 'ignored',
      spx_options_direct: false,
      spx_market_context: false,
      qqq_market_context: false,
    };
  }

  if (SPX_DIRECT_TRADE_TICKERS.has(normalized)) {
    return {
      ticker: normalized,
      lane: 'spx_options_direct',
      family: 'spx',
      spx_options_direct: true,
      spx_market_context: true,
      qqq_market_context: false,
    };
  }

  if (SPX_CONTEXT_TICKERS.has(normalized)) {
    return {
      ticker: normalized,
      lane: 'spx_futures_context',
      family: 'spx',
      spx_options_direct: false,
      spx_market_context: true,
      qqq_market_context: false,
    };
  }

  if (QQQ_CONTEXT_TICKERS.has(normalized)) {
    return {
      ticker: normalized,
      lane: 'qqq_ndx_nq_context',
      family: 'qqq',
      spx_options_direct: false,
      spx_market_context: false,
      qqq_market_context: true,
    };
  }

  return {
    ticker: normalized,
    lane: 'ignored',
    family: 'ignored',
    spx_options_direct: false,
    spx_market_context: false,
    qqq_market_context: false,
  };
}

function extractIndexTickers(text) {
  if (!text || typeof text !== 'string') return [];
  const found = new Set();
  const re = /(?:[$#])?\b(SPXW|SPX|SPY|QQQ|NDX|MES|MNQ|ES|NQ)(?:_F)?\b/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const suffix = /_F\b/i.test(match[0]) ? '_F' : '';
    const normalized = normalizeIndexTicker(match[1] + suffix);
    if (normalized) found.add(normalized);
  }
  return [...found];
}

function isSpxOptionsDirectTicker(ticker) {
  return classifyIndexTicker(ticker).spx_options_direct;
}

module.exports = {
  INDEX_TICKERS,
  normalizeIndexTicker,
  isIndexTicker,
  classifyIndexTicker,
  extractIndexTickers,
  isSpxOptionsDirectTicker,
};
