'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  REQUIRED_CHANNEL_IDS,
  buildKatReleaseReadiness,
  formatKatReleaseReadinessMarkdown,
  _internal,
} = require('../lib/kat-release-readiness');

const tempDirs = [];
const TEST_NOW = new Date('2026-05-05T13:05:00.000Z');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-release-readiness-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat', 'derived'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts', 'proof', 'katbot-plain'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts', 'proof', 'katbot-live'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
  return root;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function seedReadyRoot() {
  const root = makeRoot();
  writeJson(path.join(root, 'data', 'kat', 'monitored-users.json'), {
    enabled: true,
    monitored_users: [
      { discord_id: '1', username: 'A' },
      { discord_id: '2', username: 'B' },
      { discord_id: '3', username: 'C' },
      { discord_id: '4', username: 'D' },
    ],
    monitored_channel_ids: ['main', ...REQUIRED_CHANNEL_IDS],
    command_channels: ['commands'],
    magnet_channel: 'magnets',
    discord_responses_enabled: false,
    discord_posts_enabled: false,
  });
  writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
    ...REQUIRED_CHANNEL_IDS.map(id => ({ ts: '2026-05-05T13:00:00.000Z', message_id: id, channel_id: id, content: '$SPX', attachments: [] })),
  ]);
  writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-replay-summary.json'), {
    parsed_records: 100,
  });
  writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-evaluation-summary.json'), {
    evaluated: 300,
  });
  writeJson(path.join(root, 'artifacts', 'proof', 'katbot-plain', 'katbot-proof-result.json'), {
    ok: true,
    generated_at: '2026-05-05T13:04:30.000Z',
  });
  fs.writeFileSync(path.join(root, 'artifacts', 'proof', 'katbot-plain', 'katbot-simulated-output.txt'), [
    'Kat recent: UPS chart-backed posts',
    '1. analyst1 - May 05, 9:00 AM ET',
    '   "$ups lower-case setup"',
    'Source: attached images and timestamps.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(root, 'agents', 'agent-14-kat.js'), [
    'function katImageEmbed',
    'image: { url: image.url }',
    'payload.embeds = embeds',
    'katSourceFooter',
    'trimKatDiscordContent',
    'KAT_COMMAND_COOLDOWN_MS',
    'KAT_OWNER_ONLY_SUBCOMMANDS',
    'isKatOwnerCommandAllowed',
    'allowedMentions: SAFE_ALLOWED_MENTIONS',
  ].join('\n'), 'utf8');
  return root;
}

function writeLiveProof(root, ok = true) {
  writeJson(path.join(root, 'artifacts', 'proof', 'katbot-live', 'katbot-live-discord-proof.json'), {
    ok,
    generated_at: '2026-05-05T13:04:00.000Z',
    status: {
      bot_online: ok,
      poll_active: ok,
      bot_tag: ok ? 'Kat#7773' : null,
    },
    source_channel_permissions: REQUIRED_CHANNEL_IDS.map(id => ({
      id,
      name: id,
      required: true,
      view: ok,
      history: ok,
      readable: ok,
    })),
    command_channel_permissions: [{
      ref: 'commands',
      id: 'commands',
      name: 'commands',
      view: ok,
      history: ok,
      send: ok,
      embed: ok,
      output_ready: ok,
    }],
    blockers: ok ? [] : ['discord: edited heatmap text clean: badPattern=true'],
  });
}

