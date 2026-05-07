'use strict';

const fs   = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../state/lib');
const { parseBobby }      = require('./parse-bobby');
const { log }             = require('./logger');

const LUKE_ROOT    = path.join(__dirname, '..');
const DATA_DIR       = path.join(LUKE_ROOT, 'data');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const LEVELS_FILE    = path.join(DATA_DIR, 'today-levels.json');

//  Date helpers 
function todayKeyCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}
function todayKeyET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

//  Context persistence 
function loadDailyContext() {
  const today = todayKeyCT();
  try {
    const obj = JSON.parse(fs.readFileSync(DAILY_CTX_FILE, 'utf8'));
    if (obj.date === today) return obj;
  } catch {}
  return { date: today };
}

function saveDailyContext(ctx) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    writeJsonAtomic(DAILY_CTX_FILE, ctx);
  } catch (e) {
    log('daily-ctx-save-error', { error: e.message });
  }
}

//  Kat/Jefe SPX trade text patterns 
// Require both SPX mention + directional language AND a price-level number.
// Exclude RichyDubz pastes (they have the analyst name and are handled by detectPasteIntent -> /dubz).
const KAT_SPX_RE   = /\bspx\b[\s\S]{0,120}\b(bull(?:ish)?|bear(?:ish)?|long|short|calls?|puts?|bias|setup|above|below|target|support|resistance)\b/i;
const KAT_LEVEL_RE = /\b(5[5-9]\d\d|6\d{3}|7[0-4]\d\d)\b/;
const RICHY_RE     = /\b(richy|richydubz|richyd)\b/i;
const SATY_HINT_RE = /\b(atr|prev\s*close|call\s*trigger|put\s*trigger|ribbon|saty)\b/i;
const DUBZ_HINT_RE = /\b(levels?|support|resistance|reclaim|fails?|target|magnet|bonus|range\s+res|range\s+support)\b/i;
const PINE_WATCH_RE = /\bLUKE\s+(WATCH|ARMED|LONG|PAPER_CANDIDATE|INVALIDATED|BLOCKED)\b|\bPAPER_CANDIDATE\b|\bWATCHLIST ONLY\b/i;
const PRICE_RE     = /\b(\d{3,6}(?:\.\d{1,2})?)\b/g;

//  Paste classifier 
// Returns { type, confidence, parsed } or { type: null } to fall through.
function classifyPaste(text) {
  if (!text || typeof text !== 'string') return { type: null };
  const t = text.trim();
  if (t.length < 10) return { type: null };

  // Richy/Dubz pastes must fall through to detectPasteIntent -> /dubz.
  if (RICHY_RE.test(t.slice(0, 200))) {
    return { type: null };
  }

  if (PINE_WATCH_RE.test(t)) {
    return { type: 'pine_watch', confidence: 'high', parsed: null };
  }

  // Bobby heatmap text: only auto-ingest when the parser found concrete levels.
  // Bias-only Bobby commentary is useful when explicitly pasted, but it is too
  // permissive for normal chat questions that mention loaded Bobby context.
  const bobbyParsed = parseBobby(t);
  const bobbyLevelCount = bobbyParsed
    ? (bobbyParsed.king_nodes?.length || 0) +
      (bobbyParsed.support?.length || 0) +
      (bobbyParsed.resistance?.length || 0) +
      (bobbyParsed.air_pockets?.length || 0)
    : 0;
  if (bobbyParsed && bobbyLevelCount > 0) {
    return { type: 'bobby', confidence: 'high', parsed: bobbyParsed };
  }

  // Kat/Jefe SPX trade text  must not be a RichyDubz paste
  if (!RICHY_RE.test(t.slice(0, 200)) && KAT_SPX_RE.test(t) && KAT_LEVEL_RE.test(t)) {
    return { type: 'kat', confidence: 'medium', parsed: null };
  }

  const nums = [...t.matchAll(PRICE_RE)].map(m => parseFloat(m[1])).filter(n => n > 100 && n < 999999);

  if ((SATY_HINT_RE.test(t) && nums.length > 0 && nums.length < 13) ||
      (nums.length >= 5 && nums.length < 13 && !/\b(spx|es|nq|spy|qqq)\b/i.test(t))) {
    return { type: 'saty_partial', confidence: 'medium', parsed: { count: nums.length } };
  }

  if (nums.length >= 2 && DUBZ_HINT_RE.test(t) && !SATY_HINT_RE.test(t)) {
    return { type: 'dubz_partial', confidence: 'medium', parsed: { count: nums.length } };
  }

  // Unknown: multi-line with price-level numbers looks like a trading paste
  if (t.includes('\n') && /\b\d{4,5}\b/.test(t)) {
    return { type: 'unknown', confidence: 'low', parsed: { count: nums.length } };
  }

  return { type: null };
}

//  Checklist 
// Heatmap is satisfied by: ctx.heatmap OR today-levels.json with bobby entries (loaded today ET).
function heatmapLoaded(ctx) {
  if (ctx.heatmap) return true;
  try {
    const obj = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
    return obj.date === todayKeyET() && Array.isArray(obj.bobby) && obj.bobby.length > 0;
  } catch { return false; }
}

