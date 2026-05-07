'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Kat agent live surface', () => {
  it('pushes index analyst signals and chart posts into Luke broadcasts with provenance', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("type: 'kat_signal'");
    expect(source).toContain("type: 'kat_chart_pending'");
    expect(source).toContain("type: 'kat_watchlist_signal'");
    expect(source).toContain('appendKatVisionRecord');
    expect(source).toContain("type: 'kat_vision'");
    expect(source).toContain('../lib/kat-vision-store');
    expect(source).toContain('option_context:');
    expect(source).toContain('equity_context:');
    expect(source).toContain('broadcastKatCapture(entry, signal)');
    expect(source).toContain('broadcastKatCapture(entry, null)');
    expect(source).toContain('message_id: entry.message_id');
    expect(source).toContain("source: 'katbot-discord'");
    expect(source).toContain('human_gate_required: true');
  });

  it('exposes a welcome/help surface that matches current capabilities', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    const { getKatWelcomeMessage } = require('../lib/kat-welcome-message');
    const help = getKatWelcomeMessage();

    expect(source).toContain('../lib/kat-welcome-message');
    expect(help).toContain('Katbot is live in trade-floor.');
    expect(help).toContain('`!bias spx` - 18h SPX bias if enough fresh signals exist.');
    expect(help).toContain('`!levels spx` - confirmed SPX levels from repeated analyst mentions.');
    expect(help).toContain('`!heatmap spx` / `!queue spx heatmap` - latest saved SPX heatmap.');
    expect(help).toContain('`!recent spx` - recent SPX chart posts and images.');
    expect(help).toContain('`!equity ups` - recent chart posts and images for a ticker. Lowercase is fine.');
    expect(help).toContain('To get her to yap: use long forms like `!kat recent spx`, `!kat heatmap spx`, `!kat equity ups`.');
    expect(source).toContain("router.get('/welcome'");
    expect(source).not.toContain('Luke bridge: source, analyst, channel');
  });

  it('suppresses Discord pings and pushes confluence into Luke with level context', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false })");
    expect(source).toContain('discordOutputAllowed');
    expect(source).toContain('Discord reply suppressed by output gate');
    expect(source).toContain('Discord channel post suppressed by output gate');
    expect(source).toContain('recordKatOutputBin');
    expect(source).toContain('function safeReply(message, payload)');
    expect(source).toContain('function safeSend(channel, payload)');
    expect(source).toContain('levelContextForKatInstrument(instrument)');
    expect(source).toContain("type: 'kat_confluence'");
    expect(source).toContain('human_gate_required: true');
  });

  it('exposes equity/options shadow profile routes without adding execution surfaces', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("router.get('/equity-options'");
    expect(source).toContain("router.get('/equity-options/:ticker'");
    expect(source).toContain('buildKatEquityOptionsProfile(ticker)');
    expect(source).not.toContain('/execute');
  });

  it('exposes Kat readiness without enabling Discord output by default', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("router.get('/readiness'");
    expect(source).toContain("router.get('/readiness.md'");
    expect(source).toContain('discord_responses_enabled: false');
    expect(source).toContain('discord_posts_enabled: false');
  });

  it('monitors heatmap-requests by channel id and keeps name fallback alive', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kat', 'monitored-users.json'), 'utf8'));

    expect(source).toContain('return ids.includes(channelId) || names.includes(channelName);');
    expect(source).toContain('if (req.body.monitored_channel_ids) config.monitored_channel_ids = req.body.monitored_channel_ids;');
    expect(source).toContain('targetSet.has(c.name) || targetSet.has(c.id)');
    expect(config.monitored_channels).toContain('heatmap-requests');
    expect(config.monitored_channel_ids).toContain('1482431257441996850');
    expect(config.monitored_channel_ids).toContain('1491514754387411085');
    expect(config.monitored_users.map(user => user.username)).toContain('El Jefe');
  });

  it('keeps public Kat commands scoped to SPX and chart-backed equities', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');

    expect(source).toContain('function publicKatTicker(ticker)');
    expect(source).toContain('function findKatChartEvidence(ticker, limit)');
    expect(source).toContain('function getChartEvidencePayload(ticker)');
    expect(source).toContain('getBiasReport(ticker)');
    expect(source).toContain("sub === 'chart' || sub === 'charts'");
    expect(source).toContain("sub === 'chart' || sub === 'charts' || sub === 'recent' || sub === 'source' || sub === 'sources'");
    expect(source).toContain("sub === 'equity'");
    expect(source).toContain("if (canonical !== 'SPX' && !chartBacked) continue;");
    expect(source).toContain('KAT_COMMAND_COOLDOWN_MS');
    expect(source).toContain('katCommandCooldownRemaining(message, cooldownMs, nowMs, katCommandContent)');
    expect(source).toContain('KAT_OWNER_ONLY_SUBCOMMANDS');
    expect(source).toContain('isKatOwnerCommandAllowed(message, config)');
    expect(source).toContain('normalizeKatCommandContent(message.content)');
    expect(source).toContain("'!bias': 'bias'");
    expect(source).toContain("'!queue': 'queue'");
    expect(source).toContain('Kat bias: no call.');
    expect(source).toContain('Use `!recent \' + canonical + \'` for source posts');
    expect(source).toContain('queueHeatmapTicker(args)');
  });

  it('accepts trader-friendly public Kat command shortcuts', () => {
    const katRouter = require('../agents/agent-14-kat');

    expect(katRouter._test.normalizeKatCommandContent('!bias')).toBe('!kat bias');
    expect(katRouter._test.normalizeKatCommandContent('!bias SPX')).toBe('!kat bias SPX');
    expect(katRouter._test.normalizeKatCommandContent('!levels SPX')).toBe('!kat levels SPX');
    expect(katRouter._test.normalizeKatCommandContent('!equity ups')).toBe('!kat equity ups');
    expect(katRouter._test.normalizeKatCommandContent('!Kat heatmap SPX')).toBe('!Kat heatmap SPX');
    expect(katRouter._test.normalizeKatCommandContent('!queue spx heatmap')).toBe('!kat queue spx heatmap');
    expect(katRouter._test.queueHeatmapTicker(['!kat', 'queue', 'spx', 'heatmap'])).toBe('SPX');
    expect(katRouter._test.queueHeatmapTicker(['!kat', 'queue', 'heatmap', 'qqq'])).toBe('SPX');
    expect(katRouter._test.normalizeKatCommandContent('!katapult bias')).toBeNull();
    expect(katRouter._test.katEntryTextMatchesTicker({ content: '$ups lower-case setup' }, 'UPS')).toBe(true);
    expect(katRouter._test.katEntryTextMatchesTicker({ content: 'ups 1D lower-case setup' }, 'ups')).toBe(true);
  });

  it('reports latest capture by timestamp instead of last appended backfill row', () => {
    const katRouter = require('../agents/agent-14-kat');

    const latest = katRouter._test.latestCaptureTimestampFromLines([
      JSON.stringify({ ts: '2026-05-07T14:30:00.000Z', message_id: 'live' }),
      JSON.stringify({ ts: '2026-03-31T16:07:14.386Z', message_id: 'historical-backfill' }),
    ]);

    expect(latest).toBe('2026-05-07T14:30:00.000Z');
  });

  it('does not let stale false ES parses count as SPX evidence', () => {
    const katRouter = require('../agents/agent-14-kat');

    expect(katRouter._test.katSignalMatchesTicker({ ticker: 'ES', raw: '<:KC_yes:1129057964158898256> $LAC' }, 'SPX')).toBe(false);
    expect(katRouter._test.katSignalMatchesTicker({ ticker: 'ES', raw: 'support continues to hold' }, 'SPX')).toBe(false);
    expect(katRouter._test.katSignalMatchesTicker({ ticker: 'ES', raw: '$es_f 1d 200ma retest' }, 'SPX')).toBe(true);
    expect(katRouter._test.katSignalMatchesTicker({ ticker: 'SPX', raw: 'spx 15min bull flag' }, 'spx')).toBe(true);
    expect(katRouter._test.katSignalMatchesTicker({ ticker: 'ups', raw: '$ups lower-case setup' }, 'UPS')).toBe(true);
    expect(katRouter._test.katSignalSourceMessageId({ message_id: 'raw-message:vision:attachment' })).toBe('raw-message');
  });

  it('formats trader-facing evidence with image embeds and no channel or image-link text', async () => {
    const katRouter = require('../agents/agent-14-kat');
    const evidence = [{
      entry: {
        guild_id: 'guild1',
        channel_id: 'channel1',
        message_id: 'message1',
        username: 'analyst1',
        channel_name: 'trade-floor',
        ts: '2026-05-05T13:00:00.000Z',
        content: '$UPS chart setup',
      },
      images: [{ filename: 'ups.png', url: 'https://cdn.discordapp.com/attachments/ups.png', content_type: 'image/png' }],
    }];

    const lines = katRouter._test.katEvidenceLines(evidence).join('\n');
    const payload = await katRouter._test.buildKatEvidencePayload('UPS evidence\n' + lines, evidence, 1);

    expect(payload.content).not.toContain('https://discord.com/channels/guild1/channel1/message1');
    expect(payload.content).not.toContain('trade-floor');
    expect(payload.content).not.toContain('cdn.discordapp.com');
    expect(payload.content).not.toContain('image:');
    expect(payload.files).toBeUndefined();
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].image.url).toBe('https://cdn.discordapp.com/attachments/ups.png');
  });

  it('formats Level Magnet posts without Discord link walls or static source boilerplate', () => {
    const katRouter = require('../agents/agent-14-kat');

    const output = katRouter._test.formatKatLevelMagnetMessage({
      ticker: 'SPX',
      level: 5600,
      analysts: new Set(['analyst1', 'analyst2']),
      biases: new Set(['BULLISH']),
      count: 2,
      lastTs: '2026-05-05T13:00:00.000Z',
      examples: [{
        analyst: 'analyst1',
        ts: '2026-05-05T13:00:00.000Z',
        link: 'https://discord.com/channels/guild/channel/message',
        text: '$SPX 5600 support',
      }],
    });

    expect(output).toContain('Level Magnet');
    expect(output).toContain('Source:');
    expect(output).not.toContain('https://discord.com/channels');
    expect(output).not.toContain('Elevated Charts analyst posts via Kat');
  });

  it('keeps Discord payloads under the message limit and preserves embeds through safe mentions', () => {
    const katRouter = require('../agents/agent-14-kat');
    const longText = 'x'.repeat(2500);

    const trimmed = katRouter._test.trimKatDiscordContent(longText);
    const safePayload = katRouter._test.withSafeAllowedMentions({
      content: trimmed,
      embeds: [{ image: { url: 'https://cdn.discordapp.com/attachments/chart.png' } }],
    });

    expect(trimmed.length).toBeLessThanOrEqual(1900);
    expect(trimmed).toContain('trimmed');
    expect(safePayload.allowedMentions).toEqual({ parse: [], repliedUser: false });
    expect(safePayload.embeds).toHaveLength(1);
  });

  it('rate-limits only exact duplicate public Kat commands by guild, channel, and user', () => {
    const katRouter = require('../agents/agent-14-kat');
    katRouter._test.resetKatCommandCooldownsForTest();
    const suffix = String(Date.now());
    const message = { guildId: 'guild-' + suffix, channelId: 'chan1', author: { id: 'user1' } };
    const otherUser = { guildId: 'guild-' + suffix, channelId: 'chan1', author: { id: 'user2' } };

    expect(katRouter._test.katCommandCooldownRemaining(message, 10000, 1000, '!kat levels spx')).toBe(0);
    katRouter._test.recordKatCommandCooldown(message, 1000, '!kat levels spx');

    expect(katRouter._test.katCommandCooldownRemaining(message, 10000, 5000, '!kat levels spx')).toBe(6000);
    expect(katRouter._test.katCommandCooldownRemaining(message, 10000, 5000, '!kat recent spx')).toBe(0);
    expect(katRouter._test.katCommandCooldownRemaining(otherUser, 10000, 5000, '!kat levels spx')).toBe(0);
    expect(katRouter._test.katCommandCooldownKey(message, '!kat levels SPX')).toBe('guild-' + suffix + ':chan1:user1:!kat levels spx');
  });

  it('makes Kat command channel gating testable and diagnosable', () => {
    const katRouter = require('../agents/agent-14-kat');
    const config = { command_channels: ['chan1', 'trade-floor'] };
    const byId = { channelId: 'chan1', channel: { name: 'other' } };
    const byName = { channelId: 'chan2', channel: { name: 'trade-floor' } };
    const blocked = { channelId: 'chan3', channel: { name: 'general' } };

    expect(katRouter._test.katCommandChannelAllowed(byId, config)).toBe(true);
    expect(katRouter._test.katCommandChannelAllowed(byName, config)).toBe(true);
    expect(katRouter._test.katCommandChannelAllowed(blocked, config)).toBe(false);
    expect(katRouter._test.katCommandChannelDebug(blocked, config)).toEqual({
      channel_id: 'chan3',
      channel_name: 'general',
      configured_command_channels: ['chan1', 'trade-floor'],
    });
  });

  it('keeps live image vision disabled until explicitly enabled after free-AI proof', () => {
    const katRouter = require('../agents/agent-14-kat');
    const original = process.env.KATBOT_ENABLE_LIVE_VISION;
    const originalLukeVision = process.env.LUKE_ALLOW_ANTHROPIC_VISION;

    try {
      delete process.env.KATBOT_ENABLE_LIVE_VISION;
      delete process.env.LUKE_ALLOW_ANTHROPIC_VISION;
      expect(katRouter._test.katLiveVisionAllowed({ vision_enabled: true })).toBe(false);
      expect(katRouter._test.katLiveVisionPolicy({ vision_enabled: true })).toEqual(expect.objectContaining({
        enabled: false,
        env_required: 'KATBOT_ENABLE_LIVE_VISION=1 and LUKE_ALLOW_ANTHROPIC_VISION=1',
      }));

      process.env.KATBOT_ENABLE_LIVE_VISION = '1';
      expect(katRouter._test.katLiveVisionAllowed({ vision_enabled: true })).toBe(false);
      process.env.LUKE_ALLOW_ANTHROPIC_VISION = '1';
      expect(katRouter._test.katLiveVisionAllowed({ vision_enabled: true })).toBe(true);
      expect(katRouter._test.katLiveVisionAllowed({ vision_enabled: false })).toBe(false);
    } finally {
      if (original === undefined) delete process.env.KATBOT_ENABLE_LIVE_VISION;
      else process.env.KATBOT_ENABLE_LIVE_VISION = original;
      if (originalLukeVision === undefined) delete process.env.LUKE_ALLOW_ANTHROPIC_VISION;
      else process.env.LUKE_ALLOW_ANTHROPIC_VISION = originalLukeVision;
    }
  });

  it('keeps owner/debug command paths out of public phase 1 replies', () => {
    const katRouter = require('../agents/agent-14-kat');
    const message = { author: { id: 'public-user' } };
    const ownerMessage = { author: { id: 'owner-user' } };
    const config = { owner_user_ids: ['owner-user'] };

    expect(katRouter._test.isKatOwnerCommandAllowed(message, config)).toBe(false);
    expect(katRouter._test.isKatOwnerCommandAllowed(ownerMessage, config)).toBe(true);
    expect(katRouter._test.getKatOwnerOnlyMessage()).toContain('owner-only right now');
    expect(katRouter._test.getKatOwnerOnlyMessage()).toContain('Public commands: `!bias`, `!levels SPX`');
  });
});
