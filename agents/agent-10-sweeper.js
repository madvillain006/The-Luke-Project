const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const { log: jarvisLog } = require("../lib/logger");
const client = new Anthropic();
const ROOT = path.join(__dirname, "..");

// ── FILE PATHS ────────────────────────────────────────────
const SWEEPER_STATE = path.join(ROOT, "SWEEPER_STATE.json");
const SWEEPER_MAP   = path.join(ROOT, "SWEEPER_MAP.json");
const SWEEPER_COSTS = path.join(ROOT, "sweeper-costs.json");
const ARCH_COSTS    = path.join(ROOT, "architect-costs.json");
const FINDINGS_DIR  = path.join(ROOT, "findings");
const PROPOSALS_DIR = path.join(ROOT, "proposals");
const REJECTED      = path.join(ROOT, "REJECTED_PATTERNS.jsonl");
const SWEEPER_LOG   = path.join(ROOT, "SWEEPER_LOG.jsonl");

// ── BUDGET ────────────────────────────────────────────────
const COMBINED_DAILY_BUDGET = 5.00;
const MAX_OPEN_PROPOSALS    = 10;

const HAIKU_IN_RATE     = 0.00000025;
const HAIKU_OUT_RATE    = 0.00000125;
const HAIKU_CACHE_WRITE = 0.0000003125;
const HAIKU_CACHE_READ  = 0.000000025;
const OPUS_IN_RATE      = 0.000015;
const OPUS_OUT_RATE     = 0.000075;

// ── EXCLUDED PATHS ────────────────────────────────────────
const EXCLUDED = [
  /^agents[/\\]agent-02/i,
  /^agents[/\\]agent-04/i,
  /autonomous-state\.json$/i,
  /memory\.json$/i,
  /apex[/\\]/i,
  /med.?schedule/i,
  /node_modules/i,
  /\.git/i,
  /discord-exports/i,
  /package-lock\.json$/i,
  /ARCHITECT_LOG\.jsonl$/i,
  /architect-costs\.json$/i,
  /ARCH_TOKENS\.jsonl$/i,
  /arch-zero-streak\.json$/i,
  /SWEEPER_LOG\.jsonl$/i,
  /SWEEPER_STATE\.json$/i,
  /SWEEPER_MAP\.json$/i,
  /sweeper-costs\.json$/i,
  /^proposals[/\\]/i,
  /^findings[/\\]/i,
  /tool-calls\.jsonl$/i,
  /tool-health\.jsonl$/i,
  /canary-last\.json$/i,
  /canary-log\.jsonl$/i,
];

function isExcluded(filePath) {
  const rel = path.relative(ROOT, filePath);
  return EXCLUDED.some(r => r.test(rel));
}

// ── STATE ─────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(SWEEPER_STATE, "utf8")); }
  catch {
    return {
      inventory_done: false,
      scan_queue: [],
      scanned_this_pass: [],
      last_full_scan: null,
      last_delta_scan: null,
      consecutive_rejections: 0
    };
  }
}

function saveState(state) {
  fs.writeFileSync(SWEEPER_STATE, JSON.stringify(state, null, 2));
}

// ── COSTS ─────────────────────────────────────────────────
function loadCosts(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}

function getCombinedDailyCost() {
  const day = new Date().toISOString().slice(0, 10);
  return (loadCosts(ARCH_COSTS)[day]?.cost || 0) + (loadCosts(SWEEPER_COSTS)[day]?.cost || 0);
}

function trackCost(inputT, outputT, cacheWriteT = 0, cacheReadT = 0, model = "haiku") {
  const day = new Date().toISOString().slice(0, 10);
  const c = loadCosts(SWEEPER_COSTS);
  if (!c[day]) c[day] = { input_tokens: 0, output_tokens: 0, cost: 0 };
  const inRate  = model === "opus" ? OPUS_IN_RATE  : HAIKU_IN_RATE;
  const outRate = model === "opus" ? OPUS_OUT_RATE : HAIKU_OUT_RATE;
  const cost    = inputT * inRate + outputT * outRate +
                  cacheWriteT * HAIKU_CACHE_WRITE + cacheReadT * HAIKU_CACHE_READ;
  c[day].input_tokens  += inputT;
  c[day].output_tokens += outputT;
  c[day].cost          += cost;
  fs.writeFileSync(SWEEPER_COSTS, JSON.stringify(c, null, 2));
  return cost;
}

