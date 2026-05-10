'use strict';

const SMART_TASK_RE = /\b(goal mode|100% protocol|implement|fix|debug|repair|audit|review|refactor|architecture|architect|codebase|repo|tests?|patch|production|shippable|strategy|backtest|statistical|stage\s*2|recursive|agent|subagent|analy[sz]e|investigate|research|deep\s+(?:dive|reasoning|analysis)|use\s+(?:claude|anthropic|opus|sonnet))\b/i;

function envFlag(name, fallback = false, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw));
}

function anthropicMode(env = process.env) {
  return String(env.LUKE_ANTHROPIC_MODE || 'smart-only').trim().toLowerCase();
}

function freeAiFirst(env = process.env) {
  return envFlag('LUKE_FREE_AI_FIRST', true, env);
}

function messageNeedsAnthropic(message, options = {}) {
  const mode = anthropicMode(options.env);
  if (mode === 'off' || mode === 'never') return false;
  if (mode === 'always') return true;
  if (options.forceAnthropic === true) return true;
  if (options.feature && ['vision_verify', 'screen_control', 'live_trade', 'research_synth', 'staged_trade_reason', 'signal_score'].includes(options.feature)) {
    return true;
  }
  const text = String(message || '');
  if (text.length > (options.longMessageThreshold || 1200)) return true;
  return SMART_TASK_RE.test(text);
}

function shouldUseFreeAiFirst(message, options = {}) {
  if (!freeAiFirst(options.env)) return false;
  return !messageNeedsAnthropic(message, options);
}

function llmRoutingStatus(env = process.env) {
  const status = {
    free_ai_first: freeAiFirst(env),
    anthropic_mode: anthropicMode(env),
    smart_task_policy: 'Free providers are tried first; Anthropic is reserved for explicit or heuristic smart-task escalation.',
    live_vision_policy: 'Vision/OCR remains blocked unless a vision-specific route explicitly enables it.',
  };
  try {
    const { loadConfig, providerReadiness } = require('../agents/agent-12-fallback');
    status.fallback_readiness = providerReadiness(loadConfig());
  } catch {
    status.fallback_readiness = {
      ok: false,
      provider_order: [],
      configured_providers: [],
      missing_providers: [],
      note: 'fallback readiness unavailable',
    };
  }
  return status;
}

module.exports = {
  llmRoutingStatus,
  messageNeedsAnthropic,
  shouldUseFreeAiFirst,
  freeAiFirst,
  _internal: {
    SMART_TASK_RE,
    anthropicMode,
    envFlag,
    freeAiFirst,
  },
};