describe('Kat release readiness', () => {
  it('passes limited reply ungate when payload safety, proof, and config are clean', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(report.recommended_phase).toBe('phase_1_command_replies_only');
    expect(report.blockers).toEqual([]);
    expect(report.enable_plan.phase_1.discord_responses_enabled).toBe(true);
    expect(report.enable_plan.phase_1.discord_posts_enabled).toBe(false);
    expect(formatKatReleaseReadinessMarkdown(report)).toContain('Phase 1');
  });

  it('blocks release when proof content still contains image CDN URLs', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    fs.writeFileSync(path.join(root, 'artifacts', 'proof', 'katbot-plain', 'katbot-simulated-output.txt'), [
      'https://discord.com/channels/guild/channel/message',
      'https://cdn.discordapp.com/attachments/chart.png',
    ].join('\n'), 'utf8');

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Proof output has no image CDN URLs');
  });

  it('warns but does not block when newly requested channels have no historical rows', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), []);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(report.warnings.join('\n')).toContain('Historical rows present for requested channel');
  });

  it('reports phase 1 live when command replies are enabled and auto posts stay gated', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = false;
    writeJson(configFile, config);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('PHASE_1_COMMAND_REPLIES_LIVE');
    expect(report.recommended_phase).toBe('phase_1_live_monitor_command_replies');
    expect(report.blockers).toEqual([]);
  });

  it('blocks release when live Discord proof has not passed', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = true;
    writeJson(configFile, config);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Live Discord proof passed');
  });

  it('reports live-ready when automatic posts are enabled after live Discord proof passes', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = true;
    writeJson(configFile, config);
    writeLiveProof(root, true);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('KATBOT_LIVE_READY');
    expect(report.recommended_phase).toBe('katbot_live_replies_and_posts');
    expect(report.blockers).toEqual([]);
    expect(formatKatReleaseReadinessMarkdown(report)).toContain('live Discord proof: true');
  });

  it('blocks live-ready when required source channels are not readable', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = true;
    writeJson(configFile, config);
    writeLiveProof(root, true);
    const proofFile = path.join(root, 'artifacts', 'proof', 'katbot-live', 'katbot-live-discord-proof.json');
    const liveProof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
    liveProof.source_channel_permissions[0].view = false;
    liveProof.source_channel_permissions[0].readable = false;
    writeJson(proofFile, liveProof);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Required source channels readable');
  });

  it('blocks release when any configured source channel is not readable', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    const proofFile = path.join(root, 'artifacts', 'proof', 'katbot-live', 'katbot-live-discord-proof.json');
    const liveProof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
    liveProof.source_channel_permissions.push({
      id: 'extra-source',
      name: 'trade-floor',
      required: false,
      view: true,
      history: false,
      readable: false,
    });
    liveProof.ok = false;
    liveProof.blockers = ['source channel readable: trade-floor'];
    writeJson(proofFile, liveProof);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Configured source channels readable');
  });

  it('blocks release when any configured command channel cannot send embeds', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    const proofFile = path.join(root, 'artifacts', 'proof', 'katbot-live', 'katbot-live-discord-proof.json');
    const liveProof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
    liveProof.command_channel_permissions.push({
      ref: 'trade-floor',
      id: 'trade-floor',
      name: 'trade-floor',
      view: true,
      history: true,
      send: true,
      embed: false,
      output_ready: false,
    });
    liveProof.ok = false;
    liveProof.blockers = ['command channel: trade-floor: output permissions'];
    writeJson(proofFile, liveProof);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Configured command channels writable');
  });

  it('blocks release when a configured command channel is missing from live proof', () => {
    const root = seedReadyRoot();
    writeLiveProof(root, true);
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.command_channels = ['commands', 'trade-floor'];
    writeJson(configFile, config);

    const report = buildKatReleaseReadiness({ rootDir: root, now: TEST_NOW });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Configured command channels covered');
    expect(report.blockers.join('\n')).toContain('trade-floor');
  });

  it('blocks live-ready when live proof is stale', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = true;
    writeJson(configFile, config);
    writeLiveProof(root, true);

    const report = buildKatReleaseReadiness({ rootDir: root, now: new Date('2026-05-05T14:00:00.000Z') });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Live Discord proof is fresh');
  });

  it('recognizes payload safety markers and CDN URL leakage', () => {
    expect(_internal.hasNoImageCdnUrls('image: [open chart](https://cdn.discordapp.com/attachments/x.png)')).toBe(false);
    expect(_internal.hasNoImageCdnUrls('https://cdn.discordapp.com/attachments/x.png')).toBe(false);
    expect(_internal.hasReleasePayloadSafety([
      'function katImageEmbed',
      'image: { url: image.url }',
      'payload.embeds = embeds',
      'katSourceFooter',
      'trimKatDiscordContent',
      'KAT_COMMAND_COOLDOWN_MS',
      'KAT_OWNER_ONLY_SUBCOMMANDS',
      'isKatOwnerCommandAllowed',
      'allowedMentions: SAFE_ALLOWED_MENTIONS',
    ].join('\n'))).toBe(true);
    expect(_internal.statusFrom([], { discord_responses_enabled: false, discord_posts_enabled: false })).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(_internal.statusFrom([], { discord_responses_enabled: true, discord_posts_enabled: false })).toBe('PHASE_1_COMMAND_REPLIES_LIVE');
    expect(_internal.statusFrom([], { discord_responses_enabled: true, discord_posts_enabled: true })).toBe('KATBOT_LIVE_READY');
    expect(_internal.configuredCommandChannelsWritable({
      command_channel_permissions: [{ output_ready: true }],
    })).toBe(true);
    expect(_internal.configuredCommandChannelsCovered({
      command_channel_permissions: [{ ref: 'trade-floor', output_ready: true }],
    }, { command_channels: ['trade-floor'] })).toBe(true);
  });
});
