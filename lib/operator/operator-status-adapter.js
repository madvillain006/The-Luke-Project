'use strict';

const fs = require('fs');
const path = require('path');

const { isMarketOpen, isGoodTradingTime, minsUntilOpen } = require('../market-hours');
const { buildStatusPayload, getApexConsistencyReason } = require('../../trading/risk');
const autonomousRouter = require('../../trading/router');
const { buildDecisionResponse, summarizeDecision } = require('./decision-adapter');
const { buildIngestionStatus } = require('./ingestion-status-adapter');
const { buildLogSummary } = require('./log-adapter');
const { snapshots } = require('../paths');

const LUKE_ROOT = path.join(__dirname, '..', '..');
const TRADING_STATE_FILE = path.join(LUKE_ROOT, 'state', 'snapshots', 'trading-state.json');
const LEGACY_AUTONOMOUS_STATE_FILE = snapshots.autonomousState;

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 'missing', path: filePath, value: null, error: 'missing' };
    }
    return { ok: true, status: 'ok', path: filePath, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (err) {
    return { ok: false, status: 'corrupt', path: filePath, value: null, error: err.message };
  }
}

function readTradingStateReadOnly() {
  const snapshot = readJson(TRADING_STATE_FILE);
  if (snapshot.ok) return { ...snapshot, source: 'snapshot' };
  const legacy = readJson(LEGACY_AUTONOMOUS_STATE_FILE);
  if (legacy.ok) return { ...legacy, source: 'legacy', blockers: [`primary trading state ${snapshot.status}: ${snapshot.error}`] };
  return {
    ok: false,
    status: snapshot.status === 'corrupt' || legacy.status === 'corrupt' ? 'corrupt' : 'missing',
    path: TRADING_STATE_FILE,
    source: null,
    value: null,
    error: `snapshot ${snapshot.status}; legacy ${legacy.status}`,
    blockers: [`trading state unavailable: snapshot ${snapshot.status}; legacy ${legacy.status}`],
  };
}

function marketState() {
  const market = isMarketOpen();
  const tradingTime = isGoodTradingTime();
  return {
    market,
    trading_time: tradingTime,
    minutes_until_open: market.open ? 0 : minsUntilOpen(),
  };
}

function buildRiskStatus(stateRead) {
  if (!stateRead.ok) {
    return {
      ok: false,
      staged_only: true,
      blockers: stateRead.blockers || [`trading state unavailable: ${stateRead.error}`],
      autonomous: {
        running: false,
        mode: null,
        kill_day: null,
        kill_week: null,
        open_position: null,
        pending_signal: null,
      },
    };
  }
  const payload = buildStatusPayload(stateRead.value);
  const consistencyReason = getApexConsistencyReason(stateRead.value);
  return {
    ok: !consistencyReason,
    staged_only: true,
    blockers: consistencyReason ? [consistencyReason] : [],
    autonomous: {
      running: payload.running,
      mode: payload.mode,
      kill_day: payload.kill_day,
      kill_week: payload.kill_week,
      open_position: Boolean(payload.open_position),
      pending_signal: Boolean(payload.pending_signal),
      operator_note: payload.operator_note,
    },
    payload,
  };
}

async function buildOperatorStatus({
  instrument = 'ES',
  mode = 'manual',
  now = new Date(),
  currentPrice = null,
  getLivePriceFn = undefined,
} = {}) {
  const stateRead = readTradingStateReadOnly();
  const ingestion = buildIngestionStatus({ now });
  const risk_status = buildRiskStatus(stateRead);
  const decisionResponse = await buildDecisionResponse({
    instrument,
    mode,
    currentPrice,
    state: stateRead.ok ? stateRead.value : null,
    now,
    ...(getLivePriceFn === undefined ? {} : { getLivePriceFn }),
  });
  const logs = buildLogSummary({ limit: 5 });
  const blockers = [
    ...(stateRead.blockers || []),
    ...ingestion.blockers,
    ...risk_status.blockers,
  ];

  return {
    ok: blockers.length === 0,
    blockers,
    mode,
    market_state: marketState(),
    freshness: ingestion.freshness,
    ingestion,
    risk_status,
    autonomous: {
      staged_only: true,
      wording: 'Autonomous stages candidates only; execution requires explicit staged confirmation.',
      running: risk_status.autonomous.running,
      mode: risk_status.autonomous.mode,
    },
    latest_decision: summarizeDecision(decisionResponse.decision),
    market_data: decisionResponse.market_data,
    decision: {
      actionable: decisionResponse.actionable,
      pass: decisionResponse.pass,
      summary: decisionResponse.summary,
      market_data: decisionResponse.market_data,
    },
    logs,
    state: {
      trading: {
        status: stateRead.status,
        source: stateRead.source,
        path: stateRead.path,
        error: stateRead.error,
      },
    },
  };
}

async function buildOperatorReadiness(opts = {}) {
  const stateRead = readTradingStateReadOnly();
  if (!stateRead.ok) {
    return {
      ok: false,
      blockers: stateRead.blockers || [`trading state unavailable: ${stateRead.error}`],
      staged_only: true,
      risk_status: buildRiskStatus(stateRead),
      decision: null,
      state: {
        trading: {
          status: stateRead.status,
          path: stateRead.path,
          error: stateRead.error,
        },
      },
    };
  }
  return autonomousRouter._internal.buildAutonomousPreflight(stateRead.value, opts);
}

module.exports = {
  buildOperatorStatus,
  buildOperatorReadiness,
  readTradingStateReadOnly,
  _internal: {
    readJson,
    buildRiskStatus,
    marketState,
    TRADING_STATE_FILE,
    LEGACY_AUTONOMOUS_STATE_FILE,
  },
};
