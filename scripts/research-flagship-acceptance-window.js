'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { getCandles } = require('../lib/market-data/candle-feed');
const { deriveLevelsByDate } = require('../lib/backtest-data/saty-historical');
const pine = require('../lib/backtest-data/saty-pine-watch');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'flagship-acceptance-window');
const FLAGSHIP = path.join(ROOT, 'tradingview', 'LUKE-WATCH-FLAGSHIP-v4-CANCEL-ACTIVE-WATCH.pine');

const ACCEPTANCE_BARS = [1, 2, 3, 4, 5];
const MIN_TAP_GROUPS = [0, 2, 3, 4];
const ENTRY_MODES = ['legacy_plan_entry', 'next_open_market', 'limit_retest_10m', 'limit_retest_30m'];

const cfg = {
  ...pine.DEFAULT_CONFIG,
  contractPlan: 'single_tp1',
  entrySlippagePoints: 0.25,
  roundTripFeePerContract: 5,
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
  const body = [
    columns.join(','),
    ...rows.map(row => columns.map(col => csvEscape(row[col])).join(',')),
  ].join('\n');
  fs.writeFileSync(file, body, 'utf8');
}

function nextAbove(clusters, level) {
  return clusters.find(cluster => cluster.price > level)?.price ?? null;
}

