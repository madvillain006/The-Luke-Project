'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, ensureDir } = require('../common');

function pct(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function topGroup(groups) {
  return Array.isArray(groups) && groups.length ? groups[0] : null;
}

function renderResearchDoc(summary) {
  const source = topGroup(summary.aggregates.by_source_combo);
  const flush = topGroup(summary.aggregates.by_clusters_flushed);
  const reclaimed = topGroup(summary.aggregates.by_first_reclaimed_source_type);
  const lines = [];
  lines.push('# Multi-Source Ladder First-Reclaim Research');
  lines.push('');
  lines.push('## 1. Why This Exists');
  lines.push('- The prior fake-breakdown research could wait for upper-level reclaim, which can miss the earliest opportunity after a ladder flush.');
  lines.push('- This pass tests the first lower trusted level reclaimed after price flushes through one or more trusted level clusters.');
  lines.push('');
  lines.push('## 2. Difference From Fake-Breakdown V1/V2/V3');
  lines.push('- V1/V2/V3 mainly evaluate reclaim behavior around a single trusted level and later confirmation filters.');
  lines.push('- This archetype builds a timestamp-valid ladder from all trusted sources, detects levels lost during a flush, and evaluates the first reclaimed lower cluster.');
  lines.push('');
  lines.push('## 3. Data Sources');
  lines.push(`- ES 1m bars: ${summary.es_1m_bars.count} (${summary.es_1m_bars.date_range?.start || 'n/a'} to ${summary.es_1m_bars.date_range?.end || 'n/a'}).`);
  lines.push(`- SPX 1m bars: ${summary.spx_1m_bars.count} (${summary.spx_1m_bars.date_range?.start || 'n/a'} to ${summary.spx_1m_bars.date_range?.end || 'n/a'}).`);
  lines.push(`- Source timeline events: ${summary.source_timeline_events}, usable ${summary.source_timeline_usable_events}.`);
  lines.push('- Sources considered: Saty, Mancini, Dubz, Bobby/heatmap, GEX/Heatseeker when present, SPX reference levels with explicit basis handling.');
  lines.push('');
  lines.push('## 4. Level Clustering Approach');
  lines.push(`- ES cluster tolerance: ${summary.config.cluster_tolerance} points.`);
  lines.push('- Nearby executable ES levels are clustered by price and source combo.');
  lines.push('- Chop/veto clusters are labeled and not blindly used as entries.');
  lines.push('');
  lines.push('## 5. SPX/ES Basis Handling');
  lines.push('- ES-native levels are preferred for executable entries.');
  lines.push('- SPX levels stay reference_only unless same-minute/session-open/prior-close/rolling-15m basis is available.');
  lines.push('- fixed_plus_30_proxy is diagnostic only and produced no strategy-truth executable rows.');
  lines.push('');
  lines.push('## 6. Flush Definitions');
  lines.push('- single_level: one trusted cluster lost and reclaimed.');
  lines.push('- multi_level: two or three trusted clusters lost before first reclaim.');
  lines.push('- deep_flush: four or more trusted clusters lost.');
  lines.push('');
  lines.push('## 7. First-Reclaim Definitions');
  lines.push('- First reclaim is the first lower lost cluster that closes back above after the sweep low.');
  lines.push('- The detector does not wait for mid/upper reclaim.');
  lines.push('- Upper clusters become next-cluster and runner targets.');
  lines.push('');
  lines.push('## 8. Sample Size');
  lines.push(`- Single-level flushes: ${summary.setups.single_level_flushes}.`);
  lines.push(`- Multi-level flushes: ${summary.setups.multi_level_flushes}.`);
  lines.push(`- Deep flushes: ${summary.setups.deep_flushes}.`);
  lines.push(`- First-reclaim candidates: ${summary.setups.first_reclaim_candidates}.`);
  lines.push(`- Variant rows: ${summary.rows}.`);
  lines.push('');
  lines.push('## 9. Results By Source Combo');
  lines.push(source ? `- Top source combo: ${source.source_combo}, setups ${source.unique_setups}, TP +2 ${pct(source.tp2_hit_rate)}, stop-first ${pct(source.stop_first_rate)}.` : '- No source-combo result.');
  lines.push('');
  lines.push('## 10. Results By Number Of Clusters Flushed');
  lines.push(flush ? `- Top cluster-count bucket: ${flush.clusters_lost_count}, setups ${flush.unique_setups}, TP +2 ${pct(flush.tp2_hit_rate)}, stop-first ${pct(flush.stop_first_rate)}.` : '- No cluster-count result.');
  lines.push('');
  lines.push('## 11. Results By First Reclaimed Source Type');
  lines.push(reclaimed ? `- Top first-reclaim source: ${reclaimed.first_reclaimed_source_type}, setups ${reclaimed.unique_setups}, TP +2 ${pct(reclaimed.tp2_hit_rate)}, stop-first ${pct(reclaimed.stop_first_rate)}.` : '- No first-reclaim source result.');
  lines.push('');
  lines.push('## 12. Comparison Vs Late/Upper-Level Reclaim');
  lines.push(`- Comparable late-reclaim rows: ${summary.late_comparison.comparable_rows}.`);
  lines.push(`- Late reclaim too-late cases: ${summary.late_comparison.late_reclaim_too_late_cases}.`);
  lines.push(`- Average points captured before late reclaim: ${summary.late_comparison.average_points_captured_before_late_reclaim ?? 'n/a'}.`);
  lines.push('');
  lines.push('## 13. Prop-Risk Findings');
  lines.push('- Profit targets are diagnostic only. The research viability check is continuous positive PnL without drawdown failure, not one big trade or instant account pass.');
  lines.push('- Positive-day rate is reported as a caution metric, but it is not a hard gate because the strategy can recover through small wins and controlled losses.');
  lines.push(`- 25k 2ES: PnL ${summary.account_sim['25k_2ES_FULL'].cumulative_pnl}, continuous profitable ${summary.account_sim['25k_2ES_FULL'].continuous_profitable}, target hit ${summary.account_sim['25k_2ES_FULL'].target_hit}, failed ${summary.account_sim['25k_2ES_FULL'].account_failed}, max drawdown ${summary.account_sim['25k_2ES_FULL'].max_drawdown}, positive-day rate ${pct(summary.account_sim['25k_2ES_FULL'].positive_day_rate)}.`);
  lines.push(`- 25k 1ES: PnL ${summary.account_sim['25k_1ES_STARTER'].cumulative_pnl}, continuous profitable ${summary.account_sim['25k_1ES_STARTER'].continuous_profitable}, target hit ${summary.account_sim['25k_1ES_STARTER'].target_hit}, failed ${summary.account_sim['25k_1ES_STARTER'].account_failed}, max drawdown ${summary.account_sim['25k_1ES_STARTER'].max_drawdown}, positive-day rate ${pct(summary.account_sim['25k_1ES_STARTER'].positive_day_rate)}.`);
  lines.push(`- 50k 2ES: PnL ${summary.account_sim['50k_2ES_FULL'].cumulative_pnl}, continuous profitable ${summary.account_sim['50k_2ES_FULL'].continuous_profitable}, target hit ${summary.account_sim['50k_2ES_FULL'].target_hit}, failed ${summary.account_sim['50k_2ES_FULL'].account_failed}, max drawdown ${summary.account_sim['50k_2ES_FULL'].max_drawdown}, positive-day rate ${pct(summary.account_sim['50k_2ES_FULL'].positive_day_rate)}.`);
  lines.push(`- 50k 1ES: PnL ${summary.account_sim['50k_1ES_STARTER'].cumulative_pnl}, continuous profitable ${summary.account_sim['50k_1ES_STARTER'].continuous_profitable}, target hit ${summary.account_sim['50k_1ES_STARTER'].target_hit}, failed ${summary.account_sim['50k_1ES_STARTER'].account_failed}, max drawdown ${summary.account_sim['50k_1ES_STARTER'].max_drawdown}, positive-day rate ${pct(summary.account_sim['50k_1ES_STARTER'].positive_day_rate)}.`);
  lines.push('');
  lines.push('## 14. Whether First-Reclaim Catches The Move Earlier');
  lines.push(`- First reclaim better than late reclaim: ${summary.first_reclaim_better_than_late_reclaim}.`);
  lines.push(`- Points captured before late reclaim: ${summary.late_comparison.average_points_captured_before_late_reclaim ?? 'n/a'}.`);
  lines.push('');
  lines.push('## 15. Readiness');
  lines.push(`- Prop viability: ${summary.prop_viability}.`);
  lines.push('- This remains research-only unless reviewed visually and retested on fresh data.');
  lines.push('');
  lines.push('## 16. What Remains Unproven');
  lines.push('- OHLC bars cannot prove realistic queue fills.');
  lines.push('- Cluster tolerance may be too wide or too tight.');
  lines.push('- Date-only Mancini/Dubz context may overstate availability precision.');
  lines.push('- Same-bar stop/target ambiguity is treated pessimistically but still hides sequence.');
  lines.push('- Visual pattern quality from the attached TradingView example is approximated, not truly understood by the rules.');
  lines.push('');
  lines.push('## 17. Commands To Rerun');
  lines.push('- `npm run research:ladder-reclaim`');
  lines.push('- `npm test`');
  lines.push('- `npm run research:fake-breakdown-state`');
  lines.push('- `npm run research:fake-breakdown-v3`');
  lines.push('- `npm run research:fake-breakdown-watchlist`');
  lines.push('');
  return lines.join('\n');
}

function writeResearchDoc(summary) {
  const target = path.join(ROOT, 'docs', 'MULTI_SOURCE_LADDER_RECLAIM_RESEARCH.md');
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, renderResearchDoc(summary), 'utf8');
}

module.exports = {
  renderResearchDoc,
  writeResearchDoc,
};
