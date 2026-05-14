'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');
const { buildAutomationBusinessSpine } = require('./automation-business-spine');
const { buildDailySpine } = require('./daily-spine');
const { buildDeveloperStackSpine } = require('./developer-stack-spine');
const { buildHistoryCareerSpine } = require('./history-career-spine');
const { buildRadarBrief, buildRadarItems } = require('./radar-layer');
const { buildReviewLaneStatusReport } = require('../radar/review-lane-status');

const TRADING_KEYWORDS = [
  'trade',
  'trading',
  'market',
  'position',
  'entry',
  'entries',
  'alert',
  'saty',
  'dubz',
  'bobby',
  'mancini',
  'apex',
  'tradovate',
];

const DAILY_KEYWORDS = [
  'day',
  'daily',
  'check in',
  'check-in',
  'weather',
  'brief',
  'briefing',
  'morning brief',
  'afternoon brief',
  'news',
  'nfl',
  'bills',
  'schefter',
  'deitaone',
  'walter bloomberg',
  'today',
  'todo',
  'to do',
  'errand',
];

const HISTORY_CAREER_KEYWORDS = [
  'history',
  'historical',
  'museum',
  'curator',
  'curatorial',
  'consultant',
  'research',
  'archives',
  'public history',
  'digital humanities',
  'ai engineering',
];

const AUTOMATION_BUSINESS_KEYWORDS = [
  'automation',
  'automations',
  'mcp',
  'skill file',
  'context file',
  'case study',
  'outreach',
  'lead',
  'niche',
  'client',
  'proposal',
  'maintenance',
  'mrr',
];

const DEVELOPER_STACK_KEYWORDS = [
  'claude',
  'claude code',
  'gemini',
  'gemma',
  'ollama',
  'local model',
  'local ai',
  'open source model',
  'gpu',
  'api key',
  'provider',
  'fallback',
  'free model',
  'token cost',
  'developer stack',
  'dev stack',
];

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonlTail(file, limit = 20) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function appendJsonl(file, value) {
  ensureParent(file);
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
}

function countJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function newestTimestamp(entries, keys = ['timestamp', 'ts', 'date']) {
  let newest = null;
  for (const entry of entries) {
    for (const key of keys) {
      if (!entry || !entry[key]) continue;
      const ms = new Date(entry[key]).getTime();
      if (Number.isFinite(ms) && (!newest || ms > newest.ms)) {
        newest = { ms, value: entry[key] };
      }
    }
  }
  return newest ? newest.value : null;
}

function staleWarning(label, timestamp, now, maxAgeHours) {
  if (!timestamp) return null;
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return null;
  const ageHours = (now.getTime() - ms) / 3600000;
  return ageHours > maxAgeHours ? `${label} stale for ${Math.round(ageHours)}h` : null;
}

function buildTradingReport(paths = defaultPaths, now = new Date()) {
  const tradingState = readJson(path.join(paths.SNAPSHOTS_DIR, 'trading-state.json'), {});
  const autonomousState = readJson(paths.snapshots.autonomousState, {});
  const schedulerJobs = readJson(paths.snapshots.schedulerJobs, {});
  const recentTrades = readJsonlTail(paths.events.trades, 20);
  const recentPaperTrades = readJsonlTail(paths.events.paperTrades, 20);
  const recentBobby = readJsonlTail(paths.events.bobbyContext, 20);
  const recentDiscord = readJsonlTail(paths.events.discordHistory, 20);
  const latest = {
    trade: newestTimestamp(recentTrades),
    paper_trade: newestTimestamp(recentPaperTrades),
    bobby_context: newestTimestamp(recentBobby),
    discord_signal: newestTimestamp(recentDiscord),
  };
  const staleDataWarnings = [
    staleWarning('Bobby context', latest.bobby_context, now, 24),
    staleWarning('Discord signal history', latest.discord_signal, now, 24),
  ].filter(Boolean);

  const blockers = [];
  if (tradingState.kill_day) blockers.push('daily kill active');
  if (tradingState.kill_week) blockers.push('weekly kill active');
  if (tradingState.open_position) blockers.push('open position exists');
  if (!tradingState.running) blockers.push('trading state not marked running');

  return {
    agent: 'trading',
    label: 'Trading decision-support sub-agent',
    generated_at: now.toISOString(),
    status: blockers.length ? 'attention' : 'nominal',
    mode: tradingState.mode || autonomousState.mode || 'unknown',
    running: tradingState.running === true,
    staged_only: true,
    recommendation_only: true,
    human_gate: 'required',
    open_position: tradingState.open_position || null,
    pending_signal: tradingState.pending_signal || null,
    stale_data_warnings: staleDataWarnings,
    blockers,
    counts: {
      trades: countJsonl(paths.events.trades),
      paper_trades: countJsonl(paths.events.paperTrades),
      bobby_context: countJsonl(paths.events.bobbyContext),
      discord_history: countJsonl(paths.events.discordHistory),
    },
    latest,
    scheduler: {
      known_jobs: Array.isArray(schedulerJobs.jobs) ? schedulerJobs.jobs.length : Object.keys(schedulerJobs || {}).length,
      last_heartbeat: readJson(paths.snapshots.schedulerHeartbeat, {})?.ts || null,
    },
    report_channels: [
      '/status',
      '/verdict ES',
      '/entries ES',
      '/agent/brain/report',
    ],
  };
}

