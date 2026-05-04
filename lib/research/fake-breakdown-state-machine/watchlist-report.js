'use strict';

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function money(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : 'n/a';
}

function renderWatchlistDoc(result) {
  const ruleA = result.clustering.rule_a;
  const ruleADays = ruleA.by_day.slice().sort((a, b) => b.pnl_2es - a.pnl_2es);
  const ruleBBest = result.throttles.best_variant;
  const ruleBBase = result.throttles.variants.find(row => row.name === 'baseline_2_trades_2es');
  const ruleC = result.summary.by_rule.C;
  const topADays = ruleADays.slice(0, 3).map(day => `${day.date}: ${day.signals} signals, ${day.winners} winners, ${day.losers} losers, ${money(day.pnl_2es)}`).join('; ') || 'n/a';
  const lines = [
    '# Fake Breakdown Watchlist Replay',
    '',
    '## 1. Can Rule A Be Visually Trusted?',
    '',
    `Rule A has ${result.summary.by_rule.A.signals} replay rows in the watchlist artifact. It remains WATCHLIST_ONLY because the sample is small and the visual replay still needs human inspection of the power-hour setup quality.`,
    '',
    '## 2. Are Rule A Results Clustered?',
    '',
    `Rule A appears on ${ruleA.by_day.length} days and ${ruleA.by_week.length} weeks. Top positive days: ${topADays}.`,
    '',
    '## 3. Why Did Rule B Fail Account Sim Despite Good TP/Stop Stats?',
    '',
    `Baseline Rule B: ${ruleBBase?.signals_available ?? 'n/a'} signals, ${money(ruleBBase?.cumulative_pnl)}, target hit ${ruleBBase?.target_hit ?? 'n/a'}, failed ${ruleBBase?.failed ?? 'n/a'}. The issue is chronological loss sequencing and repeated allowed tradeable signals, not raw TP +2 rate alone.`,
    '',
    '## 4. Which Rule B Throttle Improves Survival?',
    '',
    ruleBBest ? `Best Rule B throttle: ${ruleBBest.name}, ${money(ruleBBest.cumulative_pnl)}, target hit ${ruleBBest.target_hit}, failed ${ruleBBest.failed}, positive day rate ${pct(ruleBBest.positive_day_rate)}.` : 'No Rule B throttle improved survival.',
    '',
    '## 5. Is 1ES Starter Better Than 2ES For Rule B?',
    '',
    (() => {
      const one = result.throttles.variants.find(row => row.name === 'starter_1es_only');
      const two = ruleBBase;
      return `Rule B 2ES baseline: ${money(two?.cumulative_pnl)}, failed ${two?.failed}. Rule B 1ES starter: ${money(one?.cumulative_pnl)}, failed ${one?.failed}.`;
    })(),
    '',
    '## 6. What Visual Patterns Show Up In Winners Vs Losers?',
    '',
    'The replay artifact exposes the chart windows, state markers, level, entry, stop, TP +2/+3, next target, Bobby target flag, MFE/MAE, and account impact for every A/B/C signal. This doc does not overclaim the visual pattern; inspect the HTML signal-by-signal.',
    '',
    '## 7. Should Any Rule Move From WATCHLIST_ONLY To PAPER_ONLY?',
    '',
    'No. Rule A/B/C remain WATCHLIST_ONLY. Rule A is clean but low sample. Rule B and C have better sample size but still need throttle and visual review before paper status.',
    '',
    '## 8. What Exact Evidence Is Still Missing?',
    '',
    '- More out-of-sample days.',
    '- Order-fill realistic replay beyond OHLC bars.',
    '- Visual confirmation that losers are mechanically distinguishable before entry.',
    '- A throttle that survives the 25k target path without relying on one cluster.',
    '- Confirmed Bobby/heatmap target timestamps and distances for every Rule C signal.',
    '',
    '## 9. Artifacts',
    '',
    '- `artifacts/research/fake-breakdown-watchlist-replay.json`',
    '- `artifacts/research/fake-breakdown-rule-clustering.json`',
    '- `artifacts/research/fake-breakdown-rule-throttles.json`',
    '- `artifacts/research/fake-breakdown-watchlist.html`',
    '- `artifacts/research/fake-breakdown-watchlist-summary.csv`',
    '',
    '## 10. Commands',
    '',
    '```bash',
    'npm run research:fake-breakdown-watchlist',
    'npm run research:fake-breakdown-state',
    'npm test',
    '```',
    '',
  ];
  return lines.join('\n');
}

module.exports = { renderWatchlistDoc };
