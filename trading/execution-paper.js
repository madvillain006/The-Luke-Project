const { getPointValue, loadState, saveState, log, logPaperTrade, notifyJarvis } = require("./common");
const { getFuturesPrice } = require("./signals");
const { getMarketContext } = require("./market-context");
const { validateStagedTrade } = require("./risk");

function executePaper(state, signal) {
  state.paper_trades = (state.paper_trades || 0) + 1;
  const trade = {
    mode: "paper",
    ticker: signal.ticker || "MNQ",
    direction: signal.direction,
    entry: signal.entry,
    stop: signal.stop,
    target: signal.target,
    size: 1,
    source: "ximes+bobby",
    reason: signal.reason,
    status: "open",
    opened: new Date().toISOString()
  };

  state.open_position = trade;
  state.pending_signal = null;
  saveState(state);
  logPaperTrade(trade);
  log("autonomous-execute-paper", trade);

  // Non-blocking gate check — never blocks paper, builds reject-reason dataset
  (async () => {
    try {
      const creds = state.tradovate;
      const marketCtx = await getMarketContext(creds, trade.ticker);
      const gateConfig = { max_risk_per_trade: Math.abs(state.daily_loss_limit || -100) };
      const gate = validateStagedTrade(signal, marketCtx, gateConfig);
      log(gate.ok ? "market-context-gate-passed" : "MARKET_CONTEXT_REJECT", {
        mode: "paper", ok: gate.ok, reasons: gate.reasons,
        price: marketCtx.price, spread_ticks: marketCtx.spread_ticks, stale: marketCtx.stale
      });
    } catch {}
  })();

  const toGo = Math.max(0, 25 - state.paper_trades);
  notifyJarvis(
    `02B PAPER TRADE #${state.paper_trades}\n` +
    `${trade.direction} ${trade.ticker} @ ${trade.entry}\n` +
    `Stop: ${trade.stop} | Target: ${trade.target}\n` +
    `${trade.reason}\n` +
    `${toGo > 0 ? toGo + " trades to live" : "PAPER TARGET REACHED - review performance before going live"}`
  );

  return trade;
}

async function monitorOpenPosition() {
  const state = loadState();
  if (!state.open_position || state.open_position.mode !== "paper") return;

  const pos = state.open_position;
  const pv = getPointValue(pos.ticker);
  const price = await getFuturesPrice(pos.ticker);
  if (!price) return;

  const apex = state.apex;
  if (apex && apex.enabled) {
    const unrealized = pos.direction === "LONG"
      ? (price - pos.entry) * pv
      : (pos.entry - price) * pv;
    const currentAccount = apex.account_start + (state.total_eval_pnl || 0) + unrealized;
    if (currentAccount <= apex.eod_threshold) {
      notifyJarvis(
        `APEX FLOOR BREACHED (UNREALIZED)\n` +
        `Account incl. open P&L: $${currentAccount.toFixed(0)} | Floor: $${apex.eod_threshold.toFixed(0)}\n` +
        `Force-closing position to protect eval`
      );
      const exitPrice = price;
      const pnl = pos.direction === "LONG" ? (exitPrice - pos.entry) * pv : (pos.entry - exitPrice) * pv;
      state.daily_pnl = (state.daily_pnl || 0) + pnl;
      state.weekly_pnl = (state.weekly_pnl || 0) + pnl;
      state.total_eval_pnl = (state.total_eval_pnl || 0) + pnl;
      state.running = false;
      state.kill_week = true;
      const closedTrade = { ...pos, exit_price: exitPrice, pnl, close_reason: "APEX FLOOR HIT", closed: new Date().toISOString(), status: "closed" };
      logPaperTrade(closedTrade);
      log("autonomous-apex-force-close", closedTrade);
      state.open_position = null;
      saveState(state);
      return;
    }
  }

  let closeReason = null;
  if (pos.direction === "LONG") {
    if (price <= pos.stop) closeReason = "STOP HIT";
    else if (price >= pos.target) closeReason = "TARGET HIT";
  } else {
    if (price >= pos.stop) closeReason = "STOP HIT";
    else if (price <= pos.target) closeReason = "TARGET HIT";
  }

  if (!closeReason) return;

  const exitPrice = closeReason === "STOP HIT" ? pos.stop : pos.target;
  const correctedPnl = pos.direction === "LONG"
    ? (exitPrice - pos.entry) * pv
    : (pos.entry - exitPrice) * pv;

  state.daily_pnl = (state.daily_pnl || 0) + correctedPnl;
  state.weekly_pnl = (state.weekly_pnl || 0) + correctedPnl;
  state.total_eval_pnl = (state.total_eval_pnl || 0) + correctedPnl;

  if (state.daily_pnl <= state.daily_loss_limit) {
    state.kill_day = true;
    state.running = false;
  }
  if (state.weekly_pnl <= state.weekly_loss_limit) {
    state.kill_week = true;
    state.running = false;
    const nextMonday = new Date();
    const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 30, 0, 0);
    state.kill_week_until = nextMonday.toISOString();
  }

  if (apex && apex.enabled) {
    const accountValue = apex.account_start + (state.total_eval_pnl || 0);
    if (accountValue <= apex.eod_threshold) {
      state.running = false;
      state.kill_week = true;
      notifyJarvis(`APEX EOD THRESHOLD BREACHED\nAccount: $${accountValue.toFixed(0)} | Floor: $${apex.eod_threshold.toFixed(0)}\n02B STOPPED - eval failed.`);
    } else if ((state.total_eval_pnl || 0) >= apex.profit_target) {
      state.running = false;
      notifyJarvis(`APEX EVAL PASSED\n$${state.total_eval_pnl.toFixed(0)} profit on 50k account\nPay the activation fee -> apextraderfunding.com`);
    }
  }

  const closedTrade = { ...pos, exit_price: exitPrice, pnl: correctedPnl, close_reason: closeReason, closed: new Date().toISOString(), status: "closed" };
  logPaperTrade(closedTrade);
  log("autonomous-position-closed", closedTrade);
  state.open_position = null;
  saveState(state);

  let msg = `02B POSITION CLOSED - ${closeReason}\n${pos.direction} ${pos.ticker}: ${correctedPnl >= 0 ? "+" : ""}$${correctedPnl.toFixed(0)}\nDaily P&L: ${state.daily_pnl >= 0 ? "+" : ""}$${state.daily_pnl.toFixed(0)}`;
  if (apex && apex.enabled) {
    msg += `\nEval P&L: $${(state.total_eval_pnl || 0).toFixed(0)} / $${apex.profit_target} target`;
    msg += ` (${(((state.total_eval_pnl || 0) / apex.profit_target) * 100).toFixed(0)}%)`;
    msg += `\nDrawdown floor: $${apex.eod_threshold.toFixed(0)} (updates at 5PM ET)`;
  }
  if (state.kill_day) msg += "\nDAILY LIMIT HIT - killed for today";
  if (state.kill_week) msg += "\nWEEKLY LIMIT HIT - killed until " + (state.kill_week_until || "Monday").slice(0, 10);
  notifyJarvis(msg);
}

module.exports = {
  executePaper,
  monitorOpenPosition,
};
