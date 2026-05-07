'use strict';

const path = require('path');
const { defaultStage2Config } = require('./config');
const { discoverStage2 } = require('./discover');
const { ingestStage2Messages } = require('./ingest');
const { parseStage2Messages } = require('./parser');
const { filterOutSybilMessages, parseSybilContexts } = require('./sybil');
const { linkStage2 } = require('./linking');
const { hydrateParsedWithVision } = require('./ocr');
const { loadMarketDataForTrades } = require('./market-data');
const { computeFeaturesForTrades } = require('./features');
const { backtestTrades } = require('./backtest');
const { buildStage2Metrics } = require('./metrics');
const { writeJson, writeJsonl } = require('./io');
const { uniquePath, writeStage2Outputs } = require('./report');

async function buildStage2Context(options = {}) {
  const config = options.config || defaultStage2Config(options);
  const discovery = discoverStage2(config);
  const ingestion = ingestStage2Messages(config, options);
  const sybil = parseSybilContexts(ingestion.messages);
  const parsed = parseStage2Messages(filterOutSybilMessages(ingestion.messages));
  const hydrated = hydrateParsedWithVision(parsed, { rootDir: config.rootDir });
  const parsedWithOcr = hydrated.parsed;
  const ocr = hydrated.ocr;
  parsedWithOcr.summary = {
    ...parsedWithOcr.summary,
    sybil_context_records: sybil.summary.context_records,
    sybil_low_signal_records: sybil.summary.low_signal_records,
  };
  const linked = linkStage2(parsedWithOcr, config.assumptions);
  const marketData = await loadMarketDataForTrades(linked.trade_calls, options.marketData || {});
  const features = computeFeaturesForTrades(linked.trade_calls, marketData, linked.trade_heatmap_links, sybil.contexts);
  const backtestResults = backtestTrades(linked.trade_calls, marketData, {
    ...config.assumptions,
    linkedUpdates: linked.trade_updates,
  });
  const metrics = buildStage2Metrics(parsedWithOcr, linked, backtestResults, features);
  return {
    config,
    discovery,
    ingestion,
    sybil,
    parsed: parsedWithOcr,
    ocr,
    linked,
    marketData,
    features,
    backtestResults,
    metrics,
  };
}

async function runStage2(command = 'run-all', options = {}) {
  const context = await buildStage2Context(options);
  const artifactDir = context.config.outputs.artifactDir;
  const artifactPath = name => uniquePath(path.join(artifactDir, name));
  if (command === 'discover') {
    writeJson(artifactPath('stage2_discovery_v1.json'), context.discovery);
    return { ok: true, command, context, outputPaths: {} };
  }
  if (command === 'ingest') {
    writeJson(artifactPath('stage2_ingestion_inventory_v1.json'), context.ingestion.inventory);
    writeJsonl(artifactPath('stage2_raw_messages_v1.jsonl'), context.ingestion.messages);
    return { ok: true, command, context, outputPaths: {} };
  }
  if (command === 'parse') {
    writeJson(artifactPath('stage2_parse_summary_v1.json'), context.parsed.summary);
    writeJsonl(artifactPath('stage2_trade_calls_v1.jsonl'), context.parsed.trade_calls);
    return { ok: true, command, context, outputPaths: {} };
  }
  if (command === 'enrich') {
    writeJsonl(artifactPath('stage2_features_v1.jsonl'), context.features);
    return { ok: true, command, context, outputPaths: {} };
  }
  if (command === 'backtest') {
    writeJsonl(artifactPath('stage2_backtest_v1.jsonl'), context.backtestResults);
    return { ok: true, command, context, outputPaths: {} };
  }
  const outputPaths = writeStage2Outputs(context);
  return { ok: true, command, context, outputPaths };
}

module.exports = {
  buildStage2Context,
  runStage2,
};
