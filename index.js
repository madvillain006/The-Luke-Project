process.on('uncaughtException', (err, origin) => {
  const fs = require('fs');
  const path = require('path');
  const ts = new Date().toISOString();
  const entry = `[${ts}] uncaughtException origin=${origin}\n${err.stack || err}\n\n`;
  try {
    const dir = path.join(__dirname, 'state', 'events');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'crash.log'), entry);
  } catch (e) { /* swallow */ }
  console.error(entry);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const fs = require('fs');
  const path = require('path');
  const ts = new Date().toISOString();
  const entry = `[${ts}] unhandledRejection\nreason: ${reason?.stack || reason}\n\n`;
  try {
    const dir = path.join(__dirname, 'state', 'events');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'crash.log'), entry);
  } catch (e) { /* swallow */ }
  console.error(entry);
  // Do NOT exit  log and continue. Node 15+ would crash by default; we want to survive
  // transient promise rejections but capture them.
});

require('dotenv').config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { execSync, spawnSync } = require("child_process");
const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { readJsonFile, writeJsonAtomic } = require("./state/lib");
const { parseBobby, parseBobbyImage } = require("./lib/parse-bobby");
const { detectConfluence, inferInstrument } = require("./lib/confluence");
const { checkEmotionalState, loadTodayContext } = require("./lib/emotional-exits");
const { log } = require("./lib/logger");
const { loadMemory, saveMemory } = require("./lib/memory");
const { buildSystemPrompt, loadDiscordSignals, pruneDiscordHistory } = require("./lib/system-prompt");
const { handleAction, runPython } = require("./lib/actions");
const { handleSlashCommand } = require("./lib/slash-commands");
const { buildStoredHeatmapAnswer } = require("./lib/heatmap-context");
const { recoverLukeCommand } = require("./lib/command-recovery");
const {
  buildCompanionContext,
  buildCompanionMemorySnapshot,
  handleCompanionMemoryTurn,
} = require("./lib/companion-memory");
const { buildLukeOperatorCheck } = require("./lib/luke-operator-check");
const { llmRoutingStatus, messageNeedsAnthropic, freeAiFirst } = require("./lib/llm-routing-policy");
const { validateMemoryKey, MAX_TEXT_BYTES, MAX_URL_LENGTH } = require("./lib/validators");
const { detectPasteIntent } = require("./lib/detect-paste");
const { handlePasteAccumulate } = require("./lib/daily-accumulator");
const { handleManualAnalystPaste } = require("./lib/kat-stage2/manual-analyst-capture");
const { handleManualSybilPaste } = require("./lib/kat-stage2/manual-paste-capture");
const { events, runtime, snapshots } = require("./lib/paths");
const { buildOperatorStatus, buildOperatorReadiness, readTradingStateReadOnly } = require("./lib/operator/operator-status-adapter");
const { buildDecisionResponse } = require("./lib/operator/decision-adapter");
const { buildConfluenceResponse } = require("./lib/operator/confluence-adapter");
const { buildFakeBreakdownWatchlistResponse } = require("./lib/operator/fake-breakdown-watchlist-adapter");
const {
  buildLevelStateResponse,
  buildTradeCandidatesResponse,
  buildTradingAlertsResponse,
  buildCandleStatusResponse,
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
} = require("./lib/operator/trading-state-adapter");
const {
  buildLadderReclaimWatchlistResponse,
  getLadderReclaimCaseImagePath,
} = require("./lib/operator/ladder-reclaim-watchlist-adapter");
const {
  buildHeatmapProofResponse,
  getHeatmapProofFixture,
} = require("./lib/operator/heatmap-proof-fixtures");
const {
  getTodayLevelsFile,
  hasLevelsLoadedToday,
  levelsLoadedLabel,
  makeLevelsWarningPayload,
  appendBobbyVisionResult,
} = require("./lib/today-levels-shim");
const {
  buildBobbyHeatmapSourceId,
  countBobbyNodes,
  findBobbyBySourceId,
} = require("./lib/bobby-heatmap-idempotency");

const rateLimit = require("express-rate-limit");
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

//  CORS  localhost only 
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

//  RATE LIMITING 
const rl = (max, windowMs = 60000) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
const agentLimiter = rl(30);
app.use("/chat",           rl(60));
app.use("/notify",         rl(10));
app.use("/agent/brain",    rl(240));
app.use("/agent",          (req, res, next) => {
  if (req.path.startsWith("/brain")) return next();
  return agentLimiter(req, res, next);
});
app.use("/research",       rl(20));
app.use("/paste-signals",  rl(20));
app.use(rl(600)); // global fallback for local dashboard/static route smoke checks

app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (req.path === '/chat' && /^(image\/|application\/octet-stream)/.test(ct)) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      req.body = { message: '[image]', image: Buffer.concat(chunks).toString('base64') };
      next();
    });
    return;
  }
  const jsonLimit = (req.path === '/chat') ? '10mb' : '100kb';
  express.json({ limit: jsonLimit })(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Invalid JSON" });
    next();
  });
});

const MEMORY_FILE        = snapshots.memory;
const SESSION_FILE       = events.session;
const REPO_MAP_FILE          = snapshots.repoMap;
const TOOL_FAILURES_FILE     = events.toolFailures;
const TOOL_CALLS_FILE        = events.toolCalls;
const TOOL_HEALTH_FILE       = events.toolHealth;
const SCHEMA_ERRORS_FILE     = events.schemaErrors;
const SCHED_HEARTBEAT_FILE   = snapshots.schedulerHeartbeat;
const SCHED_JOBS_FILE        = snapshots.schedulerJobs;
const CANARY_LOG_FILE        = events.canaryLog;
const TRADOVATE_HEALTH_FILE  = snapshots.tradovateHealth;
const STATE_INTERVENTIONS    = events.stateInterventions;
const BOOT_CHECKS_FILE       = events.bootChecks;
const SCRAPE_RESULT_FILE     = runtime.scrapeResult;

const JOB_INTERVALS = {
  "morning-briefing":  24 * 3600000,
  "agent-assessments": 24 * 3600000,
  "discord-scrape":    24 * 3600000,
  "apex-eod-update":   24 * 3600000,
  "rss-scan":          8  * 3600000,
  "weekly-income-reset": 7 * 24 * 3600000,
  "architect":         8  * 3600000,
  "canary":            24 * 3600000,
};

const MEM_CAP_BYTES   = 200 * 1024;
const SERVER_START    = Date.now();

function buildRepoMap() {
  const root = __dirname;
  const map = { root, built: new Date().toISOString(), entries: [] };
  const walk = (dir, depth) => {
    if (depth > 2) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (["node_modules", ".git", "discord-exports"].includes(e.name)) continue;
      const rel = path.relative(root, path.join(dir, e.name));
      map.entries.push((e.isDirectory() ? "d " : "f ") + rel);
      if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1);
    }
  };
  try {
    walk(root, 0);
    fs.writeFileSync(REPO_MAP_FILE, JSON.stringify(map, null, 2));
  } catch {}
}

function saveSessionMessage(role, content) {
  try {
    fs.appendFileSync(SESSION_FILE, JSON.stringify({ role, content: content.slice(0, 300), timestamp: new Date().toISOString() }) + "\n");
    const lines = fs.readFileSync(SESSION_FILE, "utf8").split("\n").filter(Boolean);
    if (lines.length > 50) {
      fs.writeFileSync(SESSION_FILE, lines.slice(-50).join("\n") + "\n");
    }
  } catch {}
}

function logEmotionalState(state, message) {
  const mem = loadMemory();
  if (!mem.emotional_log) mem.emotional_log = [];
  if (state !== "regulated") {
    mem.emotional_log.push({ timestamp: new Date().toISOString(), state, trigger: message.slice(0, 100) });
    if (mem.emotional_log.length > 50) mem.emotional_log = mem.emotional_log.slice(-50);
    mem.current_state = state;
    saveMemory(mem);
    log("emotional-state", { state, trigger: message.slice(0, 100) });
  } else {
    if (mem.current_state && mem.current_state !== "regulated") {
      mem.current_state = "regulated";
      saveMemory(mem);
    }
  }
}

function checkProactiveAlerts() {
  const alerts = [];
  return alerts;
}

function extractAnthropicText(response) {
  return response && response.content && response.content[0] && response.content[0].text
    ? response.content[0].text
    : '';
}

async function callFallbackText(systemPrompt, userMessage, feature) {
  const fb = await _requireFallback().callFallback(systemPrompt, userMessage, { feature });
  return {
    text: fb.reply,
    provider: fb.provider,
    model: fb.model || null,
    fallback: true,
  };
}

