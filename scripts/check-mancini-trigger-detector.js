'use strict';

const fs = require('fs');
const path = require('path');
const { getCandles } = require('../lib/market-data/candle-feed');
const {
  discoverManciniCurrentLog,
  extractManciniLevelsFromLog,
} = require('../lib/tradingview/level-export');
const {
  detectManciniTriggers,
  formatDiscordSignal,
} = require('../lib/mancini-trigger-detector');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-live-detector');

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  fs.writeFileSync(file, [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column])).join(',')),
  ].join('\n'), 'utf8');
}

function levelDate(level) {
  return level?.freshness?.date || String(level?.timestamp_et || '').slice(0, 10) || null;
}

function levelsKnownBeforeDate(levels, date) {
  return levels
    .filter(level => level.instrument === 'ES' && level.active !== false)
    .filter(level => {
      const known = levelDate(level);
      return known && known < date;
    });
}

function latestLevels(levels) {
  return levels
    .filter(level => level.instrument === 'ES' && level.active !== false);
}

function sessionDate(timestamp) {
  return String(timestamp || '').slice(0, 10);
}

async function main() {
  ensureDir(OUT_DIR);

  const date = argValue('date', null);
  const time = argValue('time', null);
  const latestMode = hasFlag('latest');
  const limit = Number(argValue('limit', latestMode ? 240 : null));
  const logInfo = discoverManciniCurrentLog({ rootDir: ROOT });
  if (!logInfo?.path) throw new Error('No Mancini log found.');
  const levelSet = extractManciniLevelsFromLog({
    filePath: logInfo.path,
    latestDate: logInfo.latest_date,
    lookbackDays: 9999,
  });

  const candleOptions = date
    ? { mode: 'replay', date, ...(time ? { time } : {}), limit: 2000 }
    : { ...(limit ? { limit } : {}) };
  const feed = await getCandles('ES', candleOptions);
  const candles = feed.candles || [];
  const levelInputs = date
    ? levelsKnownBeforeDate(levelSet.levels, date)
    : latestLevels(levelSet.levels);
  const result = detectManciniTriggers({
    candles,
    levels: levelInputs,
    options: {},
  });

  const prefix = date ? `mancini-trigger-${date}${time ? `-${time.replace(/:/g, '')}` : ''}` : 'mancini-trigger-latest';
  const summary = {
    generated_at: new Date().toISOString(),
    mode: date ? 'replay' : 'latest-local',
    requested_date: date,
    requested_time: time,
    source: {
      candles: {
        source: feed.source,
        source_label: feed.source_label,
        timestamp: feed.timestamp,
        usable_for_live_arming: feed.usable_for_live_arming,
        usable_for_replay: feed.usable_for_replay,
        rows: candles.length,
        raw: feed.raw,
      },
      mancini_log: logInfo,
      levels: {
        parsed: levelSet.levels.length,
        used: levelInputs.length,
        first_known_date: levelInputs.map(levelDate).filter(Boolean).sort()[0] || null,
        latest_known_date: levelInputs.map(levelDate).filter(Boolean).sort().at(-1) || null,
      },
    },
    detector_summary: result.summary,
    latest_actionable: result.latest_actionable,
    discord_text: formatDiscordSignal(result.latest_actionable || result.triggers.at(-1) || null),
    safety: {
      no_broker_route: true,
      existing_pine_untouched: true,
      replay_local_csv_cannot_arm_live: feed.usable_for_live_arming !== true,
      levels_for_replay_known_before_session: Boolean(date),
    },
  };

  writeJson(path.join(OUT_DIR, `${prefix}-summary.json`), summary);
  writeJson(path.join(OUT_DIR, `${prefix}-triggers.json`), result.triggers);
  writeCsv(path.join(OUT_DIR, `${prefix}-triggers.csv`), result.triggers.map(trigger => ({
    date: trigger.date,
    tier: trigger.tier,
    signal_timestamp: trigger.signal_timestamp,
    level: trigger.level,
    entry_reference: trigger.entry_reference,
    prior_tap_groups: trigger.prior_tap_groups,
    max_prior_tap_groups: trigger.max_prior_tap_groups,
    flush_depth_points: trigger.flush_depth_points,
    max_flush_depth_points: trigger.max_flush_depth_points,
    dump_move_points: trigger.dump_move_points,
    repeat_count: trigger.repeat_count,
    reasons: (trigger.reasons || []).join('|'),
  })));

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
