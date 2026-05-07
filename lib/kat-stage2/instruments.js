'use strict';

const INSTRUMENT_SPECS = Object.freeze({
  ES: {
    symbol: 'ES',
    asset_class: 'future',
    tick_size: 0.25,
    tick_value: 12.50,
    point_value: 50.00,
    currency: 'USD',
    aliases: ['ES', 'ES_F', 'MES_CONTEXT', 'SPX_CONTEXT'],
  },
  MES: {
    symbol: 'MES',
    asset_class: 'future',
    tick_size: 0.25,
    tick_value: 1.25,
    point_value: 5.00,
    currency: 'USD',
    aliases: ['MES', 'MES_F'],
  },
  NQ: {
    symbol: 'NQ',
    asset_class: 'future',
    tick_size: 0.25,
    tick_value: 5.00,
    point_value: 20.00,
    currency: 'USD',
    aliases: ['NQ', 'NQ_F', 'NDX_CONTEXT'],
  },
  MNQ: {
    symbol: 'MNQ',
    asset_class: 'future',
    tick_size: 0.25,
    tick_value: 0.50,
    point_value: 2.00,
    currency: 'USD',
    aliases: ['MNQ', 'MNQ_F'],
  },
  SPX: {
    symbol: 'SPX',
    asset_class: 'index',
    tick_size: 0.01,
    tick_value: null,
    point_value: null,
    currency: 'USD',
    aliases: ['SPX', 'SPXW'],
  },
  SPY: {
    symbol: 'SPY',
    asset_class: 'equity_or_option_underlying',
    tick_size: 0.01,
    tick_value: null,
    point_value: null,
    currency: 'USD',
    aliases: ['SPY'],
  },
  QQQ: {
    symbol: 'QQQ',
    asset_class: 'equity_or_option_underlying',
    tick_size: 0.01,
    tick_value: null,
    point_value: null,
    currency: 'USD',
    aliases: ['QQQ'],
  },
});

function normalizeSymbol(symbol) {
  const raw = String(symbol || '').trim().replace(/^[#$]/, '').replace(/[^a-z0-9_./-]/gi, '').toUpperCase();
  if (!raw) return null;
  const compact = raw.replace(/[./-]F$/i, '_F');
  if (compact === 'ES_F' || compact === 'ESF') return 'ES';
  if (compact === 'MES_F' || compact === 'MESF') return 'MES';
  if (compact === 'NQ_F' || compact === 'NQF') return 'NQ';
  if (compact === 'MNQ_F' || compact === 'MNQF') return 'MNQ';
  if (compact === 'SPXW') return 'SPX';
  return compact;
}

function getInstrumentSpec(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  if (String(symbol || '').toUpperCase().startsWith('O:')) {
    return {
      symbol: String(symbol).toUpperCase(),
      asset_class: 'option_contract',
      tick_size: 0.01,
      tick_value: 1.00,
      point_value: 100.00,
      currency: 'USD',
      aliases: [String(symbol).toUpperCase()],
    };
  }
  return INSTRUMENT_SPECS[normalized] || {
    symbol: normalized,
    asset_class: 'equity_or_unknown',
    tick_size: 0.01,
    tick_value: null,
    point_value: null,
    currency: 'USD',
    aliases: [normalized],
  };
}

function signedMovePoints(direction, entryPrice, exitPrice) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) return null;
  return String(direction || '').toLowerCase() === 'short' ? entry - exit : exit - entry;
}

function ticksForMove(symbol, points) {
  const spec = getInstrumentSpec(symbol);
  if (!spec || !Number.isFinite(spec.tick_size) || spec.tick_size <= 0 || !Number.isFinite(Number(points))) return null;
  return Math.round((Number(points) / spec.tick_size) * 1000000) / 1000000;
}

function grossDollarsForMove(symbol, points, contracts = 1) {
  const spec = getInstrumentSpec(symbol);
  const count = Number(contracts || 1);
  if (!spec || !Number.isFinite(spec.point_value) || !Number.isFinite(Number(points)) || !Number.isFinite(count)) return null;
  return roundMoney(Number(points) * spec.point_value * count);
}

function roundTripCommission(commission, contracts = 1) {
  if (!commission) return null;
  const count = Number(contracts || 1);
  if (commission.type === 'per_contract_per_side') {
    return roundMoney(Number(commission.amount) * count * 2);
  }
  if (commission.type === 'per_contract_round_trip') {
    return roundMoney(Number(commission.amount) * count);
  }
  if (commission.type === 'flat_round_trip') return roundMoney(Number(commission.amount));
  return null;
}

function netDollars(gross, commission, contracts = 1, slippageDollars = 0) {
  if (!Number.isFinite(Number(gross))) return null;
  const rt = roundTripCommission(commission, contracts);
  if (rt === null && !Number.isFinite(Number(slippageDollars))) return null;
  return roundMoney(Number(gross) - (rt || 0) - (Number(slippageDollars) || 0));
}

function trueBreakevenPoints(symbol, commission, contracts = 1, slippageTicks = 0) {
  const spec = getInstrumentSpec(symbol);
  if (!spec || !Number.isFinite(spec.point_value)) return null;
  const count = Number(contracts || 1);
  const rt = roundTripCommission(commission, count);
  if (rt === null) return null;
  const slippageCost = Number(slippageTicks || 0) * spec.tick_value * count;
  return (rt + slippageCost) / (spec.point_value * count);
}

function priceMovePct(direction, entryPrice, exitPrice) {
  const entry = Number(entryPrice);
  const points = signedMovePoints(direction, entryPrice, exitPrice);
  if (!Number.isFinite(entry) || entry === 0 || points === null) return null;
  return (points / entry) * 100;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = {
  INSTRUMENT_SPECS,
  getInstrumentSpec,
  grossDollarsForMove,
  netDollars,
  normalizeSymbol,
  priceMovePct,
  roundTripCommission,
  signedMovePoints,
  ticksForMove,
  trueBreakevenPoints,
};
