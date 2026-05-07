'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (err) {
        return {
          _parse_error: err.message,
          _line: index + 1,
          raw_line_hash: sha256(line),
        };
      }
    });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function writeJsonl(file, rows) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, (rows || []).map(row => JSON.stringify(row)).join('\n') + ((rows || []).length ? '\n' : ''), 'utf8');
}

function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, String(text || ''), 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function isoOrNull(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function compactText(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)).trimEnd() + '...';
}

module.exports = {
  ROOT,
  compactText,
  ensureDir,
  isoOrNull,
  readJson,
  readJsonl,
  rel,
  sha256,
  toMs,
  writeJson,
  writeJsonl,
  writeText,
};
