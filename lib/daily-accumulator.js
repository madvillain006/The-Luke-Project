'use strict';

const fs   = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../state/lib');
const { parseXimes }      = require('./parse-ximes');
const { parseBobby }      = require('./parse-bobby');
const { log }             = require('./logger');

const LUKE_ROOT    = path.join(__dirname, '..');
const DATA_DIR       = path.join(LUKE_ROOT, 'data');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const LEVELS_FILE    = path.join(DATA_DIR, 'today-levels.json');

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayKeyCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}
function todayKeyET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// ── Context persistence ───────────────────────────────────────────────────────
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

// ── Kat/Jefe SPX trade text patterns ─────────────────────────────────────────
// Require both SPX mention + directional language AND a price-level number.
// Exclude RichyDubz pastes (they have the analyst name and are handled by detectPasteIntent → /levels).
const KAT_SPX_RE   = /\bspx\b[\s\S]{0,120}\b(bull(?:ish)?|bear(?:ish)?|long|short|calls?|puts?|bias|setup|above|below|target|support|resistance)\b/i;
const KAT_LEVEL_RE = /\b(5[5-9]\d\d|6\d{3}|7[0-4]\d\d)\b/;
const RICHY_RE     = /\b(richy|richydubz|richyd)\b/i;

// ── Paste classifier ──────────────────────────────────────────────────────────
// Returns { type, confidence, parsed } or { type: null } to fall through.
function classifyPaste(text) {
  if (!text || typeof text !== 'string') return { type: null };
  const t = text.trim();
  if (t.length < 10) return { type: null };

  // Ximes: use existing parser as ground truth (null username = manual path)
  const ximesParsed = parseXimes(null, t);
  if (ximesParsed) {
    if (ximesParsed.signal_type === 'LIVE_ENTRY' && ximesParsed.strike) {
      return { type: 'ximes_live', confidence: 'high', parsed: ximesParsed };
    }
    if (ximesParsed.signal_type === 'PRE_MARKET_SETUP') {
      return { type: 'ximes_setup', confidence: 'high', parsed: ximesParsed };
    }
    if (ximesParsed.signal_type === 'MANAGEMENT') {
      return { type: 'ximes_mgmt', confidence: 'high', parsed: ximesParsed };
    }
  }

  // Bobby heatmap text: use existing parser as ground truth
  const bobbyParsed = parseBobby(t);
  if (bobbyParsed) {
    return { type: 'bobby', confidence: 'high', parsed: bobbyParsed };
  }

  // Kat/Jefe SPX trade text — must not be a RichyDubz paste
  if (!RICHY_RE.test(t.slice(0, 200)) && KAT_SPX_RE.test(t) && KAT_LEVEL_RE.test(t)) {
    return { type: 'kat', confidence: 'medium', parsed: null };
  }

  // Unknown: multi-line with price-level numbers looks like a trading paste
  if (t.includes('\n') && /\b\d{4,5}\b/.test(t)) {
    return { type: 'unknown', confidence: 'low', parsed: null };
  }

  return { type: null };
}

// ── Checklist ─────────────────────────────────────────────────────────────────
// Heatmap is satisfied by: ctx.heatmap OR today-levels.json with bobby entries (loaded today ET).
function heatmapLoaded(ctx) {
  if (ctx.heatmap) return true;
  try {
    const obj = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
    return obj.date === todayKeyET() && Array.isArray(obj.bobby) && obj.bobby.length > 0;
  } catch { return false; }
}

function checklistComplete(ctx) {
  const hasXimes = !!(ctx.ximes && ctx.ximes.strike);
  const hasBobby = heatmapLoaded(ctx);
  const missing  = [];
  if (!hasXimes) missing.push('Ximes live signal');
  if (!hasBobby) missing.push('heatmap (Bobby or Jefe)');
  return { complete: hasXimes && hasBobby, missing };
}

// ── Ack message builder ───────────────────────────────────────────────────────
const TYPE_LABELS = {
  ximes_live:  'Ximes signal',
  ximes_setup: 'Ximes pre-market setup',
  heatmap:     'heatmap',
  kat:         'Kat context',
};

function buildAckMessage(type, missing) {
  const label = TYPE_LABELS[type] || type;
  if (missing.length === 0) return `Got it — ${label} stored. Checklist complete.`;
  return `Got it — ${label} stored. Still waiting: ${missing.join(', ')}.`;
}

// ── res wrappers ──────────────────────────────────────────────────────────────

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

// Captures res.json output without sending to client.
function captureRes(image) {
  const cap = { data: null };
  return {
    json(data)          { cap.data = data; },
    get result()        { return cap.data; },
    _heatmapImage:      image || null,
  };
}

