'use strict';

const { buildVerdictMarkdown } = require('../confluence-engine');
const { getLivePrice } = require('../live-price');
const { getMarketSnapshot } = require('../market-data');
const { priceFromLive, summarizeMarketData, isUsableDecisionPrice } = require('./decision-adapter');

function rowsFromMarkdown(markdown) {
  return String(markdown || '')
    .split('\n')
    .filter(line => line.trim().startsWith('- **'))
    .map(line => ({ markdown: line }));
}

async function buildCurrentPrices(instruments, getLivePriceFn, getMarketSnapshotFn) {
  if (getLivePriceFn === false) return { currentPrices: {}, warnings: ['live price lookup disabled'] };
  try {
    if (getLivePriceFn === getLivePrice && getMarketSnapshotFn) {
      const snapshot = await getMarketSnapshotFn(instruments);
      const currentPrices = {};
      const marketData = {};
      const warnings = [];
      for (const instrument of instruments) {
        const row = snapshot[instrument] || null;
        marketData[instrument] = summarizeMarketData(row);
        currentPrices[instrument] = isUsableDecisionPrice(row) ? row.price : null;
        if (!isUsableDecisionPrice(row)) warnings.push(`${instrument} market price unavailable or stale`);
      }
      return { currentPrices, warnings, marketData };
    }

    const livePrice = await getLivePriceFn();
    const currentPrices = {};
    const marketData = {};
    for (const instrument of instruments) {
      currentPrices[instrument] = priceFromLive(instrument, livePrice);
      marketData[instrument] = null;
    }
    return { currentPrices, warnings: [], marketData };
  } catch (err) {
    return { currentPrices: {}, warnings: [`market price unavailable: ${err.message}`], marketData: {} };
  }
}

async function buildConfluenceResponse({
  instrument = 'ES',
  instruments = null,
  topN = 5,
  currentPrices = null,
  getLivePriceFn = getLivePrice,
  getMarketSnapshotFn = getMarketSnapshot,
  buildVerdictMarkdownFn = buildVerdictMarkdown,
} = {}) {
  const list = (instruments || [instrument])
    .map(item => String(item || '').toUpperCase())
    .filter(Boolean);
  const priceResult = currentPrices
    ? { currentPrices, warnings: [], marketData: {} }
    : await buildCurrentPrices(list, getLivePriceFn, getMarketSnapshotFn);
  const markdown = buildVerdictMarkdownFn(list, {
    currentPrices: priceResult.currentPrices,
    topN,
    priceError: priceResult.warnings.length > 0,
  });

  return {
    ok: true,
    endpoint_type: 'confluence',
    mode: 'confluence_only',
    instruments: list,
    trade_action: null,
    actionable: false,
    disclaimer: 'Confluence only. Use /entries ES or /api/decision for pass/trade decision truth.',
    rows: rowsFromMarkdown(markdown),
    markdown,
    marketData: priceResult.marketData,
    market_data: priceResult.marketData,
    warnings: priceResult.warnings,
  };
}

module.exports = {
  buildConfluenceResponse,
  rowsFromMarkdown,
};
