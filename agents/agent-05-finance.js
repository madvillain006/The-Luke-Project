const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const MEMORY_FILE = path.join(__dirname, "../memory.json");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function saveMemory(mem) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

const AGENT_05_SYSTEM = `You are the FINANCE agent within Jarvis — Conor's money tracking and forecasting layer.

CURRENT SITUATION:
- Move fund target: $6,000 by mid-June 2026
- Monthly burn: $1,410
- Rent: covered by Kat
- Conor's expenses: Luke's meds ($150), gas + energy drinks ($200)
- Primary income: Instacart ~$1,000/week clean
- Trading capital: $500 (separate, do not touch)

YOUR JOB:
- Track move fund balance
- Log income and expenses
- Forecast timeline to $6k
- Track and prioritize debt
- Flag immediately if trajectory is off

FORECASTING RULES:
- Assume $900/week net Instacart (conservative)
- Account for monthly burn
- Flag if June deadline is at risk
- Suggest one concrete action when behind

TONE: Numbers first. One sentence of context. One action if needed. Never vague.`;

function getWeeksToDeadline() {
  const deadline = new Date("2026-06-15");
  const now = new Date();
  return Math.max(0, Math.ceil((deadline - now) / (7 * 24 * 60 * 60 * 1000)));
}

// Update move fund
router.post("/update-fund", (req, res) => {
  const { amount, type, notes } = req.body;
  if (!amount || !type) return res.status(400).json({ error: "amount and type (add/subtract) required" });

  const mem = loadMemory();
  if (!mem.move_fund) mem.move_fund = 0;
  if (!mem.fund_log) mem.fund_log = [];

  const delta = type === "add" ? parseFloat(amount) : -parseFloat(amount);
  mem.move_fund += delta;
  mem.fund_log.push({
    date: new Date().toISOString().slice(0, 10),
    delta,
    balance: mem.move_fund,
    notes: notes || null
  });

  saveMemory(mem);
  log("fund-update", { delta, balance: mem.move_fund });

  const remaining = 6000 - mem.move_fund;
  const weeks = getWeeksToDeadline();
  const weeklyNeeded = weeks > 0 ? (remaining / weeks).toFixed(2) : "DEADLINE PASSED";

  res.json({
    reply: `Fund: $${mem.move_fund.toFixed(2)} / $6,000 | $${remaining.toFixed(2)} remaining | Need $${weeklyNeeded}/week | ${weeks} weeks left`,
    balance: mem.move_fund
  });
});

// Fund status
router.get("/fund-status", (req, res) => {
  const mem = loadMemory();
  const balance = mem.move_fund || 0;
  const remaining = 6000 - balance;
  const weeks = getWeeksToDeadline();
  const weeklyNeeded = weeks > 0 ? (remaining / weeks).toFixed(2) : "DEADLINE PASSED";
  const onTrack = parseFloat(weeklyNeeded) <= 900;

  res.json({
    balance: balance.toFixed(2),
    target: 6000,
    remaining: remaining.toFixed(2),
    weeks_left: weeks,
    weekly_needed: weeklyNeeded,
    on_track: onTrack,
    status: onTrack ? "✓ On track" : `⚠ Need $${weeklyNeeded}/week — Instacart target is $900/week conservative`
  });
});

// Log debt
router.post("/debt-log", (req, res) => {
  const { creditor, balance, interest_rate, minimum } = req.body;
  if (!creditor || !balance) return res.status(400).json({ error: "creditor and balance required" });

  const mem = loadMemory();
  if (!mem.debts) mem.debts = [];

  const existing = mem.debts.findIndex(d => d.creditor === creditor);
  const debt = { creditor, balance: parseFloat(balance), interest_rate: interest_rate || null, minimum: minimum || null, updated: new Date().toISOString() };

  if (existing >= 0) {
    mem.debts[existing] = debt;
  } else {
    mem.debts.push(debt);
  }

  saveMemory(mem);
  log("debt-logged", debt);

  const total = mem.debts.reduce((sum, d) => sum + d.balance, 0);
  res.json({ reply: `Logged. Total debt: $${total.toFixed(2)}`, debt });
});

// Forecast
router.post("/forecast", async (req, res) => {
  const mem = loadMemory();
  const balance = mem.move_fund || 0;
  const remaining = 6000 - balance;
  const weeks = getWeeksToDeadline();
  const debts = mem.debts || [];

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: AGENT_05_SYSTEM,
      messages: [{
        role: "user",
        content: `Current financial snapshot:
Move fund: $${balance.toFixed(2)} / $6,000
Remaining: $${remaining.toFixed(2)}
Weeks to deadline: ${weeks}
Weekly Instacart target: $900 conservative
Monthly burn: $1,410
Debts: ${debts.length > 0 ? debts.map(d => `${d.creditor}: $${d.balance}`).join(", ") : "none logged"}

Forecast: will we hit $6k by mid-June? What's the one thing to do differently?`
      }]
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proactive assessment — on track for Tennessee or not?
router.get("/assess", async (req, res) => {
  const mem = loadMemory();
  const balance = mem.move_fund || 0;
  const remaining = 6000 - balance;
  const weeks = getWeeksToDeadline();
  const weeklyNeeded = weeks > 0 ? remaining / weeks : Infinity;
  const onTrack = weeklyNeeded <= 900;
  const concern = !onTrack || weeks < 4;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: AGENT_05_SYSTEM,
      messages: [{
        role: "user",
        content: `Fund: $${balance.toFixed(0)} / $6,000 | ${weeks} weeks left | Need $${weeklyNeeded.toFixed(0)}/week | Instacart target: $900/week\n\nOne sentence: on track or not, and why. One sentence: what to do about it.`
      }]
    });
    res.json({ assessment: response.content[0].text, concern, on_track: onTrack, balance, weeks_left: weeks, weekly_needed: weeklyNeeded.toFixed(0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;