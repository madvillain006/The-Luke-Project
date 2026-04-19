const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();

const STATE_FILE = path.join(__dirname, "../autonomous-state.json");
const PAPER_TRADES_FILE = path.join(__dirname, "../paper-trades.jsonl");
const HISTORY_FILE = path.join(__dirname, "../discord-history.jsonl");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");
const FINNHUB_KEY = "d7ibl19r01qu8vfo2410d7ibl19r01qu8vfo241g";

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      mode: "paper",
      running: false,
      kill_day: false,
      kill_week: false,
      kill_week_until: null,
      daily_pnl: 0,
      weekly_pnl: 0,
      total_eval_pnl: 0,
      daily_loss_limit: -100,
      weekly_loss_limit: -300,
      apex: {
        enabled: false,
        account_start: 50000,
        profit_target: 3000,
        max_drawdown: 2000,
        daily_loss_limit: 1000,
        consistency_limit: 0.50,
        account_high_eod: 50000,   // highest EOD closing balance ever achieved
        eod_threshold: 48000,      // current enforced floor (account_high_eod - max_drawdown)
        last_eod_update: null,
        contracts: 1
      },
      paper_trades: 0,
      open_position: null,
      pending_signal: null,        // staged trade waiting for manual confirm
      tradovate: { username: null, password: null, deviceId: null, cid: null, sec: null, env: "demo" }
    };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function logPaperTrade(trade) {
  fs.appendFileSync(PAPER_TRADES_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...trade }) + "\n");
}

function notifyJarvis(message) {
  return fetch("http://localhost:3000/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).catch(() => {});
}

// --- TIMING ---

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

// --- FUTURES CONTRACT SYMBOL ---

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

// --- PRICE DATA (Finnhub primary, Yahoo Finance fallback) ---

async function getPrice(finnhubSymbol, yahooSymbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (d.c && d.c > 0) return d.c;
  } catch {}
  if (yahooSymbol) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000)
      });
      const d = await r.json();
      const price = d.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) return price;
    } catch {}
  }
  return null;
}

function getFuturesPrice(ticker) {
  if (ticker === "MNQ" || ticker === "NQ") return getPrice("NQ1!", "NQ=F");
  if (ticker === "MES" || ticker === "ES") return getPrice("ES1!", "ES=F");
  return getPrice(ticker, null);
}

function getPointValue(ticker) {
  if (ticker === "MES" || ticker === "ES") return 1;
  return 2; // MNQ default
}

// --- SIGNAL SCORING ENGINE ---

function loadRecentSignals(minutesBack = 120) {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return { ximes: [], bobby: [] };
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const cutoff = Date.now() - minutesBack * 60 * 1000;
    const ximes = [];
    const bobby = [];

    for (const line of lines.slice(-200)) {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.date).getTime() < cutoff) continue;
        if (entry.source !== "intraday-scraper") continue;

        const signals = (entry.results || [])
          .filter(r => r.insights && !r.insights.includes("NO_ACTIONABLE_SIGNALS"))
          .map(r => r.insights);

        if (entry.channel === "ximes-dubz" && signals.length > 0) ximes.push(...signals);
        if (entry.channel === "bobby-spx-coms" && signals.length > 0) bobby.push(...signals);
      } catch {}
    }
    return { ximes, bobby };
  } catch { return { ximes: [], bobby: [] }; }
}

async function scoreSignals(ximes, bobby) {
  if (ximes.length === 0) return { execute: false, reason: "No ximes signals in last 2 hours" };
  if (bobby.length === 0) return { execute: false, reason: "No bobby signals — single source not enough" };

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are the signal scoring engine for an autonomous futures trading system.

RULE: Only execute if BOTH ximes AND bobby confirm the SAME direction at an aligned price level. Single source = NO EXECUTE. Bobby must show a heatmap node or structural level near ximes' call.

XIMES SIGNALS (last 2 hours):
${ximes.join("\n---\n")}

BOBBY SIGNALS (last 2 hours):
${bobby.join("\n---\n")}

Respond with JSON only, no other text:
{"execute":true/false,"ticker":"MNQ","direction":"LONG","entry":0,"stop":0,"target":0,"reason":"one sentence"}`
      }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { execute: false, reason: "Signal parse failed" };
    const result = JSON.parse(jsonMatch[0]);
    if (!result.execute) return result;
    if (!result.entry || !result.stop || !result.target) return { execute: false, reason: "Signal missing entry/stop/target" };
    if (result.direction === "LONG" && result.stop >= result.entry) return { execute: false, reason: "Invalid: stop above entry for LONG" };
    if (result.direction === "SHORT" && result.stop <= result.entry) return { execute: false, reason: "Invalid: stop below entry for SHORT" };
    return result;
  } catch (err) {
    return { execute: false, reason: "Scoring error: " + err.message };
  }
}

// --- PAPER EXECUTION ---

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

  const toGo = Math.max(0, 25 - state.paper_trades);
  notifyJarvis(
    `02B PAPER TRADE #${state.paper_trades}\n` +
    `${trade.direction} ${trade.ticker} @ ${trade.entry}\n` +
    `Stop: ${trade.stop} | Target: ${trade.target}\n` +
    `${trade.reason}\n` +
    `${toGo > 0 ? toGo + " trades to live" : "PAPER TARGET REACHED — review performance before going live"}`
  );

  return trade;
}

