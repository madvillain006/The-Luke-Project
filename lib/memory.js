const fs = require("fs");
const path = require("path");
const { readJsonFile, writeJsonAtomic } = require("../state/lib");
const { log } = require("./logger");
const { EVENTS_DIR, snapshots, events } = require("./paths");

const MEMORY_FILE = snapshots.memory;
const SCHEMA_ERRORS_FILE = events.schemaErrors;
const MEMORY_ARCHIVE_DIR = EVENTS_DIR;
const MEM_CAP_BYTES = 200 * 1024;
const ARCHIVABLE_KEYS = ["emotional_log", "closed_trades", "fund_log", "conor_health_log", "agent06_research"];

function loadMemory() {
  try {
    const mem = readJsonFile(MEMORY_FILE, {});
    if (mem._schema_version !== "1.0" || mem._written_by !== "index") {
      try { fs.appendFileSync(SCHEMA_ERRORS_FILE, JSON.stringify({ ts: new Date().toISOString(), schema_version: mem._schema_version, written_by: mem._written_by }) + "\n"); } catch {}
    }
    return mem;
  } catch { return {}; }
}

function saveMemory(mem) {
  mem._schema_version = "1.0";
  mem._written_by = "index";
  let json = JSON.stringify(mem, null, 2);
  if (json.length > MEM_CAP_BYTES) {
    const archiveKey = "memory-archive-" + new Date().toISOString().slice(0, 7) + ".json";
    const archivePath = path.join(MEMORY_ARCHIVE_DIR, archiveKey);
    const archived = {};
    for (const key of ARCHIVABLE_KEYS) {
      if (Array.isArray(mem[key]) && mem[key].length > 0) {
        const half = Math.floor(mem[key].length / 2);
        archived[key] = mem[key].slice(0, half);
        mem[key] = mem[key].slice(half);
      }
    }
    if (Object.keys(archived).length > 0) {
      try {
        const existing = readJsonFile(archivePath, {});
        for (const [k, v] of Object.entries(archived)) existing[k] = [...(existing[k] || []), ...v];
        writeJsonAtomic(archivePath, existing);
        log("memory-archived", { archive: archiveKey, keys: Object.keys(archived) });
      } catch {}
    }
    json = JSON.stringify(mem, null, 2);
  }
  writeJsonAtomic(MEMORY_FILE, JSON.parse(json));
}

module.exports = { loadMemory, saveMemory };
