const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const {
  PAPER_TRADES_FILE,
  HISTORY_FILE,
  client,
  loadState,
  saveState,
  log,
  notifyJarvis,
  getTradingWindowStatus,
  getFrontMonthSymbol,
  VALID_MODES,
} = require("./common");
const { loadRecentSignals, scoreSignals } = require("./signals");
const { detectConfluence } = require("../lib/confluence");
const { executePaper, monitorOpenPosition } = require("./execution-paper");
const { executeLive } = require("./execution-live");
const { executeShadow, monitorShadowPosition, getShadowSummary } = require("./execution-shadow");
const { tokenCache, getBaseUrl, getTradovateToken, getAccounts, getContractId, reconcileState } = require("./broker-tradovate");
const {
  buildStatusPayload,
  getPendingSignalPayload,
  getWeeklyKillUntil,
  getApexConsistencyReason,
  getApexPreTradeFloorBlock,
} = require("./risk");
const { getSiennaRegime } = require("../lib/sienna-regime");

const router = express.Router();

async function stageTrade(state, signal) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  state.pending_signal = { ...signal, staged_at: new Date().toISOString(), expires_at: expiresAt };
  saveState(state);
  log("autonomous-staged", signal);

  const pending = getPendingSignalPayload(state);
  notifyJarvis(
    `02B SIGNAL - TAP TO EXECUTE\n` +
    `${signal.direction} ${signal.ticker || "MNQ"}\n` +
    `Entry: ${signal.entry} | Stop: ${signal.stop} | Target: ${signal.target}\n` +
    `Risk: $${pending.risk_dollars} | R:R ${pending.rr}:1\n` +
    `${signal.reason}\n` +
    `Expires in 5 min - confirm in Jarvis`
  );

  if (global.broadcast) {
    global.broadcast({
      type: "staged_trade",
      pending: true,
      signal: state.pending_signal,
      seconds_left: 300,
      rr: pending.rr,
      risk_dollars: pending.risk_dollars
    });
  }
}

router.get("/status", (req, res) => {
  res.json(buildStatusPayload(loadState()));
});

router.post("/start", async (req, res) => {
  const state = loadState();
  if (state.execution_blocked) {
    return res.json({ started: false, reason: "Execution blocked: critical_mismatch pending operator acknowledgement. POST /agent/autonomous/clear-critical to clear." });
  }

  if (state.kill_week) {
    if (state.kill_week_until && new Date() < new Date(state.kill_week_until)) {
      return res.json({ started: false, reason: "Weekly kill active until " + state.kill_week_until.slice(0, 10) });
    }
    state.kill_week = false;
    state.kill_week_until = null;
    state.weekly_pnl = 0;
  }

  if (state.mode === "live") {
    try {
      const reconciliation = await reconcileState(state);
      if (!reconciliation.ok) {
        log("autonomous-start-blocked", reconciliation);
        return res.json({ started: false, reason: "Broker/local mismatch", reconciliation });
      }
    } catch (err) {
      log("autonomous-start-reconcile-error", { error: err.message });
      return res.status(500).json({ started: false, error: err.message });
    }
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
  notifyJarvis("02B KILL SWITCH ACTIVATED - system stopped for today");
  res.json({ killed: true, reason: "Manual daily kill" });
});

router.post("/kill-week", (req, res) => {
  const state = loadState();
  state.running = false;
  state.kill_week = true;
  state.pending_signal = null;
  state.kill_week_until = getWeeklyKillUntil();
  saveState(state);
  log("autonomous-kill-week", { manual: true, until: state.kill_week_until });
  notifyJarvis("02B WEEKLY KILL SWITCH - stopped until " + state.kill_week_until.slice(0, 10));
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
  if (mode && !VALID_MODES.includes(mode)) return res.status(400).json({ error: "mode must be paper, live, or shadow" });
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

router.get("/pending", (req, res) => {
  const state = loadState();
  const pending = getPendingSignalPayload(state);
  if (pending.expired) {
    state.pending_signal = null;
    saveState(state);
    return res.json({ pending: false, reason: "expired" });
  }
  if (!pending.pending) return res.json({ pending: false });
  res.json(pending);
});

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
    } else if (state.mode === "shadow") {
      const freshState = loadState();
      await executeShadow(freshState, signal);
    } else {
      const reconciliation = await reconcileState(state);
      if (!reconciliation.ok) {
        log("autonomous-reconcile-block", reconciliation);
        notifyJarvis("02B LIVE BLOCKED - broker/local mismatch\n" + reconciliation.mismatches.join("\n"));
        const blockedState = loadState();
        blockedState.pending_signal = null;
        saveState(blockedState);
        return;
      }
      const freshState = loadState();
      freshState.pending_signal = null;
      await executeLive(freshState, signal);
    }
  } catch (err) {
    log("execute-staged-error", { error: err.message });
    notifyJarvis("02B EXECUTE FAILED: " + err.message);
    const s = loadState();
    s.pending_signal = null;
    saveState(s);
  }
});

