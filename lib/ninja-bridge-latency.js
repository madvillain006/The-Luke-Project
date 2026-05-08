"use strict";

function parseLukeIdTimestamp(id) {
  const match = String(id || "").match(/^luke-long-(\d{10,13})-/);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  const millis = raw > 1_000_000_000_000 ? raw : raw * 1000;
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseNinjaLocalTimestamp(line) {
  const match = String(line || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{3})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millis] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second, millis);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

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

function normalizeBridgeEvent(event) {
  const receivedAt = event.received_at || event.ts || event.timestamp || null;
  const eventType = String(event.type || "").toLowerCase();
  const canInferFromLongId = !eventType.includes("cancel") && !eventType.includes("ping");
  const createdAt = event.created_at || (canInferFromLongId ? parseLukeIdTimestamp(event.id) : null);
  const sourceToLukeMs = Number.isFinite(event.source_to_luke_ms)
    ? event.source_to_luke_ms
    : diffMs(createdAt, receivedAt);
  return {
    ...event,
    created_at: createdAt,
    received_at: receivedAt,
    source_to_luke_ms: sourceToLukeMs,
  };
}

function parseBridgeEvents(text) {
  return parseJsonl(text)
    .filter((event) => event.id)
    .map(normalizeBridgeEvent);
}

function parseNinjaLogEvents(text, file = "") {
  const events = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const ts = parseNinjaLocalTimestamp(line);
    if (!ts) continue;

    let match = line.match(/LUKE SIM LONG ([^ ]+)/);
    if (match) {
      events.push({ ts, type: "ninja_long_submitted", id: match[1], file, line });
      continue;
    }

    match = line.match(/LUKE SIM CANCEL ([^ ]+)/);
    if (match) {
      events.push({ ts, type: "ninja_cancel_seen", id: match[1], file, line });
      continue;
    }

    match = line.match(/LUKE BRIDGE REJECT ([^:]+): (.+)$/);
    if (match) {
      events.push({ ts, type: "ninja_reject", id: match[1], reason: match[2], file, line });
      continue;
    }

    match = line.match(/LUKE BRIDGE PING ([^ ]+)/);
    if (match) {
      events.push({ ts, type: "ninja_ping_seen", id: match[1], file, line });
    }
  }
  return events;
}

function diffMs(fromIso, toIso) {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return to - from;
}

function percentile(values, pct) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const index = Math.min(clean.length - 1, Math.max(0, Math.ceil((pct / 100) * clean.length) - 1));
  return clean[index];
}

function latencyStats(values) {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) {
    return { count: 0, min: null, median: null, p90: null, max: null };
  }
  return {
    count: clean.length,
    min: Math.min(...clean),
    median: percentile(clean, 50),
    p90: percentile(clean, 90),
    max: Math.max(...clean),
  };
}

function bridgeEventKind(event) {
  const text = String(event?.type || "").toLowerCase();
  if (text.includes("cancel")) return "cancel";
  if (text.includes("ping")) return "ping";
  if (text.includes("reject")) return "reject";
  if (text.includes("long")) return "long";
  return "other";
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([id, group]) => ({
      id,
      count: group.length,
      first_at: group.map((item) => item.received_at || item.ts || item.created_at || null).filter(Boolean).sort()[0] || null,
      last_at: group.map((item) => item.received_at || item.ts || item.created_at || null).filter(Boolean).sort().at(-1) || null,
    }))
    .sort((a, b) => b.count - a.count || String(a.id).localeCompare(String(b.id)));
}

