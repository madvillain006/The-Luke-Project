"use strict";

const crypto = require("crypto");
const path = require("path");
const { appendJsonl, readJsonFile, writeJsonAtomic } = require("../state/lib");

const ROOT = path.join(__dirname, "..");
const BRIDGE_DIR = path.join(ROOT, "data", "ninjatrader");
const LATEST_SIGNAL_FILE = process.env.LUKE_NINJA_BRIDGE_FILE
  ? path.resolve(process.env.LUKE_NINJA_BRIDGE_FILE)
  : path.join(BRIDGE_DIR, "latest-luke-signal.json");
const BRIDGE_EVENTS_FILE = process.env.LUKE_NINJA_BRIDGE_EVENTS_FILE
  ? path.resolve(process.env.LUKE_NINJA_BRIDGE_EVENTS_FILE)
  : path.join(ROOT, "state", "events", "ninjatrader-bridge.jsonl");
const DEFAULT_MAX_BRIDGE_QTY = 2;
const CANCEL_TTL_MS = 10 * 60 * 1000;
const recentCancelledIds = new Map();

function asObject(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
    return { message: input };
  }
  return {};
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numberField(value, name) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${name} must be numeric`);
  }
  return numeric;
}

function integerField(value, name, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return numeric;
}

function normalizedText(value, fallback, caseMode = "upper") {
  const raw = firstDefined(value, fallback);
  const text = String(raw).trim();
  const safe = (text || fallback).replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 80);
  return caseMode === "lower" ? safe.toLowerCase() : safe.toUpperCase();
}

function maxBridgeQty() {
  const configured = Number(process.env.LUKE_NINJA_MAX_QTY || DEFAULT_MAX_BRIDGE_QTY);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_BRIDGE_QTY;
}

function normalizeTimestamp(value, fallbackDate) {
  const fallback = fallbackDate.toISOString();
  if (value === undefined || value === null || value === "") return fallback;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();

  const text = String(value).trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1_000_000_000_000 ? numeric : numeric > 1_000_000_000 ? numeric * 1000 : NaN;
    if (Number.isFinite(millis)) {
      const date = new Date(millis);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return fallback;
}

function sanitizeRaw(input) {
  const body = asObject(input);
  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    if (/token|secret|authorization/i.test(key)) continue;
    sanitized[key] = key === "signal" && value && typeof value === "object" && !Array.isArray(value)
      ? sanitizeRaw(value)
      : value;
  }
  return sanitized;
}

function pruneRecentCancelledIds(nowMs) {
  for (const [id, cancelledAt] of recentCancelledIds.entries()) {
    if (nowMs - cancelledAt > CANCEL_TTL_MS) recentCancelledIds.delete(id);
  }
}

function rememberCancelledId(id, now) {
  pruneRecentCancelledIds(now.getTime());
  recentCancelledIds.set(id, now.getTime());
}

function wasRecentlyCancelled(id, now) {
  pruneRecentCancelledIds(now.getTime());
  if (recentCancelledIds.has(id)) return true;

  const latest = readJsonFile(LATEST_SIGNAL_FILE, null);
  return latest
    && latest.signal
    && latest.signal.type === "LUKE_CANCEL"
    && latest.signal.id === id;
}

function normalizeLukeLongPayload(input, now = new Date()) {
  const body = asObject(input);
  const nested = asObject(body.signal);
  const source = { ...body, ...nested };
  const receivedAt = now.toISOString();
  const side = String(firstDefined(source.side, source.direction, "LONG")).toUpperCase();
  const type = String(firstDefined(source.type, source.signal_type, "LUKE_LONG")).toUpperCase();

  if (side !== "LONG") {
    throw new Error(`only LONG signals are accepted, got ${side}`);
  }
  if (type && !/LUKE|LONG/.test(type)) {
    throw new Error(`unsupported signal type ${type}`);
  }

  const entry = numberField(firstDefined(source.entry, source.entry_price, source.e), "entry");
  const stop = numberField(firstDefined(source.stop, source.stop_price, source.s), "stop");
  const tp1 = numberField(firstDefined(source.tp1, source.t1, source.target1), "tp1");
  const tp2 = numberField(firstDefined(source.tp2, source.t2, source.target2, source.target), "tp2");

  if (!(stop < entry)) throw new Error("stop must be below entry for LONG");
  if (!(tp1 > entry)) throw new Error("tp1 must be above entry for LONG");
  if (!(tp2 >= tp1)) throw new Error("tp2 must be at or above tp1 for LONG");

  const createdAt = normalizeTimestamp(firstDefined(
    source.created_at,
    source.fired_at,
    source.fired_at_ms,
    source.timestamp,
    source.time,
  ), now);
  const symbol = String(firstDefined(source.symbol, source.ticker, source.instrument, "ES")).toUpperCase();
  const qty = integerField(firstDefined(source.qty, source.quantity, source.contracts), "qty", 1);
  const maxQty = maxBridgeQty();
  if (qty > maxQty) {
    throw new Error(`qty ${qty} exceeds bridge max ${maxQty}`);
  }
  const id = String(firstDefined(
    source.id,
    source.signal_id,
    `luke-long-${createdAt}-${symbol}-${entry}`,
  ));

  return {
    id,
    type: "LUKE_LONG",
    side: "LONG",
    symbol,
    class: normalizedText(firstDefined(
      source.class,
      source.signal_class,
      source.order_class,
      source.strategy_class,
    ), "SCALP_VALID"),
    execution_model: normalizedText(firstDefined(
      source.execution_model,
      source.executionModel,
      source.order_model,
      source.model,
    ), "confirmed_retest_limit", "lower"),
    entry,
    stop,
    tp1,
    tp2,
    qty,
    created_at: createdAt,
    received_at: receivedAt,
    source: String(firstDefined(source.source, "tradingview")),
    bridge_nonce: crypto.randomUUID(),
  };
}

function normalizeLukeCancelPayload(input, now = new Date()) {
  const body = asObject(input);
  const nested = asObject(body.signal);
  const source = { ...body, ...nested };
  const receivedAt = now.toISOString();
  const createdAt = normalizeTimestamp(firstDefined(
    source.created_at,
    source.fired_at,
    source.fired_at_ms,
    source.timestamp,
    source.time,
  ), now);
  const rawTargetId = firstDefined(
    source.target_id,
    source.original_id,
    source.cancel_target_id,
    source.id,
  );
  const targetId = rawTargetId === undefined ? "" : String(rawTargetId);
  if (!targetId) {
    throw new Error("cancel command must include id or target_id");
  }

  return {
    id: targetId,
    type: "LUKE_CANCEL",
    side: "CANCEL",
    symbol: String(firstDefined(source.symbol, source.ticker, source.instrument, "ES")).toUpperCase(),
    created_at: createdAt,
    received_at: receivedAt,
    reason: String(firstDefined(source.reason, "live_cancel")),
    source: String(firstDefined(source.source, "tradingview")),
    bridge_nonce: crypto.randomUUID(),
  };
}

function normalizeLukePingPayload(input, now = new Date()) {
  const body = asObject(input);
  const nested = asObject(body.signal);
  const source = { ...body, ...nested };
  const receivedAt = now.toISOString();
  const createdAt = normalizeTimestamp(firstDefined(
    source.created_at,
    source.fired_at,
    source.fired_at_ms,
    source.timestamp,
    source.time,
  ), now);
  const rawId = firstDefined(source.id, source.ping_id);
  const id = rawId === undefined ? `ping-${now.getTime()}` : String(rawId);

  return {
    id,
    type: "LUKE_PING",
    side: "PING",
    symbol: String(firstDefined(source.symbol, source.ticker, source.instrument, "ES")).toUpperCase(),
    created_at: createdAt,
    received_at: receivedAt,
    reason: String(firstDefined(source.reason, "bridge_ping")),
    source: String(firstDefined(source.source, "luke-bridge-doctor")),
    bridge_nonce: crypto.randomUUID(),
  };
}

function normalizeLukeBridgePayload(input, now = new Date()) {
  const body = asObject(input);
  const nested = asObject(body.signal);
  const source = { ...body, ...nested };
  const type = String(firstDefined(source.type, source.command, source.cmd, source.signal_type, "LUKE_LONG")).toUpperCase();
  const side = String(firstDefined(source.side, source.direction, "")).toUpperCase();
  const action = String(firstDefined(source.action, "")).toUpperCase();

  if (/PING|HEALTH/.test(type) || side === "PING" || action === "PING") {
    return normalizeLukePingPayload(source, now);
  }

  if (/CANCEL|INVALIDATE|FLATTEN|EXIT/.test(type) || side === "CANCEL" || action === "CANCEL") {
    return normalizeLukeCancelPayload(source, now);
  }

  return normalizeLukeLongPayload(source, now);
}

function saveLukeBridgeCommand(input, options = {}) {
  const now = options.now || new Date();
  const signal = normalizeLukeBridgePayload(input, now);
  if (signal.type === "LUKE_LONG" && wasRecentlyCancelled(signal.id, now)) {
    throw new Error(`signal ${signal.id} was already cancelled`);
  }
  if (signal.type === "LUKE_CANCEL") {
    rememberCancelledId(signal.id, now);
  }

  const payload = {
    ok: true,
    bridge_version: 1,
    written_at: signal.received_at,
    signal,
    raw: sanitizeRaw(input),
    safety: {
      sim_bridge_only: true,
      live_broker_execution: false,
      consumer: "NinjaTrader strategy polls this file and defaults to SIM-only",
      max_qty: maxBridgeQty(),
    },
  };
  writeJsonAtomic(LATEST_SIGNAL_FILE, payload);
  const event = {
    ts: signal.received_at,
    type: signal.type === "LUKE_CANCEL" ? "luke_cancel_signal_saved" : signal.type === "LUKE_PING" ? "luke_ping_signal_saved" : "luke_long_signal_saved",
    id: signal.id,
    symbol: signal.symbol,
  };
  if (signal.type === "LUKE_LONG") {
    event.entry = signal.entry;
    event.stop = signal.stop;
    event.tp1 = signal.tp1;
    event.tp2 = signal.tp2;
    event.qty = signal.qty;
    event.class = signal.class;
    event.execution_model = signal.execution_model;
  } else {
    event.reason = signal.reason;
  }
  appendJsonl(BRIDGE_EVENTS_FILE, event);
  return payload;
}

function saveLukeLongSignal(input, options = {}) {
  return saveLukeBridgeCommand(input, options);
}

function loadLatestLukeSignal() {
  return readJsonFile(LATEST_SIGNAL_FILE, null);
}

module.exports = {
  BRIDGE_EVENTS_FILE,
  LATEST_SIGNAL_FILE,
  loadLatestLukeSignal,
  normalizeTimestamp,
  normalizeLukeBridgePayload,
  normalizeLukeCancelPayload,
  normalizeLukePingPayload,
  normalizeLukeLongPayload,
  saveLukeBridgeCommand,
  saveLukeLongSignal,
};
