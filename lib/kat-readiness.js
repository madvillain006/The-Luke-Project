'use strict';

const fs = require('fs');
const path = require('path');
const { buildKatAudit } = require('./kat-audit');
const { buildKatTickerWatchlist } = require('./kat-ticker-watchlist');
const { buildKatEquityOptionsUniverse } = require('./kat-equity-options');
const { readKatVisionSignals } = require('./kat-vision-store');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

function hasSourceSafetyGate(sourceText) {
  return sourceText.includes('discordOutputAllowed') &&
    sourceText.includes('Discord reply suppressed by output gate') &&
    sourceText.includes('Discord channel post suppressed by output gate');
}

function hasNoMentionSafety(sourceText) {
  return sourceText.includes('SAFE_ALLOWED_MENTIONS') &&
    sourceText.includes('parse: []') &&
    sourceText.includes('repliedUser: false');
}

function scoreCheck(ok, label, detail, severity) {
  return {
    ok: !!ok,
    label,
    detail,
    severity: severity || (ok ? 'info' : 'blocker'),
  };
}

function recommendationFrom(checks, config) {
  const blockers = checks.filter(check => !check.ok && check.severity === 'blocker');
  const warnings = checks.filter(check => !check.ok && check.severity === 'warning');
  const outputsEnabled = config.discord_responses_enabled === true || config.discord_posts_enabled === true;

  if (outputsEnabled) {
    return {
      status: 'do_not_use_publicly',
      label: 'Discord outputs are enabled before owner approval pack is clean.',
    };
  }

  if (blockers.length) {
    return {
      status: 'not_ready',
      label: 'Keep Kat internal. Fix blockers before showing it to the server owner.',
    };
  }

  if (warnings.length) {
    return {
      status: 'owner_review_ready',
      label: 'Ready for owner review as silent capture and Luke-only shadow evidence, not public Discord answering.',
    };
  }

  return {
    status: 'ready_to_recommend_limited_enable',
    label: 'Ready to recommend limited server-owner enablement with Discord outputs still gated until explicitly approved.',
  };
}

