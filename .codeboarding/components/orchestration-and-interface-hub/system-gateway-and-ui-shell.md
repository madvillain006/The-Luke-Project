---
component_id: 1.1
component_name: System Gateway & UI Shell
---

# System Gateway & UI Shell

## Component Description

Manages the application's lifecycle, including the Electron desktop window, the Express API server, and the routing of requests to internal agents. It provides the physical interface and the network entry point for all operations.

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
- `preload.js`

