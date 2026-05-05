const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { loadTradingState, saveTradingState } = require("../state/trading-store");
const { ROOT, events } = require("../lib/paths");
const { isFuturesMarketOpen } = require("../lib/market-hours");

const client = new Anthropic();
const PAPER_TRADES_FILE = events.paperTrades;
const HISTORY_FILE = events.discordHistory;
const LOG_FILE = events.lukeLog;

function loadState() {
  return loadTradingState();
}

function saveState(state) {
  return saveTradingState(state);
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function logPaperTrade(trade) {
  fs.appendFileSync(PAPER_TRADES_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...trade }) + "\n");
}

function notifyLuke(message) {
  return fetch("http://localhost:3000/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).catch(() => {});
}

function getETTime(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getTradingWindowStatus(now = new Date()) {
  const et = getETTime(now);
  const day = et.getDay();
  if (day === 0 || day === 6) {
    const futures = isFuturesMarketOpen(now);
    if (futures.open) {
      return {
        ok: false,
        reason: "Futures overnight open - outside approved cash trading window",
        futures_open: true,
        session: futures.session,
      };
    }
    return { ok: false, reason: "Weekend", futures_open: false };
  }
  const h = et.getHours();
  const m = et.getMinutes();
  const t = h * 100 + m;
  if (t < 930 || t > 1600) return { ok: false, reason: "Outside market hours" };
  if (t < 945) return { ok: false, reason: "First 15 min of session (no trade zone)" };
  if (t > 1530) return { ok: false, reason: "Last 30 min of session (no trade zone)" };
  return { ok: true };
}

function getFrontMonthSymbol(ticker) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear() % 100;
  let code;
  if (month <= 3) code = "H";
  else if (month <= 6) code = "M";
  else if (month <= 9) code = "U";
  else code = "Z";
  return ticker + code + year;
}

const STAGED_EXECUTION_UNLOCK_ENV = "LUKE_ENABLE_STAGED_EXECUTION";
const STAGED_EXECUTION_UNLOCK_VALUE = "YES_I_ACCEPT_STAGED_EXECUTION_RISK";
const LIVE_EXECUTION_UNLOCK_ENV = "LUKE_ENABLE_LIVE_EXECUTION";
const LIVE_EXECUTION_UNLOCK_VALUE = "YES_I_ACCEPT_LIVE_BROKER_RISK";

function getPointValue(ticker) {
  switch (String(ticker || "").toUpperCase()) {
    case "ES": return 50;
    case "MES": return 5;
    case "NQ": return 20;
    case "MNQ": return 2;
    default: return 2;
  }
}

function getStagedExecutionGate(env = process.env) {
  const enabled = env[STAGED_EXECUTION_UNLOCK_ENV] === STAGED_EXECUTION_UNLOCK_VALUE;
  return {
    enabled,
    env_var: STAGED_EXECUTION_UNLOCK_ENV,
    required_value: STAGED_EXECUTION_UNLOCK_VALUE,
    reason: enabled
      ? null
      : "Staged execution is disabled by default. Luke is read-only/replay until an explicit operator proof phase unlocks staged execution.",
  };
}

function getLiveExecutionGate(env = process.env) {
  const staged = getStagedExecutionGate(env);
  if (!staged.enabled) {
    return {
      enabled: false,
      env_var: staged.env_var,
      required_value: staged.required_value,
      reason: staged.reason,
    };
  }
  const enabled = env[LIVE_EXECUTION_UNLOCK_ENV] === LIVE_EXECUTION_UNLOCK_VALUE;
  return {
    enabled,
    env_var: LIVE_EXECUTION_UNLOCK_ENV,
    required_value: LIVE_EXECUTION_UNLOCK_VALUE,
    reason: enabled
      ? null
      : "Live execution is disabled by default. Broker submission requires a separate explicit operator proof phase.",
  };
}

const VALID_MODES = ["paper", "live", "shadow"];

module.exports = {
  ROOT,
  PAPER_TRADES_FILE,
  HISTORY_FILE,
  LOG_FILE,
  client,
  loadState,
  saveState,
  log,
  logPaperTrade,
  notifyLuke,
  getETTime,
  getTradingWindowStatus,
  getFrontMonthSymbol,
  getPointValue,
  getStagedExecutionGate,
  getLiveExecutionGate,
  VALID_MODES,
};
