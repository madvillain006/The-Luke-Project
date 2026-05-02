const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { loadTradingState, saveTradingState } = require("../state/trading-store");
const { ROOT, events } = require("../lib/paths");

const client = new Anthropic();
const PAPER_TRADES_FILE = events.paperTrades;
const HISTORY_FILE = events.discordHistory;
const LOG_FILE = events.jarvisLog;

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

function getETTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getTradingWindowStatus() {
  const et = getETTime();
  const day = et.getDay();
  if (day === 0 || day === 6) return { ok: false, reason: "Weekend" };
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

function getPointValue(ticker) {
  if (ticker === "MES" || ticker === "ES") return 1;
  return 2;
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
  VALID_MODES,
};
