// Free-LLM fallback router — no npm deps, fetch only

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { config, EVENTS_DIR, SNAPSHOTS_DIR } = require("../lib/paths");

const STATE_FILE    = path.join(SNAPSHOTS_DIR, "fallback-state.json");
const CONFIG_FILE   = config.fallback;
const CALLS_FILE    = path.join(EVENTS_DIR, "fallback-calls.jsonl");

// Features allowed in fallback mode
const ALLOWED_FEATURES = [
  "chat", "status", "log_shift", "log_luke", "ribbon", "briefing", "classify", "summarize", "non_trading"
];

// Features that require Anthropic
const BLOCKED_FEATURES = [
  "signal_score", "staged_trade_reason", "trader_profile", "research_synth",
  "vision_verify", "screen_control", "live_trade"
];

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { active: false, provider: null, entered_at: null, reason: null }; }
}

function saveState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch { return { gemini_key: "", groq_key: "", ollama_host: "http://localhost:11434" }; }
}

function isActive() { return loadState().active === true; }

function logCall(provider, model, prompt_len, reply_len) {
  try {
    fs.appendFileSync(CALLS_FILE, JSON.stringify({
      ts: new Date().toISOString(), provider, model, prompt_len, reply_len
    }) + "\n");
  } catch {}
}

async function callGemini(key, systemPrompt, userMessage) {
  const body = {
    contents: [{ role: "user", parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + userMessage }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }
  );
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  logCall("gemini", "gemini-1.5-flash", userMessage.length, text.length);
  return text;
}

async function callGroq(key, systemPrompt, userMessage) {
  const body = {
    model: "llama-3.1-8b-instant",
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userMessage }
    ],
    max_tokens: 600
  };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content || "";
  logCall("groq", "llama-3.1-8b-instant", userMessage.length, text.length);
  return text;
}

async function callOllama(host, systemPrompt, userMessage) {
  const body = {
    model: "llama3",
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userMessage }
    ],
    stream: false
  };
  const r = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const d = await r.json();
  const text = d?.message?.content || "";
  logCall("ollama", "llama3", userMessage.length, text.length);
  return text;
}

async function callFallback(systemPrompt, userMessage) {
  const config = loadConfig();
  const errors = [];

  if (config.gemini_key) {
    try { return { reply: await callGemini(config.gemini_key, systemPrompt, userMessage), provider: "gemini" }; }
    catch (e) { errors.push("gemini: " + e.message); }
  }
  if (config.groq_key) {
    try { return { reply: await callGroq(config.groq_key, systemPrompt, userMessage), provider: "groq" }; }
    catch (e) { errors.push("groq: " + e.message); }
  }
  try {
    const ollamaHost = config.ollama_host || "http://localhost:11434";
    return { reply: await callOllama(ollamaHost, systemPrompt, userMessage), provider: "ollama" };
  } catch (e) { errors.push("ollama: " + e.message); }

  throw new Error("All fallback providers failed: " + errors.join("; "));
}

// Routes
router.get("/state",  (req, res) => res.json(loadState()));
router.get("/config", (req, res) => {
  const c = loadConfig();
  // Mask keys
  res.json({ ...c, gemini_key: c.gemini_key ? "***" : "", groq_key: c.groq_key ? "***" : "" });
});

router.post("/activate", (req, res) => {
  const { reason } = req.body;
  saveState({ active: true, provider: "auto", entered_at: new Date().toISOString(), reason: reason || "manual" });
  if (global.broadcast) global.broadcast({ type: "fallback_state", active: true });
  res.json({ ok: true });
});

router.post("/deactivate", (req, res) => {
  saveState({ active: false, provider: null, entered_at: null, reason: null });
  if (global.broadcast) global.broadcast({ type: "fallback_state", active: false });
  res.json({ ok: true });
});

router.post("/chat", async (req, res) => {
  const { message, system, feature } = req.body;
  if (!isActive()) return res.status(400).json({ error: "Fallback not active" });
  if (feature && BLOCKED_FEATURES.includes(feature)) {
    return res.json({ blocked: true, message: "Paused until tokens restored. Feature requires Anthropic." });
  }
  try {
    const result = await callFallback(system || null, message);
    res.json({ reply: result.reply, provider: result.provider });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

module.exports = { router, isActive, callFallback, ALLOWED_FEATURES, BLOCKED_FEATURES };