// ── LOGGING ───────────────────────────────────────────────
function swLog(entry) {
  try { fs.appendFileSync(SWEEPER_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n"); } catch {}
}

// ── HELPERS ───────────────────────────────────────────────
function findingKey(filePath) {
  return path.relative(ROOT, filePath).replace(/[/\\]/g, "--").replace(/\./g, "_") + ".json";
}

function openSweepProposals() {
  try {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
    return fs.readdirSync(PROPOSALS_DIR).filter(f => f.startsWith("sweeper-")).length;
  } catch { return 0; }
}

function loadRejectedPatterns() {
  try {
    return fs.readFileSync(REJECTED, "utf8").split("\n").filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).slice(-20);
  } catch { return []; }
}

// ── PHASE 1 — INVENTORY ───────────────────────────────────
function walkRepo(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".git", "discord-exports", "findings", "proposals"].includes(e.name)) {
        walkRepo(full, results);
      }
    } else if (/\.(js|json|md|html|py)$/.test(e.name) && !isExcluded(full)) {
      results.push(full);
    }
  }
  return results;
}

async function runInventory() {
  swLog({ phase: "inventory", event: "start" });
  const files = walkRepo(ROOT);
  const map = { generated: new Date().toISOString(), files: [] };

  for (const f of files) {
    try {
      const lines = fs.readFileSync(f, "utf8").split("\n").length;
      const rel = path.relative(ROOT, f);
      const category = rel.startsWith("agents") ? "agent" : rel.endsWith(".html") ? "ui" : rel.endsWith(".json") ? "config" : "core";
      const priority = lines > 400 ? "high" : lines > 150 ? "med" : "low";
      map.files.push({ path: rel, full: f, lines, category, priority, last_scanned: null });
    } catch {}
  }

  map.files.sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] - { high: 0, med: 1, low: 2 }[b.priority]));
  fs.writeFileSync(SWEEPER_MAP, JSON.stringify(map, null, 2));

  const state = loadState();
  state.inventory_done = true;
  state.scan_queue = map.files.map(f => f.full);
  state.scanned_this_pass = [];
  saveState(state);

  swLog({ phase: "inventory", event: "done", file_count: map.files.length });
  jarvisLog("sweeper-inventory", { files_queued: map.files.length });
  return { files: map.files.length };
}

// ── PHASE 2 — SCAN BATCH ──────────────────────────────────
const SCAN_SYSTEM = `You are Sweeper — code quality scanner for Jarvis AI system.
Scan the file. Find real issues with concrete evidence only.

Categories: token_waste | duplication | dead_code | search_trap | error_gap | schema_drift | scheduler_waste | config_sprawl
Severity: low | med | high

Return ONLY a valid JSON array. If nothing notable, return [].
[{"line":42,"category":"token_waste","severity":"med","issue":"one sentence","suggestion":"one sentence","est_impact":"optional"}]`;

