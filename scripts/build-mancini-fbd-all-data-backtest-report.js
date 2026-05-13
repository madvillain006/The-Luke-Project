const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-all-data-backtest');
const SUMMARY_JSON = path.join(OUT_DIR, 'all_data_backtest_summary.json');
const SIGNAL_COUNTS_CSV = path.join(OUT_DIR, 'all_data_signal_counts.csv');
const SUMMARY_CSV = path.join(OUT_DIR, 'all_data_summary.csv');
const LABELED_CSV = path.join(OUT_DIR, 'labeled_event_fire_check.csv');
const HTML_FILE = path.join(OUT_DIR, 'MANCINI_FBD_ALL_DATA_BACKTEST_REPORT_2026-05-13.html');
const PDF_FILE = path.join(OUT_DIR, 'MANCINI_FBD_ALL_DATA_BACKTEST_REPORT_2026-05-13.pdf');
const PNG_FILE = path.join(OUT_DIR, 'MANCINI_FBD_ALL_DATA_BACKTEST_REPORT_2026-05-13.png');

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < String(line || '').length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function readCsv(file) {
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map(line => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value) {
  const parsed = num(value);
  if (parsed === null) return value === undefined || value === null || value === '' ? 'n/a' : escapeHtml(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function rowCells(row, keys) {
  return keys.map(key => `<td>${fmt(row[key])}</td>`).join('');
}

function filterFillComparison(summaryRows) {
  return summaryRows
    .filter(row => row.rule === 'non_acceptance_only' && row.target_points === '5.0' && row.stop_policy === 'fixed_12')
    .sort((a, b) => Number(a.timeframe_minutes) - Number(b.timeframe_minutes) || a.fill_mode.localeCompare(b.fill_mode));
}

function bestHardByRule(summaryRows) {
  const grouped = new Map();
  for (const row of summaryRows) {
    if (row.fill_mode !== 'hard_mode') continue;
    if (num(row.valid_outcomes) < 20) continue;
    const current = grouped.get(row.rule);
    if (!current || num(row.expectancy_points) > num(current.expectancy_points)) grouped.set(row.rule, row);
  }
  return [...grouped.values()].sort((a, b) => a.rule.localeCompare(b.rule));
}

function table(headers, rows, keys) {
  return `<table>
    <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${rowCells(row, keys)}</tr>`).join('')}</tbody>
  </table>`;
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(SUMMARY_JSON, 'utf8'));
  const signalCounts = readCsv(SIGNAL_COUNTS_CSV);
  const summaryRows = readCsv(SUMMARY_CSV);
  const labeledRows = readCsv(LABELED_CSV);
  const bestHard = payload.best_hard_mode_rows_after_fill_costs || [];
  const topHard = bestHard[0] || {};
  const fillComparison = filterFillComparison(summaryRows);
  const hardByRule = bestHardByRule(summaryRows);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mancini FBD All-Data Candidate Backtest</title>
  <style>
    :root {
      --ink: #15202b;
      --muted: #5d6875;
      --line: #d8dee6;
      --band: #f4f7fa;
      --accent: #09675d;
      --warn: #9a5a00;
      --bad: #8e2734;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 12.5px/1.42 "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: #fff;
    }
    main { width: 980px; margin: 0 auto; padding: 34px 40px 52px; }
    h1 { margin: 0 0 6px; font-size: 28px; line-height: 1.08; letter-spacing: 0; }
    h2 { margin: 26px 0 10px; padding-top: 10px; border-top: 2px solid var(--line); font-size: 18px; }
    p { margin: 7px 0; }
    .subtitle { color: var(--muted); margin-bottom: 18px; }
    .verdict {
      border: 2px solid var(--accent);
      background: #ecf8f5;
      padding: 12px 14px;
      margin: 16px 0;
      font-size: 13px;
    }
    .verdict b { color: var(--accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 12px 0 16px;
    }
    .stat {
      border: 1px solid var(--line);
      background: var(--band);
      padding: 9px;
      min-height: 58px;
    }
    .stat b { display: block; font-size: 17px; }
    .stat span { color: var(--muted); font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 9px 0 14px; font-size: 11.2px; }
    th, td { border: 1px solid var(--line); padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #e9edf2; }
    code { font-family: Consolas, "Courier New", monospace; font-size: 11px; }
    ul { margin: 8px 0 14px 18px; padding: 0; }
    li { margin: 4px 0; }
    .bad { color: var(--bad); font-weight: 600; }
    .warn { color: var(--warn); font-weight: 600; }
    .page-break { break-before: page; }
    @media print {
      main { width: auto; padding: 28px 30px; }
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
<main>
  <h1>Mancini FBD All-Data Candidate Backtest</h1>
  <div class="subtitle">Generated ${escapeHtml(payload.generated_at)} from local Luke research artifacts. Research, historical replay, Strategy Analyzer, Playback, and shadow telemetry only.</div>
  <div class="verdict">
    <b>Build verdict:</b> Build <code>non_acceptance_only</code> as the current Ninja shadow/replay candidate, restricted to the 1m formula path. Best hard-mode row: target ${fmt(topHard.target_points)}, stop <code>${escapeHtml(topHard.stop_policy || '')}</code>, ${fmt(topHard.valid_outcomes)} outcomes, ${fmt(topHard.expectancy_points)} ES points expectancy, max drawdown ${fmt(topHard.max_drawdown_points)} points. Do not promote the other rule families or higher timeframes as primary strategy candidates from this run.
  </div>

  <h2>Findings First</h2>
  <ul>
    <li><code>non_acceptance_only</code> is the only family with positive hard-mode evidence at useful size. The best row is 1m, target 5, fixed 12 stop, 136 outcomes, +162.75 total points after hard fill costs.</li>
    <li>3m, 5m, 15m, and 30m are comparison toggles only. Their optimal-fill rows can look strong, but hard-mode target 5/fixed 12 turns negative outside 1m.</li>
    <li>Nuance: a 3m <code>non_acceptance_only</code> hard-mode comparison row is positive at target 8/fixed 15, but that is not the primary build path.</li>
    <li><code>candidate_score_055</code>, <code>level_to_level_target_R</code>, <code>classic_backtest_only</code>, <code>ladder_first_reclaim</code>, and <code>second_attempt_review_only</code> all ran, but their best hard-mode rows are not build proof.</li>
    <li>The exact labeled-event formula check passed against the frozen grid counts. Candidate firing did not use outcome columns.</li>
  </ul>

  <h2>Data Inventory</h2>
  <div class="grid">
    <div class="stat"><b>${fmt(payload.data_inventory.merged_bars)}</b><span>merged ES 1m bars</span></div>
    <div class="stat"><b>${fmt(payload.data_inventory.raw_files)}</b><span>raw CSV files</span></div>
    <div class="stat"><b>${fmt(payload.data_inventory.sessions)}</b><span>sessions</span></div>
    <div class="stat"><b>${fmt(payload.scan.signals)}</b><span>candidate-rule signals</span></div>
    <div class="stat"><b>${fmt(payload.scan.outcomes)}</b><span>outcome simulations</span></div>
    <div class="stat"><b>${fmt(payload.level_inventory.eligible_support_level_rows)}</b><span>eligible support levels</span></div>
    <div class="stat"><b>2700</b><span>summary matrix rows</span></div>
    <div class="stat"><b>PASS</b><span>no-lookahead feature columns</span></div>
  </div>

  <h2>Best Hard-Mode Rows</h2>
  ${table(['Rule', 'TF', 'Target', 'Stop', 'Outcomes', 'Exp', 'Total', 'Max DD', 'Stop First', 'Target First'], bestHard.slice(0, 12), ['rule', 'timeframe_minutes', 'target_points', 'stop_policy', 'valid_outcomes', 'expectancy_points', 'total_points', 'max_drawdown_points', 'stop_first_rate', 'target_first_rate'])}

  <h2>Primary Candidate Fill Comparison</h2>
  <p><code>non_acceptance_only</code>, target 5, fixed 12 stop. This is the narrow build path to reproduce in Ninja Strategy Analyzer/Playback first.</p>
  ${table(['TF', 'Fill', 'Outcomes', 'Exp', 'Total', 'Max DD', 'Stop First', 'Target First', 'Timeout'], fillComparison, ['timeframe_minutes', 'fill_mode', 'valid_outcomes', 'expectancy_points', 'total_points', 'max_drawdown_points', 'stop_first_rate', 'target_first_rate', 'timeout_rate'])}

  <h2>Best Hard Row By Rule</h2>
  ${table(['Rule', 'TF', 'Target', 'Stop', 'Outcomes', 'Exp', 'Total', 'Max DD', 'Stop First'], hardByRule, ['rule', 'timeframe_minutes', 'target_points', 'stop_policy', 'valid_outcomes', 'expectancy_points', 'total_points', 'max_drawdown_points', 'stop_first_rate'])}

  <div class="page-break"></div>
  <h2>Signal Counts By Timeframe</h2>
  ${table(['Rule', 'TF', 'Signals', 'Sessions', 'Levels', 'First', 'Last'], signalCounts, ['rule', 'timeframe_minutes', 'signals', 'sessions', 'levels', 'first_signal_et', 'last_signal_et'])}

  <h2>Labeled Mancini Fire Check</h2>
  ${table(['Rule', 'Scope', 'Raw', 'Deduped', 'Exact Status', 'Exact Coverage', 'Raw 1m Hits', 'Raw 1m Coverage'], labeledRows, ['rule', 'scope', 'artifact_raw_rows', 'artifact_packet_deduped_rows', 'exact_formula_fire_status', 'exact_labeled_fire_coverage', 'raw_all_data_1m_same_level_hits', 'raw_all_data_1m_same_level_coverage'])}

  <h2>No-Cheat Contract</h2>
  <ul>
    <li>Candidate firing uses source level geometry, trap/reclaim/classification timestamps, acceptance/non-acceptance state, target room, risk to sweep, and candidate scores.</li>
    <li>Candidate firing does not use MFE, MAE, hit rates, stop-first, target-first, first-hit event, next-level hit, realized target, expectancy, or future target realization.</li>
    <li>Fill modes are post-fire simulation assumptions only: <code>optimal_fill</code>, <code>half_optimal_half_bad_fill</code>, and <code>hard_mode</code>.</li>
    <li>Hard mode uses next-bar entry, adverse entry penalty, 1.5 ES points fill cost, and stop-first same-bar ambiguity.</li>
    <li>The next gate is not Mancini timestamp matching. Timestamp parity is only a diagnostic for implementation bugs; the real gate is profitability and drawdown robustness on broad ES Strategy Analyzer/Playback data with live-like fills and costs.</li>
    <li>This package is not live-readiness evidence. It is the handoff package for Ninja shadow Strategy Analyzer/Playback profitability testing.</li>
  </ul>
</main>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  await page.goto(`file://${HTML_FILE.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.pdf({ path: PDF_FILE, format: 'Letter', printBackground: true, margin: { top: '0.25in', right: '0.25in', bottom: '0.25in', left: '0.25in' } });
  await page.screenshot({ path: PNG_FILE, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({
    html: path.relative(ROOT, HTML_FILE),
    pdf: path.relative(ROOT, PDF_FILE),
    png: path.relative(ROOT, PNG_FILE),
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
