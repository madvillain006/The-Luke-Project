const { getMarketPrice } = require("../lib/market-data");

const TICK_SIZE = 0.25; // MNQ / MES / NQ / ES all tick at 0.25 points

async function getMarketContext(creds, ticker) {
  const ctx = {
    ticker,
    price: null,
    bid: null,
    ask: null,
    spread_ticks: null,
    fetched_at: new Date().toISOString(),
    stale: false,
    source_ok: false,
    error: null
  };

  try {
    const quote = await getMarketPrice(ticker, { tradovate: creds });
    ctx.bid = quote.bid;
    ctx.ask = quote.ask;
    ctx.price = quote.price;
    ctx.spread_ticks = (quote.bid !== null && quote.ask !== null)
      ? Math.round((quote.ask - quote.bid) / TICK_SIZE) : null;
    ctx.fetched_at = quote.timestamp || ctx.fetched_at;
    ctx.source = quote.source;
    ctx.marketData = quote;

    if (ctx.price === null || quote.stale === true || quote.delayed === true || quote.confidence < 0.6) {
      ctx.stale = true;
      ctx.error = quote.error || "quote_missing_or_stale";
    } else {
      ctx.source_ok = true;
    }
  } catch (err) {
    ctx.stale = true;
    ctx.error = err && err.message ? err.message : "quote_fetch_failed";
  }

  return ctx;
}

module.exports = { getMarketContext, TICK_SIZE };
