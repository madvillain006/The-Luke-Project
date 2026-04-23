const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { log: jarvisLog } = require("../lib/logger");
const client = new Anthropic();
const ROOT = path.join(__dirname, "..");

const ARCH_LOG    = path.join(ROOT, "ARCHITECT_LOG.jsonl");
const ARCH_TOKENS = path.join(ROOT, "ARCH_TOKENS.jsonl");
const COSTS_FILE  = path.join(ROOT, "architect-costs.json");
const PROPOSALS   = path.join(ROOT, "proposals");
const REJECTED    = path.join(ROOT, "REJECTED_PATTERNS.jsonl");
const ZERO_FILE   = path.join(ROOT, "arch-zero-streak.json");

const DAILY_BUDGET      = 2.00;
const HAIKU_IN_RATE     = 0.00000025;    // $0.25/1M
const HAIKU_OUT_RATE    = 0.00000125;    // $1.25/1M
const HAIKU_CACHE_WRITE = 0.0000003125;  // $0.3125/1M (1.25x input)
const HAIKU_CACHE_READ  = 0.000000025;   // $0.025/1M (0.1x input)

const PHASE = "A";

const PROTECTED = [
  "agent-02-trader.js", "agent-02b-autonomous.js", "agent-04-health.js",
  "autonomous-state.json", "memory.json", "package.json", "package-lock.json",
  "ARCHITECT_LOG.jsonl", "architect-costs.json", "ARCH_TOKENS.jsonl", "arch-zero-streak.json",
  "SWEEPER_STATE.json", "SWEEPER_MAP.json", "SWEEPER_LOG.jsonl", "sweeper-costs.json",
  "tool-calls.jsonl", "tool-health.jsonl", "canary-last.json", "canary-log.jsonl",
  "scheduler-heartbeat.json", "tradovate-health.json",
];

// Static — cached block 1. Role + rules + output schema. Keep compact.
const SYSTEM_PROMPT = `You are Agent-09, Jarvis architect, Phase A (read-only observer).
Scan logs and repo. Return structured observations. No code changes. No proposals.

Rules:
- Only report observations with concrete evidence in the data provided
- severity: low | medium | high
- category: log_noise | dead_code | inefficiency | error_pattern | duplicate | hardcoded_literal | other
- Return ONLY a valid JSON array — no prose, no markdown fences
- If nothing notable, return []

Output schema (exact keys):
[{"sev":"high","cat":"error_pattern","desc":"one sentence","loc":"filename","ev":"exact excerpt","why":"one sentence"}]`;

// ── UTILS ────────────────────────────────────────────────

function archLog(entry) {
  try { fs.appendFileSync(ARCH_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n"); } catch {}
}

function logTokens(entry) {
  try { fs.appendFileSync(ARCH_TOKENS, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n"); } catch {}
}

function loadCosts() {
  try { return JSON.parse(fs.readFileSync(COSTS_FILE, "utf8")); } catch { return {}; }
}

function trackCost(inputT, outputT, cacheWriteT = 0, cacheReadT = 0) {
  const day = new Date().toISOString().slice(0, 10);
  const c = loadCosts();
  if (!c[day]) c[day] = { input_tokens: 0, output_tokens: 0, cache_write: 0, cache_read: 0, cost: 0 };
  c[day].input_tokens  += inputT;
  c[day].output_tokens += outputT;
  c[day].cache_write   += cacheWriteT;
  c[day].cache_read    += cacheReadT;
  c[day].cost += inputT * HAIKU_IN_RATE + outputT * HAIKU_OUT_RATE +
                 cacheWriteT * HAIKU_CACHE_WRITE + cacheReadT * HAIKU_CACHE_READ;
  fs.writeFileSync(COSTS_FILE, JSON.stringify(c, null, 2));
  return c[day].cost;
}

function getDailyCost() {
  const day = new Date().toISOString().slice(0, 10);
  return loadCosts()[day]?.cost || 0;
}

function tailLog(filePath, maxLines = 100) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
    return lines.slice(-maxLines).join("\n");
  } catch { return null; }
}

function dedupeLog(text) {
  if (!text) return text;
  const lines = text.split("\n");
  const out = [];
  let prev = null, count = 1;
  for (const line of lines) {
    if (line === prev) { count++; continue; }
    if (prev !== null) out.push(count > 1 ? `${count}x: ${prev}` : prev);
    prev = line; count = 1;
  }
  if (prev !== null) out.push(count > 1 ? `${count}x: ${prev}` : prev);
  return out.join("\n");
}

function getZeroStreak() {
  try { return JSON.parse(fs.readFileSync(ZERO_FILE, "utf8")).streak || 0; } catch { return 0; }
}

function setZeroStreak(n) {
  try { fs.writeFileSync(ZERO_FILE, JSON.stringify({ streak: n, updated: new Date().toISOString() })); } catch {}
}

// ── GIT INIT ─────────────────────────────────────────────

function ensureGit() {
  const check = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: ROOT, encoding: "utf8" });
  if (check.status === 0) return { status: "exists" };

  const gitignorePath = path.join(ROOT, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, [
      "node_modules/", "screenshot.png", "*.png",
      "discord-exports/", "architect-costs.json", ".env"
    ].join("\n") + "\n");
  }

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Jarvis",    GIT_AUTHOR_EMAIL: "jarvis@local",
    GIT_COMMITTER_NAME: "Jarvis", GIT_COMMITTER_EMAIL: "jarvis@local"
  };

  spawnSync("git", ["init"], { cwd: ROOT, encoding: "utf8", env });
  spawnSync("git", ["add", "."], { cwd: ROOT, encoding: "utf8", env });
  const commit = spawnSync("git", ["commit", "-m", "arch: initial commit — git init by agent-09"],
    { cwd: ROOT, encoding: "utf8", env });

  const ok = commit.status === 0;
  archLog({ event: "git_initialized", success: ok, stderr: commit.stderr?.slice(0, 200) });
  return { status: ok ? "initialized" : "init_failed", stderr: commit.stderr?.slice(0, 200) };
}

