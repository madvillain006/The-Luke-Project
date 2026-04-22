require('dotenv').config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { execSync, spawnSync } = require("child_process");
const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { readJsonFile, writeJsonAtomic } = require("./state/lib");
const { parseXimes } = require("./lib/parse-ximes");
const { parseBobby, parseBobbyImage } = require("./lib/parse-bobby");
const { detectConfluence, inferInstrument } = require("./lib/confluence");
const { checkEmotionalState, loadTodayContext } = require("./lib/emotional-exits");
const { log } = require("./lib/logger");
const { loadMemory, saveMemory } = require("./lib/memory");
const { buildSystemPrompt, loadDiscordSignals, pruneDiscordHistory } = require("./lib/system-prompt");
const { handleAction, runPython } = require("./lib/actions");
const { handleSlashCommand } = require("./lib/slash-commands");
const { validateMemoryKey, MAX_TEXT_BYTES, MAX_URL_LENGTH } = require("./lib/validators");
const { detectPasteIntent } = require("./lib/detect-paste");

const rateLimit = require("express-rate-limit");
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── CORS — localhost only ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ── RATE LIMITING ────────────────────────────────────────────────────────────
const rl = (max, windowMs = 60000) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
app.use("/chat",           rl(60));
app.use("/notify",         rl(10));
app.use("/agent",          rl(30));
app.use("/research",       rl(20));
app.use("/paste-signals",  rl(20));
app.use(rl(100)); // global fallback

app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Invalid JSON" });
    next();
  });
});

const MEMORY_FILE        = path.join(__dirname, "memory.json");
const MEMORY_SUMMARY_FILE = path.join(__dirname, "MEMORY_SUMMARY.md");
const SESSION_FILE       = path.join(__dirname, "session.jsonl");
const REPO_MAP_FILE          = path.join(__dirname, "repo-map.json");
const TOOL_FAILURES_FILE     = path.join(__dirname, "tool-failures.jsonl");
const TOOL_CALLS_FILE        = path.join(__dirname, "tool-calls.jsonl");
const TOOL_HEALTH_FILE       = path.join(__dirname, "tool-health.jsonl");
const SCHEMA_ERRORS_FILE     = path.join(__dirname, "schema-errors.jsonl");
const SCHED_HEARTBEAT_FILE   = path.join(__dirname, "scheduler-heartbeat.json");
const SCHED_JOBS_FILE        = path.join(__dirname, "scheduler-jobs.json");
const CANARY_LOG_FILE        = path.join(__dirname, "canary-log.jsonl");
const TRADOVATE_HEALTH_FILE  = path.join(__dirname, "tradovate-health.json");
const STATE_INTERVENTIONS    = path.join(__dirname, "state-interventions.jsonl");
const BOOT_CHECKS_FILE       = path.join(__dirname, "boot-checks.jsonl");
const SCRAPE_RESULT_FILE     = path.join(__dirname, "scrape-result.json");

const JOB_INTERVALS = {
  "morning-briefing":  24 * 3600000,
  "pre-market-scan":   24 * 3600000,
  "generate-documents": 24 * 3600000,
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
  const mem = loadMemory();
  const alerts = [];

  if (mem.luke_last_log) {
    const lastLog = new Date(mem.luke_last_log.date);
    const hoursSince = (Date.now() - lastLog.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) alerts.push("No Luke log in " + Math.floor(hoursSince) + " hours. How's he doing?");
  }


  return alerts;
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
  // Prioritize "made $87" / "earned $87" / "$87" — don't grab hours number first
  const earningsMatch = message.match(/(?:made|earned)\s*\$\s*([\d]+(?:\.\d+)?)/i)
    || message.match(/\$\s*([\d]+(?:\.\d+)?)/)
    || message.match(/([\d]+(?:\.\d+)?)/);
  const hoursMatch = message.match(/([\d.]+)\s*hours?/i);
  const milesMatch = message.match(/([\d.]+)\s*miles?/i);
  return { earnings: earningsMatch ? parseFloat(earningsMatch[1]) : null, hours: hoursMatch ? parseFloat(hoursMatch[1]) : null, miles: milesMatch ? parseFloat(milesMatch[1]) : null, notes: message };
}

