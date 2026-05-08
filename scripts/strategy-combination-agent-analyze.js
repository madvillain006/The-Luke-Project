const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'strategy-combination-agent');
const COMPLETE_SESSIONS_FALLBACK = 48;
const CURRENT_PROFILE = 'current_all_split_stop3';

const INPUTS = {
  profileSweep: 'artifacts/research/mancini-vA-dynamic-level-grid/profile-sweep.csv',
  profileThresholds: 'artifacts/research/mancini-vA-dynamic-level-grid/profile-thresholds.csv',
  profileDayResults: 'artifacts/research/mancini-vA-dynamic-level-grid/profile-day-results.csv',
  profileTrades: 'artifacts/research/mancini-vA-dynamic-level-grid/profile-trades.csv',
  dailyOracle: 'artifacts/research/mancini-v0b-strategy-comparison/daily-oracle-best-profile.csv',
  v0bStatic: 'artifacts/research/mancini-v0b-strategy-comparison/static-profile-ranking.csv',
  contextEvents: 'artifacts/research/mancini-context-protocol/events.csv',
  contextRoles: 'artifacts/research/mancini-context-protocol/summary-by-role.csv',
  contextLevels: 'artifacts/research/mancini-context-protocol/level-protocol.csv',
  vaSummary: 'artifacts/research/mancini-vA-dynamic-level-grid/summary.json',
  v0bSummary: 'artifacts/research/mancini-v0b-strategy-comparison/summary.json',
};

function abs(rel) {
  return path.join(ROOT, rel);
}

function readText(rel) {
  return fs.readFileSync(abs(rel), 'utf8');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => v !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const out = {};
    headers.forEach((header, idx) => {
      out[header] = values[idx] ?? '';
    });
    return out;
  });
}

function readCsv(rel) {
  return parseCsv(readText(rel));
}

