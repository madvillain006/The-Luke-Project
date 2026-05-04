'use strict';

const { queryLevels } = require('./level-memory');

const LEVEL_CONTEXT_INSTRUMENTS = {
  SPX: ['SPX', 'ES'],
  SPY_QQQ: ['SPX', 'ES', 'SPY', 'QQQ', 'NQ'],
  ES_NQ: ['SPX', 'ES', 'QQQ', 'NQ'],
};

function easternDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isManciniMention(mention) {
  const haystack = [
    mention && mention.analyst,
    mention && mention.source_type,
    mention && mention.source_snippet,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes('mancini');
}

function isDailyLevelMention(mention) {
  const haystack = [
    mention && mention.analyst,
    mention && mention.source_type,
    mention && mention.source_snippet,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes('saty') || haystack.includes('atr');
}

function collectMentions(records, date, predicate) {
  const matches = [];
  for (const record of records) {
    for (const mention of record.mentions || []) {
      if (mention.date !== date) continue;
      if (!predicate(mention)) continue;
      matches.push({
        instrument: record.instrument,
        price: record.canonical_price,
        analyst: mention.analyst || null,
        source_type: mention.source_type || null,
      });
    }
  }
  return matches;
}

function queryContextRecords(instruments, queryFn) {
  const records = [];
  const seen = new Set();

  for (const instrument of instruments) {
    let instrumentRecords = [];
    try {
      instrumentRecords = queryFn({ instrument, window: 'hot' }) || [];
    } catch (e) {
      instrumentRecords = [];
    }

    for (const record of instrumentRecords) {
      const key = `${record.instrument}:${record.canonical_price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }
  }

  return records;
}

function levelContextForKatInstrument(katInstrument, options = {}) {
  const now = options.now || new Date();
  const date = options.date || easternDate(now);
  const queryFn = options.queryFn || queryLevels;
  const instruments = LEVEL_CONTEXT_INSTRUMENTS[katInstrument] || ['SPX', 'ES'];
  const records = queryContextRecords(instruments, queryFn);
  const mancini = collectMentions(records, date, isManciniMention);
  const daily = collectMentions(records, date, isDailyLevelMention);
  const ready = mancini.length > 0 && daily.length > 0;

  return {
    ready,
    date,
    kat_instrument: katInstrument,
    instruments_checked: instruments,
    current_levels_loaded: ready,
    source_flags: {
      mancini: mancini.length > 0,
      daily_levels: daily.length > 0,
    },
    counts: {
      mancini: mancini.length,
      daily_levels: daily.length,
      records: records.length,
    },
    blocker: ready ? null : 'current levels not fully loaded',
    display_line: ready
      ? `Levels: current levels loaded for ${date}`
      : `Levels: current levels incomplete for ${date}`,
  };
}

function formatLevelContextLine(context) {
  if (!context || !context.ready) return '- Levels: current levels incomplete';
  return '- ' + context.display_line;
}

module.exports = {
  easternDate,
  levelContextForKatInstrument,
  formatLevelContextLine,
  _internal: {
    isManciniMention,
    isDailyLevelMention,
    collectMentions,
    queryContextRecords,
  },
};
