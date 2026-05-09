'use strict';

const {
  buildFuturesSessionBars,
  deriveLevelsByDate,
  _internal: satyHistoricalInternal,
} = require('./saty-historical');

const DEFAULT_CONFIG = {
  tickSize: 0.25,
  tp1Points: 2.0,
  tp2Mode: 'next_cluster',
  maxStopPoints: 3.0,
  hardStopPoints: 5.0,
  clusterTolerancePoints: 1.25,
  reclaimHoldBars: 2,
  flushLookbackBars: 12,
  minTargetSpacePoints: 3.0,
  allowTp1RoomCandidate: true,
  antiStuffFilter: true,
  minCloseAboveLevelPoints: 0.25,
  minReclaimCloseLocation: 0.55,
  maxReclaimUpperWickPoints: 3.0,
  enableImpulseReclaimLong: true,
  requireImpulseCloudBreak: true,
  minImpulseBodyPct: 0.45,
  levelTapLookbackBars: 2,
  levelTapTolerancePoints: 0.5,
  reentryCooldownBars: 2,
  failedReentryCooldownBars: 8,
  failedReentryLevelTolerancePoints: 1.25,
  failedReentryResetPoints: 1.0,
  pivotRibbonFilterMode: 'soft_reclaim',
  pivotFastEma: 8,
  pivotEma: 21,
  pivotSlowEma: 34,
  pivotFastConvictionEma: 13,
  pivotSlowConvictionEma: 48,
  pivotBiasEma: 21,
  mixedBarPnlPolicy: 'conservative_stop',
  pnlPointValue: 50,
  contractPlan: 'split_tp1_tp2',
  entrySlippagePoints: 0.25,
  roundTripFeePerContract: 5,
};

const SATY_LEVEL_FIELDS = [
  'prev_close',
  'call_trigger',
  'put_trigger',
  'ext_plus_1',
  'ext_plus_2',
  'ext_plus_3',
  'ext_plus_4',
  'atr_plus_1',
  'ext_minus_1',
  'ext_minus_2',
  'ext_minus_3',
  'ext_minus_4',
  'atr_minus_1',
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    clusterTolerancePoints: Math.min(
      Number(config.clusterTolerancePoints ?? DEFAULT_CONFIG.clusterTolerancePoints),
      3.0,
    ),
    entrySlippagePoints: Number(config.entrySlippagePoints ?? DEFAULT_CONFIG.entrySlippagePoints),
    roundTripFeePerContract: Number(config.roundTripFeePerContract ?? DEFAULT_CONFIG.roundTripFeePerContract),
    pnlPointValue: Number(config.pnlPointValue ?? DEFAULT_CONFIG.pnlPointValue),
  };
}

function buildSatyLevelList(satyLevels) {
  if (!satyLevels?.valid) return [];
  return SATY_LEVEL_FIELDS
    .map(field => ({
      price: Number(satyLevels[field]),
      source: 'saty',
      field,
      fresh: true,
    }))
    .filter(level => Number.isFinite(level.price))
    .sort((a, b) => a.price - b.price);
}

function clusterLevels(rawLevels, config = {}) {
  const cfg = normalizeConfig(config);
  const clusters = [];
  for (const level of [...(rawLevels || [])].sort((a, b) => a.price - b.price)) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const lowEdge = Math.min(last.min, level.price);
      const highEdge = Math.max(last.max, level.price);
      const withinAnchor = Math.abs(level.price - last.price) <= cfg.clusterTolerancePoints;
      const withinWidth = highEdge - lowEdge <= cfg.clusterTolerancePoints;
      if (withinAnchor && withinWidth) {
        const oldStrength = last.strength;
        last.price = round2(((last.price * oldStrength) + level.price) / (oldStrength + 1));
        last.min = lowEdge;
        last.max = highEdge;
        if (!last.sources.includes(level.source)) {
          last.sources.push(level.source);
          last.strength += 1;
        }
        last.fields.push(level.field);
        continue;
      }
    }
    clusters.push({
      id: `${level.source}:${level.field}:${level.price}`,
      price: level.price,
      min: level.price,
      max: level.price,
      sources: [level.source],
      fields: [level.field],
      strength: 1,
      fresh: level.fresh !== false,
    });
  }
  return clusters;
}

