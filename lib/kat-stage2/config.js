'use strict';

const path = require('path');
const { ROOT } = require('./io');

const STAGE2_VERSION = 'v1';

function defaultStage2Config(options = {}) {
  const rootDir = options.rootDir || ROOT;
  return {
    version: STAGE2_VERSION,
    rootDir,
    inputs: {
      katRawFeed: path.join(rootDir, 'data', 'kat', 'raw-feed.jsonl'),
      katProcessedSignals: path.join(rootDir, 'data', 'kat', 'processed-signals.jsonl'),
      katVisionSignals: path.join(rootDir, 'data', 'kat', 'vision-signals.jsonl'),
      katConfig: path.join(rootDir, 'data', 'kat', 'monitored-users.json'),
      manualAnalystMessages: path.join(rootDir, 'data', 'research', 'katbot', 'manual-stage2', 'manual-analyst-messages.jsonl'),
      manualSybilMessages: path.join(rootDir, 'data', 'research', 'sybil-katbot', 'manual-sybil-messages.jsonl'),
      manualSybilContexts: path.join(rootDir, 'data', 'research', 'sybil-katbot', 'manual-sybil-context.jsonl'),
    },
    outputs: {
      artifactDir: path.join(rootDir, 'artifacts', 'stage2'),
      reportDir: path.join(rootDir, 'reports', 'stage2'),
    },
    assumptions: {
      maxHoldMinutes: 390,
      sameCandlePolicy: 'intrabar_ambiguous',
      defaultContracts: 1,
      zoneFillRule: 'midpoint',
      marketEntryPrice: 'next_candle_open',
      maxMarketEntryLagMinutes: 5,
      breakoutFillRule: 'touch_after_call',
      maxUpdateLinkHours: 24,
      maxGainsLinkHours: 48,
      maxHeatmapLinkMinutes: 90,
      minConfidenceForVerifiedLink: 0.65,
      maxExplicitExitDistancePct: 0.03,
      maxStopTargetDistancePct: 0.05,
      maxOptionExplicitExitDistancePct: 5,
      maxOptionStopTargetDistancePct: 5,
      commission: null,
      slippageTicks: 0,
      rawDataPrivacy: 'raw message text stays under ignored artifacts/stage2; reports are summarized/sanitized',
    },
  };
}

module.exports = {
  STAGE2_VERSION,
  defaultStage2Config,
};
