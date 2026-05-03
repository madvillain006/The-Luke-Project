'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');

const SUBAGENTS = [
  {
    id: 'provider-router',
    label: 'Provider Router',
    owns: ['Claude primary path', 'Gemini fallback path', 'local Ollama fallback path', 'feature gating'],
    done_events: ['provider_order_confirmed', 'fallback_policy_confirmed'],
  },
  {
    id: 'local-runtime',
    label: 'Local Runtime',
    owns: ['Ollama install', 'local model pull', 'GPU/CPU readiness', 'localhost health'],
    done_events: ['ollama_installed', 'local_model_pulled', 'local_healthcheck_passed'],
  },
  {
    id: 'gemini-key',
    label: 'Gemini Key Lane',
    owns: ['Gemini API key presence', 'secret handling', 'fallback smoke test'],
    done_events: ['gemini_key_configured', 'gemini_smoke_passed'],
  },
  {
    id: 'cost-guard',
    label: 'Cost Guard',
    owns: ['paid-provider limits', 'token spend visibility', 'free/local routing pressure'],
    done_events: ['cost_policy_set', 'usage_check_added'],
  },
  {
    id: 'privacy-guard',
    label: 'Privacy Guard',
    owns: ['local-only mode boundaries', 'provider data egress labeling', 'sensitive prompt routing'],
    done_events: ['privacy_policy_set', 'local_only_rule_set'],
  },
];

const DEFAULT_PROVIDER_ORDER = [
  {
    id: 'claude',
    priority: 1,
    label: 'Regular Claude',
    mode: 'paid-primary',
    requirement: 'ANTHROPIC_API_KEY',
    data_leaves_machine: true,
  },
  {
    id: 'gemini',
    priority: 2,
    label: 'Gemini API',
    mode: 'low-cost-fallback',
    requirement: 'GEMINI_API_KEY or config/fallback-config.json gemini_key',
    data_leaves_machine: true,
  },
  {
    id: 'ollama',
    priority: 3,
    label: 'Ollama local open model',
    mode: 'free-local-fallback',
    requirement: 'Ollama running plus a pulled local model such as Gemma/Llama/Qwen',
    data_leaves_machine: false,
  },
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

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function summarizeEvents(events) {
  const byType = {};
  const byAgent = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    byAgent[event.subagent] = (byAgent[event.subagent] || 0) + 1;
  }
  return { byType, byAgent };
}

function buildSubagentStatus(subagent, events) {
  const owned = events.filter(event => event.subagent === subagent.id);
  const doneKinds = new Set(owned.map(event => event.type));
  const missing = subagent.done_events.filter(type => !doneKinds.has(type));
  const blockers = owned
    .filter(event => event.status === 'blocked')
    .map(event => event.summary || `${event.type} blocked`);

  return {
    id: subagent.id,
    label: subagent.label,
    status: blockers.length ? 'blocked' : missing.length ? 'open' : 'ready',
    owns: subagent.owns,
    completed_event_types: [...doneKinds],
    missing_event_types: missing,
    blockers,
    count: owned.length,
    recent: owned.slice(-5),
  };
}

function getFallbackConfig(paths) {
  const configFile = paths.config?.fallback || defaultPaths.config.fallback;
  return readJson(configFile, {});
}

function getProviderReadiness(paths, env = process.env) {
  const fallbackConfig = getFallbackConfig(paths);
  return DEFAULT_PROVIDER_ORDER.map(provider => {
    let configured = false;
    let status = 'missing';
    if (provider.id === 'claude') {
      configured = Boolean(env.ANTHROPIC_API_KEY);
      status = configured ? 'configured' : 'missing_key';
    } else if (provider.id === 'gemini') {
      configured = Boolean(env.GEMINI_API_KEY || fallbackConfig.gemini_key);
      status = configured ? 'configured' : 'missing_key';
    } else if (provider.id === 'ollama') {
      configured = Boolean(env.OLLAMA_HOST || fallbackConfig.ollama_host);
      status = configured ? 'host_configured_unverified' : 'missing_host';
    }
    return { ...provider, configured, status };
  });
}

function buildDeveloperStackSpine(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const env = options.env || process.env;
  const events = readJsonl(paths.events.developerStackEvents);
  const summary = summarizeEvents(events);
  const subagents = Object.fromEntries(SUBAGENTS.map(agent => [
    agent.id,
    buildSubagentStatus(agent, events),
  ]));
  const blocked = Object.values(subagents).filter(agent => agent.status === 'blocked');
  const providerOrder = getProviderReadiness(paths, env);
  const configured = providerOrder.filter(provider => provider.configured);

  return {
    agent: 'developer-stack',
    label: 'Developer AI Stack Spine',
    generated_at: now.toISOString(),
    status: blocked.length ? 'blocked' : configured.length ? 'building' : 'setup',
    mission: 'Run developer-agent work through a cost-aware provider ladder: Claude first, Gemini second, local Ollama/open-model fallback for free private loops.',
    provider_order: providerOrder,
    local_only_truth: 'Only the Ollama/local-model lane is local-only. Claude and Gemini calls leave the machine.',
    subagents,
    pipeline: {
      events: events.length,
      by_type: summary.byType,
      by_subagent: summary.byAgent,
      configured_providers: configured.map(provider => provider.id),
      recent: events.slice(-12),
    },
    setup_plan: [
      'Keep regular Claude as the first provider when the Anthropic key is available.',
      'Use Gemini as the second provider once GEMINI_API_KEY or fallback config is present.',
      'Install Ollama, pull a local open model, then use that lane for free/private long loops.',
      'Label every route by provider so paid, remote, and local-only work are never confused.',
    ],
    next_actions: Object.values(subagents)
      .filter(agent => agent.status !== 'ready')
      .slice(0, 4)
      .map(agent => `${agent.label}: ${agent.missing_event_types[0] || agent.blockers[0]}`),
  };
}

function recordDeveloperStackEvent(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const subagent = String(input.subagent || '').trim();
  const type = String(input.type || '').trim();
  if (!SUBAGENTS.some(agent => agent.id === subagent)) {
    const err = new Error('known developer-stack subagent is required');
    err.statusCode = 400;
    throw err;
  }
  if (!type) {
    const err = new Error('event type is required');
    err.statusCode = 400;
    throw err;
  }

  const entry = {
    ts: now.toISOString(),
    subagent,
    type,
    status: input.status || 'recorded',
    summary: input.summary || null,
    data: input.data || {},
  };
  ensureParent(paths.events.developerStackEvents);
  fs.appendFileSync(paths.events.developerStackEvents, JSON.stringify(entry) + '\n', 'utf8');
  ensureParent(paths.snapshots.developerStackSpine);
  fs.writeFileSync(paths.snapshots.developerStackSpine, JSON.stringify(buildDeveloperStackSpine({ paths, now }), null, 2), 'utf8');
  return entry;
}

module.exports = {
  SUBAGENTS,
  buildDeveloperStackSpine,
  recordDeveloperStackEvent,
  _internal: {
    getProviderReadiness,
    readJsonl,
  },
};