// ── Main accumulator hook ─────────────────────────────────────────────────────
// Returns true if handled (caller must return), false to fall through.
async function handlePasteAccumulate(message, image, res) {
  try {
    // Lazy-require avoids load-order issues; slash-commands is always loaded by index.js first.
    const { handleSlashCommand } = require('./slash-commands');

    // ── Image paste → heatmap (Bobby or Jefe/Kat) ──────────────────────────
    if (image) {
      const ctx = loadDailyContext();
      ctx.heatmap = { source: 'image', stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'heatmap-image-stored' });

      const { complete } = checklistComplete(ctx);
      if (complete && ctx.ximes) {
        // Capture /heatmap output (stores levels), then fire verdict
        const cap = captureRes(image);
        await handleSlashCommand('/heatmap ', cap);
        const heatmapNote = cap.result?.reply || 'Heatmap stored.';
        const prefix = `Got it — heatmap image stored.\n${heatmapNote}\n\nChecklist complete — firing verdict:\n\n`;
        await handleSlashCommand('/alert ' + ctx.ximes.raw, prependRes(res, prefix));
      } else {
        const { missing } = checklistComplete(ctx);
        const ackMsg = buildAckMessage('heatmap', missing);
        res._heatmapImage = image;
        await handleSlashCommand('/heatmap ', prependRes(res, ackMsg + '\n\n'));
      }
      return true;
    }

    const classified = classifyPaste(message);
    if (classified.type === null) return false; // conversational — fall through

    const ctx = loadDailyContext();

    // ── Ximes live entry ────────────────────────────────────────────────────
    if (classified.type === 'ximes_live') {
      ctx.ximes = {
        raw:        message,
        strike:     classified.parsed.strike,
        direction:  classified.parsed.direction,
        ticker:     classified.parsed.ticker,
        stored_at:  new Date().toISOString(),
      };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'ximes-stored', strike: classified.parsed.strike });

      const { complete, missing } = checklistComplete(ctx);
      if (complete) {
        const prefix = 'Got it — Ximes signal stored. Checklist complete — firing verdict:\n\n';
        await handleSlashCommand('/alert ' + message, prependRes(res, prefix));
      } else {
        res.json({ reply: buildAckMessage('ximes_live', missing) });
      }
      return true;
    }

    // ── Ximes pre-market setup (store + ack; no verdict — no live strike yet) ─
    if (classified.type === 'ximes_setup') {
      ctx.ximes_setup = {
        raw:       message,
        direction: classified.parsed.direction,
        strike:    classified.parsed.strike,
        stored_at: new Date().toISOString(),
      };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'ximes-setup-stored' });
      const { missing } = checklistComplete(ctx);
      res.json({ reply: buildAckMessage('ximes_setup', missing) });
      return true;
    }

    // ── Ximes management — fall through to existing parseXimes intercept ────
    if (classified.type === 'ximes_mgmt') return false;

    // ── Bobby heatmap text ──────────────────────────────────────────────────
    if (classified.type === 'bobby') {
      ctx.heatmap = { source: 'bobby-text', stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'bobby-text-stored' });

      const { complete } = checklistComplete(ctx);
      if (complete && ctx.ximes) {
        // Capture /heatmap output (stores levels), then fire verdict using stored Ximes signal
        const cap = captureRes();
        await handleSlashCommand('/heatmap ' + message, cap);
        const heatmapNote = cap.result?.reply || 'Heatmap stored.';
        const prefix = `Got it — Bobby heatmap stored.\n${heatmapNote}\n\nChecklist complete — firing verdict:\n\n`;
        await handleSlashCommand('/alert ' + ctx.ximes.raw, prependRes(res, prefix));
      } else {
        const { missing } = checklistComplete(ctx);
        const ackMsg = buildAckMessage('heatmap', missing);
        await handleSlashCommand('/heatmap ' + message, prependRes(res, ackMsg + '\n\n'));
      }
      return true;
    }

    // ── Kat/Jefe SPX trade text (optional; store + ack only) ───────────────
    if (classified.type === 'kat') {
      ctx.kat_text = { raw: message.slice(0, 500), stored_at: new Date().toISOString() };
      saveDailyContext(ctx);
      log('daily-ctx', { event: 'kat-text-stored' });
      const { missing } = checklistComplete(ctx);
      res.json({ reply: buildAckMessage('kat', missing) });
      return true;
    }

    // ── Unknown trading-looking paste ───────────────────────────────────────
    if (classified.type === 'unknown') {
      res.json({
        reply: [
          "I don't recognize this paste. Is it a:",
          "→ Ximes signal — paste as-is",
          "→ Bobby/Jefe heatmap text — paste as-is, or drop an image",
          "→ Kat context — paste as-is",
          "→ Something else? Tell me what this is.",
        ].join('\n'),
      });
      return true;
    }

    return false;

  } catch (e) {
    log('daily-ctx-error', { error: e.message });
    return false; // fail open — fall through to existing handling
  }
}

module.exports = {
  loadDailyContext,
  saveDailyContext,
  classifyPaste,
  checklistComplete,
  handlePasteAccumulate,
};
