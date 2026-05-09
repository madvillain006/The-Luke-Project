'use strict';

const {
  answerCompanionMemoryQuestion,
  buildCompanionContext,
  captureCompanionMemory,
  handleCompanionMemoryTurn,
  searchCompanionMemory,
  _internal,
} = require('../lib/companion-memory');

function makeHarness(now = new Date('2026-05-08T13:00:00.000Z')) {
  let memory = {};
  return {
    get memory() {
      return memory;
    },
    options: {
      now,
      recordRadar: false,
      loadMemoryFn: () => memory,
      saveMemoryFn: (next) => {
        memory = JSON.parse(JSON.stringify(next));
      },
      paths: {
        ROOT: process.cwd(),
        events: {},
        snapshots: {},
      },
    },
  };
}

describe('Luke companion memory', () => {
  it('captures an appointment in Luke chat and answers it from Trading memory', () => {
    const h = makeHarness();

    const capture = captureCompanionMemory({
      surface: 'system',
      text: 'I have an appointment at 2 with the bank.',
    }, h.options);

    expect(capture.captured).toBe(true);
    expect(capture.entry.kind).toBe('appointment');
    expect(capture.entry.time_hint).toContain('at 2');

    const answer = answerCompanionMemoryQuestion({
      surface: 'trading',
      text: 'what do I have at 2?',
    }, h.options);

    expect(answer.answered).toBe(true);
    expect(answer.reply).toContain('Appointment');
    expect(answer.reply).toContain('bank');
  });

  it('shares active thoughts and preferences in the prompt context', () => {
    const h = makeHarness();

    captureCompanionMemory({
      surface: 'trading',
      text: "I'm thinking about the Radar source quality loop on Friday.",
    }, h.options);
    captureCompanionMemory({
      surface: 'system',
      text: 'I prefer blunt answers when repo state is messy.',
    }, h.options);

    const matches = searchCompanionMemory({ query: 'what was I thinking about Radar?' }, h.options);
    const context = buildCompanionContext({ surface: 'system', message: 'Radar source quality' }, h.options);

    expect(matches[0].kind).toBe('thought');
    expect(context).toContain('Luke Chat and Trading share one companion memory bin');
    expect(context).toContain('Radar source quality loop');
    expect(context).toContain('blunt answers');
  });

  it('handles explicit memory turns before the generic LLM path', () => {
    const h = makeHarness();

    const saved = handleCompanionMemoryTurn({
      surface: 'system',
      text: 'Remember that the front page memorial text stays.',
    }, h.options);

    expect(saved.handled).toBe(true);
    expect(saved.reply).toContain('Saved shared memory');

    const answer = handleCompanionMemoryTurn({
      surface: 'trading',
      text: 'what did I tell you to remember?',
    }, h.options);

    expect(answer.handled).toBe(true);
    expect(answer.reply).toContain('front page memorial text stays');
  });

  it('does not capture generic questions as new memory', () => {
    const h = makeHarness();

    const result = captureCompanionMemory({
      surface: 'system',
      text: 'What should I do with the roadmap?',
    }, h.options);

    expect(result.captured).toBe(false);
    expect(_internal.classifyMemory('What should I do with the roadmap?')).toBe(null);
  });
});

describe('companion memory scope and status fields', () => {
  it('stores scope, status, and recall_reason when provided', () => {
    const h = makeHarness();
    const result = captureCompanionMemory({
      surface: 'system',
      text: 'I have a dentist appointment at 3pm on Friday.',
      scope: 'person',
      status: 'active',
      recall_reason: 'search_match',
    }, h.options);

    expect(result.captured).toBe(true);
    expect(result.entry.scope).toBe('person');
    expect(result.entry.status).toBe('active');
    expect(result.entry.recall_reason).toBe('search_match');
  });

  it('defaults scope to general and status to active when not provided', () => {
    const h = makeHarness();
    const result = captureCompanionMemory({
      surface: 'system',
      text: 'Remind me to follow up with the contractor.',
    }, h.options);

    expect(result.captured).toBe(true);
    expect(result.entry.scope).toBe('general');
    expect(result.entry.status).toBe('active');
    expect(result.entry.recall_reason).toBeNull();
  });

  it('excludeRejected option filters out rejected entries from search', () => {
    const h = makeHarness();
    captureCompanionMemory({
      surface: 'system',
      text: 'I prefer no process narration in responses.',
      status: 'rejected',
    }, h.options);
    captureCompanionMemory({
      surface: 'system',
      text: 'I like blunt answers when the repo is messy.',
      status: 'active',
    }, h.options);

    const withRejected = searchCompanionMemory({ query: 'prefer' }, h.options);
    const withoutRejected = searchCompanionMemory({ query: 'prefer' }, { ...h.options, excludeRejected: true });

    expect(withRejected.some(e => e.status === 'rejected')).toBe(true);
    expect(withoutRejected.every(e => e.status !== 'rejected')).toBe(true);
  });

  it('loads old entries without scope or status fields without error', () => {
    const h = makeHarness();
    const memory = h.memory;
    memory.luke_companion_memory = {
      version: 1,
      updated_at: '2026-01-01T00:00:00.000Z',
      entries: [{
        id: 'mem_legacy_001',
        ts: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        last_seen_at: '2026-01-01T00:00:00.000Z',
        surfaces: ['system'],
        surface: 'system',
        kind: 'note',
        confidence: 0.75,
        text: 'Remember that legacy entries exist.',
        title: 'Remember that legacy entries exist.',
        time_hint: null,
        tags: ['note'],
        active: true,
        source: 'chat',
      }],
    };

    const results = searchCompanionMemory({ query: 'legacy entries' }, h.options);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('mem_legacy_001');
  });
});
