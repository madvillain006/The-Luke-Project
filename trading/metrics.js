const fs   = require("fs");
const path = require("path");
const { loadTradingState } = require("../state/trading-store");

const ROOT             = path.join(__dirname, "..");
const LOG_FILE         = path.join(ROOT, "jarvis-log.jsonl");
const PAPER_TRADES_FILE = path.join(ROOT, "paper-trades.jsonl");
const SCHED_JOBS_FILE  = path.join(ROOT, "scheduler-jobs.json");

const MAX_RANGE_HOURS = 30 * 24;

const CRITICAL_TYPES = new Set([
  "execution-critical-mismatch",
  "autonomous-kill-day",
  "autonomous-kill-week",
  "autonomous-critical-cleared",
  "execution-emergency-flatten-success",
  "execution-emergency-flatten-result",
  "autonomous-apex-force-close",
  "02b-reconcile-mismatch",
  "autonomous-reconcile-block",
]);

function readJsonlInRange(filepath, cutoff) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf8").split("\n");
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const ts = obj.timestamp || obj.ts;
      if (ts && new Date(ts) >= cutoff) out.push(obj);
    } catch {}
  }
  return out;
}

function getSessionMetrics(rangeHours = 24) {
  const hours  = Math.min(Math.max(1, rangeHours), MAX_RANGE_HOURS);
  const cutoff = new Date(Date.now() - hours * 3600000);
  const since  = cutoff.toISOString();

  const logs   = readJsonlInRange(LOG_FILE, cutoff);
  const trades = readJsonlInRange(PAPER_TRADES_FILE, cutoff);
  const state = loadTradingState();

  // ── Signal counts ──────────────────────────────────────────────────────────
  const signals_evaluated = logs.filter(e => e.type === "autonomous-evaluate").length;
  const signals_staged    = logs.filter(e => e.type === "autonomous-staged").length;

  // ── Rejects by reason ─────────────────────────────────────────────────────
  const rejects_by_reason = {};
  function bump(key) { rejects_by_reason[key] = (rejects_by_reason[key] || 0) + 1; }

  for (const e of logs) {
    if (e.type === "MARKET_CONTEXT_REJECT" || e.type === "shadow-market-gate-rejected") {
      const reasons = (e.data && Array.isArray(e.data.reasons) && e.data.reasons.length > 0)
        ? e.data.reasons : ["unknown"];
      for (const r of reasons) bump(r.split(":")[0]);
    }
    if (e.type === "autonomous-reconcile-block" || e.type === "shadow-reconcile-would-block")
      bump("reconcile_mismatch");
    if (e.type === "execute-staged-error")
      bump("execute_error");
    if (e.type === "market_gate_rejected")
      bump("market_gate_rejected");
  }

  // ── Paper/shadow trades ───────────────────────────────────────────────────
  const opened = trades.filter(t => ["open", "shadow_open"].includes(t.status));
  const closed = trades.filter(t => ["closed", "shadow_closed"].includes(t.status));
  const shadowOpened = opened.filter(t => t.mode === "shadow" || t.status === "shadow_open");
  const shadowClosed = closed.filter(t => t.mode === "shadow" || t.status === "shadow_closed");
  const paperOpenedOnly = opened.filter(t => t.mode === "paper" || t.status === "open");
  const paperClosedOnly = closed.filter(t => t.mode === "paper" || t.status === "closed");

  const paper_trades_opened = opened.length;
  const paper_trades_closed = closed.length;
  const paper_pnl_total     = +closed.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2);
  const paper_pnl_avg_per_trade = paper_trades_closed > 0
    ? +(paper_pnl_total / paper_trades_closed).toFixed(2) : 0;
  const shadow_trades_opened = shadowOpened.length;
  const shadow_trades_closed = shadowClosed.length;
  const shadow_pnl_total = +shadowClosed.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2);
  const paper_mode_trades_opened = paperOpenedOnly.length;
  const paper_mode_trades_closed = paperClosedOnly.length;
  const paper_mode_pnl_total = +paperClosedOnly.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2);

  // ── Avg time to protection confirmed (live mode only) ────────────────────
  // Pair each autonomous-execute-live with the nearest preceding autonomous-staged
  // within a 3-minute window to estimate full cycle time.
  const liveExecs = logs.filter(e => e.type === "autonomous-execute-live");
  let avg_time_to_protection_confirmed_ms = null;
  if (liveExecs.length > 0) {
    const stagedEvents = logs.filter(e => e.type === "autonomous-staged");
    const gaps = [];
    for (const exec of liveExecs) {
      const execMs = new Date(exec.timestamp).getTime();
      const preceding = stagedEvents
        .map(s => ({ s, ms: new Date(s.timestamp).getTime() }))
        .filter(({ ms }) => ms < execMs && execMs - ms < 180000)
        .sort((a, b) => b.ms - a.ms);
      if (preceding.length > 0) gaps.push(execMs - preceding[0].ms);
    }
    if (gaps.length > 0)
      avg_time_to_protection_confirmed_ms = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  // ── Scheduler failed jobs ─────────────────────────────────────────────────
  let scheduler_jobs_failed_count = 0;
  try {
    const jobs = JSON.parse(fs.readFileSync(SCHED_JOBS_FILE, "utf8"));
    scheduler_jobs_failed_count = Object.values(jobs).filter(j => j.state === "failed").length;
  } catch {}

  // ── Reconciliation mismatches ─────────────────────────────────────────────
  const reconciliation_mismatches_count = logs.filter(e =>
    e.type === "02b-reconcile-mismatch" ||
    e.type === "autonomous-reconcile-block" ||
    e.type === "shadow-reconcile-would-block"
  ).length;

  // ── Critical events ───────────────────────────────────────────────────────
  const critical_events = logs
    .filter(e => CRITICAL_TYPES.has(e.type))
    .map(e => ({ timestamp: e.timestamp, type: e.type, summary: summariseCritical(e) }));

  return {
    range_hours: hours,
    since,
    generated_at: new Date().toISOString(),
    signals_evaluated,
    signals_staged,
    shadow_session: state.shadow_session ? {
      started: state.shadow_session.started,
      signals_evaluated: state.shadow_session.signals_evaluated || 0,
      staged: state.shadow_session.staged || 0,
      would_have_entered: state.shadow_session.would_have_entered || 0,
      rejected_count: (state.shadow_session.rejected || []).length,
      simulated_pnl: state.shadow_session.simulated_pnl || 0
    } : null,
    rejects_by_reason,
    paper_trades_opened,
    paper_trades_closed,
    paper_pnl_total,
    paper_pnl_avg_per_trade,
    paper_mode_trades_opened,
    paper_mode_trades_closed,
    paper_mode_pnl_total,
    shadow_trades_opened,
    shadow_trades_closed,
    shadow_pnl_total,
    avg_time_to_protection_confirmed_ms,
    scheduler_jobs_failed_count,
    reconciliation_mismatches_count,
    critical_events,
  };
}

