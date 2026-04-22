const fs = require("fs");
const path = require("path");
const { log } = require("./logger");
const { loadMemory } = require("./memory");
const { LUKE } = require("./config");

const MEMORY_SUMMARY_FILE = path.join(__dirname, "../MEMORY_SUMMARY.md");
const SESSION_FILE        = path.join(__dirname, "../session.jsonl");
const HISTORY_FILE        = path.join(__dirname, "../discord-history.jsonl");
const REPO_MAP_FILE       = path.join(__dirname, "../repo-map.json");

function loadRepoMapBlock() {
  try {
    const map = JSON.parse(fs.readFileSync(REPO_MAP_FILE, "utf8"));
    const files = map.entries.filter(e => e.startsWith("f ")).map(e => e.slice(2));
    const dirs  = map.entries.filter(e => e.startsWith("d ")).map(e => e.slice(2));
    return `REPO_ROOT: ${map.root}\nKEY_FILES: ${files.filter(f => /\.(js|html|json|py|md)$/.test(f) && !f.includes("\\") && !f.includes("/")).join(", ")}\nKEY_DIRS: ${dirs.filter(d => !d.includes("\\") && !d.includes("/")).join(", ")}\nLOG_FILES: ${files.filter(f => f.endsWith(".jsonl") && !f.includes("\\")).join(", ")}`;
  } catch { return `REPO_ROOT: ${path.join(__dirname, "..")}`; }
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
    return lines.slice(-20).map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(m => m && !['✅','⚠️','❌','📊','🔴','🟡','🟢'].some(e => (m.content || '').startsWith(e)))
      .slice(-5)
      .map(m => ({ ...m, content: m.content.slice(0, 150) }));
  } catch { return []; }
}

function isTradingMessage(message) {
  // Require 2+ distinct trading terms OR a high-signal term to avoid false positives
  // like "long day" or "short answer".
  const STRONG_TERMS = /\b(ximes|bobby|wyckoff|heatmap|strike|expiry|premium|mnq|mes|spx|ticker)\b/i;
  const GENERIC_TERMS = /\b(trade|signal|flow|calls|puts|spy|qqq|fngu|apg|nq|es|futures|ema|chart|level|long|short|position|entry|exit|contract|conviction|thesis)\b/gi;
  if (STRONG_TERMS.test(message)) return true;
  const matches = message.match(GENERIC_TERMS) || [];
  const distinct = new Set(matches.map(m => m.toLowerCase()));
  return distinct.size >= 2;
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
            signals.push({ server: entry.server, channel: entry.channel, date: entry.date, insights: result.insights.slice(0, 100) });
          }
        }
      } catch {}
    }
    return signals.slice(-5);
  } catch { return []; }
}

function buildStatePromptLayer(state) {
  if (state === "spiraling") return "\n\nCURRENT STATE: SPIRALING DETECTED. One sentence only. Name what you see. Give one concrete physical action. Nothing else. No analysis, no lists, no follow-up questions. Do not mention state detection.";
  if (state === "rule_break") return "\n\nCURRENT STATE: TRADING RULE VIOLATION DETECTED. Say exactly: Closed file. [name the rule broken in 3 words]. What's next. Do not mention state detection.";
  if (state === "stressed") return "\n\nCURRENT STATE: STRESSED. Keep response under 2 sentences. One concrete thing only. No breakdown unless asked. Do not mention state detection.";
  return "";
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

  const LOG_FRESH_MS = (LUKE.LOG_FRESH_HOURS || 12) * 60 * 60 * 1000;
  let lukeBaseline = "";
  if (mem.luke_last_log) {
    const lastLogMs = new Date(mem.luke_last_log.timestamp || 0).getTime();
    const isStale = Date.now() - lastLogMs > LOG_FRESH_MS;
    if (isStale) {
      const hoursAgo = Math.round((Date.now() - lastLogMs) / (60 * 60 * 1000));
      lukeBaseline = `\nLUKE: No log in ${hoursAgo}h — ask Conor how Luke is doing and remind him to use /luke to log meds.\n`;
    } else {
      lukeBaseline = "\nLUKE LAST LOG (fresh): " + JSON.stringify(mem.luke_last_log) + "\n";
    }
  } else {
    lukeBaseline = "\nLUKE: No log on record — ask Conor how Luke is doing and remind him to use /luke to log meds.\n";
  }

  let emotionalContext = "";
  if (mem.emotional_log && mem.emotional_log.length > 0) {
    const recent = mem.emotional_log.slice(-3);
    emotionalContext = "\nRECENT STATES (internal only, never mention): " + recent.map(e => e.state + " (" + e.timestamp.slice(0, 10) + ")").join(", ") + "\n";
  }

  const repoBlock = loadRepoMapBlock();
  return "You are Jarvis — built specifically for Conor. Not a general assistant. His.\n\n" +
    repoBlock + "\n\n" +
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
    "HARD RULE — LUKE LOGS: You cannot log Luke's meds from conversation. You have no write access to memory from chat. If Conor gives Luke info in chat, tell him to type '/luke' followed by the details. Never say you logged anything. Never pretend the log was saved.\n\n" +
    "ACTIONS — use freely for build tasks, only when explicitly asked for desktop control:\n" +
    'ACTION:{"action":"shell","command":"node --version"}\n' +
    'ACTION:{"action":"shell","command":"npm test","cwd":"agents","timeout":60}\n' +
    'ACTION:{"action":"read","path":"agents/agent-07-opportunity.js"}\n' +
    'ACTION:{"action":"list","path":"agents"}\n' +
    'ACTION:{"action":"write","path":"agents/agent-07.js","content":"full file contents here"} [DISABLED in runtime lockdown]\n' +
    'ACTION:{"action":"search","pattern":"router.post"} — searches ALL files (no glob = full codebase)\n' +
    'ACTION:{"action":"search","pattern":"font-size","glob":"*.html"} — restrict to html\n' +
    'ACTION:{"action":"search","pattern":"router.post","glob":"*.js"} — restrict to js\n' +
    'ACTION:{"action":"edit","file":"index.js","old_text":"exact text","new_text":"replacement","description":"what this does"} [DISABLED in runtime lockdown]\n' +
    'ACTION:{"action":"edit_restart","file":"index.js","old_text":"exact text","new_text":"replacement","description":"what this does"} [DISABLED in runtime lockdown]\n' +
    'ACTION:{"action":"open","value":"appname"}\n' +
    'ACTION:{"action":"type","value":"text"}\n' +
    'ACTION:{"action":"click","value":"x,y"}\n' +
    'ACTION:{"action":"scroll","value":"down"}\n' +
    'ACTION:{"action":"press","value":"enter"}\n' +
    'ACTION:{"action":"look","value":"question"}\n' +
    "shell returns stdout/stderr/exit_code. read/list use paths relative to jarvis root. search uses ripgrep. write/edit/edit_restart are disabled in runtime lockdown." +
    stateLayer;
}

// Prune discord-history.jsonl to last 7 days. Call once on boot.
function pruneDiscordHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const kept = lines.filter(l => {
      try { return new Date(JSON.parse(l).date).getTime() >= cutoff; }
      catch { return false; }
    });
    if (kept.length < lines.length) {
      fs.writeFileSync(HISTORY_FILE, kept.join("\n") + (kept.length ? "\n" : ""));
      log("discord-history-pruned", { removed: lines.length - kept.length, kept: kept.length });
    }
  } catch (err) {
    log("discord-history-prune-error", { error: err.message });
  }
}

module.exports = { buildSystemPrompt, loadDiscordSignals, pruneDiscordHistory };
