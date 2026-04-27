'use strict';

const { _internal: { gradeFromScore } } = require('./confluence-engine');
const { _internal: { classifyContext } } = require('./level-replay');

const TICK_SIZE = {
  ES: 0.25,
  NQ: 0.25,
};

const GRADE_RULES = {
  A: { entryTicks: 1, acceptableTicks: 3, abortTicks: 8, sizing: 'full', defaultDrawdownPts: 2.0 },
  B: { entryTicks: 2, acceptableTicks: 5, abortTicks: 10, sizing: 'half', defaultDrawdownPts: 2.5 },
  C: { entryTicks: 4, acceptableTicks: 8, abortTicks: 12, sizing: 'quarter', defaultDrawdownPts: 3.0 },
  D: { entryTicks: 4, acceptableTicks: 8, abortTicks: 12, sizing: 'pass', defaultDrawdownPts: 3.0 },
  F: { entryTicks: 4, acceptableTicks: 8, abortTicks: 12, sizing: 'pass', defaultDrawdownPts: 3.0 },
};

function roundPrice(price) {
  return Math.round(price * 100) / 100;
}

function computeFuturesEntryZone(canonicalRecord, opts = {}) {
  const instrument = opts.instrument;
  const tickSize = TICK_SIZE[instrument] || 0.25;
  const canonicalPrice = canonicalRecord.canonical_price;
  const confluenceGrade = opts.confluenceGrade || gradeFromScore(opts.confluenceScore || 0);
  const rules = GRADE_RULES[confluenceGrade] || GRADE_RULES.F;
  const context = classifyContext(canonicalRecord);
  const direction = context === 'short' ? -1 : 1;

  const replayWorst = opts.historicalReplay?.summary?.worst_drawdown_seen;
  const replayAvg = opts.historicalReplay?.summary?.avg_drawdown_on_hold;
  const worstDrawdownToRespect = Math.max(
    Number.isFinite(replayWorst) ? replayWorst : 0,
    rules.defaultDrawdownPts
  );

  const optimalEntry = roundPrice(canonicalPrice + (direction * rules.entryTicks * tickSize));
  const acceptableEntry = roundPrice(canonicalPrice + (direction * rules.acceptableTicks * tickSize));
  const abortDistance = Math.max(worstDrawdownToRespect, rules.abortTicks * tickSize);

  const entry_window = context === 'short'
    ? {
        optimal_entry: optimalEntry,
        acceptable_entry: acceptableEntry,
        abort_above: roundPrice(optimalEntry + abortDistance),
        abort_below: null,
      }
    : {
        optimal_entry: optimalEntry,
        acceptable_entry: acceptableEntry,
        abort_above: null,
        abort_below: roundPrice(optimalEntry - abortDistance),
      };

  const entryPremiumVsLevel = Math.abs(optimalEntry - canonicalPrice);
  const reasoning = `${confluenceGrade} grade ${instrument} ${context} setup. ` +
    `${rules.sizing} size. ` +
    `Enter ${entryPremiumVsLevel.toFixed(2)} pts past level for confirmation.`;

  return {
    canonical_price: canonicalPrice,
    entry_window,
    sizing_guidance: rules.sizing,
    reasoning,
    futures_specific: {
      tick_size: tickSize,
      worst_drawdown_to_respect_pts: worstDrawdownToRespect,
      avg_drawdown_pts: Number.isFinite(replayAvg) ? replayAvg : null,
      entry_premium_vs_level: entryPremiumVsLevel,
    },
  };
}

module.exports = {
  computeFuturesEntryZone,
};
