'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { freeAiFirst, messageNeedsAnthropic } = require('./llm-routing-policy');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (!part || typeof part !== 'object') return '';
      if (part.type === 'text') return part.text || '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function flattenMessages(messages) {
  if (!Array.isArray(messages)) return '';
  return messages
    .map(msg => extractTextFromContent(msg?.content))
    .filter(Boolean)
    .join('\n\n');
}

function extractAnthropicText(response) {
  return extractTextFromContent(response?.content);
}

function isFallbackEligibleError(err) {
  const status = err?.status || err?.statusCode || err?.response?.status;
  if ([429, 500, 502, 503, 504, 529].includes(status)) return true;
  const text = String(err?.message || err || '').toLowerCase();
  return /(rate limit|overloaded|capacity|temporar|timeout|timed out|econnreset|socket hang up|network|token|credit balance|quota)/i.test(text);
}

async function callFallbackText(system, userMessage, feature) {
  const { callFallback } = require('../agents/agent-12-fallback');
  const fallbackSystem = extractTextFromContent(system) || (typeof system === 'string' ? system : null);
  const fallback = await callFallback(fallbackSystem || null, userMessage || '', { feature });
  return {
    text: fallback.reply || '',
    provider: fallback.provider,
    model: fallback.model || null,
    fallback: true,
  };
}

async function createMessageWithFallback(options) {
  const {
    request,
    feature = 'chat',
    allowFallback = false,
    fallbackSystem = null,
    fallbackUserMessage = null,
    trackUsage = null,
  } = options || {};

  if (!request || typeof request !== 'object') {
    throw new Error('createMessageWithFallback: request object required');
  }

  const userMessage = fallbackUserMessage || flattenMessages(request.messages) || '[anthropic request omitted]';
  const anthropicAllowed = messageNeedsAnthropic(userMessage, { feature });

  if (freeAiFirst() || !anthropicAllowed) {
    try {
      const fallback = await callFallbackText(fallbackSystem || request.system || null, userMessage, feature);
      return { provider: fallback.provider, model: fallback.model, fallback: true, text: fallback.text };
    } catch (err) {
      if (!anthropicAllowed) throw err;
    }
  }

  if (!anthropicAllowed) {
    throw new Error(`Anthropic blocked by LLM routing policy for feature ${feature}`);
  }

  try {
    const response = await client.messages.create(request);
    if (typeof trackUsage === 'function') {
      trackUsage(feature, request.model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
    }
    return { provider: 'anthropic', fallback: false, response };
  } catch (err) {
    if (!allowFallback || !isFallbackEligibleError(err)) throw err;

    const fallback = await callFallbackText(fallbackSystem || request.system || null, userMessage, feature);
    return { ...fallback, upstream_error: err.message };
  }
}

async function createRoutedText(options = {}) {
  const {
    system = null,
    systemPrompt = null,
    messages = null,
    userMessage = null,
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 300,
    feature = 'chat',
    fallbackFeature = feature,
    allowAnthropic = undefined,
    forceAnthropic = false,
    preferAnthropic = false,
    trackUsage = null,
  } = options;

  const promptText = userMessage || flattenMessages(messages);
  const anthropicAllowed = allowAnthropic === undefined
    ? messageNeedsAnthropic(promptText, { feature, forceAnthropic })
    : Boolean(allowAnthropic);
  const shouldTryFree = freeAiFirst() && !preferAnthropic;
  const request = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt || system || undefined,
    messages: messages || [{ role: 'user', content: userMessage || '' }],
  };

  if (shouldTryFree || !anthropicAllowed) {
    try {
      const routed = await callFallbackText(systemPrompt || system || null, promptText, fallbackFeature);
      return { ...routed, anthropic_allowed: anthropicAllowed };
    } catch (fallbackError) {
      if (!anthropicAllowed) throw fallbackError;
    }
  }

  if (!anthropicAllowed) {
    throw new Error(`Anthropic blocked by LLM routing policy for feature ${feature}`);
  }

  const response = await client.messages.create(request);
  if (typeof trackUsage === 'function') {
    trackUsage(feature, model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
  }
  return {
    text: extractAnthropicText(response),
    provider: 'anthropic',
    model,
    fallback: false,
    anthropic_allowed: true,
    response,
  };
}

module.exports = {
  anthropicClient: client,
  createMessageWithFallback,
  createRoutedText,
  extractAnthropicText,
  flattenMessages,
  isFallbackEligibleError,
};
