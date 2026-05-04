'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR, writeJson, writeCsv } = require('../common');
const { loadUsableSessions, loadHistoricalCsvBars, summarizeBars } = require('../corpus-loader');
const { buildSourceTimeline } = require('../source-timeline');
const { detectFakeBreakdownsForSession } = require('./detector');
const { computeTradeMetrics, summarizeGroup } = require('./metrics');

const STOP_BUFFER = 0.25;

function stopModels(candidate) {
  return [
    {
      stop_model: 'sweep_low_minus_buffer',
      stop_price: Math.round((candidate.sweep_low - STOP_BUFFER) * 100) / 100,
    },
    {
      stop_model: 'level_minus_fixed_buffer',
      stop_price: Math.round((candidate.level_price - 2) * 100) / 100,
    },
  ].filter(row => Number.isFinite(row.stop_price));
}

function targetModels(candidate, entryPrice, stopPrice) {
  const risk = entryPrice - stopPrice;
  const rows = [
    { target_model: 'fixed_plus_5', target_price: entryPrice + 5 },
    { target_model: 'fixed_plus_10', target_price: entryPrice + 10 },
    { target_model: 'fixed_plus_15', target_price: entryPrice + 15 },
  ];
  if (Number.isFinite(risk) && risk > 0) {
    rows.push(
      { target_model: 'one_r', target_price: entryPrice + risk },
      { target_model: 'two_r', target_price: entryPrice + risk * 2 },
      { target_model: 'three_r', target_price: entryPrice + risk * 3 },
    );
  }
  if (Number.isFinite(candidate.next_trusted_level_above)) {
    rows.push({ target_model: 'next_trusted_level_above', target_price: candidate.next_trusted_level_above });
  }
  return rows.map(row => ({ ...row, target_price: Math.round(row.target_price * 100) / 100 }));
}

function resultRowsForCandidate(candidate, bars) {
  if (!candidate.valid_reclaim) return [];
  const rows = [];
  for (const entry of candidate.entry_models || []) {
    for (const stop of stopModels(candidate)) {
      const riskPoints = Math.round((entry.price - stop.stop_price) * 100) / 100;
      if (!Number.isFinite(riskPoints) || riskPoints <= 0) continue;
      for (const target of targetModels(candidate, entry.price, stop.stop_price)) {
        const metrics = computeTradeMetrics({
          bars,
          entryTimestamp: entry.timestamp_et,
          entryPrice: entry.price,
          stopPrice: stop.stop_price,
          targetPrice: target.target_price,
        });
        rows.push({
          candidate_id: candidate.id,
          strategy: candidate.strategy,
          date: candidate.date,
          timestamp_et: candidate.timestamp_et,
          instrument: candidate.instrument,
          level: candidate.level_price,
          level_sources: candidate.level_sources,
          source_combo: candidate.source_combo,
          source_freshness: candidate.source_freshness,
          level_type: [...new Set(candidate.level.level_types || [])].join('+') || 'unknown',
          breakdown_depth: candidate.breakdown_depth,
          breakdown_depth_bucket: candidate.breakdown_depth_bucket,
          minutes_below_level: candidate.minutes_below_level,
          reclaim_timestamp_et: candidate.reclaim_timestamp_et,
          reclaim_window_bucket: candidate.reclaim_window_bucket,
          entry_model: entry.model,
          entry_timestamp_et: entry.timestamp_et,
          entry_price: entry.price,
          stop_model: stop.stop_model,
          stop_price: stop.stop_price,
          target_model: target.target_model,
          target_price: target.target_price,
          risk_points: riskPoints,
          inside_mancini_chop: candidate.inside_mancini_chop,
          chop_veto_would_skip: candidate.chop_veto_would_skip,
          bobby_confirmed: candidate.bobby_confirmed,
          gex_confirmed: candidate.gex_confirmed,
          dubz_aligned: candidate.dubz_aligned,
          saty_confirmed: candidate.saty_confirmed,
          mancini_confirmed: candidate.mancini_confirmed,
          katbot_present: candidate.katbot_present,
          time_of_day: candidate.time_of_day,
          notes: candidate.level.proxy_labels?.length ? 'SPX reference level converted to ES proxy using explicit +30 basis label.' : null,
          evidence: {
            breakdown_bar: candidate.breakdown_bar,
            sweep_low: candidate.sweep_low,
            proxy_labels: candidate.level.proxy_labels || [],
          },
          ...metrics,
        });
      }
    }
  }
  return rows;
}

