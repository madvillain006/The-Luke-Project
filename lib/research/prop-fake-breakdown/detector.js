'use strict';

const { tsMs } = require('../common');
const { BASIS_METHODS, convertSpxLevel } = require('./basis');

const BREAKDOWN_DEPTHS = [1, 2, 3, 5];
const RECLAIM_WINDOWS = [3, 5, 10, 15];

function minuteKey(timestamp) {
  return String(timestamp || '').slice(0, 16);
}

function eventDate(event) {
  return String(event.available_at_et || event.timestamp_et || '').slice(0, 10);
}

function normalizeSource(source) {
  const value = String(source || '').toLowerCase();
  if (value.includes('saty')) return 'saty';
  if (value.includes('mancini')) return 'mancini';
  if (value.includes('bobby')) return 'bobby';
  if (value.includes('dubz') || value.includes('ximes')) return 'dubz';
  if (value.includes('heatseeker') || value.includes('gex')) return 'gex';
  if (value.includes('kat')) return 'katbot';
  return value || 'unknown';
}

function roleOf(event, level) {
  return String(level.role || level.label || event.source_type || 'level').toLowerCase();
}

function factFromLevel(event, rawLevel, sessionDate) {
  const source = normalizeSource(event.source);
  const price = Number(rawLevel.price);
  if (!Number.isFinite(price)) return null;
  if (source === 'katbot') return null;
  const instrumentText = String(event.instrument || rawLevel.ticker || '').toUpperCase();
  const originalInstrument = instrumentText.startsWith('SP') ? 'SPX' : (instrumentText || 'ES');
  const role = roleOf(event, rawLevel);
  const levelType = source === 'saty'
    ? role
    : `${source}_${role}`;
  return {
    id: `${event.id}:${price}:${role}`,
    source,
    role,
    level_type: levelType,
    original_level: price,
    original_level_instrument: originalInstrument,
    available_at_et: event.available_at_et,
    raw_path: event.raw_path,
    source_type: event.source_type,
    session_date: sessionDate,
  };
}

function factsForSession(timelineEvents, sessionDate) {
  const facts = [];
  for (const event of timelineEvents || []) {
    if (!event.usable_for_replay) continue;
    if (!Array.isArray(event.levels) || event.levels.length === 0) continue;
    const date = eventDate(event);
    const isSessionSaty = event.id === `saty:${sessionDate}`;
    const isSessionDateOnly = event.tags?.includes('date_only_context') && date === sessionDate;
    const isSameDay = date === sessionDate;
    if (!isSessionSaty && !isSessionDateOnly && !isSameDay) continue;
    for (const level of event.levels) {
      const fact = factFromLevel(event, level, sessionDate);
      if (fact) facts.push(fact);
    }
  }
  return facts.sort((a, b) => (a.available_at_et < b.available_at_et ? -1 : a.available_at_et > b.available_at_et ? 1 : 0));
}

function executableLevelFacts({ fact, timestamp, esBars, spxBars, allowSpxBasis = false }) {
  if (fact.original_level_instrument === 'ES') {
    return [{
      ...fact,
      executable_level: fact.original_level,
      basis_method: 'native_es',
      basis: null,
      basis_diagnostic_only: false,
      basis_available: true,
      spx_reference_only: false,
    }];
  }
  if (fact.original_level_instrument !== 'SPX') return [];
  if (!allowSpxBasis) {
    return [{
      ...fact,
      executable_level: null,
      basis_method: 'reference_only',
      basis: null,
      basis_diagnostic_only: false,
      basis_available: false,
      basis_reason: 'SPX reference only; prop evaluator does not convert SPX levels into ES executable levels',
      spx_reference_only: true,
    }];
  }
  return BASIS_METHODS.map(method => {
    const converted = convertSpxLevel({
      spxLevel: fact.original_level,
      timestamp,
      esBars,
      spxBars,
      method,
    });
    return {
      ...fact,
      executable_level: converted.executable_level,
      basis_method: method,
      basis: converted.basis?.basis ?? null,
      basis_diagnostic_only: converted.diagnostic_only === true,
      basis_available: converted.basis?.available === true,
      basis_reason: converted.basis?.reason || null,
      spx_reference_only: method === 'reference_only',
    };
  });
}

function isSpxHeatmapEvent(event) {
  if (event?.source !== 'bobby') return false;
  const type = String(event.source_type || '').toLowerCase();
  const tags = event.tags || [];
  const instrument = String(event.instrument || '').toUpperCase();
  return instrument === 'SPX' && (
    type.includes('heatmap') ||
    type.includes('image') ||
    tags.includes('heatmap') ||
    tags.includes('has_image')
  );
}

