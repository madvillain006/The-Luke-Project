'use strict';

const fs = require('fs');
const path = require('path');

const { loadSatyLevels } = require('../saty-levels');
const { loadDubzState } = require('../parse-dubz');
const { loadMemory: loadLevelMemory } = require('../level-memory');
const { queryLevelsAcrossEquivalents, scoreLevel } = require('../confluence-engine');
const { computeFuturesEntryZone } = require('../futures-entry-zones');
const { getApexPreTradeFloorBlock } = require('../../trading/risk');

const LUKE_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(LUKE_ROOT, 'data');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');

function dateKey(timestamp, timeZone) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-CA', { timeZone });
}

function todayEt(now) {
  return dateKey(now, 'America/New_York');
}

function todayCt(now) {
  return dateKey(now, 'America/Chicago');
}

function isSameEtDay(timestamp, now) {
  return dateKey(timestamp, 'America/New_York') === todayEt(now);
}

function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function countTodaysBobbyMentions(now) {
  const today = todayEt(now);
  try {
    const memory = loadLevelMemory();
    return (memory.levels || []).reduce((sum, record) => {
      const count = (record.mentions || []).filter(m =>
        m.analyst === 'bobby' &&
        (m.date === today || isSameEtDay(m.timestamp, now))
      ).length;
      return sum + count;
    }, 0);
  } catch {
    return 0;
  }
}

function buildFreshness(now = new Date()) {
  const et = todayEt(now);
  const ct = todayCt(now);

  const saty = loadSatyLevels();
  const dubzState = loadDubzState();
  const dubzCount = dubzState
    ? Object.values(dubzState.instruments || {})
      .reduce((sum, bucket) => sum + ((bucket && bucket.levels) ? bucket.levels.length : 0), 0)
    : 0;

  let bobbyLoaded = false;
  let bobbyCount = countTodaysBobbyMentions(now);
  if (bobbyCount > 0) bobbyLoaded = true;

  const dailyCtx = loadJson(DAILY_CTX_FILE);
  if (dailyCtx && dailyCtx.date === ct && dailyCtx.heatmap) {
    bobbyLoaded = true;
  }

  if (!bobbyLoaded) {
    const legacyLevels = loadJson(TODAY_LEVELS_FILE);
    const legacyBobbyCount = Array.isArray(legacyLevels?.bobby) ? legacyLevels.bobby.length : 0;
    if (legacyLevels && legacyLevels.date === et && legacyBobbyCount > 0) {
      bobbyLoaded = true;
      bobbyCount = legacyBobbyCount;
    }
  }

  return {
    today_et: et,
    saty: {
      loaded: Boolean(saty),
      updated: saty?.updated || null,
    },
    dubz: {
      loaded: dubzCount > 0,
      count: dubzCount,
      date: dubzState?.date || null,
      updated: dubzState?.last_updated || null,
      same_day: dubzState?.date === et,
      persistence: dubzCount > 0 ? 'structural_carry_forward_until_deleted' : null,
    },
    bobby: {
      loaded: bobbyLoaded,
      count: bobbyCount,
      daily_context_loaded: Boolean(dailyCtx && dailyCtx.date === ct && dailyCtx.heatmap),
    },
  };
}

function freshnessVetoes(freshness) {
  const vetoes = [];
  if (!freshness.saty.loaded) {
    vetoes.push({ type: 'stale_or_missing_input', source: 'saty', command: '/saty' });
  }
  if (!freshness.bobby.loaded) {
    vetoes.push({ type: 'stale_or_missing_input', source: 'bobby', command: '/heatmap' });
  }
  return vetoes;
}

function deriveAvoidZones(records) {
  const boundaries = records
    .filter(record => (record.mentions || []).some(m => m.analyst === 'mancini' && m.intent === 'chop_boundary'))
    .map(record => record.canonical_price)
    .sort((a, b) => a - b);

  const zones = [];
  for (let i = 0; i < boundaries.length - 1; i += 2) {
    zones.push({ low: boundaries[i], high: boundaries[i + 1] });
  }
  return zones;
}

function findAvoidZone(price, zones) {
  if (!Number.isFinite(price)) return null;
  return zones.find(zone => price >= zone.low && price <= zone.high) || null;
}

function findDirectionalTarget(level, side, records) {
  const prices = Array.from(new Set((records || []).map(r => r.canonical_price))).sort((a, b) => a - b);
  if (side === 'LONG') return prices.find(price => price > level) ?? null;
  for (let i = prices.length - 1; i >= 0; i -= 1) {
    if (prices[i] < level) return prices[i];
  }
  return null;
}

function buildBaseDecision({ ok, action, reason, instrument, freshness, vetoes = [], evidence = [] }) {
  return {
    ok,
    action,
    reason,
    instrument,
    entry: null,
    acceptable_entry: null,
    stop: null,
    target: null,
    sizing: 'pass',
    confluence: null,
    freshness,
    vetoes,
    evidence,
  };
}

