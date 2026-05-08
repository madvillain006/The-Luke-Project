'use strict';

const assert = require('assert');

const {
  answerCompanionMemoryQuestion,
  buildCompanionContext,
  captureCompanionMemory,
  handleCompanionMemoryTurn,
} = require('../lib/companion-memory');
const { recoverLukeCommand } = require('../lib/command-recovery');

let memory = {};
const options = {
  now: new Date('2026-05-08T13:00:00.000Z'),
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
};

const appointment = captureCompanionMemory({
  surface: 'system',
  text: 'I have an appointment at 2 with the bank.',
}, options);
assert.equal(appointment.captured, true);
assert.equal(appointment.entry.kind, 'appointment');

const tradingAnswer = answerCompanionMemoryQuestion({
  surface: 'trading',
  text: 'what do I have at 2?',
}, options);
assert.equal(tradingAnswer.answered, true);
assert.match(tradingAnswer.reply, /bank/i);

const thought = handleCompanionMemoryTurn({
  surface: 'trading',
  text: "I'm thinking about making the Radar source-quality loop quieter.",
}, options);
assert.equal(thought.handled, true);
assert.match(thought.reply, /Saved shared memory/);

const context = buildCompanionContext({
  surface: 'system',
  message: 'Radar source quality',
}, options);
assert.match(context, /Luke Chat and Trading share one companion memory bin/);
assert.match(context, /Radar source-quality loop/);

const recovered = recoverLukeCommand('/statsu', { surface: 'trading' });
assert.equal(recovered.command, '/status');

const systemNatural = recoverLukeCommand('status', { surface: 'system' });
assert.equal(systemNatural, null);

console.log(JSON.stringify({
  ok: true,
  proof: 'companion-memory-loop',
  entries: memory.luke_companion_memory.entries.length,
  appointment_answered_from_trading: true,
  typo_recovered: recovered.command,
  system_natural_status_recovered: false,
}, null, 2));
