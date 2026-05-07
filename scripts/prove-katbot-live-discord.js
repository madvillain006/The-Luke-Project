#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const {
  HEATMAP_REQUESTS_CHANNEL_ID,
  SECONDARY_RESEARCH_CHANNEL_ID,
} = require('../lib/kat-plain-proof');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-live');
const OUT_FILE = path.join(OUT_DIR, 'katbot-live-discord-proof.json');
const CONFIG_FILE = path.join(ROOT, 'data', 'kat', 'monitored-users.json');
const BAD_TEXT_RE = /open chart|open heatmap|discord\.com\/channels|cdn\.discordapp|image:\s*\[|Image:|#trade-floor|Source: captured analyst posts\. Not a prediction|Source: captured analyst post via Kat/i;
const REQUIRED_SOURCE_CHANNEL_IDS = new Set([HEATMAP_REQUESTS_CHANNEL_ID, SECONDARY_RESEARCH_CHANNEL_ID]);

function loadKatRouterWithoutStartingBot() {
  const token = process.env.KAT_BOT_TOKEN;
  const originalLog = console.log;
  delete process.env.KAT_BOT_TOKEN;
  console.log = () => {};
  try {
    return require('../agents/agent-14-kat');
  } finally {
    console.log = originalLog;
    if (token) process.env.KAT_BOT_TOKEN = token;
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

async function fetchKatStatus() {
  const response = await fetch('http://127.0.0.1:3000/agent/kat/status');
  if (!response.ok) throw new Error('Kat status HTTP ' + response.status);
  return response.json();
}

function result(label, ok, detail, extra) {
  return { label, ok: !!ok, detail, ...(extra || {}) };
}

function assertPayload(name, payload, options = {}) {
  const content = String(payload && payload.content || '');
  const embeds = Array.isArray(payload && payload.embeds) ? payload.embeds : [];
  const checks = [
    result(name + ': content present', content.length > 0, content.slice(0, 100)),
    result(name + ': under Discord limit', content.length <= 1900, String(content.length)),
    result(name + ': no stale channel/link text', !BAD_TEXT_RE.test(content), 'badPattern=' + BAD_TEXT_RE.test(content)),
    result(name + ': no files fallback', !payload.files, 'files=' + (payload.files ? payload.files.length : 0)),
  ];
  if (options.sourceFooter) {
    checks.push(result(name + ': source footer present', /^Source:/m.test(content), (content.match(/^Source:.+$/m) || ['missing'])[0]));
  }
  if (options.embeds) {
    checks.push(result(name + ': embeds present', embeds.length >= options.embeds, 'embeds=' + embeds.length));
  }
  return checks;
}

async function expectFetchDeleted(channel, messageId) {
  try {
    await channel.messages.fetch({ message: messageId, force: true });
    return false;
  } catch (err) {
    return err && (err.code === 10008 || /Unknown Message/i.test(String(err.message || '')));
  }
}

function embedImageUrls(payload) {
  const embeds = Array.isArray(payload && payload.embeds) ? payload.embeds : [];
  return embeds
    .map(embed => embed && embed.image && embed.image.url)
    .filter(Boolean);
}

async function fetchUrlReachability(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    if (response.ok) return { ok: true, status: response.status, method: 'HEAD' };
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
        redirect: 'follow',
      });
      return { ok: response.ok || response.status === 206, status: response.status, method: 'GET' };
    }
    return { ok: false, status: response.status, method: 'HEAD' };
  } catch (err) {
    return { ok: false, status: String(err && err.message || err), method: 'HEAD' };
  } finally {
    clearTimeout(timeout);
  }
}

async function assertEmbedImageUrlsReachable(name, payload) {
  const urls = embedImageUrls(payload);
  const checks = [];
  for (const url of urls) {
    const status = await fetchUrlReachability(url);
    checks.push(result(
      name + ': embed image reachable',
      status.ok,
      status.method + ' ' + status.status + ' ' + url.slice(0, 90),
      { url, status }
    ));
  }
  return checks;
}

function configuredSourceChannelIds(config) {
  return [...new Set((config.monitored_channel_ids || [])
    .map(String)
    .map(id => id.trim())
    .filter(Boolean))];
}

function configuredCommandChannelRefs(config) {
  return [...new Set((config.command_channels || [])
    .map(String)
    .map(id => id.trim())
    .filter(Boolean))];
}

