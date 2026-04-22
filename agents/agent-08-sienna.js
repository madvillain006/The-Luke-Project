const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const HISTORY_FILE = path.join(__dirname, "../discord-history.jsonl");
const EXPORTS_DIR = path.join(__dirname, "../discord-exports");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");
const PROFILE_FILE = path.join(__dirname, "../SIENNA_PROFILE.md");

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function loadExportFiles() {
  try {
    const files = fs.readdirSync(EXPORTS_DIR).filter(f => f.endsWith(".txt") && !fs.statSync(path.join(EXPORTS_DIR, f)).isDirectory());
    return files.map(f => ({
      name: f,
      text: fs.readFileSync(path.join(EXPORTS_DIR, f), "utf8")
    }));
  } catch { return []; }
}

function loadAllHistorySignals() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const signals = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        for (const r of entry.results || []) {
          if (r.insights && !r.insights.includes("NO_SIGNALS") && !r.insights.includes("NO_ACTIONABLE")) {
            signals.push({
              date: entry.date,
              channel: entry.channel || "unknown",
              source: entry.source || "unknown",
              insights: r.insights.slice(0, 400)
            });
          }
        }
      } catch {}
    }
    return signals;
  } catch { return []; }
}

const SIENNA_SYSTEM = `You are SIENNA — a quantitative trading research engine within Jarvis.

YOUR JOB:
- Extract and model trader methodologies from raw Discord data
- Build quantitative rules from qualitative signal language
- Identify recurring setups, frameworks, and edge conditions
- For Nobu specifically: "FV" means Flag Velocity — a specific signal type.
  ONLY log FV when it is posted BY Nobu, or when Nobu RESPONDS to something with a picture.
  Any other mention of "FV" from anyone else = ignore completely.

QUANTITATIVE OUTPUT RULES:
- Specific price levels over vague descriptions
- Named setups with entry triggers, stop criteria, target method
- Timing patterns in hours/minutes not "early" or "late"
- Win conditions vs fail conditions clearly separated

TONE: Data-first. Numbered. Direct. No hedging.`;

// Analyze all export files and build SIENNA_PROFILE.md
router.post("/analyze", async (req, res) => {
  const exports = loadExportFiles();
  if (exports.length === 0) return res.json({ error: "No .txt files in discord-exports/" });

  res.json({ started: true, files: exports.length, message: "Building Sienna profile — check SIENNA_PROFILE.md when done" });

  const allExtracted = [];

  for (const file of exports) {
    const chunkSize = 8000;
    const chunks = [];
    for (let i = 0; i < file.text.length; i += chunkSize) {
      chunks.push(file.text.slice(i, i + chunkSize));
    }

    const fileResults = [];
    for (let i = 0; i < Math.min(chunks.length, 12); i++) {
      try {
        const r = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Discord export chunk. File: ${file.name} | Chunk ${i + 1}/${Math.min(chunks.length, 12)}\n\nExtract:\n- Trader names and their specific calls/levels\n- Recurring setups or frameworks mentioned\n- Nobu's posts specifically — flag any "FV" posts from Nobu OR posts where Nobu responds with a picture\n- Price levels with context\n\nIgnore: general chat, memes, non-trading content, FV mentions from anyone other than Nobu.\nIf nothing notable: NO_SIGNALS\n\nText:\n${chunks[i]}`
          }]
        });
        const text = r.content[0].text;
        if (!text.includes("NO_SIGNALS")) fileResults.push(text);
      } catch {}
      await new Promise(r => setTimeout(r, 400));
    }

    if (fileResults.length > 0) {
      allExtracted.push({ file: file.name, data: fileResults.join("\n") });
      log("sienna-extract", { file: file.name, chunks: fileResults.length });
    }
  }

  if (allExtracted.length === 0) {
    log("sienna-analyze", { result: "no_signals", files: exports.length });
    return;
  }

  const combined = allExtracted.map(e => `=== ${e.file} ===\n${e.data}`).join("\n\n");

  // H10 fix: if combined exceeds 14000 chars, chunk-summarize first via Haiku,
  // then pass the condensed summaries to the main synthesis. Prevents silent
  // truncation of trader methodology data.
  const SYNTH_BUDGET = 14000;
  let dataForSynthesis = combined;

  if (combined.length > SYNTH_BUDGET) {
    const CHUNK_SIZE = 10000;
    const chunks = [];
    for (let i = 0; i < combined.length; i += CHUNK_SIZE) {
      chunks.push(combined.slice(i, i + CHUNK_SIZE));
    }

    const summaries = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const r = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `Summarize this chunk of pre-extracted trader data for a downstream synthesis step. Preserve: trader names, specific price levels, setup names, entry triggers, stop/target methods, timing patterns. Drop: repetitive phrasing, filler, duplicates.\n\nChunk ${i + 1}/${chunks.length}:\n${chunks[i]}`
          }]
        });
        summaries.push(r.content[0].text);
      } catch (err) {
        log("sienna-chunk-summary-error", { chunk: i + 1, error: err.message });
      }
      await new Promise(r => setTimeout(r, 400));
    }

    dataForSynthesis = summaries.join("\n\n");
    log("sienna-chunked-synthesis", {
      chunks: chunks.length,
      total_chars: combined.length,
      condensed_chars: dataForSynthesis.length
    });
  }

  try {
    const synthesis = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SIENNA_SYSTEM,
      messages: [{
        role: "user",
        content: `Build a complete quantitative trader profile from this Discord export data.\n\nFor EACH trader found:\n1. Core methodology — how they identify setups\n2. Typical instruments and timeframes\n3. Entry triggers (specific, not vague)\n4. Stop criteria\n5. Target method\n6. Timing patterns (when during session)\n7. What works based on the data\n8. What doesn't work\n\nFor NOBU specifically:\n- Document Flag Velocity (FV) — what it is, when Nobu uses it, what it signals\n- Only count FV when posted by Nobu or when Nobu responds with a picture\n- How does FV relate to trade execution?\n\nData:\n${dataForSynthesis}`
      }]
    });

    const profile = "# SIENNA PROFILE\n*Generated " + new Date().toISOString() + "*\n\n" + synthesis.content[0].text;
    fs.writeFileSync(PROFILE_FILE, profile);
    log("sienna-analyze", { files: allExtracted.length, profile_written: true });

    fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "SIENNA PROFILE GENERATED\nSIENNA_PROFILE.md written\n" + synthesis.content[0].text.slice(0, 400) + "..." })
    }).catch(() => {});

  } catch (err) {
    log("sienna-analyze-error", { error: err.message });
  }
});

