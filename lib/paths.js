const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG_DIR = path.join(ROOT, "config");
const STATE_DIR = path.join(ROOT, "state");
const EVENTS_DIR = path.join(STATE_DIR, "events");
const SNAPSHOTS_DIR = path.join(STATE_DIR, "snapshots");
const RUNTIME_DIR = path.join(STATE_DIR, "runtime");

const events = {
  actionLog: path.join(EVENTS_DIR, "action-log.jsonl"),
  bobbyContext: path.join(EVENTS_DIR, "bobby-context.jsonl"),
  bootChecks: path.join(EVENTS_DIR, "boot-checks.jsonl"),
  brainReports: path.join(EVENTS_DIR, "brain-reports.jsonl"),
  canaryLog: path.join(EVENTS_DIR, "canary-log.jsonl"),
  dailyCheckins: path.join(EVENTS_DIR, "daily-checkins.jsonl"),
  crashLog: path.join(EVENTS_DIR, "crash.log"),
  discordHistory: path.join(EVENTS_DIR, "discord-history.jsonl"),
  jarvisLog: path.join(EVENTS_DIR, "jarvis-log.jsonl"),
  lukeLog: path.join(EVENTS_DIR, "luke-log.jsonl"),
  schemaErrors: path.join(EVENTS_DIR, "schema-errors.jsonl"),
  screenActions: path.join(EVENTS_DIR, "screen-actions.jsonl"),
  session: path.join(EVENTS_DIR, "session.jsonl"),
  shifts: path.join(EVENTS_DIR, "shifts.jsonl"),
  tokenUsage: path.join(EVENTS_DIR, "token-usage.jsonl"),
  tokenUsageHistory: path.join(EVENTS_DIR, "token-usage-history.jsonl"),
  toolCalls: path.join(EVENTS_DIR, "tool-calls.jsonl"),
  toolFailures: path.join(EVENTS_DIR, "tool-failures.jsonl"),
  toolHealth: path.join(EVENTS_DIR, "tool-health.jsonl"),
  trades: path.join(EVENTS_DIR, "trades.jsonl"),
  paperTrades: path.join(EVENTS_DIR, "paper-trades.jsonl"),
  stateInterventions: path.join(EVENTS_DIR, "state-interventions.jsonl"),
  historyCareerFindings: path.join(EVENTS_DIR, "history-career-findings.jsonl"),
};

const snapshots = {
  autonomousState: path.join(SNAPSHOTS_DIR, "autonomous-state.json"),
  brainState: path.join(SNAPSHOTS_DIR, "brain-state.json"),
  canaryLast: path.join(SNAPSHOTS_DIR, "canary-last.json"),
  dailySpine: path.join(SNAPSHOTS_DIR, "daily-spine.json"),
  historyCareerSpine: path.join(SNAPSHOTS_DIR, "history-career-spine.json"),
  lukeLogDrafts: path.join(SNAPSHOTS_DIR, "luke-log-drafts.json"),
  memory: path.join(SNAPSHOTS_DIR, "memory.json"),
  repoMap: path.join(SNAPSHOTS_DIR, "repo-map.json"),
  schedulerHeartbeat: path.join(SNAPSHOTS_DIR, "scheduler-heartbeat.json"),
  schedulerJobs: path.join(SNAPSHOTS_DIR, "scheduler-jobs.json"),
  tokenUsageDaily: path.join(SNAPSHOTS_DIR, "token-usage-daily.json"),
  tokenUsageWeekly: path.join(SNAPSHOTS_DIR, "token-usage-weekly.json"),
  tradovateHealth: path.join(SNAPSHOTS_DIR, "tradovate-health.json"),
};

const config = {
  fallback: path.join(CONFIG_DIR, "fallback-config.json"),
};

const runtime = {
  wsToken: path.join(RUNTIME_DIR, "ws-token"),
  screenshot: path.join(RUNTIME_DIR, "screenshot.png"),
  bobbyVisionFixture: path.join(RUNTIME_DIR, "test-heatmap.png"),
  scrapeResult: path.join(RUNTIME_DIR, "scrape-result.json"),
};

module.exports = {
  ROOT,
  CONFIG_DIR,
  STATE_DIR,
  EVENTS_DIR,
  SNAPSHOTS_DIR,
  RUNTIME_DIR,
  config,
  events,
  runtime,
  snapshots,
};
