#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { getKatWelcomeMessage } = require('../lib/kat-welcome-message');

const ROOT = path.join(__dirname, '..');
const TRADE_FLOOR_CHANNEL_ID = '1040400353490911292';
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-intro');
const OUT_FILE = path.join(OUT_DIR, 'intro-message-proof.json');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function permissionSnapshot(channel, client) {
  const perms = channel && channel.permissionsFor(client.user);
  return {
    view: !!(perms && perms.has(PermissionFlagsBits.ViewChannel)),
    history: !!(perms && perms.has(PermissionFlagsBits.ReadMessageHistory)),
    send: !!(perms && perms.has(PermissionFlagsBits.SendMessages)),
    embed: !!(perms && perms.has(PermissionFlagsBits.EmbedLinks)),
  };
}

async function main() {
  if (!process.env.KAT_BOT_TOKEN) throw new Error('KAT_BOT_TOKEN missing');

  const channelId = process.env.KATBOT_INTRO_CHANNEL_ID || TRADE_FLOOR_CHANNEL_ID;
  const content = getKatWelcomeMessage();
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  const proof = {
    ok: false,
    generated_at: new Date().toISOString(),
    target_channel_id: channelId,
    message: {
      expected_content: content,
      length: content.length,
    },
    checks: [],
  };

  try {
    const ready = new Promise(resolve => client.once('clientReady', resolve));
    await client.login(process.env.KAT_BOT_TOKEN);
    await ready;

    const channel = await client.channels.fetch(channelId);
    const permissions = permissionSnapshot(channel, client);
    proof.bot = {
      id: client.user.id,
      tag: client.user.tag,
    };
    proof.channel = {
      id: channel ? channel.id : null,
      name: channel ? channel.name : null,
      guild_id: channel ? channel.guildId : null,
    };
    proof.permissions = permissions;
    proof.checks.push({
      label: 'trade-floor output permissions',
      ok: permissions.view && permissions.history && permissions.send && permissions.embed,
      detail: JSON.stringify(permissions),
    });

    if (!channel) throw new Error('Target channel not found: ' + channelId);
    if (!permissions.view || !permissions.history || !permissions.send || !permissions.embed) {
      throw new Error('Katbot lacks required output permissions in channel ' + channelId);
    }

    const sent = await channel.send({
      content,
      allowedMentions: { parse: [], repliedUser: false },
    });
    const readback = await channel.messages.fetch({ message: sent.id, force: true });
    proof.message = {
      ...proof.message,
      id: readback.id,
      url: readback.url,
      author_id: readback.author.id,
      author_tag: readback.author.tag,
      actual_content: readback.content,
      created_at: readback.createdAt ? readback.createdAt.toISOString() : null,
    };
    proof.checks.push({
      label: 'sent by Katbot',
      ok: readback.author.id === client.user.id,
      detail: readback.author.tag,
    });
    proof.checks.push({
      label: 'intro content read back exactly',
      ok: readback.content === content,
      detail: 'length=' + readback.content.length,
    });
    proof.checks.push({
      label: 'mentions disabled',
      ok: !/@everyone|@here|<@&?\d+>/.test(readback.content),
      detail: 'no raw mention text',
    });

    proof.ok = proof.checks.every(check => check.ok);
  } finally {
    client.destroy();
    writeJson(OUT_FILE, proof);
  }

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
