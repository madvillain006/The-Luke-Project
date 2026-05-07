'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getCandles } = require('../lib/market-data/candle-feed');

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-window');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons');

const CANDIDATES = [
  { id: 'best_total', label: 'Best total', acceptance_bars: 2, dump_window_bars: 5, min_flush_depth_points: 0.25, min_tap_groups: 3 },
  { id: 'swing_candidate', label: 'Swing candidate', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 3 },
  { id: 'swing_looser_taps', label: 'Swing looser taps', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 2 },
];

const HORIZONS = [
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '2h', label: '2 hours', minutes: 120 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '1d', label: '1 day', minutes: 1440 },
  { id: '1_5d', label: '1.5 days', minutes: 2160 },
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

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

function candidateKey(row) {
  return `${row.acceptance_bars}|${row.dump_window_bars}|${row.min_flush_depth_points}|${row.min_tap_groups}`;
}

function ruleKey(rule) {
  return `${rule.acceptance_bars}|${rule.dump_window_bars}|${rule.min_flush_depth_points}|${rule.min_tap_groups}`;
}

function lowerBoundBar(bars, timestampMs) {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (bars[mid].timeMs < timestampMs) lo = mid + 1;
    else hi = mid;
  }
  return lo < bars.length ? lo : -1;
}

function analyzeTrade(bars, trade, horizon) {
  const entryMs = Date.parse(trade.entry_timestamp);
  const startIndex = lowerBoundBar(bars, entryMs);
  if (startIndex < 0) return null;
  const endIndex = lowerBoundBar(bars, entryMs + horizon.minutes * 60000);
  if (endIndex < 0 || endIndex <= startIndex) return null;
  const entry = Number(trade.entry);
  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (let i = startIndex; i <= endIndex; i += 1) {
    maxHigh = Math.max(maxHigh, bars[i].high);
    minLow = Math.min(minLow, bars[i].low);
  }
  const endClose = bars[endIndex].close;
  return {
    close_move_points: round2(endClose - entry),
    close_move_pct: round2(((endClose - entry) / entry) * 100),
    mfe_points: round2(maxHigh - entry),
    mae_points: round2(entry - minLow),
    end_timestamp: bars[endIndex].timestamp,
  };
}

