'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');
const SUMMARY_FILE = path.join(OUT_DIR, 'options-horizons-spx-summary.json');
const SPX_EVENTS_FILE = path.join(OUT_DIR, 'spx-rth-events.csv');
const PAIRED_EVENTS_FILE = path.join(OUT_DIR, 'paired-es-spx-events.csv');
const SPX_SESSION_EVENTS_FILE = path.join(OUT_DIR, 'spx-session-events.csv');
const PAIRED_SESSION_EVENTS_FILE = path.join(OUT_DIR, 'paired-es-spx-session-events.csv');

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      const value = cols[index] ?? '';
      const num = Number(value);
      row[header] = value !== '' && Number.isFinite(num) ? num : value;
    });
    return row;
  });
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'n/a';
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function candidateRows(rows, candidateId) {
  return rows.filter(row => row.candidate_id === candidateId);
}

function dayConcentration(events, candidateId, horizonId, field) {
  const rows = events.filter(row => row.candidate_id === candidateId && row.horizon_id === horizonId);
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(Number(row[field]));
  }
  const days = [...byDate.entries()].map(([date, values]) => {
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      date,
      count: values.length,
      avg: sum / values.length,
      sum,
    };
  }).sort((a, b) => b.sum - a.sum);
  return {
    sampleDays: days.length,
    positiveDays: days.filter(day => day.avg > 0).length,
    negativeDays: days.filter(day => day.avg < 0).length,
    top: days.slice(0, 3),
    bottom: [...days].sort((a, b) => a.sum - b.sum).slice(0, 3),
  };
}