router.post("/skip-staged", (req, res) => {
  const state = loadState();
  state.pending_signal = null;
  saveState(state);
  log("autonomous-skip-staged", {});
  res.json({ skipped: true });
});

router.post("/evaluate", async (req, res) => {
  const state = loadState();
  if (state.mode === "shadow" && state.shadow_session) {
    state.shadow_session.signals_evaluated++;
    saveState(state);
  }
  if (!state.running) return res.json({ action: "skip", reason: "02B not running" });
  if (state.kill_day) return res.json({ action: "skip", reason: "Daily kill active" });
  if (state.kill_week) return res.json({ action: "skip", reason: "Weekly kill active" });
  if (state.open_position) return res.json({ action: "skip", reason: "Position already open" });
  if (state.pending_signal && new Date() < new Date(state.pending_signal.expires_at)) {
    return res.json({ action: "skip", reason: "Pending signal awaiting confirmation" });
  }

  const window = getTradingWindowStatus();
  if (!window.ok) return res.json({ action: "skip", reason: window.reason });

  const consistencyReason = getApexConsistencyReason(state);
  if (consistencyReason) return res.json({ action: "skip", reason: consistencyReason });

  res.json({ action: "evaluating" });

  try {
    const signalWindow = (state.mode === "paper" || state.mode === "shadow") ? 10080 : 120;
    const { ximes, bobby } = loadRecentSignals(signalWindow);
    log("autonomous-evaluate", { ximes_count: ximes.length, bobby_count: bobby.length, window_min: signalWindow });

    // Load today's levels for confluence check
    const DATA_DIR = require("path").join(__dirname, "..", "data");
    const LEVELS_FILE = require("path").join(DATA_DIR, "today-levels.json");
    const today = new Date().toISOString().slice(0, 10);
    let todayLevels = null;
    try {
      if (fs.existsSync(LEVELS_FILE)) {
        const obj = JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
        if (obj.date === today) todayLevels = obj;
      }
    } catch {}

    // Attach confluence score to each ximes signal
    const confluenceZones = todayLevels
      ? detectConfluence([...ximes, ...(todayLevels.richyd || [])], [...bobby, ...(todayLevels.bobby || [])], null)
      : detectConfluence(ximes, bobby, null);

    const tol = 10;
    const enrichedXimes = ximes.map(sig => {
      const level = sig.strike || sig.entry_price || null;
      if (!level) return { ...sig, confluence_score: 0, confluence_zone: null };
      const hit = confluenceZones.find(z => Math.abs(z.level - level) <= tol * 2);
      return {
        ...sig,
        confluence_score: hit ? hit.score : 0,
        confluence_zone: hit ? { level: hit.level, bias: hit.bias, confidence: hit.confidence } : null
      };
    });

    const highConfluenceXimes = enrichedXimes.filter(s => s.confluence_zone && s.confluence_zone.confidence === "HIGH");
    if (highConfluenceXimes.length === 0 && enrichedXimes.length > 0) {
      log("autonomous-evaluate-no-confluence", { zones: confluenceZones.length, ximes_count: enrichedXimes.length });
      return;
    }

    const signal = await scoreSignals(highConfluenceXimes.length > 0 ? highConfluenceXimes : ximes, bobby, state.mode);
    log("autonomous-score", { execute: signal.execute, reason: signal.reason });
    if (!signal.execute) return;

    // Attach confluence data to signal for overlay display
    if (signal.entry && confluenceZones.length > 0) {
      const matchedZone = confluenceZones.find(z => Math.abs(z.level - signal.entry) <= 20);
      if (matchedZone) {
        signal.confluence_score = matchedZone.score;
        signal.confluence_sources = matchedZone.sources || [];
        signal.confluence_confidence = matchedZone.confidence;
      }
    }

    // Sienna regime gate
    const regime = getSiennaRegime();
    signal.sienna_regime = regime.regime;
    signal.sienna_reason = regime.reason;
    if (regime.regime === 'RISK_OFF') {
      const todayStr = new Date().toISOString().slice(0, 10);
      let todayCount = 0;
      try {
        const tlines = fs.readFileSync(PAPER_TRADES_FILE, 'utf8').split('\n').filter(Boolean);
        todayCount = tlines.filter(l => { try { return JSON.parse(l).staged_at?.startsWith(todayStr); } catch { return false; } }).length;
      } catch {}
      if (todayCount >= regime.max_trades_today) {
        log('autonomous-sienna-block', { regime: regime.regime, reason: regime.reason, today_count: todayCount, max: regime.max_trades_today });
        return;
      }
      if (signal.confluence_confidence && signal.confluence_confidence !== 'HIGH') {
        log('autonomous-sienna-block', { regime: regime.regime, reason: 'RISK_OFF requires HIGH confluence', confluence: signal.confluence_confidence });
        return;
      }
    } else if (regime.regime === 'NEUTRAL') {
      const todayStr = new Date().toISOString().slice(0, 10);
      let todayCount = 0;
      try {
        const tlines = fs.readFileSync(PAPER_TRADES_FILE, 'utf8').split('\n').filter(Boolean);
        todayCount = tlines.filter(l => { try { return JSON.parse(l).staged_at?.startsWith(todayStr); } catch { return false; } }).length;
      } catch {}
      if (todayCount >= regime.max_trades_today) {
        log('autonomous-sienna-block', { regime: regime.regime, reason: regime.reason, today_count: todayCount, max: regime.max_trades_today });
        return;
      }
    }

    const freshState = loadState();
    if (!freshState.running || freshState.kill_day || freshState.kill_week || freshState.open_position) return;

    const floorBlock = getApexPreTradeFloorBlock(freshState, signal);
    if (floorBlock) {
      log("autonomous-apex-floor-block", floorBlock);
      notifyJarvis(`02B SKIPPED - too close to Apex floor\nMax loss $${floorBlock.maxLoss.toFixed(0)} would breach floor $${floorBlock.floor.toFixed(0)} + $${floorBlock.buffer} buffer`);
      return;
    }

    // DISABLED - requires human confirm
    // if (freshState.mode === "paper") executePaper(freshState, signal);
    // else if (freshState.mode === "shadow") await executeShadow(freshState, signal);
    else await stageTrade(freshState, signal);
  } catch (err) {
    log("autonomous-evaluate-error", { error: err.message });
  }
});

