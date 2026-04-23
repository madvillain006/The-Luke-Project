const fs = require("fs");
const { client, HISTORY_FILE } = require("./common");

const FINNHUB_KEY = process.env.FINNHUB_KEY;
if (!FINNHUB_KEY) {
  // Price fetching will return null — signals will degrade gracefully
  console.warn("[signals] FINNHUB_KEY not set — price fetching disabled");
}
const ALLOWED_TICKERS = new Set(["NQ", "MNQ", "ES", "MES"]);
const INTRADAY_REJECT_PATTERNS = [
  /long-?term/i,
  /multi-?month/i,
  /multi-?year/i,
  /macro/i,
  /not a day trade/i,
  /positional/i,
  /contingency/i,
  /worst-?case/i,
  /projection/i,
  /through 202[0-9]/i,
  /202[0-9]\+/i,
  /lotto/i
];
const LEVEL_LINE_PATTERN = /(LEVEL|ENTRY|STOP|TARGET):\s*([^\n]+)/i;
const NUMBER_PATTERN = /-?\d+(?:,\d{3})*(?:\.\d+)?/g;
const PREMARKET_WINDOW_MINUTES = 12 * 60;

async function getPrice(finnhubSymbol, yahooSymbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (d.c && d.c > 0) return d.c;
  } catch {}
  if (yahooSymbol) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000)
      });
      const d = await r.json();
      const price = d.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) return price;
    } catch {}
  }
  return null;
}

function getFuturesPrice(ticker) {
  if (ticker === "MNQ" || ticker === "NQ") return getPrice("NQ1!", "NQ=F");
  if (ticker === "MES" || ticker === "ES") return getPrice("ES1!", "ES=F");
  return getPrice(ticker, null);
}

function normalizeTicker(ticker) {
  const raw = String(ticker || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (raw === "MNQ" || raw === "NQ" || raw === "NDX") return "MNQ";
  if (raw === "MES" || raw === "ES" || raw === "SPX" || raw === "SPY") return "MES";
  return raw;
}

function parseFirstNumber(text) {
  const matches = String(text || "").match(NUMBER_PATTERN);
  if (!matches || matches.length === 0) return null;
  const n = Number(matches[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseNumbers(text) {
  const matches = String(text || "").match(NUMBER_PATTERN) || [];
  return matches
    .map(v => Number(v.replace(/,/g, "")))
    .filter(v => Number.isFinite(v));
}

function splitSignalBlocks(text) {
  return String(text || "")
    .split(/\n---+\n|\n(?=TICKER:)/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseSignalBlock(block, source) {
  const lines = String(block || "").split("\n");
  const map = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z_ ]+):\s*(.+)$/i);
    if (!match) continue;
    const key = match[1].trim().toUpperCase().replace(/\s+/g, "_");
    map[key] = match[2].trim();
  }

  const rawTicker = map.TICKER || "";
  const ticker = normalizeTicker(rawTicker);
  const direction = String(map.DIRECTION || "").toUpperCase().includes("SHORT") ? "SHORT"
    : String(map.DIRECTION || "").toUpperCase().includes("LONG") ? "LONG"
    : null;
  const note = [map.NOTE, map.SUMMARY, block].filter(Boolean).join(" | ");
  const conviction = String(map.CONVICTION || "").toUpperCase();
  const level = parseFirstNumber(map.LEVEL);
  const entry = parseFirstNumber(map.ENTRY) ?? level;
  const stop = parseFirstNumber(map.STOP);
  const target = parseFirstNumber(map.TARGET);

  return {
    source,
    raw: block,
    raw_ticker: rawTicker,
    ticker,
    direction,
    entry,
    stop,
    target,
    conviction,
    note
  };
}

function hasIntradayShape(candidate) {
  if (!candidate.direction) return false;
  if (!ALLOWED_TICKERS.has(candidate.ticker)) return false;
  if (INTRADAY_REJECT_PATTERNS.some(pattern => pattern.test(candidate.note || ""))) return false;
  if (!LEVEL_LINE_PATTERN.test(candidate.raw || "")) return false;
  return candidate.entry !== null;
}

function levelsMakeSense(candidate, livePrice) {
  if (!candidate || candidate.entry === null || livePrice === null) {
    return { ok: false, reason: "missing_entry_or_price" };
  }

  const drift = Math.abs(candidate.entry - livePrice);
  const maxDrift = candidate.ticker === "MNQ" ? 180 : 45;
  if (drift > maxDrift) {
    return { ok: false, reason: `entry_too_far_from_live:${drift.toFixed(2)}` };
  }

  if (candidate.stop !== null) {
    if (candidate.direction === "LONG" && candidate.stop >= candidate.entry) {
      return { ok: false, reason: "stop_not_below_entry" };
    }
    if (candidate.direction === "SHORT" && candidate.stop <= candidate.entry) {
      return { ok: false, reason: "stop_not_above_entry" };
    }
  }

  if (candidate.target !== null) {
    if (candidate.direction === "LONG" && candidate.target <= candidate.entry) {
      return { ok: false, reason: "target_not_above_entry" };
    }
    if (candidate.direction === "SHORT" && candidate.target >= candidate.entry) {
      return { ok: false, reason: "target_not_below_entry" };
    }
  }

  if (candidate.stop !== null && candidate.target !== null) {
    const risk = Math.abs(candidate.entry - candidate.stop);
    const reward = Math.abs(candidate.target - candidate.entry);
    if (risk === 0) return { ok: false, reason: "zero_risk_distance" };
    if (reward / risk < 1.2) return { ok: false, reason: "rr_below_1_2" };
  }

  return { ok: true };
}

function loadPreMarketContext() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return {};
    const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
    const cutoff = Date.now() - PREMARKET_WINDOW_MINUTES * 60 * 1000;
    const out = {};

    for (const line of lines.slice(-120)) {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.date).getTime() < cutoff) continue;
        if (entry.source !== "pre-market-scan") continue;
        if (!["ximes-dubz", "bobby-spx-coms"].includes(entry.channel)) continue;
        const insight = entry.results?.[0]?.insights || entry.results?.[0]?.raw;
        if (insight) out[entry.channel] = insight;
      } catch {}
    }

    return out;
  } catch {
    return {};
  }
}

