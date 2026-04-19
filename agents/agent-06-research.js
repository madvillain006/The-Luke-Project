const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();

const MEMORY_FILE = path.join(__dirname, "../memory.json");
const HISTORY_FILE = path.join(__dirname, "../discord-history.jsonl");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");
const SELF_KNOWLEDGE_FILE = path.join(__dirname, "../JARVIS_SELF_KNOWLEDGE.md");
const SKILLS_DIR = path.join(__dirname, "../skills");
const SUGGESTIONS_FILE = path.join(__dirname, "../suggestions.md");
const DOCS_DIR = path.join(__dirname, "..");
const FINNHUB_KEY = "d7ibl19r01qu8vfo2410d7ibl19r01qu8vfo241g";

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function saveMemory(mem) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadSelfKnowledge() {
  try { return fs.readFileSync(SELF_KNOWLEDGE_FILE, "utf8"); } catch { return "Self knowledge file not found."; }
}

function loadSkills() {
  try {
    if (!fs.existsSync(SKILLS_DIR)) return "";
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith(".md"));
    return files.map(f => fs.readFileSync(path.join(SKILLS_DIR, f), "utf8")).join("\n\n---\n\n");
  } catch { return ""; }
}

function loadDiscordSignals(limit = 20) {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const signals = [];
    for (const line of lines.slice(-50)) {
      try {
        const entry = JSON.parse(line);
        for (const r of entry.results || []) {
          if (r.insights && !r.insights.includes("NO_ACTIONABLE_SIGNALS")) {
            signals.push("[" + (entry.server || "unknown") + " #" + (entry.channel || "unknown") + "] " + r.insights.slice(0, 300));
          }
        }
      } catch {}
    }
    return signals.slice(-limit);
  } catch { return []; }
}

function loadAllHistoricalSignals() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const signals = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        for (const r of entry.results || []) {
          if (r.insights && !r.insights.includes("NO_ACTIONABLE_SIGNALS") && r.insights.trim().length > 20) {
            signals.push({
              channel: entry.channel,
              source: entry.source || "scraper",
              date: entry.date,
              insights: r.insights.slice(0, 400)
            });
          }
        }
      } catch {}
    }
    return signals;
  } catch { return []; }
}

function buildAgent06System() {
  const selfKnowledge = loadSelfKnowledge();
  const extraSkills = loadSkills();

  return "You are Agent 06 - the research, intelligence, and self-improvement layer of Jarvis, built for Conor.\n\n" +
    "YOUR ROLE: Synthesize information, validate sources, structure knowledge, analyze patterns, generate improvements, build new skills, and make Jarvis smarter over time.\n\n" +
    "JARVIS ARCHITECTURE:\n" + selfKnowledge + "\n\n" +
    "SKILLS: DEEP-RESEARCH-SYNTHESIZER, WORKFLOW-AUTOMATION-AGENT, CODE-REVIEW-SKILL, SKILL-CREATOR-META-SKILL, COMPETITIVE-INTELLIGENCE-SKILL, DEVOPS-ASSISTANT, KNOWLEDGE-STRUCTURING-SKILL, SOURCE-VALIDATION-SKILL, UI-UX-LAYOUT-ADVISOR, FLOWCHART-DECISION-BUILDER, TRADER-PROFILE-BUILDER\n\n" +
    (extraSkills ? "ADDITIONAL SKILLS:\n" + extraSkills + "\n\n" : "") +
    "SELF-IMPROVEMENT RULES:\n" +
    "1. Prefer existing stack over new dependencies\n" +
    "2. Background/night execution only\n" +
    "3. Single-file changes over rewrites\n" +
    "4. Never suggest CDP or Playwright\n" +
    "5. Rate by impact/effort ratio\n" +
    "6. Fewer moving parts is always better\n\n" +
    "TONE: Direct. No filler. Make the call.";
}

