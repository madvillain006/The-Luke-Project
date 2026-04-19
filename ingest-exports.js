const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const EXPORTS_DIR = path.join(__dirname, "discord-exports");
const HISTORY_FILE = path.join(__dirname, "discord-history.jsonl");
const LOG_FILE = path.join(__dirname, "jarvis-log.jsonl");

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function chunkText(text, chunkSize = 6000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

async function processChunk(chunk, source, chunkIndex) {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Extract every trading signal, price level, and directional call from this Discord export chunk.
Source: ${source}
Chunk: ${chunkIndex}

For each signal found, output exactly:
TIMESTAMP: [date/time if visible]
TICKER: [NQ/ES/SPX/SPY or other]
DIRECTION: [LONG/SHORT/NEUTRAL]
LEVEL: [price level if mentioned]
NOTE: [brief description of the call]
---

If no clear signals in this chunk, output: NO_SIGNALS

Raw text:
${chunk}`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error("Chunk processing error:", err.message);
    return null;
  }
}

async function ingestFile(filePath, sourceName) {
  console.log(`\nIngesting: ${sourceName}`);
  const text = fs.readFileSync(filePath, "utf8");
  console.log(`File size: ${(text.length / 1024).toFixed(1)}KB`);

  const chunks = chunkText(text, 6000);
  console.log(`Chunks to process: ${chunks.length}`);

  let totalSignals = 0;

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  Chunk ${i + 1}/${chunks.length}...`);
    const insights = await processChunk(chunks[i], sourceName, i + 1);

    if (insights && !insights.includes("NO_SIGNALS")) {
      const entry = {
        date: new Date().toISOString(),
        server: "OWLS Capital",
        channel: sourceName,
        priority: "HIGH",
        source: "historical-export",
        results: [{
          scroll: i + 1,
          raw: chunks[i].slice(0, 200),
          insights
        }]
      };
      fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + "\n");
      totalSignals++;
      process.stdout.write(` signals found\n`);
    } else {
      process.stdout.write(` no signals\n`);
    }

    // Rate limit pause
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`Done: ${sourceName} — ${totalSignals} signal chunks written`);
  log("ingest-complete", { source: sourceName, chunks: chunks.length, signalChunks: totalSignals });
}

async function runIngestion() {
  const files = fs.readdirSync(EXPORTS_DIR).filter(f => f.endsWith(".txt"));
  console.log(`Found ${files.length} export files`);

  for (const file of files) {
    const filePath = path.join(EXPORTS_DIR, file);
    const sourceName = file.includes("ximes") ? "ximes-dubz" :
                       file.includes("bobby") ? "bobby-spx-coms" :
                       file.includes("giul") ? "giul-heatseeker" : file;
    await ingestFile(filePath, sourceName);
  }

  console.log("\nIngestion complete. Run Jarvis background cycle to synthesize.");
}

runIngestion().catch(console.error);