async function callAnthropicText(request, usageFeature) {
  const response = await client.messages.create(request);
  trackUsage(usageFeature, request.model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
  return {
    text: extractAnthropicText(response),
    provider: 'anthropic',
    model: request.model,
    fallback: false,
    response,
  };
}

async function callRoutedText(options = {}) {
  const {
    systemPrompt,
    userMessage,
    messages,
    feature = 'chat',
    anthropicModel = 'claude-haiku-4-5-20251001',
    maxTokens = 300,
    preferAnthropic = false,
    allowAnthropic = false,
  } = options;
  const request = {
    model: anthropicModel,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: messages || [{ role: 'user', content: userMessage }],
  };
  const freeFirst = freeAiFirst() && !preferAnthropic;

  if (freeFirst || !allowAnthropic) {
    try {
      return await callFallbackText(systemPrompt || null, userMessage, feature);
    } catch (fallbackError) {
      if (!allowAnthropic) throw fallbackError;
      log('fallback-to-anthropic', { feature, reason: fallbackError.message });
    }
  }

  return callAnthropicText(request, feature);
}

function computeToolHealth() {
  try {
    const cutoff = Date.now() - 24 * 3600000;
    const lines = fs.existsSync(TOOL_CALLS_FILE)
      ? fs.readFileSync(TOOL_CALLS_FILE, "utf8").split("\n").filter(Boolean) : [];
    const recent = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).filter(e => new Date(e.ts).getTime() > cutoff);
    const byAction = {};
    for (const e of recent) {
      if (!byAction[e.action]) byAction[e.action] = { count: 0, total_ms: 0 };
      byAction[e.action].count++;
      byAction[e.action].total_ms += e.duration_ms || 0;
    }
    const summary = Object.entries(byAction).map(([action, s]) => ({
      action, count: s.count, avg_ms: Math.round(s.total_ms / s.count)
    }));
    fs.appendFileSync(TOOL_HEALTH_FILE, JSON.stringify({ ts: new Date().toISOString(), check: "nightly-summary", summary }) + "\n");
  } catch {}
}

function extractTicker(message) {
  const match = message.match(/\b(SPX|SPY|QQQ|FNGU|APG|NVDA|TSLA|AAPL|AMD|META|NQ|ES|MNQ|MES)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractTrade(message) {
  const ticker = extractTicker(message);
  const direction = /put/i.test(message) ? "PUT" : /call/i.test(message) ? "CALL" : null;
  const priceMatch = message.match(/\$?([\d.]+)/);
  const strikeMatch = message.match(/\$?([\d.]+)\s*strike/i);
  return { ticker: ticker || "UNKNOWN", direction: direction || "UNKNOWN", entry_price: priceMatch ? parseFloat(priceMatch[1]) : null, strike: strikeMatch ? parseFloat(strikeMatch[1]) : null, notes: message };
}

function extractShift(message) {
  // Prioritize "made $87" / "earned $87" / "$87"  don't grab hours number first
  const earningsMatch = message.match(/(?:made|earned)\s*\$\s*([\d]+(?:\.\d+)?)/i)
    || message.match(/\$\s*([\d]+(?:\.\d+)?)/)
    || message.match(/([\d]+(?:\.\d+)?)/);
  const hoursMatch = message.match(/([\d.]+)\s*hours?/i);
  const milesMatch = message.match(/([\d.]+)\s*miles?/i);
  return { earnings: earningsMatch ? parseFloat(earningsMatch[1]) : null, hours: hoursMatch ? parseFloat(hoursMatch[1]) : null, miles: milesMatch ? parseFloat(milesMatch[1]) : null, notes: message };
}



async function agentFetch(endpoint, method, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch("http://localhost:3000" + endpoint, opts);
  return r.json();
}

async function routeToAgent(message) {
  if (/(bought|entered|opened|took a position|took calls|took puts)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/log-trade", "POST", extractTrade(message));
      return { reply: data.reply, agent: "trader" };
    } catch (err) {
      log("agent-fetch-error", { agent: "trader", endpoint: "/agent/trader/log-trade", error: err.message });
      return { reply: `[trader agent error: ${err.message}]`, agent: "trader-error" };
    }
  }

  if (/(calls|puts|strike|expiry|contract|flow|signal|conviction|wyckoff|spx|spy|qqq|fngu|apg|setup|thesis|premium|ema|pine|watch|katbot|heatmap|futures|mnq|mes)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/analyze-signal", "POST", { signal: message, ticker: extractTicker(message) });
      return { reply: data.reply, agent: "trader" };
    } catch (err) {
      log("agent-fetch-error", { agent: "trader", endpoint: "/agent/trader/analyze-signal", error: err.message });
      return { reply: `[trader agent error: ${err.message}]`, agent: "trader-error" };
    }
  }

  if (/(instacart|shift|deliveries|delivery|made \$|earned|drove|zone|batch)/i.test(message)) {
    const shift = extractShift(message);
    if (shift.earnings && shift.hours) {
      try {
        const data = await agentFetch("/agent/income/log-shift", "POST", shift);
        return { reply: data.reply, agent: "income" };
      } catch (err) {
        log("agent-fetch-error", { agent: "income", endpoint: "/agent/income/log-shift", error: err.message });
        return { reply: `[income agent error: ${err.message}]`, agent: "income-error" };
      }
    }
  }

  if (/(02b|autonomous.*trad|paper trade|start.*bot|stop.*bot|kill.*switch|auto.*execut)/i.test(message)) {
    try {
      if (/reconcile|broker status|check broker|sync broker/i.test(message)) {
        const rec = await agentFetch("/agent/autonomous/reconcile", "GET");
        const lines = [
          rec.ok ? "02B RECONCILE: MATCH" : "02B RECONCILE: MISMATCH",
          `Accounts: ${rec.account_count ?? "?"}`,
          `Open positions: ${rec.open_positions ?? "?"}`,
          `Working orders: ${rec.working_orders ?? "?"}`,
          ...(rec.mismatches || [])
        ].join("\n");
        return { reply: lines, agent: "autonomous" };
      }

      const action = /start|launch|begin|activate|turn on/i.test(message) ? "start"
        : /stop|pause|deactivate|turn off/i.test(message) ? "stop"
        : /kill|emergency|abort/i.test(message) ? "kill"
        : null;

      if (action) await agentFetch("/agent/autonomous/" + action, "POST", {});
      const status = await agentFetch("/agent/autonomous/status", "GET");
      const lines = [
        "02B - " + (status.running ? (status.mode === "live" ? "LIVE" : "PAPER") : "OFF"),
        status.running ? `Mode: ${status.mode.toUpperCase()}` : null,
        status.execution?.phase ? `Execution: ${status.execution.phase}` : null,
        `Paper trades: ${status.paper_trades || 0} / 25`,
        status.open_position ? `Open: ${status.open_position.direction} ${status.open_position.ticker} @ ${status.open_position.entry}` : "No open position",
        status.kill_day ? "KILL: Daily kill active" : null,
        status.kill_week ? "KILL: Weekly kill active" : null,
        `Daily P&L: $${(status.daily_pnl || 0).toFixed(0)}`,
      ].filter(Boolean).join("\n");
      return { reply: lines, agent: "autonomous" };
    } catch (err) {
      log("agent-fetch-error", { agent: "autonomous", endpoint: "/agent/autonomous/*", error: err.message });
      return { reply: `[autonomous agent error: ${err.message}]`, agent: "autonomous-error" };
    }
  }

  if (/scheduler status|jobs status|scheduled jobs/i.test(message)) {
    try {
      const data = await agentFetch("/scheduler/status", "GET");
      const jobs = Object.entries(data.jobs || {});
      if (jobs.length === 0) return { reply: "No scheduler job receipts yet.", agent: "scheduler" };
      const lines = jobs.slice(0, 8).map(([name, info]) => `${name}: ${info.state || "unknown"} | ok=${info.last_succeeded || "never"} | fail=${info.last_failed || "never"}`);
      return { reply: "Scheduler jobs:\n" + lines.join("\n"), agent: "scheduler" };
    } catch (err) {
      log("agent-fetch-error", { agent: "scheduler", endpoint: "/scheduler/status", error: err.message });
      return { reply: `[scheduler agent error: ${err.message}]`, agent: "scheduler-error" };
    }
  }

  if (/(opportunity|contract|pitch|freelance|apply|job|gig)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/opportunity/pipeline", "GET");
      const reply = data.active > 0
        ? `${data.active} active opportunity${data.active > 1 ? "ies" : ""} in pipeline. Tell me to intake a new one or get details.`
        : "No active opportunities in pipeline. Paste one and I'll evaluate it.";
      return { reply, agent: "opportunity" };
    } catch (err) {
      log("agent-fetch-error", { agent: "opportunity", endpoint: "/agent/opportunity/pipeline", error: err.message });
      return { reply: `[opportunity agent error: ${err.message}]`, agent: "opportunity-error" };
    }
  }

  if (/(move fund|how much.*saved|fund status|on track|tennessee.*money|debt|owe|how are we looking|where are we at)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/finance/fund-status", "GET");
      const reply = "Fund: $" + (data.balance || "0") + " / $6,000 | " + (data.weeks_left || "?") + " weeks left | Need $" + (data.weekly_needed || "?") + "/week | " + (data.status || "unknown");
      return { reply, agent: "finance" };
    } catch (err) {
      log("agent-fetch-error", { agent: "finance", endpoint: "/agent/finance/fund-status", error: err.message });
      return { reply: "Couldn't pull fund status right now.", agent: "finance-error" };
    }
  }

  return null;
}

