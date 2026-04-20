const path = require("path");
const { appendJsonl, readJsonFile, writeJsonAtomic } = require("./lib");

const ROOT = path.join(__dirname, "..");
const SNAPSHOT_FILE = path.join(ROOT, "state", "snapshots", "health-state.json");
const EVENTS_FILE = path.join(ROOT, "state", "events", "health-events.jsonl");

function defaultHealthState() {
  return {
    luke_last_log: null,
    conor_health_log: []
  };
}

function withHealthMeta(state) {
  return {
    ...state,
    _schema_version: "1.0",
    _state_kind: "health",
    _updated: new Date().toISOString()
  };
}

function persistHealthState(state, eventType, data) {
  const snapshot = withHealthMeta(state);
  writeJsonAtomic(SNAPSHOT_FILE, snapshot);
  appendJsonl(EVENTS_FILE, {
    ts: new Date().toISOString(),
    type: eventType,
    data: data || {}
  });
  return snapshot;
}

function loadHealthState() {
  const snapshot = readJsonFile(SNAPSHOT_FILE, null);
  if (snapshot) return snapshot;
  return persistHealthState(defaultHealthState(), "HEALTH_STATE_INITIALIZED", { source: "missing-snapshot" });
}

function recordLukeLog(entry) {
  const state = loadHealthState();
  state.luke_last_log = entry;
  return persistHealthState(state, "LUKE_LOGGED", { entry });
}

function recordConorHealthLog(entry) {
  const state = loadHealthState();
  if (!Array.isArray(state.conor_health_log)) state.conor_health_log = [];
  state.conor_health_log.push(entry);
  state.conor_health_log = state.conor_health_log.slice(-30);
  return persistHealthState(state, "CONOR_HEALTH_LOGGED", { entry });
}

module.exports = {
  loadHealthState,
  recordConorHealthLog,
  recordLukeLog,
};
