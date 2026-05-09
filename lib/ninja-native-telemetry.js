"use strict";

function parseJsonl(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeNativeEvent(event) {
  const note = event.note || "";
  return {
    ts: event.ts || null,
    source: event.source || "ninja-native-shadow",
    event: String(event.event || "").toUpperCase(),
    signal_id: event.signal_id || "",
    instrument: event.instrument || "",
    bar: Number.isFinite(event.bar) ? event.bar : null,
    bar_time: event.bar_time || null,
    price: finiteOrNull(event.price),
    level: finiteOrNull(event.level),
    entry: finiteOrNull(event.entry),
    stop: finiteOrNull(event.stop),
    tp1: finiteOrNull(event.tp1),
    tp2: finiteOrNull(event.tp2),
    ltf_ok: event.ltf_ok === true,
    points: finiteOrNull(noteValue(note, "points")),
    contracts: finiteOrNull(noteValue(note, "contracts")),
    gross: finiteOrNull(noteValue(note, "gross")),
    cost: finiteOrNull(noteValue(note, "cost")),
    net: finiteOrNull(noteValue(note, "net")),
    total_points: finiteOrNull(noteValue(note, "total_points")),
    total_net: finiteOrNull(noteValue(note, "total_net")),
    level_count: finiteOrNull(noteValue(note, "count")),
    note,
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function noteValue(note, key) {
  const match = String(note || "").match(new RegExp(`(?:^|\\s)${key}=([-+]?\\d+(?:\\.\\d+)?)`));
  return match ? match[1] : null;
}

function parseNativeTelemetry(text) {
  return parseJsonl(text).map(normalizeNativeEvent);
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items || []) {
    const key = keyFn(item) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function missingGeometry(event) {
  return ["level", "entry", "stop", "tp1", "tp2"].filter((field) => !Number.isFinite(event[field]));
}

function summarizeNativeTelemetry(events) {
  const rows = [...(events || [])].sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  const longs = rows.filter((event) => event.event === "LONG");
  const cancels = rows.filter((event) => event.event === "CANCEL");
  const outcomes = rows.filter((event) => /^(TP1|TP1_FIRST|TP2_FIRST|TP1_THEN_STOP|STOP_FIRST|MIXED_STOP_FIRST)$/.test(event.event));
  const readyEvents = rows.filter((event) => event.event === "ENGINE_READY");
  const levelLoads = rows.filter((event) => event.event === "LEVELS_LOADED");
  const lastLevelLoad = levelLoads.at(-1) || null;
  const geometryIssues = rows
    .filter((event) => ["LONG", "CANCEL", "TP1", "TP1_FIRST", "TP2_FIRST", "TP1_THEN_STOP", "STOP_FIRST", "MIXED_STOP_FIRST"].includes(event.event))
    .map((event) => ({ event, missing: missingGeometry(event) }))
    .filter((row) => row.missing.length > 0);

  const blockers = [];
  if (geometryIssues.length > 0) blockers.push("missing_geometry");
  if (longs.some((event) => !event.signal_id)) blockers.push("long_without_signal_id");
  if (rows.some((event) => event.source !== "ninja-native-shadow")) blockers.push("unexpected_source");
  const hasLifecycleEvents = readyEvents.length > 0 || levelLoads.length > 0 || rows.some((event) => event.event === "ENGINE_TERMINATED");
  if (hasLifecycleEvents && readyEvents.length === 0) blockers.push("engine_never_ready");
  if (lastLevelLoad && lastLevelLoad.level_count === 0) blockers.push("latest_level_load_zero");
  if (rows.length > 0 && longs.length === 0 && cancels.length === 0) blockers.push("no_native_long_cancel_events");

  return {
    counts: {
      events: rows.length,
      longs: longs.length,
      cancels: cancels.length,
      outcomes: outcomes.length,
      by_event: countBy(rows, (event) => event.event),
    },
    last_level_load: lastLevelLoad,
    first_ts: rows[0]?.ts || null,
    last_ts: rows.at(-1)?.ts || null,
    last_long: longs.at(-1) || null,
    last_cancel: cancels.at(-1) || null,
    last_outcome: outcomes.at(-1) || null,
    geometry_issues: geometryIssues.map((row) => ({
      event: row.event.event,
      signal_id: row.event.signal_id,
      ts: row.event.ts,
      missing: row.missing,
    })),
    readiness: {
      status: blockers.length === 0 ? "clean" : "review",
      blockers,
    },
    recent: rows.slice(-12),
  };
}

module.exports = {
  normalizeNativeEvent,
  noteValue,
  parseNativeTelemetry,
  summarizeNativeTelemetry,
};
