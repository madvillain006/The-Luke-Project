"use strict";

require("dotenv").config();

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const { appendJsonl, writeJsonAtomic } = require("../state/lib");

const ROOT = path.join(__dirname, "..");
const STATUS_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-status.json");
const WATCHDOG_STATUS_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-watchdog-status.json");
const CURRENT_WEBHOOK_FILE = path.join(ROOT, "data", "ninjatrader", "current-webhook-url.txt");
const MANUAL_REFRESH_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-manual-refresh.json");
const EVENTS_FILE = path.join(ROOT, "state", "events", "ninjatrader-tunnel-watchdog.jsonl");
const LOCAL_BASE_URL = process.env.LUKE_NINJA_LOCAL_URL || "http://localhost:3000";
const TOKEN = process.env.LUKE_NINJA_BRIDGE_TOKEN || "";
const CHECK_INTERVAL_MS = positiveInt(process.env.LUKE_TUNNEL_WATCHDOG_INTERVAL_MS, 60000);
const REFRESH_WAIT_MS = positiveInt(process.env.LUKE_TUNNEL_REFRESH_WAIT_MS, 30000);
const STALE_WARN_MS = positiveInt(process.env.LUKE_TUNNEL_STALE_WARN_MS, 90 * 60 * 1000);

function positiveInt(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeStatus(status) {
  const statusWithTime = {
    checked_at: new Date().toISOString(),
    ...status,
  };
  writeJsonAtomic(WATCHDOG_STATUS_FILE, statusWithTime);
  if (status.webhook_url) {
    fs.writeFileSync(CURRENT_WEBHOOK_FILE, `${status.webhook_url}\n`, "utf8");
  }
  appendJsonl(EVENTS_FILE, statusWithTime);
}

function writeManualRefreshRequest() {
  writeJsonAtomic(MANUAL_REFRESH_FILE, {
    requested_at: new Date().toISOString(),
    reason: "operator_clicked_luke_ui_refresh",
  });
}

async function requestJson(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request({
      method: "GET",
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      timeout: 10000,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        let body = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = { raw: text };
        }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`timeout ${url}`));
    });
    req.on("error", (error) => {
      resolve({ ok: false, status: 0, error: error.message });
    });
    req.end();
  });
}

async function bridgeStatus(baseUrl) {
  const tokenQuery = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";
  return requestJson(`${baseUrl}/api/ninjatrader/bridge-status${tokenQuery}`);
}

function isRandomQuickTunnel(url) {
  return typeof url === "string" && /\.trycloudflare\.com\/?$/.test(url);
}

function tunnelAgeMs(status) {
  const updated = Date.parse(status && status.updated_at);
  return Number.isFinite(updated) ? Date.now() - updated : Infinity;
}

async function checkTunnel() {
  const status = readJson(STATUS_FILE, null);
  const local = await bridgeStatus(LOCAL_BASE_URL);
  if (!local.ok || !local.body || !local.body.ok) {
    return {
      ok: false,
      reason: "local_luke_bridge_unhealthy",
      local_status: local.status,
      local_error: local.error || null,
      tunnel_status: status,
    };
  }

  if (!status || !status.ok || !status.public_url) {
    return {
      ok: false,
      reason: "no_public_tunnel_status",
      local_status: local.status,
      tunnel_status: status,
    };
  }

  const publicCheck = await bridgeStatus(status.public_url);
  const ageMs = tunnelAgeMs(status);
  const warning = isRandomQuickTunnel(status.public_url)
    ? "random_trycloudflare_url_changes_on_restart_tradingview_must_be_updated_or_use_named_tunnel"
    : "";

  return {
    ok: Boolean(publicCheck.ok && publicCheck.body && publicCheck.body.ok),
    reason: publicCheck.ok && publicCheck.body && publicCheck.body.ok ? "healthy" : "public_tunnel_unhealthy",
    route: "public_tunnel",
    public_url: status.public_url,
    webhook_url: status.webhook_url,
    bridge_status_url: status.bridge_status_url,
    local_status: local.status,
    public_status: publicCheck.status,
    public_error: publicCheck.error || null,
    tunnel_age_ms: ageMs,
    stale_warning: ageMs > STALE_WARN_MS,
    stability_warning: warning,
  };
}

function run(command, args) {
  return new Promise((resolve) => {
    const useShell = /\.cmd$/i.test(command);
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      shell: useShell,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => resolve({ ok: false, code: -1, stdout, stderr: stderr + error.message }));
    child.on("exit", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

function pm2CommandCandidates() {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
  return [
    path.join(appData, "npm", "pm2.cmd"),
    path.join(appData, "npm", "pm2"),
    "pm2.cmd",
    "pm2",
  ].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
}

async function refreshTunnel() {
  writeManualRefreshRequest();
  let lastPm2Result = null;
  for (const command of pm2CommandCandidates()) {
    if (path.isAbsolute(command) && !fs.existsSync(command)) continue;
    const result = await run(command, ["restart", "luke-tunnel", "--update-env"]);
    lastPm2Result = result;
    if (result.ok) {
      return { ok: true, method: "pm2_restart_luke_tunnel", command, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
    }
  }

  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "start-luke-cloudflare-tunnel.js")], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return {
    ok: true,
    method: "detached_node_start_luke_cloudflare_tunnel",
    pm2_error: lastPm2Result ? (lastPm2Result.stderr.trim() || lastPm2Result.stdout.trim()) : "pm2 not found",
  };
}

async function waitForHealthyTunnel(timeoutMs) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started <= timeoutMs) {
    last = await checkTunnel();
    if (last.ok) return last;
    await sleep(2000);
  }
  return last || { ok: false, reason: "refresh_timeout_no_status" };
}

async function runOnce({ refresh = true, force = false } = {}) {
  let status = await checkTunnel();
  if ((status.ok && !force) || !refresh) {
    writeStatus({ ...status, refreshed: false });
    return status;
  }

  const before = status;
  const refreshResult = await refreshTunnel();
  const after = await waitForHealthyTunnel(REFRESH_WAIT_MS);
  status = {
    ...after,
    refreshed: true,
    refresh_result: refreshResult,
    previous_reason: before.reason,
  };
  writeStatus(status);
  return status;
}

async function runLoop() {
  while (true) {
    try {
      // Do not rotate quick-tunnel URLs from the background loop. TradingView
      // alerts keep the old webhook until the user pastes a new one.
      await runOnce({ refresh: false });
    } catch (error) {
      writeStatus({ ok: false, reason: "watchdog_exception", error: error.stack || error.message });
    }
    await sleep(CHECK_INTERVAL_MS);
  }
}

if (require.main === module) {
  const once = process.argv.includes("--once");
  const noRefresh = process.argv.includes("--no-refresh");
  (once ? runOnce({ refresh: !noRefresh }) : runLoop())
    .then((status) => {
      if (once) {
        console.log(JSON.stringify(status, null, 2));
        process.exit(status && status.ok ? 0 : 2);
      }
    })
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
}

module.exports = {
  checkTunnel,
  refreshTunnel,
  waitForHealthyTunnel,
  runOnce,
};
