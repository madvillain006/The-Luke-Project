'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR } = require('../common');

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function renderReadme(summary) {
  const best = summary.aggregates.best_source_combo;
  const worst = summary.aggregates.worst_source_combo;
  const lines = [
    '# Fake Breakdown Reclaim Research Artifact',
    '',
    `Generated: ${summary.generated_at}`,
    `Strategy: ${summary.strategy}`,
    '',
    '## Scope',
    '- Research-only long setup detector.',
    '- No live trading behavior changed.',
    '- No execution calls are made.',
    '- ES is the measured instrument. SPX levels are only used as explicitly labeled ES proxy references.',
    '',
    '## Summary',
    `- Sessions: ${summary.sessions}`,
    `- Date range: ${summary.date_range ? `${summary.date_range.start} to ${summary.date_range.end}` : 'none'}`,
    `- Candidates detected: ${summary.candidates_detected}`,
    `- Valid reclaims: ${summary.valid_reclaims}`,
    `- Invalid/no-reclaim: ${summary.invalid_no_reclaim}`,
    `- Chop-zone cases: ${summary.chop_zone_cases}`,
    `- Result rows: ${summary.result_rows}`,
    '',
    '## Source Combos',
    '| Combo | Count | Target first | Stop first | Avg MFE 15m | Avg MAE 15m | Avg R 60m | Confidence |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const row of summary.aggregates.by_source_combo.slice(0, 12)) {
    lines.push(`| ${row.source_combo} | ${row.count} | ${pct(row.target_first_rate)} | ${pct(row.stop_first_rate)} | ${fmt(row.average_mfe_15m)} | ${fmt(row.average_mae_15m)} | ${fmt(row.average_r_60m)} | ${row.confidence} |`);
  }
  lines.push('', '## Best/Worst By Average R 60m');
  lines.push(`- Best meaningful combo: ${best ? `${best.source_combo} (${best.count}, avg R60 ${fmt(best.average_r_60m)})` : 'insufficient sample'}`);
  lines.push(`- Worst meaningful combo: ${worst ? `${worst.source_combo} (${worst.count}, avg R60 ${fmt(worst.average_r_60m)})` : 'insufficient sample'}`);
  lines.push('', '## Risks');
  for (const item of summary.limitations) lines.push(`- ${item}`);
  lines.push('', '## Files');
  for (const name of [
    'fake-breakdown-candidates.json',
    'fake-breakdown-results.json',
    'fake-breakdown-summary.csv',
    'fake-breakdown-source-attribution.json',
    'fake-breakdown-veto-analysis.json',
  ]) {
    lines.push(`- ${path.join('artifacts', 'research', name).replace(/\\/g, '/')}`);
  }
  return lines.join('\n') + '\n';
}

function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

module.exports = {
  renderReadme,
};
