'use strict';

const {
  normalizeSession,
  runSessionBacktest,
  formatMarkdownReport,
  _internal,
} = require('../lib/es-long-bracket-runner');

function bar(timestamp, open, high, low, close) {
  return { timestamp, open, high, low, close, volume: 1000 };
}

describe('es-long-bracket-runner', () => {
  it('normalizes frozen session levels and setups', () => {
    const session = normalizeSession({
      date: '2026-04-27',
      levels: [7193, { price: '7196', source: 'mancini' }],
      setups: [{ entry: '7190.25' }],
    });

    expect(session.instrument).toBe('ES');
    expect(session.rthOnly).toBe(true);
    expect(session.levels).toEqual([
      { price: 7193, source: 'manual' },
      { price: 7196, source: 'mancini' },
    ]);
    expect(session.setups[0]).toMatchObject({
      id: 'setup-1',
      direction: 'long',
      entry: 7190.25,
      stop: null,
      targets: [],
    });
  });

  it('runs long setups from dated levels and outputs ladder results', () => {
    const session = {
      date: '2026-04-27',
      instrument: 'ES',
      levels: [
        { price: 7193, source: 'saty' },
        { price: 7196, source: 'mancini' },
        { price: 7200, source: 'dubz' },
      ],
      setups: [{
        id: 'long-reclaim',
        time: '2026-04-27T09:35:00-04:00',
        direction: 'long',
        entry: 7190.25,
        stop: 7187.25,
      }],
    };

    const bars = [
      bar('2026-04-27T09:34:00-04:00', 7185, 7210, 7180, 7205),
      bar('2026-04-27T09:35:00-04:00', 7189, 7191, 7188.5, 7190.5),
      bar('2026-04-27T09:36:00-04:00', 7190.5, 7193.25, 7189.75, 7193),
      bar('2026-04-27T09:37:00-04:00', 7193, 7196.25, 7192.5, 7196),
      bar('2026-04-27T09:38:00-04:00', 7196, 7200.5, 7195.5, 7200),
    ];

    const result = runSessionBacktest(session, bars);

    expect(result.summary).toMatchObject({
      totalSetups: 1,
      filled: 1,
      fullLadders: 1,
      netPoints: 18.25,
      netDollars: 912.5,
    });
    expect(result.trades[0].targetSource).toBe('session-levels');
    expect(result.trades[0].simulation.fills.map(fill => fill.type)).toEqual(['tp1', 'tp2', 'tp3']);
  });

  it('uses explicit setup targets before session levels', () => {
    const session = {
      date: '2026-04-27',
      levels: [{ price: 7193, source: 'saty' }],
      setups: [{
        id: 'manual-targets',
        direction: 'long',
        entry: 7190,
        stop: 7187,
        targets: [7191, 7192, 7194],
      }],
    };
    const bars = [
      bar('2026-04-27T09:35:00-04:00', 7189.5, 7191.25, 7189, 7191),
      bar('2026-04-27T09:36:00-04:00', 7191, 7192.25, 7190.75, 7192),
      bar('2026-04-27T09:37:00-04:00', 7192, 7194.25, 7191.75, 7194),
    ];

    const result = runSessionBacktest(session, bars);

    expect(result.trades[0].targetSource).toBe('setup');
    expect(result.trades[0].simulation.targets).toEqual([7191, 7192, 7194]);
  });

  it('skips non-long setups while keeping them visible for later short research', () => {
    const result = runSessionBacktest({
      date: '2026-04-27',
      setups: [
        { id: 'future-short', direction: 'short', entry: 7190, stop: 7193 },
      ],
    }, []);

    expect(result.summary).toMatchObject({
      totalSetups: 1,
      skipped: 1,
      filled: 0,
    });
    expect(result.trades[0]).toMatchObject({
      id: 'future-short',
      status: 'skipped',
      reason: 'long_only_runner',
    });
  });

  it('formats a human-readable report with fill details', () => {
    const result = runSessionBacktest({
      date: '2026-04-27',
      instrument: 'ES',
      levels: [7193, 7196, 7200],
      setups: [{ id: 'long-reclaim', direction: 'long', entry: 7190.25, stop: 7187.25 }],
    }, [
      bar('2026-04-27T09:35:00-04:00', 7189, 7191, 7188.5, 7190.5),
      bar('2026-04-27T09:36:00-04:00', 7190.5, 7193.25, 7189.75, 7193),
    ]);

    const markdown = formatMarkdownReport(result);

    expect(markdown).toContain('# ES Long Bracket Backtest - 2026-04-27');
    expect(markdown).toContain('### long-reclaim');
    expect(markdown).toContain('| Fill | Time | Price | Contracts | Points | Net $ |');
    expect(markdown).toContain('tp1');
  });

  it('filters setup bars from the setup timestamp', () => {
    const bars = [
      bar('2026-04-27T09:34:00-04:00', 1, 1, 1, 1),
      bar('2026-04-27T09:35:00-04:00', 2, 2, 2, 2),
    ];

    expect(_internal.filterBarsFromTime(bars, '2026-04-27T09:35:00-04:00')).toEqual([bars[1]]);
  });
});

