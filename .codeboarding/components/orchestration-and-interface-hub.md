---
component_id: 1
component_name: Orchestration & Interface Hub
---

# Orchestration & Interface Hub

## Component Description

Central nervous system managing the Electron-based desktop environment, Express API server, and command routing logic. Bridges human operator interactions with the underlying agentic system.

---

## Key References:

### c:\Users\conor\luke\index.js (lines 247-357)
```
async function routeToAgent(message) {
  if (/(bought|entered|opened|took a position|took calls|took puts)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/log-trade", "POST", extractTrade(message));
      return { reply: data.reply, agent: "trader" };
    } catch (err) {
      log("agent-fetch-error", { agent: "trader", endpoint: "/agent/trader/log-trade", error: err.message });
      return { reply: `[trader agent error: ${err.message}]`, agent: "trader-error" };
    }
  }

  if (/(calls|puts|strike|expiry|contract|flow|signal|conviction|wyckoff|spx|spy|qqq|fngu|apg|setup|thesis|premium|ema|ximes|bobby|heatmap|futures|mnq|mes)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/trader/analyze-signal", "POST", { signal: message, ticker: extractTicker(message) });
      return { reply: data.reply, agent: "trader" };
    } catch (err) {
      log("agent-fetch-error", { agent: "trader", endpoint: "/agent/trader/analyze-signal", error: err.message });
      return { reply: `[trader agent error: ${err.message}]`, agent: "trader-error" };
    }
  }

  if (/(instacart|shift|deliveries|delivery|made \$|earned|drove|zone|batch)/i.test(message)) {
    const shift = extractShift(message);
    if (shift.earnings && shift.hours) {
      try {
        const data = await agentFetch("/agent/income/log-shift", "POST", shift);
        return { reply: data.reply, agent: "income" };
      } catch (err) {
        log("agent-fetch-error", { agent: "income", endpoint: "/agent/income/log-shift", error: err.message });
        return { reply: `[income agent error: ${err.message}]`, agent: "income-error" };
      }
    }
  }

  if (/(02b|autonomous.*trad|paper trade|start.*bot|stop.*bot|kill.*switch|auto.*execut)/i.test(message)) {
    try {
      if (/reconcile|broker status|check broker|sync broker/i.test(message)) {
        const rec = await agentFetch("/agent/autonomous/reconcile", "GET");
        const lines = [
          rec.ok ? "02B RECONCILE: MATCH" : "02B RECONCILE: MISMATCH",
          `Accounts: ${rec.account_count ?? "?"}`,
          `Open positions: ${rec.open_positions ?? "?"}`,
          `Working orders: ${rec.working_orders ?? "?"}`,
          ...(rec.mismatches || [])
        ].join("\n");
        return { reply: lines, agent: "autonomous" };
      }

      const action = /start|launch|begin|activate|turn on/i.test(message) ? "start"
        : /stop|pause|deactivate|turn off/i.test(message) ? "stop"
        : /kill|emergency|abort/i.test(message) ? "kill"
        : null;

      if (action) await agentFetch("/agent/autonomous/" + action, "POST", {});
      const status = await agentFetch("/agent/autonomous/status", "GET");
      const lines = [
        "02B - " + (status.running ? (status.mode === "live" ? "LIVE" : "PAPER") : "OFF"),
        status.running ? `Mode: ${status.mode.toUpperCase()}` : null,
        status.execution?.phase ? `Execution: ${status.execution.phase}` : null,
        `Paper trades: ${status.paper_trades || 0} / 25`,
        status.open_position ? `Open: ${status.open_position.direction} ${status.open_position.ticker} @ ${status.open_position.entry}` : "No open position",
        status.kill_day ? "KILL: Daily kill active" : null,
        status.kill_week ? "KILL: Weekly kill active" : null,
        `Daily P&L: $${(status.daily_pnl || 0).toFixed(0)}`,
      ].filter(Boolean).join("\n");
      return { reply: lines, agent: "autonomous" };
    } catch (err) {
      log("agent-fetch-error", { agent: "autonomous", endpoint: "/agent/autonomous/*", error: err.message });
      return { reply: `[autonomous agent error: ${err.message}]`, agent: "autonomous-error" };
    }
  }

  if (/scheduler status|jobs status|scheduled jobs/i.test(message)) {
    try {
      const data = await agentFetch("/scheduler/status", "GET");
      const jobs = Object.entries(data.jobs || {});
      if (jobs.length === 0) return { reply: "No scheduler job receipts yet.", agent: "scheduler" };
      const lines = jobs.slice(0, 8).map(([name, info]) => `${name}: ${info.state || "unknown"} | ok=${info.last_succeeded || "never"} | fail=${info.last_failed || "never"}`);
      return { reply: "Scheduler jobs:\n" + lines.join("\n"), agent: "scheduler" };
    } catch (err) {
      log("agent-fetch-error", { agent: "scheduler", endpoint: "/scheduler/status", error: err.message });
      return { reply: `[scheduler agent error: ${err.message}]`, agent: "scheduler-error" };
    }
  }

  if (/(opportunity|contract|pitch|freelance|apply|job|gig)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/opportunity/pipeline", "GET");
      const reply = data.active > 0
        ? `${data.active} active opportunity${data.active > 1 ? "ies" : ""} in pipeline. Tell me to intake a new one or get details.`
        : "No active opportunities in pipeline. Paste one and I'll evaluate it.";
      return { reply, agent: "opportunity" };
    } catch (err) {
      log("agent-fetch-error", { agent: "opportunity", endpoint: "/agent/opportunity/pipeline", error: err.message });
      return { reply: `[opportunity agent error: ${err.message}]`, agent: "opportunity-error" };
    }
  }

  if (/(move fund|how much.*saved|fund status|on track|tennessee.*money|debt|owe|how are we looking|where are we at)/i.test(message)) {
    try {
      const data = await agentFetch("/agent/finance/fund-status", "GET");
      const reply = "Fund: $" + (data.balance || "0") + " / $6,000 | " + (data.weeks_left || "?") + " weeks left | Need $" + (data.weekly_needed || "?") + "/week | " + (data.status || "unknown");
      return { reply, agent: "finance" };
    } catch (err) {
      log("agent-fetch-error", { agent: "finance", endpoint: "/agent/finance/fund-status", error: err.message });
      return { reply: "Couldn't pull fund status right now.", agent: "finance-error" };
    }
  }

  return null;
}
```

