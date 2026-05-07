'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { getCandles } = require('../lib/market-data/candle-feed');
const { extractManciniLevelsFromLog, discoverManciniCurrentLog } = require('../lib/tradingview/level-export');
const pine = require('../lib/backtest-data/saty-pine-watch');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-window');
const FLAGSHIP = path.join(ROOT, 'tradingview', 'LUKE-WATCH-FLAGSHIP-v4-CANCEL-ACTIVE-WATCH.pine');
const ACCEPTANCE_BARS = [2, 3];
const DUMP_WINDOWS = [1, 5, 15, 45];
const MIN_FLUSH_DEPTHS = [0.25, 1.0, 2.0];
const MIN_TAP_GROUPS = [0, 2, 3];

const cfg = {
  ...pine.DEFAULT_CONFIG,
  tickSize: 0.25,
  tp1Points: 2,
  maxStopPoints: 3,
  hardStopPoints: 5,
  minCloseAboveLevelPoints: 0.25,
  levelTapTolerancePoints: 0.5,
  flushLookbackBars: 45,
  liveLevelWindowPoints: 400,
  entrySlippagePoints: 0.25,
  roundTripFeePerContract: 5,
  pnlPointValue: 50,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
    ...rows.map(row => columns.map(col => csvEscape(row[col])).join(',')),
  ].join('\n'), 'utf8');
}

function sessionDate(timestamp) {
  const d = new Date(timestamp);
  const et = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const hour = Number(et.hour);
  const date = `${et.year}-${et.month}-${et.day}`;
  if (hour >= 18) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  return date;
}