// --- STAGE TRADE FOR MANUAL CONFIRM (live mode) ---

async function stageTrade(state, signal) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  state.pending_signal = { ...signal, staged_at: new Date().toISOString(), expires_at: expiresAt };
  saveState(state);
  log("autonomous-staged", signal);

  const pv = getPointValue(signal.ticker || "MNQ");
  const riskPts = signal.direction === "LONG" ? signal.entry - signal.stop : signal.stop - signal.entry;
  const rewardPts = signal.direction === "LONG" ? signal.target - signal.entry : signal.entry - signal.target;
  const rr = riskPts > 0 ? (rewardPts / riskPts).toFixed(1) : "?";
  const riskDollars = (riskPts * pv).toFixed(0);

  notifyJarvis(
    `⚡ 02B SIGNAL — TAP TO EXECUTE\n` +
    `${signal.direction} ${signal.ticker || "MNQ"}\n` +
    `Entry: ${signal.entry} | Stop: ${signal.stop} | Target: ${signal.target}\n` +
    `Risk: $${riskDollars} | R:R ${rr}:1\n` +
    `${signal.reason}\n` +
    `Expires in 5 min — confirm in Jarvis`
  );

  if (global.broadcast) {
    global.broadcast({
      type: "staged_trade",
      pending: true,
      signal: state.pending_signal,
      seconds_left: 300,
      rr,
      risk_dollars: riskDollars
    });
  }
}

// --- TRADOVATE EXECUTION ---

const tokenCache = { token: null, expires: 0 };