function buildTradeDecision({ instrument, mode = 'manual', currentPrice = null, state = null, now = new Date() } = {}) {
  const normalizedInstrument = String(instrument || '').toUpperCase();
  const freshness = buildFreshness(now);
  const evidence = [{ type: 'freshness', freshness }];

  if (!normalizedInstrument) {
    return buildBaseDecision({
      ok: false,
      action: 'PASS',
      reason: 'instrument is required',
      instrument: normalizedInstrument,
      freshness,
      vetoes: [{ type: 'invalid_request', detail: 'instrument is required' }],
      evidence,
    });
  }

  const inputVetoes = freshnessVetoes(freshness);
  if (inputVetoes.length > 0) {
    const missing = inputVetoes.map(v => v.command).join(', ');
    return buildBaseDecision({
      ok: false,
      action: 'PASS',
      reason: `No fresh decision available for ${normalizedInstrument}. Run ${missing} first.`,
      instrument: normalizedInstrument,
      freshness,
      vetoes: inputVetoes,
      evidence,
    });
  }

  const records = queryLevelsAcrossEquivalents(normalizedInstrument);
  evidence.push({ type: 'level_memory', instrument: normalizedInstrument, records: records.length });
  if (records.length === 0) {
    return buildBaseDecision({
      ok: true,
      action: 'PASS',
      reason: `No levels recorded yet for ${normalizedInstrument}.`,
      instrument: normalizedInstrument,
      freshness,
      evidence,
    });
  }

  const avoidZones = deriveAvoidZones(records);
  evidence.push({ type: 'avoid_zones', zones: avoidZones });

  const ranked = records
    .map(record => ({ record, scored: scoreLevel(record, { currentPrice }) }))
    .sort((a, b) => b.scored.score - a.scored.score);

  const enriched = ranked.map(item => {
    const zone = computeFuturesEntryZone(item.record, {
      instrument: normalizedInstrument,
      currentPrice,
      confluenceGrade: item.scored.grade,
      confluenceScore: item.scored.score,
    });
    const side = zone.entry_window.abort_below != null ? 'LONG' : 'SHORT';
    const stop = zone.entry_window.abort_below ?? zone.entry_window.abort_above;
    const target = findDirectionalTarget(zone.canonical_price, side, records);
    return { item, zone, side, stop, target };
  });

  const best = enriched.find(row => ['full', 'half', 'quarter'].includes(row.zone.sizing_guidance)) || enriched[0];
  if (!best) {
    return buildBaseDecision({
      ok: true,
      action: 'PASS',
      reason: `No actionable levels for ${normalizedInstrument}.`,
      instrument: normalizedInstrument,
      freshness,
      evidence,
    });
  }

  const confluence = {
    anchor: best.zone.canonical_price,
    grade: best.item.scored.grade,
    score: best.item.scored.score,
    flags: best.item.scored.flags,
    breakdown: best.item.scored.breakdown,
    top: enriched.slice(0, 5).map(row => ({
      anchor: row.zone.canonical_price,
      side: row.side,
      grade: row.item.scored.grade,
      score: row.item.scored.score,
      sizing: row.zone.sizing_guidance,
      entry: row.zone.entry_window.optimal_entry,
      acceptable_entry: row.zone.entry_window.acceptable_entry,
      stop: row.stop,
      target: row.target,
    })),
  };
  evidence.push({ type: 'confluence', confluence });

  if (best.zone.sizing_guidance === 'pass') {
    return {
      ok: true,
      action: 'PASS',
      reason: `Best level is ${best.item.scored.grade} grade PASS at ${best.zone.canonical_price}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [],
      evidence,
    };
  }

  const avoidHit = findAvoidZone(best.zone.entry_window.optimal_entry, avoidZones) ||
    findAvoidZone(best.zone.canonical_price, avoidZones);
  if (avoidHit) {
    return {
      ok: false,
      action: 'PASS',
      reason: `Best ${normalizedInstrument} entry sits inside Mancini chop zone ${avoidHit.low}-${avoidHit.high}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [{ type: 'mancini_chop_zone', zone: avoidHit }],
      evidence,
    };
  }

  const floorBlock = state ? getApexPreTradeFloorBlock(state, {
    ticker: normalizedInstrument,
    direction: best.side,
    entry: best.zone.entry_window.optimal_entry,
    stop: best.stop,
    target: best.target ?? best.zone.canonical_price,
  }) : null;
  if (floorBlock) {
    return {
      ok: false,
      action: 'PASS',
      reason: `Apex floor blocked: max loss ${floorBlock.maxLoss.toFixed(0)} would breach floor ${floorBlock.floor.toFixed(0)} + ${floorBlock.buffer}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [{ type: 'apex_floor', floorBlock }],
      evidence,
    };
  }

  return {
    ok: true,
    action: best.side,
    reason: `${best.side} ${normalizedInstrument} ${best.zone.canonical_price} ${best.item.scored.grade} grade ${best.zone.sizing_guidance} size.`,
    instrument: normalizedInstrument,
    entry: best.zone.entry_window.optimal_entry,
    acceptable_entry: best.zone.entry_window.acceptable_entry,
    stop: best.stop,
    target: best.target,
    sizing: best.zone.sizing_guidance,
    confluence,
    freshness,
    vetoes: [],
    evidence,
    mode,
  };
}

module.exports = {
  buildTradeDecision,
  _internal: {
    buildFreshness,
    deriveAvoidZones,
    findDirectionalTarget,
    findAvoidZone,
  },
};
