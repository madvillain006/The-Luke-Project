'use strict';

const { simulateEsBracketTrade, selectNextTargets } = require('../lib/es-bracket-strategy');

function bar(minute, open, high, low, close) {
  return {
    timestamp: `2026-04-29T09:${String(30 + minute).padStart(2, '0')}:00-04:00`,
    open,
    high,
    low,
    close,
    volume: 100,
  };
}

describe('es-bracket-strategy', () => {
  it('scales out three ES contracts at the next three levels', () => {
    const result = simulateEsBracketTrade({
      direction: 'long',
      entry: 7190.25,
      stop: 7187.25,
      targets: [7193, 7196, 7200],
      bars: [
        bar(0, 7189, 7190.5, 7189, 7190.25),
        bar(1, 7190.25, 7193.25, 7190, 7193),
        bar(2, 7193, 7196.25, 7192.75, 7196),
        bar(3, 7196, 7200.25, 7195.75, 7200),
      ],
    });

    expect(result.status).toBe('filled');
    expect(result.fills.map(f => f.type)).toEqual(['tp1', 'tp2', 'tp3']);
    expect(result.summary.netPoints).toBeCloseTo(18.25);
    expect(result.summary.netDollars).toBeCloseTo(912.5);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'stop_moved', price: 7190.25, reason: 'after_tp1' }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'stop_moved', price: 7193, reason: 'after_tp2' }));
  });

  it('moves stop to breakeven after first target and preserves profit if chop returns', () => {
    const result = simulateEsBracketTrade({
      direction: 'long',
      entry: 7190.25,
      stop: 7187.25,
      targets: [7193, 7196, 7200],
      bars: [
        bar(0, 7189, 7190.5, 7189, 7190.25),
        bar(1, 7190.25, 7193.25, 7190.25, 7193),
        bar(2, 7193, 7193.25, 7189.75, 7190),
      ],
    });

    expect(result.fills.map(f => f.type)).toEqual(['tp1', 'stop']);
    expect(result.fills[1]).toMatchObject({ price: 7190.25, contracts: 2 });
    expect(result.summary.netPoints).toBeCloseTo(2.75);
    expect(result.summary.stoppedAfterTp).toBe(true);
  });

  it('moves stop to first target after second target is reached', () => {
    const result = simulateEsBracketTrade({
      direction: 'long',
      entry: 7190.25,
      stop: 7187.25,
      targets: [7193, 7196, 7200],
      bars: [
        bar(0, 7189, 7190.5, 7189, 7190.25),
        bar(1, 7190.25, 7193.25, 7190.25, 7193),
        bar(2, 7193, 7196.25, 7192.75, 7196),
        bar(3, 7196, 7196.25, 7192.75, 7193),
      ],
    });

    expect(result.fills.map(f => f.type)).toEqual(['tp1', 'tp2', 'stop']);
    expect(result.fills[2]).toMatchObject({ price: 7193, contracts: 1 });
    expect(result.summary.netPoints).toBeCloseTo(11.25);
  });

  it.skip('handles short ladders symmetrically - future short strategy coverage', () => {
    const result = simulateEsBracketTrade({
      direction: 'short',
      entry: 7190,
      stop: 7193,
      targets: [7187, 7184, 7180],
      bars: [
        bar(0, 7191, 7191, 7189.75, 7190),
        bar(1, 7190, 7190.25, 7186.75, 7187),
        bar(2, 7187, 7187.25, 7183.75, 7184),
        bar(3, 7184, 7184.25, 7179.75, 7180),
      ],
    });

    expect(result.fills.map(f => f.type)).toEqual(['tp1', 'tp2', 'tp3']);
    expect(result.summary.netPoints).toBeCloseTo(19);
    expect(result.summary.netDollars).toBeCloseTo(950);
  });

  it('uses conservative same-bar ordering when entry and stop are both possible', () => {
    const result = simulateEsBracketTrade({
      direction: 'long',
      entry: 7190.25,
      stop: 7187.25,
      targets: [7193, 7196, 7200],
      bars: [
        bar(0, 7190, 7194, 7187, 7193),
      ],
    });

    expect(result.events.map(e => e.type)).toContain('conservative_same_bar_stop');
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]).toMatchObject({ type: 'stop', contracts: 3, price: 7187.25 });
    expect(result.summary.netPoints).toBeCloseTo(-9);
  });

  it('exits leftover contracts at close when fewer than three targets exist', () => {
    const result = simulateEsBracketTrade({
      direction: 'long',
      entry: 7190,
      stop: 7187,
      targets: [7193],
      bars: [
        bar(0, 7189, 7190.25, 7189, 7190),
        bar(1, 7190, 7193.25, 7190, 7193),
        bar(2, 7193, 7194, 7192, 7194),
      ],
    });

    expect(result.fills.map(f => f.type)).toEqual(['tp1', 'close']);
    expect(result.fills[1]).toMatchObject({ contracts: 2, price: 7194 });
    expect(result.summary.netPoints).toBeCloseTo(11);
  });

  it('selects the next three non-duplicate targets in trade direction', () => {
    const targets = selectNextTargets([
      { price: 7190.1, source: 'noise' },
      { price: 7193, source: 'saty' },
      { price: 7193.1, source: 'dubz' },
      { price: 7196, source: 'mancini' },
      { price: 7200, source: 'bobby' },
      { price: 7188, source: 'wrong-way' },
    ], 7190, 'long');

    expect(targets.map(t => t.price)).toEqual([7193, 7196, 7200]);
    expect(targets.map(t => t.source)).toEqual(['saty', 'mancini', 'bobby']);
  });
});
