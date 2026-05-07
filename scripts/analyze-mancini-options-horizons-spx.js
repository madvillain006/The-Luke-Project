'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getCandles } = require('../lib/market-data/candle-feed');

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-window');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');

const MAX_SPX_ENTRY_LAG_MINUTES = 5;

const CANDIDATES = [
  { id: 'best_total', label: 'Best total', acceptance_bars: 2, dump_window_bars: 5, min_flush_depth_points: 0.25, min_tap_groups: 3 },
  { id: 'swing_candidate', label: 'Swing candidate', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 3 },
  { id: 'swing_looser_taps', label: 'Swing looser taps', acceptance_bars: 3, dump_window_bars: 1, min_flush_depth_points: 1, min_tap_groups: 2 },
];

const ES_WALL_CLOCK_HORIZONS = [
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '2h', label: '2 hours', minutes: 120 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '1d', label: '1 day', minutes: 1440 },
  { id: '1_5d', label: '1.5 days', minutes: 2160 },
];

const RTH_HORIZONS = [
  { id: '1h', label: '1 RTH hour', bars: 60 },
  { id: '2h', label: '2 RTH hours', bars: 120 },
  { id: '4h', label: '4 RTH hours', bars: 240 },
  { id: '1d', label: '1 RTH day', bars: 390 },
  { id: '1_5d', label: '1.5 RTH days', bars: 585 },
];

const SPX_SESSION_HORIZONS = [
  { id: 'spx_eod', label: 'SPX same-day close' },
  { id: 'spx_next_eod', label: 'SPX next-day close' },
  { id: 'spx_eow', label: 'SPX week close' },
];

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

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
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

function normalizeBars(feed) {
  return [...feed.candles]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(bar => ({ ...bar, timeMs: Date.parse(bar.timestamp) }));
}

function datePart(timestamp) {
  return String(timestamp || '').slice(0, 10);
}

function weekStartKey(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  parsed.setUTCDate(parsed.getUTCDate() + mondayOffset);
  return parsed.toISOString().slice(0, 10);
}

function buildTradingSessionIndex(bars) {
  const lastIndexByDate = new Map();
  const dates = [];
  let previousDate = null;
  for (let i = 0; i < bars.length; i += 1) {
    const date = datePart(bars[i].timestamp);
    if (date !== previousDate) {
      dates.push(date);
      previousDate = date;
    }
    lastIndexByDate.set(date, i);
  }
  const nextDateByDate = new Map();
  const weekEndDateByDate = new Map();
  const datesByWeek = new Map();
  for (let i = 0; i < dates.length; i += 1) {
    nextDateByDate.set(dates[i], dates[i + 1] || null);
    const week = weekStartKey(dates[i]);
    if (!datesByWeek.has(week)) datesByWeek.set(week, []);
    datesByWeek.get(week).push(dates[i]);
  }
  for (const group of datesByWeek.values()) {
    const weekEnd = group[group.length - 1];
    for (const date of group) weekEndDateByDate.set(date, weekEnd);
  }
  return { dates, lastIndexByDate, nextDateByDate, weekEndDateByDate };
}

