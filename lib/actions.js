const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const { log } = require("./logger");

const LUKE_ROOT = path.join(__dirname, "..");
const ACTION_LOG_FILE    = path.join(LUKE_ROOT, "action-log.jsonl");
const TOOL_FAILURES_FILE = path.join(LUKE_ROOT, "tool-failures.jsonl");
const TOOL_CALLS_FILE    = path.join(LUKE_ROOT, "tool-calls.jsonl");
const SCREEN_ACTIONS_FILE = path.join(LUKE_ROOT, "screen-actions.jsonl");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SCREEN_OPS = new Set(["open", "type", "click", "scroll", "press"]);

function getTrackUsage() {
  try { return require("../agents/agent-11-tokens").trackUsage; } catch { return () => {}; }
}

function logToolFailure(entry) {
  try { fs.appendFileSync(TOOL_FAILURES_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n"); } catch {}
}

function logAction(action, result) {
  try {
    fs.appendFileSync(ACTION_LOG_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      action: action.action,
      in: action,
      out: typeof result === "string" ? result.slice(0, 3000) : result
    }) + "\n");
  } catch {}
}

function runPython(cmd) {
  return execSync("python desktop.py " + cmd, { cwd: LUKE_ROOT }).toString().trim();
}

async function verifyScreen(expectHint) {
  try {
    const img = runPython("screenshot");
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 80,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: img } },
        { type: "text", text: "Does the screen show: " + (expectHint || "the expected result") + "? Answer YES or NO then one word reason." }
      ]}]
    });
    getTrackUsage()("screen-verify", "claude-haiku-4-5-20251001", r.usage?.input_tokens || 0, r.usage?.output_tokens || 0);
    const verdict = r.content[0].text.trim();
    return { ok: verdict.toUpperCase().startsWith("YES"), verdict };
  } catch (e) { return { ok: false, verdict: "verify-error: " + e.message }; }
}

