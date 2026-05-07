'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');
const PAGES_DIR = path.join(OUT_DIR, 'polished-pages');
const SUMMARY_FILE = path.join(OUT_DIR, 'options-horizons-spx-summary.json');
const SPX_RTH_EVENTS_FILE = path.join(OUT_DIR, 'spx-rth-events.csv');
const SPX_SESSION_EVENTS_FILE = path.join(OUT_DIR, 'spx-session-events.csv');

const HTML_FILE = path.join(OUT_DIR, 'mancini-acceptance-carry-es-spx-polished-report.html');
const PDF_FILE = path.join(OUT_DIR, 'mancini-acceptance-carry-es-spx-polished-report.pdf');

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

function points(value, signed = false) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const num = Number(value);
  const prefix = signed && num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}`;
}

function find(rows, horizonId, candidateId = 'swing_candidate') {
  return rows.find(row => row.candidate_id === candidateId && row.horizon_id === horizonId) || {};
}

function table(headers, rows, className = '') {
  return `<table class="${className}"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function kpi(label, value, sub = '') {
  return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}

function callout(title, text) {
  return `<div class="callout"><h3>${title}</h3><p>${text}</p></div>`;
}

function dayConcentration(events, horizonId, field = 'close_move_points') {
  const rows = events.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === horizonId);
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
    days,
    positiveDays: days.filter(day => day.avg > 0).length,
    negativeDays: days.filter(day => day.avg < 0).length,
    top: days.slice(0, 4),
    bottom: [...days].sort((a, b) => a.sum - b.sum).slice(0, 4),
  };
}

function page(title, eyebrow, body, className = '') {
  return `<section class="page ${className}">
    <div class="page-header"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div>
    ${body}
    <div class="footer">Mancini acceptance carry research - ES/SPX underlying only</div>
  </section>`;
}

function bar(label, value, max, format = value => value.toFixed(1)) {
  const width = Math.max(3, Math.min(100, (Number(value) / max) * 100));
  return `<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><div class="bar-value">${format(Number(value))}</div></div>`;
}