async function fetchConfiguredChannel(client, ref) {
  const channelRef = String(ref || '').trim();
  if (!channelRef) return null;
  if (/^\d+$/.test(channelRef)) return client.channels.fetch(channelRef);

  for (const guild of client.guilds.cache.values()) {
    await guild.channels.fetch();
    const found = guild.channels.cache.find(channel => channel && channel.name === channelRef);
    if (found) return found;
  }
  return null;
}

function commandChannelPermissionRow(channel, client, ref) {
  const perms = channel && channel.permissionsFor(client.user);
  const view = !!(perms && perms.has(PermissionFlagsBits.ViewChannel));
  const history = !!(perms && perms.has(PermissionFlagsBits.ReadMessageHistory));
  const send = !!(perms && perms.has(PermissionFlagsBits.SendMessages));
  const embed = !!(perms && perms.has(PermissionFlagsBits.EmbedLinks));
  return {
    ref: String(ref || ''),
    id: channel ? channel.id : null,
    name: channel ? channel.name : null,
    view,
    history,
    send,
    embed,
    output_ready: view && history && send && embed,
  };
}

async function verifyCommandChannel(options) {
  const {
    channel,
    ref,
    client,
    checks,
    commandChannelPermissions,
    recentPayload,
    heatmapPayload,
    heatmapHasFreshImage,
    testApi,
  } = options;
  const row = commandChannelPermissionRow(channel, client, ref);
  commandChannelPermissions.push(row);
  const label = 'command channel: ' + (row.name || row.id || ref);
  checks.push(result(
    label + ': output permissions',
    row.output_ready,
    JSON.stringify(row),
    { channel_id: row.id, ref: row.ref }
  ));
  if (!row.output_ready) return;

  let probe = null;
  let edited = null;
  let dispatchProbe = null;
  let deleted = false;
  try {
    const sendPayload = {
      content: recentPayload.content,
      embeds: (recentPayload.embeds || []).slice(0, 4),
      allowedMentions: { parse: [], repliedUser: false },
    };
    probe = await channel.send(sendPayload);
    const sent = await channel.messages.fetch({ message: probe.id, force: true });
    checks.push(result(label + ': probe sent as Kat', sent.author.id === client.user.id, sent.url, { url: sent.url }));
    checks.push(result(label + ': probe recent embeds rendered', sent.embeds.length >= 1, 'embeds=' + sent.embeds.length));
    checks.push(result(label + ': probe recent text clean', !BAD_TEXT_RE.test(sent.content), 'badPattern=' + BAD_TEXT_RE.test(sent.content)));

    edited = await sent.edit({
      content: heatmapPayload.content,
      embeds: (heatmapPayload.embeds || []).slice(0, 1),
      allowedMentions: { parse: [], repliedUser: false },
    });
    const editedReadback = await channel.messages.fetch({ message: edited.id, force: true });
    checks.push(result(label + ': probe edited by Kat', /^(Kat heatmap: SPX|No fresh heatmap found for SPX)/m.test(editedReadback.content), editedReadback.url, { url: editedReadback.url }));
    checks.push(result(label + ': edited heatmap embed state correct', heatmapHasFreshImage ? editedReadback.embeds.length === 1 : editedReadback.embeds.length === 0, 'embeds=' + editedReadback.embeds.length));
    checks.push(result(label + ': edited heatmap text clean', !BAD_TEXT_RE.test(editedReadback.content), 'badPattern=' + BAD_TEXT_RE.test(editedReadback.content)));

    let dispatchedPayload = null;
    const fakeMessage = {
      guildId: channel.guildId,
      channelId: channel.id,
      content: '!recent spx',
      author: { id: 'katbot-live-proof-user', bot: false },
      reply: async payload => {
        dispatchedPayload = payload;
        dispatchProbe = await channel.send(payload);
        return dispatchProbe;
      },
    };
    await testApi.handleKatCommand(fakeMessage, '!kat recent spx');
    checks.push(result(label + ': dispatcher !recent invoked reply path', !!dispatchProbe, dispatchProbe ? dispatchProbe.url : 'no reply'));
    if (dispatchProbe) {
      const dispatchReadback = await channel.messages.fetch({ message: dispatchProbe.id, force: true });
      checks.push(result(label + ': dispatcher !recent text clean', !BAD_TEXT_RE.test(dispatchReadback.content), 'badPattern=' + BAD_TEXT_RE.test(dispatchReadback.content)));
      checks.push(result(label + ': dispatcher !recent embeds rendered', dispatchReadback.embeds.length >= 1, 'embeds=' + dispatchReadback.embeds.length));
      checks.push(result(label + ': dispatcher !recent allowed mentions safe', dispatchedPayload && dispatchedPayload.allowedMentions && Array.isArray(dispatchedPayload.allowedMentions.parse) && dispatchedPayload.allowedMentions.parse.length === 0, JSON.stringify(dispatchedPayload && dispatchedPayload.allowedMentions || null)));
      await dispatchReadback.delete();
      dispatchProbe = null;
    }

    await editedReadback.delete();
    deleted = true;
    checks.push(result(label + ': probe deleted by Kat', await expectFetchDeleted(channel, editedReadback.id), 'message=' + editedReadback.id));
  } finally {
    if (dispatchProbe) {
      try {
        await dispatchProbe.delete();
      } catch {}
    }
    if (!deleted && (edited || probe)) {
      try {
        await (edited || probe).delete();
      } catch {}
    }
  }
}