function stats(rows, prefix = '') {
  const closeMoves = rows.map(row => Number(row[`${prefix}close_move_points`]));
  const mfes = rows.map(row => Number(row[`${prefix}mfe_points`]));
  const maes = rows.map(row => Number(row[`${prefix}mae_points`]));
  const positiveClose = rows.filter(row => Number(row[`${prefix}close_move_points`]) > 0).length;
  return {
    samples: rows.length,
    avg_close_move_points: round2(closeMoves.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_close_move_points: median(closeMoves),
    avg_mfe_points: round2(mfes.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_mfe_points: median(mfes),
    avg_mae_points: round2(maes.reduce((sum, value) => sum + value, 0) / (rows.length || 1)),
    median_mae_points: median(maes),
    positive_close_rate: rows.length ? positiveClose / rows.length : null,
    mfe_6pt_rate: rows.length ? rows.filter(row => Number(row[`${prefix}mfe_points`]) >= 6).length / rows.length : null,
    mfe_10pt_rate: rows.length ? rows.filter(row => Number(row[`${prefix}mfe_points`]) >= 10).length / rows.length : null,
    mfe_20pt_rate: rows.length ? rows.filter(row => Number(row[`${prefix}mfe_points`]) >= 20).length / rows.length : null,
  };
}

function analyzeWallClock(bars, entryTimestamp, entry, horizon) {
  const entryMs = Date.parse(entryTimestamp);
  const startIndex = lowerBoundBar(bars, entryMs);
  if (startIndex < 0) return null;
  const endIndex = lowerBoundBar(bars, entryMs + horizon.minutes * 60000);
  if (endIndex < 0 || endIndex <= startIndex) return null;
  return analyzeRange(bars, startIndex, endIndex, Number(entry));
}

function analyzeRthFromSignal(bars, signalTimestamp, horizon) {
  const signalMs = Date.parse(signalTimestamp);
  const startIndex = lowerBoundBar(bars, signalMs);
  if (startIndex < 0) return null;
  const lagMinutes = (bars[startIndex].timeMs - signalMs) / 60000;
  if (lagMinutes < 0 || lagMinutes > MAX_SPX_ENTRY_LAG_MINUTES) return null;
  const endIndex = startIndex + horizon.bars;
  if (endIndex >= bars.length || endIndex <= startIndex) return null;
  return {
    ...analyzeRange(bars, startIndex, endIndex, bars[startIndex].open),
    entry_lag_minutes: round2(lagMinutes),
  };
}

function analyzeSpxSessionFromSignal(bars, sessionIndex, signalTimestamp, horizon) {
  const signalMs = Date.parse(signalTimestamp);
  const startIndex = lowerBoundBar(bars, signalMs);
  if (startIndex < 0) return null;
  const lagMinutes = (bars[startIndex].timeMs - signalMs) / 60000;
  if (lagMinutes < 0 || lagMinutes > MAX_SPX_ENTRY_LAG_MINUTES) return null;
  const startDate = datePart(bars[startIndex].timestamp);
  let endDate = null;
  if (horizon.id === 'spx_eod') {
    endDate = startDate;
  } else if (horizon.id === 'spx_next_eod') {
    endDate = sessionIndex.nextDateByDate.get(startDate);
  } else if (horizon.id === 'spx_eow') {
    endDate = sessionIndex.weekEndDateByDate.get(startDate);
  }
  if (!endDate) return null;
  const endIndex = sessionIndex.lastIndexByDate.get(endDate);
  if (!Number.isInteger(endIndex) || endIndex <= startIndex) return null;
  return {
    ...analyzeRange(bars, startIndex, endIndex, bars[startIndex].open),
    entry_lag_minutes: round2(lagMinutes),
    spx_start_date: startDate,
    spx_end_date: endDate,
  };
}

function analyzeBetweenTimestamps(bars, startTimestamp, endTimestamp) {
  const startIndex = lowerBoundBar(bars, Date.parse(startTimestamp));
  const endIndex = lowerBoundBar(bars, Date.parse(endTimestamp));
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) return null;
  return analyzeRange(bars, startIndex, endIndex, bars[startIndex].open);
}

function analyzeRange(bars, startIndex, endIndex, entry) {
  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (let i = startIndex; i <= endIndex; i += 1) {
    maxHigh = Math.max(maxHigh, bars[i].high);
    minLow = Math.min(minLow, bars[i].low);
  }
  const endClose = bars[endIndex].close;
  return {
    entry_timestamp: bars[startIndex].timestamp,
    end_timestamp: bars[endIndex].timestamp,
    entry: round2(entry),
    end_close: round2(endClose),
    close_move_points: round2(endClose - entry),
    close_move_pct: round2(((endClose - entry) / entry) * 100),
    mfe_points: round2(maxHigh - entry),
    mae_points: round2(entry - minLow),
  };
}

function buildEsWallClockRows(trades, esBars) {
  const summaryRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of ES_WALL_CLOCK_HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const analyzed = analyzeWallClock(esBars, trade.entry_timestamp, Number(trade.entry), horizon);
        if (!analyzed) continue;
        const event = {
          section: 'ES continuous',
          instrument: 'ES',
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          signal_timestamp: trade.entry_timestamp,
          level: trade.level,
          ...analyzed,
        };
        rows.push(event);
        eventRows.push(event);
      }
      summaryRows.push({ section: 'ES continuous', instrument: 'ES', candidate_id: candidate.id, candidate_label: candidate.label, horizon_id: horizon.id, horizon_label: horizon.label, ...stats(rows) });
    }
  }
  return { summaryRows, eventRows };
}

