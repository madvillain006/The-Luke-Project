'use strict';

const { loadMemory } = require('../level-memory');

function todayEt(now = new Date()) {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function buildLevelMemorySummary({ now = new Date(), loadMemoryFn = loadMemory } = {}) {
  try {
    const memory = loadMemoryFn();
    const levels = Array.isArray(memory?.levels) ? memory.levels : [];
    const today = todayEt(now);
    const analyst_counts = {};
    const todays_analyst_counts = {};
    const instrument_counts = {};

    for (const level of levels) {
      const instrument = level.instrument || 'UNKNOWN';
      instrument_counts[instrument] = (instrument_counts[instrument] || 0) + 1;
      for (const mention of (level.mentions || [])) {
        const analyst = mention.analyst || 'unknown';
        analyst_counts[analyst] = (analyst_counts[analyst] || 0) + 1;
        if (mention.date === today) {
          todays_analyst_counts[analyst] = (todays_analyst_counts[analyst] || 0) + 1;
        }
      }
    }

    return {
      ok: true,
      blockers: [],
      today_et: today,
      level_count: levels.length,
      mention_count: Object.values(analyst_counts).reduce((sum, count) => sum + count, 0),
      analyst_counts,
      todays_analyst_counts,
      instrument_counts,
    };
  } catch (err) {
    return {
      ok: false,
      blockers: [`level memory unavailable: ${err.message}`],
      today_et: todayEt(now),
      level_count: 0,
      mention_count: 0,
      analyst_counts: {},
      todays_analyst_counts: {},
      instrument_counts: {},
    };
  }
}

module.exports = { buildLevelMemorySummary };
