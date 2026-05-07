'use strict';

const fs = require('fs');
const path = require('path');
const {
  HEATMAP_REQUESTS_CHANNEL_ID,
  SECONDARY_RESEARCH_CHANNEL_ID,
} = require('./kat-plain-proof');

const REQUIRED_CHANNEL_IDS = [
  HEATMAP_REQUESTS_CHANNEL_ID,
  SECONDARY_RESEARCH_CHANNEL_ID,
];
const LIVE_PROOF_MAX_AGE_MS = 30 * 60 * 1000;
const PLAIN_PROOF_MAX_AGE_MS = 30 * 60 * 1000;

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(file) {
  try {
    if (!fs.existsSync(file)) return '';
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readJsonl(file) {
  const text = readText(file);
  if (!text.trim()) return [];
  return text.split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function check(ok, label, detail, severity = 'blocker') {
  return { ok: !!ok, label, detail, severity };
}

function hasNoImageCdnUrls(text) {
  return !/https:\/\/[^\s>)]*(?:cdn\.discordapp\.com|cdn\.example|attachments)[^\s>)]*/i.test(text || '');
}

function hasReleasePayloadSafety(sourceText) {
  return sourceText.includes('function katImageEmbed') &&
    sourceText.includes('image: { url: image.url }') &&
    sourceText.includes('payload.embeds = embeds') &&
    sourceText.includes('katSourceFooter') &&
    sourceText.includes('trimKatDiscordContent') &&
    sourceText.includes('KAT_COMMAND_COOLDOWN_MS') &&
    sourceText.includes('KAT_OWNER_ONLY_SUBCOMMANDS') &&
    sourceText.includes('isKatOwnerCommandAllowed') &&
    sourceText.includes('allowedMentions: SAFE_ALLOWED_MENTIONS');
}

function liveDiscordProofPassed(liveProofResult) {
  return !!liveProofResult &&
    liveProofResult.ok === true &&
    liveProofResult.status &&
    liveProofResult.status.bot_online === true &&
    liveProofResult.status.poll_active === true &&
    Array.isArray(liveProofResult.blockers) &&
    liveProofResult.blockers.length === 0;
}

function artifactFresh(generatedAt, now, maxAgeMs) {
  const ts = new Date(generatedAt || 0).getTime();
  const nowMs = new Date(now || Date.now()).getTime();
  if (!Number.isFinite(ts) || !Number.isFinite(nowMs)) return false;
  const ageMs = nowMs - ts;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function requiredSourceChannelsReadable(liveProofResult) {
  if (!liveProofResult || !Array.isArray(liveProofResult.source_channel_permissions)) return false;
  const rowsById = new Map(liveProofResult.source_channel_permissions.map(row => [String(row.id), row]));
  return REQUIRED_CHANNEL_IDS.every(id => {
    const row = rowsById.get(String(id));
    return row && row.readable === true;
  });
}

function configuredSourceChannelsReadable(liveProofResult) {
  return !!liveProofResult &&
    Array.isArray(liveProofResult.source_channel_permissions) &&
    liveProofResult.source_channel_permissions.length > 0 &&
    liveProofResult.source_channel_permissions.every(row => row && row.readable === true);
}

function unreadableConfiguredSourceChannels(liveProofResult) {
  if (!liveProofResult || !Array.isArray(liveProofResult.source_channel_permissions)) {
    return ['missing live permission proof'];
  }
  return liveProofResult.source_channel_permissions
    .filter(row => !row || row.readable !== true)
    .map(row => `${row.id}${row.name ? ' (' + row.name + ')' : ''}: readable=${row.readable === true}`);
}

function unreadableRequiredSourceChannels(liveProofResult) {
  if (!liveProofResult || !Array.isArray(liveProofResult.source_channel_permissions)) {
    return REQUIRED_CHANNEL_IDS.map(id => `${id}: missing live permission proof`);
  }
  const rowsById = new Map(liveProofResult.source_channel_permissions.map(row => [String(row.id), row]));
  return REQUIRED_CHANNEL_IDS
    .map(id => rowsById.get(String(id)) || { id, readable: false, name: null })
    .filter(row => row.readable !== true)
    .map(row => `${row.id}${row.name ? ' (' + row.name + ')' : ''}: readable=${row.readable === true}`);
}

function configuredCommandChannelsWritable(liveProofResult) {
  return !!liveProofResult &&
    Array.isArray(liveProofResult.command_channel_permissions) &&
    liveProofResult.command_channel_permissions.length > 0 &&
    liveProofResult.command_channel_permissions.every(row => row && row.output_ready === true);
}

function commandChannelRefs(config) {
  return [...new Set((config.command_channels || [])
    .map(ref => String(ref || '').trim())
    .filter(Boolean))];
}

function commandChannelRowMatchesRef(row, ref) {
  const text = String(ref || '').trim();
  return !!row && [row.ref, row.id, row.name]
    .map(value => String(value || '').trim())
    .includes(text);
}

function configuredCommandChannelsCovered(liveProofResult, config) {
  const refs = commandChannelRefs(config);
  if (!refs.length) return false;
  if (!liveProofResult || !Array.isArray(liveProofResult.command_channel_permissions)) return false;
  return refs.every(ref => liveProofResult.command_channel_permissions.some(row => commandChannelRowMatchesRef(row, ref)));
}

function uncoveredConfiguredCommandChannels(liveProofResult, config) {
  const refs = commandChannelRefs(config);
  if (!liveProofResult || !Array.isArray(liveProofResult.command_channel_permissions)) {
    return refs.length ? refs : ['missing live command-channel proof'];
  }
  return refs.filter(ref => !liveProofResult.command_channel_permissions.some(row => commandChannelRowMatchesRef(row, ref)));
}

function unwritableConfiguredCommandChannels(liveProofResult) {
  if (!liveProofResult || !Array.isArray(liveProofResult.command_channel_permissions)) {
    return ['missing live command-channel permission proof'];
  }
  return liveProofResult.command_channel_permissions
    .filter(row => !row || row.output_ready !== true)
    .map(row => {
      const id = row && (row.id || row.ref) ? (row.id || row.ref) : 'unknown';
      const name = row && row.name ? ' (' + row.name + ')' : '';
      return `${id}${name}: view=${row && row.view === true}, history=${row && row.history === true}, send=${row && row.send === true}, embed=${row && row.embed === true}`;
    });
}

function statusFrom(blockers, config) {
  if (blockers.length) return 'NOT_READY_TO_UNGATE';
  if (config.discord_responses_enabled === true && config.discord_posts_enabled === true) {
    return 'KATBOT_LIVE_READY';
  }
  if (config.discord_responses_enabled === true && config.discord_posts_enabled !== true) {
    return 'PHASE_1_COMMAND_REPLIES_LIVE';
  }
  return 'READY_TO_UNGATE_COMMAND_REPLIES';
}

function buildKatReleaseReadiness(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const now = options.now || new Date();
  const katDir = path.join(rootDir, 'data', 'kat');
  const proofDir = path.join(rootDir, 'artifacts', 'proof', 'katbot-plain');
  const liveProofDir = path.join(rootDir, 'artifacts', 'proof', 'katbot-live');
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const raw = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const proofResult = readJson(path.join(proofDir, 'katbot-proof-result.json'), null);
  const liveProofResult = readJson(path.join(liveProofDir, 'katbot-live-discord-proof.json'), null);
  const proofText = readText(path.join(proofDir, 'katbot-simulated-output.txt'));
  const evaluationSummary = readJson(path.join(katDir, 'derived', 'kat-evaluation-summary.json'), null);
  const replaySummary = readJson(path.join(katDir, 'derived', 'kat-replay-summary.json'), null);
  const sourceText = options.sourceText || readText(path.join(rootDir, 'agents', 'agent-14-kat.js'));

  const monitoredIds = new Set(config.monitored_channel_ids || []);
  const rawCountsByRequiredChannel = Object.fromEntries(REQUIRED_CHANNEL_IDS.map(id => [
    id,
    raw.filter(row => row.channel_id === id).length,
  ]));

  const checks = [
    check(config.enabled === true, 'Kat enabled in config', `enabled=${config.enabled === true}`),
    check((config.monitored_users || []).length >= 4, 'Core analysts configured', `${(config.monitored_users || []).length} monitored user(s)`),
    check((config.command_channels || []).length > 0, 'Command channel configured', `${(config.command_channels || []).length} command channel(s)`),
    check(!!config.magnet_channel, 'Magnet channel configured', config.magnet_channel || 'missing'),
    ...REQUIRED_CHANNEL_IDS.map(id => check(monitoredIds.has(id), `Required channel configured: ${id}`, monitoredIds.has(id) ? 'present' : 'missing')),
    check(liveDiscordProofPassed(liveProofResult), 'Live Discord proof passed', liveProofResult ? `ok=${liveProofResult.ok}` : 'missing live proof'),
    check(artifactFresh(liveProofResult && liveProofResult.generated_at, now, LIVE_PROOF_MAX_AGE_MS), 'Live Discord proof is fresh', liveProofResult && liveProofResult.generated_at ? liveProofResult.generated_at : 'missing live proof timestamp'),
    check(configuredSourceChannelsReadable(liveProofResult), 'Configured source channels readable in live proof', unreadableConfiguredSourceChannels(liveProofResult).join('; ') || 'all configured source channels readable'),
    check(requiredSourceChannelsReadable(liveProofResult), 'Required source channels readable in live proof', unreadableRequiredSourceChannels(liveProofResult).join('; ') || 'all required source channels readable'),
    check(configuredCommandChannelsCovered(liveProofResult, config), 'Configured command channels covered in live proof', uncoveredConfiguredCommandChannels(liveProofResult, config).join('; ') || 'all configured command channels covered'),
    check(configuredCommandChannelsWritable(liveProofResult), 'Configured command channels writable in live proof', unwritableConfiguredCommandChannels(liveProofResult).join('; ') || 'all configured command channels writable'),
    check(hasReleasePayloadSafety(sourceText), 'Discord payload safety present', 'image embeds, source rotation, trimming, cooldown, safe mentions'),
    check(!sourceText.includes("router.get('/execute'") && !sourceText.includes("router.post('/execute'"), 'No Kat execution route', 'no /execute route in Kat agent'),
    check(!!proofResult && proofResult.ok === true, 'Plain proof passed', proofResult ? `ok=${proofResult.ok}` : 'missing proof result'),
    check(!!proofResult && artifactFresh(proofResult.generated_at, now, PLAIN_PROOF_MAX_AGE_MS), 'Plain proof is fresh', proofResult && proofResult.generated_at ? proofResult.generated_at : 'missing proof timestamp'),
    check(hasNoImageCdnUrls(proofText), 'Proof output has no image CDN URLs in content', 'images render as Discord embeds'),
    check(!/https:\/\/discord\.com\/channels\//.test(proofText), 'Proof output omits Discord message link walls', 'no channel/message link walls in public proof'),
    check(!/(?:open chart|open heatmap|image:\s*https?:|image:\s*\[)/i.test(proofText), 'Proof output omits image link text', 'images render below the Discord reply instead of being printed'),
    check(!!replaySummary && replaySummary.parsed_records > 0, 'Replay artifact current enough to exist', replaySummary ? `${replaySummary.parsed_records} parsed records` : 'missing replay summary'),
    check(!!evaluationSummary && evaluationSummary.evaluated > 0, 'Evaluation artifact exists', evaluationSummary ? `${evaluationSummary.evaluated} evaluated` : 'missing evaluation summary'),
    check((evaluationSummary && evaluationSummary.evaluated >= 250) || false, 'SPX/SPY validation sample is still small', evaluationSummary ? `${evaluationSummary.evaluated} evaluated` : 'missing evaluation summary', 'warning'),
    ...REQUIRED_CHANNEL_IDS.map(id => check(rawCountsByRequiredChannel[id] > 0, `Historical rows present for requested channel ${id}`, `${rawCountsByRequiredChannel[id]} historical row(s)`, 'warning')),
  ];

  const blockers = checks.filter(item => !item.ok && item.severity === 'blocker');
  const warnings = checks.filter(item => !item.ok && item.severity === 'warning');
  const status = statusFrom(blockers, config);

  return {
    generated_at: now.toISOString(),
    status,
    recommended_phase: status === 'PHASE_1_COMMAND_REPLIES_LIVE'
      ? 'phase_1_live_monitor_command_replies'
      : status === 'KATBOT_LIVE_READY'
        ? 'katbot_live_replies_and_posts'
      : status === 'READY_TO_UNGATE_COMMAND_REPLIES'
        ? 'phase_1_command_replies_only'
        : 'fix_blockers_first',
    config_state: {
      enabled: config.enabled === true,
      discord_responses_enabled: config.discord_responses_enabled === true,
      discord_posts_enabled: config.discord_posts_enabled === true,
      command_channels: config.command_channels || [],
      magnet_channel: config.magnet_channel || null,
      monitored_channel_ids: config.monitored_channel_ids || [],
      required_channel_rows: rawCountsByRequiredChannel,
      live_discord_proof: liveProofResult ? {
        ok: liveProofResult.ok === true,
        generated_at: liveProofResult.generated_at || null,
        bot_online: liveProofResult.status && liveProofResult.status.bot_online === true,
        poll_active: liveProofResult.status && liveProofResult.status.poll_active === true,
        configured_command_channels_covered: configuredCommandChannelsCovered(liveProofResult, config),
        configured_command_channels_writable: configuredCommandChannelsWritable(liveProofResult),
        configured_source_channels_readable: configuredSourceChannelsReadable(liveProofResult),
        required_source_channels_readable: requiredSourceChannelsReadable(liveProofResult),
      } : null,
    },
    enable_plan: {
      phase_1: {
        discord_responses_enabled: true,
        discord_posts_enabled: false,
        reason: 'Allow summoned !kat command replies in command_channels only. Keep automatic Level Magnet posts gated.',
      },
      phase_2_after_one_clean_session: {
        discord_responses_enabled: true,
        discord_posts_enabled: true,
        reason: 'Enable automatic Level Magnet posts only after live Discord proof verifies clean command replies, embeds, edit, and delete behavior.',
      },
      rollback: {
        discord_responses_enabled: false,
        discord_posts_enabled: false,
        reason: 'Immediate quiet mode; capture continues, public Discord output stops.',
      },
    },
    checks,
    blockers: blockers.map(item => `${item.label}: ${item.detail}`),
    warnings: warnings.map(item => `${item.label}: ${item.detail}`),
  };
}

function formatKatReleaseReadinessMarkdown(report) {
  return [
    '# Katbot Release Readiness',
    '',
    `Status: ${report.status}`,
    `Recommended phase: ${report.recommended_phase}`,
    '',
    '## Current Config',
    `- enabled: ${report.config_state.enabled}`,
    `- replies enabled: ${report.config_state.discord_responses_enabled}`,
    `- posts enabled: ${report.config_state.discord_posts_enabled}`,
    `- command channels: ${report.config_state.command_channels.join(', ') || 'none'}`,
    `- magnet channel: ${report.config_state.magnet_channel || 'none'}`,
    `- live Discord proof: ${report.config_state.live_discord_proof ? report.config_state.live_discord_proof.ok : false}`,
    '',
    '## Blockers',
    ...(report.blockers.length ? report.blockers.map(item => '- ' + item) : ['- none']),
    '',
    '## Warnings',
    ...(report.warnings.length ? report.warnings.map(item => '- ' + item) : ['- none']),
    '',
    '## Enable Plan',
    '- Phase 1: enable command replies only: `discord_responses_enabled=true`, `discord_posts_enabled=false`.',
    '- Phase 2: after one clean session, enable auto posts if wanted: `discord_posts_enabled=true`.',
    '- Rollback: set both Discord output flags to `false`.',
    '',
    '## Checks',
    ...report.checks.map(item => `- ${item.ok ? 'PASS' : item.severity.toUpperCase()}: ${item.label} - ${item.detail}`),
    '',
  ].join('\n');
}

module.exports = {
  REQUIRED_CHANNEL_IDS,
  buildKatReleaseReadiness,
  formatKatReleaseReadinessMarkdown,
  _internal: {
    hasNoImageCdnUrls,
    hasReleasePayloadSafety,
    artifactFresh,
    configuredCommandChannelsCovered,
    configuredSourceChannelsReadable,
    configuredCommandChannelsWritable,
    requiredSourceChannelsReadable,
    statusFrom,
  },
};
