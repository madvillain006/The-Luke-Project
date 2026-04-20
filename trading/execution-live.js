const { getFrontMonthSymbol, log, notifyJarvis, saveState } = require("./common");
const { getBaseUrl, getTradovateToken, getAccounts, getContractId, tokenCache, emergencyFlatten } = require("./broker-tradovate");
const { getMarketContext } = require("./market-context");
const { validateStagedTrade } = require("./risk");

const PROTECTION_MAX_RETRIES = 2;
const PROTECTION_RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setExecutionPhase(state, phase, extra = {}) {
  state.execution = {
    phase,
    updated: new Date().toISOString(),
    ...extra
  };
  saveState(state);
}

async function submitProtection(baseUrl, token, accountId, contractId, signal, exitAction) {
  const r = await fetch(`${baseUrl}/order/placeOSO`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId,
      action: exitAction,
      contractId,
      orderQty: 1,
      orderType: "Limit",
      limitPrice: signal.target,
      isAutomated: false,
      other: {
        action: exitAction,
        contractId,
        orderQty: 1,
        orderType: "Stop",
        stopPrice: signal.stop,
        isAutomated: false
      }
    })
  });
  return r.json();
}

async function executeLive(state, signal) {
  const creds = state.tradovate;
  if (!creds.username || !creds.cid || !creds.sec) throw new Error("Tradovate credentials not configured");

  if (state.execution_blocked) {
    throw new Error("Live execution blocked: critical_mismatch pending operator acknowledgement");
  }

  setExecutionPhase(state, "entry_submitting", {
    mode: "live",
    ticker: signal.ticker || "MNQ",
    direction: signal.direction
  });

  const token = await getTradovateToken(creds);
  const baseUrl = getBaseUrl(creds);

  const accounts = await getAccounts(creds);
  if (!Array.isArray(accounts) || !accounts.length) throw new Error("No Tradovate accounts found");
  const accountId = accounts[0].id;

  const ticker = signal.ticker || "MNQ";
  const contractId = await getContractId(token, baseUrl, getFrontMonthSymbol(ticker));

  const marketCtx = await getMarketContext(creds, ticker);
  const gateConfig = { max_risk_per_trade: Math.abs(state.daily_loss_limit || -100) };
  const gate = validateStagedTrade(signal, marketCtx, gateConfig);
  log(gate.ok ? "market-context-gate-passed" : "MARKET_CONTEXT_REJECT", {
    mode: "live", ok: gate.ok, reasons: gate.reasons,
    price: marketCtx.price, spread_ticks: marketCtx.spread_ticks, stale: marketCtx.stale
  });
  if (!gate.ok) {
    setExecutionPhase(state, "market_gate_rejected", { reasons: gate.reasons });
    throw new Error("Market context gate rejected: " + gate.reasons.join("; "));
  }

  const entryR = await fetch(`${baseUrl}/order/placeorder`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId,
      action: signal.direction === "LONG" ? "Buy" : "Sell",
      contractId,
      orderQty: 1,
      orderType: "Market",
      isAutomated: false
    })
  });
  const entryOrder = await entryR.json();
  if (!entryOrder.orderId) throw new Error("Tradovate entry order failed: " + JSON.stringify(entryOrder));

  setExecutionPhase(state, "entry_confirmed", { entry_order_id: entryOrder.orderId });

  await sleep(1000);
  const exitAction = signal.direction === "LONG" ? "Sell" : "Buy";

  let ocoOrder = null;
  for (let attempt = 0; attempt <= PROTECTION_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      setExecutionPhase(state, "protection_retry", { entry_order_id: entryOrder.orderId, attempt });
      log("execution-protection-retry", { attempt, entry_order_id: entryOrder.orderId });
      await sleep(PROTECTION_RETRY_DELAY_MS);
    }
    try {
      const result = await submitProtection(baseUrl, token, accountId, contractId, signal, exitAction);
      if (result.orderId) { ocoOrder = result; break; }
      log("execution-protection-attempt-failed", { attempt, response: result });
    } catch (err) {
      log("execution-protection-attempt-error", { attempt, error: err.message });
    }
  }

  if (!ocoOrder) {
    log("execution-protection-all-retries-failed", { entry_order_id: entryOrder.orderId });
    setExecutionPhase(state, "emergency_flatten_submitted", { entry_order_id: entryOrder.orderId });

    // DISABLED - human must flatten manually
    // const flattenResult = await emergencyFlatten(creds, accountId, contractId, signal.direction);

    if (flattenResult.ok) {
      setExecutionPhase(state, "emergency_flatten_confirmed", {
        entry_order_id: entryOrder.orderId,
        flatten_order_id: flattenResult.orderId,
        flatten_tag: flattenResult.tag
      });
      state.open_position = null;
      state.pending_signal = null;
      state.running = false;
      state.execution_blocked = true;
      saveState(state);
      log("execution-emergency-flatten-success", { flatten_order_id: flattenResult.orderId });
      notifyJarvis(
        `02B EMERGENCY FLATTEN EXECUTED\n` +
        `${signal.direction} ${ticker} position closed via market order\n` +
        `Entry: ${entryOrder.orderId} | Flatten: ${flattenResult.orderId}\n` +
        `System stopped. Verify flat in Tradovate.\n` +
        `Resume: POST /agent/autonomous/clear-critical { acknowledged:true, reason:"..." }`
      );
    } else {
      setExecutionPhase(state, "emergency_flatten_failed", {
        entry_order_id: entryOrder.orderId,
        flatten_error: flattenResult.error,
        flatten_tag: flattenResult.tag
      });
      state.open_position = {
        mode: "live", ticker, direction: signal.direction,
        entry: signal.entry, stop: signal.stop, target: signal.target,
        size: 1, entry_order_id: entryOrder.orderId, oco_order_id: null,
        account_id: accountId, contract_id: contractId, reason: signal.reason,
        execution_phase: "emergency_flatten_failed",
        protection_status: "missing",
        status: "open", opened: new Date().toISOString()
      };
      state.pending_signal = null;
      state.running = false;
      state.execution_blocked = true;
      state.critical_mismatch = true;
      saveState(state);
      log("execution-critical-mismatch", { entry_order_id: entryOrder.orderId, flatten_error: flattenResult.error });
      notifyJarvis(
        `!!! 02B CRITICAL FAILURE !!!\n` +
        `ENTRY FILLED. PROTECTION FAILED. FLATTEN FAILED.\n` +
        `${signal.direction} ${ticker} @ ${signal.entry} — UNPROTECTED POSITION\n` +
        `Entry order: ${entryOrder.orderId}\n` +
        `CHECK TRADOVATE NOW. MANUAL CLOSE REQUIRED.\n` +
        `critical_mismatch=true — system HARD BLOCKED until operator clears.`
      );
    }

    throw new Error("Live entry placed but all protection attempts failed — emergency flatten triggered");
  }

  const trade = {
    mode: "live",
    ticker,
    direction: signal.direction,
    entry: signal.entry,
    stop: signal.stop,
    target: signal.target,
    size: 1,
    entry_order_id: entryOrder.orderId,
    oco_order_id: ocoOrder.orderId,
    account_id: accountId,
    contract_id: contractId,
    reason: signal.reason,
    execution_phase: "protected",
    protection_status: "confirmed",
    status: "open",
    opened: new Date().toISOString()
  };

  state.open_position = trade;
  state.pending_signal = null;
  setExecutionPhase(state, "protected", {
    entry_order_id: entryOrder.orderId,
    oco_order_id: ocoOrder.orderId
  });
  log("autonomous-execute-live", trade);

  notifyJarvis(
    `02B LIVE ORDER PLACED\n` +
    `${trade.direction} ${trade.ticker} @ ${trade.entry}\n` +
    `Stop: ${trade.stop} | Target: ${trade.target}\n` +
    `Brackets set - you can step away\n` +
    `Entry order: ${entryOrder.orderId} | OCO: ${ocoOrder.orderId}`
  );

  return trade;
}

module.exports = {
  tokenCache,
  getTradovateToken,
  getContractId,
  executeLive,
};
