'use strict';

const assert = require('assert');
const { buildSystemPrompt, loadTradingContextPacks } = require('../lib/system-prompt');

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

  it('loads durable Heatseeker trading context only for trading messages', () => {
    const packs = loadTradingContextPacks();
    assert(packs.some(pack => pack.id === 'heatseeker-node-reference'),
      'Heatseeker context pack must be discoverable');

    const tradingPrompt = buildSystemPrompt('', 'SPX heatmap king node near a purple zone');
    assert(tradingPrompt.includes('TRADING CONTEXT PACKS'),
      'trading messages should inject trading context packs');
    assert(tradingPrompt.includes('Heatseeker Node Reference'),
      'trading prompt should include Heatseeker context');
    assert(tradingPrompt.includes('King Nodes are the highest absolute value nodes'),
      'trading prompt should include king node guidance');
    assert(tradingPrompt.includes('SPX node interaction margin is roughly 5-10 points'),
      'trading prompt should include SPX interaction margin guidance');

    const nonTradingPrompt = buildSystemPrompt('', 'what should I do about lunch');
    assert(!nonTradingPrompt.includes('TRADING CONTEXT PACKS'),
      'non-trading messages should not inject trading context packs');
  });
});
