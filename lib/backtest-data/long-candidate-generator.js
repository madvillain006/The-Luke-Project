'use strict';

// Offline ES long candidate generator.
//
// This does not place trades and does not touch live /entries. It turns a
// frozen session JSON into auditable long candidates with structure-based
// invalidation and multiple stop policies for later backtesting.

const DEFAULTS = {
  tickSize: 0.25,
  levelTolerancePts: 3,
  reclaimCloseBufferPts: 0,
  minTargetDistancePts: 1,
  maxThreeContractRiskPts: 3,
  pointValue: 50,
  contracts: 3,
  atmTapThreshold: 3,
};

function roundToTick(price, tickSize = DEFAULTS.tickSize) {
  return Math.round(Number(price) / tickSize) * tickSize;
}

function normalizeConfig(options = {}) {
  return { ...DEFAULTS, ...(options || {}) };
}

function isManciniLevel(level) {
  return String(level.source || '').toLowerCase().includes('mancini');
}

function isBobbyLevel(level) {
  return String(level.source || '').toLowerCase().includes('bobby');
}

function isSatyLevel(level) {
  return String(level.source || '').toLowerCase().includes('saty');
}

function levelRole(level) {
  return String(level.role || level.label || '').toLowerCase();
}

function isLongRelevantLevel(level) {
  const role = levelRole(level);
  if (role.includes('chop')) return false;
  if (role.includes('resistance')) return false;
  // Keep unclassified Saty/Bobby levels, but require Mancini levels to be
  // support/trap/reclaim/target unless they are already part of a cluster.
  if (isManciniLevel(level)) {
    return /support|trap|reclaim|target|unclassified/.test(role || 'unclassified');
  }
  return true;
}

function normalizeLevels(levels) {
  return (levels || [])
    .map(level => ({ ...level, price: Number(level.price) }))
    .filter(level => Number.isFinite(level.price))
    .filter(isLongRelevantLevel)
    .sort((a, b) => a.price - b.price);
}

function sourceSet(levels) {
  const out = new Set();
  for (const level of levels) {
    if (isManciniLevel(level)) out.add('mancini');
    else if (isBobbyLevel(level)) out.add('bobby');
    else if (isSatyLevel(level)) out.add('saty');
    else out.add(String(level.source || 'unknown'));
  }
  return [...out].sort();
}

function clusterLevels(levels, tolerancePts = DEFAULTS.levelTolerancePts) {
  const sorted = normalizeLevels(levels);
  const clusters = [];
  for (const level of sorted) {
    const existing = clusters.find(cluster => Math.abs(cluster.anchor - level.price) <= tolerancePts);
    if (existing) {
      existing.levels.push(level);
      existing.low = Math.min(existing.low, level.price);
      existing.high = Math.max(existing.high, level.price);
      existing.anchor = existing.levels.reduce((sum, l) => sum + l.price, 0) / existing.levels.length;
      existing.sources = sourceSet(existing.levels);
    } else {
      clusters.push({
        anchor: level.price,
        low: level.price,
        high: level.price,
        levels: [level],
        sources: sourceSet([level]),
      });
    }
  }
  return clusters
    .map(cluster => ({
      ...cluster,
      anchor: roundToTick(cluster.anchor),
      sourceCount: cluster.sources.length,
    }))
    .sort((a, b) => a.anchor - b.anchor);
}

function selectTargets(levels, entry, config = DEFAULTS) {
  const selected = [];
  const seen = new Set();
  for (const level of normalizeLevels(levels)) {
    if (level.price - entry < config.minTargetDistancePts) continue;
    const rounded = roundToTick(level.price, config.tickSize);
    const key = rounded.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ ...level, price: rounded });
    if (selected.length === 3) break;
  }
  return selected;
}

function barsNearCluster(bars, cluster, tolerancePts) {
  return (bars || []).filter(bar =>
    bar.low <= cluster.high + tolerancePts &&
    bar.high >= cluster.low - tolerancePts
  );
}

function buildStopPolicies({ entry, invalidationLow, config }) {
  const buffers = [
    { id: 'structure_1_tick', bufferPts: config.tickSize },
    { id: 'structure_2_ticks', bufferPts: config.tickSize * 2 },
    { id: 'structure_1_point', bufferPts: 1 },
  ];
  return buffers.map(policy => {
    const stop = roundToTick(invalidationLow - policy.bufferPts, config.tickSize);
    const riskPts = roundToTick(entry - stop, config.tickSize);
    const riskDollars = riskPts * config.pointValue * config.contracts;
    return {
      ...policy,
      stop,
      riskPts,
      riskDollars,
      accepted: riskPts > 0 && riskPts <= config.maxThreeContractRiskPts,
      rejectionReason: riskPts <= 0
        ? 'invalid_stop'
        : (riskPts > config.maxThreeContractRiskPts ? 'risk_over_cap' : null),
    };
  });
}

function classifyInteraction({ cluster, bar, nextBar, config }) {
  const sweptBelow = bar.low < cluster.low - config.tickSize;
  const touched = bar.low <= cluster.high + config.levelTolerancePts && bar.high >= cluster.low - config.levelTolerancePts;
  const reclaimed = sweptBelow && (bar.close >= cluster.anchor + config.reclaimCloseBufferPts ||
    (nextBar && nextBar.close >= cluster.anchor + config.reclaimCloseBufferPts));
  if (reclaimed) return 'trap_reclaim';
  if (touched && bar.close >= cluster.anchor && bar.low >= cluster.low - config.levelTolerancePts) return 'support_hold';
  return null;
}

