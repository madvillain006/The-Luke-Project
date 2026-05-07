'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-high-confluence');

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

function pct(value) {
  return Number.isFinite(value) ? round2(value * 100) : null;
}

function eventKey(row) {
  return String(row.signal_timestamp);
}

function hour(row) {
  return Number(String(row.signal_timestamp).slice(11, 13));
}

function minuteOfDay(row) {
  return hour(row) * 60 + Number(String(row.signal_timestamp).slice(14, 16));
}

function candidateKey(row) {
  return `${row.acceptance_bars}|${row.dump_window_bars}|${row.min_flush_depth_points}|${row.min_tap_groups}|${row.entry_timestamp || row.signal_timestamp}`;
}

function latestByKey(rows) {
  const map = new Map();
  for (const row of rows) map.set(eventKey(row), row);
  return map;
}

function uniqueTriggers(trades, rthEvents, sessionEvents) {
  const byTradeKey = new Map();
  for (const trade of trades) {
    byTradeKey.set(candidateKey(trade), trade);
  }
  const rthMaps = {
    rth1h: latestByKey(rthEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === '1h')),
    rth2h: latestByKey(rthEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === '2h')),
    rth4h: latestByKey(rthEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === '4h')),
  };
  const sessionMaps = {
    eod: latestByKey(sessionEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === 'spx_eod')),
    nextEod: latestByKey(sessionEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === 'spx_next_eod')),
    eow: latestByKey(sessionEvents.filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === 'spx_eow')),
  };
  const base = sessionEvents
    .filter(row => row.candidate_id === 'swing_candidate' && row.horizon_id === 'spx_eod')
    .map(row => {
      const trade = byTradeKey.get(`3|1|1|3|${row.signal_timestamp}`) || {};
      const r1 = rthMaps.rth1h.get(row.signal_timestamp) || {};
      const r2 = rthMaps.rth2h.get(row.signal_timestamp) || {};
      const r4 = rthMaps.rth4h.get(row.signal_timestamp) || {};
      const nd = sessionMaps.nextEod.get(row.signal_timestamp) || {};
      const wk = sessionMaps.eow.get(row.signal_timestamp) || {};
      return {
        date: row.date,
        signal_timestamp: row.signal_timestamp,
        level: Number(row.level),
        hour: hour(row),
        minute_of_day: minuteOfDay(row),
        prior_tap_groups: Number(trade.prior_tap_groups),
        flush_depth_points: Number(trade.flush_depth_points),
        dump_move_points: Number(trade.dump_move_points),
        bars_since_flush: Number(trade.bars_since_flush),
        spx_entry: Number(row.entry),
        mfe_1h: Number(r1.mfe_points),
        mae_1h: Number(r1.mae_points),
        close_1h: Number(r1.close_move_points),
        mfe_2h: Number(r2.mfe_points),
        mae_2h: Number(r2.mae_points),
        close_2h: Number(r2.close_move_points),
        mfe_4h: Number(r4.mfe_points),
        mae_4h: Number(r4.mae_points),
        close_4h: Number(r4.close_move_points),
        close_eod: Number(row.close_move_points),
        mfe_eod: Number(row.mfe_points),
        mae_eod: Number(row.mae_points),
        close_next_eod: Number(nd.close_move_points),
        close_eow: Number(wk.close_move_points),
      };
    })
    .sort((a, b) => a.signal_timestamp.localeCompare(b.signal_timestamp));

  const byDateCount = new Map();
  const byLevelDateCount = new Map();
  const cooldowns = [30, 60, 90];
  const lastByCooldown = new Map(cooldowns.map(cooldown => [cooldown, new Map()]));
  for (const row of base) {
    const dayCount = byDateCount.get(row.date) || 0;
    row.trigger_number_day = dayCount + 1;
    byDateCount.set(row.date, dayCount + 1);

    const levelDate = `${row.date}|${row.level}`;
    const levelCount = byLevelDateCount.get(levelDate) || 0;
    row.trigger_number_level_day = levelCount + 1;
    byLevelDateCount.set(levelDate, levelCount + 1);

    for (const cooldown of cooldowns) {
      const lastMap = lastByCooldown.get(cooldown);
      const lastMinute = lastMap.get(row.date);
      row[`passes_${cooldown}m_cooldown`] = !Number.isFinite(lastMinute) || row.minute_of_day - lastMinute >= cooldown;
      if (row[`passes_${cooldown}m_cooldown`]) lastMap.set(row.date, row.minute_of_day);
    }
  }
  return base;
}

