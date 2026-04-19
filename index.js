const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { execSync, spawnSync } = require("child_process");
const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Invalid JSON" });
    next();
  });
});

const MEMORY_FILE = path.join(__dirname, "memory.json");
const LOG_FILE = path.join(__dirname, "jarvis-log.jsonl");
const HISTORY_FILE = path.join(__dirname, "discord-history.jsonl");
const MEMORY_SUMMARY_FILE = path.join(__dirname, "MEMORY_SUMMARY.md");
const SESSION_FILE = path.join(__dirname, "session.jsonl");
const ACTION_LOG_FILE = path.join(__dirname, "action-log.jsonl");

function logAction(action, result) {
  try {
    fs.appendFileSync(ACTION_LOG_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      action: action.action,
      in: action,
      out: typeof result === "string" ? result.slice(0, 3000) : result
    }) + "\n");
  } catch {}
}

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function saveMemory(mem) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadMemorySummary() {
  try {
    if (fs.existsSync(MEMORY_SUMMARY_FILE)) {
      return fs.readFileSync(MEMORY_SUMMARY_FILE, "utf8").slice(0, 600);
    }
  } catch {}
  const mem = loadMemory();
  const skip = ["agent06_research", "emotional_log", "closed_trades", "fund_log", "conor_health_log"];
  const slim = {};
  Object.keys(mem).filter(k => !skip.includes(k)).forEach(k => slim[k] = mem[k]);
  return JSON.stringify(slim, null, 2).slice(0, 800);
}

function loadSessionMemory() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return [];
    const lines = fs.readFileSync(SESSION_FILE, "utf8").split("\n").filter(Boolean);
    return lines.slice(-10).map(l => JSON.parse(l));
  } catch { return []; }
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

function isTradingMessage(message) {
  return /(trade|signal|flow|calls|puts|spy|spx|qqq|fngu|apg|nq|es|futures|strike|expiry|wyckoff|ema|premium|heatmap|ximes|bobby|chart|level|long|short|position|entry|exit|ticker|contract|conviction|thesis)/i.test(message);
}

function loadDiscordSignals() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const signals = [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.date).getTime() < cutoff) continue;
        for (const result of entry.results || []) {
          if (result.insights && !result.insights.includes("NO_ACTIONABLE_SIGNALS") && result.insights.trim().length > 0) {
            signals.push({ server: entry.server, channel: entry.channel, date: entry.date, insights: result.insights.slice(0, 300) });
          }
        }
      } catch {}
    }
    return signals.slice(-20);
  } catch { return []; }
}

