'use strict';

const { buildActiveSourceContext } = require('../no-lookahead-context');
const { tsMs } = require('../common');
const { sourceCombo, sourceFlags, insideChop, timeBucket, breakdownBucket, reclaimBucket } = require('./filters');

const DEFAULTS = {
  breakdownPoints: 2.0,
  reclaimWindows: [3, 5, 10, 15],
  retestWindowMinutes: 10,
  retestTolerancePoints: 1,
  spxToEsBasis: 30,
};

function normalizeSource(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('bobby')) return 'bobby';
  if (s.includes('mancini')) return 'mancini';
  if (s.includes('saty')) return 'saty';
  if (s.includes('dubz') || s.includes('ximes')) return 'dubz';
  if (s.includes('gex') || s.includes('heatseeker')) return 'heatseeker';
  if (s.includes('kat')) return 'katbot';
  return s || 'unknown';
}

function levelRole(level, event) {
  return String(level.role || level.label || event.source_type || 'level').toLowerCase();
}

function levelType(level, event) {
  const source = normalizeSource(event.source);
  const role = levelRole(level, event);
  if (source === 'saty') return role.includes('trigger') ? role : `saty_${role}`;
  if (source === 'mancini') return role.includes('chop') ? 'mancini_chop_boundary' : `mancini_${role}`;
  if (source === 'bobby') return role.includes('node') ? 'bobby_node' : `bobby_${role}`;
  if (source === 'dubz') return `dubz_${role}`;
  if (source === 'heatseeker') return `heatseeker_${role}`;
  return `${source}_${role}`;
}

function levelFromEvent(event, level, options = {}) {
  const price = Number(level.price);
  if (!Number.isFinite(price)) return null;
  const source = normalizeSource(event.source);
  const eventInstrument = String(event.instrument || level.ticker || '').toUpperCase();
  const role = levelRole(level, event);
  let instrument = eventInstrument.startsWith('SP') ? 'SPX' : (eventInstrument || 'ES');
  let esPrice = price;
  let proxy = null;
  if (instrument === 'SPX' || String(level.ticker || '').toUpperCase().startsWith('SP')) {
    instrument = 'ES';
    esPrice = price + (options.spxToEsBasis ?? DEFAULTS.spxToEsBasis);
    proxy = {
      source_instrument: 'SPX',
      basis_points: options.spxToEsBasis ?? DEFAULTS.spxToEsBasis,
      original_price: price,
      label: 'SPX_reference_to_ES_proxy',
    };
  }
  if (instrument !== 'ES') return null;
  return {
    price: Math.round(esPrice * 100) / 100,
    original_price: price,
    instrument: 'ES',
    source,
    role,
    label: level.label || level.role || event.source_type,
    level_type: levelType(level, event),
    available_at_et: event.available_at_et,
    raw_path: event.raw_path,
    proxy,
  };
}

function trustedLevelsAt(timelineEvents, timestamp, options = {}) {
  const context = buildActiveSourceContext(timelineEvents, timestamp);
  const byPrice = new Map();
  for (const event of context.events || []) {
    for (const rawLevel of event.levels || []) {
      const level = levelFromEvent(event, rawLevel, options);
      if (!level) continue;
      const key = level.price.toFixed(2);
      if (!byPrice.has(key)) {
        byPrice.set(key, {
          price: level.price,
          instrument: 'ES',
          sources: [],
          source_combo: null,
          level_types: [],
          proxy_labels: [],
          first_available_at_et: level.available_at_et,
          latest_available_at_et: level.available_at_et,
        });
      }
      const record = byPrice.get(key);
      record.sources.push(level);
      record.level_types.push(level.level_type);
      if (level.proxy) record.proxy_labels.push(level.proxy);
      if (level.available_at_et < record.first_available_at_et) record.first_available_at_et = level.available_at_et;
      if (level.available_at_et > record.latest_available_at_et) record.latest_available_at_et = level.available_at_et;
      record.source_combo = sourceCombo(record.sources.map(item => item.source));
    }
  }
  return [...byPrice.values()].sort((a, b) => a.price - b.price);
}

function findReclaim(bars, startIndex, level, maxWindowMinutes) {
  const start = tsMs(bars[startIndex].timestamp);
  for (let i = startIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    const elapsed = Math.round((tsMs(bar.timestamp) - start) / 60000);
    if (elapsed > maxWindowMinutes) return null;
    if (bar.close >= level) return { index: i, bar, minutesBelow: elapsed };
  }
  return null;
}

function findRetestHold(bars, reclaimIndex, level, options = {}) {
  const start = tsMs(bars[reclaimIndex].timestamp);
  const maxMs = (options.retestWindowMinutes ?? DEFAULTS.retestWindowMinutes) * 60 * 1000;
  const tolerance = options.retestTolerancePoints ?? DEFAULTS.retestTolerancePoints;
  for (let i = reclaimIndex + 1; i < bars.length; i += 1) {
    const bar = bars[i];
    const elapsed = tsMs(bar.timestamp) - start;
    if (elapsed > maxMs) return null;
    if (bar.low <= level + tolerance && bar.close >= level) return { index: i, bar };
  }
  return null;
}

