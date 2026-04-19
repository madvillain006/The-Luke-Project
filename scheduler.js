// C:\Users\conor\jarvis\scheduler.js
const fs = require("fs");
const path = require("path");

const JARVIS_URL = "[localhost](http://localhost:3000)";
const LOG_FILE = path.join(__dirname, "jarvis-log.jsonl");

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

async function post(endpoint, body) {
  const r = await fetch(`${JARVIS_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function get(endpoint) {
  const r = await fetch(`${JARVIS_URL}${endpoint}`);
  return r.json();
}

// --- MORNING BRIEFING (4AM) ---

async function morningBriefing() {
  console.log("Generating morning briefing...");

  const sections = [];

  try {
    const finance = await get("/agent/finance/assess");
    sections.push("FUND: " + finance.assessment);
  } catch { sections.push("FUND: unavailable"); }

  try {
    const health = await get("/agent/health/assess");
    sections.push("LUKE: " + health.assessment);
    if (health.concern) sections.push("⚠ LUKE CONCERN FLAGGED — check logs");
  } catch { sections.push("LUKE: unavailable"); }

  try {
    const autonomous = await get("/agent/autonomous/status");
    const paperDone = autonomous.paper_trades || 0;
    const toGo = Math.max(0, 25 - paperDone);
    if (autonomous.running) {
      sections.push(`02B: RUNNING (${autonomous.mode.toUpperCase()}) | ${paperDone}/25 paper trades`);
    } else {
      sections.push(`02B: OFF | ${paperDone}/25 paper trades | ${toGo > 0 ? toGo + " to live" : "READY FOR LIVE"}`);
    }
    if (autonomous.kill_day) sections.push("⚠ 02B DAILY KILL ACTIVE");
    if (autonomous.kill_week) sections.push("🚨 02B WEEKLY KILL ACTIVE");

    // Apex eval floor status
    if (autonomous.apex && autonomous.apex.enabled) {
      const floor = autonomous.apex.eod_threshold;
      const high = autonomous.apex.account_high_eod;
      const balance = autonomous.apex.account_start + (autonomous.total_eval_pnl || 0);
      const cushion = balance - floor;
      sections.push(`APEX FLOOR: $${floor.toFixed(0)} | Current: $${balance.toFixed(0)} | Cushion: $${cushion.toFixed(0)}`);
    }
  } catch { sections.push("02B: unavailable"); }

  try {
    const signalAssess = await get("/agent/autonomous/assess");
    sections.push("SIGNALS: " + signalAssess.assessment.split("\n").slice(0, 2).join(" | "));
  } catch {}

  sections.push("WINDOWS: 9:45-10:30AM and 2:30-3:30PM ET | ximes+bobby confluence required");
  sections.push("MEDS: Omeprazole 4AM alone → wait 30min → Mirtazapine+Prednisone 4:30AM with food");

  const briefing = "MORNING BRIEFING " + new Date().toLocaleDateString() + "\n\n" + sections.join("\n");
  await post("/notify", { message: briefing });
  log("morning-briefing", { sections: sections.length });
  console.log("Morning briefing sent.");
}

// --- PRE-MARKET SCAN (6:30AM) ---

async function runPreMarketScan() {
  console.log("Triggering pre-market scan...");
  try {
    const { runPreMarketScan } = require("./intraday-scraper");
    await runPreMarketScan();
    log("pre-market-scan", { triggered: true });
  } catch (err) {
    console.error("Pre-market scan failed:", err.message);
    log("pre-market-scan-error", { error: err.message });
  }
}

// --- NIGHTLY DOCUMENT GENERATION (1AM) ---

async function generateDocuments() {
  console.log("Scheduler: generating base documents...");
  try {
    await fetch(`${JARVIS_URL}/agent/research/generate-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  } catch (err) {
    console.error("Document generation failed:", err.message);
  }
}

// --- AGENT SELF-ASSESSMENTS (3AM) ---

