'use strict';

const fs = require('fs');
const path = require('path');
const { events } = require('../paths');

const LUKE_ROOT = path.join(__dirname, '..', '..');

const LOG_FILES = {
  luke: events.lukeLog,
  trading_events: path.join(LUKE_ROOT, 'state', 'events', 'trading-events.jsonl'),
  paper_trades: events.paperTrades,
  trades: events.trades,
};

function readJsonlTail(filePath, limit = 20) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 'missing', path: filePath, entries: [], error: 'missing' };
    }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).slice(-limit);
    const entries = lines.map(line => {
      try { return JSON.parse(line); } catch { return { raw: line, parse_error: true }; }
    });
    return { ok: true, status: 'ok', path: filePath, entries, error: null };
  } catch (err) {
    return { ok: false, status: 'unavailable', path: filePath, entries: [], error: err.message };
  }
}

function buildLogSummary({ limit = 20, files = LOG_FILES } = {}) {
  const logs = Object.fromEntries(
    Object.entries(files).map(([key, filePath]) => [key, readJsonlTail(filePath, limit)])
  );
  const blockers = [];
  for (const [key, result] of Object.entries(logs)) {
    if (result.status === 'unavailable') blockers.push(`${key} log unavailable: ${result.error}`);
  }
  return { ok: blockers.length === 0, blockers, logs };
}

module.exports = {
  buildLogSummary,
  readJsonlTail,
  LOG_FILES,
};