function groupBarsBySession(bars) {
  const grouped = new Map();
  for (const bar of bars) {
    const date = sessionDate(bar.timestamp);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(bar);
  }
  return grouped;
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function levelDate(level) {
  return level?.freshness?.date || String(level?.timestamp_et || '').slice(0, 10) || null;
}

function levelsKnownBeforeDate(levels, date) {
  return [...new Set(levels
    .filter(level => level.instrument === 'ES' && level.active !== false)
    .filter(level => {
      const knownDate = levelDate(level);
      return knownDate && knownDate < date;
    })
    .map(level => Number(level.price))
    .filter(Number.isFinite)
    .map(price => Math.round(price / cfg.tickSize) * cfg.tickSize))]
    .sort((a, b) => a - b);
}

function touched(bar, level) {
  return Boolean(bar && bar.low <= level + cfg.levelTapTolerancePoints && bar.high >= level - cfg.tickSize);
}

function priorTouchGroups(bars, index, level) {
  let groups = 0;
  let wasTouching = false;
  for (let i = 0; i < index; i += 1) {
    const isTouching = touched(bars[i], level);
    if (isTouching && !wasTouching) groups += 1;
    wasTouching = isTouching;
  }
  return groups;
}

function dumpContext(bars, index, level, dumpWindowBars, minFlushDepth) {
  const start = Math.max(1, index - dumpWindowBars);
  let sawAbove = false;
  let highSinceAbove = -Infinity;
  let best = null;
  for (let i = start; i <= index; i += 1) {
    const bar = bars[i];
    if (!bar) continue;
    if (bar.high >= level + cfg.tickSize) {
      sawAbove = true;
      highSinceAbove = Math.max(highSinceAbove, bar.high);
    }
    if (sawAbove && bar.low <= level - minFlushDepth) {
      const flushDepth = round2(level - bar.low);
      const windowMove = round2(highSinceAbove - bar.low);
      if (!best || flushDepth > best.flush_depth_points) {
        best = {
          flush_index: i,
          bars_since_flush: index - i,
          flush_depth_points: flushDepth,
          dump_move_points: windowMove,
        };
      }
    }
  }
  return best;
}

function heldAbove(bars, index, level, acceptanceBars) {
  for (let i = 0; i < acceptanceBars; i += 1) {
    const bar = bars[index - i];
    if (!bar || bar.close < level + cfg.minCloseAboveLevelPoints) return false;
  }
  return true;
}

function evaluateTrade(bars, entryIndex, plan) {
  const fill = round2(plan.entry + cfg.entrySlippagePoints);
  const max30Index = Math.min(bars.length - 1, entryIndex + 30);
  const max60Index = Math.min(bars.length - 1, entryIndex + 60);
  let maxHigh30 = -Infinity;
  let maxHigh60 = -Infinity;
  for (let i = entryIndex; i <= max60Index; i += 1) {
    if (i <= max30Index) maxHigh30 = Math.max(maxHigh30, bars[i].high);
    maxHigh60 = Math.max(maxHigh60, bars[i].high);
  }
  for (let i = entryIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    const hitStop = bar.low <= plan.stop;
    const hitTp1 = bar.high >= plan.tp1;
    const hitTp2 = bar.high >= plan.tp2;
    let outcome = null;
    let points = null;
    if (hitStop && hitTp1) {
      outcome = 'mixed_stop_first';
      points = plan.stop - fill;
    } else if (hitStop) {
      outcome = 'stop_first';
      points = plan.stop - fill;
    } else if (hitTp2) {
      outcome = 'tp2_first';
      points = plan.tp2 - fill;
    } else if (hitTp1) {
      outcome = 'tp1_first';
      points = plan.tp1 - fill;
    }
    if (outcome) {
      const roundedPoints = round2(points);
      const gross = round2(roundedPoints * cfg.pnlPointValue);
      const fees = cfg.roundTripFeePerContract;
      return {
        outcome,
        outcomeIndex: i,
        outcomeTimestamp: bar.timestamp,
        points: roundedPoints,
        dollars: round2(gross - fees),
        mfe30: round2(maxHigh30 - plan.entry),
        mfe60: round2(maxHigh60 - plan.entry),
      };
    }
  }
  return {
    outcome: 'open_or_unresolved',
    outcomeIndex: bars.length - 1,
    outcomeTimestamp: null,
    points: 0,
    dollars: 0,
    mfe30: round2(maxHigh30 - plan.entry),
    mfe60: round2(maxHigh60 - plan.entry),
  };
}

function runVariant({ sessionBars, levels, date, acceptanceBars, dumpWindowBars, minFlushDepth, minTapGroups }) {
  const trades = [];
  let lastClosedIndex = null;
  let lastFailedLevel = null;
  let lastFailedIndex = null;

  for (let i = 1; i < sessionBars.length - 1; i += 1) {
    let chosen = null;
    const close = sessionBars[i].close;
    for (const level of levels) {
      if (Math.abs(level - close) > cfg.liveLevelWindowPoints) continue;
      const dump = dumpContext(sessionBars, i, level, dumpWindowBars, minFlushDepth);
      if (!dump) continue;
      if (!heldAbove(sessionBars, i, level, acceptanceBars)) continue;
      const priorTaps = priorTouchGroups(sessionBars, i, level);
      if (priorTaps < minTapGroups) continue;
      const failedRecent = Number.isFinite(lastFailedLevel)
        && Number.isInteger(lastFailedIndex)
        && Math.abs(level - lastFailedLevel) <= cfg.failedReentryLevelTolerancePoints
        && i - lastFailedIndex <= cfg.failedReentryCooldownBars;
      const failedReset = sessionBars[i].low <= level - cfg.failedReentryResetPoints
        && sessionBars[i].close >= level + cfg.minCloseAboveLevelPoints;
      if (failedRecent && !failedReset) continue;
      if (chosen === null || level > chosen.level) {
        chosen = { level, dump, priorTaps };
      }
    }
    if (!chosen) continue;
    if (Number.isInteger(lastClosedIndex) && i <= lastClosedIndex + cfg.reentryCooldownBars) continue;

    const entryIndex = i + 1;
    const entry = round2(sessionBars[entryIndex].open);
    const stop = round2(chosen.level - cfg.maxStopPoints);
    if (entry - stop > cfg.hardStopPoints) continue;
    const plan = {
      entry,
      stop,
      tp1: round2(entry + cfg.tp1Points),
      tp2: round2(entry + cfg.tp1Points * 2),
    };
    const outcome = evaluateTrade(sessionBars, entryIndex, plan);
    trades.push({
      date,
      acceptance_bars: acceptanceBars,
      dump_window_bars: dumpWindowBars,
      min_flush_depth_points: minFlushDepth,
      min_tap_groups: minTapGroups,
      signal_timestamp: sessionBars[i].timestamp,
      entry_timestamp: sessionBars[entryIndex].timestamp,
      outcome_timestamp: outcome.outcomeTimestamp,
      level: chosen.level,
      entry,
      stop,
      tp1: plan.tp1,
      tp2: plan.tp2,
      prior_tap_groups: chosen.priorTaps,
      bars_since_flush: chosen.dump.bars_since_flush,
      flush_depth_points: chosen.dump.flush_depth_points,
      dump_move_points: chosen.dump.dump_move_points,
      outcome: outcome.outcome,
      points: outcome.points,
      dollars: outcome.dollars,
      mfe_30_points: outcome.mfe30,
      mfe_60_points: outcome.mfe60,
    });
    lastClosedIndex = outcome.outcomeIndex;
    if (outcome.outcome === 'stop_first' || outcome.outcome === 'mixed_stop_first') {
      lastFailedIndex = outcome.outcomeIndex;
      lastFailedLevel = chosen.level;
    }
    i = Math.max(i, outcome.outcomeIndex);
  }
  return trades;
}

function summarize(rows) {
  const trades = rows.length;
  const stops = rows.filter(row => row.outcome === 'stop_first' || row.outcome === 'mixed_stop_first').length;
  const wins = rows.filter(row => row.outcome === 'tp1_first' || row.outcome === 'tp2_first').length;
  const tp2 = rows.filter(row => row.outcome === 'tp2_first').length;
  const totalDollars = round2(rows.reduce((sum, row) => sum + row.dollars, 0));
  const totalPoints = round2(rows.reduce((sum, row) => sum + row.points, 0));
  const mfe30 = rows.map(row => row.mfe_30_points).filter(Number.isFinite).sort((a, b) => a - b);
  const median = values => values.length ? values[Math.floor(values.length / 2)] : null;
  return {
    trades,
    tp1_first_rate: trades ? wins / trades : null,
    stop_first_rate: trades ? stops / trades : null,
    tp2_first_rate: trades ? tp2 / trades : null,
    total_points: totalPoints,
    total_dollars: totalDollars,
    average_dollars: trades ? round2(totalDollars / trades) : null,
    median_mfe_30: median(mfe30),
    explosive_6pt_30_rate: trades ? rows.filter(row => row.mfe_30_points >= 6).length / trades : null,
    explosive_10pt_30_rate: trades ? rows.filter(row => row.mfe_30_points >= 10).length / trades : null,
  };
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function tableHtml(rows) {
  return `<section class="panel" id="summary-table">
    <h1>Mancini Flush Acceptance Summary</h1>
    <div class="meta">Known-before-session Mancini levels only. Entry is next 1m open after hold confirmation. No planned-entry backfill.</div>
    <table><thead><tr><th>Hold</th><th>Dump</th><th>Depth</th><th>Min taps</th><th>Trades</th><th>TP1%</th><th>Stop%</th><th>Net $</th><th>Avg $</th><th>Med MFE30</th><th>6pt MFE%</th><th>10pt MFE%</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td>${row.acceptance_bars}m</td><td>${row.dump_window_bars}m</td><td>${row.min_flush_depth_points}</td><td>${row.min_tap_groups}</td><td>${row.trades}</td><td>${pct(row.tp1_first_rate)}</td><td>${pct(row.stop_first_rate)}</td><td>${row.total_dollars.toFixed(0)}</td><td>${row.average_dollars?.toFixed(1) ?? 'n/a'}</td><td>${row.median_mfe_30?.toFixed(2) ?? 'n/a'}</td><td>${pct(row.explosive_6pt_30_rate)}</td><td>${pct(row.explosive_10pt_30_rate)}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

function barHtml(rows, field, title, formatter) {
  const values = rows.map(row => Number(row[field] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return `<section class="panel" id="${field}"><h1>${title}</h1><div class="meta">Mancini level flush -> hold above -> next-open entry</div>
    ${rows.map(row => {
      const value = Number(row[field] || 0);
      const width = Math.max(4, Math.round(((value - min) / (max - min || 1)) * 760));
      return `<div class="barrow"><div class="label">hold ${row.acceptance_bars}m / dump ${row.dump_window_bars}m / depth ${row.min_flush_depth_points} / taps ${row.min_tap_groups}</div><div class="barwrap"><div class="bar ${value >= 0 ? 'pos' : 'neg'}" style="width:${width}px"></div></div><div class="value">${formatter(value)}</div></div>`;
    }).join('')}</section>`;
}

async function renderPngs(rows, metadata) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin:0; background:#101418; color:#f4f6f8; font-family:Arial,sans-serif; }
    .panel { width:1240px; min-height:760px; box-sizing:border-box; padding:34px 42px; background:#11161c; }
    h1 { margin:0 0 6px; font-size:30px; }
    .meta { color:#aab4c0; font-size:15px; margin-bottom:24px; }
    .barrow { display:grid; grid-template-columns:330px 720px 130px; gap:14px; align-items:center; margin:8px 0; font-size:13px; }
    .barwrap { height:24px; background:#222a33; border-radius:4px; overflow:hidden; }
    .bar { height:24px; border-radius:4px; }
    .pos { background:#32c766; } .neg { background:#e45050; }
    .value { text-align:right; font-weight:700; }
    table { border-collapse:collapse; width:100%; font-size:16px; }
    th,td { border-bottom:1px solid #28313b; padding:9px 10px; text-align:right; }
    th:first-child,td:first-child { text-align:left; }
    th { color:#b9c4d0; background:#18202a; }
    pre { white-space:pre-wrap; font-size:14px; color:#d5dde6; }
  </style></head><body>
    ${barHtml(rows, 'total_dollars', 'Net Dollars By Hold Acceptance', value => `$${value.toFixed(0)}`)}
    ${barHtml(rows, 'explosive_6pt_30_rate', 'Explosive Rate: 6pt MFE Within 30m', value => pct(value))}
    ${tableHtml(rows)}
    <section class="panel" id="metadata"><h1>Run Metadata</h1><pre>${JSON.stringify(metadata, null, 2)}</pre></section>
  </body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'report.html'), html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 860 } });
  await page.setContent(html, { waitUntil: 'load' });
  for (const [selector, name] of [
    ['#total_dollars', 'mancini-net-dollars-by-hold.png'],
    ['#explosive_6pt_30_rate', 'mancini-explosive-rate-by-hold.png'],
    ['#summary-table', 'mancini-acceptance-summary-table.png'],
    ['#metadata', 'mancini-run-metadata.png'],
  ]) {
    await page.locator(selector).screenshot({ path: path.join(OUT_DIR, name) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const feed = await getCandles('ES', { mode: 'replay', limit: 200000 });
  const bars = [...feed.candles].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const grouped = groupBarsBySession(bars);
  const dates = [...grouped.keys()].sort();
  const log = discoverManciniCurrentLog({ rootDir: ROOT });
  const latestDate = log?.latest_date || '2026-05-06';
  const mancini = extractManciniLevelsFromLog({
    filePath: log.path,
    latestDate,
    now: new Date(`${latestDate}T12:00:00-04:00`),
    lookbackDays: 9999,
  });
  const flagshipText = fs.readFileSync(FLAGSHIP, 'utf8');
  const flagshipHash = crypto.createHash('sha256').update(flagshipText).digest('hex');
  const allTrades = [];
  const sessionLevelCounts = [];

  for (const date of dates) {
    const sessionBars = grouped.get(date) || [];
    const levels = levelsKnownBeforeDate(mancini.levels, date);
    if (sessionBars.length === 0 || levels.length === 0) continue;
    sessionLevelCounts.push({ date, bars: sessionBars.length, levels: levels.length });
    for (const acceptanceBars of ACCEPTANCE_BARS) {
      for (const dumpWindowBars of DUMP_WINDOWS) {
        for (const minFlushDepth of MIN_FLUSH_DEPTHS) {
          for (const minTapGroups of MIN_TAP_GROUPS) {
            allTrades.push(...runVariant({
              sessionBars,
              levels,
              date,
              acceptanceBars,
              dumpWindowBars,
              minFlushDepth,
              minTapGroups,
            }));
          }
        }
      }
    }
  }

  const groupedRows = new Map();
  for (const row of allTrades) {
    const key = `${row.acceptance_bars}|${row.dump_window_bars}|${row.min_flush_depth_points}|${row.min_tap_groups}`;
    if (!groupedRows.has(key)) groupedRows.set(key, []);
    groupedRows.get(key).push(row);
  }
  const summaryRows = [...groupedRows.entries()].map(([key, rows]) => {
    const [acceptanceBars, dumpWindowBars, minFlushDepth, minTapGroups] = key.split('|').map(Number);
    return {
      acceptance_bars: acceptanceBars,
      dump_window_bars: dumpWindowBars,
      min_flush_depth_points: minFlushDepth,
      min_tap_groups: minTapGroups,
      ...summarize(rows),
    };
  }).sort((a, b) => a.min_tap_groups - b.min_tap_groups
    || a.acceptance_bars - b.acceptance_bars
    || a.dump_window_bars - b.dump_window_bars
    || a.min_flush_depth_points - b.min_flush_depth_points);

  const metadata = {
    generated_at: new Date().toISOString(),
    research_only: true,
    no_pine_rewrite: true,
    hypothesis: 'Mancini level flush followed by 1m closes holding above for 2.5-3.5 minutes',
    no_cheat_rule: 'Mancini level must be known before session date; entry is next 1m open after hold confirmation',
    flagship_file: path.relative(ROOT, FLAGSHIP),
    flagship_sha256: flagshipHash,
    data: {
      source: feed.source,
      source_label: feed.source_label,
      bars: bars.length,
      first_timestamp: bars[0]?.timestamp,
      last_timestamp: bars[bars.length - 1]?.timestamp,
      sessions_with_prior_mancini_levels: sessionLevelCounts.length,
      session_level_counts: sessionLevelCounts,
      raw: feed.raw,
    },
    mancini: {
      log: path.relative(ROOT, log.path),
      latest_date: latestDate,
      parsed_levels: mancini.levels.length,
      parse_errors: mancini.parse_errors,
    },
    config: {
      ...cfg,
      acceptanceBarsTested: ACCEPTANCE_BARS,
      dumpWindowsTested: DUMP_WINDOWS,
      minFlushDepthsTested: MIN_FLUSH_DEPTHS,
      minTapGroupsTested: MIN_TAP_GROUPS,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ metadata, summaryRows }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'summary.csv'), summaryRows);
  writeCsv(path.join(OUT_DIR, 'trades.csv'), allTrades);
  await renderPngs(summaryRows, metadata);
  const best = [...summaryRows].sort((a, b) => b.total_dollars - a.total_dollars)[0] || null;
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR),
    flagship_sha256: flagshipHash.slice(0, 16),
    bars: bars.length,
    sessions_with_prior_mancini_levels: sessionLevelCounts.length,
    best,
    pngs: [
      'mancini-net-dollars-by-hold.png',
      'mancini-explosive-rate-by-hold.png',
      'mancini-acceptance-summary-table.png',
      'mancini-run-metadata.png',
    ].map(name => path.join(path.relative(ROOT, OUT_DIR), name)),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