app.get("/", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/luke-shell.html");
});

app.get("/shell", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/luke-shell.html");
});

app.get("/trading", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/chat.html");
});

app.get("/luke", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/chat.html");
});

app.get("/daily", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/daily-window.html");
});

app.get("/radar", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/radar-dashboard.html");
});

app.get("/operator-v2", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/operator-v2.html");
});

app.get("/trading-window", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/trading-window.html");
});

app.get("/research/fake-breakdown-watchlist", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, "artifacts", "research", "fake-breakdown-watchlist.html"));
});

app.get("/research/ladder-reclaim-watchlist", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, "artifacts", "research", "ladder-reclaim-visual-review.html"));
});

app.get("/brain", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/brain-dashboard.html");
});

app.get("/brain-dashboard", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(__dirname + "/brain-dashboard.html");
});

function isTradingSurfaceCommand(text) {
  return /^\/(?:alert|backtest|balance|confluence|dubz|entries|heatmap|history|layout|levels|mancini|ready|reset|review|runner|saty|session|status|trade|trading-mode|verdict)\b/i.test(String(text || "").trim());
}

const PROTECTED_TRADING_SMOKE_PATHS = ["/status", "/balance", "/saty", "/ready", "/alert"];

app.all(PROTECTED_TRADING_SMOKE_PATHS, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const command = `/${String(req.path || "").replace(/^\/+/, "")}`;
  const handled = await handleSlashCommand(command, res);
  if (handled !== null) return;
  return res.status(404).json({ error: "Unknown protected trading command" });
});

const SYSTEM_CHAT_PROMPT = [
  "You are Luke's system chat for the local dashboard.",
  "Be concise, practical, and collaborative.",
  "You can discuss the state of the overall Luke system, daily planning, research, automation business work, developer workflow, and where trading fits in the architecture.",
  "Do not parse trading signals, ingest market levels, stage trades, or alter trading state from this surface.",
  "If the user asks for trading-specific ingestion or recommendations, tell them to use the Trading tab so that process stays isolated.",
  "No em dashes.",
].join(" ");

app.get("/luke/memory", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json(buildCompanionMemorySnapshot({ limit: Number(req.query.limit || 12) }));
});

app.get("/luke/memory/context", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const surface = req.query.surface === "system" ? "system" : "trading";
  const message = String(req.query.q || req.query.message || "");
  return res.json({
    ok: true,
    surface,
    context: buildCompanionContext({ surface, message }),
  });
});

app.get("/luke/operator-check", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json(buildLukeOperatorCheck({ health: buildHealthPayload() }));
});

app.post("/chat", async (req, res) => {
  const { message = "", history, image, surface } = req.body || {};
  const isSystemSurface = surface === "system";
  if (!message && !image) return res.status(400).json({ error: "No message" });

  //  accumulator: auto-classify paste, store piece, ack, fire verdict 
  if (!isSystemSurface && !message.startsWith("/")) {
    const sybilResult = await handleManualSybilPaste(message, res);
    if (sybilResult) return;
    const accResult = await handlePasteAccumulate(message, image, res);
    if (accResult) return;
    const analystPasteResult = await handleManualAnalystPaste(message, res);
    if (analystPasteResult) return;
  }

  //  slash command intercept 
  let routedMessage = message;
  if (!isSystemSurface && !message.startsWith("/")) {
    const { command, cleanedText } = detectPasteIntent(message, !!image);
    if (command) routedMessage = command + " " + cleanedText;
  }
  const commandRecovery = recoverLukeCommand(routedMessage, { surface: isSystemSurface ? "system" : "trading" });
  if (commandRecovery) routedMessage = commandRecovery.command;

  if (routedMessage.startsWith("/")) {
    if (isSystemSurface && isTradingSurfaceCommand(routedMessage)) {
      const recoveredLine = commandRecovery
        ? `I read that as /${commandRecovery.command_name}, but it belongs in the Trading tab so the trading process stays isolated.`
        : "That belongs in the Trading tab so the trading process stays isolated.";
      return res.json({
        reply: `${recoveredLine} Open Trading (Analysis) for level ingestion, verdicts, entries, trade logs, and reviews.`,
        state: "regulated",
        history: [...(history || []), { role: "user", content: message }, { role: "assistant", content: recoveredLine }],
      });
    }
    if (image && routedMessage.startsWith("/heatmap")) res._heatmapImage = image;
    if (image && routedMessage.startsWith("/dubz"))    res._dubzImage    = image;
    const handled = await handleSlashCommand(routedMessage, res);
    if (handled !== null) return;
  }

  //  end slash commands 

  if (!isSystemSurface && !message.startsWith("/")) {
    const heatmapAnswer = buildStoredHeatmapAnswer(message);
    if (heatmapAnswer) {
      saveSessionMessage("user", message);
      saveSessionMessage("assistant", heatmapAnswer);
      log("chat-heatmap-context", { user: message, answered: true });
      return res.json({
        reply: heatmapAnswer,
        state: "regulated",
        history: [...(history || []), { role: "user", content: message }, { role: "assistant", content: heatmapAnswer }],
      });
    }
  }

  let companionTurn = null;
  if (!image && !routedMessage.startsWith("/")) {
    companionTurn = handleCompanionMemoryTurn({ text: message, surface: isSystemSurface ? "system" : "trading" });
    if (companionTurn.handled) {
      saveSessionMessage("user", message);
      saveSessionMessage("assistant", companionTurn.reply);
      log("chat-companion-memory", {
        user: message,
        handled: true,
        surface: isSystemSurface ? "system" : "trading",
        captured: Boolean(companionTurn.capture?.captured),
      });
      return res.json({
        reply: companionTurn.reply,
        state: "regulated",
        memory: { handled: true, captured: Boolean(companionTurn.capture?.captured) },
        history: [...(history || []), { role: "user", content: message }, { role: "assistant", content: companionTurn.reply }],
      });
    }
  }

  const messages = [...(history || []), { role: "user", content: message }];
  const _exitWarnings = isSystemSurface ? [] : checkEmotionalState(loadTodayContext());
  const state = isSystemSurface ? "regulated"
    : _exitWarnings.find(w => w.type === "HARD") ? "rule_break"
    : _exitWarnings.length > 0 ? "stressed"
    : "regulated";
  if (!isSystemSurface) logEmotionalState(state, message);
  const alerts = isSystemSurface ? [] : checkProactiveAlerts();
  const hardCapActive = isHardCap();

  saveSessionMessage("user", message);
  const companionContext = buildCompanionContext({ message, surface: isSystemSurface ? "system" : "trading" });

  const ACK_SYSTEM = "You are Luke. Acknowledge this agent result in one sentence. Be brief. No em dashes.";

  try {
    const routeNeedsAnthropic = messageNeedsAnthropic(message, { feature: "chat" });
    const routed = isSystemSurface || hardCapActive || !routeNeedsAnthropic ? null : await routeToAgent(message);
    if (routed) {
      const ack = await callRoutedText({
        systemPrompt: ACK_SYSTEM,
        userMessage: "[" + routed.agent.toUpperCase() + " AGENT LOGGED: " + routed.reply + "]\n\nAcknowledge that in one sentence as Luke, naturally. No em dashes. Do not mention mood, state, detection, or system internals.",
        feature: "chat",
        maxTokens: 80,
        allowAnthropic: false,
      });
      let reply = ack.text;
      if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
      saveSessionMessage("assistant", reply);
      log("chat", { user: message, luke: reply, agent: routed.agent, state, provider: ack.provider, model: ack.model });
      return res.json({ reply, state, provider: ack.provider, model: ack.model, fallback: ack.fallback, history: [...messages, { role: "assistant", content: reply }] });
    }
  } catch {}

  // A10: fallback routing when fallback mode is active or paid-token hard cap is hit.
  if (_requireFallback().isActive() || hardCapActive) {
    try {
      const fallbackSystemPrompt = [
        isSystemSurface ? SYSTEM_CHAT_PROMPT : "You are Luke - concise trading and ops copilot. Keep it brief and direct.",
        companionContext,
      ].join("\n\n");
      const fb = await _requireFallback().callFallback(
        fallbackSystemPrompt,
        message,
        { feature: isSystemSurface ? "status" : "chat" }
      );
      let reply = fb.reply;
      if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
      saveSessionMessage("assistant", reply);
      log("chat-fallback", { user: message, provider: fb.provider, state });
      return res.json({ reply, state, fallback: true, provider: fb.provider, model: fb.model || null, history: [...messages, { role: "assistant", content: reply }] });
    } catch (fbErr) {
      log("fallback-error", { error: fbErr.message });
      if (hardCapActive) {
        return res.status(503).json({ error: "Paid-token hard cap is active and all fallback providers failed", detail: fbErr.message });
      }
    }
  }

  function isSimpleMessage(text) {
    const t = text.trim().toLowerCase();
    if (t.startsWith("/")) return true;
    if (t.length < 20) return true;
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|yep|nope|sure|got it|cool)$/i.test(t)) return true;
    if (!t.includes(" ")) return true;
    return false;
  }

  const useHaiku = isSimpleMessage(message);
  const chatModel = useHaiku ? "claude-haiku-4-5-20251001" : "claude-opus-4-7";
  const baseChatSystemPrompt = isSystemSurface ? SYSTEM_CHAT_PROMPT : useHaiku
    ? "You are Luke - sharp, brief, no filler. No em dashes."
    : buildSystemPrompt(state, message);
  const chatSystemPrompt = [baseChatSystemPrompt, companionContext].join("\n\n");
  const allowAnthropic = !hardCapActive && messageNeedsAnthropic(message, { feature: "chat" });

  try {
    const llm = await callRoutedText({
      systemPrompt: chatSystemPrompt,
      userMessage: message,
      messages,
      feature: "chat",
      anthropicModel: chatModel,
      maxTokens: useHaiku ? 150 : 800,
      preferAnthropic: false,
      allowAnthropic,
    });

    let reply = llm.text;
    let action = null;
    let extra = null;

    const actionStart = reply.indexOf("ACTION:{");
    if (actionStart !== -1) {
      try {
        let depth = 0, end = -1;
        for (let i = actionStart + 7; i < reply.length; i++) {
          if (reply[i] === "{") depth++;
          else if (reply[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end !== -1) {
          action = JSON.parse(reply.slice(actionStart + 7, end));
          reply = (reply.slice(0, actionStart) + reply.slice(end)).trim();
          extra = await handleAction(action);
          if (extra) reply = reply ? reply + "\n\n" + extra : extra;
        }
      } catch (e) {
        reply += "\n[Action failed: " + e.message + "]";
      }
    }

    if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
    saveSessionMessage("assistant", reply);
    log("chat", { user: message, luke: reply, state, provider: llm.provider, model: llm.model, anthropic_allowed: allowAnthropic });
    res.json({ reply, state, action, provider: llm.provider, model: llm.model, fallback: llm.fallback, anthropic_allowed: allowAnthropic, history: [...messages, { role: "assistant", content: llm.text }] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/see", async (req, res) => {
  const { question } = req.body;
  if (!/^(1|true|yes|on)$/i.test(String(process.env.LUKE_ALLOW_ANTHROPIC_VISION || ''))) {
    return res.status(403).json({ error: "Vision is disabled until free-AI image/OCR routing is explicitly authorized." });
  }
  try {
    const img = runPython(["screenshot"]);
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 384,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: img } }, { type: "text", text: question || "What's on this screen? Be brief." }] }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: "Vision failed" });
  }
});

