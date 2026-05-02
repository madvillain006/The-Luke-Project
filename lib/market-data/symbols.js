'use strict';

const FUTURES_MONTHS = [
  { month: 2, code: 'H' },
  { month: 5, code: 'M' },
  { month: 8, code: 'U' },
  { month: 11, code: 'Z' },
];

const SYMBOLS = {
  ES: { instrument: 'ES', kind: 'future', tradovateRoot: 'ES', yahooSymbol: 'ES=F', finnhubSymbol: 'ES1!' },
  MES: { instrument: 'MES', kind: 'future', tradovateRoot: 'MES', yahooSymbol: 'MES=F', finnhubSymbol: 'ES1!', equivalent: 'ES' },
  NQ: { instrument: 'NQ', kind: 'future', tradovateRoot: 'NQ', yahooSymbol: 'NQ=F', finnhubSymbol: 'NQ1!' },
  MNQ: { instrument: 'MNQ', kind: 'future', tradovateRoot: 'MNQ', yahooSymbol: 'MNQ=F', finnhubSymbol: 'NQ1!', equivalent: 'NQ' },
  SPX: { instrument: 'SPX', kind: 'index', polygonTicker: 'I:SPX', yahooSymbol: '^GSPC', finnhubSymbol: 'SPX' },
  SPY: { instrument: 'SPY', kind: 'etf', polygonTicker: 'SPY', yahooSymbol: 'SPY', finnhubSymbol: 'SPY' },
  QQQ: { instrument: 'QQQ', kind: 'etf', polygonTicker: 'QQQ', yahooSymbol: 'QQQ', finnhubSymbol: 'QQQ' },
};

function normalizeMarketSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase().replace(/^\//, '');
  const normalized = raw === 'ES_F' ? 'ES'
    : raw === 'NQ_F' ? 'NQ'
      : raw;
  const info = SYMBOLS[normalized] || { instrument: normalized || 'UNKNOWN', kind: 'unknown' };
  return {
    input: symbol,
    symbol: normalized || 'UNKNOWN',
    ...info,
  };
}

function getFrontMonthSymbol(root, now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const month = d.getUTCMonth();
  let year = d.getUTCFullYear();
  let monthCode = FUTURES_MONTHS.find(item => month <= item.month)?.code;
  if (!monthCode) {
    monthCode = 'H';
    year += 1;
  }
  return `${root}${monthCode}${String(year).slice(-1)}`;
}

module.exports = {
  normalizeMarketSymbol,
  getFrontMonthSymbol,
  _internal: { SYMBOLS },
};
