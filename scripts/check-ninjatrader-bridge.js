"use strict";

require("dotenv").config();

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BRIDGE_FILE = path.join(ROOT, "data", "ninjatrader", "latest-luke-signal.json");
const TUNNEL_STATUS_FILE = path.join(ROOT, "data", "ninjatrader", "tunnel-status.json");
const NINJA_USER_DIR = process.env.NINJATRADER_USER_DIR || "C:\\Users\\conor\\OneDrive\\Documents\\NinjaTrader 8";
const TOKEN = process.env.LUKE_NINJA_BRIDGE_TOKEN || "";
const LOCAL_BASE_URL = process.env.LUKE_NINJA_LOCAL_URL || "http://localhost:3000";
const WANTS_TEXT_PAYLOAD = process.argv.includes("--text-payload");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const bodyText = options.body || "";
    const request = client.request({
      method: options.method || "GET",
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        ...(options.headers || {}),
        ...(bodyText ? { "content-length": Buffer.byteLength(bodyText) } : {}),
      },
      timeout: 20000,
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        let body = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = { raw: text };
        }
        resolve({
          status: response.statusCode,
          ok: response.statusCode >= 200 && response.statusCode < 300,
          body,
        });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error(`request timed out: ${url}`));
    });
    request.on("error", reject);
    if (bodyText) request.write(bodyText);
    request.end();
  });
}

async function postCommand(url, body) {
  const payload = JSON.stringify(TOKEN ? { ...body, token: TOKEN } : body);
  return requestJson(url, {
    method: "POST",
    headers: { "content-type": WANTS_TEXT_PAYLOAD ? "text/plain" : "application/json" },
    body: payload,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearBridgeFile(note) {
  writeJson(BRIDGE_FILE, {
    ok: false,
    bridge_version: 1,
    written_at: new Date().toISOString(),
    signal: null,
    safety: {
      sim_bridge_only: true,
      live_broker_execution: false,
      note,
    },
  });
}

function recentFiles(dir, prefix) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.toLowerCase().startsWith(prefix) && name.toLowerCase().endsWith(".txt"))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return { full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 4)
      .map((item) => item.full);
  } catch {
    return [];
  }
}

function ninjaFilesContain(text) {
  const files = [
    ...recentFiles(path.join(NINJA_USER_DIR, "log"), "log."),
    ...recentFiles(path.join(NINJA_USER_DIR, "trace"), "trace."),
  ];
  for (const file of files) {
    try {
      if (fs.readFileSync(file, "utf8").includes(text)) {
        return { found: true, file };
      }
    } catch {}
  }
  return { found: false, file: null };
}

function latestNinjaStrategyEvent() {
  const files = [
    ...recentFiles(path.join(NINJA_USER_DIR, "log"), "log."),
    ...recentFiles(path.join(NINJA_USER_DIR, "trace"), "trace."),
  ];
  const events = [];
  for (const file of files) {
    try {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.includes("NinjaScript strategy 'LukeAlertBridgeStrategy/")) continue;
        if (!line.includes("Enabling") && !line.includes("Disabling")) continue;
        const timestamp = (line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3})/) || [null, ""])[1];
        events.push({
          timestamp,
          state: line.includes("Enabling") ? "enabled" : "disabled",
          file,
          line,
        });
      }
    } catch {}
  }
  return events.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))).at(-1) || null;
}

async function waitForNinjaText(text, timeoutMs = 60000, pollMs = 1000) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const seen = ninjaFilesContain(text);
    if (seen.found) {
      return seen;
    }
    await sleep(pollMs);
  }
  return { found: false, file: null };
}

