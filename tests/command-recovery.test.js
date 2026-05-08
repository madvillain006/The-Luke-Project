'use strict';

const { recoverLukeCommand, _internal } = require('../lib/command-recovery');

describe('Luke command recovery', () => {
  it('recovers mistyped slash commands', () => {
    expect(recoverLukeCommand('/statsu', { surface: 'trading' })).toEqual(expect.objectContaining({
      command: '/status',
      command_name: 'status',
      reason: 'slash-command-typo',
    }));
    expect(recoverLukeCommand('/veridct ES', { surface: 'trading' })).toEqual(expect.objectContaining({
      command: '/verdict ES',
      command_name: 'verdict',
    }));
  });

  it('recovers short natural trading commands only on the trading surface', () => {
    expect(recoverLukeCommand('status', { surface: 'trading' })).toEqual(expect.objectContaining({
      command: '/status',
      reason: 'natural-command',
    }));
    expect(recoverLukeCommand('status', { surface: 'system' })).toBe(null);
    expect(recoverLukeCommand('what is the repo status?', { surface: 'trading' })).toBe(null);
  });

  it('keeps exact slash commands alone', () => {
    expect(recoverLukeCommand('/status', { surface: 'trading' })).toBe(null);
    expect(_internal.editDistance('statsu', 'status')).toBe(2);
  });
});
