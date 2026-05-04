'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  readJson,
  readJsonl,
  etIso,
  tsMs,
  datePart,
} = require('./common');

const SESSION_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');
const DERIVED_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'derived');

function makeEvent(fields) {
  const timestamp = fields.timestamp_et || fields.available_at_et || null;
  const parseable = timestamp ? Number.isFinite(tsMs(timestamp)) : false;
  return {
    id: fields.id,
    source: fields.source,
    source_type: fields.source_type,
    instrument: fields.instrument || null,
    timestamp_et: fields.timestamp_et || null,
    available_at_et: fields.available_at_et || null,
    levels: fields.levels || [],
    commentary: fields.commentary || null,
    tags: fields.tags || [],
    raw_path: fields.raw_path || null,
    parsed_path: fields.parsed_path || null,
    confidence: fields.confidence || (parseable ? 'medium' : 'low'),
    usable_for_replay: fields.usable_for_replay === undefined ? parseable : fields.usable_for_replay,
    unusable_reason: fields.unusable_reason || null,
  };
}

function satyLevelEvents(session, relPath) {
  const levels = session.saty?.levels;
  if (!levels?.valid) return [];
  const available = levels.valid_from && /[+-]\d{2}:\d{2}$/.test(levels.valid_from)
    ? levels.valid_from
    : etIso(datePart(levels.valid_from) || session.date, (levels.valid_from || '').slice(11, 19) || '09:25:00');
  const numericLevels = Object.entries(levels)
    .filter(([key, value]) => /trigger|plus|minus|prev_close/.test(key) && Number.isFinite(Number(value)))
    .map(([label, value]) => ({ price: Number(value), label, role: label, source: 'saty' }));
  return [makeEvent({
    id: `saty:${session.date}`,
    source: 'saty',
    source_type: 'saty_generated_levels',
    instrument: 'ES',
    timestamp_et: available,
    available_at_et: available,
    levels: numericLevels,
    tags: ['date_scoped', 'historical_formula', levels.formula_provenance],
    raw_path: relPath,
    parsed_path: relPath,
    confidence: 'high',
  })];
}

function sessionLevelEvents(session, relPath) {
  const events = [];
  const levelsBySource = new Map();
  for (const level of session.levels || []) {
    const source = String(level.source || 'unknown').toLowerCase();
    if (source === 'saty') continue;
    if (!levelsBySource.has(source)) levelsBySource.set(source, []);
    levelsBySource.get(source).push(level);
  }
  for (const [source, levels] of levelsBySource.entries()) {
    const family = source.includes('mancini') ? 'mancini' : source.includes('bobby') ? 'bobby' : source;
    const available = family === 'mancini' ? etIso(session.date, '09:25:00') : etIso(session.date, '09:30:00');
    events.push(makeEvent({
      id: `${family}:session-levels:${session.date}`,
      source: family,
      source_type: family === 'mancini' ? 'date_only_premarket_context' : 'session_derived_levels',
      instrument: 'ES',
      timestamp_et: available,
      available_at_et: available,
      levels: levels.map(level => ({
        price: Number(level.price),
        label: level.label || level.role || source,
        role: level.role || level.label || source,
        source: family,
      })),
      commentary: family === 'mancini' ? 'Date-only Mancini session levels; treated as premarket/all-day context.' : null,
      tags: family === 'mancini' ? ['date_only_context', 'premarket_assumption'] : ['session_derived'],
      raw_path: relPath,
      parsed_path: relPath,
      confidence: family === 'mancini' ? 'medium' : 'low',
    }));
  }
  return events;
}

function bobbyMessageEvents() {
  const filePath = path.join(DERIVED_DIR, 'bobby-messages.jsonl');
  const rel = 'data/backtest/es-long-bracket/derived/bobby-messages.jsonl';
  return readJsonl(filePath).map(row => {
    const hasTime = Boolean(row.timestamp) && Number.isFinite(tsMs(row.timestamp));
    return makeEvent({
      id: `bobby-message:${row.id || row.messageId}`,
      source: 'bobby',
      source_type: row.attachments?.some(a => a.isImage) ? 'bobby_text_with_image' : 'bobby_text',
      instrument: row.mentionedInstruments?.[0] || null,
      timestamp_et: row.timestamp || null,
      available_at_et: row.timestamp || null,
      levels: (row.levelCandidates || []).map(level => ({ price: Number(level.price), role: level.role || 'candidate', source: 'bobby' })),
      commentary: row.content || null,
      tags: ['discord_export', ...(row.imageUrls?.length ? ['has_image'] : [])],
      raw_path: rel,
      parsed_path: rel,
      confidence: hasTime ? 'high' : 'low',
      usable_for_replay: hasTime,
      unusable_reason: hasTime ? null : 'missing_timestamp',
    });
  });
}

function bobbyImageParseEvents() {
  const filePath = path.join(DERIVED_DIR, 'bobby-image-parses.jsonl');
  const rel = 'data/backtest/es-long-bracket/derived/bobby-image-parses.jsonl';
  return readJsonl(filePath).map(row => {
    const hasParsedLevels = row.parseStatus === 'ok' && (row.levels || []).length > 0;
    return makeEvent({
      id: `bobby-image:${row.attachmentId || row.messageId}`,
      source: 'bobby',
      source_type: hasParsedLevels ? 'bobby_cached_parsed_heatmap' : 'bobby_image_unparsed',
      instrument: hasParsedLevels ? ((row.levels[0]?.ticker || '').startsWith('SP') ? 'SPX' : 'ES') : null,
      timestamp_et: row.timestamp || null,
      available_at_et: row.timestamp || null,
      levels: (row.levels || []).map(level => ({
        price: Number(level.price),
        role: level.role || 'king_node',
        label: level.role || 'king_node',
        source: 'bobby',
        ticker: level.ticker || null,
      })),
      commentary: hasParsedLevels ? null : 'Heatmap image exists but no cached parsed levels were available.',
      tags: ['heatmap', hasParsedLevels ? 'cached_parse' : 'image_unparsed'],
      raw_path: row.localPath || rel,
      parsed_path: rel,
      confidence: hasParsedLevels ? 'medium' : 'low',
      usable_for_replay: Boolean(row.timestamp && hasParsedLevels),
      unusable_reason: hasParsedLevels ? null : 'image_unparsed',
    });
  });
}