function summariseCritical(e) {
  const d = e.data || {};
  switch (e.type) {
    case "autonomous-kill-day":      return d.manual ? "manual kill-day" : "daily loss limit hit";
    case "autonomous-kill-week":     return d.manual ? "manual kill-week" : "weekly loss limit hit";
    case "execution-critical-mismatch": return "ENTRY FILLED, PROTECTION + FLATTEN FAILED";
    case "execution-emergency-flatten-success": return "emergency flatten executed successfully";
    case "autonomous-apex-force-close": return "Apex floor breached, position force-closed";
    case "02b-reconcile-mismatch":
    case "autonomous-reconcile-block": return "reconcile mismatch: " + (d.mismatches || []).join("; ");
    default: return JSON.stringify(d).slice(0, 120);
  }
}

function buildTextSummary(m) {
  const lines = [
    `Luke 02B metrics — last ${m.range_hours}h (since ${m.since.slice(0, 16).replace("T", " ")} UTC):`,
    `Signals evaluated: ${m.signals_evaluated} | Staged: ${m.signals_staged}`,
  ];

  const rejectTotal = Object.values(m.rejects_by_reason).reduce((a, b) => a + b, 0);
  if (rejectTotal > 0) {
    const parts = Object.entries(m.rejects_by_reason).map(([k, v]) => `${k}×${v}`);
    lines.push(`Gate rejections: ${rejectTotal} (${parts.join(", ")})`);
  } else {
    lines.push("Gate rejections: 0");
  }

  lines.push(
    `Paper trades — opened: ${m.paper_trades_opened}, closed: ${m.paper_trades_closed}`,
    `Paper P&L — total: $${m.paper_pnl_total}, avg/trade: $${m.paper_pnl_avg_per_trade}`,
  );

  if (m.avg_time_to_protection_confirmed_ms !== null)
    lines.push(`Avg time entry→protected: ${(m.avg_time_to_protection_confirmed_ms / 1000).toFixed(1)}s`);

  lines.push(
    `Reconcile mismatches: ${m.reconciliation_mismatches_count}`,
    `Scheduler failed jobs: ${m.scheduler_jobs_failed_count}`,
    `Critical events: ${m.critical_events.length}${m.critical_events.length > 0 ? " — " + m.critical_events.map(e => e.type).join(", ") : ""}`,
  );

  return lines.join("  |  ");
}

module.exports = { getSessionMetrics, buildTextSummary };