async function buildCandidates(source, signals) {
  const candidates = [];
  for (const text of signals) {
    for (const block of splitSignalBlocks(text)) {
      const candidate = parseSignalBlock(block, source);
      if (hasIntradayShape(candidate)) candidates.push(candidate);
    }
  }
  return candidates;
}

const BOBBY_CONTEXT_FILE = require("path").join(require("path").dirname(HISTORY_FILE), "bobby-context.jsonl");

function loadRecentSignals(minutesBack = 120) {
  try {
    const cutoff = Date.now() - minutesBack * 60 * 1000;
    const ximes = [];
    const bobby = [];

    if (fs.existsSync(HISTORY_FILE)) {
      const lines = fs.readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
      for (const line of lines.slice(-400)) {
        try {
          const entry = JSON.parse(line);
          if (new Date(entry.date).getTime() < cutoff) continue;
          if (entry.source !== "intraday-scraper" && entry.source !== "historical-export") continue;
          if (entry.channel !== "ximes-dubz") continue;
          if (entry.signal_type !== "LIVE_ENTRY" && entry.signal_type !== "PRE_MARKET_SETUP") continue;
          ximes.push(entry);
        } catch {}
      }
    }

    if (fs.existsSync(BOBBY_CONTEXT_FILE)) {
      const lines = fs.readFileSync(BOBBY_CONTEXT_FILE, "utf8").split("\n").filter(Boolean);
      for (const line of lines.slice(-200)) {
        try {
          const entry = JSON.parse(line);
          if (new Date(entry.date).getTime() < cutoff) continue;
          bobby.push(entry);
        } catch {}
      }
    }

    return { ximes, bobby };
  } catch {
    return { ximes: [], bobby: [] };
  }
}

function parsedXimesToCandidate(sig) {
  const ticker = normalizeTicker(sig.ticker || "");
  const direction = sig.direction || null;
  const entry = sig.strike || sig.entry_price || null;
  const stop = sig.cut || null;
  const target = sig.target || null;
  const conviction = sig.confidence || "MEDIUM";
  const note = sig.raw || "";
  return { source: "ximes", raw: sig.raw || "", raw_ticker: sig.ticker || "", ticker, direction, entry, stop, target, conviction, note };
}

