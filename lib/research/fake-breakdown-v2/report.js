'use strict';

function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function renderReadme(summary) {
  const rows = [
    ['Reaction scalp', summary.reaction_scalp],
    ['Level-to-level', summary.level_to_level],
    ['Staged long', summary.staged_long],
  ];
  const lines = [
    '# Fake Breakdown V2 Research Artifact',
    '',
    `Generated: ${summary.generated_at}`,
    `Strategy: ${summary.strategy}`,
    '',
    '## Scope',
    `- Sessions: ${summary.sessions}`,
    `- Date range: ${summary.date_range?.start || 'n/a'} to ${summary.date_range?.end || 'n/a'}`,
    `- Unique setups: ${summary.unique_setups}`,
    `- Candidate rows: ${summary.candidate_rows}`,
    '',
    '## Archetypes',
    '| Archetype | Setups | Rows | Hindsight Taken | Candidate TP1 | Candidate TP2 | Candidate Stop First | Taken Heat TP1 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [name, row] of rows) {
    lines.push(`| ${name} | ${row.unique_setups} | ${row.candidate_rows} | ${row.taken_rows} | ${pct(row.candidate_tp1_hit_rate)} | ${pct(row.candidate_tp2_hit_rate)} | ${pct(row.candidate_stop_first_rate)} | ${fmt(row.average_heat_before_tp1)} |`);
  }
  lines.push('');
  lines.push('## Basis');
  lines.push(`- Actual executable basis methods: ${summary.basis.actual_basis_methods_tested.join(', ')}`);
  lines.push(`- Fixed +30 strategy rows: ${summary.basis.fixed_plus_30_strategy_rows}`);
  lines.push(`- SPX reference-only heatmap comparisons: ${summary.basis.spx_reference_only_cases}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push(`- Immediate 2ES viable: ${summary.immediate_2es_viable}`);
  lines.push(`- Staged 1ES->2ES viable: ${summary.staged_1_to_2_viable}`);
  lines.push(`- Level-to-level more promising than scalp: ${summary.level_to_level_more_promising_than_scalp}`);
  lines.push('- This is research only and does not change live trading behavior.');
  return lines.join('\n') + '\n';
}

module.exports = { renderReadme };