function nextTrustedLevelAbove(levels, price) {
  return levels
    .map(level => level.price)
    .filter(value => value > price)
    .sort((a, b) => a - b)[0] || null;
}

function detectFakeBreakdownsForSession({ session, timelineEvents, options = {} }) {
  const config = { ...DEFAULTS, ...(options || {}) };
  const bars = session.replayBars || session.bars?.rth || session.bars?.es || [];
  const candidates = [];
  const maxWindow = Math.max(...config.reclaimWindows);
  const activeBreaks = new Set();

  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];
    const prior = bars[i - 1];
    const levels = trustedLevelsAt(timelineEvents, bar.timestamp, config)
      .filter(level => Math.abs(level.price - bar.close) <= 80 || (bar.low <= level.price + 10 && bar.high >= level.price - 10));
    for (const level of levels) {
      const key = `${session.date}:${level.price.toFixed(2)}`;
      const threshold = level.price - config.breakdownPoints;
      const brokeNow = bar.low <= threshold && prior.low > threshold;
      if (!brokeNow || activeBreaks.has(key)) continue;
      activeBreaks.add(key);

      const reclaim = findReclaim(bars, i, level.price, maxWindow);
      const sweepLow = Math.min(...bars.slice(i, reclaim ? reclaim.index + 1 : Math.min(bars.length, i + maxWindow + 1)).map(row => row.low));
      const sourceNames = level.sources.map(source => source.source);
      const flags = sourceFlags(sourceNames);
      const base = {
        id: `${session.date}-${bar.timestamp.slice(11, 16)}-${level.price.toFixed(2)}`,
        strategy: 'fake_breakdown_reclaim_long',
        date: session.date,
        timestamp_et: bar.timestamp,
        instrument: 'ES',
        level,
        level_price: level.price,
        level_sources: [...new Set(sourceNames)].sort(),
        source_combo: sourceCombo(sourceNames),
        source_freshness: {
          first_available_at_et: level.first_available_at_et,
          latest_available_at_et: level.latest_available_at_et,
        },
        breakdown_depth: Math.round((level.price - bar.low) * 100) / 100,
        breakdown_depth_bucket: breakdownBucket(level.price - bar.low),
        breakdown_bar: bar.timestamp,
        sweep_low: sweepLow,
        inside_mancini_chop: insideChop({ level }),
        chop_veto_would_skip: insideChop({ level }),
        bobby_confirmed: flags.bobby_confirmed,
        gex_confirmed: flags.gex_confirmed,
        dubz_aligned: flags.dubz_aligned,
        saty_confirmed: flags.saty_confirmed,
        mancini_confirmed: flags.mancini_confirmed,
        katbot_present: flags.katbot_present,
        time_of_day: timeBucket(bar.timestamp),
        next_trusted_level_above: nextTrustedLevelAbove(levels, level.price),
        invalid_reason: null,
      };
      if (!reclaim) {
        candidates.push({
          ...base,
          valid_reclaim: false,
          reclaim_timestamp_et: null,
          minutes_below_level: null,
          reclaim_window_bucket: 'no_reclaim',
          windows_reclaimed: [],
          invalid_reason: 'no_reclaim_within_15m',
          entry_models: [],
        });
        continue;
      }
      const retest = findRetestHold(bars, reclaim.index, level.price, config);
      candidates.push({
        ...base,
        valid_reclaim: true,
        reclaim_timestamp_et: reclaim.bar.timestamp,
        minutes_below_level: reclaim.minutesBelow,
        reclaim_window_bucket: reclaimBucket(reclaim.minutesBelow),
        windows_reclaimed: config.reclaimWindows.filter(minutes => reclaim.minutesBelow <= minutes),
        entry_models: [
          {
            model: 'reclaim_close',
            timestamp_et: reclaim.bar.timestamp,
            price: reclaim.bar.close,
            bar_index: reclaim.index,
          },
          ...(retest ? [{
            model: 'retest_hold',
            timestamp_et: retest.bar.timestamp,
            price: retest.bar.close,
            bar_index: retest.index,
          }] : []),
        ],
      });
    }
    for (const key of [...activeBreaks]) {
      const levelPrice = Number(key.split(':').pop());
      if (bar.close > levelPrice + config.breakdownPoints) activeBreaks.delete(key);
    }
  }
  return candidates;
}

module.exports = {
  DEFAULTS,
  trustedLevelsAt,
  detectFakeBreakdownsForSession,
  levelFromEvent,
  findReclaim,
  findRetestHold,
  nextTrustedLevelAbove,
};