function num(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/[$,%]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return round2((numerator / denominator) * 100);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function profileFamily(profile) {
  if (profile.startsWith('swing_mancini_only')) return 'swing_only';
  if (profile.startsWith('futures_scalp_valid_only')) return 'scalp_valid_only';
  if (profile.startsWith('futures_scalp_major_only')) return 'scalp_major_only';
  if (profile.startsWith('futures_scalp_only')) return 'scalp_only';
  if (profile.startsWith('scalps_')) return 'scalp_plus_swing';
  if (profile === CURRENT_PROFILE) return 'control';
  if (profile.startsWith('all_classes')) return 'all_classes';
  return 'other';
}

function isScalpClass(row) {
  return row.class === 'SCALP_VALID' || row.class === 'SCALP_MAJOR';
}

function isSwingClass(row) {
  return row.class === 'MANCINI_RECLAIM';
}

function isFilled(row) {
  return row.status && row.status !== 'no_fill' && !row.status.startsWith('suppressed');
}

function signalMinute(row) {
  const raw = row.signal_et || row.entry_et || '';
  const match = raw.match(/\s(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeBucket(row) {
  const minute = signalMinute(row);
  if (minute === null) return 'missing_time';
  const signalDate = String(row.signal_et || '').slice(0, 10);
  if (signalDate && row.plan_date && signalDate < row.plan_date) return 'overnight_prior_evening';
  if (minute < 9 * 60 + 30) return 'pre_0930';
  if (minute < 11 * 60) return 'open_0930_1100';
  if (minute < 13 * 60) return 'mid_1100_1300';
  return 'afternoon_1300_plus';
}

function stopDistanceBucket(row) {
  const distance = Math.abs(num(row.entry) - num(row.stop));
  if (!distance) return 'missing';
  if (distance <= 3) return 'stop_le_3';
  if (distance <= 3.5) return 'stop_3_to_3_5';
  if (distance <= 5) return 'stop_3_5_to_5';
  return 'stop_gt_5';
}

function satyDistanceBucket(value) {
  const distance = Math.abs(num(value));
  if (!distance) return 'missing';
  if (distance <= 2) return 'saty_le_2';
  if (distance <= 4) return 'saty_2_to_4';
  if (distance <= 8) return 'saty_4_to_8';
  return 'saty_gt_8';
}

function equityMetrics(dayRows, completeSessions) {
  const byDate = new Map();
  for (const row of dayRows) {
    const date = row.date || row.plan_date;
    if (!date) continue;
    byDate.set(date, round2((byDate.get(date) || 0) + num(row.net ?? row.net_dollars)));
  }

  const active = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const nets = active.map(([, value]) => value);
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of nets) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  const total = round2(nets.reduce((sum, value) => sum + value, 0));
  const activeSessions = nets.filter((value) => value !== 0).length;
  const sorted = [...nets].sort((a, b) => a - b);
  return {
    total_net: total,
    avg_all_sessions: round2(total / completeSessions),
    active_sessions: activeSessions,
    avg_active_session: activeSessions ? round2(total / activeSessions) : 0,
    median_active_session: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    best_session: sorted.length ? sorted[sorted.length - 1] : 0,
    worst_session: sorted.length ? sorted[0] : 0,
    positive_active_sessions: nets.filter((value) => value > 0).length,
    negative_active_sessions: nets.filter((value) => value < 0).length,
    sessions_ge_500: nets.filter((value) => value >= 500).length,
    sessions_le_neg500: nets.filter((value) => value <= -500).length,
    max_drawdown_active_order: round2(maxDrawdown),
  };
}

function aggregateRows(rows) {
  const fills = rows.filter(isFilled);
  const winners = fills.filter((row) => num(row.net_dollars) > 0);
  const stopped = fills.filter((row) => row.status === 'stopped_pre_tp1' || num(row.net_dollars) < 0);
  const net = round2(rows.reduce((sum, row) => sum + num(row.net_dollars), 0));
  return {
    rows: rows.length,
    fills: fills.length,
    winners: winners.length,
    stopped: stopped.length,
    net_dollars: net,
    avg_per_fill: fills.length ? round2(net / fills.length) : 0,
    win_rate: pct(winners.length, fills.length),
    stop_rate: pct(stopped.length, fills.length),
    avg_mfe: fills.length ? round2(fills.reduce((sum, row) => sum + num(row.mfe), 0) / fills.length) : 0,
    avg_mae: fills.length ? round2(fills.reduce((sum, row) => sum + num(row.mae), 0) / fills.length) : 0,
  };
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function csvEscape(value) {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(fileName, rows) {
  const fullPath = path.join(OUT_DIR, fileName);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
  fs.writeFileSync(fullPath, `${body}\n`);
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => row[header] ?? '').join(' | ')} |`),
  ].join('\n');
}

function topN(rows, n, key) {
  return [...rows].sort((a, b) => num(b[key]) - num(a[key])).slice(0, n);
}

function joinContext(trades, events, levels) {
  const byKey = new Map();
  for (const row of [...events, ...levels]) {
    const date = row.plan_date;
    const price = num(row.price || row.level);
    if (!date || !price) continue;
    const key = `${date}|${round2(price)}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  return trades.map((trade) => {
    const key = `${trade.plan_date}|${round2(num(trade.level))}`;
    const context = byKey.get(key) || {};
    return {
      ...trade,
      context_primary_role: context.primary_role || '',
      context_tags: context.tags || '',
      context_saty_valid: context.saty_valid || '',
      context_nearest_saty_distance: context.nearest_saty_distance || '',
      context_event_status: context.event_status || '',
      context_sweep_depth_points: context.sweep_depth_points || '',
      context_entry_model: context.entry_model || '',
    };
  });
}

function featureBuckets(rows, featureName, keyFn) {
  return [...groupBy(rows, keyFn).entries()]
    .map(([value, bucketRows]) => ({
      feature: featureName,
      value,
      ...aggregateRows(bucketRows),
    }))
    .sort((a, b) => a.feature.localeCompare(b.feature) || num(b.fills) - num(a.fills));
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const profileSweep = readCsv(INPUTS.profileSweep);
  const profileThresholds = readCsv(INPUTS.profileThresholds);
  const profileDayResults = readCsv(INPUTS.profileDayResults);
  const profileTrades = readCsv(INPUTS.profileTrades);
  const dailyOracle = readCsv(INPUTS.dailyOracle);
  const v0bStatic = readCsv(INPUTS.v0bStatic);
  const contextEvents = readCsv(INPUTS.contextEvents);
  const contextRoles = readCsv(INPUTS.contextRoles);
  const contextLevels = readCsv(INPUTS.contextLevels);
  const vaSummary = JSON.parse(readText(INPUTS.vaSummary));
  const v0bSummary = JSON.parse(readText(INPUTS.v0bSummary));
  const completeSessions = num(vaSummary.metadata?.complete_sessions) || COMPLETE_SESSIONS_FALLBACK;

  const thresholdByProfile = new Map(profileThresholds.map((row) => [row.profile, row]));
  const profileRanking = profileSweep.map((row, index) => {
    const risk = thresholdByProfile.get(row.profile) || {};
    return {
      rank: index + 1,
      profile: row.profile,
      family: profileFamily(row.profile),
      net_dollars: num(row.net_dollars),
      avg_all_sessions: num(row.avg_complete_session_net),
      avg_active_session: num(row.avg_active_session_net),
      win_rate: num(row.win_rate),
      filled: num(row.filled),
      stopped_pre_tp1: num(row.stopped_pre_tp1),
      sessions_ge_500: num(row.sessions_ge_500),
      sessions_le_neg500: num(row.sessions_le_neg500),
      worst_session: num(risk.worst_session),
      max_drawdown_active_order: num(risk.max_drawdown_active_order),
      top3_contribution_pct: num(risk.top3_contribution_pct),
      avg_mfe: num(row.avg_mfe),
      avg_mae: num(row.avg_mae),
    };
  });
  writeCsv('profile-ranking-drawdown.csv', profileRanking);

  const byDate = groupBy(profileDayResults, (row) => row.date);
  const profileDayWinners = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const sorted = [...rows].sort((a, b) => num(b.net) - num(a.net));
      const current = rows.find((row) => row.profile === CURRENT_PROFILE) || {};
      return {
        date,
        winner_profile: sorted[0]?.profile || '',
        winner_net: num(sorted[0]?.net),
        second_profile: sorted[1]?.profile || '',
        second_net: num(sorted[1]?.net),
        third_profile: sorted[2]?.profile || '',
        third_net: num(sorted[2]?.net),
        current_net: num(current.net),
        winner_minus_current: round2(num(sorted[0]?.net) - num(current.net)),
      };
    });
  writeCsv('profile-day-winners.csv', profileDayWinners);

  const winnerFrequency = [...groupBy(profileDayWinners, (row) => row.winner_profile).entries()]
    .map(([profile, rows]) => ({
      profile,
      winner_days: rows.length,
      avg_winner_net: round2(rows.reduce((sum, row) => sum + num(row.winner_net), 0) / rows.length),
      family: profileFamily(profile),
    }))
    .sort((a, b) => num(b.winner_days) - num(a.winner_days) || num(b.avg_winner_net) - num(a.avg_winner_net));

  const currentDayRows = profileDayResults.filter((row) => row.profile === CURRENT_PROFILE);
  const currentLossDays = currentDayRows
    .filter((row) => num(row.net) < 0)
    .map((row) => {
      const winner = profileDayWinners.find((day) => day.date === row.date) || {};
      return {
        date: row.date,
        current_net: num(row.net),
        current_fills: num(row.fills),
        current_winners: num(row.winners),
        current_stops: num(row.stops),
        oracle_winner_profile: winner.winner_profile,
        oracle_winner_net: winner.winner_net,
        oracle_delta: winner.winner_minus_current,
      };
    });
  writeCsv('current-control-losing-days.csv', currentLossDays);

  const enrichedTrades = joinContext(profileTrades, contextEvents, contextLevels);
  const currentTrades = enrichedTrades.filter((row) => row.profile === CURRENT_PROFILE);
  const currentFilled = currentTrades.filter(isFilled);
  const currentLosingTrades = currentFilled.filter((row) => num(row.net_dollars) < 0);
  const currentLossTradeRows = currentLosingTrades.map((row) => ({
    plan_date: row.plan_date,
    signal_et: row.signal_et,
    class: row.class,
    priority: row.priority,
    source_count: row.source_count,
    level: row.level,
    status: row.status,
    net_dollars: num(row.net_dollars),
    mfe: num(row.mfe),
    mae: num(row.mae),
    time_bucket: timeBucket(row),
    context_primary_role: row.context_primary_role,
    context_tags: row.context_tags,
    context_saty_valid: row.context_saty_valid,
    context_nearest_saty_distance: row.context_nearest_saty_distance,
  }));
  writeCsv('current-control-losing-trades.csv', currentLossTradeRows);

  const featureRows = [
    ...featureBuckets(currentFilled, 'class', (row) => row.class),
    ...featureBuckets(currentFilled, 'priority', (row) => `priority_${row.priority || 'missing'}`),
    ...featureBuckets(currentFilled, 'source_count', (row) => `source_count_${row.source_count || 'missing'}`),
    ...featureBuckets(currentFilled, 'signal_time_bucket', timeBucket),
    ...featureBuckets(currentFilled, 'stop_distance', stopDistanceBucket),
    ...featureBuckets(currentFilled, 'context_primary_role', (row) => row.context_primary_role || 'missing_context'),
    ...featureBuckets(currentFilled, 'context_saty_valid', (row) => row.context_saty_valid || 'missing_context'),
    ...featureBuckets(currentFilled, 'context_saty_distance', (row) => satyDistanceBucket(row.context_nearest_saty_distance)),
    ...featureBuckets(currentFilled, 'context_tag_caution', (row) => (String(row.context_tags).includes('caution') ? 'has_caution' : 'no_caution_or_missing')),
  ];
  writeCsv('selector-feature-buckets.csv', featureRows);

  const scalpProfiles = [
    'scalps_2_5pt_swing_split',
    'scalps_all_tp1_stop3_5_swing_split',
    'scalps_1_5pt_tighter_swing_split',
    'futures_scalp_only_all_tp1_stop3_5',
    'futures_scalp_only_all_tp1_stop3',
    'futures_scalp_valid_only_all_tp1_stop3_5',
    'all_classes_all_tp1_stop3',
    CURRENT_PROFILE,
  ].filter((profile) => profileSweep.some((row) => row.profile === profile));

  const swingProfiles = [
    'swing_mancini_only_split_tp3_stop5',
    'swing_mancini_only_split_tp3_stop4',
    'swing_mancini_only_split_stop5',
    'swing_mancini_only_split_stop4',
    'swing_mancini_only_split_stop3',
    'swing_mancini_only_all_tp1_stop3',
    CURRENT_PROFILE,
  ].filter((profile) => profileSweep.some((row) => row.profile === profile));

  const componentCombos = [];
  for (const scalpProfile of scalpProfiles) {
    for (const swingProfile of swingProfiles) {
      const scalpRows = profileTrades.filter((row) => row.profile === scalpProfile && isScalpClass(row));
      const swingRows = profileTrades.filter((row) => row.profile === swingProfile && isSwingClass(row));
      const selected = [...scalpRows, ...swingRows];
      const dayRows = [...groupBy(selected, (row) => row.plan_date).entries()].map(([date, rows]) => ({
        date,
        net: round2(rows.reduce((sum, row) => sum + num(row.net_dollars), 0)),
      }));
      const metrics = equityMetrics(dayRows, completeSessions);
      const scalpAgg = aggregateRows(scalpRows);
      const swingAgg = aggregateRows(swingRows);
      componentCombos.push({
        selector: `${scalpProfile}__scalps_PLUS__${swingProfile}__mancini`,
        selector_type: 'component_hybrid_approximation',
        scalp_profile: scalpProfile,
        swing_profile: swingProfile,
        ...metrics,
        scalp_component_net: scalpAgg.net_dollars,
        swing_component_net: swingAgg.net_dollars,
        scalp_fills: scalpAgg.fills,
        swing_fills: swingAgg.fills,
      });
    }
  }

  const staticCandidates = profileRanking.map((row) => ({
    selector: row.profile,
    selector_type: 'directly_tested_static_profile',
    scalp_profile: '',
    swing_profile: '',
    total_net: row.net_dollars,
    avg_all_sessions: row.avg_all_sessions,
    active_sessions: num(thresholdByProfile.get(row.profile)?.active_sessions),
    avg_active_session: row.avg_active_session,
    median_active_session: num(thresholdByProfile.get(row.profile)?.median_active_session),
    best_session: num(thresholdByProfile.get(row.profile)?.best_session),
    worst_session: row.worst_session,
    positive_active_sessions: num(thresholdByProfile.get(row.profile)?.positive_active_sessions),
    negative_active_sessions: num(thresholdByProfile.get(row.profile)?.negative_active_sessions),
    sessions_ge_500: row.sessions_ge_500,
    sessions_le_neg500: row.sessions_le_neg500,
    max_drawdown_active_order: row.max_drawdown_active_order,
    scalp_component_net: '',
    swing_component_net: '',
    scalp_fills: '',
    swing_fills: '',
  }));

  const selectorCandidates = [...staticCandidates, ...componentCombos]
    .sort((a, b) => num(b.total_net) - num(a.total_net));
  writeCsv('selector-combination-candidates.csv', selectorCandidates);

  const noHindsightRules = [
    {
      rule: 'static_scalps_2_5pt_swing_split',
      status: 'deployable_candidate_after parity proof',
      lookahead: 'none in selector; profile chosen before session',
      evidence: 'directly tested static profile',
      net_dollars: num(profileRanking.find((row) => row.profile === 'scalps_2_5pt_swing_split')?.net_dollars),
    },
    {
      rule: 'static_futures_scalp_only_all_tp1_stop3_5',
      status: 'deployable_candidate_after parity proof',
      lookahead: 'none in selector; profile chosen before session',
      evidence: 'directly tested static profile',
      net_dollars: num(profileRanking.find((row) => row.profile === 'futures_scalp_only_all_tp1_stop3_5')?.net_dollars),
    },
    {
      rule: 'class_router_scalp_profile_plus_swing_profile',
      status: 'research_candidate_only',
      lookahead: 'uses pre-trade class label only, but result is component approximation',
      evidence: 'computed from profile-trade class rows; must be retested in replay engine',
      net_dollars: num(componentCombos[0]?.total_net),
    },
    {
      rule: 'daily_oracle_best_profile',
      status: 'hindsight ceiling only',
      lookahead: 'cheats by choosing after session outcome',
      evidence: 'v0b daily oracle upper bound',
      net_dollars: num(v0bSummary.daily_oracle_upper_bound?.total_net),
    },
  ];
  writeCsv('selector-rule-lookahead-audit.csv', noHindsightRules);

  const topCombos = topN(selectorCandidates, 12, 'total_net');
  const topDirect = topN(staticCandidates, 8, 'total_net');
  const topHybrid = topN(componentCombos, 8, 'total_net');
  const weakBuckets = featureRows
    .filter((row) => num(row.fills) >= 5)
    .sort((a, b) => num(a.net_dollars) - num(b.net_dollars))
    .slice(0, 10);
  const strongBuckets = featureRows
    .filter((row) => num(row.fills) >= 5)
    .sort((a, b) => num(b.net_dollars) - num(a.net_dollars))
    .slice(0, 10);
  const oracleSummary = {
    total_net: num(v0bSummary.daily_oracle_upper_bound?.total_net),
    avg_all_sessions: num(v0bSummary.daily_oracle_upper_bound?.avg_all_sessions),
    avg_active_session: num(v0bSummary.daily_oracle_upper_bound?.avg_active_session),
    worst_active_session: num(v0bSummary.daily_oracle_upper_bound?.worst_active_session),
    sessions_ge_500: num(v0bSummary.daily_oracle_upper_bound?.sessions_ge_500),
  };

  const analysis = {
    generated_at: new Date().toISOString(),
    complete_sessions: completeSessions,
    inputs: INPUTS,
    profile_count: profileSweep.length,
    active_backtest_days: profileDayWinners.length,
    current_loss_total: round2(currentLossDays.reduce((sum, row) => sum + num(row.current_net), 0)),
    profile_ranking_top_8: topDirect,
    winner_frequency: winnerFrequency,
    current_losing_days: currentLossDays,
    daily_oracle_upper_bound: oracleSummary,
    top_selector_candidates: topCombos,
    top_component_hybrid_approximations: topHybrid,
    weakest_current_feature_buckets: weakBuckets,
    strongest_current_feature_buckets: strongBuckets,
    role_summary: contextRoles,
    caveats: [
      'Daily oracle rows are hindsight only and cannot be converted directly to a live selector.',
      'Component hybrid rows are approximations from profile-trade class rows; profile-level suppression/open-trade interactions must be replayed before promotion.',
      'All reported backtests are 1m OHLC artifacts, not tick-level Ninja/live proof.',
    ],
  };
  writeJson('summary.json', analysis);

  const report = [
    '# Strategy Combination Agent Research',
    '',
    `Generated: ${analysis.generated_at}`,
    '',
    '## Scope',
    '',
    'Inputs inspected:',
    '',
    ...Object.values(INPUTS).map((rel) => `- \`${rel}\``),
    '- `data/research/mancini` raw log folder was inspected as source context for the context-protocol artifacts.',
    '',
    'No Pine or Ninja files were edited.',
    '',
    '## Best Directly Tested Profiles',
    '',
    mdTable(
      ['profile', 'family', 'net_dollars', 'avg_all_sessions', 'avg_active_session', 'sessions_ge_500', 'sessions_le_neg500', 'worst_session', 'max_drawdown_active_order'],
      topDirect.map((row) => ({
        profile: `\`${row.selector}\``,
        family: profileFamily(row.selector),
        net_dollars: `$${row.total_net}`,
        avg_all_sessions: `$${row.avg_all_sessions}`,
        avg_active_session: `$${row.avg_active_session}`,
        sessions_ge_500: row.sessions_ge_500,
        sessions_le_neg500: row.sessions_le_neg500,
        worst_session: `$${row.worst_session}`,
        max_drawdown_active_order: `$${row.max_drawdown_active_order}`,
      })),
    ),
    '',
    '## Day Winner Reality Check',
    '',
    `Active tested days: ${profileDayWinners.length}. Daily oracle upper bound: $${oracleSummary.total_net}, avg all sessions $${oracleSummary.avg_all_sessions}, avg active $${oracleSummary.avg_active_session}, worst active day $${oracleSummary.worst_active_session}. This is a hindsight ceiling, not a deployable rule.`,
    '',
    mdTable(
      ['profile', 'winner_days', 'avg_winner_net', 'family'],
      winnerFrequency.slice(0, 8).map((row) => ({
        profile: `\`${row.profile}\``,
        winner_days: row.winner_days,
        avg_winner_net: `$${row.avg_winner_net}`,
        family: row.family,
      })),
    ),
    '',
    '## Current Control Losses',
    '',
    `The current control lost money on ${currentLossDays.length} active days for a combined $${analysis.current_loss_total}. These days explain the control drawdown problem more than the trade win rate does.`,
    '',
    mdTable(
      ['date', 'current_net', 'current_fills', 'current_stops', 'oracle_winner_profile', 'oracle_delta'],
      currentLossDays.map((row) => ({
        date: row.date,
        current_net: `$${row.current_net}`,
        current_fills: row.current_fills,
        current_stops: row.current_stops,
        oracle_winner_profile: `\`${row.oracle_winner_profile}\``,
        oracle_delta: `$${row.oracle_delta}`,
      })),
    ),
    '',
    'Lowest current-control buckets with at least 5 fills:',
    '',
    mdTable(
      ['feature', 'value', 'fills', 'net_dollars', 'win_rate', 'stop_rate', 'avg_mfe', 'avg_mae'],
      weakBuckets.map((row) => ({
        feature: row.feature,
        value: row.value,
        fills: row.fills,
        net_dollars: `$${row.net_dollars}`,
        win_rate: `${row.win_rate}%`,
        stop_rate: `${row.stop_rate}%`,
        avg_mfe: row.avg_mfe,
        avg_mae: row.avg_mae,
      })),
    ),
    '',
    '## Scalp vs Swing Combination Candidates',
    '',
    'Direct static rows are the cleanest evidence because the replay actually tested them. Component hybrids below are useful selector hypotheses, but they must be re-run inside the replay engine because open-trade suppression can change when scalp and swing brackets are mixed.',
    '',
    mdTable(
      ['selector', 'selector_type', 'total_net', 'avg_all_sessions', 'worst_session', 'sessions_le_neg500', 'max_drawdown_active_order'],
      topCombos.slice(0, 10).map((row) => ({
        selector: `\`${row.selector}\``,
        selector_type: row.selector_type,
        total_net: `$${row.total_net}`,
        avg_all_sessions: `$${row.avg_all_sessions}`,
        worst_session: `$${row.worst_session}`,
        sessions_le_neg500: row.sessions_le_neg500,
        max_drawdown_active_order: `$${row.max_drawdown_active_order}`,
      })),
    ),
    '',
    '## Oracle vs Deployable',
    '',
    '- Deployable candidate: choose one static profile before the session, or route by pre-trade class/context fields already known at signal time.',
    '- Deployable candidate after replay proof: `SCALP_VALID` / `SCALP_MAJOR` use the 2.5-point scalp profile while `MANCINI_RECLAIM` stays split-runner or remains shadow-only.',
    '- Research-only: component hybrid totals in this report; they are not direct replay results yet.',
    '- Cheating: daily best-profile switching from `daily-oracle-best-profile.csv`; that chooses after seeing the day outcome.',
    '',
    '## Selector Features Worth Testing Next',
    '',
    '- `class`: separate `SCALP_VALID`, `SCALP_MAJOR`, and `MANCINI_RECLAIM`; do not force one bracket shape on all level types.',
    '- `signal_time_bucket`: losses and stops should be checked by overnight, pre-9:30, open, midday, and afternoon behavior before adding daily switches.',
    '- `priority` and `source_count`: these are available before entry and can gate lower-confidence levels without hindsight.',
    '- Mancini protocol fields: `primary_role`, `tags`, `long_eligible`, and caution/failed-breakdown tags from the daily plan.',
    '- SATY confluence: `saty_valid`, nearest SATY label, and nearest SATY distance; invalid SATY rows should remain non-proof.',
    '- Reclaim mechanics available before entry: sweep depth, same-bar reclaim flag, acceptance model, and time from touch/sweep to acceptance.',
    '',
    '## Output Files',
    '',
    '- `profile-ranking-drawdown.csv`',
    '- `profile-day-winners.csv`',
    '- `current-control-losing-days.csv`',
    '- `current-control-losing-trades.csv`',
    '- `selector-feature-buckets.csv`',
    '- `selector-combination-candidates.csv`',
    '- `selector-rule-lookahead-audit.csv`',
    '- `summary.json`',
    '- `report.md`',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), report);

  console.log(`Wrote strategy-combination research to ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`Profiles analyzed: ${profileSweep.length}`);
  console.log(`Active day winners analyzed: ${profileDayWinners.length}`);
  console.log(`Current losing days: ${currentLossDays.length}, net ${analysis.current_loss_total}`);
}

main();
