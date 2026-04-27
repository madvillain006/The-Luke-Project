'use strict';

function classifyContext(canonicalRecord) {
  const mentions = canonicalRecord?.mentions || [];
  let longVotes = 0;
  let shortVotes = 0;

  for (const mention of mentions) {
    if (
      mention.direction === 'support' ||
      mention.intent === 'long_trigger' ||
      mention.intent === 'failed_breakdown'
    ) longVotes++;
    if (
      mention.direction === 'resistance' ||
      mention.intent === 'short_trigger' ||
      mention.intent === 'failed_breakout'
    ) shortVotes++;
  }

  if (shortVotes > longVotes) return 'short';
  return 'long';
}

function outcomeForWindow(windowBars, level, tolerancePoints, context) {
  if (!windowBars.length) return null;
  const crossedUp = windowBars.some(bar => bar.low <= level - tolerancePoints && bar.high >= level + tolerancePoints);
  const crossedDown = crossedUp;

  if (context === 'long') {
    const brokeBelow = windowBars.some(bar => bar.low < level - tolerancePoints);
    return brokeBelow ? 'fail' : 'hold';
  }
  const brokeAbove = windowBars.some(bar => bar.high > level + tolerancePoints);
  return brokeAbove ? 'fail' : 'hold';
}

function replayLevelAgainstPriceAction(canonicalRecord, bars, opts = {}) {
  const tolerancePoints = opts.tolerancePoints ?? 1;
  const windowMinutes = opts.windowMinutes ?? 30;
  const windowMs = windowMinutes * 60 * 1000;
  const level = canonicalRecord.canonical_price;

  if (!Array.isArray(bars) || bars.length === 0) {
    return {
      interactions: [],
      summary: {
        total_touches: 0,
        hold_count: 0,
        fail_count: 0,
        hold_rate: 0,
        avg_drawdown_on_hold: 0,
        avg_advance_on_hold: 0,
        worst_drawdown_seen: 0,
      },
    };
  }

  const context = classifyContext(canonicalRecord);
  const interactions = [];
  let active = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const inBand = bar.low <= level + tolerancePoints && bar.high >= level - tolerancePoints;

    if (!active && inBand) {
      active = { startIndex: i, timestamp: bar.timestamp };
      continue;
    }

    if (active) {
      const elapsed = new Date(bar.timestamp).getTime() - new Date(active.timestamp).getTime();
      const timedOut = elapsed > windowMs;
      const leftBand = !inBand;
      const endOfSeries = i === bars.length - 1;
      if (timedOut || leftBand || endOfSeries) {
        const endIndex = endOfSeries && inBand ? i : Math.max(active.startIndex, i - 1);
        const windowBars = bars.slice(active.startIndex, endIndex + 1);
        const firstBar = bars[active.startIndex];
        const lastBar = bars[endIndex];
        const type =
          firstBar.open < level && lastBar.close > level ? 'cross_up' :
          firstBar.open > level && lastBar.close < level ? 'cross_down' :
          lastBar.high >= level + tolerancePoints || lastBar.low <= level - tolerancePoints ? 'rejected' :
          'touch';
        const maxAdvance = context === 'long'
          ? Math.max(...windowBars.map(b => b.high - level))
          : Math.max(...windowBars.map(b => level - b.low));
        const maxDrawdown = context === 'long'
          ? Math.max(...windowBars.map(b => Math.max(0, level - b.low)))
          : Math.max(...windowBars.map(b => Math.max(0, b.high - level)));
        interactions.push({
          timestamp: active.timestamp,
          type,
          bars_within_tolerance: windowBars.length,
          max_drawdown_pts: maxDrawdown,
          max_advance_pts: maxAdvance,
          outcome: outcomeForWindow(windowBars, level, tolerancePoints, context) || 'unknown',
        });
        active = null;
      }
    }
  }

  const holds = interactions.filter(item => item.outcome === 'hold');
  const fails = interactions.filter(item => item.outcome === 'fail');
  return {
    interactions,
    summary: {
      total_touches: interactions.length,
      hold_count: holds.length,
      fail_count: fails.length,
      hold_rate: interactions.length > 0 ? holds.length / interactions.length : 0,
      avg_drawdown_on_hold: holds.length > 0 ? holds.reduce((sum, item) => sum + item.max_drawdown_pts, 0) / holds.length : 0,
      avg_advance_on_hold: holds.length > 0 ? holds.reduce((sum, item) => sum + item.max_advance_pts, 0) / holds.length : 0,
      worst_drawdown_seen: interactions.length > 0 ? Math.max(...interactions.map(item => item.max_drawdown_pts)) : 0,
    },
  };
}

module.exports = {
  replayLevelAgainstPriceAction,
  _internal: {
    classifyContext,
  },
};
