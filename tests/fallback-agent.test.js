'use strict';

const fallback = require('../agents/agent-12-fallback');

function fakeResponse({ ok = true, status = 200, statusText = 'OK', body = {} } = {}) {
  return {
    ok,
    status,
    statusText,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  };
}

describe('free AI fallback agent', () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_MODELS: process.env.GEMINI_MODELS,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    FALLBACK_PROVIDER_ORDER: process.env.FALLBACK_PROVIDER_ORDER,
    OLLAMA_HOST: process.env.OLLAMA_HOST,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  };

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('blocks live vision and live trading features from fallback mode', () => {
    expect(fallback.ensureFeatureAllowed('chat')).toBe('chat');
    expect(fallback.ensureFeatureAllowed('status')).toBe('status');
    expect(() => fallback.ensureFeatureAllowed('vision_verify')).toThrow(/Fallback feature blocked/);
    expect(() => fallback.ensureFeatureAllowed('live_trade')).toThrow(/Fallback feature blocked/);
    expect(() => fallback.ensureFeatureAllowed('unregistered_feature')).toThrow(/Fallback feature blocked/);
    expect(fallback.normalizeGeminiModel('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(fallback.parseCsvList('gemini, groq, gemini')).toEqual(['gemini', 'groq']);
  });

  it('reports fallback provider readiness without exposing secrets', () => {
    const readiness = fallback.providerReadiness({
      gemini_key: 'test-gemini-key',
      gemini_models: ['gemini-test'],
      groq_key: '',
      groq_model: 'llama-test',
      deepseek_key: '',
      deepseek_model: 'deepseek-test',
      ollama_configured: true,
      ollama_model: 'llama3',
      provider_order: ['gemini', 'groq', 'ollama'],
    });

    expect(readiness.ok).toBe(true);
    expect(readiness.configured_providers).toEqual(['gemini', 'ollama']);
    expect(readiness.missing_providers).toEqual(['groq']);
    expect(JSON.stringify(readiness)).not.toContain('test-gemini-key');
    expect(readiness.blocked_features).toContain('live_trade');
  });

  it('reports provider HTTP errors without leaking API-key-shaped secrets', async () => {
    const fakeGoogleKey = ['AIza', '123456789012345678901234567890'].join('');
    await expect(fallback.readProviderJson(fakeResponse({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      body: { error: { message: `bad key ${fakeGoogleKey}` } },
    }), 'gemini')).rejects.toThrow('[masked-google-key]');
  });

  it('falls through from failing Gemini to Ollama for allowed text features', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODELS = 'gemini-test-model';
    delete process.env.GROQ_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    process.env.FALLBACK_PROVIDER_ORDER = 'gemini,ollama';
    process.env.OLLAMA_HOST = 'http://ollama.test';
    process.env.OLLAMA_MODEL = 'llama3-test';

    const urls = [];
    global.fetch = async url => {
      urls.push(String(url));
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return fakeResponse({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          body: { error: { message: 'quota exhausted' } },
        });
      }
      return fakeResponse({
        body: { message: { content: 'local fallback ok' } },
      });
    };

    const result = await fallback.callFallback('system', 'hello', { feature: 'chat' });

    expect(result.provider).toBe('ollama');
    expect(result.reply).toBe('local fallback ok');
    expect(urls.some(url => url.includes('generativelanguage.googleapis.com'))).toBe(true);
    expect(urls.some(url => url.includes('/models/gemini-test-model:generateContent'))).toBe(true);
    expect(urls.some(url => url.includes('ollama.test/api/chat'))).toBe(true);
  });

  it('uses configurable Groq Llama models before lower-priority providers', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GROQ_API_KEY = 'gsk_test_key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
    process.env.FALLBACK_PROVIDER_ORDER = 'groq,gemini,ollama';

    let requestBody = null;
    global.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(init.headers.Authorization).toBe('Bearer gsk_test_key');
      requestBody = JSON.parse(init.body);
      return fakeResponse({ body: { choices: [{ message: { content: 'groq ok' } }] } });
    };

    const result = await fallback.callFallback('system', 'hello', { feature: 'chat' });

    expect(result.provider).toBe('groq');
    expect(result.model).toBe('llama-3.3-70b-versatile');
    expect(requestBody.model).toBe('llama-3.3-70b-versatile');
    expect(result.reply).toBe('groq ok');
  });

  it('supports hosted DeepSeek API without requiring a local download', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    const fakeDeepSeekKey = ['sk', 'deepseek-test-key-1234567890'].join('-');
    process.env.DEEPSEEK_API_KEY = fakeDeepSeekKey;
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro';
    process.env.FALLBACK_PROVIDER_ORDER = 'deepseek,ollama';

    let requestBody = null;
    global.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
      expect(init.headers.Authorization).toBe(`Bearer ${fakeDeepSeekKey}`);
      requestBody = JSON.parse(init.body);
      return fakeResponse({ body: { choices: [{ message: { content: 'deepseek ok' } }] } });
    };

    const result = await fallback.callFallback('system', 'hello', { feature: 'chat' });

    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-v4-pro');
    expect(requestBody.model).toBe('deepseek-v4-pro');
    expect(result.reply).toBe('deepseek ok');
  });
});
