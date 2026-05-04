'use strict';

const {
  buildTradingState,
  levelStatePayload,
  candidatesPayload,
  alertsPayload,
  candleStatusPayload,
} = require('../trading-state/level-state-engine');
const {
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
  resolveTradingRequest,
} = require('../trading-state/chart-data');

function normalizeInstrument(value) {
  return String(value || 'ES').toUpperCase();
}

function requestOptions(options = {}) {
  return resolveTradingRequest({
    ...options,
    instrument: normalizeInstrument(options.instrument),
    mode: options.mode || 'live',
    date: options.date || null,
    time: options.time || null,
    start: options.start || null,
    end: options.end || null,
    limit: options.limit || null,
    example: options.example || null,
  });
}

async function buildLevelStateResponse(options = {}) {
  const state = await buildTradingState(requestOptions(options));
  return levelStatePayload(state);
}

async function buildTradeCandidatesResponse(options = {}) {
  const state = await buildTradingState(requestOptions(options));
  return candidatesPayload(state);
}

async function buildTradingAlertsResponse(options = {}) {
  const state = await buildTradingState(requestOptions(options));
  return alertsPayload(state);
}

async function buildCandleStatusResponse(options = {}) {
  return candleStatusPayload(requestOptions(options));
}

module.exports = {
  buildLevelStateResponse,
  buildTradeCandidatesResponse,
  buildTradingAlertsResponse,
  buildCandleStatusResponse,
  buildTradingChartDataResponse,
  buildTradingSourceHealthResponse,
};
