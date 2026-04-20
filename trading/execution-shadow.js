const {
  log, loadState, saveState, logPaperTrade, notifyJarvis, getPointValue
} = require("./common");
const { reconcileState } = require("./broker-tradovate");
const { getMarketContext, TICK_SIZE } = require("./market-context");
const { validateStagedTrade } = require("./risk");
const { getFuturesPrice } = require("./signals");

const DEFAULT_MAX_SLIPPAGE_TICKS = 2;

function simulateFill(signal, marketCtx, maxSlip) {
  const base = signal.direction === "LONG"
    ? (marketCtx.ask !== null ? marketCtx.ask : marketCtx.price)
    : (marketCtx.bid !== null ? marketCtx.bid : marketCtx.price);
  if (base === null) return { fill_price: signal.entry, slippage_ticks: 0 };
  const slip = Math.floor(Math.random() * (maxSlip + 1));
  const dir = signal.direction === "LONG" ? 1 : -1;
  const fill_price = Math.round((base + slip * TICK_SIZE * dir) / TICK_SIZE) * TICK_SIZE;
  return { fill_price, slippage_ticks: slip };
}

function touchSession(state) {
  if (!state.shadow_session) {
    state.shadow_session = {
      started: new Date().toISOString(),
      signals_evaluated: 0,
      staged: 0,
      would_have_entered: 0,
      rejected: [],
      simulated_pnl: 0,
      trades: []
    };
  }
  return state.shadow_session;
}

async function executeShadow(state, signal) {
  const ticker = signal.ticker || "MNQ";
  const creds = state.tradovate;
  const pv = getPointValue(ticker);
  const sess = touchSession(state);
  sess.staged++;

  // Real reconciliation — informational only, does not hard-block shadow
  try {
    const rec = await reconcileState(state);
    log("shadow-reconcile", { ...rec, simulated: true });
    if (!rec.ok) {
      log("shadow-reconcile-would-block", { mismatches: rec.mismatches, simulated: true });
      sess.rejected.push({ reason: "reconcile_mismatch", mismatches: rec.mismatches, timestamp: new Date().toISOString() });
      state.pending_signal = null;
      saveState(state);
      notifyJarvis(`02B SHADOW: reconcile mismatch (live would have blocked)\n${(rec.mismatches || []).join("\n")}`);
      return { executed: false, reason: "reconcile_mismatch", simulated: true };
    }
  } catch (err) {
    log("shadow-reconcile-error", { error: err.message, simulated: true });
    sess.rejected.push({
      reason: "reconcile_error",
      reasons: [err.message],
      timestamp: new Date().toISOString()
    });
    state.pending_signal = null;
    saveState(state);
    notifyJarvis(`02B SHADOW: reconcile error\n${err.message}`);
    return { executed: false, reason: "reconcile_error", simulated: true, error: err.message };
  }

  // Real market context
  const marketCtx = await getMarketContext(creds, ticker);

  // Real risk/market gate
  const gateConfig = { max_risk_per_trade: Math.abs(state.daily_loss_limit || -100) };
  const gate = validateStagedTrade(signal, marketCtx, gateConfig);
  log(gate.ok ? "shadow-market-gate-passed" : "shadow-market-gate-rejected", {
    simulated: true, ok: gate.ok, reasons: gate.reasons,
    price: marketCtx.price, spread_ticks: marketCtx.spread_ticks, stale: marketCtx.stale
  });

  if (!gate.ok) {
    sess.rejected.push({ reason: "market_gate", reasons: gate.reasons, timestamp: new Date().toISOString() });
    state.pending_signal = null;
    saveState(state);
    notifyJarvis(`02B SHADOW: market gate rejected\n${gate.reasons.join("\n")}`);
    return { executed: false, reason: "market_gate_rejected", reasons: gate.reasons, simulated: true };
  }

  // Simulated fill with configurable slippage
  const maxSlip = (state.shadow_config && state.shadow_config.max_slippage_ticks != null)
    ? state.shadow_config.max_slippage_ticks : DEFAULT_MAX_SLIPPAGE_TICKS;
  const fill = simulateFill(signal, marketCtx, maxSlip);

  const riskPts = signal.direction === "LONG"
    ? fill.fill_price - signal.stop : signal.stop - fill.fill_price;
  const rewardPts = signal.direction === "LONG"
    ? signal.target - fill.fill_price : fill.fill_price - signal.target;

  const trade = {
    mode: "shadow", simulated: true, ticker,
    direction: signal.direction,
    entry: signal.entry, fill_price: fill.fill_price, slippage_ticks: fill.slippage_ticks,
    stop: signal.stop, target: signal.target, size: 1,
    risk_dollars: +(riskPts * pv).toFixed(2),
    target_pnl: +(rewardPts * pv).toFixed(2),
    market_price_at_fill: marketCtx.price,
    source: "ximes+bobby", reason: signal.reason,
    status: "shadow_open", opened: new Date().toISOString()
  };

  state.open_position = trade;
  state.pending_signal = null;
  sess.would_have_entered++;
  sess.trades.push({
    fill_price: fill.fill_price, slippage_ticks: fill.slippage_ticks,
    risk_dollars: trade.risk_dollars, timestamp: trade.opened
  });
  saveState(state);

  logPaperTrade(trade);
  log("shadow-execute", trade);

  notifyJarvis(
    `02B SHADOW TRADE (SIMULATED — NO ORDER SENT)\n` +
    `${trade.direction} ${trade.ticker} @ ${fill.fill_price} (${fill.slippage_ticks}t slip)\n` +
    `Stop: ${signal.stop} | Target: ${signal.target}\n` +
    `Risk: $${trade.risk_dollars} | Target P&L: $${trade.target_pnl}\n` +
    `${signal.reason}`
  );

  return trade;
}

