const express = require("express");
const router = express.Router();
const fs = require("fs");
const { readJsonFile, writeJsonAtomic } = require("../state/lib");
const { recordConorHealthLog, recordLukeLog } = require("../state/health-store");
const { events, snapshots } = require("../lib/paths");
const { createRoutedText } = require("../lib/llm-client");

const { log } = require("../lib/logger");
const { loadMemory, saveMemory } = require("../lib/memory");

const LUKE_LOG_FILE = events.lukeLog;
const LUKE_DRAFTS_FILE = snapshots.lukeLogDrafts;

function logLuke(entry) {
  fs.appendFileSync(LUKE_LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

function loadLukeLogs() {
  try {
    return fs.readFileSync(LUKE_LOG_FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

function loadLukeDrafts() {
  return readJsonFile(LUKE_DRAFTS_FILE, []);
}

function saveLukeDrafts(drafts) {
  writeJsonAtomic(LUKE_DRAFTS_FILE, drafts);
}

function buildLukeEntry(body = {}) {
  const { meds, food_eaten, stool, vomiting, energy, notes } = body;
  return {
    date: new Date().toISOString().slice(0, 10),
    meds: meds || null,
    food_eaten: food_eaten || null,
    stool: stool || null,
    vomiting: vomiting || false,
    energy: energy || null,
    notes: notes || null
  };
}

function persistLukeEntry(entry) {
  logLuke(entry);
  recordLukeLog(entry);

  const mem = loadMemory();
  mem.luke_last_log = entry;
  saveMemory(mem);

  const flags = [];
  if (entry.vomiting) flags.push("VOMITING LOGGED");
  if (entry.food_eaten === 0 || entry.food_eaten === "refused") flags.push("FOOD REFUSED");
  if (entry.stool === "diarrhea") flags.push("DIARRHEA");
  if (entry.meds && entry.meds.includes("combined")) flags.push("MED PROTOCOL VIOLATION");

  log("luke-logged", entry);
  return flags;
}

const AGENT_04_SYSTEM = `You are the HEALTH agent within Luke - managing Luke's PLE and Conor's health logging.

LUKE'S CONDITION: PLE (protein-losing enteropathy) - chronic, requires careful daily management.

LUKE'S MED PROTOCOL (STRICT ORDER - NEVER COMBINE):
1. Omeprazole - ALONE, empty stomach, 4AM
2. Wait 30 minutes minimum
3. Mirtazapine + Prednisone - TOGETHER, with food, 4:30AM
4. Carafate - ONLY when Luke refuses kibble voluntarily. Trigger is refusal, not the clock.

LUKE'S FOOD: kibble + cottage cheese

RED FLAGS - alert immediately if:
- Meds given out of order or combined
- Luke refuses food two meals in a row
- Vomiting more than once in 24 hours
- Diarrhea returning after improvement
- Lethargy - not interested in toys or movement

CONOR'S HEALTH:
- ADHD - Adderall 4AM
- Cancer survivor - clear Feb/Mar 2026, monitor for fatigue or unusual symptoms
- Log energy, sleep, stress when provided

TONE: Direct. Flag problems immediately. One concrete action when something's off. Never lecture.`;

router.post("/log-luke", async (req, res) => {
  const entry = buildLukeEntry(req.body);
  const flags = persistLukeEntry(entry);
  const flagText = flags.length > 0 ? "\n" + flags.join("\n") : "";
  res.json({ reply: `Logged.${flagText}`, entry });
});

router.post("/draft-luke", (req, res) => {
  const entry = buildLukeEntry(req.body);
  const draft = {
    id: "luke-draft-" + Date.now(),
    created_at: new Date().toISOString(),
    entry
  };
  const drafts = loadLukeDrafts();
  drafts.push(draft);
  saveLukeDrafts(drafts.slice(-20));
  log("luke-draft-created", { id: draft.id, entry });
  res.json({
    reply: `Drafted Luke log. Confirm with POST /agent/health/confirm-luke using id ${draft.id}.`,
    requires_confirmation: true,
    draft
  });
});

router.post("/confirm-luke", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  const drafts = loadLukeDrafts();
  const draft = drafts.find(d => d.id === id);
  if (!draft) return res.status(404).json({ error: "draft not found" });

  const flags = persistLukeEntry(draft.entry);
  saveLukeDrafts(drafts.filter(d => d.id !== id));
  const flagText = flags.length > 0 ? "\n" + flags.join("\n") : "";
  res.json({ reply: `Confirmed.${flagText}`, entry: draft.entry, confirmed_id: id });
});

router.get("/drafts-luke", (req, res) => {
  res.json({ drafts: loadLukeDrafts() });
});

router.get("/luke-status", async (req, res) => {
  const logs = loadLukeLogs();
  if (logs.length === 0) return res.json({ reply: "No Luke logs yet." });

  const recent = logs.slice(-7);
  try {
    const routed = await createRoutedText({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 200,
      system: AGENT_04_SYSTEM,
      userMessage: `Luke's last 7 entries:
${recent.map(e => `${e.date}: food=${e.food_eaten}, stool=${e.stool}, vomiting=${e.vomiting}, energy=${e.energy}, meds=${e.meds}`).join("\n")}

Assess trend. Flag any concerns. One concrete action if needed.`,
      feature: "summarize",
      allowAnthropic: false,
    });

    res.json({ reply: routed.text, logs: recent, provider: routed.provider, model: routed.model, fallback: routed.fallback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/med-schedule", (req, res) => {
  res.json({
    reply: "Luke's med schedule",
    schedule: [
      { time: "4:00 AM", med: "Omeprazole", instructions: "ALONE. Empty stomach. Nothing else." },
      { time: "4:30 AM", med: "Mirtazapine + Prednisone", instructions: "TOGETHER. With food (kibble + cottage cheese)." },
      { time: "As needed", med: "Carafate", instructions: "ONLY if Luke refuses kibble voluntarily. Trigger is refusal, not clock." }
    ]
  });
});

router.get("/assess", async (req, res) => {
  const logs = loadLukeLogs();
  if (logs.length === 0) return res.json({ assessment: "No Luke logs yet.", concern: false });

  const recent = logs.slice(-10);
  const vomitCount = recent.filter(l => l.vomiting).length;
  const refusedCount = recent.filter(l => l.food_eaten === "refused" || l.food_eaten === 0).length;
  const diarrheaCount = recent.filter(l => l.stool === "diarrhea").length;
  const lowEnergyCount = recent.filter(l => l.energy === "low").length;
  const concern = vomitCount > 1 || refusedCount > 2 || diarrheaCount > 1;

  try {
    const routed = await createRoutedText({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 200,
      system: AGENT_04_SYSTEM,
      userMessage: `Luke's last ${recent.length} entries:\n${recent.map(e => `${e.date}: food=${e.food_eaten}, stool=${e.stool}, vomit=${e.vomiting}, energy=${e.energy}`).join("\n")}\n\nVomiting: ${vomitCount}x | Food refused: ${refusedCount}x | Diarrhea: ${diarrheaCount}x | Low energy: ${lowEnergyCount}x\n\nTwo sentences max: trend and one action if needed. If stable, say so.`,
      feature: "summarize",
      allowAnthropic: false,
    });
    res.json({ assessment: routed.text, concern, flags: { vomiting: vomitCount, refused: refusedCount, diarrhea: diarrheaCount, low_energy: lowEnergyCount }, provider: routed.provider, model: routed.model, fallback: routed.fallback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/log-conor", (req, res) => {
  const { energy, sleep, stress, notes } = req.body;
  const mem = loadMemory();
  if (!mem.conor_health_log) mem.conor_health_log = [];
  const entry = {
    date: new Date().toISOString().slice(0, 10),
    energy: energy || null,
    sleep: sleep || null,
    stress: stress || null,
    notes: notes || null
  };
  recordConorHealthLog(entry);
  mem.conor_health_log.push(entry);
  if (mem.conor_health_log.length > 30) mem.conor_health_log = mem.conor_health_log.slice(-30);
  saveMemory(mem);
  log("conor-health", entry);
  res.json({ reply: "Logged.", entry });
});

module.exports = router;
