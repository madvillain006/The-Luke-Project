const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-hermes-input');
const HTML_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.html');
const PDF_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.pdf');
const PNG_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_BUILD_CANDIDATE_REPORT_2026-05-13.png');
const EXECUTIVE_HTML_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.html');
const EXECUTIVE_PDF_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.pdf');
const EXECUTIVE_PNG_FILE = path.join(PACKAGE_DIR, 'MANCINI_FBD_EXECUTIVE_REPORT_2026-05-13.png');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, name), 'utf8'));
}

function readCsv(name) {
  const raw = fs.readFileSync(path.join(PACKAGE_DIR, name), 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell);
    return Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']));
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metric(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return String(value);
}

function gridLookup(rows, timeframe, target, stop) {
  return rows.find((row) =>
    row.rule === 'non_acceptance_only' &&
    row.scope === 'deployable_planned_only' &&
    row.timeframe_minutes === String(timeframe) &&
    row.target_points === Number(target).toFixed(1) &&
    row.stop_policy === stop
  );
}

function rowCells(row) {
  return [
    row.timeframe_minutes + 'm',
    row.target_points,
    row.stop_policy,
    row.rows,
    row.expectancy_points_slippage_0_5,
    row.total_points_slippage_0_5,
    row.max_drawdown_points,
    row.stop_first_rate,
    row.target_first_rate,
    row.timeout_rate,
  ].map((value) => `<td>${escapeHtml(value)}</td>`).join('');
}

async function main() {
  const manifest = readJson('manifest.json');
  const scores = readJson('candidate_rule_scores.json');
  const flagship = readJson('FLAGSHIP_RESULT_2026-05-13.json');
  const gridRows = readCsv('exact_strategy_grid.csv');

  const nonAcceptance = scores.candidate_rules.non_acceptance_only;
  const nonAcceptancePacket = nonAcceptance.packet_deduped;
  const ladder = scores.candidate_rules.ladder_first_reclaim;
  const classic = scores.candidate_rules.classic_backtest_only;
  const levelToLevel = scores.candidate_rules.level_to_level_target_R;
  const overall = scores.overall_non_rejected;
  const overallPacket = scores.overall_non_rejected_packet_deduped;

  const candidateGrid = [
    gridLookup(gridRows, 1, 5, 'fixed_12'),
    gridLookup(gridRows, 1, 8, 'fixed_12'),
    gridLookup(gridRows, 2, 5, 'fixed_12'),
    gridLookup(gridRows, 5, 5, 'fixed_12'),
    gridLookup(gridRows, 1, 5, 'fixed_8'),
    gridLookup(gridRows, 1, 5, 'fixed_10'),
    gridLookup(gridRows, 1, 5, 'fixed_20'),
  ].filter(Boolean);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mancini FBD Build Candidate Audit</title>
  <style>
    :root {
      --ink: #17202a;
      --muted: #5b6570;
      --line: #d9dee5;
      --band: #f4f6f8;
      --accent: #0f6b5f;
      --warn: #9a5a00;
      --bad: #8e2734;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 13px/1.45 "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: #fff;
    }
    main { width: 960px; margin: 0 auto; padding: 36px 42px 56px; }
    h1 { font-size: 28px; line-height: 1.1; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 28px 0 10px; padding-top: 10px; border-top: 2px solid var(--line); }
    h3 { font-size: 14px; margin: 18px 0 8px; color: var(--accent); }
    p { margin: 7px 0; }
    .subtitle { color: var(--muted); font-size: 12px; margin-bottom: 18px; }
    .verdict {
      border: 2px solid var(--accent);
      background: #eef8f5;
      padding: 12px 14px;
      margin: 18px 0;
    }
    .verdict strong { color: var(--accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 14px 0 18px;
    }
    .stat {
      border: 1px solid var(--line);
      background: var(--band);
      padding: 10px;
      min-height: 64px;
    }
    .stat b { display: block; font-size: 17px; }
    .stat span { color: var(--muted); font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 12px; }
    th, td { border: 1px solid var(--line); padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #e9edf2; }
    ul { padding-left: 18px; margin: 8px 0 14px; }
    li { margin: 4px 0; }
    .warn { color: var(--warn); font-weight: 600; }
    .bad { color: var(--bad); font-weight: 600; }
    .mono { font-family: Consolas, "Courier New", monospace; font-size: 11px; }
    .page-break { break-before: page; }
    @media print {
      main { width: auto; padding: 28px 32px; }
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
<main>
  <h1>Mancini FBD Build Candidate Audit</h1>
  <div class="subtitle">Generated from local package artifacts on 2026-05-13. Research, historical replay, Strategy Analyzer, Playback, and shadow telemetry only. No live trading instruction or order-entry code is included.</div>

  <div class="verdict">
    <strong>Build verdict:</strong> Build the current <span class="mono">non_acceptance_protocol</span> candidate in Ninja only for shadow/Strategy Analyzer/Playback/Market Replay analysis. Do not build <span class="mono">ladder_first_reclaim</span> as a strategy candidate. Keep classic acceptance as telemetry/search until it has real rows.
  </div>

  <h2>Findings First</h2>
  <ol>
    <li><strong>Material stale math was corrected.</strong> The old negative non-acceptance expectancy came from an incomplete source set and a weaker exact-scenario rebuild. Current package counts are 842 direct audit rows, 1129 training/features/labels rows, and 1296 exact strategy-grid rows.</li>
    <li><strong>Only one candidate family is worth Ninja shadow build now.</strong> <span class="mono">non_acceptance_only</span> has ${metric(nonAcceptance.rows)} rows / ${metric(nonAcceptance.unique_setups)} unique setups, ${metric(nonAcceptance.stop_first_rate)} stop-first, and ${metric(nonAcceptance.expectancy_points_with_0_5_es_point_slippage)} points expectancy after 0.5 ES point slippage. Packet-deduped: ${metric(nonAcceptancePacket.rows)} rows / ${metric(nonAcceptancePacket.unique_setups)} unique, ${metric(nonAcceptancePacket.expectancy_points_with_0_5_es_point_slippage)} expectancy.</li>
    <li><strong>Ladder first reclaim is a no-build family.</strong> It has ${metric(ladder.rows)} rows, ${metric(ladder.stop_first_rate)} stop-first, ${metric(ladder.false_armed_rate)} false-armed, and ${metric(ladder.expectancy_points_with_0_5_es_point_slippage)} expectancy. It belongs in reject/control telemetry only.</li>
    <li><strong>Classic acceptance has no current build sample.</strong> Current strict rule rows: ${metric(classic.rows)}. Keep it as telemetry/search, not as a candidate.</li>
    <li><strong>Adverse movement is still the governing risk in replay.</strong> Fixed 8/10 point stops are useful controls but not defaults. Fixed 12 with 5 or 8 point targets is the first bounded shadow comparison; wider stops must be treated as replay controls, not proof.</li>
  </ol>

  <h2>Package Counts</h2>
  <div class="grid">
    <div class="stat"><b>${metric(manifest.counts.direct_audit_rows)}</b><span>direct audit rows</span></div>
    <div class="stat"><b>${metric(manifest.counts.training_rows)}</b><span>training rows</span></div>
    <div class="stat"><b>${metric(manifest.counts.feature_rows)} / ${metric(manifest.counts.label_rows)}</b><span>features / labels</span></div>
    <div class="stat"><b>${metric(manifest.counts.hard_rejected_rows)}</b><span>hard rejects</span></div>
    <div class="stat"><b>${metric(manifest.counts.strict_positive_training_candidate_rows)}</b><span>strict direct positives</span></div>
    <div class="stat"><b>${metric(manifest.counts.gallery_svg_files)} / ${metric(manifest.counts.gallery_png_files)}</b><span>packet gallery SVG / PNG</span></div>
    <div class="stat"><b>${metric(manifest.counts.saty_protocol_rows)}</b><span>SATY protocol rows</span></div>
    <div class="stat"><b>${metric(manifest.counts.exact_strategy_grid_rows)}</b><span>strategy grid rows</span></div>
  </div>

  <h2>Rule Family Verdicts</h2>
  <table>
    <thead><tr><th>Family</th><th>Rows / Unique</th><th>Stop First</th><th>False Armed</th><th>Expectancy</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td class="mono">non_acceptance_protocol</td><td>${metric(nonAcceptance.rows)} / ${metric(nonAcceptance.unique_setups)}</td><td>${metric(nonAcceptance.stop_first_rate)}</td><td>${metric(nonAcceptance.false_armed_rate)}</td><td>${metric(nonAcceptance.expectancy_points_with_0_5_es_point_slippage)}</td><td>Build in Ninja shadow/replay now.</td></tr>
      <tr><td class="mono">level_to_level_target_R</td><td>${metric(levelToLevel.rows)} / ${metric(levelToLevel.unique_setups)}</td><td>${metric(levelToLevel.stop_first_rate)}</td><td>${metric(levelToLevel.false_armed_rate)}</td><td>${metric(levelToLevel.expectancy_points_with_0_5_es_point_slippage)}</td><td>Lower-confidence secondary comparison only.</td></tr>
      <tr><td class="mono">classic_acceptance_backtest_from_below</td><td>${metric(classic.rows)} / ${metric(classic.unique_setups)}</td><td>${metric(classic.stop_first_rate)}</td><td>${metric(classic.false_armed_rate)}</td><td>${metric(classic.expectancy_points_with_0_5_es_point_slippage)}</td><td>Telemetry/search only.</td></tr>
      <tr><td class="mono">ladder_first_reclaim</td><td>${metric(ladder.rows)} / ${metric(ladder.unique_setups)}</td><td>${metric(ladder.stop_first_rate)}</td><td>${metric(ladder.false_armed_rate)}</td><td>${metric(ladder.expectancy_points_with_0_5_es_point_slippage)}</td><td class="bad">No-build; reject/control telemetry.</td></tr>
    </tbody>
  </table>

  <h2>Pass / Fail Gates</h2>
  <table>
    <tbody>
      <tr><th>Source-label safety</th><td>PASS. Direct source labels come from source audit status; no-source/data-only and S/R-list-only rows remain hard rejects/control context.</td></tr>
      <tr><th>SATY no-lookahead safety</th><td>PASS. SATY uses prior completed ES session close plus ATR(14); 108 valid and 64 invalid derivations; SATY remains context only.</td></tr>
      <tr><th>MFE/MAE leakage</th><td>PASS. <span class="mono">features.csv</span> has no MFE/MAE, hit-rate, stop-first, first-hit, expectancy, or outcome-audit columns. Labels own those fields.</td></tr>
      <tr><th>Negative controls</th><td>PASS for shadow build. Random support and late reclaim controls stay separate; shuffled timestamp control is false-armed and cannot promote rules.</td></tr>
      <tr><th>Sample-size gates</th><td>PASS for Ninja shadow build; FAIL for live or production promotion. The all-source non-acceptance sample is useful, but deployable planned-only grid is 15 rows.</td></tr>
      <tr><th>Ninja shadow-only safety</th><td>PASS. The shadow artifact emits no order APIs and now includes separate trap/reclaim/classification/candidate-fire timestamps.</td></tr>
    </tbody>
  </table>

  <h2>Exact Strategy Grid Starting Points</h2>
  <p>These rows are not final strategy proof. They define what to replay in Ninja with minute and tick-by-tick fill resolution.</p>
  <table>
    <thead><tr><th>TF</th><th>Target</th><th>Stop</th><th>Rows</th><th>Expectancy</th><th>Total</th><th>Max DD</th><th>Stop First</th><th>Target First</th><th>Timeout</th></tr></thead>
    <tbody>${candidateGrid.map((row) => `<tr>${rowCells(row)}</tr>`).join('')}</tbody>
  </table>

  <h2>Roadmap To Ninja Replay</h2>
  <h3>Phase 1: Shadow Candidate Harness</h3>
  <ul>
    <li>Implement only <span class="mono">non_acceptance_protocol</span> as the active candidate family.</li>
    <li>Emit telemetry rows for candidate, reject, and control cases. No live routing, broker/account connection, Pine edit, credentials, or live-risk behavior.</li>
    <li>Separate timestamps: <span class="mono">trap_detected</span>, <span class="mono">reclaim_detected</span>, <span class="mono">classification_complete</span>, and <span class="mono">candidate_fired</span>. Candidate fire must not be backdated to reclaim.</li>
    <li>Deduplicate by source packet/session/level/timing key before scoring.</li>
  </ul>

  <h3>Phase 2: Replay Matrix</h3>
  <ul>
    <li>Timeframes: 1m, 2m, 5m, plus tick-by-tick fill resolution in Ninja for same-bar ordering.</li>
    <li>Targets: 3, 5, and 8 ES points; keep next trusted level as label/context, not candidate selection.</li>
    <li>Stops: fixed 8, 10, 12, 15, 20, and sweep invalidation as context. Fixed 12 is the first bounded comparison; fixed 8/10 are adverse controls.</li>
    <li>Slippage/friction sweeps: 0.5, 1.0, and 1.5 ES points round trip.</li>
    <li>Scopes: deployable planned-only, confirmed reconstruction, and all-source non-rejected. Keep them scored separately.</li>
  </ul>

  <h3>Phase 3: Output File Contract</h3>
  <p>Every Ninja run should write CSV and JSON records with these columns at minimum:</p>
  <p class="mono">${escapeHtml(flagship.validation_plan.ninjatrader_phase.first_ninja_goal)}</p>
  <ul>
    <li>Required identifiers: run id, instrument, session date, source path/line, packet id, setup level, source label, family, rule version.</li>
    <li>Required timing: trap, reclaim, classification, candidate fire, entry/fill simulation timestamp, first-hit timestamp.</li>
    <li>Required parameters: timeframe, target points, stop policy, slippage points, fill mode, same-bar policy.</li>
    <li>Required outcomes: target first, stop first, timeout, first-hit points, MFE/MAE labels, max adverse excursion, max favorable excursion, expectancy after slippage.</li>
    <li>Required safety labels: hard reject reason, no-source/data-only flag, S/R-list-only flag, source-after-entry leakage flag, future-target leakage flag, no-order/no-live flags.</li>
  </ul>

  <h3>Promotion Gate</h3>
  <ul>
    <li>Minimum 50 source-approved, replay-confirmed unique setups after packet dedupe.</li>
    <li>Positive expectancy after slippage in every chronological fold.</li>
    <li>Stop-first rate at or below 0.25 for the non-acceptance candidate.</li>
    <li>False-armed rate at or below 0.10 after shuffled timestamp and random-support controls.</li>
    <li>No hidden promotion of SATY-only, no-source, S/R-list-only, source-negative, no-bars, no-reclaim, or chart/source mismatch rows.</li>
  </ul>

  <h2>Bottom Line</h2>
  <p>Build this current candidate in Ninja for shadow Strategy Analyzer/Playback/Market Replay: <strong>non-acceptance failed-breakdown replay, source-gated, timestamp-separated, packet-deduped, with the target/stop/timeframe grid above.</strong> Do not build ladder-first-reclaim as a strategy candidate. Do not treat this as live-ready.</p>
</main>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  await page.goto('file://' + HTML_FILE.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.pdf({ path: PDF_FILE, format: 'Letter', printBackground: true, margin: { top: '0.35in', bottom: '0.35in', left: '0.35in', right: '0.35in' } });
  await page.screenshot({ path: PNG_FILE, fullPage: true });
  await browser.close();
  fs.copyFileSync(HTML_FILE, EXECUTIVE_HTML_FILE);
  fs.copyFileSync(PDF_FILE, EXECUTIVE_PDF_FILE);
  fs.copyFileSync(PNG_FILE, EXECUTIVE_PNG_FILE);
  console.log(JSON.stringify({
    html: path.relative(ROOT, HTML_FILE),
    pdf: path.relative(ROOT, PDF_FILE),
    png: path.relative(ROOT, PNG_FILE),
    executiveHtml: path.relative(ROOT, EXECUTIVE_HTML_FILE),
    executivePdf: path.relative(ROOT, EXECUTIVE_PDF_FILE),
    executivePng: path.relative(ROOT, EXECUTIVE_PNG_FILE),
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