function buildSpxRthRows(trades, spxBars) {
  const summaryRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of RTH_HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const analyzed = analyzeRthFromSignal(spxBars, trade.entry_timestamp, horizon);
        if (!analyzed) continue;
        const event = {
          section: 'SPX RTH',
          instrument: 'SPX',
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          signal_timestamp: trade.entry_timestamp,
          level: trade.level,
          ...analyzed,
        };
        rows.push(event);
        eventRows.push(event);
      }
      summaryRows.push({ section: 'SPX RTH', instrument: 'SPX', candidate_id: candidate.id, candidate_label: candidate.label, horizon_id: horizon.id, horizon_label: horizon.label, ...stats(rows) });
    }
  }
  return { summaryRows, eventRows };
}

function buildSpxSessionRows(trades, spxBars, sessionIndex) {
  const summaryRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of SPX_SESSION_HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const analyzed = analyzeSpxSessionFromSignal(spxBars, sessionIndex, trade.entry_timestamp, horizon);
        if (!analyzed) continue;
        const event = {
          section: 'SPX session',
          instrument: 'SPX',
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          signal_timestamp: trade.entry_timestamp,
          level: trade.level,
          ...analyzed,
        };
        rows.push(event);
        eventRows.push(event);
      }
      summaryRows.push({ section: 'SPX session', instrument: 'SPX', candidate_id: candidate.id, candidate_label: candidate.label, horizon_id: horizon.id, horizon_label: horizon.label, ...stats(rows) });
    }
  }
  return { summaryRows, eventRows };
}

function buildPairedRows(trades, esBars, spxBars) {
  const summaryRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of RTH_HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const spx = analyzeRthFromSignal(spxBars, trade.entry_timestamp, horizon);
        if (!spx) continue;
        const es = analyzeBetweenTimestamps(esBars, spx.entry_timestamp, spx.end_timestamp);
        if (!es) continue;
        const event = {
          section: 'Paired ES/SPX RTH',
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          signal_timestamp: trade.entry_timestamp,
          level: trade.level,
          spx_entry_timestamp: spx.entry_timestamp,
          spx_end_timestamp: spx.end_timestamp,
          spx_entry_lag_minutes: spx.entry_lag_minutes,
          spx_entry: spx.entry,
          spx_close_move_points: spx.close_move_points,
          spx_close_move_pct: spx.close_move_pct,
          spx_mfe_points: spx.mfe_points,
          spx_mae_points: spx.mae_points,
          es_entry: es.entry,
          es_close_move_points: es.close_move_points,
          es_close_move_pct: es.close_move_pct,
          es_mfe_points: es.mfe_points,
          es_mae_points: es.mae_points,
          both_close_positive: spx.close_move_points > 0 && es.close_move_points > 0,
          spx_minus_es_close_points: round2(spx.close_move_points - es.close_move_points),
        };
        rows.push(event);
        eventRows.push(event);
      }
      const spxStats = stats(rows, 'spx_');
      const esStats = stats(rows, 'es_');
      summaryRows.push({
        section: 'Paired ES/SPX RTH',
        candidate_id: candidate.id,
        candidate_label: candidate.label,
        horizon_id: horizon.id,
        horizon_label: horizon.label,
        samples: rows.length,
        es_avg_close_move_points: esStats.avg_close_move_points,
        spx_avg_close_move_points: spxStats.avg_close_move_points,
        es_median_close_move_points: esStats.median_close_move_points,
        spx_median_close_move_points: spxStats.median_close_move_points,
        es_avg_mfe_points: esStats.avg_mfe_points,
        spx_avg_mfe_points: spxStats.avg_mfe_points,
        es_positive_close_rate: esStats.positive_close_rate,
        spx_positive_close_rate: spxStats.positive_close_rate,
        both_positive_close_rate: rows.length ? rows.filter(row => row.both_close_positive).length / rows.length : null,
        avg_spx_minus_es_close_points: round2(rows.reduce((sum, row) => sum + row.spx_minus_es_close_points, 0) / (rows.length || 1)),
      });
    }
  }
  return { summaryRows, eventRows };
}

