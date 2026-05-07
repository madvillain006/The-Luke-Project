'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-window');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-promotion');

const CANDIDATES = [
  { id: 'best_total', label: 'Best total net', acceptance_bars: 2, dump_window_bars: 5, min_flush_depth_points: 0.25, min_tap_groups: 3 },
  { id: 'swing_candidate', label: 'Swing candidate', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 3 },
  { id: 'swing_looser_taps', label: 'Swing looser taps', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 2 },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      const value = cols[index];
      const num = Number(value);
      row[header] = value !== '' && Number.isFinite(num) ? num : value;
    });
    return row;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  fs.writeFileSync(file, [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column])).join(',')),
  ].join('\n'), 'utf8');
}

function key(row) {
  return `${row.acceptance_bars}|${row.dump_window_bars}|${row.min_flush_depth_points}|${row.min_tap_groups}`;
}

function candidateKey(candidate) {
  return `${candidate.acceptance_bars}|${candidate.dump_window_bars}|${candidate.min_flush_depth_points}|${candidate.min_tap_groups}`;
}

function dateMonth(date) {
  return String(date).slice(0, 7);
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function summarizeTrades(rows) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const byDate = new Map();
  const byMonth = new Map();
  for (const row of rows) {
    const dollars = Number(row.dollars || 0);
    equity += dollars;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    const date = row.date;
    const month = dateMonth(date);
    byDate.set(date, round2((byDate.get(date) || 0) + dollars));
    byMonth.set(month, round2((byMonth.get(month) || 0) + dollars));
  }
  const wins = rows.filter(row => row.outcome === 'tp1_first' || row.outcome === 'tp2_first').length;
  const stops = rows.filter(row => row.outcome === 'stop_first' || row.outcome === 'mixed_stop_first').length;
  const sortedMfe30 = rows.map(row => Number(row.mfe_30_points)).filter(Number.isFinite).sort((a, b) => a - b);
  const median = values => values.length ? values[Math.floor(values.length / 2)] : null;
  const dailyRows = [...byDate.entries()].map(([date, dollars]) => ({ date, dollars })).sort((a, b) => a.date.localeCompare(b.date));
  const monthRows = [...byMonth.entries()].map(([month, dollars]) => ({ month, dollars })).sort((a, b) => a.month.localeCompare(b.month));
  return {
    trades: rows.length,
    wins,
    stops,
    winRate: rows.length ? wins / rows.length : null,
    stopRate: rows.length ? stops / rows.length : null,
    dollars: round2(equity),
    averageDollars: rows.length ? round2(equity / rows.length) : null,
    maxDrawdown: round2(maxDrawdown),
    profitFactor: round2(
      rows.filter(row => Number(row.dollars) > 0).reduce((sum, row) => sum + Number(row.dollars), 0)
      / Math.abs(rows.filter(row => Number(row.dollars) < 0).reduce((sum, row) => sum + Number(row.dollars), 0) || 1),
    ),
    medianMfe30: median(sortedMfe30),
    explosive6Rate: rows.length ? rows.filter(row => Number(row.mfe_30_points) >= 6).length / rows.length : null,
    explosive10Rate: rows.length ? rows.filter(row => Number(row.mfe_30_points) >= 10).length / rows.length : null,
    days: dailyRows.length,
    positiveDays: dailyRows.filter(row => row.dollars > 0).length,
    negativeDays: dailyRows.filter(row => row.dollars < 0).length,
    dailyRows,
    monthRows,
    worstDays: [...dailyRows].sort((a, b) => a.dollars - b.dollars).slice(0, 8),
    bestDays: [...dailyRows].sort((a, b) => b.dollars - a.dollars).slice(0, 8),
  };
}