router.post("/monitor", async (req, res) => {
  res.json({ monitoring: true });
  try { await monitorOpenPosition(); } catch (err) { log("autonomous-monitor-error", { error: err.message }); }
  try { await monitorShadowPosition(); } catch (err) { log("autonomous-monitor-shadow-error", { error: err.message }); }
});

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
      `APEX EOD UPDATE - FLOOR MOVED\n` +
      `Closing balance: $${closingBalance.toFixed(0)} (new high)\n` +
      `Drawdown floor: $${previousThreshold.toFixed(0)} -> $${state.apex.eod_threshold.toFixed(0)}\n` +
      `Eval P&L: $${(state.total_eval_pnl || 0).toFixed(0)} / $${state.apex.profit_target} target`
    );
  } else {
    saveState(state);
    notifyJarvis(
      `APEX EOD - no change\n` +
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
  } catch {
    res.json({ count: 0, trades: [] });
  }
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
  } catch {
    res.json({ error: "No trades yet" });
  }
});

router.get("/assess", async (req, res) => {
  const state = loadState();
  const { ximes, bobby } = loadRecentSignals(480);

  let perfSummary = "No paper trades yet.";
  try {
    const lines = fs.readFileSync(PAPER_TRADES_FILE, "utf8").split("\n").filter(Boolean);
    const closed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(t => t && t.status === "closed");
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
1. SIGNAL_QUALITY: HIGH/MEDIUM/LOW/NONE - explain why in one sentence
2. READY_TO_TRADE: YES/NO - one sentence reason
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
        "3. Create new application named 'Jarvis' - get CID (numeric) and SEC (string)",
        "4. deviceId can be any stable string, e.g. 'jarvis-device-01'",
        "5. Set env: 'demo' for paper account, 'live' for real money",
        "6. POST /agent/autonomous/set-mode with all credentials"
      ]
    });
  }

  try {
    tokenCache.token = null;
    const token = await getTradovateToken(creds);
    const baseUrl = getBaseUrl(creds);
    const accounts = await getAccounts(creds);

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
      contract_lookup: contractOk ? "OK - " + testSymbol + " found" : "WARNING - contract lookup failed",
      ready: contractOk,
      message: contractOk ? "All systems go. Ready to switch to live mode." : "Auth works but contract lookup failed - verify symbol format before going live."
    });
  } catch (err) {
    res.json({ connected: false, configured: true, error: err.message });
  }
});

