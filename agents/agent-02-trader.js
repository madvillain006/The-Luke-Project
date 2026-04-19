const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const MEMORY_FILE = path.join(__dirname, "../memory.json");
const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");
const TRADES_FILE = path.join(__dirname, "../trades.jsonl");
const FINNHUB_KEY = "d7ibl19r01qu8vfo2410d7ibl19r01qu8vfo241g";

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return {}; }
}

function saveMemory(mem) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

function logTrade(trade) {
  fs.appendFileSync(TRADES_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...trade }) + "\n");
}

function loadTrades() {
  try {
    return fs.readFileSync(TRADES_FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

async function getLiveQuote(ticker) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return {
      price: d.c,
      change: ((d.c - d.pc) / d.pc * 100).toFixed(2),
      high: d.h,
      low: d.l,
      open: d.o
    };
  } catch { return null; }
}

const AGENT_02_SYSTEM = `You are the TRADER agent within Jarvis — Conor's options trading execution layer.

YOUR ROLE:
Signal analysis, entry validation, trade logging, P&L tracking. You don't make trades — you validate them against Conor's rules and track results.

CONOR'S TRADING RULES (HARD — NON-NEGOTIABLE):
- Capital: $500
- Sizing: $50-$125 per contract
- Stop: -25% hard stop, set at entry
- Entry: OCO bracket set the moment position opens
- No lottos, no 0DTE gambling, no revenge trades
- Weeklies acceptable on HIGH conviction only with clear structure

CONOR'S EDGE:
- Thesis identification
- Premium/EMA correlation
- Wyckoff phase reading
- Discord flow confluence (bigT, BarrySanders329, jefe, bobby-spx, GOATS)
- Current macro: Wyckoff Markup phase confirmed

SIGNAL HIERARCHY:
1. Institutional flow data (block trades, unusual OI, premium size) — highest weight
2. Discord confluence from key traders — high weight
3. Wyckoff phase alignment — required for entry
4. Live price context — validation only, not the thesis

WATCHLIST: FNGU, SPX, SPY, QQQ, APG

BROKEN LAYER:
Conor's edge is real. Execution is where he bleeds. Slow him down at entry. Track everything after.

TONE: Direct. YES or NO. No hedge. One paragraph max per response.`;

// Analyze a signal with live price context
router.post("/analyze-signal", async (req, res) => {
  const { signal, ticker } = req.body;
  if (!signal) return res.status(400).json({ error: "No signal provided" });

  let quoteBlock = "";
  if (ticker) {
    const quote = await getLiveQuote(ticker);
    if (quote) {
      quoteBlock = `\nLIVE PRICE: ${ticker} at $${quote.price} (${quote.change}% today) | High: $${quote.high} | Low: $${quote.low}`;
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system: AGENT_02_SYSTEM,
      messages: [{
        role: "user",
        content: `Analyze this signal:
${signal}
${quoteBlock}

Output: Thesis, risk, conviction 1-10, does it align with Wyckoff Markup phase. One paragraph.`
      }]
    });

    const reply = response.content[0].text;
    log("trader-analyze", { signal, ticker, reply });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Entry check — YES or NO
router.post("/check-entry", async (req, res) => {
  const { signal, ticker, premium, sizing } = req.body;
  if (!signal) return res.status(400).json({ error: "No signal provided" });

  let quoteBlock = "";
  if (ticker) {
    const quote = await getLiveQuote(ticker);
    if (quote) {
      quoteBlock = `\nLIVE: ${ticker} at $${quote.price} (${quote.change}% today)`;
    }
  }

  const sizingCheck = sizing ? (sizing >= 50 && sizing <= 125 ? "✓ sizing OK" : `⚠ SIZING VIOLATION: $${sizing} is outside $50-$125 range`) : "sizing not provided";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 180,
      system: AGENT_02_SYSTEM,
      messages: [{
        role: "user",
        content: `Entry check:
Signal: ${signal}
${quoteBlock}
Premium: ${premium || "not specified"}
Sizing: ${sizingCheck}

Answer YES or NO. If YES: give strike, expiry, size, OCO stop level. If NO: one sentence why.`
      }]
    });

    const reply = response.content[0].text;
    log("trader-entry-check", { signal, ticker, reply });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log a trade
router.post("/log-trade", async (req, res) => {
  const { ticker, direction, strike, expiry, premium, sizing, entry_price, notes } = req.body;
  if (!ticker || !direction) return res.status(400).json({ error: "ticker and direction required" });

  const trade = {
    ticker,
    direction,
    strike: strike || null,
    expiry: expiry || null,
    premium: premium || null,
    sizing: sizing || null,
    entry_price: entry_price || null,
    notes: notes || null,
    status: "open"
  };

  logTrade(trade);

  const mem = loadMemory();
  if (!mem.open_trades) mem.open_trades = [];
  mem.open_trades.push({ ...trade, opened: new Date().toISOString() });
  saveMemory(mem);

  log("trade-logged", trade);
  res.json({ reply: "Logged.", trade });
});

// Close a trade and update P&L
router.post("/close-trade", async (req, res) => {
  const { ticker, exit_price, result } = req.body;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const mem = loadMemory();
  if (!mem.open_trades) mem.open_trades = [];
  if (!mem.closed_trades) mem.closed_trades = [];
  if (!mem.pnl) mem.pnl = { wins: 0, losses: 0, total: 0, biggest_win: 0, biggest_loss: 0, streak: 0 };

  const idx = mem.open_trades.findIndex(t => t.ticker === ticker);
  if (idx === -1) return res.status(404).json({ error: "No open trade found for " + ticker });

  const trade = mem.open_trades.splice(idx, 1)[0];
  trade.exit_price = exit_price;
  trade.result = result;
  trade.closed = new Date().toISOString();
  mem.closed_trades.push(trade);

  if (result > 0) {
    mem.pnl.wins++;
    mem.pnl.streak = mem.pnl.streak >= 0 ? mem.pnl.streak + 1 : 1;
    if (result > mem.pnl.biggest_win) mem.pnl.biggest_win = result;
  } else {
    mem.pnl.losses++;
    mem.pnl.streak = mem.pnl.streak <= 0 ? mem.pnl.streak - 1 : -1;
    if (result < mem.pnl.biggest_loss) mem.pnl.biggest_loss = result;
  }
  mem.pnl.total += result;

  saveMemory(mem);
  log("trade-closed", { ticker, exit_price, result });
  res.json({ reply: "Closed.", pnl: mem.pnl });
});

// P&L summary
router.get("/pnl-summary", (req, res) => {
  const mem = loadMemory();
  const pnl = mem.pnl || { wins: 0, losses: 0, total: 0, biggest_win: 0, biggest_loss: 0, streak: 0 };
  const open = mem.open_trades || [];
  res.json({
    wins: pnl.wins,
    losses: pnl.losses,
    winrate: pnl.wins + pnl.losses > 0 ? ((pnl.wins / (pnl.wins + pnl.losses)) * 100).toFixed(1) + "%" : "0%",
    total_pnl: "$" + pnl.total.toFixed(2),
    biggest_win: "$" + pnl.biggest_win.toFixed(2),
    biggest_loss: "$" + pnl.biggest_loss.toFixed(2),
    streak: pnl.streak,
    open_positions: open.length
  });
});

// Assess options trading performance and give honest feedback
router.get("/assess", async (req, res) => {
  const trades = loadTrades();
  const mem = loadMemory();
  const pnl = mem.pnl || { wins: 0, losses: 0, total: 0, streak: 0 };
  const open = mem.open_trades || [];

  if (trades.length === 0) return res.json({ assessment: "No trades logged yet. Log some trades first.", trades: 0 });

  const recent = trades.slice(-20);
  const summary = recent.map(t =>
    `${t.ticker} ${t.direction} | entry: $${t.entry_price || "?"} | result: ${t.result !== undefined ? "$" + t.result : "open"} | ${t.notes?.slice(0, 50) || ""}`
  ).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: AGENT_02_SYSTEM,
      messages: [{
        role: "user",
        content: `Assess Conor's recent trading honestly. Don't sugarcoat it.

STATS: ${pnl.wins}W / ${pnl.losses}L | Total P&L: $${pnl.total?.toFixed(2) || 0} | Streak: ${pnl.streak} | Open: ${open.length}

RECENT TRADES (last 20):
${summary}

Give:
PATTERN: what's actually happening in the losses (one sentence)
BROKEN_RULE: most common rule violation or "None"
HONEST_TAKE: one direct sentence about where he is right now
ACTION: one concrete thing to do differently next trade`
      }]
    });
    res.json({ assessment: response.content[0].text, stats: pnl, open_positions: open.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Quick quote
router.get("/quote/:ticker", async (req, res) => {
  const quote = await getLiveQuote(req.params.ticker.toUpperCase());
  if (!quote) return res.status(500).json({ error: "Quote unavailable" });
  res.json(quote);
});

module.exports = router;