'use strict';
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const router   = express.Router();

// ── Paths ───────────────────────────────────────────────────────────────────
const KAT_DIR       = path.join(__dirname, '../data/kat');
const RAW_FEED      = path.join(KAT_DIR, 'raw-feed.jsonl');
const PROCESSED     = path.join(KAT_DIR, 'processed-signals.jsonl');
const ACTIVITY      = path.join(KAT_DIR, 'activity.json');
const CONFIG_FILE   = path.join(KAT_DIR, 'monitored-users.json');
const SYNTHESIS     = path.join(KAT_DIR, 'synthesis-report.json');

// ── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(KAT_DIR)) fs.mkdirSync(KAT_DIR, { recursive: true });
}

function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) return {
    enabled: false, monitored_users: [], monitored_channels: [],
    synthesis_schedule: 'EOD', vision_enabled: true, heatmap_detection: true
  };
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (e) { console.error('[kat] config parse error:', e.message); return { enabled: false, monitored_users: [], monitored_channels: [] }; }
}

function saveConfig(cfg) {
  ensureDir();
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}

function appendRawFeed(entry) {
  ensureDir();
  fs.appendFileSync(RAW_FEED, JSON.stringify(entry) + '\n', 'utf8');
}

function updateActivity(username) {
  ensureDir();
  let activity = {};
  if (fs.existsSync(ACTIVITY)) {
    try { activity = JSON.parse(fs.readFileSync(ACTIVITY, 'utf8')); } catch (e) {}
  }
  activity[username] = new Date().toISOString();
  const tmp = ACTIVITY + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(activity, null, 2), 'utf8');
  fs.renameSync(tmp, ACTIVITY);
}

function isMonitoredUser(userId, config) {
  return (config.monitored_users || []).some(u => u.discord_id === userId);
}

function isMonitoredChannel(channelId, channelName, config) {
  const ids   = config.monitored_channel_ids || [];
  const names = config.monitored_channels    || [];
  if (ids.length > 0)   return ids.includes(channelId);
  if (names.length > 0) return names.includes(channelName);
  return false;
}

function rawFeedCount() {
  if (!fs.existsSync(RAW_FEED)) return 0;
  try {
    return fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim()).length;
  } catch (e) { return 0; }
}

function lastCapture() {
  if (!fs.existsSync(RAW_FEED)) return null;
  try {
    const lines = fs.readFileSync(RAW_FEED, 'utf8').split('\n').filter(l => l.trim());
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]).ts;
  } catch (e) { return null; }
}

// ── Discord bot ─────────────────────────────────────────────────────────────
let discordClient = null;

if (process.env.KAT_BOT_TOKEN) {
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    discordClient.on('ready', () => {
      console.log('[kat] Bot online as ' + discordClient.user.tag);
      runBackfill(discordClient);
    });

    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      const config = loadConfig();
      if (!config.enabled) return;
      if (!isMonitoredUser(message.author.id, config)) return;
      if (!isMonitoredChannel(message.channelId, message.channel.name, config)) return;

      const entry = {
        ts:           message.createdAt.toISOString(),
        message_id:   message.id,
        guild_id:     message.guildId,
        channel_id:   message.channelId,
        channel_name: message.channel.name,
        user_id:      message.author.id,
        username:     message.author.username,
        content:      message.content,
        attachments:  message.attachments.map(a => ({
          id:           a.id,
          url:          a.url,
          filename:     a.name,
          content_type: a.contentType || 'unknown'
        }))
      };

      appendRawFeed(entry);
      updateActivity(message.author.username);
      console.log('[kat] Captured: ' + message.author.username + ' in #' + message.channel.name + ' — ' + entry.content.slice(0, 60));
    });

    discordClient.on('error', (err) => {
      console.error('[kat] Discord client error:', err.message);
    });

    discordClient.login(process.env.KAT_BOT_TOKEN).catch(err => {
      console.error('[kat] Login failed:', err.message);
    });

  } catch (e) {
    console.error('[kat] discord.js load error:', e.message);
  }
} else {
  console.log('[kat] KAT_BOT_TOKEN not set — bot offline, ready to deploy');
}

