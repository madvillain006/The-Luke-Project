const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { ROOT, events, runtime } = require("../lib/paths");

const client = new Anthropic();

const CHANNELS = [
  { server: "Base", name: "positions", url: "https://discord.com/channels/995345482618503249/995347068942045204", priority: "HIGH" },
  { server: "Base", name: "spx-ndx-futures", url: "https://discord.com/channels/995345482618503249/1304107087193702511", priority: "HIGH" },
  { server: "Base", name: "flow", url: "https://discord.com/channels/995345482618503249/995345863050268803", priority: "HIGH" },
  { server: "Elevated Charts", name: "jefe-flow", url: "https://discord.com/channels/755261229748191313/1443678893377851586", priority: "HIGH" },
  { server: "Elevated Charts", name: "uw-flow", url: "https://discord.com/channels/755261229748191313/1389824176881270808", priority: "MEDIUM" },
  { server: "Elevated Charts", name: "trade-floor", url: "https://discord.com/channels/755261229748191313/1040400353490911292", priority: "MEDIUM" },
  { server: "OWLS Capital", name: "trading-floor", url: "https://discord.com/channels/718624848812834903/718643687097368658", priority: "HIGH" },
  { server: "OWLS Capital", name: "bobby-spx-coms", url: "https://discord.com/channels/718624848812834903/1473072016637821168", priority: "HIGH" },
  { server: "OWLS Capital", name: "giul-heatseeker", url: "https://discord.com/channels/718624848812834903/1457591894337916999", priority: "MEDIUM" },
  { server: "OWLS Capital", name: "ximes-dubz", url: "https://discord.com/channels/718624848812834903/1476605105263612097", priority: "HIGH" },
  { server: "OWLS Capital", name: "news", url: "https://discord.com/channels/718624848812834903/1081082844807434292", priority: "LOW" },
  { server: "DM", name: "GOATS", url: "https://discord.com/channels/@me/1319318159328809070", priority: "HIGH" },
  { server: "DM", name: "Flow", url: "https://discord.com/channels/@me/1417517605576638484", priority: "HIGH" },
  { server: "DM", name: "OWLS ALERTS", url: "https://discord.com/channels/@me/1450560212900647016", priority: "HIGH" },
  { server: "DM", name: "bigT", url: "https://discord.com/channels/@me/963573643194015814", priority: "HIGH" },
  { server: "DM", name: "BarrySanders329", url: "https://discord.com/channels/@me/1137717841609629786", priority: "HIGH" },
];

const HISTORY_PATH = events.discordHistory;

function runPython(args) {
  try {
    const result = execSync(`python scripts\\desktop.py ${args}`, {
      cwd: ROOT,
      timeout: 15000,
    }).toString().trim();
    return result;
  } catch (err) {
    console.error(`scripts/desktop.py error: ${err.message}`);
    return null;
  }
}

function takeScreenshot() {
  const b64 = runPython("screenshot");
  if (!b64) return null;
  const buffer = Buffer.from(b64, "base64");
  fs.writeFileSync(runtime.screenshot, buffer);
  return b64;
}

function openUrl(url) {
  runPython(`open ${url}`);
}

function scrollDown(amount = 5) {
  runPython(`scroll down ${amount}`);
}

async function readScreenWithHaiku(b64Image, channelName, server) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: b64Image,
            },
          },
          {
            type: "text",
            text: `This is a screenshot of the Discord channel "${channelName}" in server "${server}". Extract all visible trading messages, tickers, flow alerts, option plays, price levels, and any signals. Return raw text of what you see. If there are images of charts or flow data, describe what they show. Be thorough.`,
          },
        ],
      },
    ],
  });
  return response.content[0].text;
}

async function extractInsightsWithOpus(rawText, channelName, server) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are analyzing Discord trading channel data for a trader named Conor. 

Channel: ${channelName} | Server: ${server}

Raw content:
${rawText}

Extract actionable trading insights. For each one return:
TICKER: 
DIRECTION: 
LEVEL/STRIKE: 
EXPIRY: 
CONVICTION: HIGH/MEDIUM/LOW
TRADER: 
NOTE: 

If no clear trade setups, return: NO_ACTIONABLE_SIGNALS

Only include real signals with tickers and direction. Skip general chat.`,
      },
    ],
  });
  return response.content[0].text;
}

function appendToHistory(entry) {
  fs.appendFileSync(HISTORY_PATH, JSON.stringify(entry) + "\n");
}

async function scrapeChannel(channel) {
  console.log(`\nScraping: [${channel.server}] #${channel.name}`);

  openUrl(channel.url);
  await sleep(4000);

  const results = [];

  for (let scroll = 0; scroll < 3; scroll++) {
    const b64 = takeScreenshot();
    if (!b64) {
      console.log("  Screenshot failed, skipping");
      break;
    }

    const rawText = await readScreenWithHaiku(b64, channel.name, channel.server);
    console.log(`  Screen ${scroll + 1} read (${rawText.length} chars)`);

    if (rawText && rawText.length > 50) {
      const insights = await extractInsightsWithOpus(rawText, channel.name, channel.server);
      results.push({ scroll: scroll + 1, raw: rawText, insights });

      if (insights && !insights.includes("NO_ACTIONABLE_SIGNALS")) {
        console.log(`  Signals found on scroll ${scroll + 1}`);
      }
    }

    if (scroll < 2) {
      scrollDown(5);
      await sleep(1500);
    }
  }

  return results;
}

async function runScraper(priorityFilter = ["HIGH"]) {
  console.log(`\n=== Discord Scraper Starting ===`);
  console.log(`Priority filter: ${priorityFilter.join(", ")}`);

  const targets = CHANNELS.filter(c => priorityFilter.includes(c.priority));
  console.log(`Channels to scrape: ${targets.length}`);

  const session = {
    date: new Date().toISOString(),
    channels: [],
  };

  for (const channel of targets) {
    try {
      const results = await scrapeChannel(channel);
      const entry = {
        date: new Date().toISOString(),
        server: channel.server,
        channel: channel.name,
        priority: channel.priority,
        results,
      };
      session.channels.push(entry);
      appendToHistory(entry);
      await sleep(2000);
    } catch (err) {
      console.error(`  Error on ${channel.name}: ${err.message}`);
    }
  }

  console.log(`\n=== Scrape complete. ${session.channels.length} channels processed ===`);
  const expected = targets.length;
  const received = session.channels.filter(c => c.results && c.results.length > 0).length;
  const missing = targets.filter(t => !session.channels.find(c => c.channel === t.name)).map(t => t.name);
  const completeness = expected > 0 ? Math.round(received / expected * 100) : 100;
  try { fs.writeFileSync(runtime.scrapeResult, JSON.stringify({ ts: new Date().toISOString(), expected, received, missing, completeness }, null, 2)); } catch {}
  return session;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runScraper, scrapeChannel, CHANNELS };

// Run directly: node scripts/discord-scraper.js
if (require.main === module) {
  runScraper(["HIGH"]).catch(console.error);
}
