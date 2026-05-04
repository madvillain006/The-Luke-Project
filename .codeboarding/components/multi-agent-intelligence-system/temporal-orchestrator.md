---
component_id: 2.4
component_name: Temporal Orchestrator
---

# Temporal Orchestrator

## Component Description

Manages the lifecycle of the system through periodic tasks, agent assessments, and heartbeat monitoring. It ensures that the multi-agent system maintains its operational cadence.

---

## Key References:

### c:\Users\conor\luke\scheduler.js (lines 304-482)
```
async function runScheduler() {
  const fired = {};
  let currentDate = new Date().toISOString().slice(0, 10);
  let lastRssHour = -1;
  let eodFiredToday = null;



  const { runSatyAutoPull, loadAutoPullState } = require("./lib/saty-auto-pull");
  const { loadSatyLevels } = require("./lib/saty-levels");
  const { isFuturesMarketOpen } = require("./lib/market-hours");
  setInterval(async () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const mins = (Number(map.hour) * 60) + Number(map.minute);
    const normalCashWindow = map.weekday !== 'Sat' && map.weekday !== 'Sun' && mins >= 505 && mins <= 515;
    const futuresCatchup = isFuturesMarketOpen(now).open && !loadSatyLevels();
    if (!normalCashWindow && !futuresCatchup) return;
    const todayET = `${map.year}-${map.month}-${map.day}`;
    const state = loadAutoPullState();
    const lastAttemptET = state?.last_attempt
      ? new Date(state.last_attempt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      : null;
    if (lastAttemptET === todayET) return;
    await runJob(normalCashWindow ? "saty-auto-pull-0830" : "saty-auto-pull-futures-catchup", async () => {
      const result = await runSatyAutoPull({ preferUs500: futuresCatchup && !normalCashWindow });
      if (!result.ok && !result.pending) throw new Error(result.error || result.reason || 'Saty auto-pull failed');
      return result.pending ? `pending: ${result.reason || 'pending'}` : `saved ${result.level_count} levels`;
    });
  }, 60 * 1000);

  // DISABLED - manual trigger only
  // setInterval(async () => {
  //   const now = new Date();
  //   const today = now.toISOString().slice(0, 10);
  //   const hour = now.getHours();
  //   const minute = now.getMinutes();
  //   const day = now.getDay();
  //   if (hour === 16 && minute === 59 && day !== 0 && day !== 6 && eodFiredToday !== today) {
  //     eodFiredToday = today;
  //     await runJob("apex-eod-update-459", runApexEodUpdate);
  //   }
  // }, 30 * 1000);

  // DISABLED - manual trigger only
  // setInterval(async () => {
  //   const now = new Date();
  //   const today = now.toISOString().slice(0, 10);
  //
  //   if (today !== currentDate) {
  //     Object.keys(fired).forEach(k => delete fired[k]);
  //     currentDate = today;
  //   }
  //
  //   const hour = now.getHours();
  //   const minute = now.getMinutes();
  //   const key = `${today}-${hour}`;
  //   if (minute >= 5 || fired[key]) return;
  //   fired[key] = true;
  //
  //   if (hour === 0) {
  //     await runJob("tokens-reset-daily", async () => {
  //       const r = await fetch(`${LUKE_URL}/agent/tokens/reset-daily`, { method: "POST" });
  //       if (!r.ok) throw new Error("HTTP " + r.status);
  //       return "reset";
  //     });
  //     if (now.getDay() === 1) {
  //       await runJob("tokens-reset-weekly", async () => {
  //         const r = await fetch(`${LUKE_URL}/agent/tokens/reset-weekly`, { method: "POST" });
  //         if (!r.ok) throw new Error("HTTP " + r.status);
  //         return "reset";
  //       });
  //     }
  //   }
  //
  //   if (hour === 2) {
  //     const { runScraper } = require("./scripts/discord-scraper");
  //     await runJob("discord-scrape", async () => {
  //       await runScraper(["HIGH"]);
  //       return "triggered";
  //     });
  //   }
  //
  //   if (hour === 2 && now.getDate() === 1) {
  //     await runJob("sweeper-inventory", async () => {
  //       await post("/agent/sweeper/inventory", {});
  //       return "triggered";
  //     });
  //   }
  //
  //   if (hour === 3) {
  //     await runJob("agent-assessments", runAgentAssessments);
  //     await runJob("tool-health-nightly", async () => {
  //       const r = await fetch(`${LUKE_URL}/luke/tool-health-nightly`, { method: "POST" });
  //       if (!r.ok) throw new Error("HTTP " + r.status);
  //       return "ok";
  //     });
  //   }
  //
  //   if (hour === 4) await runJob("morning-briefing", morningBriefing);
  //
  //   if (hour === 8 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("daily-morning-briefing", () => dailyBriefing("morning"));
  //   }
  //
  //   if (hour === 14 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("daily-afternoon-briefing", () => dailyBriefing("afternoon"));
  //   }
  //
  //   if (hour === 6 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("tradovate-health", checkTradovateHealth);
  //   }
  //
  //   if (hour === 6 && now.getDay() === 1) {
  //     await runJob("weekly-income-reset", resetWeeklyIncome);
  //   }
  //
  //   if (hour === 7 && now.getDay() === 1) {
  //     await runJob("sweeper-delta-scan", async () => {
  //       await post("/agent/sweeper/delta-scan", {});
  //       return "triggered";
  //     });
  //   }
  //
  //   if (hour === 9) {
  //     await runJob("autonomous-daily-reset", async () => {
  //       const r = await fetch(`${LUKE_URL}/agent/autonomous/daily-reset`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({})
  //       });
  //       if (!r.ok) throw new Error("HTTP " + r.status);
  //       return "reset";
  //     });
  //   }
  //
  //   if (hour === 10 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("canary", async () => {
  //       await post("/agent/autonomous/canary", {});
  //       return "triggered";
  //     });
  //   }
  //
  //   if (hour === 17 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("apex-eod-update", async () => {
  //       const r = await fetch(`${LUKE_URL}/agent/autonomous/eod-update`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({})
  //       });
  //       if (!r.ok) throw new Error("HTTP " + r.status);
  //       return "triggered";
  //     });
  //   }
  //
  //   if ([8, 14, 20].includes(hour) && hour !== lastRssHour) {
  //     lastRssHour = hour;
  //     await runJob("rss-scan", pollRSSFeeds);
  //   }
  //
  //   const archTriggers = { 6: "morning", 13: "midday", 23: "evening" };
  //   if (archTriggers[hour]) {
  //     await runJob("architect", async () => {
  //       await post("/agent/architect/run", { trigger: archTriggers[hour] });
  //       return archTriggers[hour];
  //     });
  //   }
  // }, 5 * 60 * 1000);
}
```

### c:\Users\conor\luke\scheduler.js (lines 177-203)
```
async function runAgentAssessments() {
  const concerns = [];

  try {
    const health = await get("/agent/health/assess");
    if (health.concern) concerns.push("SYSTEM: " + health.assessment);
  } catch {}

  try {
    const finance = await get("/agent/finance/assess");
    if (finance.concern) concerns.push("FINANCE: " + finance.assessment);
  } catch {}

  try {
    const trader = await get("/agent/trader/assess");
    if (trader.assessment && !trader.assessment.toLowerCase().includes("no trades")) {
      log("trader-assess", { assessment: trader.assessment });
    }
  } catch {}

  if (concerns.length > 0) {
    await post("/notify", { message: "OVERNIGHT CONCERN FLAGS\n\n" + concerns.join("\n\n") });
    log("overnight-concerns", { concerns });
  }

  return concerns.length ? `${concerns.length} concerns` : "no concerns";
}
```


## Source Files:

- `scheduler.js`

