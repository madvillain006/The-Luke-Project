const { getFrontMonthSymbol } = require("./common");
const { getTradovateToken, getBaseUrl } = require("./broker-tradovate");

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

  if (!creds || !creds.username || !creds.cid || !creds.sec) {
    ctx.stale = true;
    ctx.error = "tradovate_credentials_missing";
    return ctx;
  }

  try {
    const token = await getTradovateToken(creds);
    const baseUrl = getBaseUrl(creds);
    const symbol = getFrontMonthSymbol(ticker);

    const r = await fetch(`${baseUrl}/quote/find?name=${symbol}`, {
      headers: { "Authorization": "Bearer " + token },
      signal: AbortSignal.timeout(4000)
    });
    if (!r.ok) {
      ctx.stale = true;
      ctx.error = `quote_http_${r.status}`;
      return ctx;
    }
    const q = await r.json();

    const bid  = typeof q.bidPrice  === "number" ? q.bidPrice  : null;
    const ask  = typeof q.askPrice  === "number" ? q.askPrice  : null;
    const last = typeof q.lastPrice === "number" ? q.lastPrice : null;

    ctx.bid  = bid;
    ctx.ask  = ask;
    ctx.price = last !== null ? last
      : (bid !== null && ask !== null ? (bid + ask) / 2 : null);
    ctx.spread_ticks = (bid !== null && ask !== null)
      ? Math.round((ask - bid) / TICK_SIZE) : null;

    if (ctx.price === null) {
      ctx.stale = true;
      ctx.error = "quote_missing_price";
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