### c:\Users\conor\luke\index.js (lines 1334-1355)
```
(function bootChecks() {
  const required_envs = ["ANTHROPIC_API_KEY"];
  for (const key of required_envs) {
    if (!process.env[key]) {
      console.error(`[boot] FATAL: required env var ${key} is not set`);
      process.exit(1);
    }
  }
  // write-permission check on logs directory
  const testFile = events.lukeLog;
  try { fs.accessSync(path.dirname(testFile), fs.constants.W_OK); }
  catch { console.error("[boot] FATAL: log directory is not writable"); process.exit(1); }

  // required data dirs
  for (const dir of ["data", "state", "agents"]) {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      console.error(`[boot] FATAL: required directory '${dir}' is missing`);
      process.exit(1);
    }
  }
  log("boot-checks-passed", { envs: required_envs });
})();
```

### c:\Users\conor\luke\electron.js (lines 56-89)
```
function createWindow() {
    const saved = loadWindowState()
    const defaultBounds = { width: 1280, height: 820, x: 80, y: 60 }
    const bounds = saved && saved.width >= 960 && saved.height >= 640 ? saved : defaultBounds
    const win = new BrowserWindow({
        width:  bounds.width,
        height: bounds.height,
        x:      bounds.x,
        y:      bounds.y,
        minWidth: 960,
        minHeight: 640,
        resizable: true,
        title: 'Luke',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.setMenuBarVisibility(false)
    win.loadURL('http://localhost:3000/shell')
    win.on('resize', () => saveWindowState(win))
    win.on('move',   () => saveWindowState(win))
    win.on('closed', () => {
        if (serverProcess) serverProcess.kill()
    })
    globalShortcut.register('CommandOrControl+Shift+K', () => {
        fetch('http://localhost:3000/kill-workflow', { method: 'POST' }).catch(() => {})
        fetch('http://localhost:3000/panic', { method: 'POST' }).catch(() => {})
    })
}
```


## Source Files:

- `electron.js`
- `index.js`
- `lib\actions.js`
- `lib\bobby-heatmap-idempotency.js`
- `lib\bracket-calc.js`
- `lib\commands\entries-command.js`
- `lib\commands\status-command.js`
- `lib\commands\verdict-command.js`
- `lib\confluence-engine.js`
- `lib\confluence.js`
- `lib\daily-accumulator.js`
- `lib\decision-spine\index.js`
- `lib\detect-paste.js`
- `lib\emotional-exits.js`
- `lib\es-bracket-strategy.js`
- `lib\es-long-bracket-runner.js`
- `lib\futures-entry-zones.js`
- `lib\heatmap-context.js`
- `lib\heatseeker-reference.js`
- `lib\historical-data.js`
- `lib\kat-audit.js`
- `lib\kat-confluence.js`
- `lib\kat-equity-options.js`
- `lib\kat-index-scope.js`
- `lib\kat-insights.js`
- `lib\kat-level-context.js`
- `lib\kat-market-evaluation.js`
- `lib\kat-message-bin.js`
- `lib\kat-owner-proof-pack.js`
- `lib\kat-readiness.js`
- `lib\kat-replay.js`
- `lib\kat-ticker-watchlist.js`
- `lib\level-memory.js`
- `lib\level-replay.js`
- `lib\live-price.js`
- `lib\llm-client.js`
- `lib\logger.js`
- `lib\market-data\providers\finnhub.js`
- `lib\market-data\providers\polygon.js`
- `lib\market-data\providers\tradovate.js`
- `lib\market-data\providers\yahoo.js`
- `lib\market-hours.js`
- `lib\memory.js`
- `lib\operator\confluence-adapter.js`
- `lib\operator\decision-adapter.js`
- `lib\operator\fake-breakdown-watchlist-adapter.js`
- `lib\operator\ingestion-status-adapter.js`
- `lib\operator\level-memory-adapter.js`
- `lib\operator\log-adapter.js`
- `lib\operator\operator-status-adapter.js`
- `lib\parse-bobby.js`
- `lib\parse-dubz.js`
- `lib\parse-kat.js`
- `lib\parse-mancini.js`
- `lib\parse-ximes.js`
- `lib\renderers\entries-renderer.js`
- `lib\renderers\status-renderer.js`
- `lib\renderers\verdict-renderer.js`
- `lib\research\common.js`
- `lib\research\corpus-loader.js`
- `lib\research\existing-data-inventory.js`
- `lib\research\fake-breakdown-state-machine\account-sim.js`
- `lib\research\fake-breakdown-state-machine\evaluator.js`
- `lib\research\fake-breakdown-state-machine\live-watchlist.js`
- `lib\research\fake-breakdown-state-machine\report.js`
- `lib\research\fake-breakdown-state-machine\rule-throttle-analysis.js`
- `lib\research\fake-breakdown-state-machine\rules.js`
- `lib\research\fake-breakdown-state-machine\states.js`
- `lib\research\fake-breakdown-state-machine\visual-replay.js`
- `lib\research\fake-breakdown-state-machine\watchlist-report.js`
- `lib\research\fake-breakdown-v3\combo-search.js`
- `lib\research\fake-breakdown-v3\evaluator.js`
- `lib\research\fake-breakdown-v3\feature-extractor.js`
- `lib\research\fake-breakdown-v3\filters.js`
- `lib\research\fake-breakdown-v3\report.js`
- `lib\research\no-lookahead-context.js`
- `lib\research\outcome-metrics.js`
- `lib\research\replay-engine.js`
- `lib\research\source-attribution.js`
- `lib\research\source-timeline.js`
- `lib\saty-auto-pull.js`
- `lib\saty-levels.js`
- `lib\session-replay.js`
- `lib\sienna-regime.js`
- `lib\slash-commands-ingest.js`
- `lib\slash-commands.js`
- `lib\system-prompt.js`
- `lib\today-levels-shim.js`
- `lib\validators.js`
- `preload.js`
- `scripts\audit-kat.js`
- `scripts\backfill-saty-to-memory.js`
- `scripts\backtest-es-long-bracket.js`
- `scripts\backtest-session.js`
- `scripts\build-es-long-backtest-dataset.js`
- `scripts\build-es-long-backtest-sessions.js`
- `scripts\build-fake-breakdown-watchlist-replay.js`
- `scripts\build-kat-owner-proof-pack.js`
- `scripts\build-level-frequency.js`
- `scripts\compare-operator-surfaces.js`
- `scripts\coverage-audit.js`
- `scripts\diagnose-backtest-coverage.js`
- `scripts\discord-scraper.js`
- `scripts\dry-fire.js`
- `scripts\generate-es-long-candidates.js`
- `scripts\import-mancini-archive.js`
- `scripts\ingest-exports.js`
- `scripts\inject-session-bobby-levels.js`
- `scripts\inventory-existing-research-data.js`
- `scripts\mancini-check.js`
- `scripts\parse-bobby-images.js`
- `scripts\parse-discord-backtest.js`
- `scripts\prove-operator-v2.js`
- `scripts\prove-staged-flow.js`
- `scripts\replay-decision-spine-history.js`
- `scripts\replay-kat.js`
- `scripts\run-atm-backtest.js`
- `scripts\run-combined-atm-backtest.js`
- `scripts\run-existing-data-replay.js`
- `scripts\run-fake-breakdown-research.js`
- `scripts\run-fake-breakdown-state-machine.js`
- `scripts\run-fake-breakdown-v2-research.js`
- `scripts\run-fake-breakdown-v3-live-filters.js`
- `scripts\run-historical-operator-replay.js`
- `scripts\run-operator-session.js`
- `scripts\run-prop-fake-breakdown-research.js`
- `scripts\run-tonight-wrapup-proof.js`
- `scripts\run-virtual-trading-workday-showcase.js`
- `scripts\test-bobby-vision.js`
- `scripts\test-dubz-paste.js`
- `scripts\validate-bobby-fixtures.js`
- `scripts\validate-dubz-fixtures.js`
- `scripts\verify-gate4-dubz-memory.js`
- `scripts\verify-gate5-bobby-memory.js`
- `scripts\verify-market-data.js`
- `state\health-store.js`
- `state\lib.js`
- `state\trading-store.js`
- `trading\broker-tradovate.js`
- `trading\common.js`
- `trading\execution-live.js`
- `trading\execution-paper.js`
- `trading\execution-shadow.js`
- `trading\market-context.js`
- `trading\metrics.js`
- `trading\risk.js`
- `trading\router.js`
- `trading\signals.js`

