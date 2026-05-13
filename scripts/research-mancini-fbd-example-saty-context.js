#!/usr/bin/env node
'use strict';

// Per-Mancini-example SATY context overlays.
// Research/historical/shadow only. SATY proximity is context, not source proof.

const fs = require('fs');
const path = require('path');
const {
  buildFuturesSessionBars,
  deriveLevelsByDate,
  _internal,
} = require('../lib/backtest-data/saty-historical');
const { _internal: historicalDataInternal } = require('../lib/historical-data');

const ROOT = path.join(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');
const QUICK_ROWS = path.join(ROOT, 'artifacts', 'research', 'hermes-mancini-event-packets', 'quick_reclaim_acceptance_rows.csv');
const GALLERY_MANIFEST = path.join(ROOT, 'artifacts', 'research', 'mancini-real-packet-gallery', 'manifest.json');
const SELECTED_TRAINING_ROWS = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-hermes-input', 'selected_training_rows.jsonl');
const SUPPLEMENTAL_BAR_DIRS = [
  path.join(ROOT, 'data', 'historical'),
  path.join(ROOT, 'data', 'backtest'),
  path.join(ROOT, 'data', 'research', 'mancini'),
];

const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-example-saty-context');
const CHART_DIR = path.join(OUT_DIR, 'charts');
const OUT_ROWS = path.join(OUT_DIR, 'example_saty_rows.csv');
const OUT_CONTEXT = path.join(OUT_DIR, 'example_saty_context.json');
const OUT_MANIFEST = path.join(OUT_DIR, 'chart_manifest.json');
const OUT_REPORT = path.join(OUT_DIR, 'example_saty_report.md');
const OUT_VALIDATION_OUTCOMES = path.join(OUT_DIR, 'example_saty_validation_outcomes.csv');

const LEVEL_KEYS = [
  'atr_minus_1',
  'ext_minus_4',
  'ext_minus_3',
  'ext_minus_2',
  'ext_minus_1',
  'put_trigger',
  'prev_close',
  'call_trigger',
  'ext_plus_1',
  'ext_plus_2',
  'ext_plus_3',
  'ext_plus_4',
  'atr_plus_1',
];

const DISPLAY_LEVEL_PRIORITY = new Set([
  'prev_close',
  'put_trigger',
  'call_trigger',
  'ext_minus_1',
  'ext_plus_1',
  'atr_minus_1',
  'atr_plus_1',
]);

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetGeneratedDir(dir) {
  const resolved = path.resolve(dir);
  const allowedRoot = path.resolve(OUT_DIR);
  if (!resolved.startsWith(`${allowedRoot}${path.sep}`) && resolved !== allowedRoot) {
    throw new Error(`Refusing to clean outside Mancini SATY example output dir: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function asNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function round2(value) {
  return round(value, 2);
}

function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function resolveRootPath(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return '';
  const normalized = String(relativeOrAbsolute).replace(/\//g, path.sep).replace(/\\/g, path.sep);
  return path.isAbsolute(normalized) ? normalized : path.join(ROOT, normalized);
}

function parseTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function timestampWithSource(source, value) {
  return value && parseTime(value) !== null ? { source, value } : null;
}

function proofTimestamp(quick, manifest) {
  const marketEvents = [
    timestampWithSource('quick.trap_candle_timestamp_et', quick.trap_candle_timestamp_et),
    timestampWithSource('manifest.trap_candle_timestamp_et', manifest?.trap_candle_timestamp_et),
    timestampWithSource('quick.first_reclaim_close_timestamp_et', quick.first_reclaim_close_timestamp_et),
    timestampWithSource('manifest.first_reclaim_close_timestamp_et', manifest?.first_reclaim_close_timestamp_et),
  ].filter(Boolean).sort((a, b) => parseTime(a.value) - parseTime(b.value));
  if (marketEvents.length) return marketEvents[0];
  return [
    timestampWithSource('quick.source_timestamp_et', quick.source_timestamp_et),
    timestampWithSource('manifest.source_text_evidence.timestamp_et', manifest?.source_text_evidence?.timestamp_et),
    timestampWithSource('manifest.source_timestamp_et', manifest?.source_timestamp_et),
  ].filter(Boolean)[0] || { source: 'missing', value: '' };
}

function satySessionTimestamp(quick, manifest) {
  return [
    timestampWithSource('quick.trap_candle_timestamp_et', quick.trap_candle_timestamp_et),
    timestampWithSource('manifest.trap_candle_timestamp_et', manifest?.trap_candle_timestamp_et),
    timestampWithSource('quick.first_reclaim_close_timestamp_et', quick.first_reclaim_close_timestamp_et),
    timestampWithSource('manifest.first_reclaim_close_timestamp_et', manifest?.first_reclaim_close_timestamp_et),
    timestampWithSource('quick.source_timestamp_et', quick.source_timestamp_et),
    timestampWithSource('manifest.source_text_evidence.timestamp_et', manifest?.source_text_evidence?.timestamp_et),
    timestampWithSource('manifest.source_timestamp_et', manifest?.source_timestamp_et),
  ]
    .filter((item) => item && _internal.isInsideFuturesSession({ timestamp: item.value }))
    .sort((a, b) => parseTime(a.value) - parseTime(b.value))[0] || { source: 'maintenance_gap_plan_date_fallback', value: '' };
}

function preferredExampleTimestamp(quick, manifest) {
  return proofTimestamp(quick, manifest).value;
}

function loadSessions() {
  const sessions = [];
  if (!fs.existsSync(SESSIONS_DIR)) return sessions;
  for (const name of fs.readdirSync(SESSIONS_DIR).sort()) {
    if (!name.endsWith('.json') || name === 'example-session.json') continue;
    const filePath = path.join(SESSIONS_DIR, name);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.example || data.usable === false) continue;
    const bars = (data.bars?.es || [])
      .map((bar) => ({
        timestamp: bar.timestamp,
        open: asNumber(bar.open),
        high: asNumber(bar.high),
        low: asNumber(bar.low),
        close: asNumber(bar.close),
        volume: asNumber(bar.volume) || 0,
      }))
      .filter((bar) => bar.timestamp && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));
    if (!bars.length) continue;
    sessions.push({
      date: data.date || name.replace(/\.json$/, ''),
      source_file: rel(filePath),
      bars,
    });
  }
  return sessions;
}

function discoverSupplementalEsFiles() {
  const files = [];
  for (const dir of SUPPLEMENTAL_BAR_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (/^es[hmuz]\d{2}_intraday-1min_historical-data-download.*\.csv$/i.test(name)) {
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}

function loadSupplementalBars(files) {
  return files.map((filePath) => ({
    source_file: rel(filePath),
    bars: historicalDataInternal.parseBarchartCsv(filePath) || [],
  })).filter((item) => item.bars.length);
}

function mergeBarsByTimestamp(barArrays) {
  const byTimestamp = new Map();
  for (const bars of barArrays) {
    for (const bar of bars || []) {
      if (!bar?.timestamp) continue;
      const existing = byTimestamp.get(bar.timestamp);
      if (!existing || (Number(bar.volume) || 0) > (Number(existing.volume) || 0)) {
        byTimestamp.set(bar.timestamp, {
          timestamp: bar.timestamp,
          open: asNumber(bar.open),
          high: asNumber(bar.high),
          low: asNumber(bar.low),
          close: asNumber(bar.close),
          volume: asNumber(bar.volume) || 0,
        });
      }
    }
  }
  return [...byTimestamp.values()]
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

function levelsFromSatyRow(row) {
  if (!row?.valid) return [];
  return LEVEL_KEYS
    .map((name) => ({ name, price: asNumber(row[name]) }))
    .filter((level) => level.price !== null)
    .sort((a, b) => a.price - b.price);
}

function nearestLevel(levels, price) {
  if (!Number.isFinite(price) || !levels.length) {
    return { name: '', price: '', distance_points: '', distance_bucket: 'missing' };
  }
  let best = null;
  for (const level of levels) {
    const distance = Math.abs(level.price - price);
    if (!best || distance < best.distance) {
      best = { ...level, distance };
    }
  }
  return {
    name: best.name,
    price: round2(best.price),
    distance_points: round(best.distance, 4),
    distance_bucket: distanceBucket(best.distance),
  };
}

function isoEtForLocalBoundary(value) {
  const text = String(value || '');
  if (!text) return '';
  if (/[+-]\d{2}:\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) return text;
  const second = match[3] || '00';
  const local = `${match[1]} ${match[2]}`;
  return `${match[1]}T${match[2]}:${second}${historicalDataInternal.getETOffset(local)}`;
}

function isTimestampInsideWindow(timestamp, validFrom, validUntil) {
  const t = parseTime(timestamp);
  const from = parseTime(isoEtForLocalBoundary(validFrom));
  const until = parseTime(isoEtForLocalBoundary(validUntil));
  return t !== null && from !== null && until !== null && t >= from && t <= until;
}

function isReferenceCloseBeforeValidFrom(referenceCloseTimestamp, validFrom) {
  const closeTime = parseTime(referenceCloseTimestamp);
  const from = parseTime(isoEtForLocalBoundary(validFrom));
  return closeTime !== null && from !== null && closeTime <= from;
}

function minutesOfDay(timestamp) {
  const match = String(timestamp || '').match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function referenceCompleteness(referenceSession) {
  if (!referenceSession) return 'missing_reference_session';
  const minutes = minutesOfDay(referenceSession.session_close);
  if (!Number.isFinite(minutes)) return 'unknown_reference_close_time';
  if (referenceSession.bar_count >= 1380 && minutes >= 1019) return 'full_to_1659_before_maintenance';
  if (referenceSession.bar_count >= 1300 && minutes >= 959) return 'local_full_to_1559_close_convention';
  return 'partial_reference_session';
}

function referenceCompletenessUsableForSaty(status) {
  return status === 'full_to_1659_before_maintenance' || status === 'local_full_to_1559_close_convention';
}

function normalizedSatyError(satyRow) {
  const error = String(satyRow?.error || '').toLowerCase();
  if (error.includes('at least 15') && error.includes('atr')) return 'insufficient_prior_sessions_for_atr14';
  if (error.includes('missing')) return 'missing_target_session_saty_row';
  return 'invalid_saty_row';
}

function strictSatyValidityFailures({
  satyRow,
  referenceStatus,
  hasSatyAnchor,
  satyAnchorInsideFuturesSession,
  satyAnchorTimestampInsideSatyWindow,
  referenceBeforeTarget,
  referenceFieldIsClose,
  exampleMapsToTarget,
  referenceCloseBeforeValidFrom,
  closeMatches,
}) {
  const failures = [];
  if (!satyRow?.valid) failures.push(normalizedSatyError(satyRow));
  if (!referenceCompletenessUsableForSaty(referenceStatus)) failures.push(`unusable_reference_${referenceStatus}`);
  if (!hasSatyAnchor) failures.push('missing_in_session_saty_anchor');
  if (hasSatyAnchor && !satyAnchorInsideFuturesSession) failures.push('saty_anchor_outside_futures_session');
  if (hasSatyAnchor && satyRow?.valid && !satyAnchorTimestampInsideSatyWindow) failures.push('saty_anchor_outside_valid_window');
  if (!referenceBeforeTarget) failures.push('reference_not_before_target_session');
  if (!referenceFieldIsClose) failures.push('reference_field_not_close');
  if (!exampleMapsToTarget) failures.push('example_session_mapping_failed');
  if (!referenceCloseBeforeValidFrom) failures.push('reference_close_after_valid_from');
  if (!closeMatches) failures.push('reference_close_mismatch');
  return failures;
}

function distanceBucket(distance) {
  if (!Number.isFinite(distance)) return 'missing';
  if (distance <= 0.5) return 'le_0_5';
  if (distance <= 1) return 'le_1';
  if (distance <= 2) return 'le_2';
  if (distance <= 3) return 'le_3';
  if (distance <= 5) return 'le_5';
  return 'gt_5';
}

function strongestPacketLabel(rows) {
  const statuses = new Set(rows.map((row) => row.source_label_status).filter(Boolean));
  const any = (field) => rows.some((row) => row[field] === true || row[field] === 'true');
  let classification = 'packet_observation';
  if (statuses.has('source_confirmed_fbd') || any('source_confirmed_fbd')) classification = 'source_confirmed_fbd';
  else if (statuses.has('source_planned_fbd') || any('source_planned_fbd')) classification = 'source_planned_fbd';
  else if (statuses.has('source_negative_control') || any('source_negative_control')) classification = 'source_negative_control';
  else if (any('sr_list_only')) classification = 'sr_list_only';
  else if (any('chart_mismatch')) classification = 'chart_mismatch';
  else if (any('needs_crop')) classification = 'needs_crop';
  else if (any('data_only')) classification = 'data_only';
  const sourceConfidence = Math.max(0, ...rows.map((row) => asNumber(row.source_confidence_score) || 0));
  return {
    source_context_classification: classification,
    source_confidence_score: round(sourceConfidence, 4),
    source_label_statuses: [...statuses].sort().join('|'),
    training_rows_joined: rows.length,
  };
}

function packetLabelMap(trainingRows) {
  const byPacket = new Map();
  for (const row of trainingRows) {
    if (!row.packet_id) continue;
    if (!byPacket.has(row.packet_id)) byPacket.set(row.packet_id, []);
    byPacket.get(row.packet_id).push(row);
  }
  return new Map([...byPacket.entries()].map(([packetId, rows]) => [packetId, strongestPacketLabel(rows)]));
}

function loadWindowBars(windowCsv) {
  const filePath = resolveRootPath(windowCsv);
  if (!filePath || !fs.existsSync(filePath)) return [];
  return parseCsv(filePath)
    .map((row) => ({
      timestamp: row.timestamp_et || row.timestamp,
      time: parseTime(row.timestamp_et || row.timestamp),
      open: asNumber(row.open),
      high: asNumber(row.high),
      low: asNumber(row.low),
      close: asNumber(row.close),
      volume: asNumber(row.volume) || 0,
    }))
    .filter((bar) => bar.time !== null && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => a.time - b.time);
}

function priorSessionForTarget(sessionSummaries, targetDate) {
  return [...sessionSummaries].reverse().find((session) => session.date < targetDate) || null;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortLevelName(name) {
  return {
    prev_close: 'prev',
    put_trigger: 'put',
    call_trigger: 'call',
    atr_minus_1: '-1ATR',
    atr_plus_1: '+1ATR',
    ext_minus_1: '-.382',
    ext_minus_2: '-.500',
    ext_minus_3: '-.618',
    ext_minus_4: '-.786',
    ext_plus_1: '+.382',
    ext_plus_2: '+.500',
    ext_plus_3: '+.618',
    ext_plus_4: '+.786',
  }[name] || name;
}

function fitPanelValue(value, max = 32) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;
}

function shortTime(timestamp) {
  const text = String(timestamp || '');
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : text;
}

function priceDomain(bars, setupLevel, sweptLow, levels, nonAcceptanceThreshold) {
  const prices = bars.flatMap((bar) => [bar.high, bar.low]);
  [setupLevel, sweptLow, nonAcceptanceThreshold].forEach((price) => {
    if (Number.isFinite(price)) prices.push(price);
  });
  if (Number.isFinite(setupLevel) && levels.length) {
    levels
      .map((level) => ({ ...level, distance: Math.abs(level.price - setupLevel) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .forEach((level) => prices.push(level.price));
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(2, (max - min) * 0.12);
  return { min: min - pad, max: max + pad };
}

function pickVisibleLevels(levels, min, max, setupLevel) {
  const inRange = levels.filter((level) => level.price >= min && level.price <= max);
  const nearest = Number.isFinite(setupLevel)
    ? levels
      .map((level) => ({ ...level, distance: Math.abs(level.price - setupLevel) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
    : [];
  const byName = new Map();
  for (const level of [...inRange, ...nearest]) {
    byName.set(level.name, level);
  }
  return [...byName.values()].sort((a, b) => a.price - b.price);
}

function chartFileName(index, row) {
  const ts = String(row.example_timestamp_et || 'missing')
    .replace(/[-:]/g, '')
    .replace(/T/g, '_')
    .replace(/[^\d_]/g, '')
    .slice(0, 13);
  const level = String(row.setup_level || 'no_level').replace(/[^0-9.]/g, '');
  const suffix = row.packet_id.split(':').pop() || String(index).padStart(3, '0');
  return `${String(index).padStart(3, '0')}_${ts}_${level}_${suffix}_saty_context.svg`;
}

function renderSvg({
  row,
  bars,
  satyLevels,
  visibleLevels,
  setupLevel,
  sweptLow,
  trapTimestamp,
  reclaimTimestamp,
  chartPath,
}) {
  const width = 1500;
  const height = 900;
  const chart = { x: 70, y: 95, w: 1030, h: 650 };
  const panel = { x: 1130, y: 95, w: 320 };
  const nonAcceptanceThreshold = Number.isFinite(setupLevel) ? setupLevel + 5 : null;
  const domain = priceDomain(bars, setupLevel, sweptLow, satyLevels, nonAcceptanceThreshold);
  const y = (price) => chart.y + ((domain.max - price) / (domain.max - domain.min)) * chart.h;
  const x = (idx) => chart.x + (idx / Math.max(1, bars.length - 1)) * chart.w;
  const maxVolume = Math.max(1, ...bars.map((bar) => bar.volume || 0));
  const candleW = Math.max(4, Math.min(18, chart.w / Math.max(1, bars.length) * 0.62));

  const timeToIndex = new Map(bars.map((bar, idx) => [bar.timestamp, idx]));
  const trapIdx = timeToIndex.get(trapTimestamp);
  const reclaimIdx = timeToIndex.get(reclaimTimestamp);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<rect width="1500" height="900" fill="#f8fafc"/>');
  parts.push('<text x="70" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">Mancini Example With Prior-Close SATY Context</text>');
  parts.push(`<text x="70" y="68" font-family="Arial, sans-serif" font-size="13" fill="#475569">${xmlEscape(row.packet_id)}</text>`);
  parts.push(`<rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" fill="#ffffff" stroke="#cbd5e1"/>`);

  for (let i = 0; i <= 6; i += 1) {
    const gy = chart.y + (i / 6) * chart.h;
    const price = domain.max - (i / 6) * (domain.max - domain.min);
    parts.push(`<line x1="${chart.x}" y1="${gy}" x2="${chart.x + chart.w}" y2="${gy}" stroke="#e2e8f0" stroke-width="1"/>`);
    parts.push(`<text x="18" y="${gy + 4}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">${round2(price)}</text>`);
  }

  for (const level of visibleLevels) {
    const ly = y(level.price);
    const isPrevClose = level.name === 'prev_close';
    const isPriority = DISPLAY_LEVEL_PRIORITY.has(level.name);
    const color = isPrevClose ? '#7c3aed' : '#2563eb';
    parts.push(`<line x1="${chart.x}" y1="${ly}" x2="${chart.x + chart.w}" y2="${ly}" stroke="${color}" stroke-width="${isPriority ? 1.7 : 1}" stroke-dasharray="${isPrevClose ? '0' : '6 5'}" opacity="0.78"/>`);
    parts.push(`<text x="${chart.x + chart.w - 10}" y="${ly - 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="${color}">${xmlEscape(shortLevelName(level.name))} ${round2(level.price)}</text>`);
  }

  if (Number.isFinite(setupLevel)) {
    const sy = y(setupLevel);
    parts.push(`<line x1="${chart.x}" y1="${sy}" x2="${chart.x + chart.w}" y2="${sy}" stroke="#111827" stroke-width="2.2"/>`);
    parts.push(`<text x="${chart.x + 8}" y="${sy - 7}" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#111827">Mancini setup ${round2(setupLevel)}</text>`);
  }
  if (Number.isFinite(sweptLow)) {
    const swy = y(sweptLow);
    parts.push(`<line x1="${chart.x}" y1="${swy}" x2="${chart.x + chart.w}" y2="${swy}" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="3 5"/>`);
    parts.push(`<text x="${chart.x + 8}" y="${swy + 16}" font-family="Arial, sans-serif" font-size="12" fill="#dc2626">swept low ${round2(sweptLow)}</text>`);
  }

  if (Number.isInteger(trapIdx)) {
    const tx = x(trapIdx);
    parts.push(`<line x1="${tx}" y1="${chart.y}" x2="${tx}" y2="${chart.y + chart.h}" stroke="#ef4444" stroke-width="1.4" opacity="0.65"/>`);
    parts.push(`<text x="${tx + 4}" y="${chart.y + 18}" font-family="Arial, sans-serif" font-size="11" fill="#ef4444">trap</text>`);
  }
  if (Number.isInteger(reclaimIdx)) {
    const rx = x(reclaimIdx);
    parts.push(`<line x1="${rx}" y1="${chart.y}" x2="${rx}" y2="${chart.y + chart.h}" stroke="#0284c7" stroke-width="1.4" opacity="0.75"/>`);
    parts.push(`<text x="${rx + 4}" y="${chart.y + 34}" font-family="Arial, sans-serif" font-size="11" fill="#0284c7">reclaim</text>`);
  }

  bars.forEach((bar, idx) => {
    const cx = x(idx);
    const openY = y(bar.open);
    const closeY = y(bar.close);
    const highY = y(bar.high);
    const lowY = y(bar.low);
    const up = bar.close >= bar.open;
    const fill = up ? '#16a34a' : '#dc2626';
    const bodyY = Math.min(openY, closeY);
    const bodyH = Math.max(1, Math.abs(openY - closeY));
    parts.push(`<line x1="${cx}" y1="${highY}" x2="${cx}" y2="${lowY}" stroke="${fill}" stroke-width="1.1"/>`);
    parts.push(`<rect x="${cx - candleW / 2}" y="${bodyY}" width="${candleW}" height="${bodyH}" fill="${fill}" opacity="0.82"/>`);
    const vh = (bar.volume / maxVolume) * 55;
    parts.push(`<rect x="${cx - candleW / 2}" y="${chart.y + chart.h + 65 - vh}" width="${candleW}" height="${vh}" fill="#94a3b8" opacity="0.45"/>`);
  });

  const labelEvery = Math.max(1, Math.floor(bars.length / 6));
  bars.forEach((bar, idx) => {
    if (idx % labelEvery !== 0 && idx !== bars.length - 1) return;
    parts.push(`<text x="${x(idx) - 14}" y="${chart.y + chart.h + 90}" font-family="Arial, sans-serif" font-size="10" fill="#64748b">${xmlEscape(shortTime(bar.timestamp))}</text>`);
  });

  parts.push(`<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="650" fill="#ffffff" stroke="#cbd5e1"/>`);
  const panelLines = [
    ['example_ts', row.example_timestamp_et],
    ['saty_anchor', row.saty_session_timestamp_et || row.saty_session_timestamp_source],
    ['target_session', row.target_session_date],
    ['reference_date', row.saty_reference_date],
    ['reference_close', row.saty_reference_close],
    ['ATR(14)', row.saty_atr_value || 'invalid'],
    ['SATY valid', row.saty_valid],
    ['source_class', row.source_context_classification],
    ['family', row.acceptance_family],
    ['nearest_setup', `${row.nearest_saty_to_setup_name || ''} ${row.nearest_saty_to_setup_price || ''}`.trim()],
    ['setup_distance', row.nearest_saty_to_setup_distance_points],
    ['bucket', row.nearest_saty_to_setup_distance_bucket],
    ['timing_row', row.accepted_for_timing_test],
    ['authority', 'context only'],
  ];
  let py = panel.y + 28;
  for (const [key, value] of panelLines) {
    parts.push(`<text x="${panel.x + 14}" y="${py}" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#334155">${xmlEscape(key)}</text>`);
    parts.push(`<text x="${panel.x + 138}" y="${py}" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">${xmlEscape(fitPanelValue(value))}</text>`);
    py += 24;
  }
  parts.push(`<text x="${panel.x + 14}" y="${panel.y + 625}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">SATY-only proximity is not a Mancini positive label.</text>`);
  parts.push(`<text x="${panel.x + 14}" y="${panel.y + 644}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">No live execution, broker, risk, Pine, or Ninja path touched.</text>`);
  parts.push('</svg>');
  fs.writeFileSync(chartPath, `${parts.join('\n')}\n`, 'utf8');
}

function countBy(rows, field) {
  const out = {};
  for (const row of rows) {
    const key = String(row[field] ?? 'missing') || 'missing';
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort());
}

function summarizeDistance(rows, field) {
  const values = rows
    .map((row) => asNumber(row[field]))
    .filter((value) => value !== null);
  if (!values.length) return { rows: rows.length, measured: 0 };
  values.sort((a, b) => a - b);
  return {
    rows: rows.length,
    measured: values.length,
    min: round(values[0], 4),
    median: round(values[Math.floor(values.length / 2)], 4),
    p75: round(values[Math.floor(values.length * 0.75)], 4),
    max: round(values[values.length - 1], 4),
    buckets: countBy(rows, field.replace('distance_points', 'distance_bucket')),
  };
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length, 4);
}

function validationOutcomeByBucket(outcomeRows) {
  const out = {};
  for (const bucket of Object.keys(countBy(outcomeRows, 'nearest_saty_to_setup_distance_bucket'))) {
    const group = outcomeRows.filter((row) => row.nearest_saty_to_setup_distance_bucket === bucket);
    out[bucket] = {
      rows: group.length,
      avg_mfe_60m: average(group.map((row) => asNumber(row.mfe_60m)).filter((v) => v !== null)),
      avg_mae_60m: average(group.map((row) => asNumber(row.mae_60m)).filter((v) => v !== null)),
      saty_context_timing_rows: group.filter((row) => asBool(row.accepted_for_saty_context_timing_stats)).length,
    };
  }
  return out;
}

function shuffledTimestampControl(rows, satyByDate) {
  const validDates = [...new Set(rows.filter((row) => row.saty_valid === true).map((row) => row.target_session_date))].sort();
  if (validDates.length < 2) return { available: false, reason: 'fewer_than_two_valid_saty_dates' };
  const rotated = new Map(validDates.map((date, idx) => [date, validDates[(idx + 7) % validDates.length]]));
  const controlRows = [];
  for (const row of rows) {
    const setup = asNumber(row.setup_level);
    const replacementDate = rotated.get(row.target_session_date);
    if (setup === null || !replacementDate) continue;
    const levels = levelsFromSatyRow(satyByDate[replacementDate]);
    const nearest = nearestLevel(levels, setup);
    controlRows.push({
      packet_id: row.packet_id,
      actual_target_session_date: row.target_session_date,
      shuffled_target_session_date: replacementDate,
      shuffled_nearest_distance_points: nearest.distance_points,
      shuffled_nearest_distance_bucket: nearest.distance_bucket,
      shuffled_distance_bucket: nearest.distance_bucket,
    });
  }
  return {
    available: true,
    rows: controlRows.length,
    actual_setup_distance: summarizeDistance(rows, 'nearest_saty_to_setup_distance_points'),
    shuffled_setup_distance: summarizeDistance(controlRows, 'shuffled_nearest_distance_points'),
  };
}

function markdownReport(summary, sampleRows) {
  const lines = [
    '# Mancini Example SATY Prior-Close Context',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'Scope: research/historical/shadow only. The SATY levels are generated per Mancini packet example from the example SATY session anchor, using the prior completed ES futures session close and ATR(14) from `lib/backtest-data/saty-historical.js`.',
    '',
    'SATY proximity is context only. It does not promote support-list-only rows, SATY-only rows, or no-source rows into positive Mancini examples.',
    '',
    '## Coverage',
    '',
    `- Packet examples: ${summary.coverage.packet_examples}`,
    `- Unique packet ids: ${summary.coverage.unique_packet_ids}`,
    `- Session JSON files loaded: ${summary.coverage.sessions_loaded}`,
    `- Supplemental ES bar files loaded: ${summary.coverage.supplemental_es_bar_files_loaded}`,
    `- Merged intraday bars: ${summary.coverage.merged_intraday_bars}`,
    `- Valid SATY derivations: ${summary.coverage.valid_saty_rows}`,
    `- Invalid SATY derivations: ${summary.coverage.invalid_saty_rows}`,
    `- Prior-close references found: ${summary.coverage.prior_close_reference_rows}`,
    `- SVG charts written: ${summary.coverage.svg_charts_written}`,
    `- Existing PNG sidecars recorded: ${summary.coverage.png_sidecars_present}`,
    `- Validation outcome label rows: ${summary.coverage.validation_outcome_label_rows}`,
    '',
    '## Prior-Close Sanity',
    '',
    `- Reference date before target session failures: ${summary.sanity.reference_before_target_failures}`,
    `- Reference field not close failures: ${summary.sanity.reference_field_not_close_failures}`,
    `- Example timestamp session mapping failures: ${summary.sanity.example_session_mapping_failures}`,
    `- Earliest proof timestamp inside futures session failures: ${summary.sanity.signal_inside_futures_session_failures}`,
    `- SATY session anchor missing rows: ${summary.sanity.saty_session_anchor_missing_rows}`,
    `- SATY session anchor inside futures session failures: ${summary.sanity.saty_session_inside_futures_session_failures}`,
    `- Plan-date/session mismatch rows: ${summary.sanity.plan_date_target_session_mismatch_rows}`,
    `- Reference close after SATY valid-from failures: ${summary.sanity.reference_session_close_after_valid_from_failures}`,
    `- Valid SATY rows with anchor outside SATY window: ${summary.sanity.valid_saty_rows_with_anchor_outside_window}`,
    `- Reference close mismatch failures: ${summary.sanity.reference_close_mismatch_failures}`,
    `- Rows with live/trading authority other than none: ${summary.sanity.live_authority_failures}`,
    '',
    '## Reference Completeness',
    '',
    ...Object.entries(summary.by_reference_completeness_status).map(([key, value]) => `- ${key}: ${value}`),
    '',
    'The local SATY derivation uses the last available bar of the prior completed ES session. Where the source data stops at 15:59 ET, the report marks that as `local_full_to_1559_close_convention` rather than pretending it is a proved 17:00 exchange close.',
    '',
    '## SATY Session Anchor Sources',
    '',
    ...Object.entries(summary.by_saty_session_timestamp_source).map(([key, value]) => `- ${key}: ${value}`),
    '',
    'Rows using `maintenance_gap_plan_date_fallback` have no in-session timestamp available for SATY anchoring. They are hard-rejected from SATY-valid derivations and SATY-context timing stats.',
    '',
    '## Invalid SATY Reasons',
    '',
    ...Object.entries(summary.by_saty_invalid_reason).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Source Classes',
    '',
    ...Object.entries(summary.by_source_context_classification).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Setup-Level Distance To Nearest SATY Level',
    '',
    ...Object.entries(summary.setup_distance_buckets).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Acceptance Families',
    '',
    ...Object.entries(summary.by_acceptance_family).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Validation-Only Outcome Readout',
    '',
    `MFE/MAE fields are written only to \`${rel(OUT_VALIDATION_OUTCOMES)}\`, not to \`${rel(OUT_ROWS)}\`. They remain labels for later validation and false-positive analysis.`,
    '',
    ...Object.entries(summary.validation_only_outcome_by_setup_distance_bucket).map(([key, value]) => `- ${key}: rows=${value.rows}, saty_context_timing=${value.saty_context_timing_rows}, avg_mfe_60m=${value.avg_mfe_60m}, avg_mae_60m=${value.avg_mae_60m}`),
    '',
    '## Shuffled Timestamp Control',
    '',
    `- Available: ${summary.shuffled_timestamp_control.available}`,
    `- Rows: ${summary.shuffled_timestamp_control.rows || 0}`,
    `- Actual median setup distance: ${summary.shuffled_timestamp_control.actual_setup_distance?.median ?? 'n/a'}`,
    `- Shuffled median setup distance: ${summary.shuffled_timestamp_control.shuffled_setup_distance?.median ?? 'n/a'}`,
    '',
    '## Sample Rows',
    '',
    ...sampleRows.map((row) => `- ${row.packet_id}: setup=${row.setup_level}, session=${row.target_session_date}, ref=${row.saty_reference_date} close=${row.saty_reference_close}, nearest=${row.nearest_saty_to_setup_name} ${row.nearest_saty_to_setup_price} distance=${row.nearest_saty_to_setup_distance_points}, class=${row.source_context_classification}, chart=${row.chart_svg_path}`),
    '',
    '## Safety',
    '',
    '- No Pine, NinjaTrader, broker, account, credential, risk, order, or live-execution path is touched.',
    '- `sr_list_only` and SATY-only/no-Mancini-source contexts remain control/negative evidence.',
    '- Candidate math may use SATY distance as a no-lookahead context feature only after Mancini source gates pass.',
  ];
  return `${lines.join('\n')}\n`;
}

function buildRows() {
  const manifest = JSON.parse(fs.readFileSync(GALLERY_MANIFEST, 'utf8'));
  const manifestByPacket = new Map(manifest.map((row) => [row.packet_id, row]));
  const quickRows = parseCsv(QUICK_ROWS);
  const trainingLabels = packetLabelMap(readJsonl(SELECTED_TRAINING_ROWS));
  const sessions = loadSessions();
  const supplementalFiles = discoverSupplementalEsFiles();
  const supplementalSources = loadSupplementalBars(supplementalFiles);
  const sessionBars = sessions.flatMap((session) => session.bars);
  const intradayBars = mergeBarsByTimestamp([
    sessionBars,
    ...supplementalSources.map((source) => source.bars),
  ]);
  const sessionSummaries = buildFuturesSessionBars(intradayBars);

  const examples = quickRows.map((quick) => {
    const packetId = quick.packet_id;
    const manifestRow = manifestByPacket.get(packetId) || {};
    const proof = proofTimestamp(quick, manifestRow);
    const satySession = satySessionTimestamp(quick, manifestRow);
    const planDate = manifestRow.event_fields?.plan_date || '';
    const exampleTimestamp = proof.value;
    const targetSessionDate = satySession.value
      ? _internal.futuresSessionDateForTimestamp(satySession.value)
      : planDate || (exampleTimestamp ? _internal.futuresSessionDateForTimestamp(exampleTimestamp) : '');
    return {
      quick,
      manifest: manifestRow,
      packet_id: packetId,
      example_timestamp_et: exampleTimestamp,
      proof_timestamp_source: proof.source,
      saty_session_timestamp_et: satySession.value,
      saty_session_timestamp_source: satySession.source,
      target_session_date: targetSessionDate,
    };
  });
  const targetDates = [...new Set(examples.map((example) => example.target_session_date).filter(Boolean))].sort();
  const satyByDate = deriveLevelsByDate(intradayBars, targetDates);

  const rows = [];
  const validationOutcomes = [];
  const chartManifest = [];
  for (const [idx, example] of examples.entries()) {
    const { quick, manifest: manifestRow } = example;
    const labelInfo = trainingLabels.get(example.packet_id) || {
      source_context_classification: quick.source_setup_evidence_status === 'level_list_only_not_setup_description' ? 'sr_list_only' : 'packet_observation',
      source_confidence_score: 0,
      source_label_statuses: '',
      training_rows_joined: 0,
    };
    const satyRow = satyByDate[example.target_session_date] || { valid: false, error: 'missing_target_session_saty_row' };
    const priorReference = priorSessionForTarget(sessionSummaries, example.target_session_date);
    const setupLevel = asNumber(quick.level);
    const sweptLow = asNumber(quick.trap_candle_low);
    const windowCsv = quick.window_csv || manifestRow.window_csv || '';
    const bars = loadWindowBars(windowCsv);
    const reclaimBar = bars.find((bar) => bar.timestamp === quick.first_reclaim_close_timestamp_et);
    const reclaimClose = asNumber(reclaimBar?.close);
    const referenceClose = satyRow.valid ? asNumber(satyRow.prev_close) : asNumber(priorReference?.close);
    const referenceDate = satyRow.reference_date || priorReference?.date || '';
    const referenceField = satyRow.reference_field || (priorReference ? 'close' : '');
    const referenceStatus = referenceCompleteness(priorReference);
    const planDate = manifestRow.event_fields?.plan_date || '';
    const referenceBeforeTarget = Boolean(referenceDate && example.target_session_date && referenceDate < example.target_session_date);
    const exampleMapsToTarget = example.saty_session_timestamp_et
      ? example.target_session_date === _internal.futuresSessionDateForTimestamp(example.saty_session_timestamp_et)
      : Boolean(planDate && example.target_session_date === planDate);
    const signalInsideFuturesSession = example.example_timestamp_et
      ? _internal.isInsideFuturesSession({ timestamp: example.example_timestamp_et })
      : false;
    const satyAnchorInsideFuturesSession = example.saty_session_timestamp_et
      ? _internal.isInsideFuturesSession({ timestamp: example.saty_session_timestamp_et })
      : false;
    const referenceCloseBeforeValidFrom = satyRow.valid
      ? isReferenceCloseBeforeValidFrom(satyRow.reference_session_close || priorReference?.session_close, satyRow.valid_from)
      : true;
    const satyAnchorTimestampInsideSatyWindow = satyRow.valid && example.saty_session_timestamp_et
      ? isTimestampInsideWindow(example.saty_session_timestamp_et, satyRow.valid_from, satyRow.valid_until)
      : false;
    const planDateMatchesTarget = planDate ? planDate === example.target_session_date : true;
    const closeMatches = satyRow.valid && priorReference
      ? Math.abs(asNumber(satyRow.prev_close) - asNumber(priorReference.close)) < 0.01
      : Boolean(referenceClose !== null && priorReference);
    const satyFailures = strictSatyValidityFailures({
      satyRow,
      referenceStatus,
      hasSatyAnchor: Boolean(example.saty_session_timestamp_et),
      satyAnchorInsideFuturesSession,
      satyAnchorTimestampInsideSatyWindow,
      referenceBeforeTarget,
      referenceFieldIsClose: referenceField === 'close',
      exampleMapsToTarget,
      referenceCloseBeforeValidFrom,
      closeMatches,
    });
    const strictSatyValid = satyFailures.length === 0;
    const satyLevels = strictSatyValid ? levelsFromSatyRow(satyRow) : [];
    const nearestSetup = nearestLevel(satyLevels, setupLevel);
    const nearestSwept = nearestLevel(satyLevels, sweptLow);
    const nearestReclaim = nearestLevel(satyLevels, reclaimClose);
    const visibleLevels = pickVisibleLevels(
      satyLevels,
      bars.length ? priceDomain(bars, setupLevel, sweptLow, satyLevels, Number.isFinite(setupLevel) ? setupLevel + 5 : null).min : -Infinity,
      bars.length ? priceDomain(bars, setupLevel, sweptLow, satyLevels, Number.isFinite(setupLevel) ? setupLevel + 5 : null).max : Infinity,
      setupLevel,
    );
    const rawAcceptedForTiming = asBool(quick.accepted_for_timing_test);
    const acceptedForSatyContextTiming = rawAcceptedForTiming && strictSatyValid;

    const row = {
      schema_version: 1,
      review_only: true,
      trading_authority: 'none',
      packet_id: example.packet_id,
      example_index: idx + 1,
      proof_timestamp_et: example.example_timestamp_et,
      proof_timestamp_source: example.proof_timestamp_source,
      saty_session_timestamp_et: example.saty_session_timestamp_et,
      saty_session_timestamp_source: example.saty_session_timestamp_source,
      example_timestamp_et: example.example_timestamp_et,
      target_session_date: example.target_session_date,
      plan_date: planDate,
      source_id: quick.source_id || manifestRow.source_id || '',
      source_kind: quick.source_kind || manifestRow.source_kind || '',
      source_label: quick.source_label || manifestRow.mancini_source_text || '',
      source_context_classification: labelInfo.source_context_classification,
      source_label_statuses: labelInfo.source_label_statuses,
      source_confidence_score: labelInfo.source_confidence_score,
      training_rows_joined: labelInfo.training_rows_joined,
      source_setup_evidence_status: quick.source_setup_evidence_status || '',
      source_level_role_status: quick.source_level_role_status || '',
      sr_list_only_control: labelInfo.source_context_classification === 'sr_list_only',
      setup_level: setupLevel,
      swept_low: sweptLow,
      flush_points: asNumber(quick.flush_points),
      trap_candle_timestamp_et: quick.trap_candle_timestamp_et || '',
      first_reclaim_close_timestamp_et: quick.first_reclaim_close_timestamp_et || '',
      acceptance_family: quick.acceptance_family || '',
      raw_packet_accepted_for_timing_test: rawAcceptedForTiming,
      accepted_for_timing_test: acceptedForSatyContextTiming,
      saty_valid: strictSatyValid,
      saty_invalid_reason: strictSatyValid ? '' : satyFailures.join('|'),
      saty_target_session_date: satyRow.target_session_date || example.target_session_date,
      saty_reference_date: referenceDate,
      saty_reference_field: referenceField,
      saty_reference_close: referenceClose !== null ? round2(referenceClose) : '',
      saty_reference_session_open: satyRow.reference_session_open || priorReference?.session_open || '',
      saty_reference_session_close: satyRow.reference_session_close || priorReference?.session_close || '',
      saty_reference_bar_count: satyRow.reference_bar_count || priorReference?.bar_count || '',
      saty_reference_completeness_status: referenceStatus,
      saty_atr_value: strictSatyValid ? asNumber(satyRow.atr_value) : '',
      saty_valid_from: satyRow.valid_from || '',
      saty_valid_until: satyRow.valid_until || '',
      saty_formula_provenance: satyRow.formula_provenance || 'Saty_Pine_D_session_extended_close1_atr14_1',
      reference_before_target_check: referenceBeforeTarget,
      reference_field_close_check: referenceField === 'close',
      example_session_mapping_check: exampleMapsToTarget,
      signal_inside_futures_session_check: signalInsideFuturesSession,
      saty_session_inside_futures_session_check: satyAnchorInsideFuturesSession,
      plan_date_matches_target_session_check: planDateMatchesTarget,
      reference_session_close_before_valid_from_check: referenceCloseBeforeValidFrom,
      saty_session_timestamp_inside_saty_window_check: satyAnchorTimestampInsideSatyWindow,
      reference_close_matches_session_close_check: closeMatches,
      nearest_saty_to_setup_name: nearestSetup.name,
      nearest_saty_to_setup_price: nearestSetup.price,
      nearest_saty_to_setup_distance_points: nearestSetup.distance_points,
      nearest_saty_to_setup_distance_bucket: nearestSetup.distance_bucket,
      nearest_saty_to_swept_low_name: nearestSwept.name,
      nearest_saty_to_swept_low_price: nearestSwept.price,
      nearest_saty_to_swept_low_distance_points: nearestSwept.distance_points,
      nearest_saty_to_swept_low_distance_bucket: nearestSwept.distance_bucket,
      nearest_saty_to_reclaim_close_name: nearestReclaim.name,
      nearest_saty_to_reclaim_close_price: nearestReclaim.price,
      nearest_saty_to_reclaim_close_distance_points: nearestReclaim.distance_points,
      nearest_saty_to_reclaim_close_distance_bucket: nearestReclaim.distance_bucket,
      visible_saty_levels: visibleLevels.map((level) => `${level.name}:${round2(level.price)}`).join('|'),
      window_csv: windowCsv,
      original_chart_path: manifestRow.chart_path || '',
      original_png_path: manifestRow.png_path || '',
      chart_svg_path: '',
      chart_png_path: '',
    };
    validationOutcomes.push({
      schema_version: 1,
      labels_only: true,
      review_only: true,
      packet_id: example.packet_id,
      example_index: idx + 1,
      source_context_classification: labelInfo.source_context_classification,
      saty_valid: strictSatyValid,
      saty_invalid_reason: row.saty_invalid_reason,
      nearest_saty_to_setup_distance_bucket: nearestSetup.distance_bucket,
      raw_packet_accepted_for_timing_test: rawAcceptedForTiming,
      accepted_for_saty_context_timing_stats: acceptedForSatyContextTiming,
      mfe_15m: quick.mfe_15m,
      mae_15m: quick.mae_15m,
      mfe_60m: quick.mfe_60m,
      mae_60m: quick.mae_60m,
    });

    if (bars.length) {
      const chartPath = path.join(CHART_DIR, chartFileName(idx + 1, row));
      renderSvg({
        row,
        bars,
        satyLevels,
        visibleLevels,
        setupLevel,
        sweptLow,
        trapTimestamp: row.trap_candle_timestamp_et,
        reclaimTimestamp: row.first_reclaim_close_timestamp_et,
        chartPath,
      });
      row.chart_svg_path = rel(chartPath);
      row.chart_png_path = rel(chartPath.replace(/\.svg$/i, '.png'));
    }
    rows.push(row);
    chartManifest.push({
      packet_id: row.packet_id,
      example_index: row.example_index,
      proof_timestamp_et: row.proof_timestamp_et,
      proof_timestamp_source: row.proof_timestamp_source,
      saty_session_timestamp_et: row.saty_session_timestamp_et,
      saty_session_timestamp_source: row.saty_session_timestamp_source,
      chart_svg_path: row.chart_svg_path,
      chart_png_path: row.chart_png_path,
      target_session_date: row.target_session_date,
      saty_reference_date: row.saty_reference_date,
      saty_reference_close: row.saty_reference_close,
      saty_reference_completeness_status: row.saty_reference_completeness_status,
      saty_valid: row.saty_valid,
      source_context_classification: row.source_context_classification,
      nearest_saty_to_setup_name: row.nearest_saty_to_setup_name,
      nearest_saty_to_setup_price: row.nearest_saty_to_setup_price,
      nearest_saty_to_setup_distance_points: row.nearest_saty_to_setup_distance_points,
    });
  }

  return {
    manifest,
    quickRows,
    sessions,
    supplementalSources,
    intradayBars,
    satyByDate,
    rows,
    validationOutcomes,
    chartManifest,
  };
}

function buildSummary(context) {
  const { rows, validationOutcomes, quickRows, manifest, sessions, supplementalSources, intradayBars, satyByDate } = context;
  const svgCharts = rows.filter((row) => row.chart_svg_path && fs.existsSync(resolveRootPath(row.chart_svg_path))).length;
  const pngSidecars = rows.filter((row) => row.chart_png_path && fs.existsSync(resolveRootPath(row.chart_png_path))).length;
  const outcomeFieldNames = ['mfe_15m', 'mae_15m', 'mfe_60m', 'mae_60m'];
  const outcomeFieldsPresentInFeatureRows = rows.some((row) => outcomeFieldNames.some((field) => Object.prototype.hasOwnProperty.call(row, field)));
  const satyOnlyPromotedRows = rows.filter((row) => row.source_context_classification === 'saty_only_no_mancini_source_setup' && asNumber(row.source_confidence_score) > 0);
  const srListOnlyPromotedRows = rows.filter((row) => row.sr_list_only_control && ['source_confirmed_fbd', 'source_planned_fbd'].includes(row.source_context_classification));
  const summary = {
    generated_at: new Date().toISOString(),
    scope: 'research_historical_shadow_only',
    inputs: {
      quick_rows: rel(QUICK_ROWS),
      gallery_manifest: rel(GALLERY_MANIFEST),
      selected_training_rows: rel(SELECTED_TRAINING_ROWS),
      sessions_dir: rel(SESSIONS_DIR),
      supplemental_es_bar_files: supplementalSources.map((source) => source.source_file),
      saty_formula_module: 'lib/backtest-data/saty-historical.js',
    },
    outputs: {
      rows_csv: rel(OUT_ROWS),
      context_json: rel(OUT_CONTEXT),
      chart_manifest: rel(OUT_MANIFEST),
      report_md: rel(OUT_REPORT),
      validation_outcomes_csv: rel(OUT_VALIDATION_OUTCOMES),
      chart_dir: rel(CHART_DIR),
    },
    coverage: {
      packet_examples: rows.length,
      quick_rows: quickRows.length,
      manifest_rows: manifest.length,
      sessions_loaded: sessions.length,
      supplemental_es_bar_files_loaded: supplementalSources.length,
      merged_intraday_bars: intradayBars.length,
      target_sessions: new Set(rows.map((row) => row.target_session_date).filter(Boolean)).size,
      unique_packet_ids: new Set(rows.map((row) => row.packet_id)).size,
      valid_saty_rows: rows.filter((row) => row.saty_valid === true).length,
      invalid_saty_rows: rows.filter((row) => row.saty_valid !== true).length,
      prior_close_reference_rows: rows.filter((row) => row.saty_reference_close !== '').length,
      svg_charts_written: svgCharts,
      png_sidecars_present: pngSidecars,
      validation_outcome_label_rows: validationOutcomes.length,
    },
    sanity: {
      reference_before_target_failures: rows.filter((row) => !row.reference_before_target_check).length,
      reference_field_not_close_failures: rows.filter((row) => !row.reference_field_close_check).length,
      example_session_mapping_failures: rows.filter((row) => !row.example_session_mapping_check).length,
      signal_inside_futures_session_failures: rows.filter((row) => !row.signal_inside_futures_session_check).length,
      saty_session_anchor_missing_rows: rows.filter((row) => !row.saty_session_timestamp_et).length,
      saty_session_inside_futures_session_failures: rows.filter((row) => row.saty_session_timestamp_et && !row.saty_session_inside_futures_session_check).length,
      plan_date_target_session_mismatch_rows: rows.filter((row) => !row.plan_date_matches_target_session_check).length,
      reference_session_close_after_valid_from_failures: rows.filter((row) => !row.reference_session_close_before_valid_from_check).length,
      valid_saty_rows_with_anchor_outside_window: rows.filter((row) => row.saty_valid && row.saty_session_timestamp_et && !row.saty_session_timestamp_inside_saty_window_check).length,
      reference_close_mismatch_failures: rows.filter((row) => !row.reference_close_matches_session_close_check).length,
      live_authority_failures: rows.filter((row) => row.trading_authority !== 'none' || row.review_only !== true).length,
      saty_only_promoted_to_source_failures: satyOnlyPromotedRows.length,
      sr_list_only_promoted_to_source_failures: srListOnlyPromotedRows.length,
      mfe_mae_present_in_feature_rows: outcomeFieldsPresentInFeatureRows,
      mfe_mae_used_as_saty_derivation_inputs: false,
    },
    by_source_context_classification: countBy(rows, 'source_context_classification'),
    by_acceptance_family: countBy(rows, 'acceptance_family'),
    by_proof_timestamp_source: countBy(rows, 'proof_timestamp_source'),
    by_saty_session_timestamp_source: countBy(rows, 'saty_session_timestamp_source'),
    by_reference_completeness_status: countBy(rows, 'saty_reference_completeness_status'),
    by_target_session_date: countBy(rows, 'target_session_date'),
    setup_distance: summarizeDistance(rows, 'nearest_saty_to_setup_distance_points'),
    swept_low_distance: summarizeDistance(rows, 'nearest_saty_to_swept_low_distance_points'),
    setup_distance_buckets: countBy(rows, 'nearest_saty_to_setup_distance_bucket'),
    by_saty_invalid_reason: countBy(rows.filter((row) => !row.saty_valid), 'saty_invalid_reason'),
    validation_only_outcome_by_setup_distance_bucket: validationOutcomeByBucket(validationOutcomes),
    shuffled_timestamp_control: shuffledTimestampControl(rows, satyByDate),
    safety: {
      live_trading_behavior_introduced: false,
      broker_risk_live_pine_credential_execution_touched: false,
      ninja_code_written: false,
      saty_only_rows_promoted_to_positive: satyOnlyPromotedRows.length > 0,
      sr_list_only_rows_promoted_to_positive: srListOnlyPromotedRows.length > 0,
      mfe_mae_used_as_candidate_inputs: outcomeFieldsPresentInFeatureRows,
    },
  };
  return summary;
}

function main() {
  ensureDir(OUT_DIR);
  const preserveChartDir = process.argv.includes('--preserve-chart-dir');
  if (preserveChartDir) ensureDir(CHART_DIR);
  else resetGeneratedDir(CHART_DIR);
  const context = buildRows();
  const summary = buildSummary(context);

  const columns = [
    'schema_version',
    'review_only',
    'trading_authority',
    'packet_id',
    'example_index',
    'proof_timestamp_et',
    'proof_timestamp_source',
    'saty_session_timestamp_et',
    'saty_session_timestamp_source',
    'example_timestamp_et',
    'target_session_date',
    'plan_date',
    'source_id',
    'source_kind',
    'source_context_classification',
    'source_label_statuses',
    'source_confidence_score',
    'training_rows_joined',
    'source_setup_evidence_status',
    'source_level_role_status',
    'sr_list_only_control',
    'setup_level',
    'swept_low',
    'flush_points',
    'trap_candle_timestamp_et',
    'first_reclaim_close_timestamp_et',
    'acceptance_family',
    'raw_packet_accepted_for_timing_test',
    'accepted_for_timing_test',
    'saty_valid',
    'saty_invalid_reason',
    'saty_target_session_date',
    'saty_reference_date',
    'saty_reference_field',
    'saty_reference_close',
    'saty_reference_session_open',
    'saty_reference_session_close',
    'saty_reference_bar_count',
    'saty_reference_completeness_status',
    'saty_atr_value',
    'saty_valid_from',
    'saty_valid_until',
    'saty_formula_provenance',
    'reference_before_target_check',
    'reference_field_close_check',
    'example_session_mapping_check',
    'signal_inside_futures_session_check',
    'saty_session_inside_futures_session_check',
    'plan_date_matches_target_session_check',
    'reference_session_close_before_valid_from_check',
    'saty_session_timestamp_inside_saty_window_check',
    'reference_close_matches_session_close_check',
    'nearest_saty_to_setup_name',
    'nearest_saty_to_setup_price',
    'nearest_saty_to_setup_distance_points',
    'nearest_saty_to_setup_distance_bucket',
    'nearest_saty_to_swept_low_name',
    'nearest_saty_to_swept_low_price',
    'nearest_saty_to_swept_low_distance_points',
    'nearest_saty_to_swept_low_distance_bucket',
    'nearest_saty_to_reclaim_close_name',
    'nearest_saty_to_reclaim_close_price',
    'nearest_saty_to_reclaim_close_distance_points',
    'nearest_saty_to_reclaim_close_distance_bucket',
    'visible_saty_levels',
    'window_csv',
    'original_chart_path',
    'original_png_path',
    'chart_svg_path',
    'chart_png_path',
  ];
  const outcomeColumns = [
    'schema_version',
    'labels_only',
    'review_only',
    'packet_id',
    'example_index',
    'source_context_classification',
    'saty_valid',
    'saty_invalid_reason',
    'nearest_saty_to_setup_distance_bucket',
    'raw_packet_accepted_for_timing_test',
    'accepted_for_saty_context_timing_stats',
    'mfe_15m',
    'mae_15m',
    'mfe_60m',
    'mae_60m',
  ];
  writeCsv(OUT_ROWS, context.rows, columns);
  writeCsv(OUT_VALIDATION_OUTCOMES, context.validationOutcomes, outcomeColumns);
  fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(context.chartManifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CONTEXT, `${JSON.stringify({ ...summary, rows: context.rows, validation_outcomes: context.validationOutcomes }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_REPORT, markdownReport(summary, context.rows.slice(0, 10)), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    out_dir: rel(OUT_DIR),
    rows: context.rows.length,
    valid_saty_rows: summary.coverage.valid_saty_rows,
    invalid_saty_rows: summary.coverage.invalid_saty_rows,
    prior_close_reference_rows: summary.coverage.prior_close_reference_rows,
    svg_charts_written: summary.coverage.svg_charts_written,
    sanity: summary.sanity,
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  _internal: {
    parseCsvLine,
    parseCsv,
    asNumber,
    proofTimestamp,
    satySessionTimestamp,
    preferredExampleTimestamp,
    distanceBucket,
    nearestLevel,
    isoEtForLocalBoundary,
    isTimestampInsideWindow,
    referenceCompleteness,
    referenceCompletenessUsableForSaty,
    normalizedSatyError,
    strictSatyValidityFailures,
    strongestPacketLabel,
    shuffledTimestampControl,
  },
};
