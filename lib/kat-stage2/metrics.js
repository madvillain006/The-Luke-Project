'use strict';

function finite(values) {
  return values
    .filter(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)))
    .map(Number);
}

function avg(values) {
  const nums = finite(values);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function median(values) {
  const nums = finite(values).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function rate(count, total) {
  return total ? count / total : null;
}

function profitFactor(results) {
  const wins = finite(results.filter(row => Number(row.gross_points) > 0).map(row => row.gross_points));
  const losses = finite(results.filter(row => Number(row.gross_points) < 0).map(row => Math.abs(row.gross_points)));
  const grossWin = wins.reduce((sum, n) => sum + n, 0);
  const grossLoss = losses.reduce((sum, n) => sum + n, 0);
  return grossLoss > 0 ? grossWin / grossLoss : null;
}

function isBacktestable(row) {
  return row && !['invalid', 'no_fill'].includes(row.outcome);
}

function isSettled(row) {
  return row && ['win', 'loss', 'breakeven', 'closed_explicit'].includes(row.outcome);
}

function summarizeResults(results) {
  const rows = results || [];
  const backtestable = rows.filter(isBacktestable);
  const settled = backtestable.filter(isSettled);
  const pointRows = settled.filter(row => Number.isFinite(Number(row.gross_points)));
  const wins = pointRows.filter(row => Number(row.gross_points) > 0);
  const losses = pointRows.filter(row => Number(row.gross_points) < 0);
  const breakeven = pointRows.filter(row => Number(row.gross_points) === 0);
  const unresolved = rows.filter(row => row.outcome === 'unresolved');
  const partial = rows.filter(row => row.outcome === 'partial');
  const avgWin = avg(wins.map(row => row.gross_points));
  const avgLoss = avg(losses.map(row => row.gross_points));
  return {
    total_results: rows.length,
    backtestable_trades: backtestable.length,
    unbacktestable_trades: rows.length - backtestable.length,
    settled_trades: settled.length,
    point_scored_trades: pointRows.length,
    win_count: wins.length,
    loss_count: losses.length,
    breakeven_count: breakeven.length,
    partial_count: partial.length,
    unresolved_count: unresolved.length,
    hit_rate: rate(wins.length, pointRows.length),
    win_rate: rate(wins.length, wins.length + losses.length),
    average_win_points: avgWin,
    median_win_points: median(wins.map(row => row.gross_points)),
    average_loss_points: avgLoss,
    median_loss_points: median(losses.map(row => row.gross_points)),
    average_win_price_move_pct: avg(wins.map(row => row.price_move_pct)),
    median_win_price_move_pct: median(wins.map(row => row.price_move_pct)),
    average_loss_price_move_pct: avg(losses.map(row => row.price_move_pct)),
    median_loss_price_move_pct: median(losses.map(row => row.price_move_pct)),
    expectancy_points: avg(pointRows.map(row => row.gross_points)),
    average_r: avg(pointRows.map(row => row.r_multiple)),
    median_r: median(pointRows.map(row => row.r_multiple)),
    profit_factor_points: profitFactor(pointRows),
    average_mfe_points: avg(backtestable.map(row => row.mfe_points)),
    average_mae_points: avg(backtestable.map(row => row.mae_points)),
    average_time_to_close_seconds: avg(settled.map(row => row.time_to_close_seconds)),
    median_time_to_close_seconds: median(settled.map(row => row.time_to_close_seconds)),
    average_time_to_target_seconds: avg(pointRows.map(row => row.time_to_target_seconds)),
  };
}

function groupBy(rows, keyFn) {
  const groups = {};
  for (const row of rows || []) {
    const key = keyFn(row) || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return groups;
}

function summarizeGroups(results, keyFn) {
  const out = {};
  const groups = groupBy(results, keyFn);
  for (const [key, rows] of Object.entries(groups)) out[key] = summarizeResults(rows);
  return out;
}

function attachFeatures(results, features) {
  const byTrade = new Map((features || []).map(feature => [feature.trade_id, feature]));
  return (results || []).map(result => ({ ...result, features: byTrade.get(result.trade_id) || null }));
}

function buildStage2Metrics(parsed, linked, backtestResults, features) {
  const enriched = attachFeatures(backtestResults, features);
  return {
    generated_at: new Date().toISOString(),
    inventory: {
      analysts: parsed.analysts.length,
      candidate_trade_calls: parsed.trade_calls.length,
      valid_trade_calls: parsed.trade_calls.filter(row => row.parse_status === 'valid').length,
      partial_trade_calls: parsed.trade_calls.filter(row => row.parse_status === 'partial').length,
      ambiguous_trade_calls: parsed.trade_calls.filter(row => row.parse_status === 'ambiguous').length,
      rejected_messages: parsed.rejected.length,
      trade_updates: linked.trade_updates.length,
      linked_updates: linked.trade_updates.filter(row => row.trade_id).length,
      gains_only_posts: linked.gains_posts.filter(row => row.verification_status === 'gains_only_unverified').length,
      verified_linked_gains: linked.gains_posts.filter(row => row.verification_status === 'linked_to_prior_call').length,
      heatmaps_cataloged: linked.heatmaps.length,
      heatmaps_linked_to_trades: linked.trade_heatmap_links.length,
      option_trade_calls: parsed.trade_calls.filter(row => row.asset_class === 'option' || row.option_contract).length,
      option_backtest_results: backtestResults.filter(row => row.option_ticker).length,
      existing_vision_records: parsed.summary.vision_records || 0,
      heatmaps_hydrated_with_existing_vision: parsed.summary.heatmaps_hydrated_with_vision || 0,
      vision_gains_posts: parsed.summary.vision_gains_posts || 0,
      sybil_context_records: parsed.summary.sybil_context_records || 0,
      sybil_low_signal_records: parsed.summary.sybil_low_signal_records || 0,
    },
    overall: summarizeResults(backtestResults),
    by_analyst: summarizeGroups(backtestResults, row => row.analyst_name || row.analyst_id),
    by_symbol: summarizeGroups(backtestResults, row => row.symbol),
    by_time_of_day: summarizeGroups(enriched, row => row.features?.time_of_day),
    by_heatmap_confluence: summarizeGroups(enriched, row => row.features?.heatmap_confluence_present ? 'with_heatmap' : 'without_heatmap'),
    by_sybil_context: summarizeGroups(enriched, row => row.features?.sybil_context_present ? 'with_sybil_context' : 'without_sybil_context'),
    caveats: [
      'Exploratory research only; no live execution.',
      'Gains-only posts are not counted as verified calls unless linked to a prior call.',
      'Net results are unavailable when commission config is missing.',
      'Same-candle target/stop collisions are ambiguous unless configured otherwise.',
      'Percent metrics are price move percentages, not account returns.',
      'Expectancy and average win/loss exclude unresolved, no-fill, invalid, intrabar-ambiguous, and partially modeled trades.',
      'OCR backfills are disabled unless explicitly authorized; only existing vision/OCR metadata is indexed.',
      'Options are scored with contract bars only when an option ticker and market data are available; otherwise the option result is invalid/unbacktestable.',
    ],
  };
}

module.exports = {
  avg,
  buildStage2Metrics,
  median,
  summarizeGroups,
  summarizeResults,
};