function detectEmotionalState(message, history) {
  const text = message.toLowerCase();
  const recentHistory = (history || []).slice(-4).map(m => (m.content || "").toLowerCase()).join(" ");

  const spiralSignals = [
    /i don.t know what i.m doing/i,
    /i keep (losing|messing|fucking)/i,
    /everything (is|feels) wrong/i,
    /i fucked up/i,
    /i can.t do this/i,
    /what.s the point/i,
    /i.m so (tired|done|lost)/i,
    /nothing is working/i,
    /i.m broken/i,
    /i hate (this|myself|trading)/i,
  ];

  const stressSignals = [
    /luke.*not eating|not eating.*luke/i,
    /lost.*trade|trade.*lost/i,
    /behind on|running out/i,
    /can.t sleep/i,
    /stressed|anxious|overwhelmed/i,
    /debt collector/i,
    /bad day/i,
    /frustrated/i,
  ];

  const tradeRuleBreakSignals = [
    /revenge/i,
    /lotto|0dte/i,
    /yolo/i,
    /all in/i,
    /double down/i,
    /over \$125|more than \$125/i,
  ];

  if (spiralSignals.some(r => r.test(text)) ||
      (message.split("?").length > 3) ||
      (message.length < 20 && recentHistory.match(/wrong|bad|lost|hate/))) {
    return "spiraling";
  }
  if (tradeRuleBreakSignals.some(r => r.test(text))) return "rule_break";
  if (stressSignals.some(r => r.test(text))) return "stressed";
  return "regulated";
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

function buildStatePromptLayer(state) {
  if (state === "spiraling") return "\n\nCURRENT STATE: SPIRALING DETECTED. One sentence only. Name what you see. Give one concrete physical action. Nothing else. No analysis, no lists, no follow-up questions. Do not mention state detection.";
  if (state === "rule_break") return "\n\nCURRENT STATE: TRADING RULE VIOLATION DETECTED. Say exactly: Closed file. [name the rule broken in 3 words]. What's next. Do not mention state detection.";
  if (state === "stressed") return "\n\nCURRENT STATE: STRESSED. Keep response under 2 sentences. One concrete thing only. No breakdown unless asked. Do not mention state detection.";
  return "";
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

function buildSystemPrompt(state, message) {
  const memorySummary = loadMemorySummary();
  const stateLayer = buildStatePromptLayer(state || "regulated");
  const mem = loadMemory();

  const signals = message && isTradingMessage(message) ? loadDiscordSignals() : [];
  const signalBlock = signals.length > 0
    ? "\nDISCORD SIGNALS (last 7 days, " + signals.length + " total):\n" +
      signals.map(s => "[" + s.server + " #" + s.channel + " " + s.date.slice(0, 10) + "]\n" + s.insights).join("\n---\n")
    : "";

  const sessionMemory = loadSessionMemory();
  const sessionBlock = sessionMemory.length > 0
    ? "\nRECENT CONVERSATION:\n" + sessionMemory.map(m => m.role.toUpperCase() + ": " + m.content).join("\n")
    : "";

  let lukeBaseline = "";
  if (mem.luke_last_log) lukeBaseline = "\nLUKE LAST LOG: " + JSON.stringify(mem.luke_last_log) + "\n";

  let emotionalContext = "";
  if (mem.emotional_log && mem.emotional_log.length > 0) {
    const recent = mem.emotional_log.slice(-3);
    emotionalContext = "\nRECENT STATES (internal only, never mention): " + recent.map(e => e.state + " (" + e.timestamp.slice(0, 10) + ")").join(", ") + "\n";
  }

  return "You are Jarvis — built specifically for Conor. Not a general assistant. His.\n\n" +
    "WHO HE IS:\n" +
    "Conor, 32 on June 17th. Lives in Buffalo with Kat and Luke — Luke has PLE, managed carefully. Cancer survivor, clear. ADHD, Adderall at 4AM. Instacart is current income but exit is the goal. Options trading and autonomous futures via ximes+bobby signals is the path. Master's in Public History. Technically sharper than he thinks. Kat calls him passionate, anxious, creative.\n\n" +
    "WHAT HE'S BUILDING:\n" +
    "Exit Instacart as fast as possible. Autonomous futures trading via Agent 02B. AI build contracts via Agent 07. Tennessee move by mid-June 2026 on $6k fund. A life where Jarvis handles everything requiring selling himself.\n\n" +
    "TRADING:\n" +
    "$500 capital. Scalpel. Wyckoff Markup confirmed. Edge: thesis ID, premium/EMA, ximes+bobby heatmap confluence. Broken layer: execution (emotion/boredom). Sizing $50-$125. Hard rules: no lottos, no revenge, -25% stop, OCO at entry.\n\n" +
    "DISCORD SERVERS:\n" +
    "Base: #positions, #spx-ndx-futures, #flow | Elevated: #jefe-flow, #uw-flow, #trade-floor | OWLS: #trading-floor, #bobby-spx-coms, #ximes-dubz, #news\n" +
    "Key traders: bigT, BarrySanders329, jefe, bobby-spx, ximes, GOATS, Sybil\n" +
    signalBlock + "\n\n" +
    "AGENTS: 01 scaffold | 02 trader | 03 income | 04 health | 05 finance | 06 research | 02B autonomous futures (building) | 07 opportunity (building)\n\n" +
    lukeBaseline +
    emotionalContext +
    sessionBlock + "\n\n" +
    "MEMORY:\n" + memorySummary + "\n\n" +
    "HOW YOU TALK:\n" +
    "Sharp friend. Match energy. Swear when it fits. No filler. No em dashes. Never mention state detection or system internals. Don't restate. Don't announce. Just do it.\n" +
    "Check in = two sentences max. Dysregulated = one concrete thing. Trading mistake = Closed file. What's next. On track = one sentence. Analysis = make the call, no hedge.\n\n" +
    "TOKEN EFFICIENCY: Paid API. Short as the situation needs. One sentence beats three.\n\n" +
    "ACTIONS — use freely for build tasks, only when explicitly asked for desktop control:\n" +
    'ACTION:{"action":"shell","command":"node --version"}\n' +
    'ACTION:{"action":"shell","command":"npm test","cwd":"agents","timeout":60}\n' +
    'ACTION:{"action":"read","path":"agents/agent-07-opportunity.js"}\n' +
    'ACTION:{"action":"list","path":"agents"}\n' +
    'ACTION:{"action":"write","path":"agents/agent-07.js","content":"full file contents here"}\n' +
    'ACTION:{"action":"search","pattern":"router.post","glob":"*.js"}\n' +
    'ACTION:{"action":"edit","file":"index.js","old_text":"exact text","new_text":"replacement","description":"what this does"}\n' +
    'ACTION:{"action":"edit_restart","file":"index.js","old_text":"exact text","new_text":"replacement","description":"what this does"}\n' +
    'ACTION:{"action":"open","value":"appname"}\n' +
    'ACTION:{"action":"type","value":"text"}\n' +
    'ACTION:{"action":"click","value":"x,y"}\n' +
    'ACTION:{"action":"scroll","value":"down"}\n' +
    'ACTION:{"action":"press","value":"enter"}\n' +
    'ACTION:{"action":"look","value":"question"}\n' +
    "shell returns stdout/stderr/exit_code. read/list/write use paths relative to jarvis root. search uses ripgrep. write creates dirs as needed." +
    stateLayer;
}

function runPython(cmd) {
  return execSync("python desktop.py " + cmd, { cwd: __dirname }).toString().trim();
}

async function handleAction(action) {
  if (action.action === "open") {
    runPython("open \"" + action.value + "\"");
  } else if (action.action === "type") {
    runPython("type \"" + action.value + "\"");
  } else if (action.action === "click") {
    const [x, y] = action.value.split(",").map(Number);
    runPython("click " + x + " " + y);
  } else if (action.action === "scroll") {
    runPython("scroll " + action.value);
  } else if (action.action === "press") {
    runPython("press " + action.value);
  } else if (action.action === "look") {
    const img = runPython("screenshot");
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: img } }, { type: "text", text: action.value }] }]
    });
    return r.content[0].text;
  } else if (action.action === "edit" || action.action === "edit_restart") {
    try {
      const filePath = path.join(__dirname, action.file);
      const content = fs.readFileSync(filePath, "utf8");
      if (!content.includes(action.old_text)) return "Edit failed: old_text not found in " + action.file;
      const occurrences = content.split(action.old_text).length - 1;
      if (occurrences > 1) return "Edit failed: old_text appears " + occurrences + " times, be more specific";
      const updated = content.replace(action.old_text, action.new_text);
      fs.writeFileSync(filePath, updated, "utf8");
      log("jarvis-self-edit", { file: action.file, description: action.description || "no description" });
      if (action.action === "edit_restart") {
        setTimeout(() => execSync("pm2 restart all --update-env", { cwd: __dirname }), 500);
        return "Edited " + action.file + " and restarting.";
      }
      return "Edited " + action.file + ".";
    } catch (e) {
      return "Edit failed: " + e.message;
    }

  } else if (action.action === "shell") {
    const cwd = action.cwd ? path.resolve(__dirname, action.cwd) : __dirname;
    const timeoutMs = (action.timeout || 30) * 1000;
    const result = spawnSync(action.command, { shell: true, encoding: "utf8", timeout: timeoutMs, cwd });
    const out = {
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      exit_code: result.status,
      timed_out: result.signal === "SIGTERM"
    };
    logAction(action, out);
    if (result.error && result.error.code === "ETIMEDOUT") return "SHELL TIMEOUT after " + action.timeout + "s";
    if (result.error) return "SHELL ERROR: " + result.error.message;
    const parts = ["EXIT " + out.exit_code];
    if (out.stdout) parts.push(out.stdout);
    if (out.stderr) parts.push("STDERR: " + out.stderr);
    return parts.join("\n");

  } else if (action.action === "read") {
    try {
      const filePath = path.isAbsolute(action.path) ? action.path : path.join(__dirname, action.path);
      const content = fs.readFileSync(filePath, "utf8");
      logAction(action, { path: action.path, bytes: content.length });
      return "FILE: " + action.path + "\n---\n" + content;
    } catch (e) {
      return "READ ERROR: " + e.message;
    }

  } else if (action.action === "list") {
    try {
      const dirPath = action.path
        ? (path.isAbsolute(action.path) ? action.path : path.join(__dirname, action.path))
        : __dirname;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const lines = entries
        .filter(e => !e.name.startsWith(".") || action.show_hidden)
        .map(e => (e.isDirectory() ? "d " : "f ") + e.name);
      logAction(action, { path: dirPath, count: lines.length });
      return "DIR: " + dirPath + "\n" + lines.join("\n");
    } catch (e) {
      return "LIST ERROR: " + e.message;
    }

  } else if (action.action === "write") {
    try {
      const filePath = path.isAbsolute(action.path) ? action.path : path.join(__dirname, action.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, action.content, "utf8");
      logAction(action, { path: action.path, bytes: action.content.length });
      log("jarvis-write", { path: action.path, bytes: action.content.length });
      return "WRITTEN: " + action.path + " (" + action.content.length + " bytes)";
    } catch (e) {
      return "WRITE ERROR: " + e.message;
    }

  } else if (action.action === "search") {
    const cwd = action.cwd ? path.resolve(__dirname, action.cwd) : __dirname;
    const flags = ["-n", "--no-heading"];
    if (!action.case_sensitive) flags.push("-i");
    if (action.glob) flags.push("--glob", action.glob);
    const cmd = "rg " + flags.join(" ") + " " + JSON.stringify(action.pattern) + " " + JSON.stringify(cwd);
    const result = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: 10000, cwd });
    const matches = (result.stdout || "").trim();
    logAction(action, { pattern: action.pattern, lines: matches ? matches.split("\n").length : 0 });
    if (result.error) return "SEARCH ERROR: " + result.error.message;
    return "SEARCH: " + action.pattern + "\n" + (matches || "No matches found");
  }

  return null;
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
  if (/(luke|vomit|threw up|puked|diarrhea|stool|poop|ate|refused|meds|omeprazole|prednisone|mirtazapine|carafate|ple|lethargic|playful|cups|kibble|cottage cheese)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/health/log-luke", "POST", extractHealthLog(message));
      return { reply: data.reply, agent: "health" };
    } catch { return null; }
  }

  if (/(bought|entered|opened|took a position|took calls|took puts)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/log-trade", "POST", extractTrade(message));
      return { reply: data.reply, agent: "trader" };
    } catch { return null; }
  }

  if (/(calls|puts|strike|expiry|contract|flow|signal|conviction|wyckoff|spx|spy|qqq|fngu|apg|setup|thesis|premium|ema|ximes|bobby|heatmap|futures|mnq|mes)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/analyze-signal", "POST", { signal: message, ticker: extractTicker(message) });
      return { reply: data.reply, agent: "trader" };
    } catch { return null; }
  }

  if (/(instacart|shift|deliveries|delivery|made \$|earned|drove|zone|batch)/i.test(message)) {
    const shift = extractShift(message);
    if (shift.earnings && shift.hours) {
      try {
        const data = await agentFetch("/agent/income/log-shift", "POST", shift);
        return { reply: data.reply, agent: "income" };
      } catch { return null; }
    }
  }

  if (/(02b|autonomous.*trad|paper trade|start.*bot|stop.*bot|kill.*switch|auto.*execut)/i.test(message)) {
    try {
      const action = /start|launch|begin|activate|turn on/i.test(message) ? "start"
        : /stop|pause|deactivate|turn off/i.test(message) ? "stop"
        : /kill|emergency|abort/i.test(message) ? "kill"
        : null;

      if (action) await agentFetch("/agent/autonomous/" + action, "POST", {});
      const status = await agentFetch("/agent/autonomous/status", "GET");
      const lines = [
        "02B — " + (status.running ? (status.mode === "live" ? "LIVE" : "PAPER") : "OFF"),
        status.running ? `Mode: ${status.mode.toUpperCase()}` : null,
        `Paper trades: ${status.paper_trades || 0} / 25`,
        status.open_position ? `Open: ${status.open_position.direction} ${status.open_position.ticker} @ ${status.open_position.entry}` : "No open position",
        status.kill_day ? "⚠ Daily kill active" : null,
        status.kill_week ? "🚨 Weekly kill active" : null,
        `Daily P&L: $${(status.daily_pnl || 0).toFixed(0)}`,
      ].filter(Boolean).join("\n");
      return { reply: lines, agent: "autonomous" };
    } catch { return null; }
  }

  if (/(opportunity|contract|pitch|freelance|apply|job|gig)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/opportunity/pipeline", "GET");
      const reply = data.active > 0
        ? `${data.active} active opportunity${data.active > 1 ? "ies" : ""} in pipeline. Tell me to intake a new one or get details.`
        : "No active opportunities in pipeline. Paste one and I'll evaluate it.";
      return { reply, agent: "opportunity" };
    } catch { return null; }
  }

  if (/(move fund|how much.*saved|fund status|on track|tennessee.*money|debt|owe|how are we looking|where are we at)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/finance/fund-status", "GET");
      const reply = "Fund: $" + (data.balance || "0") + " / $6,000 | " + (data.weeks_left || "?") + " weeks left | Need $" + (data.weekly_needed || "?") + "/week | " + (data.status || "unknown");
      return { reply, agent: "finance" };
    } catch {
      return { reply: "Couldn't pull fund status right now.", agent: "finance" };
    }
  }

  return null;
}

