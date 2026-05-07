'use strict';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const OPEN_MINS = 570; // 9:30 AM ET
const CLOSE_MINS = 960; // 4:00 PM ET
const FUTURES_OPEN_MINS = 1080; // 6:00 PM ET
const FUTURES_PAUSE_MINS = 1020; // 5:00 PM ET

function getETComponents(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  return { h, m, etMins: h * 60 + m, weekday };
}

function isWeekend(now = new Date()) {
  const { weekday } = getETComponents(now);
  return weekday === 'Sat' || weekday === 'Sun';
}

function isMarketOpen(now = new Date()) {
  const { etMins, weekday } = getETComponents(now);
  if (!WEEKDAYS.includes(weekday)) {
    return { open: false, session: 'closed', message: 'Weekend - cash market closed' };
  }
  if (etMins < OPEN_MINS) {
    return { open: false, session: 'pre', message: 'Pre-market (before 9:30 AM ET)' };
  }
  if (etMins >= CLOSE_MINS) {
    return { open: false, session: 'after', message: 'After-hours (after 4:00 PM ET)' };
  }
  return { open: true, session: 'regular', message: 'Regular session (9:30 AM-4:00 PM ET)' };
}

function isFuturesMarketOpen(now = new Date()) {
  const { etMins, weekday } = getETComponents(now);
  if (weekday === 'Sat') {
    return { open: false, session: 'closed', message: 'Futures weekend close' };
  }
  if (weekday === 'Sun') {
    if (etMins >= FUTURES_OPEN_MINS) {
      return { open: true, session: 'futures_overnight', message: 'Futures overnight session open' };
    }
    return { open: false, session: 'closed', message: 'Futures reopen Sunday 6:00 PM ET' };
  }
  if (weekday === 'Fri' && etMins >= FUTURES_PAUSE_MINS) {
    return { open: false, session: 'closed', message: 'Futures weekend close after Friday 5:00 PM ET' };
  }
  if (etMins >= FUTURES_PAUSE_MINS && etMins < FUTURES_OPEN_MINS) {
    return { open: false, session: 'maintenance', message: 'Futures daily maintenance break (5:00-6:00 PM ET)' };
  }
  if (etMins < OPEN_MINS) {
    return { open: true, session: 'futures_overnight', message: 'Futures overnight session open' };
  }
  if (etMins >= CLOSE_MINS) {
    return { open: true, session: 'futures_after_hours', message: 'Futures after-hours session open' };
  }
  return { open: true, session: 'regular', message: 'Regular cash session and futures session open' };
}

function isGoodTradingTime(now = new Date()) {
  const { etMins, weekday } = getETComponents(now);
  if (!WEEKDAYS.includes(weekday) || etMins < OPEN_MINS || etMins >= CLOSE_MINS) {
    return { good: false, window: 'closed', message: 'Market closed' };
  }
  if (etMins >= 950) {
    return { good: false, window: 'last10', message: 'Last 10 mins (3:50-4:00 PM ET) - no new Pine/Luke Watch entries' };
  }
  if (etMins >= 780) {
    return { good: true, window: 'afternoon', message: 'Afternoon window (1:00-3:50 PM ET)' };
  }
  if (etMins >= 690) {
    return { good: false, window: 'lunch', message: 'Lunch chop (11:30 AM-1:00 PM ET)' };
  }
  return { good: true, window: 'morning', message: 'Morning window (9:30-11:30 AM ET) - best time' };
}

function minsUntilOpen(now = new Date()) {
  const { etMins, weekday } = getETComponents(now);
  if (WEEKDAYS.includes(weekday) && etMins < OPEN_MINS) {
    return OPEN_MINS - etMins;
  }
  let daysToAdd = 1;
  if (weekday === 'Fri') daysToAdd = 3;
  else if (weekday === 'Sat') daysToAdd = 2;
  const minsUntilMidnight = 24 * 60 - etMins;
  return minsUntilMidnight + (daysToAdd - 1) * 24 * 60 + OPEN_MINS;
}

function minsUntilFuturesOpen(now = new Date()) {
  const { etMins, weekday } = getETComponents(now);
  const futures = isFuturesMarketOpen(now);
  if (futures.open) return 0;
  if (weekday === 'Sun') return FUTURES_OPEN_MINS - etMins;
  if (weekday === 'Sat') return (24 * 60 - etMins) + FUTURES_OPEN_MINS;
  if (etMins >= FUTURES_PAUSE_MINS && etMins < FUTURES_OPEN_MINS) return FUTURES_OPEN_MINS - etMins;
  if (weekday === 'Fri') return (2 * 24 * 60) + (24 * 60 - etMins) + FUTURES_OPEN_MINS;
  return 0;
}

module.exports = {
  isWeekend,
  isMarketOpen,
  isFuturesMarketOpen,
  isGoodTradingTime,
  minsUntilOpen,
  minsUntilFuturesOpen,
  _internal: { getETComponents },
};
