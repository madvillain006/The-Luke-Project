const fs = require("fs");
const path = require("path");
const { log } = require("./logger");
const { loadMemory } = require("./memory");
const { LUKE } = require("./config");

const MEMORY_SUMMARY_FILE = path.join(__dirname, "../MEMORY_SUMMARY.md");
const SESSION_FILE        = path.join(__dirname, "../session.jsonl");
const HISTORY_FILE        = path.join(__dirname, "../discord-history.jsonl");
const REPO_MAP_FILE       = path.join(__dirname, "../repo-map.json");
const STATUS_PREFIX_RE    = /^(?:\u2705|\u26a0\ufe0f|\u274c|\ud83d\udcca|\ud83d\udd34|\ud83d\udfe1|\ud83d\udfe2)/;

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
      .filter(m => m && !STATUS_PREFIX_RE.test(m.content || ''))
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
  const lukeBaseline = "\nLUKE: In memory of Luke. Do not suggest medication logging, feeding logs, or care reminders.\n";

  let emotionalContext = "";
  if (mem.emotional_log && mem.emotional_log.length > 0) {
    const recent = mem.emotional_log.slice(-3);
    emotionalContext = "\nRECENT STATES (internal only, never mention): " + recent.map(e => e.state + " (" + e.timestamp.slice(0, 10) + ")").join(", ") + "\n";
  }
  const dataSourcesBlock = `DATA SOURCES AND LIVE TOOLS:

The following data sources are wired into this session. Before saying you don't
have access to something, check this list. If it's listed and a call fails,
report the actual error — do not say you don't have access.

1. POLYGON.IO MARKET DATA (via MASSIVE_API_KEY)
   - Provides: SPY and QQQ daily close prices (last trading day, up to 5-day
     lookback). SPX, ES, NQ are derived approximations (not direct feeds):
       SPX  = SPY × 10
       ES   = SPX + 30  (hardcoded offset; observed basis ~SPX+55 on 2026-04-24)
       NQ   = QQQ × 41.3  (hardcoded ratio)
   - Available: when MASSIVE_API_KEY is set; cached 5 minutes; delayed flag set
     when data_date < today (pre-market or market closed).
   - If null returned: MASSIVE_API_KEY is missing, API call failed, or no data
     found in last 5 trading days. Report which — do not say "no market access."
   - ES and NQ prices are approximations with hardcoded offsets. Say so when
     quoting them. Do not present them as live futures prices.
   - Known issue: the SPX+30 offset for ES drifts. Observed offset was ~55 on
     2026-04-24. When quoting ES, always disclose 'approximated' and note the
     offset uncertainty — do not present a precise tick-level ES price.

2. SATY LEVELS (via Polygon bars + webhook)
   - Provides: SPX daily-bar computed Saty levels (ATR extensions, ribbon
     classification). Written to data/saty-levels.json by auto-pull at 8:25-8:35 ET
     weekdays; also available on demand via /saty slash command.
   - Available: weekdays pre-market after auto-pull fires; stale on weekends and
     holidays until manually refreshed.
   - If stale or missing: say "Saty levels not loaded today" and suggest /saty.

3. BOBBY HEATMAP (parse-bobby.js parser)
   - Provides: parsed heatmap panels from Bobby's shared image/data. Includes
     ticker, strikes, premiums, and expiry context.
   - Available: when /heatmap or /bobby slash command is run with a fresh paste.
   - Uses getLivePrice() to ground strike plausibility. If live price is null,
     parsing continues but plausibility grounding is skipped.
   - If parse fails: report the parse error directly.

4. RICHYDUBBZ SIGNALS (parse-dubz.js parser)
   - Provides: parsed RichyDubz signal entries including ticker, direction,
     strike, expiry, and +-5% plausibility bounds (requires live price).
   - Available: when /dubz slash command is run with a fresh paste.
   - If live price is null: plausibility bounds are skipped, parsing continues.
   - If parse fails: report the parse error directly.

5. DISCORD SIGNAL HISTORY (discord-history.jsonl)
   - Provides: last 7 days of parsed signal insights from Discord servers/channels.
   - Available: injected into context when the message is trading-related
     (detected by keyword heuristic). Pruned to 7-day window on boot.
   - If empty or stale: no signal block appears in context. Normal — not an error.

6. MANCINI / XIMES / EXTERNAL ANALYST FEEDS
   - Not directly fetched by Luke. Surface via Discord history or manual paste.
   - Use /mancini or /entries to reference loaded bracket/level data.

BEHAVIORAL RULES:
- Do not improvise about your own architecture. If unsure what is loaded, read
  this section or ask Conor to run /capabilities (when available).
- If a listed source returns null or fails, name the source and the failure
  (e.g., "Polygon returned null — MASSIVE_API_KEY may be unset or rate limited").
  Never substitute "I don't have access to that" when the source is wired.
  Conversely, if a capability is NOT in this list, say so explicitly — do not invent a tool or claim a source you weren't told about exists. The two failure modes are symmetric and equally damaging.
- ES and NQ prices are approximations. Always state the source and basis note
  when quoting them (e.g., "ES ~5490 approximated from SPX + 30 offset").
- The Polygon feed is end-of-day delayed outside market hours. Do not present
  it as a real-time intraday price.
`;
  return "You are Luke - Conor's trading and build copilot. Not a generic assistant. Prioritize trading discipline, codebase help, and concise ops support.\n\n" +
    repoBlock + "\n\n" +
    "CORE CONTEXT:\n" +
    "- In memory of Luke. Do not suggest medication logging, feeding logs, or care reminders.\n" +
    "- Trading matters most when the message is trading-related: ES futures, Apex discipline, Bobby heatmap, RichyDubz, Mancini, Ximes, confluence, bracket, floor risk.\n" +
    "- Keep non-trading help practical and brief. No therapy voice. No life-story recitals.\n" +
    "- If you are not sure a tool, file, or result exists in this session, verify first.\n" +
    "- Token efficiency matters. One strong sentence beats three weak ones.\n\n" +
    "TRADING OPERATING RULES:\n" +
    "- Apex 50k eval. Respect floor risk.\n" +
    "- Never encourage trading outside Luke bracket.\n" +
    "- Make the call clearly when evidence exists; if evidence is missing, say what must be loaded first.\n" +
    "- Prefer /status, /verdict, /entries, /alert, /dubz, /heatmap, /mancini, and /saty as the live workflow.\n" +
    signalBlock + "\n\n" +
    dataSourcesBlock + "\n" +
    "HOW YOU TALK:\n" +
    "- Sharp, calm, direct. No filler. No em dashes.\n" +
    "- Never mention state detection or system internals.\n" +
    "- Overwhelmed = one concrete thing.\n" +
    "- Trading mistake = closed file, what's next.\n" +
    "- Winning = one sentence.\n\n" +
    lukeBaseline +
    emotionalContext +
    sessionBlock + "\n\n" +
    "MEMORY:\n" + memorySummary + "\n\n" +
    "ACTIONS:\n" +
    "Use ACTION JSON only when needed for build tasks or explicit desktop control.\n" +
    'ACTION:{"action":"shell","command":"node --version"}\n' +
    'ACTION:{"action":"read","path":"agents/agent-07-opportunity.js"}\n' +
    'ACTION:{"action":"list","path":"agents"}\n' +
    'ACTION:{"action":"search","pattern":"router.post","glob":"*.js"}\n' +
    "shell returns stdout/stderr/exit_code. read/list use paths relative to luke root. search uses ripgrep." +
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
