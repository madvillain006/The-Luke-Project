const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { events } = require("../lib/paths");

const client = new Anthropic();
const LOG_FILE = events.jarvisLog;
const PIPELINE_FILE = path.join(__dirname, "../OPPORTUNITY_PIPELINE.md");
const OPPS_FILE = path.join(__dirname, "../opportunities.jsonl");

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadOpportunities() {
  try {
    return fs.readFileSync(OPPS_FILE, "utf8").split("\n").filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function saveOpportunity(opp) {
  fs.appendFileSync(OPPS_FILE, JSON.stringify({ ...opp, id: opp.id || Date.now().toString() }) + "\n");
}

function updatePipelineDoc(opps) {
  const active = opps.filter(o => o.status !== "closed" && o.status !== "rejected");
  const closed = opps.filter(o => o.status === "closed");
  const lines = [
    "# OPPORTUNITY PIPELINE",
    `*Updated ${new Date().toISOString().slice(0, 10)}*`,
    "",
    `## Active (${active.length})`,
    ...active.map(o =>
      `### ${o.type}: ${o.title}\n` +
      `**Status:** ${o.status} | **Date:** ${o.date}\n` +
      (o.value ? `**Value:** ${o.value}\n` : "") +
      (o.source ? `**Source:** ${o.source}\n` : "") +
      (o.notes ? `**Notes:** ${o.notes}\n` : "") +
      (o.pitch_sent ? `**Pitch sent:** ${o.pitch_sent.slice(0, 80)}...\n` : "")
    ),
    "",
    `## Closed (${closed.length})`,
    ...closed.map(o => `- ${o.title} — ${o.status} (${o.date})`)
  ];
  fs.writeFileSync(PIPELINE_FILE, lines.join("\n"));
}

const AGENT_07_SYSTEM = `You are the OPPORTUNITY agent within Luke, built for Conor.

WHO CONOR IS:
- 32 (June 17), Buffalo NY moving to Tennessee mid-June 2026
- Master's in Public History + deep technical AI skills
- Built a full autonomous trading + life-management AI agent system in 15 hours
- Expert at trading systems: ximes+bobby GEX heatmap methodology, MNQ/MES futures, signal synthesis
- Direct communicator. Dry humor. No BS. Gets things done fast.

CONOR'S SKILLS (match opportunities to these):
- AI agent development (Node.js, Python, full stack)
- Autonomous trading systems (futures, options, signal processing)
- Historical research and writing (Master's credential)
- Pattern recognition and synthesis
- System building from scratch

TARGET OPPORTUNITY TYPES:
- AI build contracts: $2-5k, Luke does the actual work
- Trading research: synthesize edge from public signals
- Historical research and writing: institutional, academic, think-tank
- Prop firm evaluation: Apex/Topstep funded accounts
- Signal sharing: paid Discord or Substack

CONOR'S VOICE FOR PITCHES:
- Direct, no fluff
- Leads with demonstrated competence, not soft sells
- References specific things he's built or proved
- Doesn't beg, doesn't oversell, doesn't cold pitch strangers
- One paragraph max. Makes the case and stops.

HARD RULES:
- Never draft cold outreach to strangers
- Never oversell or use corporate filler language ("synergies", "leverage", "passionate about")
- Never pitch something he can't deliver
- Always lead with proof, not promise

TONE: Direct. Make the call. One concrete recommendation.`;

// Intake a new opportunity — paste a job listing, contract post, or opportunity description
router.post("/intake", async (req, res) => {
  const { text, source, type } = req.body;
  if (!text) return res.status(400).json({ error: "No opportunity text provided" });

  try {
    const analysis = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: AGENT_07_SYSTEM,
      messages: [{
        role: "user",
        content: `Evaluate this opportunity for Conor. Source: ${source || "unknown"}\n\nOPPORTUNITY:\n${text.slice(0, 3000)}\n\nOutput exactly:\nFIT: HIGH/MEDIUM/LOW/PASS\nTYPE: [trading-research / ai-build / research-writing / prop-firm / signal-sharing / other]\nVALUE: [estimated value or "unclear"]\nWHY: one sentence on the fit\nPITCH: [full draft pitch in Conor's voice, or "N/A — LOW FIT" if PASS]`
      }]
    });

    const reply = analysis.content[0].text;
    const fitMatch = reply.match(/FIT:\s*(HIGH|MEDIUM|LOW|PASS)/i);
    const typeMatch = reply.match(/TYPE:\s*([^\n]+)/i);
    const valueMatch = reply.match(/VALUE:\s*([^\n]+)/i);
    const whyMatch = reply.match(/WHY:\s*([^\n]+)/i);
    const pitchMatch = reply.match(/PITCH:\s*([\s\S]+?)(?:$)/i);

    const opp = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      title: text.slice(0, 80).replace(/\n/g, " "),
      source: source || "manual",
      type: typeMatch ? typeMatch[1].trim() : (type || "unknown"),
      fit: fitMatch ? fitMatch[1].toUpperCase() : "UNKNOWN",
      value: valueMatch ? valueMatch[1].trim() : null,
      notes: whyMatch ? whyMatch[1].trim() : null,
      status: "new",
      raw: text.slice(0, 500),
      pitch: pitchMatch ? pitchMatch[1].trim().replace(/^N\/A.*$/i, "") : null
    };

    if (opp.fit !== "PASS") {
      saveOpportunity(opp);
      const allOpps = loadOpportunities();
      updatePipelineDoc(allOpps);
      log("opportunity-intake", { title: opp.title, fit: opp.fit, type: opp.type });
    }

    res.json({ reply, opp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pipeline
router.get("/pipeline", (req, res) => {
  const opps = loadOpportunities();
  const active = opps.filter(o => o.status !== "closed" && o.status !== "rejected");
  res.json({
    total: opps.length,
    active: active.length,
    opportunities: opps.slice(-20)
  });
});

// Update opportunity status
router.post("/update", (req, res) => {
  const { id, status, notes } = req.body;
  if (!id || !status) return res.status(400).json({ error: "id and status required" });

  const opps = loadOpportunities();
  const idx = opps.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ error: "Opportunity not found" });

  opps[idx].status = status;
  if (notes) opps[idx].notes = notes;
  opps[idx].updated = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(OPPS_FILE, opps.map(o => JSON.stringify(o)).join("\n") + "\n");
  updatePipelineDoc(opps);
  log("opportunity-update", { id, status });
  res.json({ updated: true, opportunity: opps[idx] });
});

// Draft a pitch for an existing opportunity
router.post("/draft-pitch", async (req, res) => {
  const { id, context } = req.body;
  const opps = loadOpportunities();
  const opp = opps.find(o => o.id === id);
  if (!opp) return res.status(404).json({ error: "Opportunity not found" });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: AGENT_07_SYSTEM,
      messages: [{
        role: "user",
        content: `Draft a pitch for this opportunity in Conor's voice.\n\nOpportunity: ${opp.title}\nType: ${opp.type}\nValue: ${opp.value || "unclear"}\nContext: ${context || opp.raw || "none"}\n\nOne paragraph. Direct. Leads with proof. No fluff.`
      }]
    });

    const pitch = response.content[0].text;
    const idx = opps.findIndex(o => o.id === id);
    opps[idx].pitch = pitch;
    opps[idx].pitch_sent = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(OPPS_FILE, opps.map(o => JSON.stringify(o)).join("\n") + "\n");
    updatePipelineDoc(opps);
    log("opportunity-pitch", { id, title: opp.title });
    res.json({ reply: pitch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan for opportunities from a free-form description of a platform/channel
router.post("/scan-context", async (req, res) => {
  const { context, platform } = req.body;
  if (!context) return res.status(400).json({ error: "No context provided" });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: AGENT_07_SYSTEM,
      messages: [{
        role: "user",
        content: `Platform: ${platform || "unknown"}\n\nContent:\n${context.slice(0, 3000)}\n\nIs there anything here worth responding to for Conor? YES or NO, and one sentence why.`
      }]
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