router.get("/reconcile", async (req, res) => {
  const state = loadState();
  try {
    const reconciliation = await reconcileState(state);
    if (!reconciliation.ok) log("02b-reconcile-mismatch", reconciliation);
    else log("02b-reconcile-ok", reconciliation);
    res.json(reconciliation);
  } catch (err) {
    log("02b-reconcile-error", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/self-audit", async (req, res) => {
  const state = loadState();
  const checks = [];
  function check(label, condition, detail) {
    checks.push({ label, ok: Boolean(condition), detail: detail || "" });
  }

  check("State loaded", true, `mode: ${state.mode}`);
  check("Mode valid", VALID_MODES.includes(state.mode), state.mode);
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
    try {
      const reconciliation = await reconcileState(state);
      check("Broker reconciliation", reconciliation.ok, reconciliation.ok ? "match" : reconciliation.mismatches.join(" | "));
    } catch (err) {
      check("Broker reconciliation", false, err.message);
    }
  }

  const paperDone = state.paper_trades || 0;
  check("Paper trades (25 required)", paperDone >= 25, `${paperDone}/25`);

  const pass = checks.filter(c => c.ok).length;
  const fail = checks.filter(c => !c.ok).length;
  const blocking = checks.filter(c => !c.ok && (c.label.includes("kill") || c.label.includes("limit") || c.label.includes("threshold")));

  const summary = `02B SELF-AUDIT: ${pass}/${checks.length} PASS\n\n` +
    checks.map(c => `${c.ok ? "PASS" : "FAIL"} ${c.label}: ${c.detail}`).join("\n");

  log("02b-self-audit", { pass, fail });
  res.json({ pass, fail, total: checks.length, checks, summary, blocking_issues: blocking.map(c => c.label) });
});

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
      `02B REPLAY - ${date || `last ${hours_back || 24}h`}\n` +
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

router.post("/clear-critical", (req, res) => {
  const { acknowledged, reason } = req.body || {};
  if (acknowledged !== true || !reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ cleared: false, error: "Body must include { acknowledged: true, reason: '<non-empty string>' }" });
  }
  const state = loadState();
  if (!state.critical_mismatch && !state.execution_blocked) {
    return res.json({ cleared: false, reason: "No critical_mismatch or execution_blocked flag set — nothing to clear" });
  }
  state.critical_mismatch = false;
  state.execution_blocked = false;
  saveState(state);
  log("autonomous-critical-cleared", { reason: reason.trim(), cleared_by: "operator" });
  res.json({ cleared: true, note: "critical_mismatch and execution_blocked cleared. Trading remains stopped — start manually." });
});

