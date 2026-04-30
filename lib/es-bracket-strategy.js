'use strict';

const ES_DEFAULTS = {
  tickSize: 0.25,
  pointValue: 50,
  contracts: 3,
  commissionPerContract: 0,
  slippageTicks: 0,
  exitAtClose: true,
};

function roundToTick(price, tickSize = ES_DEFAULTS.tickSize) {
  return Math.round(price / tickSize) * tickSize;
}

function normalizeDirection(direction) {
  const d = String(direction || '').toLowerCase();
  if (d === 'long' || d === 'bullish' || d === 'buy') return 'long';
  if (d === 'short' || d === 'bearish' || d === 'sell') return 'short';
  throw new Error(`Unsupported direction: ${direction}`);
}

function pointsForExit(direction, entry, exitPrice) {
  return direction === 'long' ? exitPrice - entry : entry - exitPrice;
}

function sortTargets(direction, entry, targets) {
  const clean = (targets || [])
    .map(Number)
    .filter(Number.isFinite)
    .filter(price => direction === 'long' ? price > entry : price < entry);

  clean.sort((a, b) => direction === 'long' ? a - b : b - a);
  return clean.slice(0, 3);
}

function selectNextTargets(levels, entry, directionInput, opts = {}) {
  const direction = normalizeDirection(directionInput);
  const tickSize = opts.tickSize || ES_DEFAULTS.tickSize;
  const minDistance = opts.minDistancePts ?? tickSize;
  const dedupeTolerance = opts.dedupeTolerancePts ?? tickSize;
  const sorted = (levels || [])
    .map(level => typeof level === 'number' ? { price: level } : level)
    .filter(level => Number.isFinite(level?.price))
    .filter(level => {
      const distance = direction === 'long' ? level.price - entry : entry - level.price;
      return distance >= minDistance;
    })
    .sort((a, b) => direction === 'long' ? a.price - b.price : b.price - a.price);

  const selected = [];
  for (const level of sorted) {
    if (selected.some(existing => Math.abs(existing.price - level.price) <= dedupeTolerance)) continue;
    selected.push({ ...level, price: roundToTick(level.price, tickSize) });
    if (selected.length === 3) break;
  }
  return selected;
}

function makeFill({ type, timestamp, price, contracts, entry, direction, pointValue, commissionPerContract }) {
  const points = pointsForExit(direction, entry, price) * contracts;
  const grossDollars = points * pointValue;
  const commission = contracts * commissionPerContract;
  return {
    type,
    timestamp,
    price,
    contracts,
    points,
    grossDollars,
    commission,
    netDollars: grossDollars - commission,
  };
}