function computeEma(values, length) {
  const out = new Array(values.length).fill(null);
  if (!Array.isArray(values) || values.length === 0 || length <= 0) return out;
  const alpha = 2 / (length + 1);
  let ema = values[0];
  out[0] = ema;
  for (let i = 1; i < values.length; i += 1) {
    ema = (values[i] * alpha) + (ema * (1 - alpha));
    out[i] = ema;
  }
  return out;
}

function buildPivotRibbon(bars, config = {}) {
  const cfg = normalizeConfig(config);
  const closes = (bars || []).map(bar => bar.close);
  return {
    fast: computeEma(closes, cfg.pivotFastEma),
    pivot: computeEma(closes, cfg.pivotEma),
    slow: computeEma(closes, cfg.pivotSlowEma),
    fastConviction: computeEma(closes, cfg.pivotFastConvictionEma),
    slowConviction: computeEma(closes, cfg.pivotSlowConvictionEma),
    bias: computeEma(closes, cfg.pivotBiasEma),
  };
}

function valueAt(series, idx) {
  return Array.isArray(series) && idx >= 0 ? series[idx] : null;
}

function pivotRibbonLongOk(bars, idx, ribbon, config = {}) {
  const cfg = normalizeConfig(config);
  if (cfg.pivotRibbonFilterMode === 'off') return true;
  const bar = bars[idx];
  const fast = valueAt(ribbon.fast, idx);
  const pivot = valueAt(ribbon.pivot, idx);
  const slow = valueAt(ribbon.slow, idx);
  const fastConviction = valueAt(ribbon.fastConviction, idx);
  const slowConviction = valueAt(ribbon.slowConviction, idx);
  const bias = valueAt(ribbon.bias, idx);
  const ready = [fast, pivot, slow, fastConviction, slowConviction, bias].every(Number.isFinite);
  if (!ready) return false;
  const abovePivot = bar.close >= pivot;
  const aboveBias = bar.close >= bias;
  const fastCloudBullish = fast >= pivot;
  const slowCloudBullish = pivot >= slow;
  const bullishConviction = fastConviction >= slowConviction;
  const softReclaimOk = abovePivot || bullishConviction || bar.close >= fast || bar.close >= pivot - 1.0;
  if (cfg.pivotRibbonFilterMode === 'soft_reclaim') return softReclaimOk;
  if (cfg.pivotRibbonFilterMode === 'above_pivot') return abovePivot && aboveBias;
  if (cfg.pivotRibbonFilterMode === 'full_bullish') {
    return abovePivot && fastCloudBullish && slowCloudBullish && bullishConviction;
  }
  return abovePivot && aboveBias && (fastCloudBullish || bullishConviction);
}

function pivotCloudBreakNow(bars, idx, ribbon) {
  const bar = bars[idx];
  const prev = bars[idx - 1];
  const fast = valueAt(ribbon.fast, idx);
  const pivot = valueAt(ribbon.pivot, idx);
  const slow = valueAt(ribbon.slow, idx);
  if (![fast, pivot, slow].every(Number.isFinite)) return false;
  const cloudTop = Math.max(fast, pivot, slow);
  return bar.close >= cloudTop && ((prev && prev.close <= cloudTop) || bar.low <= cloudTop);
}

function nextAbove(clusters, level) {
  return clusters.find(cluster => cluster.price > level)?.price ?? null;
}

function barAt(bars, idx) {
  return idx >= 0 && idx < bars.length ? bars[idx] : null;
}

function touchedLevel(bars, idx, level, config = {}) {
  const cfg = normalizeConfig(config);
  const bar = barAt(bars, idx);
  if (!bar) return false;
  return bar.low <= level + cfg.levelTapTolerancePoints && bar.high >= level - cfg.tickSize;
}

function mixedPoints(stop, entry, target, config = {}) {
  const policy = normalizeConfig(config).mixedBarPnlPolicy;
  if (policy === 'target_first') return target - entry;
  if (policy === 'zero') return 0;
  return stop - entry;
}

