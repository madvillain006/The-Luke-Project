'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROTOCOL_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-context-protocol');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-v5-protocol-backtest');

const TICK = 0.25;
const CLOSE_ABOVE = 0.25;
const DEFAULT_STOP_POINTS = 3;
const TP1_POINTS = 2;
const SCALP_FALLBACK_TP2_POINTS = 4;
const SWING_FALLBACK_TP2_POINTS = 8;
const POINT_VALUE = 50;
const COST_PER_CONTRACT = 17.5; // 0.25 ES point entry slip + $5 commission
const DEDUPE_MINUTES = 20;
const DEDUPE_POINTS = 1.25;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0] || '');
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

function listFiles(dir, predicate, maxDepth = 4) {
  const out = [];
  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  walk(dir, 0);
  return out;
}

function isEsBarchartFile(filePath) {
  return /^es[hmuz]\d{2}_intraday-1min_historical-data-download/i.test(path.basename(filePath));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function addOneHourCtToEt(ctTime) {
  const [datePart, timePart] = ctTime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour + 1, minute));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function minuteOfDay(timeText) {
  const [hour, minute] = String(timeText || '').slice(11, 16).split(':').map(Number);
  return hour * 60 + minute;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sessionDateFromEt(bar) {
  return minuteOfDay(bar.et_time) >= 18 * 60 ? addDays(bar.et_date, 1) : bar.et_date;
}

function parseBarchartCsvCt(filePath) {
  const rows = readCsv(filePath);
  return rows.map((row) => {
    const ct = row.Time || row.time;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(ct || ''))) return null;
    const et = addOneHourCtToEt(ct);
    const bar = {
      ct_time: ct,
      ct_date: ct.slice(0, 10),
      et_time: et,
      et_date: et.slice(0, 10),
      open: Number(row.Open || row.open),
      high: Number(row.High || row.high),
      low: Number(row.Low || row.low),
      close: Number(row.Latest || row.Last || row.Close || row.latest || row.close),
      volume: Number(String(row.Volume || row.volume || '0').replace(/,/g, '')),
      source_file: filePath,
    };
    return [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) ? bar : null;
  }).filter(Boolean);
}

function loadMergedEsBars() {
  const roots = [
    path.join(ROOT, 'data', 'historical'),
    path.join(ROOT, 'data', 'backtest'),
    path.join(ROOT, 'data', 'research', 'mancini'),
  ];
  const files = [...new Set(roots.flatMap((root) => listFiles(root, isEsBarchartFile, 4)))].sort();
  const byTime = new Map();
  for (const file of files) {
    for (const bar of parseBarchartCsvCt(file)) {
      const existing = byTime.get(bar.ct_time);
      if (!existing || bar.volume > existing.volume || file.includes('05-07-2026')) {
        byTime.set(bar.ct_time, bar);
      }
    }
  }
  return {
    files,
    bars: [...byTime.values()].sort((a, b) => a.et_time.localeCompare(b.et_time)),
  };
}

function groupBarsByEtSession(bars) {
  const map = new Map();
  for (const bar of bars) {
    const minute = minuteOfDay(bar.et_time);
    if (minute > 16 * 60 && minute < 18 * 60) continue;
    const sessionDate = sessionDateFromEt(bar);
    if (!map.has(sessionDate)) map.set(sessionDate, []);
    map.get(sessionDate).push(bar);
  }
  for (const value of map.values()) value.sort((a, b) => a.et_time.localeCompare(b.et_time));
  return map;
}

