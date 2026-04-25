const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

const client = new Anthropic();
const ROOT = path.join(__dirname, "..");
const WORKFLOWS_DIR   = path.join(ROOT, "workflows");
const RECORDINGS_DIR  = path.join(ROOT, "workflow-recordings");
const QUAL_FILE       = path.join(ROOT, "workflow-qualification.jsonl");
const STRIKES_FILE    = path.join(ROOT, "workflow-strikes.json");
const STATE_FILE      = path.join(ROOT, "workflow-state.json");

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

// ── STATE ────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { running: false, workflow: null, step: null, paused: false, killed: false }; }
}
function saveState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {} }

// ── STRIKES (A7 three-strike) ────────────────────────────────────────────────

function loadStrikes() {
  try { return JSON.parse(fs.readFileSync(STRIKES_FILE, "utf8")); } catch { return {}; }
}
function saveStrikes(s) { try { fs.writeFileSync(STRIKES_FILE, JSON.stringify(s, null, 2)); } catch {} }

function recordStrike(wfName) {
  const s = loadStrikes();
  const cutoff = Date.now() - 24 * 3600000;
  if (!s[wfName]) s[wfName] = [];
  s[wfName] = s[wfName].filter(t => t > cutoff);
  s[wfName].push(Date.now());
  saveStrikes(s);
  return s[wfName].length;
}

function isDisabled(wfName) {
  const s = loadStrikes();
  const cutoff = Date.now() - 24 * 3600000;
  const recent = (s[wfName] || []).filter(t => t > cutoff);
  return recent.length >= 3;
}

// ── QUALIFICATION (A6 dry-run) ────────────────────────────────────────────────

function getDryRunCount(wfName) {
  try {
    const lines = fs.readFileSync(QUAL_FILE, "utf8").split("\n").filter(Boolean);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.workflow === wfName && e.result === "pass").length;
  } catch { return 0; }
}

function logQual(wfName, result, details) {
  try {
    fs.appendFileSync(QUAL_FILE, JSON.stringify({
      ts: new Date().toISOString(), workflow: wfName, result, ...details
    }) + "\n");
  } catch {}
}

// ── YAML LOADER ──────────────────────────────────────────────────────────────