async function runScanBatch(batchSize = 5) {
  if (getCombinedDailyCost() >= COMBINED_DAILY_BUDGET) {
    return { skipped: true, reason: "combined_budget" };
  }

  const state = loadState();
  if (!state.inventory_done) return { skipped: true, reason: "no_inventory" };
  if (state.scan_queue.length === 0) return { skipped: true, reason: "queue_empty" };
  if (state.consecutive_rejections >= 3) {
    swLog({ phase: "scan", skipped: "consecutive_rejections", count: state.consecutive_rejections });
    return { skipped: true, reason: "consecutive_rejections", count: state.consecutive_rejections };
  }

  fs.mkdirSync(FINDINGS_DIR, { recursive: true });
  const results = [];

  for (let i = 0; i < batchSize && state.scan_queue.length > 0; i++) {
    const filePath = state.scan_queue[0];
    const rel = path.relative(ROOT, filePath);

    if (!fs.existsSync(filePath)) { state.scan_queue.shift(); i--; continue; }

    let content;
    try { content = fs.readFileSync(filePath, "utf8"); }
    catch { state.scan_queue.shift(); i--; continue; }

    if (content.length > 50000) {
      swLog({ phase: "scan", file: rel, skipped: "too_large", bytes: content.length });
      fs.writeFileSync(path.join(FINDINGS_DIR, findingKey(filePath)),
        JSON.stringify({ file: rel, skipped: "too_large_manual_review", findings: [] }, null, 2));
      state.scan_queue.shift();
      state.scanned_this_pass.push(rel);
      results.push({ file: rel, findings: 0, skipped: true });
      continue;
    }

    let findings = [];
    let usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

    try {
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: [{ type: "text", text: SCAN_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `FILE: ${rel}\n\nCONTENT:\n${content.slice(0, 45000)}` }]
      });
      usage = { ...usage, ...resp.usage };
      const m = resp.content[0].text.trim().match(/\[[\s\S]*\]/);
      if (m) { try { findings = JSON.parse(m[0]); } catch {} }
    } catch (err) {
      swLog({ phase: "scan", file: rel, error: err.message });
    }

    const runCost = trackCost(usage.input_tokens, usage.output_tokens,
      usage.cache_creation_input_tokens || 0, usage.cache_read_input_tokens || 0);

    fs.writeFileSync(path.join(FINDINGS_DIR, findingKey(filePath)),
      JSON.stringify({ file: rel, scanned: new Date().toISOString(), findings }, null, 2));

    swLog({ phase: "scan", file: rel, findings: findings.length, cost: runCost.toFixed(5) });
    state.scan_queue.shift();
    state.scanned_this_pass.push(rel);
    results.push({ file: rel, findings: findings.length });

    if (getCombinedDailyCost() >= COMBINED_DAILY_BUDGET) break;
  }

  // Update map scan timestamps
  try {
    const map = JSON.parse(fs.readFileSync(SWEEPER_MAP, "utf8"));
    for (const r of results) {
      const entry = map.files.find(f => f.path === r.file);
      if (entry) entry.last_scanned = new Date().toISOString();
    }
    fs.writeFileSync(SWEEPER_MAP, JSON.stringify(map, null, 2));
  } catch {}

  if (state.scan_queue.length === 0) {
    state.last_full_scan = new Date().toISOString();
    swLog({ phase: "scan", event: "pass_complete", total: state.scanned_this_pass.length });
    jarvisLog("sweeper-pass-complete", { files: state.scanned_this_pass.length });
  }

  saveState(state);
  const totalFindings = results.reduce((s, r) => s + (r.findings || 0), 0);
  jarvisLog("sweeper-batch", { scanned: results.length, findings: totalFindings, queued: state.scan_queue.length });
  return { scanned: results.length, total_findings: totalFindings, queue_remaining: state.scan_queue.length };
}