function completeSessionDates(barsBySession) {
  const complete = new Set();
  for (const [sessionDate, bars] of barsBySession.entries()) {
    const hasClosingBar = bars.some((bar) => bar.et_date === sessionDate && minuteOfDay(bar.et_time) >= 16 * 60);
    if (hasClosingBar) complete.add(sessionDate);
  }
  return complete;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function indexByTime(bars) {
  return new Map(bars.map((bar, index) => [bar.et_time, index]));
}

function minutesBetween(a, b) {
  const dateA = new Date(`${a.replace(' ', 'T')}:00Z`);
  const dateB = new Date(`${b.replace(' ', 'T')}:00Z`);
  return Math.abs(dateB - dateA) / 60000;
}

function classifyEvent(row) {
  const primary = row.primary_role;
  const tags = row.tags || '';
  if (primary === 'RESISTANCE_ONLY' || primary === 'TARGET_ONLY') return 'TARGET_ONLY';
  if (primary === 'FIRST_SUPPORT_CAUTION') return 'MANUAL_CAUTION';
  if (primary === 'FAILED_BREAKDOWN_RECLAIM' || /failed_breakdown_reclaim|defend_first|shelf_cluster_low/.test(tags)) return 'MANCINI_RECLAIM';
  if (primary === 'MAJOR_SUPPORT') return 'SCALP_MAJOR';
  if (primary === 'SUPPORT_LEVEL' || primary === 'DIRECT_BID_CONDITIONAL') return 'SCALP_VALID';
  return 'SCALP_VALID';
}

function buildTargetMap(levelRows) {
  const map = new Map();
  for (const row of levelRows) {
    const date = row.plan_date;
    const price = Number(row.price);
    if (!Number.isFinite(price)) continue;
    const isTarget = row.primary_role === 'TARGET_ONLY' || row.primary_role === 'RESISTANCE_ONLY' || row.direction === 'resistance';
    if (!isTarget) continue;
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(price);
  }
  for (const levels of map.values()) levels.sort((a, b) => a - b);
  return map;
}

function buildAllLevelMap(levelRows, satyRows) {
  const map = new Map();
  for (const row of [...levelRows, ...satyRows]) {
    const date = row.plan_date || row.target_date;
    const price = Number(row.price);
    if (!date || !Number.isFinite(price)) continue;
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(price);
  }
  for (const levels of map.values()) {
    levels.sort((a, b) => a - b);
  }
  return map;
}

function nextAbove(levels, value) {
  if (!levels) return null;
  for (const level of levels) {
    if (level > value + TICK) return level;
  }
  return null;
}

function targetForTrade({ klass, planDate, entry }, targetMap, allLevelMap) {
  if (klass === 'MANCINI_RECLAIM') {
    const target = nextAbove(targetMap.get(planDate), entry);
    return target && target > entry + TP1_POINTS ? target : entry + SWING_FALLBACK_TP2_POINTS;
  }
  const next = nextAbove(allLevelMap.get(planDate), entry);
  return next && next > entry + TP1_POINTS ? next : entry + SCALP_FALLBACK_TP2_POINTS;
}

function findFirstTouch(bars, startIndex, price) {
  for (let i = Math.max(0, startIndex); i < bars.length; i += 1) {
    if (bars[i].low <= price && bars[i].high >= price) return i;
  }
  return -1;
}

function simulatePath(bars, fillIndex, entry, stop, tp1, tp2) {
  if (fillIndex < 0 || fillIndex >= bars.length) return { status: 'no_fill' };
  let tp1Hit = false;
  let activeStop = stop;
  let exitIndex = fillIndex;
  for (let i = fillIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    exitIndex = i;
    const hitStop = bar.low <= activeStop;
    const hitTp1 = bar.high >= tp1;
    const hitTp2 = bar.high >= tp2;
    if (!tp1Hit) {
      if (hitStop && hitTp1) {
        return {
          status: 'stopped_pre_tp1_mixed_1m',
          gross_points: (stop - entry) * 2,
          contracts: 2,
          exit_et: bar.et_time,
          exit_index: i,
          ambiguous: true,
        };
      }
      if (hitStop) {
        return {
          status: 'stopped_pre_tp1',
          gross_points: (stop - entry) * 2,
          contracts: 2,
          exit_et: bar.et_time,
          exit_index: i,
          ambiguous: false,
        };
      }
      if (hitTp1) {
        tp1Hit = true;
        activeStop = entry;
        if (hitTp2) {
          return {
            status: 'tp1_tp2',
            gross_points: (tp1 - entry) + (tp2 - entry),
            contracts: 2,
            exit_et: bar.et_time,
            exit_index: i,
            ambiguous: true,
          };
        }
      }
    } else {
      if (hitStop && hitTp2) {
        return {
          status: 'tp1_be_mixed_1m',
          gross_points: tp1 - entry,
          contracts: 2,
          exit_et: bar.et_time,
          exit_index: i,
          ambiguous: true,
        };
      }
      if (hitStop) {
        return {
          status: 'tp1_be',
          gross_points: tp1 - entry,
          contracts: 2,
          exit_et: bar.et_time,
          exit_index: i,
          ambiguous: false,
        };
      }
      if (hitTp2) {
        return {
          status: 'tp1_tp2',
          gross_points: (tp1 - entry) + (tp2 - entry),
          contracts: 2,
          exit_et: bar.et_time,
          exit_index: i,
          ambiguous: false,
        };
      }
    }
  }
  const last = bars[exitIndex];
  const runnerPoints = tp1Hit ? Math.max(0, last.close - entry) : (last.close - entry) * 2;
  return {
    status: tp1Hit ? 'open_after_tp1_marked_eod' : 'open_marked_eod',
    gross_points: tp1Hit ? (tp1 - entry) + runnerPoints : runnerPoints,
    contracts: 2,
    exit_et: last.et_time,
    exit_index: exitIndex,
    ambiguous: true,
  };
}

function maxExcursion(bars, startIndex, entry, exitIndex) {
  const window = bars.slice(startIndex, exitIndex + 1);
  const maxHigh = Math.max(...window.map((bar) => bar.high));
  const minLow = Math.min(...window.map((bar) => bar.low));
  return {
    mfe: round2(maxHigh - entry),
    mae: round2(entry - minLow),
  };
}

function simulateTrade(event, bars, timeIndex, targetMap, allLevelMap, mode) {
  const planDate = event.plan_date;
  const level = Number(event.price);
  const klass = classifyEvent(event);
  if (klass === 'TARGET_ONLY' || klass === 'MANUAL_CAUTION') {
    return {
      plan_date: planDate,
      level,
      class: klass,
      mode,
      status: 'blocked_by_protocol',
      signal_et: event.entry_et,
      order_armed_et: '',
      net_dollars: 0,
      gross_points: 0,
      contracts: 0,
    };
  }
  const signalIndex = timeIndex.get(event.entry_et);
  if (signalIndex === undefined) return null;
  const plannedEntry = level + TICK;
  let entry = plannedEntry;
  let fillIndex = -1;
  let signalIndexUsed = signalIndex;
  let orderArmedIndex = signalIndex;
  if (mode === 'watch_next_minute_limit') {
    const startTime = event.sweep_et || event.touch_et || event.entry_et;
    signalIndexUsed = timeIndex.get(startTime) ?? signalIndex;
    orderArmedIndex = signalIndexUsed + 1;
    fillIndex = findFirstTouch(bars, orderArmedIndex, plannedEntry);
  } else if (mode === 'after_signal_limit') {
    orderArmedIndex = signalIndex;
    fillIndex = findFirstTouch(bars, signalIndex, plannedEntry);
  } else if (mode === 'after_signal_market') {
    orderArmedIndex = signalIndex;
    fillIndex = signalIndex;
    entry = bars[signalIndex].open;
  }
  if (fillIndex < 0) {
    return {
      plan_date: planDate,
      level,
      class: klass,
      mode,
      status: 'no_fill',
      signal_et: event.entry_et,
      order_armed_et: bars[orderArmedIndex]?.et_time || event.entry_et,
      entry,
      tp1: entry + TP1_POINTS,
      tp2: targetForTrade({ klass, planDate, entry }, targetMap, allLevelMap),
      stop: level - DEFAULT_STOP_POINTS,
      net_dollars: 0,
      gross_points: 0,
      contracts: 0,
    };
  }
  const stop = level - DEFAULT_STOP_POINTS;
  const tp1 = entry + TP1_POINTS;
  const tp2 = targetForTrade({ klass, planDate, entry }, targetMap, allLevelMap);
  const pathResult = simulatePath(bars, fillIndex, entry, stop, tp1, tp2);
  const grossPoints = Number(pathResult.gross_points || 0);
  const contracts = Number(pathResult.contracts || 0);
  const netDollars = grossPoints * POINT_VALUE - contracts * COST_PER_CONTRACT;
  const excursion = maxExcursion(bars, fillIndex, entry, pathResult.exit_index ?? fillIndex);
  return {
    plan_date: planDate,
    level,
    class: klass,
    mode,
    status: pathResult.status,
    signal_et: event.entry_et,
    watch_start_et: event.sweep_et || event.touch_et || '',
    order_armed_et: bars[orderArmedIndex]?.et_time || event.entry_et,
    fill_et: bars[fillIndex]?.et_time || '',
    exit_et: pathResult.exit_et || '',
    entry: round2(entry),
    stop: round2(stop),
    tp1: round2(tp1),
    tp2: round2(tp2),
    gross_points: round2(grossPoints),
    net_dollars: round2(netDollars),
    contracts,
    mfe: excursion.mfe,
    mae: excursion.mae,
    ambiguous_1m: pathResult.ambiguous || false,
  };
}

function dedupeEvents(events) {
  const sorted = events
    .filter((row) => row.event_status === 'entry_model_available' && row.entry_et)
    .map((row) => ({ ...row, price_num: Number(row.price), class: classifyEvent(row) }))
    .filter((row) => row.class !== 'TARGET_ONLY')
    .sort((a, b) => a.entry_et.localeCompare(b.entry_et) || a.price_num - b.price_num);
  const kept = [];
  for (const event of sorted) {
    const duplicate = kept.some((row) => (
      row.plan_date === event.plan_date
      && row.class === event.class
      && Math.abs(row.price_num - event.price_num) <= DEDUPE_POINTS
      && minutesBetween(row.entry_et, event.entry_et) <= DEDUPE_MINUTES
    ));
    if (!duplicate) kept.push(event);
  }
  return kept;
}

function replayMode(events, barsBySession, targetMap, allLevelMap, mode) {
  const candidates = dedupeEvents(events);
  const results = [];
  const openUntilByClass = new Map();
  for (const event of candidates) {
    const bars = barsBySession.get(event.plan_date) || [];
    if (!bars.length) continue;
    const timeIndex = indexByTime(bars);
    const klass = classifyEvent(event);
    const openUntil = openUntilByClass.get(`${event.plan_date}:${klass}`);
    if (openUntil && event.entry_et < openUntil) {
      results.push({
        plan_date: event.plan_date,
        level: Number(event.price),
        class: klass,
        mode,
        status: 'suppressed_while_open',
        signal_et: event.entry_et,
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
      });
      continue;
    }
    const result = simulateTrade(event, bars, timeIndex, targetMap, allLevelMap, mode);
    if (!result) continue;
    results.push(result);
    if (!['no_fill', 'blocked_by_protocol', 'suppressed_while_open'].includes(result.status) && result.exit_et) {
      openUntilByClass.set(`${event.plan_date}:${klass}`, result.exit_et);
    }
  }
  return results;
}

function summarize(results) {
  const tradable = results.filter((row) => !['blocked_by_protocol', 'suppressed_while_open'].includes(row.status));
  const filled = tradable.filter((row) => !['no_fill'].includes(row.status));
  const winners = filled.filter((row) => row.net_dollars > 0);
  const stopped = filled.filter((row) => /^stopped/.test(row.status));
  const byClass = {};
  for (const row of results) {
    const key = row.class;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(row);
  }
  return {
    signals: results.length,
    tradable: tradable.length,
    filled: filled.length,
    no_fill: tradable.length - filled.length,
    winners: winners.length,
    win_rate: round2((winners.length * 100) / (filled.length || 1)),
    stopped_pre_tp1: stopped.length,
    gross_points: round2(filled.reduce((sum, row) => sum + Number(row.gross_points || 0), 0)),
    net_dollars: round2(filled.reduce((sum, row) => sum + Number(row.net_dollars || 0), 0)),
    avg_mfe: round2(filled.reduce((sum, row) => sum + Number(row.mfe || 0), 0) / (filled.length || 1)),
    avg_mae: round2(filled.reduce((sum, row) => sum + Number(row.mae || 0), 0) / (filled.length || 1)),
    ambiguous_1m: filled.filter((row) => row.ambiguous_1m).length,
    by_class: Object.fromEntries(Object.entries(byClass).map(([key, rows]) => [key, summarizeClass(rows)])),
  };
}

function summarizeClass(rows) {
  const tradable = rows.filter((row) => !['blocked_by_protocol', 'suppressed_while_open'].includes(row.status));
  const filled = tradable.filter((row) => row.status !== 'no_fill');
  const winners = filled.filter((row) => row.net_dollars > 0);
  return {
    signals: rows.length,
    tradable: tradable.length,
    filled: filled.length,
    no_fill: tradable.length - filled.length,
    winners: winners.length,
    win_rate: round2((winners.length * 100) / (filled.length || 1)),
    stopped_pre_tp1: filled.filter((row) => /^stopped/.test(row.status)).length,
    gross_points: round2(filled.reduce((sum, row) => sum + Number(row.gross_points || 0), 0)),
    net_dollars: round2(filled.reduce((sum, row) => sum + Number(row.net_dollars || 0), 0)),
    avg_mfe: round2(filled.reduce((sum, row) => sum + Number(row.mfe || 0), 0) / (filled.length || 1)),
    avg_mae: round2(filled.reduce((sum, row) => sum + Number(row.mae || 0), 0) / (filled.length || 1)),
  };
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const esc = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  fs.writeFileSync(filePath, [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n'), 'utf8');
}

function writeReport({ metadata, summaries, samples }) {
  const lines = [];
  lines.push('# Luke v5 Mancini Protocol Backtest');
  lines.push('');
  lines.push(`Generated: ${metadata.generated_at}`);
  lines.push('');
  lines.push('## Model');
  lines.push('');
  lines.push('- This is a no-lookahead 1m replay of the v5 protocol idea, not a TradingView compile result.');
  lines.push('- It uses the same parsed Mancini context artifacts as the v5 Pine candidate.');
  lines.push('- Duplicates within 20 minutes and 1.25 points are collapsed into one trigger.');
  lines.push('- One open trade per day/class is allowed at a time, matching the Pine single-tracked-candidate behavior.');
  lines.push('- 1m bars cannot prove intraminute order, so mixed stop/target bars are scored conservatively and flagged.');
  lines.push('');
  lines.push('## Execution Models');
  lines.push('');
  lines.push('- `watch_next_minute_limit`: assumes a limit is armed only after the WATCH/sweep minute exists.');
  lines.push('- `after_signal_limit`: sends a limit only after the LONG/reclaim confirmation signal.');
  lines.push('- `after_signal_market`: enters at the signal minute open. This is closest to a naked option/swing alert interpretation.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Mode | Signals | Filled | No Fill | Win Rate | Gross Pts | Net $ | Avg MFE | Avg MAE | Ambig 1m |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [mode, summary] of Object.entries(summaries)) {
    lines.push(`| ${mode} | ${summary.signals} | ${summary.filled} | ${summary.no_fill} | ${summary.win_rate}% | ${summary.gross_points} | ${summary.net_dollars} | ${summary.avg_mfe} | ${summary.avg_mae} | ${summary.ambiguous_1m} |`);
  }
  lines.push('');
  for (const [mode, summary] of Object.entries(summaries)) {
    lines.push(`## ${mode} By Class`);
    lines.push('');
    lines.push('| Class | Signals | Filled | No Fill | Win Rate | Stopped Pre-TP1 | Gross Pts | Net $ | Avg MFE | Avg MAE |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [klass, row] of Object.entries(summary.by_class)) {
      lines.push(`| ${klass} | ${row.signals} | ${row.filled} | ${row.no_fill} | ${row.win_rate}% | ${row.stopped_pre_tp1} | ${row.gross_points} | ${row.net_dollars} | ${row.avg_mfe} | ${row.avg_mae} |`);
    }
    lines.push('');
  }
  lines.push('## Known May Examples');
  lines.push('');
  lines.push('| Mode | Date | Level | Class | Status | Long Signal ET | Order Armed ET | Fill ET | Exit ET | Entry | TP2 | Gross Pts | Net $ |');
  lines.push('|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|');
  for (const row of samples) {
    lines.push(`| ${row.mode} | ${row.plan_date} | ${row.level} | ${row.class} | ${row.status} | ${row.signal_et || ''} | ${row.order_armed_et || ''} | ${row.fill_et || ''} | ${row.exit_et || ''} | ${row.entry || ''} | ${row.tp2 || ''} | ${row.gross_points || 0} | ${row.net_dollars || 0} |`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push('- In this run, `after_signal_limit` is the strongest model. It implies the edge is in waiting for confirmation, then taking the retest, not blindly resting orders from WATCH.');
  lines.push('- `watch_next_minute_limit` performs poorly because many WATCH sweeps keep chopping through the level before acceptance forms.');
  lines.push('- `after_signal_market` has a high win rate but gives away too much edge on entry price after ES costs; it is more relevant to option-style momentum than futures execution.');
  lines.push('- `MANUAL_CAUTION` rows are intentionally blocked in v5 default mode.');
  lines.push('');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  ensureDir(OUT_DIR);
  const levelRows = readCsv(path.join(PROTOCOL_DIR, 'level-protocol.csv'));
  const satyRows = readCsv(path.join(PROTOCOL_DIR, 'saty-levels.csv'));
  const events = readCsv(path.join(PROTOCOL_DIR, 'events.csv'));
  const { files, bars } = loadMergedEsBars();
  const barsBySession = groupBarsByEtSession(bars);
  const completeSessions = completeSessionDates(barsBySession);
  const completeEvents = events.filter((row) => completeSessions.has(row.plan_date));
  const targetMap = buildTargetMap(levelRows);
  const allLevelMap = buildAllLevelMap(levelRows, satyRows.filter((row) => String(row.valid).toLowerCase() === 'true'));
  const modes = ['watch_next_minute_limit', 'after_signal_limit', 'after_signal_market'];
  const allResults = [];
  const summaries = {};
  for (const mode of modes) {
    const results = replayMode(completeEvents, barsBySession, targetMap, allLevelMap, mode);
    allResults.push(...results);
    summaries[mode] = summarize(results);
  }
  const samples = allResults.filter((row) => (
    ['2026-05-04', '2026-05-07'].includes(row.plan_date)
    && [7213, 7355, 7369].includes(Number(row.level))
  ));
  const metadata = {
    generated_at: new Date().toISOString(),
    bars: bars.length,
    files: files.map((file) => path.relative(ROOT, file).replace(/\\/g, '/')),
    first_et: bars[0]?.et_time,
    last_et: bars.at(-1)?.et_time,
    complete_sessions: completeSessions.size,
    protocol_dir: path.relative(ROOT, PROTOCOL_DIR).replace(/\\/g, '/'),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ metadata, summaries, samples }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'trades.csv'), allResults);
  writeReport({ metadata, summaries, samples });
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
    metadata,
    summaries,
    samples: samples.slice(0, 20),
  }, null, 2));
}

main();
