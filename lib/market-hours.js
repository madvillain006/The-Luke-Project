'use strict';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const OPEN_MINS  = 570;  // 9:30 AM ET
const CLOSE_MINS = 960;  // 4:00 PM ET

function getETComponents() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short'
  }).formatToParts(now);
  const h       = parseInt(parts.find(p => p.type === 'hour')?.value    || '0');
  const m       = parseInt(parts.find(p => p.type === 'minute')?.value  || '0');
  const weekday =          parts.find(p => p.type === 'weekday')?.value || '';
  return { h, m, etMins: h * 60 + m, weekday };
}

function isWeekend() {
  const { weekday } = getETComponents();
  return weekday === 'Sat' || weekday === 'Sun';
}

function isMarketOpen() {
  const { etMins, weekday } = getETComponents();
  if (!WEEKDAYS.includes(weekday)) {
    return { open: false, session: 'closed', message: 'Weekend — market closed' };
  }
  if (etMins < OPEN_MINS) {
    return { open: false, session: 'pre', message: 'Pre-market (before 9:30 AM ET)' };
  }
  if (etMins >= CLOSE_MINS) {
    return { open: false, session: 'after', message: 'After-hours (after 4:00 PM ET)' };
  }
  return { open: true, session: 'regular', message: 'Regular session (9:30 AM–4:00 PM ET)' };
}

function isGoodTradingTime() {
  const { etMins, weekday } = getETComponents();
  if (!WEEKDAYS.includes(weekday) || etMins < OPEN_MINS || etMins >= CLOSE_MINS) {
    return { good: false, window: 'closed', message: 'Market closed' };
  }
  if (etMins >= 950) {
    return { good: false, window: 'last10', message: 'Last 10 mins (3:50–4:00 PM ET) — Ximes says no responsibility after 3:49' };
  }
  if (etMins >= 780) {
    return { good: true,  window: 'afternoon', message: 'Afternoon window (1:00–3:50 PM ET)' };
  }
  if (etMins >= 690) {
    return { good: false, window: 'lunch', message: 'Lunch chop (11:30 AM–1:00 PM ET)' };
  }
  return { good: true, window: 'morning', message: 'Morning window (9:30–11:30 AM ET) — best time' };
}

function minsUntilOpen() {
  const { etMins, weekday } = getETComponents();
  if (WEEKDAYS.includes(weekday) && etMins < OPEN_MINS) {
    return OPEN_MINS - etMins;
  }
  let daysToAdd = 1;
  if (weekday === 'Fri') daysToAdd = 3;
  else if (weekday === 'Sat') daysToAdd = 2;
  const minsUntilMidnight = 24 * 60 - etMins;
  return minsUntilMidnight + (daysToAdd - 1) * 24 * 60 + OPEN_MINS;
}

module.exports = { isWeekend, isMarketOpen, isGoodTradingTime, minsUntilOpen };