async function scoreSignals(ximes, bobby, mode = "live") {
  if (ximes.length === 0) return { execute: false, reason: "No ximes signals in window" };
  if (bobby.length === 0) return { execute: false, reason: "No bobby context - single source not enough" };
  const paperMode = mode === "paper" || mode === "shadow";

  try {
    const [nqPrice, esPrice] = await Promise.all([
      getFuturesPrice("MNQ"),
      getFuturesPrice("MES")
    ]);

    const livePrices = { MNQ: nqPrice, MES: esPrice };

    const ximesCandidates = ximes.map(parsedXimesToCandidate).filter(hasIntradayShape);
    if (ximesCandidates.length === 0) {
      return { execute: false, reason: "No ximes candidates passed intraday filters" };
    }

    const vettedXimes = ximesCandidates
      .map(candidate => ({
        candidate,
        sanity: paperMode ? { ok: true } : levelsMakeSense(candidate, livePrices[candidate.ticker] ?? null)
      }))
      .filter(item => item.sanity.ok);

    if (vettedXimes.length === 0) {
      return { execute: false, reason: "Ximes candidates failed sanity checks against live price" };
    }

    const bobbyContext = bobby.map(b =>
      `king_nodes: ${(b.king_nodes || []).join(", ") || "none"} | support: ${(b.support || []).join(", ") || "none"} | resistance: ${(b.resistance || []).join(", ") || "none"} | bias: ${b.bias || "NEUTRAL"}`
    ).join("\n");

    const preMarket = loadPreMarketContext();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 420,
      messages: [{
        role: "user",
        content: `You are the signal scoring engine for a supervised futures trading assistant.

RULES:
- Only approve if ximes signal aligns with bobby structural context (same direction, level near bobby node).
- Reject macro, long-term, contingency, lotto, or vague commentary.
- Reject anything that does not make sense as a same-session futures trade.
- Bobby is structural context, not a standalone trigger.
- Prefer no trade over forced trade.

LIVE PRICES:
- MNQ: ${nqPrice ?? "unknown"}
- MES: ${esPrice ?? "unknown"}

PRE-MARKET CONTEXT:
- ximes: ${preMarket["ximes-dubz"] || "none"}
- bobby: ${preMarket["bobby-spx-coms"] || "none"}

XIMES SIGNALS:
${vettedXimes.map(({ candidate }) =>
  `- ${candidate.ticker} ${candidate.direction} entry ${candidate.entry} stop ${candidate.stop ?? "?"} target ${candidate.target ?? "?"} conviction ${candidate.conviction || "?"} | ${candidate.note.slice(0, 220)}`
).join("\n")}

BOBBY CONTEXT (structural levels):
${bobbyContext}

Respond with JSON only, no other text:
{"execute":true/false,"ticker":"MNQ","direction":"LONG","entry":0,"stop":0,"target":0,"confidence":"LOW|MEDIUM|HIGH","reason":"one sentence","why_not":[]}`
      }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { execute: false, reason: "Signal parse failed" };
    const result = JSON.parse(jsonMatch[0]);
    if (!result.execute) return result;
    if (!result.entry || !result.stop || !result.target) return { execute: false, reason: "Signal missing entry/stop/target" };
    if (result.direction === "LONG" && result.stop >= result.entry) return { execute: false, reason: "Invalid: stop above entry for LONG" };
    if (result.direction === "SHORT" && result.stop <= result.entry) return { execute: false, reason: "Invalid: stop below entry for SHORT" };
    result.ticker = normalizeTicker(result.ticker || "MNQ");
    if (!paperMode) {
      const livePrice = livePrices[result.ticker] ?? null;
      const sanity = levelsMakeSense(result, livePrice);
      if (!sanity.ok) return { execute: false, reason: "Post-score sanity reject: " + sanity.reason };
    }
    return result;
  } catch (err) {
    return { execute: false, reason: "Scoring error: " + err.message };
  }
}

module.exports = {
  getFuturesPrice,
  loadRecentSignals,
  scoreSignals,
};
