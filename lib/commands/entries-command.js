'use strict';

const { renderEntriesDecision } = require('../renderers/entries-renderer');
const { getMarketPrice: defaultGetMarketPrice } = require('../market-data');

function entriesKatInstrument(instrument) {
  return instrument === 'ES'
    ? 'SPX'
    : instrument === 'NQ'
      ? 'ES_NQ'
      : instrument === 'SPY'
        ? 'SPY_QQQ'
        : instrument === 'QQQ'
          ? 'SPY_QQQ'
          : instrument;
}

async function handleEntriesCommand(message, res, deps) {
  const {
    getKatContextSummary,
    formatKatSummaryLine,
    getLivePrice,
    getMarketPrice = defaultGetMarketPrice,
    loadState,
    buildTradeDecision,
  } = deps;

  const args = message.slice('/entries '.length).trim().split(/\s+/).filter(Boolean);
  if (args.length < 1) {
    return res.json({ reply: 'Use /entries <INSTRUMENT>' });
  }

  const instrument = args[0].toUpperCase();
  const katEntryLine = formatKatSummaryLine(
    getKatContextSummary(entriesKatInstrument(instrument)),
    'Kat context'
  );

  let marketData = null;
  try {
    marketData = getLivePrice
      ? null
      : await getMarketPrice(instrument);
  } catch {}

  let livePrice = null;
  if (getLivePrice) {
    try {
      livePrice = await getLivePrice();
    } catch {}
  }

  const legacyEntry = instrument === 'ES'
    ? livePrice?.instruments?.es
    : instrument === 'NQ'
      ? livePrice?.instruments?.nq
      : null;
  const displayMarketData = legacyEntry?.marketData || marketData || null;
  const legacyPrice = Number.isFinite(legacyEntry?.price) && legacyEntry.stale !== true && legacyEntry.delayed !== true && (legacyEntry.confidence ?? 0) >= 0.6
    ? legacyEntry.price
    : null;
  const providerPrice = Number.isFinite(marketData?.price) && marketData.stale !== true && marketData.delayed !== true && marketData.confidence >= 0.6
    ? marketData.price
    : null;
  const currentPrice = Number.isFinite(legacyPrice) ? legacyPrice : providerPrice;

  const tradeState = loadState();
  const decision = buildTradeDecision({
    instrument,
    mode: 'manual',
    currentPrice,
    state: tradeState,
    now: new Date(),
  });

  return res.json({
    reply: renderEntriesDecision({ instrument, currentPrice, marketData: displayMarketData, decision, tradeState, katEntryLine }),
  });
}

module.exports = { handleEntriesCommand, entriesKatInstrument };
