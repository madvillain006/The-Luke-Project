const express = require("express");
const fs = require("fs");
const path = require("path");
const { events, snapshots } = require("../lib/paths");
const { createRoutedText } = require("../lib/llm-client");

const router = express.Router();

const MEMORY_FILE = snapshots.memory;
const HISTORY_FILE = events.discordHistory;
const LOG_FILE = events.lukeLog;
const SKILLS_DIR = path.join(__dirname, "../skills");

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadSkills() {
  try {
    if (!fs.existsSync(SKILLS_DIR)) return "";
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith(".md"));
    return files.map(f => fs.readFileSync(path.join(SKILLS_DIR, f), "utf8")).join("\n\n---\n\n");
  } catch {
    return "";
  }
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
  } catch {
    return [];
  }
}

function buildAgent06System() {
  const extraSkills = loadSkills();
  return "You are Agent 06, Luke's lightweight research and synthesis router.\n\n" +
    "Role: answer direct research, validation, structure, review, and improvement requests without writing repo docs or mutating project state.\n\n" +
    "Rules:\n" +
    "1. Prefer existing Luke behavior and current code over stale planning docs.\n" +
    "2. Do not generate root markdown docs, background roadmaps, or suggestion files.\n" +
    "3. Return concise, actionable output.\n" +
    "4. Fewer moving parts is better.\n\n" +
    (extraSkills ? "Additional local skills:\n" + extraSkills + "\n\n" : "") +
    "Tone: direct. No filler.";
}

async function createMessage(model, maxTokens, content, options = {}) {
  const routed = await createRoutedText({
    model,
    maxTokens,
    system: buildAgent06System(),
    userMessage: content,
    feature: options.feature || (/opus/i.test(model) ? "research_synth" : "summarize"),
    fallbackFeature: options.fallbackFeature || "summarize",
    allowAnthropic: options.allowAnthropic ?? /opus/i.test(model),
  });
  return routed.text;
}

router.post("/synthesize", async (req, res) => {
  const { topic } = req.body;
  const mem = loadMemory();
  const research = mem.agent06_research || [];
  const signals = loadDiscordSignals(10);

  if (research.length === 0 && signals.length === 0) {
    return res.json({ reply: "No research or signals stored yet." });
  }

  try {
    const reply = await createMessage(
      "claude-opus-4-6",
      800,
      "Synthesize" + (topic ? " around: " + topic : "") + ".\n\nResearch:\n" +
        research.slice(-15).map(r => r.insight).join("\n\n") +
        "\n\nSignals:\n" + signals.join("\n\n") +
        "\n\nOutput: dominant patterns, actionable insights, and what Luke should do differently."
    );
    log("research-synthesize", { topic, reply });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/validate", async (req, res) => {
  const { source, content } = req.body;
  if (!source && !content) return res.status(400).json({ error: "Provide source or content" });
  try {
    const reply = await createMessage(
      "claude-haiku-4-5-20251001",
      150,
      "Source: " + (source || "unknown") + "\nContent: " + (content || "none") + "\nScore reliability, flag bias, assess relevance."
    );
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/structure", async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: "No input" });
  try {
    const reply = await createMessage("claude-haiku-4-5-20251001", 350, "Structure this into a clean framework:\n\n" + input);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/create-skill", async (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: "No goal provided" });
  try {
    const reply = await createMessage(
      "claude-opus-4-6",
      600,
      "Draft a Codex skill for: " + goal + "\n\nOutput complete markdown. First line must be: name: [skill-name-kebab-case]"
    );
    res.json({ reply, saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/flowchart", async (req, res) => {
  const { process } = req.body;
  if (!process) return res.status(400).json({ error: "No process provided" });
  try {
    const reply = await createMessage("claude-haiku-4-5-20251001", 350, "Convert this process into nodes, branches, and layout:\n\n" + process);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/review-code", async (req, res) => {
  const { code, filename } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });
  try {
    const reply = await createMessage(
      "claude-opus-4-6",
      800,
      "Review " + (filename || "this code") + " for bugs, inefficiencies, style issues, and concrete fixes:\n\n" + code
    );
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ui-advice", async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "No description" });
  try {
    const reply = await createMessage("claude-haiku-4-5-20251001", 250, "Luke UI advice for this description:\n\n" + description);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/improve", async (req, res) => {
  const mem = loadMemory();
  const research = mem.agent06_research || [];
  const signals = loadDiscordSignals(15);
  try {
    const reply = await createMessage(
      "claude-opus-4-6",
      800,
      "Generate 3 improvements without writing files.\n\nResearch:\n" +
        research.slice(-5).map(r => r.insight).join("\n\n") +
        "\n\nSignals:\n" + signals.join("\n\n") +
        "\n\nFor each: title, change, priority, effort, rationale."
    );
    log("agent06-improve", { reply });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function disabledDocRoute(res, route) {
  res.status(410).json({
    error: "disabled",
    route,
    reason: "Root markdown/doc generation was removed during cleanup. Use explicit docs or current runtime state instead."
  });
}

router.post("/generate-documents", (req, res) => disabledDocRoute(res, "/agent/research/generate-documents"));
router.post("/background-cycle", (req, res) => disabledDocRoute(res, "/agent/research/background-cycle"));
router.post("/trader-deep-dive", (req, res) => disabledDocRoute(res, "/agent/research/trader-deep-dive"));

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    agent: "research",
    mode: "on-demand",
    endpoints: [
      "synthesize",
      "validate",
      "structure",
      "create-skill",
      "flowchart",
      "review-code",
      "ui-advice",
      "improve"
    ]
  });
});

module.exports = router;