function dateRange(events, candidateId) {
  const stamps = events
    .filter(row => row.candidate_id === candidateId)
    .map(row => String(row.signal_timestamp || row.entry_timestamp || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  return stamps.length ? `${stamps[0]} to ${stamps[stamps.length - 1]}` : 'n/a';
}

function buildMarkdown(summary, spxEvents, pairedEvents, spxSessionEvents, pairedSessionEvents) {
  const meta = summary.metadata;
  const esSwing = candidateRows(summary.es_continuous_rows, 'swing_candidate');
  const spxSwing = candidateRows(summary.spx_rth_rows, 'swing_candidate');
  const spxSessionSwing = candidateRows(summary.spx_session_rows || [], 'swing_candidate');
  const pairedSwing = candidateRows(summary.paired_es_spx_rows, 'swing_candidate');
  const pairedSessionSwing = candidateRows(summary.paired_es_spx_session_rows || [], 'swing_candidate');
  const spxOneDay = dayConcentration(spxEvents, 'swing_candidate', '1d', 'close_move_points');
  const spxFourHour = dayConcentration(spxEvents, 'swing_candidate', '4h', 'close_move_points');
  const spxEod = dayConcentration(spxSessionEvents, 'swing_candidate', 'spx_eod', 'close_move_points');
  const spxNextEod = dayConcentration(spxSessionEvents, 'swing_candidate', 'spx_next_eod', 'close_move_points');
  const spxEow = dayConcentration(spxSessionEvents, 'swing_candidate', 'spx_eow', 'close_move_points');
  const pairedOneDay = dayConcentration(pairedEvents, 'swing_candidate', '1d', 'spx_close_move_points');
  const pairedEow = dayConcentration(pairedSessionEvents, 'swing_candidate', 'spx_eow', 'spx_close_move_points');

  const report = [];
  report.push('# Mancini Acceptance Carry: ES + SPX Underlying Report');
  report.push('');
  report.push(`Generated: ${meta.generated_at}`);
  report.push('');
  report.push('## Executive Read');
  report.push('');
  report.push('- The tested pattern is: ES flushes below a prior-known Mancini level, then recovers and holds above it for the acceptance window. Entry is the next 1m open after confirmation. No planned-entry backfill was used.');
  report.push('- The strongest discretionary read is not immediate 1h close direction. It is the 4h to 1.5 RTH day carry after the stricter swing-candidate acceptance signal.');
  report.push('- SPX cash-session results survive when overnight ES-only signals are excluded. That matters if this later becomes an options filter, because the SPX leg only counts signals that map to a cash-session SPX bar within five minutes.');
  report.push('- Short-dated options need a different read: fixed-horizon close can understate the edge because contracts can be sold into the impulse. For that lane, MFE frequency is the better available proxy until actual option bars exist.');
  report.push('- Same-day SPX close, next SPX trading-day close, and current-week SPX close are now included because those line up better with option holding decisions than arbitrary futures wall-clock windows.');
  report.push('- This is underlying-price movement only. The available Barchart data here does not include option contract bars, so this does not model options P/L, IV, delta, theta, bid/ask spread, contract selection, or execution quality.');
  report.push('');
  report.push('## Data And Guardrails');
  report.push('');
  report.push(`- ES data: ${meta.es_data.bars.toLocaleString()} 1m bars, ${meta.es_data.first_timestamp} through ${meta.es_data.last_timestamp}.`);
  report.push(`- SPX data: ${meta.spx_data.bars.toLocaleString()} 1m bars, ${meta.spx_data.first_timestamp} through ${meta.spx_data.last_timestamp}.`);
  report.push(`- Flagship file: ${meta.flagship_file}.`);
  report.push(`- Flagship hash: ${meta.flagship_sha256.slice(0, 12)}.`);
  report.push(`- No-cheat rule: ${meta.no_cheat_rule}.`);
  report.push(`- SPX tradeability rule: ${meta.spx_tradeability_rule}.`);
  report.push('');
  report.push('## Swing Candidate Rule');
  report.push('');
  report.push('- 3 one-minute acceptance bars after reclaim.');
  report.push('- 1-minute dump window.');
  report.push('- Minimum flush depth: 1.00 ES point below level.');
  report.push('- Minimum prior tap groups: 3.');
  report.push('');
  report.push('## ES Continuous Reference');
  report.push('');
  report.push(mdTable(
    ['Horizon', 'Samples', 'Avg Close', 'Median Close', 'Avg MFE', 'Avg MAE', 'Close +%', 'MFE 10pt%', 'MFE 20pt%'],
    esSwing.map(row => [
      row.horizon_label,
      row.samples,
      num(row.avg_close_move_points),
      num(row.median_close_move_points),
      num(row.avg_mfe_points),
      num(row.avg_mae_points),
      pct(row.positive_close_rate),
      pct(row.mfe_10pt_rate),
      pct(row.mfe_20pt_rate),
    ])
  ));
  report.push('');
  report.push('## SPX RTH Underlying');
  report.push('');
  report.push(mdTable(
    ['Horizon', 'Samples', 'Avg Close', 'Median Close', 'Avg MFE', 'Avg MAE', 'Close +%', 'MFE 10pt%', 'MFE 20pt%'],
    spxSwing.map(row => [
      row.horizon_label,
      row.samples,
      num(row.avg_close_move_points),
      num(row.median_close_move_points),
      num(row.avg_mfe_points),
      num(row.avg_mae_points),
      pct(row.positive_close_rate),
      pct(row.mfe_10pt_rate),
      pct(row.mfe_20pt_rate),
    ])
  ));
  report.push('');
  report.push('## Short-Dated Options Proxy');
  report.push('');
  report.push('This section is not an option-backtest. It asks a narrower question: after the signal, how often does SPX move far enough in the favorable direction soon enough that a short-dated call could plausibly become mispriced or offer a sell-into-strength exit? For 0DTE/1DTE style trades, MFE matters more than end-of-window close, because the trade can work even if the index later fades.');
  report.push('');
  report.push(mdTable(
    ['Rule', 'Horizon', 'Samples', 'Close +%', 'Avg Close', 'Avg MFE', 'Median MFE', 'MFE 6pt%', 'MFE 10pt%', 'MFE 20pt%', 'Avg MAE'],
    summary.spx_rth_rows
      .filter(row => ['best_total', 'swing_candidate'].includes(row.candidate_id) && ['1h', '2h', '4h'].includes(row.horizon_id))
      .map(row => [
        row.candidate_label,
        row.horizon_label,
        row.samples,
        pct(row.positive_close_rate),
        num(row.avg_close_move_points),
        num(row.avg_mfe_points),
        num(row.median_mfe_points),
        pct(row.mfe_6pt_rate),
        pct(row.mfe_10pt_rate),
        pct(row.mfe_20pt_rate),
        num(row.avg_mae_points),
      ])
  ));
  report.push('');
  report.push('Short-dated read:');
  report.push('');
  report.push('- The swing candidate is not a clean 1h close-direction signal: SPX closes green only 50.0% of the time at 1 RTH hour and 2 RTH hours.');
  report.push('- But the same swing candidate reaches +10 SPX points of favorable excursion 61.8% of the time within 1 RTH hour and 70.6% within 2 RTH hours. It reaches +20 points 26.5% within 1 RTH hour and 47.1% within 2 RTH hours.');
  report.push('- That is the possible short-dated options edge: buy only when premium/IV/spread makes the required underlying move cheap enough, then sell into the impulse rather than treating the signal as a passive hold.');
  report.push('- The risk side is real. Average adverse excursion is 17.79 SPX points at 1 RTH hour and 24.92 at 2 RTH hours for the swing candidate, so short-dated contracts need a hard invalidation rule and cannot be left to decay through chop.');
  report.push('');
  report.push('## SPX Session Horizons');
  report.push('');
  report.push('These are option-decision style horizons: hold to the current SPX cash close, hold to the next SPX cash close, or hold to the end of the current SPX trading week. This is still underlying-only, but it maps more directly to same-day, next-day, and weekly option structures.');
  report.push('');
  report.push(mdTable(
    ['Horizon', 'Samples', 'Avg Close', 'Median Close', 'Avg MFE', 'Avg MAE', 'Close +%', 'MFE 10pt%', 'MFE 20pt%'],
    spxSessionSwing.map(row => [
      row.horizon_label,
      row.samples,
      num(row.avg_close_move_points),
      num(row.median_close_move_points),
      num(row.avg_mfe_points),
      num(row.avg_mae_points),
      pct(row.positive_close_rate),
      pct(row.mfe_10pt_rate),
      pct(row.mfe_20pt_rate),
    ])
  ));
  report.push('');
  report.push('Session-horizon read:');
  report.push('');
  report.push('- Same-day close is useful but not automatic: +18.33 SPX average close, +11.88 median close, 67.6% close-positive, with 55.9% reaching +20 SPX MFE before close.');
  report.push('- Next trading-day close is much stronger in this sample: +137.42 average close, +193.77 median close, 96.6% close-positive.');
  report.push('- End-of-week close is similarly strong: +143.04 average close, +204.38 median close, 94.1% close-positive.');
  report.push('- This is exactly where longer-dated options may fit better than 0DTE: the pattern can chop intraday but still resolve higher by next day/week close.');
  report.push('');
  report.push('## Paired ES/SPX RTH');
  report.push('');
  report.push(mdTable(
    ['Horizon', 'Samples', 'ES Avg Close', 'SPX Avg Close', 'ES +%', 'SPX +%', 'Both +%', 'SPX-ES Avg'],
    pairedSwing.map(row => [
      row.horizon_label,
      row.samples,
      num(row.es_avg_close_move_points),
      num(row.spx_avg_close_move_points),
      pct(row.es_positive_close_rate),
      pct(row.spx_positive_close_rate),
      pct(row.both_positive_close_rate),
      num(row.avg_spx_minus_es_close_points),
    ])
  ));
  report.push('');
  report.push('## Paired ES/SPX Session Horizons');
  report.push('');
  report.push(mdTable(
    ['Horizon', 'Samples', 'ES Avg Close', 'SPX Avg Close', 'ES +%', 'SPX +%', 'Both +%', 'SPX-ES Avg'],
    pairedSessionSwing.map(row => [
      row.horizon_label,
      row.samples,
      num(row.es_avg_close_move_points),
      num(row.spx_avg_close_move_points),
      pct(row.es_positive_close_rate),
      pct(row.spx_positive_close_rate),
      pct(row.both_positive_close_rate),
      num(row.avg_spx_minus_es_close_points),
    ])
  ));
  report.push('');
  report.push('## Concentration Check');
  report.push('');
  report.push(`- SPX swing sample date range: ${dateRange(spxEvents, 'swing_candidate')}.`);
  report.push(`- SPX 4 RTH hours: ${spxFourHour.sampleDays} signal days, ${spxFourHour.positiveDays} positive avg days, ${spxFourHour.negativeDays} negative avg days.`);
  report.push(`- SPX same-day close: ${spxEod.sampleDays} signal days, ${spxEod.positiveDays} positive avg days, ${spxEod.negativeDays} negative avg days.`);
  report.push(`- SPX next-day close: ${spxNextEod.sampleDays} signal days, ${spxNextEod.positiveDays} positive avg days, ${spxNextEod.negativeDays} negative avg days.`);
  report.push(`- SPX week close: ${spxEow.sampleDays} signal days, ${spxEow.positiveDays} positive avg days, ${spxEow.negativeDays} negative avg days.`);
  report.push(`- SPX 1 RTH day: ${spxOneDay.sampleDays} signal days, ${spxOneDay.positiveDays} positive avg days, ${spxOneDay.negativeDays} negative avg days.`);
  report.push(`- Paired SPX 1 RTH day: ${pairedOneDay.sampleDays} signal days, ${pairedOneDay.positiveDays} positive avg days, ${pairedOneDay.negativeDays} negative avg days.`);
  report.push(`- Paired SPX week close: ${pairedEow.sampleDays} signal days, ${pairedEow.positiveDays} positive avg days, ${pairedEow.negativeDays} negative avg days.`);
  report.push('');
  report.push('Top SPX 1 RTH day contributors:');
  report.push('');
  report.push(mdTable(
    ['Date', 'Signals', 'Avg Close', 'Sum Close'],
    spxOneDay.top.map(day => [day.date, day.count, num(day.avg), num(day.sum)])
  ));
  report.push('');
  report.push('Worst SPX 1 RTH day contributors:');
  report.push('');
  report.push(mdTable(
    ['Date', 'Signals', 'Avg Close', 'Sum Close'],
    spxOneDay.bottom.map(day => [day.date, day.count, num(day.avg), num(day.sum)])
  ));
  report.push('');
  report.push('Top SPX week-close contributors:');
  report.push('');
  report.push(mdTable(
    ['Date', 'Signals', 'Avg Close', 'Sum Close'],
    spxEow.top.map(day => [day.date, day.count, num(day.avg), num(day.sum)])
  ));
  report.push('');
  report.push('Worst SPX week-close contributors:');
  report.push('');
  report.push(mdTable(
    ['Date', 'Signals', 'Avg Close', 'Sum Close'],
    spxEow.bottom.map(day => [day.date, day.count, num(day.avg), num(day.sum)])
  ));
  report.push('');
  report.push('## Interpretation');
  report.push('');
  report.push('- For short-dated directional options, this still needs active execution: the 1h and 2h close-positive rates are only 50% on SPX RTH, despite useful MFE. The edge, if present, is selling the favorable excursion, not waiting for a clean close.');
  report.push('- For a potential longer-dated options filter, the 4h to 1.5 RTH day underlying window is where the signal becomes interesting: SPX swing candidate shows 73.5% close-positive at 4 RTH hours, 90.3% at 1 RTH day, and 96.6% at 1.5 RTH days.');
  report.push('- The session horizons strengthen the longer-dated read: same-day close is decent, but next-day and week-close are where the directional carry becomes much cleaner in this sample.');
  report.push('- ES generally moves slightly more than SPX on the paired RTH windows, but SPX tracks the same directional behavior closely enough to justify further options-specific research if real option bars become available.');
  report.push('- The 1-day and 1.5-day averages are strong, but they are still from a limited March/April sample and include a powerful trend regime. Treat this as an add-on swing flag, not proof to auto-size.');
  report.push('');
  report.push('## Files');
  report.push('');
  report.push('- `spx-rth-options-underlying.png`');
  report.push('- `paired-es-spx-rth.png`');
  report.push('- `spx-swing-avg-close.png`');
  report.push('- `spx-swing-avg-mfe.png`');
  report.push('- `options-horizons-spx-summary.json`');
  return report.join('\n');
}

function buildHtml(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let inTable = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('| ')) {
      const cells = line.slice(2, -2).split(' | ');
      if (i + 1 < lines.length && lines[i + 1].startsWith('| ---')) {
        html += '<table><thead><tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead><tbody>';
        inTable = true;
        i += 1;
      } else if (inTable) {
        html += '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
      }
      continue;
    }
    if (inTable) {
      html += '</tbody></table>';
      inTable = false;
    }
    if (line.startsWith('# ')) html += `<h1>${line.slice(2)}</h1>`;
    else if (line.startsWith('## ')) html += `<h2>${line.slice(3)}</h2>`;
    else if (line.startsWith('- ')) html += `<p class="bullet">${line}</p>`;
    else if (line.trim() === '') html += '';
    else html += `<p>${line}</p>`;
  }
  if (inTable) html += '</tbody></table>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Mancini Acceptance Underlying Carry Report</title><style>
    body { font-family: Arial, sans-serif; margin: 38px auto; max-width: 1120px; color: #17202a; line-height: 1.42; }
    h1 { font-size: 30px; margin: 0 0 18px; }
    h2 { font-size: 22px; margin: 28px 0 10px; border-top: 1px solid #d8dee6; padding-top: 20px; }
    p { margin: 8px 0; }
    .bullet { margin-left: 12px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 13px; }
    th, td { border: 1px solid #d8dee6; padding: 7px 8px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #f1f4f8; }
    code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
  </style></head><body>${html}</body></html>`;
}

function main() {
  const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
  const spxEvents = parseCsv(SPX_EVENTS_FILE);
  const pairedEvents = parseCsv(PAIRED_EVENTS_FILE);
  const spxSessionEvents = parseCsv(SPX_SESSION_EVENTS_FILE);
  const pairedSessionEvents = parseCsv(PAIRED_SESSION_EVENTS_FILE);
  const markdown = buildMarkdown(summary, spxEvents, pairedEvents, spxSessionEvents, pairedSessionEvents);
  const html = buildHtml(markdown);
  const mdFile = path.join(OUT_DIR, 'mancini-acceptance-carry-es-spx-underlying-report.md');
  const htmlFile = path.join(OUT_DIR, 'mancini-acceptance-carry-es-spx-underlying-report.html');
  fs.writeFileSync(mdFile, markdown, 'utf8');
  fs.writeFileSync(htmlFile, html, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    markdown: path.relative(ROOT, mdFile),
    html: path.relative(ROOT, htmlFile),
  }, null, 2));
}

main();
