const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const client = new Anthropic();
const ROOT = path.join(__dirname, "..");

const ARCH_LOG   = path.join(ROOT, "ARCHITECT_LOG.jsonl");
const COSTS_FILE = path.join(ROOT, "architect-costs.json");
const PROPOSALS  = path.join(ROOT, "proposals");

// $2/day Haiku cap
const DAILY_BUDGET   = 2.00;
const HAIKU_IN_RATE  = 0.00000025;  // $0.25 / 1M tokens
const HAIKU_OUT_RATE = 0.00000125;  // $1.25 / 1M tokens

// Phase A = read-only observer (no code changes, no proposals)
const PHASE = "A";

// Files agent-09 may never auto-edit — enforced at action layer in Phase C
const PROTECTED = [
  "agent-02-trader.js", "agent-02b-autonomous.js", "agent-04-health.js",
  "autonomous-state.json", "memory.json", "package.json", "package-lock.json"
];

// ── UTILS ─────────────────────────────────────────────

function archLog(entry) {
  try {
    fs.appendFileSync(ARCH_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {}
}

function loadCosts() {
  try { return JSON.parse(fs.readFileSync(COSTS_FILE, "utf8")); } catch { return {}; }
}

function trackCost(inputT, outputT) {
  const day = new Date().toISOString().slice(0, 10);
  const c = loadCosts();
  if (!c[day]) c[day] = { input_tokens: 0, output_tokens: 0, cost: 0 };
  c[day].input_tokens += inputT;
  c[day].output_tokens += outputT;
  c[day].cost += inputT * HAIKU_IN_RATE + outputT * HAIKU_OUT_RATE;
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

// ── GIT INIT (runs once if no .git) ──────────────────

function ensureGit() {
  const check = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: ROOT, encoding: "utf8" });
  if (check.status === 0) return { status: "exists" };

  const gitignorePath = path.join(ROOT, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, [
      "node_modules/",
      "screenshot.png",
      "*.png",
      "discord-exports/",
      "architect-costs.json",
      ".env"
    ].join("\n") + "\n");
  }

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Jarvis",
    GIT_AUTHOR_EMAIL: "jarvis@local",
    GIT_COMMITTER_NAME: "Jarvis",
    GIT_COMMITTER_EMAIL: "jarvis@local"
  };

  spawnSync("git", ["init"], { cwd: ROOT, encoding: "utf8", env });
  spawnSync("git", ["add", "."], { cwd: ROOT, encoding: "utf8", env });
  const commit = spawnSync(
    "git", ["commit", "-m", "arch: initial commit — git init by agent-09"],
    { cwd: ROOT, encoding: "utf8", env }
  );

  const ok = commit.status === 0;
  archLog({ event: "git_initialized", success: ok, stderr: commit.stderr?.slice(0, 200) });
  return { status: ok ? "initialized" : "init_failed", stderr: commit.stderr?.slice(0, 200) };
}

// ── CORE SCAN ─────────────────────────────────────────

async function runScan(trigger = "scheduled") {
  // Budget gate
  const spentToday = getDailyCost();
  if (spentToday >= DAILY_BUDGET) {
    const entry = { phase: PHASE, trigger, skipped: "budget_exceeded", cost_today: spentToday.toFixed(4) };
    archLog(entry);
    console.log("Agent-09: dormant — daily budget cap reached");
    return { skipped: true, reason: "budget", cost_today: spentToday };
  }

  // Git gate — initialize if needed, block scan until it exists
  const git = ensureGit();

  // Collect log tails
  const logFiles = ["jarvis-log.jsonl", "action-log.jsonl", "ARCHITECT_LOG.jsonl"];
  const logBlocks = logFiles
    .map(f => {
      const content = tailLog(path.join(ROOT, f), 100);
      return content ? `=== ${f} (tail 100) ===\n${content}` : null;
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);

  // Repo snapshot
  const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(e => !["node_modules", ".git", "discord-exports"].includes(e.name))
    .map(e => (e.isDirectory() ? "d " : "f ") + e.name)
    .join("\n");

  const agentEntries = fs.readdirSync(path.join(ROOT, "agents"), { withFileTypes: true })
    .map(e => e.name).join(", ");

  fs.mkdirSync(PROPOSALS, { recursive: true });
  const openProposals = fs.readdirSync(PROPOSALS).filter(f => f.endsWith(".md")).length;

  const prompt = `You are Agent-09, the Jarvis architect agent in Phase A (read-only observer).
Your only job this run: scan the logs and repo, identify issues, return structured observations.
You do NOT make changes or write proposals yet. Log only.

REPO ROOT:
${rootEntries}

AGENTS: ${agentEntries}

RECENT LOGS (last 100 lines each):
${logBlocks || "(no logs yet)"}

GIT: ${git.status}
OPEN PROPOSALS: ${openProposals}
TODAY'S COST SO FAR: $${spentToday.toFixed(4)} of $${DAILY_BUDGET} budget

Return a JSON array of observations. Each observation:
{
  "severity": "low|medium|high",
  "category": "log_noise|dead_code|inefficiency|error_pattern|duplicate|hardcoded_literal|other",
  "description": "one sentence — what you see",
  "location": "filename or component (be specific)",
  "evidence": "exact short excerpt from logs or pattern you are reacting to",
  "notes": "why this matters — one sentence"
}

Only include observations you have concrete evidence for from the data above.
If nothing notable, return [].
Return ONLY a valid JSON array — no prose, no markdown fences.`;

  let observations = [];
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }]
    });
    usage = resp.usage;
    const text = resp.content[0].text.trim();
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      try { observations = JSON.parse(m[0]); } catch {}
    }
  } catch (err) {
    archLog({ phase: PHASE, trigger, scan_error: err.message });
    return { error: err.message };
  }

  const runCost = usage.input_tokens * HAIKU_IN_RATE + usage.output_tokens * HAIKU_OUT_RATE;
  const dayTotal = trackCost(usage.input_tokens, usage.output_tokens);

  archLog({
    phase: PHASE,
    trigger,
    git,
    observations_count: observations.length,
    observations,
    tokens: { input: usage.input_tokens, output: usage.output_tokens },
    cost_run: runCost.toFixed(5),
    cost_day: dayTotal.toFixed(4)
  });

  // Notify on high-severity findings
  const high = observations.filter(o => o.severity === "high");
  if (high.length > 0) {
    fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `AGENT-09 [${trigger}]: ${observations.length} observations, ${high.length} high-severity\n` +
          high.map(o => `[${o.category}] ${o.description}\n  @ ${o.location}`).join("\n")
      })
    }).catch(() => {});
  }

  console.log(`Agent-09 scan done (${trigger}): ${observations.length} obs | $${runCost.toFixed(5)} this run | $${dayTotal.toFixed(4)} today`);
  return {
    phase: PHASE, trigger,
    observations_count: observations.length,
    high_severity: high.length,
    cost_run: runCost.toFixed(5),
    cost_day: dayTotal.toFixed(4)
  };
}

// ── ROUTES ────────────────────────────────────────────

router.post("/run", async (req, res) => {
  res.json({ started: true, phase: PHASE });
  try { await runScan(req.body?.trigger || "manual"); } catch {}
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
    last_observations: lastEntry?.observations_count || 0
  });
});

router.get("/log", (req, res) => {
  try {
    const n = Math.min(parseInt(req.query.n) || 10, 50);
    const lines = fs.readFileSync(ARCH_LOG, "utf8").split("\n").filter(Boolean);
    const entries = lines.slice(-n)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
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
