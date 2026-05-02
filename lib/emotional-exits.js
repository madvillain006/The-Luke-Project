const fs = require("fs");
const { events } = require("./paths");

const TRADES_FILE = events.trades;
const CAPITAL = 500;

function getETHour() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === "hour").value);
  const m = parseInt(parts.find(p => p.type === "minute").value);
  return h + m / 60;
}

function isTradeToday(t, today) {
  return (t.date && t.date.startsWith(today)) || (t.timestamp && t.timestamp.startsWith(today));
}

function isWin(t) {
  if (typeof t.result === "string") return t.result === "WIN";
  return typeof t.result === "number" && t.result > 0;
}

function isLoss(t) {
  if (typeof t.result === "string") return t.result === "LOSS";
  return typeof t.result === "number" && t.result < 0;
}

function isClosed(t) {
  if (typeof t.result === "string") return t.result === "WIN" || t.result === "LOSS" || t.result === "SCRATCH";
  return typeof t.result === "number";
}

function loadTodayContext() {
  const today = new Date().toISOString().slice(0, 10);
  let trades = [];
  try {
    const lines = fs.readFileSync(TRADES_FILE, "utf8").split("\n").filter(Boolean);
    trades = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(t => t && isTradeToday(t, today));
  } catch {}

  const closed = trades.filter(isClosed);
  const losses_today = closed.filter(isLoss).length;
  const wins_today = closed.filter(isWin).length;

  const lastClosed = closed[closed.length - 1];
  const last_trade_result = lastClosed
    ? (isWin(lastClosed) ? "WIN" : isLoss(lastClosed) ? "LOSS" : "SCRATCH")
    : null;

  const tsKey = lastClosed ? (lastClosed.timestamp || lastClosed.date) : null;
  const time_since_last_trade_mins = tsKey
    ? (Date.now() - new Date(tsKey).getTime()) / 60000
    : Infinity;

  const netPnl = closed.reduce((s, t) => {
    const pts = typeof t.pnl === "number" ? t.pnl : (typeof t.result === "number" ? t.result : 0);
    return s + pts;
  }, 0);
  const current_drawdown_pct = netPnl < 0 ? (Math.abs(netPnl) / CAPITAL) * 100 : 0;

  return { losses_today, wins_today, last_trade_result, time_since_last_trade_mins, current_drawdown_pct };
}

function checkEmotionalState(tradeContext) {
  const {
    losses_today,
    wins_today,
    last_trade_result,
    time_since_last_trade_mins,
    current_drawdown_pct
  } = tradeContext;

  // HARD BLOCKS — return immediately, single element array
  if (losses_today >= 2) {
    return [{ type: "HARD", emoji: "❌", message: "2 loss limit hit. Done for today." }];
  }
  if (current_drawdown_pct >= 2) {
    return [{ type: "HARD", emoji: "❌", message: "Daily drawdown limit. Done for today." }];
  }
  if (time_since_last_trade_mins < 5) {
    return [{ type: "HARD", emoji: "❌", message: "Too soon after last trade. Wait." }];
  }
  if (time_since_last_trade_mins < 15 && last_trade_result === "LOSS") {
    return [{ type: "HARD", emoji: "❌", message: "Cooling off after loss. Wait 15 mins." }];
  }

  // SOFT WARNINGS
  const warnings = [];

  if (losses_today === 1) {
    warnings.push({ type: "SOFT", emoji: "⚠️", message: "1 loss today. Final trade of day if this loses." });
  }
  if (wins_today >= 2) {
    warnings.push({ type: "SOFT", emoji: "⚠️", message: "Already up today. Size down or walk away." });
  }

  const etHour = getETHour();
  if (etHour > 15.5) {
    warnings.push({ type: "SOFT", emoji: "⚠️", message: "Last 30 mins. High risk. Skip unless A+ setup." });
  } else if (etHour > 14 && wins_today === 0) {
    warnings.push({ type: "SOFT", emoji: "⚠️", message: "Afternoon, no wins yet. Stick to A+ only." });
  }

  return warnings;
}

module.exports = { checkEmotionalState, loadTodayContext };
