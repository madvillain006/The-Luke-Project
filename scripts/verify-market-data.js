'use strict';

require('dotenv').config();

const { getMarketSnapshot } = require('../lib/market-data');

const REQUIRED_SYMBOLS = ['ES', 'MES', 'NQ', 'MNQ', 'SPX', 'SPY', 'QQQ'];
const REQUIRED_FIELDS = [
  'symbol',
  'instrument',
  'price',
  'bid',
  'ask',
  'last',
  'previousClose',
  'settlement',
  'timestamp',
  'session',
  'source',
  'sourcePriority',
  'stale',
  'delayed',
  'confidence',
  'error',
  'raw',
];

function validateRow(symbol, row) {
  const missing = REQUIRED_FIELDS.filter(field => !(field in row));
  if (missing.length) return `${symbol} missing fields: ${missing.join(', ')}`;
  if (row.price === null && row.source !== 'UNKNOWN') return `${symbol} null price must be UNKNOWN source`;
  if (row.source === 'UNKNOWN' && row.confidence !== 0) return `${symbol} UNKNOWN must have confidence 0`;
  if (row.source === 'UNKNOWN' && row.stale !== true) return `${symbol} UNKNOWN must be stale`;
  if (Number.isFinite(row.price) && (row.source === 'UNKNOWN' || !row.source)) return `${symbol} priced row missing source`;
  return null;
}

async function main() {
  const snapshot = await getMarketSnapshot(REQUIRED_SYMBOLS, { cache: false, timeoutMs: 1500 });
  const errors = [];
  for (const symbol of REQUIRED_SYMBOLS) {
    const row = snapshot[symbol];
    if (!row) {
      errors.push(`${symbol} missing result`);
      continue;
    }
    const error = validateRow(symbol, row);
    if (error) errors.push(error);
  }

  console.log(JSON.stringify(snapshot, null, 2));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