function manciniPostEvents() {
  const filePath = path.join(DERIVED_DIR, 'mancini-posts.jsonl');
  const rel = 'data/backtest/es-long-bracket/derived/mancini-posts.jsonl';
  return readJsonl(filePath).map(row => {
    const date = row.estimatedDate || row.candidateTradingDates?.[0] || row.threadHeader?.anchorDate;
    const available = date ? etIso(date, '09:25:00') : null;
    return makeEvent({
      id: `mancini-post:${row.postIndex}:${date || 'unknown'}`,
      source: 'mancini',
      source_type: 'raw_date_only_mancini_post',
      instrument: 'ES',
      timestamp_et: available,
      available_at_et: available,
      levels: (row.levels || []).map(level => ({ price: Number(level.price), role: level.role || 'level', source: 'mancini' })),
      commentary: row.content || null,
      tags: ['date_only_context', 'raw_post', `timestamp_confidence:${row.timestampConfidence || 'unknown'}`],
      raw_path: rel,
      parsed_path: rel,
      confidence: row.timestampConfidence === 'high' ? 'medium' : 'low',
      usable_for_replay: false,
      unusable_reason: available ? 'raw_date_only_post_needs_availability_time' : 'missing_timestamp',
    });
  });
}

function katEvents() {
  const events = [];
  for (const rel of ['data/kat/raw-feed.jsonl', 'data/kat/processed-signals.jsonl']) {
    const filePath = path.join(ROOT, rel);
    for (const row of readJsonl(filePath)) {
      const timestamp = row.timestamp || row.ts || row.created_at || null;
      events.push(makeEvent({
        id: `kat:${rel}:${row.id || events.length}`,
        source: 'katbot',
        source_type: 'katbot_context',
        instrument: row.instrument || row.symbol || null,
        timestamp_et: timestamp,
        available_at_et: timestamp,
        levels: [],
        commentary: row.content || row.text || null,
        tags: ['katbot'],
        raw_path: rel,
        parsed_path: rel,
        confidence: timestamp ? 'medium' : 'low',
        usable_for_replay: Boolean(timestamp),
        unusable_reason: timestamp ? null : 'missing_timestamp',
      }));
    }
  }
  return events;
}

function importedManciniEvents() {
  const filePath = path.join(ROOT, 'artifacts', 'research', 'mancini-normalized.json');
  const parsed = readJson(filePath);
  const rows = Array.isArray(parsed?.events) ? parsed.events : [];
  return rows.map(row => makeEvent({
    id: row.id,
    source: 'mancini',
    source_type: 'mancini_imported_archive',
    instrument: 'ES',
    timestamp_et: row.timestamp_et,
    available_at_et: row.available_at_et || row.timestamp_et,
    levels: (row.levels || []).map(level => ({ price: Number(level.price), role: level.role || 'level', source: 'mancini' })),
    commentary: null,
    tags: ['imported_archive', `timestamp_quality:${row.timestamp_quality || 'unknown'}`],
    raw_path: row.raw_path,
    parsed_path: 'artifacts/research/mancini-normalized.json',
    confidence: row.timestamp_quality === 'exact' ? 'medium' : 'low',
    usable_for_replay: row.usable_for_replay === true,
    unusable_reason: row.usable_for_replay === true ? null : (row.unusable_reason || 'not_usable'),
  }));
}

function buildSourceTimeline(options = {}) {
  const events = [];
  if (fs.existsSync(SESSION_DIR)) {
    for (const name of fs.readdirSync(SESSION_DIR).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()) {
      const rel = `data/backtest/es-long-bracket/sessions/${name}`;
      const session = readJson(path.join(SESSION_DIR, name));
      if (!session) continue;
      events.push(...satyLevelEvents(session, rel));
      events.push(...sessionLevelEvents(session, rel));
    }
  }
  events.push(...bobbyMessageEvents());
  events.push(...bobbyImageParseEvents());
  events.push(...manciniPostEvents());
  events.push(...importedManciniEvents());
  events.push(...katEvents());

  const seen = new Set();
  const deduped = [];
  for (const event of events) {
    const key = `${event.source}|${event.source_type}|${event.instrument}|${event.available_at_et}|${JSON.stringify(event.levels)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  deduped.sort((a, b) => {
    const at = tsMs(a.available_at_et) ?? Number.MAX_SAFE_INTEGER;
    const bt = tsMs(b.available_at_et) ?? Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return String(a.id).localeCompare(String(b.id));
  });

  const missing = deduped.filter(event => !event.usable_for_replay).map(event => ({
    id: event.id,
    source: event.source,
    source_type: event.source_type,
    raw_path: event.raw_path,
    unusable_reason: event.unusable_reason || 'not_usable',
  }));

  return {
    generated_at: new Date().toISOString(),
    event_count: deduped.length,
    usable_event_count: deduped.filter(event => event.usable_for_replay).length,
    events: options.usableOnly ? deduped.filter(event => event.usable_for_replay) : deduped,
    missing,
  };
}

module.exports = {
  buildSourceTimeline,
  makeEvent,
};
