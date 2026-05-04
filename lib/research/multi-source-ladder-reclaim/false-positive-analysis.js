'use strict';

const { average, median } = require('../common');
const { rounded } = require('./level-clusters');

function isFalsePositive(row) {
  return row?.classification === 'TRADEABLE_RESEARCH' && (!row.tp1_hit || row.stop_first || row.same_bar_ambiguity);
}

function timeBucket(timestamp) {
  const hhmm = String(timestamp || '').slice(11, 16);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return 'unknown';
  if (hhmm < '09:30') return 'premarket';
  if (hhmm < '10:00') return 'opening_30';
  if (hhmm < '11:30') return 'mid_morning';
  if (hhmm < '14:00') return 'lunch';
  if (hhmm < '15:00') return 'afternoon';
  return 'power_hour';
}

function levelKey(row) {
  const level = Number.isFinite(row?.first_reclaimed_level) ? row.first_reclaimed_level.toFixed(2) : 'unknown';
  return `${row?.date || 'unknown'}|${level}`;
}

function repeatedLevelKeys(rows) {
  const counts = new Map();
  for (const row of rows || []) counts.set(levelKey(row), (counts.get(levelKey(row)) || 0) + 1);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function categorizeFalsePositive(row, repeatedKeys = new Set()) {
  const categories = [];
  if (!isFalsePositive(row)) return categories;
  if (row.same_bar_ambiguity) categories.push('same_bar_ambiguity');
  if (row.stop_first && Number.isFinite(row.stop_points) && row.stop_points <= 1.5) categories.push('stop_too_tight');
  if (row.stop_first && Number.isFinite(row.time_to_stop) && row.time_to_stop <= 5) categories.push('reclaim_failed');
  if (row.entry_model === 'reclaim_close_first_cluster' && row.stop_first) categories.push('no_acceptance_above_level');
  if (Number.isFinite(row.next_cluster_target) && Number.isFinite(row.entry_price) && row.next_cluster_target - row.entry_price < 2) categories.push('target_too_close');
  if (row.first_reclaimed_cluster_strength > 1 && row.stop_first) categories.push('cluster_too_wide_or_needs_visual_review');
  if (repeatedKeys.has(levelKey(row))) categories.push('repeated_same_level');
  if (['opening_30', 'lunch'].includes(timeBucket(row.entry_timestamp_et))) categories.push('bad_time_of_day');
  if (!row.bobby_heatmap_present) categories.push('missing_bobby_heatmap_confirmation');
  if (row.first_reclaimed_cluster_is_chop) categories.push('inside_chop_veto');
  if (row.flush_type === 'deep_flush' || row.clusters_lost_count >= 4) categories.push('deep_flush_too_violent');
  if (!categories.length) categories.push('uncategorized_visual_review_needed');
  return categories;
}

function summarizeByCategory(falseRows, repeatedKeys = repeatedLevelKeys(falseRows)) {
  const counts = {};
  const examples = {};
  for (const row of falseRows) {
    for (const category of categorizeFalsePositive(row, repeatedKeys)) {
      counts[category] = (counts[category] || 0) + 1;
      if (!examples[category]) {
        examples[category] = {
          setup_id: row.setup_id,
          date: row.date,
          entry_timestamp_et: row.entry_timestamp_et,
          source_combo: row.source_combo,
          entry_model: row.entry_model,
          stop_points: row.stop_points,
          heat_before_tp1: row.max_heat_before_tp1,
        };
      }
    }
  }
  return { counts, examples };
}

function summarizeEntryRisk(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = row.entry_model || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([entry_model, group]) => {
    const stops = group.map(row => row.stop_points).filter(Number.isFinite);
    const heat = group.map(row => row.max_heat_before_tp1).filter(Number.isFinite);
    return {
      entry_model,
      rows: group.length,
      unique_setups: new Set(group.map(row => row.setup_id)).size,
      avg_stop_points: rounded(average(stops)),
      median_stop_points: rounded(median(stops)),
      min_stop_points: stops.length ? rounded(Math.min(...stops)) : null,
      max_stop_points: stops.length ? rounded(Math.max(...stops)) : null,
      avg_heat_before_tp1: rounded(average(heat)),
      median_heat_before_tp1: rounded(median(heat)),
      tp2_hit_rate: rate(group, row => row.tp1_hit),
      stop_first_rate: rate(group, row => row.stop_first || row.same_bar_ambiguity),
    };
  }).sort((a, b) => b.unique_setups - a.unique_setups);
}

function analyzeFalsePositives(rows) {
  const tradeable = (rows || []).filter(row => row.classification === 'TRADEABLE_RESEARCH');
  const falseRows = tradeable.filter(isFalsePositive);
  const repeatedKeys = repeatedLevelKeys(tradeable);
  const categorySummary = summarizeByCategory(falseRows, repeatedKeys);
  return {
    tradeable_rows: tradeable.length,
    false_positive_rows: falseRows.length,
    false_positive_rate: rate(tradeable, isFalsePositive),
    category_counts: categorySummary.counts,
    category_examples: categorySummary.examples,
    by_entry_model_risk: summarizeEntryRisk(tradeable),
    candidate_pre_entry_filters_for_future_tests: [
      'require acceptance above first reclaimed cluster before full 2ES sizing',
      'separate deep flushes from one/two-cluster flushes',
      'avoid repeated same-level attempts after a same-day loss until retested visually',
      'require Bobby/heatmap confirmation for low-strength clusters',
      'test time-of-day filters around opening-30 and lunch separately',
    ],
  };
}

function rate(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : null;
}

module.exports = {
  isFalsePositive,
  timeBucket,
  levelKey,
  repeatedLevelKeys,
  categorizeFalsePositive,
  summarizeByCategory,
  summarizeEntryRisk,
  analyzeFalsePositives,
};
