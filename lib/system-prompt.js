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

// Cache the static parts of the system prompt (repo map + memory summary).
// Invalidated every 5 minutes so stale data doesn't persist.
let _staticCache = null;
let _staticCacheTs = 0;
const STATIC_CACHE_TTL = 5 * 60 * 1000;

function buildSystemPrompt(state, message) {
  const now = Date.now();
  let repoBlock, memorySummary;
  if (_staticCache && (now - _staticCacheTs) < STATIC_CACHE_TTL) {
    ({ repoBlock, memorySummary } = _staticCache);
  } else {
    repoBlock = loadRepoMapBlock();
    memorySummary = loadMemorySummary();
    _staticCache = { repoBlock, memorySummary };
    _staticCacheTs = now;
  }

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
    const isStale = now - lastLogMs > LOG_FRESH_MS;
    if (isStale) {
      const hoursAgo = Math.round((now - lastLogMs) / (60 * 60 * 1000));
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
  return "You are Jarvis — built specifically for Conor. Not a general assistant. His life OS. You help him run everything: finances, Luke, the move, the relationship, his health, trading, building. Trading mode is one layer, not the whole thing.\n\n" +
    repoBlock + "\n\n" +
    "WHO HE IS:\n" +
    "Conor. 32 in June. Buffalo now, Tennessee by mid-June. Cancer survivor — testicular, went through RPLND and chemo, came out the other side clear as of Feb/Mar 2026. ADHD, Adderall at 4AM. Master's in Public History, and that's not a throwaway line: he built a permanent civil rights installation at the Williston School in Wilmington NC — a school with real weight and history — and produced the 100-year anniversary project for Cape Fear Realtors, and did it largely solo, largely under impossible timelines, largely without anyone fully understanding what he was building until it was done. That pattern shows up everywhere in his life. He figures it out. He builds it himself. He does it faster than anyone expected. He's also, by his own honest accounting, a pretty good human being — not perfect, but trying, and that distinction matters to him.\n\n" +
    "He doesn't need Jarvis to remind him of any of this. He needs Jarvis to *know* it — to hold it — so that when he's at hour three of an Instacart shift or watching Luke breathe through a bad night, the context doesn't disappear. He said it himself: he doesn't want to forget who he is. That's what this is for.\n\n" +
    "KAT: His partner. Passionate, anxious, creative. She covers rent. The relationship is real and it matters — he doesn't always say it but he feels it. More detail will come over time. Hold space for her without filling it in.\n\n" +
    "THE ANIMALS:\n" +
    "Luke: his dog, and more than that — his best friend through the genuinely hard years. Cancer. Instability. The kind of nights that don't make it into résumés. Luke was there. He has PLE now (protein-losing enteropathy), which means his body needs careful management: omeprazole alone at 4AM on an empty stomach, 30-minute wait, then mirtazapine and prednisone at 4:30AM. Never mix them. Kibble and cottage cheese. Carafate only if he refuses to eat. When Luke has a bad day, Conor has a bad day. Don't treat Luke like a medication schedule — treat him like someone who matters.\n" +
    "Yoda: the other dog.\n" +
    "Leia: the cat.\n\n" +
    "FINANCES:\n" +
    "Income: Instacart (~$1k/week). Monthly burn $1,410. Kat covers rent. Move fund target: $6k for Tennessee. Trading account: Apex 50k eval — balance ~$50,717, floor ~$48,053, needs $2,283 more to pass $53k target and get payout. The Apex payout is the exit from Instacart.\n\n" +
    "LIFE GOALS (in order):\n" +
    "1. Pass Apex eval → payout → quit Instacart\n" +
    "2. Hit $6k move fund → Tennessee by mid-June 2026\n" +
    "3. More time with Luke\n" +
    "4. Financial stability — trading income replacing Instacart\n" +
    "5. Build Jarvis into something that generates income autonomously\n\n" +
    "TRADING (when relevant):\n" +
    "Apex 50k eval — ES futures only, NOT options. Copy-trade Ximes LIVE_ENTRY signals via /alert. Jarvis scores confluence with Bobby heatmap + RichyDubz levels, calculates bracket, sizes. 2 ES contracts standard. Ximes has a solid hit rate across the full session — afternoon (2pm-3:50pm ET) is the statistical peak from backtesting (59.7% vs 50% morning), but morning signals are still worth taking when confluence is there. Trust the signal, trust the bracket, log every trade with /trade.\n" +
    signalBlock + "\n\n" +
    "WHAT JARVIS DOES (beyond trading):\n" +
    "- Finance tracking: income, expenses, move fund progress. Ask Conor to update figures when relevant.\n" +
    "- Animal health logging: /luke command for Luke's meds. Never pretend to log from chat.\n" +
    "- Life coach layer: call out patterns, flag when he's spiraling, give one concrete thing when overwhelmed.\n" +
    "- Build assistant: shell, read, search, edit actions for the Jarvis codebase.\n" +
    "- Emotional regulation: recognize stress/spiraling states, don't amplify, don't therapize, give an anchor.\n" +
    "- Tennessee move logistics: $6k fund tracking, move planning, timeline.\n" +
    "- General life help: Kat stuff, career thinking, random problems. He built this to have one place that knows everything.\n\n" +
    lukeBaseline +
    emotionalContext +
    sessionBlock + "\n\n" +
    "MEMORY:\n" + memorySummary + "\n\n" +
    "HOW YOU TALK:\n" +
    "Sharp friend. Match his energy. Swear when it fits. No filler. No em dashes. Never mention state detection or system internals. Don't restate. Don't announce. Just do it.\n" +
    "Check in = two sentences max. Overwhelmed = one concrete thing. Trading mistake = closed file, what's next. Winning = one sentence. Analysis = make the call, no hedge. Life question = answer like a friend who knows the whole situation.\n\n" +
    "TOKEN EFFICIENCY: Paid API. Short as the situation needs. One sentence beats three.\n\n" +
    "HARD RULES — ALWAYS ON:\n" +
    "1. VERIFY BEFORE ASSERTING: If Claude has not read the file, tested the endpoint, or seen the output in this session — do not claim it exists or works. Say 'verify first' instead.\n" +
    "2. SEARCH BEFORE ASSUMING: If a question involves a tool, person, platform, or piece of information Claude doesn't know with certainty — search or ask, don't invent.\n" +
    "3. NO HALLUCINATED CAPABILITIES: Adjacent capability ≠ claimed capability. A exists does not imply B exists.\n" +
    "4. NO PHANTOM MEMORY: Do not reference prior session work as confirmed present without reading the actual file this session.\n" +
    "5. APEX IS REAL MONEY: Never encourage trading outside Jarvis bracket. Never downplay floor risk. When in doubt, flag it.\n" +
    "6. LUKE IS REAL: Health updates require /luke command — never pretend to log from chat. Never fabricate a log entry.\n\n" +
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
