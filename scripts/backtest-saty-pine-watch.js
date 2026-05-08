'use strict';

const fs = require('fs');
const path = require('path');
const { getCandles } = require('../lib/market-data/candle-feed');
const { buildFuturesSessionBars } = require('../lib/backtest-data/saty-historical');
const {
  compareReferenceFields,
} = require('../lib/backtest-data/saty-pine-watch');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'saty-pine-watch-backtest');
let OUT_DIR = DEFAULT_OUT_DIR;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(name, value) {
  ensureDir(OUT_DIR);
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(value, null, 2), 'utf8');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(name, rows, columns) {
  ensureDir(OUT_DIR);
  const lines = [columns.join(',')];
  for (const row of rows || []) {
    lines.push(columns.map(column => csvEscape(row[column])).join(','));
  }
  fs.writeFileSync(path.join(OUT_DIR, name), `${lines.join('\n')}\n`, 'utf8');
}

function parseArgs(argv) {
  const out = {
    dates: null,
    start: null,
    end: null,
    outDir: null,
    entrySlippagePoints: 0.25,
    roundTripFeePerContract: 5,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dates') out.dates = String(argv[++i] || '').split(',').map(v => v.trim()).filter(Boolean);
    else if (arg === '--start') out.start = argv[++i] || null;
    else if (arg === '--end') out.end = argv[++i] || null;
    else if (arg === '--out-dir') out.outDir = argv[++i] || null;
    else if (arg === '--entry-slippage-points') out.entrySlippagePoints = Number(argv[++i]);
    else if (arg === '--round-trip-fee') out.roundTripFeePerContract = Number(argv[++i]);
  }
  return out;
}

function filterDates(dates, args) {
  return dates.filter(date => {
    if (args.start && date < args.start) return false;
    if (args.end && date > args.end) return false;
    return true;
  });
}

function flattenSessionRows(result) {
  return (result.sessions || []).map(row => ({
    reference_field: result.summary.reference_field,
    date: row.date,
    valid: row.valid,
    error: row.error || '',
    bars: row.bars,
    reference_date: row.reference_date || '',
    prev_close: row.prev_close || '',
    atr_value: row.atr_value || '',
    clusters: row.clusters || '',
    events: row.summary?.events || 0,
    trades: row.summary?.trades || 0,
    total_points: row.summary?.total_points || 0,
    total_gross_dollars: row.summary?.total_gross_dollars || 0,
    total_fees: row.summary?.total_fees || 0,
    total_dollars: row.summary?.total_dollars || 0,
    stop_first: row.summary?.by_outcome?.stop_first || 0,
    tp1_first: row.summary?.by_outcome?.tp1_first || 0,
    tp2_first: row.summary?.by_outcome?.tp2_first || 0,
    blocked: row.summary?.event_counts?.BLOCKED || 0,
    watch: row.summary?.event_counts?.WATCH || 0,
    armed: row.summary?.event_counts?.ARMED || 0,
  }));
}

