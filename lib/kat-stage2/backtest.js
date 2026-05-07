'use strict';

const {
  getInstrumentSpec,
  grossDollarsForMove,
  netDollars,
  normalizeSymbol,
  priceMovePct,
  signedMovePoints,
  ticksForMove,
} = require('./instruments');
const { backtestMarketSymbol, findFirstCandleAfter } = require('./market-data');
const { toMs } = require('./io');

function directionHit(direction, candle, price, kind) {
  if (!Number.isFinite(Number(price))) return false;
  if (kind === 'target') {
    return direction === 'short' ? candle.low <= price : candle.high >= price;
  }
  return direction === 'short' ? candle.high >= price : candle.low <= price;
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function touched(candle, price) {
  return Number.isFinite(Number(price)) && candle.low <= price && candle.high >= price;
}

function entryFill(trade, candles, assumptions = {}) {
  const after = findFirstCandleAfter(candles, trade.timestamp_utc);
  if (!after.candle) return { filled: false, reason: 'no_candle_after_call', index: -1 };
  const callMs = toMs(trade.timestamp_utc);
  const firstMs = toMs(after.candle.timestamp_utc);
  const entryDeadlineMs = callMs + (assumptions.maxHoldMinutes || 390) * 60 * 1000;
  const type = trade.entry_type || 'unknown';
  if (type === 'market' || (type === 'unknown' && trade.entry_price === null)) {
    const maxLag = assumptions.maxMarketEntryLagMinutes ?? 5;
    if (Number.isFinite(callMs) && Number.isFinite(firstMs) && firstMs - callMs > maxLag * 60 * 1000) {
      return { filled: false, reason: 'market_data_gap_after_call', index: -1 };
    }
    const price = assumptions.marketEntryPrice === 'next_candle_close' ? after.candle.close : after.candle.open;
    return { filled: true, assumed_entry_time_utc: after.candle.timestamp_utc, assumed_entry_price: price, index: after.index, assumptions: ['market_entry_next_available_candle'] };
  }
  if (type === 'zone') {
    for (let i = after.index; i < candles.length; i += 1) {
      const candle = candles[i];
      if (Number.isFinite(entryDeadlineMs) && toMs(candle.timestamp_utc) > entryDeadlineMs) break;
      const overlaps = candle.high >= trade.entry_zone_low && candle.low <= trade.entry_zone_high;
      if (!overlaps) continue;
      let price = (trade.entry_zone_low + trade.entry_zone_high) / 2;
      if (assumptions.zoneFillRule === 'conservative_worst') {
        price = trade.direction === 'short' ? trade.entry_zone_low : trade.entry_zone_high;
      }
      return { filled: true, assumed_entry_time_utc: candle.timestamp_utc, assumed_entry_price: price, index: i, assumptions: ['zone_fill_' + (assumptions.zoneFillRule || 'midpoint')] };
    }
    return { filled: false, reason: 'entry_zone_not_touched', index: -1 };
  }
  if (['limit', 'breakout', 'breakdown', 'market'].includes(type) && Number.isFinite(Number(trade.entry_price))) {
    for (let i = after.index; i < candles.length; i += 1) {
      const candle = candles[i];
      if (Number.isFinite(entryDeadlineMs) && toMs(candle.timestamp_utc) > entryDeadlineMs) break;
      if (type === 'breakout' && trade.direction !== 'short' && candle.high < trade.entry_price) continue;
      if (type === 'breakdown' && trade.direction === 'short' && candle.low > trade.entry_price) continue;
      if (!touched(candle, trade.entry_price) && type === 'limit') continue;
      if (!touched(candle, trade.entry_price) && (type === 'breakout' || type === 'breakdown')) continue;
      return { filled: true, assumed_entry_time_utc: candle.timestamp_utc, assumed_entry_price: trade.entry_price, index: i, assumptions: [type + '_touch_after_call'] };
    }
    return { filled: false, reason: type + '_not_filled', index: -1 };
  }
  return { filled: false, reason: 'entry_rule_unavailable', index: -1 };
}

function maxHoldEndIndex(candles, startIndex, maxHoldMinutes) {
  if (startIndex < 0) return -1;
  const startMs = toMs(candles[startIndex].timestamp_utc);
  const maxMs = startMs + (maxHoldMinutes || 390) * 60 * 1000;
  let end = startIndex;
  for (let i = startIndex; i < candles.length; i += 1) {
    if (toMs(candles[i].timestamp_utc) > maxMs) break;
    end = i;
  }
  return end;
}

function favorableMove(direction, entry, candle) {
  return direction === 'short' ? entry - candle.low : candle.high - entry;
}

function adverseMove(direction, entry, candle) {
  return direction === 'short' ? candle.high - entry : entry - candle.low;
}

function directionallyValidExit(direction, updateType, entryPrice, exitPrice) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) return false;
  if (updateType === 'closed') return true;
  if (updateType === 'target_hit') return direction === 'short' ? exit <= entry : exit >= entry;
  if (updateType === 'stop_hit') return direction === 'short' ? exit >= entry : exit <= entry;
  return true;
}

