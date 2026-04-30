'use strict';

const Anthropic = require('@anthropic-ai/sdk');

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

function isFallbackEligibleError(err) {
  const status = err?.status || err?.statusCode || err?.response?.status;
  if ([429, 500, 502, 503, 504, 529].includes(status)) return true;
  const text = String(err?.message || err || '').toLowerCase();
  return /(rate limit|overloaded|capacity|temporar|timeout|timed out|econnreset|socket hang up|network|token|credit balance|quota)/i.test(text);
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

  try {
    const response = await client.messages.create(request);
    if (typeof trackUsage === 'function') {
      trackUsage(feature, request.model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
    }
    return { provider: 'anthropic', fallback: false, response };
  } catch (err) {
    if (!allowFallback || !isFallbackEligibleError(err)) throw err;

    const { callFallback } = require('../agents/agent-12-fallback');
    const userMessage = fallbackUserMessage || flattenMessages(request.messages) || '[anthropic request omitted]';
    const fallback = await callFallback(fallbackSystem || request.system || null, userMessage);
    return { provider: fallback.provider, fallback: true, text: fallback.reply, upstream_error: err.message };
  }
}

module.exports = {
  anthropicClient: client,
  createMessageWithFallback,
  flattenMessages,
  isFallbackEligibleError,
};