app.post("/see-image", async (req, res) => {
  const { image, mime_type, question, surface } = req.body || {};
  if (!image) return res.status(400).json({ error: "No image" });
  if (!/^(1|true|yes|on)$/i.test(String(process.env.LUKE_ALLOW_ANTHROPIC_VISION || ''))) {
    return res.status(403).json({ error: "Vision is disabled until free-AI image/OCR routing is explicitly authorized." });
  }
  try {
    if (surface === "system") {
      const mediaType = typeof mime_type === "string" && /^image\//i.test(mime_type) ? mime_type : "image/png";
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 384,
        system: SYSTEM_CHAT_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: question || "Describe this image briefly." },
          ],
        }],
      });
      trackUsage("system-image", "claude-haiku-4-5-20251001", response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
      return res.json({ reply: response.content[0].text });
    }

    const sourceId = buildBobbyHeatmapSourceId({ image });
    const existing = (() => {
      try {
        const obj = JSON.parse(fs.readFileSync(getTodayLevelsFile(__dirname), 'utf8'));
        return findBobbyBySourceId(obj, sourceId);
      } catch { return null; }
    })();
    if (existing) {
      const kings  = (existing.king_nodes || []).join(", ") || "none";
      const walls  = (existing.resistance || []).join(", ") || "none";
      const floors = (existing.support || []).join(", ") || "none";
      const summary = `King nodes: ${kings}. Walls: ${walls}. Floors: ${floors}. Nodes: ${countBobbyNodes(existing)}. Bias: ${existing.bias}.`;
      return res.json({ reply: `${summary} Katbot/SPX heatmap already loaded; duplicate ignored.` });
    }

    const result = await parseBobbyImage(image);
    if (!result) return res.status(422).json({ error: "No levels extracted from image" });

    appendBobbyVisionResult(getTodayLevelsFile(__dirname), result);

    const kings  = (result.king_nodes || []).join(", ") || "none";
    const walls  = (result.resistance || []).join(", ") || "none";
    const floors = (result.support || []).join(", ") || "none";
    const pockets = (result.air_pockets || []).join(", ") || "none";
    const summary = `King nodes: ${kings}. Walls: ${walls}. Floors: ${floors}. Air pockets: ${pockets}. Bias: ${result.bias}.`;
    res.json({ reply: `${summary} Katbot/SPX heatmap loaded to confluence.` });
  } catch (err) {
    res.status(500).json({ error: "Vision failed" });
  }
});

// guarded in Phase 1B.6.3  intraday-scraper v0 archived; requires Mac mini hardware

app.post("/do", async (req, res) => {
  const { action, value } = req.body;
  try {
    let result;
    if (action === "open") result = runPython(["open", value]);
    else if (action === "type") result = runPython(["type", value]);
    else if (action === "click") { const [x, y] = value.split(",").map(Number); result = runPython(["click", String(x), String(y)]); }
    else if (action === "scroll") result = runPython(["scroll", value]);
    else if (action === "press") result = runPython(["press", value]);
    else result = "Unknown action";
    res.json({ reply: result });
  } catch (err) {
    res.status(500).json({ error: "Action failed" });
  }
});

app.post("/research", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") return res.status(400).json({ error: "No URL" });
  if (url.length > MAX_URL_LENGTH) return res.status(400).json({ error: "URL too long" });
  // Reject non-http(s) schemes to prevent SSRF via file:// / ftp:// etc.
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Only http/https URLs allowed" });

  try {
    let text = "";
    const isXPost = url.includes("x.com") || url.includes("twitter.com");

    if (isXPost) {
      const oembed = await fetch("https://publish.twitter.com/oembed?url=" + encodeURIComponent(url));
      const data = await oembed.json();
      text = data.html ? data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    } else {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(10000)
      });
      const html = await r.text();
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
    }

    if (!text || text.length < 50) return res.json({ reply: "Could not extract content from this URL." });

    const result = await callRoutedText({
      userMessage: "You are Agent 06  research agent for Luke. Extract what is useful for building a personal AI agent system or for trading.\n\nURL: " + url + "\n\nCONTENT:\n" + text + "\n\nFormat exactly like this:\nKEY INSIGHT: one sentence\nAPPLIES TO: scaffold / trader / research / all\nIMPLEMENTATION: one sentence\nPRIORITY: HIGH / MEDIUM / LOW\n\nUnder 80 words total. If not relevant to AI agents or trading, say: NOT RELEVANT",
      feature: "summarize",
      maxTokens: 384,
      allowAnthropic: false,
    });

    const insight = result.text;

    if (!insight.includes("NOT RELEVANT")) {
      const mem = loadMemory();
      if (!mem.agent06_research) mem.agent06_research = [];
      mem.agent06_research.push({ url, insight, date: new Date().toISOString() });
      mem.agent06_last_run = new Date().toISOString();
      saveMemory(mem);
      log("research", { url, insight });
    }

    res.json({ reply: insight, provider: result.provider, model: result.model });
  } catch (err) {
    res.status(500).json({ error: "Research failed", detail: err.message });
  }
});

app.post("/memory", (req, res) => {
  const { key, value } = req.body;
  if (!validateMemoryKey(key)) return res.status(400).json({ error: "Invalid or blocked memory key" });
  const mem = loadMemory();
  mem[key] = value;
  mem._updated = new Date().toISOString();
  saveMemory(mem);
  log("memory", { key, value });
  res.json({ saved: true });
});

app.get("/memory", (req, res) => res.json(loadMemory()));
app.get("/scheduler/status", (req, res) => {
  const heartbeat = readJsonFile(SCHED_HEARTBEAT_FILE, {});
  const jobs = readJsonFile(SCHED_JOBS_FILE, {});
  const staleHours = {
    "morning-briefing": 30,
    "discord-scrape": 30,
    "agent-assessments": 30,
        "weekly-income-reset": 8 * 24,
    "rss-scan": 12,
    "architect": 12,
    "tradovate-health": 30,
    "canary": 30,
    "apex-eod-update": 30,
  };
  const annotated = Object.fromEntries(Object.entries(jobs).map(([name, info]) => {
    const last = info.last_succeeded || info.last_started || null;
    const thresholdH = staleHours[name] || 30;
    const stale = last ? ((Date.now() - new Date(last).getTime()) > thresholdH * 3600000) : true;
    return [name, { ...info, stale, stale_threshold_hours: thresholdH }];
  }));
  res.json({ heartbeat, jobs: annotated });
});