function accountingEntry(plan, config = {}) {
  const cfg = normalizeConfig(config);
  if (Number.isFinite(plan?.filled_entry)) return Number(plan.filled_entry);
  return round2(Number(plan.entry) + cfg.entrySlippagePoints);
}

function signalEntry(plan) {
  return Number(plan?.entry);
}

function eventCost(contracts, config = {}) {
  const cfg = normalizeConfig(config);
  const commission = round2(contracts * cfg.roundTripFeePerContract);
  const slippage = round2(contracts * cfg.entrySlippagePoints * cfg.pnlPointValue);
  return {
    fees: round2(commission + slippage),
    commission,
    slippage,
  };
}

function buildOutcome(outcome, bar, points, plan, config = {}, contractsOverride = null) {
  const cfg = normalizeConfig(config);
  const contracts = Number.isFinite(contractsOverride)
    ? contractsOverride
    : Number(plan?.contracts || 1);
  const roundedPoints = round2(points);
  const gross = round2(roundedPoints * cfg.pnlPointValue);
  const cost = eventCost(contracts, cfg);
  const fees = cost.fees;
  const net = round2(gross - fees);
  return {
    outcome,
    outcome_timestamp: bar.timestamp,
    points: roundedPoints,
    contracts,
    gross_dollars: gross,
    fees,
    commission_dollars: cost.commission,
    slippage_dollars: cost.slippage,
    dollars: net,
    net_dollars: net,
    entry_slippage_points: cfg.entrySlippagePoints,
    round_trip_fee_per_contract: cfg.roundTripFeePerContract,
  };
}

function evaluateOutcome(bars, startIndex, plan, config = {}) {
  const cfg = normalizeConfig(config);
  const fill = signalEntry(plan);
  if (cfg.contractPlan === 'split_tp1_tp2') {
    let tp1Hit = false;
    let activeStop = plan.stop;
    let realizedPoints = 0;
    for (let i = startIndex + 1; i < bars.length; i += 1) {
      const bar = bars[i];
      const hitStop = bar.low <= activeStop;
      const hitTp1 = bar.high >= plan.tp1;
      const hitTp2 = bar.high >= plan.tp2;

      if (!tp1Hit && hitStop && hitTp1) {
        const stopFirstPoints = (activeStop - fill) * 2;
        const targetFirstPoints = hitTp2
          ? (plan.tp1 - fill) + (plan.tp2 - fill)
          : plan.tp1 - fill;
        const points = cfg.mixedBarPnlPolicy === 'target_first'
          ? targetFirstPoints
          : cfg.mixedBarPnlPolicy === 'zero'
            ? 0
            : stopFirstPoints;
        const contracts = cfg.mixedBarPnlPolicy === 'zero' ? 0 : cfg.mixedBarPnlPolicy === 'target_first' && !hitTp2 ? 1 : 2;
        return buildOutcome(points > 0 ? 'mixed_target_first' : points === 0 ? 'mixed_zero' : 'mixed_stop_first', bar, points, plan, cfg, contracts);
      }
      if (hitTp2) {
        const points = tp1Hit
          ? realizedPoints + (plan.tp2 - fill)
          : (plan.tp1 - fill) + (plan.tp2 - fill);
        return buildOutcome(tp1Hit ? 'tp1_then_tp2' : 'tp2_first', bar, points, plan, cfg, 2);
      }
      if (hitStop && tp1Hit) {
        const points = realizedPoints + (activeStop - fill);
        return buildOutcome('tp1_then_stop', bar, points, plan, cfg, 2);
      }
      if (hitStop) {
        const contracts = tp1Hit ? 1 : 2;
        const points = realizedPoints + ((activeStop - fill) * contracts);
        return buildOutcome(tp1Hit ? 'tp1_then_stop' : 'stop_first', bar, points, plan, cfg, 2);
      }
      if (hitTp1 && !tp1Hit) {
        tp1Hit = true;
        realizedPoints += plan.tp1 - fill;
        activeStop = plan.entry;
      }
    }
    if (tp1Hit) {
      return {
        ...buildOutcome('tp1_open_runner', bars[bars.length - 1], realizedPoints, plan, cfg, 1),
        outcome_timestamp: null,
      };
    }
    return {
      outcome: 'open_or_unresolved',
      outcome_timestamp: null,
      points: null,
      dollars: null,
    };
  }

  for (let i = startIndex + 1; i < bars.length; i += 1) {
    const bar = bars[i];
    const hitStop = bar.low <= plan.stop;
    const hitTp1 = bar.high >= plan.tp1;
    const hitTp2 = bar.high >= plan.tp2;
    if (hitStop && hitTp1) {
      const points = mixedPoints(plan.stop, fill, plan.tp1, config);
      return buildOutcome(points > 0 ? 'mixed_target_first' : points === 0 ? 'mixed_zero' : 'mixed_stop_first', bar, points, plan, config);
    }
    if (hitStop) {
      const points = plan.stop - fill;
      return buildOutcome('stop_first', bar, points, plan, config);
    }
    if (hitTp2) {
      const points = plan.tp2 - fill;
      return buildOutcome('tp2_first', bar, points, plan, config);
    }
    if (hitTp1) {
      const points = plan.tp1 - fill;
      return buildOutcome('tp1_first', bar, points, plan, config);
    }
  }
  return {
    outcome: 'open_or_unresolved',
    outcome_timestamp: null,
    points: null,
    dollars: null,
  };
}