function samePrice(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}

function isPlausibleExplicitExitPrice(entryPrice, exitPrice, assumptions = {}, direction = null, updateType = null) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0 || exit <= 0) return false;
  const maxDistancePct = assumptions.maxExplicitExitDistancePct ?? 0.03;
  if (Math.abs(exit - entry) / entry > maxDistancePct) return false;
  return direction && updateType ? directionallyValidExit(direction, updateType, entry, exit) : true;
}

function isPlausibleTradeLevel(entryPrice, level, assumptions = {}) {
  const entry = Number(entryPrice);
  const price = Number(level);
  if (!Number.isFinite(entry) || !Number.isFinite(price) || entry <= 0 || price <= 0) return false;
  const maxDistancePct = assumptions.maxStopTargetDistancePct ?? 0.05;
  return Math.abs(price - entry) / entry <= maxDistancePct;
}

function isDirectionalTarget(direction, entryPrice, targetPrice) {
  const entry = Number(entryPrice);
  const target = Number(targetPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(target)) return false;
  return direction === 'short' ? target < entry : target > entry;
}

function isDirectionalStop(direction, entryPrice, stopPrice) {
  const entry = Number(entryPrice);
  const stop = Number(stopPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(stop)) return false;
  return direction === 'short' ? stop >= entry : stop <= entry;
}

function tradeLevelAssumptions(trade, assumptions = {}) {
  if (!String(trade.normalized_symbol || '').startsWith('O:')) return assumptions;
  return {
    ...assumptions,
    maxExplicitExitDistancePct: assumptions.maxOptionExplicitExitDistancePct ?? 5,
    maxStopTargetDistancePct: assumptions.maxOptionStopTargetDistancePct ?? 5,
  };
}

function validateTradeLevels(trade, entry, assumptions = {}) {
  const adjustedAssumptions = tradeLevelAssumptions(trade, assumptions);
  const target = Number(trade.take_profit_1);
  const stop = Number(trade.stop_price);
  const targetPresent = hasNumber(trade.take_profit_1);
  const stopPresent = hasNumber(trade.stop_price);
  const targetPlausible = targetPresent && isPlausibleTradeLevel(entry, target, adjustedAssumptions);
  const stopPlausible = stopPresent && isPlausibleTradeLevel(entry, stop, adjustedAssumptions);
  const hasTarget = targetPlausible && isDirectionalTarget(trade.direction, entry, target);
  const hasStop = stopPlausible && isDirectionalStop(trade.direction, entry, stop);
  return {
    target,
    stop,
    hasTarget,
    hasStop,
    risk_stop_price: hasStop ? stop : null,
    assumptions: [
      targetPresent && !targetPlausible ? 'ignored_implausible_target_price' : null,
      stopPresent && !stopPlausible ? 'ignored_implausible_stop_price' : null,
      targetPlausible && !hasTarget ? 'ignored_wrong_side_target_price' : null,
      stopPlausible && !hasStop ? 'ignored_wrong_side_stop_price' : null,
    ].filter(Boolean),
  };
}

