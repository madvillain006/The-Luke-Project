'use strict';

const fs = require('fs');
const path = require('path');
const { findBobbyBySourceId } = require('./bobby-heatmap-idempotency');

function getTodayLevelsFile(rootDir) {
  return path.join(rootDir, 'data', 'today-levels.json');
}

function todayKeyUTC(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function inferRootDir(filePath) {
  const dataDir = path.dirname(filePath);
  return path.basename(dataDir).toLowerCase() === 'data' ? path.dirname(dataDir) : null;
}

function countLoadedLevels(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return (Array.isArray(obj.richyd) ? obj.richyd.length : 0) +
    (Array.isArray(obj.bobby) ? obj.bobby.length : 0);
}

function hasLevelsLoadedToday(filePath, now = new Date()) {
  const today = todayKeyUTC(now);
  const obj = readJsonObject(filePath);
  if (obj && obj.date === today && countLoadedLevels(obj) > 0) return true;

  const rootDir = inferRootDir(filePath);
  if (!rootDir) return false;

  const dailyContext = readJsonObject(path.join(rootDir, 'data', 'daily-context.json'));
  if (dailyContext && dailyContext.date === today && dailyContext.heatmap) return true;

  const bobbyEvents = readJsonl(path.join(rootDir, 'state', 'events', 'bobby-context.jsonl'));
  return bobbyEvents.some(row => {
    const date = String(row?.date || row?.ts || '');
    return date.startsWith(today) && (row.source === 'bobby-vision' || row.vision_parsed || row.panels || row.king_nodes);
  });
}

function levelsLoadedLabel(filePath, now = new Date()) {
  return hasLevelsLoadedToday(filePath, now) ? 'YES' : 'NO';
}

function makeLevelsWarningPayload() {
  return {
    type: 'levels_warning',
    message: 'Warning: No levels loaded. Paste /heatmap [Bobby text] before trading.',
  };
}

function appendBobbyVisionResult(filePath, result, now = new Date()) {
  if (!result || typeof result !== 'object') throw new Error('Bobby vision result is required');

  const today = todayKeyUTC(now);
  const existing = readJsonObject(filePath);
  const obj = existing && existing.date === today
    ? existing
    : { date: today, richyd: [], bobby: [] };

  const enriched = {
    ...result,
    date: now.toISOString(),
    source: 'bobby-vision',
  };

  obj.richyd = Array.isArray(obj.richyd) ? obj.richyd : [];
  obj.bobby = Array.isArray(obj.bobby) ? obj.bobby : [];
  if (!findBobbyBySourceId(obj, enriched.source_id)) {
    obj.bobby = [...obj.bobby, enriched];
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
  return obj;
}

module.exports = {
  getTodayLevelsFile,
  todayKeyUTC,
  countLoadedLevels,
  hasLevelsLoadedToday,
  levelsLoadedLabel,
  makeLevelsWarningPayload,
  appendBobbyVisionResult,
  _internal: {
    readJsonObject,
    readJsonl,
    inferRootDir,
  },
};