function buildBrainSnapshot(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const reports = readJsonlTail(paths.events.brainReports, options.reportLimit || 20);
  const trading = buildTradingReport(paths, now);
  const automationBusiness = buildAutomationBusinessSpine({ paths, now });
  const daily = buildDailySpine({ paths, now });
  const developerStack = buildDeveloperStackSpine({ paths, now });
  const historyCareer = buildHistoryCareerSpine({ paths, now });
  const reviewLane = buildReviewLaneStatusReport({
    now,
    env: options.env,
    reports,
    radar_items: buildRadarItems({ paths, limit: options.radarLimit || 50 }).items || [],
  }, { now });
  const attention = [];

  if (trading.status !== 'nominal') attention.push({ agent: 'trading', blockers: trading.blockers });
  if (automationBusiness.blockers?.length) attention.push({ agent: 'automation-business', blockers: automationBusiness.blockers });
  if (developerStack.blockers?.length) attention.push({ agent: 'developer-stack', blockers: developerStack.blockers });
  if (daily.status === 'open') attention.push({ agent: 'daily', blockers: daily.checklist.filter(item => item.status === 'open').map(item => item.label) });
  if (historyCareer.blockers?.length) attention.push({ agent: 'history-career', blockers: historyCareer.blockers });
  if (!reports.length) attention.push({ agent: 'brain', blockers: ['no sub-agent reports received yet'] });

  return {
    id: 'luke-brain',
    label: 'Luke local brain',
    generated_at: now.toISOString(),
    role: 'Top-level local orchestration brain for machine/server resident Luke agents.',
    mission: [
      'Coordinate sub-agents without bypassing their safety contracts.',
      'Keep trading as a reporting sub-agent with human-gated execution.',
      'Maintain an auditable local report inbox before adding broader autonomy.',
    ],
    safety_contract: {
      local_first: true,
      human_gate_required_for_trading: true,
      unattended_broker_execution: false,
    },
    subagents: {
      trading,
      automation_business: automationBusiness,
      developer_stack: developerStack,
      daily,
      history_career: historyCareer,
      radar: (() => { try { return buildRadarBrief({ paths, now }); } catch { return { ok: false, summary_line: 'radar unavailable' }; } })(),
      review_lane: reviewLane,
    },
    report_inbox: {
      count: reports.length,
      recent: reports,
    },
    attention,
    next_actions: attention.length
      ? attention.map(item => `${item.agent}: ${item.blockers.join('; ')}`)
      : ['No immediate brain-level blocker detected.'],
  };
}

function recordSubagentReport(report, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const agent = String(report?.agent || '').trim();
  if (!agent) {
    const err = new Error('agent is required');
    err.statusCode = 400;
    throw err;
  }

  const entry = {
    ts: now.toISOString(),
    agent,
    status: report.status || 'reported',
    summary: report.summary || null,
    severity: report.severity || 'info',
    data: report.data || {},
  };
  appendJsonl(paths.events.brainReports, entry);
  ensureParent(paths.snapshots.brainState);
  fs.writeFileSync(paths.snapshots.brainState, JSON.stringify(buildBrainSnapshot({ paths, now }), null, 2), 'utf8');
  return entry;
}

