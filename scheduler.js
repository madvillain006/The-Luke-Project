process.on('uncaughtException', (err, origin) => {
  const fs = require('fs');
  const path = require('path');
  const ts = new Date().toISOString();
  const entry = `[${ts}] uncaughtException origin=${origin}\n${err.stack || err}\n\n`;
  try { fs.appendFileSync(path.join(__dirname, 'crash.log'), entry); } catch (e) { /* swallow */ }
  console.error(entry);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const fs = require('fs');
  const path = require('path');
  const ts = new Date().toISOString();
  const entry = `[${ts}] unhandledRejection\nreason: ${reason?.stack || reason}\n\n`;
  try { fs.appendFileSync(path.join(__dirname, 'crash.log'), entry); } catch (e) { /* swallow */ }
  console.error(entry);
  // Do NOT exit â€” log and continue. Node 15+ would crash by default; we want to survive
  // transient promise rejections but capture them.
});

process.on('SIGINT', () => {
  console.log('SIGINT received â€” shutting down gracefully');
  process.exit(0);
});

const fs = require("fs");
const path = require("path");
const { log } = require("./lib/logger");

const LUKE_URL = "http://localhost:3000";
const HEARTBEAT_FILE = path.join(__dirname, "scheduler-heartbeat.json");
const JOB_STATUS_FILE = path.join(__dirname, "scheduler-jobs.json");

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeHeartbeat(job, result) {
  try {
    const hb = readJson(HEARTBEAT_FILE, {});
    hb[job] = { last_run: new Date().toISOString(), result: String(result || "ok").slice(0, 100) };
    writeJson(HEARTBEAT_FILE, hb);
  } catch {}
}

function markJob(job, patch) {
  const status = readJson(JOB_STATUS_FILE, {});
  status[job] = { ...(status[job] || {}), ...patch };
  writeJson(JOB_STATUS_FILE, status);
}

async function runJob(job, fn) {
  const started = new Date().toISOString();
  const t0 = Date.now();
  markJob(job, { state: "started", last_started: started });
  try {
    const result = await fn();
    const finished = new Date().toISOString();
    markJob(job, {
      state: "succeeded",
      last_started: started,
      last_succeeded: finished,
      duration_ms: Date.now() - t0,
      result: String(result || "ok").slice(0, 160)
    });
    writeHeartbeat(job, result || "ok");
    return result;
  } catch (err) {
    const finished = new Date().toISOString();
    markJob(job, {
      state: "failed",
      last_started: started,
      last_failed: finished,
      duration_ms: Date.now() - t0,
      error: err.message
    });
    log("scheduler-job-error", { job, error: err.message });
    return null;
  }
}

async function post(endpoint, body) {
  const r = await fetch(`${LUKE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`POST ${endpoint} failed: HTTP ${r.status}`);
  return r.json();
}

async function get(endpoint) {
  const r = await fetch(`${LUKE_URL}${endpoint}`);
  if (!r.ok) throw new Error(`GET ${endpoint} failed: HTTP ${r.status}`);
  return r.json();
}

async function morningBriefing() {
  const sections = [];

  try {
    const finance = await get("/agent/finance/assess");
    sections.push("FUND: " + finance.assessment);
  } catch {
    sections.push("FUND: unavailable");
  }

  try {
    const health = await get("/agent/health/assess");
    sections.push("SYSTEM: " + health.assessment);
    if (health.concern) sections.push("LUKE CONCERN FLAGGED - check logs");
  } catch {
    sections.push("SYSTEM: unavailable");
  }

  try {
    const autonomous = await get("/agent/autonomous/status");
    const paperDone = autonomous.paper_trades || 0;
    const toGo = Math.max(0, 25 - paperDone);
    if (autonomous.running) {
      sections.push(`02B: RUNNING (${autonomous.mode.toUpperCase()}) | ${paperDone}/25 paper trades`);
    } else {
      sections.push(`02B: OFF | ${paperDone}/25 paper trades | ${toGo > 0 ? toGo + " to live" : "READY FOR LIVE"}`);
    }
    if (autonomous.kill_day) sections.push("02B DAILY KILL ACTIVE");
    if (autonomous.kill_week) sections.push("02B WEEKLY KILL ACTIVE");
    if (autonomous.apex && autonomous.apex.enabled) {
      const floor = autonomous.apex.eod_threshold;
      const balance = autonomous.apex.account_start + (autonomous.total_eval_pnl || 0);
      const cushion = balance - floor;
      sections.push(`APEX FLOOR: $${floor.toFixed(0)} | Current: $${balance.toFixed(0)} | Cushion: $${cushion.toFixed(0)}`);
    }
  } catch {
    sections.push("02B: unavailable");
  }

  try {
    const signalAssess = await get("/agent/autonomous/assess");
    sections.push("SIGNALS: " + signalAssess.assessment.split("\n").slice(0, 2).join(" | "));
  } catch {}

  sections.push("WINDOWS: 9:45-10:30AM and 2:30-3:30PM ET | ximes+bobby confluence required");

  const briefing = "MORNING BRIEFING " + new Date().toLocaleDateString() + "\n\n" + sections.join("\n");
  await post("/notify", { message: briefing });
  log("morning-briefing", { sections: sections.length });
  return `${sections.length} sections`;
}

async function runPreMarketScan() {
  const { runPreMarketScan } = require("./archive/intraday-scraper-v0-screenshot-based");
  await runPreMarketScan();
  log("pre-market-scan", { triggered: true });
  return "completed";
}

async function generateDocuments() {
  const r = await fetch(`${LUKE_URL}/agent/research/generate-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!r.ok) throw new Error("Document generation failed: HTTP " + r.status);
  return "generated";
}

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