function writeMarkdown(report) {
  const lines = [
    '# Saty Pine Watch Historical Backtest',
    '',
    'Research-only historical replay. No live data, no broker route, no execution.',
    '',
    '## Formula',
    '',
    '- Current Pine: `previous_close = request.security(..., close[1], ...)`.',
    '- Current Pine ATR: `atr_value = request.security(..., ta.atr(14)[1], ...)`.',
    '- Comparison variant: previous futures-session `open` as the Saty anchor.',
    '- Both variants use the same local ES 1m historical candle source and the same ported Pine watch trigger logic.',
    `- Entry accounting uses adverse long-fill slippage of ${report.close.formula.entry_slippage_points} point(s).`,
    `- Net dollars subtract $${report.close.formula.round_trip_fee_per_contract} per round trip contract.`,
    '',
    '## Summary',
    '',
    '| Reference field | Sessions valid | Trades | Stop-first rate | Total points | Gross $ | Fees $ | Net $ |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| close/current Pine | ${report.close_summary.sessions_valid} | ${report.close_summary.trades} | ${pct(report.close_summary.stop_first_rate)} | ${report.close_summary.total_points} | ${report.close_summary.total_gross_dollars} | ${report.close_summary.total_fees} | ${report.close_summary.total_dollars} |`,
    `| open/comparison | ${report.open_summary.sessions_valid} | ${report.open_summary.trades} | ${pct(report.open_summary.stop_first_rate)} | ${report.open_summary.total_points} | ${report.open_summary.total_gross_dollars} | ${report.open_summary.total_fees} | ${report.open_summary.total_dollars} |`,
    '',
    '## Artifacts',
    '',
    '- `summary.json`',
    '- `close-events.json`',
    '- `open-events.json`',
    '- `close-trades.csv`',
    '- `open-trades.csv`',
    '- `sessions.csv`',
    '',
    '## Safety',
    '',
    '- `read_only: true`',
    '- `no_live_execution: true`',
    '- Replay candles and historical triggers do not arm live candidates.',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), `${lines.join('\n')}\n`, 'utf8');
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.outDir) {
    OUT_DIR = path.isAbsolute(args.outDir) ? args.outDir : path.join(ROOT, args.outDir);
  }
  const config = {
    entrySlippagePoints: args.entrySlippagePoints,
    roundTripFeePerContract: args.roundTripFeePerContract,
  };
  const feed = await getCandles('ES', { mode: 'replay', limit: 200000 });
  const bars = feed.candles || [];
  if (!bars.length) throw new Error('No local ES historical 1m candles found');
  const allDates = buildFuturesSessionBars(bars).map(session => session.date);
  const dates = args.dates || filterDates(allDates, args);
  const report = compareReferenceFields(bars, { dates, config });

  writeJson('summary.json', {
    generated_at: report.generated_at,
    read_only: report.read_only,
    no_live_execution: report.no_live_execution,
    current_pine_reference_field: report.current_pine_reference_field,
    user_hypothesis_reference_field: report.user_hypothesis_reference_field,
    close_summary: report.close_summary,
    open_summary: report.open_summary,
    delta: report.delta,
    source: {
      instrument: 'ES',
      candle_source: feed.source,
      candle_source_label: feed.source_label,
      live: feed.live,
      replay: feed.replay,
      usable_for_live_arming: feed.usable_for_live_arming,
      bars: bars.length,
      first_timestamp: bars[0]?.timestamp || null,
      last_timestamp: bars[bars.length - 1]?.timestamp || null,
      dates_requested: dates.length,
    },
    accounting: {
      entry_slippage_points: config.entrySlippagePoints,
      round_trip_fee_per_contract: config.roundTripFeePerContract,
      dollars_are_net_after_fees: true,
    },
  });
  writeJson('close-events.json', report.close.events);
  writeJson('open-events.json', report.open.events);
  writeJson('close-sessions.json', report.close.sessions);
  writeJson('open-sessions.json', report.open.sessions);
  writeCsv('close-trades.csv', report.close.trades, [
    'date',
    'reference_field',
    'timestamp',
    'level',
    'entry',
    'filled_entry',
    'stop',
    'tp1',
    'tp2',
    'trigger',
    'outcome',
    'outcome_timestamp',
    'points',
    'contracts',
    'gross_dollars',
    'fees',
    'commission_dollars',
    'slippage_dollars',
    'dollars',
    'net_dollars',
    'entry_slippage_points',
    'round_trip_fee_per_contract',
  ]);
  writeCsv('open-trades.csv', report.open.trades, [
    'date',
    'reference_field',
    'timestamp',
    'level',
    'entry',
    'filled_entry',
    'stop',
    'tp1',
    'tp2',
    'trigger',
    'outcome',
    'outcome_timestamp',
    'points',
    'contracts',
    'gross_dollars',
    'fees',
    'commission_dollars',
    'slippage_dollars',
    'dollars',
    'net_dollars',
    'entry_slippage_points',
    'round_trip_fee_per_contract',
  ]);
  writeCsv('sessions.csv', [
    ...flattenSessionRows(report.close),
    ...flattenSessionRows(report.open),
  ], [
    'reference_field',
    'date',
    'valid',
    'error',
    'bars',
    'reference_date',
    'prev_close',
    'atr_value',
    'clusters',
    'events',
    'trades',
    'total_points',
    'total_gross_dollars',
    'total_fees',
    'total_dollars',
    'stop_first',
    'tp1_first',
    'tp2_first',
    'blocked',
    'watch',
    'armed',
  ]);
  writeMarkdown(report);

  console.log(JSON.stringify({
    ok: true,
    artifact_dir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
    source_bars: bars.length,
    date_range: [bars[0]?.timestamp, bars[bars.length - 1]?.timestamp],
    close_summary: report.close_summary,
    open_summary: report.open_summary,
    delta: report.delta,
    accounting: {
      entry_slippage_points: config.entrySlippagePoints,
      round_trip_fee_per_contract: config.roundTripFeePerContract,
      dollars_are_net_after_fees: true,
    },
  }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(`saty pine watch backtest failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