function buildPairedSessionRows(trades, esBars, spxBars, sessionIndex) {
  const summaryRows = [];
  const eventRows = [];
  for (const candidate of CANDIDATES) {
    const matching = trades.filter(row => candidateKey(row) === ruleKey(candidate));
    for (const horizon of SPX_SESSION_HORIZONS) {
      const rows = [];
      for (const trade of matching) {
        const spx = analyzeSpxSessionFromSignal(spxBars, sessionIndex, trade.entry_timestamp, horizon);
        if (!spx) continue;
        const es = analyzeBetweenTimestamps(esBars, spx.entry_timestamp, spx.end_timestamp);
        if (!es) continue;
        const event = {
          section: 'Paired ES/SPX session',
          candidate_id: candidate.id,
          candidate_label: candidate.label,
          horizon_id: horizon.id,
          horizon_label: horizon.label,
          date: trade.date,
          signal_timestamp: trade.entry_timestamp,
          level: trade.level,
          spx_entry_timestamp: spx.entry_timestamp,
          spx_end_timestamp: spx.end_timestamp,
          spx_entry_lag_minutes: spx.entry_lag_minutes,
          spx_start_date: spx.spx_start_date,
          spx_end_date: spx.spx_end_date,
          spx_entry: spx.entry,
          spx_close_move_points: spx.close_move_points,
          spx_close_move_pct: spx.close_move_pct,
          spx_mfe_points: spx.mfe_points,
          spx_mae_points: spx.mae_points,
          es_entry: es.entry,
          es_close_move_points: es.close_move_points,
          es_close_move_pct: es.close_move_pct,
          es_mfe_points: es.mfe_points,
          es_mae_points: es.mae_points,
          both_close_positive: spx.close_move_points > 0 && es.close_move_points > 0,
          spx_minus_es_close_points: round2(spx.close_move_points - es.close_move_points),
        };
        rows.push(event);
        eventRows.push(event);
      }
      const spxStats = stats(rows, 'spx_');
      const esStats = stats(rows, 'es_');
      summaryRows.push({
        section: 'Paired ES/SPX session',
        candidate_id: candidate.id,
        candidate_label: candidate.label,
        horizon_id: horizon.id,
        horizon_label: horizon.label,
        samples: rows.length,
        es_avg_close_move_points: esStats.avg_close_move_points,
        spx_avg_close_move_points: spxStats.avg_close_move_points,
        es_median_close_move_points: esStats.median_close_move_points,
        spx_median_close_move_points: spxStats.median_close_move_points,
        es_avg_mfe_points: esStats.avg_mfe_points,
        spx_avg_mfe_points: spxStats.avg_mfe_points,
        es_positive_close_rate: esStats.positive_close_rate,
        spx_positive_close_rate: spxStats.positive_close_rate,
        both_positive_close_rate: rows.length ? rows.filter(row => row.both_close_positive).length / rows.length : null,
        avg_spx_minus_es_close_points: round2(rows.reduce((sum, row) => sum + row.spx_minus_es_close_points, 0) / (rows.length || 1)),
      });
    }
  }
  return { summaryRows, eventRows };
}