app.post("/notify", (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") return res.status(400).json({ error: "No message" });
  if (message.length > 500) return res.status(400).json({ error: "Message too long (max 500 chars)" });
  const safeMessage = message.slice(0, 500);
  log("alert", { message: safeMessage });
  broadcast({ type: "notification", message: safeMessage });
  res.json({ sent: true });
});

app.post("/scrape", async (req, res) => {
  const { priority } = req.body;
  try {
    const { runScraper } = require("./scripts/discord-scraper");
    const filter = priority || ["HIGH"];
    res.json({ started: true, priority: filter });
    runScraper(filter).catch(console.error);
  } catch (err) {
    res.status(500).json({ error: "Scraper failed", detail: err.message });
  }
});

app.post("/paste-signals", async (req, res) => {
  const { text, source } = req.body;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "No text provided" });
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) return res.status(400).json({ error: "Text exceeds 10KB limit" });
  const sourceLabel = String(source || "");
  const sybilResult = await handleManualSybilPaste(text, res, {
    force: /\bsybil\b/i.test(sourceLabel),
    channelName: /\bsybil\b/i.test(sourceLabel) ? "manual-sybil-paste" : undefined,
    provenanceNote: sourceLabel ? `paste-signals source: ${sourceLabel}` : "paste-signals manual paste",
  });
  if (sybilResult) return;

  const analystPasteResult = await handleManualAnalystPaste(text, res, {
    force: true,
    sourceLabel,
    provenanceNote: sourceLabel ? `paste-signals source: ${sourceLabel}` : "paste-signals manual paste",
  });
  if (analystPasteResult) return;

  try {
    const result = await callRoutedText({
      userMessage: "Extract every trading signal, level call, and directional bias from this Discord channel paste. Source: " + (source || "unknown") + "\n\nFor each signal found:\nTICKER: \nDIRECTION: \nLEVEL: \nTIMESTAMP: (if visible)\nNOTES: \n\nPaste:\n" + text.slice(0, 8000),
      feature: "classify",
      maxTokens: 500,
      allowAnthropic: false,
    });

    const insights = result.text;
    const entry = { date: new Date().toISOString(), source: source || "manual-paste", results: [{ scroll: 1, raw: text.slice(0, 500), insights }] };
    fs.appendFileSync(events.discordHistory, JSON.stringify(entry) + "\n");
    log("paste-signals", { source, length: text.length });
    res.json({ reply: insights, provider: result.provider, model: result.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/signals", (req, res) => {
  const signals = loadDiscordSignals();
  res.json({ count: signals.length, signals });
});

// PRICE - structured market data; stale/latest-close is labeled explicitly.
app.get("/price/spx", async (req, res) => {
  const { getMarketPrice } = require('./lib/market-data');
  const data = await getMarketPrice('SPX');
  if (!data || !Number.isFinite(data.price)) return res.status(503).json({ error: 'price unavailable', marketData: data || null });
  res.json({
    ticker: 'SPX',
    price: data.price,
    timestamp: data.timestamp,
    data_date: data.timestamp ? data.timestamp.slice(0, 10) : null,
    source: data.source,
    price_approximation: false,
    stale: data.stale,
    delayed: data.delayed,
    confidence: data.confidence,
    marketData: data,
  });
});

//  SATY ATR WEBHOOK (TradingView  Luke) 
// Set up a TradingView alert on Saty's ATR script with webhook URL:
//   http://[your-ngrok-url]/webhook/saty
// Alert message (JSON format):
//   {"up2":{{plot_0}},"up1":{{plot_1}},"mid":{{plot_2}},"down1":{{plot_3}},"down2":{{plot_4}},"atr":{{plot_5}}}
// Or simpler  just set the alert message to the 5 level values space-separated.
app.post("/webhook/saty", (req, res) => {
  try {
    const { saveSatyLevels, parseSatyText } = require('./lib/saty-levels');
    const body = req.body;
    // Accept either pre-parsed JSON or raw text
    let parsed;
    if (body && typeof body === 'object' && (body.up1 || body.mid || body.up2)) {
      // Already parsed JSON from TradingView
      parsed = { ...body, valid: true };
    } else {
      // Try to parse as text
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      parsed = parseSatyText(text);
    }
    if (!parsed || !parsed.valid) {
      return res.status(400).json({ ok: false, error: 'parse failed' });
    }
    saveSatyLevels(parsed);
    log('saty-webhook', { levels: parsed });
    res.json({ ok: true, levels: parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/webhook/saty", (req, res) => {
  const { loadSatyLevels, buildStatusSummary } = require('./lib/saty-levels');
  const data = loadSatyLevels();
  res.json({ loaded: !!data, summary: buildStatusSummary(data) });
});

//  LUKE LONG -> NINJATRADER SIM BRIDGE
// TradingView/Luke alert payload lands here, Luke writes a local JSON file,
// and the NinjaTrader strategy polls that file. This route does not place live orders.
function getNinjaBridgeToken(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  return req.get("x-luke-bridge-token") || body.token || body.bridge_token || req.query.token;
}

function requireNinjaBridgeToken(req, res) {
  const expectedBridgeToken = process.env.LUKE_NINJA_BRIDGE_TOKEN;
  if (!expectedBridgeToken) return true;
  if (getNinjaBridgeToken(req) === expectedBridgeToken) return true;
  res.status(401).json({ ok: false, sim_bridge_only: true, error: "invalid Ninja bridge token" });
  return false;
}

function readTextFileTrimmed(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return fallback;
  }
}

function isoAgeMs(isoText) {
  const parsed = Date.parse(isoText);
  return Number.isFinite(parsed) ? Date.now() - parsed : null;
}

function buildNinjaTunnelWatchdogUiStatus(overrideStatus = null) {
  const ninjaDir = path.join(__dirname, "data", "ninjatrader");
  const tunnelStatusPath = path.join(ninjaDir, "tunnel-status.json");
  const watchdogStatusPath = path.join(ninjaDir, "tunnel-watchdog-status.json");
  const currentWebhookPath = path.join(ninjaDir, "current-webhook-url.txt");
  const latestSignalPath = path.join(ninjaDir, "latest-luke-signal.json");
  const watchdog = overrideStatus || readJsonFile(watchdogStatusPath, null);
  const tunnel = readJsonFile(tunnelStatusPath, null);
  const latestSignal = readJsonFile(latestSignalPath, null);
  const webhookUrl = watchdog?.webhook_url || readTextFileTrimmed(currentWebhookPath) || tunnel?.webhook_url || "";
  const publicUrl = watchdog?.public_url || tunnel?.public_url || "";
  const checkedAt = watchdog?.checked_at || tunnel?.updated_at || null;
  const statusAgeMs = isoAgeMs(checkedAt);
  const watchdogStale = statusAgeMs === null || statusAgeMs > 3 * 60 * 1000;
  const tunnelStale = Boolean(watchdog?.stale_warning);
  const healthy = Boolean(watchdog?.ok && webhookUrl && !watchdogStale && !tunnelStale);
  const state = healthy ? "healthy" : watchdog?.ok && webhookUrl ? "stale" : "unhealthy";
  return {
    ok: Boolean(watchdog?.ok && webhookUrl),
    state,
    reason: watchdogStale ? "watchdog_not_recent" : tunnelStale ? "quick_tunnel_age_warning" : watchdog?.reason || "no_watchdog_status",
    route: watchdog?.route || (publicUrl ? "public_tunnel" : "unknown"),
    webhook_url: webhookUrl,
    public_url: publicUrl,
    checked_at: checkedAt,
    status_age_ms: statusAgeMs,
    tunnel_age_ms: typeof watchdog?.tunnel_age_ms === "number" ? watchdog.tunnel_age_ms : null,
    local_status: watchdog?.local_status ?? null,
    public_status: watchdog?.public_status ?? null,
    refreshed: Boolean(watchdog?.refreshed),
    stability_warning: watchdog?.stability_warning || "",
    bridge_file_idle: !latestSignal?.signal,
    bridge_file_written_at: latestSignal?.written_at || null,
    sim_bridge_only: true,
    token_required: Boolean(process.env.LUKE_NINJA_BRIDGE_TOKEN),
  };
}

app.post("/webhook/luke-long", (req, res) => {
  try {
    if (!requireNinjaBridgeToken(req, res)) return;

    const { saveLukeBridgeCommand, LATEST_SIGNAL_FILE } = require("./lib/ninjatrader-alert-bridge");
    const payload = saveLukeBridgeCommand(req.body);
    log("ninjatrader-bridge-signal", {
      id: payload.signal.id,
      type: payload.signal.type,
      symbol: payload.signal.symbol,
      entry: payload.signal.entry,
      stop: payload.signal.stop,
      tp1: payload.signal.tp1,
      tp2: payload.signal.tp2,
      qty: payload.signal.qty,
      file: LATEST_SIGNAL_FILE,
    });
    res.json({
      ok: true,
      sim_bridge_only: true,
      file: LATEST_SIGNAL_FILE,
      signal: payload.signal,
    });
  } catch (err) {
    res.status(400).json({ ok: false, sim_bridge_only: true, error: err.message });
  }
});

app.get("/api/ninjatrader/bridge-status", (req, res) => {
  if (!requireNinjaBridgeToken(req, res)) return;
  const tunnelStatusPath = path.join(__dirname, "data", "ninjatrader", "tunnel-status.json");
  res.json({
    ok: true,
    sim_bridge_only: true,
    token_required: Boolean(process.env.LUKE_NINJA_BRIDGE_TOKEN),
    tunnel: readJsonFile(tunnelStatusPath, null),
  });
});

app.get("/api/ninjatrader/latest-signal", (req, res) => {
  if (!requireNinjaBridgeToken(req, res)) return;
  const { loadLatestLukeSignal, LATEST_SIGNAL_FILE } = require("./lib/ninjatrader-alert-bridge");
  res.json({
    ok: true,
    sim_bridge_only: true,
    file: LATEST_SIGNAL_FILE,
    payload: loadLatestLukeSignal(),
  });
});

app.get("/api/ninjatrader/tunnel-watchdog", (req, res) => {
  res.json(buildNinjaTunnelWatchdogUiStatus());
});

app.post("/api/ninjatrader/tunnel-watchdog/refresh", async (req, res) => {
  try {
    const watchdog = require("./agents/agent-15-ninja-tunnel-watchdog");
    const force = req.query.force === "1" || req.query.force === "true" || req.body?.force === true;
    await watchdog.runOnce({ refresh: true, force });
    res.json(buildNinjaTunnelWatchdogUiStatus());
  } catch (error) {
    res.status(500).json({
      ...buildNinjaTunnelWatchdogUiStatus(),
      ok: false,
      state: "unhealthy",
      reason: "refresh_failed",
      error: error.message,
    });
  }
});

app.get("/agent/saty/auto-pull/status", (req, res) => {
  const { loadAutoPullState } = require('./lib/saty-auto-pull');
  const { loadSatyLevels, buildStatusSummary } = require('./lib/saty-levels');
  const saty = loadSatyLevels();
  res.json({
    state: loadAutoPullState(),
    loaded: !!saty,
    summary: buildStatusSummary(saty),
  });
});

app.post("/agent/saty/auto-pull", async (req, res) => {
  try {
    const { runSatyAutoPull } = require('./lib/saty-auto-pull');
    const result = await runSatyAutoPull();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.get("/state", (req, res) => {
  const mem = loadMemory();
  res.json({ current_state: mem.current_state || "regulated", emotional_log: (mem.emotional_log || []).slice(-10) });
});

app.get("/api/operator/status", async (req, res) => {
  try {
    const payload = await buildOperatorStatus({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "manual",
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, blockers: [`operator status failed: ${err.message}`] });
  }
});

app.get("/api/operator/readiness", async (req, res) => {
  try {
    const payload = await buildOperatorReadiness({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "manual",
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, blockers: [`operator readiness failed: ${err.message}`] });
  }
});

app.get("/api/decision", async (req, res) => {
  try {
    const stateRead = readTradingStateReadOnly();
    const payload = await buildDecisionResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "manual",
      currentPrice: req.query.currentPrice,
      state: stateRead.ok ? stateRead.value : null,
    });
    if (!stateRead.ok) {
      payload.ok = false;
      payload.blockers = stateRead.blockers || [`trading state unavailable: ${stateRead.error}`];
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, blockers: [`decision failed: ${err.message}`] });
  }
});

app.get("/api/confluence", async (req, res) => {
  try {
    const payload = await buildConfluenceResponse({
      instrument: req.query.instrument || "ES",
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, blockers: [`confluence failed: ${err.message}`] });
  }
});

app.get("/api/trading/level-state", async (req, res) => {
  try {
    const payload = await buildLevelStateResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`level-state failed: ${err.message}`] });
  }
});

