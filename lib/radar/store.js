'use strict';

const fs = require('fs');
const path = require('path');

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function appendJsonl(file, row) {
  ensureParent(file);
  fs.appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
}

function writeJson(file, value) {
  ensureParent(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function findByHash(file, hash) {
  if (!hash) return null;
  return readJsonl(file).find(row => row.raw_hash === hash) || null;
}

module.exports = {
  appendJsonl,
  findByHash,
  readJsonl,
  writeJson,
};
