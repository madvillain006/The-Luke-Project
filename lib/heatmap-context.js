'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TODAY_LEVELS_FILE = path.join(ROOT, 'data', 'today-levels.json');
const DAILY_CTX_FILE = path.join(ROOT, 'data', 'daily-context.json');
const BOBBY_EVENTS_FILE = path.join(ROOT, 'state', 'events', 'bobby-context.jsonl');

const HEATMAP_QUESTION_RE = /\b(heatmap|bobby|nodes?|king\s+nodes?|purple|yellow|gamma|dealer|trinity|air\s+pockets?)\b/i;
const FOLLOWUP_RE = /\b(tell me|what|explain|about|recap|summary|summarize|show|read|stored|loaded|gave|image|picture|it)\b/i;
const STORED_REFERENCE_RE = /\b(just\s+gave|gave\s+(it|that)|sent\s+(it|that)|pasted\s+(it|that)|uploaded\s+(it|that)|that\s+image|the\s+image|in\s+the\s+image|stored)\b/i;

function todayKeyET(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8')
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

function list(values) {
  return Array.isArray(values) && values.length ? values.join(', ') : 'none';
}

function formatAge(iso, now = new Date()) {
  const ms = now.getTime() - new Date(iso || 0).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'unknown age';
  const minutes = Math.round(ms / 60000);
  if (minutes < 90) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function bobbyAgeSource(bobby, levels, today, now) {
  if (bobby?.date || bobby?.ts) return bobby.date || bobby.ts;
  if (levels?.date === today) return now.toISOString();
  return null;
}

function latestBobby(state) {
  const rows = Array.isArray(state?.bobby) ? state.bobby.filter(Boolean) : [];
  return rows
    .slice()
    .sort((a, b) => new Date(b.date || b.ts || 0) - new Date(a.date || a.ts || 0))[0] || null;
}

function sameETDate(iso, today) {
  const date = new Date(iso || 0);
  if (!Number.isFinite(date.getTime())) return false;
  return todayKeyET(date) === today;
}

function latestBobbyEvent(rows, today) {
  const events = Array.isArray(rows) ? rows : [];
  return events
    .filter(row => row && sameETDate(row.date || row.ts, today))
    .filter(row => row.source === 'bobby-vision' || row.source === 'bobby-text' || row.vision_parsed || row.panels || row.king_nodes)
    .sort((a, b) => new Date(b.date || b.ts || 0) - new Date(a.date || a.ts || 0))[0] || null;
}

function buildStoredHeatmapAnswer(message, options = {}) {
  const text = String(message || '');
  const explicitHeatmapQuestion = HEATMAP_QUESTION_RE.test(text) && FOLLOWUP_RE.test(text);
  const storedReferenceCandidate = STORED_REFERENCE_RE.test(text);
  if (!explicitHeatmapQuestion && !storedReferenceCandidate) return null;

  const now = options.now || new Date();
  const levels = Object.prototype.hasOwnProperty.call(options, 'levels')
    ? options.levels
    : readJson(options.todayLevelsFile || TODAY_LEVELS_FILE);
  const dailyContext = Object.prototype.hasOwnProperty.call(options, 'dailyContext')
    ? options.dailyContext
    : readJson(options.dailyContextFile || DAILY_CTX_FILE);
  const today = todayKeyET(now);
  const levelBobby = levels?.date === today ? latestBobby(levels) : null;
  const eventRows = Object.prototype.hasOwnProperty.call(options, 'events')
    ? options.events
    : readJsonl(options.bobbyEventsFile || BOBBY_EVENTS_FILE);
  const bobby = levelBobby || latestBobbyEvent(eventRows, today);
  const hasStoredHeatmap = Boolean(bobby || dailyContext?.heatmap);

  if (storedReferenceCandidate && !hasStoredHeatmap) return null;

  if (!bobby) {
    if (dailyContext?.heatmap) {
      return [
        `I have the heatmap marked as received from ${dailyContext.heatmap.source || 'unknown source'} (${formatAge(dailyContext.heatmap.stored_at, now)}), but I do not have parsed Bobby node details in today's level file.`,
        'Run `/heatmap` with the image/text again or `/nodes` if you want me to inspect whatever nodes are currently in memory.',
      ].join('\n');
    }
    return 'No Bobby heatmap is loaded for today. Paste the image or text with `/heatmap` first.';
  }

  const panels = Array.isArray(bobby.panels) ? bobby.panels : [];
  const panelLines = panels.map(panel => {
    const price = Number.isFinite(panel.current_price) ? ` image price ${panel.current_price}` : '';
    return `- ${panel.ticker || panel.instrument || 'UNKNOWN'}:${price}; kings ${list(panel.king_nodes)}; support ${list(panel.support)}; resistance ${list(panel.resistance)}.`;
  });

  return [
    `Yes, the heatmap is stored. Source: ${bobby.source || 'Bobby heatmap'}${bobby.vision_parsed ? ' via vision' : ''}; age ${formatAge(bobbyAgeSource(bobby, levels, today, now), now)}.`,
    `Bias: ${bobby.bias || 'unknown'}${bobby.trinity ? '; trinity view parsed' : ''}.`,
    `King nodes: ${list(bobby.king_nodes)}.`,
    `Support/floors: ${list(bobby.support)}.`,
    `Resistance/walls: ${list(bobby.resistance)}.`,
    bobby.air_pockets?.length ? `Air pockets: ${list(bobby.air_pockets)}.` : null,
    panelLines.length ? `Panels:\n${panelLines.join('\n')}` : null,
    bobby.notes ? `Read: ${bobby.notes}` : null,
    bobby.vision_parsed
      ? 'This is stored image-derived context, not live price. Use `/verdict ES` or `/entries ES` with current Luke Watch Pine context.'
      : 'This is stored text-derived heatmap context, not live price. Use `/verdict ES` or `/entries ES` with current Luke Watch Pine context.',
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildStoredHeatmapAnswer,
  _internal: {
    HEATMAP_QUESTION_RE,
    FOLLOWUP_RE,
    latestBobby,
    latestBobbyEvent,
    formatAge,
    bobbyAgeSource,
    todayKeyET,
  },
};