function makeCandidate({ session, cluster, bar, nextBar, index, config }) {
  const triggerType = classifyInteraction({ cluster, bar, nextBar, config });
  if (!triggerType) return null;

  const entryBar = triggerType === 'trap_reclaim' && nextBar?.close >= cluster.anchor ? nextBar : bar;
  const entry = roundToTick(Math.max(cluster.anchor, entryBar.close), config.tickSize);
  const invalidationLow = Math.min(bar.low, nextBar ? nextBar.low : bar.low, cluster.low);
  const stopPolicies = buildStopPolicies({ entry, invalidationLow, config });
  const acceptedStops = stopPolicies.filter(policy => policy.accepted);
  const targets = selectTargets(session.levels || [], entry, config);

  if (acceptedStops.length === 0) return null;
  if (targets.length === 0) return null;

  const sources = cluster.sources;
  return {
    id: `${session.date}-${triggerType}-${index}`,
    date: session.date,
    instrument: 'ES',
    direction: 'long',
    time: entryBar.timestamp,
    triggerType,
    entry,
    invalidationLow: roundToTick(invalidationLow, config.tickSize),
    cluster: {
      anchor: cluster.anchor,
      low: cluster.low,
      high: cluster.high,
      sources,
      sourceCount: cluster.sourceCount,
      levels: cluster.levels,
    },
    sourceLevels: cluster.levels,
    confluenceSources: sources,
    stopPolicies,
    preferredStop: acceptedStops[0],
    targets,
    chopRisk: cluster.levels.some(level => levelRole(level).includes('chop')),
    atmMachine: false,
    atmTapIndex: null,
    atmTapCount: null,
    scalpVariants: [],
    reason: `${triggerType} at ${cluster.anchor} using ${sources.join('+')} confluence`,
  };
}

function buildScalpVariants(candidate, config) {
  const twoPointTarget = roundToTick(candidate.entry + 2, config.tickSize);
  const threePointTarget = roundToTick(candidate.entry + 3, config.tickSize);
  const stop = candidate.preferredStop;
  const makeVariant = (id, target, contracts) => ({
    id,
    contracts,
    entry: candidate.entry,
    stop: stop.stop,
    target,
    rewardPts: roundToTick(target - candidate.entry, config.tickSize),
    riskPts: stop.riskPts,
    riskDollars: stop.riskPts * config.pointValue * contracts,
    rewardDollars: roundToTick(target - candidate.entry, config.tickSize) * config.pointValue * contracts,
    riskRewardOk: stop.riskPts <= roundToTick(target - candidate.entry, config.tickSize),
    rejectionReason: stop.riskPts <= roundToTick(target - candidate.entry, config.tickSize)
      ? null
      : 'scalp_reward_less_than_structural_risk',
  });
  return [
    makeVariant('atm_2_contract_2pt_scalp', twoPointTarget, 2),
    makeVariant('atm_2_contract_3pt_scalp', threePointTarget, 2),
  ];
}

function annotateAtmMachineCandidates(candidates, config) {
  const byCluster = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.date}|${candidate.cluster.anchor}`;
    if (!byCluster.has(key)) byCluster.set(key, []);
    byCluster.get(key).push(candidate);
  }

  for (const group of byCluster.values()) {
    group.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
    group.forEach((candidate, idx) => {
      candidate.atmTapIndex = idx + 1;
      candidate.atmTapCount = idx + 1;
      if (candidate.atmTapIndex >= config.atmTapThreshold) {
        candidate.atmMachine = true;
        candidate.scalpVariants = buildScalpVariants(candidate, config);
      }
    });
  }
  return candidates;
}

function generateLongCandidates(session, options = {}) {
  const config = normalizeConfig(options);
  if (!session || session.usable === false) return [];
  const bars = session.bars?.rth || session.bars?.es || [];
  if (!Array.isArray(bars) || bars.length === 0) return [];

  const clusters = clusterLevels(session.levels || [], config.levelTolerancePts)
    .filter(cluster => cluster.sourceCount >= (options.minSources || 1));

  const candidates = [];
  for (const cluster of clusters) {
    const interacting = barsNearCluster(bars, cluster, config.levelTolerancePts);
    for (const bar of interacting) {
      const index = bars.findIndex(b => b.timestamp === bar.timestamp);
      const nextBar = index >= 0 ? bars[index + 1] : null;
      const candidate = makeCandidate({ session, cluster, bar, nextBar, index, config });
      if (candidate) candidates.push(candidate);
    }
  }

  const seen = new Set();
  const deduped = candidates.filter(candidate => {
    const key = `${candidate.time}|${candidate.cluster.anchor}|${candidate.triggerType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return annotateAtmMachineCandidates(deduped, config);
}

module.exports = {
  DEFAULTS,
  generateLongCandidates,
  clusterLevels,
  selectTargets,
  buildStopPolicies,
  annotateAtmMachineCandidates,
  _internal: {
    roundToTick,
    normalizeLevels,
    sourceSet,
    barsNearCluster,
    classifyInteraction,
    makeCandidate,
    buildScalpVariants,
  },
};