// ── Backfill ─────────────────────────────────────────────────────────────────
async function runBackfill(client) {
  const config = loadConfig();
  if (!config.enabled) {
    console.log('[kat] Backfill skipped — bot not enabled');
    return;
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  console.log('[kat] Backfill starting — cutoff: ' + cutoff.toISOString());

  // Load existing message IDs to avoid duplicates
  const seen = new Set();
  if (fs.existsSync(RAW_FEED)) {
    const lines = fs.readFileSync(RAW_FEED, 'utf8')
      .split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.message_id) seen.add(entry.message_id);
      } catch (e) {}
    }
  }
  console.log('[kat] Backfill — ' + seen.size + ' existing entries in feed (dedup set loaded)');

  const monitoredIds = new Set((config.monitored_users || []).map(u => u.discord_id));

  let totalCaptured = 0;
  let totalSkipped  = 0;

  for (const guild of client.guilds.cache.values()) {
    await guild.fetch();
    await guild.channels.fetch();

    const channelIds   = new Set(config.monitored_channel_ids || []);
    const channelNames = new Set(config.monitored_channels    || []);

    const targetChannels = [];
    for (const [, c] of guild.channels.cache) {
      if (!c) continue;
      try {
        const isText = typeof c.isTextBased === 'function' ? c.isTextBased() : false;
        if (!isText) continue;
        if (channelIds.size > 0 && channelIds.has(c.id)) {
          targetChannels.push(c);
          console.log('[kat] Backfill target (by ID): #' + c.name);
        } else if (channelIds.size === 0 && channelNames.has(c.name)) {
          targetChannels.push(c);
          console.log('[kat] Backfill target (by name): #' + c.name);
        }
      } catch (e) {
        console.error('[kat] Channel check error:', e.message);
      }
    }

    for (const channel of targetChannels) {
      const channelName = channel.name;
      console.log('[kat] Backfilling #' + channelName + ' in ' + guild.name);

      let lastId        = null;
      let reachedCutoff = false;
      let pageCount     = 0;

      while (!reachedCutoff) {
        try {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (!messages.size) break;

          const sorted = [...messages.values()].sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
          );

          for (const msg of sorted) {
            if (msg.createdAt < cutoff) { reachedCutoff = true; break; }
            if (!monitoredIds.has(msg.author.id)) continue;
            if (seen.has(msg.id)) { totalSkipped++; continue; }

            const entry = {
              ts:           msg.createdAt.toISOString(),
              message_id:   msg.id,
              guild_id:     msg.guildId,
              channel_id:   msg.channelId,
              channel_name: channelName,
              user_id:      msg.author.id,
              username:     msg.author.username,
              content:      msg.content,
              attachments:  msg.attachments.map(a => ({
                id:           a.id,
                url:          a.url,
                filename:     a.name,
                content_type: a.contentType || 'unknown'
              })),
              backfill:     true
            };

            appendRawFeed(entry);
            seen.add(msg.id);
            updateActivity(msg.author.username);
            totalCaptured++;
          }

          lastId = sorted[0].id;
          pageCount++;

          // Rate limit courtesy pause — 500ms between pages
          await new Promise(r => setTimeout(r, 500));

          if (pageCount >= 200) {
            console.log('[kat] Backfill page limit reached for #' + channelName);
            break;
          }

        } catch (e) {
          console.error('[kat] Backfill error in #' + channelName + ':', e.message);
          break;
        }
      }

      console.log('[kat] #' + channelName + ' backfill done — page ' + pageCount);
    }
  }

  console.log('[kat] Backfill complete — captured: ' + totalCaptured + ', skipped (dedup): ' + totalSkipped);
}