// ── PHASE 3 — SYNTHESIS ───────────────────────────────────
async function runSynthesis() {
  if (getCombinedDailyCost() >= COMBINED_DAILY_BUDGET) return { skipped: true, reason: "combined_budget" };

  const open = openSweepProposals();
  if (open >= MAX_OPEN_PROPOSALS) return { skipped: true, reason: "proposal_backlog", open };

  fs.mkdirSync(FINDINGS_DIR, { recursive: true });

  const allFindings = [];
  for (const f of fs.readdirSync(FINDINGS_DIR).filter(f => f.endsWith(".json"))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(FINDINGS_DIR, f), "utf8"));
      if (d.findings?.length > 0) {
        for (const finding of d.findings) allFindings.push({ ...finding, file: d.file });
      }
    } catch {}
  }

  if (allFindings.length === 0) return { skipped: true, reason: "no_findings" };

  const rejected = loadRejectedPatterns();

  // Priority-order truncation: findings get up to 12000 chars first,
  // rejected patterns fill whatever remains up to a combined 15000 char cap.
  const FINDINGS_CAP = 12000;
  const COMBINED_CAP = 15000;
  const findingsStr = JSON.stringify(allFindings, null, 2).slice(0, FINDINGS_CAP);
  const rejectedBudget = Math.max(0, COMBINED_CAP - findingsStr.length);
  const rejectedStr = rejected.length > 0
    ? JSON.stringify(rejected, null, 2).slice(0, rejectedBudget)
    : "";

  const synthPrompt =
    `You are Sweeper synthesis for Jarvis — Conor's personal AI assistant.\n\n` +
    `FINDINGS (${allFindings.length} across codebase):\n` +
    findingsStr +
    (rejectedStr ? `\n\nREJECTED PATTERNS (do not re-propose):\n${rejectedStr}` : "") +
    `\n\nWrite up to 10 grouped proposals. Rules:\n` +
    `- Title each with "## SWEEP: <title>"\n` +
    `- Group related findings (same issue across files = one proposal)\n` +
    `- Surgical scope — one reversible change per proposal\n` +
    `- Rank by impact × safety (highest impact, lowest risk first)\n` +
    `- Format: ## SWEEP: title | **Files:** ... | **Issue:** ... | **Fix:** specific change | **Risk:** low/med/high\n` +
    `- Separate proposals with ---\n\nReturn only the markdown.`;

  let proposalText = "";
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    const resp = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      messages: [{ role: "user", content: synthPrompt }]
    });
    usage = resp.usage;
    proposalText = resp.content[0].text;
  } catch (err) {
    swLog({ phase: "synthesis", error: err.message });
    return { error: err.message };
  }

  trackCost(usage.input_tokens, usage.output_tokens, 0, 0, "opus");

  const ts = Date.now();
  const fname = `sweeper-${new Date().toISOString().slice(0, 10)}-${ts}.md`;
  fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROPOSALS_DIR, fname), proposalText);

  swLog({ phase: "synthesis", proposals_file: fname, findings_used: allFindings.length });

  fetch("http://localhost:3000/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `SWEEPER: ${allFindings.length} findings → proposals written to ${fname}` })
  }).catch(() => {});

  jarvisLog("sweeper-synthesis", { findings: allFindings.length, file: fname });
  return { proposals_file: fname, findings_used: allFindings.length };
}

// ── DELTA SCAN ────────────────────────────────────────────
async function runDeltaScan() {
  const state = loadState();
  if (!state.inventory_done) return runInventory();

  try {
    const map = JSON.parse(fs.readFileSync(SWEEPER_MAP, "utf8"));
    const modified = map.files.filter(f => {
      if (!f.last_scanned) return true;
      try { return fs.statSync(f.full).mtimeMs > new Date(f.last_scanned).getTime(); }
      catch { return false; }
    });

    if (modified.length === 0) {
      swLog({ phase: "delta", event: "no_changes" });
      return { delta: true, changed: 0 };
    }

    const modPaths = new Set(modified.map(f => f.full));
    state.scan_queue = [
      ...modified.map(f => f.full),
      ...state.scan_queue.filter(q => !modPaths.has(q))
    ];
    state.last_delta_scan = new Date().toISOString();
    saveState(state);

    swLog({ phase: "delta", changed: modified.length });
    return runScanBatch(5);
  } catch (e) {
    return { error: e.message };
  }
}

// ── SMART RUN ─────────────────────────────────────────────
async function smartRun() {
  const state = loadState();
  if (!state.inventory_done) return { phase: "inventory", result: await runInventory() };
  if (state.scan_queue.length > 0) return { phase: "scan", result: await runScanBatch(5) };

  // Queue empty — synthesize if findings exist and proposals backlog has room
  try {
    const hasFindingsWithIssues = fs.readdirSync(FINDINGS_DIR)
      .filter(f => f.endsWith(".json"))
      .some(f => {
        try { return JSON.parse(fs.readFileSync(path.join(FINDINGS_DIR, f), "utf8")).findings?.length > 0; }
        catch { return false; }
      });
    if (hasFindingsWithIssues && openSweepProposals() < MAX_OPEN_PROPOSALS) {
      return { phase: "synthesis", result: await runSynthesis() };
    }
  } catch {}

  return { phase: "idle", message: "Scan queue empty, no pending synthesis" };
}

// ── ROUTES ────────────────────────────────────────────────
router.post("/run", async (req, res) => {
  res.json({ started: true });
  try { await smartRun(); } catch (e) { swLog({ error: e.message }); }
});

