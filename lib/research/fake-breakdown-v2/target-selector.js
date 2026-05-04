'use strict';

const { rankTargetCandidates } = require('./level-ladder');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function fixedTarget(entryPrice, points) {
  return {
    target_model: `fixed_plus_${points}`,
    tp1: rounded(entryPrice + points),
    tp2: null,
    tp1_points: points,
    tp2_source: null,
    target_distance: points,
    target_confidence: 'mechanical',
  };
}

function rejectReason(candidate, entryPrice, options = {}) {
  const minDistance = options.minDistance ?? 2;
  if (!candidate || !Number.isFinite(candidate.target_price)) return 'missing_target';
  if (candidate.target_price <= entryPrice) return 'target_below_or_at_entry';
  if (candidate.target_price - entryPrice < minDistance) return 'target_too_close';
  if (!options.allowChop && /chop/.test(String(candidate.level_type || '').toLowerCase())) return 'target_inside_chop_veto';
  if (candidate.basis_diagnostic_only) return 'diagnostic_basis_not_strategy_truth';
  if (candidate.basis_method === 'reference_only') return 'reference_only_not_executable';
  return null;
}

function nextApplicableTarget({ ladder, entryPrice, minDistance = 2, allowChop = false }) {
  const candidates = rankTargetCandidates({ ladder, entryPrice, minDistance, allowChop });
  const selected = candidates[0] || null;
  if (!selected) return null;
  return {
    target_model: 'next_applicable_trusted_level',
    tp1: null,
    tp2: selected.target_price,
    tp2_source: selected.source,
    tp2_level_type: selected.level_type,
    target_distance: selected.target_distance,
    target_basis_method: selected.basis_method,
    target_confidence: selected.source_strength >= 4 ? 'medium' : 'low',
    target_raw_path: selected.raw_path,
  };
}

function reactionScalpTargets(entryPrice) {
  return [2, 3, 4].map(points => fixedTarget(entryPrice, points));
}

function levelToLevelTargets({ ladder, entryPrice, trimPoints = 3, minDistance = 3, allowChop = false }) {
  const next = nextApplicableTarget({ ladder, entryPrice, minDistance, allowChop });
  if (!next) return [];
  return [
    {
      target_model: `trim_${trimPoints}_then_next_level`,
      tp1: rounded(entryPrice + trimPoints),
      tp2: next.tp2,
      tp1_points: trimPoints,
      tp2_source: next.tp2_source,
      tp2_level_type: next.tp2_level_type,
      target_distance: next.target_distance,
      target_basis_method: next.target_basis_method,
      target_confidence: next.target_confidence,
      target_raw_path: next.target_raw_path,
    },
  ];
}

function selectTargets({ archetype, ladder, entryPrice, allowChop = false }) {
  if (!Number.isFinite(entryPrice)) return [];
  if (archetype === 'REACTION_SCALP') return reactionScalpTargets(entryPrice);
  if (archetype === 'LEVEL_TO_LEVEL_LONG') {
    return [
      ...levelToLevelTargets({ ladder, entryPrice, trimPoints: 3, minDistance: 3, allowChop }),
      ...levelToLevelTargets({ ladder, entryPrice, trimPoints: 4, minDistance: 4, allowChop }),
    ];
  }
  if (archetype === 'STAGED_LONG') {
    return levelToLevelTargets({ ladder, entryPrice, trimPoints: 3, minDistance: 3, allowChop });
  }
  return [];
}

module.exports = {
  fixedTarget,
  rejectReason,
  nextApplicableTarget,
  reactionScalpTargets,
  levelToLevelTargets,
  selectTargets,
};
