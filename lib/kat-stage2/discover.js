'use strict';

const fs = require('fs');
const path = require('path');
const { getLocalCandleInventory } = require('../market-data/candle-feed');
const { compactText, readJson, readJsonl, rel } = require('./io');

function summarizeJsonl(file) {
  const rows = readJsonl(file).filter(row => !row._parse_error);
  const times = rows
    .map(row => new Date(row.ts || row.timestamp_utc || row.timestamp || 0).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const channels = {};
  const analysts = {};
  let attachments = 0;
  for (const row of rows) {
    const channel = row.channel_name || row.channel || row.channel_id || 'unknown';
    const analyst = row.username || row.analyst || row.author_name || row.user_id || 'unknown';
    channels[channel] = (channels[channel] || 0) + 1;
    analysts[analyst] = (analysts[analyst] || 0) + 1;
    attachments += Array.isArray(row.attachments) ? row.attachments.length : 0;
  }
  return {
    path: rel(file),
    exists: fs.existsSync(file),
    rows: rows.length,
    first_timestamp: times.length ? new Date(times[0]).toISOString() : null,
    last_timestamp: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    channels,
    analysts,
    attachments,
    sample_keys: Object.keys(rows[0] || {}),
  };
}

function discoverStage2(config) {
  const katConfig = readJson(config.inputs.katConfig, {});
  const raw = summarizeJsonl(config.inputs.katRawFeed);
  const processed = summarizeJsonl(config.inputs.katProcessedSignals);
  const vision = summarizeJsonl(config.inputs.katVisionSignals);
  const candleInventory = getLocalCandleInventory({ cache: false });
  return {
    generated_at: new Date().toISOString(),
    version: config.version,
    katbot: {
      location: rel(path.join(config.rootDir, 'agents', 'agent-14-kat.js')),
      config_path: rel(config.inputs.katConfig),
      monitored_users: (katConfig.monitored_users || []).map(user => ({
        discord_id: user.discord_id || null,
        username: user.username || null,
        role: user.role || null,
      })),
      monitored_channels: katConfig.monitored_channels || [],
      monitored_channel_ids: katConfig.monitored_channel_ids || [],
    },
    discord_data: {
      raw_feed: raw,
      processed_signals: processed,
      vision_signals: vision,
      privacy_note: compactText(config.assumptions.rawDataPrivacy, 240),
    },
    market_data: candleInventory,
    storage: {
      artifact_dir: rel(config.outputs.artifactDir),
      report_dir: rel(config.outputs.reportDir),
      raw_artifacts_ignored_by_git: true,
      report_contains_summaries_only: true,
    },
  };
}

module.exports = {
  discoverStage2,
};
