'use strict';

const { tsMs } = require('../common');
const { factsForSession } = require('../prop-fake-breakdown/detector');
const { BASIS_METHODS, convertSpxLevel } = require('../prop-fake-breakdown/basis');

const SOURCE_STRENGTH = {
  saty: 5,
  mancini: 5,
  bobby: 4,
  gex: 4,
  heatseeker: 4,
  dubz: 3,
  katbot: 1,
  unknown: 1,
};

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function sourceStrength(source) {
  return SOURCE_STRENGTH[String(source || '').toLowerCase()] || 1;
}

function sourceCombo(levels) {
  return [...new Set((levels || []).map(level => level.source).filter(Boolean))].sort().join('+') || 'unknown';
}

function ageMinutes(availableAt, timestamp) {
  const a = tsMs(availableAt);
  const b = tsMs(timestamp);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

function executableRowsForFact({ fact, timestamp, esBars, spxBars, allowSpxBasis = false, basisMethods = ['native_es', 'reference_only'] }) {
  if (fact.original_level_instrument === 'ES') {
    return [{
      id: fact.id,
      source: fact.source,
      role: fact.role,
      level_type: fact.level_type,
      original_level: fact.original_level,
      original_level_instrument: 'ES',
      executable_level: fact.original_level,
      basis_method: 'native_es',
      basis: null,
      basis_diagnostic_only: false,
      executable: true,
      source_strength: sourceStrength(fact.source),
      available_at_et: fact.available_at_et,
      raw_path: fact.raw_path,
      age_minutes: ageMinutes(fact.available_at_et, timestamp),
    }];
  }
  if (fact.original_level_instrument !== 'SPX') return [];
  const requested = basisMethods.filter(method => BASIS_METHODS.includes(method));
  if (!allowSpxBasis) {
    return requested.includes('reference_only') || requested.length === 0 ? [{
      id: fact.id,
      source: fact.source,
      role: fact.role,
      level_type: fact.level_type,
      original_level: fact.original_level,
      original_level_instrument: 'SPX',
      executable_level: null,
      basis_method: 'reference_only',
      basis: null,
      basis_diagnostic_only: false,
      executable: false,
      source_strength: sourceStrength(fact.source),
      available_at_et: fact.available_at_et,
      raw_path: fact.raw_path,
      age_minutes: ageMinutes(fact.available_at_et, timestamp),
      unusable_reason: 'SPX reference only; no executable ES conversion requested',
    }] : [];
  }
  return requested.map(method => {
    if (method === 'native_es') return null;
    const converted = convertSpxLevel({
      spxLevel: fact.original_level,
      timestamp,
      esBars,
      spxBars,
      method,
    });
    return {
      id: fact.id,
      source: fact.source,
      role: fact.role,
      level_type: fact.level_type,
      original_level: fact.original_level,
      original_level_instrument: 'SPX',
      executable_level: converted.executable && !converted.diagnostic_only ? converted.executable_level : null,
      diagnostic_level: converted.executable_level,
      basis_method: method,
      basis: converted.basis?.basis ?? null,
      basis_diagnostic_only: converted.diagnostic_only === true,
      executable: converted.executable === true && converted.diagnostic_only !== true,
      source_strength: sourceStrength(fact.source),
      available_at_et: fact.available_at_et,
      raw_path: fact.raw_path,
      age_minutes: ageMinutes(fact.available_at_et, timestamp),
      unusable_reason: converted.executable ? null : converted.basis?.reason || 'basis_unavailable',
    };
  }).filter(Boolean);
}

function dedupeLevels(levels) {
  const grouped = new Map();
  for (const level of levels || []) {
    const keyPrice = Number.isFinite(level.executable_level)
      ? rounded(level.executable_level)
      : `ref:${level.original_level_instrument}:${rounded(level.original_level)}:${level.basis_method}`;
    const key = `${keyPrice}|${level.source}|${level.level_type}|${level.basis_method}`;
    if (!grouped.has(key)) grouped.set(key, level);
  }
  return [...grouped.values()];
}

function buildLevelLadder({
  setup,
  facts,
  timelineEvents,
  sessionDate,
  timestamp,
  esBars,
  spxBars,
  allowSpxBasis = false,
  basisMethods = ['native_es', 'reference_only'],
}) {
  const ts = timestamp || setup?.timestamp_et;
  const rawFacts = facts || factsForSession(timelineEvents || [], sessionDate || setup?.date);
  const activeFacts = rawFacts.filter(fact => tsMs(fact.available_at_et) <= tsMs(ts));
  const levels = dedupeLevels(activeFacts.flatMap(fact => executableRowsForFact({
    fact,
    timestamp: ts,
    esBars,
    spxBars,
    allowSpxBasis,
    basisMethods,
  })));
  const executable = levels.filter(level => level.executable && Number.isFinite(level.executable_level) && !level.basis_diagnostic_only);
  const currentLevel = setup ? {
    executable_level: setup.executable_level,
    source_combo: setup.source_combo,
    level_type: setup.level_type,
    inside_chop: setup.inside_chop,
  } : null;
  const above = executable
    .filter(level => !setup || level.executable_level > setup.executable_level + 0.25)
    .sort((a, b) => a.executable_level - b.executable_level);
  const below = executable
    .filter(level => !setup || level.executable_level < setup.executable_level - 0.25)
    .sort((a, b) => b.executable_level - a.executable_level);
  return {
    timestamp_et: ts,
    current: currentLevel,
    below,
    above,
    reference_only: levels.filter(level => !level.executable && level.basis_method === 'reference_only'),
    diagnostic_only: levels.filter(level => level.basis_diagnostic_only),
    source_combo: sourceCombo(executable),
    all_levels: levels,
  };
}

function rankTargetCandidates({ ladder, entryPrice, minDistance = 2, allowChop = false }) {
  const candidates = (ladder?.above || [])
    .filter(level => Number.isFinite(level.executable_level))
    .filter(level => level.executable_level > entryPrice + minDistance)
    .filter(level => allowChop || !/chop/.test(String(level.level_type || '').toLowerCase()))
    .map(level => ({
      ...level,
      target_price: rounded(level.executable_level),
      target_distance: rounded(level.executable_level - entryPrice),
      rank_score: sourceStrength(level.source) * 10 - Math.abs(level.executable_level - entryPrice) * 0.1 - Math.min(level.age_minutes || 0, 390) * 0.01,
    }))
    .sort((a, b) => {
      if (Math.abs(a.target_distance - b.target_distance) > 0.01) return a.target_distance - b.target_distance;
      return b.rank_score - a.rank_score;
    });
  return candidates;
}

module.exports = {
  SOURCE_STRENGTH,
  sourceStrength,
  executableRowsForFact,
  buildLevelLadder,
  rankTargetCandidates,
  dedupeLevels,
};
