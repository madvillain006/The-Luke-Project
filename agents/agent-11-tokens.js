const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const ROOT         = path.join(__dirname, "..");
const USAGE_FILE   = path.join(ROOT, "token-usage.jsonl");
const DAILY_FILE   = path.join(ROOT, "token-usage-daily.json");
const WEEKLY_FILE  = path.join(ROOT, "token-usage-weekly.json");
const HISTORY_FILE = path.join(ROOT, "token-usage-history.jsonl");

const SOFT_CAP = 5.00;
const HARD_CAP = 10.00;

const RATES = {
  "claude-opus-4-7":           { in: 0.000015,   out: 0.000075,   cw: 0.0000187,  cr: 0.0000015  },
  "claude-haiku-4-5-20251001": { in: 0.00000025, out: 0.00000125, cw: 0.0000003125, cr: 0.000000025 },
  "claude-sonnet-4-6":         { in: 0.000003,   out: 0.000015,   cw: 0.00000375, cr: 0.0000003  },
};

function costOf(model, inT, outT, cacheWriteT, cacheReadT) {
  const r = RATES[model] || RATES["claude-haiku-4-5-20251001"];
  return inT * r.in + outT * r.out + (cacheWriteT || 0) * r.cw + (cacheReadT || 0) * r.cr;
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

function weekKey() {
  const d = new Date();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return mon.toISOString().slice(0, 10);
}

function loadDaily()   { try { return JSON.parse(fs.readFileSync(DAILY_FILE,  "utf8")); } catch { return {}; } }
function loadWeekly()  { try { return JSON.parse(fs.readFileSync(WEEKLY_FILE, "utf8")); } catch { return {}; } }
function saveDaily(d)  { try { fs.writeFileSync(DAILY_FILE,  JSON.stringify(d, null, 2)); } catch {} }
function saveWeekly(w) { try { fs.writeFileSync(WEEKLY_FILE, JSON.stringify(w, null, 2)); } catch {} }

let _lastCapAlert = { level: null, ts: 0 };

function trackUsage(agent, model, inT, outT, cacheWriteT = 0, cacheReadT = 0) {
  if (!inT && !outT) return { cost: 0, daily_total: getDailyTotal() };
  const cost = costOf(model, inT || 0, outT || 0, cacheWriteT, cacheReadT);

  try {
    fs.appendFileSync(USAGE_FILE, JSON.stringify({
      ts: new Date().toISOString(), agent, model,
      in_tok: inT, out_tok: outT, cache_write: cacheWriteT, cache_read: cacheReadT, cost
    }) + "\n");
  } catch {}

  const tod = todayKey();
  const d = loadDaily();
  if (!d[tod]) d[tod] = { total_cost: 0, agents: {} };
  d[tod].total_cost = (d[tod].total_cost || 0) + cost;
  if (!d[tod].agents[agent]) d[tod].agents[agent] = { cost: 0, calls: 0 };
  d[tod].agents[agent].cost  += cost;
  d[tod].agents[agent].calls += 1;
  saveDaily(d);

  const wk = weekKey();
  const w = loadWeekly();
  if (!w[wk]) w[wk] = { total_cost: 0, agents: {} };
  w[wk].total_cost = (w[wk].total_cost || 0) + cost;
  if (!w[wk].agents[agent]) w[wk].agents[agent] = { cost: 0, calls: 0 };
  w[wk].agents[agent].cost  += cost;
  w[wk].agents[agent].calls += 1;
  saveWeekly(w);

  const dailyTotal = d[tod].total_cost;

  // Threshold alerts (debounce 30 min per level)
  const now = Date.now();
  if (global.broadcast) {
    const pct = dailyTotal / HARD_CAP;
    let level = null;
    if (pct >= 1.0) level = "hard";
    else if (pct >= 0.85) level = "warn85";
    else if (pct >= 0.60) level = "warn60";
    if (level && (level !== _lastCapAlert.level || now - _lastCapAlert.ts > 30 * 60000)) {
      _lastCapAlert = { level, ts: now };
      global.broadcast({ type: "token_cap", level, total: dailyTotal, pct });
    }
  }

  return { cost, daily_total: dailyTotal };
}

function getDailyTotal() {
  try {
    const d = loadDaily();
    return d[todayKey()]?.total_cost || 0;
  } catch { return 0; }
}

function getDailyStatus() {
  const d = loadDaily();
  const tod = todayKey();
  const data = d[tod] || { total_cost: 0, agents: {} };
  const total = data.total_cost || 0;
  const top = Object.entries(data.agents || {})
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5)
    .map(([agent, s]) => ({ agent, cost: parseFloat(s.cost.toFixed(4)), calls: s.calls }));
  return {
    date: tod, total_cost: parseFloat(total.toFixed(4)),
    soft_cap: SOFT_CAP, hard_cap: HARD_CAP,
    cap_status: total >= HARD_CAP ? "hard" : total >= SOFT_CAP ? "soft" : "ok",
    pct: parseFloat((total / HARD_CAP).toFixed(4)),
    top_agents: top
  };
}

function getWeeklyStatus() {
  const w = loadWeekly();
  const wk = weekKey();
  const data = w[wk] || { total_cost: 0 };
  return { week: wk, total_cost: parseFloat((data.total_cost || 0).toFixed(4)) };
}

function isHardCap() { return getDailyStatus().cap_status === "hard"; }
function isSoftCap() { return ["soft", "hard"].includes(getDailyStatus().cap_status); }

router.post("/log", (req, res) => {
  const { agent, model, in_tok, out_tok, cache_write, cache_read } = req.body;
  const result = trackUsage(
    agent || "unknown", model || "claude-haiku-4-5-20251001",
    in_tok || 0, out_tok || 0, cache_write || 0, cache_read || 0
  );
  res.json({ ok: true, ...result });
});

router.get("/daily",  (req, res) => res.json(getDailyStatus()));
router.get("/weekly", (req, res) => res.json(getWeeklyStatus()));
router.get("/status", (req, res) => res.json({ daily: getDailyStatus(), weekly: getWeeklyStatus() }));

router.post("/reset-daily", (req, res) => {
  const tod = todayKey();
  const d = loadDaily();
  for (const [day, data] of Object.entries(d)) {
    if (day !== tod) {
      try { fs.appendFileSync(HISTORY_FILE, JSON.stringify({ date: day, ...data }) + "\n"); } catch {}
    }
  }
  const newD = {};
  if (d[tod]) newD[tod] = d[tod];
  saveDaily(newD);
  res.json({ ok: true, archived: Object.keys(d).filter(k => k !== tod).length });
});

router.post("/reset-weekly", (req, res) => {
  const wk = weekKey();
  const w = loadWeekly();
  const newW = {};
  if (w[wk]) newW[wk] = w[wk];
  saveWeekly(newW);
  res.json({ ok: true });
});

module.exports = { router, trackUsage, getDailyStatus, getWeeklyStatus, isHardCap, isSoftCap, SOFT_CAP, HARD_CAP };
