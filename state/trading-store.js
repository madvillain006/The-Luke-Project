const path = require("path");
const { appendJsonl, readJsonFile, writeJsonAtomic } = require("./lib");

const ROOT = path.join(__dirname, "..");
const SNAPSHOT_FILE = path.join(ROOT, "state", "snapshots", "trading-state.json");
const EVENTS_FILE = path.join(ROOT, "state", "events", "trading-events.jsonl");
const LEGACY_FILE = path.join(ROOT, "autonomous-state.json");

function defaultTradingState() {
  return {
    mode: "paper",
    running: false,
    kill_day: false,
    kill_week: false,
    kill_week_until: null,
    daily_pnl: 0,
    weekly_pnl: 0,
    total_eval_pnl: 0,
    daily_loss_limit: -100,
    weekly_loss_limit: -300,
    apex: {
      enabled: false,
      account_start: 50000,
      profit_target: 3000,
      max_drawdown: 2000,
      daily_loss_limit: 1000,
      consistency_limit: 0.50,
      account_high_eod: 50000,
      eod_threshold: 48000,
      last_eod_update: null,
      contracts: 1
    },
    paper_trades: 0,
    open_position: null,
    pending_signal: null,
    tradovate: { username: null, password: null, deviceId: null, cid: null, sec: null, env: "demo" }
  };
}

function withTradingMeta(state) {
  return {
    ...state,
    _schema_version: "1.0",
    _state_kind: "trading",
    _updated: new Date().toISOString()
  };
}

function summarize(state) {
  return {
    mode: state.mode,
    running: state.running,
    kill_day: state.kill_day,
    kill_week: state.kill_week,
    paper_trades: state.paper_trades || 0,
    has_open_position: !!state.open_position,
    has_pending_signal: !!state.pending_signal,
    total_eval_pnl: state.total_eval_pnl || 0,
  };
}

function persistTradingState(state, eventType, data) {
  const snapshot = withTradingMeta(state);
  writeJsonAtomic(SNAPSHOT_FILE, snapshot);
  writeJsonAtomic(LEGACY_FILE, snapshot);
  appendJsonl(EVENTS_FILE, {
    ts: new Date().toISOString(),
    type: eventType,
    summary: summarize(snapshot),
    data: data || {}
  });
  return snapshot;
}

function loadTradingState() {
  try {
    return readJsonFile(SNAPSHOT_FILE);
  } catch (snapshotErr) {
    try {
      const legacy = readJsonFile(LEGACY_FILE);
      return persistTradingState(legacy, "TRADING_STATE_RECOVERED_FROM_LEGACY", { source: "legacy-file" });
    } catch (legacyErr) {
      return persistTradingState(defaultTradingState(), "TRADING_STATE_INITIALIZED", {
        snapshot_error: snapshotErr.message,
        legacy_error: legacyErr.message
      });
    }
  }
}

function saveTradingState(state, eventType = "TRADING_STATE_SAVED", data = {}) {
  return persistTradingState(state, eventType, data);
}

module.exports = {
  defaultTradingState,
  loadTradingState,
  saveTradingState,
};