// Synthesize research
router.post("/synthesize", async (req, res) => {
  const { topic } = req.body;
  const mem = loadMemory();
  const research = mem.agent06_research || [];
  const signals = loadDiscordSignals(10);

  if (research.length === 0 && signals.length === 0) return res.json({ reply: "No research or signals stored yet." });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 800,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use DEEP-RESEARCH-SYNTHESIZER" + (topic ? " focused on: " + topic : "") + ".\n\nResearch:\n" + research.slice(-15).map(r => r.insight).join("\n\n") + "\n\nSignals:\n" + signals.join("\n\n") + "\n\nOutput: dominant patterns, actionable insights, what Jarvis should do differently." }]
    });
    const reply = response.content[0].text;
    log("research-synthesize", { topic, reply });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Validate a source
router.post("/validate", async (req, res) => {
  const { source, content } = req.body;
  if (!source && !content) return res.status(400).json({ error: "Provide source or content" });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use SOURCE-VALIDATION-SKILL.\nSource: " + (source || "unknown") + "\nContent: " + (content || "none") + "\nScore reliability, flag bias, assess relevance." }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Structure knowledge
router.post("/structure", async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: "No input" });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use KNOWLEDGE-STRUCTURING-SKILL on:\n\n" + input + "\n\nOutput clean structured framework." }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create and save a skill
router.post("/create-skill", async (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: "No goal provided" });
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use SKILL-CREATOR-META-SKILL for: " + goal + "\n\nOutput complete .md skill. First line must be: name: [skill-name-kebab-case]" }]
    });
    const reply = response.content[0].text;
    try {
      if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR);
      const nameMatch = reply.match(/name:\s*([a-z0-9-]+)/);
      const skillName = nameMatch ? nameMatch[1] : "skill-" + Date.now();
      const skillPath = path.join(SKILLS_DIR, skillName + ".md");
      fs.writeFileSync(skillPath, reply);
      log("skill-created", { goal, skillName });
      res.json({ reply, saved: skillPath });
    } catch { res.json({ reply, saved: false }); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Flowchart
router.post("/flowchart", async (req, res) => {
  const { process } = req.body;
  if (!process) return res.status(400).json({ error: "No process provided" });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use FLOWCHART-DECISION-BUILDER on:\n\n" + process + "\n\nOutput nodes, connections, branches, layout." }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Code review
router.post("/review-code", async (req, res) => {
  const { code, filename } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 800,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use CODE-REVIEW-SKILL on " + (filename || "this code") + ":\n\n" + code + "\n\nBugs, inefficiencies, style issues, fixes." }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UI advice
router.post("/ui-advice", async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "No description" });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use UI-UX-LAYOUT-ADVISOR on Jarvis Electron 480x700:\n\n" + description + "\n\nLayout improvements, hierarchy, spacing." }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Full improvement cycle
router.post("/improve", async (req, res) => {
  const mem = loadMemory();
  const research = mem.agent06_research || [];
  const signals = loadDiscordSignals(15);
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 800,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Use WORKFLOW-AUTOMATION-AGENT and DEEP-RESEARCH-SYNTHESIZER.\n\nResearch:\n" + research.slice(-5).map(r => r.insight).join("\n\n") + "\n\nSignals:\n" + signals.join("\n\n") + "\n\nGenerate 3 improvements:\n## IMPROVEMENT: [title]\nAGENT: \nCHANGE: \nPRIORITY: \nEFFORT: \nRATIONALE: " }]
    });
    const reply = response.content[0].text;
    fs.appendFileSync(SUGGESTIONS_FILE, "\n\n---\n# Improvements " + new Date().toISOString() + "\n\n" + reply);
    log("agent06-improve", { reply });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GENERATE BASE DOCUMENTS — called nightly at 1AM
router.post("/generate-documents", async (req, res) => {
  res.json({ started: true });

  const allSignals = loadAllHistoricalSignals();
  const mem = loadMemory();

  console.log("Agent 06: generating base documents from " + allSignals.length + " historical signals...");

  try {
    // 1. TRADER_PROFILES.md
    const ximesSignals = allSignals.filter(s => s.channel === "ximes-dubz").slice(-100);
    const bobbySignals = allSignals.filter(s => s.channel === "bobby-spx-coms").slice(-100);
    const bigtSignals = allSignals.filter(s => s.channel === "bigT").slice(-50);

    const traderProfileResponse = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Build TRADER_PROFILES.md from this signal data.\n\nFor each trader synthesize: methodology, typical setups, preferred levels, timing patterns, win patterns, what to watch for.\n\nximes-dubz signals:\n" + ximesSignals.map(s => s.insights).join("\n") + "\n\nbobby-spx-coms signals:\n" + bobbySignals.map(s => s.insights).join("\n") + "\n\nbigT signals:\n" + bigtSignals.map(s => s.insights).join("\n") + "\n\nOutput as clean markdown." }]
    });

    fs.writeFileSync(path.join(DOCS_DIR, "TRADER_PROFILES.md"), "# TRADER PROFILES\n*Generated " + new Date().toISOString() + "*\n\n" + traderProfileResponse.content[0].text);
    console.log("TRADER_PROFILES.md written");

    // 2. MEMORY_SUMMARY.md
    const skip = ["agent06_research", "emotional_log", "closed_trades", "fund_log", "conor_health_log", "open_trades"];
    const slim = {};
    Object.keys(mem).filter(k => !skip.includes(k)).forEach(k => slim[k] = mem[k]);

    const memorySummaryResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: "Summarize this memory object in 150 words max. Focus on: current financial state, Luke health, active goals, recent context. Be dense and specific.\n\n" + JSON.stringify(slim, null, 2) }]
    });

    fs.writeFileSync(path.join(DOCS_DIR, "MEMORY_SUMMARY.md"), "# MEMORY SUMMARY\n*Generated " + new Date().toISOString() + "*\n\n" + memorySummaryResponse.content[0].text);
    console.log("MEMORY_SUMMARY.md written");

    // 3. CONOR_CHRONICLE.md — append today's entry
    const chroniclePath = path.join(DOCS_DIR, "CONOR_CHRONICLE.md");
    const todayEntry = "\n\n## " + new Date().toISOString().slice(0, 10) + "\n" +
      "- Ingested historical Discord data from ximes-dubz, bobby-spx-coms, giul-heatseeker\n" +
      "- " + allSignals.length + " total signals in database\n" +
      "- Trader profiles generated\n" +
      "- Memory summary updated\n";

    if (!fs.existsSync(chroniclePath)) {
      fs.writeFileSync(chroniclePath, "# CONOR CHRONICLE\nRunning log of decisions, wins, patterns, and progress.\n" + todayEntry);
    } else {
      fs.appendFileSync(chroniclePath, todayEntry);
    }
    console.log("CONOR_CHRONICLE.md updated");

    // 4. CONOR_EDGE.md — initialize if not exists
    const edgePath = path.join(DOCS_DIR, "CONOR_EDGE.md");
    if (!fs.existsSync(edgePath)) {
      fs.writeFileSync(edgePath, "# CONOR EDGE DOCUMENT\n*Initialize manually — Jarvis will maintain after first entry*\n\n## Entry Criteria\nTBD — fill in after first 10 trades\n\n## Exit Criteria\nBy premium paid, not arbitrary levels\n\n## Hard Rules\n- No lottos\n- No revenge trades\n- -25% hard stop at entry\n- OCO set immediately\n- No trading during Instacart shifts\n\n## Wyckoff Framework\nCurrent phase: Markup confirmed\n\n## Track Record\nNo trades logged yet\n");
      console.log("CONOR_EDGE.md initialized");
    }

    log("generate-documents", { signals: allSignals.length, docs: ["TRADER_PROFILES.md", "MEMORY_SUMMARY.md", "CONOR_CHRONICLE.md", "CONOR_EDGE.md"] });

  } catch (err) {
    log("generate-documents-error", { error: err.message });
    console.error("Document generation error:", err.message);
  }
});