function parseSimpleYaml(text) {
  const lines = text.split("\n");
  const result = {};
  let currentSection = null;
  let currentList = null;
  let currentItem = null;
  let stepsList = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      const m = line.match(/^(\w+):\s*(.*)/);
      if (!m) continue;
      currentSection = m[1];
      currentList = null; currentItem = null;
      if (m[2]) result[currentSection] = m[2].replace(/^["']|["']$/g, "");
      else if (currentSection === "steps" || currentSection === "preflight") {
        result[currentSection] = [];
        currentList = result[currentSection];
        if (currentSection === "steps") stepsList = currentList;
      }
    } else if (indent === 2) {
      const listItem = line.trimStart().match(/^-\s*(.*)/);
      if (listItem && currentList !== null) {
        if (currentSection === "preflight") { currentList.push(listItem[1]); }
        else if (currentSection === "steps") { currentItem = {}; currentList.push(currentItem); }
        continue;
      }
      if (currentItem !== null) {
        const kv = line.trimStart().match(/^(\w+):\s*(.*)/);
        if (kv) currentItem[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
      }
    } else if (indent === 4 && currentItem !== null) {
      const kv = line.trimStart().match(/^(\w+):\s*(.*)/);
      if (kv) currentItem[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function loadWorkflow(name) {
  const file = path.join(WORKFLOWS_DIR, name + ".yaml");
  if (!fs.existsSync(file)) throw new Error("Workflow not found: " + name);
  const text = fs.readFileSync(file, "utf8");
  return parseSimpleYaml(text);
}

// ── PREFLIGHT (A3) ────────────────────────────────────────────────────────────

async function runPreflight(checks) {
  const results = [];
  for (const check of (checks || [])) {
    let ok = true; let detail = "ok";
    try {
      if (check === "backend_heartbeat") {
        const r = await fetch("http://localhost:3000/health");
        const d = await r.json(); ok = d.ok === true; detail = d.ok ? "ok" : "server not healthy";
      } else if (check === "boot_check") {
        const r = await fetch("http://localhost:3000/luke/boot-check");
        const d = await r.json(); ok = d.overall !== "red"; detail = d.overall;
      } else if (check === "tradovate_connected") {
        const r = await fetch("http://localhost:3000/agent/autonomous/test-connection", { method: "POST" });
        const d = await r.json(); ok = d.connected === true || d.ok === true;
        detail = ok ? "ok" : "tradovate not connected";
      } else if (check === "no_open_position") {
        const r = await fetch("http://localhost:3000/agent/autonomous/status");
        const d = await r.json(); ok = !d.open_position; detail = ok ? "ok" : "position open";
      } else if (check === "mouse_still_2s") {
        const pos1 = runDesktop("mousepos").split(",").map(Number);
        await new Promise(r => setTimeout(r, 2000));
        const pos2 = runDesktop("mousepos").split(",").map(Number);
        const delta = Math.abs(pos1[0] - pos2[0]) + Math.abs(pos1[1] - pos2[1]);
        ok = delta <= 10; detail = ok ? "ok" : "mouse moved " + delta + "px";
      }
    } catch (e) { ok = false; detail = e.message; }
    results.push({ check, ok, detail });
  }
  return results;
}

// ── DESKTOP HELPERS ──────────────────────────────────────────────────────────

function runDesktop(args) {
  try {
    return execSync("python desktop.py " + args, { cwd: ROOT, timeout: 15000 }).toString().trim();
  } catch (e) { return "ERROR: " + e.message; }
}

async function takeVerifyScreenshot(recDir, stepId) {
  try {
    const b64 = runDesktop("screenshot");
    const pngBuf = Buffer.from(b64, "base64");
    fs.writeFileSync(path.join(recDir, stepId + ".png"), pngBuf);
    return b64;
  } catch { return null; }
}

async function verifyStep(b64, hint) {
  if (!b64 || !hint) return { ok: true, verdict: "no-verify" };
  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 80,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: "Does the screen show: " + hint + "? Answer YES or NO then one word reason." }
      ]}]
    });
    const verdict = r.content[0].text.trim();
    // Log token usage
    try { await fetch("http://localhost:3000/agent/tokens/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: "workflow-verify", model: "claude-haiku-4-5-20251001", in_tok: r.usage?.input_tokens || 0, out_tok: r.usage?.output_tokens || 0 }) }); } catch {}
    return { ok: verdict.toUpperCase().startsWith("YES"), verdict };
  } catch (e) { return { ok: false, verdict: "verify-error: " + e.message }; }
}

// ── MOUSE OVERRIDE MONITOR (A4) ──────────────────────────────────────────────

let _mouseOverride = false;
let _mouseMonitor = null;
let _lastMousePos = null;

function startMouseMonitor(broadcast) {
  _mouseOverride = false;
  _lastMousePos = null;
  _mouseMonitor = setInterval(() => {
    try {
      const pos = runDesktop("mousepos").split(",").map(Number);
      if (_lastMousePos) {
        const delta = Math.abs(pos[0] - _lastMousePos[0]) + Math.abs(pos[1] - _lastMousePos[1]);
        if (delta > 10) {
          _mouseOverride = true;
          if (broadcast) broadcast({ type: "workflow_paused", reason: "mouse_override", delta });
          clearInterval(_mouseMonitor); _mouseMonitor = null;
        }
      }
      _lastMousePos = pos;
    } catch {}
  }, 100);
}

function stopMouseMonitor() {
  if (_mouseMonitor) { clearInterval(_mouseMonitor); _mouseMonitor = null; }
  _mouseOverride = false; _lastMousePos = null;
}

// ── STEP EXECUTOR ────────────────────────────────────────────────────────────