function barAt(bars, index) {
  return index >= 0 && index < bars.length ? bars[index] : null;
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

function buildOutcome(outcome, bar, points, contracts = 1) {
  const roundedPoints = round2(points);
  const gross = round2(roundedPoints * cfg.pnlPointValue);
  const fees = round2(contracts * cfg.roundTripFeePerContract);
  return {
    outcome,
    outcome_timestamp: bar?.timestamp || null,
    points: roundedPoints,
    gross_dollars: gross,
    fees,
    dollars: round2(gross - fees),
  };
}

function evaluateFromEntry(bars, entryIndex, plan) {
  const fill = round2(plan.entry + cfg.entrySlippagePoints);
  const end30 = Math.min(bars.length - 1, entryIndex + 30);
  const end60 = Math.min(bars.length - 1, entryIndex + 60);
  let maxHigh30 = -Infinity;
  let maxHigh60 = -Infinity;
  for (let i = entryIndex; i <= end60; i += 1) {
    if (i <= end30) maxHigh30 = Math.max(maxHigh30, bars[i].high);
    maxHigh60 = Math.max(maxHigh60, bars[i].high);
  }

  for (let i = entryIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    const hitStop = bar.low <= plan.stop;
    const hitTp1 = bar.high >= plan.tp1;
    const hitTp2 = bar.high >= plan.tp2;
    if (hitStop && hitTp1) {
      return {
        ...buildOutcome('mixed_stop_first', bar, plan.stop - fill),
        outcome_index: i,
        mfe_30_points: round2(maxHigh30 - plan.entry),
        mfe_60_points: round2(maxHigh60 - plan.entry),
      };
    }
    if (hitStop) {
      return {
        ...buildOutcome('stop_first', bar, plan.stop - fill),
        outcome_index: i,
        mfe_30_points: round2(maxHigh30 - plan.entry),
        mfe_60_points: round2(maxHigh60 - plan.entry),
      };
    }
    if (hitTp2) {
      return {
        ...buildOutcome('tp2_first', bar, plan.tp2 - fill),
        outcome_index: i,
        mfe_30_points: round2(maxHigh30 - plan.entry),
        mfe_60_points: round2(maxHigh60 - plan.entry),
      };
    }
    if (hitTp1) {
      return {
        ...buildOutcome('tp1_first', bar, plan.tp1 - fill),
        outcome_index: i,
        mfe_30_points: round2(maxHigh30 - plan.entry),
        mfe_60_points: round2(maxHigh60 - plan.entry),
      };
    }
  }

  return {
    outcome: 'open_or_unresolved',
    outcome_timestamp: null,
    points: 0,
    gross_dollars: 0,
    fees: 0,
    dollars: 0,
    outcome_index: bars.length - 1,
    mfe_30_points: round2(maxHigh30 - plan.entry),
    mfe_60_points: round2(maxHigh60 - plan.entry),
  };
}

function variantTradeRows({ bars, satyLevels, acceptanceBars, minTapGroups, entryMode, date }) {
  const rawLevels = pine.buildSatyLevelList(satyLevels);
  const clusters = pine.clusterLevels(rawLevels, cfg);
  const ribbon = pine._internal.buildPivotRibbon(bars, cfg);
  const trades = [];
  let previousPaperSignal = false;
  let lastClosedIndex = null;
  let lastFailedIndex = null;
  let lastFailedLevel = null;

  for (let i = 1; i < bars.length - 1; i += 1) {
    const bar = bars[i];
    let paperPlan = null;
    let paperSignal = false;

    for (const cluster of clusters) {
      const level = cluster.price;
      const prev = bars[i - 1];
      const nextCluster = nextAbove(clusters, level);
      const planEntry = round2(level + Math.max(cfg.minCloseAboveLevelPoints, cfg.tickSize));
      const stop = round2(level - Math.min(cfg.maxStopPoints, cfg.hardStopPoints));
      const targetSpace = Number.isFinite(nextCluster) ? nextCluster - level : cfg.tp1Points * 2.0;
      const entryTargetSpace = Number.isFinite(nextCluster) ? nextCluster - planEntry : cfg.tp1Points * 2.0;
      const targetOk = (
        targetSpace >= cfg.minTargetSpacePoints
        && entryTargetSpace >= cfg.minTargetSpacePoints
      ) || (cfg.allowTp1RoomCandidate && (!Number.isFinite(nextCluster) || nextCluster - planEntry >= cfg.tp1Points));

      let barsSinceFlush = -1;
      let barsSinceReclaim = -1;
      for (let lookback = 0; lookback <= cfg.flushLookbackBars; lookback += 1) {
        const cur = barAt(bars, i - lookback);
        const before = barAt(bars, i - lookback - 1);
        if (!cur || !before) continue;
        const pastFlush = cur.low <= level - cfg.tickSize && before.close >= level;
        const pastReclaim = cur.close > level && (before.close <= level || cur.low <= level - cfg.tickSize);
        if (barsSinceFlush === -1 && pastFlush) barsSinceFlush = lookback;
        if (barsSinceReclaim === -1 && pastReclaim) barsSinceReclaim = lookback;
      }
      const flushBeforeReclaim = barsSinceFlush >= 0
        && barsSinceReclaim >= 0
        && (barsSinceFlush > barsSinceReclaim || (barsSinceFlush === 0 && barsSinceReclaim === 0));
      const reclaimRecent = flushBeforeReclaim
        && barsSinceFlush <= cfg.flushLookbackBars
        && barsSinceReclaim <= cfg.flushLookbackBars;

      let holdAbove = true;
      for (let hold = 0; hold < acceptanceBars; hold += 1) {
        const held = barAt(bars, i - hold);
        holdAbove = holdAbove && Boolean(held && held.close >= level);
      }

      let recentLevelTap = false;
      for (let tap = 0; tap <= cfg.levelTapLookbackBars; tap += 1) {
        recentLevelTap = recentLevelTap || touched(barAt(bars, i - tap), level);
      }
      const reclaimEvent = bar.close > level && (prev.close <= level || bar.low <= level - cfg.tickSize);
      const freshLevelRetest = recentLevelTap && bar.close >= level + cfg.minCloseAboveLevelPoints;
      const candleRange = Math.max(bar.high - bar.low, cfg.tickSize);
      const reclaimCloseLocation = (bar.close - bar.low) / candleRange;
      const reclaimBodyPct = Math.abs(bar.close - bar.open) / candleRange;
      const reclaimUpperWick = bar.high - Math.max(bar.open, bar.close);
      const closeClearedLevel = bar.close >= level + cfg.minCloseAboveLevelPoints;
      const ribbonOk = pine._internal.pivotRibbonLongOk(bars, i, ribbon, cfg);
      const notStuffedReclaim = !cfg.antiStuffFilter || (
        closeClearedLevel
        && reclaimCloseLocation >= cfg.minReclaimCloseLocation
        && reclaimUpperWick <= cfg.maxReclaimUpperWickPoints
        && ribbonOk
      );
      const impulseCloudOk = !cfg.requireImpulseCloudBreak || pine._internal.pivotCloudBreakNow(bars, i, ribbon) || bar.close >= Math.max(
        ribbon.fast[i] ?? -Infinity,
        ribbon.pivot[i] ?? -Infinity,
        ribbon.slow[i] ?? -Infinity,
      );
      const impulseReclaimHere = cfg.enableImpulseReclaimLong
        && reclaimEvent
        && freshLevelRetest
        && bar.close > bar.open
        && reclaimBodyPct >= cfg.minImpulseBodyPct
        && closeClearedLevel
        && impulseCloudOk
        && ribbonOk;
      const failedLevelRecent = Number.isFinite(lastFailedLevel)
        && Number.isInteger(lastFailedIndex)
        && Math.abs(level - lastFailedLevel) <= cfg.failedReentryLevelTolerancePoints
        && i - lastFailedIndex <= cfg.failedReentryCooldownBars;
      const failedLevelReset = bar.low <= level - cfg.failedReentryResetPoints && closeClearedLevel;
      const failedChaseBlock = failedLevelRecent && !failedLevelReset;
      const priorTaps = priorTouchGroups(bars, i, level);
      const riskOk = planEntry - stop <= cfg.hardStopPoints;
      const paperHere = ((reclaimRecent && holdAbove) || impulseReclaimHere)
        && targetOk
        && notStuffedReclaim
        && riskOk
        && !failedChaseBlock
        && priorTaps >= minTapGroups;

      if (paperHere && (!paperPlan || level > paperPlan.level)) {
        paperPlan = {
          date,
          signal_timestamp: bar.timestamp,
          signal_index: i,
          level,
          prior_tap_groups: priorTaps,
          bars_since_flush: barsSinceFlush,
          bars_since_reclaim: barsSinceReclaim,
          plan_entry: planEntry,
          stop,
          next_cluster: nextCluster,
          trigger: impulseReclaimHere ? 'impulse' : 'acceptance',
        };
      }
      paperSignal = paperSignal || paperHere;
    }

    const reentryOk = !Number.isInteger(lastClosedIndex) || i > lastClosedIndex + cfg.reentryCooldownBars;
    const longEvent = Boolean(paperPlan && paperSignal && !previousPaperSignal && reentryOk);
    previousPaperSignal = paperSignal;
    if (!longEvent) continue;

    let entryIndex = i + 1;
    if (entryIndex >= bars.length) break;
    let marketEntry = round2(bars[entryIndex].open);
    let entry = entryMode === 'next_open_market' ? marketEntry : paperPlan.plan_entry;
    if (entryMode === 'limit_retest_10m' || entryMode === 'limit_retest_30m') {
      const maxWaitBars = entryMode === 'limit_retest_10m' ? 10 : 30;
      let foundEntryIndex = null;
      for (let waitIndex = i + 1; waitIndex <= Math.min(bars.length - 1, i + maxWaitBars); waitIndex += 1) {
        if (bars[waitIndex].low <= paperPlan.plan_entry && bars[waitIndex].high >= paperPlan.plan_entry) {
          foundEntryIndex = waitIndex;
          break;
        }
      }
      if (!Number.isInteger(foundEntryIndex)) continue;
      entryIndex = foundEntryIndex;
      marketEntry = round2(bars[entryIndex].open);
      entry = paperPlan.plan_entry;
    }
    const stop = paperPlan.stop;
    if (entry - stop > cfg.hardStopPoints) continue;
    const tp1 = round2(entry + cfg.tp1Points);
    const tp2 = Number.isFinite(paperPlan.next_cluster) && paperPlan.next_cluster > tp1
      ? round2(paperPlan.next_cluster)
      : round2(entry + cfg.tp1Points * 2.0);
    const plan = { ...paperPlan, entry, stop, tp1, tp2 };
    const outcome = evaluateFromEntry(bars, entryIndex, plan);
    const trade = {
      date,
      acceptance_bars: acceptanceBars,
      acceptance_minutes: acceptanceBars,
      min_tap_groups: minTapGroups,
      entry_mode: entryMode,
      signal_timestamp: paperPlan.signal_timestamp,
      entry_timestamp: bars[entryIndex].timestamp,
      outcome_timestamp: outcome.outcome_timestamp,
      level: paperPlan.level,
      entry,
      stop,
      tp1,
      tp2,
      prior_tap_groups: paperPlan.prior_tap_groups,
      bars_since_flush: paperPlan.bars_since_flush,
      bars_since_reclaim: paperPlan.bars_since_reclaim,
      trigger: paperPlan.trigger,
      outcome: outcome.outcome,
      points: outcome.points,
      dollars: outcome.dollars,
      mfe_30_points: outcome.mfe_30_points,
      mfe_60_points: outcome.mfe_60_points,
    };
    trades.push(trade);
    lastClosedIndex = outcome.outcome_index;
    if (outcome.outcome === 'stop_first' || outcome.outcome === 'mixed_stop_first') {
      lastFailedIndex = outcome.outcome_index;
      lastFailedLevel = paperPlan.level;
    }
    i = Math.max(i, outcome.outcome_index);
  }
  return trades;
}

function summarize(rows) {
  const trades = rows.length;
  const tp1 = rows.filter(row => row.outcome === 'tp1_first' || row.outcome === 'tp2_first').length;
  const tp2 = rows.filter(row => row.outcome === 'tp2_first').length;
  const stop = rows.filter(row => row.outcome === 'stop_first' || row.outcome === 'mixed_stop_first').length;
  const dollars = round2(rows.reduce((sum, row) => sum + row.dollars, 0));
  const points = round2(rows.reduce((sum, row) => sum + row.points, 0));
  const mfe30 = rows.map(row => row.mfe_30_points).filter(Number.isFinite).sort((a, b) => a - b);
  const mfe60 = rows.map(row => row.mfe_60_points).filter(Number.isFinite).sort((a, b) => a - b);
  const median = values => values.length ? values[Math.floor(values.length / 2)] : null;
  return {
    trades,
    tp1_first_rate: trades ? tp1 / trades : null,
    stop_first_rate: trades ? stop / trades : null,
    tp2_first_rate: trades ? tp2 / trades : null,
    total_points: points,
    total_dollars: dollars,
    average_dollars: trades ? round2(dollars / trades) : null,
    median_mfe_30: median(mfe30),
    median_mfe_60: median(mfe60),
    explosive_6pt_30_rate: trades ? rows.filter(row => row.mfe_30_points >= 6).length / trades : null,
    explosive_10pt_30_rate: trades ? rows.filter(row => row.mfe_30_points >= 10).length / trades : null,
  };
}

function toPct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function chartRows(summaryRows, entryMode) {
  return summaryRows
    .filter(row => row.entry_mode === entryMode)
    .sort((a, b) => a.min_tap_groups - b.min_tap_groups || a.acceptance_bars - b.acceptance_bars);
}

function barHtml(rows, field, title, formatter = value => String(value)) {
  const values = rows.map(row => Number(row[field] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return `
    <section class="panel" id="${field}">
      <h1>${title}</h1>
      <div class="meta">Flagship v4 acceptance-window replay | ES 1m Barchart futures | non-cheating next-open entries</div>
      <div class="bars">
        ${rows.map(row => {
          const value = Number(row[field] || 0);
          const width = Math.max(4, Math.round(((value - min) / (max - min || 1)) * 760));
          const cls = value >= 0 ? 'pos' : 'neg';
          return `<div class="barrow">
            <div class="label">${row.entry_mode.replace(/_/g, ' ')} ${row.acceptance_bars}m / taps ${row.min_tap_groups}</div>
            <div class="barwrap"><div class="bar ${cls}" style="width:${width}px"></div></div>
            <div class="value">${formatter(value)}</div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

function tableHtml(rows) {
  return `
    <section class="panel" id="summary-table">
      <h1>Acceptance Window Summary</h1>
      <div class="meta">Rows are next-open market entries after acceptance confirmation. Costs: 0.25pt adverse slippage + $5/contract.</div>
      <table>
        <thead><tr><th>Accept</th><th>Min taps</th><th>Trades</th><th>TP1%</th><th>Stop%</th><th>Net $</th><th>Avg $</th><th>Med MFE30</th><th>6pt MFE%</th></tr></thead>
        <tbody>
          ${rows.map(row => `<tr>
            <td>${row.acceptance_bars}m</td>
            <td>${row.min_tap_groups}</td>
            <td>${row.trades}</td>
            <td>${toPct(row.tp1_first_rate)}</td>
            <td>${toPct(row.stop_first_rate)}</td>
            <td>${row.total_dollars.toFixed(0)}</td>
            <td>${row.average_dollars?.toFixed(1) ?? 'n/a'}</td>
            <td>${row.median_mfe_30?.toFixed(2) ?? 'n/a'}</td>
            <td>${toPct(row.explosive_6pt_30_rate)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

async function renderPngs(summaryRows, metadata) {
  const nonCheatRows = summaryRows
    .filter(row => row.entry_mode !== 'legacy_plan_entry')
    .sort((a, b) => a.entry_mode.localeCompare(b.entry_mode)
      || a.min_tap_groups - b.min_tap_groups
      || a.acceptance_bars - b.acceptance_bars);
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #101418; color: #f4f6f8; font-family: Arial, sans-serif; }
    .panel { width: 1320px; min-height: 760px; box-sizing: border-box; padding: 34px 42px; background: #11161c; }
    h1 { margin: 0 0 6px; font-size: 30px; }
    .meta { color: #aab4c0; font-size: 15px; margin-bottom: 26px; }
    .barrow { display: grid; grid-template-columns: 270px 780px 130px; gap: 14px; align-items: center; margin: 10px 0; font-size: 14px; }
    .label { color: #d5dde6; }
    .barwrap { height: 24px; background: #222a33; border-radius: 4px; overflow: hidden; }
    .bar { height: 24px; border-radius: 4px; }
    .pos { background: #32c766; }
    .neg { background: #e45050; }
    .value { text-align: right; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; font-size: 16px; }
    th, td { border-bottom: 1px solid #28313b; padding: 9px 10px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #b9c4d0; background: #18202a; }
    .foot { margin-top: 22px; color: #aab4c0; font-size: 13px; }
  </style></head><body>
    ${barHtml(nonCheatRows, 'total_dollars', 'Non-Cheating Net Dollars By Acceptance Window', value => `$${value.toFixed(0)}`)}
    ${barHtml(nonCheatRows, 'explosive_6pt_30_rate', 'Non-Cheating Explosive Move Rate: 6pt MFE Within 30m', value => toPct(value))}
    ${tableHtml(nonCheatRows)}
    <section class="panel" id="metadata"><h1>Run Metadata</h1><pre>${JSON.stringify(metadata, null, 2)}</pre></section>
  </body></html>`;
  const htmlPath = path.join(OUT_DIR, 'report.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  for (const [selector, name] of [
    ['#total_dollars', 'net-dollars-by-acceptance.png'],
    ['#explosive_6pt_30_rate', 'explosive-rate-by-acceptance.png'],
    ['#summary-table', 'acceptance-summary-table.png'],
    ['#metadata', 'run-metadata.png'],
  ]) {
    await page.locator(selector).screenshot({ path: path.join(OUT_DIR, name) });
  }
  await browser.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const feed = await getCandles('ES', { mode: 'replay', limit: 200000 });
  const bars = [...feed.candles].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const sessions = pine._internal.groupBarsBySessionDate(bars);
  const dates = [...sessions.keys()].sort();
  const levelsByDate = deriveLevelsByDate(bars, dates, { referenceField: 'close' });
  const flagshipText = fs.readFileSync(FLAGSHIP, 'utf8');
  const flagshipHash = crypto.createHash('sha256').update(flagshipText).digest('hex');
  const allTrades = [];

  for (const entryMode of ENTRY_MODES) {
    for (const acceptanceBars of ACCEPTANCE_BARS) {
      for (const minTapGroups of MIN_TAP_GROUPS) {
        for (const date of dates) {
          const satyLevels = levelsByDate[date];
          const sessionBars = sessions.get(date) || [];
          if (!satyLevels?.valid || sessionBars.length === 0) continue;
          const rows = variantTradeRows({
            bars: sessionBars,
            satyLevels,
            acceptanceBars,
            minTapGroups,
            entryMode,
            date,
          });
          allTrades.push(...rows);
        }
      }
    }
  }

  const grouped = new Map();
  for (const row of allTrades) {
    const key = `${row.entry_mode}|${row.acceptance_bars}|${row.min_tap_groups}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const summaryRows = [...grouped.entries()].map(([key, rows]) => {
    const [entryMode, acceptanceBars, minTapGroups] = key.split('|');
    return {
      entry_mode: entryMode,
      acceptance_bars: Number(acceptanceBars),
      min_tap_groups: Number(minTapGroups),
      ...summarize(rows),
    };
  }).sort((a, b) => a.entry_mode.localeCompare(b.entry_mode)
    || a.min_tap_groups - b.min_tap_groups
    || a.acceptance_bars - b.acceptance_bars);

  const metadata = {
    generated_at: new Date().toISOString(),
    research_only: true,
    no_pine_rewrite: true,
    flagship_file: path.relative(ROOT, FLAGSHIP),
    flagship_sha256: flagshipHash,
    flagship_size_bytes: Buffer.byteLength(flagshipText),
    model_family: 'local JS port of current flagship Saty/Pivot/failed-breakdown core',
    external_pasted_levels: 'not used; avoids point-in-time Mancini lookahead without timestamped TradingView input history',
    data: {
      symbol: feed.symbol,
      timeframe: feed.timeframe,
      source: feed.source,
      source_label: feed.source_label,
      bars: bars.length,
      first_timestamp: bars[0]?.timestamp,
      last_timestamp: bars[bars.length - 1]?.timestamp,
      session_dates: dates.length,
      valid_saty_sessions: dates.filter(date => levelsByDate[date]?.valid && (sessions.get(date) || []).length > 0).length,
      raw: feed.raw,
    },
    config: {
      tp1Points: cfg.tp1Points,
      maxStopPoints: cfg.maxStopPoints,
      hardStopPoints: cfg.hardStopPoints,
      clusterTolerancePoints: cfg.clusterTolerancePoints,
      minCloseAboveLevelPoints: cfg.minCloseAboveLevelPoints,
      pivotRibbonFilterMode: cfg.pivotRibbonFilterMode,
      entrySlippagePoints: cfg.entrySlippagePoints,
      roundTripFeePerContract: cfg.roundTripFeePerContract,
      acceptanceBarsTested: ACCEPTANCE_BARS,
      minTapGroupsTested: MIN_TAP_GROUPS,
      entryModesTested: ENTRY_MODES,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ metadata, summaryRows }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'summary.csv'), summaryRows);
  writeCsv(path.join(OUT_DIR, 'trades.csv'), allTrades);
  await renderPngs(summaryRows, metadata);

  const nextOpenRows = chartRows(summaryRows, 'next_open_market');
  const nonCheatRows = summaryRows.filter(row => row.entry_mode !== 'legacy_plan_entry');
  const best = [...nextOpenRows].sort((a, b) => b.total_dollars - a.total_dollars)[0];
  const bestNonCheat = [...nonCheatRows].sort((a, b) => b.total_dollars - a.total_dollars)[0];
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR),
    flagship_file: metadata.flagship_file,
    flagship_sha256: flagshipHash.slice(0, 16),
    bars: bars.length,
    valid_saty_sessions: metadata.data.valid_saty_sessions,
    best_next_open: best,
    best_non_cheat: bestNonCheat,
    pngs: [
      'net-dollars-by-acceptance.png',
      'explosive-rate-by-acceptance.png',
      'acceptance-summary-table.png',
      'run-metadata.png',
    ].map(name => path.join(path.relative(ROOT, OUT_DIR), name)),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
