'use strict';

const fs   = require('fs');
const path = require('path');
const { parseXimes } = require('../lib/parse-ximes');
const { parseBobby } = require('../lib/parse-bobby');
const { ROOT, events } = require('../lib/paths');

const EXPORTS_DIR  = path.join(ROOT, 'discord-exports', 'processed');
const HISTORY_FILE = events.discordHistory;
const BOBBY_FILE   = events.bobbyContext;

// Parse Discord export text into [{username, text}] pairs.
// Handles: [date time] username: message
function parseMessages(text) {
  const messages = [];
  const lines = text.split('\n');
  let currentUser = null;
  const headerRe = /^\[(\d+\/\d+\/\d{4}\s+\d+:\d+\s+[AP]M)\]\s+(.+)$/;
  const skipLine = /^\{|={3,}|^Guild:|^Channel:|^$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const hm = headerRe.exec(line);
    if (hm) {
      currentUser = hm[2].trim().toLowerCase().replace(/#\d{4}$/, '');
      continue;
    }
    if (!currentUser) continue;
    if (skipLine.test(line)) continue;
    if (line.length < 2) continue;
    messages.push({ username: currentUser, text: line });
  }
  return messages;
}

function runIngestion() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    console.error('processed/ folder not found:', EXPORTS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(EXPORTS_DIR)
    .filter(f => f.endsWith('.txt') && (f.includes('ximes') || f.includes('bobby')));

  if (!files.length) {
    console.log('No ximes or bobby export files found in processed/');
    return;
  }

  let ximesCount = 0;
  let bobbyCount = 0;

  for (const file of files) {
    const isXimes = file.includes('ximes');
    const isBobby = file.includes('bobby');
    const filePath = path.join(EXPORTS_DIR, file);
    const text     = fs.readFileSync(filePath, 'utf8');
    const messages = parseMessages(text);

    console.log(`${file}: ${messages.length} messages parsed`);

    if (isXimes) {
      let lastSignal     = null;
      let lastSignalTime = null;

      for (const msg of messages) {
        const signal = parseXimes(msg.username, msg.text, lastSignal, lastSignalTime);
        if (!signal) continue;

        const entry = {
          date:     new Date().toISOString(),
          server:   'OWLS Capital',
          channel:  'ximes-dubz',
          priority: 'HIGH',
          source:   'historical-export',
          ...signal
        };
        fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
        lastSignal     = signal;
        lastSignalTime = Date.now();
        ximesCount++;
      }
    }

    if (isBobby) {
      for (const msg of messages) {
        const context = parseBobby(msg.text);
        if (!context) continue;

        const entry = {
          date:    new Date().toISOString(),
          channel: 'bobby-spx-coms',
          source:  'historical-export',
          ...context
        };
        fs.appendFileSync(BOBBY_FILE, JSON.stringify(entry) + '\n');
        bobbyCount++;
      }
    }
  }

  console.log(`\nximes signals written: ${ximesCount}`);
  console.log(`bobby context entries written: ${bobbyCount}`);
}

runIngestion();