// ── Targeted Backfill ────────────────────────────────────────────────────────
async function runTargetedBackfill(client, targetChannelNames) {
  const config = loadConfig();
  if (!config.enabled) {
    console.log('[kat] Targeted backfill skipped — bot not enabled');
    return;
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  const targetSet = new Set(targetChannelNames);
  console.log('[kat] TARGETED BACKFILL starting for: ' + targetChannelNames.join(', '));

  const seen = new Set();
  if (fs.existsSync(RAW_FEED)) {
    const lines = fs.readFileSync(RAW_FEED, 'utf8')
      .split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.message_id) seen.add(entry.message_id);
      } catch (e) {}
    }
  }
  console.log('[kat] TARGETED BACKFILL — ' + seen.size + ' existing entries in feed (dedup set loaded)');

  const monitoredIds = new Set((config.monitored_users || []).map(u => u.discord_id));

  let totalCaptured = 0;
  let totalSkipped  = 0;

  for (const guild of client.guilds.cache.values()) {
    await guild.fetch();
    await guild.channels.fetch();

    const targetChannels = [];
    for (const [, c] of guild.channels.cache) {
      if (!c) continue;
      try {
        const isText = typeof c.isTextBased === 'function' ? c.isTextBased() : false;
        if (!isText) continue;
        if (targetSet.has(c.name)) {
          targetChannels.push(c);
          console.log('[kat] TARGETED BACKFILL target: #' + c.name);
        }
      } catch (e) {
        console.error('[kat] Channel check error:', e.message);
      }
    }

    for (const channel of targetChannels) {
      const channelName = channel.name;
      console.log('[kat] TARGETED BACKFILL backfilling #' + channelName + ' in ' + guild.name);

      let lastId        = null;
      let reachedCutoff = false;
      let pageCount     = 0;
      let channelCaptured = 0;

      while (!reachedCutoff) {
        try {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (!messages.size) break;

          const sorted = [...messages.values()].sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
          );

          for (const msg of sorted) {
            if (msg.createdAt < cutoff) { reachedCutoff = true; break; }
            if (!monitoredIds.has(msg.author.id)) continue;
            if (seen.has(msg.id)) { totalSkipped++; continue; }

            const entry = {
              ts:           msg.createdAt.toISOString(),
              message_id:   msg.id,
              guild_id:     msg.guildId,
              channel_id:   msg.channelId,
              channel_name: channelName,
              user_id:      msg.author.id,
              username:     msg.author.username,
              content:      msg.content,
              attachments:  msg.attachments.map(a => ({
                id:           a.id,
                url:          a.url,
                filename:     a.name,
                content_type: a.contentType || 'unknown'
              })),
              backfill:     true
            };

            appendRawFeed(entry);
            seen.add(msg.id);
            updateActivity(msg.author.username);
            totalCaptured++;
            channelCaptured++;
          }

          lastId = sorted[0].id;
          pageCount++;

          await new Promise(r => setTimeout(r, 500));

          if (pageCount >= 200) {
            console.log('[kat] TARGETED BACKFILL page limit reached for #' + channelName);
            break;
          }

        } catch (e) {
          console.error('[kat] TARGETED BACKFILL error in #' + channelName + ':', e.message);
          break;
        }
      }

      console.log('[kat] #' + channelName + ' targeted backfill done — captured: ' + channelCaptured + ', pages: ' + pageCount);
    }
  }

  console.log('[kat] TARGETED BACKFILL complete — captured: ' + totalCaptured + ', skipped (dedup): ' + totalSkipped);
}

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /agent/kat/backfill-channels  { channels: ["barrys-breakdowns", ...] }
router.post('/backfill-channels', async (req, res) => {
  const { channels } = req.body;
  if (!channels || !Array.isArray(channels)) {
    return res.status(400).json({ error: 'channels array required' });
  }
  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'Bot not online' });
  }
  res.json({ ok: true, message: 'Backfill started for: ' + channels.join(', ') });
  setImmediate(() => runTargetedBackfill(discordClient, channels));
});

// GET /agent/kat/status
router.get('/status', (req, res) => {
  const config   = loadConfig();
  const activity = fs.existsSync(ACTIVITY)
    ? JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'))
    : {};
  res.json({
    enabled:               config.enabled,
    bot_online:            !!(discordClient && discordClient.isReady()),
    bot_tag:               discordClient && discordClient.isReady() ? discordClient.user.tag : null,
    monitored_users_count: (config.monitored_users || []).length,
    monitored_users:       (config.monitored_users || []).map(u => u.username),
    monitored_channels:    config.monitored_channels || [],
    raw_feed_count:        rawFeedCount(),
    last_capture:          lastCapture(),
    activity
  });
});

// POST /agent/kat/enable  { enabled: bool }
router.post('/enable', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  const config = loadConfig();
  config.enabled = enabled;
  saveConfig(config);
  console.log('[kat] ' + (enabled ? 'ENABLED — bot now capturing' : 'DISABLED — bot paused'));
  res.json({ ok: true, enabled: config.enabled });
});

// POST /agent/kat/configure  { monitored_users: [...], monitored_channels: [...] }
router.post('/configure', (req, res) => {
  const config = loadConfig();
  if (req.body.monitored_users)    config.monitored_users    = req.body.monitored_users;
  if (req.body.monitored_channels) config.monitored_channels = req.body.monitored_channels;
  saveConfig(config);
  console.log('[kat] Config updated:', JSON.stringify({ users: config.monitored_users.map(u => u.username), channels: config.monitored_channels }));
  res.json({ ok: true, config });
});

// GET /agent/kat/feed?limit=50
router.get('/feed', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  if (!fs.existsSync(RAW_FEED)) return res.json({ entries: [], count: 0 });
  const lines = fs.readFileSync(RAW_FEED, 'utf8')
    .split('\n').filter(l => l.trim());
  const entries = lines.slice(-limit).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  res.json({ entries, count: lines.length });
});

// GET /agent/kat/activity
router.get('/activity', (req, res) => {
  if (!fs.existsSync(ACTIVITY)) return res.json({});
  try { res.json(JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'))); }
  catch (e) { res.json({}); }
});

module.exports = router;