async function _handleAction(action) {
  if (action.action === "open") {
    runPython("open \"" + action.value + "\"");
  } else if (action.action === "type") {
    runPython("type \"" + action.value + "\"");
  } else if (action.action === "click") {
    const [x, y] = action.value.split(",").map(Number);
    runPython("click " + x + " " + y);
  } else if (action.action === "scroll") {
    runPython("scroll " + action.value);
  } else if (action.action === "press") {
    runPython("press " + action.value);
  } else if (action.action === "look") {
    const img = runPython("screenshot");
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: img } }, { type: "text", text: action.value }] }]
    });
    return r.content[0].text;
  } else if (action.action === "edit" || action.action === "edit_restart") {
    log("blocked-runtime-action", { action: action.action, file: action.file || null, description: action.description || null });
    return "BLOCKED: runtime self-edit is disabled. Use an external coder workflow for code changes.";

  } else if (action.action === "shell") {
    const cwd = action.cwd ? path.resolve(LUKE_ROOT, action.cwd) : LUKE_ROOT;
    const timeoutMs = (action.timeout || 30) * 1000;
    const result = spawnSync(action.command, { shell: true, encoding: "utf8", timeout: timeoutMs, cwd });
    const out = {
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      exit_code: result.status,
      timed_out: result.signal === "SIGTERM"
    };
    logAction(action, out);
    if (result.error && result.error.code === "ETIMEDOUT") return "SHELL TIMEOUT after " + action.timeout + "s";
    if (result.error) return "SHELL ERROR: " + result.error.message;
    const parts = ["EXIT " + out.exit_code];
    if (out.stdout) parts.push(out.stdout);
    if (out.stderr) parts.push("STDERR: " + out.stderr);
    return parts.join("\n");

  } else if (action.action === "read") {
    try {
      const rawPath = path.isAbsolute(action.path) ? action.path : path.join(LUKE_ROOT, action.path);
      const filePath = path.resolve(rawPath);
      if (!filePath.startsWith(LUKE_ROOT)) {
        logToolFailure({ op: "read", path: action.path, error: "path_traversal_blocked" });
        return "READ BLOCKED: path outside Luke root";
      }
      const content = fs.readFileSync(filePath, "utf8");
      logAction(action, { path: action.path, bytes: content.length });
      return "FILE: " + action.path + "\n---\n" + content;
    } catch (e) {
      const rawPath = path.isAbsolute(action.path) ? action.path : path.join(LUKE_ROOT, action.path);
      const filePath = path.resolve(rawPath);
      const parentDir = path.dirname(filePath);
      let parentContents = "";
      try { parentContents = fs.readdirSync(parentDir).join(", "); } catch {}
      logToolFailure({ op: "read", path: action.path, error: e.code, parent_contents: parentContents.slice(0, 300) });
      return "READ ERROR: " + e.message + (parentContents ? "\nActual contents of " + parentDir + ": " + parentContents : "");
    }

  } else if (action.action === "list") {
    try {
      const dirPath = action.path
        ? (path.isAbsolute(action.path) ? action.path : path.join(LUKE_ROOT, action.path))
        : LUKE_ROOT;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const lines = entries
        .filter(e => !e.name.startsWith(".") || action.show_hidden)
        .map(e => (e.isDirectory() ? "d " : "f ") + e.name);
      logAction(action, { path: dirPath, count: lines.length });
      return "DIR: " + dirPath + "\n" + lines.join("\n");
    } catch (e) {
      return "LIST ERROR: " + e.message;
    }

  } else if (action.action === "write") {
    log("blocked-runtime-action", { action: action.action, path: action.path || null });
    return "BLOCKED: runtime file writes are disabled. Use an external coder workflow for code changes.";

  } else if (action.action === "search") {
    const cwd = action.cwd ? path.resolve(LUKE_ROOT, action.cwd) : LUKE_ROOT;
    const flags = ["-n", "--no-heading"];
    if (!action.case_sensitive) flags.push("-i");
    if (action.glob) flags.push("--glob", action.glob);
    const cmd = "rg " + flags.join(" ") + " " + JSON.stringify(action.pattern) + " " + JSON.stringify(cwd);
    const result = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: 10000, cwd });
    const matches = (result.stdout || "").trim();
    const matchLines = matches ? matches.split("\n").length : 0;
    logAction(action, { pattern: action.pattern, lines: matchLines });
    if (!matches) logToolFailure({ op: "search", pattern: action.pattern, glob: action.glob || "all", cwd, note: "zero results — check glob scope" });
    if (result.error) return "SEARCH ERROR: " + result.error.message;
    return "SEARCH: " + action.pattern + (action.glob ? " [" + action.glob + "]" : " [all files]") + "\n" + (matches || "No matches found — try without glob to search all file types");
  }

  return null;
}

async function handleAction(action) {
  const t0 = Date.now();
  const isScreenOp = SCREEN_OPS.has(action.action);

  const intentEntry = { ts: new Date().toISOString(), action: action.action, params: action, phase: "intent" };
  if (isScreenOp) {
    try { fs.appendFileSync(SCREEN_ACTIONS_FILE, JSON.stringify(intentEntry) + "\n"); } catch {}
  }

  const result = await _handleAction(action);

  if (isScreenOp && (action.verify_hint || action.action === "click" || action.action === "type")) {
    const verify = await verifyScreen(action.verify_hint || "the action completed successfully");
    const verifyEntry = { ts: new Date().toISOString(), action: action.action, phase: "verify", ok: verify.ok, verdict: verify.verdict };
    try { fs.appendFileSync(SCREEN_ACTIONS_FILE, JSON.stringify(verifyEntry) + "\n"); } catch {}
    if (!verify.ok) {
      logToolFailure({ op: "screen-verify", action: action.action, verdict: verify.verdict });
      if (global.broadcast) global.broadcast({ type: "notification", message: "SCREEN VERIFY FAILED: " + action.action + " — " + verify.verdict });
    }
  }

  try {
    fs.appendFileSync(TOOL_CALLS_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      action: action.action,
      key: action.path || action.pattern || action.command || action.file || "",
      duration_ms: Date.now() - t0,
      result_len: typeof result === "string" ? result.length : 0
    }) + "\n");
  } catch {}
  return result;
}

module.exports = { handleAction, runPython };
