const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const MEMORY_FILE = path.join(__dirname, "../memory.json");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");
const SHIFTS_FILE = path.join(__dirname, "../shifts.jsonl");

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function saveMemory(mem) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadShifts() {
  try {
    return fs.readFileSync(SHIFTS_FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

function logShift(shift) {
  fs.appendFileSync(SHIFTS_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...shift }) + "\n");
}

const AGENT_03_SYSTEM = `You are the INCOME agent within Jarvis — Conor's Instacart optimization layer.

CONTEXT:
- Target: $1,000/week clean from Instacart
- Move fund target: $6,000 by mid-June 2026
- Monthly burn: $1,410 (rent covered by Kat)
- Gas and energy drinks: ~$200/month Conor's responsibility

YOUR JOB:
- Track shifts: earnings, hours, mileage, zone
- Calculate true $/hour after gas and wear (~$0.21/mile)
- Identify best time slots, zones, order types
- Weekly summaries with one concrete action
- Flag immediately if behind $1k/week pace

OPTIMIZATION TARGETS:
- Best days/times by earnings rate
- Zone performance comparison
- Batch order vs single order profitability
- Gas efficiency by zone

TONE: Numbers first. One concrete recommendation. Never vague.`;

// Log a shift
router.post("/log-shift", (req, res) => {
  const { earnings, hours, miles, zone, notes, date } = req.body;
  if (!earnings || !hours) return res.status(400).json({ error: "earnings and hours required" });

  const gas_cost = (miles || 0) * 0.21;
  const net = earnings - gas_cost;
  const hourly = (net / hours).toFixed(2);

  const shift = {
    date: date || new Date().toISOString().slice(0, 10),
    earnings: parseFloat(earnings),
    hours: parseFloat(hours),
    miles: miles || 0,
    gas_cost: parseFloat(gas_cost.toFixed(2)),
    net: parseFloat(net.toFixed(2)),
    hourly: parseFloat(hourly),
    zone: zone || "unknown",
    notes: notes || null
  };

  logShift(shift);

  const mem = loadMemory();
  if (!mem.income_this_week) mem.income_this_week = 0;
  mem.income_this_week += shift.net;
  mem.last_shift = shift;
  saveMemory(mem);

  log("shift-logged", shift);

  const weeklyTarget = 1000;
  const pace = mem.income_this_week;
  const status = pace >= weeklyTarget ? "✓ On pace" : `⚠ $${(weeklyTarget - pace).toFixed(2)} behind pace`;

  res.json({
    reply: `Logged. Net: $${shift.net} | $${hourly}/hr | Weekly total: $${pace.toFixed(2)} — ${status}`,
    shift
  });
});

// Weekly summary
router.get("/income-summary", async (req, res) => {
  const shifts = loadShifts();
  const mem = loadMemory();

  if (shifts.length === 0) return res.json({ reply: "No shifts logged yet." });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thisWeek = shifts.filter(s => s.date >= weekAgo);
  const totalNet = thisWeek.reduce((sum, s) => sum + s.net, 0);
  const totalHours = thisWeek.reduce((sum, s) => sum + s.hours, 0);
  const avgHourly = totalHours > 0 ? (totalNet / totalHours).toFixed(2) : 0;

  const bestShift = [...thisWeek].sort((a, b) => b.hourly - a.hourly)[0];
  const worstShift = [...thisWeek].sort((a, b) => a.hourly - b.hourly)[0];

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: AGENT_03_SYSTEM,
      messages: [{
        role: "user",
        content: `Weekly summary:
Shifts this week: ${thisWeek.length}
Total net: $${totalNet.toFixed(2)} of $1,000 target
Avg $/hr: $${avgHourly}
Best shift: $${bestShift?.hourly}/hr on ${bestShift?.date} in ${bestShift?.zone}
Worst shift: $${worstShift?.hourly}/hr on ${worstShift?.date} in ${worstShift?.zone}

Give one concrete action to improve next week.`
      }]
    });

    res.json({
      reply: response.content[0].text,
      stats: { totalNet, totalHours, avgHourly, shiftsCount: thisWeek.length, target: 1000 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset weekly counter (call every Monday)
router.post("/reset-week", (req, res) => {
  const mem = loadMemory();
  mem.income_last_week = mem.income_this_week || 0;
  mem.income_this_week = 0;
  saveMemory(mem);
  res.json({ reply: `Week reset. Last week: $${mem.income_last_week.toFixed(2)}` });
});

module.exports = router;