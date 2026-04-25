const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const SNAPSHOT_FILE   = path.join(ROOT, "state", "snapshots", "trading-state.json");
const EVENTS_FILE     = path.join(ROOT, "state", "events",    "trading-events.jsonl");
const SCHED_JOBS_FILE = path.join(ROOT, "scheduler-jobs.json");
const LOG_FILE        = path.join(ROOT, "jarvis-log.jsonl");

function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "localhost", port: 3000,
      path: endpoint, method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch   { resolve({ status: res.statusCode, body: raw });         }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function pass(msg) { console.log("PASS:", msg); }
function fail(msg) { console.log("FAIL:", msg); }
function info(msg) { console.log("    ", msg);  }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function readSnapshot() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8")); }
  catch { return null; }
}

function lastEvents(n = 10) {
  try {
    return fs.readFileSync(EVENTS_FILE, "utf8")
      .split("\n").filter(Boolean).slice(-n)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function lastLogs(n = 20) {
  try {
    return fs.readFileSync(LOG_FILE, "utf8")
      .split("\n").filter(Boolean).slice(-n)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

async function assertRunning() {
  try {
    const r = await api("GET", "/health");
    if (r.status !== 200) throw new Error("non-200");
  } catch {
    console.error("ERROR: Luke not running on localhost:3000 — start it first");
    process.exit(2);
  }
}

module.exports = {
  ROOT, SNAPSHOT_FILE, EVENTS_FILE, SCHED_JOBS_FILE, LOG_FILE,
  api, pass, fail, info, sleep,
  readSnapshot, lastEvents, lastLogs, assertRunning,
};
