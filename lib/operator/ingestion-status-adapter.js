'use strict';

const fs = require('fs');
const path = require('path');

const { _internal: decisionSpineInternal } = require('../decision-spine');
const { buildLevelMemorySummary } = require('./level-memory-adapter');

const LUKE_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(LUKE_ROOT, 'data');

const FILES = {
  saty: path.join(DATA_DIR, 'saty-levels.json'),
  dubz: path.join(DATA_DIR, 'dubz-levels.json'),
  daily_context: path.join(DATA_DIR, 'daily-context.json'),
  today_levels: path.join(DATA_DIR, 'today-levels.json'),
  level_memory: path.join(DATA_DIR, 'level-memory.json'),
  apex_state: path.join(DATA_DIR, 'apex-state.json'),
};

function readJsonStatus(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 'missing', path: filePath, value: null, error: 'missing' };
    }
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { ok: true, status: 'ok', path: filePath, value, error: null };
  } catch (err) {
    return { ok: false, status: 'corrupt', path: filePath, value: null, error: err.message };
  }
}

function fileSummary(readResult) {
  return {
    status: readResult.status,
    path: readResult.path,
    error: readResult.error,
  };
}

function buildIngestionStatus({ now = new Date(), files = FILES } = {}) {
  const reads = Object.fromEntries(
    Object.entries(files).map(([key, filePath]) => [key, readJsonStatus(filePath)])
  );
  const freshness = decisionSpineInternal.buildFreshness(now);
  const levelMemory = buildLevelMemorySummary({ now });
  const blockers = [];

  for (const [key, result] of Object.entries(reads)) {
    if (result.status === 'corrupt') blockers.push(`${key} state corrupt: ${result.error}`);
  }
  if (!freshness.saty.loaded) blockers.push('Saty missing or stale');
  if (!freshness.bobby.loaded) blockers.push('Bobby heatmap missing or stale');
  if (!freshness.dubz.loaded) blockers.push('Dubz missing or stale');
  if (!levelMemory.ok) blockers.push(...levelMemory.blockers);

  return {
    ok: blockers.length === 0,
    blockers,
    freshness,
    state_files: Object.fromEntries(
      Object.entries(reads).map(([key, result]) => [key, fileSummary(result)])
    ),
    level_memory: levelMemory,
  };
}

module.exports = {
  buildIngestionStatus,
  readJsonStatus,
  FILES,
};
