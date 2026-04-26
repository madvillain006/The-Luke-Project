/*
 * ARCHIVED — intraday-scraper v0 (screenshot-based)
 *
 * Original purpose:
 *   Automated ingestion of analyst signals via Playwright screenshot scraping
 *   of Discord windows. Captured pre-market data (Finnhub quotes, level estimates)
 *   and analyst Discord channel content without requiring manual paste.
 *
 * Why archived:
 *   Requires a Mac mini target environment for headless browser + Discord window
 *   management. Current dev machine (Windows) cannot run this reliably. Archived
 *   rather than deleted to preserve the work and historical context.
 *
 * When to revisit:
 *   Post-Apex-payout, when shipping the commercial version. Do NOT unarchive
 *   and resume without first evaluating alternative approaches (see below).
 *
 * Architectural note for v1 design:
 *   Do NOT assume screenshot scraping is the right path. Evaluate:
 *     - Direct Discord API (discord.js bot reading channels — Kat already does this)
 *     - Headless browser with proper authentication
 *     - OWLS server hooks (if Elevated Charts provides them)
 *     - Paid analyst feed APIs (structured data, no scraping needed)
 *   v0 screenshot approach was a pragmatic first attempt, not a design commitment.
 *
 * Original commit reference:
 *   c929691 — Jarvis v1 - built April 20 2026
 *   0172f71 — fix(intraday): log notifyJarvis and glance errors instead of silent catch
 *   567448c — fix(security): remove hardcoded Finnhub key fallback
 *   5381a97 — Rename project: Jarvis → Luke
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const HISTORY_FILE = path.join(__dirname, "discord-history.jsonl");
const LOG_FILE = path.join(__dirname, "jarvis-log.jsonl");
const FINNHUB_KEY = process.env.FINNHUB_KEY;
if (!FINNHUB_KEY) { console.error("FINNHUB_KEY not set in environment"); process.exit(1); }

const INTRADAY_CHANNELS = [
  { server: "OWLS Capital", name: "ximes-dubz", url: "https://discord.com/channels/718624848812834903/1476605105263612097", priority: "PRIMARY" },
  { server: "OWLS Capital", name: "bobby-spx-coms", url: "https://discord.com/channels/718624848812834903/1473072016637821168", priority: "PRIMARY" },
];

const GLANCE_CHANNELS = [
  { server: "Base", name: "positions", url: "https://discord.com/channels/995345482618503249/995347068942045204" },
  { server: "Elevated Charts", name: "jefe-flow", url: "https://discord.com/channels/755261229748191313/1443678893377851586" },
  { server: "OWLS Capital", name: "trading-floor", url: "https://discord.com/channels/718624848812834903/718643687097368658" },
];

function isMarketHours() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = et.getHours();
  const min = et.getMinutes();
  const timeNum = hour * 100 + min;
  return timeNum >= 915 && timeNum <= 1600;
}

function runPython(args) {
  try {
    return execSync("python desktop.py " + args, { cwd: __dirname, timeout: 15000 }).toString().trim();
  } catch { return null; }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getLiveQuote(ticker) {
  try {
    const r = await fetch("https://finnhub.io/api/v1/quote?symbol=" + ticker + "&token=" + FINNHUB_KEY);
    const d = await r.json();
    return ticker + ": $" + d.c.toFixed(2) + " (" + ((d.c - d.pc) / d.pc * 100).toFixed(2) + "%)";
  } catch { return ticker + ": unavailable"; }
}

async function scrapeAndExtract(channel) {
  try {
    runPython("open " + channel.url);
    await sleep(4000);

    const b64 = runPython("screenshot");
    if (!b64) return null;

    const buffer = Buffer.from(b64, "base64");
    fs.writeFileSync(path.join(__dirname, "screenshot.png"), buffer);

    const readResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
          { type: "text", text: "This is Discord channel " + channel.name + ". Extract the most recent trading signals, price levels, directions, and any heatmap node levels visible. Focus on ximes level calls and bobby heatmap nodes. Be specific with numbers. If nothing new or actionable, say NO_NEW_SIGNALS." }
        ]
      }]
    });

    const raw = readResponse.content[0].text;
    if (raw.includes("NO_NEW_SIGNALS")) return null;

    const extractResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [{
        role: "user",
        content: "Extract actionable futures signals from this Discord content for MNQ/MES trading.\n\nChannel: " + channel.name + "\nContent: " + raw + "\n\nFor each signal:\nTICKER: NQ or ES\nDIRECTION: LONG/SHORT\nLEVEL: exact price\nSTOP: level that invalidates\nTARGET: next key level\nCONVICTION: HIGH/MEDIUM/LOW\n\nIf no clear futures signal: NO_ACTIONABLE_SIGNALS"
      }]
    });

    const insights = extractResponse.content[0].text;
    if (insights.includes("NO_ACTIONABLE_SIGNALS")) return null;

    return { raw, insights };
  } catch (err) {
    console.error("Error scraping " + channel.name + ":", err.message);
    return null;
  }
}

async function notifyLuke(message) {
  try {
    await fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
  } catch (err) {
    console.error("[notifyLuke] failed:", err.message);
  }
}

async function triggerAutonomousEvaluate() {
  try {
    await fetch("http://localhost:3000/agent/autonomous/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  } catch {}
}

async function triggerAutonomousMonitor() {
  try {
    await fetch("http://localhost:3000/agent/autonomous/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  } catch {}
}

async function runIntradayCycle() {
  console.log("Intraday cycle: " + new Date().toLocaleTimeString());

  const [spy, nq] = await Promise.all([getLiveQuote("SPY"), getLiveQuote("NQ")]);
  console.log("Market: " + spy + " | " + nq);

  let newSignals = false;
  for (const channel of INTRADAY_CHANNELS) {
    const result = await scrapeAndExtract(channel);
    if (result) {
      const entry = {
        date: new Date().toISOString(),
        server: channel.server,
        channel: channel.name,
        priority: "INTRADAY",
        source: "intraday-scraper",
        market: { spy, nq },
        results: [{ scroll: 1, raw: result.raw, insights: result.insights }]
      };
      fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + "\n");
      fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type: "intraday-signal", data: { channel: channel.name, insights: result.insights } }) + "\n");

      await notifyLuke("INTRADAY SIGNAL [" + channel.name + "]:\n" + result.insights);
      console.log("Signal found in " + channel.name + " — Luke notified");
      newSignals = true;
    }
    await sleep(3000);
  }

  // Trigger 02B evaluation if new signals came in, always monitor open positions
  if (newSignals) await triggerAutonomousEvaluate();
  await triggerAutonomousMonitor();
}

async function runGlanceCycle() {
  console.log("Glance cycle: " + new Date().toLocaleTimeString());
  for (const channel of GLANCE_CHANNELS) {
    try {
      runPython("open " + channel.url);
      await sleep(3000);
      const b64 = runPython("screenshot");
      if (!b64) continue;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            { type: "text", text: "Discord channel " + channel.name + ". In one sentence: is there anything urgent or actionable in the last few messages? If nothing notable, say NOTHING_NOTABLE." }
          ]
        }]
      });

      const summary = response.content[0].text;
      if (!summary.includes("NOTHING_NOTABLE")) {
        await notifyLuke("GLANCE [" + channel.name + "]: " + summary);
        console.log("Glance alert: " + channel.name);
      }
      await sleep(2000);
    } catch (err) { console.error("[glance] error on " + channel.name + ":", err.message); }
  }
}

// Pre-market scan — captures ximes key levels + bobby GEX before session opens (call at 6:30AM ET)
async function runPreMarketScan() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return;

  console.log("Pre-market scan starting: " + new Date().toLocaleTimeString());

  const preMarketChannels = [
    { server: "OWLS Capital", name: "ximes-dubz", url: "https://discord.com/channels/718624848812834903/1476605105263612097", prompt: "This is ximes-dubz pre-market. Extract today's key price levels, bias direction, and any levels ximes is watching for the session. Format: BIAS: [bull/bear/neutral] | KEY LEVELS: [list] | NOTES: [any special context]. If no pre-market call yet, say NO_PREMARKET_CALL." },
    { server: "OWLS Capital", name: "bobby-spx-coms", url: "https://discord.com/channels/718624848812834903/1473072016637821168", prompt: "This is bobby-spx-coms pre-market GEX/heatmap. Extract the key heatmap nodes, GEX flip levels, and any dealer positioning context for today. Format: GEX FLIP: [level] | YELLOW NODES: [levels] | MAGNET: [level] | BIAS: [bull/bear]. If nothing pre-market yet, say NO_PREMARKET_DATA." }
  ];

  const results = [];
  for (const ch of preMarketChannels) {
    try {
      runPython("open " + ch.url);
      await sleep(5000);
      const b64 = runPython("screenshot");
      if (!b64) continue;

      const readResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            { type: "text", text: ch.prompt }
          ]
        }]
      });

      const raw = readResponse.content[0].text;
      if (raw.includes("NO_PREMARKET_CALL") || raw.includes("NO_PREMARKET_DATA")) {
        console.log("No pre-market data yet in " + ch.name);
        continue;
      }

      const entry = {
        date: new Date().toISOString(),
        server: ch.server,
        channel: ch.name,
        priority: "PRE-MARKET",
        source: "pre-market-scan",
        results: [{ scroll: 1, raw, insights: raw }]
      };
      fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + "\n");
      results.push({ channel: ch.name, data: raw });
      console.log("Pre-market captured from " + ch.name);
      await sleep(3000);
    } catch (err) {
      console.error("Pre-market scan error for " + ch.name + ":", err.message);
    }
  }

  if (results.length > 0) {
    await notifyLuke(
      "PRE-MARKET SCAN COMPLETE\n\n" +
      results.map(r => "[" + r.channel + "]\n" + r.data).join("\n\n")
    );
  } else {
    await notifyLuke("Pre-market scan ran — no data posted yet in ximes or bobby. Check manually.");
  }
}

async function run() {
  console.log("Intraday scraper started");
  console.log("Monitoring: ximes-dubz + bobby-spx-coms every 90 seconds");
  console.log("Glancing: positions, jefe-flow, trading-floor every 15 minutes");

  if (!isMarketHours()) {
    console.log("Market is closed. Waiting for market hours (9:15AM-4:00PM ET)...");
    while (!isMarketHours()) {
      await sleep(60000);
    }
    console.log("Market hours detected. Starting intraday monitoring.");
  }

  let cycleCount = 0;

  while (isMarketHours()) {
    await runIntradayCycle();
    cycleCount++;

    if (cycleCount % 10 === 0) {
      await runGlanceCycle();
    }

    await sleep(90000);
  }

  console.log("Market closed. Intraday scraper stopping.");
}

module.exports = { runPreMarketScan };
// DISABLED - manual trigger only
// run().catch(console.error);