'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-vA-dynamic-level-grid');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-vA-autonomous-risk-sweep');
const COMPLETE_SESSIONS = 48;
const SUPPRESSED_STATUSES = new Set(['suppressed_while_open', 'suppressed_failed_cooldown']);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  fs.writeFileSync(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')}\n`, 'utf8');
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function maxDrawdown(days) {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const day of days) {
    equity += Number(day.net || 0);
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }
  return round2(drawdown);
}

function minuteOfDay(etTime) {
  const [, timePart = ''] = String(etTime || '').split(' ');
  const [hour, minute] = timePart.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
  return hour * 60 + minute;
}

function timeWindowAllows(row, timeMode) {
  const minute = minuteOfDay(row.signal_et || row.order_armed_et || row.fill_et);
  if (minute < 0) return true;
  if (timeMode === 'rth_0930_1600') return minute >= 9 * 60 + 30 && minute < 16 * 60;
  if (timeMode === 'rth_1000_1530') return minute >= 10 * 60 && minute < 15 * 60 + 30;
  if (timeMode === 'day_0800_1600') return minute >= 8 * 60 && minute < 16 * 60;
  if (timeMode === 'day_0600_1600') return minute >= 6 * 60 && minute < 16 * 60;
  return true;
}

function isFilled(row) {
  return row.status && row.status !== 'no_fill' && !SUPPRESSED_STATUSES.has(row.status);
}

function sortTradeRows(rows) {
  return rows.slice().sort((a, b) => (
    String(a.plan_date).localeCompare(String(b.plan_date))
    || Number(a.signal_index || 0) - Number(b.signal_index || 0)
    || String(a.signal_et || '').localeCompare(String(b.signal_et || ''))
  ));
}

function groupByProfileAndDay(rows) {
  const byProfile = new Map();
  for (const row of sortTradeRows(rows)) {
    const profile = row.profile || 'unknown';
    const date = row.plan_date || 'unknown';
    if (!byProfile.has(profile)) byProfile.set(profile, new Map());
    const days = byProfile.get(profile);
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(row);
  }
  return byProfile;
}

function applyDailyRule(dayRows, rule) {
  let net = 0;
  let grossPoints = 0;
  let fills = 0;
  let winners = 0;
  let losers = 0;
  let stops = 0;
  let noFills = 0;
  let suppressedByRule = 0;
  let exitReason = '';
  let consecutiveLosses = 0;
  const kept = [];
  for (const row of dayRows) {
    if (exitReason) {
      suppressedByRule += 1;
      continue;
    }
    if (!timeWindowAllows(row, rule.timeMode)) {
      suppressedByRule += 1;
      continue;
    }
    if (rule.maxConsecutiveLosses > 0 && consecutiveLosses >= rule.maxConsecutiveLosses) {
      suppressedByRule += 1;
      exitReason = 'consecutive_loss_lock';
      continue;
    }
    if (!isFilled(row)) {
      if (row.status === 'no_fill') noFills += 1;
      kept.push(row);
      continue;
    }
    const tradeNet = Number(row.net_dollars || 0);
    net += tradeNet;
    grossPoints += Number(row.gross_points || 0);
    fills += 1;
    if (tradeNet > 0) winners += 1;
    else if (tradeNet < 0) losers += 1;
    if (tradeNet < 0) consecutiveLosses += 1;
    else if (tradeNet > 0) consecutiveLosses = 0;
    if (String(row.status || '').startsWith('stopped')) stops += 1;
    kept.push(row);
    if (rule.maxFills > 0 && fills >= rule.maxFills) exitReason = 'max_fills';
    if (!exitReason && rule.profitLock > 0 && net >= rule.profitLock) exitReason = 'profit_lock';
    if (!exitReason && rule.lossLimit > 0 && net <= -rule.lossLimit) exitReason = 'loss_limit';
  }
  return {
    net: round2(net),
    gross_points: round2(grossPoints),
    fills,
    winners,
    losers,
    stops,
    no_fills: noFills,
    suppressed_by_daily_rule: suppressedByRule,
    exit_reason: exitReason || 'none',
    kept_rows: kept,
  };
}

