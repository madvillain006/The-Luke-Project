"use strict";

const fs = require("fs");
const path = require("path");

const {
  buildParityLedger,
  parityRowsToCsv,
  parityRowsToMarkdown,
  todayDateKey,
} = require("../lib/ninja-parity-ledger");

const ROOT = path.join(__dirname, "..");
const DEFAULT_BRIDGE_FILE = path.join(ROOT, "state", "events", "ninjatrader-bridge.jsonl");
const DEFAULT_NATIVE_FILE = path.join(ROOT, "state", "events", "ninja-native-shadow.jsonl");
const DEFAULT_OUT_ROOT = path.join(ROOT, "artifacts", "research", "ninja-parity-today");

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

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function main() {
  const timeZone = argValue("--tz", "America/New_York");
  const date = argValue("--date", todayDateKey(timeZone));
  const bridgeFile = argValue("--bridge-file", DEFAULT_BRIDGE_FILE);
  const nativeFile = argValue("--native-file", DEFAULT_NATIVE_FILE);
  const outDir = argValue("--out-dir", path.join(DEFAULT_OUT_ROOT, date));
  const outputJson = process.argv.includes("--json");

  const report = buildParityLedger({
    bridgeText: readText(bridgeFile),
    nativeText: readText(nativeFile),
    date,
    timeZone,
  });

  const summaryPath = path.join(outDir, "summary.json");
  const csvPath = path.join(outDir, "ledger.csv");
  const markdownPath = path.join(outDir, "ledger.md");
  writeText(summaryPath, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    bridge_file: bridgeFile,
    native_file: nativeFile,
    ...report,
  }, null, 2)}\n`);
  writeText(csvPath, parityRowsToCsv(report.rows));
  writeText(markdownPath, parityRowsToMarkdown(report));

  if (outputJson) {
    console.log(JSON.stringify({
      ok: report.summary.status === "clean",
      out_dir: outDir,
      summary_path: summaryPath,
      csv_path: csvPath,
      markdown_path: markdownPath,
      summary: report.summary,
    }, null, 2));
    return;
  }

  console.log("Luke Ninja/Pine parity ledger");
  console.log(`date=${date} tz=${timeZone}`);
  console.log(`bridge_file=${bridgeFile}`);
  console.log(`native_file=${nativeFile}`);
  console.log(`status=${report.summary.status} blockers=${report.summary.blockers.join(",") || "none"}`);
  console.log(`pine L/C=${report.summary.counts.pine_longs}/${report.summary.counts.pine_cancels} native L/C=${report.summary.counts.native_longs}/${report.summary.counts.native_cancels}`);
  console.log(`matched=${report.summary.counts.matched} missing_native=${report.summary.counts.missing_native} native_only=${report.summary.counts.native_only} geometry_mismatch=${report.summary.counts.geometry_mismatch}`);
  console.log(`wrote=${markdownPath}`);
  console.log(`csv=${csvPath}`);
}

if (require.main === module) {
  main();
}

