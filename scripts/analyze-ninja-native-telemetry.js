"use strict";

const fs = require("fs");
const path = require("path");

const {
  parseNativeTelemetry,
  summarizeNativeTelemetry,
} = require("../lib/ninja-native-telemetry");

const ROOT = path.join(__dirname, "..");
const DEFAULT_FILE = path.join(ROOT, "state", "events", "ninja-native-shadow.jsonl");

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

function formatRow(row) {
  return [
    row.ts || "",
    row.event,
    row.signal_id || "",
    row.instrument || "",
    `level=${value(row.level)}`,
    `entry=${value(row.entry)}`,
    `stop=${value(row.stop)}`,
    `tp1=${value(row.tp1)}`,
    `tp2=${value(row.tp2)}`,
    row.note || "",
  ].join(" | ");
}

function value(number) {
  return Number.isFinite(number) ? number.toFixed(2) : "n/a";
}

function main() {
  const file = argValue("--file", DEFAULT_FILE);
  const outputJson = process.argv.includes("--json");
  const events = parseNativeTelemetry(readText(file));
  const summary = summarizeNativeTelemetry(events);

  if (outputJson) {
    console.log(JSON.stringify({ file, ...summary }, null, 2));
    return;
  }

  console.log("Ninja-native Luke shadow telemetry");
  console.log(`file: ${file}`);
  console.log(`events=${summary.counts.events} longs=${summary.counts.longs} cancels=${summary.counts.cancels} outcomes=${summary.counts.outcomes}`);
  console.log(`readiness=${summary.readiness.status} blockers=${summary.readiness.blockers.join(",") || "none"}`);
  console.log(`first=${summary.first_ts || "n/a"} last=${summary.last_ts || "n/a"}`);
  console.log("");
  console.log("Event counts");
  for (const [event, count] of Object.entries(summary.counts.by_event)) {
    console.log(`${event}: ${count}`);
  }
  console.log("");
  console.log("Geometry issues");
  if (summary.geometry_issues.length === 0) {
    console.log("none");
  } else {
    for (const issue of summary.geometry_issues.slice(-12)) {
      console.log(`${issue.ts} ${issue.event} ${issue.signal_id}: missing ${issue.missing.join(",")}`);
    }
  }
  console.log("");
  console.log("Recent");
  if (summary.recent.length === 0) {
    console.log("none");
  } else {
    for (const row of summary.recent) console.log(formatRow(row));
  }
}

main();
