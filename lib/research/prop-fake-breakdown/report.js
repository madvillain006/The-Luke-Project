'use strict';

function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function renderReadme(summary) {
  const lines = [
    '# Prop Fake Breakdown Research Artifact',
    '',
    `Generated: ${summary.generated_at}`,
    `Strategy: ${summary.strategy}`,
    '',
    '## Prop Model',
    `- Contracts: ${summary.prop_config.contracts} ES`,
    `- Dollars per point total: ${summary.prop_config.dollars_per_point_total}`,
    `- Max risk per trade: ${summary.prop_config.max_risk_dollars_per_trade}`,
    `- Max stop points: ${summary.prop_config.max_stop_points}`,
    '',
    '## Counts',
    `- Unique setups: ${summary.unique_setups}`,
    `- Variant rows: ${summary.variant_rows}`,
    `- TRADEABLE: ${summary.classification_counts.TRADEABLE}`,
    `- WATCH_ONLY: ${summary.classification_counts.WATCH_ONLY}`,
    `- PASS: ${summary.classification_counts.PASS}`,
    `- Chop cases: ${summary.chop_cases}`,
    '',
    '## Source Combos',
    '| Combo | Setups | Rows | Tradeable | TP1 hit | Stop first | Avg heat | Avg R60 | Confidence |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const row of summary.aggregates.by_source_combo.slice(0, 10)) {
    lines.push(`| ${row.source_combo} | ${row.unique_setups} | ${row.variant_rows} | ${row.tradeable_count} | ${pct(row.tp1_hit_rate)} | ${pct(row.stop_first_rate)} | ${fmt(row.average_max_heat_before_tp1)} | ${fmt(row.average_r_60m)} | ${row.confidence} |`);
  }
  lines.push('', '## Basis');
  lines.push(`- Actual basis methods tested: ${summary.basis_comparison.actual_basis_methods_tested.join(', ') || 'none'}`);
  lines.push(`- Fixed +30 diagnostic rows: ${summary.basis_comparison.fixed_plus_30_diagnostic_rows}`);
  lines.push(`- SPX reference-only rows: ${summary.basis_comparison.spx_reference_only_cases}`);
  lines.push('', '## Prop Sim');
  lines.push(`- Daily drawdown failures: ${summary.prop_sim.daily_drawdown_failures}`);
  lines.push(`- Max drawdown used: ${fmt(summary.prop_sim.max_drawdown_used)}`);
  lines.push('', '## Verdict');
  lines.push('- Long-only prop strategy support: inconclusive.');
  lines.push('- This artifact is research only and does not change live trading behavior.');
  return lines.join('\n') + '\n';
}

module.exports = { renderReadme };
