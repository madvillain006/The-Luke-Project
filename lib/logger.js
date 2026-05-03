const fs = require("fs");
const { events } = require("./paths");

const LOG_FILE = events.lukeLog;

function log(type, data) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + "\n");
}

module.exports = { log };