async function getTradovateToken(creds) {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;

  const r = await fetch(`https://${creds.env}.tradovateapi.com/v1/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: creds.username,
      password: creds.password,
      appId: "Jarvis",
      appVersion: "1.0",
      deviceId: creds.deviceId || "jarvis-device-01",
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

async function getContractId(token, baseUrl, ticker) {
  const r = await fetch(`${baseUrl}/contract/find?name=${ticker}`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const contracts = await r.json();
  if (!contracts || !contracts.id) throw new Error("Contract not found for " + ticker);
  return contracts.id;
}

async function executeLive(state, signal) {
  const creds = state.tradovate;
  if (!creds.username || !creds.cid || !creds.sec) throw new Error("Tradovate credentials not configured");

  const token = await getTradovateToken(creds);
  const baseUrl = `https://${creds.env}.tradovateapi.com/v1`;

  const accountsR = await fetch(`${baseUrl}/account/list`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const accounts = await accountsR.json();
  if (!Array.isArray(accounts) || !accounts.length) throw new Error("No Tradovate accounts found");
  const accountId = accounts[0].id;

  const ticker = signal.ticker || "MNQ";
  const contractId = await getContractId(token, baseUrl, getFrontMonthSymbol(ticker));

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

  await sleep(1000);
  const exitAction = signal.direction === "LONG" ? "Sell" : "Buy";
  const ocoR = await fetch(`${baseUrl}/order/placeOSO`, {
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
  const ocoOrder = await ocoR.json();

  const trade = {
    mode: "live",
    ticker,
    direction: signal.direction,
    entry: signal.entry,
    stop: signal.stop,
    target: signal.target,
    size: 1,
    entry_order_id: entryOrder.orderId,
    oco_order_id: ocoOrder.orderId || null,
    account_id: accountId,
    contract_id: contractId,
    reason: signal.reason,
    status: "open",
    opened: new Date().toISOString()
  };

  state.open_position = trade;
  state.pending_signal = null;
  saveState(state);
  log("autonomous-execute-live", trade);

  notifyJarvis(
    `✅ 02B LIVE ORDER PLACED\n` +
    `${trade.direction} ${trade.ticker} @ ${trade.entry}\n` +
    `Stop: ${trade.stop} | Target: ${trade.target}\n` +
    `Brackets set — you can step away\n` +
    `Entry order: ${entryOrder.orderId} | OCO: ${ocoOrder.orderId || "pending"}`
  );

  return trade;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- POSITION MONITORING (paper mode — simulates price checks) ---

async function monitorOpenPosition() {
  const state = loadState();
  if (!state.open_position || state.open_position.mode !== "paper") return;

  const pos = state.open_position;
  const pv = getPointValue(pos.ticker);
  const price = await getFuturesPrice(pos.ticker);
  if (!price) return;

  // Check unrealized P&L against Apex floor while position is open
  const apex = state.apex;
  if (apex && apex.enabled) {
    const unrealized = pos.direction === "LONG"
      ? (price - pos.entry) * pv
      : (pos.entry - price) * pv;
    const currentAccount = apex.account_start + (state.total_eval_pnl || 0) + unrealized;
    if (currentAccount <= apex.eod_threshold) {
      // Force close — floor would be breached
      notifyJarvis(
        `🚨 APEX FLOOR BREACHED (UNREALIZED)\n` +
        `Account incl. open P&L: $${currentAccount.toFixed(0)} | Floor: $${apex.eod_threshold.toFixed(0)}\n` +
        `Force-closing position to protect eval`
      );
      const exitPrice = price;
      const pnl = pos.direction === "LONG"
        ? (exitPrice - pos.entry) * pv
        : (pos.entry - exitPrice) * pv;
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
  const pnl = pos.direction === "LONG"
    ? (exitPrice - pos.entry) * pv
    : (pos.entry - exitPrice) * pv;

  state.daily_pnl = (state.daily_pnl || 0) + pnl;
  state.weekly_pnl = (state.weekly_pnl || 0) + pnl;
  state.total_eval_pnl = (state.total_eval_pnl || 0) + pnl;

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

  // Apex EOD floor check on close
  if (apex && apex.enabled) {
    const accountValue = apex.account_start + (state.total_eval_pnl || 0);
    if (accountValue <= apex.eod_threshold) {
      state.running = false;
      state.kill_week = true;
      notifyJarvis(`🚨 APEX EOD THRESHOLD BREACHED\nAccount: $${accountValue.toFixed(0)} | Floor: $${apex.eod_threshold.toFixed(0)}\n02B STOPPED — eval failed.`);
    } else if ((state.total_eval_pnl || 0) >= apex.profit_target) {
      state.running = false;
      notifyJarvis(`✅ APEX EVAL PASSED\n$${state.total_eval_pnl.toFixed(0)} profit on 50k account\nPay the activation fee → apextraderfunding.com`);
    }
  }

  const closedTrade = { ...pos, exit_price: exitPrice, pnl, close_reason: closeReason, closed: new Date().toISOString(), status: "closed" };
  logPaperTrade(closedTrade);
  log("autonomous-position-closed", closedTrade);
  state.open_position = null;
  saveState(state);

  let msg = `02B POSITION CLOSED — ${closeReason}\n${pos.direction} ${pos.ticker}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}\nDaily P&L: ${state.daily_pnl >= 0 ? "+" : ""}$${state.daily_pnl.toFixed(0)}`;
  if (apex && apex.enabled) {
    msg += `\nEval P&L: $${(state.total_eval_pnl || 0).toFixed(0)} / $${apex.profit_target} target`;
    msg += ` (${(((state.total_eval_pnl || 0) / apex.profit_target) * 100).toFixed(0)}%)`;
    msg += `\nDrawdown floor: $${apex.eod_threshold.toFixed(0)} (updates at 5PM ET)`;
  }
  if (state.kill_day) msg += "\n⚠ DAILY LIMIT HIT — killed for today";
  if (state.kill_week) msg += "\n🚨 WEEKLY LIMIT HIT — killed until " + (state.kill_week_until || "Monday").slice(0, 10);
  notifyJarvis(msg);
}

// --- ROUTES ---

router.get("/status", (req, res) => {
  const state = loadState();
  const window = getTradingWindowStatus();
  const pending = state.pending_signal && new Date() < new Date(state.pending_signal.expires_at)
    ? { ...state.pending_signal, seconds_left: Math.round((new Date(state.pending_signal.expires_at) - Date.now()) / 1000) }
    : null;
  res.json({
    mode: state.mode,
    running: state.running,
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
  });
});

router.post("/start", (req, res) => {
  const state = loadState();

  if (state.kill_week) {
    if (state.kill_week_until && new Date() < new Date(state.kill_week_until)) {
      return res.json({ started: false, reason: "Weekly kill active until " + state.kill_week_until.slice(0, 10) });
    }
    state.kill_week = false;
    state.kill_week_until = null;
    state.weekly_pnl = 0;
  }

  state.running = true;
  saveState(state);
  log("autonomous-start", { mode: state.mode });
  res.json({ started: true, mode: state.mode, message: `02B running in ${state.mode.toUpperCase()} mode` });
});

router.post("/stop", (req, res) => {
  const state = loadState();
  state.running = false;
  saveState(state);
  log("autonomous-stop", {});
  res.json({ stopped: true });
});

router.post("/kill", (req, res) => {
  const state = loadState();
  state.running = false;
  state.kill_day = true;
  state.pending_signal = null;
  saveState(state);
  log("autonomous-kill-day", { manual: true });
  notifyJarvis("02B KILL SWITCH ACTIVATED — system stopped for today");
  res.json({ killed: true, reason: "Manual daily kill" });
});

router.post("/kill-week", (req, res) => {
  const state = loadState();
  state.running = false;
  state.kill_week = true;
  state.pending_signal = null;
  const nextMonday = new Date();
  const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 30, 0, 0);
  state.kill_week_until = nextMonday.toISOString();
  saveState(state);
  log("autonomous-kill-week", { manual: true, until: state.kill_week_until });
  notifyJarvis("02B WEEKLY KILL SWITCH — stopped until " + state.kill_week_until.slice(0, 10));
  res.json({ killed: true, until: state.kill_week_until });
});

router.post("/reset-kill", (req, res) => {
  const state = loadState();
  state.kill_day = false;
  state.kill_week = false;
  state.kill_week_until = null;
  state.daily_pnl = 0;
  saveState(state);
  log("autonomous-reset-kill", {});
  res.json({ reset: true });
});

router.post("/set-mode", (req, res) => {
  const { mode, tradovate, daily_loss_limit, weekly_loss_limit, apex } = req.body;
  if (mode && !["paper", "live"].includes(mode)) return res.status(400).json({ error: "mode must be paper or live" });
  if (mode === "live") {
    const state = loadState();
    const creds = tradovate || state.tradovate;
    if (!creds || !creds.username || !creds.cid || !creds.sec) {
      return res.status(400).json({ error: "live mode requires tradovate: {username, password, deviceId, cid, sec, env}" });
    }
  }
  const state = loadState();
  if (mode) state.mode = mode;
  if (tradovate) state.tradovate = { ...state.tradovate, ...tradovate };
  if (daily_loss_limit !== undefined) state.daily_loss_limit = daily_loss_limit;
  if (weekly_loss_limit !== undefined) state.weekly_loss_limit = weekly_loss_limit;
  if (apex) state.apex = { ...state.apex, ...apex };
  saveState(state);
  log("autonomous-set-mode", { mode: state.mode, apex_enabled: state.apex?.enabled });
  res.json({ mode: state.mode, apex: state.apex, daily_loss_limit: state.daily_loss_limit });
});

// Check for pending signal — called by chat.html every 15 seconds
router.get("/pending", (req, res) => {
  const state = loadState();
  if (!state.pending_signal) return res.json({ pending: false });

  if (new Date() > new Date(state.pending_signal.expires_at)) {
    state.pending_signal = null;
    saveState(state);
    return res.json({ pending: false, reason: "expired" });
  }

  const secondsLeft = Math.round((new Date(state.pending_signal.expires_at) - Date.now()) / 1000);
  const sig = state.pending_signal;
  const pv = getPointValue(sig.ticker || "MNQ");
  const riskPts = sig.direction === "LONG" ? sig.entry - sig.stop : sig.stop - sig.entry;
  const rewardPts = sig.direction === "LONG" ? sig.target - sig.entry : sig.entry - sig.target;
  const rr = riskPts > 0 ? (rewardPts / riskPts).toFixed(1) : "?";
  const riskDollars = (riskPts * pv).toFixed(0);

  res.json({
    pending: true,
    signal: sig,
    seconds_left: secondsLeft,
    rr,
    risk_dollars: riskDollars
  });
});

// Manual confirm — execute the staged trade
router.post("/execute-staged", async (req, res) => {
  const state = loadState();

  if (!state.pending_signal) return res.json({ executed: false, reason: "No pending signal" });
  if (new Date() > new Date(state.pending_signal.expires_at)) {
    state.pending_signal = null;
    saveState(state);
    return res.json({ executed: false, reason: "Signal expired" });
  }

  if (state.kill_day) { state.pending_signal = null; saveState(state); return res.json({ executed: false, reason: "Daily kill active" }); }
  if (state.kill_week) { state.pending_signal = null; saveState(state); return res.json({ executed: false, reason: "Weekly kill active" }); }
  if (state.open_position) { state.pending_signal = null; saveState(state); return res.json({ executed: false, reason: "Position already open" }); }
  if (!state.running) { state.pending_signal = null; saveState(state); return res.json({ executed: false, reason: "02B not running" }); }

  const signal = state.pending_signal;
  res.json({ executing: true, signal });

  try {
    if (state.mode === "paper") {
      executePaper(state, signal);
    } else {
      const freshState = loadState();
      freshState.pending_signal = null;
      await executeLive(freshState, signal);
    }
  } catch (err) {
    log("execute-staged-error", { error: err.message });
    notifyJarvis("❌ 02B EXECUTE FAILED: " + err.message);
    const s = loadState();
    s.pending_signal = null;
    saveState(s);
  }
});

// Skip the staged trade
router.post("/skip-staged", (req, res) => {
  const state = loadState();
  state.pending_signal = null;
  saveState(state);
  log("autonomous-skip-staged", {});
  res.json({ skipped: true });
});

// Called by intraday-scraper after each signal cycle
router.post("/evaluate", async (req, res) => {
  const state = loadState();

  if (!state.running) return res.json({ action: "skip", reason: "02B not running" });
  if (state.kill_day) return res.json({ action: "skip", reason: "Daily kill active" });
  if (state.kill_week) return res.json({ action: "skip", reason: "Weekly kill active" });
  if (state.open_position) return res.json({ action: "skip", reason: "Position already open" });
  if (state.pending_signal && new Date() < new Date(state.pending_signal.expires_at)) {
    return res.json({ action: "skip", reason: "Pending signal awaiting confirmation" });
  }

  const window = getTradingWindowStatus();
  if (!window.ok) return res.json({ action: "skip", reason: window.reason });

  // Apex consistency check
  if (state.apex && state.apex.enabled && state.total_eval_pnl > 0) {
    const maxToday = state.total_eval_pnl * state.apex.consistency_limit;
    if ((state.daily_pnl || 0) >= maxToday * 0.9) {
      return res.json({ action: "skip", reason: `Apex consistency cap — today at $${state.daily_pnl.toFixed(0)} approaching 50% limit ($${maxToday.toFixed(0)})` });
    }
  }

  res.json({ action: "evaluating" });

  try {
    const { ximes, bobby } = loadRecentSignals(120);
    log("autonomous-evaluate", { ximes_count: ximes.length, bobby_count: bobby.length });

    const signal = await scoreSignals(ximes, bobby);
    log("autonomous-score", { execute: signal.execute, reason: signal.reason });

    if (!signal.execute) return;

    const freshState = loadState();
    if (!freshState.running || freshState.kill_day || freshState.kill_week || freshState.open_position) return;

    // Apex pre-trade floor check — make sure max loss can't breach the drawdown floor
    if (freshState.apex && freshState.apex.enabled) {
      const pv = getPointValue(signal.ticker || "MNQ");
      const riskPts = signal.direction === "LONG" ? signal.entry - signal.stop : signal.stop - signal.entry;
      const maxLoss = riskPts * pv;
      const accountValue = freshState.apex.account_start + (freshState.total_eval_pnl || 0);
      const safetyBuffer = 200;
      if (accountValue - maxLoss < freshState.apex.eod_threshold + safetyBuffer) {
        log("autonomous-apex-floor-block", { accountValue, maxLoss, floor: freshState.apex.eod_threshold, buffer: safetyBuffer });
        notifyJarvis(`⚠ 02B SKIPPED — too close to Apex floor\nMax loss $${maxLoss.toFixed(0)} would breach floor $${freshState.apex.eod_threshold.toFixed(0)} + $${safetyBuffer} buffer`);
        return;
      }
    }

    if (freshState.mode === "paper") {
      executePaper(freshState, signal);
    } else {
      await stageTrade(freshState, signal);
    }
  } catch (err) {
    log("autonomous-evaluate-error", { error: err.message });
  }
});

// Called by intraday-scraper to check if open paper position hit stop/target
router.post("/monitor", async (req, res) => {
  res.json({ monitoring: true });
  try { await monitorOpenPosition(); } catch (err) {
    log("autonomous-monitor-error", { error: err.message });
  }
});

// Called by scheduler at 5PM ET to update Apex EOD trailing threshold
router.post("/eod-update", (req, res) => {
  const state = loadState();
  if (!state.apex || !state.apex.enabled) return res.json({ skipped: true, reason: "Apex not enabled" });

  const closingBalance = state.apex.account_start + (state.total_eval_pnl || 0);
  const previousHigh = state.apex.account_high_eod;
  const previousThreshold = state.apex.eod_threshold;

  state.apex.last_eod_update = new Date().toISOString();

  if (closingBalance > state.apex.account_high_eod) {
    state.apex.account_high_eod = closingBalance;
    state.apex.eod_threshold = closingBalance - state.apex.max_drawdown;
    saveState(state);
    log("apex-eod-update", { new_high: closingBalance, new_threshold: state.apex.eod_threshold });
    notifyJarvis(
      `📊 APEX EOD UPDATE — FLOOR MOVED\n` +
      `Closing balance: $${closingBalance.toFixed(0)} (new high)\n` +
      `Drawdown floor: $${previousThreshold.toFixed(0)} → $${state.apex.eod_threshold.toFixed(0)}\n` +
      `Eval P&L: $${(state.total_eval_pnl || 0).toFixed(0)} / $${state.apex.profit_target} target`
    );
  } else {
    saveState(state);
    notifyJarvis(
      `📊 APEX EOD — no change\n` +
      `Closing: $${closingBalance.toFixed(0)} | High: $${previousHigh.toFixed(0)} | Floor: $${state.apex.eod_threshold.toFixed(0)}`
    );
  }

  res.json({
    closing_balance: closingBalance,
    account_high_eod: state.apex.account_high_eod,
    eod_threshold: state.apex.eod_threshold,
    floor_moved: closingBalance > previousHigh
  });
});

// Reset daily state — called by scheduler each morning
router.post("/daily-reset", (req, res) => {
  const state = loadState();
  state.daily_pnl = 0;
  state.kill_day = false;
  saveState(state);
  log("autonomous-daily-reset", {});
  res.json({ reset: true });
});

router.get("/paper-trades", (req, res) => {
  try {
    const lines = fs.readFileSync(PAPER_TRADES_FILE, "utf8").split("\n").filter(Boolean);
    const trades = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json({ count: trades.length, trades });
  } catch { res.json({ count: 0, trades: [] }); }
});

router.get("/performance", (req, res) => {
  try {
    const lines = fs.readFileSync(PAPER_TRADES_FILE, "utf8").split("\n").filter(Boolean);
    const all = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const closed = all.filter(t => t.status === "closed");

    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const losses = closed.filter(t => (t.pnl || 0) <= 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;

    res.json({
      total_closed: closed.length,
      open: all.filter(t => t.status === "open").length,
      wins: wins.length,
      losses: losses.length,
      winrate: closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) + "%" : "0%",
      total_pnl: "$" + totalPnl.toFixed(2),
      avg_win: "$" + avgWin.toFixed(2),
      avg_loss: "$" + avgLoss.toFixed(2),
      expectancy: closed.length > 0 ? "$" + ((wins.length / closed.length * avgWin) + (losses.length / closed.length * avgLoss)).toFixed(2) : "$0",
      paper_trades_to_live: Math.max(0, 25 - closed.length),
      ready_for_live: closed.length >= 25
    });
  } catch { res.json({ error: "No trades yet" }); }
});

router.get("/assess", async (req, res) => {
  const state = loadState();
  const { ximes, bobby } = loadRecentSignals(480);

  let perfSummary = "No paper trades yet.";
  try {
    const lines = fs.readFileSync(PAPER_TRADES_FILE, "utf8").split("\n").filter(Boolean);
    const closed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(t => t && t.status === "closed");
    if (closed.length > 0) {
      const wins = closed.filter(t => t.pnl > 0).length;
      const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
      perfSummary = `${closed.length} closed trades | ${((wins / closed.length) * 100).toFixed(0)}% win rate | $${totalPnl.toFixed(0)} total P&L | ${Math.max(0, 25 - closed.length)} to live`;
    }
  } catch {}

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are the 02B autonomous trading system doing a self-assessment.

PAPER PERFORMANCE: ${perfSummary}
MODE: ${state.mode} | RUNNING: ${state.running} | KILL_DAY: ${state.kill_day} | KILL_WEEK: ${state.kill_week}
DAILY P&L: $${state.daily_pnl || 0} (limit: $${state.daily_loss_limit})
WEEKLY P&L: $${state.weekly_pnl || 0} (limit: $${state.weekly_loss_limit})
${state.apex?.enabled ? `APEX EVAL: $${state.total_eval_pnl || 0} / $${state.apex.profit_target} | Floor: $${state.apex.eod_threshold}` : "APEX: disabled"}

XIMES SIGNALS (last 8 hrs, ${ximes.length} found):
${ximes.slice(-3).join("\n---\n") || "NONE"}

BOBBY SIGNALS (last 8 hrs, ${bobby.length} found):
${bobby.slice(-3).join("\n---\n") || "NONE"}

OPEN POSITION: ${state.open_position ? JSON.stringify(state.open_position) : "None"}

Assess:
1. SIGNAL_QUALITY: HIGH/MEDIUM/LOW/NONE — explain why in one sentence
2. READY_TO_TRADE: YES/NO — one sentence reason
3. CONCERN: any flags or issues? One sentence or "None"
4. RECOMMENDATION: one concrete sentence

Be direct. If the data is thin, say so.`
      }]
    });

    const assessment = response.content[0].text;
    log("02b-assess", { assessment });
    res.json({ assessment, signals: { ximes: ximes.length, bobby: bobby.length }, performance: perfSummary, state: { mode: state.mode, running: state.running, daily_pnl: state.daily_pnl } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/test-connection", async (req, res) => {
  const state = loadState();
  const creds = state.tradovate;

  if (!creds.username || !creds.cid || !creds.sec) {
    return res.json({
      connected: false,
      configured: false,
      message: "Credentials not set. Use POST /agent/autonomous/set-mode with tradovate: {username, password, deviceId, cid, sec, env}",
      setup_steps: [
        "1. Create account at tradovate.com",
        "2. Go to Settings > API Credentials",
        "3. Create new application named 'Jarvis' — get CID (numeric) and SEC (string)",
        "4. deviceId can be any stable string, e.g. 'jarvis-device-01'",
        "5. Set env: 'demo' for paper account, 'live' for real money",
        "6. POST /agent/autonomous/set-mode with all credentials"
      ]
    });
  }

  try {
    tokenCache.token = null;
    const token = await getTradovateToken(creds);
    const baseUrl = `https://${creds.env}.tradovateapi.com/v1`;

    const accountsR = await fetch(`${baseUrl}/account/list`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const accounts = await accountsR.json();

    if (!Array.isArray(accounts) || !accounts.length) {
      return res.json({ connected: true, configured: true, accounts: 0, message: "Auth works but no accounts found" });
    }

    const testSymbol = getFrontMonthSymbol("MNQ");
    let contractOk = false;
    try {
      await getContractId(token, baseUrl, testSymbol);
      contractOk = true;
    } catch {}

    log("02b-test-connection", { env: creds.env, accounts: accounts.length, contractOk });
    res.json({
      connected: true,
      configured: true,
      env: creds.env,
      accounts: accounts.map(a => ({ id: a.id, name: a.name, balance: a.cashBalance })),
      contract_lookup: contractOk ? "OK — " + testSymbol + " found" : "WARNING — contract lookup failed",
      ready: contractOk,
      message: contractOk ? "All systems go. Ready to switch to live mode." : "Auth works but contract lookup failed — verify symbol format before going live."
    });
  } catch (err) {
    res.json({ connected: false, configured: true, error: err.message });
  }
});

// Self-audit — 02B checks its own readiness before a dry run or live session
router.get("/self-audit", async (req, res) => {
  const state = loadState();
  const checks = [];

  function check(label, condition, detail) {
    checks.push({ label, ok: Boolean(condition), detail: detail || "" });
  }

  check("State loaded", true, `mode: ${state.mode}`);
  check("Mode valid", state.mode === "paper" || state.mode === "live", state.mode);
  check("Daily kill clear", !state.kill_day, state.kill_day ? "KILL DAY ACTIVE" : "clear");
  check("Weekly kill clear", !state.kill_week, state.kill_week ? `KILL UNTIL ${(state.kill_week_until || "").slice(0, 10)}` : "clear");
  check("Daily loss limit set", state.daily_loss_limit < 0, `$${state.daily_loss_limit}`);
  check("Weekly loss limit set", state.weekly_loss_limit < 0, `$${state.weekly_loss_limit}`);
  check("Apex account start", state.apex && state.apex.account_start > 0, `$${state.apex?.account_start}`);
  check("Apex EOD threshold", state.apex && state.apex.eod_threshold > 0, `floor: $${state.apex?.eod_threshold}`);
  check("No open position", !state.open_position, state.open_position ? `${state.open_position.ticker} open` : "none");
  check("Signal history file exists", fs.existsSync(HISTORY_FILE), HISTORY_FILE);

  const { ximes, bobby } = loadRecentSignals(480);
  check("Ximes signals (8h)", ximes.length > 0, `${ximes.length} found`);
  check("Bobby signals (8h)", bobby.length > 0, `${bobby.length} found`);
  check("Both sources present", ximes.length > 0 && bobby.length > 0, "required for execution");

  const window = getTradingWindowStatus();
  check("Trading window", window.ok, window.reason || "open");

  if (state.mode === "live") {
    check("Tradovate username", !!(state.tradovate?.username), state.tradovate?.username || "NOT SET");
    check("Tradovate cid+sec", !!(state.tradovate?.cid && state.tradovate?.sec), state.tradovate?.env || "NOT SET");
  }

  const paperDone = state.paper_trades || 0;
  check("Paper trades (25 required)", paperDone >= 25, `${paperDone}/25`);

  const pass = checks.filter(c => c.ok).length;
  const fail = checks.filter(c => !c.ok).length;
  const blocking = checks.filter(c => !c.ok && (c.label.includes("kill") || c.label.includes("limit") || c.label.includes("threshold")));

  const summary = `02B SELF-AUDIT: ${pass}/${checks.length} PASS\n\n` +
    checks.map(c => `${c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`).join("\n");

  log("02b-self-audit", { pass, fail });
  res.json({ pass, fail, total: checks.length, checks, summary, blocking_issues: blocking.map(c => c.label) });
});

// Replay — feed historical signals through the scorer for dry run backtesting
router.post("/replay", async (req, res) => {
  const { date, hours_back } = req.body;

  try {
    if (!fs.existsSync(HISTORY_FILE)) return res.json({ error: "No signal history file found" });

    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    let targetEntries;

    if (date) {
      targetEntries = lines.filter(l => {
        try { return JSON.parse(l).date?.startsWith(date); } catch { return false; }
      }).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } else {
      const cutoff = Date.now() - (hours_back || 24) * 60 * 60 * 1000;
      targetEntries = lines.filter(l => {
        try { return new Date(JSON.parse(l).date).getTime() > cutoff; } catch { return false; }
      }).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }

    if (targetEntries.length === 0) {
      return res.json({ error: "No signals found for that period", tried: date || `last ${hours_back || 24}h` });
    }

    const ximes = [];
    const bobby = [];
    for (const entry of targetEntries) {
      for (const r of entry.results || []) {
        if (!r.insights || r.insights.includes("NO_ACTIONABLE") || r.insights.includes("NO_SIGNALS")) continue;
        if (entry.channel === "ximes-dubz") ximes.push(r.insights);
        else if (entry.channel === "bobby-spx-coms") bobby.push(r.insights);
      }
    }

    res.json({ found: { ximes: ximes.length, bobby: bobby.length, total_entries: targetEntries.length }, scoring: true, period: date || `last ${hours_back || 24}h` });

    const signal = await scoreSignals(ximes, bobby);
    log("02b-replay", { date, ximes: ximes.length, bobby: bobby.length, execute: signal.execute, reason: signal.reason });

    notifyJarvis(
      `02B REPLAY — ${date || `last ${hours_back || 24}h`}\n` +
      `Ximes: ${ximes.length} | Bobby: ${bobby.length} signals\n` +
      (signal.execute
        ? `WOULD TRADE: ${signal.direction} ${signal.ticker} @ ${signal.entry}\nStop: ${signal.stop} | Target: ${signal.target}\n${signal.reason}`
        : `NO TRADE: ${signal.reason}`)
    );
  } catch (err) {
    log("02b-replay-error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post("/launch", async (req, res) => {
  const { exec } = require("child_process");

  const windows = [
    { name: "Tradovate", url: "https://trader.tradovate.com/" },
    { name: "ximes-dubz", url: "https://discord.com/channels/718624848812834903/1476605105263612097" },
    { name: "bobby-spx-coms", url: "https://discord.com/channels/718624848812834903/1473072016637821168" },
  ];

  res.json({ launching: windows.map(w => w.name) });

  for (const w of windows) {
    exec(`start "" "${w.url}"`);
    await new Promise(r => setTimeout(r, 1500));
  }

  log("autonomous-launch-windows", { windows: windows.map(w => w.name) });
});

module.exports = router;
