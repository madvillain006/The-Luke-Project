'use strict';

// Historical Saty level derivation for offline ES backtests.
//
// Important correction:
//   Saty levels for ES research must be keyed to the ES futures session:
//   18:00 ET open through 17:00 ET close. The levels for a target session
//   are generated from the prior completed futures session and become valid
//   at the next 18:00 ET open.
//
// This module intentionally does NOT use live/stale data/saty-levels.json.
// It also does not use SPX RTH-calendar bars as the backtest clock.
//
// Formula source:
//   Saty ATR Levels Pine source:
//   previous_close = request.security(ticker, 'D', close[1], session.extended)
//   atr = request.security(ticker, 'D', ta.atr(14)[1], session.extended)
//   levels = previous_close +/- atr * Fibonacci multipliers.
//
// Historical equivalent:
//   Build ES extended-session daily bars (18:00-17:00 ET), compute Wilder ATR(14),
//   and for target session D use the prior completed session's close and ATR.

const DEFAULT_TRIGGER_PCT = 0.236;
const DEFAULT_ATR_LENGTH = 14;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dateAdd(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutesOfDay(timestamp) {
  const m = String(timestamp).match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function calendarDate(timestamp) {
  return String(timestamp).slice(0, 10);
}

function isWeekend(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function nextCalendarDate(date) {
  return dateAdd(date, 1);
}

// The futures session date is the RTH date that the session leads into.
// Examples:
//   Sunday 18:00 -> Monday session
//   Monday 09:30 -> Monday session
//   Monday 16:59 -> Monday session
//   Monday 18:00 -> Tuesday session
function futuresSessionDateForTimestamp(timestamp) {
  const date = calendarDate(timestamp);
  const minutes = minutesOfDay(timestamp);
  if (minutes === null) return null;
  if (minutes >= 1080) return nextCalendarDate(date); // 18:00+
  return date;
}

function isInsideFuturesSession(bar) {
  const minutes = minutesOfDay(bar.timestamp);
  if (minutes === null) return false;
  // Daily maintenance break: 17:00-17:59 ET.
  return minutes < 1020 || minutes >= 1080;
}

function summarizeBarsAsSession(sessionDate, bars) {
  if (!Array.isArray(bars) || bars.length === 0) return null;
  const sorted = [...bars].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  );
  const high = Math.max(...sorted.map(b => b.high));
  const low = Math.min(...sorted.map(b => b.low));
  const open = sorted[0].open;
  const close = sorted[sorted.length - 1].close;
  const volume = sorted.reduce((sum, b) => sum + (Number(b.volume) || 0), 0);
  if (![open, high, low, close].every(Number.isFinite)) return null;
  return {
    date: sessionDate,
    session_open: sorted[0].timestamp,
    session_close: sorted[sorted.length - 1].timestamp,
    open,
    high,
    low,
    close,
    volume,
    bar_count: sorted.length,
    range: round2(high - low),
  };
}

function buildFuturesSessionBars(intradayBars) {
  const groups = new Map();
  for (const bar of intradayBars || []) {
    if (!bar?.timestamp || !isInsideFuturesSession(bar)) continue;
    const sessionDate = futuresSessionDateForTimestamp(bar.timestamp);
    if (!sessionDate || isWeekend(sessionDate)) continue;
    if (!groups.has(sessionDate)) groups.set(sessionDate, []);
    groups.get(sessionDate).push(bar);
  }

  return [...groups.entries()]
    .map(([date, bars]) => summarizeBarsAsSession(date, bars))
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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

function computeWilderAtr(sessions, length = DEFAULT_ATR_LENGTH) {
  const out = new Array((sessions || []).length).fill(null);
  if (!Array.isArray(sessions) || sessions.length < length + 1) return out;

  const trs = sessions.map((session, idx) =>
    trueRange(session, idx > 0 ? sessions[idx - 1].close : NaN)
  );

  let seed = 0;
  for (let i = 1; i <= length; i += 1) seed += trs[i];
  let atr = seed / length;
  out[length] = atr;

  for (let i = length + 1; i < sessions.length; i += 1) {
    atr = ((atr * (length - 1)) + trs[i]) / length;
    out[i] = atr;
  }
  return out;
}

function deriveSatyLevelsFromReferenceSession(referenceSession, atr, options = {}) {
  const triggerPercentage = options.triggerPercentage ?? DEFAULT_TRIGGER_PCT;
  const referenceField = options.referenceField === 'open' ? 'open' : 'close';
  if (!referenceSession || !Number.isFinite(referenceSession[referenceField]) || !Number.isFinite(atr)) {
    return { valid: false, error: 'Missing completed futures reference session' };
  }
  if (atr <= 0) {
    return { valid: false, error: 'Reference futures session ATR is zero' };
  }

  const pc = referenceSession[referenceField];
  const level = mult => round2(pc + (atr * mult));

  return {
    valid: true,
    instrument: 'ES',
    trading_type: 'FuturesSession',
    source: 'historical-es-futures-session',
    formula_provenance: 'Saty_Pine_D_session_extended_close1_atr14_1',
    reference_field: referenceField,
    verification_required: false,
    atr_length: options.atrLength || DEFAULT_ATR_LENGTH,
    trigger_percentage: triggerPercentage,
    reference_date: referenceSession.date,
    reference_session_open: referenceSession.session_open,
    reference_session_close: referenceSession.session_close,
    reference_bar_count: referenceSession.bar_count,
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
  };
}

function deriveLevelsByDate(intradayBars, tradingDates, options = {}) {
  const sessions = buildFuturesSessionBars(intradayBars);
  const atrLength = options.atrLength || DEFAULT_ATR_LENGTH;
  const atrSeries = computeWilderAtr(sessions, atrLength);
  const byDate = new Map(sessions.map((session, idx) => [session.date, { session, atr: atrSeries[idx] }]));
  const sessionDates = sessions.map(session => session.date).sort();
  const result = {};

  for (const targetDate of tradingDates || []) {
    // Pine close[1]/atr[1] on the Day timeframe means the prior completed
    // extended daily bar, not necessarily the prior calendar date. For Monday
    // sessions this correctly references Friday, while levels still become
    // valid at Sunday 18:00 ET.
    const referenceDate = [...sessionDates].reverse().find(date => date < targetDate);
    const reference = byDate.get(referenceDate);
    if (!reference) {
      result[targetDate] = {
        valid: false,
        error: `No completed prior ES futures session found before ${targetDate}`,
        required_reference_date: referenceDate,
      };
      continue;
    }
    if (!Number.isFinite(reference.atr)) {
      result[targetDate] = {
        valid: false,
        error: `Need at least ${atrLength + 1} ES futures sessions to derive Saty ATR`,
        required_reference_date: referenceDate,
        reference_date: reference.session.date,
        reference_bar_count: reference.session.bar_count,
      };
      continue;
    }
    result[targetDate] = {
      ...deriveSatyLevelsFromReferenceSession(reference.session, reference.atr, options),
      target_session_date: targetDate,
      valid_from: `${dateAdd(targetDate, -1)}T18:00:00`,
      valid_until: `${targetDate}T17:00:00`,
    };
  }

  return result;
}

module.exports = {
  buildFuturesSessionBars,
  deriveLevelsByDate,
  deriveSatyLevelsFromReferenceSession,
  _internal: {
    round2,
    dateAdd,
    minutesOfDay,
    futuresSessionDateForTimestamp,
    isInsideFuturesSession,
    summarizeBarsAsSession,
    trueRange,
    computeWilderAtr,
  },
};
