const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function writeJsonAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tempPath = filePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
}

function appendJsonl(filePath, entry) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(entry) + "\n");
}

module.exports = {
  appendJsonl,
  ensureDir,
  readJsonFile,
  writeJsonAtomic,
};
