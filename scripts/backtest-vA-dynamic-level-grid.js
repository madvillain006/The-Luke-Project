'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROTOCOL_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-context-protocol');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-vA-dynamic-level-grid');

const TICK = 0.25;
const CLOSE_ABOVE = 0.25;
const DEFAULT_STOP_POINTS = 3;
const TP1_POINTS = 2;
const SCALP_FALLBACK_TP2_POINTS = 4;
const SWING_FALLBACK_TP2_POINTS = 8;
const POINT_VALUE = 50;
const COST_PER_CONTRACT = 17.5;
const CLUSTER_TOLERANCE_POINTS = 1.25;
const LIVE_LEVEL_WINDOW_POINTS = 400;
const MAX_RECLAIM_LOOKBACK_MINUTES = 60;
const RETEST_LIMIT_EXPIRY_MINUTES = 10;
const DEDUPE_MINUTES = 20;
const DEDUPE_POINTS = 1.25;
const LEVEL_TAP_LOOKBACK_MINUTES = 2;
const LEVEL_TAP_TOLERANCE_POINTS = 0.5;
const MIN_RECLAIM_CLOSE_LOCATION = 0.55;
const MAX_RECLAIM_UPPER_WICK_POINTS = 3;
const MIN_TARGET_SPACE_POINTS = 3;
const FAILED_REENTRY_COOLDOWN_MINUTES = 40;
const FAILED_REENTRY_LEVEL_TOLERANCE_POINTS = 1.25;
const FAILED_REENTRY_RESET_POINTS = 1;
const SUPPRESSED_STATUSES = new Set(['suppressed_while_open', 'suppressed_failed_cooldown']);

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

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((header) => escape(row[header])).join(','));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
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

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundTick(value) {
  return Math.round(Number(value) / TICK) * TICK;
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  return date.toISOString().slice(0, 10);
}

