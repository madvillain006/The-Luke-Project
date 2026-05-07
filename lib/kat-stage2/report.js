'use strict';

const fs = require('fs');
const path = require('path');
const { compactText, ensureDir, rel, writeJson, writeText } = require('./io');

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(digits);
  return String(value);
}

function pct(value) {
  return value === null || value === undefined ? 'n/a' : (value * 100).toFixed(1) + '%';
}

function uniquePath(file) {
  if (!fs.existsSync(file)) return file;
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return base + '-' + stamp + ext;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function writeCsv(file, rows, columns) {
  ensureDir(path.dirname(file));
  const lines = [columns.join(',')];
  for (const row of rows || []) {
    lines.push(columns.map(col => csvEscape(row[col])).join(','));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

function topEntries(object, limit = 8) {
  return Object.entries(object || {}).filter(([, row]) => (row?.backtestable_trades || 0) > 0 || (row?.point_scored_trades || 0) > 0).sort((a, b) => {
    const scoredDelta = (b[1]?.point_scored_trades || 0) - (a[1]?.point_scored_trades || 0);
    if (scoredDelta) return scoredDelta;
    return (b[1]?.backtestable_trades || 0) - (a[1]?.backtestable_trades || 0);
  }).slice(0, limit);
}

function topUnsupportedSymbols(unsupported, limit = 12) {
  return Object.entries(unsupported || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function buildMarkdownReport(context) {
  const { discovery, ingestion, sybil, parsed, linked, marketData, features, backtestResults, metrics, config, outputPaths } = context;
  const overall = metrics.overall;
  const lines = [];
  lines.push('# KatBot Stage 2 Research Report');
  lines.push('');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('Offline financial research only. No live trading behavior is added or changed.');
  lines.push('Raw server data stays in ignored local artifact paths; this report summarizes counts and metrics.');
  lines.push('');
  lines.push('## Data Inventory');
  lines.push('');
  lines.push('- KatBot location: `' + (discovery.katbot.location || 'agents/agent-14-kat.js') + '`');
  lines.push('- Raw Kat messages: ' + fmt(ingestion.inventory.kat_raw_messages));
  lines.push('- Manual KatBot analyst paste messages: ' + fmt(ingestion.inventory.manual_analyst_messages || 0));
  lines.push('- Manual Sybil/server context messages: ' + fmt(ingestion.inventory.manual_sybil_messages || 0));
  lines.push('- Discord export messages loaded: ' + fmt(ingestion.inventory.discord_export_messages));
  lines.push('- Deduped Stage 2 messages: ' + fmt(ingestion.inventory.deduped_messages));
  lines.push('- Attachments cataloged on ingested messages: ' + fmt(ingestion.inventory.attachments));
  lines.push('- Analysts observed: ' + fmt(Object.keys(ingestion.inventory.analysts || {}).length));
  lines.push('- Channels observed: ' + fmt(Object.keys(ingestion.inventory.channels || {}).length));
  lines.push('- Heatmaps cataloged: ' + fmt(metrics.inventory.heatmaps_cataloged));
  lines.push('- Gains posts: ' + fmt(linked.gains_posts.length));
  lines.push('- Option trade calls parsed: ' + fmt(metrics.inventory.option_trade_calls));
  lines.push('- Existing vision/OCR rows indexed: ' + fmt(metrics.inventory.existing_vision_records));
  lines.push('- Heatmaps hydrated from existing vision rows: ' + fmt(metrics.inventory.heatmaps_hydrated_with_existing_vision));
  lines.push('- Vision-derived gains posts: ' + fmt(metrics.inventory.vision_gains_posts));
  lines.push('- Sybil context records: ' + fmt(sybil?.summary?.context_records || 0));
  lines.push('- Sybil low-signal records: ' + fmt(sybil?.summary?.low_signal_records || 0));
  lines.push('');
  lines.push('## Parser Summary');
  lines.push('');
  lines.push('- Candidate trade calls: ' + fmt(metrics.inventory.candidate_trade_calls));
  lines.push('- Valid calls: ' + fmt(metrics.inventory.valid_trade_calls));
  lines.push('- Partial calls: ' + fmt(metrics.inventory.partial_trade_calls));
  lines.push('- Ambiguous calls: ' + fmt(metrics.inventory.ambiguous_trade_calls));
  lines.push('- Rejected/non-stage2 messages: ' + fmt(metrics.inventory.rejected_messages));
  lines.push('- Trade updates: ' + fmt(metrics.inventory.trade_updates));
  lines.push('- Linked updates: ' + fmt(metrics.inventory.linked_updates));
  lines.push('- Gains-only unverified: ' + fmt(metrics.inventory.gains_only_posts));
  lines.push('- Linked gains: ' + fmt(metrics.inventory.verified_linked_gains));
  lines.push('');
  lines.push('Supported formats include long/short calls, market/here entries, limit/zone entries, reclaim/breakout/breakdown triggers, SPX/SPY/QQQ/equity option contracts, basic debit spreads, option premium moves, stops, targets, trims, breakeven moves, stopped/closed updates, gains captions, and heatmap captions. Ambiguous messages stay ambiguous.');
  lines.push('OCR backfills are disabled unless explicitly authorized; Stage 2 only indexes existing vision/OCR rows already present on disk.');
  lines.push('');
  lines.push('## Market Data Coverage');
  lines.push('');
  const coverageEntries = Object.entries(marketData.coverage || {});
  for (const [symbol, coverage] of coverageEntries) {
    lines.push('- ' + symbol + ': ' + (coverage.found ? 'found' : 'missing') +
      ', rows=' + fmt(coverage.rows) +
      ', range=' + fmt(coverage.first_timestamp) + ' to ' + fmt(coverage.last_timestamp) +
      ', source=' + fmt(coverage.source_label || coverage.source) +
      (coverage.error ? ', error=' + coverage.error : ''));
  }
  const unsupportedEntries = topUnsupportedSymbols(marketData.unsupported_symbols, 12);
  const unsupportedCount = Object.keys(marketData.unsupported_symbols || {}).length;
  const unsupportedMentions = Object.values(marketData.unsupported_symbols || {}).reduce((sum, count) => sum + count, 0);
  lines.push('- Unsupported symbols not sent to candle adapter: ' + fmt(unsupportedCount) + ' symbols, ' + fmt(unsupportedMentions) + ' parsed mentions.');
  if (unsupportedEntries.length) {
    lines.push('- Unsupported sample: ' + unsupportedEntries.map(([symbol, count]) => symbol + '=' + count).join(', ') +
      (unsupportedCount > unsupportedEntries.length ? ', plus ' + (unsupportedCount - unsupportedEntries.length) + ' more.' : '.'));
  }
  lines.push('');
  lines.push('No-lookahead rule: entries use only candles after the message timestamp. Pre-entry features use only candles fully closed before the call time.');
  lines.push('');
  lines.push('## Backtest Assumptions');
  lines.push('');
  lines.push('- Entry: market/here uses next available candle; levels/zones require post-call touch.');
  lines.push('- Exit: plausible explicit linked close/stop/target updates win first; otherwise plausible target/stop simulation is used when available.');
  lines.push('- Same-candle stop/target policy: `' + config.assumptions.sameCandlePolicy + '`.');
  lines.push('- Max hold: ' + config.assumptions.maxHoldMinutes + ' minutes.');
  lines.push('- Max explicit exit distance: ' + pct(config.assumptions.maxExplicitExitDistancePct));
  lines.push('- Max stop/target distance: ' + pct(config.assumptions.maxStopTargetDistancePct));
  lines.push('- Max option premium explicit exit distance: ' + pct(config.assumptions.maxOptionExplicitExitDistancePct));
  lines.push('- Max option premium stop/target distance: ' + pct(config.assumptions.maxOptionStopTargetDistancePct));
  lines.push('- Heatmap confluence link window: nearest qualifying prior heatmap within ' + fmt(config.assumptions.maxHeatmapLinkMinutes) + ' minutes, requiring same analyst or same symbol family.');
  lines.push('- Commission: ' + (config.assumptions.commission ? JSON.stringify(config.assumptions.commission) : 'not configured; gross only.'));
  lines.push('- Slippage ticks: ' + fmt(config.assumptions.slippageTicks));
  lines.push('- Option contracts: exact contract bars are required for option P&L scoring. Missing expiration/contract bars stay invalid instead of being converted into underlying-proxy P&L.');
  lines.push('');
  lines.push('## Overall Performance');
  lines.push('');
  lines.push('- Backtestable trades: ' + fmt(overall.backtestable_trades) + ' / ' + fmt(overall.total_results));
  lines.push('- Settled point-scored trades: ' + fmt(overall.point_scored_trades));
  lines.push('- Wins: ' + fmt(overall.win_count));
  lines.push('- Losses: ' + fmt(overall.loss_count));
  lines.push('- Partial: ' + fmt(overall.partial_count));
  lines.push('- Unresolved: ' + fmt(overall.unresolved_count));
  lines.push('- Hit rate on settled point-scored trades: ' + pct(overall.hit_rate));
  lines.push('- Win rate excluding breakeven: ' + pct(overall.win_rate));
  lines.push('- Average win points: ' + fmt(overall.average_win_points));
  lines.push('- Average loss points: ' + fmt(overall.average_loss_points));
  lines.push('- Expectancy points: ' + fmt(overall.expectancy_points));
  lines.push('- Average R: ' + fmt(overall.average_r, 3));
  lines.push('- Profit factor: ' + fmt(overall.profit_factor_points, 3));
  lines.push('- Average time to close seconds: ' + fmt(overall.average_time_to_close_seconds));
  lines.push('');
  lines.push('## Analyst Leaderboard');
  lines.push('');
  lines.push('| Analyst | Backtestable | Scored | Wins | Losses | Hit Rate | Expectancy Pts | Avg R | Caveat |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const [analyst, row] of topEntries(metrics.by_analyst, 12)) {
    lines.push('| ' + analyst + ' | ' + fmt(row.backtestable_trades) + ' | ' + fmt(row.point_scored_trades) + ' | ' + fmt(row.win_count) + ' | ' + fmt(row.loss_count) + ' | ' +
      pct(row.hit_rate) + ' | ' + fmt(row.expectancy_points) + ' | ' + fmt(row.average_r, 3) + ' | ' +
      ((row.point_scored_trades || 0) < 20 ? 'low sample: scored trades' : 'sample still exploratory') + ' |');
  }
  lines.push('');
  lines.push('## Symbol Results');
  lines.push('');
  lines.push('| Symbol | Backtestable | Scored | Hit Rate | Expectancy Pts | Avg Win | Avg Loss |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const [symbol, row] of topEntries(metrics.by_symbol, 12)) {
    lines.push('| ' + symbol + ' | ' + fmt(row.backtestable_trades) + ' | ' + fmt(row.point_scored_trades) + ' | ' + pct(row.hit_rate) + ' | ' + fmt(row.expectancy_points) + ' | ' + fmt(row.average_win_points) + ' | ' + fmt(row.average_loss_points) + ' |');
  }
  lines.push('');
  lines.push('## Heatmap Analysis');
  lines.push('');
  lines.push('- Heatmaps cataloged: ' + fmt(metrics.inventory.heatmaps_cataloged));
  lines.push('- Heatmap links to trades: ' + fmt(metrics.inventory.heatmaps_linked_to_trades));
  for (const [bucket, row] of Object.entries(metrics.by_heatmap_confluence || {})) {
    lines.push('- ' + bucket + ': ' + fmt(row.backtestable_trades) + ' backtestable, hit rate ' + pct(row.hit_rate) + ', expectancy ' + fmt(row.expectancy_points));
  }
  lines.push('');
  lines.push('## Sybil Context Analysis');
  lines.push('');
  lines.push('- Sybil is treated as regime/equity/SPX context only, not verified trade calls.');
  lines.push('- Context records: ' + fmt(sybil?.summary?.context_records || 0));
  lines.push('- Attachments cataloged metadata-only: ' + fmt(sybil?.summary?.attachments || 0));
  for (const [tag, count] of Object.entries(sybil?.summary?.tag_counts || {}).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    lines.push('- ' + tag + ': ' + fmt(count));
  }
  for (const [bucket, row] of Object.entries(metrics.by_sybil_context || {})) {
    lines.push('- ' + bucket + ': ' + fmt(row.backtestable_trades) + ' backtestable, hit rate ' + pct(row.hit_rate) + ', expectancy ' + fmt(row.expectancy_points));
  }
  lines.push('');
  lines.push('## Market-Condition Analysis');
  lines.push('');
  for (const [bucket, row] of Object.entries(metrics.by_time_of_day || {})) {
    lines.push('- ' + bucket + ': ' + fmt(row.backtestable_trades) + ' backtestable, hit rate ' + pct(row.hit_rate) + ', expectancy ' + fmt(row.expectancy_points));
  }
  lines.push('');
  lines.push('## Gains Analysis');
  lines.push('');
  lines.push('- Linked gains: ' + fmt(metrics.inventory.verified_linked_gains));
  lines.push('- Gains-only/unverified: ' + fmt(metrics.inventory.gains_only_posts));
  lines.push('Gains-only screenshots/captions are not counted as verified trade calls unless linked to an earlier call.');
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  for (const caveat of metrics.caveats) lines.push('- ' + caveat);
  lines.push('- Missing market data creates invalid/unbacktestable results; no prices are fabricated.');
  lines.push('- Option contract P&L requires exact option bars; otherwise the option result remains invalid/unbacktestable.');
  lines.push('- Heatmap confluence is a conservative metadata link, not proof the analyst used the heatmap.');
  lines.push('- Intrabar ambiguity is not resolved with unavailable lower timeframe data.');
  lines.push('- Option screenshots without explicit contract/timestamp context remain unverified and unscored until linked to a prior call and market data.');
  lines.push('- Any edge is exploratory until validated out of sample.');
  lines.push('');
  lines.push('## Output Files');
  lines.push('');
  for (const [label, file] of Object.entries(outputPaths || {})) lines.push('- ' + label + ': `' + rel(file) + '`');
  lines.push('');
  lines.push('## Sample Parsed Messages');
  lines.push('');
  for (const trade of parsed.trade_calls.slice(0, 5)) {
    lines.push('- ' + compactText([trade.timestamp_utc, trade.analyst_name, trade.normalized_symbol, trade.direction, trade.entry_type, trade.parse_status].join(' | '), 220));
  }
  lines.push('');
  return lines.join('\n');
}

function writeStage2Outputs(context) {
  const artifactDir = context.config.outputs.artifactDir;
  const reportDir = context.config.outputs.reportDir;
  ensureDir(artifactDir);
  ensureDir(reportDir);

  const outputPaths = {
    summary_json: uniquePath(path.join(artifactDir, 'stage2_results_v1.json')),
    parsed_trades_csv: uniquePath(path.join(artifactDir, 'stage2_trades_v1.csv')),
    backtest_csv: uniquePath(path.join(artifactDir, 'stage2_backtest_v1.csv')),
    report_md: uniquePath(path.join(reportDir, 'stage2_report_v1.md')),
  };
  const withPaths = { ...context, outputPaths };
  const report = buildMarkdownReport(withPaths);
  writeJson(outputPaths.summary_json, {
    generated_at: new Date().toISOString(),
    discovery: context.discovery,
    ingestion_inventory: context.ingestion.inventory,
    parser_summary: context.parsed.summary,
    linking_summary: context.linked.summary,
    market_coverage: context.marketData.coverage,
    unsupported_market_symbols: context.marketData.unsupported_symbols,
    sybil_summary: context.sybil.summary,
    metrics: context.metrics,
    assumptions: context.config.assumptions,
  });
  writeCsv(outputPaths.parsed_trades_csv, context.parsed.trade_calls, [
    'trade_id', 'source_message_id', 'analyst_id', 'analyst_name', 'timestamp_utc',
    'normalized_symbol', 'direction', 'entry_type', 'entry_price', 'entry_zone_low', 'entry_zone_high',
    'stop_price', 'take_profit_1', 'take_profit_2', 'parse_status', 'parser_confidence',
    'asset_class', 'option_ticker', 'option_contract',
  ]);
  writeCsv(outputPaths.backtest_csv, context.backtestResults, [
    'trade_id', 'analyst_id', 'analyst_name', 'symbol', 'market_symbol', 'option_ticker', 'direction', 'call_time_utc',
    'assumed_entry_time_utc', 'assumed_entry_price', 'exit_time_utc', 'exit_price', 'outcome',
    'gross_points', 'gross_ticks', 'gross_dollars', 'net_dollars', 'mfe_points', 'mae_points',
    'r_multiple', 'backtest_confidence',
  ]);
  writeText(outputPaths.report_md, report);
  return outputPaths;
}

module.exports = {
  buildMarkdownReport,
  uniquePath,
  writeCsv,
  writeStage2Outputs,
};
