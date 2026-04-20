const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "../jarvis-log.jsonl");

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

module.exports = { log };
