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

function accountLine(row) {
  if (!row) return 'n/a';
  return `${row.account} ${row.mode}, daily stop ${row.daily_profit_stop ?? 'none'}: PnL ${money(row.cumulative_pnl)}, target hit ${row.target_hit}, days to target ${row.days_to_target ?? 'n/a'}, failed ${row.account_failed}, fail-before-target ${pct(row.fail_before_target_probability)}, positive days ${pct(row.positive_day_rate)}`;
}

function renderReport({ summary, ruleResults }) {
  const best = summary.best_rule;
  const lines = [
    '# Fake Breakdown State Machine Research',
    '',
    '## 1. Can Luke Produce Useful WATCH Signals?',
    '',
    `Level-watch universe: ${summary.level_watch_count} historical setups. Valid reclaim watch count: ${summary.valid_reclaim_count}. State rows tested from named rules: ${summary.state_rows}.`,
    '',
    best ? `Best named rule: ${best.rule_label}. Recommendation: ${best.recommendation}.` : 'No named rule produced a usable state-machine result.',
    '',
    'This is research-only. It does not change live trading behavior or `buildTradeDecision`.',
    '',
    '## 2. Which ARMED Rules Work Best?',
    '',
    '| Rule | Armed | Tradeable | False armed | TP +2 | TP +3 | Stop-first | Median heat | 2ES expectancy | 25k days target | 50k days target | Status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const row of ruleResults) {
    lines.push(`| ${row.rule_id} | ${row.sample_size} | ${row.tradeable_count} | ${pct(row.false_armed_rate)} | ${pct(row.tp2_hit_rate)} | ${pct(row.tp3_hit_rate)} | ${pct(row.stop_first_rate)} | ${num(row.median_heat_before_tp1)} | ${money(row.expectancy_2es)} | ${row.account_25k_best_2es?.days_to_target ?? 'n/a'} | ${row.account_50k_best_2es?.days_to_target ?? 'n/a'} | ${row.recommendation} |`);
  }

  lines.push(
    '',
    '## 3. Which Rule Survives Slippage?',
    '',
    best ? `${best.rule_label} had 2ES expectancy ${money(best.expectancy_2es)} and 1ES expectancy ${money(best.expectancy_1es)} after 0.5 ES points round-trip slippage.` : 'No rule survived slippage.',
    '',
    '## 4. Does 2ES Full Work?',
    '',
    best ? accountLine(best.account_25k_best_2es) : 'n/a',
    '',
    '2ES full remains rule-dependent. It is not broadly viable from baseline V3, and state-machine output keeps it research-only.',
    '',
    '## 5. Does 1ES Starter Work Better?',
    '',
    best ? accountLine(best.account_25k_best_1es) : 'n/a',
    '',
    '1ES reduces loss size but does not automatically solve false armed signals. It remains a paper/research sizing variant.',
    '',
    '## 6. False Armed Rate',
    '',
    best ? `Best-rule false armed rate: ${pct(best.false_armed_rate)}. False armed means ARMED did not reach fixed +2 before the measured outcome window/stop logic.` : 'n/a',
    '',
    '## 7. Days To Pass 25K',
    '',
    best ? `Best 25k 2ES simulation: ${accountLine(best.account_25k_best_2es)}.` : 'n/a',
    '',
    'The 25k target in this state-machine run is +$1,250 with $1,000 drawdown limits.',
    '',
    '## 8. Account Fail First',
    '',
    best ? `Best 25k 2ES fail-before-target probability: ${pct(best.account_25k_best_2es?.fail_before_target_probability)}. Best 50k 2ES fail-before-target probability: ${pct(best.account_50k_best_2es?.fail_before_target_probability)}.` : 'n/a',
    '',
    'This is deterministic replay probability over the current corpus, not a forward statistical estimate.',
    '',
    '## 9. Live-Watchlist Candidates',
    '',
  );

  for (const row of ruleResults.filter(row => row.recommendation === 'WATCHLIST_ONLY')) {
    lines.push(`- ${row.rule_id}: ${row.rule_label}`);
  }
  if (!ruleResults.some(row => row.recommendation === 'WATCHLIST_ONLY')) lines.push('- None.');

  lines.push('', '## 10. Paper-Only Candidates', '');
  for (const row of ruleResults.filter(row => row.recommendation === 'PAPER_ONLY')) {
    lines.push(`- ${row.rule_id}: ${row.rule_label}`);
  }
  if (!ruleResults.some(row => row.recommendation === 'PAPER_ONLY')) lines.push('- None.');

  lines.push('', '## 11. Research-Only / Not Ready', '');
  for (const row of ruleResults.filter(row => row.recommendation === 'NOT_READY')) {
    lines.push(`- ${row.rule_id}: ${row.rule_label}`);
  }
  if (!ruleResults.some(row => row.recommendation === 'NOT_READY')) lines.push('- None.');

  lines.push(
    '',
    '## 12. 50K With Previous Rules',
    '',
    'The 50k side simulation keeps the same signal, trade, daily kill, max losses, and max tradeable signal rules, but uses a $3,000 target and $2,000 EOD/funded trailing drawdown.',
    '',
  );
  for (const row of ruleResults) {
    lines.push(`- ${row.rule_id}: ${accountLine(row.account_50k_best_2es)}`);
  }

  lines.push(
    '',
    '## 13. Remaining Risks',
    '',
    '- State reconstruction uses historical OHLC bars, not order-book fills.',
    '- WATCH and ARMED states are reconstructed from existing V2/V3 research artifacts, not yet a live scanner.',
    '- Same-bar ambiguity and slippage assumptions can still change apparent edge.',
    '- Named-rule thresholds were chosen after V3 research and need more out-of-sample days.',
    '',
    '## 14. Commands To Rerun',
    '',
    '```bash',
    'npm run research:fake-breakdown-state',
    'npm run research:fake-breakdown-v3',
    'npm test',
    '```',
    ''
  );

  return lines.join('\n');
}

module.exports = { renderReport };
