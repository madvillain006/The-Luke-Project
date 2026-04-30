'use strict';

const fs = require('fs');
const path = require('path');
const { simulateEsBracketTrade, selectNextTargets } = require('./es-bracket-strategy');

const DEFAULT_CONFIG = {
  defaultStopDistancePts: 3,
  minTargetDistancePts: 0.25,
  dedupeTolerancePts: 0.25,
  tickSize: 0.25,
  pointValue: 50,
  contracts: 3,
  commissionPerContract: 0,
  slippageTicks: 0,
  exitAtClose: true,
};

function loadSessionFile(filePath) {
  if (!filePath) throw new Error('--session is required');
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  const session = JSON.parse(raw);
  return normalizeSession(session, absolute);
}

function normalizeSession(session, sourcePath = null) {
  if (!session || typeof session !== 'object') throw new Error('session must be an object');
  if (!session.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(session.date))) {
    throw new Error('session.date must be YYYY-MM-DD');
  }

  const config = { ...DEFAULT_CONFIG, ...(session.config || {}) };
  const levels = normalizeLevels(session.levels || []);
  const setups = normalizeSetups(session.setups || []);

  return {
    ...session,
    sourcePath,
    date: String(session.date),
    instrument: String(session.instrument || 'ES').toUpperCase(),
    rthOnly: session.rthOnly !== false,
    config,
    levels,
    setups,
  };
}

function normalizeLevels(levels) {
  if (!Array.isArray(levels)) return [];
  return levels
    .map(level => {
      if (typeof level === 'number') return { price: level, source: 'manual' };
      if (!level || typeof level !== 'object') return null;
      return {
        ...level,
        price: Number(level.price),
        source: String(level.source || 'manual'),
      };
    })
    .filter(level => level && Number.isFinite(level.price));
}

function normalizeSetups(setups) {
  if (!Array.isArray(setups)) return [];
  return setups
    .map((setup, index) => {
      if (!setup || typeof setup !== 'object') return null;
      const entry = Number(setup.entry);
      return {
        ...setup,
        id: setup.id || `setup-${index + 1}`,
        direction: String(setup.direction || 'long').toLowerCase(),
        entry,
        stop: setup.stop == null || setup.stop === '' ? null : Number(setup.stop),
        targets: normalizeTargetPrices(setup.targets),
      };
    })
    .filter(setup => setup && Number.isFinite(setup.entry));
}

function normalizeTargetPrices(targets) {
  if (!Array.isArray(targets)) return [];
  return targets
    .map(target => typeof target === 'number' ? target : Number(target?.price))
    .filter(Number.isFinite);
}

function filterBarsFromTime(bars, isoTimestamp) {
  if (!isoTimestamp) return bars;
  const start = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(start)) return bars;
  return bars.filter(bar => {
    const ts = new Date(bar.timestamp).getTime();
    return Number.isFinite(ts) && ts >= start;
  });
}

function selectTargetsForSetup(setup, session) {
  if (setup.targets.length > 0) {
    const selected = setup.targets.slice(0, 3).map(price => ({ price, source: 'setup' }));
    return { levels: selected, prices: selected.map(level => level.price), source: 'setup' };
  }

  const selected = selectNextTargets(session.levels, setup.entry, 'long', {
    tickSize: session.config.tickSize,
    minDistancePts: session.config.minTargetDistancePts,
    dedupeTolerancePts: session.config.dedupeTolerancePts,
  });
  return { levels: selected, prices: selected.map(level => level.price), source: 'session-levels' };
}

function runSessionBacktest(sessionInput, barsInput) {
  const session = normalizeSession(sessionInput, sessionInput?.sourcePath || null);
  const bars = Array.isArray(barsInput) ? barsInput : [];
  const trades = [];

  for (const setup of session.setups) {
    if (setup.direction !== 'long') {
      trades.push({
        id: setup.id,
        status: 'skipped',
        reason: 'long_only_runner',
        setup,
      });
      continue;
    }

    const setupBars = filterBarsFromTime(bars, setup.time);
    const stop = Number.isFinite(setup.stop)
      ? setup.stop
      : setup.entry - session.config.defaultStopDistancePts;
    const targets = selectTargetsForSetup(setup, session);

    let simulation;
    try {
      simulation = simulateEsBracketTrade({
        direction: 'long',
        entry: setup.entry,
        stop,
        targets: targets.prices,
        bars: setupBars,
        config: session.config,
      });
    } catch (err) {
      trades.push({
        id: setup.id,
        status: 'error',
        reason: err.message,
        setup,
        stop,
        targetLevels: targets.levels,
      });
      continue;
    }

    trades.push({
      id: setup.id,
      status: simulation.status,
      setup,
      stop,
      targetSource: targets.source,
      targetLevels: targets.levels,
      simulation,
    });
  }

  return {
    session: {
      date: session.date,
      instrument: session.instrument,
      rthOnly: session.rthOnly,
      sourcePath: session.sourcePath,
      example: Boolean(session.example),
    },
    data: {
      bars: bars.length,
      setups: session.setups.length,
      levels: session.levels.length,
    },
    trades,
    summary: summarizeBacktest(trades),
  };
}