function buildHtml(summary, spxRthEvents, spxSessionEvents) {
  const meta = summary.metadata;
  const es = summary.es_continuous_rows.filter(row => row.candidate_id === 'swing_candidate');
  const spx = summary.spx_rth_rows.filter(row => row.candidate_id === 'swing_candidate');
  const session = summary.spx_session_rows.filter(row => row.candidate_id === 'swing_candidate');
  const paired = summary.paired_es_spx_rows.filter(row => row.candidate_id === 'swing_candidate');
  const pairedSession = summary.paired_es_spx_session_rows.filter(row => row.candidate_id === 'swing_candidate');

  const spx1h = find(summary.spx_rth_rows, '1h');
  const spx2h = find(summary.spx_rth_rows, '2h');
  const spx4h = find(summary.spx_rth_rows, '4h');
  const spxEod = find(summary.spx_session_rows, 'spx_eod');
  const spxNext = find(summary.spx_session_rows, 'spx_next_eod');
  const spxWeek = find(summary.spx_session_rows, 'spx_eow');

  const oneDayConc = dayConcentration(spxRthEvents, '1d');
  const eowConc = dayConcentration(spxSessionEvents, 'spx_eow');
  const eodConc = dayConcentration(spxSessionEvents, 'spx_eod');

  const pages = [];

  pages.push(`<section class="page cover">
    <div class="cover-grid">
      <div>
        <div class="eyebrow">Research packet</div>
        <h1>Mancini Acceptance Carry</h1>
        <p class="subtitle">ES fake-breakdown acceptance signal tested against ES continuous movement and SPX cash-session underlying movement.</p>
        <div class="badge-row"><span>Underlying-only</span><span>No option contract bars</span><span>No planned-entry backfill</span></div>
      </div>
      <div class="cover-card">
        ${kpi('SPX same-day close+', pct(spxEod.positive_close_rate), `${points(spxEod.avg_close_move_points, true)} avg SPX pts`)}
        ${kpi('SPX next-day close+', pct(spxNext.positive_close_rate), `${points(spxNext.avg_close_move_points, true)} avg SPX pts`)}
        ${kpi('SPX week-close+', pct(spxWeek.positive_close_rate), `${points(spxWeek.avg_close_move_points, true)} avg SPX pts`)}
      </div>
    </div>
    <div class="cover-footer">Generated ${meta.generated_at} - flagship ${String(meta.flagship_sha256).slice(0, 12)}</div>
  </section>`);

  pages.push(page('What Was Tested', 'Method', `
    <div class="two-col">
      <div>
        ${callout('Signal definition', 'ES flushes below a prior-known Mancini level, then recovers and holds above it for the acceptance window. Entry is the next 1m open after confirmation.')}
        ${callout('Swing candidate rule', '3 one-minute acceptance bars, 1-minute dump window, minimum 1.00 ES point flush below level, and 3 prior tap groups.')}
        ${callout('SPX tradeability filter', 'SPX sections exclude overnight ES-only signals. The ES signal must map to an SPX cash-session bar within five minutes.')}
      </div>
      <div>
        <div class="mini-table-title">Data</div>
        ${table(['Feed', 'Bars', 'Range'], [
          ['ES 1m', meta.es_data.bars.toLocaleString(), `${meta.es_data.first_timestamp}<br>${meta.es_data.last_timestamp}`],
          ['SPX 1m', meta.spx_data.bars.toLocaleString(), `${meta.spx_data.first_timestamp}<br>${meta.spx_data.last_timestamp}`],
        ], 'tight')}
        <p class="note">This is not options P/L. It does not model IV, delta, theta, bid/ask spread, contract selection, or execution quality.</p>
      </div>
    </div>
  `));

  pages.push(page('ES And SPX Forward Movement', 'Underlying carry', `
    <div class="grid-2">
      <div>
        <h3>ES continuous reference</h3>
        ${table(['Horizon', 'N', 'Avg close', 'Median', 'Avg MFE', 'Close +'], es.map(row => [
          row.horizon_label, row.samples, points(row.avg_close_move_points, true), points(row.median_close_move_points, true), points(row.avg_mfe_points), pct(row.positive_close_rate),
        ]))}
      </div>
      <div>
        <h3>SPX RTH underlying</h3>
        ${table(['Horizon', 'N', 'Avg close', 'Median', 'Avg MFE', 'Close +'], spx.map(row => [
          row.horizon_label, row.samples, points(row.avg_close_move_points, true), points(row.median_close_move_points, true), points(row.avg_mfe_points), pct(row.positive_close_rate),
        ]))}
      </div>
    </div>
    <p class="note">The 1h/2h SPX close rate is not enough by itself. The signal becomes cleaner as the holding window extends.</p>
  `));

  pages.push(page('Short-Dated Options Proxy', 'MFE matters more than close', `
    <div class="hero-kpis">
      ${kpi('1h MFE >= 10 SPX pts', pct(spx1h.mfe_10pt_rate), `${pct(spx1h.positive_close_rate)} close-positive`)}
      ${kpi('2h MFE >= 10 SPX pts', pct(spx2h.mfe_10pt_rate), `${pct(spx2h.positive_close_rate)} close-positive`)}
      ${kpi('4h MFE >= 20 SPX pts', pct(spx4h.mfe_20pt_rate), `${pct(spx4h.positive_close_rate)} close-positive`)}
    </div>
    <div class="chart-card">
      ${bar('1 RTH hour avg MFE', spx1h.avg_mfe_points, 70, value => `${value.toFixed(2)} pts`)}
      ${bar('2 RTH hours avg MFE', spx2h.avg_mfe_points, 70, value => `${value.toFixed(2)} pts`)}
      ${bar('4 RTH hours avg MFE', spx4h.avg_mfe_points, 70, value => `${value.toFixed(2)} pts`)}
    </div>
    <div class="two-col">
      <p class="note">The short-dated edge, if real, is not passive close-to-close holding. It is buying only when premium/IV/spread makes the required underlying move cheap enough, then selling into the favorable excursion.</p>
      <p class="risk">Risk: average adverse excursion is ${points(spx1h.avg_mae_points)} SPX pts at 1h and ${points(spx2h.avg_mae_points)} at 2h. This needs hard invalidation and cannot be left to decay through chop.</p>
    </div>
  `));

  pages.push(page('SPX Session Horizons', 'Option-decision windows', `
    <div class="hero-kpis">
      ${kpi('Same-day close', `${points(spxEod.avg_close_move_points, true)} pts`, `${pct(spxEod.positive_close_rate)} close-positive`)}
      ${kpi('Next-day close', `${points(spxNext.avg_close_move_points, true)} pts`, `${pct(spxNext.positive_close_rate)} close-positive`)}
      ${kpi('Week close', `${points(spxWeek.avg_close_move_points, true)} pts`, `${pct(spxWeek.positive_close_rate)} close-positive`)}
    </div>
    ${table(['Horizon', 'Samples', 'Avg close', 'Median close', 'Avg MFE', 'Avg MAE', 'Close +', 'MFE 20pt+'], session.map(row => [
      row.horizon_label, row.samples, points(row.avg_close_move_points, true), points(row.median_close_move_points, true), points(row.avg_mfe_points), points(row.avg_mae_points), pct(row.positive_close_rate), pct(row.mfe_20pt_rate),
    ]))}
    <p class="note">Same-day is useful but not automatic. Next-day and week-close are much cleaner in this sample, which argues for using this as a swing-options filter rather than a blind 0DTE hold.</p>
  `));

  pages.push(page('Paired ES/SPX View', 'Same signal, same SPX cash windows', `
    <h3>RTH fixed windows</h3>
    ${table(['Horizon', 'N', 'ES avg close', 'SPX avg close', 'ES +', 'SPX +', 'Both +'], paired.map(row => [
      row.horizon_label, row.samples, points(row.es_avg_close_move_points, true), points(row.spx_avg_close_move_points, true), pct(row.es_positive_close_rate), pct(row.spx_positive_close_rate), pct(row.both_positive_close_rate),
    ]))}
    <h3>Session horizons</h3>
    ${table(['Horizon', 'N', 'ES avg close', 'SPX avg close', 'ES +', 'SPX +', 'Both +'], pairedSession.map(row => [
      row.horizon_label, row.samples, points(row.es_avg_close_move_points, true), points(row.spx_avg_close_move_points, true), pct(row.es_positive_close_rate), pct(row.spx_positive_close_rate), pct(row.both_positive_close_rate),
    ]))}
  `));

  pages.push(page('Concentration Check', 'Do not trust averages blindly', `
    <div class="three-col">
      ${callout('SPX same-day', `${eodConc.days.length} signal days, ${eodConc.positiveDays} positive avg days, ${eodConc.negativeDays} negative avg days.`)}
      ${callout('SPX 1 RTH day', `${oneDayConc.days.length} signal days, ${oneDayConc.positiveDays} positive avg days, ${oneDayConc.negativeDays} negative avg days.`)}
      ${callout('SPX week close', `${eowConc.days.length} signal days, ${eowConc.positiveDays} positive avg days, ${eowConc.negativeDays} negative avg days.`)}
    </div>
    <div class="grid-2">
      <div>
        <h3>Top week-close contributors</h3>
        ${table(['Date', 'Signals', 'Avg close', 'Sum'], eowConc.top.map(day => [day.date, day.count, points(day.avg, true), points(day.sum, true)]), 'tight')}
      </div>
      <div>
        <h3>Worst week-close contributors</h3>
        ${table(['Date', 'Signals', 'Avg close', 'Sum'], eowConc.bottom.map(day => [day.date, day.count, points(day.avg, true), points(day.sum, true)]), 'tight')}
      </div>
    </div>
    <p class="note">The sample is still mostly March/April and includes a strong trend regime. Strong enough for an add-on filter; not enough to auto-size.</p>
  `));

  pages.push(page('Practical Read', 'How to use this without overclaiming', `
    <div class="two-col">
      <div>
        <h3>Useful</h3>
        <ul>
          <li>Flag as a larger-swing context signal after Mancini acceptance.</li>
          <li>For short-dated options, focus on favorable excursion and active exits.</li>
          <li>For longer-dated options, same-day, next-day, and week-close carry are the better decision horizons.</li>
        </ul>
      </div>
      <div>
        <h3>Not proven</h3>
        <ul>
          <li>No actual option contract candles are present in this dataset.</li>
          <li>No IV/theta/spread model is included.</li>
          <li>Sample size is limited and regime-sensitive.</li>
        </ul>
      </div>
    </div>
    <div class="final-callout">Conclusion: this is promising as a Katbot options filter candidate only if later paired with real option contract data or live premium tracking. With current data, it is an SPX underlying carry edge, not an options P/L edge.</div>
  `));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Mancini Acceptance Carry Polished Report</title><style>
    @page { size: Letter landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #dfe5ec; color: #17202a; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 11in; height: 8.5in; margin: 0 auto 22px; padding: 0.48in 0.58in; background: #fbfcfe; page-break-after: always; position: relative; overflow: hidden; }
    .cover { background: linear-gradient(135deg, #101820 0%, #182a35 58%, #233947 100%); color: #f7fbff; }
    .cover-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 38px; align-items: center; height: 6.8in; }
    h1 { font-size: 54px; line-height: 0.98; margin: 12px 0 18px; letter-spacing: 0; }
    h2 { font-size: 30px; margin: 2px 0 18px; letter-spacing: 0; }
    h3 { font-size: 16px; margin: 0 0 10px; }
    p, li { font-size: 14px; line-height: 1.45; }
    .subtitle { font-size: 20px; line-height: 1.35; color: #d7e2ec; max-width: 620px; }
    .eyebrow { color: #0a8f7a; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; font-size: 12px; }
    .cover .eyebrow { color: #7de0c5; }
    .badge-row { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
    .badge-row span { border: 1px solid rgba(255,255,255,0.28); padding: 8px 10px; border-radius: 999px; font-size: 12px; color: #eaf4fb; }
    .cover-card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 18px; padding: 20px; display: grid; gap: 14px; }
    .cover-footer { position: absolute; bottom: 0.36in; left: 0.58in; right: 0.58in; color: #aebdcc; font-size: 12px; }
    .page-header { border-bottom: 2px solid #d9e1e8; margin-bottom: 22px; padding-bottom: 8px; }
    .footer { position: absolute; bottom: 0.22in; left: 0.58in; right: 0.58in; color: #8695a5; font-size: 10px; border-top: 1px solid #e1e7ed; padding-top: 7px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
    .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .hero-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
    .kpi { background: #eef4f8; border: 1px solid #d7e2ea; border-radius: 14px; padding: 15px; }
    .cover .kpi { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
    .kpi-label { color: #647486; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; }
    .cover .kpi-label { color: #b9c8d7; }
    .kpi-value { font-size: 30px; font-weight: 900; margin: 4px 0; color: #0d5f53; }
    .cover .kpi-value { color: #7de0c5; }
    .kpi-sub { font-size: 12px; color: #6f7d8b; }
    .cover .kpi-sub { color: #d8e4ef; }
    .callout { background: #f2f6f9; border-left: 5px solid #0a8f7a; padding: 13px 14px; margin-bottom: 12px; border-radius: 10px; }
    .callout p { margin: 0; }
    .note { color: #415061; background: #f5f8fb; border-radius: 10px; padding: 12px 14px; }
    .risk { color: #7b2c2c; background: #fff0f0; border-radius: 10px; padding: 12px 14px; }
    .final-callout { margin-top: 22px; padding: 18px; border-radius: 14px; background: #eaf7f3; border: 1px solid #b9dfd4; font-size: 18px; line-height: 1.45; font-weight: 800; color: #164a40; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
    th { background: #e9eef4; color: #263443; text-align: right; padding: 8px; border: 1px solid #d3dde6; }
    td { text-align: right; padding: 8px; border: 1px solid #d9e1e8; }
    th:first-child, td:first-child { text-align: left; }
    .tight th, .tight td { padding: 7px; font-size: 11px; }
    .mini-table-title { font-weight: 800; margin-bottom: 8px; }
    .chart-card { background: #f4f8fb; border: 1px solid #dbe5ed; border-radius: 16px; padding: 18px; margin-bottom: 16px; }
    .bar-row { display: grid; grid-template-columns: 180px 1fr 90px; gap: 12px; align-items: center; margin: 12px 0; font-size: 13px; }
    .bar-track { height: 22px; background: #dce5ec; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #0a8f7a, #32c766); border-radius: 999px; }
    .bar-value { font-weight: 800; text-align: right; }
    ul { margin-top: 0; padding-left: 22px; }
    @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
  </style></head><body>${pages.join('\n')}</body></html>`;
}

async function render() {
  ensureDir(PAGES_DIR);
  const browser = await chromium.launch({ headless: true });
  const pageInstance = await browser.newPage({ viewport: { width: 1320, height: 1020 }, deviceScaleFactor: 1 });
  await pageInstance.goto(pathToFileURL(HTML_FILE).href, { waitUntil: 'load' });
  await pageInstance.pdf({
    path: PDF_FILE,
    width: '11in',
    height: '8.5in',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });
  const pages = await pageInstance.locator('.page').all();
  for (let i = 0; i < pages.length; i += 1) {
    await pages[i].screenshot({ path: path.join(PAGES_DIR, `page-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
  const spxRthEvents = parseCsv(SPX_RTH_EVENTS_FILE);
  const spxSessionEvents = parseCsv(SPX_SESSION_EVENTS_FILE);
  const html = buildHtml(summary, spxRthEvents, spxSessionEvents);
  fs.writeFileSync(HTML_FILE, html, 'utf8');
  await render();
  console.log(JSON.stringify({
    ok: true,
    html: path.relative(ROOT, HTML_FILE),
    pdf: path.relative(ROOT, PDF_FILE),
    pages_dir: path.relative(ROOT, PAGES_DIR),
    pages: fs.readdirSync(PAGES_DIR).filter(file => file.endsWith('.png')).sort(),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
