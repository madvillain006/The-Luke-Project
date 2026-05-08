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
    expect(context).toContain('System chat and Trading chat share one companion memory bin');
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
