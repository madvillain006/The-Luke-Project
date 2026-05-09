"use strict";

const { parseBridgeEvents } = require("./ninja-bridge-latency");
const { parseNativeTelemetry } = require("./ninja-native-telemetry");

const EXECUTABLE_EVENTS = new Set(["LONG", "CANCEL"]);

function localDateKey(value, timeZone = "America/New_York") {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((out, part) => {
    out[part.type] = part.value;
    return out;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todayDateKey(timeZone = "America/New_York") {
  return localDateKey(new Date(), timeZone);
}

function normalizeIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function priceKey(value) {
  const number = finiteOrNull(value);
  return number === null ? "" : number.toFixed(2);
}

function eventKey(row) {
  if (!EXECUTABLE_EVENTS.has(row.event)) return "";
  const bar = normalizeIso(row.bar_time) || "";
  return `${row.event}|${bar}|${priceKey(row.entry)}`;
}

function eventKeyFallback(row) {
  if (!EXECUTABLE_EVENTS.has(row.event)) return "";
  return `${row.event}|${priceKey(row.entry)}`;
}

function tsMs(row) {
  const ts = row.ts || row.signal_ts;
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

const PROXIMITY_MS = 10 * 60 * 1000;

function parseEntryFromLukeId(id) {
  const match = String(id || "").match(/-([-+]?\d+(?:\.\d+)?)$/);
  return match ? finiteOrNull(match[1]) : null;
}

function bridgeKind(type) {
  const text = String(type || "").toLowerCase();
  if (text.includes("cancel")) return "CANCEL";
  if (text.includes("long")) return "LONG";
  if (text.includes("ping")) return "PING";
  return text.toUpperCase() || "UNKNOWN";
}

function normalizePineBridgeRow(event) {
  const kind = bridgeKind(event.type);
  const entry = finiteOrNull(event.entry) ?? parseEntryFromLukeId(event.id);
  return {
    source: "pine_bridge",
    event: kind,
    id: event.id || "",
    ts: normalizeIso(event.received_at || event.ts),
    signal_ts: normalizeIso(event.created_at),
    bar_time: normalizeIso(event.bar_time),
    symbol: event.symbol || "",
    entry,
    stop: finiteOrNull(event.stop),
    tp1: finiteOrNull(event.tp1),
    tp2: finiteOrNull(event.tp2),
    qty: finiteOrNull(event.qty),
    class: event.class || "",
    note: event.reason || "",
    source_to_luke_ms: finiteOrNull(event.source_to_luke_ms),
  };
}

function normalizeNativeRow(event) {
  return {
    source: "ninja_native",
    event: String(event.event || "").toUpperCase(),
    id: event.signal_id || "",
    ts: normalizeIso(event.ts),
    signal_ts: normalizeIso(event.ts),
    bar_time: normalizeIso(event.bar_time),
    symbol: event.instrument || "",
    price: finiteOrNull(event.price),
    level: finiteOrNull(event.level),
    entry: finiteOrNull(event.entry),
    stop: finiteOrNull(event.stop),
    tp1: finiteOrNull(event.tp1),
    tp2: finiteOrNull(event.tp2),
    contracts: finiteOrNull(event.contracts),
    points: finiteOrNull(event.points),
    net: finiteOrNull(event.net),
    note: event.note || "",
  };
}

function filterRowsForDate(rows, dateKey, timeZone) {
  return rows.filter((row) => {
    const key = localDateKey(row.bar_time || row.signal_ts || row.ts, timeZone);
    return key === dateKey;
  });
}

function numericMismatch(left, right, fields, tolerance = 0.01) {
  return fields.filter((field) => {
    const a = finiteOrNull(left[field]);
    const b = finiteOrNull(right[field]);
    if (a === null || b === null) return false;
    return Math.abs(a - b) > tolerance;
  });
}

function matchNativeRows(pineRows, nativeRows) {
  const nativeExecutable = nativeRows.filter((row) => EXECUTABLE_EVENTS.has(row.event));
  const nativeByKey = new Map();
  const nativeByFallback = new Map();
  for (const row of nativeExecutable) {
    const key = eventKey(row);
    if (key) {
      if (!nativeByKey.has(key)) nativeByKey.set(key, []);
      nativeByKey.get(key).push(row);
    }
    const fkey = eventKeyFallback(row);
    if (fkey) {
      if (!nativeByFallback.has(fkey)) nativeByFallback.set(fkey, []);
      nativeByFallback.get(fkey).push(row);
    }
  }

  const used = new Set();
  const rows = [];
  for (const pine of pineRows.filter((row) => EXECUTABLE_EVENTS.has(row.event))) {
    const key = eventKey(pine);
    const candidates = nativeByKey.get(key) || [];
    let native = candidates.find((row) => !used.has(row)) || null;

    if (!native) {
      const pineMs = tsMs(pine);
      if (pineMs !== null) {
        const fkey = eventKeyFallback(pine);
        const tier2 = (nativeByFallback.get(fkey) || [])
          .filter((row) => !used.has(row))
          .filter((row) => {
            const nMs = tsMs(row);
            return nMs !== null && Math.abs(nMs - pineMs) <= PROXIMITY_MS;
          })
          .sort((a, b) => Math.abs(tsMs(a) - pineMs) - Math.abs(tsMs(b) - pineMs));
        native = tier2[0] || null;
      }
    }

    if (native) used.add(native);
    const mismatches = native ? numericMismatch(pine, native, pine.event === "LONG" ? ["entry", "stop", "tp1", "tp2"] : ["entry"]) : [];
    rows.push({
      status: native ? mismatches.length > 0 ? "geometry_mismatch" : "matched" : "missing_native",
      event: pine.event,
      key,
      bar_time: pine.bar_time || native?.bar_time || null,
      entry: pine.entry ?? native?.entry ?? null,
      pine,
      native,
      mismatches,
    });
  }

  for (const native of nativeExecutable) {
    if (used.has(native)) continue;
    rows.push({
      status: "native_only",
      event: native.event,
      key: eventKey(native),
      bar_time: native.bar_time,
      entry: native.entry,
      pine: null,
      native,
      mismatches: [],
    });
  }

  return rows.sort((a, b) => String(a.bar_time || a.pine?.ts || a.native?.ts || "").localeCompare(String(b.bar_time || b.pine?.ts || b.native?.ts || "")));
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function summarizeParityRows(rows, pineRows, nativeRows) {
  const blockers = [];
  const statusCounts = countBy(rows, (row) => row.status);
  const pineExecutable = pineRows.filter((row) => EXECUTABLE_EVENTS.has(row.event));
  const nativeExecutable = nativeRows.filter((row) => EXECUTABLE_EVENTS.has(row.event));
  const missingNativeRows = rows.filter((r) => r.status === "missing_native");
  if (pineExecutable.some((r) => !r.bar_time && missingNativeRows.some((mr) => mr.pine === r)))
    blockers.push("pine_bridge_missing_bar_time");
  if (nativeExecutable.some((row) => !row.bar_time)) blockers.push("native_missing_bar_time");
  if ((statusCounts.missing_native || 0) > 0) blockers.push("pine_events_missing_native_match");
  if ((statusCounts.native_only || 0) > 0) blockers.push("native_events_without_pine_match");
  if ((statusCounts.geometry_mismatch || 0) > 0) blockers.push("geometry_mismatch");

  return {
    status: blockers.length === 0 ? "clean" : "review",
    blockers,
    counts: {
      pine_events: pineRows.length,
      pine_longs: pineRows.filter((row) => row.event === "LONG").length,
      pine_cancels: pineRows.filter((row) => row.event === "CANCEL").length,
      native_events: nativeRows.length,
      native_longs: nativeRows.filter((row) => row.event === "LONG").length,
      native_cancels: nativeRows.filter((row) => row.event === "CANCEL").length,
      matched: statusCounts.matched || 0,
      missing_native: statusCounts.missing_native || 0,
      native_only: statusCounts.native_only || 0,
      geometry_mismatch: statusCounts.geometry_mismatch || 0,
    },
  };
}

function buildParityLedger({ bridgeText = "", nativeText = "", date = todayDateKey(), timeZone = "America/New_York" } = {}) {
  const pineRows = filterRowsForDate(parseBridgeEvents(bridgeText).map(normalizePineBridgeRow), date, timeZone);
  const nativeRows = filterRowsForDate(parseNativeTelemetry(nativeText).map(normalizeNativeRow), date, timeZone);
  const parityRows = matchNativeRows(pineRows, nativeRows);
  return {
    date,
    time_zone: timeZone,
    summary: summarizeParityRows(parityRows, pineRows, nativeRows),
    pine_rows: pineRows,
    native_rows: nativeRows,
    rows: parityRows,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatNumber(value) {
  const number = finiteOrNull(value);
  return number === null ? "" : number.toFixed(2);
}

function parityRowsToCsv(rows) {
  const header = [
    "status", "event", "bar_time", "entry", "pine_ts", "native_ts", "pine_id", "native_id",
    "pine_entry", "native_entry", "pine_stop", "native_stop", "pine_tp1", "native_tp1", "pine_tp2", "native_tp2",
    "mismatches", "pine_latency_ms", "native_note",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [
      row.status,
      row.event,
      row.bar_time || "",
      formatNumber(row.entry),
      row.pine?.ts || "",
      row.native?.ts || "",
      row.pine?.id || "",
      row.native?.id || "",
      formatNumber(row.pine?.entry),
      formatNumber(row.native?.entry),
      formatNumber(row.pine?.stop),
      formatNumber(row.native?.stop),
      formatNumber(row.pine?.tp1),
      formatNumber(row.native?.tp1),
      formatNumber(row.pine?.tp2),
      formatNumber(row.native?.tp2),
      row.mismatches.join("|"),
      row.pine?.source_to_luke_ms ?? "",
      row.native?.note || "",
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function parityRowsToMarkdown(report) {
  const lines = [
    `# Luke Ninja/Pine Parity Ledger - ${report.date}`,
    "",
    `Status: ${report.summary.status}`,
    `Blockers: ${report.summary.blockers.join(", ") || "none"}`,
    "",
    "| Pine LONG | Pine CANCEL | Native LONG | Native CANCEL | Matched | Missing Native | Native Only | Geometry Mismatch |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${report.summary.counts.pine_longs} | ${report.summary.counts.pine_cancels} | ${report.summary.counts.native_longs} | ${report.summary.counts.native_cancels} | ${report.summary.counts.matched} | ${report.summary.counts.missing_native} | ${report.summary.counts.native_only} | ${report.summary.counts.geometry_mismatch} |`,
    "",
    "| Status | Event | Bar Time | Entry | Pine Time | Native Time | Mismatch |",
    "| --- | --- | --- | ---: | --- | --- | --- |",
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.status} | ${row.event} | ${row.bar_time || ""} | ${formatNumber(row.entry)} | ${row.pine?.ts || ""} | ${row.native?.ts || ""} | ${row.mismatches.join(", ") || ""} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

module.exports = {
  buildParityLedger,
  eventKey,
  localDateKey,
  normalizeNativeRow,
  normalizePineBridgeRow,
  parityRowsToCsv,
  parityRowsToMarkdown,
  todayDateKey,
};