async function monitorShadowPosition() {
  const state = loadState();
  if (!state.open_position || state.open_position.mode !== "shadow") return;

  const pos = state.open_position;
  const pv = getPointValue(pos.ticker);
  const price = await getFuturesPrice(pos.ticker);
  if (!price) return;

  let closeReason = null;
  if (pos.direction === "LONG") {
    if (price <= pos.stop)        closeReason = "STOP HIT";
    else if (price >= pos.target) closeReason = "TARGET HIT";
  } else {
    if (price >= pos.stop)        closeReason = "STOP HIT";
    else if (price <= pos.target) closeReason = "TARGET HIT";
  }
  if (!closeReason) return;

  const exitPrice = closeReason === "STOP HIT" ? pos.stop : pos.target;
  const fillBase = pos.fill_price != null ? pos.fill_price : pos.entry;
  const pnl = pos.direction === "LONG"
    ? (exitPrice - fillBase) * pv
    : (fillBase - exitPrice) * pv;

  const closedTrade = {
    ...pos, exit_price: exitPrice,
    pnl: +pnl.toFixed(2), close_reason: closeReason,
    closed: new Date().toISOString(), status: "shadow_closed"
  };
  logPaperTrade(closedTrade);
  log("shadow-position-closed", closedTrade);

  const sess = touchSession(state);
  sess.simulated_pnl = +((sess.simulated_pnl || 0) + pnl).toFixed(2);
  state.open_position = null;
  saveState(state);

  notifyJarvis(
    `02B SHADOW CLOSE — ${closeReason}\n` +
    `${pos.direction} ${pos.ticker}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)} (simulated)\n` +
    `Session P&L: $${sess.simulated_pnl.toFixed(0)} | Entries: ${sess.would_have_entered}`
  );
}

function getShadowSummary(state) {
  const s = state.shadow_session;
  if (!s) return { active: false, message: "No shadow session — POST /shadow/reset to start one" };

  const byReason = {};
  for (const r of (s.rejected || [])) {
    if (Array.isArray(r.reasons) && r.reasons.length > 0) {
      for (const reason of r.reasons) {
        const bucket = String(reason).split(":")[0];
        byReason[bucket] = (byReason[bucket] || 0) + 1;
      }
      continue;
    }
    byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  }
  return {
    active: state.mode === "shadow" && !!state.running,
    started: s.started,
    signals_evaluated: s.signals_evaluated,
    staged: s.staged,
    would_have_entered: s.would_have_entered,
    rejected_count: (s.rejected || []).length,
    rejected_by_reason: byReason,
    simulated_pnl: s.simulated_pnl || 0,
    open_position: (state.open_position && state.open_position.mode === "shadow")
      ? state.open_position : null,
    trades: s.trades || []
  };
}

module.exports = { executeShadow, monitorShadowPosition, getShadowSummary };