function barByMinute(bars) {
  const out = new Map();
  for (const bar of bars || []) out.set(minuteKey(bar.timestamp), bar);
  return out;
}

function nearestLevel(levels, price) {
  if (!Number.isFinite(price) || !levels.length) return null;
  return levels
    .map(level => Number(level.price))
    .filter(Number.isFinite)
    .sort((a, b) => Math.abs(a - price) - Math.abs(b - price))[0] ?? null;
}

function spxHeatmapComparisonsForSession({ session, timelineEvents, spxBars }) {
  const esByMinute = barByMinute(session.replayBars || session.bars?.rth || session.bars?.es || []);
  const spxByMinute = barByMinute(spxBars || []);
  const rows = [];
  for (const event of timelineEvents || []) {
    if (!isSpxHeatmapEvent(event)) continue;
    if (eventDate(event) !== session.date) continue;
    const timestamp = event.available_at_et || event.timestamp_et;
    const minute = minuteKey(timestamp);
    const es = esByMinute.get(minute);
    const spx = spxByMinute.get(minute);
    const levels = Array.isArray(event.levels)
      ? event.levels.filter(level => Number.isFinite(Number(level.price)))
      : [];
    const nearest = nearestLevel(levels, spx?.close);
    rows.push({
      event_id: event.id,
      timestamp_et: timestamp,
      minute,
      raw_path: event.raw_path,
      source_type: event.source_type,
      parsed: event.source_type === 'bobby_cached_parsed_heatmap',
      level_count: levels.length,
      es_close: es?.close ?? null,
      spx_close: spx?.close ?? null,
      es_minus_spx: es && spx ? Math.round((es.close - spx.close) * 100) / 100 : null,
      nearest_spx_level: nearest,
      nearest_spx_level_distance: Number.isFinite(nearest) && spx
        ? Math.round((nearest - spx.close) * 100) / 100
        : null,
      comparison_available: Boolean(es && spx),
      comparison_reason: es && spx ? 'same_minute_es_spx_heatmap_comparison' : 'missing_same_minute_es_or_spx_bar',
      conversion_used: false,
    });
  }
  return rows.sort((a, b) => a.timestamp_et < b.timestamp_et ? -1 : a.timestamp_et > b.timestamp_et ? 1 : 0);
}

function findReclaim(bars, startIndex, level, maxWindow) {
  const start = tsMs(bars[startIndex].timestamp);
  for (let i = startIndex; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWindow) return null;
    if (bars[i].close >= level) return { index: i, bar: bars[i], minutes: elapsed };
  }
  return null;
}

function findLimitEntry(bars, reclaimIndex, price, maxWait = 10) {
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 1; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].low <= price && bars[i].high >= price) return { index: i, bar: bars[i], price };
  }
  return null;
}

function findRetestHold(bars, reclaimIndex, level, maxWait = 10) {
  const start = tsMs(bars[reclaimIndex].timestamp);
  for (let i = reclaimIndex + 1; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxWait) return null;
    if (bars[i].low <= level + 0.25 && bars[i].close >= level) return { index: i, bar: bars[i], price: Math.max(level, bars[i].close) };
  }
  return null;
}

function nextLevelAbove(activeLevels, price) {
  return activeLevels
    .filter(level => level.basis_method !== 'fixed_plus_30_proxy')
    .map(level => level.executable_level)
    .filter(level => Number.isFinite(level) && level > price + 0.25)
    .sort((a, b) => a - b)[0] || null;
}

function sourceCombo(sources) {
  return [...new Set(sources || [])].sort().join('+') || 'unknown';
}