function simulateEsBracketTrade(params) {
  const cfg = { ...ES_DEFAULTS, ...(params.config || {}) };
  const direction = normalizeDirection(params.direction);
  const bars = Array.isArray(params.bars) ? params.bars : [];
  const entry = roundToTick(Number(params.entry), cfg.tickSize);
  const initialStop = roundToTick(Number(params.stop), cfg.tickSize);
  const targets = sortTargets(direction, entry, params.targets).map(price => roundToTick(price, cfg.tickSize));

  if (!Number.isFinite(entry)) throw new Error('entry is required');
  if (!Number.isFinite(initialStop)) throw new Error('stop is required');
  if (direction === 'long' && initialStop >= entry) throw new Error('long stop must be below entry');
  if (direction === 'short' && initialStop <= entry) throw new Error('short stop must be above entry');
  if (bars.length === 0) {
    return {
      status: 'no_data',
      direction,
      entry,
      initialStop,
      targets,
      events: [],
      fills: [],
      summary: { netPoints: 0, netDollars: 0, filledContracts: 0, remainingContracts: cfg.contracts },
    };
  }

  const events = [];
  const fills = [];
  let entered = false;
  let remaining = cfg.contracts;
  let stop = initialStop;
  let nextTargetIndex = 0;
  let maxFavorable = 0;
  let maxAdverse = 0;

  const slippage = cfg.slippageTicks * cfg.tickSize;
  const entryFill = direction === 'long' ? entry + slippage : entry - slippage;

  for (const bar of bars) {
    if (!entered) {
      const entryHit = direction === 'long' ? bar.high >= entry : bar.low <= entry;
      if (!entryHit) continue;

      entered = true;
      events.push({ type: 'entry', timestamp: bar.timestamp, price: entryFill, contracts: cfg.contracts });

      const sameBarStopHit = direction === 'long' ? bar.low <= stop : bar.high >= stop;
      if (sameBarStopHit) {
        fills.push(makeFill({
          type: 'stop',
          timestamp: bar.timestamp,
          price: stop,
          contracts: remaining,
          entry: entryFill,
          direction,
          pointValue: cfg.pointValue,
          commissionPerContract: cfg.commissionPerContract,
        }));
        events.push({ type: 'conservative_same_bar_stop', timestamp: bar.timestamp, price: stop, contracts: remaining });
        remaining = 0;
        break;
      }
    }

    if (!entered || remaining <= 0) continue;

    const favorable = direction === 'long' ? bar.high - entryFill : entryFill - bar.low;
    const adverse = direction === 'long' ? entryFill - bar.low : bar.high - entryFill;
    maxFavorable = Math.max(maxFavorable, favorable);
    maxAdverse = Math.max(maxAdverse, adverse);

    const stopHit = direction === 'long' ? bar.low <= stop : bar.high >= stop;
    const nextTarget = targets[nextTargetIndex];
    const targetHit = nextTarget != null && (direction === 'long' ? bar.high >= nextTarget : bar.low <= nextTarget);

    // Conservative one-minute assumption: if stop and target are both possible in
    // the same bar, count the stop first.
    if (stopHit) {
      fills.push(makeFill({
        type: 'stop',
        timestamp: bar.timestamp,
        price: stop,
        contracts: remaining,
        entry: entryFill,
        direction,
        pointValue: cfg.pointValue,
        commissionPerContract: cfg.commissionPerContract,
      }));
      events.push({ type: 'stop', timestamp: bar.timestamp, price: stop, contracts: remaining });
      remaining = 0;
      break;
    }

    if (targetHit) {
      fills.push(makeFill({
        type: `tp${nextTargetIndex + 1}`,
        timestamp: bar.timestamp,
        price: nextTarget,
        contracts: 1,
        entry: entryFill,
        direction,
        pointValue: cfg.pointValue,
        commissionPerContract: cfg.commissionPerContract,
      }));
      remaining -= 1;
      events.push({ type: `tp${nextTargetIndex + 1}`, timestamp: bar.timestamp, price: nextTarget, contracts: 1 });

      if (nextTargetIndex === 0) {
        stop = entryFill;
        events.push({ type: 'stop_moved', timestamp: bar.timestamp, price: stop, reason: 'after_tp1' });
      } else if (nextTargetIndex === 1) {
        stop = targets[0];
        events.push({ type: 'stop_moved', timestamp: bar.timestamp, price: stop, reason: 'after_tp2' });
      }
      nextTargetIndex += 1;
      if (remaining <= 0) break;
    }
  }

  if (entered && remaining > 0 && cfg.exitAtClose) {
    const last = bars[bars.length - 1];
    fills.push(makeFill({
      type: 'close',
      timestamp: last.timestamp,
      price: last.close,
      contracts: remaining,
      entry: entryFill,
      direction,
      pointValue: cfg.pointValue,
      commissionPerContract: cfg.commissionPerContract,
    }));
    events.push({ type: 'close', timestamp: last.timestamp, price: last.close, contracts: remaining });
    remaining = 0;
  }

  const netPoints = fills.reduce((sum, fill) => sum + fill.points, 0);
  const netDollars = fills.reduce((sum, fill) => sum + fill.netDollars, 0);
  const stoppedAfterTp = fills.some(fill => fill.type === 'stop') && fills.some(fill => /^tp/.test(fill.type));

  return {
    status: entered ? 'filled' : 'not_triggered',
    direction,
    entry: entryFill,
    initialStop,
    finalStop: stop,
    targets,
    events,
    fills,
    summary: {
      netPoints,
      netDollars,
      filledContracts: cfg.contracts - remaining,
      remainingContracts: remaining,
      maxFavorablePts: maxFavorable,
      maxAdversePts: maxAdverse,
      stoppedAfterTp,
    },
  };
}

module.exports = {
  simulateEsBracketTrade,
  selectNextTargets,
  _internal: {
    roundToTick,
    sortTargets,
    pointsForExit,
  },
};
