#!/usr/bin/env node
'use strict';

const path = require('path');
const { RESEARCH_ARTIFACT_DIR, writeCsv } = require('../lib/research/common');
const { runExistingDataReplay } = require('../lib/research/replay-engine');

function csvRows(rows) {
  return rows.map(row => ({
    date: row.date,
    timestamp_et: row.timestamp_et,
    instrument: row.instrument,
    es_price: row.es_price,
    source_combo: row.source_combo,
    action: row.action,
    raw_spine_action: row.raw_spine_action,
    adapter_action: row.adapter_action,
    anchor: row.anchor,
    entry: row.entry,
    stop: row.stop,
    target: row.target,
    sizing: row.sizing,
    veto_count: row.vetoes?.length || 0,
    mfe_5m: row.outcome?.mfe_5m,
    mae_5m: row.outcome?.mae_5m,
    mfe_15m: row.outcome?.mfe_15m,
    mae_15m: row.outcome?.mae_15m,
    mfe_30m: row.outcome?.mfe_30m,
    mae_30m: row.outcome?.mae_30m,
    mfe_60m: row.outcome?.mfe_60m,
    mae_60m: row.outcome?.mae_60m,
    target_stop_first: row.outcome?.target_stop_first,
    pass_missed_move: row.pass_missed_move,
    veto_saved_bad_trade: row.veto_saved_bad_trade,
    reason: row.reason,
  }));
}

async function main() {
  const { result, attribution } = await runExistingDataReplay();
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'replay-summary.csv'), csvRows(result.rows), [
    'date',
    'timestamp_et',
    'instrument',
    'es_price',
    'source_combo',
    'action',
    'raw_spine_action',
    'adapter_action',
    'anchor',
    'entry',
    'stop',
    'target',
    'sizing',
    'veto_count',
    'mfe_5m',
    'mae_5m',
    'mfe_15m',
    'mae_15m',
    'mfe_30m',
    'mae_30m',
    'mfe_60m',
    'mae_60m',
    'target_stop_first',
    'pass_missed_move',
    'veto_saved_bad_trade',
    'reason',
  ]);
  console.log(`replay sessions: ${result.sessions}`);
  console.log(`checkpoints: ${result.checkpoint_count}`);
  console.log(`actionable: ${result.counts.actionable} pass/wait: ${result.counts.pass_wait} vetoes: ${result.counts.vetoes}`);
  console.log(`top combos: ${attribution.slice(0, 3).map(row => `${row.source_combo}:${row.count}`).join(', ') || 'none'}`);
  console.log(`artifact: ${path.join('artifacts', 'research', 'replay-results.json')}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`existing data replay failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
