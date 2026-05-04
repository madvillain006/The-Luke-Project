'use strict';

const fs = require('fs');
const path = require('path');
const { buildKatAudit } = require('./kat-audit');
const { buildKatTickerWatchlist } = require('./kat-ticker-watchlist');
const { buildKatEquityOptionsUniverse } = require('./kat-equity-options');
const { buildKatReadiness } = require('./kat-readiness');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function readJsonlTail(file, limit) {
  try {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function formatPct(rate) {
  if (!rate || rate.pct == null) return 'n/a';
  return rate.pct.toFixed(2).replace(/\.00$/, '') + '%';
}

function formatAge(ts, now) {
  if (!ts) return 'never';
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return 'unknown';
  const ageMs = now.getTime() - ms;
  if (ageMs < 0) return 'future';
  const mins = Math.floor(ageMs / 60000);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 48) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

function buildKatInsights(options) {
  const opts = options || {};
  const rootDir = opts.rootDir || path.join(__dirname, '..');
  const now = opts.now || new Date();
  const katDir = path.join(rootDir, 'data', 'kat');
  const derivedDir = path.join(katDir, 'derived');
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const activity = readJson(path.join(katDir, 'activity.json'), {});
  const replaySummary = readJson(path.join(derivedDir, 'kat-replay-summary.json'), null);
  const evaluationSummary = readJson(path.join(derivedDir, 'kat-evaluation-summary.json'), null);
  const runtime = opts.runtime || {};
  const recentEvaluations = readJsonlTail(path.join(derivedDir, 'kat-spx-spy-evaluations.jsonl'), 250)
    .filter(row => row.status === 'evaluated')
    .slice(-10)
    .reverse();
  const audit = buildKatAudit({ rootDir });
  const watchlist = buildKatTickerWatchlist({ rootDir, now });
  const equityOptions = buildKatEquityOptionsUniverse({ rootDir, now, limit: 20 });
  const readiness = buildKatReadiness({ rootDir, now, runtime });

  const latestActivityTs = Object.values(activity).sort().slice(-1)[0] || null;
  const artifactsReady = !!(replaySummary && evaluationSummary);
  const blockers = [];
  if (!config.enabled) blockers.push('Kat capture is disabled.');
  if (runtime.bot_online === false) blockers.push('Kat Discord client is offline in the running Luke process.');
  if (runtime.poll_active === false) blockers.push('Kat confluence poll is not active.');
  if (!latestActivityTs) blockers.push('No Kat activity has been recorded.');
  if (!artifactsReady) blockers.push('Kat replay artifacts missing. Run node scripts/replay-kat.js.');
  if (audit.raw.duplicate_message_ids > 0) blockers.push(`${audit.raw.duplicate_message_ids} duplicate Discord message ids are present in raw feed; replay skips them.`);
  if (evaluationSummary && evaluationSummary.evaluated < 250) {
    blockers.push('SPX/SPY evaluation sample is still thin; do not promote to trade recommendation authority.');
  }

  const helpfulOutputs = [
    'Luke can consume Kat replay summaries through /agent/kat/insights.',
    'Discord users can query !kat status or !kat summary instead of waiting for rare confluence alerts.',
    'Discord users can query !kat watchlist to see repeated non-index tickers under shadow review.',
    'Discord users can query !kat equity TICKER or !kat options TICKER to inspect shadow equity/options evidence.',
    'The backtesting agent can use data/kat/derived/kat-index-replay.jsonl and kat-spx-spy-evaluations.jsonl when it finishes its current lane.',
  ];

  const nextActions = [
    'Import more SPX/SPY market bars covering the raw Kat date range so more than 114 direct signals can be scored.',
    'Run historical image parsing for the 700 heatmap candidates and attach parsed levels by message_id.',
    'Collect market data for the top non-index Kat watchlist symbols before scoring or recommending them.',
    'Split analyst scorecards by ticker, time of day, signal type, and heatmap agreement before trusting any single aggregate win rate.',
    'Add a scheduled Discord EOD summary only after the command-based summary is verified in the live server.',
  ];

  return {
    generated_at: now.toISOString(),
    status: blockers.length ? 'degraded' : 'ok',
    config: {
      enabled: !!config.enabled,
      monitored_users_count: (config.monitored_users || []).length,
      monitored_channels_count: (config.monitored_channels || []).length,
      magnet_channel: config.magnet_channel || null,
      command_channels: config.command_channels || [],
    },
    runtime: {
      bot_online: typeof runtime.bot_online === 'boolean' ? runtime.bot_online : null,
      poll_active: typeof runtime.poll_active === 'boolean' ? runtime.poll_active : null,
      bot_tag: runtime.bot_tag || null,
    },
    activity: {
      latest_capture: latestActivityTs,
      latest_capture_age: formatAge(latestActivityTs, now),
      by_user: activity,
    },
    audit: {
      raw_messages: audit.raw.total,
      processed_signals: audit.processed.total,
      image_posts: audit.raw.image_posts,
      heatmap_candidates: audit.raw.heatmap_candidates,
      index_mention_posts: audit.raw.index_mention_posts,
      duplicate_message_ids: audit.raw.duplicate_message_ids,
    },
    replay: replaySummary,
    evaluation: evaluationSummary,
    watchlist,
    equity_options: equityOptions,
    readiness: {
      recommendation: readiness.recommendation,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      discord_output_gate: readiness.discord_output_gate,
    },
    recent_evaluated_examples: recentEvaluations.map(row => ({
      ts: row.ts,
      analyst: row.analyst,
      ticker: row.ticker,
      direction: row.direction,
      entry: row.entry,
      outcome_30m: row.outcomes && row.outcomes['30m'] ? row.outcomes['30m'] : null,
      heatmap_candidate: !!row.heatmap_candidate,
      recommendation: row.recommendation ? row.recommendation.recommendation : null,
    })),
    blockers,
    helpful_outputs: helpfulOutputs,
    next_actions: nextActions,
  };
}

function formatKatInsightsForDiscord(insights) {
  const replay = insights.replay || {};
  const evaluation = insights.evaluation || {};
  const lines = [
    '**Kat status**',
    'Capture: ' + (insights.config.enabled ? 'enabled' : 'disabled') +
      ' | last seen: ' + insights.activity.latest_capture_age,
    'Discord: ' + (insights.runtime.bot_online === null
      ? 'unknown'
      : insights.runtime.bot_online ? 'online' : 'offline') +
      ' | poll: ' + (insights.runtime.poll_active === null
        ? 'unknown'
        : insights.runtime.poll_active ? 'active' : 'inactive'),
    'Raw: ' + insights.audit.raw_messages +
      ' messages | images: ' + insights.audit.image_posts +
      ' | heatmaps: ' + insights.audit.heatmap_candidates,
    'Replay: ' + (replay.parsed_records || 0) +
      ' index records | SPX/SPY direct: ' + (replay.spx_options_direct_records || 0),
    'Evaluated: ' + (evaluation.evaluated || 0) + '/' + (evaluation.total || 0) +
      ' | 30m baseline: ' + formatPct(evaluation.win_rate_30m),
    'Watchlist: ' + ((insights.watchlist && insights.watchlist.candidates || [])
      .slice(0, 3)
      .map(c => c.ticker + ' (' + c.mentions + ')')
      .join(', ') || 'none yet'),
    'Equity/options: ' + ((insights.equity_options && insights.equity_options.tickers || [])
      .slice(0, 3)
      .map(c => c.ticker + ' ' + c.asset_scope)
      .join(', ') || 'none yet'),
    'Readiness: ' + (insights.readiness && insights.readiness.recommendation
      ? insights.readiness.recommendation.status
      : 'unknown'),
    '_Human-gated shadow evidence only. QQQ/NDX/NQ are context, not SPX-equivalent._',
  ];
  if (insights.blockers.length) {
    lines.push('Blockers: ' + insights.blockers.slice(0, 2).join(' | '));
  }
  return lines.join('\n');
}

function buildKatHandoffMarkdown(insights) {
  const evaluation = insights.evaluation || {};
  const replay = insights.replay || {};
  return [
    '# Katbot Handoff',
    '',
    '## Purpose',
    'Katbot is the Discord analyst ingestion and index-confluence engine. It is not an execution bot.',
    '',
    '## Current Evidence',
    `- Raw messages: ${insights.audit.raw_messages}`,
    `- Image posts: ${insights.audit.image_posts}`,
    `- Heatmap candidates: ${insights.audit.heatmap_candidates}`,
    `- Replay index records: ${replay.parsed_records || 0}`,
    `- SPX/SPY direct records: ${replay.spx_options_direct_records || 0}`,
    `- Evaluable SPX/SPY records: ${evaluation.evaluated || 0}/${evaluation.total || 0}`,
    `- 30m directional baseline: ${formatPct(evaluation.win_rate_30m)}`,
    `- Shadow watchlist: ${(insights.watchlist && insights.watchlist.candidates || []).map(c => `${c.ticker} (${c.mentions})`).join(', ') || 'none yet'}`,
    `- Equity/options shadow universe: ${(insights.equity_options && insights.equity_options.tickers || []).slice(0, 10).map(c => `${c.ticker} ${c.asset_scope}`).join(', ') || 'none yet'}`,
    `- Readiness: ${insights.readiness && insights.readiness.recommendation ? insights.readiness.recommendation.status : 'unknown'}`,
    '',
    '## Scope Rule',
    '- Direct SPX options lane is SPX/SPY only.',
    '- QQQ/NDX/NQ are separate index context until validated.',
    '- Single-name equities are shadow-watch only until market data and scoring exist.',
    '',
    '## Files For The Next Agent',
    '- data/kat/derived/kat-index-replay.jsonl',
    '- data/kat/derived/kat-replay-summary.json',
    '- data/kat/derived/kat-spx-spy-evaluations.jsonl',
    '- data/kat/derived/kat-evaluation-summary.json',
    '- /agent/kat/insights watchlist field',
    '- /agent/kat/equity-options',
    '- /agent/kat/equity-options/:ticker',
    '- /agent/kat/readiness',
    '- /agent/kat/readiness.md',
    '',
    '## Next Work',
    ...insights.next_actions.map(action => '- ' + action),
    '',
  ].join('\n');
}

module.exports = {
  buildKatInsights,
  formatKatInsightsForDiscord,
  buildKatHandoffMarkdown,
  _internal: {
    formatPct,
    formatAge,
    readJson,
    readJsonlTail,
  },
};
