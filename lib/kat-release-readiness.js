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
  return !/cdn\.discordapp\.com|cdn\.example|https:\/\/[^\s]+attachments[^\s]+/i.test(text || '');
}

function hasReleasePayloadSafety(sourceText) {
  return sourceText.includes('katDiscordMessageLink') &&
    sourceText.includes('files: katEvidenceFiles') &&
    sourceText.includes('Image attachment failed; use the source message links above') &&
    sourceText.includes('trimKatDiscordContent') &&
    sourceText.includes('KAT_COMMAND_COOLDOWN_MS') &&
    sourceText.includes('KAT_OWNER_ONLY_SUBCOMMANDS') &&
    sourceText.includes('isKatOwnerCommandAllowed') &&
    sourceText.includes('allowedMentions: SAFE_ALLOWED_MENTIONS');
}

function statusFrom(blockers, config) {
  if (blockers.length) return 'NOT_READY_TO_UNGATE';
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
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const raw = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const proofResult = readJson(path.join(proofDir, 'katbot-proof-result.json'), null);
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
    check(config.discord_posts_enabled !== true, 'Auto posts still gated for Phase 1', `discord_posts_enabled=${config.discord_posts_enabled === true}`),
    check(hasReleasePayloadSafety(sourceText), 'Discord payload safety present', 'message links, file attachments, fallback, trimming, cooldown, safe mentions'),
    check(!sourceText.includes("router.get('/execute'") && !sourceText.includes("router.post('/execute'"), 'No Kat execution route', 'no /execute route in Kat agent'),
    check(!!proofResult && proofResult.ok === true, 'Plain proof passed', proofResult ? `ok=${proofResult.ok}` : 'missing proof result'),
    check(hasNoImageCdnUrls(proofText), 'Proof output has no image CDN URLs in content', 'uses message links plus attached-image wording'),
    check(/https:\/\/discord\.com\/channels\//.test(proofText), 'Proof output includes direct Discord message links', 'source messages are clickable'),
    check(/image: attached in Discord payload/i.test(proofText), 'Proof output describes rendered image attachments', 'images are sent as Discord files'),
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
        reason: 'Enable automatic Level Magnet posts only after command replies behave cleanly in the server.',
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
    statusFrom,
  },
};
