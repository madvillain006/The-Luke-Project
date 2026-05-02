const { getFrontMonthSymbol } = require("./common");

const tokenCache = { token: null, expires: 0 };

function getBaseUrl(creds) {
  return `https://${creds.env}.tradovateapi.com/v1`;
}

async function getTradovateToken(creds) {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;

  const r = await fetch(`${getBaseUrl(creds)}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: creds.username,
      password: creds.password,
      appId: "Jarvis",      // legacy Tradovate app registration; do not change without re-registering
      appVersion: "1.0",
      deviceId: creds.deviceId || "jarvis-device-01",   // stable device ID; tied to Tradovate registration
      cid: parseInt(creds.cid),
      sec: creds.sec
    })
  });
  const d = await r.json();
  if (!d.accessToken) throw new Error("Tradovate auth failed: " + JSON.stringify(d));
  tokenCache.token = d.accessToken;
  tokenCache.expires = Date.now() + 55 * 60 * 1000;
  return d.accessToken;
}

async function tradovateGet(creds, endpoint) {
  const token = await getTradovateToken(creds);
  const r = await fetch(`${getBaseUrl(creds)}${endpoint}`, {
    headers: { "Authorization": "Bearer " + token }
  });
  return r.json();
}

async function getAccounts(creds) {
  return tradovateGet(creds, "/account/list");
}

async function getContractId(token, baseUrl, ticker) {
  const r = await fetch(`${baseUrl}/contract/find?name=${ticker}`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const contracts = await r.json();
  if (!contracts || !contracts.id) throw new Error("Contract not found for " + ticker);
  return contracts.id;
}

async function getContractIdForTicker(creds, ticker) {
  const token = await getTradovateToken(creds);
  return getContractId(token, getBaseUrl(creds), getFrontMonthSymbol(ticker));
}

async function listPositions(creds) {
  return tradovateGet(creds, "/position/list");
}

async function listOrders(creds) {
  return tradovateGet(creds, "/order/list");
}

async function reconcileState(state) {
  const creds = state.tradovate;
  if (!creds || !creds.username || !creds.cid || !creds.sec) {
    return { ok: false, configured: false, critical: true, reason: "Tradovate credentials not configured" };
  }

  const [accounts, positions, orders] = await Promise.all([
    getAccounts(creds),
    listPositions(creds).catch(() => []),
    listOrders(creds).catch(() => []),
  ]);

  const accountCount = Array.isArray(accounts) ? accounts.length : 0;
  const openPositions = Array.isArray(positions)
    ? positions.filter(p => Number(p.netPos || p.netPosition || p.position || 0) !== 0)
    : [];
  const workingOrders = Array.isArray(orders)
    ? orders.filter(o => {
        const text = String(o.ordStatus || o.orderStatus || o.status || "").toLowerCase();
        return text.includes("working") || text.includes("open") || text.includes("pending");
      })
    : [];

  const mismatches = [];
  if (state.open_position && openPositions.length === 0) mismatches.push("Local state shows open position but broker shows none");
  if (!state.open_position && openPositions.length > 0) mismatches.push("Broker shows open position but local state is flat");
  if (state.open_position && state.open_position.mode === "live" && workingOrders.length === 0) {
    mismatches.push("Live position has no visible working protection orders");
  }

  return {
    ok: mismatches.length === 0,
    configured: true,
    critical: mismatches.length > 0,
    account_count: accountCount,
    open_positions: openPositions.length,
    working_orders: workingOrders.length,
    mismatches,
  };
}

async function emergencyFlatten(creds, accountId, contractId, direction) {
  const token = await getTradovateToken(creds);
  const baseUrl = getBaseUrl(creds);
  const tag = `emergency-flatten-${accountId}-${Date.now()}`;
  const closeAction = direction === "LONG" ? "Sell" : "Buy";

  try {
    const r = await fetch(`${baseUrl}/order/placeorder`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        action: closeAction,
        contractId,
        orderQty: 1,
        orderType: "Market",
        isAutomated: false,
        text: tag
      })
    });
    const result = await r.json();
    if (result.orderId) return { ok: true, orderId: result.orderId, tag };
    return { ok: false, tag, error: JSON.stringify(result) };
  } catch (err) {
    return { ok: false, tag, error: err.message };
  }
}

module.exports = {
  tokenCache,
  getBaseUrl,
  getTradovateToken,
  getAccounts,
  getContractId,
  getContractIdForTicker,
  listOrders,
  listPositions,
  reconcileState,
  emergencyFlatten,
};