app.get("/api/trading/trade-candidates", async (req, res) => {
  try {
    const payload = await buildTradeCandidatesResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`trade-candidates failed: ${err.message}`] });
  }
});

app.get("/api/trading/alerts", async (req, res) => {
  try {
    const payload = await buildTradingAlertsResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`trading alerts failed: ${err.message}`] });
  }
});

app.get("/api/trading/candle-status", async (req, res) => {
  try {
    const payload = await buildCandleStatusResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`candle status failed: ${err.message}`] });
  }
});

app.get("/api/trading/chart-data", async (req, res) => {
  try {
    const payload = await buildTradingChartDataResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`chart-data failed: ${err.message}`] });
  }
});

app.get("/api/trading/source-health", async (req, res) => {
  try {
    const payload = await buildTradingSourceHealthResponse({
      instrument: req.query.instrument || "ES",
      mode: req.query.mode || "live",
      date: req.query.date,
      time: req.query.time,
      start: req.query.start,
      end: req.query.end,
      limit: req.query.limit,
      example: req.query.example,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`source-health failed: ${err.message}`] });
  }
});

app.get("/api/operator/heatmap-proof", (req, res) => {
  try {
    res.json(buildHeatmapProofResponse());
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_live_execution: true, blockers: [`heatmap proof failed: ${err.message}`] });
  }
});

app.get("/api/operator/heatmap-proof/image/:fixtureId", (req, res) => {
  try {
    const fixture = getHeatmapProofFixture(req.params.fixtureId);
    if (!fixture) return res.status(404).json({ ok: false, read_only: true, no_live_execution: true, error: "heatmap proof fixture unavailable" });
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(fixture.file);
  } catch (err) {
    return res.status(500).json({ ok: false, read_only: true, no_live_execution: true, error: `heatmap proof image failed: ${err.message}` });
  }
});

app.get("/api/research/fake-breakdown-watchlist", async (req, res) => {
  try {
    const payload = await buildFakeBreakdownWatchlistResponse({
      instrument: req.query.instrument || "ES",
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, blockers: [`fake breakdown watchlist failed: ${err.message}`] });
  }
});

app.get("/api/research/ladder-reclaim-watchlist", async (req, res) => {
  try {
    const payload = buildLadderReclaimWatchlistResponse({
      instrument: req.query.instrument || "ES",
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, read_only: true, no_execution: true, blockers: [`ladder reclaim watchlist failed: ${err.message}`] });
  }
});

app.get("/api/research/ladder-reclaim-watchlist/image", (req, res) => {
  try {
    const imagePath = getLadderReclaimCaseImagePath({
      kind: req.query.kind || "positive",
      index: req.query.index || 0,
    });
    if (!imagePath) return res.status(404).json({ ok: false, read_only: true, error: "ladder reclaim case image unavailable" });
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(imagePath);
  } catch (err) {
    return res.status(500).json({ ok: false, read_only: true, error: `ladder reclaim case image failed: ${err.message}` });
  }
});

app.post("/edit", (req, res) => {
  const { file, description } = req.body || {};
  log("blocked-http-edit", { route: "/edit", file: file || null, description: description || null });
  res.status(403).json({ error: "Runtime edit endpoint disabled. Use an external coder workflow." });
});

app.post("/edit-and-restart", (req, res) => {
  const { file, description } = req.body || {};
  log("blocked-http-edit", { route: "/edit-and-restart", file: file || null, description: description || null });
  res.status(403).json({ error: "Runtime edit/restart endpoint disabled. Use an external coder workflow." });
});

