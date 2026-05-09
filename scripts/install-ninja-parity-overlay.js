"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "ninjatrader", "LukeParityOverlayIndicator.cs");
const DEFAULT_CUSTOM_DIR = process.env.NINJATRADER_CUSTOM_DIR
  || path.join(process.env.USERPROFILE || "C:\\Users\\conor", "OneDrive", "Documents", "NinjaTrader 8", "bin", "Custom");
const TARGET_RELATIVE = path.join("Indicators", "LukeParityOverlayIndicator.cs");
const CSPROJ_NAME = "NinjaTrader.Custom.csproj";
const CSPROJ_INCLUDE = '    <Compile Include="Indicators\\LukeParityOverlayIndicator.cs" />';

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function auditIndicatorSource(source) {
  const banned = [
    "EnterLong",
    "EnterShort",
    "ExitLong",
    "ExitShort",
    "SubmitOrder",
    "SubmitOrderUnmanaged",
    "SetStopLoss",
    "SetProfitTarget",
    "CancelOrder",
  ];
  const blockers = [];
  for (const call of banned) {
    if (new RegExp(`\\b${call}\\s*\\(`).test(source)) blockers.push(`order_call:${call}`);
  }
  for (const snippet of [
    "namespace NinjaTrader.NinjaScript.Indicators",
    "public class LukeParityOverlayIndicator : Indicator",
    "Draw.TextFixed",
    "Draw.HorizontalLine",
    "AddDataSeries(BarsPeriodType.Day, 1)",
    "ComputeSatyAtr",
    "NativeTelemetryPath",
    "score incl cxl",
    "realistic net",
    "IsShadowOnly",
    "chart-only: no order APIs",
  ]) {
    if (!source.includes(snippet)) blockers.push(`missing:${snippet}`);
  }
  return {
    status: blockers.length === 0 ? "clean" : "blocked",
    blockers,
    no_order_apis: !blockers.some((item) => item.startsWith("order_call:")),
  };
}

function patchProject(projectText) {
  if (projectText.includes('Compile Include="Indicators\\LukeParityOverlayIndicator.cs"')) {
    return { changed: false, text: projectText };
  }

  const indicatorAnchor = /(\s*<Compile Include="Indicators\\[^"]+\.cs" \/>\r?\n)(?![\s\S]*<Compile Include="Indicators\\[^"]+\.cs" \/>)/;
  if (indicatorAnchor.test(projectText)) {
    return {
      changed: true,
      text: projectText.replace(indicatorAnchor, `$1${CSPROJ_INCLUDE}\r\n`),
    };
  }

  const itemGroupEnd = /(\s*<\/ItemGroup>)/;
  if (!itemGroupEnd.test(projectText)) {
    throw new Error("Could not find an Indicator compile anchor or ItemGroup end in NinjaTrader.Custom.csproj");
  }
  return {
    changed: true,
    text: projectText.replace(itemGroupEnd, `${CSPROJ_INCLUDE}\r\n$1`),
  };
}

function install({ customDir = DEFAULT_CUSTOM_DIR, write = false } = {}) {
  const source = readText(SOURCE);
  const audit = auditIndicatorSource(source);
  if (audit.status !== "clean") {
    throw new Error(`Indicator source gate failed: ${audit.blockers.join(", ")}`);
  }

  const target = path.join(customDir, TARGET_RELATIVE);
  const project = path.join(customDir, CSPROJ_NAME);
  const projectText = readText(project);
  const patched = patchProject(projectText);
  const targetExists = fs.existsSync(target);
  const targetSame = targetExists && readText(target) === source;
  const actions = [];
  const backups = [];

  if (!targetSame) actions.push(`copy ${SOURCE} -> ${target}`);
  if (patched.changed) actions.push(`add ${TARGET_RELATIVE} compile include to ${project}`);

  if (write) {
    const backupStamp = stamp();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!targetSame) {
      if (targetExists) {
        const targetBackup = `${target}.luke-backup-${backupStamp}`;
        fs.copyFileSync(target, targetBackup);
        backups.push(targetBackup);
      }
      writeText(target, source);
    }
    if (patched.changed) {
      const projectBackup = `${project}.luke-backup-${backupStamp}`;
      fs.copyFileSync(project, projectBackup);
      backups.push(projectBackup);
      writeText(project, patched.text);
    }
  }

  return {
    custom_dir: customDir,
    source: SOURCE,
    target,
    project,
    write,
    source_gate: audit,
    target_same: targetSame,
    project_changed: patched.changed,
    actions,
    backups,
  };
}

function main() {
  const write = process.argv.includes("--write");
  const customArg = process.argv.find((arg) => arg.startsWith("--custom-dir="));
  const customDir = customArg ? customArg.slice("--custom-dir=".length) : DEFAULT_CUSTOM_DIR;
  const result = install({ customDir, write });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  auditIndicatorSource,
  install,
  patchProject,
};
