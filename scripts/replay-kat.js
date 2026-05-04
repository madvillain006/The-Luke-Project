'use strict';

const path = require('path');
const { buildKatReplay, writeKatReplay } = require('../lib/kat-replay');
const { evaluateKatReplay, writeKatEvaluation } = require('../lib/kat-market-evaluation');

function pct(rate) {
  if (!rate || rate.pct == null) return 'n/a';
  return rate.pct.toFixed(2).replace(/\.00$/, '') + '%';
}

function main() {
  const rootDir = path.join(__dirname, '..');
  const outDir = path.join(rootDir, 'data', 'kat', 'derived');
  const replay = buildKatReplay({ rootDir });
  const replayFiles = writeKatReplay(replay, outDir);
  const evaluation = evaluateKatReplay(replay.records, { rootDir });
  const evaluationFiles = writeKatEvaluation(evaluation, outDir);

  console.log('KATBOT REPLAY COMPLETE');
  console.log('- replay records: ' + replay.summary.parsed_records);
  console.log('- signal records: ' + replay.summary.signal_records);
  console.log('- image evidence records: ' + replay.summary.image_evidence_records);
  console.log('- duplicate message ids skipped: ' + replay.summary.duplicate_message_ids_skipped);
  console.log('- SPX/SPY direct records: ' + replay.summary.spx_options_direct_records);
  console.log('- evaluations: ' + evaluation.summary.evaluated + ' / ' + evaluation.summary.total);
  console.log('- win rate 5m: ' + pct(evaluation.summary.win_rate_5m));
  console.log('- win rate 15m: ' + pct(evaluation.summary.win_rate_15m));
  console.log('- win rate 30m: ' + pct(evaluation.summary.win_rate_30m));
  console.log('- win rate 60m: ' + pct(evaluation.summary.win_rate_60m));
  console.log('- win rate EOD: ' + pct(evaluation.summary.win_rate_eod));
  console.log('- replay: ' + path.relative(rootDir, replayFiles.replayPath));
  console.log('- replay summary: ' + path.relative(rootDir, replayFiles.summaryPath));
  console.log('- evaluations: ' + path.relative(rootDir, evaluationFiles.evaluationsPath));
  console.log('- evaluation summary: ' + path.relative(rootDir, evaluationFiles.summaryPath));
}

main();