function resolveExplicitExit(trade, linkedUpdates, entryPrice, assumptions = {}) {
  const adjustedAssumptions = tradeLevelAssumptions(trade, assumptions);
  const tradeOptionTicker = trade.option_contract?.option_ticker || trade.option_ticker || null;
  const updates = (linkedUpdates || [])
    .filter(update => update.trade_id === trade.trade_id)
    .sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));
  for (const update of updates) {
    if (['closed', 'stop_hit', 'target_hit'].includes(update.update_type) && Number.isFinite(Number(update.price))) {
      if (tradeOptionTicker && update.option_ticker && tradeOptionTicker !== update.option_ticker) continue;
      if (!isPlausibleExplicitExitPrice(entryPrice, update.price, adjustedAssumptions, trade.direction, update.update_type)) continue;
      return {
        exit_time_utc: update.timestamp_utc,
        exit_price: Number(update.price),
        outcome: samePrice(entryPrice, update.price)
          ? 'breakeven'
          : (update.update_type === 'stop_hit' ? 'loss' : (update.update_type === 'target_hit' ? 'win' : 'closed_explicit')),
        assumptions: ['explicit_update_' + update.update_type],
      };
    }
  }
  return null;
}

function simulateExit(trade, candles, entry, startIndex, assumptions = {}) {
  const explicit = resolveExplicitExit(trade, assumptions.linkedUpdates, entry, assumptions);
  if (explicit) return explicit;
  const breakevenUpdates = (assumptions.linkedUpdates || [])
    .filter(update => update.trade_id === trade.trade_id && update.update_type === 'moved_to_breakeven')
    .map(update => toMs(update.timestamp_utc))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const breakevenMs = breakevenUpdates[0] || null;
  const endIndex = maxHoldEndIndex(candles, startIndex, assumptions.maxHoldMinutes || 390);
  const levelValidation = validateTradeLevels(trade, entry, assumptions);
  const { target, stop, hasTarget, hasStop } = levelValidation;
  const levelAssumptions = levelValidation.assumptions;
  let mfe = 0;
  let mae = 0;
  let targetHit = false;
  let targetTime = null;
  let targetPrice = null;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const candle = candles[i];
    const effectiveStop = breakevenMs && toMs(candle.timestamp_utc) >= breakevenMs ? entry : stop;
    mfe = Math.max(mfe, favorableMove(trade.direction, entry, candle));
    mae = Math.max(mae, adverseMove(trade.direction, entry, candle));
    const stopHit = hasStop && directionHit(trade.direction, candle, effectiveStop, 'stop');
    const targetTouched = hasTarget && directionHit(trade.direction, candle, target, 'target');
    if (stopHit && targetTouched && !targetHit) {
      if ((assumptions.sameCandlePolicy || 'intrabar_ambiguous') === 'stop_first') {
        return { outcome: 'loss', exit_price: effectiveStop, exit_time_utc: candle.timestamp_utc, mfe_points: mfe, mae_points: mae, assumptions: [...levelAssumptions, 'same_candle_stop_first'] };
      }
      return { outcome: 'intrabar_ambiguous', exit_price: null, exit_time_utc: candle.timestamp_utc, mfe_points: mfe, mae_points: mae, assumptions: [...levelAssumptions, 'same_candle_stop_and_target'] };
    }
    if (targetTouched && !targetHit) {
      targetHit = true;
      targetTime = candle.timestamp_utc;
      targetPrice = target;
      if (!trade.partial_exit_plan) {
        return { outcome: 'win', exit_price: target, exit_time_utc: candle.timestamp_utc, mfe_points: mfe, mae_points: mae, time_to_target_utc: targetTime, assumptions: [...levelAssumptions, 'target_hit'] };
      }
    }
    if (stopHit) {
      const isBreakeven = samePrice(effectiveStop, entry);
      return {
        outcome: isBreakeven ? 'breakeven' : (targetHit ? 'partial' : 'loss'),
        exit_price: effectiveStop,
        exit_time_utc: candle.timestamp_utc,
        mfe_points: mfe,
        mae_points: mae,
        time_to_target_utc: targetTime,
        assumptions: [...levelAssumptions, isBreakeven ? 'stop_moved_to_breakeven' : (targetHit ? 'partial_target_then_stop' : 'stop_hit')],
      };
    }
  }
  const last = candles[endIndex] || candles[candles.length - 1];
  return {
    outcome: targetHit ? 'partial' : 'unresolved',
    exit_price: targetHit ? targetPrice : (last ? last.close : null),
    exit_time_utc: targetHit ? targetTime : (last ? last.timestamp_utc : null),
    mfe_points: mfe,
    mae_points: mae,
    time_to_target_utc: targetTime,
    assumptions: [...levelAssumptions, targetHit ? 'target_hit_no_final_exit' : 'max_hold_expired_or_data_ended'],
  };
}

