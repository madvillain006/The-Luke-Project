"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CLOUDFLARED = path.join(ROOT, "tools", "cloudflared", "cloudflared.exe");
const STATUS_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-status.json");
const MANUAL_REFRESH_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-manual-refresh.json");
const TARGET = process.env.LUKE_TUNNEL_TARGET || "http://localhost:3000";
const URL_RE = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
const MANUAL_REFRESH_MAX_AGE_MS = Number(process.env.LUKE_TUNNEL_MANUAL_REFRESH_MAX_AGE_MS || 120000);

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify({
    updated_at: new Date().toISOString(),
    ...status,
  }, null, 2)}\n`);
}

function freshManualRefreshRequest() {
  const request = readJson(MANUAL_REFRESH_FILE, null);
  const requestedAt = Date.parse(request?.requested_at);
  if (!Number.isFinite(requestedAt)) return false;
  return Date.now() - requestedAt <= MANUAL_REFRESH_MAX_AGE_MS;
}

function clearManualRefreshRequest() {
  try {
    fs.unlinkSync(MANUAL_REFRESH_FILE);
  } catch {}
}

if (!fs.existsSync(CLOUDFLARED)) {
  writeStatus({
    ok: false,
    target: TARGET,
    error: `cloudflared not found at ${CLOUDFLARED}`,
  });
  process.exit(1);
}

const existingStatus = readJson(STATUS_FILE, null);
const hasExistingWebhook = Boolean(existingStatus?.webhook_url || existingStatus?.public_url);
const manualRefresh = freshManualRefreshRequest();
if (hasExistingWebhook && !manualRefresh) {
  writeStatus({
    ok: false,
    target: TARGET,
    status: "manual_refresh_required",
    public_url: existingStatus.public_url || null,
    webhook_url: existingStatus.webhook_url || (existingStatus.public_url ? `${existingStatus.public_url}/webhook/luke-long` : null),
    bridge_status_url: existingStatus.bridge_status_url || null,
    previous_status: existingStatus.status || null,
    error: "quick_tunnel_start_blocked_without_manual_ui_refresh",
  });
  process.exit(0);
}

if (manualRefresh) clearManualRefreshRequest();

writeStatus({
  ok: false,
  target: TARGET,
  status: "starting",
});

const child = spawn(CLOUDFLARED, [
  "tunnel",
  "--url",
  TARGET,
  "--no-autoupdate",
], {
  cwd: ROOT,
  windowsHide: true,
});

let publicUrl = "";

function handleOutput(buffer) {
  const text = buffer.toString();
  process.stdout.write(text);
  const match = text.match(URL_RE);
  if (match && match[0] !== publicUrl) {
    publicUrl = match[0];
    writeStatus({
      ok: true,
      status: "running",
      target: TARGET,
      public_url: publicUrl,
      webhook_url: `${publicUrl}/webhook/luke-long`,
      bridge_status_url: `${publicUrl}/api/ninjatrader/bridge-status`,
      token_required: Boolean(process.env.LUKE_NINJA_BRIDGE_TOKEN),
    });
  }
}

child.stdout.on("data", handleOutput);
child.stderr.on("data", handleOutput);

child.on("exit", (code, signal) => {
  writeStatus({
    ok: false,
    status: "exited",
    target: TARGET,
    public_url: publicUrl || null,
    code,
    signal,
  });
  process.exit(code || 1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