const FILTERS = [
  { id: 'all_swing', label: 'All strict Mancini triggers', fn: () => true },
  { id: 'first_per_day', label: 'First trigger per day', fn: row => row.trigger_number_day === 1 },
  { id: 'first_per_level_day', label: 'First trigger per level/day', fn: row => row.trigger_number_level_day === 1 },
  { id: 'cooldown_60m', label: '60m cooldown', fn: row => row.passes_60m_cooldown },
  { id: 'morning_before_11', label: 'Before 11:00 ET', fn: row => row.hour < 11 },
  { id: 'not_opening_15m', label: 'After 09:45 ET', fn: row => row.minute_of_day >= 9 * 60 + 45 },
  { id: 'after_945_cooldown_60m', label: 'After 09:45 + 60m cooldown', fn: row => row.minute_of_day >= 9 * 60 + 45 && row.passes_60m_cooldown },
  { id: 'taps_5_plus', label: '5+ prior tap groups', fn: row => row.prior_tap_groups >= 5 },
  { id: 'taps_8_plus', label: '8+ prior tap groups', fn: row => row.prior_tap_groups >= 8 },
  { id: 'flush_2_plus', label: '2+ ES pt flush', fn: row => row.flush_depth_points >= 2 },
  { id: 'flush_2_taps_5', label: '2+ flush + 5+ taps', fn: row => row.flush_depth_points >= 2 && row.prior_tap_groups >= 5 },
  { id: 'taps_5_cooldown_60m', label: '5+ taps + 60m cooldown', fn: row => row.prior_tap_groups >= 5 && row.passes_60m_cooldown },
  { id: 'taps_5_after_945', label: '5+ taps + after 09:45', fn: row => row.prior_tap_groups >= 5 && row.minute_of_day >= 9 * 60 + 45 },
];

const SUPER_TRIGGER_WINDOWS = [15, 30, 45, 60];