function barRows(rows, labelKey, valueKey, maxWidth = 760) {
  const values = rows.map(row => Number(row[valueKey] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return rows.map(row => {
    const value = Number(row[valueKey] || 0);
    const width = Math.max(4, Math.round(((value - min) / (max - min || 1)) * maxWidth));
    return { label: row[labelKey], value, width };
  });
}

function panelSummary(candidates) {
  return `<section class="panel" id="candidate-summary">
    <h1>Promotion Sanity: Candidate Rules</h1>
    <div class="meta">All entries are next 1m open after confirmed Mancini hold acceptance. No planned-entry backfill.</div>
    <table>
      <thead><tr><th>Rule</th><th>Trades</th><th>Win%</th><th>Stop%</th><th>Net $</th><th>Avg $</th><th>PF</th><th>Max DD</th><th>Med MFE30</th><th>6pt MFE%</th><th>10pt MFE%</th><th>Days + / -</th></tr></thead>
      <tbody>${candidates.map(item => `<tr>
        <td>${item.label}</td><td>${item.summary.trades}</td><td>${pct(item.summary.winRate)}</td><td>${pct(item.summary.stopRate)}</td>
        <td>${item.summary.dollars.toFixed(0)}</td><td>${item.summary.averageDollars.toFixed(1)}</td><td>${item.summary.profitFactor.toFixed(2)}</td>
        <td>${item.summary.maxDrawdown.toFixed(0)}</td><td>${item.summary.medianMfe30?.toFixed(2) ?? 'n/a'}</td>
        <td>${pct(item.summary.explosive6Rate)}</td><td>${pct(item.summary.explosive10Rate)}</td>
        <td>${item.summary.positiveDays} / ${item.summary.negativeDays}</td>
      </tr>`).join('')}</tbody>
    </table>
  </section>`;
}

function panelMonthly(candidate) {
  const rows = barRows(candidate.summary.monthRows, 'month', 'dollars');
  return `<section class="panel" id="monthly-${candidate.id}">
    <h1>${candidate.label}: Monthly Net</h1>
    <div class="meta">Reject if all profit is one month or one day.</div>
    ${rows.map(row => `<div class="barrow"><div class="label">${row.label}</div><div class="barwrap"><div class="bar ${row.value >= 0 ? 'pos' : 'neg'}" style="width:${row.width}px"></div></div><div class="value">$${row.value.toFixed(0)}</div></div>`).join('')}
  </section>`;
}

function panelWorst(candidate) {
  return `<section class="panel" id="worst-${candidate.id}">
    <h1>${candidate.label}: Worst / Best Days</h1>
    <div class="meta">Daily concentration check.</div>
    <div class="cols">
      <table><thead><tr><th>Worst date</th><th>$</th></tr></thead><tbody>${candidate.summary.worstDays.map(row => `<tr><td>${row.date}</td><td>${row.dollars.toFixed(0)}</td></tr>`).join('')}</tbody></table>
      <table><thead><tr><th>Best date</th><th>$</th></tr></thead><tbody>${candidate.summary.bestDays.map(row => `<tr><td>${row.date}</td><td>${row.dollars.toFixed(0)}</td></tr>`).join('')}</tbody></table>
    </div>
  </section>`;
}

async function render(candidates, metadata) {
  ensureDir(OUT_DIR);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin:0; background:#101418; color:#f4f6f8; font-family:Arial,sans-serif; }
    .panel { width:1320px; min-height:760px; box-sizing:border-box; padding:34px 42px; background:#11161c; }
    h1 { margin:0 0 6px; font-size:30px; }
    .meta { color:#aab4c0; font-size:15px; margin-bottom:24px; }
    table { border-collapse:collapse; width:100%; font-size:15px; }
    th,td { border-bottom:1px solid #28313b; padding:9px 10px; text-align:right; }
    th:first-child,td:first-child { text-align:left; }
    th { color:#b9c4d0; background:#18202a; }
    .barrow { display:grid; grid-template-columns:130px 760px 130px; gap:14px; align-items:center; margin:12px 0; font-size:16px; }
    .barwrap { height:24px; background:#222a33; border-radius:4px; overflow:hidden; }
    .bar { height:24px; border-radius:4px; }
    .pos { background:#32c766; } .neg { background:#e45050; }
    .value { text-align:right; font-weight:700; }
    .cols { display:grid; grid-template-columns:1fr 1fr; gap:26px; }
    pre { white-space:pre-wrap; font-size:14px; color:#d5dde6; }
  </style></head><body>
    ${panelSummary(candidates)}
    ${panelMonthly(candidates.find(item => item.id === 'swing_candidate'))}
    ${panelWorst(candidates.find(item => item.id === 'swing_candidate'))}
    <section class="panel" id="promotion-metadata"><h1>Run Metadata</h1><pre>${JSON.stringify(metadata, null, 2)}</pre></section>
  </body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'promotion-report.html'), html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
  await page.setContent(html, { waitUntil: 'load' });
  for (const [selector, file] of [
    ['#candidate-summary', 'promotion-candidate-summary.png'],
    ['#monthly-swing_candidate', 'promotion-swing-monthly.png'],
    ['#worst-swing_candidate', 'promotion-swing-best-worst-days.png'],
    ['#promotion-metadata', 'promotion-run-metadata.png'],
  ]) {
    await page.locator(selector).screenshot({ path: path.join(OUT_DIR, file) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const base = JSON.parse(fs.readFileSync(path.join(IN_DIR, 'summary.json'), 'utf8'));
  const trades = parseCsv(path.join(IN_DIR, 'trades.csv'));
  const byKey = new Map();
  for (const row of trades) {
    const k = key(row);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(row);
  }
  const candidates = CANDIDATES.map(candidate => {
    const rows = byKey.get(candidateKey(candidate)) || [];
    return {
      ...candidate,
      rows,
      summary: summarizeTrades(rows),
    };
  });
  const metadata = {
    generated_at: new Date().toISOString(),
    source_backtest: path.relative(ROOT, IN_DIR),
    flagship_file: base.metadata.flagship_file,
    flagship_sha256: base.metadata.flagship_sha256,
    data: base.metadata.data,
    no_cheat_rule: base.metadata.no_cheat_rule,
    candidates: CANDIDATES,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'promotion-summary.json'), JSON.stringify({ metadata, candidates }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'promotion-candidate-summary.csv'), candidates.map(item => ({
    id: item.id,
    label: item.label,
    acceptance_bars: item.acceptance_bars,
    dump_window_bars: item.dump_window_bars,
    min_flush_depth_points: item.min_flush_depth_points,
    min_tap_groups: item.min_tap_groups,
    ...item.summary,
    dailyRows: undefined,
    monthRows: undefined,
    worstDays: undefined,
    bestDays: undefined,
  })));
  await render(candidates, metadata);
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR),
    candidates: candidates.map(item => ({
      id: item.id,
      trades: item.summary.trades,
      net: item.summary.dollars,
      avg: item.summary.averageDollars,
      pf: item.summary.profitFactor,
      maxDrawdown: item.summary.maxDrawdown,
      winRate: item.summary.winRate,
      explosive10Rate: item.summary.explosive10Rate,
      days: `${item.summary.positiveDays}/${item.summary.negativeDays}`,
    })),
    pngs: [
      'promotion-candidate-summary.png',
      'promotion-swing-monthly.png',
      'promotion-swing-best-worst-days.png',
      'promotion-run-metadata.png',
    ].map(file => path.join(path.relative(ROOT, OUT_DIR), file)),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
