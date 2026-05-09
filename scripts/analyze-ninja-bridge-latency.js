"use strict";

const fs = require("fs");
const path = require("path");

const {
  parseBridgeEvents,
  parseNinjaLogEvents,
  summarizeLatency,
} = require("../lib/ninja-bridge-latency");

const ROOT = path.join(__dirname, "..");
const DEFAULT_BRIDGE_EVENTS = path.join(ROOT, "state", "events", "ninjatrader-bridge.jsonl");
const DEFAULT_NINJA_USER_DIR = process.env.NINJATRADER_USER_DIR || "C:\\Users\\conor\\OneDrive\\Documents\\NinjaTrader 8";

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function recentFiles(dir, prefix, limit) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.toLowerCase().startsWith(prefix) && name.toLowerCase().endsWith(".txt"))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return { full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit)
      .map((item) => item.full);
  } catch {
    return [];
  }
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value}ms` : "n/a";
}

function formatList(items, formatter, empty = "none") {
  if (!items || items.length === 0) return empty;
  return items.map(formatter).join("; ");
}

function main() {
  const bridgeFile = argValue("--bridge-file", DEFAULT_BRIDGE_EVENTS);
  const ninjaUserDir = argValue("--ninja-user-dir", DEFAULT_NINJA_USER_DIR);
  const limit = Number(argValue("--limit", "40"));
  const fileLimit = Number(argValue("--file-limit", "4"));
  const outputJson = process.argv.includes("--json");

  const bridgeEvents = parseBridgeEvents(readText(bridgeFile)).slice(-Math.max(1, limit));
  const ninjaFiles = [
    ...recentFiles(path.join(ninjaUserDir, "log"), "log.", fileLimit),
    ...recentFiles(path.join(ninjaUserDir, "trace"), "trace.", fileLimit),
  ];
  const ninjaEvents = ninjaFiles.flatMap((file) => parseNinjaLogEvents(readText(file), file));
  const summary = summarizeLatency(bridgeEvents, ninjaEvents);

  if (outputJson) {
    console.log(JSON.stringify({
      bridge_file: bridgeFile,
      ninja_user_dir: ninjaUserDir,
      ninja_files: ninjaFiles,
      ...summary,
    }, null, 2));
    return;
  }

  console.log("Luke/Ninja bridge latency summary");
  console.log(`bridge file: ${bridgeFile}`);
  console.log(`ninja files: ${ninjaFiles.length}`);
  console.log("");
  console.log("Stats");
  console.log(`source -> Luke: count=${summary.stats.source_to_luke_ms.count} median=${formatMs(summary.stats.source_to_luke_ms.median)} p90=${formatMs(summary.stats.source_to_luke_ms.p90)} max=${formatMs(summary.stats.source_to_luke_ms.max)}`);
  console.log(`Luke -> Ninja:  count=${summary.stats.luke_to_ninja_ms.count} median=${formatMs(summary.stats.luke_to_ninja_ms.median)} p90=${formatMs(summary.stats.luke_to_ninja_ms.p90)} max=${formatMs(summary.stats.luke_to_ninja_ms.max)}`);
  console.log("");
  console.log("Parity");
  console.log(`readiness=${summary.parity.readiness.status} blockers=${summary.parity.readiness.blockers.join(",") || "none"} matched=${summary.parity.counts.matched}/${summary.parity.counts.bridge_events}`);
  console.log(`duplicate LONGs bridge=${summary.parity.duplicate_longs.bridge.length} ninja=${summary.parity.duplicate_longs.ninja.length}`);
  console.log(`no_ninja_match=${summary.parity.counts.no_ninja_match}`);
  console.log(`cancel events=${summary.parity.counts.bridge_cancels}`);
  console.log("");
  console.log("Duplicate LONG detail");
  console.log(`bridge: ${formatList(summary.parity.duplicate_longs.bridge, (item) => `${item.id} x${item.count}`)}`);
  console.log(`ninja:  ${formatList(summary.parity.duplicate_longs.ninja, (item) => `${item.id} x${item.count}`)}`);
  console.log("");
  console.log("Cancel timing");
  for (const row of summary.parity.cancel_timing.slice(-8)) {
    console.log([
      row.id,
      `cancel_after_long=${formatMs(row.cancel_after_long_ms)}`,
      `cancel_after_ninja_long=${formatMs(row.cancel_after_ninja_long_ms)}`,
      `Luke->Ninja cancel=${formatMs(row.luke_to_ninja_cancel_ms)}`,
    ].join(" | "));
  }
  if (summary.parity.cancel_timing.length === 0) console.log("none");
  console.log("");
  console.log("No Ninja match");
  for (const row of summary.parity.no_ninja_match.slice(-8)) {
    console.log([
      row.id,
      row.type,
      row.received_at || "",
      `src->Luke=${formatMs(row.source_to_luke_ms)}`,
    ].join(" | "));
  }
  if (summary.parity.no_ninja_match.length === 0) console.log("none");
  console.log("");
  console.log("Recent rows");
  for (const row of summary.rows.slice(-12)) {
    console.log([
      row.id,
      row.type,
      row.symbol || "",
      `src->Luke=${formatMs(row.source_to_luke_ms)}`,
      `Luke->Ninja=${formatMs(row.luke_to_ninja_ms)}`,
      row.ninja_type || "no_ninja_match",
      row.ninja_reason || "",
    ].join(" | "));
  }
}

main();