async function executeStep(step, vars, dryRun, recDir) {
  // Substitute template vars
  const sub = (s) => s ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || "") : s;
  const action = step.action;
  const value  = sub(step.value || "");
  const verifyHint = sub(step.verify_hint || "");

  let execResult = null;

  if (dryRun) {
    execResult = "[DRY RUN] would execute: " + action + " " + value;
  } else {
    if      (action === "screenshot") { /* no-op, screenshot taken below */ execResult = "screenshot taken"; }
    else if (action === "click")  { const [x,y] = value.split(",").map(Number); execResult = runDesktop("click " + x + " " + y); }
    else if (action === "type")   { execResult = runDesktop("type \"" + value + "\""); }
    else if (action === "press")  { execResult = runDesktop("press " + value); }
    else if (action === "scroll") { execResult = runDesktop("scroll " + value); }
    else if (action === "open")   { execResult = runDesktop("open " + value); }
    else if (action === "wait")   { execResult = runDesktop("wait " + value); }
    else if (action === "find")   { execResult = runDesktop("find " + JSON.stringify(value)); }
    else { execResult = "unknown action: " + action; }
  }

  // Screenshot for recording
  const b64 = await takeVerifyScreenshot(recDir, step.id);

  // Verify
  let verify = { ok: true, verdict: "skipped" };
  if (verifyHint && (dryRun ? false : true)) {
    verify = await verifyStep(b64, verifyHint);
  }

  const stepLog = {
    ts: new Date().toISOString(), step_id: step.id, action,
    value, dry_run: dryRun, result: execResult, verify_ok: verify.ok, verdict: verify.verdict
  };
  try { fs.appendFileSync(path.join(recDir, "steps.jsonl"), JSON.stringify(stepLog) + "\n"); } catch {}

  return { ok: verify.ok || dryRun, stepLog };
}

// ── MAIN RUNNER ──────────────────────────────────────────────────────────────

let _activeRun = null;

async function runWorkflow(name, vars = {}, opts = {}) {
  if (_activeRun) return { error: "Workflow already running: " + _activeRun.name };

  const wf = loadWorkflow(name);

  // Three-strike check (A7)
  if (isDisabled(name)) return { error: "Workflow disabled (3-strike): " + name + " — review required" };

  // Dry-run qualification check (A6)
  const dryRuns = getDryRunCount(name);
  const reqDryRuns = parseInt(wf.required_dry_runs || 0);
  const isDryRun = opts.dry_run === true || wf.dry_run === "true";
  if (!isDryRun && reqDryRuns > 0 && dryRuns < reqDryRuns) {
    return { error: `Workflow needs ${reqDryRuns} dry runs, only ${dryRuns} completed` };
  }

  // Preflight (A3)
  const preflightResults = await runPreflight(wf.preflight || []);
  const preflightFail = preflightResults.find(r => !r.ok);
  if (preflightFail) {
    return { error: "Preflight failed: " + preflightFail.check + " — " + preflightFail.detail };
  }

  // Recording dir (A8)
  const runTs = new Date().toISOString().replace(/[:.]/g, "-");
  const dateDir = new Date().toISOString().slice(0, 10);
  const recDir = path.join(RECORDINGS_DIR, dateDir, name + "-" + runTs);
  fs.mkdirSync(recDir, { recursive: true });

  const runMeta = { ts: new Date().toISOString(), workflow: name, dry_run: isDryRun, vars: Object.keys(vars) };
  try { fs.writeFileSync(path.join(recDir, "meta.json"), JSON.stringify(runMeta, null, 2)); } catch {}

  _activeRun = { name, startTs: Date.now(), recDir };
  saveState({ running: true, workflow: name, step: null, paused: false, killed: false, dry_run: isDryRun });

  // Start mouse override monitor (A4)
  const bcFn = global.broadcast;
  startMouseMonitor(bcFn);

  let verifyFails = 0;
  const steps = wf.steps || [];
  let stepResults = [];

  try {
    for (const step of steps) {
      // Kill check
      const st = loadState();
      if (st.killed || _mouseOverride) {
        const reason = st.killed ? "kill_signal" : "mouse_override";
        saveState({ ...loadState(), running: false, killed: true });
        logQual(name, "aborted", { reason, step: step.id });
        return { aborted: true, reason, step: step.id };
      }

      saveState({ ...loadState(), step: step.id });
      if (bcFn) bcFn({ type: "workflow_step", workflow: name, step: step.id });

      const { ok, stepLog } = await executeStep(step, vars, isDryRun, recDir);
      stepResults.push(stepLog);

      if (!ok && step.checkpoint) {
        verifyFails++;
        if (!isDryRun) recordStrike(name);
        if (verifyFails >= 3 || step.checkpoint) {
          saveState({ ...loadState(), running: false });
          stopMouseMonitor();
          logQual(name, "fail", { step: step.id, verdict: stepLog.verdict });
          if (bcFn) bcFn({ type: "notification", message: "WORKFLOW FAILED at checkpoint: " + step.id + " — " + stepLog.verdict });
          return { ok: false, failed_step: step.id, verdict: stepLog.verdict };
        }
      }
    }
  } finally {
    stopMouseMonitor();
    _activeRun = null;
    saveState({ running: false, workflow: name, step: "complete", paused: false, killed: false });
  }

  // 30-day recording cleanup (A8)
  cleanOldRecordings();

  if (isDryRun) {
    logQual(name, "pass", { steps: steps.length });
    if (bcFn) bcFn({ type: "notification", message: "DRY RUN PASSED: " + name + " (" + getDryRunCount(name) + "/" + reqDryRuns + ")" });
  } else {
    logQual(name, "live_pass", { steps: steps.length });
  }

  return { ok: true, dry_run: isDryRun, steps: stepResults.length };
}

