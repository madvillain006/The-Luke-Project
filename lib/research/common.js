'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RESEARCH_ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'research');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map((line, idx) => {
      try { return JSON.parse(line); }
      catch (err) { throw new Error(`${filePath}:${idx + 1}: ${err.message}`); }
    });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function writeCsv(filePath, rows, columns) {
  ensureDir(path.dirname(filePath));
  const escape = value => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map(col => escape(row[col])).join(','));
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function walkFiles(root, options = {}) {
  const out = [];
  const maxFiles = options.maxFiles || Infinity;
  function walk(current) {
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function datePart(timestamp) {
  const m = String(timestamp || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function offsetForDate(date) {
  if (!date) return '-05:00';
  return date >= '2026-03-08' && date < '2026-11-01' ? '-04:00' : '-05:00';
}

function etIso(date, hhmmss = '09:25:00') {
  return `${date}T${hhmmss}${offsetForDate(date)}`;
}

function isParseableTimestamp(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t);
}

function tsMs(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function average(values) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

module.exports = {
  ROOT,
  RESEARCH_ARTIFACT_DIR,
  ensureDir,
  readJson,
  readJsonl,
  writeJson,
  writeCsv,
  walkFiles,
  datePart,
  etIso,
  isParseableTimestamp,
  tsMs,
  relativePath,
  numeric,
  median,
  average,
};