// Background self-improvement cycle — called by scheduler at 3AM
router.post("/background-cycle", async (req, res) => {
  res.json({ started: true });

  try {
    const mem = loadMemory();
    const research = mem.agent06_research || [];
    const signals = loadDiscordSignals(20);

    const marketContext = await fetch("https://finnhub.io/api/v1/quote?symbol=SPY&token=" + FINNHUB_KEY)
      .then(r => r.json())
      .then(d => "SPY: $" + d.c.toFixed(2) + " (" + ((d.c - d.pc) / d.pc * 100).toFixed(2) + "% today) | High: $" + d.h.toFixed(2) + " | Low: $" + d.l.toFixed(2))
      .catch(() => "Market data unavailable");

    const synthesis = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Background cycle step 1: Use DEEP-RESEARCH-SYNTHESIZER.\nMarket: " + marketContext + "\nResearch (" + research.length + " items): " + research.slice(-10).map(r => r.insight).join(" | ") + "\nSignals (" + signals.length + " items): " + signals.slice(-10).join(" | ") + "\nDate: " + new Date().toISOString() + "\nExtract 3 most important patterns. Flag signals older than 24 hours as stale." }]
    });

    const patterns = synthesis.content[0].text;

    const improvements = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      system: buildAgent06System(),
      messages: [{ role: "user", content: "Background cycle step 2.\nPatterns: " + patterns + "\nGenerate 2 HIGH priority improvements using WORKFLOW-AUTOMATION-AGENT. Apply all self-improvement rules. Specific enough to implement without clarification." }]
    });

    const reply = improvements.content[0].text;
    const entry = "\n\n---\n# Background cycle " + new Date().toISOString() + "\nMARKET: " + marketContext + "\n\nPATTERNS:\n" + patterns + "\n\nIMPROVEMENTS:\n" + reply;
    fs.appendFileSync(SUGGESTIONS_FILE, entry);
    log("background-cycle", { patterns, reply, marketContext });

  } catch (err) {
    log("background-cycle-error", { error: err.message });
  }
});

