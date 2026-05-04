'use strict';

const { detectSetupsForSession } = require('../prop-fake-breakdown/detector');
const { buildEntryModels, accumulationMetrics } = require('./entry-models');

function detectV2SetupsForSession({ session, timelineEvents, spxBars }) {
  const bars = session.replayBars || session.bars?.rth || session.bars?.es || [];
  return detectSetupsForSession({ session, timelineEvents, spxBars }).map(setup => ({
    ...setup,
    strategy: 'fake_breakdown_reclaim_long_v2',
    entry_models_v2: buildEntryModels(setup, bars),
    accumulation: accumulationMetrics(setup, bars),
  }));
}

module.exports = {
  detectV2SetupsForSession,
};