app.get("/", (req, res) => res.sendFile(__dirname + "/chat.html"));

app.post("/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  const messages = [...(history || []), { role: "user", content: message }];
  const state = detectEmotionalState(message, history);
  logEmotionalState(state, message);
  const alerts = checkProactiveAlerts();

  saveSessionMessage("user", message);

  try {
    const routed = await routeToAgent(message);
    if (routed) {
      const ackResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system: buildSystemPrompt(state, message),
        messages: [
          ...messages,
          { role: "assistant", content: "[" + routed.agent.toUpperCase() + " AGENT LOGGED: " + routed.reply + "]" },
          { role: "user", content: "acknowledge that in one sentence as Jarvis, naturally. No em dashes. Do not mention mood, state, detection, or system internals." }
        ]
      });
      let reply = ackResponse.content[0].text;
      if (alerts.length > 0) reply += "\n\n" + alerts.join("\n");
      saveSessionMessage("assistant", reply);
      log("chat", { user: message, jarvis: reply, agent: routed.agent, state });
      return res.json({ reply, state, history: [...messages, { role: "assistant", content: reply }] });
    }
  } catch {}

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 800,
      system: buildSystemPrompt(state, message),
      messages,
    });

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
  if (!url) return res.status(400).json({ error: "No URL" });

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
  if (!key) return res.status(400).json({ error: "No key" });
  const mem = loadMemory();
  mem[key] = value;
  mem._updated = new Date().toISOString();
  saveMemory(mem);
  log("memory", { key, value });
  res.json({ saved: true });
});