function dedupeNinjaEvents(events) {
  const seen = new Set();
  const unique = [];
  for (const event of events || []) {
    const key = [
      event.type || "",
      event.id || "",
      event.ts || "",
      event.reason || "",
      event.line || "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }
  return unique;
}

function preferredNinjaTypes(bridgeType) {
  const text = String(bridgeType || "").toLowerCase();
  if (text.includes("cancel")) return ["ninja_cancel_seen"];
  if (text.includes("ping")) return ["ninja_ping_seen"];
  if (text.includes("reject")) return ["ninja_reject"];
  return ["ninja_long_submitted", "ninja_reject"];
}

function chooseMatchingNinjaEvent(bridgeEvent, ninjaEvents) {
  const ordered = ninjaEvents
    .filter((event) => !bridgeEvent.received_at || !event.ts || diffMs(bridgeEvent.received_at, event.ts) >= -1000)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const preferred = preferredNinjaTypes(bridgeEvent.type);
  return ordered.find((event) => preferred.includes(event.type)) || ordered[0] || null;
}

function latestBefore(events, iso) {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return null;
  return events
    .filter((event) => Number.isFinite(Date.parse(event.received_at || event.ts)) && Date.parse(event.received_at || event.ts) <= target)
    .sort((a, b) => Date.parse(a.received_at || a.ts) - Date.parse(b.received_at || b.ts))
    .at(-1) || null;
}

function summarizeDuplicateLongs(bridgeEvents, ninjaEvents) {
  const bridgeLongs = bridgeEvents.filter((event) => bridgeEventKind(event) === "long");
  const ninjaLongs = ninjaEvents.filter((event) => event.type === "ninja_long_submitted");
  return {
    bridge: duplicateGroups(bridgeLongs, (event) => event.id),
    ninja: duplicateGroups(ninjaLongs, (event) => event.id),
  };
}

function summarizeCancelTiming(rows, bridgeEvents, ninjaEvents) {
  const longBridgeEvents = bridgeEvents.filter((event) => bridgeEventKind(event) === "long");
  const ninjaLongEvents = ninjaEvents.filter((event) => event.type === "ninja_long_submitted");

  return rows
    .filter((row) => bridgeEventKind(row) === "cancel")
    .map((row) => {
      const priorLong = latestBefore(
        longBridgeEvents.filter((event) => event.id === row.id),
        row.received_at,
      );
      const priorNinjaLong = latestBefore(
        ninjaLongEvents.filter((event) => event.id === row.id),
        row.received_at,
      );
      return {
        id: row.id,
        cancel_received_at: row.received_at,
        long_received_at: priorLong?.received_at || null,
        ninja_long_at: priorNinjaLong?.ts || null,
        ninja_cancel_at: row.ninja_type === "ninja_cancel_seen" ? row.ninja_at : null,
        cancel_after_long_ms: priorLong ? diffMs(priorLong.received_at, row.received_at) : null,
        cancel_after_ninja_long_ms: priorNinjaLong ? diffMs(priorNinjaLong.ts, row.received_at) : null,
        luke_to_ninja_cancel_ms: row.ninja_type === "ninja_cancel_seen" ? row.luke_to_ninja_ms : null,
      };
    });
}

function summarizePortReadiness(parity, stats) {
  const blockers = [];
  if (parity.counts.no_ninja_match > 0) blockers.push("no_ninja_match");
  if (parity.duplicate_longs.bridge.length > 0) blockers.push("duplicate_bridge_longs");
  if (parity.duplicate_longs.ninja.length > 0) blockers.push("duplicate_ninja_longs");
  const missingCancelMatches = parity.cancel_timing.filter((row) => row.luke_to_ninja_cancel_ms === null).length;
  if (missingCancelMatches > 0) blockers.push("cancel_without_ninja_match");

  return {
    status: blockers.length === 0 ? "clean" : "review",
    blockers,
    matched_ratio: parity.counts.bridge_events === 0
      ? null
      : Number((parity.counts.matched / parity.counts.bridge_events).toFixed(4)),
    source_to_luke_p90_ms: stats.source_to_luke_ms.p90,
    luke_to_ninja_p90_ms: stats.luke_to_ninja_ms.p90,
  };
}

function summarizeLatency(bridgeEvents, ninjaEvents) {
  ninjaEvents = dedupeNinjaEvents(ninjaEvents);
  const ninjaById = new Map();
  for (const event of ninjaEvents) {
    if (!ninjaById.has(event.id)) ninjaById.set(event.id, []);
    ninjaById.get(event.id).push(event);
  }

  const rows = bridgeEvents.map((event) => {
    const matchingNinja = (ninjaById.get(event.id) || [])
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const firstNinja = chooseMatchingNinjaEvent(event, matchingNinja);
    return {
      id: event.id,
      type: event.type,
      symbol: event.symbol,
      entry: event.entry,
      kind: bridgeEventKind(event),
      created_at: event.created_at,
      received_at: event.received_at,
      source_to_luke_ms: event.source_to_luke_ms,
      ninja_at: firstNinja?.ts || null,
      ninja_type: firstNinja?.type || null,
      ninja_reason: firstNinja?.reason || null,
      luke_to_ninja_ms: firstNinja ? diffMs(event.received_at, firstNinja.ts) : null,
    };
  });

  const noNinjaMatch = rows
    .filter((row) => !row.ninja_at)
    .map((row) => ({
      id: row.id,
      type: row.type,
      kind: row.kind,
      received_at: row.received_at,
      source_to_luke_ms: row.source_to_luke_ms,
    }));

  const stats = {
    source_to_luke_ms: latencyStats(rows.map((row) => row.source_to_luke_ms)),
    luke_to_ninja_ms: latencyStats(rows.map((row) => row.luke_to_ninja_ms)),
  };
  const parity = {
    counts: {
      bridge_events: bridgeEvents.length,
      ninja_events: ninjaEvents.length,
      bridge_longs: rows.filter((row) => row.kind === "long").length,
      bridge_cancels: rows.filter((row) => row.kind === "cancel").length,
      matched: rows.filter((row) => row.ninja_at).length,
      no_ninja_match: noNinjaMatch.length,
    },
    duplicate_longs: summarizeDuplicateLongs(bridgeEvents, ninjaEvents),
    cancel_timing: summarizeCancelTiming(rows, bridgeEvents, ninjaEvents),
    no_ninja_match: noNinjaMatch,
  };

  return {
    rows,
    stats,
    parity: {
      ...parity,
      readiness: summarizePortReadiness(parity, stats),
    },
  };
}

module.exports = {
  bridgeEventKind,
  dedupeNinjaEvents,
  diffMs,
  latencyStats,
  normalizeBridgeEvent,
  parseBridgeEvents,
  parseLukeIdTimestamp,
  parseNinjaLocalTimestamp,
  parseNinjaLogEvents,
  preferredNinjaTypes,
  summarizeCancelTiming,
  summarizeDuplicateLongs,
  summarizeLatency,
  summarizePortReadiness,
};