function cleanOldRecordings() {
  try {
    const cutoff = Date.now() - 30 * 24 * 3600000;
    const dateDirs = fs.readdirSync(RECORDINGS_DIR);
    for (const dd of dateDirs) {
      const ddPath = path.join(RECORDINGS_DIR, dd);
      try {
        const stat = fs.statSync(ddPath);
        if (stat.mtimeMs < cutoff) fs.rmSync(ddPath, { recursive: true, force: true });
      } catch {}
    }
  } catch {}
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

router.get("/list", (req, res) => {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".yaml"));
    const workflows = files.map(f => {
      const name = f.replace(".yaml", "");
      try {
        const wf = loadWorkflow(name);
        return {
          name, description: wf.description || "", dry_run: wf.dry_run === "true",
          required_dry_runs: parseInt(wf.required_dry_runs || 0),
          completed_dry_runs: getDryRunCount(name),
          disabled: isDisabled(name)
        };
      } catch { return { name, error: "parse error" }; }
    });
    res.json({ workflows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/run", async (req, res) => {
  const { workflow, vars, dry_run } = req.body;
  if (!workflow) return res.status(400).json({ error: "workflow required" });
  res.json({ started: true, workflow });
  const result = await runWorkflow(workflow, vars || {}, { dry_run: dry_run === true });
  if (global.broadcast) {
    global.broadcast({ type: "workflow_result", workflow, ...result });
  }
});

router.get("/status", (req, res) => res.json({ ...loadState(), active_name: _activeRun?.name || null }));

router.post("/abort", (req, res) => {
  saveState({ ...loadState(), killed: true, running: false });
  stopMouseMonitor();
  _activeRun = null;
  if (global.broadcast) global.broadcast({ type: "workflow_kill" });
  res.json({ ok: true });
});

router.post("/resume", (req, res) => {
  _mouseOverride = false;
  saveState({ ...loadState(), paused: false });
  if (global.broadcast) global.broadcast({ type: "workflow_resumed" });
  res.json({ ok: true });
});

router.get("/qualification", (req, res) => {
  const { workflow } = req.query;
  const count = workflow ? getDryRunCount(workflow) : null;
  res.json({ workflow, dry_run_passes: count });
});

router.get("/recordings", (req, res) => {
  try {
    const { workflow, date } = req.query;
    const dateDirs = fs.readdirSync(RECORDINGS_DIR).sort().reverse().slice(0, 7);
    const result = [];
    for (const dd of dateDirs) {
      if (date && dd !== date) continue;
      const ddPath = path.join(RECORDINGS_DIR, dd);
      const runs = fs.readdirSync(ddPath).filter(r => !workflow || r.startsWith(workflow));
      for (const run of runs.slice(0, 5)) {
        const metaPath = path.join(ddPath, run, "meta.json");
        try { result.push({ date: dd, run, ...JSON.parse(fs.readFileSync(metaPath, "utf8")) }); } catch {}
      }
    }
    res.json({ recordings: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kill handler — also triggered by /kill-workflow in index.js
router.post("/kill", (req, res) => {
  saveState({ ...loadState(), killed: true, running: false });
  stopMouseMonitor();
  _activeRun = null;
  res.json({ ok: true });
});

module.exports = router;