function buildKatReadiness(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const now = options.now || new Date();
  const katDir = path.join(rootDir, 'data', 'kat');
  const derivedDir = path.join(katDir, 'derived');
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const audit = buildKatAudit({ rootDir, now });
  const replaySummary = readJson(path.join(derivedDir, 'kat-replay-summary.json'), null);
  const evaluationSummary = readJson(path.join(derivedDir, 'kat-evaluation-summary.json'), null);
  const watchlist = buildKatTickerWatchlist({ rootDir, now, limit: 10 });
  const equityOptions = buildKatEquityOptionsUniverse({ rootDir, now, limit: 20 });
  const visionSignals = readKatVisionSignals({ rootDir });
  const visionChartCount = visionSignals.filter(row => row.source_class === 'chart').length;
  const visionHeatmapCount = visionSignals.filter(row => row.source_class === 'heatmap').length;
  const sourceText = options.sourceText || readText(path.join(rootDir, 'agents', 'agent-14-kat.js'));
  const runtime = options.runtime || {};

  const checks = [
    scoreCheck((config.monitored_users || []).length > 0, 'monitored analysts configured', `${(config.monitored_users || []).length} configured`),
    scoreCheck((config.monitored_channels || []).length > 0 || (config.monitored_channel_ids || []).length > 0, 'monitored channels configured', `${(config.monitored_channels || []).length} names / ${(config.monitored_channel_ids || []).length} ids`),
    scoreCheck(audit.raw.total > 1000, 'historical capture depth', `${audit.raw.total} raw messages captured`),
    scoreCheck(audit.files.raw_feed.bad_lines === 0, 'raw feed parses cleanly', `${audit.files.raw_feed.bad_lines} malformed raw JSONL lines`),
    scoreCheck(audit.files.processed_signals.bad_lines === 0, 'processed signal feed parses cleanly', `${audit.files.processed_signals.bad_lines} malformed processed JSONL lines`),
    scoreCheck(!!replaySummary, 'index replay artifacts exist', replaySummary ? `${replaySummary.parsed_records || 0} replay records` : 'missing replay summary'),
    scoreCheck(!!evaluationSummary, 'SPX/SPY evaluation artifacts exist', evaluationSummary ? `${evaluationSummary.evaluated || 0}/${evaluationSummary.total || 0} evaluated` : 'missing evaluation summary'),
    scoreCheck(!evaluationSummary || (evaluationSummary.evaluated || 0) >= 250, 'SPX/SPY sample size', evaluationSummary ? `${evaluationSummary.evaluated || 0} evaluated direct records` : 'missing evaluation', 'warning'),
    scoreCheck(watchlist.candidates.length > 0, 'non-index shadow watchlist exists', `${watchlist.candidates.length} candidates`),
    scoreCheck(equityOptions.tickers.length > 0, 'equity/options shadow profiles exist', `${equityOptions.tickers.length} profiles`),
    scoreCheck(equityOptions.ready_for_backtest.length > 0, 'downstream validation queue exists', `${equityOptions.ready_for_backtest.length} ticker(s) ready for backtest`, 'warning'),
    scoreCheck(audit.raw.image_posts === 0 || visionSignals.length > 0, 'analyst chart/heatmap reads are saved', `${visionSignals.length} saved chart/heatmap read(s) for ${audit.raw.image_posts} image post(s)`),
    scoreCheck(audit.raw.image_posts === 0 || visionChartCount > 0, 'chart images are read for levels', `${visionChartCount} saved chart read(s)`),
    scoreCheck(audit.raw.heatmap_candidates === 0 || visionHeatmapCount > 0, 'heatmap images are read for levels', `${visionHeatmapCount} saved heatmap read(s) for ${audit.raw.heatmap_candidates} candidate(s)`),
    scoreCheck(hasSourceSafetyGate(sourceText), 'Discord output gate present', 'safeReply/safeSend suppress Discord output unless explicitly approved'),
    scoreCheck(hasNoMentionSafety(sourceText), 'Discord mention safety present', 'allowedMentions disables parsing and reply pings'),
    scoreCheck(config.discord_responses_enabled !== true, 'Discord command replies gated off', 'responses are disabled unless explicitly approved'),
    scoreCheck(config.discord_posts_enabled !== true, 'Discord channel posts gated off', 'magnet/confluence posts are disabled unless explicitly approved'),
  ];

  if (typeof runtime.bot_online === 'boolean') {
    checks.push(scoreCheck(runtime.bot_online, 'runtime bot online', runtime.bot_online ? 'online' : 'offline', 'warning'));
  }
  if (typeof runtime.poll_active === 'boolean') {
    checks.push(scoreCheck(runtime.poll_active, 'runtime poll active', runtime.poll_active ? 'active' : 'inactive', 'warning'));
  }

  const recommendation = recommendationFrom(checks, config);
  const blockers = checks.filter(check => !check.ok && check.severity === 'blocker').map(check => `${check.label}: ${check.detail}`);
  const warnings = checks.filter(check => !check.ok && check.severity === 'warning').map(check => `${check.label}: ${check.detail}`);

  return {
    generated_at: now.toISOString(),
    recommendation,
    discord_output_gate: {
      responses_enabled: config.discord_responses_enabled === true,
      posts_enabled: config.discord_posts_enabled === true,
      env_override_supported: true,
      approval_required: true,
    },
    evidence: {
      raw_messages: audit.raw.total,
      processed_signals: audit.processed.total,
      heatmap_candidates: audit.raw.heatmap_candidates,
      image_posts: audit.raw.image_posts,
      vision_signals: visionSignals.length,
      vision_chart_signals: visionChartCount,
      vision_heatmap_signals: visionHeatmapCount,
      replay_records: replaySummary ? replaySummary.parsed_records || 0 : 0,
      spx_spy_evaluated: evaluationSummary ? evaluationSummary.evaluated || 0 : 0,
      watchlist_candidates: watchlist.candidates.map(candidate => candidate.ticker),
      equity_options_ready_for_backtest: equityOptions.ready_for_backtest,
    },
    checks,
    blockers,
    warnings,
    owner_review_notes: [
      'Recommend silent capture and Luke-only shadow evidence before any public Discord answering.',
      'Do not enable Discord replies or channel posts until Conor explicitly approves generated wording.',
      'No autonomous execution exists here; all outputs remain human-gated evidence.',
      'Backtesting/scoring remains owned by the separate backtesting lane.',
    ],
  };
}

function formatKatReadinessMarkdown(readiness) {
  const lines = [
    '# Katbot Readiness',
    '',
    `Recommendation: ${readiness.recommendation.status}`,
    readiness.recommendation.label,
    '',
    '## Evidence',
    `- Raw messages: ${readiness.evidence.raw_messages}`,
    `- Processed signals: ${readiness.evidence.processed_signals}`,
    `- Image posts: ${readiness.evidence.image_posts}`,
    `- Heatmap candidates: ${readiness.evidence.heatmap_candidates}`,
    `- Vision signals: ${readiness.evidence.vision_signals} (${readiness.evidence.vision_chart_signals} chart, ${readiness.evidence.vision_heatmap_signals} heatmap)`,
    `- Replay records: ${readiness.evidence.replay_records}`,
    `- SPX/SPY evaluated: ${readiness.evidence.spx_spy_evaluated}`,
    `- Watchlist: ${readiness.evidence.watchlist_candidates.join(', ') || 'none'}`,
    `- Ready for downstream validation: ${readiness.evidence.equity_options_ready_for_backtest.join(', ') || 'none'}`,
    '',
    '## Blockers',
    ...(readiness.blockers.length ? readiness.blockers.map(item => '- ' + item) : ['- none']),
    '',
    '## Warnings',
    ...(readiness.warnings.length ? readiness.warnings.map(item => '- ' + item) : ['- none']),
    '',
    '## Owner Notes',
    `- Discord outputs still gated: replies=${readiness.discord_output_gate.responses_enabled}, posts=${readiness.discord_output_gate.posts_enabled}`,
    ...readiness.owner_review_notes.map(item => '- ' + item),
    '',
  ];
  return lines.join('\n');
}

module.exports = {
  buildKatReadiness,
  formatKatReadinessMarkdown,
  _internal: {
    hasSourceSafetyGate,
    hasNoMentionSafety,
    recommendationFrom,
  },
};
