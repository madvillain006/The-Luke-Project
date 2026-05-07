'use strict';

const fs = require('fs');
const path = require('path');
const {
  llmRoutingStatus,
  messageNeedsAnthropic,
  shouldUseFreeAiFirst,
} = require('../lib/llm-routing-policy');

const ROOT = path.join(__dirname, '..');

describe('LLM routing policy', () => {
  it('routes routine text through free AI first', () => {
    expect(shouldUseFreeAiFirst('hey what is the plan today', { env: {} })).toBe(true);
    expect(messageNeedsAnthropic('hey what is the plan today', { env: {} })).toBe(false);
  });

  it('reserves Anthropic for explicit or heuristic smart tasks', () => {
    expect(messageNeedsAnthropic('goal mode investigate the repo and fix the bug', { env: {} })).toBe(true);
    expect(messageNeedsAnthropic('use claude for deep reasoning on this architecture', { env: {} })).toBe(true);
    expect(messageNeedsAnthropic('x'.repeat(1300), { env: {} })).toBe(true);
    expect(messageNeedsAnthropic('goal mode investigate the repo', { env: { LUKE_ANTHROPIC_MODE: 'off' } })).toBe(false);
  });

  it('exposes the free-first policy in status shape', () => {
    expect(llmRoutingStatus({ LUKE_FREE_AI_FIRST: '1' })).toEqual(expect.objectContaining({
      free_ai_first: true,
      anthropic_mode: 'smart-only',
    }));
  });

  it('keeps live server boot independent of Anthropic and gates vision', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const agent02 = fs.readFileSync(path.join(ROOT, 'agents', 'agent-02-trader.js'), 'utf8');
    const agent04 = fs.readFileSync(path.join(ROOT, 'agents', 'agent-04-health.js'), 'utf8');
    const agent14 = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    const parseBobby = fs.readFileSync(path.join(ROOT, 'lib', 'parse-bobby.js'), 'utf8');
    const parseDubz = fs.readFileSync(path.join(ROOT, 'lib', 'parse-dubz.js'), 'utf8');
    const stackSpine = fs.readFileSync(path.join(ROOT, 'lib', 'brain', 'developer-stack-spine.js'), 'utf8');

    expect(index).toContain('const required_envs = [];');
    expect(index).toContain('const routeNeedsAnthropic = messageNeedsAnthropic(message, { feature: "chat" });');
    expect(index).toContain('allowAnthropic = !hardCapActive && messageNeedsAnthropic(message, { feature: "chat" });');
    expect(index).toContain('preferAnthropic: false');
    expect(index).toContain('Vision is disabled until free-AI image/OCR routing is explicitly authorized.');
    expect(index).toContain('allowAnthropic: false');
    expect(agent02).not.toContain('require("@anthropic-ai/sdk")');
    expect(agent04).not.toContain('require("@anthropic-ai/sdk")');
    expect(agent14).toContain("envFlagEnabled('KATBOT_ENABLE_LIVE_VISION') && envFlagEnabled('LUKE_ALLOW_ANTHROPIC_VISION')");
    expect(parseBobby).toContain('Vision/OCR disabled until LUKE_ALLOW_ANTHROPIC_VISION is enabled.');
    expect(parseDubz).toContain('Vision/OCR disabled until LUKE_ALLOW_ANTHROPIC_VISION is enabled.');
    expect(stackSpine).toContain('Gemini/Groq/DeepSeek/Ollama first');
    expect(stackSpine).not.toContain('Claude first');
  });
});