router.post("/inventory", async (req, res) => {
  res.json({ started: true });
  try { await runInventory(); } catch (e) { swLog({ error: e.message }); }
});

router.post("/scan-batch", async (req, res) => {
  res.json({ started: true });
  try { await runScanBatch(req.body?.batch_size || 5); } catch (e) { swLog({ error: e.message }); }
});

router.post("/synthesize", async (req, res) => {
  res.json({ started: true });
  try { await runSynthesis(); } catch (e) { swLog({ error: e.message }); }
});

router.post("/delta-scan", async (req, res) => {
  res.json({ started: true });
  try { await runDeltaScan(); } catch (e) { swLog({ error: e.message }); }
});

router.get("/status", (req, res) => {
  const state = loadState();
  const day = new Date().toISOString().slice(0, 10);
  const combined = getCombinedDailyCost();

  let map_stats = { total: 0, scanned: 0 };
  try {
    const map = JSON.parse(fs.readFileSync(SWEEPER_MAP, "utf8"));
    map_stats.total   = map.files.length;
    map_stats.scanned = map.files.filter(f => f.last_scanned).length;
  } catch {}

  let total_findings = 0;
  try {
    fs.readdirSync(FINDINGS_DIR).filter(f => f.endsWith(".json")).forEach(f => {
      try { total_findings += JSON.parse(fs.readFileSync(path.join(FINDINGS_DIR, f), "utf8")).findings?.length || 0; }
      catch {}
    });
  } catch {}

  res.json({
    inventory_done: state.inventory_done,
    queue_remaining: state.scan_queue.length,
    scanned_this_pass: state.scanned_this_pass.length,
    last_full_scan: state.last_full_scan,
    last_delta_scan: state.last_delta_scan,
    consecutive_rejections: state.consecutive_rejections,
    open_sweep_proposals: openSweepProposals(),
    total_findings,
    combined_cost_today: combined.toFixed(4),
    combined_budget: COMBINED_DAILY_BUDGET,
    budget_remaining: (COMBINED_DAILY_BUDGET - combined).toFixed(4),
    map_stats
  });
});

router.get("/findings", (req, res) => {
  try {
    fs.mkdirSync(FINDINGS_DIR, { recursive: true });
    const files = fs.readdirSync(FINDINGS_DIR).filter(f => f.endsWith(".json"));
    const summary = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(FINDINGS_DIR, f), "utf8"));
        const bySev = { low: 0, med: 0, high: 0 };
        for (const fi of d.findings || []) bySev[fi.severity] = (bySev[fi.severity] || 0) + 1;
        return { file: d.file, count: d.findings?.length || 0, severity: bySev, scanned: d.scanned };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => b.count - a.count);
    res.json({ files: summary.length, total: summary.reduce((s, f) => s + f.count, 0), summary });
  } catch { res.json({ files: 0, total: 0, summary: [] }); }
});

router.get("/proposals", (req, res) => {
  try {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
    const files = fs.readdirSync(PROPOSALS_DIR).filter(f => f.startsWith("sweeper-"));
    res.json({ count: files.length, proposals: files });
  } catch { res.json({ count: 0, proposals: [] }); }
});

router.post("/reject", (req, res) => {
  const { pattern, reason } = req.body;
  if (!pattern) return res.status(400).json({ error: "pattern required" });
  try {
    fs.appendFileSync(REJECTED, JSON.stringify({ ts: new Date().toISOString(), pattern, reason: reason || "" }) + "\n");
    const state = loadState();
    state.consecutive_rejections = (state.consecutive_rejections || 0) + 1;
    if (state.consecutive_rejections >= 3) {
      fetch("http://localhost:3000/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "SWEEPER: 3 consecutive rejections — pausing proposals. Re-reading REJECTED_PATTERNS before next synthesis." })
      }).catch(() => {});
    }
    saveState(state);
    res.json({ logged: true, consecutive_rejections: state.consecutive_rejections });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/reset-rejections", (req, res) => {
  const state = loadState();
  state.consecutive_rejections = 0;
  saveState(state);
  res.json({ reset: true });
});

module.exports = router;
