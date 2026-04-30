'use strict';

const fs = require('fs');
const path = require('path');

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

function countLoadedLevels(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return (Array.isArray(obj.richyd) ? obj.richyd.length : 0) +
    (Array.isArray(obj.bobby) ? obj.bobby.length : 0);
}

function hasLevelsLoadedToday(filePath, now = new Date()) {
  const obj = readJsonObject(filePath);
  return Boolean(obj && obj.date === todayKeyUTC(now) && countLoadedLevels(obj) > 0);
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
  obj.bobby = [...(Array.isArray(obj.bobby) ? obj.bobby : []), enriched];
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
  },
};