function detectSetupsForSession({ session, timelineEvents, spxBars }) {
  const bars = session.replayBars || session.bars?.rth || session.bars?.es || [];
  const facts = factsForSession(timelineEvents, session.date);
  const heatmapComparisons = spxHeatmapComparisonsForSession({ session: { ...session, replayBars: bars }, timelineEvents, spxBars });
  const heatmapByMinute = new Map(heatmapComparisons.map(row => [row.minute, row]));
  const setups = [];
  const active = [];
  let factIndex = 0;
  const seen = new Set();

  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];
    while (factIndex < facts.length && tsMs(facts[factIndex].available_at_et) <= tsMs(bar.timestamp)) {
      active.push(facts[factIndex]);
      factIndex += 1;
    }
    if (!active.length) continue;
    const executableFacts = active
      .flatMap(fact => executableLevelFacts({ fact, timestamp: bar.timestamp, esBars: bars, spxBars, allowSpxBasis: false }))
      .filter(fact => Number.isFinite(fact.executable_level));
    const heatmapComparison = heatmapByMinute.get(minuteKey(bar.timestamp)) || null;

    for (const fact of executableFacts) {
      for (const depth of BREAKDOWN_DEPTHS) {
        const threshold = fact.executable_level - depth;
        const brokeNow = bar.low <= threshold && bars[i - 1].low > threshold;
        if (!brokeNow) continue;
        const id = `${session.date}:${bar.timestamp}:${fact.id}:${fact.basis_method}:${depth}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const reclaim = findReclaim(bars, i, fact.executable_level, 15);
        const sweepBars = reclaim ? bars.slice(i, reclaim.index + 1) : bars.slice(i, Math.min(bars.length, i + 16));
        const sweepLow = Math.min(...sweepBars.map(row => row.low));
        const activeNear = executableFacts.filter(level =>
          Number.isFinite(level.executable_level) &&
          level.executable_level > fact.executable_level &&
          level.executable_level - fact.executable_level <= 100 &&
          level.basis_method !== 'fixed_plus_30_proxy'
        );
        const nextTrusted = nextLevelAbove(activeNear, fact.executable_level);
        const sourceSet = heatmapComparison?.comparison_available
          ? [fact.source, 'bobby']
          : [fact.source];
        const insideChop = fact.source === 'mancini' && /chop/.test(fact.role);
        const setup = {
          id,
          strategy: 'prop_fake_breakdown_reclaim_long_v1',
          date: session.date,
          timestamp_et: bar.timestamp,
          instrument: 'ES',
          level: fact.original_level,
          executable_level: fact.executable_level,
          original_level_instrument: fact.original_level_instrument,
          basis_method: fact.basis_method,
          basis: fact.basis,
          basis_diagnostic_only: fact.basis_diagnostic_only,
          basis_available: fact.basis_available,
          basis_reason: fact.basis_reason,
          level_sources: sourceSet,
          source_combo: sourceCombo(sourceSet),
          level_type: fact.level_type,
          source_freshness: { available_at_et: fact.available_at_et, raw_path: fact.raw_path },
          inside_chop: insideChop,
          breakdown_depth_test: depth,
          breakdown_depth_actual: Math.round((fact.executable_level - bar.low) * 100) / 100,
          breakdown_timestamp_et: bar.timestamp,
          sweep_low: sweepLow,
          reclaim_timestamp: reclaim?.bar.timestamp || null,
          minutes_below_level: reclaim?.minutes ?? null,
          reclaim_windows: reclaim ? RECLAIM_WINDOWS.filter(window => reclaim.minutes <= window) : [],
          valid_reclaim: Boolean(reclaim),
          next_trusted_level_above: nextTrusted,
          spx_heatmap_minute_comparison: heatmapComparison,
          invalid_reason: reclaim ? null : 'no_reclaim_within_15m',
          entry_points: [],
        };
        if (reclaim) {
          setup.entry_points.push({
            entry_model: 'reclaim_close',
            entry_timestamp_et: reclaim.bar.timestamp,
            entry_price: reclaim.bar.close,
            fill_assumption: 'close of reclaim candle',
          });
          const limitPrice = Math.round((fact.executable_level + 0.25) * 100) / 100;
          const limit = findLimitEntry(bars, reclaim.index, limitPrice);
          if (limit) {
            setup.entry_points.push({
              entry_model: 'level_reclaim_limit',
              entry_timestamp_et: limit.bar.timestamp,
              entry_price: limit.price,
              fill_assumption: 'post-reclaim limit touched at L+0.25',
            });
          }
          const retest = findRetestHold(bars, reclaim.index, fact.executable_level);
          if (retest) {
            setup.entry_points.push({
              entry_model: 'retest_hold',
              entry_timestamp_et: retest.bar.timestamp,
              entry_price: retest.price,
              fill_assumption: 'post-reclaim retest held above level',
            });
          }
        }
        setups.push(setup);
      }
    }
  }
  return setups;
}

module.exports = {
  BREAKDOWN_DEPTHS,
  RECLAIM_WINDOWS,
  factsForSession,
  executableLevelFacts,
  spxHeatmapComparisonsForSession,
  detectSetupsForSession,
  findReclaim,
  findLimitEntry,
  findRetestHold,
};
