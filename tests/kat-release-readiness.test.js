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

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-release-readiness-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat', 'derived'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts', 'proof', 'katbot-plain'), { recursive: true });
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
  });
  fs.writeFileSync(path.join(root, 'artifacts', 'proof', 'katbot-plain', 'katbot-simulated-output.txt'), [
    'https://discord.com/channels/guild/channel/message',
    'image: attached in Discord payload (chart.png)',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(root, 'agents', 'agent-14-kat.js'), [
    'katDiscordMessageLink',
    'files: katEvidenceFiles',
    'Image attachment failed; use the source message links above',
    'trimKatDiscordContent',
    'KAT_COMMAND_COOLDOWN_MS',
    'KAT_OWNER_ONLY_SUBCOMMANDS',
    'isKatOwnerCommandAllowed',
    'allowedMentions: SAFE_ALLOWED_MENTIONS',
  ].join('\n'), 'utf8');
  return root;
}

describe('Kat release readiness', () => {
  it('passes limited reply ungate when payload safety, proof, and config are clean', () => {
    const root = seedReadyRoot();

    const report = buildKatReleaseReadiness({ rootDir: root, now: new Date('2026-05-05T13:05:00.000Z') });

    expect(report.status).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(report.recommended_phase).toBe('phase_1_command_replies_only');
    expect(report.blockers).toEqual([]);
    expect(report.enable_plan.phase_1.discord_responses_enabled).toBe(true);
    expect(report.enable_plan.phase_1.discord_posts_enabled).toBe(false);
    expect(formatKatReleaseReadinessMarkdown(report)).toContain('Phase 1');
  });

  it('blocks release when proof content still contains image CDN URLs', () => {
    const root = seedReadyRoot();
    fs.writeFileSync(path.join(root, 'artifacts', 'proof', 'katbot-plain', 'katbot-simulated-output.txt'), [
      'https://discord.com/channels/guild/channel/message',
      'https://cdn.discordapp.com/attachments/chart.png',
    ].join('\n'), 'utf8');

    const report = buildKatReleaseReadiness({ rootDir: root });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Proof output has no image CDN URLs');
  });

  it('warns but does not block when newly requested channels have no historical rows', () => {
    const root = seedReadyRoot();
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), []);

    const report = buildKatReleaseReadiness({ rootDir: root });

    expect(report.status).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(report.warnings.join('\n')).toContain('Historical rows present for requested channel');
  });

  it('reports phase 1 live when command replies are enabled and auto posts stay gated', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = false;
    writeJson(configFile, config);

    const report = buildKatReleaseReadiness({ rootDir: root });

    expect(report.status).toBe('PHASE_1_COMMAND_REPLIES_LIVE');
    expect(report.recommended_phase).toBe('phase_1_live_monitor_command_replies');
    expect(report.blockers).toEqual([]);
  });

  it('blocks release when automatic posts are enabled during phase 1', () => {
    const root = seedReadyRoot();
    const configFile = path.join(root, 'data', 'kat', 'monitored-users.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.discord_responses_enabled = true;
    config.discord_posts_enabled = true;
    writeJson(configFile, config);

    const report = buildKatReleaseReadiness({ rootDir: root });

    expect(report.status).toBe('NOT_READY_TO_UNGATE');
    expect(report.blockers.join('\n')).toContain('Auto posts still gated for Phase 1');
  });

  it('recognizes payload safety markers and CDN URL leakage', () => {
    expect(_internal.hasNoImageCdnUrls('image: attached in Discord payload')).toBe(true);
    expect(_internal.hasNoImageCdnUrls('https://cdn.discordapp.com/attachments/x.png')).toBe(false);
    expect(_internal.hasReleasePayloadSafety([
      'katDiscordMessageLink',
      'files: katEvidenceFiles',
      'Image attachment failed; use the source message links above',
      'trimKatDiscordContent',
      'KAT_COMMAND_COOLDOWN_MS',
      'KAT_OWNER_ONLY_SUBCOMMANDS',
      'isKatOwnerCommandAllowed',
      'allowedMentions: SAFE_ALLOWED_MENTIONS',
    ].join('\n'))).toBe(true);
    expect(_internal.statusFrom([], { discord_responses_enabled: false, discord_posts_enabled: false })).toBe('READY_TO_UNGATE_COMMAND_REPLIES');
    expect(_internal.statusFrom([], { discord_responses_enabled: true, discord_posts_enabled: false })).toBe('PHASE_1_COMMAND_REPLIES_LIVE');
  });
});