function addOneHourCtToEt(ctTime) {
  const [datePart, timePart] = ctTime.split(' ');
  if (!datePart || !timePart) return '';
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return '';
  const date = new Date(Date.UTC(year, month - 1, day, hour + 1, minute, 0));
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function minuteOfDay(etTime) {
  const [, timePart] = etTime.split(' ');
  const [hour, minute] = timePart.split(':').map(Number);
  return hour * 60 + minute;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function sessionDateForBar(bar) {
  return minuteOfDay(bar.et_time) >= 18 * 60 ? addDays(bar.et_date, 1) : bar.et_date;
}

function parseBarchartCsvCt(filePath) {
  return readCsv(filePath).map((row) => {
    const ct = row.Time || row.time;
    if (!ct) return null;
    const et = addOneHourCtToEt(ct.replace(/"/g, ''));
    if (!et) return null;
    return {
      ct_time: ct.replace(/"/g, ''),
      et_time: et,
      et_date: et.slice(0, 10),
      open: Number(row.Open),
      high: Number(row.High),
      low: Number(row.Low),
      close: Number(row.Latest || row.Close),
      volume: Number(row.Volume || 0),
      source_file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    };
  }).filter((bar) => (
    bar
    && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)
  ));
}

function loadMergedEsBars() {
  const roots = [
    path.join(ROOT, 'data', 'historical'),
    path.join(ROOT, 'data', 'backtest'),
    path.join(ROOT, 'data', 'research', 'mancini'),
  ];
  const files = roots.flatMap((dir) => listFiles(
    dir,
    (file) => /^es[hmuz]\d{2}_intraday-1min_historical-data-download/i.test(path.basename(file))
      && file.toLowerCase().endsWith('.csv'),
  )).sort();
  const byTime = new Map();
  for (const file of files) {
    for (const bar of parseBarchartCsvCt(file)) {
      const existing = byTime.get(bar.ct_time);
      if (!existing || bar.volume >= existing.volume) byTime.set(bar.ct_time, bar);
    }
  }
  const bars = [...byTime.values()].sort((a, b) => a.et_time.localeCompare(b.et_time));
  return { files, bars };
}

function groupBarsByEtSession(bars) {
  const map = new Map();
  for (const bar of bars) {
    const minute = minuteOfDay(bar.et_time);
    if (minute > 16 * 60 && minute < 18 * 60) continue;
    const sessionDate = sessionDateForBar(bar);
    if (!map.has(sessionDate)) map.set(sessionDate, []);
    map.get(sessionDate).push(bar);
  }
  for (const value of map.values()) value.sort((a, b) => a.et_time.localeCompare(b.et_time));
  return map;
}

function completeSessionDates(barsBySession) {
  const dates = new Set();
  for (const [sessionDate, bars] of barsBySession.entries()) {
    const hasRthClose = bars.some((bar) => bar.et_date === sessionDate && minuteOfDay(bar.et_time) >= 16 * 60);
    if (hasRthClose) dates.add(sessionDate);
  }
  return dates;
}

function addMinutesEt(etTime, minutes) {
  if (!etTime) return '';
  const [datePart, timePart] = etTime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes, 0));
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function minutesBetween(a, b) {
  if (!a || !b) return Infinity;
  const parse = (value) => {
    const [datePart, timePart] = value.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour, minute, 0);
  };
  return Math.abs(parse(b) - parse(a)) / 60000;
}

function classifyLevel(row) {
  const primary = row.primary_role;
  const tags = row.tags || '';
  if (primary === 'RESISTANCE_ONLY' || primary === 'TARGET_ONLY') return 'TARGET_ONLY';
  if (primary === 'FIRST_SUPPORT_CAUTION') return 'MANUAL_CAUTION';
  if (primary === 'FAILED_BREAKDOWN_RECLAIM' || /failed_breakdown_reclaim|defend_first|shelf_cluster_low/.test(tags)) return 'MANCINI_RECLAIM';
  if (primary === 'MAJOR_SUPPORT') return 'SCALP_MAJOR';
  if (primary === 'SUPPORT_LEVEL' || primary === 'DIRECT_BID_CONDITIONAL') return 'SCALP_VALID';
  return 'SCALP_VALID';
}

function priorityForClass(klass) {
  if (klass === 'MANCINI_RECLAIM') return 3;
  if (klass === 'SCALP_MAJOR') return 2;
  if (klass === 'SCALP_VALID') return 1;
  return 0;
}

function buildRawLevelMaps(levelRows, satyRows) {
  const rawByDate = new Map();
  const targetMap = new Map();
  const allMap = new Map();
  let skippedFutureManciniRows = 0;
  const pushRaw = (date, raw) => {
    if (!rawByDate.has(date)) rawByDate.set(date, []);
    rawByDate.get(date).push(raw);
    if (!allMap.has(date)) allMap.set(date, []);
    allMap.get(date).push(raw.price);
    if (raw.class === 'TARGET_ONLY') {
      if (!targetMap.has(date)) targetMap.set(date, []);
      targetMap.get(date).push(raw.price);
    }
  };
  for (const row of levelRows) {
    const date = row.plan_date;
    const published = row.pub_date;
    const price = Number(row.price);
    if (!date || !Number.isFinite(price)) continue;
    if (isIsoDate(published) && isIsoDate(date) && published > date) {
      skippedFutureManciniRows += 1;
      continue;
    }
    const klass = classifyLevel(row);
    pushRaw(date, {
      price,
      class: klass,
      priority: priorityForClass(klass),
      source: 'mancini',
      role: row.primary_role || '',
      tags: row.tags || '',
    });
  }
  for (const row of satyRows) {
    if (String(row.valid).toLowerCase() !== 'true') continue;
    const date = row.target_date;
    const price = Number(row.price);
    if (!date || !Number.isFinite(price)) continue;
    pushRaw(date, {
      price,
      class: 'SCALP_VALID',
      priority: 1,
      source: 'saty',
      role: row.label || 'saty',
      tags: 'saty',
    });
  }
  for (const levels of targetMap.values()) levels.sort((a, b) => a - b);
  for (const levels of allMap.values()) levels.sort((a, b) => a - b);
  return { rawByDate, targetMap, allMap, levelAudit: { skipped_future_mancini_rows: skippedFutureManciniRows } };
}

function resolveClusterClass(cluster) {
  if (cluster.members.some((member) => member.class === 'MANCINI_RECLAIM')) return 'MANCINI_RECLAIM';
  if (cluster.members.every((member) => member.class === 'TARGET_ONLY')) return 'TARGET_ONLY';
  if (cluster.members.some((member) => member.class === 'MANUAL_CAUTION')) return 'MANUAL_CAUTION';
  const hasSaty = cluster.members.some((member) => member.source === 'saty');
  const hasMancini = cluster.members.some((member) => member.source === 'mancini' && member.class !== 'TARGET_ONLY');
  if (cluster.members.some((member) => member.class === 'SCALP_MAJOR') || (hasSaty && hasMancini)) return 'SCALP_MAJOR';
  return 'SCALP_VALID';
}

function clusterLevels(rawLevels) {
  const clusters = [];
  for (const raw of rawLevels.slice().sort((a, b) => a.price - b.price)) {
    const last = clusters.at(-1);
    if (last) {
      const lowEdge = Math.min(last.min, raw.price);
      const highEdge = Math.max(last.max, raw.price);
      const withinAnchor = Math.abs(raw.price - last.anchor) <= CLUSTER_TOLERANCE_POINTS;
      const withinWidth = highEdge - lowEdge <= CLUSTER_TOLERANCE_POINTS;
      if (withinAnchor && withinWidth) {
        last.members.push(raw);
        last.min = lowEdge;
        last.max = highEdge;
        last.anchor = roundTick(last.members.reduce((sum, member) => sum + member.price, 0) / last.members.length);
        last.class = resolveClusterClass(last);
        last.priority = priorityForClass(last.class);
        continue;
      }
    }
    clusters.push({
      anchor: roundTick(raw.price),
      min: raw.price,
      max: raw.price,
      members: [raw],
      class: raw.class,
      priority: priorityForClass(raw.class),
    });
  }
  return clusters.map((cluster) => {
    cluster.class = resolveClusterClass(cluster);
    cluster.priority = priorityForClass(cluster.class);
    return cluster;
  });
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

function targetRoomOk(levels, level, entry) {
  const next = nextAbove(levels, level);
  const targetSpace = next == null ? TP1_POINTS * 2 : next - level;
  const entryTargetSpace = next == null ? TP1_POINTS * 2 : next - entry;
  const tp1RoomOk = next == null || next - entry >= TP1_POINTS;
  return (targetSpace >= MIN_TARGET_SPACE_POINTS && entryTargetSpace >= MIN_TARGET_SPACE_POINTS) || tp1RoomOk;
}

function recentTap(bars, index, level) {
  const start = Math.max(0, index - LEVEL_TAP_LOOKBACK_MINUTES);
  for (let i = start; i <= index; i += 1) {
    if (bars[i].low <= level + LEVEL_TAP_TOLERANCE_POINTS && bars[i].high >= level - TICK) return true;
  }
  return false;
}

function antiStuffOk(bar, level) {
  const range = Math.max(bar.high - bar.low, TICK);
  const closeLocation = (bar.close - bar.low) / range;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  return bar.close >= level + CLOSE_ABOVE
    && closeLocation >= MIN_RECLAIM_CLOSE_LOCATION
    && upperWick <= MAX_RECLAIM_UPPER_WICK_POINTS;
}

function generateDynamicSignals({ sessionDate, bars, rawByDate, targetMap, allLevelMap }) {
  const rawLevels = rawByDate.get(sessionDate) || [];
  const clusters = clusterLevels(rawLevels).filter((cluster) => cluster.class !== 'TARGET_ONLY' && cluster.class !== 'MANUAL_CAUTION');
  const states = new Map(clusters.map((cluster) => [cluster.anchor, {
    lastFlushIndex: -1,
    closesAbove: 0,
    lastSignalIndex: -Infinity,
  }]));
  const candidates = [];
  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];
    const prev = bars[i - 1];
    if (bar.et_date === sessionDate && minuteOfDay(bar.et_time) >= 16 * 60) break;
    const minuteCandidates = [];
    for (const cluster of clusters) {
      const level = cluster.anchor;
      if (Math.abs(level - bar.close) > LIVE_LEVEL_WINDOW_POINTS) continue;
      const state = states.get(level);
      const flushEvent = bar.low <= level - TICK && prev.close >= level;
      if (flushEvent) {
        state.lastFlushIndex = i;
        state.closesAbove = 0;
      }
      if (state.lastFlushIndex < 0 || i - state.lastFlushIndex > MAX_RECLAIM_LOOKBACK_MINUTES) {
        if (bar.close < level) state.closesAbove = 0;
        continue;
      }
      if (bar.close >= level + CLOSE_ABOVE) {
        state.closesAbove += 1;
      } else if (bar.close <= level) {
        state.closesAbove = 0;
      }
      const requiredAcceptance = cluster.class === 'MANCINI_RECLAIM' ? 3 : 2;
      if (state.closesAbove < requiredAcceptance) continue;
      if (!recentTap(bars, i, level)) continue;
      if (!antiStuffOk(bar, level)) continue;
      if (i - state.lastSignalIndex <= DEDUPE_MINUTES) continue;
      const entry = level + TICK;
      if (!targetRoomOk(allLevelMap.get(sessionDate), level, entry)) continue;
      const tp2 = targetForTrade({ klass: cluster.class, planDate: sessionDate, entry }, targetMap, allLevelMap);
      minuteCandidates.push({
        plan_date: sessionDate,
        level,
        class: cluster.class,
        priority: cluster.priority,
        signal_index: i,
        signal_et: bar.et_time,
        watch_start_et: bars[state.lastFlushIndex]?.et_time || '',
        entry,
        stop: level - DEFAULT_STOP_POINTS,
        tp1: entry + TP1_POINTS,
        tp2,
        source_count: cluster.members.length,
      });
      state.lastSignalIndex = i;
      state.lastFlushIndex = -1;
      state.closesAbove = 0;
    }
    if (minuteCandidates.length) {
      minuteCandidates.sort((a, b) => b.priority - a.priority || b.level - a.level);
      candidates.push(minuteCandidates[0]);
    }
  }
  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates) {
  const kept = [];
  for (const candidate of candidates.sort((a, b) => a.signal_et.localeCompare(b.signal_et) || b.priority - a.priority || b.level - a.level)) {
    const duplicate = kept.some((row) => (
      row.plan_date === candidate.plan_date
      && Math.abs(row.level - candidate.level) <= DEDUPE_POINTS
      && minutesBetween(row.signal_et, candidate.signal_et) <= DEDUPE_MINUTES
    ));
    if (!duplicate) kept.push(candidate);
  }
  return kept;
}

function findFirstTouch(bars, startIndex, price, endIndex = bars.length - 1) {
  for (let i = Math.max(0, startIndex); i < bars.length && i <= endIndex; i += 1) {
    if (bars[i].low <= price && bars[i].high >= price) return i;
  }
  return -1;
}

function failedCooldownBlocks(bars, candidate, lastFailed) {
  if (!lastFailed || lastFailed.index == null || lastFailed.level == null) return false;
  if (candidate.signal_index - lastFailed.index > FAILED_REENTRY_COOLDOWN_MINUTES) return false;
  if (Math.abs(candidate.level - lastFailed.level) > FAILED_REENTRY_LEVEL_TOLERANCE_POINTS) return false;
  const start = Math.max(0, lastFailed.index);
  for (let i = start; i <= candidate.signal_index && i < bars.length; i += 1) {
    const bar = bars[i];
    if (bar.low <= candidate.level - FAILED_REENTRY_RESET_POINTS && bar.close >= candidate.level + CLOSE_ABOVE) {
      return false;
    }
  }
  return true;
}

function isPreTpStop(status) {
  return String(status || '').startsWith('stopped_pre_tp1');
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
  const runnerPoints = tp1Hit ? last.close - entry : (last.close - entry) * 2;
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

function replayDynamicSession(sessionDate, bars, candidates) {
  const results = [];
  let busyUntilIndex = -1;
  let lastFailed = null;
  for (const candidate of candidates) {
    if (candidate.signal_index <= busyUntilIndex) {
      results.push({
        ...candidate,
        mode: 'dynamic_vA_level_grid',
        status: 'suppressed_while_open',
        order_armed_et: '',
        order_expire_et: '',
        fill_et: '',
        exit_et: '',
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    if (failedCooldownBlocks(bars, candidate, lastFailed)) {
      results.push({
        ...candidate,
        mode: 'dynamic_vA_level_grid',
        status: 'suppressed_failed_cooldown',
        order_armed_et: '',
        order_expire_et: '',
        fill_et: '',
        exit_et: '',
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    const orderArmedIndex = candidate.signal_index + 1;
    const orderExpireIndex = Math.min(bars.length - 1, orderArmedIndex + RETEST_LIMIT_EXPIRY_MINUTES - 1);
    const fillIndex = findFirstTouch(bars, orderArmedIndex, candidate.entry, orderExpireIndex);
    if (fillIndex < 0) {
      busyUntilIndex = Math.max(busyUntilIndex, orderExpireIndex);
      results.push({
        ...candidate,
        mode: 'dynamic_vA_level_grid',
        status: 'no_fill',
        order_armed_et: bars[orderArmedIndex]?.et_time || '',
        order_expire_et: bars[orderExpireIndex]?.et_time || '',
        fill_et: '',
        exit_et: '',
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    const pathResult = simulatePath(bars, fillIndex, candidate.entry, candidate.stop, candidate.tp1, candidate.tp2);
    const grossPoints = Number(pathResult.gross_points || 0);
    const contracts = Number(pathResult.contracts || 0);
    const excursion = maxExcursion(bars, fillIndex, candidate.entry, pathResult.exit_index ?? fillIndex);
    const result = {
      ...candidate,
      mode: 'dynamic_vA_level_grid',
      status: pathResult.status,
      order_armed_et: bars[orderArmedIndex]?.et_time || '',
      order_expire_et: bars[orderExpireIndex]?.et_time || '',
      fill_et: bars[fillIndex]?.et_time || '',
      exit_et: pathResult.exit_et || '',
      entry: round2(candidate.entry),
      stop: round2(candidate.stop),
      tp1: round2(candidate.tp1),
      tp2: round2(candidate.tp2),
      gross_points: round2(grossPoints),
      net_dollars: round2(grossPoints * POINT_VALUE - contracts * COST_PER_CONTRACT),
      contracts,
      mfe: excursion.mfe,
      mae: excursion.mae,
      ambiguous_1m: pathResult.ambiguous || false,
    };
    results.push(result);
    if (isPreTpStop(result.status)) {
      lastFailed = { index: result.exit_index ?? fillIndex, level: candidate.level };
    }
    busyUntilIndex = Math.max(busyUntilIndex, pathResult.exit_index ?? fillIndex);
  }
  return results.map((row) => ({ ...row, plan_date: sessionDate }));
}

function targetForProfile(candidate, profile, targetMap, allLevelMap) {
  if (profile.tp2Mode === 'fixed') return candidate.entry + profile.tp2Points;
  if (profile.tp2Mode === 'mancini_target') {
    const target = nextAbove(targetMap.get(candidate.plan_date), candidate.entry);
    return target && target > candidate.entry + profile.tp1Points ? target : candidate.entry + profile.tp2Points;
  }
  const next = nextAbove(allLevelMap.get(candidate.plan_date), candidate.entry);
  return next && next > candidate.entry + profile.tp1Points ? next : candidate.entry + profile.tp2Points;
}

function profileForClass(profileSet, klass) {
  return profileSet.classes[klass] || profileSet.classes.DEFAULT;
}

function signalTimeBucket(candidate) {
  const signalDate = String(candidate.signal_et || '').slice(0, 10);
  const minute = minuteOfDay(candidate.signal_et || '');
  if (signalDate && candidate.plan_date && signalDate < candidate.plan_date) return 'overnight_prior_evening';
  if (minute < 0) return 'missing_time';
  if (minute < 9 * 60 + 30) return 'pre_0930';
  if (minute < 11 * 60) return 'open_0930_1100';
  if (minute < 13 * 60) return 'mid_1100_1300';
  return 'afternoon_1300_plus';
}

function profileFilterAllows(profileSet, candidate) {
  const filter = profileSet.filter || {};
  const bucket = signalTimeBucket(candidate);
  if (filter.includeTimeBuckets && !filter.includeTimeBuckets.includes(bucket)) return false;
  if (filter.excludeTimeBuckets && filter.excludeTimeBuckets.includes(bucket)) return false;
  if (filter.minSourceCount != null && Number(candidate.source_count || 0) < filter.minSourceCount) return false;
  if (filter.maxSourceCount != null && Number(candidate.source_count || 0) > filter.maxSourceCount) return false;
  return true;
}

function simulatePathWithProfile(bars, fillIndex, candidate, profile, targetMap, allLevelMap) {
  if (fillIndex < 0 || fillIndex >= bars.length) return { status: 'no_fill' };
  const entry = candidate.entry;
  const stop = candidate.level - profile.stopPoints;
  const tp1 = entry + profile.tp1Points;
  const tp2 = targetForProfile(candidate, profile, targetMap, allLevelMap);
  let remaining = profile.contracts;
  let grossPoints = 0;
  let activeStop = stop;
  let tp1Hit = false;
  let exitIndex = fillIndex;
  for (let i = fillIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    exitIndex = i;
    const hitStop = bar.low <= activeStop;
    const hitTp1 = profile.tp1Contracts > 0 && !tp1Hit && bar.high >= tp1;
    const hitTp2 = profile.tp2Contracts > 0 && bar.high >= tp2;
    if (hitStop && (hitTp1 || hitTp2)) {
      return {
        status: 'stopped_mixed_1m',
        gross_points: grossPoints + (activeStop - entry) * remaining,
        contracts: profile.contracts,
        exit_et: bar.et_time,
        exit_index: i,
        stop,
        tp1,
        tp2,
        ambiguous: true,
      };
    }
    if (hitStop) {
      return {
        status: tp1Hit ? 'tp1_be' : 'stopped_pre_tp1',
        gross_points: grossPoints + (activeStop - entry) * remaining,
        contracts: profile.contracts,
        exit_et: bar.et_time,
        exit_index: i,
        stop,
        tp1,
        tp2,
        ambiguous: false,
      };
    }
    if (hitTp1) {
      const exited = Math.min(profile.tp1Contracts, remaining);
      grossPoints += (tp1 - entry) * exited;
      remaining -= exited;
      tp1Hit = true;
      if (profile.moveStopToBEAfterTP1) activeStop = entry;
      if (remaining <= 0) {
        return {
          status: 'tp1_all',
          gross_points: grossPoints,
          contracts: profile.contracts,
          exit_et: bar.et_time,
          exit_index: i,
          stop,
          tp1,
          tp2,
          ambiguous: false,
        };
      }
    }
    if (hitTp2) {
      grossPoints += (tp2 - entry) * remaining;
      return {
        status: tp1Hit ? 'tp1_tp2' : 'tp2_all',
        gross_points: grossPoints,
        contracts: profile.contracts,
        exit_et: bar.et_time,
        exit_index: i,
        stop,
        tp1,
        tp2,
        ambiguous: false,
      };
    }
  }
  const last = bars[exitIndex];
  grossPoints += (last.close - entry) * remaining;
  return {
    status: tp1Hit ? 'open_after_tp1_marked_eod' : 'open_marked_eod',
    gross_points: grossPoints,
    contracts: profile.contracts,
    exit_et: last.et_time,
    exit_index: exitIndex,
    stop,
    tp1,
    tp2,
    ambiguous: true,
  };
}

function replayDynamicSessionWithProfile(sessionDate, bars, candidates, profileSet, targetMap, allLevelMap) {
  const results = [];
  let busyUntilIndex = -1;
  let lastFailed = null;
  for (const candidate of candidates) {
    if (profileSet.allowedClasses && !profileSet.allowedClasses.includes(candidate.class)) continue;
    if (!profileFilterAllows(profileSet, candidate)) continue;
    const profile = profileForClass(profileSet, candidate.class);
    if (candidate.signal_index <= busyUntilIndex) {
      results.push({
        ...candidate,
        profile: profileSet.name,
        order_profile: profile.name,
        mode: 'dynamic_vA_profile_sweep',
        status: 'suppressed_while_open',
        order_armed_et: '',
        order_expire_et: '',
        fill_et: '',
        exit_et: '',
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    if (failedCooldownBlocks(bars, candidate, lastFailed)) {
      results.push({
        ...candidate,
        profile: profileSet.name,
        order_profile: profile.name,
        mode: 'dynamic_vA_profile_sweep',
        status: 'suppressed_failed_cooldown',
        order_armed_et: '',
        order_expire_et: '',
        fill_et: '',
        exit_et: '',
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    const orderArmedIndex = candidate.signal_index + 1;
    const expiry = Math.max(1, profile.expiryMinutes);
    const orderExpireIndex = Math.min(bars.length - 1, orderArmedIndex + expiry - 1);
    const fillIndex = findFirstTouch(bars, orderArmedIndex, candidate.entry, orderExpireIndex);
    if (fillIndex < 0) {
      busyUntilIndex = Math.max(busyUntilIndex, orderExpireIndex);
      results.push({
        ...candidate,
        profile: profileSet.name,
        order_profile: profile.name,
        mode: 'dynamic_vA_profile_sweep',
        status: 'no_fill',
        order_armed_et: bars[orderArmedIndex]?.et_time || '',
        order_expire_et: bars[orderExpireIndex]?.et_time || '',
        fill_et: '',
        exit_et: '',
        stop: round2(candidate.level - profile.stopPoints),
        tp1: round2(candidate.entry + profile.tp1Points),
        tp2: round2(targetForProfile(candidate, profile, targetMap, allLevelMap)),
        net_dollars: 0,
        gross_points: 0,
        contracts: 0,
        mfe: 0,
        mae: 0,
        ambiguous_1m: false,
      });
      continue;
    }
    const pathResult = simulatePathWithProfile(bars, fillIndex, candidate, profile, targetMap, allLevelMap);
    const grossPoints = Number(pathResult.gross_points || 0);
    const contracts = Number(pathResult.contracts || 0);
    const excursion = maxExcursion(bars, fillIndex, candidate.entry, pathResult.exit_index ?? fillIndex);
    const netDollars = grossPoints * POINT_VALUE - contracts * COST_PER_CONTRACT;
    const result = {
      ...candidate,
      profile: profileSet.name,
      order_profile: profile.name,
      mode: 'dynamic_vA_profile_sweep',
      status: pathResult.status,
      order_armed_et: bars[orderArmedIndex]?.et_time || '',
      order_expire_et: bars[orderExpireIndex]?.et_time || '',
      fill_et: bars[fillIndex]?.et_time || '',
      exit_et: pathResult.exit_et || '',
      entry: round2(candidate.entry),
      stop: round2(pathResult.stop),
      tp1: round2(pathResult.tp1),
      tp2: round2(pathResult.tp2),
      gross_points: round2(grossPoints),
      net_dollars: round2(netDollars),
      contracts,
      mfe: excursion.mfe,
      mae: excursion.mae,
      ambiguous_1m: pathResult.ambiguous || false,
    };
    results.push(result);
    if (isPreTpStop(result.status)) {
      lastFailed = { index: result.exit_index ?? fillIndex, level: candidate.level };
    }
    busyUntilIndex = Math.max(busyUntilIndex, pathResult.exit_index ?? fillIndex);
  }
  return results.map((row) => ({ ...row, plan_date: sessionDate }));
}

function summarize(results, completeSessionCount) {
  const tradable = results.filter((row) => !SUPPRESSED_STATUSES.has(row.status));
  const filled = tradable.filter((row) => row.status !== 'no_fill');
  const winners = filled.filter((row) => Number(row.net_dollars || 0) > 0);
  const byDay = new Map();
  for (const row of filled) {
    const date = row.plan_date;
    if (!byDay.has(date)) byDay.set(date, { net: 0, gross_points: 0, fills: 0, winners: 0, stopped: 0 });
    const day = byDay.get(date);
    day.net += Number(row.net_dollars || 0);
    day.gross_points += Number(row.gross_points || 0);
    day.fills += 1;
    if (Number(row.net_dollars || 0) > 0) day.winners += 1;
    if (String(row.status).startsWith('stopped_pre_tp1')) day.stopped += 1;
  }
  const days = [...byDay.entries()].map(([date, row]) => ({
    date,
    net: round2(row.net),
    gross_points: round2(row.gross_points),
    fills: row.fills,
    winners: row.winners,
    stopped: row.stopped,
  })).sort((a, b) => a.date.localeCompare(b.date));
  const totalNet = filled.reduce((sum, row) => sum + Number(row.net_dollars || 0), 0);
  return {
    signals: results.length,
    tradable: tradable.length,
    filled: filled.length,
    no_fill: tradable.filter((row) => row.status === 'no_fill').length,
    suppressed: results.filter((row) => SUPPRESSED_STATUSES.has(row.status)).length,
    winners: winners.length,
    win_rate: round2((winners.length / (filled.length || 1)) * 100),
    stopped_pre_tp1: filled.filter((row) => String(row.status).startsWith('stopped_pre_tp1')).length,
    gross_points: round2(filled.reduce((sum, row) => sum + Number(row.gross_points || 0), 0)),
    net_dollars: round2(totalNet),
    avg_active_session_net: round2(totalNet / (days.length || 1)),
    avg_complete_session_net: round2(totalNet / (completeSessionCount || 1)),
    sessions_with_fills: days.length,
    sessions_ge_500: days.filter((row) => row.net >= 500).length,
    sessions_ge_1000: days.filter((row) => row.net >= 1000).length,
    sessions_le_neg500: days.filter((row) => row.net <= -500).length,
    avg_mfe: round2(filled.reduce((sum, row) => sum + Number(row.mfe || 0), 0) / (filled.length || 1)),
    avg_mae: round2(filled.reduce((sum, row) => sum + Number(row.mae || 0), 0) / (filled.length || 1)),
    ambiguous_1m: filled.filter((row) => row.ambiguous_1m === true || row.ambiguous_1m === 'true').length,
    by_day: days,
  };
}

function buildProfileSets() {
  const splitScalp = { name: '2ct_split_2pt_runner_stop3_exp10', contracts: 2, tp1Contracts: 1, tp2Contracts: 1, tp1Points: 2, tp2Points: SCALP_FALLBACK_TP2_POINTS, stopPoints: 3, tp2Mode: 'next_cluster', expiryMinutes: 10, moveStopToBEAfterTP1: true };
  const splitSwing = { name: '2ct_split_2pt_swing_target_stop3_exp10', contracts: 2, tp1Contracts: 1, tp2Contracts: 1, tp1Points: 2, tp2Points: SWING_FALLBACK_TP2_POINTS, stopPoints: 3, tp2Mode: 'mancini_target', expiryMinutes: 10, moveStopToBEAfterTP1: true };
  const allTp1Stop3 = { name: '2ct_all_tp1_2pt_stop3_exp10', contracts: 2, tp1Contracts: 2, tp2Contracts: 0, tp1Points: 2, tp2Points: SCALP_FALLBACK_TP2_POINTS, stopPoints: 3, tp2Mode: 'fixed', expiryMinutes: 10, moveStopToBEAfterTP1: false };
  const allTp1Stop25 = { ...allTp1Stop3, name: '2ct_all_tp1_2pt_stop2_5_exp10', stopPoints: 2.5 };
  const allTp1Stop35 = { ...allTp1Stop3, name: '2ct_all_tp1_2pt_stop3_5_exp10', stopPoints: 3.5 };
  const oneTp1Stop3 = { name: '1ct_tp1_2pt_stop3_exp10', contracts: 1, tp1Contracts: 1, tp2Contracts: 0, tp1Points: 2, tp2Points: SCALP_FALLBACK_TP2_POINTS, stopPoints: 3, tp2Mode: 'fixed', expiryMinutes: 10, moveStopToBEAfterTP1: false };
  const allTp15Stop25 = { ...allTp1Stop3, name: '2ct_all_tp1_1_5pt_stop2_5_exp10', tp1Points: 1.5, stopPoints: 2.5 };
  const allTp25Stop3 = { ...allTp1Stop3, name: '2ct_all_tp1_2_5pt_stop3_exp10', tp1Points: 2.5, stopPoints: 3 };
  const swingStop4 = { ...splitSwing, name: '2ct_split_2pt_swing_target_stop4_exp10', stopPoints: 4 };
  const swingStop5 = { ...splitSwing, name: '2ct_split_2pt_swing_target_stop5_exp10', stopPoints: 5 };
  const swingStop4NoBe = { ...swingStop4, name: '2ct_split_2pt_swing_target_stop4_no_be_exp10', moveStopToBEAfterTP1: false };
  const swingStop5NoBe = { ...swingStop5, name: '2ct_split_2pt_swing_target_stop5_no_be_exp10', moveStopToBEAfterTP1: false };
  const swingTp3Stop4 = { ...splitSwing, name: '2ct_split_3pt_swing_target_stop4_exp10', tp1Points: 3, stopPoints: 4 };
  const swingTp3Stop5 = { ...splitSwing, name: '2ct_split_3pt_swing_target_stop5_exp10', tp1Points: 3, stopPoints: 5 };
  const swingOneRunnerStop4 = { name: '1ct_runner_swing_target_stop4_exp10', contracts: 1, tp1Contracts: 0, tp2Contracts: 1, tp1Points: 2, tp2Points: SWING_FALLBACK_TP2_POINTS, stopPoints: 4, tp2Mode: 'mancini_target', expiryMinutes: 10, moveStopToBEAfterTP1: false };
  const swingOneRunnerStop5 = { ...swingOneRunnerStop4, name: '1ct_runner_swing_target_stop5_exp10', stopPoints: 5 };
  const swingAllTp1 = { ...allTp1Stop3, name: '2ct_all_tp1_2pt_swing_stop3_exp10', tp2Mode: 'fixed' };
  return [
    {
      name: 'current_all_split_stop3',
      classes: { DEFAULT: splitScalp, SCALP_VALID: splitScalp, SCALP_MAJOR: splitScalp, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'scalps_all_tp1_swing_split',
      classes: { DEFAULT: allTp1Stop3, SCALP_VALID: allTp1Stop3, SCALP_MAJOR: allTp1Stop3, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'scalps_all_tp1_stop2_5_swing_split',
      classes: { DEFAULT: allTp1Stop25, SCALP_VALID: allTp1Stop25, SCALP_MAJOR: allTp1Stop25, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'scalps_all_tp1_stop3_5_swing_split',
      classes: { DEFAULT: allTp1Stop35, SCALP_VALID: allTp1Stop35, SCALP_MAJOR: allTp1Stop35, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'scalps_1ct_tp1_swing_split',
      classes: { DEFAULT: oneTp1Stop3, SCALP_VALID: oneTp1Stop3, SCALP_MAJOR: oneTp1Stop3, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'all_classes_all_tp1_stop3',
      classes: { DEFAULT: allTp1Stop3, SCALP_VALID: allTp1Stop3, SCALP_MAJOR: allTp1Stop3, MANCINI_RECLAIM: swingAllTp1 },
    },
    {
      name: 'scalps_all_tp1_swing_wide_stop4',
      classes: { DEFAULT: allTp1Stop3, SCALP_VALID: allTp1Stop3, SCALP_MAJOR: allTp1Stop3, MANCINI_RECLAIM: swingStop4 },
    },
    {
      name: 'scalps_1_5pt_tighter_swing_split',
      classes: { DEFAULT: allTp15Stop25, SCALP_VALID: allTp15Stop25, SCALP_MAJOR: allTp15Stop25, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'scalps_2_5pt_swing_split',
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'router_scalp_2_5pt_swing_tp3_stop4',
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingTp3Stop4 },
    },
    {
      name: 'router_scalp_2_5pt_swing_tp3_stop5',
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_tp3_stop5_no_open',
      filter: { excludeTimeBuckets: ['open_0930_1100'] },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_tp3_stop5_max_source2',
      filter: { maxSourceCount: 2 },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_tp3_stop5_no_open_max_source2',
      filter: { excludeTimeBuckets: ['open_0930_1100'], maxSourceCount: 2 },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_stop5',
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingStop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_stop5_no_open',
      filter: { excludeTimeBuckets: ['open_0930_1100'] },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingStop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_stop5_max_source2',
      filter: { maxSourceCount: 2 },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingStop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_stop5_no_open_max_source2',
      filter: { excludeTimeBuckets: ['open_0930_1100'], maxSourceCount: 2 },
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingStop5 },
    },
    {
      name: 'router_scalp_2_5pt_swing_stop5_no_be',
      classes: { DEFAULT: allTp25Stop3, SCALP_VALID: allTp25Stop3, SCALP_MAJOR: allTp25Stop3, MANCINI_RECLAIM: swingStop5NoBe },
    },
    {
      name: 'router_scalp_stop3_5_swing_tp3_stop4',
      classes: { DEFAULT: allTp1Stop35, SCALP_VALID: allTp1Stop35, SCALP_MAJOR: allTp1Stop35, MANCINI_RECLAIM: swingTp3Stop4 },
    },
    {
      name: 'router_scalp_stop3_5_swing_tp3_stop5',
      classes: { DEFAULT: allTp1Stop35, SCALP_VALID: allTp1Stop35, SCALP_MAJOR: allTp1Stop35, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'router_scalp_1_5pt_swing_tp3_stop5',
      classes: { DEFAULT: allTp15Stop25, SCALP_VALID: allTp15Stop25, SCALP_MAJOR: allTp15Stop25, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'futures_scalp_only_all_tp1_stop3_5',
      allowedClasses: ['SCALP_VALID', 'SCALP_MAJOR'],
      classes: { DEFAULT: allTp1Stop35, SCALP_VALID: allTp1Stop35, SCALP_MAJOR: allTp1Stop35 },
    },
    {
      name: 'futures_scalp_only_all_tp1_stop3',
      allowedClasses: ['SCALP_VALID', 'SCALP_MAJOR'],
      classes: { DEFAULT: allTp1Stop3, SCALP_VALID: allTp1Stop3, SCALP_MAJOR: allTp1Stop3 },
    },
    {
      name: 'futures_scalp_valid_only_all_tp1_stop3_5',
      allowedClasses: ['SCALP_VALID'],
      classes: { DEFAULT: allTp1Stop35, SCALP_VALID: allTp1Stop35 },
    },
    {
      name: 'futures_scalp_major_only_all_tp1_stop3_5',
      allowedClasses: ['SCALP_MAJOR'],
      classes: { DEFAULT: allTp1Stop35, SCALP_MAJOR: allTp1Stop35 },
    },
    {
      name: 'swing_mancini_only_split_stop3',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: splitSwing, MANCINI_RECLAIM: splitSwing },
    },
    {
      name: 'swing_mancini_only_all_tp1_stop3',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingAllTp1, MANCINI_RECLAIM: swingAllTp1 },
    },
    {
      name: 'swing_mancini_only_split_stop4',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingStop4, MANCINI_RECLAIM: swingStop4 },
    },
    {
      name: 'swing_mancini_only_split_stop5',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingStop5, MANCINI_RECLAIM: swingStop5 },
    },
    {
      name: 'swing_mancini_only_split_stop4_no_be',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingStop4NoBe, MANCINI_RECLAIM: swingStop4NoBe },
    },
    {
      name: 'swing_mancini_only_split_stop5_no_be',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingStop5NoBe, MANCINI_RECLAIM: swingStop5NoBe },
    },
    {
      name: 'swing_mancini_only_split_tp3_stop4',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingTp3Stop4, MANCINI_RECLAIM: swingTp3Stop4 },
    },
    {
      name: 'swing_mancini_only_split_tp3_stop5',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingTp3Stop5, MANCINI_RECLAIM: swingTp3Stop5 },
    },
    {
      name: 'swing_mancini_only_1ct_runner_stop4',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingOneRunnerStop4, MANCINI_RECLAIM: swingOneRunnerStop4 },
    },
    {
      name: 'swing_mancini_only_1ct_runner_stop5',
      allowedClasses: ['MANCINI_RECLAIM'],
      classes: { DEFAULT: swingOneRunnerStop5, MANCINI_RECLAIM: swingOneRunnerStop5 },
    },
  ];
}

function summarizeProfileSets(profileResults, completeSessionCount) {
  return profileResults.map(({ profileSet, results }) => {
    const summary = summarize(results, completeSessionCount);
    return {
      profile: profileSet.name,
      signals: summary.signals,
      filled: summary.filled,
      no_fill: summary.no_fill,
      suppressed: summary.suppressed,
      win_rate: summary.win_rate,
      stopped_pre_tp1: summary.stopped_pre_tp1,
      gross_points: summary.gross_points,
      net_dollars: summary.net_dollars,
      avg_active_session_net: summary.avg_active_session_net,
      avg_complete_session_net: summary.avg_complete_session_net,
      sessions_with_fills: summary.sessions_with_fills,
      sessions_ge_500: summary.sessions_ge_500,
      sessions_ge_1000: summary.sessions_ge_1000,
      sessions_le_neg500: summary.sessions_le_neg500,
      avg_mfe: summary.avg_mfe,
      avg_mae: summary.avg_mae,
    };
  }).sort((a, b) => b.net_dollars - a.net_dollars);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function maxDrawdownFromDays(days) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const day of days) {
    equity += Number(day.net || 0);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return round2(maxDrawdown);
}

function profileDayRows(profileName, results) {
  const byDay = new Map();
  for (const row of results.filter((item) => item.status !== 'no_fill' && !SUPPRESSED_STATUSES.has(item.status))) {
    const date = row.plan_date;
    if (!byDay.has(date)) byDay.set(date, {
      profile: profileName,
      date,
      net: 0,
      gross_points: 0,
      fills: 0,
      winners: 0,
      losers: 0,
      stops: 0,
    });
    const day = byDay.get(date);
    const net = Number(row.net_dollars || 0);
    day.net += net;
    day.gross_points += Number(row.gross_points || 0);
    day.fills += 1;
    if (net > 0) day.winners += 1;
    else day.losers += 1;
    if (String(row.status).startsWith('stopped')) day.stops += 1;
  }
  return [...byDay.values()]
    .map((row) => ({
      ...row,
      net: round2(row.net),
      gross_points: round2(row.gross_points),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function thresholdRowsForProfiles(profileResults, completeSessionCount) {
  const thresholds = [100, 200, 300, 400, 500, 1000];
  return profileResults.map(({ profileSet, results }) => {
    const days = profileDayRows(profileSet.name, results);
    const nets = days.map((row) => row.net);
    const totalNet = round2(nets.reduce((sum, value) => sum + value, 0));
    const positive = days.filter((row) => row.net > 0).length;
    const negative = days.filter((row) => row.net < 0).length;
    const topNets = nets.slice().sort((a, b) => b - a);
    const top1Contribution = totalNet > 0 && topNets.length ? round2((topNets[0] / totalNet) * 100) : 0;
    const top3Contribution = totalNet > 0 ? round2((topNets.slice(0, 3).reduce((sum, value) => sum + value, 0) / totalNet) * 100) : 0;
    const row = {
      profile: profileSet.name,
      active_sessions: days.length,
      inactive_sessions: completeSessionCount - days.length,
      total_net: totalNet,
      avg_all_sessions: round2(totalNet / (completeSessionCount || 1)),
      avg_active_sessions: round2(totalNet / (days.length || 1)),
      median_active_session: round2(median(nets)),
      best_session: round2(Math.max(...nets, 0)),
      worst_session: round2(Math.min(...nets, 0)),
      positive_active_sessions: positive,
      negative_active_sessions: negative,
      max_drawdown_active_order: maxDrawdownFromDays(days),
      top1_contribution_pct: top1Contribution,
      top3_contribution_pct: top3Contribution,
    };
    for (const threshold of thresholds) {
      const count = days.filter((day) => day.net >= threshold).length;
      row[`ge_${threshold}_count`] = count;
      row[`ge_${threshold}_active_pct`] = round2((count / (days.length || 1)) * 100);
      row[`ge_${threshold}_all_pct`] = round2((count / (completeSessionCount || 1)) * 100);
    }
    return row;
  }).sort((a, b) => b.avg_all_sessions - a.avg_all_sessions);
}

function compareProfilesByDay(profileResults, leftName, rightName) {
  const left = profileResults.find((row) => row.profileSet.name === leftName);
  const right = profileResults.find((row) => row.profileSet.name === rightName);
  if (!left || !right) return [];
  const leftDays = new Map(profileDayRows(leftName, left.results).map((row) => [row.date, row]));
  const rightDays = new Map(profileDayRows(rightName, right.results).map((row) => [row.date, row]));
  const dates = [...new Set([...leftDays.keys(), ...rightDays.keys()])].sort();
  return dates.map((date) => {
    const leftDay = leftDays.get(date);
    const rightDay = rightDays.get(date);
    const leftNet = Number(leftDay?.net || 0);
    const rightNet = Number(rightDay?.net || 0);
    return {
      date,
      left_profile: leftName,
      left_net: round2(leftNet),
      right_profile: rightName,
      right_net: round2(rightNet),
      right_minus_left: round2(rightNet - leftNet),
      left_fills: leftDay?.fills || 0,
      right_fills: rightDay?.fills || 0,
    };
  });
}

function summarizeByClass(results) {
  const classes = [...new Set(results.map((row) => row.class))].sort();
  return Object.fromEntries(classes.map((klass) => {
    const rows = results.filter((row) => row.class === klass);
    const tradable = rows.filter((row) => !SUPPRESSED_STATUSES.has(row.status));
    const filled = tradable.filter((row) => row.status !== 'no_fill');
    const winners = filled.filter((row) => Number(row.net_dollars || 0) > 0);
    return [klass, {
      signals: rows.length,
      filled: filled.length,
      no_fill: tradable.filter((row) => row.status === 'no_fill').length,
      suppressed: rows.filter((row) => SUPPRESSED_STATUSES.has(row.status)).length,
      winners: winners.length,
      win_rate: round2((winners.length / (filled.length || 1)) * 100),
      gross_points: round2(filled.reduce((sum, row) => sum + Number(row.gross_points || 0), 0)),
      net_dollars: round2(filled.reduce((sum, row) => sum + Number(row.net_dollars || 0), 0)),
      avg_mfe: round2(filled.reduce((sum, row) => sum + Number(row.mfe || 0), 0) / (filled.length || 1)),
      avg_mae: round2(filled.reduce((sum, row) => sum + Number(row.mae || 0), 0) / (filled.length || 1)),
    }];
  }));
}

function writeReport({ metadata, summary, byClass, topDays, bottomDays, mayRows, profileSummary, thresholdRows, currentVsBestRows }) {
  const lines = [];
  lines.push('# Luke vA Dynamic Level Grid Backtest');
  lines.push('');
  lines.push(`Generated: ${metadata.generated_at}`);
  lines.push('');
  lines.push('## Model');
  lines.push('');
  lines.push('- This repairs the earlier vA replay mismatch: it scans the full daily Mancini + Saty level grid minute by minute instead of only replaying pre-parsed Mancini entry events.');
  lines.push('- Signal generation is no-lookahead: flush, reclaim, acceptance, anti-stuff, and pending retest decisions use only bars available through the signal minute.');
  lines.push('- Execution is vA confirmed retest-limit: LONG after acceptance, then a limit at level + 0.25 for 10 minutes, one global pending/open trade at a time.');
  lines.push('- Mixed 1m stop/target bars are scored conservatively as stop first and flagged ambiguous.');
  lines.push('- This is still not tick data and still not TradingView realtime alert proof.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Signals | Filled | No Fill | Suppressed | Win Rate | Gross Pts | Net $ | Avg Active Session | Avg All Complete Sessions | >=$500 Sessions | >=$1000 Sessions | <=-$500 Sessions |');
  lines.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  lines.push(`| ${summary.signals} | ${summary.filled} | ${summary.no_fill} | ${summary.suppressed} | ${summary.win_rate}% | ${summary.gross_points} | ${summary.net_dollars} | ${summary.avg_active_session_net} | ${summary.avg_complete_session_net} | ${summary.sessions_ge_500} | ${summary.sessions_ge_1000} | ${summary.sessions_le_neg500} |`);
  lines.push('');
  lines.push('## By Class');
  lines.push('');
  lines.push('| Class | Signals | Filled | No Fill | Suppressed | Win Rate | Gross Pts | Net $ | Avg MFE | Avg MAE |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [klass, row] of Object.entries(byClass)) {
    lines.push(`| ${klass} | ${row.signals} | ${row.filled} | ${row.no_fill} | ${row.suppressed} | ${row.win_rate}% | ${row.gross_points} | ${row.net_dollars} | ${row.avg_mfe} | ${row.avg_mae} |`);
  }
  lines.push('');
  lines.push('## Order Profile Sweep');
  lines.push('');
  lines.push('| Profile | Filled | Win Rate | Gross Pts | Net $ | Avg Active Session | >=$500 Sessions | >=$1000 Sessions | <=-$500 Sessions |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of profileSummary) {
    lines.push(`| ${row.profile} | ${row.filled} | ${row.win_rate}% | ${row.gross_points} | ${row.net_dollars} | ${row.avg_active_session_net} | ${row.sessions_ge_500} | ${row.sessions_ge_1000} | ${row.sessions_le_neg500} |`);
  }
  lines.push('');
  lines.push('## Daily Target Bars');
  lines.push('');
  lines.push('| Profile | Avg All | Avg Active | Median Active | Worst | >=$100 | >=$200 | >=$300 | >=$400 | >=$500 | >=$1000 | Max DD | Top3 % |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of thresholdRows) {
    lines.push(`| ${row.profile} | ${row.avg_all_sessions} | ${row.avg_active_sessions} | ${row.median_active_session} | ${row.worst_session} | ${row.ge_100_count}/${metadata.complete_sessions} | ${row.ge_200_count}/${metadata.complete_sessions} | ${row.ge_300_count}/${metadata.complete_sessions} | ${row.ge_400_count}/${metadata.complete_sessions} | ${row.ge_500_count}/${metadata.complete_sessions} | ${row.ge_1000_count}/${metadata.complete_sessions} | ${row.max_drawdown_active_order} | ${row.top3_contribution_pct}% |`);
  }
  lines.push('');
  lines.push('## Current Split vs Best Scalp Profile');
  lines.push('');
  lines.push('| Date | Current Split Net | Best Profile Net | Best Minus Current | Current Fills | Best Fills |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of currentVsBestRows) {
    lines.push(`| ${row.date} | ${row.left_net} | ${row.right_net} | ${row.right_minus_left} | ${row.left_fills} | ${row.right_fills} |`);
  }
  lines.push('');
  lines.push('## Best Sessions');
  lines.push('');
  lines.push('| Date | Net $ | Gross Pts | Fills | Winners | Stops |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of topDays) lines.push(`| ${row.date} | ${row.net} | ${row.gross_points} | ${row.fills} | ${row.winners} | ${row.stopped} |`);
  lines.push('');
  lines.push('## Worst Sessions');
  lines.push('');
  lines.push('| Date | Net $ | Gross Pts | Fills | Winners | Stops |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of bottomDays) lines.push(`| ${row.date} | ${row.net} | ${row.gross_points} | ${row.fills} | ${row.winners} | ${row.stopped} |`);
  lines.push('');
  lines.push('## May Sample Rows');
  lines.push('');
  lines.push('| Date | Class | Status | Signal ET | Armed ET | Fill ET | Exit ET | Level | Entry | TP2 | Net $ |');
  lines.push('|---|---|---|---|---|---|---|---:|---:|---:|---:|');
  for (const row of mayRows.slice(0, 40)) {
    lines.push(`| ${row.plan_date} | ${row.class} | ${row.status} | ${row.signal_et} | ${row.order_armed_et || ''} | ${row.fill_et || ''} | ${row.exit_et || ''} | ${row.level} | ${row.entry || ''} | ${row.tp2 || ''} | ${row.net_dollars || 0} |`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  ensureDir(OUT_DIR);
  const levelRows = readCsv(path.join(PROTOCOL_DIR, 'level-protocol.csv'));
  const satyRows = readCsv(path.join(PROTOCOL_DIR, 'saty-levels.csv'));
  const { files, bars } = loadMergedEsBars();
  const barsBySession = groupBarsByEtSession(bars);
  const completeSessions = completeSessionDates(barsBySession);
  const { rawByDate, targetMap, allMap, levelAudit } = buildRawLevelMaps(levelRows, satyRows);
  const allResults = [];
  const candidatesBySession = new Map();
  for (const sessionDate of [...completeSessions].sort()) {
    const sessionBars = barsBySession.get(sessionDate) || [];
    const candidates = generateDynamicSignals({
      sessionDate,
      bars: sessionBars,
      rawByDate,
      targetMap,
      allLevelMap: allMap,
    });
    candidatesBySession.set(sessionDate, candidates);
    allResults.push(...replayDynamicSession(sessionDate, sessionBars, candidates));
  }
  const profileResults = buildProfileSets().map((profileSet) => {
    const results = [];
    for (const sessionDate of [...completeSessions].sort()) {
      const sessionBars = barsBySession.get(sessionDate) || [];
      const candidates = candidatesBySession.get(sessionDate) || [];
      results.push(...replayDynamicSessionWithProfile(sessionDate, sessionBars, candidates, profileSet, targetMap, allMap));
    }
    return { profileSet, results };
  });
  const profileSummary = summarizeProfileSets(profileResults, completeSessions.size);
  const thresholdRows = thresholdRowsForProfiles(profileResults, completeSessions.size);
  const bestProfile = profileResults.find((row) => row.profileSet.name === profileSummary[0]?.profile);
  const bestProfileName = profileSummary[0]?.profile || '';
  const currentVsBestRows = compareProfilesByDay(profileResults, 'current_all_split_stop3', bestProfileName);
  const allProfileDayRows = profileResults.flatMap(({ profileSet, results }) => profileDayRows(profileSet.name, results));
  const allProfileTradeRows = profileResults.flatMap(({ profileSet, results }) => (
    results.map((row) => ({ ...row, profile: row.profile || profileSet.name }))
  ));
  const summary = summarize(allResults, completeSessions.size);
  const byClass = summarizeByClass(allResults);
  const topDays = summary.by_day.slice().sort((a, b) => b.net - a.net).slice(0, 12);
  const bottomDays = summary.by_day.slice().sort((a, b) => a.net - b.net).slice(0, 12);
  const mayRows = allResults.filter((row) => row.plan_date >= '2026-05-01').sort((a, b) => (
    a.plan_date.localeCompare(b.plan_date) || String(a.signal_et).localeCompare(String(b.signal_et))
  ));
  const metadata = {
    generated_at: new Date().toISOString(),
    bars: bars.length,
    first_et: bars[0]?.et_time,
    last_et: bars.at(-1)?.et_time,
    complete_sessions: completeSessions.size,
    files: files.map((file) => path.relative(ROOT, file).replace(/\\/g, '/')),
    protocol_dir: path.relative(ROOT, PROTOCOL_DIR).replace(/\\/g, '/'),
    level_audit: levelAudit,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
    metadata,
    summary,
    by_class: byClass,
    profile_summary: profileSummary,
    threshold_rows: thresholdRows,
    top_days: topDays,
    bottom_days: bottomDays,
  }, null, 2), 'utf8');
  writeCsv(path.join(OUT_DIR, 'trades.csv'), allResults);
  writeCsv(path.join(OUT_DIR, 'profile-sweep.csv'), profileSummary);
  writeCsv(path.join(OUT_DIR, 'profile-thresholds.csv'), thresholdRows);
  writeCsv(path.join(OUT_DIR, 'profile-day-results.csv'), allProfileDayRows);
  writeCsv(path.join(OUT_DIR, 'profile-trades.csv'), allProfileTradeRows);
  writeCsv(path.join(OUT_DIR, 'current-vs-best-profile-by-day.csv'), currentVsBestRows);
  if (bestProfile) writeCsv(path.join(OUT_DIR, 'best-profile-trades.csv'), bestProfile.results);
  writeReport({ metadata, summary, byClass, topDays, bottomDays, mayRows, profileSummary, thresholdRows, currentVsBestRows });
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
    metadata,
    summary,
    by_class: byClass,
    profile_summary: profileSummary,
    threshold_rows: thresholdRows,
    top_days: topDays,
    bottom_days: bottomDays,
  }, null, 2));
}

main();