async function main() {
  if (!process.env.KAT_BOT_TOKEN) throw new Error('KAT_BOT_TOKEN missing');

  const katRouter = loadKatRouterWithoutStartingBot();
  const testApi = katRouter._test;
  const config = readJson(CONFIG_FILE, {});
  const status = await fetchKatStatus();
  const checks = [];

  checks.push(result('runtime: bot online', status.bot_online === true, JSON.stringify({
    bot_online: status.bot_online,
    bot_tag: status.bot_tag,
  })));
  checks.push(result('runtime: poll active', status.poll_active === true, 'poll_active=' + status.poll_active));
  checks.push(result('runtime: Discord output enabled', status.discord_output && status.discord_output.responses_enabled === true, JSON.stringify(status.discord_output || {})));

  checks.push(result('shortcut: !recent lower-case normalizes', testApi.normalizeKatCommandContent('!recent spx') === '!kat recent spx', testApi.normalizeKatCommandContent('!recent spx')));
  checks.push(result('shortcut: !equity lower-case normalizes', testApi.normalizeKatCommandContent('!equity ups') === '!kat equity ups', testApi.normalizeKatCommandContent('!equity ups')));
  checks.push(result('shortcut: !queue spx heatmap routes to SPX heatmap', testApi.queueHeatmapTicker(['!kat', 'queue', 'spx', 'heatmap']) === 'SPX', testApi.queueHeatmapTicker(['!kat', 'queue', 'spx', 'heatmap'])));
  checks.push(result('ticker text: lower-case equity matches', testApi.katEntryTextMatchesTicker({ content: '$ups 1D setup' }, 'ups') === true, '$ups -> UPS'));

  testApi.resetKatCommandCooldownsForTest();
  const fakeMessage = { guildId: 'proof-guild', channelId: 'proof-channel', author: { id: 'proof-user' } };
  testApi.recordKatCommandCooldown(fakeMessage, 1000, '!kat levels spx');
  checks.push(result('cooldown: exact duplicate blocked', testApi.katCommandCooldownRemaining(fakeMessage, 10000, 5000, '!kat levels spx') === 6000, 'levels remaining=' + testApi.katCommandCooldownRemaining(fakeMessage, 10000, 5000, '!kat levels spx')));
  checks.push(result('cooldown: next different command allowed', testApi.katCommandCooldownRemaining(fakeMessage, 10000, 5000, '!kat recent spx') === 0, 'recent remaining=' + testApi.katCommandCooldownRemaining(fakeMessage, 10000, 5000, '!kat recent spx')));

  checks.push(...assertPayload('bias spx', testApi.getBiasReport('spx'), { sourceFooter: false }));
  checks.push(...assertPayload('levels spx', testApi.getTopLevels('spx'), { sourceFooter: false }));
  const recentPayload = await testApi.getChartEvidencePayload('spx');
  checks.push(...assertPayload('recent spx', recentPayload, { sourceFooter: true, embeds: 1 }));
  checks.push(...await assertEmbedImageUrlsReachable('recent spx', recentPayload));
  const heatmapPayload = await testApi.getHeatmap('spx');
  const heatmapContent = String(heatmapPayload && heatmapPayload.content || '');
  const heatmapHasFreshImage = /^Kat heatmap: SPX/m.test(heatmapContent);
  checks.push(...assertPayload('heatmap spx', heatmapPayload, {
    sourceFooter: heatmapHasFreshImage,
    embeds: heatmapHasFreshImage ? 1 : 0,
  }));
  checks.push(result(
    'heatmap spx: no stale heatmap output',
    heatmapHasFreshImage || /^No fresh heatmap found for SPX/m.test(heatmapContent),
    heatmapContent.slice(0, 160)
  ));
  if (heatmapHasFreshImage) {
    checks.push(...await assertEmbedImageUrlsReachable('heatmap spx', heatmapPayload));
  }

  const footers = new Set(Array.from({ length: 24 }, (_, index) => testApi.katSourceFooter('proof:' + index)));
  checks.push(result('source footer rotation: professional option present', [...footers].some(line => /attached images|attached charts|timestamps/i.test(line)), [...footers].join(' | ')));
  checks.push(result('source footer rotation: silly option present', [...footers].some(line => /George Washington|cat in the alley|sweeping|sandwich/i.test(line)), [...footers].join(' | ')));

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  const commandChannels = [];
  const commandChannelPermissions = [];
  const sourceChannelPermissions = [];
  try {
    const ready = new Promise(resolve => client.once('clientReady', resolve));
    await client.login(process.env.KAT_BOT_TOKEN);
    await ready;

    const commandRefs = configuredCommandChannelRefs(config);
    if (!commandRefs.length) throw new Error('No Kat command channel configured');
    for (const ref of commandRefs) {
      const commandChannel = await fetchConfiguredChannel(client, ref);
      if (!commandChannel) {
        const row = {
          ref: String(ref),
          id: null,
          name: null,
          view: false,
          history: false,
          send: false,
          embed: false,
          output_ready: false,
          error: 'configured channel not found',
        };
        commandChannelPermissions.push(row);
        checks.push(result('command channel: ' + ref + ': output permissions', false, JSON.stringify(row), { ref }));
        continue;
      }
      commandChannels.push({ id: commandChannel.id, name: commandChannel.name, ref });
      await verifyCommandChannel({
        channel: commandChannel,
        ref,
        client,
        checks,
        commandChannelPermissions,
        recentPayload,
        heatmapPayload,
        heatmapHasFreshImage,
        testApi,
      });
    }

    for (const sourceId of configuredSourceChannelIds(config)) {
      try {
        const sourceChannel = await client.channels.fetch(sourceId);
        const sourcePerms = sourceChannel && sourceChannel.permissionsFor(client.user);
        const readable = !!(sourcePerms &&
          sourcePerms.has(PermissionFlagsBits.ViewChannel) &&
          sourcePerms.has(PermissionFlagsBits.ReadMessageHistory));
        const permissionRow = {
          id: sourceId,
          name: sourceChannel ? sourceChannel.name : null,
          required: REQUIRED_SOURCE_CHANNEL_IDS.has(sourceId),
          view: !!(sourcePerms && sourcePerms.has(PermissionFlagsBits.ViewChannel)),
          history: !!(sourcePerms && sourcePerms.has(PermissionFlagsBits.ReadMessageHistory)),
          readable,
        };
        sourceChannelPermissions.push(permissionRow);
        checks.push(result(
          'source channel readable: ' + (permissionRow.name || sourceId),
          readable,
          JSON.stringify(permissionRow),
          { channel_id: sourceId, required: permissionRow.required }
        ));
      } catch (err) {
        const permissionRow = {
          id: sourceId,
          name: null,
          required: REQUIRED_SOURCE_CHANNEL_IDS.has(sourceId),
          view: false,
          history: false,
          readable: false,
          error: err && (err.code + ': ' + err.message),
        };
        sourceChannelPermissions.push(permissionRow);
        checks.push(result(
          'source channel readable: ' + sourceId,
          false,
          JSON.stringify(permissionRow),
          { channel_id: sourceId, required: permissionRow.required }
        ));
      }
    }

  } finally {
    client.destroy();
  }

  const blockers = checks.filter(check => !check.ok);
  const proof = {
    ok: blockers.length === 0,
    generated_at: new Date().toISOString(),
    status: {
      bot_online: status.bot_online,
      poll_active: status.poll_active,
      bot_tag: status.bot_tag,
      raw_feed_count: status.raw_feed_count,
      processed_signal_count: status.processed_signal_count,
    },
    command_channel: commandChannels[0] ? { id: commandChannels[0].id, name: commandChannels[0].name } : null,
    command_channels: commandChannels,
    command_channel_permissions: commandChannelPermissions,
    source_channel_permissions: sourceChannelPermissions,
    checks,
    blockers,
  };

  writeJson(OUT_FILE, proof);
  console.log(JSON.stringify(proof, null, 2));
  if (!proof.ok) process.exitCode = 1;
}

main().catch(err => {
  const proof = {
    ok: false,
    generated_at: new Date().toISOString(),
    error: err && err.stack ? err.stack : String(err),
  };
  writeJson(OUT_FILE, proof);
  console.error(JSON.stringify(proof, null, 2));
  process.exitCode = 1;
});