// Professional trader deep-dive — categorizes all traders from chat logs, Nobu FV (Flag Velocity) specifically
router.post("/trader-deep-dive", async (req, res) => {
  res.json({ started: true, message: "Building TRADER_ANALYSIS.md — check back in a few minutes" });

  const allSignals = loadAllHistoricalSignals();
  if (allSignals.length === 0) {
    log("trader-deep-dive-error", { error: "no signals" });
    return;
  }

  // Group by channel/trader
  const byChannel = {};
  for (const s of allSignals) {
    const ch = s.channel || "unknown";
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(s.insights);
  }

  const analyses = [];

  for (const [channel, signals] of Object.entries(byChannel)) {
    if (signals.length < 3) continue;

    const isNobuChannel = channel.toLowerCase().includes("nobu") ||
      signals.some(s => s.toLowerCase().includes("nobu"));
    const hasFV = signals.some(s => s.toLowerCase().includes(" fv ") || s.toLowerCase().includes("fv:"));

    const sample = signals.slice(-50).join("\n---\n").slice(0, 5000);

    try {
      const r = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 700,
        system: buildAgent06System(),
        messages: [{
          role: "user",
          content: `Professional trader analysis. Channel: ${channel} (${signals.length} total signals)\n\n` +
            `Analyze this trader's methodology from their Discord signals.\n\n` +
            `Output:\n## ${channel}\n### Core Methodology\n### Typical Setups (numbered)\n### Win Patterns\n### What Doesn't Work\n### Key Levels and Tools\n` +
            (isNobuChannel || hasFV
              ? `### Flag Velocity (FV)\nNobu uses "FV" to mean Flag Velocity — a specific signal type. Document what it is, when it appears, how Nobu uses it, and what trade action it implies. Only count FV when posted BY Nobu or when Nobu responds to a post WITH A PICTURE.\n`
              : "") +
            `\nSignals:\n${sample}`
        }]
      });
      analyses.push(r.content[0].text);
    } catch (err) {
      analyses.push(`## ${channel}\nAnalysis error: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  const doc = "# TRADER ANALYSIS — PROFESSIONAL DEEP DIVE\n*Generated " + new Date().toISOString() + "*\n\n*Traders analyzed: " + Object.keys(byChannel).length + " | Total signals: " + allSignals.length + "*\n\n" + analyses.join("\n\n---\n\n");
  fs.writeFileSync(path.join(DOCS_DIR, "TRADER_ANALYSIS.md"), doc);
  log("trader-deep-dive", { channels: Object.keys(byChannel).length, total: allSignals.length });

  fetch("http://localhost:3000/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "TRADER ANALYSIS COMPLETE\n" + Object.keys(byChannel).length + " traders analyzed\nTRADER_ANALYSIS.md written" })
  }).catch(() => {});
});

module.exports = router;