function evaluatePineWatchSession({ bars, satyLevels, config = {} }) {
  const cfg = normalizeConfig(config);
  const sortedBars = [...(bars || [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const rawLevels = buildSatyLevelList(satyLevels);
  const clusters = clusterLevels(rawLevels, cfg);
  const ribbon = buildPivotRibbon(sortedBars, cfg);
  const events = [];
  const trades = [];
  let lastCandidateClosedIndex = null;
  let lastFailedCandidateIndex = null;
  let lastFailedCandidateLevel = null;
  let openTrade = null;
  let previousActiveLevel = null;
  let previousSignals = {
    watch: false,
    armed: false,
    paper: false,
    invalidated: false,
    blocked: false,
  };

  for (let i = 1; i < sortedBars.length; i += 1) {
    const bar = sortedBars[i];
    const prev = sortedBars[i - 1];
    if (openTrade && i > openTrade.startIndex) {
      const outcome = evaluateOutcome(sortedBars.slice(0, i + 1), openTrade.startIndex, openTrade.plan, cfg);
      if (outcome.outcome !== 'open_or_unresolved') {
        const trade = {
          event: 'LONG_CANDIDATE',
          timestamp: openTrade.timestamp,
          level: openTrade.plan.level,
          entry: openTrade.plan.entry,
          filled_entry: openTrade.plan.filled_entry,
          stop: openTrade.plan.stop,
          tp1: openTrade.plan.tp1,
          tp2: openTrade.plan.tp2,
          trigger: openTrade.plan.trigger,
          ...outcome,
        };
        trades.push(trade);
        events.push(trade);
        lastCandidateClosedIndex = i;
        if (outcome.outcome === 'stop_first' || outcome.outcome === 'mixed_stop_first') {
          lastFailedCandidateIndex = i;
          lastFailedCandidateLevel = openTrade.plan.level;
        }
        openTrade = null;
      }
    }

    let watchPlan = null;
    let armedPlan = null;
    let paperPlan = null;
    let blockReason = '';
    let watchSignal = false;
    let armedSignal = false;
    let paperSignal = false;
    let invalidatedSignal = false;
    let blockedSignal = false;
    let rawFlushSignal = false;
    let rawReclaimSignal = false;

    for (const cluster of clusters) {
      const level = cluster.price;
      const nextCluster = nextAbove(clusters, level);
      const targetSpace = Number.isFinite(nextCluster) ? nextCluster - level : cfg.tp1Points * 2.0;
      const entry = level + Math.max(cfg.minCloseAboveLevelPoints, cfg.tickSize);
      const stop = level - Math.min(cfg.maxStopPoints, cfg.hardStopPoints);
      const tp1 = entry + cfg.tp1Points;
      const tp2 = cfg.tp2Mode === 'next_cluster' && Number.isFinite(nextCluster) && nextCluster > tp1
        ? nextCluster
        : entry + cfg.tp1Points * 2.0;
      const plan = {
        level,
        entry: round2(entry),
        filled_entry: round2(entry + cfg.entrySlippagePoints),
        stop: round2(stop),
        tp1: round2(tp1),
        tp2: round2(tp2),
        next_cluster: nextCluster,
        contracts: cfg.contractPlan === 'split_tp1_tp2' ? 2 : 1,
      };

      let recentLevelTap = false;
      for (let tap = 0; tap <= cfg.levelTapLookbackBars; tap += 1) {
        recentLevelTap = recentLevelTap || touchedLevel(sortedBars, i - tap, level, cfg);
      }
      const freshLevelRetest = recentLevelTap && bar.close >= level + cfg.minCloseAboveLevelPoints;
      const failedLevelRecent = Number.isFinite(lastFailedCandidateLevel)
        && Number.isInteger(lastFailedCandidateIndex)
        && Math.abs(level - lastFailedCandidateLevel) <= cfg.failedReentryLevelTolerancePoints
        && i - lastFailedCandidateIndex <= cfg.failedReentryCooldownBars;
      const failedLevelReset = bar.low <= level - cfg.failedReentryResetPoints
        && bar.close >= level + cfg.minCloseAboveLevelPoints;
      const failedChaseBlock = failedLevelRecent && !failedLevelReset;
      const flushEvent = bar.low <= level - cfg.tickSize && prev.close >= level;
      const reclaimEvent = bar.close > level && (prev.close <= level || bar.low <= level - cfg.tickSize);

      let barsSinceFlush = -1;
      let barsSinceReclaim = -1;
      for (let lookback = 0; lookback <= cfg.flushLookbackBars; lookback += 1) {
        const cur = barAt(sortedBars, i - lookback);
        const before = barAt(sortedBars, i - lookback - 1);
        if (!cur || !before) continue;
        const pastFlush = cur.low <= level - cfg.tickSize && before.close >= level;
        const pastReclaim = cur.close > level && (before.close <= level || cur.low <= level - cfg.tickSize);
        if (barsSinceFlush === -1 && pastFlush) barsSinceFlush = lookback;
        if (barsSinceReclaim === -1 && pastReclaim) barsSinceReclaim = lookback;
      }
      const flushBeforeReclaim = barsSinceFlush >= 0
        && barsSinceReclaim >= 0
        && (barsSinceFlush > barsSinceReclaim || (barsSinceFlush === 0 && barsSinceReclaim === 0));
      const reclaimRecent = flushBeforeReclaim
        && barsSinceFlush <= cfg.flushLookbackBars
        && barsSinceReclaim <= cfg.flushLookbackBars;
      let holdAbove = true;
      for (let hold = 0; hold < cfg.reclaimHoldBars; hold += 1) {
        const held = barAt(sortedBars, i - hold);
        holdAbove = holdAbove && Boolean(held && held.close >= level);
      }
      const entryTargetSpace = Number.isFinite(nextCluster) ? nextCluster - entry : cfg.tp1Points * 2.0;
      const candleRange = Math.max(bar.high - bar.low, cfg.tickSize);
      const reclaimCloseLocation = (bar.close - bar.low) / candleRange;
      const reclaimBodyPct = Math.abs(bar.close - bar.open) / candleRange;
      const reclaimUpperWick = bar.high - Math.max(bar.open, bar.close);
      const closeClearedLevel = bar.close >= level + cfg.minCloseAboveLevelPoints;
      const ribbonOk = pivotRibbonLongOk(sortedBars, i, ribbon, cfg);
      const notStuffedReclaim = !cfg.antiStuffFilter || (
        closeClearedLevel
        && reclaimCloseLocation >= cfg.minReclaimCloseLocation
        && reclaimUpperWick <= cfg.maxReclaimUpperWickPoints
        && ribbonOk
      );
      const impulseCloudOk = !cfg.requireImpulseCloudBreak || pivotCloudBreakNow(sortedBars, i, ribbon) || ribbonOk;
      const impulseReclaimHere = cfg.enableImpulseReclaimLong
        && reclaimEvent
        && freshLevelRetest
        && bar.close > bar.open
        && reclaimBodyPct >= cfg.minImpulseBodyPct
        && closeClearedLevel
        && impulseCloudOk
        && ribbonOk;
      const riskPoints = entry - stop;
      const riskOk = riskPoints <= cfg.hardStopPoints;
      const tp1RoomOk = cfg.allowTp1RoomCandidate && (!Number.isFinite(nextCluster) || nextCluster - entry >= cfg.tp1Points);
      const targetOk = (targetSpace >= cfg.minTargetSpacePoints && entryTargetSpace >= cfg.minTargetSpacePoints) || tp1RoomOk;
      const watchHere = flushEvent && targetOk;
      const armedHere = ((reclaimRecent && holdAbove) || impulseReclaimHere)
        && targetOk
        && notStuffedReclaim
        && !failedChaseBlock;
      const paperHere = armedHere && riskOk;
      const invalidHere = reclaimRecent && bar.close < level - cfg.tickSize && prev.close >= level;
      const blockedHere = reclaimRecent && holdAbove && (!targetOk || !notStuffedReclaim || !riskOk || failedChaseBlock);
      let blockedReason = 'blocked';
      if (!targetOk) blockedReason = 'target room';
      else if (!notStuffedReclaim) {
        if (!closeClearedLevel) blockedReason = 'close not clear';
        else if (reclaimCloseLocation < cfg.minReclaimCloseLocation) blockedReason = 'weak close';
        else if (reclaimUpperWick > cfg.maxReclaimUpperWickPoints) blockedReason = 'upper wick';
        else blockedReason = 'pivot ribbon';
      } else if (!riskOk) blockedReason = `risk ${round2(riskPoints)}`;
      else if (failedChaseBlock) blockedReason = 'failed cooldown';

      rawFlushSignal = rawFlushSignal || flushEvent;
      rawReclaimSignal = rawReclaimSignal || reclaimEvent;
      watchSignal = watchSignal || watchHere;
      armedSignal = armedSignal || armedHere;
      paperSignal = paperSignal || paperHere;
      invalidatedSignal = invalidatedSignal || invalidHere;
      blockedSignal = blockedSignal || blockedHere;
      if (blockedHere && !blockReason) blockReason = `${blockedReason} @ ${level.toFixed(2)}`;
      if (paperHere && (!paperPlan || level > paperPlan.level)) {
        paperPlan = {
          ...plan,
          trigger: impulseReclaimHere ? 'impulse_reclaim' : 'reclaim_hold',
          fresh_level_retest: freshLevelRetest,
          failed_chase_block: failedChaseBlock,
        };
      }
      if (armedHere && (!armedPlan || level > armedPlan.level)) armedPlan = { ...plan, trigger: impulseReclaimHere ? 'impulse_reclaim' : 'reclaim_hold' };
      if (watchHere && (!watchPlan || level > watchPlan.level)) watchPlan = { ...plan, trigger: 'flush' };
    }

    const activePlan = paperPlan || armedPlan || watchPlan;
    const watchEvent = watchSignal && !previousSignals.watch;
    const armedEvent = armedSignal && !previousSignals.armed;
    const paperSetupNow = paperSignal && paperPlan;
    const paperEdgeEvent = paperSetupNow && !previousSignals.paper;
    const paperRetestReentry = paperSetupNow
      && paperPlan.fresh_level_retest
      && !paperPlan.failed_chase_block
      && !openTrade
      && Number.isInteger(lastCandidateClosedIndex)
      && i > lastCandidateClosedIndex + cfg.reentryCooldownBars;
    const candidateLevelChanged = paperSetupNow
      && !paperPlan.failed_chase_block
      && !openTrade
      && Number.isFinite(paperPlan.level)
      && Number.isFinite(previousActiveLevel)
      && Math.abs(paperPlan.level - previousActiveLevel) >= cfg.tickSize;
    const longCandidateEvent = paperSetupNow && !openTrade && (paperEdgeEvent || paperRetestReentry || candidateLevelChanged);
    const invalidatedEvent = invalidatedSignal && !previousSignals.invalidated;
    const blockedEvent = blockedSignal && !previousSignals.blocked;

    if (watchEvent && activePlan) {
      events.push({
        event: 'WATCH',
        timestamp: bar.timestamp,
        level: activePlan.level,
        trigger: activePlan.trigger,
      });
    }
    if (armedEvent && activePlan) {
      events.push({
        event: 'ARMED',
        timestamp: bar.timestamp,
        level: activePlan.level,
        trigger: activePlan.trigger,
      });
    }
    if (blockedEvent) {
      events.push({
        event: 'BLOCKED',
        timestamp: bar.timestamp,
        reason: blockReason,
      });
    }
    if (invalidatedEvent && activePlan) {
      events.push({
        event: 'INVALIDATED',
        timestamp: bar.timestamp,
        level: activePlan.level,
      });
    }
    if (longCandidateEvent && paperPlan) {
      const candidateEvent = {
        event: 'LONG_CANDIDATE_OPEN',
        timestamp: bar.timestamp,
        level: paperPlan.level,
        entry: paperPlan.entry,
        filled_entry: paperPlan.filled_entry,
        stop: paperPlan.stop,
        tp1: paperPlan.tp1,
        tp2: paperPlan.tp2,
        trigger: paperPlan.trigger,
      };
      events.push(candidateEvent);
      openTrade = { timestamp: bar.timestamp, startIndex: i, plan: paperPlan };
    }

    previousSignals = {
      watch: watchSignal,
      armed: armedSignal,
      paper: paperSignal,
      invalidated: invalidatedSignal,
      blocked: blockedSignal,
    };
    previousActiveLevel = Number.isFinite(activePlan?.level) ? activePlan.level : null;
  }

  if (openTrade) {
    const outcome = evaluateOutcome(sortedBars, openTrade.startIndex, openTrade.plan, cfg);
    const trade = {
      event: 'LONG_CANDIDATE',
      timestamp: openTrade.timestamp,
      level: openTrade.plan.level,
      entry: openTrade.plan.entry,
      filled_entry: openTrade.plan.filled_entry,
      stop: openTrade.plan.stop,
      tp1: openTrade.plan.tp1,
      tp2: openTrade.plan.tp2,
      trigger: openTrade.plan.trigger,
      ...outcome,
    };
    events.push(trade);
    trades.push(trade);
  }

  return {
    saty: satyLevels,
    config: cfg,
    clusters,
    events,
    trades,
    summary: summarizeTrades(trades, events),
  };
}

function summarizeTrades(trades, events = []) {
  const byOutcome = {};
  for (const trade of trades || []) {
    byOutcome[trade.outcome] = (byOutcome[trade.outcome] || 0) + 1;
  }
  const eventCounts = {};
  for (const event of events || []) {
    eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
  }
  const resolved = (trades || []).filter(trade => Number.isFinite(trade.points));
  const points = resolved.reduce((sum, trade) => sum + trade.points, 0);
  const dollars = resolved.reduce((sum, trade) => sum + trade.dollars, 0);
  const grossDollars = resolved.reduce((sum, trade) => sum + (trade.gross_dollars || 0), 0);
  const fees = resolved.reduce((sum, trade) => sum + (trade.fees || 0), 0);
  return {
    events: events.length,
    trades: trades.length,
    resolved_trades: resolved.length,
    by_outcome: byOutcome,
    event_counts: eventCounts,
    tp1_first_rate: trades.length ? (byOutcome.tp1_first || 0) / trades.length : null,
    stop_first_rate: trades.length ? (byOutcome.stop_first || 0) / trades.length : null,
    total_points: round2(points),
    total_dollars: round2(dollars),
    total_gross_dollars: round2(grossDollars),
    total_fees: round2(fees),
    average_points: resolved.length ? round2(points / resolved.length) : null,
  };
}

function groupBarsBySessionDate(bars) {
  const groups = new Map();
  for (const bar of bars || []) {
    if (!satyHistoricalInternal.isInsideFuturesSession(bar)) continue;
    const date = satyHistoricalInternal.futuresSessionDateForTimestamp(bar.timestamp);
    if (!date) continue;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(bar);
  }
  return groups;
}

function runSatyPineWatchBacktest({ bars, referenceField = 'close', dates = null, config = {} }) {
  const cfg = normalizeConfig(config);
  const sessions = buildFuturesSessionBars(bars);
  const targetDates = dates || sessions.map(session => session.date);
  const levelsByDate = deriveLevelsByDate(bars, targetDates, { referenceField });
  const grouped = groupBarsBySessionDate(bars);
  const sessionResults = [];
  const allEvents = [];
  const allTrades = [];
  for (const date of targetDates) {
    const saty = levelsByDate[date];
    const sessionBars = grouped.get(date) || [];
    if (!saty?.valid || sessionBars.length === 0) {
      sessionResults.push({
        date,
        valid: false,
        error: saty?.error || 'no_session_bars',
        bars: sessionBars.length,
      });
      continue;
    }
    const result = evaluatePineWatchSession({ bars: sessionBars, satyLevels: saty, config: cfg });
    const stampedEvents = result.events.map(event => ({ date, reference_field: referenceField, ...event }));
    const stampedTrades = result.trades.map(trade => ({ date, reference_field: referenceField, ...trade }));
    allEvents.push(...stampedEvents);
    allTrades.push(...stampedTrades);
    sessionResults.push({
      date,
      valid: true,
      bars: sessionBars.length,
      reference_date: saty.reference_date,
      reference_field: referenceField,
      prev_close: saty.prev_close,
      atr_value: saty.atr_value,
      clusters: result.clusters.length,
      summary: result.summary,
    });
  }
  return {
    generated_at: new Date().toISOString(),
    mode: 'historical_replay',
    read_only: true,
    no_live_execution: true,
    formula: {
      pine_file: 'tradingview/history/level-reclaim/luke-level-reclaim-watch.pine',
      saty_previous_close_line: 'previous_close = request.security(..., close[1], ...)',
      atr_line: 'atr_value = request.security(..., ta.atr(14)[1], ...)',
      reference_field: referenceField,
      entry_slippage_points: cfg.entrySlippagePoints,
      round_trip_fee_per_contract: cfg.roundTripFeePerContract,
      dollars_are_net_after_fees: true,
    },
    sessions: sessionResults,
    events: allEvents,
    trades: allTrades,
    summary: {
      reference_field: referenceField,
      sessions_requested: targetDates.length,
      sessions_valid: sessionResults.filter(row => row.valid).length,
      sessions_with_trades: sessionResults.filter(row => row.summary?.trades > 0).length,
      ...summarizeTrades(allTrades, allEvents),
    },
  };
}

function compareReferenceFields(bars, options = {}) {
  const close = runSatyPineWatchBacktest({ ...options, bars, referenceField: 'close' });
  const open = runSatyPineWatchBacktest({ ...options, bars, referenceField: 'open' });
  return {
    generated_at: new Date().toISOString(),
    read_only: true,
    no_live_execution: true,
    current_pine_reference_field: 'close',
    user_hypothesis_reference_field: 'open',
    close_summary: close.summary,
    open_summary: open.summary,
    delta: {
      trades: open.summary.trades - close.summary.trades,
      total_points: round2((open.summary.total_points || 0) - (close.summary.total_points || 0)),
      total_dollars: round2((open.summary.total_dollars || 0) - (close.summary.total_dollars || 0)),
      total_fees: round2((open.summary.total_fees || 0) - (close.summary.total_fees || 0)),
      stop_first_rate: Number.isFinite(open.summary.stop_first_rate) && Number.isFinite(close.summary.stop_first_rate)
        ? round2(open.summary.stop_first_rate - close.summary.stop_first_rate)
        : null,
    },
    close,
    open,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  SATY_LEVEL_FIELDS,
  buildSatyLevelList,
  clusterLevels,
  evaluatePineWatchSession,
  runSatyPineWatchBacktest,
  compareReferenceFields,
  _internal: {
    normalizeConfig,
    computeEma,
    buildPivotRibbon,
    pivotRibbonLongOk,
    pivotCloudBreakNow,
    summarizeTrades,
    groupBarsBySessionDate,
    evaluateOutcome,
    accountingEntry,
  },
};
