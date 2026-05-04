'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readJson } = require('./common');
const { loadIntraday, _internal: historicalInternal } = require('../historical-data');

const SESSION_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');

function listSessionDates() {
  if (!fs.existsSync(SESSION_DIR)) return [];
  return fs.readdirSync(SESSION_DIR)
    .filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map(name => name.slice(0, 10))
    .sort();
}

function loadSession(date) {
  return readJson(path.join(SESSION_DIR, `${date}.json`));
}

function loadUsableSessions(options = {}) {
  const dates = options.dates || listSessionDates();
  const sessions = [];
  const excluded = [];
  for (const date of dates) {
    const session = loadSession(date);
    if (!session) {
      excluded.push({ date, reason: 'missing_session_json' });
      continue;
    }
    const bars = session.bars?.rth?.length ? session.bars.rth : (session.bars?.es || []);
    if (!Array.isArray(bars) || bars.length === 0 || session.usable === false) {
      excluded.push({ date, reason: session.excludedReason || 'missing_usable_es_bars' });
      continue;
    }
    sessions.push({ ...session, replayBars: bars });
  }
  return { sessions, excluded };
}

function loadHistoricalCsvBars(instrument, date = null, root = null) {
  if (root) historicalInternal._setHistoricalRoot(root);
  try {
    return loadIntraday(instrument, date) || [];
  } finally {
    if (root) historicalInternal._resetHistoricalRoot();
  }
}

function summarizeBars(bars) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { count: 0, date_range: null, first_timestamp: null, last_timestamp: null };
  }
  return {
    count: bars.length,
    date_range: {
      start: bars[0].timestamp.slice(0, 10),
      end: bars[bars.length - 1].timestamp.slice(0, 10),
    },
    first_timestamp: bars[0].timestamp,
    last_timestamp: bars[bars.length - 1].timestamp,
  };
}

module.exports = {
  SESSION_DIR,
  listSessionDates,
  loadSession,
  loadUsableSessions,
  loadHistoricalCsvBars,
  summarizeBars,
};