function buildInvalidResult(trade, reason, extras = {}) {
  const row = trade || {};
  return {
    trade_id: row.trade_id || null,
    analyst_id: row.analyst_id || null,
    symbol: row.normalized_symbol || null,
    market_symbol: extras.market_symbol || null,
    option_ticker: row.option_contract?.option_ticker || null,
    option_contract: row.option_contract || null,
    direction: row.direction || null,
    call_time_utc: row.timestamp_utc || null,
    outcome: 'invalid',
    parser_confidence: row.parser_confidence || null,
    backtest_confidence: 0,
    assumptions_used: [reason],
    data_quality_flags: [reason],
    ...extras,
  };
}

function marketSymbolForTrade(trade, marketData) {
  const optionTicker = trade.option_contract?.option_ticker;
  if (optionTicker && marketData.bySymbol?.[optionTicker]?.length) return optionTicker;
  return backtestMarketSymbol(trade.normalized_symbol);
}

function simulationTradeForMarket(trade, marketSymbol) {
  if (!String(marketSymbol || '').startsWith('O:')) return trade;
  return {
    ...trade,
    normalized_symbol: marketSymbol,
    direction: 'long',
    entry_type: Number.isFinite(Number(trade.option_contract?.entry_premium)) ? 'limit' : 'market',
    entry_price: Number.isFinite(Number(trade.option_contract?.entry_premium)) ? Number(trade.option_contract.entry_premium) : null,
    stop_price: trade.stop_price,
    take_profit_1: Number.isFinite(Number(trade.option_contract?.exit_premium)) ? Number(trade.option_contract.exit_premium) : trade.take_profit_1,
  };
}