async function runAgentAssessments() {
  console.log("Running agent assessments...");
  const concerns = [];

  try {
    const health = await get("/agent/health/assess");
    if (health.concern) concerns.push("LUKE: " + health.assessment);
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
}

// --- APEX EOD THRESHOLD UPDATE (4:59PM ET weekdays) ---

async function runApexEodUpdate() {
  console.log("Scheduler: triggering Apex EOD threshold update...");
  try {
    const result = await post("/agent/autonomous/eod-update", {});
    if (result.updated) {
      const msg = result.new_high
        ? `APEX EOD UPDATE — New high! Floor raised to $${result.eod_threshold}\nAccount high: $${result.account_high_eod}`
        : `APEX EOD UPDATE — Floor holds at $${result.eod_threshold} | Closing balance: $${result.closing_balance}`;
      await post("/notify", { message: msg });
      log("apex-eod-update", result);
    }
    if (result.eval_passed) {
      await post("/notify", { message: "🎉 APEX EVAL PASSED — Profit target hit! Submit for funding." });
    }
  } catch (err) {
    console.error("Apex EOD update failed:", err.message);
    log("apex-eod-update-error", { error: err.message });
  }
}

// --- RSS OPPORTUNITY SCAN (every 8 hours) ---

const RSS_FEEDS = [
  { url: "[weworkremotely.com](https://weworkremotely.com/categories/remote-programming-jobs.rss)", name: "We Work Remotely — Dev" },
  { url: "[remotive.com](https://remotive.com/remote-jobs/rss/software-dev)", name: "Remotive — Dev" },
  { url: "[news.ycombinator.com](https://news.ycombinator.com/jobs.rss)", name: "HackerNews Jobs" },
];

async function pollRSSFeeds() {
  console.log("Polling RSS feeds for opportunities...");
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

        const quickR = await fetch(`${JARVIS_URL}/agent/opportunity/scan-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: text, platform: feed.name })
        });
        const quick = await quickR.json();

        if (quick.reply && quick.reply.toLowerCase().startsWith("yes")) {
          const intakeR = await fetch(`${JARVIS_URL}/agent/opportunity/intake`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, source: feed.name })
          });
          const intake = await intakeR.json();
          if (intake.opp && ["HIGH", "MEDIUM"].includes(intake.opp.fit)) {
            await post("/notify", {
              message: `OPPORTUNITY [${intake.opp.fit}] — ${feed.name}\n${title}\n${intake.opp.notes || ""}`
            });
            found++;
          }
        }
      }
    } catch (err) {
      console.error("RSS feed failed " + feed.name + ":", err.message);
    }
  }

  if (found > 0) log("rss-scan", { found });
  console.log("RSS scan complete. " + found + " opportunities found.");
}

// --- WEEKLY INCOME RESET (Monday 6AM) ---

async function resetWeeklyIncome() {
  console.log("Resetting weekly income counter...");
  try {
    await fetch(`${JARVIS_URL}/agent/income/reset-week`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  } catch (err) {
    console.error("Weekly income reset failed:", err.message);
  }
}

// --- MAIN SCHEDULER ---

async function runScheduler() {
  console.log("Jarvis scheduler running...");

  const fired = {};
  let currentDate = new Date().toISOString().slice(0, 10);
  let lastRssHour = -1;

  // Sub-minute ticker for 4:59PM EOD update (needs to fire at :59, not top of hour)
  // Check every 30 seconds for the EOD window
  let eodFiredToday = null;
  setInterval(async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();

    // 4:59PM ET, weekdays only, once per day
    // Note: scheduler runs in local machine time — if machine is ET this is correct.
    // If machine is not ET, adjust hour/minute accordingly.
    if (hour === 16 && minute === 59 && day !== 0 && day !== 6 && eodFiredToday !== today) {
      eodFiredToday = today;
      await runApexEodUpdate();
    }
  }, 30 * 1000); // every 30 seconds

  setInterval(async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (today !== currentDate) {
      Object.keys(fired).forEach(k => delete fired[k]);
      currentDate = today;
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const key = `${today}-${hour}`;

    if (minute >= 5 || fired[key]) return;
    fired[key] = true;

    // 1AM — generate base documents
    if (hour === 1) await generateDocuments();

    // 2AM — nightly Discord scrape
    if (hour === 2) {
      console.log("Scheduler: triggering nightly Discord scrape...");
      const { runScraper } = require("./discord-scraper");
      runScraper(["HIGH"]).catch(console.error);
    }

    // 3AM — Agent 06 cycle + agent assessments
    if (hour === 3) {
      console.log("Scheduler: running Agent 06 background cycle...");
      fetch(`${JARVIS_URL}/agent/research/background-cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).catch(console.error);
      await runAgentAssessments();
    }

    // 4AM — Morning briefing
    if (hour === 4) await morningBriefing();

    // 6AM weekdays — pre-market scan
    if (hour === 6 && now.getDay() !== 0 && now.getDay() !== 6) {
      await runPreMarketScan();
    }

    // 6AM Monday — weekly income reset
    if (hour === 6 && now.getDay() === 1) {
      await resetWeeklyIncome();
    }

    // 9AM — reset 02B daily kill/P&L before market open
    if (hour === 9) {
      fetch(`${JARVIS_URL}/agent/autonomous/daily-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).catch(console.error);
    }

    // 5PM weekdays — Apex EOD trailing threshold update
    if (hour === 17 && now.getDay() !== 0 && now.getDay() !== 6) {
      fetch(`${JARVIS_URL}/agent/autonomous/eod-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).catch(console.error);
    }

    // RSS: poll at 8AM, 2PM, 8PM
    if ([8, 14, 20].includes(hour) && hour !== lastRssHour) {
      lastRssHour = hour;
      pollRSSFeeds().catch(console.error);
    }

    // Agent-09 architect scan: 6AM (morning), 1PM (midday), 11PM (evening)
    const archTriggers = { 6: "morning", 13: "midday", 23: "evening" };
    if (archTriggers[hour]) {
      post("/agent/architect/run", { trigger: archTriggers[hour] }).catch(console.error);
    }

  }, 5 * 60 * 1000);
}

runScheduler().catch(console.error);
