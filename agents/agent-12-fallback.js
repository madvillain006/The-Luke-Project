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

class FallbackFeatureBlockedError extends Error {
  constructor(feature) {
    super(`Fallback feature blocked: ${feature}`);
    this.name = "FallbackFeatureBlockedError";
    this.code = "FALLBACK_FEATURE_BLOCKED";
    this.feature = feature;
  }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { active: false, provider: null, entered_at: null, reason: null }; }
}

function saveState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

function loadConfig() {
  let fileConfig = {};
  try { fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch { fileConfig = {}; }
  const providerOrder = parseCsvList(process.env.FALLBACK_PROVIDER_ORDER || fileConfig.provider_order, ["gemini", "groq", "deepseek", "ollama"]);
  const geminiModels = parseCsvList(process.env.GEMINI_MODELS || fileConfig.gemini_models || process.env.GEMINI_MODEL || fileConfig.gemini_model, ["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  return {
    gemini_key: process.env.GEMINI_API_KEY || fileConfig.gemini_key || "",
    gemini_model: geminiModels[0],
    gemini_models: geminiModels,
    groq_key: process.env.GROQ_API_KEY || fileConfig.groq_key || "",
    groq_model: process.env.GROQ_MODEL || fileConfig.groq_model || "llama-3.3-70b-versatile",
    deepseek_key: process.env.DEEPSEEK_API_KEY || fileConfig.deepseek_key || "",
    deepseek_model: process.env.DEEPSEEK_MODEL || fileConfig.deepseek_model || "deepseek-v4-flash",
    deepseek_base_url: process.env.DEEPSEEK_BASE_URL || fileConfig.deepseek_base_url || "https://api.deepseek.com",
    ollama_host: process.env.OLLAMA_HOST || fileConfig.ollama_host || "http://localhost:11434",
    ollama_model: process.env.OLLAMA_MODEL || fileConfig.ollama_model || "llama3",
    ollama_configured: Boolean(process.env.OLLAMA_HOST || fileConfig.ollama_host),
    provider_order: providerOrder,
  };
}

function isActive() { return loadState().active === true; }

function providerReadiness(config = loadConfig()) {
  const providers = {
    gemini: {
      configured: Boolean(config.gemini_key),
      models: config.gemini_models || [],
      setup: "Set GEMINI_API_KEY.",
    },
    groq: {
      configured: Boolean(config.groq_key),
      models: [config.groq_model].filter(Boolean),
      setup: "Set GROQ_API_KEY.",
    },
    deepseek: {
      configured: Boolean(config.deepseek_key),
      models: [config.deepseek_model].filter(Boolean),
      setup: "Set DEEPSEEK_API_KEY.",
    },
    ollama: {
      configured: Boolean(config.ollama_configured),
      models: [config.ollama_model].filter(Boolean),
      setup: "Set OLLAMA_HOST and run the local Ollama model.",
    },
  };
  const order = config.provider_order || [];
  return {
    ok: order.some(provider => providers[provider]?.configured),
    provider_order: order,
    providers,
    configured_providers: order.filter(provider => providers[provider]?.configured),
    missing_providers: order.filter(provider => providers[provider] && !providers[provider].configured),
    blocked_features: BLOCKED_FEATURES,
    allowed_features: ALLOWED_FEATURES,
    secret_policy: "keys are read from env/config and never returned by readiness status",
  };
}

function logCall(provider, model, prompt_len, reply_len) {
  try {
    fs.appendFileSync(CALLS_FILE, JSON.stringify({
      ts: new Date().toISOString(), provider, model, prompt_len, reply_len
    }) + "\n");
  } catch {}
}

function safeErrorText(payload) {
  if (!payload) return "";
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[masked-google-key]")
    .replace(/gsk_[0-9A-Za-z_-]{20,}/g, "[masked-groq-key]")
    .replace(/sk-[0-9A-Za-z_-]{20,}/g, "[masked-api-key]")
    .slice(0, 240);
}

function parseCsvList(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const parsed = source
    .map(item => String(item || "").trim())
    .filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : [...fallback];
}

async function readProviderJson(response, provider) {
  const raw = await response.text();
  let parsed = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${provider} returned non-json response: ${safeErrorText(raw)}`);
    }
  }
  if (!response.ok) {
    const detail = parsed?.error?.message || parsed?.error || raw || response.statusText;
    throw new Error(`${provider} HTTP ${response.status}: ${safeErrorText(detail)}`);
  }
  return parsed || {};
}

function ensureFeatureAllowed(feature = "chat") {
  const normalized = String(feature || "chat");
  if (BLOCKED_FEATURES.includes(normalized)) {
    throw new FallbackFeatureBlockedError(normalized);
  }
  if (!ALLOWED_FEATURES.includes(normalized)) {
    throw new FallbackFeatureBlockedError(normalized);
  }
  return normalized;
}

function normalizeGeminiModel(model) {
  return String(model || "gemini-2.5-flash").replace(/^models\//, "");
}

async function callGemini(key, systemPrompt, userMessage, model = "gemini-2.5-flash") {
  const modelName = normalizeGeminiModel(model);
  const body = {
    contents: [{ role: "user", parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + userMessage }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }
  );
  const d = await readProviderJson(r, "gemini");
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text.trim()) throw new Error("gemini returned empty reply");
  logCall("gemini", modelName, userMessage.length, text.length);
  return text;
}

async function callGeminiModels(key, systemPrompt, userMessage, models) {
  const errors = [];
  for (const model of parseCsvList(models, ["gemini-2.5-flash", "gemini-2.5-flash-lite"])) {
    try {
      const reply = await callGemini(key, systemPrompt, userMessage, model);
      return { reply, model: normalizeGeminiModel(model) };
    } catch (error) {
      errors.push(normalizeGeminiModel(model) + ": " + error.message);
    }
  }
  throw new Error("gemini model ladder failed: " + errors.join("; "));
}

async function callOpenAiCompatible(provider, baseUrl, key, model, systemPrompt, userMessage, options = {}) {
  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userMessage }
    ],
    max_tokens: options.maxTokens || 600
  };
  const endpoint = String(baseUrl || "").replace(/\/+$/, "") + "/chat/completions";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 15000)
  });
  const d = await readProviderJson(r, provider);
  const text = d?.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error(provider + " returned empty reply");
  logCall(provider, model, userMessage.length, text.length);
  return text;
}

async function callGroq(key, systemPrompt, userMessage, model = "llama-3.3-70b-versatile") {
  return callOpenAiCompatible("groq", "https://api.groq.com/openai/v1", key, model, systemPrompt, userMessage);
}

async function callDeepSeek(key, systemPrompt, userMessage, model = "deepseek-v4-flash", baseUrl = "https://api.deepseek.com") {
  return callOpenAiCompatible("deepseek", baseUrl, key, model, systemPrompt, userMessage, { timeoutMs: 30000 });
}

async function callOllama(host, model, systemPrompt, userMessage) {
  const body = {
    model,
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
  const d = await readProviderJson(r, "ollama");
  const text = d?.message?.content || "";
  if (!text.trim()) throw new Error("ollama returned empty reply");
  logCall("ollama", model, userMessage.length, text.length);
  return text;
}

async function callFallback(systemPrompt, userMessage, options = {}) {
  const feature = ensureFeatureAllowed(options.feature || "chat");
  const config = loadConfig();
  const errors = [];
  const userText = String(userMessage || "");

  for (const provider of config.provider_order) {
    if (provider === "gemini") {
      if (!config.gemini_key) { errors.push("gemini: not configured"); continue; }
      try {
        const result = await callGeminiModels(config.gemini_key, systemPrompt, userText, config.gemini_models);
        return { reply: result.reply, provider: "gemini", model: result.model, feature };
      } catch (e) { errors.push("gemini: " + e.message); }
    } else if (provider === "groq") {
      if (!config.groq_key) { errors.push("groq: not configured"); continue; }
      try {
        return { reply: await callGroq(config.groq_key, systemPrompt, userText, config.groq_model), provider: "groq", model: config.groq_model, feature };
      } catch (e) { errors.push("groq: " + e.message); }
    } else if (provider === "deepseek") {
      if (!config.deepseek_key) { errors.push("deepseek: not configured"); continue; }
      try {
        return { reply: await callDeepSeek(config.deepseek_key, systemPrompt, userText, config.deepseek_model, config.deepseek_base_url), provider: "deepseek", model: config.deepseek_model, feature };
      } catch (e) { errors.push("deepseek: " + e.message); }
    } else if (provider === "ollama") {
      if (!config.ollama_configured) { errors.push("ollama: not configured"); continue; }
      try {
        return { reply: await callOllama(config.ollama_host, config.ollama_model, systemPrompt, userText), provider: "ollama", model: config.ollama_model, feature };
      } catch (e) { errors.push("ollama: " + e.message); }
    } else {
      errors.push(provider + ": unknown provider");
    }
  }

  throw new Error("All fallback providers failed: " + errors.join("; "));
}

// Routes
router.get("/state",  (req, res) => res.json(loadState()));
router.get("/config", (req, res) => {
  const c = loadConfig();
  // Mask keys
  res.json({
    ...c,
    gemini_key: c.gemini_key ? "***" : "",
    groq_key: c.groq_key ? "***" : "",
    deepseek_key: c.deepseek_key ? "***" : "",
  });
});

router.get("/readiness", (req, res) => {
  res.json(providerReadiness());
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
  try {
    ensureFeatureAllowed(feature || "chat");
  } catch (err) {
    return res.json({ blocked: true, message: "Paused until tokens restored. Feature requires Anthropic." });
  }
  try {
    const result = await callFallback(system || null, message, { feature: feature || "chat" });
    res.json({ reply: result.reply, provider: result.provider, model: result.model || null });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

module.exports = {
  router,
  isActive,
  loadConfig,
  providerReadiness,
  callFallback,
  callGemini,
  callGeminiModels,
  callGroq,
  callDeepSeek,
  callOpenAiCompatible,
  callOllama,
  readProviderJson,
  parseCsvList,
  normalizeGeminiModel,
  ensureFeatureAllowed,
  FallbackFeatureBlockedError,
  ALLOWED_FEATURES,
  BLOCKED_FEATURES,
};
