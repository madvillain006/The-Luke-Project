'use strict';

const fs = require('fs');
const path = require('path');
const { isGoodTradingTime } = require('./market-hours');
const { events } = require('./paths');

const BOBBY_CONTEXT_FILE = events.bobbyContext;
const DAILY_CTX_FILE = path.join(__dirname, '..', 'data', 'daily-context.json');

function getETMinutes() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  return h * 60 + m;
}

function getTodayET() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
}

function loadTodayBobbyContext() {
  const today = getTodayET();
  try {
    if (!fs.existsSync(BOBBY_CONTEXT_FILE)) return [];
    return fs.readFileSync(BOBBY_CONTEXT_FILE, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && (e.date || e.timestamp || '').startsWith(today));
  } catch { return []; }
}

function loadTodayPineContext(today) {
  try {
    if (!fs.existsSync(DAILY_CTX_FILE)) return null;
    const ctx = JSON.parse(fs.readFileSync(DAILY_CTX_FILE, 'utf8'));
    const rawDate = ctx.pine_watch?.stored_at || ctx.updated_at || ctx.date || '';
    if (rawDate && !String(rawDate).startsWith(today)) return null;
    return ctx.pine_watch || null;
  } catch { return null; }
}

function getSiennaRegime() {
  const etMins = getETMinutes();
  const today = getTodayET();
  const bobbyCtx = loadTodayBobbyContext();
  const pineCtx = loadTodayPineContext(today);
  const pineRaw = String(pineCtx?.raw || '');

  void etMins;

  if (bobbyCtx.some(e => e.vix_mentioned === true)) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'VIX mentioned in bobby context today' };
  }

  if (/\b(LUKE\s+BLOCKED|LUKE\s+INVALIDATED|BLOCKED|INVALIDATED)\b/i.test(pineRaw)) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Luke Watch Pine blocked or invalidated the setup' };
  }

  if (isGoodTradingTime().window === 'lunch') {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Lunch chop window (11:30 AM-1:00 PM ET)' };
  }

  if (bobbyCtx.some(e => (e.raw || e.content || '').toUpperCase().includes('TRINITY') || (e.signal_type || '').toUpperCase().includes('TRINITY'))) {
    return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'Bobby TRINITY signal today' };
  }

  if (/\b(LUKE\s+ARMED|LUKE\s+LONG|LUKE\s+PAPER_CANDIDATE|ARMED|PAPER_CANDIDATE)\b/i.test(pineRaw)) {
    return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'Luke Watch Pine armed/candidate context today' };
  }

  return { regime: 'NEUTRAL', selectivity: 'HIGH', max_trades_today: 2, confidence_boost: 0, reason: 'No elevated risk signals or special setups' };
}

module.exports = { getSiennaRegime };