function backtestTrade(trade, marketData, assumptions = {}) {
  if (!trade || trade.parse_status === 'ambiguous') return buildInvalidResult(trade, 'ambiguous_trade_not_backtested');
  if (!trade.normalized_symbol || !['long', 'short'].includes(trade.direction)) return buildInvalidResult(trade, 'missing_symbol_or_direction');
  if (trade.option_contract) {
    if ((trade.option_contract.spread_legs || []).length > 1) {
      return buildInvalidResult(trade, 'multi_leg_option_spread_pricing_unavailable');
    }
    const optionTicker = trade.option_contract.option_ticker;
    if (!optionTicker) return buildInvalidResult(trade, 'option_contract_ticker_unavailable');
    if (!marketData.bySymbol?.[optionTicker]?.length) {
      return buildInvalidResult(trade, 'option_contract_market_data_missing_' + optionTicker, { market_symbol: optionTicker });
    }
  }
  const marketSymbol = marketSymbolForTrade(trade, marketData);
  const simTrade = simulationTradeForMarket(trade, marketSymbol);
  const candles = marketData.bySymbol?.[marketSymbol] || [];
  if (!candles.length) return buildInvalidResult(trade, 'market_data_missing_' + marketSymbol);

  const fill = entryFill(simTrade, candles, assumptions);
  if (!fill.filled) {
    return {
      ...buildInvalidResult(trade, fill.reason),
      outcome: 'no_fill',
      backtest_confidence: 0.3,
    };
  }

  const exit = simulateExit(simTrade, candles, fill.assumed_entry_price, fill.index, assumptions);
  const points = Number.isFinite(Number(exit.exit_price))
    ? signedMovePoints(simTrade.direction, fill.assumed_entry_price, exit.exit_price)
    : null;
  const contracts = trade.size_contracts || assumptions.defaultContracts || 1;
  const grossDollars = points === null ? null : grossDollarsForMove(marketSymbol, points, contracts);
  const slippageCost = slippageDollars(marketSymbol, contracts, assumptions.slippageTicks || 0);
  const net = assumptions.commission
    ? netDollars(grossDollars, assumptions.commission, contracts, slippageCost)
    : null;
  const levelValidation = validateTradeLevels(simTrade, fill.assumed_entry_price, assumptions);
  const riskPoints = hasNumber(levelValidation.risk_stop_price)
    ? Math.abs(fill.assumed_entry_price - Number(levelValidation.risk_stop_price))
    : null;
  const rMultiple = Number.isFinite(Number(points)) && Number.isFinite(Number(riskPoints)) && riskPoints > 0
    ? points / riskPoints
    : null;
  const entryMs = toMs(fill.assumed_entry_time_utc);
  const exitMs = toMs(exit.exit_time_utc);
  return {
    trade_id: trade.trade_id,
    analyst_id: trade.analyst_id,
    analyst_name: trade.analyst_name,
    symbol: trade.normalized_symbol,
    market_symbol: marketSymbol,
    option_ticker: trade.option_contract?.option_ticker || null,
    option_contract: trade.option_contract || null,
    direction: trade.direction,
    call_time_utc: trade.timestamp_utc,
    assumed_entry_time_utc: fill.assumed_entry_time_utc,
    assumed_entry_price: fill.assumed_entry_price,
    stop_price: trade.stop_price,
    target_prices: [trade.take_profit_1, trade.take_profit_2, trade.take_profit_3, ...(trade.take_profit_more || [])].filter(Number.isFinite),
    exit_time_utc: exit.exit_time_utc,
    exit_price: exit.exit_price,
    outcome: exit.outcome,
    gross_points: points,
    net_points: points,
    gross_ticks: points === null ? null : ticksForMove(marketSymbol, points),
    net_ticks: points === null ? null : ticksForMove(marketSymbol, points),
    gross_dollars: grossDollars,
    net_dollars: net,
    commission_paid: assumptions.commission ? require('./instruments').roundTripCommission(assumptions.commission, contracts) : null,
    slippage_paid: slippageCost || 0,
    mfe_points: exit.mfe_points ?? null,
    mae_points: exit.mae_points ?? null,
    mfe_ticks: exit.mfe_points === undefined ? null : ticksForMove(marketSymbol, exit.mfe_points),
    mae_ticks: exit.mae_points === undefined ? null : ticksForMove(marketSymbol, exit.mae_points),
    bars_to_close: Number.isFinite(entryMs) && Number.isFinite(exitMs) ? Math.max(0, Math.round((exitMs - entryMs) / 60000)) : null,
    time_to_close_seconds: Number.isFinite(entryMs) && Number.isFinite(exitMs) ? Math.max(0, Math.round((exitMs - entryMs) / 1000)) : null,
    time_to_target_seconds: exit.time_to_target_utc && Number.isFinite(entryMs) ? Math.round((toMs(exit.time_to_target_utc) - entryMs) / 1000) : null,
    r_multiple: rMultiple,
    price_move_pct: Number.isFinite(Number(exit.exit_price)) ? priceMovePct(simTrade.direction, fill.assumed_entry_price, exit.exit_price) : null,
    parser_confidence: trade.parser_confidence,
    backtest_confidence: backtestConfidence(trade, exit, candles),
    assumptions_used: [...(fill.assumptions || []), ...(exit.assumptions || []), ...levelValidation.assumptions.filter(note => !(exit.assumptions || []).includes(note)), assumptions.commission ? 'commission_applied' : 'commission_unavailable_gross_only'],
    data_quality_flags: [
      ...(marketData.coverage?.[marketSymbol]?.replay ? ['replay_market_data'] : []),
      assumptions.commission ? null : 'net_unavailable_commission_missing',
      exit.outcome === 'intrabar_ambiguous' ? 'same_candle_stop_target' : null,
    ].filter(Boolean),
  };
}

function slippageDollars(symbol, contracts, slippageTicks) {
  const spec = getInstrumentSpec(symbol);
  if (!spec || !Number.isFinite(spec.tick_value)) return 0;
  return Number(slippageTicks || 0) * spec.tick_value * Number(contracts || 1);
}

function backtestConfidence(trade, exit, candles) {
  let score = 0.4;
  if (trade.entry_price !== null || trade.entry_type === 'market' || trade.entry_type === 'zone') score += 0.15;
  if (trade.stop_price !== null) score += 0.1;
  if (trade.take_profit_1 !== null) score += 0.1;
  if (exit.outcome !== 'intrabar_ambiguous') score += 0.1;
  if (candles.length > 10) score += 0.05;
  return Math.min(0.95, Math.round(score * 100) / 100);
}

function backtestTrades(trades, marketData, assumptions = {}) {
  return trades.map(trade => backtestTrade(trade, marketData, assumptions));
}

module.exports = {
  backtestTrade,
  backtestTrades,
  directionallyValidExit,
  entryFill,
  isPlausibleExplicitExitPrice,
  isPlausibleTradeLevel,
  simulateExit,
  validateTradeLevels,
};
