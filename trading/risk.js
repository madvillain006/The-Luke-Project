const { getPointValue, getTradingWindowStatus } = require("./common");

function getWeeklyKillUntil() {
  const nextMonday = new Date();
  const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 30, 0, 0);
  return nextMonday.toISOString();
}

function getPendingSignalPayload(state) {
  if (!state.pending_signal) return { pending: false };

  if (new Date() > new Date(state.pending_signal.expires_at)) {
    return { pending: false, expired: true };
  }

  const secondsLeft = Math.round((new Date(state.pending_signal.expires_at) - Date.now()) / 1000);
  const sig = state.pending_signal;
  const pv = getPointValue(sig.ticker || "MNQ");
  const riskPts = sig.direction === "LONG" ? sig.entry - sig.stop : sig.stop - sig.entry;
  const rewardPts = sig.direction === "LONG" ? sig.target - sig.entry : sig.entry - sig.target;
  const rr = riskPts > 0 ? (rewardPts / riskPts).toFixed(1) : "?";
  const riskDollars = (riskPts * pv).toFixed(0);

  return {
    pending: true,
    signal: sig,
    seconds_left: secondsLeft,
    rr,
    risk_dollars: riskDollars
  };
}

function buildStatusPayload(state) {
  const window = getTradingWindowStatus();
  const pending = state.pending_signal && new Date() < new Date(state.pending_signal.expires_at)
    ? { ...state.pending_signal, seconds_left: Math.round((new Date(state.pending_signal.expires_at) - Date.now()) / 1000) }
    : null;

  return {
    mode: state.mode,
    running: state.running,
    execution: state.execution || null,
    trading_window: window,
    kill_day: state.kill_day,
    kill_week: state.kill_week,
    kill_week_until: state.kill_week_until,
    daily_pnl: state.daily_pnl,
    weekly_pnl: state.weekly_pnl,
    daily_loss_limit: state.daily_loss_limit,
    weekly_loss_limit: state.weekly_loss_limit,
    paper_trades: state.paper_trades || 0,
    paper_trades_to_live: Math.max(0, 25 - (state.paper_trades || 0)),
    ready_for_live: (state.paper_trades || 0) >= 25,
    open_position: state.open_position,
    pending_signal: pending,
    tradovate_configured: !!(state.tradovate && state.tradovate.username && state.tradovate.cid),
    apex: state.apex ? {
      enabled: state.apex.enabled,
      profit_target: state.apex.profit_target,
      total_eval_pnl: state.total_eval_pnl || 0,
      pct_to_target: state.apex.profit_target ? (((state.total_eval_pnl || 0) / state.apex.profit_target) * 100).toFixed(1) + "%" : "0%",
      account_high_eod: state.apex.account_high_eod,
      eod_threshold: state.apex.eod_threshold,
      max_drawdown: state.apex.max_drawdown
    } : null
  };
}

function getApexConsistencyReason(state) {
  if (!(state.apex && state.apex.enabled && state.total_eval_pnl > 0)) return null;
  const maxToday = state.total_eval_pnl * state.apex.consistency_limit;
  if ((state.daily_pnl || 0) >= maxToday * 0.9) {
    return `Apex consistency cap - today at $${state.daily_pnl.toFixed(0)} approaching 50% limit ($${maxToday.toFixed(0)})`;
  }
  return null;
}

function getApexPreTradeFloorBlock(state, signal) {
  if (!(state.apex && state.apex.enabled)) return null;
  const pv = getPointValue(signal.ticker || "MNQ");
  const riskPts = signal.direction === "LONG" ? signal.entry - signal.stop : signal.stop - signal.entry;
  const maxLoss = riskPts * pv;
  const accountValue = state.apex.account_start + (state.total_eval_pnl || 0);
  const safetyBuffer = 200;
  if (accountValue - maxLoss < state.apex.eod_threshold + safetyBuffer) {
    return { accountValue, maxLoss, floor: state.apex.eod_threshold, buffer: safetyBuffer };
  }
  return null;
}

const MARKET_GATE_DEFAULTS = {
  drift_reject_ticks: 8,
  max_spread_ticks: 3,
  min_rr: 1.5
};

const FUTURES_TICK_SIZE = 0.25;

function validateStagedTrade(signal, marketCtx, config = {}) {
  const cfg = { ...MARKET_GATE_DEFAULTS, ...config };
  const reasons = [];

  if (!marketCtx || marketCtx.stale) {
    const detail = marketCtx && marketCtx.error ? ` (${marketCtx.error})` : "";
    reasons.push(`market_context_stale: cannot verify current price${detail}`);
    return { ok: false, reasons };
  }

  const { direction, entry, stop, target, ticker } = signal;
  const pv = getPointValue(ticker || "MNQ");

  if (marketCtx.price !== null) {
    const driftTicks = Math.abs(marketCtx.price - entry) / FUTURES_TICK_SIZE;
    if (driftTicks > cfg.drift_reject_ticks) {
      reasons.push(`price_drift: ${driftTicks.toFixed(1)} ticks from staged entry ${entry}, current ${marketCtx.price}`);
    }
  }

  if (marketCtx.spread_ticks !== null && marketCtx.spread_ticks > cfg.max_spread_ticks) {
    reasons.push(`spread_too_wide: ${marketCtx.spread_ticks} ticks (max ${cfg.max_spread_ticks})`);
  }

  if (cfg.max_risk_per_trade !== undefined && cfg.max_risk_per_trade > 0 && marketCtx.price !== null) {
    const riskPts = direction === "LONG" ? marketCtx.price - stop : stop - marketCtx.price;
    const effectiveRisk = riskPts * pv;
    if (effectiveRisk > cfg.max_risk_per_trade) {
      reasons.push(`effective_risk: $${effectiveRisk.toFixed(0)} exceeds max $${cfg.max_risk_per_trade}`);
    }
  }

  if (marketCtx.price !== null) {
    const driftedEntry = marketCtx.price;
    const rewardPts = direction === "LONG" ? target - driftedEntry : driftedEntry - target;
    const riskPts   = direction === "LONG" ? driftedEntry - stop   : stop - driftedEntry;
    if (riskPts > 0) {
      const rrAfterDrift = rewardPts / riskPts;
      if (rrAfterDrift < cfg.min_rr) {
        reasons.push(`rr_after_drift: ${rrAfterDrift.toFixed(2)} < min ${cfg.min_rr}`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

module.exports = {
  buildStatusPayload,
  getPendingSignalPayload,
  getWeeklyKillUntil,
  getApexConsistencyReason,
  getApexPreTradeFloorBlock,
  validateStagedTrade,
};