async function runApexEodUpdate() {
  const result = await post("/agent/autonomous/eod-update", {});
  if (result.updated) {
    const msg = result.new_high
      ? `APEX EOD UPDATE - New high! Floor raised to $${result.eod_threshold}\nAccount high: $${result.account_high_eod}`
      : `APEX EOD UPDATE - Floor holds at $${result.eod_threshold} | Closing balance: $${result.closing_balance}`;
    await post("/notify", { message: msg });
    log("apex-eod-update", result);
  }
  if (result.eval_passed) {
    await post("/notify", { message: "APEX EVAL PASSED - Profit target hit! Submit for funding." });
  }
  return result.updated ? "updated" : "no-change";
}

const RSS_FEEDS = [
  { url: "https://weworkremotely.com/categories/remote-programming-jobs.rss", name: "We Work Remotely - Dev" },
  { url: "https://remotive.com/remote-jobs/rss/software-dev", name: "Remotive - Dev" },
  { url: "https://news.ycombinator.com/jobs.rss", name: "HackerNews Jobs" },
];

async function pollRSSFeeds() {
  let found = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const r = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000)
      });
      const xml = await r.text();
      const items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];

      for (const item of items.slice(0, 8)) {
        const titleM = item[1].match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/is);
        const descM = item[1].match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/is);
        const title = (titleM?.[1] || "").replace(/<[^>]+>/g, "").trim();
        const desc = (descM?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
        if (!title || title.length < 5) continue;

        const text = title + "\n" + desc;
        const quickR = await fetch(`${LUKE_URL}/agent/opportunity/scan-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: text, platform: feed.name })
        });
        if (!quickR.ok) throw new Error("scan-context HTTP " + quickR.status);
        const quick = await quickR.json();

        if (quick.reply && quick.reply.toLowerCase().startsWith("yes")) {
          const intakeR = await fetch(`${LUKE_URL}/agent/opportunity/intake`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, source: feed.name })
          });
          if (!intakeR.ok) throw new Error("intake HTTP " + intakeR.status);
          const intake = await intakeR.json();
          if (intake.opp && ["HIGH", "MEDIUM"].includes(intake.opp.fit)) {
            await post("/notify", {
              message: `OPPORTUNITY [${intake.opp.fit}] - ${feed.name}\n${title}\n${intake.opp.notes || ""}`
            });
            found++;
          }
        }
      }
    } catch (err) {
      log("rss-feed-error", { feed: feed.name, error: err.message });
    }
  }

  if (found > 0) log("rss-scan", { found });
  return `${found} found`;
}

async function resetWeeklyIncome() {
  const r = await fetch(`${LUKE_URL}/agent/income/reset-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!r.ok) throw new Error("Weekly income reset failed: HTTP " + r.status);
  return "reset";
}

async function checkTradovateHealth() {
  const r = await fetch(`${LUKE_URL}/agent/autonomous/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (!r.ok) throw new Error("Tradovate health check failed: HTTP " + r.status);
  const result = await r.json();
  const health = { ts: new Date().toISOString(), ok: result.connected === true || result.ok === true, detail: result.message || result.status || "" };
  writeJson(path.join(__dirname, "tradovate-health.json"), health);
  if (!health.ok) await post("/notify", { message: "TRADOVATE CONNECTION FAILED - check credentials\n" + health.detail });
  log("tradovate-health", health);
  return health.ok ? "ok" : "failed";
}

async function runScheduler() {
  const fired = {};
  let currentDate = new Date().toISOString().slice(0, 10);
  let lastRssHour = -1;
  let eodFiredToday = null;

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
  //   if (hour === 1) await runJob("generate-documents", generateDocuments);
  //
  //   if (hour === 2) {
  //     const { runScraper } = require("./discord-scraper");
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
  //     await runJob("research-background-cycle", async () => {
  //       const r = await fetch(`${LUKE_URL}/agent/research/background-cycle`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({})
  //       });
  //       if (!r.ok) throw new Error("HTTP " + r.status);
  //       return "triggered";
  //     });
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
  //   if (hour === 6 && now.getDay() !== 0 && now.getDay() !== 6) {
  //     await runJob("pre-market-scan", runPreMarketScan);
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

runScheduler().catch(console.error);