function summaryTable(rows, title, note) {
  return `<section class="panel" id="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><h1>${title}</h1><div class="meta">${note}</div>
    <table><thead><tr><th>Rule</th><th>Horizon</th><th>Samples</th><th>Avg close</th><th>Med close</th><th>Avg MFE</th><th>Avg MAE</th><th>Close +%</th><th>MFE 10pt%</th><th>MFE 20pt%</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td>${row.candidate_label}</td><td>${row.horizon_label}</td><td>${row.samples}</td><td>${row.avg_close_move_points.toFixed(2)}</td><td>${row.median_close_move_points?.toFixed(2) ?? 'n/a'}</td><td>${row.avg_mfe_points.toFixed(2)}</td><td>${row.avg_mae_points.toFixed(2)}</td><td>${pct(row.positive_close_rate)}</td><td>${pct(row.mfe_10pt_rate)}</td><td>${pct(row.mfe_20pt_rate)}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

function pairedTable(rows) {
  return `<section class="panel" id="paired-es-spx"><h1>Paired ES + SPX RTH</h1><div class="meta">Same signal, SPX cash-session entry, ES measured over the exact SPX start/end timestamps.</div>
    <table><thead><tr><th>Rule</th><th>Horizon</th><th>Samples</th><th>ES avg close</th><th>SPX avg close</th><th>ES avg MFE</th><th>SPX avg MFE</th><th>ES +%</th><th>SPX +%</th><th>Both +%</th><th>SPX-ES avg</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td>${row.candidate_label}</td><td>${row.horizon_label}</td><td>${row.samples}</td><td>${row.es_avg_close_move_points.toFixed(2)}</td><td>${row.spx_avg_close_move_points.toFixed(2)}</td><td>${row.es_avg_mfe_points.toFixed(2)}</td><td>${row.spx_avg_mfe_points.toFixed(2)}</td><td>${pct(row.es_positive_close_rate)}</td><td>${pct(row.spx_positive_close_rate)}</td><td>${pct(row.both_positive_close_rate)}</td><td>${row.avg_spx_minus_es_close_points.toFixed(2)}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

function swingBars(rows, title, field, selectorId) {
  const values = rows.map(row => Number(row[field] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return `<section class="panel" id="${selectorId}"><h1>${title}</h1><div class="meta">Swing candidate only.</div>
    ${rows.map(row => {
      const value = Number(row[field] || 0);
      const width = Math.max(4, Math.round(((value - min) / (max - min || 1)) * 760));
      return `<div class="barrow"><div class="label">${row.horizon_label}</div><div class="barwrap"><div class="bar ${value >= 0 ? 'pos' : 'neg'}" style="width:${width}px"></div></div><div class="value">${value.toFixed(2)}pt</div></div>`;
    }).join('')}</section>`;
}

async function render(esRows, spxRows, spxSessionRows, pairedRows, pairedSessionRows, metadata) {
  ensureDir(OUT_DIR);
  const swingSpx = spxRows.filter(row => row.candidate_id === 'swing_candidate');
  const swingSpxSession = spxSessionRows.filter(row => row.candidate_id === 'swing_candidate');
  const swingPaired = pairedRows.filter(row => row.candidate_id === 'swing_candidate');
  const swingPairedSession = pairedSessionRows.filter(row => row.candidate_id === 'swing_candidate');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin:0; background:#101418; color:#f4f6f8; font-family:Arial,sans-serif; }
    .panel { width:1480px; min-height:820px; box-sizing:border-box; padding:34px 42px; background:#11161c; }
    h1 { margin:0 0 6px; font-size:30px; }
    .meta { color:#aab4c0; font-size:15px; margin-bottom:24px; }
    table { border-collapse:collapse; width:100%; font-size:14px; }
    th,td { border-bottom:1px solid #28313b; padding:8px 9px; text-align:right; }
    th:first-child,td:first-child { text-align:left; }
    th { color:#b9c4d0; background:#18202a; }
    .barrow { display:grid; grid-template-columns:220px 760px 130px; gap:14px; align-items:center; margin:14px 0; font-size:16px; }
    .barwrap { height:25px; background:#222a33; border-radius:4px; overflow:hidden; }
    .bar { height:25px; border-radius:4px; }
    .pos { background:#32c766; } .neg { background:#e45050; }
    .value { text-align:right; font-weight:700; }
    pre { white-space:pre-wrap; font-size:13px; color:#d5dde6; }
  </style></head><body>
    ${summaryTable(esRows, 'ES Continuous Reference', 'Original futures-style wall-clock forward movement after the no-cheat Mancini acceptance signal.')}
    ${summaryTable(spxRows, 'SPX RTH Options Underlying', `SPX cash-session only. Signal must map to an SPX bar within ${MAX_SPX_ENTRY_LAG_MINUTES} minutes; horizons are RTH trading minutes.`)}
    ${summaryTable(spxSessionRows, 'SPX Session Horizons', 'SPX cash-session only. Same-day close, next trading-day close, and current-week close.')}
    ${pairedTable(pairedRows)}
    ${pairedTable(pairedSessionRows).replace('id="paired-es-spx"', 'id="paired-es-spx-session"').replace('Paired ES + SPX RTH', 'Paired ES + SPX Session Horizons')}
    ${swingBars(swingSpx, 'SPX Swing Candidate: Avg Close Move', 'avg_close_move_points', 'spx-swing-close')}
    ${swingBars(swingSpx, 'SPX Swing Candidate: Avg MFE', 'avg_mfe_points', 'spx-swing-mfe')}
    ${swingBars(swingSpxSession, 'SPX Swing Candidate: Session Avg Close', 'avg_close_move_points', 'spx-swing-session-close')}
    ${swingBars(swingPaired, 'Paired Swing: SPX minus ES Avg Close', 'avg_spx_minus_es_close_points', 'paired-swing-spread')}
    ${swingBars(swingPairedSession, 'Paired Session Swing: SPX minus ES Avg Close', 'avg_spx_minus_es_close_points', 'paired-session-swing-spread')}
    <section class="panel" id="run-metadata"><h1>Run Metadata</h1><pre>${JSON.stringify(metadata, null, 2)}</pre></section>
  </body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'options-horizons-spx-report.html'), html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1480, height: 900 } });
  await page.setContent(html, { waitUntil: 'load' });
  for (const [selector, file] of [
    ['#es-continuous-reference', 'es-continuous-reference.png'],
    ['#spx-rth-options-underlying', 'spx-rth-options-underlying.png'],
    ['#spx-session-horizons', 'spx-session-horizons.png'],
    ['#paired-es-spx', 'paired-es-spx-rth.png'],
    ['#paired-es-spx-session', 'paired-es-spx-session.png'],
    ['#spx-swing-close', 'spx-swing-avg-close.png'],
    ['#spx-swing-mfe', 'spx-swing-avg-mfe.png'],
    ['#spx-swing-session-close', 'spx-swing-session-avg-close.png'],
    ['#paired-swing-spread', 'paired-swing-spx-minus-es.png'],
    ['#paired-session-swing-spread', 'paired-session-swing-spx-minus-es.png'],
    ['#run-metadata', 'spx-run-metadata.png'],
  ]) {
    await page.locator(selector).screenshot({ path: path.join(OUT_DIR, file) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const base = JSON.parse(fs.readFileSync(path.join(IN_DIR, 'summary.json'), 'utf8'));
  const trades = parseCsv(path.join(IN_DIR, 'trades.csv'));
  const [esFeed, spxFeed] = await Promise.all([
    getCandles('ES', { mode: 'replay', limit: 200000 }),
    getCandles('SPX', { mode: 'replay', limit: 200000 }),
  ]);
  const esBars = normalizeBars(esFeed);
  const spxBars = normalizeBars(spxFeed);

  const es = buildEsWallClockRows(trades, esBars);
  const spxSessionIndex = buildTradingSessionIndex(spxBars);
  const spx = buildSpxRthRows(trades, spxBars);
  const spxSession = buildSpxSessionRows(trades, spxBars, spxSessionIndex);
  const paired = buildPairedRows(trades, esBars, spxBars);
  const pairedSession = buildPairedSessionRows(trades, esBars, spxBars, spxSessionIndex);

  const metadata = {
    generated_at: new Date().toISOString(),
    research_only: true,
    purpose: 'SPX longer-dated options style directional carry after ES Mancini acceptance signals',
    signal_source: 'ES Mancini acceptance backtest trades; no SPX-derived level lookahead',
    source_backtest: path.relative(ROOT, IN_DIR),
    flagship_file: base.metadata.flagship_file,
    flagship_sha256: base.metadata.flagship_sha256,
    no_cheat_rule: base.metadata.no_cheat_rule,
    spx_tradeability_rule: `SPX signal must have a cash-session bar within ${MAX_SPX_ENTRY_LAG_MINUTES} minutes; overnight ES-only signals are excluded from SPX/paired sections`,
    es_data: {
      source: esFeed.source,
      source_label: esFeed.source_label,
      bars: esBars.length,
      first_timestamp: esBars[0]?.timestamp,
      last_timestamp: esBars[esBars.length - 1]?.timestamp,
      files: esFeed.raw?.files || [],
    },
    spx_data: {
      source: spxFeed.source,
      source_label: spxFeed.source_label,
      bars: spxBars.length,
      first_timestamp: spxBars[0]?.timestamp,
      last_timestamp: spxBars[spxBars.length - 1]?.timestamp,
      files: spxFeed.raw?.files || [],
    },
    es_wall_clock_horizons: ES_WALL_CLOCK_HORIZONS,
    spx_rth_horizons: RTH_HORIZONS,
    spx_session_horizons: SPX_SESSION_HORIZONS,
    candidates: CANDIDATES,
  };

  const summary = {
    metadata,
    es_continuous_rows: es.summaryRows,
    spx_rth_rows: spx.summaryRows,
    spx_session_rows: spxSession.summaryRows,
    paired_es_spx_rows: paired.summaryRows,
    paired_es_spx_session_rows: pairedSession.summaryRows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'options-horizons-spx-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'es-continuous-summary.csv'), es.summaryRows);
  writeCsv(path.join(OUT_DIR, 'spx-rth-summary.csv'), spx.summaryRows);
  writeCsv(path.join(OUT_DIR, 'spx-session-summary.csv'), spxSession.summaryRows);
  writeCsv(path.join(OUT_DIR, 'paired-es-spx-summary.csv'), paired.summaryRows);
  writeCsv(path.join(OUT_DIR, 'paired-es-spx-session-summary.csv'), pairedSession.summaryRows);
  writeCsv(path.join(OUT_DIR, 'spx-rth-events.csv'), spx.eventRows);
  writeCsv(path.join(OUT_DIR, 'spx-session-events.csv'), spxSession.eventRows);
  writeCsv(path.join(OUT_DIR, 'paired-es-spx-events.csv'), paired.eventRows);
  writeCsv(path.join(OUT_DIR, 'paired-es-spx-session-events.csv'), pairedSession.eventRows);
  await render(es.summaryRows, spx.summaryRows, spxSession.summaryRows, paired.summaryRows, pairedSession.summaryRows, metadata);

  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR),
    swing_spx: spx.summaryRows.filter(row => row.candidate_id === 'swing_candidate'),
    swing_spx_session: spxSession.summaryRows.filter(row => row.candidate_id === 'swing_candidate'),
    swing_paired: paired.summaryRows.filter(row => row.candidate_id === 'swing_candidate'),
    swing_paired_session: pairedSession.summaryRows.filter(row => row.candidate_id === 'swing_candidate'),
    pngs: [
      'es-continuous-reference.png',
      'spx-rth-options-underlying.png',
      'spx-session-horizons.png',
      'paired-es-spx-rth.png',
      'paired-es-spx-session.png',
      'spx-swing-avg-close.png',
      'spx-swing-avg-mfe.png',
      'spx-swing-session-avg-close.png',
      'paired-swing-spx-minus-es.png',
      'paired-session-swing-spx-minus-es.png',
      'spx-run-metadata.png',
    ].map(file => path.join(path.relative(ROOT, OUT_DIR), file)),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