function summarize(rows) {
  const closeMoves = rows.map(row => row.close_move_points);
  const mfes = rows.map(row => row.mfe_points);
  const maes = rows.map(row => row.mae_points);
  const positiveClose = rows.filter(row => row.close_move_points > 0).length;
  return {
    samples: rows.length,
    avg_close_move_points: round2(closeMoves.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_close_move_points: median(closeMoves),
    avg_mfe_points: round2(mfes.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_mfe_points: median(mfes),
    avg_mae_points: round2(maes.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_mae_points: median(maes),
    positive_close_rate: rows.length ? positiveClose / rows.length : null,
    mfe_6pt_rate: rows.length ? rows.filter(row => row.mfe_points >= 6).length / rows.length : null,
    mfe_10pt_rate: rows.length ? rows.filter(row => row.mfe_points >= 10).length / rows.length : null,
    mfe_20pt_rate: rows.length ? rows.filter(row => row.mfe_points >= 20).length / rows.length : null,
  };
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function barPanel(rows, field, title, formatter) {
  const values = rows.map(row => Number(row[field] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return `<section class="panel" id="${field}"><h1>${title}</h1><div class="meta">Raw ES move after signal. Not futures TP/stop logic.</div>
    ${rows.map(row => {
      const value = Number(row[field] || 0);
      const width = Math.max(4, Math.round(((value - min) / (max - min || 1)) * 760));
      return `<div class="barrow"><div class="label">${row.candidate_label} ${row.horizon_label}</div><div class="barwrap"><div class="bar ${value >= 0 ? 'pos' : 'neg'}" style="width:${width}px"></div></div><div class="value">${formatter(value)}</div></div>`;
    }).join('')}</section>`;
}

function tablePanel(rows) {
  return `<section class="panel" id="options-summary"><h1>Options-Style Forward Movement</h1>
    <div class="meta">Same Mancini acceptance signals, measured over fixed forward horizons. Entry anchor is next 1m open.</div>
    <table><thead><tr><th>Rule</th><th>Horizon</th><th>Samples</th><th>Avg close</th><th>Med close</th><th>Avg MFE</th><th>Avg MAE</th><th>Close +%</th><th>MFE 10pt%</th><th>MFE 20pt%</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td>${row.candidate_label}</td><td>${row.horizon_label}</td><td>${row.samples}</td><td>${row.avg_close_move_points.toFixed(2)}</td><td>${row.median_close_move_points?.toFixed(2) ?? 'n/a'}</td><td>${row.avg_mfe_points.toFixed(2)}</td><td>${row.avg_mae_points.toFixed(2)}</td><td>${pct(row.positive_close_rate)}</td><td>${pct(row.mfe_10pt_rate)}</td><td>${pct(row.mfe_20pt_rate)}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

async function render(rows, metadata) {
  ensureDir(OUT_DIR);
  const swingRows = rows.filter(row => row.candidate_id === 'swing_candidate');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin:0; background:#101418; color:#f4f6f8; font-family:Arial,sans-serif; }
    .panel { width:1320px; min-height:760px; box-sizing:border-box; padding:34px 42px; background:#11161c; }
    h1 { margin:0 0 6px; font-size:30px; }
    .meta { color:#aab4c0; font-size:15px; margin-bottom:24px; }
    table { border-collapse:collapse; width:100%; font-size:15px; }
    th,td { border-bottom:1px solid #28313b; padding:9px 10px; text-align:right; }
    th:first-child,td:first-child { text-align:left; }
    th { color:#b9c4d0; background:#18202a; }
    .barrow { display:grid; grid-template-columns:260px 760px 130px; gap:14px; align-items:center; margin:12px 0; font-size:15px; }
    .barwrap { height:24px; background:#222a33; border-radius:4px; overflow:hidden; }
    .bar { height:24px; border-radius:4px; }
    .pos { background:#32c766; } .neg { background:#e45050; }
    .value { text-align:right; font-weight:700; }
    pre { white-space:pre-wrap; font-size:14px; color:#d5dde6; }
  </style></head><body>
    ${tablePanel(rows)}
    ${barPanel(swingRows, 'avg_close_move_points', 'Swing Candidate: Average Close Move', value => `${value.toFixed(2)}pt`)}
    ${barPanel(swingRows, 'avg_mfe_points', 'Swing Candidate: Average MFE', value => `${value.toFixed(2)}pt`)}
    <section class="panel" id="options-metadata"><h1>Run Metadata</h1><pre>${JSON.stringify(metadata, null, 2)}</pre></section>
  </body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'options-horizons-report.html'), html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
  await page.setContent(html, { waitUntil: 'load' });
  for (const [selector, file] of [
    ['#options-summary', 'options-forward-summary.png'],
    ['#avg_close_move_points', 'options-swing-avg-close-move.png'],
    ['#avg_mfe_points', 'options-swing-avg-mfe.png'],
    ['#options-metadata', 'options-run-metadata.png'],
  ]) {
    await page.locator(selector).screenshot({ path: path.join(OUT_DIR, file) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const base = JSON.parse(fs.readFileSync(path.join(IN_DIR, 'summary.json'), 'utf8'));
  const trades = parseCsv(path.join(IN_DIR, 'trades.csv'));
  const feed = await getCandles('ES', { mode: 'replay', limit: 200000 });
  const bars = [...feed.candles]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(bar => ({ ...bar, timeMs: Date.parse(bar.timestamp) }));

  const horizonRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const analyzed = analyzeTrade(bars, trade, horizon);
        if (!analyzed) continue;
        const eventRow = {
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          entry_timestamp: trade.entry_timestamp,
          entry: trade.entry,
          level: trade.level,
          ...analyzed,
        };
        rows.push(eventRow);
        eventRows.push(eventRow);
      }
      horizonRows.push({
        candidate_id: candidate.id,
        candidate_label: candidate.label,
        horizon_id: horizon.id,
        horizon_label: horizon.label,
        ...summarize(rows),
      });
    }
  }

  const metadata = {
    generated_at: new Date().toISOString(),
    research_only: true,
    purpose: 'longer-dated options style directional hold analysis, not Pine/futures execution',
    source_backtest: path.relative(ROOT, IN_DIR),
    flagship_file: base.metadata.flagship_file,
    flagship_sha256: base.metadata.flagship_sha256,
    no_cheat_rule: base.metadata.no_cheat_rule,
    data: {
      source: feed.source,
      source_label: feed.source_label,
      bars: bars.length,
      first_timestamp: bars[0]?.timestamp,
      last_timestamp: bars[bars.length - 1]?.timestamp,
    },
    horizons: HORIZONS,
    candidates: CANDIDATES,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'options-horizons-summary.json'), JSON.stringify({ metadata, horizonRows }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'options-horizons-summary.csv'), horizonRows);
  writeCsv(path.join(OUT_DIR, 'options-horizons-events.csv'), eventRows);
  await render(horizonRows, metadata);
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR),
    swing_candidate: horizonRows.filter(row => row.candidate_id === 'swing_candidate'),
    pngs: [
      'options-forward-summary.png',
      'options-swing-avg-close-move.png',
      'options-swing-avg-mfe.png',
      'options-run-metadata.png',
    ].map(file => path.join(path.relative(ROOT, OUT_DIR), file)),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