function answerInquiry(input = {}, options = {}) {
  const message = String(input.message || input.inquiry || '').trim();
  const snapshot = buildBrainSnapshot(options);
  if (!message) {
    const err = new Error('message is required');
    err.statusCode = 400;
    throw err;
  }

  const lower = message.toLowerCase();
  const wantsTrading = TRADING_KEYWORDS.some(word => lower.includes(word));
  const wantsAutomationBusiness = AUTOMATION_BUSINESS_KEYWORDS.some(word => lower.includes(word));
  const wantsDeveloperStack = DEVELOPER_STACK_KEYWORDS.some(word => lower.includes(word));
  const wantsDaily = DAILY_KEYWORDS.some(word => lower.includes(word));
  const wantsHistoryCareer = HISTORY_CAREER_KEYWORDS.some(word => lower.includes(word));
  if (wantsTrading) {
    const t = snapshot.subagents.trading;
    return {
      routed_to: 'trading',
      reply: [
        `Trading is ${t.status} in ${t.mode} mode.`,
        `Human gate: ${t.human_gate}; recommendation-only: ${t.recommendation_only ? 'yes' : 'no'}.`,
        t.blockers.length ? `Blockers: ${t.blockers.join('; ')}.` : 'No trading blockers found in current state.',
        'Use /status, /verdict ES, or /entries ES for trading-specific detail.',
      ].join(' '),
      snapshot,
    };
  }

  if (wantsAutomationBusiness) {
    const business = snapshot.subagents.automation_business;
    return {
      routed_to: 'automation-business',
      reply: [
        `Automation-business sub-agent is ${business.status}.`,
        `Selected niche: ${business.pipeline.selected_niche || business.recommended_start.niche}.`,
        `Run rate tracked: $${business.pipeline.monthly_run_rate}.`,
        business.next_actions.length ? `Next: ${business.next_actions[0]}.` : 'No immediate automation-business blocker detected.',
      ].join(' '),
      snapshot,
    };
  }

  if (wantsDeveloperStack) {
    const dev = snapshot.subagents.developer_stack;
    const configured = dev.pipeline.configured_providers.join(', ') || 'none';
    const local = dev.provider_order.find(provider => provider.id === 'ollama');
    return {
      routed_to: 'developer-stack',
      reply: [
        `Developer stack spine is ${dev.status}.`,
        `Provider order: ${dev.provider_order.map(provider => provider.label).join(' -> ')}.`,
        `Configured providers: ${configured}.`,
        `Local lane: ${local?.status || 'unknown'}; ${dev.local_only_truth}`,
      ].join(' '),
      snapshot,
    };
  }

  if (wantsDaily) {
    const daily = snapshot.subagents.daily;
    return {
      routed_to: 'daily',
      reply: [
        `Daily spine is ${daily.status} for ${daily.date}.`,
        `Weather: ${daily.weather.summary}.`,
        `Open: ${daily.checklist.filter(item => item.status === 'open').map(item => item.label).join(', ') || 'none'}.`,
        'Use /agent/brain/daily/brief?kind=morning or kind=afternoon for live markets, NFL, and Bills briefs.',
      ].join(' '),
      snapshot,
    };
  }

  if (wantsHistoryCareer) {
    const career = snapshot.subagents.history_career;
    return {
      routed_to: 'history-career',
      reply: [
        `History-career spine is ${career.status}.`,
        `Accepted leads: ${career.pipeline.accepted}; MLIS-filtered: ${career.pipeline.rejected_mlis}.`,
        `Current tracks: ${career.tracks.map(track => track.label).join(', ')}.`,
      ].join(' '),
      snapshot,
    };
  }

  return {
    routed_to: 'brain',
    reply: [
      'Luke brain is online as the top-level local orchestration layer.',
      `Known sub-agents: ${Object.keys(snapshot.subagents).join(', ')}.`,
      snapshot.attention.length
        ? `Attention: ${snapshot.attention.map(item => `${item.agent}: ${item.blockers.join('; ')}`).join(' | ')}.`
        : 'No immediate brain-level blocker detected.',
    ].join(' '),
    snapshot,
  };
}

module.exports = {
  answerInquiry,
  buildBrainSnapshot,
  buildTradingReport,
  recordSubagentReport,
  _internal: {
    readJson,
    readJsonlTail,
  },
};
