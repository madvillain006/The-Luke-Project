'use strict';

const assert = require('assert');
const { buildSystemPrompt } = require('../lib/system-prompt');

describe('system prompt content', () => {
  it('includes DATA SOURCES AND LIVE TOOLS section', () => {
    const prompt = buildSystemPrompt('', '');
    assert(prompt.includes('DATA SOURCES AND LIVE TOOLS'),
      'system prompt must include data sources section');
    assert(prompt.includes('MASSIVE_API_KEY'),
      'system prompt must mention MASSIVE_API_KEY');
    assert(prompt.includes('Never substitute'),
      'system prompt must include the I-do-not-have-access rule');
    assert(prompt.includes('do not invent a tool'),
      'system prompt must include the symmetric hallucination rule');
  });
});