function summarizeRule(profile, rule, daysMap) {
  const dayRows = [];
  for (const [date, rows] of [...daysMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const result = applyDailyRule(rows, rule);
    if (result.fills > 0) {
      dayRows.push({
        profile,
        rule: rule.name,
        date,
        ...result,
      });
    }
  }
  const nets = dayRows.map((row) => row.net);
  const totalNet = round2(nets.reduce((sum, value) => sum + value, 0));
  const activeSessions = dayRows.length;
  const positive = dayRows.filter((row) => row.net > 0).length;
  const negative = dayRows.filter((row) => row.net < 0).length;
  const fills = dayRows.reduce((sum, row) => sum + row.fills, 0);
  const winners = dayRows.reduce((sum, row) => sum + row.winners, 0);
  const losers = dayRows.reduce((sum, row) => sum + row.losers, 0);
  const stopped = dayRows.reduce((sum, row) => sum + row.stops, 0);
  return {
    profile,
    rule: rule.name,
    profit_lock: rule.profitLock || 0,
    loss_limit: rule.lossLimit || 0,
    max_fills: rule.maxFills || 0,
    max_consecutive_losses: rule.maxConsecutiveLosses || 0,
    time_mode: rule.timeMode || 'all',
    total_net: totalNet,
    avg_all_sessions: round2(totalNet / COMPLETE_SESSIONS),
    active_sessions: activeSessions,
    avg_active_session: round2(totalNet / (activeSessions || 1)),
    median_active_session: round2(median(nets)),
    p25_active_session: round2(percentile(nets, 25)),
    p75_active_session: round2(percentile(nets, 75)),
    best_session: round2(Math.max(...nets, 0)),
    worst_session: round2(Math.min(...nets, 0)),
    positive_active_sessions: positive,
    negative_active_sessions: negative,
    active_win_day_rate: round2((positive / (activeSessions || 1)) * 100),
    fills,
    winners,
    losers,
    stopped,
    trade_win_rate: round2((winners / (fills || 1)) * 100),
    max_drawdown_active_order: maxDrawdown(dayRows),
    sessions_ge_100: dayRows.filter((row) => row.net >= 100).length,
    sessions_ge_200: dayRows.filter((row) => row.net >= 200).length,
    sessions_ge_300: dayRows.filter((row) => row.net >= 300).length,
    sessions_ge_400: dayRows.filter((row) => row.net >= 400).length,
    sessions_ge_500: dayRows.filter((row) => row.net >= 500).length,
    sessions_le_neg300: dayRows.filter((row) => row.net <= -300).length,
    sessions_le_neg500: dayRows.filter((row) => row.net <= -500).length,
  };
}

function buildRules() {
  const rules = [{ name: 'unbounded', profitLock: 0, lossLimit: 0, maxFills: 0, maxConsecutiveLosses: 0, timeMode: 'all' }];
  const timeModes = ['all', 'day_0600_1600', 'day_0800_1600', 'rth_0930_1600', 'rth_1000_1530'];
  for (const profitLock of [200, 300, 400, 500, 750, 1000]) {
    for (const lossLimit of [200, 300, 400, 500, 750]) {
      for (const maxFills of [0, 2, 3, 4, 6, 8]) {
        for (const maxConsecutiveLosses of [0, 2, 3]) {
          for (const timeMode of timeModes) {
            const timeSuffix = timeMode === 'all' ? '' : `_${timeMode}`;
            const lossSuffix = maxConsecutiveLosses ? `_cl${maxConsecutiveLosses}` : '';
            rules.push({
              name: `pl${profitLock}_ll${lossLimit}_max${maxFills || 'none'}${lossSuffix}${timeSuffix}`,
              profitLock,
              lossLimit,
              maxFills,
              maxConsecutiveLosses,
              timeMode,
            });
          }
        }
      }
    }
  }
  return rules;
}

function selectAutonomousCandidate(rows) {
  const filtered = rows.filter((row) => (
    row.active_sessions >= 8
    && row.avg_all_sessions >= 100
    && row.worst_session >= -500
    && row.sessions_le_neg500 === 0
    && row.max_drawdown_active_order >= -800
  ));
  const pool = filtered.length ? filtered : rows;
  return pool.slice().sort((a, b) => (
    b.avg_all_sessions - a.avg_all_sessions
    || b.median_active_session - a.median_active_session
    || b.total_net - a.total_net
    || b.worst_session - a.worst_session
  ))[0];
}

function selectMedianCandidate(rows) {
  const filtered = rows.filter((row) => (
    row.active_sessions >= 8
    && row.avg_all_sessions >= 100
    && row.worst_session >= -500
    && row.sessions_le_neg500 === 0
    && row.max_drawdown_active_order >= -800
  ));
  const pool = filtered.length ? filtered : rows;
  return pool.slice().sort((a, b) => (
    b.median_active_session - a.median_active_session
    || b.avg_all_sessions - a.avg_all_sessions
    || b.total_net - a.total_net
    || b.worst_session - a.worst_session
  ))[0];
}

function writeReport({ generatedAt, selected, medianSelected, topRows, topMedianRows, selectedDays, strictBaseline }) {
  const lines = [];
  lines.push('# Luke vA Autonomous Risk Sweep');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`Selected autonomous dollars/day profile/rule: \`${selected.profile}\` / \`${selected.rule}\`.`);
  lines.push('');
  lines.push('Selection was risk-constrained before maximizing average dollars across all 48 available sessions: active sessions >= 8, avg all sessions >= $100, worst active day >= -$500, no active days <= -$500, and active-order max drawdown no worse than -$800.');
  lines.push('');
  lines.push(`Highest median active-day profile under the same constraints is \`${medianSelected.profile}\` / \`${medianSelected.rule}\`, median active $${medianSelected.median_active_session}, avg all-session $${medianSelected.avg_all_sessions}, active sessions ${medianSelected.active_sessions}/48. That is not the primary autonomous choice because it fires much less often.`);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  for (const [label, value] of [
    ['Total net', `$${selected.total_net}`],
    ['Avg all 48 sessions', `$${selected.avg_all_sessions}`],
    ['Avg active session', `$${selected.avg_active_session}`],
    ['Median active session', `$${selected.median_active_session}`],
    ['P25 active session', `$${selected.p25_active_session}`],
    ['Worst active session', `$${selected.worst_session}`],
    ['Best active session', `$${selected.best_session}`],
    ['Active sessions', selected.active_sessions],
    ['Positive active sessions', selected.positive_active_sessions],
    ['Negative active sessions', selected.negative_active_sessions],
    ['Active win day rate', `${selected.active_win_day_rate}%`],
    ['Trade win rate', `${selected.trade_win_rate}%`],
    ['Time mode', selected.time_mode],
    ['Max consecutive losses', selected.max_consecutive_losses],
    ['Max fills', selected.max_fills],
    ['Max active-order drawdown', `$${selected.max_drawdown_active_order}`],
    ['Days >= $300', selected.sessions_ge_300],
    ['Days >= $500', selected.sessions_ge_500],
    ['Days <= -$300', selected.sessions_le_neg300],
    ['Days <= -$500', selected.sessions_le_neg500],
  ]) {
    lines.push(`| ${label} | ${value} |`);
  }
  lines.push('');
  lines.push('## Top Risk-Constrained Rows');
  lines.push('');
  lines.push('| Rank | Profile | Rule | Total | Avg All | Avg Active | Median Active | Worst | DD | >=$300 | >=$500 | <=-$500 | Time | CL |');
  lines.push('|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|');
  topRows.slice(0, 20).forEach((row, index) => {
    lines.push(`| ${index + 1} | ${row.profile} | ${row.rule} | ${row.total_net} | ${row.avg_all_sessions} | ${row.avg_active_session} | ${row.median_active_session} | ${row.worst_session} | ${row.max_drawdown_active_order} | ${row.sessions_ge_300} | ${row.sessions_ge_500} | ${row.sessions_le_neg500} | ${row.time_mode} | ${row.max_consecutive_losses} |`);
  });
  lines.push('');
  lines.push('## Top Median Active-Day Rows');
  lines.push('');
  lines.push('| Rank | Profile | Rule | Total | Avg All | Avg Active | Median Active | Active Sessions | Worst | DD |');
  lines.push('|---:|---|---|---:|---:|---:|---:|---:|---:|---:|');
  topMedianRows.slice(0, 12).forEach((row, index) => {
    lines.push(`| ${index + 1} | ${row.profile} | ${row.rule} | ${row.total_net} | ${row.avg_all_sessions} | ${row.avg_active_session} | ${row.median_active_session} | ${row.active_sessions} | ${row.worst_session} | ${row.max_drawdown_active_order} |`);
  });
  lines.push('');
  lines.push('## Selected Daily Results');
  lines.push('');
  lines.push('| Date | Net | Fills | Winners | Losers | Stops | Exit Reason |');
  lines.push('|---|---:|---:|---:|---:|---:|---|');
  for (const row of selectedDays) {
    lines.push(`| ${row.date} | ${row.net} | ${row.fills} | ${row.winners} | ${row.losers} | ${row.stops} | ${row.exit_reason} |`);
  }
  lines.push('');
  lines.push('## Baseline Comparison');
  lines.push('');
  lines.push(`Strict unbounded baseline from the same generated profile trades: \`${strictBaseline.profile}\` / \`${strictBaseline.rule}\` net $${strictBaseline.total_net}, avg all $${strictBaseline.avg_all_sessions}, avg active $${strictBaseline.avg_active_session}, median active $${strictBaseline.median_active_session}, worst $${strictBaseline.worst_session}, max DD $${strictBaseline.max_drawdown_active_order}.`);
  lines.push('');
  lines.push('## What This Does Not Prove');
  lines.push('');
  lines.push('- It is still 1m OHLCV replay, not tick data. Mixed target/stop minutes are handled conservatively upstream.');
  lines.push('- It tests generated strategy trades, not broker fill logs.');
  lines.push('- It does not prove TradingView alert delivery, tunnel durability, Ninja order acceptance, or live fill quality.');
  lines.push('- It is a candidate for autonomous dry-fire, not a capital scaling proof.');
  lines.push('');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), `${lines.join('\n')}\n`, 'utf8');
}