// ── CORE SCAN ─────────────────────────────────────────────

async function runScan(trigger = "scheduled", forceRun = false) {
  // Budget gate
  const spentToday = getDailyCost();
  if (spentToday >= DAILY_BUDGET) {
    archLog({ phase: PHASE, trigger, skipped: "budget_exceeded", cost_today: spentToday.toFixed(4) });
    jarvisLog("agent-09-dormant", { reason: "budget_exceeded", cost_today: spentToday.toFixed(4) });
    return { skipped: true, reason: "budget", cost_today: spentToday };
  }

  // Zero-streak gate (skip scheduled runs; manual /run?force=true bypasses)
  if (!forceRun) {
    const streak = getZeroStreak();
    if (streak >= 3) {
      archLog({ phase: PHASE, trigger, skipped: "zero_streak", streak });
      jarvisLog("agent-09-paused", { reason: "zero_streak", streak });
      return { skipped: true, reason: "zero_streak", streak };
    }
  }

  const git = ensureGit();

  // Cached block 2: agent's own source code (mostly static between deploys)
  const selfSource = fs.readFileSync(__filename, "utf8");

  // Dynamic: log data (not cached — changes every run)
  const logFiles = ["jarvis-log.jsonl", "action-log.jsonl"];
  const logBlocks = logFiles
    .map(f => {
      const raw = tailLog(path.join(ROOT, f), 80);
      if (!raw) return null;
      return `=== ${f} ===\n${dedupeLog(raw)}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 5500);

  const archTail = dedupeLog(tailLog(ARCH_LOG, 40)) || "(none)";

  // Repo snapshot
  const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(e => !["node_modules", ".git", "discord-exports"].includes(e.name))
    .map(e => (e.isDirectory() ? "d " : "f ") + e.name)
    .join("\n");

  const agentEntries = fs.readdirSync(path.join(ROOT, "agents"), { withFileTypes: true })
    .map(e => e.name).join(", ");

  fs.mkdirSync(PROPOSALS, { recursive: true });
  const openProposals = fs.readdirSync(PROPOSALS).filter(f => f.endsWith(".md")).length;

  const dynamicPrompt =
    `TRIGGER: ${trigger} | GIT: ${git.status} | PROPOSALS: ${openProposals} | BUDGET: $${spentToday.toFixed(4)}/$${DAILY_BUDGET}\n\n` +
    `REPO:\n${rootEntries}\n\nAGENTS: ${agentEntries}\n\n` +
    `ARCH_LOG (tail 40):\n${archTail}\n\n` +
    `RECENT LOGS:\n${logBlocks || "(no logs yet)"}`;

  let observations = [];
  let usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: [
        { type: "text", text: SYSTEM_PROMPT,                cache_control: { type: "ephemeral" } },
        { type: "text", text: `SELF SOURCE:\n${selfSource}`, cache_control: { type: "ephemeral" } }
      ],
      messages: [{ role: "user", content: dynamicPrompt }]
    });
    usage = { ...usage, ...resp.usage };
    const text = resp.content[0].text.trim();
    const m = text.match(/\[[\s\S]*\]/);
    if (m) { try { observations = JSON.parse(m[0]); } catch {} }
  } catch (err) {
    archLog({ phase: PHASE, trigger, scan_error: err.message });
    return { error: err.message };
  }

  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead  = usage.cache_read_input_tokens     || 0;
  const runCost    = usage.input_tokens * HAIKU_IN_RATE + usage.output_tokens * HAIKU_OUT_RATE +
                     cacheWrite * HAIKU_CACHE_WRITE + cacheRead * HAIKU_CACHE_READ;
  const dayTotal   = trackCost(usage.input_tokens, usage.output_tokens, cacheWrite, cacheRead);

  logTokens({
    trigger,
    in: usage.input_tokens, out: usage.output_tokens,
    cache_write: cacheWrite, cache_read: cacheRead,
    cost: runCost.toFixed(5), obs: observations.length
  });

  // Zero-streak tracking
  const prevStreak = getZeroStreak();
  const newStreak  = observations.length === 0 ? prevStreak + 1 : 0;
  setZeroStreak(newStreak);

  if (newStreak === 3) {
    fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "AGENT-09: 3 consecutive zero-observation scans — scheduled scans paused. Use /run?force=true or check that logs are accumulating." })
    }).catch(() => {});
    archLog({ phase: PHASE, trigger, event: "zero_streak_alert", streak: 3 });
  }

  archLog({
    phase: PHASE, trigger, git,
    observations_count: observations.length,
    observations,
    tokens: { in: usage.input_tokens, out: usage.output_tokens, cache_write: cacheWrite, cache_read: cacheRead },
    cost_run: runCost.toFixed(5),
    cost_day: dayTotal.toFixed(4)
  });

  // Notify on high-severity findings
  const high = observations.filter(o => o.sev === "high");
  if (high.length > 0) {
    fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `AGENT-09 [${trigger}]: ${observations.length} obs, ${high.length} high\n` +
          high.map(o => `[${o.cat}] ${o.desc}\n  @ ${o.loc}`).join("\n")
      })
    }).catch(() => {});
  }

  jarvisLog("agent-09-run", { trigger, obs: observations.length, run_cost: runCost.toFixed(5), day_total: dayTotal.toFixed(4), cache_write: cacheWrite, cache_read: cacheRead });
  return {
    phase: PHASE, trigger,
    observations_count: observations.length,
    high_severity: high.length,
    cost_run: runCost.toFixed(5),
    cost_day: dayTotal.toFixed(4),
    zero_streak: newStreak
  };
}

// ── ROUTES ─────────────────────────────────────────────────

router.post("/run", async (req, res) => {
  const force = req.query.force === "true" || req.body?.force === true;
  if (force) setZeroStreak(0);
  res.json({ started: true, phase: PHASE, force });
  try { await runScan(req.body?.trigger || "manual", force); } catch {}
});

router.get("/status", (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const costs = loadCosts();
  let lastEntry = null;
  try {
    const lines = fs.readFileSync(ARCH_LOG, "utf8").split("\n").filter(Boolean);
    if (lines.length) lastEntry = JSON.parse(lines[lines.length - 1]);
  } catch {}
  let openProposals = 0;
  try { openProposals = fs.readdirSync(PROPOSALS).filter(f => f.endsWith(".md")).length; } catch {}
  res.json({
    phase: PHASE,
    cost_today: (costs[day]?.cost || 0).toFixed(4),
    daily_budget: DAILY_BUDGET,
    budget_remaining: (DAILY_BUDGET - (costs[day]?.cost || 0)).toFixed(4),
    open_proposals: openProposals,
    last_scan: lastEntry?.ts || null,
    last_observations: lastEntry?.observations_count || 0,
    zero_streak: getZeroStreak()
  });
});

router.get("/log", (req, res) => {
  try {
    const n = Math.min(parseInt(req.query.n) || 10, 50);
    const lines = fs.readFileSync(ARCH_LOG, "utf8").split("\n").filter(Boolean);
    const entries = lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json({ count: entries.length, entries });
  } catch { res.json({ count: 0, entries: [] }); }
});

router.get("/tokens", (req, res) => {
  try {
    const n = Math.min(parseInt(req.query.n) || 20, 100);
    const lines = fs.readFileSync(ARCH_TOKENS, "utf8").split("\n").filter(Boolean);
    const entries = lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json({ count: entries.length, entries });
  } catch { res.json({ count: 0, entries: [] }); }
});

router.get("/proposals", (req, res) => {
  try {
    fs.mkdirSync(PROPOSALS, { recursive: true });
    const files = fs.readdirSync(PROPOSALS).filter(f => f.endsWith(".md"));
    res.json({ count: files.length, proposals: files });
  } catch { res.json({ count: 0, proposals: [] }); }
});

module.exports = router;