function buildSuperTriggers(triggers, windowMinutes) {
  const grouped = new Map();
  for (const row of triggers) {
    const key = `${row.date}|${row.level}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const clusters = [];
  for (const [key, rows] of grouped.entries()) {
    const sorted = rows.sort((a, b) => a.signal_timestamp.localeCompare(b.signal_timestamp));
    let current = [];
    for (const row of sorted) {
      const previous = current[current.length - 1];
      if (!previous || row.minute_of_day - previous.minute_of_day <= windowMinutes) {
        current.push(row);
      } else {
        clusters.push(makeCluster(key, current, windowMinutes));
        current = [row];
      }
    }
    if (current.length) clusters.push(makeCluster(key, current, windowMinutes));
  }
  return clusters.sort((a, b) => a.first_signal_timestamp.localeCompare(b.first_signal_timestamp));
}

function makeCluster(key, rows, windowMinutes) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const max = field => Math.max(...rows.map(row => Number(row[field])).filter(Number.isFinite));
  const avg = field => rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length;
  return {
    super_window_minutes: windowMinutes,
    key,
    date: first.date,
    level: first.level,
    first_signal_timestamp: first.signal_timestamp,
    last_signal_timestamp: last.signal_timestamp,
    trigger_count: rows.length,
    duration_minutes: last.minute_of_day - first.minute_of_day,
    first_hour: first.hour,
    first_minute_of_day: first.minute_of_day,
    max_prior_tap_groups: max('prior_tap_groups'),
    max_flush_depth_points: max('flush_depth_points'),
    avg_prior_tap_groups: round2(avg('prior_tap_groups')),
    avg_flush_depth_points: round2(avg('flush_depth_points')),
    first_mfe_1h: first.mfe_1h,
    first_mfe_2h: first.mfe_2h,
    first_mfe_4h: first.mfe_4h,
    first_mae_1h: first.mae_1h,
    first_mae_2h: first.mae_2h,
    first_close_eod: first.close_eod,
    first_close_next_eod: first.close_next_eod,
    first_close_eow: first.close_eow,
    last_mfe_1h: last.mfe_1h,
    last_mfe_2h: last.mfe_2h,
    last_mfe_4h: last.mfe_4h,
    last_mae_1h: last.mae_1h,
    last_mae_2h: last.mae_2h,
    last_close_eod: last.close_eod,
    last_close_next_eod: last.close_next_eod,
    last_close_eow: last.close_eow,
    best_mfe_1h: max('mfe_1h'),
    best_mfe_2h: max('mfe_2h'),
    best_mfe_4h: max('mfe_4h'),
  };
}

const SUPER_FILTERS = [
  { id: 'all_super', label: 'All same-level super triggers', fn: () => true },
  { id: 'repeat_2_plus', label: '2+ repeats inside window', fn: row => row.trigger_count >= 2 },
  { id: 'repeat_3_plus', label: '3+ repeats inside window', fn: row => row.trigger_count >= 3 },
  { id: 'repeat_2_taps_5', label: '2+ repeats + 5+ taps', fn: row => row.trigger_count >= 2 && row.max_prior_tap_groups >= 5 },
  { id: 'repeat_2_flush_2', label: '2+ repeats + 2+ flush', fn: row => row.trigger_count >= 2 && row.max_flush_depth_points >= 2 },
  { id: 'repeat_2_after_945', label: '2+ repeats + after 09:45', fn: row => row.trigger_count >= 2 && row.first_minute_of_day >= 9 * 60 + 45 },
  { id: 'repeat_2_before_11', label: '2+ repeats + before 11:00', fn: row => row.trigger_count >= 2 && row.first_hour < 11 },
];

function summarizeSuper(rows, filter, mode) {
  const subset = rows.filter(filter.fn);
  const n = subset.length;
  if (!n) return null;
  const p = prefix => mode === 'first_entry' ? `first_${prefix}` : `last_${prefix}`;
  const rate = pred => subset.filter(pred).length / n;
  const avg = field => subset.reduce((sum, row) => sum + Number(row[field] || 0), 0) / n;
  return {
    mode,
    super_window_minutes: rows[0]?.super_window_minutes ?? null,
    filter_id: filter.id,
    filter_label: filter.label,
    super_triggers: n,
    signal_days: new Set(subset.map(row => row.date)).size,
    avg_repeats: round2(avg('trigger_count')),
    avg_duration_minutes: round2(avg('duration_minutes')),
    avg_max_taps: round2(avg('max_prior_tap_groups')),
    avg_max_flush: round2(avg('max_flush_depth_points')),
    avg_mfe_1h: round2(avg(p('mfe_1h'))),
    avg_mfe_2h: round2(avg(p('mfe_2h'))),
    avg_mfe_4h: round2(avg(p('mfe_4h'))),
    avg_mae_1h: round2(avg(p('mae_1h'))),
    avg_mae_2h: round2(avg(p('mae_2h'))),
    rate_mfe10_1h: pct(rate(row => row[p('mfe_1h')] >= 10)),
    rate_mfe20_1h: pct(rate(row => row[p('mfe_1h')] >= 20)),
    rate_mfe10_2h: pct(rate(row => row[p('mfe_2h')] >= 10)),
    rate_mfe20_2h: pct(rate(row => row[p('mfe_2h')] >= 20)),
    rate_mfe20_4h: pct(rate(row => row[p('mfe_4h')] >= 20)),
    rate_eod_positive: pct(rate(row => row[p('close_eod')] > 0)),
    rate_next_eod_positive: pct(rate(row => Number.isFinite(row[p('close_next_eod')]) && row[p('close_next_eod')] > 0)),
    rate_eow_positive: pct(rate(row => Number.isFinite(row[p('close_eow')]) && row[p('close_eow')] > 0)),
    avg_close_eod: round2(avg(p('close_eod'))),
    avg_close_next_eod: round2(avg(p('close_next_eod'))),
    avg_close_eow: round2(avg(p('close_eow'))),
    options_quality_score: round2(
      (rate(row => row[p('mfe_2h')] >= 10) * 0.25)
      + (rate(row => row[p('mfe_4h')] >= 20) * 0.20)
      + (rate(row => row[p('close_eod')] > 0) * 0.20)
      + (rate(row => Number.isFinite(row[p('close_next_eod')]) && row[p('close_next_eod')] > 0) * 0.25)
      - (Math.min(1, avg(p('mae_1h')) / 40) * 0.10)
    ),
  };
}

function summarize(rows, filter) {
  const subset = rows.filter(filter.fn);
  const n = subset.length;
  if (!n) return null;
  const rate = pred => subset.filter(pred).length / n;
  const avg = field => subset.reduce((sum, row) => sum + Number(row[field] || 0), 0) / n;
  return {
    filter_id: filter.id,
    filter_label: filter.label,
    triggers: n,
    signal_days: new Set(subset.map(row => row.date)).size,
    avg_prior_taps: round2(avg('prior_tap_groups')),
    avg_flush_depth: round2(avg('flush_depth_points')),
    avg_mae_1h: round2(avg('mae_1h')),
    avg_mae_2h: round2(avg('mae_2h')),
    avg_mfe_1h: round2(avg('mfe_1h')),
    avg_mfe_2h: round2(avg('mfe_2h')),
    avg_mfe_4h: round2(avg('mfe_4h')),
    rate_mfe10_1h: pct(rate(row => row.mfe_1h >= 10)),
    rate_mfe20_1h: pct(rate(row => row.mfe_1h >= 20)),
    rate_mfe10_2h: pct(rate(row => row.mfe_2h >= 10)),
    rate_mfe20_2h: pct(rate(row => row.mfe_2h >= 20)),
    rate_mfe20_4h: pct(rate(row => row.mfe_4h >= 20)),
    rate_eod_positive: pct(rate(row => row.close_eod > 0)),
    rate_next_eod_positive: pct(rate(row => Number.isFinite(row.close_next_eod) && row.close_next_eod > 0)),
    rate_eow_positive: pct(rate(row => Number.isFinite(row.close_eow) && row.close_eow > 0)),
    avg_close_eod: round2(avg('close_eod')),
    avg_close_next_eod: round2(avg('close_next_eod')),
    avg_close_eow: round2(avg('close_eow')),
    options_quality_score: round2(
      (rate(row => row.mfe_2h >= 10) * 0.25)
      + (rate(row => row.mfe_4h >= 20) * 0.20)
      + (rate(row => row.close_eod > 0) * 0.20)
      + (rate(row => Number.isFinite(row.close_next_eod) && row.close_next_eod > 0) * 0.25)
      - (Math.min(1, avg('mae_1h') / 40) * 0.10)
    ),
  };
}

function main() {
  ensureDir(OUT_DIR);
  const trades = parseCsv(path.join(ROOT, 'artifacts', 'research', 'mancini-acceptance-window', 'trades.csv'));
  const rthEvents = parseCsv(path.join(IN_DIR, 'spx-rth-events.csv'));
  const sessionEvents = parseCsv(path.join(IN_DIR, 'spx-session-events.csv'));
  const triggers = uniqueTriggers(trades, rthEvents, sessionEvents);
  const rows = FILTERS.map(filter => summarize(triggers, filter)).filter(Boolean)
    .sort((a, b) => b.options_quality_score - a.options_quality_score || b.triggers - a.triggers);
  const superTriggers = SUPER_TRIGGER_WINDOWS.flatMap(windowMinutes => buildSuperTriggers(triggers, windowMinutes));
  const superRows = [];
  for (const windowMinutes of SUPER_TRIGGER_WINDOWS) {
    const clusters = superTriggers.filter(row => row.super_window_minutes === windowMinutes);
    for (const mode of ['first_entry', 'last_entry']) {
      for (const filter of SUPER_FILTERS) {
        const row = summarizeSuper(clusters, filter, mode);
        if (row) superRows.push(row);
      }
    }
  }
  superRows.sort((a, b) => b.options_quality_score - a.options_quality_score || b.super_triggers - a.super_triggers);
  writeCsv(path.join(OUT_DIR, 'high-confluence-filter-summary.csv'), rows);
  writeCsv(path.join(OUT_DIR, 'high-confluence-trigger-detail.csv'), triggers);
  writeCsv(path.join(OUT_DIR, 'super-trigger-detail.csv'), superTriggers);
  writeCsv(path.join(OUT_DIR, 'super-trigger-filter-summary.csv'), superRows);
  fs.writeFileSync(path.join(OUT_DIR, 'high-confluence-summary.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    purpose: 'SPX options-quality proxy filters for Mancini trigger; underlying-only, no option contract bars',
    success_proxy: {
      short_dated: 'MFE thresholds within 1h/2h/4h, especially 10-20 SPX points',
      swing: 'same-day, next-day, and week-close positive SPX underlying move',
      caveat: 'Actual naked-call returns require option marks/IV/spread data, which are not present here.',
    },
    trigger_count: triggers.length,
    super_trigger_definition: 'Same SPX session date and exact Mancini level; repeated triggers are merged while gaps remain within the tested time window.',
    rows,
    superRows,
  }, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, out_dir: path.relative(ROOT, OUT_DIR), top: rows.slice(0, 8), superTop: superRows.slice(0, 12) }, null, 2));
}

main();
