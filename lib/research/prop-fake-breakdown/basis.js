'use strict';

const { tsMs } = require('../common');

const BASIS_METHODS = [
  'same_minute_basis',
  'session_open_basis',
  'prior_close_basis',
  'rolling_15m_basis',
  'fixed_plus_30_proxy',
  'reference_only',
];

const BAR_INDEX_CACHE = new WeakMap();

function dateOf(timestamp) {
  return String(timestamp || '').slice(0, 10);
}

function minuteKey(timestamp) {
  return String(timestamp || '').slice(0, 16);
}

function barIndex(bars) {
  const rows = bars || [];
  if (BAR_INDEX_CACHE.has(rows)) return BAR_INDEX_CACHE.get(rows);
  const minute = new Map();
  const firstRth = new Map();
  const lastByDate = new Map();
  for (const bar of rows) {
    const key = minuteKey(bar.timestamp);
    if (!minute.has(key)) minute.set(key, bar);
    const date = dateOf(bar.timestamp);
    if (!lastByDate.has(date) || String(bar.timestamp) > String(lastByDate.get(date).timestamp)) {
      lastByDate.set(date, bar);
    }
    if (!firstRth.has(date) && /T09:3\d/.test(String(bar.timestamp))) {
      firstRth.set(date, bar);
    }
  }
  const dates = [...lastByDate.keys()].sort();
  const priorClose = new Map();
  for (let i = 1; i < dates.length; i += 1) {
    priorClose.set(dates[i], lastByDate.get(dates[i - 1]));
  }
  const index = { minute, firstRth, lastByDate, priorClose };
  BAR_INDEX_CACHE.set(rows, index);
  return index;
}

function barAtOrBefore(bars, timestamp) {
  const target = tsMs(timestamp);
  let found = null;
  for (const bar of bars || []) {
    const t = tsMs(bar.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t <= target) found = bar;
    if (t > target) break;
  }
  return found;
}

function barAtSameMinute(bars, timestamp) {
  return barIndex(bars).minute.get(minuteKey(timestamp)) || null;
}

function firstRthBar(bars, date) {
  return barIndex(bars).firstRth.get(date) ||
    barIndex(bars).minute.get(`${date}T09:30`) ||
    null;
}

function priorCloseBar(bars, date) {
  return barIndex(bars).priorClose.get(date) || null;
}

function rollingBasis(esBars, spxBars, timestamp, minutes = 15) {
  const end = tsMs(timestamp);
  if (!Number.isFinite(end)) return null;
  const start = end - minutes * 60 * 1000;
  const spxByMinute = barIndex(spxBars).minute;
  const diffs = [];
  for (const es of esBars || []) {
    const t = tsMs(es.timestamp);
    if (!Number.isFinite(t) || t > end || t < start) continue;
    const spx = spxByMinute.get(minuteKey(es.timestamp));
    if (spx && Number.isFinite(es.close) && Number.isFinite(spx.close)) diffs.push(es.close - spx.close);
  }
  if (!diffs.length) return null;
  return diffs.reduce((sum, n) => sum + n, 0) / diffs.length;
}

function calculateBasis({ method, timestamp, esBars, spxBars }) {
  if (method === 'fixed_plus_30_proxy') {
    return { method, basis: 30, available: true, diagnostic_only: true, reason: 'fixed +30 diagnostic proxy' };
  }
  if (method === 'reference_only') {
    return { method, basis: null, available: true, executable: false, reason: 'SPX reference only; no ES executable conversion' };
  }
  const date = dateOf(timestamp);
  if (method === 'same_minute_basis') {
    const es = barAtSameMinute(esBars, timestamp);
    const spx = barAtSameMinute(spxBars, timestamp);
    if (!es || !spx) return { method, basis: null, available: false, reason: 'missing same-minute ES/SPX bars' };
    return { method, basis: es.close - spx.close, available: true, diagnostic_only: false };
  }
  if (method === 'session_open_basis') {
    const es = firstRthBar(esBars, date);
    const spx = firstRthBar(spxBars, date);
    if (!es || !spx || tsMs(es.timestamp) > tsMs(timestamp) || tsMs(spx.timestamp) > tsMs(timestamp)) {
      return { method, basis: null, available: false, reason: 'missing available session open ES/SPX bars' };
    }
    return { method, basis: es.open - spx.open, available: true, diagnostic_only: false };
  }
  if (method === 'prior_close_basis') {
    const es = priorCloseBar(esBars, date);
    const spx = priorCloseBar(spxBars, date);
    if (!es || !spx) return { method, basis: null, available: false, reason: 'missing prior close ES/SPX bars' };
    return { method, basis: es.close - spx.close, available: true, diagnostic_only: false };
  }
  if (method === 'rolling_15m_basis') {
    const basis = rollingBasis(esBars, spxBars, timestamp, 15);
    if (!Number.isFinite(basis)) return { method, basis: null, available: false, reason: 'missing rolling 15m paired ES/SPX bars' };
    return { method, basis, available: true, diagnostic_only: false };
  }
  return { method, basis: null, available: false, reason: `unknown basis method ${method}` };
}

function convertSpxLevel({ spxLevel, timestamp, esBars, spxBars, method }) {
  const basis = calculateBasis({ method, timestamp, esBars, spxBars });
  if (method === 'reference_only') {
    return {
      method,
      executable: false,
      diagnostic_only: false,
      original_level: spxLevel,
      executable_level: null,
      basis,
    };
  }
  if (!basis.available || !Number.isFinite(basis.basis)) {
    return {
      method,
      executable: false,
      diagnostic_only: method === 'fixed_plus_30_proxy',
      original_level: spxLevel,
      executable_level: null,
      basis,
    };
  }
  return {
    method,
    executable: method !== 'fixed_plus_30_proxy',
    diagnostic_only: method === 'fixed_plus_30_proxy',
    original_level: spxLevel,
    executable_level: Math.round((spxLevel + basis.basis) * 100) / 100,
    basis,
  };
}

module.exports = {
  BASIS_METHODS,
  calculateBasis,
  convertSpxLevel,
  barAtOrBefore,
  barAtSameMinute,
  firstRthBar,
  priorCloseBar,
  rollingBasis,
};
