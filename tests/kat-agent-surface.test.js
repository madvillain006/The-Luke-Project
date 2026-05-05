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
    expect(source).toContain('function getKatWelcomeMessage()');
    expect(source).toContain("Hey everyone. I'm Kat.");
    expect(source).toContain('`!kat levels SPX` - top analyst-marked levels this week.');
    expect(source).toContain('`!kat bias` - SPX directional bias across monitored analysts, last 18 hours.');
    expect(source).toContain('`!kat heatmap SPX` - most recent heatmap image for that ticker with timestamp.');
    expect(source).toContain('`!kat recent SPX` - latest chart-backed analyst posts for SPX/ES/SPY.');
    expect(source).toContain('`!kat equity UPS` - latest chart-backed analyst posts for that equity ticker.');
    expect(source).toContain('Level Magnet alerts run during market hours');
    expect(source).toContain('Owner/debug commands are blocked from public Phase 1 replies unless an owner user id is configured.');
    expect(source).toContain("router.get('/welcome'");
    expect(source).toContain('No autonomous execution');
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
    expect(source).toContain('katCommandCooldownRemaining(message, cooldownMs, nowMs)');
    expect(source).toContain('KAT_OWNER_ONLY_SUBCOMMANDS');
    expect(source).toContain('isKatOwnerCommandAllowed(message, config)');
  });

  it('formats trader-facing evidence with direct message links and attached files, not CDN URLs in content', () => {
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
    const payload = katRouter._test.buildKatEvidencePayload('UPS evidence\n' + lines, evidence, 1);

    expect(payload.content).toContain('https://discord.com/channels/guild1/channel1/message1');
    expect(payload.content).toContain('image: attached below');
    expect(payload.content).not.toContain('cdn.discordapp.com');
    expect(payload.files).toEqual([{ attachment: 'https://cdn.discordapp.com/attachments/ups.png', name: 'ups.png' }]);
  });

  it('keeps Discord payloads under the message limit and preserves image files through safe mentions', () => {
    const katRouter = require('../agents/agent-14-kat');
    const longText = 'x'.repeat(2500);

    const trimmed = katRouter._test.trimKatDiscordContent(longText);
    const safePayload = katRouter._test.withSafeAllowedMentions({
      content: trimmed,
      files: [{ attachment: 'https://cdn.discordapp.com/attachments/chart.png', name: 'chart.png' }],
    });

    expect(trimmed.length).toBeLessThanOrEqual(1900);
    expect(trimmed).toContain('trimmed');
    expect(safePayload.allowedMentions).toEqual({ parse: [], repliedUser: false });
    expect(safePayload.files).toHaveLength(1);
  });

  it('rate-limits public Kat commands by guild, channel, and user', () => {
    const katRouter = require('../agents/agent-14-kat');
    katRouter._test.resetKatCommandCooldownsForTest();
    const suffix = String(Date.now());
    const message = { guildId: 'guild-' + suffix, channelId: 'chan1', author: { id: 'user1' } };
    const otherUser = { guildId: 'guild-' + suffix, channelId: 'chan1', author: { id: 'user2' } };

    expect(katRouter._test.katCommandCooldownRemaining(message, 10000, 1000)).toBe(0);
    katRouter._test.recordKatCommandCooldown(message, 1000);

    expect(katRouter._test.katCommandCooldownRemaining(message, 10000, 5000)).toBe(6000);
    expect(katRouter._test.katCommandCooldownRemaining(otherUser, 10000, 5000)).toBe(0);
    expect(katRouter._test.katCommandCooldownKey(message)).toBe('guild-' + suffix + ':chan1:user1');
  });

  it('keeps owner/debug command paths out of public phase 1 replies', () => {
    const katRouter = require('../agents/agent-14-kat');
    const message = { author: { id: 'public-user' } };
    const ownerMessage = { author: { id: 'owner-user' } };
    const config = { owner_user_ids: ['owner-user'] };

    expect(katRouter._test.isKatOwnerCommandAllowed(message, config)).toBe(false);
    expect(katRouter._test.isKatOwnerCommandAllowed(ownerMessage, config)).toBe(true);
    expect(katRouter._test.getKatOwnerOnlyMessage()).toContain('owner-only during Phase 1');
    expect(katRouter._test.getKatOwnerOnlyMessage()).toContain('No internal status, watchlist, options profile, or Luke-side data is exposed.');
  });
});
