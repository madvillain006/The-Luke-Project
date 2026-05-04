'use strict';

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function num(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function money(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : 'n/a';
}

function ruleLine(rule) {
  if (!rule) return 'No qualifying rule met the minimum sample threshold.';
  return `${rule.label}: ${rule.taken_setup_count} setups, TP +2 ${pct(rule.tp2_hit_rate)}, stop-first ${pct(rule.stop_first_rate)}, median MAE ${num(rule.median_mae_before_tp1)}, 2ES expectancy ${money(rule.expectancy_2es_slip_0_5_round_trip)}, 1ES expectancy ${money(rule.expectancy_1es_slip_0_5_round_trip)}, confidence ${rule.confidence}.`;
}

function renderReadme({ summary, rules, failure }) {
  const best2 = rules.best_2es_rule;
  const bestMedium = rules.best_medium_or_better_2es_rule;
  const bestHigh = rules.best_high_confidence_2es_rule;
  const best1 = rules.best_1es_rule;
  const bestBobby = rules.best_bobby_rule;
  const baseline = summary.baseline;
  const bobbyPresence = summary.by_bobby_target_presence || [];
  const bobbyTrue = bobbyPresence.find(row => row.bobby_heatmap_target_present === 'true');
  const bobbyFalse = bobbyPresence.find(row => row.bobby_heatmap_target_present === 'false');

  const lines = [
    '# Fake Breakdown V3 Live Filters Research',
    '',
    '## 1. Which Pre-Entry Filters Worked Best?',
    '',
    `Best 2ES rule: ${ruleLine(best2)}`,
    '',
    `Best medium-or-better sample rule: ${ruleLine(bestMedium)}`,
    '',
    `Best high-confidence sample rule: ${ruleLine(bestHigh)}`,
    '',
    `Best 1ES/starter rule: ${ruleLine(best1)}`,
    '',
    'The rule search uses only allowlisted pre-entry fields: source/target presence, entry model, sweep depth, time below level, reclaim candle quality, acceptance before entry, overhead distance, chop status, time of day, and stop size.',
    '',
    '## 2. Did Bobby/Heatmap Target Presence Remain Useful?',
    '',
    bestBobby ? `Best Bobby/heatmap rule: ${ruleLine(bestBobby)}` : 'No Bobby/heatmap rule reached the minimum sample threshold.',
    '',
    `Bobby present baseline: ${bobbyTrue ? `${bobbyTrue.taken_setup_count} setups, TP +2 ${pct(bobbyTrue.tp2_hit_rate)}, stop-first ${pct(bobbyTrue.stop_first_rate)}` : 'n/a'}.`,
    `Bobby absent baseline: ${bobbyFalse ? `${bobbyFalse.taken_setup_count} setups, TP +2 ${pct(bobbyFalse.tp2_hit_rate)}, stop-first ${pct(bobbyFalse.stop_first_rate)}` : 'n/a'}.`,
    'In V3, Bobby/heatmap presence improved TP +2 hit rate but did not broadly reduce stop-first rate across all requested entry models. The best Bobby combinations are still low-sample.',
    '',
    '## 3. Did Micro-Pivot/Higher-Low/Hold Entries Reduce Heat?',
    '',
    '| Entry filter | Setups | TP +2 | Stop-first | Median MAE | 2ES expectancy |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of summary.by_entry_model_group || []) {
    lines.push(`| ${row.entry_model_group} | ${row.taken_setup_count} | ${pct(row.tp2_hit_rate)} | ${pct(row.stop_first_rate)} | ${num(row.median_mae_before_tp1)} | ${money(row.expectancy_2es_slip_0_5_round_trip)} |`);
  }

  lines.push(
    '',
    '## 4. Is TP +2 Prop-Safe Under Slippage?',
    '',
    `Baseline taken setups: ${baseline.taken_setup_count}. TP +2 hit rate ${pct(baseline.tp2_hit_rate)}, stop-first ${pct(baseline.stop_first_rate)}, median MAE ${num(baseline.median_mae_before_tp1)}.`,
    `With 0.25 ES points per side, equivalent to 0.5 round trip, baseline 2ES expectancy is ${money(baseline.expectancy_2es_slip_0_5_round_trip)} and baseline 1ES expectancy is ${money(baseline.expectancy_1es_slip_0_5_round_trip)}.`,
    '',
    '## 5. Is 2ES Full-Size Viable?',
    '',
    `Research verdict: ${summary.conclusion.two_es_viable}. Full 2ES rows are only counted as preferred when stop <= 3 ES points. Hard-stop rows up to 5 points are measured but not treated as clean full-size prop entries.`,
    '',
    '## 6. Is 1ES Starter Better?',
    '',
    `Research verdict: ${summary.conclusion.one_es_starter_better}. 1ES uses the same entry/stop evidence but halves point-dollar exposure. Staged add-after-confirmation remains diagnostic, not a live rule.`,
    '',
    '## 7. Are There Enough Samples To Trust This?',
    '',
    `Unique setups: ${summary.unique_setups}. Observation rows: ${summary.observation_rows}. Date range: ${summary.date_range?.start || 'n/a'} to ${summary.date_range?.end || 'n/a'}. Best-rule confidence: ${summary.conclusion.confidence}.`,
    '',
    'Variant rows are not independent trades. Confidence is based on unique setups, and small source-combo samples stay low confidence.',
    '',
    '## 8. What Remains Discretionary?',
    '',
    '- Whether a visual fake breakdown is clean versus ordinary chop noise.',
    '- Whether a fast retest or micro-pivot fill is realistic in live order flow.',
    '- Whether the next heatmap/Bobby level is still active liquidity, not stale context.',
    '- Whether a prop trader should skip after emotional or high-volatility conditions not represented in the bars.',
    '',
    '## 9. 50k Side Project',
    '',
    `The 50k account uses the same rules with a $3,000 profit target and $2,000 EOD/funded intraday drawdown. Best 2ES rule 50k cumulative PnL: ${money(best2?.account_50k_2es?.cumulative_pnl)}, profit target hit: ${best2?.account_50k_2es?.profit_target_hit ?? 'n/a'}, account failed: ${best2?.account_50k_2es?.account_failed ?? 'n/a'}.`,
    '',
    '## 10. Failure-Oriented Risks',
    '',
  );

  for (const risk of failure.unresolved_risks || []) lines.push(`- ${risk}`);

  lines.push(
    '',
    '## 11. Commands To Rerun',
    '',
    '```bash',
    'npm run research:fake-breakdown-v3',
    'npm run research:fake-breakdown-v2',
    'npm test',
    '```',
    '',
    'This research does not change live trading behavior, does not change `buildTradeDecision`, and does not add execution.',
    ''
  );

  return lines.join('\n');
}

module.exports = { renderReadme };