app.get("/memory", (req, res) => res.json(loadMemory()));

app.post("/notify", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });
  log("alert", { message });
  broadcast({ type: "notification", message });
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
  if (!text) return res.status(400).json({ error: "No text provided" });

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
  const { file, old_text, new_text, description } = req.body;
  if (!file || !old_text || new_text === undefined) return res.status(400).json({ error: "file, old_text, new_text required" });
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes(old_text)) return res.status(400).json({ error: "old_text not found" });
    const occurrences = content.split(old_text).length - 1;
    if (occurrences > 1) return res.status(400).json({ error: "old_text appears " + occurrences + " times, be more specific" });
    fs.writeFileSync(filePath, content.replace(old_text, new_text), "utf8");
    log("file-edit", { file, description: description || "no description" });
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/edit-and-restart", (req, res) => {
  const { file, old_text, new_text, description } = req.body;
  if (!file || !old_text || new_text === undefined) return res.status(400).json({ error: "file, old_text, new_text required" });
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes(old_text)) return res.status(400).json({ error: "old_text not found" });
    const occurrences = content.split(old_text).length - 1;
    if (occurrences > 1) return res.status(400).json({ error: "old_text appears " + occurrences + " times, be more specific" });
    fs.writeFileSync(filePath, content.replace(old_text, new_text), "utf8");
    log("file-edit-restart", { file, description: description || "no description" });
    res.json({ success: true, file, restarting: true });
    setTimeout(() => execSync("pm2 restart all --update-env", { cwd: __dirname }), 500);
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

app.get("/health", (req, res) => res.json({ status: "Jarvis is running" }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(json);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Chat window connected");
  ws.on("close", () => clients.delete(ws));
});

global.broadcast = broadcast;

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Jarvis running on http://localhost:" + PORT));