app.post("/agent/autonomous/canary", async (req, res) => {
  try {
    const canaryId = "canary-" + Date.now();
    const syntheticSignal = { signal: { ticker: "MNQ", direction: "LONG", entry: 21500, stop: 21460, target: 21580, reason: "[CANARY TEST]" }, risk_dollars: 20, rr: 2, seconds_left: 30, canary: true, canary_id: canaryId };
    broadcast({ type: "staged_trade", ...syntheticSignal });
    const start = Date.now();
    setTimeout(() => {
      const record = { ts: new Date().toISOString(), canary_id: canaryId, duration_ms: Date.now() - start, auto_skipped: true, ok: true };
      try { fs.appendFileSync(CANARY_LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      try { fs.writeFileSync(snapshots.canaryLast, JSON.stringify(record, null, 2)); } catch {}
      log("canary", record);
    }, 30000);
    res.json({ ok: true, canary_id: canaryId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/agent/autonomous/metrics", (req, res) => {
  try {
    const { getSessionMetrics, buildTextSummary } = require("./trading/metrics");
    const hours = Math.max(1, Math.min(parseInt(req.query.hours) || 24, 720));
    const m = getSessionMetrics(hours);
    res.json({ ...m, text_summary: buildTextSummary(m) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/agent/research", require("./agents/agent-06-research"));
app.use("/agent/brain", require("./agents/agent-00-brain"));
app.use("/agent/trader", require("./agents/agent-02-trader"));
app.use("/agent/autonomous", require("./agents/agent-02b-autonomous"));
app.use("/agent/income", require("./agents/agent-03-income"));
app.use("/agent/health", require("./agents/agent-04-health"));
app.use("/agent/finance", require("./agents/agent-05-finance"));
app.use("/agent/opportunity", require("./agents/agent-07-opportunity"));
app.use("/agent/architect", require("./agents/agent-09-architect"));
app.use("/agent/sweeper", require("./agents/agent-10-sweeper"));
app.use("/agent/workflows", require("./agents/agent-13-workflows"));
const { router: tokensRouter, trackUsage, getDailyStatus, isHardCap, isSoftCap } = require("./agents/agent-11-tokens");
app.use("/agent/tokens", tokensRouter);
let _fallbackMod = null;
function _requireFallback() {
  if (!_fallbackMod) _fallbackMod = require('./agents/agent-12-fallback');
  return _fallbackMod;
}
app.use("/agent/fallback", (req, res, next) => _requireFallback().router(req, res, next));
const katRouter = require("./agents/agent-14-kat");
app.use("/agent/kat", katRouter);

// Expose WS token to the browser (localhost only  not a secret across the network)
app.get("/ws-token", (req, res) => res.json({ token: WS_TOKEN }));

app.post("/intraday/start", (req, res) => {
  try {
    try { execSync("pm2 restart luke-intraday --update-env", { cwd: __dirname, windowsHide: true }); }
    catch { execSync("pm2 start luke-intraday --update-env", { cwd: __dirname, windowsHide: true }); }
    log("intraday-start", {});
    res.json({ started: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/intraday/stop", (req, res) => {
  try {
    execSync("pm2 stop luke-intraday", { cwd: __dirname, windowsHide: true });
    log("intraday-stop", {});
    res.json({ stopped: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function gitShaIfAvailable() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true }).trim();
  } catch {
    return null;
  }
}

function buildHealthPayload() {
  const { isMarketOpen } = require("./lib/market-hours");
  const today = new Date().toISOString().slice(0, 10);
  const tradesFile = events.trades;
  const lastSigFile = path.join(__dirname, "data", "last-signal.json");
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")); } catch {}

  let trades_today = 0;
  try {
    trades_today = fs.readFileSync(tradesFile, "utf8").split("\n").filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(t => t && ((t.date || t.timestamp || "").startsWith(today))).length;
  } catch {}

  let last_signal = null;
  try {
    const ls = JSON.parse(fs.readFileSync(lastSigFile, "utf8"));
    last_signal = { type: ls.signal_type, analyst: ls.analyst, ts: ls.date || ls.timestamp || null };
  } catch {}

  return {
    ok: true,
    app: "Luke",
    version: pkg.version || "unknown",
    pid: process.pid,
    port: Number(process.env.PORT || 3000),
    started_at: new Date(SERVER_START).toISOString(),
    git_sha_if_available: gitShaIfAvailable(),
    build_marker_if_available: process.env.LUKE_BUILD_MARKER || null,
    uptime_sec: Math.floor((Date.now() - SERVER_START) / 1000),
    trades_today,
    last_signal,
    market: isMarketOpen(),
  };
}

app.get("/api/health", (req, res) => {
  res.json(buildHealthPayload());
});

app.get("/health", (req, res) => {
  res.json(buildHealthPayload());
});

app.get("/luke/self-diagnose", (req, res) => {
  const out = {
    missing_capabilities: [],
    broken_tools: [],
    stale_data: [],
    open_proposals: 0,
    recent_failures: [],
    suggested_priorities: []
  };

  // Repo map
  try {
    const map = JSON.parse(fs.readFileSync(REPO_MAP_FILE, "utf8"));
    const age = (Date.now() - new Date(map.built).getTime()) / 60000;
    if (age > 90) out.stale_data.push("repo-map.json last built " + Math.round(age) + "m ago");
  } catch { out.missing_capabilities.push("repo-map not built  Luke cannot locate own files"); }

  // Tool failures
  try {
    const lines = fs.readFileSync(TOOL_FAILURES_FILE, "utf8").split("\n").filter(Boolean);
    out.recent_failures = lines.slice(-10).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const searchFails = out.recent_failures.filter(f => f.op === "search");
    if (searchFails.length > 0) out.broken_tools.push("search: " + searchFails.length + " zero-result ops in recent history");
  } catch {}

  // Open proposals
  try {
    out.open_proposals = fs.readdirSync(path.join(__dirname, "state", "runtime", "proposals")).filter(f => f.endsWith(".md")).length;
    if (out.open_proposals > 5) out.stale_data.push(out.open_proposals + " unreviewed proposals in state/runtime/proposals/");
  } catch {}

  // Derive suggestions
  if (out.missing_capabilities.length > 0) out.suggested_priorities.push("run GET /luke/self-diagnose after fixing repo-map");
  if (out.broken_tools.length > 0) out.suggested_priorities.push("review tool-failures.jsonl for search scope issues");

  res.json(out);
});

app.post("/luke/tool-health-nightly", (req, res) => { computeToolHealth(); res.json({ ok: true }); });

app.get("/luke/boot-check", (req, res) => {
  const checks = [];
  function check(name, fn) {
    try { const r = fn(); checks.push({ name, status: r ? "green" : "yellow", detail: r || "not available" }); }
    catch (e) { checks.push({ name, status: "red", detail: e.message }); }
  }
  check("memory-file", () => { readJsonFile(MEMORY_FILE); return "ok"; });
  check("repo-map", () => {
    const map = JSON.parse(fs.readFileSync(REPO_MAP_FILE, "utf8"));
    return (Date.now() - new Date(map.built).getTime()) < 120 * 60000 ? "ok" : null;
  });
  check("agents-dir", () => { fs.readdirSync(path.join(__dirname, "agents")); return "ok"; });
  check("anthropic-key", () => process.env.ANTHROPIC_API_KEY ? "ok" : null);
  check("katbot-token", () => process.env.KAT_BOT_TOKEN ? "ok" : null);
  check("gemini-key", () => process.env.GEMINI_API_KEY ? "ok" : null);
  check("tool-health", () => fs.existsSync(TOOL_HEALTH_FILE) ? "ok" : null);
  check("scheduler-heartbeat", () => fs.existsSync(SCHED_HEARTBEAT_FILE) ? "ok" : null);
  check("scheduler-jobs", () => fs.existsSync(SCHED_JOBS_FILE) ? "ok" : null);
  check("trading-snapshot", () => fs.existsSync(path.join(__dirname, "state", "snapshots", "trading-state.json")) ? "ok" : null);
  check("health-snapshot", () => fs.existsSync(path.join(__dirname, "state", "snapshots", "health-state.json")) ? "ok" : null);
  check("no-schema-errors-today", () => {
    if (!fs.existsSync(SCHEMA_ERRORS_FILE)) return "ok";
    const today = fs.readFileSync(SCHEMA_ERRORS_FILE, "utf8").split("\n").filter(Boolean)
      .filter(l => { try { return Date.now() - new Date(JSON.parse(l).ts).getTime() < 86400000; } catch { return false; } });
    return today.length === 0 ? "ok" : null;
  });
  check("tradovate-health", () => {
    if (!fs.existsSync(TRADOVATE_HEALTH_FILE)) return null;
    return JSON.parse(fs.readFileSync(TRADOVATE_HEALTH_FILE, "utf8")).ok ? "ok" : null;
  });
  check("memory-cap", () => (fs.existsSync(MEMORY_FILE) ? fs.statSync(MEMORY_FILE).size : 0) < MEM_CAP_BYTES ? "ok" : null);
  check("canary-recent", () => {
    const f = snapshots.canaryLast;
    if (!fs.existsSync(f)) return null;
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    return c.ok && Date.now() - new Date(c.ts).getTime() < 48 * 3600000 ? "ok" : null;
  });
  const overall = checks.every(c => c.status === "green") ? "green"
    : checks.some(c => c.status === "red") ? "red" : "yellow";
  try { fs.appendFileSync(BOOT_CHECKS_FILE, JSON.stringify({ ts: new Date().toISOString(), overall, checks }) + "\n"); } catch {}
  res.json({ overall, checks });
});

app.post("/luke/log-intervention", (req, res) => {
  const { state, action } = req.body;
  try { fs.appendFileSync(STATE_INTERVENTIONS, JSON.stringify({ ts: new Date().toISOString(), state, action }) + "\n"); } catch {}
  res.json({ ok: true });
});

app.post("/kill-workflow", (req, res) => {
  log("kill-workflow", { triggered: new Date().toISOString() });
  broadcast({ type: "workflow_kill" });
  res.json({ ok: true });
});

app.post("/panic", (req, res) => {
  log("PANIC", { triggered: new Date().toISOString() });
  try { fs.writeFileSync(path.join(__dirname, "panic-dump-" + Date.now() + ".json"), JSON.stringify({ timestamp: new Date().toISOString(), memory: loadMemory() }, null, 2)); } catch {}
  try { fetch("http://localhost:3000/agent/autonomous/kill", { method: "POST" }).catch(() => {}); } catch {}
  try { execSync("pm2 stop luke-intraday", { cwd: __dirname, windowsHide: true }); } catch {}
  broadcast({ type: "notification", message: "PANIC executed  02B kill sent, intraday stopped, state dumped" });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  log("express-error", {
    method: req.method,
    path: req.path,
    message: err?.message || String(err),
  });
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ ok: false, error: "Internal server error" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

//  WS TOKEN  generated each boot, written for preload to read 
const crypto = require("crypto");
const WS_TOKEN = crypto.randomBytes(24).toString("hex");
const WS_TOKEN_FILE = runtime.wsToken;
try { fs.mkdirSync(path.dirname(WS_TOKEN_FILE), { recursive: true }); } catch {}
try { fs.writeFileSync(WS_TOKEN_FILE, WS_TOKEN); } catch {}

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(json);
  }
}

wss.on("connection", (ws, req) => {
  // Validate token from query string: ws://localhost:3000?token=<TOKEN>
  const url = new URL(req.url || "/", "http://localhost:3000");
  const token = url.searchParams.get("token");
  if (token !== WS_TOKEN) {
    ws.close(4401, "Unauthorized");
    log("ws-auth-rejected", { ip: req.socket?.remoteAddress });
    return;
  }
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  // Morning levels warning  fire immediately on connect if levels missing/stale
  try {
    const _levelsOk = hasLevelsLoadedToday(getTodayLevelsFile(__dirname));
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "assistant", message: "I trade the plan. I follow the system. No fear, no freelancing." }));
    }
    if (!_levelsOk && ws.readyState === 1) {
      ws.send(JSON.stringify(makeLevelsWarningPayload()));
      log("UX", { event: "morning levels warning on boot" });
    }
  } catch {}
});

const wsHeartbeat = setInterval(() => {
  for (const ws of clients) {
    if (ws.isAlive === false) {
      clients.delete(ws);
      try { ws.terminate(); } catch {}
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);
wsHeartbeat.unref?.();

global.broadcast = broadcast;

buildRepoMap();
pruneDiscordHistory();
// DISABLED - manual only
// setInterval(buildRepoMap, 60 * 60 * 1000);

try {
  const _st = spawnSync("rg", ["express", "index.js"], { cwd: __dirname, encoding: "utf8", windowsHide: true });
  fs.appendFileSync(TOOL_HEALTH_FILE, JSON.stringify({ ts: new Date().toISOString(), check: "boot-search-test", ok: _st.status === 0 }) + "\n");
} catch {}

// DISABLED - manual only
// setInterval(() => {
//   try {
//     if (!fs.existsSync(SCHED_HEARTBEAT_FILE)) return;
//     const hb = JSON.parse(fs.readFileSync(SCHED_HEARTBEAT_FILE, "utf8"));
//     const now = Date.now();
//     for (const [job, interval] of Object.entries(JOB_INTERVALS)) {
//       if (!hb[job]) continue;
//       const age = now - new Date(hb[job].last_run).getTime();
//       if (age > interval * 2) {
//         const ageH = Math.round(age / 3600000);
//         broadcast({ type: "notification", message: (job.includes("health") ? " " : "") + "SCHEDULER STALE: " + job + " last ran " + ageH + "h ago" });
//         log("sched-heartbeat-alert", { job, age_h: ageH });
//       }
//     }
//   } catch {}
// }, 15 * 60 * 1000);

// DISABLED - manual only
// setInterval(async () => {
//   try {
//     const r = await fetch("http://localhost:3000/agent/autonomous/status");
//     const s = await r.json();
//     if (!s.running || !s.total_eval_pnl || s.total_eval_pnl <= 0 || (s.daily_pnl || 0) <= 0) return;
//     const ratio = s.daily_pnl / s.total_eval_pnl;
//     const level = ratio >= 0.50 ? "violation" : ratio >= 0.45 ? "halt" : ratio >= 0.35 ? "warning" : null;
//     if (level) {
//       if (level !== "warning") broadcast({ type: "notification", message: (level === "violation" ? " " : " ") + "APEX CONCENTRATION: today " + Math.round(ratio * 100) + "% of cumulative [" + level.toUpperCase() + "]" });
//       log("apex-consistency", { ratio: ratio.toFixed(3), daily_pnl: s.daily_pnl, total_eval_pnl: s.total_eval_pnl, level });
//     }
//   } catch {}
// }, 30 * 60 * 1000);

//  CRASH RECOVERY 
const CRASH_DIR  = path.join(__dirname, "logs");
const ARCH_DIR   = path.join(__dirname, "archive");

function writeCrashState(reason, err) {
  try {
    if (!fs.existsSync(CRASH_DIR)) fs.mkdirSync(CRASH_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(CRASH_DIR, `crash-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({
      timestamp: new Date().toISOString(),
      reason,
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.slice(0, 2000) : null
    }, null, 2));
    log("crash", { reason, message: err && err.message ? err.message : String(err) });
  } catch {}
}

// disabled in Phase 1B.6.3  superseded by crash handlers at top of file (write to state/events/crash.log).
// unhandledRejection was dual-logging: both the handler below and the top-of-file handler fired.
// process.on("uncaughtException", (err) => {
//   writeCrashState("uncaughtException", err);
//   process.exit(1);
// });
// process.on("unhandledRejection", (reason) => {
//   writeCrashState("unhandledRejection", reason);
// });

//  BOOT SANITY CHECKS 
(function bootChecks() {
  const required_envs = [];
  const optional_envs = ["ANTHROPIC_API_KEY", "KAT_BOT_TOKEN", "GEMINI_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY"].filter(key => process.env[key]);
  for (const key of required_envs) {
    if (!process.env[key]) {
      console.error(`[boot] FATAL: required env var ${key} is not set`);
      process.exit(1);
    }
  }
  // write-permission check on logs directory
  const testFile = events.lukeLog;
  try { fs.accessSync(path.dirname(testFile), fs.constants.W_OK); }
  catch { console.error("[boot] FATAL: log directory is not writable"); process.exit(1); }

  // required data dirs
  for (const dir of ["data", "state", "agents"]) {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      console.error(`[boot] FATAL: required directory '${dir}' is missing`);
      process.exit(1);
    }
  }
  log("boot-checks-passed", { envs: required_envs, optional_envs });
})();

// On boot: move any old crash files to archive/ and log them
try {
  if (!fs.existsSync(ARCH_DIR)) fs.mkdirSync(ARCH_DIR, { recursive: true });
  const crashFiles = fs.readdirSync(CRASH_DIR).filter(f => f.startsWith("crash-") && f.endsWith(".json"));
  if (crashFiles.length > 0) {
    for (const f of crashFiles) {
      const src = path.join(CRASH_DIR, f);
      const dst = path.join(ARCH_DIR, f);
      try {
        const data = JSON.parse(fs.readFileSync(src, "utf8"));
        log("boot-crash-found", { file: f, reason: data.reason, message: data.message });
        fs.renameSync(src, dst);
      } catch {}
    }
    console.warn(`[boot] Found and archived ${crashFiles.length} crash file(s) from last run.`);
  }
} catch {}

function gracefulShutdown(signal) {
  log("server-shutdown", { signal });
  server.close(() => {
    log("server-shutdown-complete", { signal });
    process.exit(0);
  });
  // Force-kill if clients don't disconnect within 5 seconds
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
server.on("error", err => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Luke server already appears to be running on http://${HOST}:${PORT}; not starting a duplicate server.`);
    process.exit(0);
  }
  throw err;
});
server.listen(PORT, HOST, () => {
  console.log("Luke running on http://localhost:" + PORT);
  const _lvlsLoaded = levelsLoadedLabel(getTodayLevelsFile(__dirname));
  const _tradesToday = (() => {
    try {
      const _t = new Date().toISOString().slice(0, 10);
      return fs.readFileSync(events.trades, "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(_t) || (t.timestamp || "").startsWith(_t))).length;
    } catch { return 0; }
  })();
  console.log("===================================");
  console.log("LUKE ONLINE");
  console.log("===================================");
  console.log("Luke online. Trade the plan.");
  console.log("-----------------------------------");
  console.log(`Levels loaded: ${_lvlsLoaded}`);
  console.log(`Trades today:  ${_tradesToday}`);
  console.log("Type /status in chat for full state.");
  console.log("Read docs/MONDAY_OPS.md before trading.");
  console.log("===================================");
});
