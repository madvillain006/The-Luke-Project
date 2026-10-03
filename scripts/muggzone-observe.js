#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { ShadowLedger } = require("../lib/muggzone/ledger");
const { MuggzoneObserver, DiscordDomSurface, ObserverHalt, validateConfig, exactChannel, atomicJson } = require("../lib/muggzone/observer");
const { scheduleState } = require("../lib/muggzone/schedule");

function argumentsFor(argv) {
  const result = { once: false, status: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--config") result.config = argv[++i];
    else if (argv[i] === "--once") result.once = true;
    else if (argv[i] === "--status") result.status = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!result.config) throw new Error("Usage: node scripts/muggzone-observe.js --config /persistent/config.json [--once|--status]");
  return result;
}

async function loadPlaywright() {
  // Offline replay and tests never load a browser dependency or start Electron.
  try { const loaded = await import("playwright"); return loaded.default || loaded; }
  catch (original) {
    try {
      const scoped = createRequire(path.join(__dirname, "../deploy/muggzone/package.json"));
      const loaded = await import(pathToFileURL(scoped.resolve("playwright")).href);
      return loaded.default || loaded;
    } catch { throw new Error(`Playwright unavailable. Install the scoped deploy/muggzone runtime. ${original.code || ""}`); }
  }
}

function claimLock(filename) {
  let fd;
  try { fd = fs.openSync(filename, "wx", 0o600); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const pid = Number(fs.readFileSync(filename, "utf8").trim());
    if (!Number.isInteger(pid) || pid < 1) throw new Error(`Invalid lock ${filename}; preserve it for review`);
    try { process.kill(pid, 0); throw new Error(`Observer already running as PID ${pid}`); }
    catch (running) { if (running.code !== "ESRCH") throw running; }
    fs.unlinkSync(filename);
    fd = fs.openSync(filename, "wx", 0o600);
  }
  fs.writeFileSync(fd, `${process.pid}\n`); fs.closeSync(fd);
  return () => { try { fs.unlinkSync(filename); } catch {} };
}

function wait(ms, stopSignal) {
  return new Promise(resolve => {
    const timer = setTimeout(done, ms);
    function done() { clearTimeout(timer); stopSignal.off("stop", done); resolve(); }
    stopSignal.once("stop", done);
  });
}

function borrowedBrowser(context) {
  if (!context || typeof context.pages !== "function") throw new Error("A live browser context is required");
  // The desktop owns this persistent session. Observer halts disconnect observation,
  // leaving the browser open for the user to review or reauthenticate.
  return { contexts: () => [context], close: async () => {} };
}

async function main(argv = process.argv.slice(2), { browserContext = null } = {}) {
  const args = argumentsFor(argv);
  const config = validateConfig(JSON.parse(fs.readFileSync(args.config, "utf8")));
  const repo = path.resolve(__dirname, "..");
  const dataDir = path.resolve(config.data_dir);
  if (dataDir === repo || dataDir.startsWith(`${repo}${path.sep}`)) throw new Error("Persistent data and browser sessions must stay outside the source repo");
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const dbPath = path.join(dataDir, "shadow.sqlite");
  if (args.status && !fs.existsSync(dbPath)) { console.log(JSON.stringify({ initialized: false, status: "not_started" })); return; }
  const releaseLock = args.status ? () => {} : claimLock(path.join(dataDir, "observer.lock"));
  let ledger;
  let browser;
  let stopped = false;
  const stopSignal = new (require("node:events").EventEmitter)();
  const stop = () => { stopped = true; stopSignal.emit("stop"); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  const statusFile = path.join(dataDir, "observer-status.json");
  const publish = value => { atomicJson(statusFile, { ...value, updated_at: new Date().toISOString() }); console.log(JSON.stringify(value)); };
  try {
    ledger = new ShadowLedger({ dbPath, channelId: config.channel_id, authorIds: config.author_ids });
    if (args.status) { console.log(JSON.stringify(ledger.status(), null, 2)); return; }
    // Construct before browser connection so checkpoint/database inconsistencies stop immediately.
    const observer = new MuggzoneObserver({ surface: null, ledger, config });
    while (!stopped) {
      const schedule = scheduleState(new Date(), config.schedule);
      if (!schedule.active) {
        publish({ status: "outside_window", schedule });
        if (args.once) return;
        await wait(Math.min(config.schedule.poll_interval_ms, 60000), stopSignal);
        continue;
      }
      const ledgerState = ledger.status();
      if (ledgerState.health?.status === "halted") throw new ObserverHalt("ledger_review", "Ledger is halted for review; restore continuity before observing more signals");
      if (ledgerState.review_required) throw new ObserverHalt("source_review", "A source instruction requires manual reconciliation before polling can continue");
      if (!browser) {
        if (browserContext) browser = borrowedBrowser(browserContext);
        else {
          const { chromium } = await loadPlaywright();
          browser = await chromium.connectOverCDP(config.cdp_url);
        }
        const pages = browser.contexts().flatMap(context => context.pages());
        const matches = pages.filter(page => exactChannel(page.url(), config.channel_url));
        if (matches.length !== 1) {
          const needsAuth = pages.some(page => /^https:\/\/discord\.com\/(login|register)(?:[/?#]|$)/.test(page.url()));
          throw new ObserverHalt(needsAuth ? "auth_required" : "channel_tab_required", "Manually authenticate and leave exactly one tab open at the configured MuggZone channel");
        }
        observer.surface = new DiscordDomSurface(matches[0], config);
      }
      const result = await observer.poll();
      publish({ status: result.status, history_complete: result.history_complete, accepted: result.accepted, duplicates: result.duplicates, review: result.review, review_required: !!result.review_required, ignored: result.ignored, observer_problems: result.observer_problems });
      if (!result.history_complete || result.health?.status !== "ready") throw new ObserverHalt("ledger_review", "Observation needs review; no further automatic polling will run");
      if (result.review_required) throw new ObserverHalt("source_review", "A source instruction requires manual reconciliation before polling can continue");
      if (args.once) return;
      await wait(config.schedule.poll_interval_ms, stopSignal);
    }
    publish({ status: "stopped" });
  } catch (error) {
    publish({ status: "halted", reason: error.code || "observer_error", message: error.message });
    process.exitCode = 1;
  } finally {
    // Closing a CDP connection disconnects this client; the manually authenticated browser stays running.
    if (browser) await browser.close().catch(() => {});
    if (ledger) ledger.close();
    releaseLock();
    process.off("SIGINT", stop); process.off("SIGTERM", stop);
  }
}

module.exports = { main, argumentsFor, loadPlaywright, claimLock, borrowedBrowser };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