// Return current SIENNA_PROFILE.md
router.get("/profile", (req, res) => {
  try {
    if (!fs.existsSync(PROFILE_FILE)) return res.json({ profile: null, message: "No profile yet — run POST /analyze first" });
    const profile = fs.readFileSync(PROFILE_FILE, "utf8");
    res.json({ profile, generated: fs.statSync(PROFILE_FILE).mtime });
  } catch { res.json({ profile: null, error: "Could not read profile" }); }
});

// Score a signal against Sienna's known framework
router.post("/score-signal", async (req, res) => {
  const { signal, channel } = req.body;
  if (!signal) return res.status(400).json({ error: "No signal provided" });

  let profileContext = "";
  try {
    if (fs.existsSync(PROFILE_FILE)) profileContext = fs.readFileSync(PROFILE_FILE, "utf8").slice(0, 1500);
  } catch {}

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system: SIENNA_SYSTEM,
      messages: [{
        role: "user",
        content: `Score this signal against known trader methodologies.\n\nSIGNAL (from ${channel || "unknown"}):\n${signal}\n\n${profileContext ? "PROFILE CONTEXT:\n" + profileContext : "No profile loaded."}\n\nOutput:\nSCORE: 1-10\nALIGNED_WITH: [trader name]\nSETUP_TYPE: [specific setup name]\nCONFIRMS: [what it confirms]\nCONFLICTS: [what it conflicts with, or NONE]`
      }]
    });
    res.json({ reply: r.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quantitative stats across all signals in history
router.get("/model", (req, res) => {
  const signals = loadAllHistorySignals();
  if (signals.length === 0) return res.json({ error: "No signals in discord-history.jsonl" });

  const channels = {};
  const directions = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
  const tickers = {};
  const dates = signals.map(s => s.date).filter(Boolean).sort();

  for (const s of signals) {
    channels[s.channel] = (channels[s.channel] || 0) + 1;
    if (/DIRECTION:\s*LONG/i.test(s.insights)) directions.LONG++;
    else if (/DIRECTION:\s*SHORT/i.test(s.insights)) directions.SHORT++;
    else directions.NEUTRAL++;
    const tm = s.insights.match(/TICKER:\s*(NQ|ES|SPX|SPY|QQQ|MNQ|MES)/i);
    if (tm) tickers[tm[1].toUpperCase()] = (tickers[tm[1].toUpperCase()] || 0) + 1;
  }

  const total = signals.length;
  res.json({
    total_signals: total,
    date_range: dates.length > 1 ? `${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}` : "single entry",
    channels: Object.entries(channels).sort((a, b) => b[1] - a[1]).reduce((o, [k, v]) => ({ ...o, [k]: v }), {}),
    direction_bias: {
      long: total > 0 ? ((directions.LONG / total) * 100).toFixed(0) + "%" : "0%",
      short: total > 0 ? ((directions.SHORT / total) * 100).toFixed(0) + "%" : "0%",
      neutral: total > 0 ? ((directions.NEUTRAL / total) * 100).toFixed(0) + "%" : "0%"
    },
    tickers: Object.entries(tickers).sort((a, b) => b[1] - a[1]).reduce((o, [k, v]) => ({ ...o, [k]: v }), {}),
    profile_exists: fs.existsSync(PROFILE_FILE)
  });
});

module.exports = router;