function aggregateResults(rows) {
  return {
    by_source_combo: summarizeGroup(rows, 'source_combo'),
    by_level_type: summarizeGroup(rows, 'level_type'),
    by_breakdown_depth_bucket: summarizeGroup(rows, 'breakdown_depth_bucket'),
    by_reclaim_time_bucket: summarizeGroup(rows, 'reclaim_window_bucket'),
    by_time_of_day: summarizeGroup(rows, 'time_of_day'),
    by_chop: summarizeGroup(rows.map(row => ({ ...row, chop_group: row.inside_mancini_chop ? 'chop' : 'no_chop' })), 'chop_group'),
    by_bobby: summarizeGroup(rows.map(row => ({ ...row, bobby_group: row.bobby_confirmed ? 'bobby_confirmed' : 'no_bobby' })), 'bobby_group'),
    by_gex: summarizeGroup(rows.map(row => ({ ...row, gex_group: row.gex_confirmed ? 'gex_confirmed' : 'no_gex' })), 'gex_group'),
    by_dubz: summarizeGroup(rows.map(row => ({ ...row, dubz_group: row.dubz_aligned ? 'dubz_aligned' : 'no_dubz' })), 'dubz_group'),
    by_saty: summarizeGroup(rows.map(row => ({ ...row, saty_group: row.saty_confirmed ? 'saty_confirmed' : 'no_saty' })), 'saty_group'),
    by_target_model: summarizeGroup(rows, 'target_model'),
    by_stop_model: summarizeGroup(rows, 'stop_model'),
    best_source_combo: summarizeGroup(rows, 'source_combo')
      .filter(row => row.count >= 30)
      .sort((a, b) => (b.average_r_60m ?? -999) - (a.average_r_60m ?? -999))[0] || null,
    worst_source_combo: summarizeGroup(rows, 'source_combo')
      .filter(row => row.count >= 30)
      .sort((a, b) => (a.average_r_60m ?? 999) - (b.average_r_60m ?? 999))[0] || null,
  };
}

function toCsvRows(rows) {
  return rows.map(row => ({
    candidate_id: row.candidate_id,
    date: row.date,
    timestamp_et: row.timestamp_et,
    level: row.level,
    source_combo: row.source_combo,
    level_type: row.level_type,
    breakdown_depth: row.breakdown_depth,
    minutes_below_level: row.minutes_below_level,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_price: row.stop_price,
    target_model: row.target_model,
    target_price: row.target_price,
    risk_points: row.risk_points,
    mfe_15m: row.mfe_15m,
    mae_15m: row.mae_15m,
    r_multiple_60m: row.r_multiple_60m,
    first_hit: row.first_hit,
    inside_mancini_chop: row.inside_mancini_chop,
    bobby_confirmed: row.bobby_confirmed,
    gex_confirmed: row.gex_confirmed,
    dubz_aligned: row.dubz_aligned,
    saty_confirmed: row.saty_confirmed,
    notes: row.notes,
  }));
}

async function runFakeBreakdownResearch(options = {}) {
  const timeline = options.timeline || buildSourceTimeline({ usableOnly: false });
  const { sessions, excluded } = loadUsableSessions(options);
  const allCandidates = [];
  const allResults = [];
  for (const session of sessions) {
    const candidates = detectFakeBreakdownsForSession({ session, timelineEvents: timeline.events, options: options.detector || {} });
    allCandidates.push(...candidates);
    for (const candidate of candidates) {
      allResults.push(...resultRowsForCandidate(candidate, session.replayBars));
    }
  }
  const valid = allCandidates.filter(candidate => candidate.valid_reclaim);
  const invalid = allCandidates.filter(candidate => !candidate.valid_reclaim);
  const summary = {
    generated_at: new Date().toISOString(),
    strategy: 'fake_breakdown_reclaim_long',
    sessions: sessions.length,
    excluded_sessions: excluded,
    date_range: sessions.length ? { start: sessions[0].date, end: sessions[sessions.length - 1].date } : null,
    es_1m_bars: summarizeBars(sessions.flatMap(session => session.replayBars || [])),
    es_historical_csv_bars: summarizeBars(loadHistoricalCsvBars('ES')),
    spx_historical_csv_bars: summarizeBars(loadHistoricalCsvBars('SPX')),
    candidates_detected: allCandidates.length,
    valid_reclaims: valid.length,
    invalid_no_reclaim: invalid.length,
    chop_zone_cases: allCandidates.filter(candidate => candidate.inside_mancini_chop).length,
    result_rows: allResults.length,
    no_lookahead_enforced: true,
    aggregates: aggregateResults(allResults),
    edge_supported: 'inconclusive',
    confidence: allResults.length >= 100 ? 'medium' : 'low',
    limitations: [
      'Research ignores fees and slippage.',
      'SPX reference levels are only used with an explicit +30 ES proxy label.',
      'Raw date-only source events are quarantined unless normalized elsewhere.',
      'Stop/target same-bar ordering is ambiguous.',
      'No strategy is live by default.',
    ],
  };

  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-candidates.json'), allCandidates);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-results.json'), { summary, rows: allResults });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-source-attribution.json'), summary.aggregates);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-veto-analysis.json'), {
    generated_at: new Date().toISOString(),
    chop_cases: allCandidates.filter(candidate => candidate.inside_mancini_chop),
    result_rows_inside_chop: allResults.filter(row => row.inside_mancini_chop),
  });
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-summary.csv'), toCsvRows(allResults), [
    'candidate_id', 'date', 'timestamp_et', 'level', 'source_combo', 'level_type',
    'breakdown_depth', 'minutes_below_level', 'entry_model', 'entry_price',
    'stop_model', 'stop_price', 'target_model', 'target_price', 'risk_points',
    'mfe_15m', 'mae_15m', 'r_multiple_60m', 'first_hit', 'inside_mancini_chop',
    'bobby_confirmed', 'gex_confirmed', 'dubz_aligned', 'saty_confirmed', 'notes',
  ]);
  return { summary, candidates: allCandidates, results: allResults };
}

module.exports = {
  runFakeBreakdownResearch,
  resultRowsForCandidate,
  stopModels,
  targetModels,
  aggregateResults,
};
