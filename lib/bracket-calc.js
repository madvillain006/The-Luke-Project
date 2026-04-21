'use strict';

const INSTRUMENT_SPECS = {
  ES:  { tick: 0.25, dpt: 12.50, defaultTarget: 2,  defaultStop: 1  },
  MES: { tick: 0.25, dpt: 1.25,  defaultTarget: 2,  defaultStop: 1  },
  NQ:  { tick: 0.25, dpt: 5.00,  defaultTarget: 8,  defaultStop: 4  },
  MNQ: { tick: 0.25, dpt: 0.50,  defaultTarget: 8,  defaultStop: 4  },
  SPY: { tick: 0.01, dpt: 1.00,  defaultTarget: 3,  defaultStop: 1.5, shares: 100 },
  SPX: { tick: 0.01, dpt: 100.0, defaultTarget: 3,  defaultStop: 1.5 },
};

function resolveSpec(ticker) {
  if (!ticker) return null;
  return INSTRUMENT_SPECS[ticker.toUpperCase()] || null;
}

function round2(n) { return Math.round(n * 100) / 100; }

function calculateBracket(signal, confluenceZones, currentPrice) {
  const ticker = (signal.ticker || '').toUpperCase();
  const spec = resolveSpec(ticker);
  if (!spec) {
    return { error: `Unknown instrument: ${ticker}` };
  }

  const entry = signal.strike || signal.entry_price || currentPrice;
  if (!entry) return { error: 'No entry price' };

  const direction = signal.direction ||
    (signal.bias === 'BULLISH' ? 'LONG' : signal.bias === 'BEARISH' ? 'SHORT' : null);
  if (!direction) return { error: 'No direction on signal' };

  const hm = (confluenceZones || []).filter(
    z => z.confidence === 'HIGH' || z.confidence === 'MEDIUM'
  );

  let target = null;
  let stop   = null;

  if (direction === 'LONG') {
    const above = hm.filter(z => z.level > entry).sort((a, b) => a.level - b.level);
    const below = hm.filter(z => z.level < entry).sort((a, b) => b.level - a.level);
    if (above.length) target = above[0].level;
    if (below.length) stop   = below[0].level;
  } else {
    const below = hm.filter(z => z.level < entry).sort((a, b) => b.level - a.level);
    const above = hm.filter(z => z.level > entry).sort((a, b) => a.level - b.level);
    if (below.length) target = below[0].level;
    if (above.length) stop   = above[0].level;
  }

  if (target === null) {
    target = direction === 'LONG'
      ? round2(entry + spec.defaultTarget)
      : round2(entry - spec.defaultTarget);
  }
  if (stop === null) {
    stop = direction === 'LONG'
      ? round2(entry - spec.defaultStop)
      : round2(entry + spec.defaultStop);
  }

  const stop_ticks   = Math.round(Math.abs(entry - stop)   / spec.tick);
  const target_ticks = Math.round(Math.abs(target - entry) / spec.tick);

  const multiplier = (ticker === 'SPY') ? (spec.shares || 100) : 1;
  const risk_dollars   = round2(stop_ticks   * spec.dpt * multiplier);
  const reward_dollars = round2(target_ticks * spec.dpt * multiplier);
  const rr_ratio = risk_dollars > 0 ? round2(reward_dollars / risk_dollars) : 0;

  const result = {
    entry:         round2(entry),
    stop:          round2(stop),
    target:        round2(target),
    stop_ticks,
    target_ticks,
    risk_dollars,
    reward_dollars,
    rr_ratio,
    instrument:    ticker,
    tick_size:     spec.tick,
    direction,
  };

  // guard: stop on wrong side of entry
  if (direction === 'LONG' && stop >= entry) {
    return { error: 'Stop above entry for LONG — impossible bracket' };
  }
  if (direction === 'SHORT' && stop <= entry) {
    return { error: 'Stop below entry for SHORT — impossible bracket' };
  }

  if (rr_ratio < 1.0) {
    result.flag = 'reject';
    result.flag_message = 'R:R below 1:1, do not take';
  } else if (rr_ratio < 1.5) {
    result.flag = 'warning';
    result.flag_message = 'R:R below 1:1.5, weak trade';
  }

  return result;
}

module.exports = { calculateBracket };