function extractHealthLog(message) {
  return {
    vomiting: /vomit|threw up|puked/i.test(message),
    stool: /diarrhea/i.test(message) ? "diarrhea" : /solid|normal|formed/i.test(message) ? "normal" : null,
    food_eaten: /refused|wouldn't eat|didn't eat|not eating/i.test(message) ? "refused" : /ate|eating|finished|cups/i.test(message) ? "ate" : null,
    energy: /lethargic|tired|low energy/i.test(message) ? "low" : /playful|active|toys|moving around/i.test(message) ? "good" : null,
    notes: message
  };
}

async function agentFetch(endpoint, method, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch("http://localhost:3000" + endpoint, opts);
  return r.json();
}

async function routeToAgent(message) {
  if (/show.*luke.*draft|list.*luke.*draft/i.test(message)) {
    try {
      const data = await agentFetch("/agent/health/drafts-luke", "GET");
      const drafts = data.drafts || [];
      if (drafts.length === 0) return { reply: "No pending Luke drafts.", agent: "health" };
      const lines = drafts.map(d => `${d.id}: food=${d.entry.food_eaten || "?"}, stool=${d.entry.stool || "?"}, vomit=${d.entry.vomiting ? "yes" : "no"}, notes=${(d.entry.notes || "").slice(0, 40)}`);
      return { reply: "Pending Luke drafts:\n" + lines.join("\n"), agent: "health" };
    } catch (err) {
      log("agent-fetch-error", { agent: "health", endpoint: "/agent/health/drafts-luke", error: err.message });
      return { reply: `[health agent error: ${err.message}]`, agent: "health-error" };
    }
  }

  const lukeConfirmMatch = message.match(/confirm\s+(luke-draft-\d+)/i);
  if (lukeConfirmMatch) {
    try {
      const data = await agentFetch("/agent/health/confirm-luke", "POST", { id: lukeConfirmMatch[1] });
      return { reply: data.reply, agent: "health" };
    } catch (err) {
      log("agent-fetch-error", { agent: "health", endpoint: "/agent/health/confirm-luke", error: err.message });
      return { reply: `[health agent error: ${err.message}]`, agent: "health-error" };
    }
  }

  if (/(luke|vomit|threw up|puked|diarrhea|stool|poop|ate|refused|meds|omeprazole|prednisone|mirtazapine|carafate|ple|lethargic|playful|cups|kibble|cottage cheese)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/health/draft-luke", "POST", extractHealthLog(message));
      return { reply: data.reply, agent: "health" };
    } catch (err) {
      log("agent-fetch-error", { agent: "health", endpoint: "/agent/health/draft-luke", error: err.message });
      return { reply: `[health agent error: ${err.message}]`, agent: "health-error" };
    }
  }

  if (/(bought|entered|opened|took a position|took calls|took puts)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/log-trade", "POST", extractTrade(message));
      return { reply: data.reply, agent: "trader" };
    } catch (err) {
      log("agent-fetch-error", { agent: "trader", endpoint: "/agent/trader/log-trade", error: err.message });
      return { reply: `[trader agent error: ${err.message}]`, agent: "trader-error" };
    }
  }

  if (/(calls|puts|strike|expiry|contract|flow|signal|conviction|wyckoff|spx|spy|qqq|fngu|apg|setup|thesis|premium|ema|ximes|bobby|heatmap|futures|mnq|mes)/i.test(message)) {
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
        "02B — " + (status.running ? (status.mode === "live" ? "LIVE" : "PAPER") : "OFF"),
        status.running ? `Mode: ${status.mode.toUpperCase()}` : null,
        status.execution?.phase ? `Execution: ${status.execution.phase}` : null,
        `Paper trades: ${status.paper_trades || 0} / 25`,
        status.open_position ? `Open: ${status.open_position.direction} ${status.open_position.ticker} @ ${status.open_position.entry}` : "No open position",
        status.kill_day ? "⚠ Daily kill active" : null,
        status.kill_week ? "🚨 Weekly kill active" : null,
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

app.get("/", (req, res) => res.sendFile(__dirname + "/chat.html"));

app.post("/chat", async (req, res) => {
  const { message, history, image } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  // ── slash command intercept ────────────────────────────────────────────────
  let routedMessage = message;
  if (!message.startsWith("/")) {
    const { command, cleanedText } = detectPasteIntent(message, !!image);
    if (command) routedMessage = command + " " + cleanedText;
  }
  if (routedMessage.startsWith("/")) {
    if (image && routedMessage.startsWith("/heatmap")) res._heatmapImage = image;
    const handled = await handleSlashCommand(routedMessage, res);
    if (handled !== null) return;
  }

  // ── end slash commands ────────────────────────────────────────────────────

  // ── parseXimes intercept — catch signals before Claude fallthrough ────
  if (message.length >= 8 && !message.startsWith("/")) {
    const parsed = parseXimes(null, message);
    if (parsed && parsed.signal_type === "LIVE_ENTRY" && parsed.strike) {
      const alertMsg = "/alert " + message;
      const handled = await handleSlashCommand(alertMsg, res);
      if (handled !== null) return;
    }
    if (parsed && parsed.signal_type === "MANAGEMENT") {
      const actions = {
        TRIM: "⚡ XIMES TRIM — Take partial profits now.\n" +
          (parsed.gainPct ? "He called " + parsed.gainPct + "% gain.\n" : "") +
          "→ Close 50-75% of position. Hold runner.",
        RUNNER: "🏃 XIMES RUNNER — Hold partial position.\n" +
          (parsed.sizing ? "He has " + parsed.sizing + " cons left (" + parsed.pctRemaining + "%).\n" : "") +
          "→ Keep 20-25% on. Move stop to breakeven.",
        CLOSE: "🚪 XIMES EXIT — Close position now.",
        ADD: "➕ XIMES ADDING — He is sizing in further.\n→ Consider adding within your risk parameters.",
      };
      const reply = actions[parsed.action] || "XIMES: " + parsed.action;
      return res.json({ reply });
    }
  }
  // ── end parseXimes intercept ──────────────────────────────────────────

  const messages = [...(history || []), { role: "user", content: message }];
  const _exitWarnings = checkEmotionalState(loadTodayContext());
  const state = _exitWarnings.find(w => w.type === "HARD") ? "rule_break"
    : _exitWarnings.length > 0 ? "stressed"
    : "regulated";
  logEmotionalState(state, message);
  const alerts = checkProactiveAlerts();

  saveSessionMessage("user", message);

  const ACK_SYSTEM = "You are Jarvis. Acknowledge this agent result in one sentence. Be brief. No em dashes.";

  try {
    const routed = await routeToAgent(message);
    if (routed) {
      const ackResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system: ACK_SYSTEM,
        messages: [
          ...messages,
          { role: "assistant", content: "[" + routed.agent.toUpperCase() + " AGENT LOGGED: " + routed.reply + "]" },
          { role: "user", content: "acknowledge that in one sentence as Jarvis, naturally. No em dashes. Do not mention mood, state, detection, or system internals." }
        ]
      });
      trackUsage("main-ack", "claude-haiku-4-5-20251001", ackResponse.usage?.input_tokens || 0, ackResponse.usage?.output_tokens || 0);
      let reply = ackResponse.content[0].text;
      if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
      saveSessionMessage("assistant", reply);
      log("chat", { user: message, jarvis: reply, agent: routed.agent, state });
      return res.json({ reply, state, history: [...messages, { role: "assistant", content: reply }] });
    }
  } catch {}

  // A10: fallback routing when hard cap hit
  if (isFallbackActive()) {
    try {
      const fb = await callFallback(
        "You are Jarvis — Conor's personal assistant. Keep it brief and direct.",
        message
      );
      let reply = fb.reply;
      if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
      saveSessionMessage("assistant", reply);
      log("chat-fallback", { user: message, provider: fb.provider, state });
      return res.json({ reply, state, fallback: true, provider: fb.provider, history: [...messages, { role: "assistant", content: reply }] });
    } catch (fbErr) {
      log("fallback-error", { error: fbErr.message });
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
  const chatSystemPrompt = useHaiku
    ? "You are Jarvis — Conor's personal AI. Sharp, brief, no filler. No em dashes."
    : buildSystemPrompt(state, message);

  try {
    const response = await client.messages.create({
      model: chatModel,
      max_tokens: useHaiku ? 150 : 800,
      system: chatSystemPrompt,
      messages,
    });
    trackUsage("main-chat", chatModel, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);

    let reply = response.content[0].text;
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
    log("chat", { user: message, jarvis: reply, state });
    res.json({ reply, state, action, history: [...messages, { role: "assistant", content: response.content[0].text }] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/see", async (req, res) => {
  const { question } = req.body;
  try {
    const img = runPython("screenshot");
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
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image" });
  try {
    const result = await parseBobbyImage(image);
    if (!result) return res.status(422).json({ error: "No levels extracted from image" });

    const levelsFile = path.join(__dirname, "data", "today-levels.json");
    const today = new Date().toISOString().slice(0, 10);
    let obj;
    try { obj = JSON.parse(fs.readFileSync(levelsFile, "utf8")); } catch { obj = { date: today, richyd: [], bobby: [] }; }
    result.date = new Date().toISOString();
    result.source = 'bobby-vision';
    obj.bobby = [...(obj.bobby || []), result];
    fs.writeFileSync(levelsFile, JSON.stringify(obj, null, 2), "utf8");

    const kings  = (result.king_nodes || []).join(", ") || "none";
    const walls  = (result.resistance || []).join(", ") || "none";
    const floors = (result.support || []).join(", ") || "none";
    const pockets = (result.air_pockets || []).join(", ") || "none";
    const summary = `King nodes: ${kings}. Walls: ${walls}. Floors: ${floors}. Air pockets: ${pockets}. Bias: ${result.bias}.`;
    res.json({ reply: `${summary} Bobby heatmap loaded to confluence.` });
  } catch (err) {
    res.status(500).json({ error: "Vision failed" });
  }
});

app.post("/premarket", (req, res) => {
  try {
    const { runPreMarketScan } = require("./intraday-scraper");
    res.json({ started: true });
    runPreMarketScan().catch(console.error);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/do", async (req, res) => {
  const { action, value } = req.body;
  try {
    let result;
    if (action === "open") result = runPython("open \"" + value + "\"");
    else if (action === "type") result = runPython("type \"" + value + "\"");
    else if (action === "click") { const [x, y] = value.split(",").map(Number); result = runPython("click " + x + " " + y); }
    else if (action === "scroll") result = runPython("scroll " + value);
    else if (action === "press") result = runPython("press " + value);
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

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 384,
      messages: [{ role: "user", content: "You are Agent 06 — research agent for Jarvis. Extract what is useful for building a personal AI agent system or for trading.\n\nURL: " + url + "\n\nCONTENT:\n" + text + "\n\nFormat exactly like this:\nKEY INSIGHT: one sentence\nAPPLIES TO: scaffold / trader / research / all\nIMPLEMENTATION: one sentence\nPRIORITY: HIGH / MEDIUM / LOW\n\nUnder 80 words total. If not relevant to AI agents or trading, say: NOT RELEVANT" }]
    });

    const insight = response.content[0].text;

    if (!insight.includes("NOT RELEVANT")) {
      const mem = loadMemory();
      if (!mem.agent06_research) mem.agent06_research = [];
      mem.agent06_research.push({ url, insight, date: new Date().toISOString() });
      mem.agent06_last_run = new Date().toISOString();
      saveMemory(mem);
      log("research", { url, insight });
    }

    res.json({ reply: insight });
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
    "generate-documents": 30,
    "discord-scrape": 30,
    "agent-assessments": 30,
    "pre-market-scan": 30,
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
    const { runScraper } = require("./discord-scraper");
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

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: "Extract every trading signal, level call, and directional bias from this Discord channel paste. Source: " + (source || "unknown") + "\n\nFor each signal found:\nTICKER: \nDIRECTION: \nLEVEL: \nTIMESTAMP: (if visible)\nNOTES: \n\nPaste:\n" + text.slice(0, 8000)
      }]
    });

    const insights = response.content[0].text;
    const entry = { date: new Date().toISOString(), source: source || "manual-paste", results: [{ scroll: 1, raw: text.slice(0, 500), insights }] };
    fs.appendFileSync(path.join(__dirname, "discord-history.jsonl"), JSON.stringify(entry) + "\n");
    log("paste-signals", { source, length: text.length });
    res.json({ reply: insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/signals", (req, res) => {
  const signals = loadDiscordSignals();
  res.json({ count: signals.length, signals });
});

app.get("/state", (req, res) => {
  const mem = loadMemory();
  res.json({ current_state: mem.current_state || "regulated", emotional_log: (mem.emotional_log || []).slice(-10) });
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
      try { fs.writeFileSync(path.join(__dirname, "canary-last.json"), JSON.stringify(record, null, 2)); } catch {}
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
app.use("/agent/trader", require("./agents/agent-02-trader"));
app.use("/agent/autonomous", require("./agents/agent-02b-autonomous"));
app.use("/agent/income", require("./agents/agent-03-income"));
app.use("/agent/health", require("./agents/agent-04-health"));
app.use("/agent/finance", require("./agents/agent-05-finance"));
app.use("/agent/opportunity", require("./agents/agent-07-opportunity"));
app.use("/agent/sienna", require("./agents/agent-08-sienna"));
app.use("/agent/architect", require("./agents/agent-09-architect"));
app.use("/agent/sweeper",  require("./agents/agent-10-sweeper"));
const { router: tokensRouter, trackUsage, getDailyStatus, isHardCap, isSoftCap } = require("./agents/agent-11-tokens");
app.use("/agent/tokens", tokensRouter);
const { router: fallbackRouter, isActive: isFallbackActive, callFallback } = require("./agents/agent-12-fallback");
app.use("/agent/fallback", fallbackRouter);
const agentKat = require('./agents/agent-14-kat');
app.use('/agent/kat', agentKat);

// Expose WS token to the browser (localhost only — not a secret across the network)
app.get("/ws-token", (req, res) => res.json({ token: WS_TOKEN }));

app.post("/intraday/start", (req, res) => {
  try {
    try { execSync("pm2 restart jarvis-intraday --update-env", { cwd: __dirname }); }
    catch { execSync("pm2 start jarvis-intraday --update-env", { cwd: __dirname }); }
    log("intraday-start", {});
    res.json({ started: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/intraday/stop", (req, res) => {
  try {
    execSync("pm2 stop jarvis-intraday", { cwd: __dirname });
    log("intraday-stop", {});
    res.json({ stopped: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/health", (req, res) => {
  const { isMarketOpen } = require("./lib/market-hours");
  const today = new Date().toISOString().slice(0, 10);
  const tradesFile = path.join(__dirname, "trades.jsonl");
  const lastSigFile = path.join(__dirname, "data", "last-signal.json");

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

  res.json({
    ok: true,
    uptime_sec: Math.floor((Date.now() - SERVER_START) / 1000),
    version: "2.0",
    trades_today,
    last_signal,
    market: isMarketOpen(),
  });
});

app.get("/jarvis/self-diagnose", (req, res) => {
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
  } catch { out.missing_capabilities.push("repo-map not built — Jarvis cannot locate own files"); }

  // Tool failures
  try {
    const lines = fs.readFileSync(TOOL_FAILURES_FILE, "utf8").split("\n").filter(Boolean);
    out.recent_failures = lines.slice(-10).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const searchFails = out.recent_failures.filter(f => f.op === "search");
    if (searchFails.length > 0) out.broken_tools.push("search: " + searchFails.length + " zero-result ops in recent history");
  } catch {}

  // Open proposals
  try {
    out.open_proposals = fs.readdirSync(path.join(__dirname, "proposals")).filter(f => f.endsWith(".md")).length;
    if (out.open_proposals > 5) out.stale_data.push(out.open_proposals + " unreviewed proposals in proposals/");
  } catch {}

  // Memory staleness
  try {
    const stat = fs.statSync(MEMORY_SUMMARY_FILE);
    const days = (Date.now() - stat.mtimeMs) / 86400000;
    if (days > 3) out.stale_data.push("MEMORY_SUMMARY.md last updated " + Math.round(days) + " days ago");
  } catch {}

  // Arch log recent errors
  try {
    const archLines = fs.readFileSync(path.join(__dirname, "ARCHITECT_LOG.jsonl"), "utf8").split("\n").filter(Boolean);
    const recent = archLines.slice(-20).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const errors = recent.filter(e => e.scan_error || e.skipped);
    if (errors.length > 0) out.stale_data.push("agent-09 recent issues: " + errors.map(e => e.scan_error || e.skipped).join(", "));
  } catch {}

  // Derive suggestions
  if (out.missing_capabilities.length > 0) out.suggested_priorities.push("run GET /jarvis/self-diagnose after fixing repo-map");
  if (out.broken_tools.length > 0) out.suggested_priorities.push("review tool-failures.jsonl for search scope issues");
  if (out.stale_data.some(s => s.includes("MEMORY"))) out.suggested_priorities.push("refresh MEMORY_SUMMARY.md");

  res.json(out);
});

app.post("/jarvis/tool-health-nightly", (req, res) => { computeToolHealth(); res.json({ ok: true }); });

app.get("/jarvis/boot-check", (req, res) => {
  const checks = [];
  function check(name, fn) {
    try { const r = fn(); checks.push({ name, status: r ? "green" : "yellow", detail: r || "not available" }); }
    catch (e) { checks.push({ name, status: "red", detail: e.message }); }
  }
  check("memory-file", () => { JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); return "ok"; });
  check("repo-map", () => {
    const map = JSON.parse(fs.readFileSync(REPO_MAP_FILE, "utf8"));
    return (Date.now() - new Date(map.built).getTime()) < 120 * 60000 ? "ok" : null;
  });
  check("agents-dir", () => { fs.readdirSync(path.join(__dirname, "agents")); return "ok"; });
  check("anthropic-key", () => process.env.ANTHROPIC_API_KEY ? "ok" : null);
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
    const f = path.join(__dirname, "canary-last.json");
    if (!fs.existsSync(f)) return null;
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    return c.ok && Date.now() - new Date(c.ts).getTime() < 48 * 3600000 ? "ok" : null;
  });
  const overall = checks.every(c => c.status === "green") ? "green"
    : checks.some(c => c.status === "red") ? "red" : "yellow";
  try { fs.appendFileSync(BOOT_CHECKS_FILE, JSON.stringify({ ts: new Date().toISOString(), overall, checks }) + "\n"); } catch {}
  res.json({ overall, checks });
});

app.post("/jarvis/log-intervention", (req, res) => {
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
  try { execSync("pm2 stop jarvis-intraday", { cwd: __dirname }); } catch {}
  broadcast({ type: "notification", message: "PANIC executed — 02B kill sent, intraday stopped, state dumped" });
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

// ── WS TOKEN — generated each boot, written for preload to read ──────────────
const crypto = require("crypto");
const WS_TOKEN = crypto.randomBytes(24).toString("hex");
const WS_TOKEN_FILE = path.join(__dirname, ".ws-token");
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
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  // Morning levels warning — fire immediately on connect if levels missing/stale
  try {
    const _today = new Date().toISOString().slice(0, 10);
    const _lvlsFile = path.join(__dirname, "data", "today-levels.json");
    const _levelsOk = (() => {
      try {
        const o = JSON.parse(fs.readFileSync(_lvlsFile, "utf8"));
        return o.date === _today && ((o.richyd || []).length + (o.bobby || []).length) > 0;
      } catch { return false; }
    })();
    if (!_levelsOk && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "levels_warning", message: "⚠️ No levels loaded. Paste /levels [RichyDubz morning message] then /heatmap [Bobby text] before trading." }));
      ws.send(JSON.stringify({ type: "assistant", message: "💬 I was built because you're tired of losing. Let's make today count." }));
      log("UX", { event: "morning levels warning on boot" });
    }
  } catch {}
});

global.broadcast = broadcast;

buildRepoMap();
pruneDiscordHistory();
// DISABLED - manual only
// setInterval(buildRepoMap, 60 * 60 * 1000);

try {
  const _st = spawnSync("rg express index.js", { shell: true, cwd: __dirname, encoding: "utf8" });
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
//         broadcast({ type: "notification", message: (job.includes("health") ? "🔴 " : "") + "SCHEDULER STALE: " + job + " last ran " + ageH + "h ago" });
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
//       if (level !== "warning") broadcast({ type: "notification", message: (level === "violation" ? "🚨 " : "⚠ ") + "APEX CONCENTRATION: today " + Math.round(ratio * 100) + "% of cumulative [" + level.toUpperCase() + "]" });
//       log("apex-consistency", { ratio: ratio.toFixed(3), daily_pnl: s.daily_pnl, total_eval_pnl: s.total_eval_pnl, level });
//     }
//   } catch {}
// }, 30 * 60 * 1000);

// ── CRASH RECOVERY ──────────────────────────────────────────────────────────
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

process.on("uncaughtException", (err) => {
  writeCrashState("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  writeCrashState("unhandledRejection", reason);
});

// ── BOOT SANITY CHECKS ──────────────────────────────────────────────────────
(function bootChecks() {
  const required_envs = ["ANTHROPIC_API_KEY"];
  for (const key of required_envs) {
    if (!process.env[key]) {
      console.error(`[boot] FATAL: required env var ${key} is not set`);
      process.exit(1);
    }
  }
  // write-permission check on logs directory
  const testFile = path.join(__dirname, "jarvis-log.jsonl");
  try { fs.accessSync(path.dirname(testFile), fs.constants.W_OK); }
  catch { console.error("[boot] FATAL: log directory is not writable"); process.exit(1); }

  // required data dirs
  for (const dir of ["data", "state", "agents"]) {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      console.error(`[boot] FATAL: required directory '${dir}' is missing`);
      process.exit(1);
    }
  }
  log("boot-checks-passed", { envs: required_envs });
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

const PORT = 3000;
server.listen(PORT, "127.0.0.1", () => {
  console.log("Jarvis running on http://localhost:" + PORT);
  const _lvlsLoaded = (() => {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "today-levels.json"), "utf8"));
      return o.date === new Date().toISOString().slice(0, 10) && ((o.richyd || []).length + (o.bobby || []).length > 0) ? "YES" : "NO";
    } catch { return "NO"; }
  })();
  const _tradesToday = (() => {
    try {
      const _t = new Date().toISOString().slice(0, 10);
      return fs.readFileSync(path.join(__dirname, "trades.jsonl"), "utf8").split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(t => t && ((t.date || "").startsWith(_t) || (t.timestamp || "").startsWith(_t))).length;
    } catch { return 0; }
  })();
  console.log("===================================");
  console.log("JARVIS ONLINE");
  console.log("===================================");
  console.log("I was built because you're tired of losing.");
  console.log("-----------------------------------");
  console.log(`Levels loaded: ${_lvlsLoaded ? 'YES' : 'NO'}`);
  console.log(`Trades today:  ${_tradesToday}`);
  console.log("Type /status in chat for full state.");
  console.log("Read DAILY_OPS.md before trading.");
  console.log("===================================");
});