function compactDayRows(rows) {
  return rows.map(({ kept_rows: _keptRows, ...row }) => row);
}

function main() {
  ensureDir(OUT_DIR);
  const tradesPath = path.join(IN_DIR, 'profile-trades.csv');
  const rows = readCsv(tradesPath);
  const byProfile = groupByProfileAndDay(rows);
  const rules = buildRules();
  const summaries = [];
  const dayOutputs = [];
  for (const [profile, daysMap] of byProfile.entries()) {
    for (const rule of rules) {
      const summary = summarizeRule(profile, rule, daysMap);
      summaries.push(summary);
      if (rule.name === 'unbounded') {
        for (const [date, dayRows] of daysMap.entries()) {
          const result = applyDailyRule(dayRows, rule);
          if (result.fills > 0) dayOutputs.push({ profile, rule: rule.name, date, ...result });
        }
      }
    }
  }
  const selected = selectAutonomousCandidate(summaries);
  const medianSelected = selectMedianCandidate(summaries);
  const selectedProfileDays = byProfile.get(selected.profile);
  const selectedRule = rules.find((rule) => rule.name === selected.rule);
  const selectedDays = [...selectedProfileDays.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayRows]) => ({ profile: selected.profile, rule: selected.rule, date, ...applyDailyRule(dayRows, selectedRule) }))
    .filter((row) => row.fills > 0);
  const compactSelectedDays = compactDayRows(selectedDays);
  const topRows = summaries.slice()
    .filter((row) => row.active_sessions >= 8 && row.avg_all_sessions >= 100 && row.worst_session >= -500 && row.sessions_le_neg500 === 0 && row.max_drawdown_active_order >= -800)
    .sort((a, b) => (
      b.avg_all_sessions - a.avg_all_sessions
      || b.median_active_session - a.median_active_session
      || b.total_net - a.total_net
      || b.worst_session - a.worst_session
    ));
  const topMedianRows = summaries.slice()
    .filter((row) => row.active_sessions >= 8 && row.avg_all_sessions >= 100 && row.worst_session >= -500 && row.sessions_le_neg500 === 0 && row.max_drawdown_active_order >= -800)
    .sort((a, b) => (
      b.median_active_session - a.median_active_session
      || b.avg_all_sessions - a.avg_all_sessions
      || b.total_net - a.total_net
      || b.worst_session - a.worst_session
    ));
  const strictBaseline = summaries.find((row) => row.profile === 'scalps_2_5pt_swing_split' && row.rule === 'unbounded') || selected;
  writeCsv(path.join(OUT_DIR, 'risk-sweep.csv'), summaries.sort((a, b) => (
    b.median_active_session - a.median_active_session
    || b.avg_all_sessions - a.avg_all_sessions
  )));
  writeCsv(path.join(OUT_DIR, 'selected-daily-results.csv'), compactSelectedDays);
  writeCsv(path.join(OUT_DIR, 'unbounded-daily-results.csv'), dayOutputs);
  const generatedAt = new Date().toISOString();
  const payload = {
    generated_at: generatedAt,
    source_trades: path.relative(ROOT, tradesPath).replace(/\\/g, '/'),
    complete_sessions: COMPLETE_SESSIONS,
    selection_constraints: {
      active_sessions_gte: 8,
      avg_all_sessions_gte: 100,
      worst_session_gte: -500,
      sessions_le_neg500: 0,
      max_drawdown_active_order_gte: -800,
    },
    selected,
    median_selected: medianSelected,
    top_rows: topRows.slice(0, 20),
    top_median_rows: topMedianRows.slice(0, 12),
    selected_days: compactSelectedDays,
    strict_baseline: strictBaseline,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(payload, null, 2), 'utf8');
  writeReport({ generatedAt, selected, medianSelected, topRows, topMedianRows, selectedDays: compactSelectedDays, strictBaseline });
  console.log(JSON.stringify(payload, null, 2));
}

main();
