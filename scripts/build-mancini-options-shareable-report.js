'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');
const REPORT_DIR = path.join(OUT_DIR, 'shareable-report');
const SUMMARY_FILE = path.join(OUT_DIR, 'options-horizons-spx-summary.json');
const SPX_RTH_EVENTS_FILE = path.join(OUT_DIR, 'spx-rth-events.csv');
const SPX_SESSION_EVENTS_FILE = path.join(OUT_DIR, 'spx-session-events.csv');

const HTML_FILE = path.join(REPORT_DIR, 'mancini-acceptance-carry-shareable-report.html');
const PDF_FILE = path.join(REPORT_DIR, 'mancini-acceptance-carry-shareable-report.pdf');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

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
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : 'n/a';
}

function pts(value, signed = false) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value);
  return `${signed && n > 0 ? '+' : ''}${n.toFixed(2)}`;
}

function rowFor(rows, id, candidate = 'swing_candidate') {
  return rows.find(row => row.candidate_id === candidate && row.horizon_id === id) || {};
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function stat(label, value, sub = '') {
  return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`;
}

function page(title, body) {
  return `<section class="page"><h1>${title}</h1>${body}<div class="footer">Mancini acceptance carry research - underlying only</div></section>`;
}

function concentration(events, horizonId) {
  const rows = events.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === horizonId);
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(Number(row.close_move_points));
  }
  const days = [...byDate.entries()].map(([date, values]) => {
    const sum = values.reduce((total, value) => total + value, 0);
    return { date, count: values.length, avg: sum / values.length, sum };
  }).sort((a, b) => b.sum - a.sum);
  return {
    days,
    positiveDays: days.filter(day => day.avg > 0).length,
    negativeDays: days.filter(day => day.avg < 0).length,
    top: days.slice(0, 3),
    bottom: [...days].sort((a, b) => a.sum - b.sum).slice(0, 3),
  };
}

function buildHtml(summary, spxRthEvents, spxSessionEvents) {
  const meta = summary.metadata;
  const es = summary.es_continuous_rows.filter(row => row.candidate_id === 'swing_candidate');
  const spx = summary.spx_rth_rows.filter(row => row.candidate_id === 'swing_candidate');
  const session = summary.spx_session_rows.filter(row => row.candidate_id === 'swing_candidate');
  const paired = summary.paired_es_spx_session_rows.filter(row => row.candidate_id === 'swing_candidate');
  const spx1h = rowFor(summary.spx_rth_rows, '1h');
  const spx2h = rowFor(summary.spx_rth_rows, '2h');
  const spx4h = rowFor(summary.spx_rth_rows, '4h');
  const sameDay = rowFor(summary.spx_session_rows, 'spx_eod');
  const nextDay = rowFor(summary.spx_session_rows, 'spx_next_eod');
  const weekClose = rowFor(summary.spx_session_rows, 'spx_eow');
  const oneDayConc = concentration(spxRthEvents, '1d');
  const eowConc = concentration(spxSessionEvents, 'spx_eow');

  const pages = [
    page('Mancini Acceptance Carry: ES + SPX', `
      <p class="dek">ES fake-breakdown acceptance signal tested against ES continuous movement and SPX cash-session underlying movement. This is built for options idea generation, but it is not an options P/L backtest.</p>
      <div class="stats">
        ${stat('SPX same-day close+', pct(sameDay.positive_close_rate), `${pts(sameDay.avg_close_move_points, true)} avg close pts`)}
        ${stat('SPX next-day close+', pct(nextDay.positive_close_rate), `${pts(nextDay.avg_close_move_points, true)} avg close pts`)}
        ${stat('SPX week-close+', pct(weekClose.positive_close_rate), `${pts(weekClose.avg_close_move_points, true)} avg close pts`)}
      </div>
      <h2>Guardrails</h2>
      <ul>
        <li>No planned-entry backfill: entry is the next 1m open after hold confirmation.</li>
        <li>Mancini levels must be known before the session date.</li>
        <li>SPX sections exclude overnight ES-only signals; signal must map to a cash-session SPX bar within five minutes.</li>
        <li>No option contract bars are present, so IV, theta, delta, bid/ask, and contract selection are not modeled.</li>
      </ul>
      <h2>Swing Candidate Rule</h2>
      <p>3 one-minute acceptance bars after reclaim; 1-minute dump window; minimum 1.00 ES point flush below level; minimum 3 prior tap groups.</p>
      <p class="small">Generated ${meta.generated_at}. Flagship hash ${String(meta.flagship_sha256).slice(0, 12)}.</p>
    `),
    page('Forward Movement Summary', `
      <div class="twocol">
        <div>
          <h2>ES Continuous Reference</h2>
          ${table(['Horizon', 'N', 'Avg Close', 'Median', 'Avg MFE', 'Close +'], es.map(row => [
            row.horizon_label, row.samples, pts(row.avg_close_move_points, true), pts(row.median_close_move_points, true), pts(row.avg_mfe_points), pct(row.positive_close_rate),
          ]))}
        </div>
        <div>
          <h2>SPX RTH Underlying</h2>
          ${table(['Horizon', 'N', 'Avg Close', 'Median', 'Avg MFE', 'Close +'], spx.map(row => [
            row.horizon_label, row.samples, pts(row.avg_close_move_points, true), pts(row.median_close_move_points, true), pts(row.avg_mfe_points), pct(row.positive_close_rate),
          ]))}
        </div>
      </div>
      <p class="note">The 1h and 2h SPX close-positive rates are only 50.0%. That is not a passive close-to-close scalp edge. The value for short-dated options is whether MFE is large enough to sell into the impulse.</p>
    `),
    page('Short-Dated Options Proxy', `
      <p>The available data cannot price options. This section asks the narrower question: how often does SPX make enough favorable movement soon enough that a short-dated call might become mispriced or offer a sell-into-strength exit?</p>
      <div class="stats">
        ${stat('1h MFE >= 10 pts', pct(spx1h.mfe_10pt_rate), `${pct(spx1h.positive_close_rate)} close-positive`)}
        ${stat('2h MFE >= 10 pts', pct(spx2h.mfe_10pt_rate), `${pct(spx2h.positive_close_rate)} close-positive`)}
        ${stat('4h MFE >= 20 pts', pct(spx4h.mfe_20pt_rate), `${pct(spx4h.positive_close_rate)} close-positive`)}
      </div>
      ${table(['Horizon', 'N', 'Avg Close', 'Avg MFE', 'Median MFE', 'MFE 6+', 'MFE 10+', 'MFE 20+', 'Avg MAE'], spx.filter(row => ['1h', '2h', '4h'].includes(row.horizon_id)).map(row => [
        row.horizon_label, row.samples, pts(row.avg_close_move_points, true), pts(row.avg_mfe_points), pts(row.median_mfe_points), pct(row.mfe_6pt_rate), pct(row.mfe_10pt_rate), pct(row.mfe_20pt_rate), pts(row.avg_mae_points),
      ]))}
      <p class="note">Risk is material: average adverse excursion is ${pts(spx1h.avg_mae_points)} SPX pts at 1h and ${pts(spx2h.avg_mae_points)} at 2h. Short-dated contracts need hard invalidation and active exits.</p>
    `),
    page('SPX Session Horizons', `
      <p>These horizons line up with option-holding decisions better than arbitrary wall-clock windows: same SPX cash close, next SPX cash close, and current-week SPX close.</p>
      ${table(['Horizon', 'N', 'Avg Close', 'Median', 'Avg MFE', 'Avg MAE', 'Close +', 'MFE 20+'], session.map(row => [
        row.horizon_label, row.samples, pts(row.avg_close_move_points, true), pts(row.median_close_move_points, true), pts(row.avg_mfe_points), pts(row.avg_mae_points), pct(row.positive_close_rate), pct(row.mfe_20pt_rate),
      ]))}
      <h2>Paired ES/SPX Session View</h2>
      ${table(['Horizon', 'N', 'ES Avg', 'SPX Avg', 'ES +', 'SPX +', 'Both +'], paired.map(row => [
        row.horizon_label, row.samples, pts(row.es_avg_close_move_points, true), pts(row.spx_avg_close_move_points, true), pct(row.es_positive_close_rate), pct(row.spx_positive_close_rate), pct(row.both_positive_close_rate),
      ]))}
      <p class="note">Same-day close is decent. Next-day and week-close are much cleaner in this sample, which favors swing-option structures over blind 0DTE holding.</p>
    `),
    page('Concentration And Read', `
      <div class="twocol">
        <div>
          <h2>SPX 1 RTH Day</h2>
          <p>${oneDayConc.days.length} signal days, ${oneDayConc.positiveDays} positive avg days, ${oneDayConc.negativeDays} negative avg days.</p>
          ${table(['Top Date', 'Signals', 'Avg', 'Sum'], oneDayConc.top.map(day => [day.date, day.count, pts(day.avg, true), pts(day.sum, true)]))}
        </div>
        <div>
          <h2>SPX Week Close</h2>
          <p>${eowConc.days.length} signal days, ${eowConc.positiveDays} positive avg days, ${eowConc.negativeDays} negative avg days.</p>
          ${table(['Top Date', 'Signals', 'Avg', 'Sum'], eowConc.top.map(day => [day.date, day.count, pts(day.avg, true), pts(day.sum, true)]))}
        </div>
      </div>
      <h2>Practical Read</h2>
      <ul>
        <li>Promising as an add-on SPX options filter candidate.</li>
        <li>Short-dated use should focus on MFE and active exits, not passive holding.</li>
        <li>Longer-dated use has better underlying carry through next-day and week-close windows.</li>
        <li>Still not proof to auto-size: sample is limited and regime-sensitive, and actual option contract bars are missing.</li>
      </ul>
    `),
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><title>Mancini Acceptance Carry Shareable Report</title><style>
    @page { size: Letter; margin: 0.42in; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f5; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 8.5in; min-height: 11in; margin: 0 auto 18px; padding: 0.42in 0.5in 0.55in; background: #fff; page-break-after: always; position: relative; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 18px 0 8px; }
    p, li { font-size: 12.5px; line-height: 1.42; }
    .dek { font-size: 14px; color: #374151; margin-bottom: 16px; }
    .small { font-size: 10px; color: #6b7280; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 18px; }
    .stat { border: 1px solid #d7dee7; background: #f7fafc; border-radius: 8px; padding: 10px; }
    .stat-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #64748b; font-weight: 700; }
    .stat-value { font-size: 22px; font-weight: 800; margin: 3px 0; color: #0f766e; }
    .stat-sub { font-size: 10.5px; color: #475569; }
    .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10.4px; }
    th, td { border: 1px solid #dbe3ec; padding: 5.5px 6px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #eef3f7; color: #26313d; }
    .note { background: #f1f5f9; border-left: 4px solid #0f766e; padding: 9px 10px; color: #334155; }
    ul { padding-left: 18px; margin-top: 8px; }
    .footer { position: absolute; bottom: 0.24in; left: 0.5in; right: 0.5in; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 9.5px; color: #94a3b8; }
    @media print { body { background: #fff; } .page { margin: 0; min-height: auto; } }
  </style></head><body>${pages.join('\n')}</body></html>`;
}

async function render() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1020, height: 1320 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(HTML_FILE).href, { waitUntil: 'load' });
  await page.pdf({
    path: PDF_FILE,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });
  const pageNodes = await page.locator('.page').all();
  for (let i = 0; i < pageNodes.length; i += 1) {
    await pageNodes[i].screenshot({ path: path.join(REPORT_DIR, `page-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
}

async function main() {
  ensureDir(REPORT_DIR);
  const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
  const spxRthEvents = parseCsv(SPX_RTH_EVENTS_FILE);
  const spxSessionEvents = parseCsv(SPX_SESSION_EVENTS_FILE);
  fs.writeFileSync(HTML_FILE, buildHtml(summary, spxRthEvents, spxSessionEvents), 'utf8');
  await render();
  console.log(JSON.stringify({
    ok: true,
    pdf: path.relative(ROOT, PDF_FILE),
    html: path.relative(ROOT, HTML_FILE),
    png_pages: fs.readdirSync(REPORT_DIR).filter(file => /^page-\d+\.png$/.test(file)).sort().map(file => path.relative(ROOT, path.join(REPORT_DIR, file))),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