function checklistComplete(ctx) {
  const hasBobby = heatmapLoaded(ctx);
  const missing  = [];
  if (!hasBobby) missing.push('Katbot/SPX heatmap');
  return { complete: hasBobby, missing };
}

//  Ack message builder 
const TYPE_LABELS = {
  heatmap:       'Katbot/SPX heatmap',
  kat:           'Katbot analyst context',
  pine_watch:    'Luke Watch Pine alert',
  saty_partial:  'partial Saty input',
  dubz_partial:  'partial Dubz input',
};

function buildAckMessage(type, missing) {
  const label = TYPE_LABELS[type] || type;
  if (missing.length === 0) return `Got it - ${label} stored. Pine confluence context ready.`;
  return `Got it - ${label} stored. Still waiting: ${missing.join(', ')}.`;
}

//  res wrappers 

// Prepends prefix to reply before forwarding to real res.json().
function prependRes(res, prefix) {
  return {
    json(data) {
      if (data && typeof data.reply === 'string') {
        res.json({ ...data, reply: prefix + data.reply });
      } else {
        res.json(data);
      }
    },
    get _heatmapImage()    { return res._heatmapImage; },
    set _heatmapImage(v)   { res._heatmapImage = v; },
  };
}

//  Main accumulator hook 
// Returns true if handled (caller must return), false to fall through.
async function handlePasteAccumulate(message, image, res) {
  try {
    // Lazy-require avoids load-order issues; slash-commands is always loaded by index.js first.
    const { handleSlashCommand } = require('./slash-commands');

    //  Image paste  heatmap (Bobby or Jefe/Kat) 
    if (image) {
      const ctx = loadDailyContext();
      ctx.heatmap = { source: 'image', stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'heatmap-image-stored' });

      const { missing } = checklistComplete(ctx);
      const ackMsg = buildAckMessage('heatmap', missing);
      res._heatmapImage = image;
      await handleSlashCommand('/heatmap ', prependRes(res, ackMsg + '\n\n'));
      return true;
    }

    const classified = classifyPaste(message);
    if (classified.type === null) return false; // conversational  fall through

    const ctx = loadDailyContext();

    //  Luke Watch Pine alert text
    if (classified.type === 'pine_watch') {
      ctx.pine_watch = { raw: message.slice(0, 500), stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'pine-watch-stored' });
      const { missing } = checklistComplete(ctx);
      res.json({ reply: buildAckMessage('pine_watch', missing) + '\nUse /entries ES for bracket/readiness. No execution is armed here.' });
      return true;
    }

    //  Bobby heatmap text 
    if (classified.type === 'bobby') {
      ctx.heatmap = { source: 'bobby-text', stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'bobby-text-stored' });

      const { missing } = checklistComplete(ctx);
      const ackMsg = buildAckMessage('heatmap', missing);
      await handleSlashCommand('/heatmap ' + message, prependRes(res, ackMsg + '\n\n'));
      return true;
    }

    //  Kat/Jefe SPX trade text (optional; store + ack only) 
    if (classified.type === 'kat') {
      ctx.kat_text = { raw: message.slice(0, 500), stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'kat-text-stored' });
      const { missing } = checklistComplete(ctx);
      res.json({ reply: buildAckMessage('kat', missing) });
      return true;
    }

    //  Unknown trading-looking paste 
    if (classified.type === 'saty_partial') {
      const count = classified.parsed?.count ?? 0;
      res.json({
        reply: [
          `This looks like partial Saty input${count ? ` (${count} prices)` : ''}.`,
          'Need the full 13 Saty levels.',
          'Load them by 8:30 AM ET if they are not already in.',
          'Use: /saty [13 levels highest to lowest]',
        ].join('\n'),
      });
      return true;
    }

    if (classified.type === 'dubz_partial') {
      const count = classified.parsed?.count ?? 0;
      res.json({
        reply: [
          `This looks like partial Dubz or level context${count ? ` (${count} prices)` : ''}.`,
          'Need the full RichyDubz morning block for reliable confluence.',
          'Use: /dubz [full RichyDubz text]',
          'If this is Katbot/SPX heatmap context, use /heatmap instead.',
        ].join('\n'),
      });
      return true;
    }

    if (classified.type === 'unknown') {
      res.json({
        reply: [
          "I don't recognize this paste. Is it a:",
          "-> Luke Watch Pine alert - paste as-is",
          "-> Katbot/SPX heatmap text - paste as-is, or drop an image",
          "-> Katbot analyst chart/context - paste as-is",
          "-> Something else? Tell me what this is.",
        ].join('\n'),
      });
      return true;
    }

    return false;

  } catch (e) {
    log('daily-ctx-error', { error: e.message });
    return false; // fail open  fall through to existing handling
  }
}

module.exports = {
  DAILY_CTX_FILE,
  loadDailyContext,
  saveDailyContext,
  classifyPaste,
  checklistComplete,
  handlePasteAccumulate,
};
