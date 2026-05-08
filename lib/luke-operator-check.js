'use strict';

const fs = require('fs');

const defaultPaths = require('./paths');
const { buildCompanionMemorySnapshot } = require('./companion-memory');
const { buildRadarSnapshot } = require('./radar/ingest');

function makeCheck(id, label, status, detail, owner = 'front') {
  return {
    id,
    label,
    status,
    detail: String(detail || 'not available'),
    owner,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ageMinutes(file, now) {
  try {
    const stat = fs.statSync(file);
    return Math.max(0, Math.round((now.getTime() - stat.mtimeMs) / 60000));
  } catch {
    return null;
  }
}

function buildDailyCheck(paths, now) {
  const file = paths.snapshots && paths.snapshots.dailySpine;
  if (!file || !fs.existsSync(file)) {
    return makeCheck(
      'daily-brief',
      'Daily Brief',
      'yellow',
      'Daily opens, but the latest Daily spine snapshot is not present yet.'
    );
  }

  let detail = 'Daily snapshot present';
  try {
    const daily = readJson(file);
    const label = daily.date_label || daily.generated_at || 'snapshot present';
    detail = `Daily snapshot present: ${label}`;
  } catch {
    detail = 'Daily snapshot file exists but could not be parsed.';
  }

  const age = ageMinutes(file, now);
  if (age !== null && age > 360) {
    return makeCheck('daily-brief', 'Daily Brief', 'yellow', `${detail}; ${age}m old.`);
  }
  return makeCheck('daily-brief', 'Daily Brief', 'green', detail);
}

function buildLukeOperatorCheck(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now instanceof Date ? options.now : new Date();
  const checks = [];
  const nextActions = [];
  let memorySnapshot = null;
  let radarSnapshot = null;

  try {
    memorySnapshot = options.memorySnapshot || buildCompanionMemorySnapshot({
      limit: Number(options.memoryLimit || 6),
      ...(options.memoryOptions || {}),
    });
    checks.push(makeCheck(
      'shared-memory',
      'Shared Memory',
      'green',
      memorySnapshot.summary_line || 'shared memory ready'
    ));
    if (!memorySnapshot.entries?.length) {
      nextActions.push('Seed Luke with one real appointment, reminder, preference, or active thought.');
    }
  } catch (err) {
    checks.push(makeCheck('shared-memory', 'Shared Memory', 'red', err.message));
    nextActions.push('Repair shared companion memory before using Luke as the default daily surface.');
  }

  checks.push(makeCheck(
    'luke-chat',
    'Luke Chat',
    'green',
    'General chat is the front companion surface and shares memory with Trading.'
  ));

  checks.push(makeCheck(
    'trading-boundary',
    'Trading Boundary',
    'green',
    'Trading ingestion, verdicts, entries, and trade logs stay inside Trading.'
  ));

  try {
    radarSnapshot = options.radarSnapshot || buildRadarSnapshot(paths, now, { writeSnapshot: false });
    checks.push(makeCheck(
      'radar',
      'Radar',
      'green',
      radarSnapshot.summary_line || 'ready / no items'
    ));
    if (!radarSnapshot.counts?.total) {
      nextActions.push('Drop the next source, link, Sybil paste, Pine note, or reminder into Radar.');
    }
  } catch (err) {
    checks.push(makeCheck('radar', 'Radar', 'red', err.message));
    nextActions.push('Repair Radar intake before relying on Luke for source synthesis.');
  }

  checks.push(buildDailyCheck(paths, now));

  const health = options.health || null;
  checks.push(makeCheck(
    'runtime',
    'Runtime',
    health?.ok === false ? 'red' : 'green',
    health?.ok === false
      ? 'Runtime health endpoint reports a failure.'
      : `Local runtime ready${health?.port ? ` on port ${health.port}` : ''}.`
  ));

  checks.push(makeCheck(
    'code-boundary',
    'Code Boundary',
    'green',
    'Use Codex only when actively changing Luke code; use Luke first for daily ops, memory, Radar, and trading review.'
  ));

  const redChecks = checks.filter(check => check.status === 'red');
  const yellowChecks = checks.filter(check => check.status === 'yellow');
  const canReplaceCodexForDailyUse = redChecks.length === 0;
  const summaryLine = canReplaceCodexForDailyUse
    ? 'Luke is ready as the daily operator surface; keep Codex for code changes.'
    : 'Luke is not ready to replace chat alternatives yet; fix red operator checks first.';

  if (yellowChecks.length) {
    nextActions.push(`Review yellow checks when convenient: ${yellowChecks.map(check => check.label).join(', ')}.`);
  }

  return {
    ok: redChecks.length === 0,
    label: 'Luke Operator Check',
    generated_at: now.toISOString(),
    verdict: canReplaceCodexForDailyUse ? 'use_luke_first' : 'fix_before_defaulting_to_luke',
    summary_line: summaryLine,
    can_replace_codex_for_daily_use: canReplaceCodexForDailyUse,
    can_replace_claude_for_luke_work: canReplaceCodexForDailyUse,
    codex_boundary: 'Codex remains the code-improvement tool. Luke should be the first stop for daily planning, shared memory, Radar intake, and supervised trading review.',
    claude_boundary: 'External chat remains useful for one-off outside research or model comparison. Luke should own local context and recurring operator memory.',
    checks,
    counts: {
      green: checks.filter(check => check.status === 'green').length,
      yellow: yellowChecks.length,
      red: redChecks.length,
    },
    memory: memorySnapshot ? {
      summary_line: memorySnapshot.summary_line,
      counts: memorySnapshot.counts || {},
      recent_count: memorySnapshot.entries?.length || 0,
    } : null,
    radar: radarSnapshot ? {
      summary_line: radarSnapshot.summary_line,
      counts: radarSnapshot.counts || {},
    } : null,
    front_routes: ['/luke', '/trading', '/daily', '/radar'],
    drilldown_routes: ['/brain-dashboard', '/operator-v2', '/trading-window'],
    next_actions: [...new Set(nextActions)].slice(0, 4),
    operator_lines: [
      summaryLine,
      `Memory: ${memorySnapshot?.summary_line || 'unavailable'}`,
      `Radar: ${radarSnapshot?.summary_line || 'unavailable'}`,
      'Boundary: use Luke first for daily ops; use Codex for code changes.',
    ],
  };
}

module.exports = {
  buildLukeOperatorCheck,
  _internal: {
    ageMinutes,
    buildDailyCheck,
    makeCheck,
  },
};