function summarizeBacktest(trades) {
  const filled = trades.filter(trade => trade.simulation?.status === 'filled');
  const notTriggered = trades.filter(trade => trade.simulation?.status === 'not_triggered');
  const noData = trades.filter(trade => trade.simulation?.status === 'no_data');
  const skipped = trades.filter(trade => trade.status === 'skipped');
  const errors = trades.filter(trade => trade.status === 'error');

  const netPoints = filled.reduce((sum, trade) => sum + trade.simulation.summary.netPoints, 0);
  const netDollars = filled.reduce((sum, trade) => sum + trade.simulation.summary.netDollars, 0);
  const winners = filled.filter(trade => trade.simulation.summary.netPoints > 0);
  const losers = filled.filter(trade => trade.simulation.summary.netPoints < 0);
  const flat = filled.filter(trade => trade.simulation.summary.netPoints === 0);
  const stoppedAfterTp = filled.filter(trade => trade.simulation.summary.stoppedAfterTp);
  const tp3 = filled.filter(trade => trade.simulation.fills.some(fill => fill.type === 'tp3'));

  return {
    totalSetups: trades.length,
    filled: filled.length,
    notTriggered: notTriggered.length,
    noData: noData.length,
    skipped: skipped.length,
    errors: errors.length,
    winners: winners.length,
    losers: losers.length,
    flat: flat.length,
    stoppedAfterTp: stoppedAfterTp.length,
    fullLadders: tp3.length,
    netPoints,
    netDollars,
    avgPointsPerFilled: filled.length ? netPoints / filled.length : 0,
    avgDollarsPerFilled: filled.length ? netDollars / filled.length : 0,
  };
}

function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function formatMarkdownReport(result) {
  const s = result.summary;
  const lines = [];
  lines.push(`# ES Long Bracket Backtest - ${result.session.date}`);
  lines.push('');
  lines.push(`Instrument: ${result.session.instrument}`);
  lines.push(`RTH only: ${result.session.rthOnly ? 'yes' : 'no'}`);
  lines.push(`Bars loaded: ${result.data.bars}`);
  lines.push(`Setups: ${result.data.setups}`);
  if (result.session.example) {
    lines.push('');
    lines.push('WARNING: This session is marked example=true. Do not treat this as trading evidence.');
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Filled: ${s.filled}/${s.totalSetups}`);
  lines.push(`- Not triggered: ${s.notTriggered}`);
  lines.push(`- Skipped: ${s.skipped}`);
  lines.push(`- Errors: ${s.errors}`);
  lines.push(`- Winners / losers / flat: ${s.winners} / ${s.losers} / ${s.flat}`);
  lines.push(`- Full 3-target ladders: ${s.fullLadders}`);
  lines.push(`- Stopped after TP: ${s.stoppedAfterTp}`);
  lines.push(`- Net points: ${formatNumber(s.netPoints)}`);
  lines.push(`- Net dollars: ${formatMoney(s.netDollars)}`);
  lines.push(`- Avg points per filled: ${formatNumber(s.avgPointsPerFilled)}`);
  lines.push('');
  lines.push('## Trades');
  lines.push('');

  for (const trade of result.trades) {
    lines.push(`### ${trade.id}`);
    if (trade.status === 'skipped' || trade.status === 'error') {
      lines.push('');
      lines.push(`Status: ${trade.status}`);
      lines.push(`Reason: ${trade.reason}`);
      lines.push('');
      continue;
    }

    const sim = trade.simulation;
    lines.push('');
    lines.push(`Status: ${sim.status}`);
    lines.push(`Entry: ${sim.entry}`);
    lines.push(`Initial stop: ${sim.initialStop}`);
    lines.push(`Targets: ${sim.targets.length ? sim.targets.join(', ') : 'none'}`);
    lines.push(`Target source: ${trade.targetSource}`);

    if (trade.targetLevels.length) {
      const labels = trade.targetLevels
        .map(level => `${level.price} (${level.source || 'manual'}${level.label ? `: ${level.label}` : ''})`);
      lines.push(`Target levels: ${labels.join('; ')}`);
    }

    lines.push(`Net points: ${formatNumber(sim.summary.netPoints)}`);
    lines.push(`Net dollars: ${formatMoney(sim.summary.netDollars)}`);
    lines.push(`Max favorable/adverse: ${formatNumber(sim.summary.maxFavorablePts)} / ${formatNumber(sim.summary.maxAdversePts)} pts`);
    lines.push('');
    lines.push('| Fill | Time | Price | Contracts | Points | Net $ |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    if (sim.fills.length === 0) {
      lines.push('| none |  |  |  |  |  |');
    } else {
      for (const fill of sim.fills) {
        lines.push(`| ${fill.type} | ${fill.timestamp} | ${fill.price} | ${fill.contracts} | ${formatNumber(fill.points)} | ${formatMoney(fill.netDollars)} |`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  DEFAULT_CONFIG,
  loadSessionFile,
  normalizeSession,
  runSessionBacktest,
  summarizeBacktest,
  formatMarkdownReport,
  _internal: {
    normalizeLevels,
    normalizeSetups,
    normalizeTargetPrices,
    filterBarsFromTime,
    selectTargetsForSetup,
  },
};