router.post("/launch", async (req, res) => {
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

// ── SHADOW MODE ──────────────────────────────────────────────────────────
router.get("/shadow/summary", (req, res) => {
  res.json(getShadowSummary(loadState()));
});

router.post("/shadow/reset", (req, res) => {
  const state = loadState();
  state.shadow_session = {
    started: new Date().toISOString(),
    signals_evaluated: 0,
    staged: 0,
    would_have_entered: 0,
    rejected: [],
    simulated_pnl: 0,
    trades: []
  };
  saveState(state);
  log("shadow-session-reset", {});
  res.json({ reset: true, started: state.shadow_session.started });
});

// ── FAULT-INJECTION TEST HOOKS (non-production only) ──────────────────────
if (process.env.NODE_ENV !== "production") {
  // Generic state patch — lets test scripts inject pending signals, open positions, etc.
  router.post("/_test/inject-state", (req, res) => {
    const patch = req.body || {};
    const state = loadState();
    Object.assign(state, patch);
    saveState(state);
    log("test-state-injected", { keys: Object.keys(patch) });
    res.json({ ok: true, patched: Object.keys(patch) });
  });

  // Simulate the full protection-failure → emergencyFlatten sequence without Tradovate
  router.post("/_test/simulate-protection-failure", (req, res) => {
    const { flatten_succeeds = false } = req.body || {};
    const state = loadState();
    const entryOrderId = "TEST-ENTRY-" + Date.now();

    state.execution = { phase: "entry_confirmed", entry_order_id: entryOrderId, updated: new Date().toISOString() };
    saveState(state);

    for (let attempt = 1; attempt <= 2; attempt++) {
      log("execution-protection-retry",          { attempt, entry_order_id: entryOrderId, test: true });
      log("execution-protection-attempt-failed", { attempt, response: { error: "simulated" }, test: true });
    }
    log("execution-protection-all-retries-failed", { entry_order_id: entryOrderId, test: true });

    const s2 = loadState();
    s2.execution = { phase: "emergency_flatten_submitted", entry_order_id: entryOrderId, updated: new Date().toISOString() };
    saveState(s2);

    const s3 = loadState();
    if (flatten_succeeds) {
      const flattenOrderId = "TEST-FLATTEN-" + Date.now();
      s3.execution = { phase: "emergency_flatten_confirmed", entry_order_id: entryOrderId, flatten_order_id: flattenOrderId, updated: new Date().toISOString() };
      s3.open_position = null;
      s3.running = false;
      s3.execution_blocked = true;
      s3.critical_mismatch = false;
      log("execution-emergency-flatten-success", { flatten_order_id: flattenOrderId, test: true });
    } else {
      s3.execution = { phase: "emergency_flatten_failed", entry_order_id: entryOrderId, flatten_error: "simulated", updated: new Date().toISOString() };
      s3.running = false;
      s3.execution_blocked = true;
      s3.critical_mismatch = true;
      log("execution-critical-mismatch", { entry_order_id: entryOrderId, flatten_error: "simulated", test: true });
    }
    saveState(s3);
    log("test-protection-failure-simulation", { flatten_succeeds, test: true });

    const final = loadState();
    res.json({
      ok: true, flatten_succeeds,
      phase: final.execution && final.execution.phase,
      critical_mismatch: !!final.critical_mismatch,
      execution_blocked: !!final.execution_blocked
    });
  });

  // Run reconcile logic with a synthetic phantom broker position — no real Tradovate call
  router.post("/_test/reconcile-phantom", (req, res) => {
    const state = loadState();
    const syntheticOpenPositions = [{ netPos: 1, contractId: 99901 }];
    const mismatches = [];
    if (!state.open_position && syntheticOpenPositions.length > 0) {
      mismatches.push("Broker shows open position but local state is flat");
    }
    if (state.open_position && syntheticOpenPositions.length === 0) {
      mismatches.push("Local state shows open position but broker shows none");
    }
    const result = {
      ok: mismatches.length === 0,
      configured: true, critical: mismatches.length > 0,
      account_count: 1, open_positions: syntheticOpenPositions.length,
      working_orders: 0, mismatches, synthetic: true
    };
    log("test-phantom-reconcile", result);
    res.json(result);
  });
}

module.exports = router;
