'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../state/lib');
const { getLivePrice } = require('./live-price');
const { saveSatyLevels, loadSatyLevels, appendSatyToMemory } = require('./saty-levels');
const { fetchDailyBarsFromYahoo } = require('./market-data/providers/yahoo');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'saty-auto-pull.json');
const DEFAULT_ATR_LENGTH = 14;
const DEFAULT_TRIGGER_PCT = 0.236;
const DEFAULT_HISTORY_DAYS = 120;

function loadAutoPullState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return null; }
}

function saveAutoPullState(state) {
  writeJsonAtomic(STATE_FILE, state);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function formatYmd(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 86400000);
}

async function fetchDailyBarsFromPolygon(ticker, key, daysBack = DEFAULT_HISTORY_DAYS) {
  const to = formatYmd(new Date());
  const from = formatYmd(subtractDays(new Date(), daysBack));
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`daily bars fetch failed for ${ticker}: HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows
    .map(r => ({
      date: formatYmd(r.t),
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v || 0),
    }))
    .filter(bar => Number.isFinite(bar.open) && Number.isFinite(bar.high) &&
      Number.isFinite(bar.low) && Number.isFinite(bar.close));
}

function trueRange(current, prevClose) {
  if (!current) return null;
  if (!Number.isFinite(prevClose)) return current.high - current.low;
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - prevClose),
    Math.abs(current.low - prevClose),
  );
}

function computeWilderAtr(bars, length = DEFAULT_ATR_LENGTH) {
  const out = new Array((bars || []).length).fill(null);
  if (!Array.isArray(bars) || bars.length < length + 1) return out;

  const trs = bars.map((bar, idx) => trueRange(bar, idx > 0 ? bars[idx - 1].close : NaN));
  let seed = 0;
  for (let i = 1; i <= length; i += 1) seed += trs[i];
  let atr = seed / length;
  out[length] = atr;

  for (let i = length + 1; i < bars.length; i += 1) {
    atr = ((atr * (length - 1)) + trs[i]) / length;
    out[i] = atr;
  }
  return out;
}

function computeEma(values, length) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const alpha = 2 / (length + 1);
  const out = new Array(values.length).fill(null);
  let ema = values[0];
  out[0] = ema;
  for (let i = 1; i < values.length; i += 1) {
    ema = (values[i] * alpha) + (ema * (1 - alpha));
    out[i] = ema;
  }
  return out;
}

function classifyRibbonFromBars(bars) {
  if (!Array.isArray(bars) || bars.length < 34) return 'NEUTRAL';
  const closes = bars.map(bar => bar.close);
  const ema8 = computeEma(closes, 8);
  const ema21 = computeEma(closes, 21);
  const ema34 = computeEma(closes, 34);
  const price = closes[closes.length - 1];
  const fast = ema8[ema8.length - 1];
  const pivot = ema21[ema21.length - 1];
  const slow = ema34[ema34.length - 1];
  if ([price, fast, pivot, slow].every(Number.isFinite)) {
    if (price >= fast && fast >= pivot && pivot >= slow) return 'BULLISH';
    if (price <= fast && fast <= pivot && pivot <= slow) return 'BEARISH';
  }
  return 'NEUTRAL';
}

function deriveSatyLevelsFromBars(bars, options = {}) {
  const atrLength = options.atrLength || DEFAULT_ATR_LENGTH;
  const triggerPercentage = options.triggerPercentage ?? DEFAULT_TRIGGER_PCT;
  if (!Array.isArray(bars) || bars.length < Math.max(35, atrLength + 2)) {
    return { valid: false, error: 'Need at least 35 daily bars to derive Saty levels' };
  }

  const atrSeries = computeWilderAtr(bars, atrLength);
  const refIndex = bars.length - 1;
  const referenceBar = bars[refIndex];
  const atr = atrSeries[refIndex];
  if (!referenceBar || !Number.isFinite(referenceBar.close) || !Number.isFinite(atr)) {
    return { valid: false, error: 'Could not derive previous close and ATR from daily bars' };
  }

  const pc = referenceBar.close;
  const level = mult => round2(pc + (atr * mult));

  return {
    valid: true,
    instrument: 'SPX',
    trading_type: 'Day',
    atr_length: atrLength,
    trigger_percentage: triggerPercentage,
    reference_date: referenceBar.date,
    atr_value: round2(atr),
    prev_close: round2(pc),
    call_trigger: level(triggerPercentage),
    put_trigger: level(-triggerPercentage),
    ext_plus_1: level(0.382),
    ext_plus_2: level(0.5),
    ext_plus_3: level(0.618),
    ext_plus_4: level(0.786),
    atr_plus_1: level(1.0),
    ext_minus_1: level(-0.382),
    ext_minus_2: level(-0.5),
    ext_minus_3: level(-0.618),
    ext_minus_4: level(-0.786),
    atr_minus_1: level(-1.0),
    ribbon: classifyRibbonFromBars(bars),
  };
}

async function captureReferenceSnapshot(options = {}) {
  const key = process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY || null;

  const livePrice = await getLivePrice().catch(() => null);
  let dailyBars;
  let dailySource = null;
  const errors = [];

  if (key) {
    try {
      dailyBars = await fetchDailyBarsFromPolygon('I:SPX', key, options.daysBack || DEFAULT_HISTORY_DAYS);
      if (!Array.isArray(dailyBars) || dailyBars.length < 35) throw new Error('not enough SPX bars');
      dailySource = 'polygon:I:SPX';
    } catch (spxErr) {
      errors.push(`polygon:I:SPX ${spxErr.message}`);
    }
  } else {
    errors.push('polygon:I:SPX key missing');
  }

  if (!Array.isArray(dailyBars) || dailyBars.length < 35) {
    try {
      dailyBars = await fetchDailyBarsFromYahoo('^GSPC', {
        range: options.yahooRange || '6mo',
        timeoutMs: options.timeoutMs,
      });
      if (!Array.isArray(dailyBars) || dailyBars.length < 35) throw new Error('not enough Yahoo SPX bars');
      dailySource = 'yahoo:^GSPC';
    } catch (yahooErr) {
      errors.push(`yahoo:^GSPC ${yahooErr.message}`);
    }
  }

  if (!Array.isArray(dailyBars) || dailyBars.length < 35) {
    return { ok: false, error: `SPX daily bars unavailable: ${errors.join('; ')}` };
  }

  const latestBar = dailyBars[dailyBars.length - 1] || null;
  return {
    ok: true,
    snapshot: {
      captured_at: new Date().toISOString(),
      source: livePrice?.source || dailySource || 'unknown',
      data_date: livePrice?.data_date || latestBar?.date || null,
      delayed: !!livePrice?.delayed,
      spx: Number.isFinite(livePrice?.spx) ? livePrice.spx : latestBar?.close ?? null,
      spy: Number.isFinite(livePrice?.spy) ? livePrice.spy : null,
      instruments: livePrice?.instruments || null,
      daily_source: dailySource,
      daily_bars: dailyBars,
    }
  };
}

function resolveDeriveFunction(explicitFn) {
  if (typeof explicitFn === 'function') return { derive: explicitFn, source: 'inline' };

  const modulePath = process.env.SATY_DERIVE_MODULE;
  if (!modulePath) return { derive: deriveSatyLevelsFromSnapshot, source: 'built-in' };

  const resolved = path.isAbsolute(modulePath) ? modulePath : path.join(ROOT, modulePath);
  if (!fs.existsSync(resolved)) {
    throw new Error('SATY_DERIVE_MODULE not found: ' + resolved);
  }

  const loaded = require(resolved);
  const derive = typeof loaded === 'function' ? loaded : loaded?.deriveSatyLevels;
  if (typeof derive !== 'function') {
    throw new Error('SATY_DERIVE_MODULE must export a function or deriveSatyLevels()');
  }

  return { derive, source: resolved };
}

async function deriveSatyLevelsFromSnapshot(snapshot, options = {}) {
  const derived = deriveSatyLevelsFromBars(snapshot?.daily_bars, options);
  if (!derived.valid) return derived;
  return {
    ...derived,
    source_note: snapshot?.daily_source || snapshot?.source || 'unknown',
    auto_pull_reference: {
      captured_at: snapshot?.captured_at || null,
      data_date: snapshot?.data_date || null,
      daily_source: snapshot?.daily_source || null,
      spx: snapshot?.spx ?? null,
      spy: snapshot?.spy ?? null,
    }
  };
}

async function deriveLevelsFromSnapshot(snapshot, options = {}) {
  const resolved = resolveDeriveFunction(options.deriveFn);
  const derived = await resolved.derive(snapshot, options);
  if (!derived || typeof derived !== 'object') {
    throw new Error('Saty derive module returned no payload');
  }
  if (derived.valid !== true) {
    return { ok: false, pending: true, reason: derived.error || 'derive module did not return valid Saty levels' };
  }
  return { ok: true, levels: derived, derive_source: resolved.source };
}

async function runSatyAutoPull(options = {}) {
  const startedAt = new Date().toISOString();
  const captured = await captureReferenceSnapshot(options);

  if (!captured.ok) {
    const failedState = {
      last_attempt: startedAt,
      ok: false,
      stage: 'fetch',
      error: captured.error,
    };
    saveAutoPullState(failedState);
    return failedState;
  }

  const derived = await deriveLevelsFromSnapshot(captured.snapshot, options);
  const baseState = {
    last_attempt: startedAt,
    reference_snapshot: {
      captured_at: captured.snapshot.captured_at,
      data_date: captured.snapshot.data_date,
      daily_source: captured.snapshot.daily_source,
      spx: captured.snapshot.spx,
      spy: captured.snapshot.spy,
    },
    ok: !!derived.ok,
    stage: derived.ok ? 'saved' : 'derive',
    pending: !!derived.pending,
    reason: derived.reason || null,
    derive_source: derived.derive_source || null,
  };

  if (!derived.ok) {
    saveAutoPullState(baseState);
    return baseState;
  }

  const levelsToSave = {
    ...derived.levels,
    valid: true,
    source: 'auto-pull',
    derive_source: derived.derive_source,
  };

  saveSatyLevels(levelsToSave);
  const saved = loadSatyLevels() || { ...levelsToSave, updated: new Date().toISOString() };
  const memoryResults = await appendSatyToMemory(saved);

  const successState = {
    ...baseState,
    ok: true,
    pending: false,
    reason: null,
    saved_at: saved.updated,
    level_count: memoryResults.length,
  };
  saveAutoPullState(successState);
  return successState;
}

module.exports = {
  loadAutoPullState,
  captureReferenceSnapshot,
  deriveLevelsFromSnapshot,
  runSatyAutoPull,
  _internal: {
    fetchDailyBarsFromPolygon,
    computeWilderAtr,
    classifyRibbonFromBars,
    deriveSatyLevelsFromBars,
    deriveSatyLevelsFromSnapshot,
  },
};