async function main() {
  const tunnel = readJson(TUNNEL_STATUS_FILE, null);
  const wantsPublicTunnel = process.argv.includes("--public-tunnel") || process.env.LUKE_NINJA_USE_PUBLIC_TUNNEL === "true";
  const wantsOrderTest = process.argv.includes("--order-test") || process.env.LUKE_NINJA_DO_ORDER_TEST === "true";
  if (!TOKEN) throw new Error("LUKE_NINJA_BRIDGE_TOKEN is not set");

  if (wantsPublicTunnel && (!tunnel || !tunnel.ok || !tunnel.webhook_url)) {
    throw new Error(`Tunnel is not ready: ${JSON.stringify(tunnel)}`);
  }

  const localStatus = await requestJson(`${LOCAL_BASE_URL}/api/ninjatrader/bridge-status?token=${encodeURIComponent(TOKEN)}`);
  if (!localStatus.ok || !localStatus.body?.ok) {
    throw new Error(`Local bridge status failed: ${localStatus.status} ${JSON.stringify(localStatus.body)}`);
  }

  let publicStatus = null;
  if (wantsPublicTunnel) {
    publicStatus = await requestJson(`${tunnel.public_url}/api/ninjatrader/bridge-status?token=${encodeURIComponent(TOKEN)}`);
    if (!publicStatus.ok || !publicStatus.body?.ok) {
      throw new Error(`Public bridge status failed: ${publicStatus.status} ${JSON.stringify(publicStatus.body)}`);
    }
  }

  const webhookUrl = wantsPublicTunnel ? tunnel.webhook_url : `${LOCAL_BASE_URL}/webhook/luke-long`;
  const strategyEventBeforePing = latestNinjaStrategyEvent();
  const pingId = `doctor-ping-${Date.now()}`;
  const pingResponse = await postCommand(webhookUrl, {
    id: pingId,
    type: "LUKE_PING",
    side: "PING",
    symbol: "ESM2026",
    timestamp: String(Date.now()),
    reason: "doctor_ping_no_order",
    source: "luke-bridge-doctor",
  });
  if (!pingResponse.ok || pingResponse.body?.signal?.type !== "LUKE_PING") {
    throw new Error(`Public PING failed: ${pingResponse.status} ${JSON.stringify(pingResponse.body)}`);
  }

  const pingSeen = await waitForNinjaText(`LUKE BRIDGE PING ${pingId}`, 20000, 500);
  const strategyEventAfterPing = latestNinjaStrategyEvent();
  clearBridgeFile("cleared after no-order Ninja bridge ping doctor");

  if (!pingSeen.found || !wantsOrderTest) {
    console.log(JSON.stringify({
      ok: pingSeen.found,
      mode: "ping_only_no_order",
      route: wantsPublicTunnel ? "public_tunnel" : "local_only",
      webhook_url: webhookUrl,
      local_status: localStatus.status,
      public_status: publicStatus ? publicStatus.status : null,
      ping_status: pingResponse.status,
      payload_content_type: WANTS_TEXT_PAYLOAD ? "text/plain" : "application/json",
      ninja_ping_seen: pingSeen.found,
      ninja_ping_file: pingSeen.file,
      ninja_strategy_state: strategyEventAfterPing?.state || strategyEventBeforePing?.state || "unknown",
      latest_ninja_strategy_event: strategyEventAfterPing?.line || strategyEventBeforePing?.line || null,
      bridge_file_cleared: true,
      next: pingSeen.found ? "Ninja bridge is armed; use --order-test only when intentionally testing orders." : strategyEventAfterPing?.state === "disabled" ? "Enable LukeAlertBridgeStrategy in NinjaTrader, then rerun this ping doctor." : "Ninja did not log ping; strategy is not enabled, is running old compiled code, or did not poll within 20s.",
    }, null, 2));
    process.exit(pingSeen.found ? 0 : 2);
  }

  const id = `doctor-order-${Date.now()}`;
  const longPayload = {
    id,
    symbol: "ESM2026",
    side: "LONG",
    entry: 7000.25,
    stop: 6997.25,
    tp1: 7002.25,
    tp2: 7004.25,
    qty: 2,
    timestamp: String(Date.now()),
    source: "luke-bridge-doctor",
  };

  const longResponse = await postCommand(webhookUrl, longPayload);
  if (!longResponse.ok || longResponse.body?.signal?.type !== "LUKE_LONG") {
    throw new Error(`Public LONG failed: ${longResponse.status} ${JSON.stringify(longResponse.body)}`);
  }
  const longSeen = await waitForNinjaText(`LUKE SIM LONG ${id}`);
  if (!longSeen.found) {
    clearBridgeFile("cleared after order doctor LONG was not seen by Ninja");
    throw new Error(`Ninja did not log LUKE SIM LONG ${id}; strategy may not be polling, may have rejected the signal, or market data ticks did not arrive.`);
  }

  const cancelResponse = await postCommand(webhookUrl, {
    id,
    type: "LUKE_CANCEL",
    side: "CANCEL",
    symbol: "ESM2026",
    timestamp: String(Date.now()),
    reason: "doctor_cancel",
    source: "luke-bridge-doctor",
  });
  if (!cancelResponse.ok || cancelResponse.body?.signal?.type !== "LUKE_CANCEL") {
    throw new Error(`Public CANCEL failed: ${cancelResponse.status} ${JSON.stringify(cancelResponse.body)}`);
  }
  const cancelSeen = await waitForNinjaText(`LUKE SIM CANCEL ${id}`);
  if (!cancelSeen.found) {
    clearBridgeFile("cleared after order doctor CANCEL was not seen by Ninja");
    throw new Error(`Ninja did not log LUKE SIM CANCEL ${id}; cancel/exit path is not proven.`);
  }

  const lateLongResponse = await postCommand(webhookUrl, longPayload);
  if (lateLongResponse.status !== 400) {
    throw new Error(`Late LONG should reject after CANCEL, got ${lateLongResponse.status}`);
  }

  clearBridgeFile("cleared after public tunnel bridge order doctor; waiting for real Luke alert");

  console.log(JSON.stringify({
    ok: true,
    route: wantsPublicTunnel ? "public_tunnel" : "local_only",
    webhook_url: webhookUrl,
    local_status: localStatus.status,
    public_status: publicStatus ? publicStatus.status : null,
    ping_status: pingResponse.status,
    payload_content_type: WANTS_TEXT_PAYLOAD ? "text/plain" : "application/json",
    ninja_ping_seen: pingSeen.found,
    ninja_ping_file: pingSeen.file,
    ninja_strategy_state: strategyEventAfterPing?.state || strategyEventBeforePing?.state || "unknown",
    latest_ninja_strategy_event: strategyEventAfterPing?.line || strategyEventBeforePing?.line || null,
    long_status: longResponse.status,
    ninja_long_seen: longSeen.found,
    ninja_long_file: longSeen.file,
    cancel_status: cancelResponse.status,
    ninja_cancel_seen: cancelSeen.found,
    ninja_cancel_file: cancelSeen.file,
    late_long_status: lateLongResponse.status,
    bridge_file_cleared: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
