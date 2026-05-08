'use strict';

const {
  buildContextBinPrompt,
  buildContextBinsSnapshot,
  classifyContextTurn,
  recordContextTurn,
} = require('../lib/luke-context-bins');

function makeHarness() {
  let store = null;
  return {
    get store() {
      return store;
    },
    options: {
      now: new Date('2026-05-08T13:00:00.000Z'),
      loadStoreFn: () => store,
      saveStoreFn: (next) => {
        store = JSON.parse(JSON.stringify(next));
      },
      paths: {
        events: {},
        snapshots: {},
      },
    },
  };
}

describe('Luke context bins', () => {
  it('routes mixed Luke, Radar, trading, and personal context into rolling bins', () => {
    const h = makeHarness();

    const personal = classifyContextTurn({
      surface: 'system',
      text: 'I have an appointment at 2 and I prefer blunt answers.',
    });
    expect(personal.bins).toContain('personal');
    expect(personal.bins).toContain('daily');

    const trading = classifyContextTurn({
      surface: 'system',
      text: '/status',
    });
    expect(trading.primary_bin).toBe('trading');
    expect(trading.intent).toBe('trading_command');

    recordContextTurn({
      surface: 'system',
      role: 'user',
      text: 'Sybil source says NVDA contradicts the AI capex thesis.',
    }, h.options);
    recordContextTurn({
      surface: 'trading',
      role: 'user',
      text: 'ES Saty level and Mancini reclaim should stay watchlist only.',
    }, h.options);

    const snapshot = buildContextBinsSnapshot({ ...h.options, limit: 4 });
    expect(snapshot.summary_line).toContain('active bins');
    expect(snapshot.bins.radar.count).toBe(1);
    expect(snapshot.bins.trading.count).toBe(2);

    const prompt = buildContextBinPrompt({
      surface: 'system',
      text: 'what was the NVDA source contradiction?',
    }, h.options);
    expect(prompt).toContain('Radar bin');
    expect(prompt).toContain('NVDA contradicts');
  });
});
