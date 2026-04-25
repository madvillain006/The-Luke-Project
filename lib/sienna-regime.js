'use strict';

const fs = require('fs');
const path = require('path');
const { isGoodTradingTime } = require('./market-hours');

const LUKE_ROOT = path.join(__dirname, '..');
const BOBBY_CONTEXT_FILE = path.join(LUKE_ROOT, 'bobby-context.jsonl');
const HISTORY_FILE = path.join(LUKE_ROOT, 'discord-history.jsonl');

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

function loadAllXimesSignals(count) {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
    const signals = [];
    for (const line of lines.slice(-400)) {
      try {
        const e = JSON.parse(line);
        if (e.channel !== 'ximes-dubz') continue;
        if (e.source !== 'intraday-scraper' && e.source !== 'historical-export') continue;
        signals.push(e);
      } catch {}
    }
    return signals.slice(-count);
  } catch { return []; }
}

function getSiennaRegime() {
  const etMins = getETMinutes();
  const today = getTodayET();
  const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;

  // Guard: require today's ximes signals before running any detection
  const allRecentXimes = loadAllXimesSignals(50);
  const todayXimes = allRecentXimes.filter(e => {
    const ts = e.timestamp || e.date || '';
    if (ts.startsWith(today)) return true;
    // numeric ms timestamp fallback
    const ms = typeof e.ts === 'number' ? e.ts : (typeof e.timestamp_ms === 'number' ? e.timestamp_ms : 0);
    return ms > 0 && ms >= eightHoursAgo;
  });

  if (todayXimes.length === 0) {
    return { regime: 'NEUTRAL', selectivity: 'NORMAL', max_trades_today: 2, confidence_boost: 0, reason: 'No signals yet today' };
  }

  const bobbyCtx = loadTodayBobbyContext();
  const recentXimes = todayXimes.slice(-3);

  // RISK_OFF: VIX mentioned in bobby context today
  if (bobbyCtx.some(e => e.vix_mentioned === true)) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'VIX mentioned in bobby context today' };
  }

  // RISK_OFF: last 3 today ximes signals are all MANAGEMENT (choppy, no new entries)
  if (recentXimes.length >= 3 && recentXimes.every(e => e.signal_type === 'MANAGEMENT')) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Last 3 ximes signals are MANAGEMENT — choppy' };
  }

  if (isGoodTradingTime().window === 'lunch') {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Lunch chop window (11:30 AM–1:00 PM ET)' };
  }

  // RISK_ON: Bobby has TRINITY signal today
  if (bobbyCtx.some(e => (e.raw || e.content || '').toUpperCase().includes('TRINITY') || (e.signal_type || '').toUpperCase().includes('TRINITY'))) {
    return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'Bobby TRINITY signal today' };
  }

  // RISK_ON: PRE_MARKET_SETUP with HIGH confidence in today's signals only
  for (const e of todayXimes) {
    if (e.signal_type === 'PRE_MARKET_SETUP' && e.confidence === 'HIGH') {
      return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'PRE_MARKET_SETUP HIGH confidence today' };
    }
    for (const r of e.results || []) {
      if (r.signal_type === 'PRE_MARKET_SETUP' && r.confidence === 'HIGH') {
        return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'PRE_MARKET_SETUP HIGH confidence today' };
      }
    }
  }

  return { regime: 'NEUTRAL', selectivity: 'HIGH', max_trades_today: 2, confidence_boost: 0, reason: 'No elevated risk signals or special setups' };
}

module.exports = { getSiennaRegime };
