'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GRID_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-vA-dynamic-level-grid');
const RISK_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-vA-autonomous-risk-sweep');
const PROTOCOL_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-context-protocol');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-v0b-strategy-comparison');
const COMPLETE_SESSIONS = 48;

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines.shift());
  return lines.map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }
  const headers = Object.keys(rows[0]);
  fs.writeFileSync(filePath, [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n'), 'utf8');
}

function readCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function summarizeDayRows(dayRows) {
  const active = dayRows.filter((row) => n(row.net) !== 0 || n(row.fills) > 0);
  const nets = active.map((row) => n(row.net));
  const totalNet = nets.reduce((sum, value) => sum + value, 0);
  const worst = nets.length ? Math.min(...nets) : 0;
  const best = nets.length ? Math.max(...nets) : 0;
  return {
    total_net: round2(totalNet),
    avg_all_sessions: round2(totalNet / COMPLETE_SESSIONS),
    active_sessions: active.length,
    avg_active_session: round2(totalNet / (active.length || 1)),
    median_active_session: round2(median(nets)),
    worst_active_session: round2(worst),
    best_active_session: round2(best),
    sessions_ge_100: active.filter((row) => n(row.net) >= 100).length,
    sessions_ge_200: active.filter((row) => n(row.net) >= 200).length,
    sessions_ge_300: active.filter((row) => n(row.net) >= 300).length,
    sessions_ge_400: active.filter((row) => n(row.net) >= 400).length,
    sessions_ge_500: active.filter((row) => n(row.net) >= 500).length,
    sessions_le_neg300: active.filter((row) => n(row.net) <= -300).length,
    sessions_le_neg500: active.filter((row) => n(row.net) <= -500).length,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profileDays = readCsv(path.join(GRID_DIR, 'profile-day-results.csv'));
  const profileSweep = readCsv(path.join(GRID_DIR, 'profile-sweep.csv'));
  const riskSummary = JSON.parse(fs.readFileSync(path.join(RISK_DIR, 'summary.json'), 'utf8'));
  const roleSummary = readCsv(path.join(PROTOCOL_DIR, 'summary-by-role.csv'));

  const byDate = groupBy(profileDays, 'date');
  const oracleRows = [];
  for (const [date, rows] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const best = rows.slice().sort((a, b) => n(b.net) - n(a.net))[0];
    const current = rows.find((row) => row.profile === 'current_all_split_stop3');
    const currentNet = current ? n(current.net) : 0;
    oracleRows.push({
      date,
      best_profile: best.profile,
      best_net: round2(n(best.net)),
      current_net: round2(currentNet),
      advantage_vs_current: round2(n(best.net) - currentNet),
      fills: best.fills,
      winners: best.winners,
      stops: best.stops,
    });
  }

  const oracleSummary = summarizeDayRows(oracleRows.map((row) => ({
    net: row.best_net,
    fills: row.fills,
  })));

  const profileRanking = profileSweep.map((row) => ({
    profile: row.profile,
    net_dollars: round2(n(row.net_dollars)),
    avg_all_sessions: round2(n(row.avg_complete_session_net)),
    active_sessions: n(row.sessions_with_fills),
    avg_active_session: round2(n(row.avg_active_session_net)),
    win_rate: round2(n(row.win_rate)),
    stopped_pre_tp1: n(row.stopped_pre_tp1),
    sessions_ge_500: n(row.sessions_ge_500),
    sessions_le_neg500: n(row.sessions_le_neg500),
    avg_mfe: round2(n(row.avg_mfe)),
    avg_mae: round2(n(row.avg_mae)),
  })).sort((a, b) => (
    b.avg_all_sessions - a.avg_all_sessions
    || b.net_dollars - a.net_dollars
  ));

  const selectedStatic = profileRanking[0];
  const currentStatic = profileRanking.find((row) => row.profile === 'current_all_split_stop3');
  const v5Proxy = currentStatic;
  const v6Proxy = currentStatic;
  const laterObjective = profileRanking.find((row) => row.profile === 'scalps_2_5pt_swing_split');
  const saferScalpOnly = profileRanking.find((row) => row.profile === 'futures_scalp_only_all_tp1_stop3_5');

  const deployableRows = [currentStatic, laterObjective, saferScalpOnly]
    .filter(Boolean)
    .map((row) => ({
      profile: row.profile,
      avg_all_sessions: row.avg_all_sessions,
      avg_active_session: row.avg_active_session,
      active_sessions: row.active_sessions,
      win_rate: row.win_rate,
      sessions_ge_500: row.sessions_ge_500,
      sessions_le_neg500: row.sessions_le_neg500,
      note: row.profile === 'current_all_split_stop3'
        ? 'closest proxy for first longer-log protocol and current split runner'
        : row.profile === 'scalps_2_5pt_swing_split'
          ? 'highest static all-session net in refreshed profile grid'
          : 'higher win-rate scalp-only alternative with lower active median',
    }));

  const payload = {
    generated_at: new Date().toISOString(),
    complete_sessions: COMPLETE_SESSIONS,
    source_files: {
      profile_day_results: path.relative(ROOT, path.join(GRID_DIR, 'profile-day-results.csv')).replace(/\\/g, '/'),
      profile_sweep: path.relative(ROOT, path.join(GRID_DIR, 'profile-sweep.csv')).replace(/\\/g, '/'),
      risk_summary: path.relative(ROOT, path.join(RISK_DIR, 'summary.json')).replace(/\\/g, '/'),
      role_summary: path.relative(ROOT, path.join(PROTOCOL_DIR, 'summary-by-role.csv')).replace(/\\/g, '/'),
    },
    chronological_version_map: [
      {
        pine: 'LUKE-WATCH-FLAGSHIP-v5-MANCINI-PROTOCOL-SCALP-SWING.pine',
        meaning: 'first longer-log Mancini protocol Pine',
        tested_proxy: 'current_all_split_stop3',
        caveat: 'offline grid uses 1m replay and retest-limit style fills; exact Pine v5 same-bar LTF gate is not proven identical',
      },
      {
        pine: 'LUKE-MANCINI-FLAGSHIP-v6-CONFIRMED-RETEST-LIMIT-NINJA-DRYFIRE.pine',
        meaning: 'next chronological confirmed retest-limit Pine',
        tested_proxy: 'current_all_split_stop3',
        caveat: 'closest current split-runner profile under refreshed dynamic grid',
      },
      {
        pine: 'LUKE-MANCINI-OBJECTIVITY-MAX-NET-vA-SCALP-2_5-SWING-SPLIT.pine',
        meaning: 'later objective/max-net experiment',
        tested_proxy: 'scalps_2_5pt_swing_split',
        caveat: 'different exit plan: scalp classes all out at +2.5 points',
      },
    ],
    longer_log_role_summary: roleSummary,
    selected_static_profile: selectedStatic,
    current_profile: currentStatic,
    first_longer_log_proxy: v5Proxy,
    next_chronological_proxy: v6Proxy,
    later_objective_profile: laterObjective,
    safer_scalp_only_profile: saferScalpOnly,
    daily_oracle_upper_bound: oracleSummary,
    risk_sweep_selected: riskSummary.selected,
    deployable_rows: deployableRows,
  };

  writeCsv(path.join(OUT_DIR, 'daily-oracle-best-profile.csv'), oracleRows);
  writeCsv(path.join(OUT_DIR, 'static-profile-ranking.csv'), profileRanking);
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# Mancini v0b Strategy Comparison');
  lines.push('');
  lines.push(`Generated: ${payload.generated_at}`);
  lines.push('');
  lines.push('## Bottom Line');
  lines.push('');
  lines.push(`Best static refreshed profile: \`${selectedStatic.profile}\`, avg all 48 sessions $${selectedStatic.avg_all_sessions}, avg active $${selectedStatic.avg_active_session}, win rate ${selectedStatic.win_rate}%, sessions <= -$500 ${selectedStatic.sessions_le_neg500}.`);
  lines.push('');
  lines.push(`Daily oracle upper bound: avg all 48 sessions $${oracleSummary.avg_all_sessions}, avg active $${oracleSummary.avg_active_session}, median active $${oracleSummary.median_active_session}. This is a hindsight ceiling, not a live strategy.`);
  lines.push('');
  lines.push('A live selector must use only information available before or during the session. Choosing the best profile after the session is a research upper bound and would cheat if converted directly to Pine or Ninja.');
  lines.push('');
  lines.push('## Chronological Version Map');
  lines.push('');
  lines.push('| Pine | Tested Proxy | Result Interpretation |');
  lines.push('|---|---|---|');
  for (const row of payload.chronological_version_map) {
    lines.push(`| \`${row.pine}\` | \`${row.tested_proxy}\` | ${row.meaning}. ${row.caveat}. |`);
  }
  lines.push('');
  lines.push('## Deployable Candidates');
  lines.push('');
  lines.push('| Profile | Avg All Sessions | Avg Active | Active Sessions | Win Rate | >= $500 Days | <= -$500 Days | Note |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|');
  for (const row of deployableRows) {
    lines.push(`| \`${row.profile}\` | $${row.avg_all_sessions} | $${row.avg_active_session} | ${row.active_sessions}/48 | ${row.win_rate}% | ${row.sessions_ge_500} | ${row.sessions_le_neg500} | ${row.note} |`);
  }
  lines.push('');
  lines.push('## Longer-Log Role Evidence');
  lines.push('');
  lines.push('| Role | Entries | Median MFE 30m | Hit 2pt 30m | Hit 4pt 30m | Hit 8pt 30m | Avg MAE 30m |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const row of roleSummary) {
    lines.push(`| ${row.primary_role} | ${row.entries} | ${row.median_mfe_30m || ''} | ${row.hit_2pt_30m_rate}% | ${row.hit_4pt_30m_rate}% | ${row.hit_8pt_30m_rate}% | ${row.avg_mae_30m} |`);
  }
  lines.push('');
  lines.push('## Daily Oracle Upper Bound');
  lines.push('');
  lines.push('| Date | Best Profile | Best Net | Current Net | Advantage |');
  lines.push('|---|---|---:|---:|---:|');
  for (const row of oracleRows) {
    lines.push(`| ${row.date} | \`${row.best_profile}\` | $${row.best_net} | $${row.current_net} | $${row.advantage_vs_current} |`);
  }
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`For an autonomous test right now, the report still points to \`${selectedStatic.profile}\` as the highest static net profile, but the mismatch between TradingView behavior and offline replay means it should not replace the green control until Pine-vs-replay event parity is proven.`);
  lines.push('');
  lines.push('The useful implementation from this report is not a hindsight daily switch. It is a two-lane next test: keep the green control as baseline, and shadow the 2.5-point scalp/swing profile with identical level inputs and event logging. Only promote it if live/replay parity holds over several sessions.');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), lines.join('\n'), 'utf8');

  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  main();
}
